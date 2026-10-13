-- =====================================================================
-- Convites por link (administrador → zelador → filhos)
--
-- * O administrador cria terreiros no app e gera um link para o zelador.
-- * O zelador entra pelo link já aprovado e gera links para os filhos.
-- * Os filhos entram pelo link e aguardam a aprovação do zelador
--   (ou do administrador).
--
-- Rode este arquivo DEPOIS do schema.sql. Pode ser executado mais de uma vez.
-- =====================================================================

-- Perfis: administrador e terreiro opcional (o administrador pode não ter casa)
alter table public.perfis add column if not exists admin boolean not null default false;
alter table public.perfis alter column terreiro_id drop not null;

-- O código fixo por terreiro foi substituído pelos links de convite
alter table public.terreiros drop column if exists codigo_convite;

create table if not exists public.convites (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  tipo text not null check (tipo in ('admin', 'zelador', 'membro')),
  terreiro_id uuid references public.terreiros (id) on delete cascade,
  criado_por uuid references public.perfis (id) on delete set null,
  usos integer not null default 0,
  usos_max integer,
  expira_em timestamptz,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.sou_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select admin from public.perfis where id = auth.uid() and aprovado), false)
$$;

-- Cadastro: o perfil nasce a partir do link de convite
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
    v_convite.terreiro_id,
    case when v_convite.tipo = 'zelador' then 'zelador' else 'membro' end,
    v_convite.tipo in ('admin', 'zelador'),
    v_convite.tipo = 'admin',
    now(),
    new.raw_user_meta_data ->> 'versao_termos'
  );

  update public.convites set usos = usos + 1 where id = v_convite.id;
  return new;
end $$;

-- O que o link mostra antes do cadastro (funciona sem login)
create or replace function public.info_convite(p_codigo text)
returns table (tipo text, terreiro text, nacao text)
language sql stable security definer set search_path = '' as $$
  select c.tipo, t.nome, t.nacao
  from public.convites c
  left join public.terreiros t on t.id = c.terreiro_id
  where c.codigo = trim(p_codigo)
    and c.ativo
    and (c.expira_em is null or c.expira_em > now())
    and (c.usos_max is null or c.usos < c.usos_max)
$$;

-- Gera um link. Zelador: só para filhos da própria casa. Administrador: qualquer um.
create or replace function public.criar_convite(p_terreiro uuid, p_tipo text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_codigo text;
begin
  if p_tipo in ('admin', 'zelador') and not public.sou_admin() then
    raise exception 'Somente o administrador pode convidar zeladores';
  end if;
  if p_tipo = 'membro' and not (public.sou_admin() or (public.sou_zelador() and p_terreiro = public.meu_terreiro())) then
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
  where id = p_convite
    and (public.sou_admin() or (public.sou_zelador() and terreiro_id = public.meu_terreiro()));
  if not found then
    raise exception 'Convite não encontrado';
  end if;
end $$;

-- Administrador cria um terreiro e já recebe o link para o zelador
create or replace function public.criar_terreiro(p_nome text, p_nacao text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_terreiro uuid;
begin
  if not public.sou_admin() then
    raise exception 'Somente o administrador pode criar terreiros';
  end if;
  insert into public.terreiros (nome, nacao) values (trim(p_nome), trim(p_nacao)) returning id into v_terreiro;
  return public.criar_convite(v_terreiro, 'zelador');
end $$;

-- Administrador escolhe a própria casa e o próprio papel nela
create or replace function public.entrar_no_terreiro(p_terreiro uuid, p_papel text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.sou_admin() then
    raise exception 'Somente o administrador';
  end if;
  if p_papel not in ('membro', 'validador', 'zelador') then
    raise exception 'Papel inválido';
  end if;
  update public.perfis set terreiro_id = p_terreiro, papel = p_papel where id = auth.uid();
end $$;

-- Gerenciar membros: zelador na própria casa; administrador em todas
create or replace function public.gerenciar_membro(p_usuario uuid, p_aprovado boolean, p_papel text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (public.sou_admin() or public.sou_zelador()) then
    raise exception 'Somente zeladores podem gerenciar membros';
  end if;
  if p_usuario = auth.uid() then
    raise exception 'Você não pode alterar o seu próprio acesso';
  end if;
  if p_papel not in ('membro', 'validador', 'zelador') then
    raise exception 'Papel inválido';
  end if;
  update public.perfis
     set aprovado = p_aprovado, papel = p_papel
   where id = p_usuario and (public.sou_admin() or terreiro_id = public.meu_terreiro());
  if not found then
    raise exception 'Membro não encontrado no seu terreiro';
  end if;
end $$;

create or replace function public.remover_membro(p_usuario uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (public.sou_admin() or public.sou_zelador()) then
    raise exception 'Somente zeladores podem remover membros';
  end if;
  if p_usuario = auth.uid() then
    raise exception 'Você não pode remover a si mesmo';
  end if;
  if not exists (
    select 1 from public.perfis
    where id = p_usuario and (public.sou_admin() or terreiro_id = public.meu_terreiro())
  ) then
    raise exception 'Membro não encontrado no seu terreiro';
  end if;
  delete from auth.users where id = p_usuario;
end $$;

-- Permissões
alter table public.convites enable row level security;
revoke all on public.convites from anon, authenticated;
grant select on public.convites to authenticated;

drop policy if exists convites_ler on public.convites;
create policy convites_ler on public.convites for select to authenticated
  using (public.sou_admin() or (public.sou_zelador() and terreiro_id = public.meu_terreiro()));

drop policy if exists perfis_ler on public.perfis;
create policy perfis_ler on public.perfis for select to authenticated
  using (id = auth.uid()
         or public.sou_admin()
         or (public.sou_zelador() and terreiro_id = public.meu_terreiro()));

revoke execute on function
  public.criar_convite(uuid, text), public.desativar_convite(uuid),
  public.criar_terreiro(text, text), public.entrar_no_terreiro(uuid, text)
  from public, anon;
grant execute on function
  public.criar_convite(uuid, text), public.desativar_convite(uuid),
  public.criar_terreiro(text, text), public.entrar_no_terreiro(uuid, text)
  to authenticated;
grant execute on function public.info_convite(text) to anon, authenticated;
