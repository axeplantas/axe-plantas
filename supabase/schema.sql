-- =====================================================================
-- Axé Plantas — estrutura do banco de dados (Supabase / Postgres)
--
-- Como usar: no painel do Supabase, abra "SQL Editor", cole este arquivo
-- inteiro e clique em "Run". Pode ser executado mais de uma vez.
--
-- Regras principais:
--  * Ninguém entra sem o código de convite do terreiro.
--  * Todo novo membro fica "aguardando" até um zelador da casa aprovar.
--  * Folhas e pontos cadastrados por membros ficam pendentes até um
--    validador (ou zelador) do MESMO terreiro aprovar.
--  * O fundamento (Orixás, usos) é de cada casa: só a própria casa vê.
--  * Pontos podem ser: privado (só eu), terreiro (minha casa) ou rede
--    (os três terreiros).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------

create table if not exists public.terreiros (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nacao text not null,
  codigo_convite text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  apelido text not null,
  terreiro_id uuid not null references public.terreiros (id),
  papel text not null default 'membro' check (papel in ('membro', 'validador', 'zelador')),
  aprovado boolean not null default false,
  consentimento_em timestamptz,      -- aceite dos termos e da política (LGPD)
  versao_termos text,
  created_at timestamptz not null default now()
);

-- Para bancos criados antes desta coluna existir
alter table public.perfis add column if not exists consentimento_em timestamptz;
alter table public.perfis add column if not exists versao_termos text;

create table if not exists public.folhas (
  id uuid primary key default gen_random_uuid(),
  nome_popular text not null,
  nome_ritual text,            -- Yorubá, Kikongo, Tupi...
  outros_nomes text,           -- nomes regionais
  nome_cientifico text,
  toxica boolean not null default false,
  alerta text,                 -- ex.: "não confundir com..."
  status text not null default 'pendente' check (status in ('pendente', 'validada', 'recusada')),
  terreiro_id uuid not null references public.terreiros (id),
  criado_por uuid references public.perfis (id) on delete set null,
  validado_por uuid references public.perfis (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.fundamentos (
  folha_id uuid not null references public.folhas (id) on delete cascade,
  terreiro_id uuid not null references public.terreiros (id),
  orixas text,
  usos text,
  observacoes text,
  atualizado_em timestamptz not null default now(),
  primary key (folha_id, terreiro_id)
);

create table if not exists public.pontos (
  id uuid primary key default gen_random_uuid(),
  folha_id uuid not null references public.folhas (id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  foto_path text,
  observacao text,
  visibilidade text not null default 'rede' check (visibilidade in ('privado', 'terreiro', 'rede')),
  status text not null default 'pendente' check (status in ('pendente', 'validado', 'recusado')),
  terreiro_id uuid not null references public.terreiros (id),
  criado_por uuid references public.perfis (id) on delete set null,
  validado_por uuid references public.perfis (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists pontos_folha_idx on public.pontos (folha_id);
create index if not exists folhas_terreiro_idx on public.folhas (terreiro_id);

-- ---------------------------------------------------------------------
-- Funções de apoio (quem sou eu?)
-- ---------------------------------------------------------------------

create or replace function public.meu_terreiro() returns uuid
language sql stable security definer set search_path = '' as $$
  select terreiro_id from public.perfis where id = auth.uid() and aprovado
$$;

create or replace function public.sou_validador() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select papel in ('validador', 'zelador') from public.perfis where id = auth.uid() and aprovado),
    false)
$$;

create or replace function public.sou_zelador() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select papel = 'zelador' from public.perfis where id = auth.uid() and aprovado),
    false)
$$;

-- ---------------------------------------------------------------------
-- Cadastro: cria o perfil a partir do código de convite do terreiro
-- ---------------------------------------------------------------------

create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_terreiro uuid;
begin
  select id into v_terreiro
  from public.terreiros
  where codigo_convite = upper(trim(new.raw_user_meta_data ->> 'codigo_convite'));

  if v_terreiro is null then
    raise exception 'codigo_convite_invalido';
  end if;

  if coalesce((new.raw_user_meta_data ->> 'consentimento')::boolean, false) is not true then
    raise exception 'consentimento_obrigatorio';
  end if;

  insert into public.perfis (id, apelido, terreiro_id, consentimento_em, versao_termos)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'apelido'), ''), 'Sem nome'),
    v_terreiro,
    now(),
    new.raw_user_meta_data ->> 'versao_termos'
  );
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.novo_usuario();

