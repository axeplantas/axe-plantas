-- =====================================================================
-- Uma pessoa em várias casas (Ideia: filho de mais de um terreiro)
--
-- Cada pessoa tem um vínculo (membros) com cada casa, com papel próprio
-- (membro, validador, zelador), aprovação própria e a função extra de
-- contador. A "casa ativa" é a escolhida no app (perfis.terreiro_id);
-- perfis.papel e perfis.aprovado são uma cópia do vínculo da casa ativa,
-- mantida pelo próprio banco.
--
-- Rode depois de notificacoes-e-fotos.sql. Pode rodar mais de uma vez.
-- =====================================================================

create table if not exists public.membros (
  perfil_id uuid not null references public.perfis (id) on delete cascade,
  terreiro_id uuid not null references public.terreiros (id) on delete cascade,
  papel text not null default 'membro' check (papel in ('membro', 'validador', 'zelador')),
  aprovado boolean not null default false,
  contador boolean not null default false,       -- função extra: confere mensalidades
  mensalidade_valor numeric(10, 2),              -- vazio = valor padrão da casa
  isento boolean not null default false,         -- não paga mensalidade
  aprovado_em timestamptz,
  created_at timestamptz not null default now(),
  primary key (perfil_id, terreiro_id)
);

create index if not exists membros_terreiro_idx on public.membros (terreiro_id);

-- Quem já usava o app continua na mesma casa, com o mesmo papel.
insert into public.membros (perfil_id, terreiro_id, papel, aprovado, isento, aprovado_em, created_at)
select id, terreiro_id, papel, aprovado, papel = 'zelador', case when aprovado then created_at end, created_at
from public.perfis
where terreiro_id is not null
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Quem sou eu (na casa ativa) e o que posso em cada casa
-- ---------------------------------------------------------------------

create or replace function public.meu_terreiro() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.terreiro_id
  from public.perfis p
  join public.membros m on m.perfil_id = p.id and m.terreiro_id = p.terreiro_id
  where p.id = auth.uid() and m.aprovado
$$;

create or replace function public.papel_na_casa_ativa() returns text
language sql stable security definer set search_path = '' as $$
  select m.papel
  from public.perfis p
  join public.membros m on m.perfil_id = p.id and m.terreiro_id = p.terreiro_id
  where p.id = auth.uid() and m.aprovado
$$;

create or replace function public.sou_validador() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.papel_na_casa_ativa() in ('validador', 'zelador'), false)
$$;

create or replace function public.sou_zelador() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.papel_na_casa_ativa() = 'zelador', false)
$$;

create or replace function public.sou_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select admin from public.perfis where id = auth.uid()), false)
$$;

create or replace function public.eh_membro_de(p_terreiro uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.membros where perfil_id = auth.uid() and terreiro_id = p_terreiro and aprovado)
$$;

create or replace function public.eh_zelador_de(p_terreiro uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.membros
                 where perfil_id = auth.uid() and terreiro_id = p_terreiro and aprovado and papel = 'zelador')
$$;

-- Equipe da casa: zelador e validadores
create or replace function public.eh_equipe_de(p_terreiro uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.membros
                 where perfil_id = auth.uid() and terreiro_id = p_terreiro and aprovado
                   and papel in ('validador', 'zelador'))
$$;

-- Quem cuida do dinheiro: zelador ou contador
create or replace function public.eh_gestor_financeiro_de(p_terreiro uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.membros
                 where perfil_id = auth.uid() and terreiro_id = p_terreiro and aprovado
                   and (papel = 'zelador' or contador))
$$;

-- ---------------------------------------------------------------------
-- perfis.papel / perfis.aprovado acompanham o vínculo da casa ativa
-- ---------------------------------------------------------------------

