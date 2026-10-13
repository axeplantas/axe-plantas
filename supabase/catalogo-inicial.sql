-- =====================================================================
-- Catálogo inicial de folhas (compartilhado por todos os terreiros)
--
-- Só nomes, nome científico e alertas de segurança. SEM fundamento:
-- Orixás e usos cada casa registra na página da folha, e só ela vê.
-- As folhas do catálogo não pertencem a nenhuma casa (terreiro_id vazio)
-- e só o administrador pode editá-las ou apagá-las.
--
-- Rode depois de schema.sql e convites.sql. Pode rodar mais de uma vez.
-- =====================================================================

alter table public.folhas alter column terreiro_id drop not null;
create unique index if not exists folhas_catalogo_unico on public.folhas (lower(nome_popular)) where terreiro_id is null;

drop policy if exists folhas_validar on public.folhas;
create policy folhas_validar on public.folhas for update to authenticated
  using (public.sou_admin() or (public.sou_validador() and terreiro_id = public.meu_terreiro()))
  with check (public.sou_admin() or (public.sou_validador() and terreiro_id = public.meu_terreiro()));
drop policy if exists folhas_apagar on public.folhas;
create policy folhas_apagar on public.folhas for delete to authenticated
  using (public.sou_admin() or (public.sou_zelador() and terreiro_id = public.meu_terreiro()));

