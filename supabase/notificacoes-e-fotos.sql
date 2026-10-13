-- =====================================================================
-- Várias fotos por ponto + notificações no celular (Web Push)
--
-- Rode depois dos outros arquivos. Pode rodar mais de uma vez.
-- ATENÇÃO: em outro projeto, troque o endereço da função "notificar"
-- em disparar_notificacoes() pelo do seu projeto Supabase.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Fotos: um ponto pode ter até 3 fotos (folha, flor, fruto...)
-- ---------------------------------------------------------------------

alter table public.pontos add column if not exists fotos text[] not null default '{}';
update public.pontos set fotos = array[foto_path] where foto_path is not null and fotos = '{}';

drop policy if exists fotos_ver on storage.objects;
create policy fotos_ver on storage.objects for select to authenticated
  using (bucket_id = 'fotos'
         and ((storage.foldername(name))[1] = auth.uid()::text
              or exists (select 1 from public.pontos p
                         where p.foto_path = objects.name or objects.name = any (p.fotos))));

create or replace function public.excluir_minha_conta() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_usuario uuid := auth.uid();
  v_perfil public.perfis%rowtype;
begin
  if v_usuario is null then
    raise exception 'Não autenticado';
  end if;

  select * into v_perfil from public.perfis where id = v_usuario;
  if v_perfil.papel = 'zelador' and v_perfil.aprovado and (
    select count(*) from public.perfis
    where terreiro_id = v_perfil.terreiro_id and papel = 'zelador' and aprovado
  ) = 1 then
    raise exception 'unico_zelador';
  end if;

  delete from public.pontos where criado_por = v_usuario and visibilidade = 'privado';
  update public.pontos set foto_path = null, fotos = '{}' where criado_por = v_usuario;
  delete from public.obrigacoes where criado_por = v_usuario and visibilidade = 'privado';
  delete from auth.users where id = v_usuario;
end $$;

-- ---------------------------------------------------------------------
-- Notificações
-- ---------------------------------------------------------------------

create extension if not exists pg_net;

