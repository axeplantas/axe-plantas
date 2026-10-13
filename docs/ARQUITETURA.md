# Arquitetura

Visão técnica para desenvolvedores que forem continuar o projeto.

## Visão geral

```
Celular (web app instalado)                 Supabase (São Paulo)
┌──────────────────────────┐               ┌────────────────────────────────────┐
│ React + Vite (PWA)       │──login/dados─▶│ Postgres + regras de acesso (RLS)  │
│ Leaflet + OpenStreetMap  │──fotos───────▶│ Storage (bucket privado "fotos")   │
│ Service worker:          │               │ Funções (Edge Functions, Deno):    │
│  - cache e atualização   │──foto(s)─────▶│  identificar → Pl@ntNet            │
│  - notificações (push)   │◀──push────────│  notificar  → Web Push             │
│ IndexedDB: pontos        │               │ Gatilhos no banco → fila de avisos │
│  guardados sem internet  │               └────────────────────────────────────┘
└──────────────────────────┘
Hospedagem do app: GitHub Pages (publicação automática a cada mudança na branch main)
```

## Tecnologias
| Parte | Tecnologia |
|---|---|
| Interface | React 19, TypeScript, Vite, react-router (HashRouter) |
| Mapa | Leaflet / react-leaflet, mapas do OpenStreetMap |
| PWA | vite-plugin-pwa (Workbox), `public/push-sw.js` para notificações |
| Dados no aparelho | localStorage (perfil, folhas) e IndexedDB via idb-keyval (pontos guardados) |
| Backend | Supabase: Postgres, Auth (e-mail e senha), Storage, Edge Functions |
| Identificação | Pl@ntNet API v2 (`/v2/identify/all`) |
| Notificações | Web Push (VAPID) com a biblioteca `web-push` na função `notificar` |
| Publicação | GitHub Actions → GitHub Pages |

## Estrutura de pastas
```
src/pages/           telas (Mapa, NovoPonto, Folhas, FolhaDetalhe, Obrigações, Painel, Admin, Perfil…)
src/components/      peças reutilizáveis (SeletorFolha, FotosDaPlanta, IdentificarFolha, Galeria…)
src/lib/             supabase, sessão, tipos, fila sem internet, notificações, atualização, demonstração
supabase/*.sql       banco de dados, na ordem: schema → convites → catalogo-inicial → notificacoes-e-fotos → primeiro-admin
supabase/functions/  funções do servidor (identificar, notificar)
public/              ícones, páginas legais, receptor de notificações
marca/               logo em vetor e arquivos gerados (npm run marca)
docs/                estes registros
```

## Modelo de dados (principais tabelas)
| Tabela | Para quê |
|---|---|
| `terreiros` | casas participantes |
| `perfis` | uma por pessoa: apelido, terreiro, papel, aprovação, administrador, consentimento |
| `convites` | links de convite (tipo, validade, limite de uso) |
| `folhas` | catálogo (sem terreiro) e folhas cadastradas pelas casas (com status de validação) |
| `fundamentos` | Orixás e usos por folha **e por terreiro** |
| `pontos` | onde a folha está: coordenadas, fotos, visibilidade, status |
| `obrigacoes`, `obrigacao_itens` | listas de folhas para preparar |
| `push_inscricoes`, `notificacoes`, `config_push` | notificações no celular |

Toda leitura e escrita passa pelas regras de acesso (RLS). Ações sensíveis (aprovar membro, criar convite, excluir conta) são funções `security definer` com verificação de papel.

## Fluxos importantes
- **Cadastro:** link `?convite=CODIGO` → `info_convite` mostra a casa → `signUp` com o código e o consentimento → gatilho `novo_usuario` cria o perfil (zelador já aprovado; membro aguardando).
- **Marcar ponto:** fotos reduzidas e sem EXIF → (opcional) função `identificar` → envio das fotos ao Storage → registro em `pontos`. Sem internet, vai para a fila no IndexedDB e é enviado depois (`src/lib/fila.ts`).
- **Notificações:** gatilhos no banco → `notificacoes` → `pg_net` chama a função `notificar` → Web Push para os celulares inscritos.
- **Atualização do app:** o service worker procura versão nova ao abrir e quando o app volta para a tela (`src/lib/atualizacao.ts`).

## Como rodar
```bash
npm install
npm run demo   # demonstração com dados de exemplo, sem banco
npm run dev    # com o banco (precisa de .env.local, veja .env.example)
npm run build  # gera a versão de produção
npm run marca  # regenera logos e ícones a partir de marca/simbolo.svg
```

## Configurações fora do código (Supabase)
- Segredo `PLANTNET_KEY` (Edge Functions › Secrets).
- Funções `identificar` e `notificar` com "Verify JWT with legacy secret" **desligado** (a verificação é feita no próprio código).
- Authentication: "Confirm email" desligado; Site URL e Redirect URLs com o endereço do app.
- Variáveis do repositório no GitHub: `SUPABASE_URL` e `SUPABASE_KEY` (chave publicável).