-- ---------------------------------------------------------------------
-- Preenchimento automático (o celular não consegue "forjar" esses campos)
-- ---------------------------------------------------------------------

create or replace function public.antes_inserir_folha() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.criado_por := auth.uid();
  new.terreiro_id := public.meu_terreiro();
  if public.sou_validador() then
    new.status := 'validada';
    new.validado_por := auth.uid();
  else
    new.status := 'pendente';
    new.validado_por := null;
  end if;
  return new;
end $$;

create or replace function public.antes_alterar_folha() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.criado_por := old.criado_por;
  new.terreiro_id := old.terreiro_id;
  if new.status is distinct from old.status then
    new.validado_por := auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists folha_insert on public.folhas;
create trigger folha_insert before insert on public.folhas
  for each row execute function public.antes_inserir_folha();
drop trigger if exists folha_update on public.folhas;
create trigger folha_update before update on public.folhas
  for each row execute function public.antes_alterar_folha();

create or replace function public.antes_inserir_ponto() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.criado_por := auth.uid();
  new.terreiro_id := public.meu_terreiro();
  -- Ponto privado não precisa de validação; validador aprova o próprio.
  if new.visibilidade = 'privado' or public.sou_validador() then
    new.status := 'validado';
    new.validado_por := auth.uid();
  else
    new.status := 'pendente';
    new.validado_por := null;
  end if;
  return new;
end $$;

create or replace function public.antes_alterar_ponto() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.criado_por := old.criado_por;
  new.terreiro_id := old.terreiro_id;
  if new.status is distinct from old.status then
    new.validado_por := auth.uid();
  end if;
  return new;
end $$;

create or replace function public.antes_salvar_fundamento() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.terreiro_id := public.meu_terreiro();
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists ponto_insert on public.pontos;
create trigger ponto_insert before insert on public.pontos
  for each row execute function public.antes_inserir_ponto();
drop trigger if exists ponto_update on public.pontos;
create trigger ponto_update before update on public.pontos
  for each row execute function public.antes_alterar_ponto();
drop trigger if exists fundamento_salvar on public.fundamentos;
create trigger fundamento_salvar before insert or update on public.fundamentos
  for each row execute function public.antes_salvar_fundamento();

-- ---------------------------------------------------------------------
-- Ações do zelador
-- ---------------------------------------------------------------------

