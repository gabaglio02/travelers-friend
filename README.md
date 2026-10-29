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
- `server/agenda.js`: API `/api/eventos` com cache por datas
- `server/fontes/`: de onde os eventos vêm (veja abaixo)
- `server/config.json`: tempo de validade do cache e feeds
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

- **Site e API juntos:** qualquer hospedagem que rode Node (`node serve.js`, usando a variável `PORT`).
  A pasta `data/` precisa ser gravável e persistente.
- **Site separado da API:** publique os arquivos estáticos onde preferir e, em `js/config.js`,
  coloque o endereço da API em `apiBase`. A API já responde com CORS liberado.

## Adicionar uma cidade

1. Crie `js/data/<id>.js` no mesmo formato de `sp.js` (`window.TF_CITIES.<id> = {...}`).
2. Inclua o `<script>` dele no `index.html`.
3. Em `js/app.js`, tire o `soon: true` da cidade em `CITY_OPTIONS`.
4. Na API, inclua a cidade em `CIDADES` (`server/agenda.js`) e os arquivos dela em `server/fontes/local.js`.

Os preços, horários e datas são aproximados. Os itens marcados como `ilustrativo` são exemplos.