-- Cada celular que ativou as notificações
create table if not exists public.push_inscricoes (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfis (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- Fila de mensagens a enviar (só a função "notificar" lê)
create table if not exists public.notificacoes (
  id bigserial primary key,
  perfil_id uuid not null references public.perfis (id) on delete cascade,
  titulo text not null,
  corpo text,
  url text,
  enviada boolean not null default false,
  created_at timestamptz not null default now()
);

-- Chaves do Web Push: geradas pela própria função na primeira vez; ninguém digita.
create table if not exists public.config_push (
  id integer primary key default 1 check (id = 1),
  chave_publica text not null,
  chave_privada text not null
);

alter table public.push_inscricoes enable row level security;
alter table public.notificacoes enable row level security;
alter table public.config_push enable row level security;
revoke all on public.push_inscricoes, public.notificacoes, public.config_push from anon, authenticated;
grant select on public.push_inscricoes to authenticated;

drop policy if exists inscricoes_ler on public.push_inscricoes;
create policy inscricoes_ler on public.push_inscricoes for select to authenticated
  using (perfil_id = auth.uid());

-- Salvar/remover a inscrição deste celular (um celular pertence a uma pessoa por vez)
create or replace function public.salvar_inscricao(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  delete from public.push_inscricoes where endpoint = p_endpoint;
  insert into public.push_inscricoes (perfil_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth);
end $$;

create or replace function public.remover_inscricao(p_endpoint text) returns void
language sql security definer set search_path = '' as $$
  delete from public.push_inscricoes where endpoint = p_endpoint and perfil_id = auth.uid()
$$;

revoke execute on function public.salvar_inscricao(text, text, text), public.remover_inscricao(text) from public, anon;
grant execute on function public.salvar_inscricao(text, text, text), public.remover_inscricao(text) to authenticated;

-- Avisa a função "notificar" que há mensagens na fila
create or replace function public.disparar_notificacoes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://ppjfqicxopmdpzrglijf.supabase.co/functions/v1/notificar',
    body := '{}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return null;
end $$;

drop trigger if exists notificacoes_enviar on public.notificacoes;
create trigger notificacoes_enviar after insert on public.notificacoes
  for each statement execute function public.disparar_notificacoes();

-- Quem cuida de validar numa casa (validadores e zeladores aprovados)
create or replace function public.avisar_validadores(p_terreiro uuid, p_exceto uuid, p_titulo text, p_corpo text, p_url text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notificacoes (perfil_id, titulo, corpo, url)
  select id, p_titulo, p_corpo, p_url
  from public.perfis
  where terreiro_id = p_terreiro and aprovado and papel in ('validador', 'zelador')
    and id is distinct from p_exceto
$$;

-- Novo pedido de entrada → zeladores da casa e administradores
create or replace function public.notificar_novo_membro() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not new.aprovado and new.terreiro_id is not null then
    insert into public.notificacoes (perfil_id, titulo, corpo, url)
    select p.id, 'Novo pedido de entrada',
           new.apelido || ' quer entrar em ' || coalesce((select nome from public.terreiros where id = new.terreiro_id), 'sua casa') || '.',
           '#/painel'
    from public.perfis p
    where p.aprovado and ((p.terreiro_id = new.terreiro_id and p.papel = 'zelador') or p.admin);
  end if;
  return new;
end $$;

drop trigger if exists perfil_novo_notificar on public.perfis;
create trigger perfil_novo_notificar after insert on public.perfis
  for each row execute function public.notificar_novo_membro();

-- Pedido aprovado → a própria pessoa
create or replace function public.notificar_aprovacao() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not old.aprovado and new.aprovado then
    insert into public.notificacoes (perfil_id, titulo, corpo, url)
    values (new.id, 'Você foi aprovado(a)!', 'Seu acesso ao Axé Plantas foi liberado. Toque para abrir o mapa.', '#/');
  end if;
  return new;
end $$;

drop trigger if exists perfil_aprovado_notificar on public.perfis;
create trigger perfil_aprovado_notificar after update on public.perfis
  for each row execute function public.notificar_aprovacao();

-- Folha nova pendente → validadores da casa
create or replace function public.notificar_folha() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'pendente' and new.terreiro_id is not null then
    perform public.avisar_validadores(new.terreiro_id, new.criado_por,
      'Folha nova para conferir', new.nome_popular || ' foi cadastrada e espera validação.', '#/painel');
  end if;
  return new;
end $$;

drop trigger if exists folha_nova_notificar on public.folhas;
create trigger folha_nova_notificar after insert on public.folhas
  for each row execute function public.notificar_folha();

-- Ponto novo pendente → validadores da casa; ponto aprovado → quem marcou
create or replace function public.notificar_ponto() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_folha text := coalesce((select nome_popular from public.folhas where id = new.folha_id), 'Folha');
begin
  if tg_op = 'INSERT' and new.status = 'pendente' then
    perform public.avisar_validadores(new.terreiro_id, new.criado_por,
      'Ponto novo para conferir', v_folha || ' foi marcada no mapa e espera validação.', '#/painel');
  elsif tg_op = 'UPDATE' and old.status = 'pendente' and new.status = 'validado'
        and new.criado_por is not null and new.criado_por is distinct from auth.uid() then
    insert into public.notificacoes (perfil_id, titulo, corpo, url)
    values (new.criado_por, 'Seu ponto foi aprovado', v_folha || ' já aparece no mapa.', '#/?folha=' || new.folha_id);
  end if;
  return new;
end $$;

drop trigger if exists ponto_notificar on public.pontos;
create trigger ponto_notificar after insert or update on public.pontos
  for each row execute function public.notificar_ponto();

-- A função "notificar" roda com a chave de serviço; ela precisa de acesso a estas tabelas.
grant select, insert, update, delete on public.config_push, public.notificacoes, public.push_inscricoes to service_role;
grant usage, select on sequence public.notificacoes_id_seq to service_role;