create or replace function public.gerenciar_membro(p_usuario uuid, p_aprovado boolean, p_papel text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.sou_zelador() then
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
   where id = p_usuario and terreiro_id = public.meu_terreiro();
  if not found then
    raise exception 'Membro não encontrado no seu terreiro';
  end if;
end $$;

create or replace function public.remover_membro(p_usuario uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.sou_zelador() then
    raise exception 'Somente zeladores podem remover membros';
  end if;
  if p_usuario = auth.uid() then
    raise exception 'Você não pode remover a si mesmo';
  end if;
  if not exists (select 1 from public.perfis where id = p_usuario and terreiro_id = public.meu_terreiro()) then
    raise exception 'Membro não encontrado no seu terreiro';
  end if;
  delete from auth.users where id = p_usuario;
end $$;

-- ---------------------------------------------------------------------
-- Permissões (quem pode ler/escrever o quê)
-- ---------------------------------------------------------------------

alter table public.terreiros enable row level security;
alter table public.perfis enable row level security;
alter table public.folhas enable row level security;
alter table public.fundamentos enable row level security;
alter table public.pontos enable row level security;

revoke all on public.terreiros, public.perfis, public.folhas, public.fundamentos, public.pontos from anon, authenticated;

-- O código de convite nunca é exposto ao aplicativo.
grant select (id, nome, nacao) on public.terreiros to authenticated;
grant select on public.perfis to authenticated;
grant update (apelido) on public.perfis to authenticated;
grant select, insert, update, delete on public.folhas, public.fundamentos, public.pontos to authenticated;

revoke execute on function public.gerenciar_membro(uuid, boolean, text), public.remover_membro(uuid) from public, anon;
grant execute on function public.gerenciar_membro(uuid, boolean, text), public.remover_membro(uuid) to authenticated;

-- Terreiros
drop policy if exists terreiros_ler on public.terreiros;
create policy terreiros_ler on public.terreiros for select to authenticated using (true);

-- Perfis: cada um vê o seu; o zelador vê os da sua casa.
drop policy if exists perfis_ler on public.perfis;
create policy perfis_ler on public.perfis for select to authenticated
  using (id = auth.uid() or (public.sou_zelador() and terreiro_id = public.meu_terreiro()));
drop policy if exists perfis_editar on public.perfis;
create policy perfis_editar on public.perfis for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Folhas: validadas aparecem para os três terreiros; pendentes só para a casa.
drop policy if exists folhas_ler on public.folhas;
create policy folhas_ler on public.folhas for select to authenticated
  using (public.meu_terreiro() is not null
         and (status = 'validada' or terreiro_id = public.meu_terreiro()));
drop policy if exists folhas_criar on public.folhas;
create policy folhas_criar on public.folhas for insert to authenticated
  with check (public.meu_terreiro() is not null);
drop policy if exists folhas_validar on public.folhas;
create policy folhas_validar on public.folhas for update to authenticated
  using (public.sou_validador() and terreiro_id = public.meu_terreiro())
  with check (public.sou_validador() and terreiro_id = public.meu_terreiro());
drop policy if exists folhas_apagar on public.folhas;
create policy folhas_apagar on public.folhas for delete to authenticated
  using (public.sou_zelador() and terreiro_id = public.meu_terreiro());

-- Fundamento: só a própria casa lê; validadores escrevem.
drop policy if exists fundamentos_ler on public.fundamentos;
create policy fundamentos_ler on public.fundamentos for select to authenticated
  using (terreiro_id = public.meu_terreiro());
drop policy if exists fundamentos_criar on public.fundamentos;
create policy fundamentos_criar on public.fundamentos for insert to authenticated
  with check (public.sou_validador());
drop policy if exists fundamentos_editar on public.fundamentos;
create policy fundamentos_editar on public.fundamentos for update to authenticated
  using (public.sou_validador() and terreiro_id = public.meu_terreiro())
  with check (public.sou_validador());
drop policy if exists fundamentos_apagar on public.fundamentos;
create policy fundamentos_apagar on public.fundamentos for delete to authenticated
  using (public.sou_validador() and terreiro_id = public.meu_terreiro());

-- Pontos no mapa
drop policy if exists pontos_ler on public.pontos;
create policy pontos_ler on public.pontos for select to authenticated
  using (
    public.meu_terreiro() is not null and (
      criado_por = auth.uid()
      or (status = 'validado' and visibilidade = 'rede')
      or (status = 'validado' and visibilidade = 'terreiro' and terreiro_id = public.meu_terreiro())
      or (public.sou_validador() and visibilidade <> 'privado' and terreiro_id = public.meu_terreiro())
    )
  );
drop policy if exists pontos_criar on public.pontos;
create policy pontos_criar on public.pontos for insert to authenticated
  with check (public.meu_terreiro() is not null);
drop policy if exists pontos_validar on public.pontos;
create policy pontos_validar on public.pontos for update to authenticated
  using (public.sou_validador() and terreiro_id = public.meu_terreiro() and visibilidade <> 'privado')
  with check (public.sou_validador() and terreiro_id = public.meu_terreiro());
drop policy if exists pontos_apagar on public.pontos;
create policy pontos_apagar on public.pontos for delete to authenticated
  using (criado_por = auth.uid()
         or (public.sou_validador() and terreiro_id = public.meu_terreiro() and visibilidade <> 'privado'));

-- ---------------------------------------------------------------------
-- Fotos (armazenamento privado; só quem pode ver o ponto vê a foto)
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 3145728, array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists fotos_enviar on storage.objects;
create policy fotos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos'
              and public.meu_terreiro() is not null
              and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists fotos_ver on storage.objects;
create policy fotos_ver on storage.objects for select to authenticated
  using (bucket_id = 'fotos'
         and ((storage.foldername(name))[1] = auth.uid()::text
              or exists (select 1 from public.pontos p where p.foto_path = objects.name)));
drop policy if exists fotos_apagar on storage.objects;
create policy fotos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- Obrigações: listas de folhas para preparar (só eu ou o meu terreiro)
-- ---------------------------------------------------------------------

create table if not exists public.obrigacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  data date,
  observacao text,
  visibilidade text not null default 'terreiro' check (visibilidade in ('privado', 'terreiro')),
  terreiro_id uuid not null references public.terreiros (id),
  criado_por uuid references public.perfis (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.obrigacao_itens (
  id uuid primary key default gen_random_uuid(),
  obrigacao_id uuid not null references public.obrigacoes (id) on delete cascade,
  folha_id uuid not null references public.folhas (id) on delete cascade,
  quantidade text,
  colhida boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists obrigacao_itens_obrigacao_idx on public.obrigacao_itens (obrigacao_id);

create or replace function public.antes_inserir_obrigacao() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.criado_por := auth.uid();
  new.terreiro_id := public.meu_terreiro();
  return new;
end $$;

create or replace function public.antes_alterar_obrigacao() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.criado_por := old.criado_por;
  new.terreiro_id := old.terreiro_id;
  return new;
end $$;

drop trigger if exists obrigacao_insert on public.obrigacoes;
create trigger obrigacao_insert before insert on public.obrigacoes
  for each row execute function public.antes_inserir_obrigacao();
drop trigger if exists obrigacao_update on public.obrigacoes;
create trigger obrigacao_update before update on public.obrigacoes
  for each row execute function public.antes_alterar_obrigacao();

-- Quem pode editar a lista: quem criou, ou validadores da casa (se for do terreiro).
create or replace function public.posso_editar_obrigacao(p_obrigacao uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.obrigacoes o
    where o.id = p_obrigacao
      and public.meu_terreiro() is not null
      and (o.criado_por = auth.uid()
           or (o.visibilidade = 'terreiro' and o.terreiro_id = public.meu_terreiro() and public.sou_validador()))
  )
$$;

alter table public.obrigacoes enable row level security;
alter table public.obrigacao_itens enable row level security;
revoke all on public.obrigacoes, public.obrigacao_itens from anon, authenticated;
grant select, insert, update, delete on public.obrigacoes, public.obrigacao_itens to authenticated;

drop policy if exists obrigacoes_ler on public.obrigacoes;
create policy obrigacoes_ler on public.obrigacoes for select to authenticated
  using (public.meu_terreiro() is not null
         and (criado_por = auth.uid()
              or (visibilidade = 'terreiro' and terreiro_id = public.meu_terreiro())));
drop policy if exists obrigacoes_criar on public.obrigacoes;
create policy obrigacoes_criar on public.obrigacoes for insert to authenticated
  with check (public.meu_terreiro() is not null);
drop policy if exists obrigacoes_editar on public.obrigacoes;
create policy obrigacoes_editar on public.obrigacoes for update to authenticated
  using (public.posso_editar_obrigacao(id)) with check (public.posso_editar_obrigacao(id));
drop policy if exists obrigacoes_apagar on public.obrigacoes;
create policy obrigacoes_apagar on public.obrigacoes for delete to authenticated
  using (public.posso_editar_obrigacao(id));

-- Itens: quem vê a obrigação vê os itens e pode marcar como colhido;
-- só quem edita a obrigação adiciona ou remove folhas.
drop policy if exists itens_ler on public.obrigacao_itens;
create policy itens_ler on public.obrigacao_itens for select to authenticated
  using (exists (select 1 from public.obrigacoes o where o.id = obrigacao_id));
drop policy if exists itens_marcar on public.obrigacao_itens;
create policy itens_marcar on public.obrigacao_itens for update to authenticated
  using (exists (select 1 from public.obrigacoes o where o.id = obrigacao_id))
  with check (exists (select 1 from public.obrigacoes o where o.id = obrigacao_id));
drop policy if exists itens_criar on public.obrigacao_itens;
create policy itens_criar on public.obrigacao_itens for insert to authenticated
  with check (public.posso_editar_obrigacao(obrigacao_id));
drop policy if exists itens_apagar on public.obrigacao_itens;
create policy itens_apagar on public.obrigacao_itens for delete to authenticated
  using (public.posso_editar_obrigacao(obrigacao_id));

-- ---------------------------------------------------------------------
-- Excluir minha conta (exigência da Apple e direito garantido pela LGPD)
--
-- Antes de chamar, o app apaga as fotos da pessoa no armazenamento.
-- Aqui: apaga pontos e obrigações privados, tira a foto dos pontos
-- compartilhados (que continuam no mapa, sem autoria) e apaga a conta.
-- ---------------------------------------------------------------------

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
  update public.pontos set foto_path = null where criado_por = v_usuario;
  delete from public.obrigacoes where criado_por = v_usuario and visibilidade = 'privado';
  delete from auth.users where id = v_usuario;
end $$;

revoke execute on function public.excluir_minha_conta() from public, anon;
grant execute on function public.excluir_minha_conta() to authenticated;
