# Axé Plantas

Aplicativo para os filhos de santo encontrarem e compartilharem onde estão as folhas sagradas.
Funciona no iPhone e no Android como **web app instalável** (PWA). É gratuito, sem precisar de loja de aplicativos.

> **Projeto pessoal.** Use apenas contas pessoais (e-mail, GitHub, Supabase). Nada de contas da empresa.

## Como funciona

- **Entrada por convite:** a pessoa cria a conta com o **código do terreiro** e fica aguardando até o zelador aprovar.
- **Papéis:** *membro* marca folhas; *validador* aprova folhas e pontos da sua casa; *zelador* também aprova membros e define os validadores.
- **Mapa compartilhado** entre os três terreiros. Cada ponto tem uma visibilidade: *Só eu*, *Meu terreiro* ou *Os três terreiros*.
- **Obrigações:** lista de folhas para preparar uma obrigação, com o ponto mais perto de cada folha, "como chegar", marcação de colhida e progresso. Pode ser só sua ou da casa toda.
- **Fundamento da casa:** os Orixás e os usos de cada folha são registrados por terreiro e **só a própria casa vê**.
- **Privacidade:** as fotos ficam privadas e perdem os dados de localização do celular (EXIF) antes do envio. Os terreiros não aparecem no mapa.

## Ferramentas (todas gratuitas)

| Parte | Ferramenta |
|---|---|
| Aplicativo | React + Vite (PWA) |
| Mapa | OpenStreetMap + Leaflet |
| Banco, login e fotos | Supabase (plano gratuito) |
| Hospedagem | GitHub Pages, Cloudflare Pages ou Vercel |

## Passo a passo para colocar no ar

### 1. Criar o banco no Supabase (conta pessoal)
1. Acesse <https://supabase.com> e crie uma conta com seu **e-mail pessoal**.
2. Crie um projeto chamado `axe-plantas` na região **South America (São Paulo)**.
3. Abra **SQL Editor**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
4. Abra [`supabase/terreiros.sql`](supabase/terreiros.sql), troque os nomes e os **códigos de convite**, rode no SQL Editor e **depois desfaça** a alteração no arquivo, para que os códigos reais não fiquem salvos aqui.
5. Em **Authentication > Sign In / Providers > Email**, desligue **Confirm email**. A aprovação do zelador já protege a entrada, e o envio de e-mails do plano gratuito é bem limitado.
6. Em **Authentication > URL Configuration**, coloque o endereço do app em **Site URL** (depois de publicado).

### 2. Ligar o app ao banco
1. No Supabase, vá em **Project Settings > API** e copie a **Project URL** e a **publishable key** (ou *anon key*).
2. Copie o arquivo `.env.example` para `.env.local` e cole esses dois valores.

> Essa chave pode ficar no aplicativo, pois foi feita para isso. Quem protege os dados são as regras do banco (`schema.sql`).
> Nunca use a chave **secret** ou **service_role** no app.

### 3. Ver a demonstração (sem banco de dados)
```bash
npm run demo
```

### 4. Rodar no computador (com o banco)
```bash
npm install
npm run dev
```
Abra o endereço que aparecer (ex.: `http://localhost:5173`).

### 5. Zeladores
Depois que cada zelador criar a conta no app, rode no SQL Editor o comando do passo 2 de [`supabase/terreiros.sql`](supabase/terreiros.sql), trocando o e-mail.
A partir daí, ele aprova os membros pela aba **Validar**.

## Antes de publicar
- [x] Responsável (Projeto Axé Plantas) e contato (axeplantas@gmail.com) preenchidos nas páginas legais.
- [ ] Recomendado: pedir que um advogado revise a Política de Privacidade e os Termos de Uso.

## Para virar app de loja (depois do piloto)
Já está pronto: política de privacidade, termos de uso, exclusão de conta dentro do app e consentimento no cadastro.
Falta: contas de desenvolvedor (Apple US$ 99/ano, Google US$ 25 uma vez), empacotar com Capacitor e enviar para revisão.

## Estrutura

```
supabase/schema.sql      banco de dados e regras de segurança
supabase/terreiros.sql   cadastro dos terreiros e zeladores
src/pages/               telas (Mapa, Marcar, Folhas, Validar, Perfil…)
src/lib/                 conexão com o Supabase, sessão, tipos, fotos, demonstração
marca/                   símbolo original (simbolo.svg) e arquivos da logo
scripts/gerar-marca.mjs  gera logos e ícones (npm run marca)
```

## Próximas ideias
- Identificação da planta pela foto (Pl@ntNet)
- Mapa offline de uma região inteira
- Avisos de época (floração, frutos)
- Versão nas lojas (App Store / Google Play) com o mesmo código
