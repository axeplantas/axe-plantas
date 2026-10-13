-- =====================================================================
-- Cadastro dos terreiros e dos zeladores
--
-- ATENÇÃO: troque os nomes e os códigos de convite ANTES de rodar.
-- NÃO salve os códigos reais neste arquivo nem no GitHub: troque aqui,
-- rode no SQL Editor do Supabase e depois desfaça a alteração no arquivo.
-- O código é a "chave" que o membro digita para entrar na casa.
-- =====================================================================

-- 1) Os três terreiros
insert into public.terreiros (nome, nacao, codigo_convite) values
  ('Terreiro 1', 'Candomblé de Ketu',             'TROCAR-CODIGO-1'),
  ('Terreiro 2', 'Umbanda / Jurema / Quimbanda',  'TROCAR-CODIGO-2'),
  ('Terreiro 3', 'Umbanda',                       'TROCAR-CODIGO-3');

-- 2) Depois que cada zelador criar a conta no app, rode isto trocando o
--    e-mail. Ele passa a ser zelador aprovado e cuida do resto pelo app.
-- update public.perfis p
--    set papel = 'zelador', aprovado = true
--   from auth.users u
--  where u.id = p.id and u.email = 'email-do-zelador@exemplo.com';
