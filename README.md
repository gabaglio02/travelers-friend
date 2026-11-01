# Traveler's Friend

Organizador de viagens: explore atrações, monte o roteiro de cada dia, veja recomendações próximas,
como chegar, tempo estimado em cada lugar e o custo total da viagem.

## Rodar

```bash
node serve.js
```

Abra http://localhost:5173. O `serve.js` entrega o site e a API da agenda (Node 18 ou mais novo, sem dependências).
Abrindo o `index.html` direto no navegador o site também funciona, mas só com a agenda dos arquivos locais.

## Estrutura

- `index.html`: layout (Explorar · Roteiro · Custos)
- `css/style.css`: visual em preto e branco; a cor de destaque fica em `--accent`
- `js/config.js`: endereço do servidor da agenda (`apiBase`)
- `js/app.js`: filtros, roteiro, horários, refeições, deslocamentos, hospedagens, recomendações, mapa e custos
- `js/data/sp.js`: lugares fixos de São Paulo e Grande SP
- `js/data/sp-eventos.js`: agenda de eventos (também usada como reserva quando o servidor não responde)
- `js/data/sp-fotos.js`: fotos dos lugares (Wikimedia Commons, só licenças livres; crédito exibido nos detalhes)
- `js/core/`: constantes, utilidades e roteador por hash (`#/`, `#/planejar`)
- `server/agenda.js`: API `/api/eventos` com cache por datas
- `server/fontes/`: de onde os eventos vêm (veja abaixo)
- `server/config.json`: tempo de validade do cache e feeds
- `server/store.js`: onde a agenda fica (arquivo `data/` ou Supabase)
- `api/`: funções da Vercel (agenda, status, config, cron)
- `js/conta.js`: contas, viagens salvas e fotos (Supabase)
- `supabase/schema.sql`: tabelas e regras de segurança do Supabase
- `supabase/002_perfis.sql`: perfis, identidades, amizades, lugares visitados e privacidade por seção
- `supabase/003_limite_identidades.sql`: limite de 3 identidades por conta (perfil + 2 personas)
- `supabase/004_mural.sql`: álbuns de lembranças, recados, amizades mais seguras, bloqueio por conta e denúncias
- `supabase/005_contas_18.sql`: contas só para maiores de 18 (toda identidade passa a ser 18+)
- `supabase/006_perfil_so_amigos.sql`: perfil "Só amigos" mostra um cartão para pedir amizade; "Só eu" não recebe pedidos
- `supabase/007_compartilhar_e_erros.sql`: roteiros compartilhados por link (#/r/<código>) e registro de erros do site (tabela `erros_site`)
- `supabase/testes/`: testes do SQL num Postgres local (PGlite)
- `js/dados/perfis.js`: leitura e gravação de perfis no Supabase
- `js/social/perfil.js`: páginas `#/@apelido`, `#/perfil` e `#/perfil/editar`
- `privacidade.html`: política de privacidade
- `data/`: banco da agenda gerado pelo servidor (pode apagar para recomeçar)

## Agenda online

Quando a pessoa aperta **Buscar** (ou troca as datas), o site chama:

```
GET /api/eventos?cidade=sp&de=2026-11-11&ate=2026-11-25
```

O servidor responde com os eventos que acontecem nessas datas e com `atualizadoEm`:

- datas nunca buscadas → coleta nas fontes antes de responder;
- dados com mais de `ttlHoras` (padrão 12h) → responde na hora e atualiza em segundo plano; o site pergunta de novo em 15 s;
- além disso, os próximos 90 dias são atualizados sozinhos a cada `ttlHoras`.

`GET /api/status` mostra o resultado da última coleta de cada fonte.

### Fontes

| Fonte | Arquivo | Quando liga |
|---|---|---|
| Arquivos do site | `server/fontes/local.js` | sempre; lê `js/data/sp.js` e `sp-eventos.js` a cada coleta |
| Feeds JSON | `server/fontes/feeds.js` | quando há itens em `"feeds"` no `server/config.json` |
| API de ingressos (modelo) | `server/fontes/modelo-api.js` | com as variáveis `EVENTOS_API_KEY` e `EVENTOS_API_URL`; ajuste a função `converter` para a API escolhida |

Para criar uma fonte nova, copie um desses arquivos (precisa exportar `nome`, `ativa(config)` e
`coletar({ cidade, de, ate })`, devolvendo eventos no formato de `sp-eventos.js`) e inclua em `FONTES`,
no topo de `server/agenda.js`. Eventos sem `id`, `nome`, `categoria`, `lat`, `lng` e `datas`/`periodo` são descartados.

Antes de ligar uma plataforma, confira se os termos de uso permitem exibir os eventos dela.

## Publicar

### Vercel + Supabase (recomendado)

O projeto já vem pronto para a Vercel: os arquivos do site são servidos como estáticos e a pasta `api/`
vira funções (`/api/eventos`, `/api/status`, `/api/config` e `/api/cron`). Na Vercel a agenda fica guardada
no Supabase (tabela `agenda_cache`) em vez da pasta `data/`.

1. **Vercel:** *Add New → Project → Import* o repositório do GitHub. Sem framework, sem comando de build.
   Use a conta pessoal (plano **Hobby**); não crie Team nem inicie o teste do Pro.
2. **Supabase:** no projeto da Vercel, *Storage* (ou *Integrations*) → **Supabase** → escolha o plano **Free**.
   A integração cria as variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` (o site aceita também os nomes `NEXT_PUBLIC_…`).
3. **Banco:** no painel do Supabase, *SQL Editor* → cole e rode [`supabase/schema.sql`](supabase/schema.sql) , depois [`supabase/002_perfis.sql`](supabase/002_perfis.sql) , [`supabase/003_limite_identidades.sql`](supabase/003_limite_identidades.sql) [`supabase/004_mural.sql`](supabase/004_mural.sql), [`supabase/005_contas_18.sql`](supabase/005_contas_18.sql) [`supabase/006_perfil_so_amigos.sql`](supabase/006_perfil_so_amigos.sql) e [`supabase/007_compartilhar_e_erros.sql`](supabase/007_compartilhar_e_erros.sql) (só acrescentam/ajustam; é seguro rodar de novo).
4. **Login:** no Supabase, *Authentication → URL Configuration*: em **Site URL** coloque o endereço da Vercel
   (ex.: `https://travelers-friend.vercel.app`) e adicione-o também em **Redirect URLs** (e `http://localhost:5173` para testar).
5. **Cron (opcional):** crie a variável `CRON_SECRET` na Vercel com um texto aleatório; o `/api/cron` passa a aceitar só a Vercel.
6. *Redeploy* na Vercel. Cada envio para a branch `main` publica o site de novo.

Notas:
- A chave **anon** é pública por natureza (vai para o navegador); quem protege os dados são as regras de Row Level Security do `schema.sql`.
  A **service_role** só existe no servidor — nunca coloque no `js/config.js`.
- O Supabase Free envia poucos e-mails por hora (confirmação de conta e recuperação de senha). Para lançar de verdade,
  configure um SMTP próprio em *Authentication → Emails*.
- Limites de fotos: 50 fotos ou 20 MB por conta (em `supabase/schema.sql` e `js/conta.js`).
- A [Política de Privacidade](privacidade.html) está preenchida; ao mudar o que o site guarda ou o e-mail de contato, atualize o texto e a data no topo.

### Testar contas no computador

Crie um arquivo `.env.local` na raiz (ele fica fora do git) com as chaves do projeto Supabase e rode `node serve.js`:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=...
# opcional: guarda a agenda no Supabase também
# SUPABASE_SERVICE_ROLE_KEY=...
```

### Outras hospedagens

- **Site e API juntos:** qualquer hospedagem que rode Node (`node serve.js`, usando a variável `PORT`).
  A pasta `data/` precisa ser gravável e persistente.
- **Site separado da API:** publique os arquivos estáticos onde preferir e, em `js/config.js`,
  coloque o endereço da API em `apiBase`. A API já responde com CORS liberado.

## Contas, viagens e fotos

Todo o código que fala com o Supabase está em `js/conta.js` (trocar de serviço = reescrever esse arquivo).
Sem o Supabase configurado, o site funciona como antes e a viagem fica salva só no navegador.

- Criar conta (nome, e-mail, senha), entrar, recuperar senha, sair e **excluir a conta** (apaga viagens e fotos).
- Ao entrar pela primeira vez com uma viagem já montada no navegador, o site pergunta se quer salvá-la na conta.
- Várias viagens por conta; cada alteração é salva sozinha (indicador "salvando… / salvo ✓" no botão da conta).
- Fotos: reduzidas no navegador (1600 px + miniatura de 400 px), sem os dados de GPS, privadas por padrão.

## Adicionar uma cidade

1. Crie `js/data/<id>.js` no mesmo formato de `sp.js` (`window.TF_CITIES.<id> = {...}`).
2. Inclua o `<script>` dele no `index.html`.
3. Em `js/app.js`, tire o `soon: true` da cidade em `CITY_OPTIONS`.
4. Na API, inclua a cidade em `CIDADES` (`server/agenda.js`) e os arquivos dela em `server/fontes/local.js`.

Os preços, horários e datas são aproximados. Os itens marcados como `ilustrativo` são exemplos.

## Perfis

- `#/@apelido` mostra o perfil; o banco (`perfil_publico`) já devolve só as seções que quem está vendo pode ver.
- Cada seção tem privacidade própria: público · só amigos · só eu. Contas são só para maiores de 18 (declarado no cadastro).
- Avatar e capa ficam no bucket público `perfil`; fotos de viagem continuam no bucket privado `fotos`.
- Testar o SQL localmente: numa pasta fora do projeto, `npm i @electric-sql/pglite@0.2.17` e
  `node supabase/testes/perfis.test.mjs <pasta-do-projeto>` (o script fica nessa pasta junto do pacote).
  O mural tem o seu: `node supabase/testes/mural.test.mjs <pasta-do-projeto>`.

## Identidades

- `#/identidades` lista o perfil principal e as personas da conta (até 3: o perfil + 2 personas, mesmo limite do banco).
- `#/identidades/nova`: escolhe o tipo (figura histórica, animal, objeto, personagem original) e abre o mesmo
  formulário do perfil, com ideias prontas, moldura do avatar, emoticons e emoticon de assinatura.
- Figuras históricas: só pessoas já falecidas, com declaração obrigatória; a página mostra o selo
  "perfil temático — não é a conta oficial".
- Apagar uma persona pede para digitar o @ e remove também o avatar/capa dela no bucket `perfil`.

## Mural de lembranças, recados e amigos

- **Lembranças** (álbuns): título, local, datas, descrição, lugares e visibilidade própria (público · só amigos · só eu).
  Ficam no perfil (`#/@apelido`) e abrem em `#/@apelido/album/<id>`. Criar: "+ Nova lembrança" no perfil ou
  "📸 Virar lembrança" no Roteiro (leva lugares e datas e pode marcá-los como visitados).
- **Fotos** dos álbuns continuam no bucket privado `fotos` (limite de 50 fotos / 20 MB por conta) e são abertas por
  links temporários só para quem pode ver o álbum. Apagar um álbum mantém as fotos em "Minhas fotos", a menos que a pessoa marque o contrário.
- **Recados**: só amigos escrevem; quem lê é definido na privacidade do perfil (seção "Mural de recados"; "Só eu" desliga).
  O autor e o dono do mural podem apagar. Limite de 20 recados por hora por conta.
- **Amigos** (`#/amigos`): pedidos recebidos/enviados, amigos e bloqueados; o número de pedidos aparece no topo.
- **Bloquear** vale para a conta inteira (todas as identidades dos dois lados) e desfaz a amizade; só quem bloqueou desbloqueia.
- **Denúncias** vão para a tabela `denuncias`. Para moderar: Supabase → *Table Editor* → `denuncias` (filtre `estado = aberta`),
  veja `alvo_tipo`/`alvo_id`, remova o conteúdo se for o caso e mude o estado para `analisada` ou `removida`.

## Erros do site

Quando algo quebra no navegador de alguém, `js/erros.js` registra a mensagem, a página e o navegador (nada pessoal) na tabela `erros_site` do Supabase (Table Editor → erros_site). Erros repetidos só aumentam a coluna `vezes`.

Resumo diário por e-mail (opcional): crie uma conta gratuita em [resend.com](https://resend.com) com o e-mail que vai receber os avisos, gere uma API key e cadastre na Vercel (Settings → Environment Variables) `RESEND_API_KEY` e `AVISO_EMAIL`. O cron diário (`api/cron.js`) manda o resumo quando houver erro nas últimas 24 h.

## Restaurantes

`js/data/sp-restaurantes.js` tem ~430 restaurantes bem avaliados (nota 4,5+ no Google Maps, ou 4,4 com 1.500+ avaliações) a até 3 km das atrações. É gerado por `tools/gerar-restaurantes.js` a partir de uma coleta de buscas "restaurantes bem avaliados <bairro>" no Google Maps — não edite à mão. No Explorar eles aparecem pelo filtro Gastronomia ou pela busca; no roteiro, em "Onde comer perto" (até 3 km, priorizando os mais bem avaliados).

## Compras (shoppings, galerias e outlets)

`js/data/sp-compras.js` tem ~110 shoppings, galerias de roupas e outlets (nota 4,2+ e 500+ avaliações no Google Maps; galerias 4,1+ e 300+). Os mais conhecidos aparecem no "Tudo" do Explorar; os outros, pelo filtro Compras ou pela busca. Cada um mostra as lojas de roupa e os restaurantes de dentro (os restaurantes ficam em `sp-restaurantes.js` com o campo `local`).

Para refazer: colete no Google Maps ("shopping center", "galeria de roupas", "outlet"; e, para cada um, "restaurantes no <shopping>" e "lojas de roupa no <shopping>"), rode `node tools/gerar-compras.js <projeto> compras.json dentro.json rest-dentro.json` e depois `node tools/gerar-restaurantes.js <projeto> restaurantes.json rest-dentro.json`. Bairro e cidade vêm do OpenStreetMap (com cache).