create or replace function public.sincronizar_casa_ativa(p_perfil uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_ativa uuid;
  v_vinculo public.membros%rowtype;
begin
  select terreiro_id into v_ativa from public.perfis where id = p_perfil;

  select * into v_vinculo from public.membros where perfil_id = p_perfil and terreiro_id = v_ativa;
  if not found then
    -- A casa ativa deixou de existir para a pessoa: escolhe outra (aprovada primeiro).
    select * into v_vinculo from public.membros
    where perfil_id = p_perfil
    order by aprovado desc, aprovado_em desc nulls last, created_at
    limit 1;
  end if;

  if found then
    update public.perfis p
       set terreiro_id = v_vinculo.terreiro_id,
           papel = v_vinculo.papel,
           aprovado = v_vinculo.aprovado or p.admin
     where p.id = p_perfil;
  else
    update public.perfis p set terreiro_id = null, papel = 'membro', aprovado = p.admin where p.id = p_perfil;
  end if;
end $$;

create or replace function public.ao_mudar_vinculo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform public.sincronizar_casa_ativa(old.perfil_id);
    return old;
  end if;
  if tg_op = 'INSERT' then
    -- Quem ainda não tem casa ativa passa a ter esta.
    update public.perfis set terreiro_id = new.terreiro_id where id = new.perfil_id and terreiro_id is null;
  end if;
  perform public.sincronizar_casa_ativa(new.perfil_id);
  return new;
end $$;

drop trigger if exists membros_sincronizar on public.membros;
create trigger membros_sincronizar after insert or update or delete on public.membros
  for each row execute function public.ao_mudar_vinculo();

create or replace function public.antes_aprovar_vinculo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.aprovado and (tg_op = 'INSERT' or not old.aprovado) then
    new.aprovado_em := coalesce(new.aprovado_em, now());
  end if;
  return new;
end $$;

drop trigger if exists membros_aprovado_em on public.membros;
create trigger membros_aprovado_em before insert or update on public.membros
  for each row execute function public.antes_aprovar_vinculo();

-- Trocar de casa no app
create or replace function public.trocar_casa(p_terreiro uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.membros where perfil_id = auth.uid() and terreiro_id = p_terreiro) then
    raise exception 'Você não faz parte desta casa';
  end if;
  update public.perfis set terreiro_id = p_terreiro where id = auth.uid();
  perform public.sincronizar_casa_ativa(auth.uid());
end $$;

-- ---------------------------------------------------------------------
-- Cadastro e convites
-- ---------------------------------------------------------------------

create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_convite public.convites%rowtype;
begin
  select * into v_convite
  from public.convites
  where codigo = trim(new.raw_user_meta_data ->> 'convite')
    and ativo
    and (expira_em is null or expira_em > now())
    and (usos_max is null or usos < usos_max)
  for update;

  if not found then
    raise exception 'convite_invalido';
  end if;
  if coalesce((new.raw_user_meta_data ->> 'consentimento')::boolean, false) is not true then
    raise exception 'consentimento_obrigatorio';
  end if;

  insert into public.perfis (id, apelido, terreiro_id, papel, aprovado, admin, consentimento_em, versao_termos)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'apelido'), ''), 'Sem nome'),
    null, 'membro', v_convite.tipo = 'admin', v_convite.tipo = 'admin',
    now(), new.raw_user_meta_data ->> 'versao_termos'
  );

  if v_convite.terreiro_id is not null then
    insert into public.membros (perfil_id, terreiro_id, papel, aprovado, isento)
    values (new.id, v_convite.terreiro_id,
            case when v_convite.tipo = 'zelador' then 'zelador' else 'membro' end,
            v_convite.tipo = 'zelador', v_convite.tipo = 'zelador');
  end if;

  update public.convites set usos = usos + 1 where id = v_convite.id;
  return new;
end $$;

