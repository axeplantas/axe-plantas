-- =====================================================================
-- Primeiro acesso: gera o link de convite do ADMINISTRADOR
--
-- Rode uma única vez, depois de schema.sql e convites.sql.
-- Abra no celular ou no computador:
--   https://SEU-ENDERECO/?convite=CODIGO_QUE_APARECER
-- O link vale para uma pessoa e por 7 dias. Depois disso, os terreiros
-- e os zeladores são criados e convidados pelo próprio app (Perfil ›
-- Administração), sem precisar mexer aqui de novo.
-- =====================================================================

insert into public.convites (tipo, usos_max, expira_em)
values ('admin', 1, now() + interval '7 days')
returning codigo;