insert into public.folhas (nome_popular, outros_nomes, nome_cientifico, toxica, alerta) values
  ('Abre-caminho', null, 'Lygodium volubile', false, null),
  ('Akoko', null, 'Newbouldia laevis', false, null),
  ('Alecrim', null, 'Salvia rosmarinus', false, null),
  ('Alfavaca', 'alfavacão, alfavaca-cravo', 'Ocimum gratissimum', false, null),
  ('Alfazema', 'lavanda', 'Lavandula angustifolia', false, null),
  ('Aroeira', 'aroeira-vermelha, aroeira-pimenteira', 'Schinus terebinthifolia', false, 'Pode causar alergia na pele de pessoas sensíveis.'),
  ('Arruda', null, 'Ruta graveolens', true, 'Pode causar queimaduras na pele exposta ao sol. Não usar na gravidez.'),
  ('Assa-peixe', null, 'Vernonanthura polyanthes', false, null),
  ('Babosa', 'aloe', 'Aloe vera', false, 'Não ingerir a seiva amarela da casca.'),
  ('Bambu', null, 'Bambusa vulgaris', false, null),
  ('Bananeira', null, 'Musa × paradisiaca', false, null),
  ('Boldo', 'boldo-brasileiro, tapete-de-Oxalá', 'Coleus barbatus (Plectranthus barbatus)', false, 'Evitar uso prolongado e na gravidez.'),
  ('Cajueiro', 'caju', 'Anacardium occidentale', false, null),
  ('Camomila', null, 'Matricaria chamomilla', false, null),
  ('Cana-do-brejo', null, 'Costus spicatus', false, null),
  ('Capim-santo', 'capim-limão, capim-cidreira', 'Cymbopogon citratus', false, null),
  ('Colônia', null, 'Alpinia zerumbet', false, null),
  ('Comigo-ninguém-pode', null, 'Dieffenbachia seguine', true, 'Muito tóxica: a seiva queima a boca e a garganta. Cuidado com crianças e animais.'),
  ('Cordão-de-frade', null, 'Leonotis nepetifolia', false, null),
  ('Cravo-de-defunto', 'tagetes', 'Tagetes erecta', false, null),
  ('Dama-da-noite', null, 'Cestrum nocturnum', true, 'Tóxica se ingerida.'),
  ('Dendezeiro', 'dendê', 'Elaeis guineensis', false, null),
  ('Erva-cidreira', 'cidreira, cidreira-de-arbusto', 'Lippia alba', false, null),
  ('Erva-de-santa-maria', 'mastruz, mentruz', 'Dysphania ambrosioides', true, 'Tóxica em doses altas. Não usar na gravidez.'),
  ('Erva-doce', 'funcho', 'Foeniculum vulgare', false, null),
  ('Espada-de-Santa-Bárbara', 'espada-de-Iansã', 'Dracaena trifasciata (variedade de bordas amarelas)', true, 'Tóxica se ingerida (pessoas e animais).'),
  ('Espada-de-São-Jorge', 'espada-de-Ogum', 'Dracaena trifasciata', true, 'Tóxica se ingerida (pessoas e animais).'),
  ('Folha-da-fortuna', 'erva-da-costa, coirama', 'Kalanchoe pinnata', false, null),
  ('Fumo', 'tabaco', 'Nicotiana tabacum', true, 'Tóxico se ingerido.'),
  ('Gameleira-branca', 'gameleira', 'Ficus sp.', false, null),
  ('Girassol', null, 'Helianthus annuus', false, null),
  ('Goiabeira', 'goiaba', 'Psidium guajava', false, null),
  ('Guiné', 'tipi, erva-pipi', 'Petiveria alliacea', true, 'Tóxica se ingerida.'),
  ('Hortelã', 'hortelã-comum', 'Mentha spicata', false, null),
  ('Hortelã-pimenta', null, 'Mentha × piperita', false, null),
  ('Jaqueira', 'jaca', 'Artocarpus heterophyllus', false, null),
  ('Levante', 'elevante, alevante', 'Mentha sp.', false, null),
  ('Lírio-do-brejo', 'gengibre-branco', 'Hedychium coronarium', false, null),
  ('Losna', 'absinto', 'Artemisia absinthium', true, 'Tóxica em doses altas. Não usar na gravidez.'),
  ('Louro', 'loureiro', 'Laurus nobilis', false, null),
  ('Macaçá', 'macassá', 'Aeollanthus suaveolens', false, null),
  ('Malva', null, 'Malva sylvestris', false, null),
  ('Mamona', 'carrapateira', 'Ricinus communis', true, 'Sementes muito tóxicas, podem matar.'),
  ('Manacá', null, 'Brunfelsia uniflora', true, 'Tóxica se ingerida.'),
  ('Mangueira', 'manga', 'Mangifera indica', false, null),
  ('Manjericão', 'manjericão-roxo', 'Ocimum basilicum', false, null),
  ('Manjerona', null, 'Origanum majorana', false, null),
  ('Melão-de-são-caetano', null, 'Momordica charantia', true, 'Frutos maduros e sementes são tóxicos.'),
  ('Oriri', 'erva-de-jabuti, alfavaquinha-de-cobra', 'Peperomia pellucida', false, null),
  ('Pata-de-vaca', null, 'Bauhinia forficata', false, null),
  ('Peregun', 'pau-d’água, nativo', 'Dracaena fragrans', false, null),
  ('Picão', 'picão-preto', 'Bidens pilosa', false, null),
  ('Pinhão-roxo', null, 'Jatropha gossypiifolia', true, 'Sementes e látex tóxicos.'),
  ('Pitangueira', 'pitanga', 'Eugenia uniflora', false, null),
  ('Poejo', null, 'Mentha pulegium', true, 'Tóxico em doses altas. Não usar na gravidez.'),
  ('Quebra-pedra', null, 'Phyllanthus niruri', false, null),
  ('Rosa-branca', 'roseira', 'Rosa sp.', false, null),
  ('Saião', 'coirama-branca', 'Kalanchoe crenata', false, null),
  ('São-gonçalinho', 'guaçatonga', 'Casearia sylvestris', false, null),
  ('Tanchagem', 'tansagem, transagem', 'Plantago major', false, null),
  ('Vassourinha', 'vassourinha-doce', 'Scoparia dulcis', false, null)
on conflict do nothing;

-- O cadastro acima entra como "pendente" (não há usuário logado no SQL Editor);
-- as folhas do catálogo já nascem validadas.
update public.folhas set status = 'validada' where terreiro_id is null and status = 'pendente';