-- Quem já tem conta usa o link para entrar em mais uma casa
create or replace function public.aceitar_convite(p_codigo text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_convite public.convites%rowtype;
  v_nome text;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  select * into v_convite
  from public.convites
  where codigo = trim(p_codigo)
    and ativo
    and (expira_em is null or expira_em > now())
    and (usos_max is null or usos < usos_max)
  for update;
  if not found then
    raise exception 'convite_invalido';
  end if;

  if v_convite.tipo = 'admin' then
    update public.perfis set admin = true, aprovado = true where id = auth.uid();
    v_nome := 'Administração';
  else
    if exists (select 1 from public.membros where perfil_id = auth.uid() and terreiro_id = v_convite.terreiro_id) then
      raise exception 'ja_membro';
    end if;
    insert into public.membros (perfil_id, terreiro_id, papel, aprovado, isento)
    values (auth.uid(), v_convite.terreiro_id,
            case when v_convite.tipo = 'zelador' then 'zelador' else 'membro' end,
            v_convite.tipo = 'zelador', v_convite.tipo = 'zelador');
    update public.perfis set terreiro_id = v_convite.terreiro_id where id = auth.uid();
    perform public.sincronizar_casa_ativa(auth.uid());
    select nome into v_nome from public.terreiros where id = v_convite.terreiro_id;
  end if;

  update public.convites set usos = usos + 1 where id = v_convite.id;
  return v_nome;
end $$;

create or replace function public.criar_convite(p_terreiro uuid, p_tipo text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_codigo text;
begin
  if p_tipo in ('admin', 'zelador') and not public.sou_admin() then
    raise exception 'Somente o administrador pode convidar zeladores';
  end if;
  if p_tipo = 'membro' and not (public.sou_admin() or public.eh_zelador_de(p_terreiro)) then
    raise exception 'Somente o zelador da casa pode convidar filhos';
  end if;
  if p_tipo <> 'admin' and p_terreiro is null then
    raise exception 'Escolha o terreiro';
  end if;

  insert into public.convites (tipo, terreiro_id, criado_por, usos_max, expira_em)
  values (
    p_tipo,
    case when p_tipo = 'admin' then null else p_terreiro end,
    auth.uid(),
    case when p_tipo = 'membro' then null else 1 end,
    now() + case when p_tipo = 'membro' then interval '30 days' else interval '7 days' end
  )
  returning codigo into v_codigo;
  return v_codigo;
end $$;

create or replace function public.desativar_convite(p_convite uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.convites set ativo = false
  where id = p_convite and (public.sou_admin() or public.eh_zelador_de(terreiro_id));
  if not found then
    raise exception 'Convite não encontrado';
  end if;
end $$;

drop policy if exists convites_ler on public.convites;
create policy convites_ler on public.convites for select to authenticated
  using (public.sou_admin() or public.eh_zelador_de(terreiro_id));

-- ---------------------------------------------------------------------
-- Gerenciar os filhos de uma casa (zelador da casa ou administrador)
-- ---------------------------------------------------------------------

create or replace function public.atualizar_membro(
  p_usuario uuid, p_terreiro uuid, p_aprovado boolean, p_papel text,
  p_contador boolean, p_isento boolean, p_mensalidade numeric
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_atual public.membros%rowtype;
begin
  if not (public.sou_admin() or public.eh_zelador_de(p_terreiro)) then
    raise exception 'Somente o zelador da casa pode fazer isso';
  end if;
  if p_papel not in ('membro', 'validador', 'zelador') then
    raise exception 'Papel inválido';
  end if;
  select * into v_atual from public.membros where perfil_id = p_usuario and terreiro_id = p_terreiro;
  if not found then
    raise exception 'Membro não encontrado nesta casa';
  end if;
  if p_usuario = auth.uid() and not public.sou_admin()
     and (p_papel <> v_atual.papel or p_aprovado <> v_atual.aprovado) then
    raise exception 'Você não pode alterar o seu próprio acesso';
  end if;

  update public.membros
     set aprovado = p_aprovado, papel = p_papel, contador = p_contador,
         isento = p_isento, mensalidade_valor = p_mensalidade
   where perfil_id = p_usuario and terreiro_id = p_terreiro;
end $$;

-- Tira a pessoa da casa (a conta continua existindo para as outras casas).
create or replace function public.remover_da_casa(p_usuario uuid, p_terreiro uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.sou_admin() or public.eh_zelador_de(p_terreiro)) then
    raise exception 'Somente o zelador da casa pode remover membros';
  end if;
  if p_usuario = auth.uid() then
    raise exception 'Você não pode remover a si mesmo';
  end if;
  delete from public.membros where perfil_id = p_usuario and terreiro_id = p_terreiro;
  if not found then
    raise exception 'Membro não encontrado nesta casa';
  end if;
end $$;

-- Versões antigas, usadas por apps ainda não atualizados (agem na casa ativa).
create or replace function public.gerenciar_membro(p_usuario uuid, p_aprovado boolean, p_papel text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.membros%rowtype;
begin
  select * into v from public.membros
  where perfil_id = p_usuario and terreiro_id = (select terreiro_id from public.perfis where id = auth.uid());
  if not found then
    raise exception 'Membro não encontrado no seu terreiro';
  end if;
  perform public.atualizar_membro(p_usuario, v.terreiro_id, p_aprovado, p_papel, v.contador, v.isento, v.mensalidade_valor);
end $$;

create or replace function public.remover_membro(p_usuario uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.remover_da_casa(p_usuario, (select terreiro_id from public.perfis where id = auth.uid()));
end $$;

-- Administrador entra numa casa com o papel que escolher
create or replace function public.entrar_no_terreiro(p_terreiro uuid, p_papel text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.sou_admin() then
    raise exception 'Somente o administrador';
  end if;
  if p_papel not in ('membro', 'validador', 'zelador') then
    raise exception 'Papel inválido';
  end if;
  insert into public.membros (perfil_id, terreiro_id, papel, aprovado, isento)
  values (auth.uid(), p_terreiro, p_papel, true, p_papel = 'zelador')
  on conflict (perfil_id, terreiro_id) do update set papel = excluded.papel, aprovado = true;
  update public.perfis set terreiro_id = p_terreiro where id = auth.uid();
  perform public.sincronizar_casa_ativa(auth.uid());
end $$;

-- Excluir conta: não deixa nenhuma casa sem zelador
create or replace function public.excluir_minha_conta() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_usuario uuid := auth.uid();
begin
  if v_usuario is null then
    raise exception 'Não autenticado';
  end if;
  if exists (
    select 1 from public.membros m
    where m.perfil_id = v_usuario and m.aprovado and m.papel = 'zelador'
      and not exists (select 1 from public.membros o
                      where o.terreiro_id = m.terreiro_id and o.perfil_id <> v_usuario
                        and o.aprovado and o.papel = 'zelador')
  ) then
    raise exception 'unico_zelador';
  end if;

  delete from public.pontos where criado_por = v_usuario and visibilidade = 'privado';
  update public.pontos set foto_path = null, fotos = '{}' where criado_por = v_usuario;
  delete from public.obrigacoes where criado_por = v_usuario and visibilidade = 'privado';
  delete from auth.users where id = v_usuario;
end $$;

-- ---------------------------------------------------------------------
-- Notificações: agora pelos vínculos
-- ---------------------------------------------------------------------

drop trigger if exists perfil_novo_notificar on public.perfis;
drop trigger if exists perfil_aprovado_notificar on public.perfis;

create or replace function public.avisar_validadores(p_terreiro uuid, p_exceto uuid, p_titulo text, p_corpo text, p_url text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notificacoes (perfil_id, titulo, corpo, url)
  select perfil_id, p_titulo, p_corpo, p_url
  from public.membros
  where terreiro_id = p_terreiro and aprovado and papel in ('validador', 'zelador')
    and perfil_id is distinct from p_exceto
$$;

create or replace function public.notificar_vinculo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_casa text := coalesce((select nome from public.terreiros where id = new.terreiro_id), 'sua casa');
  v_apelido text := coalesce((select apelido from public.perfis where id = new.perfil_id), 'Alguém');
begin
  if tg_op = 'INSERT' and not new.aprovado then
    insert into public.notificacoes (perfil_id, titulo, corpo, url)
    select distinct m.perfil_id, 'Novo pedido de entrada', v_apelido || ' quer entrar em ' || v_casa || '.', '#/painel'
    from public.membros m
    where m.terreiro_id = new.terreiro_id and m.aprovado and m.papel = 'zelador'
    union
    select p.id, 'Novo pedido de entrada', v_apelido || ' quer entrar em ' || v_casa || '.', '#/painel'
    from public.perfis p where p.admin;
  elsif tg_op = 'UPDATE' and new.aprovado and not old.aprovado then
    insert into public.notificacoes (perfil_id, titulo, corpo, url)
    values (new.perfil_id, 'Você foi aprovado(a)!', 'Seu acesso a ' || v_casa || ' foi liberado. Toque para abrir.', '#/');
  end if;
  return new;
end $$;

drop trigger if exists membros_notificar on public.membros;
create trigger membros_notificar after insert or update on public.membros
  for each row execute function public.notificar_vinculo();

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------

alter table public.membros enable row level security;
revoke all on public.membros from anon, authenticated;
grant select on public.membros to authenticated;
grant select, insert, update, delete on public.membros to service_role;

drop policy if exists membros_ler on public.membros;
create policy membros_ler on public.membros for select to authenticated
  using (perfil_id = auth.uid()
         or public.sou_admin()
         or public.eh_zelador_de(terreiro_id)
         or public.eh_gestor_financeiro_de(terreiro_id));

-- Perfis: cada um vê o seu; zelador e contador veem os da casa; admin vê todos.
drop policy if exists perfis_ler on public.perfis;
create policy perfis_ler on public.perfis for select to authenticated
  using (id = auth.uid()
         or public.sou_admin()
         or exists (select 1 from public.membros m
                    where m.perfil_id = perfis.id
                      and (public.eh_zelador_de(m.terreiro_id) or public.eh_gestor_financeiro_de(m.terreiro_id))));

revoke execute on function
  public.trocar_casa(uuid), public.aceitar_convite(text),
  public.atualizar_membro(uuid, uuid, boolean, text, boolean, boolean, numeric),
  public.remover_da_casa(uuid, uuid)
  from public, anon;
grant execute on function
  public.trocar_casa(uuid), public.aceitar_convite(text),
  public.atualizar_membro(uuid, uuid, boolean, text, boolean, boolean, numeric),
  public.remover_da_casa(uuid, uuid)
  to authenticated;

-- Zelador (ou administrador) edita o nome e a nação da própria casa
create or replace function public.atualizar_terreiro(p_terreiro uuid, p_nome text, p_nacao text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.sou_admin() or public.eh_zelador_de(p_terreiro)) then
    raise exception 'Somente o zelador da casa pode editar os dados dela';
  end if;
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Informe o nome da casa';
  end if;
  update public.terreiros set nome = trim(p_nome), nacao = trim(p_nacao) where id = p_terreiro;
end $$;

revoke execute on function public.atualizar_terreiro(uuid, text, text) from public, anon;
grant execute on function public.atualizar_terreiro(uuid, text, text) to authenticated;
