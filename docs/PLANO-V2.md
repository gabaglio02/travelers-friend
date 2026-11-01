# Traveler's Friend v2 — auditoria e plano

Branch de trabalho: `nova-versao` · Backup da versão no ar: tag `v1.0` (bf0d998).
Status: **Etapas 0 a 5 concluídas** na branch `nova-versao` (com `002`, `003` e `004` rodados no Supabase; `005` — contas só 18+ — rodado em 31/10/2026). **Publicado na `main` em 31/10/2026.** Ainda pendentes da seção 6: teste com duas contas no site real e revisão jurídica da política.

---

## 1. Auditoria da aplicação atual

### Tecnologias
| Camada | O que é usado hoje |
|---|---|
| Front-end | HTML + CSS + JavaScript puro, sem framework e sem etapa de build |
| Mapa | Leaflet 1.9.4 (CDN) + tiles do OpenStreetMap em tons de cinza |
| Busca de endereço | OpenStreetMap Nominatim (chamado pelo navegador) |
| Back-end local | `serve.js` (Node, sem dependências) |
| Back-end publicado | Funções da Vercel em `api/` (agenda, status, config, cron diário) |
| Contas | Supabase Auth (e-mail + senha, confirmação por e-mail, recuperação de senha) |
| Banco | Supabase Postgres com Row Level Security |
| Arquivos | Supabase Storage, bucket privado `fotos` (pasta por usuário) |
| Biblioteca Supabase | supabase-js 2.45.4 via CDN, isolada em `js/conta.js` |

### Tamanho e organização
- `js/app.js` — 1.423 linhas, ~120 funções, um único objeto `state` e redesenho completo (`renderAll`) a cada mudança.
  Seções: deslocamento, hospedagens, estado, regras de horário, refeições, filtros, timeline, recomendações, mapa, custos, detalhe, agenda online, calendário, idade, eventos.
- `js/conta.js` — 509 linhas: login, viagens na conta, fotos, excluir conta.
- `js/data/sp.js` + `sp-eventos.js` — 143 itens (53 com data), 24 combos, **0 fotos**.
- `css/style.css` — 525 linhas, tokens em `:root` (preto, amarelo `#ffe14d`, neutros), Space Grotesk + JetBrains Mono.

### Navegação
- Tela inicial (busca) → painel com 3 colunas: Explorar · Roteiro · Custos (abas no celular).
- Detalhes em `<dialog>`; conta, viagens e fotos em outro `<dialog>`.
- **Não há rotas/URLs**: nada pode ser compartilhado por link (ex.: um perfil público).

### Banco de dados atual (`supabase/schema.sql`)
| Tabela / recurso | Uso | Acesso |
|---|---|---|
| `viagens` | estado inteiro do roteiro em `jsonb` | só o dono |
| `fotos` | metadados das fotos (arquivo no Storage) | só o dono; limite 50 fotos / 20 MB |
| `agenda_cache` | agenda coletada pelo servidor | só o servidor (service_role) |
| bucket `fotos` | arquivos `<user_id>/<id>.jpg` + miniatura | só o dono |
| `excluir_minha_conta()` | LGPD | o próprio usuário |

### O que dá para reaproveitar
- **Motor de agenda do dia** (`scheduleCore`): horários, refeições, deslocamentos, esperas, avisos de fechado/atrasado/classificação — base pronta para a nova linha do tempo e para detectar conflitos.
- **Opções de transporte por trecho**, combos, recomendações por proximidade, filtros, agenda online com cache.
- **Pipeline de fotos** (redução no navegador, remoção de GPS, miniatura, limite) — vira a base dos álbuns.
- **Padrões de segurança** do `schema.sql` (RLS por dono, funções `security definer`, bucket por pasta).
- `window.TF` (ponte entre `app.js` e `conta.js`).

### Limitações técnicas encontradas
1. **`app.js` monolítico** com HTML em strings: perfil, personas e mural somariam milhares de linhas no mesmo arquivo.
2. **Sem rotas**: perfis públicos precisam de endereço próprio (`/#/@apelido`).
3. **Sem fotos das atrações**: nenhuma imagem existe hoje; precisam vir de uma fonte com licença.
4. **"Confirmado × estimado" não é um campo**: hoje existe só `confirmar`, `ilustrativo` e `precoNota`. Na prática **quase todos os preços são estimativas** — a interface vai mostrar isso com honestidade.
5. **Modelo de dados só privado**: todas as regras são "só o dono". Público/amigos exige um modelo novo de permissões.
6. **Capacidade do plano Free**: 1 GB de Storage para o site inteiro e poucos e-mails/hora. Álbuns e perfis públicos aumentam muito o uso.

---

## 2. Pontos de atenção (decisões que podem gerar problema)

| # | Pedido | Risco | Alternativa proposta |
|---|---|---|---|
| A | Perfis de pessoas históricas | Confusão com contas oficiais; abre espaço para imitar pessoas reais vivas | Selo fixo "Perfil temático criado por @usuário — não é oficial"; permitir só figuras históricas já falecidas, animais, objetos e personagens originais; proibir pessoas vivas e marcas nos termos e com denúncia |
| B | Mural de recados, amigos, perfis públicos | Spam, assédio, conteúdo impróprio; responsabilidade do dono do site (LGPD/Marco Civil) | Recados só de amigos (padrão) ou desligados; dono apaga qualquer recado; botão **denunciar** e **bloquear**; limite de recados por hora |
| C | Público jovem (o site tem filtro de idade) | Dados de menores têm regras mais rígidas | Recursos sociais públicos só para maiores de 18 no lançamento (ou validação jurídica para outra idade); menores usam o planejador e o perfil privado |
| D | Visitantes do perfil | Rastrear quem visitou é sensível | Desligado por padrão; quando ligado, mostra só visitas de amigos que também ligaram |
| E | Status disponível/ocupado/ausente/invisível | Status "ao vivo" exige presença em tempo real (Realtime) | Status escolhido manualmente + "visto por último" opcional (invisível esconde); presença em tempo real numa fase futura |
| F | Referências ao MSN | Logos, sons, emoticons e o nome são marcas/obras protegidas | Só arte **original** inspirada na época (emoticons próprios em SVG, temas, "nudge" visual), sem logos/sons/nomes da Microsoft |
| G | Fotos nas atrações | Usar imagens sem licença | Wikimedia Commons (licenças livres) com crédito do autor e link da licença; eventos sem foto livre usam ilustração da categoria |
| H | Álbuns com muitas fotos | 1 GB para todos os usuários no plano Free | Manter limite por conta (subir para 100 fotos/40 MB quando necessário) e planejar migração das fotos para Cloudflare R2 ou Supabase Pro antes de abrir ao público |
| I | Amigos **ou** seguidores | Dois modelos sociais duplicam regras de privacidade | Só **amigos com pedido e aceite** (como no MSN); "seguidores" fica para depois, se fizer falta |

---

## 3. Arquitetura proposta

### Front-end — evoluir, não reconstruir
- Continuar **sem framework e sem build** (o deploy segue simples e o que funciona continua igual).
- Dividir em **módulos ES** (`<script type="module">`), sem mudar comportamento:
  `js/core/` (estado, utilidades, rotas) · `js/planner/` (explorar, roteiro, custos, mapa) · `js/social/` (perfil, personas, mural, amigos) · `js/conta.js` (continua sendo o único arquivo que fala com o Supabase).
- **Roteador por hash**: `#/` planejador · `#/@apelido` perfil · `#/@apelido/album/<id>` álbum · `#/eu` editar perfil · `#/identidades` minhas personas · `#/amigos`.
- **Design system** em CSS: escala de espaçamento e tipografia, componentes reutilizáveis (botão, campo, seletor, aba, avatar, chip de status, linha do tempo), menos bordas e etiquetas.
- Mapa: **Leaflet.markercluster** (CDN) para agrupar pontos.
- Gráfico de custos em SVG próprio (sem biblioteca).

### Modelo de identidades
- Cada conta tem **1 identidade principal** (o perfil) e **N identidades temáticas** (personas), todas na mesma tabela.
- Amizades ficam entre **identidades**: a pessoa decide se a persona "Mala Viajante" tem amigos próprios ou não. Isso mantém as personas como personagens de verdade, não só avatares.
- Recados, álbuns e lembranças pertencem a uma identidade.
- A conta (auth.users) continua sendo a dona de tudo, para excluir/exportar em um passo.

### Banco de dados — migração **somente aditiva** (`supabase/002_perfis.sql`)
Nada é apagado ou renomeado; `viagens`, `fotos` e `agenda_cache` continuam iguais (só ganham colunas opcionais).

| Tabela nova | Campos principais |
|---|---|
| `identidades` | `id`, `owner_id`, `tipo` (principal · historica · animal · objeto · original), `apelido` (único, para a URL), `nome`, `bio`, `mensagem`, `status` (disponivel · ocupado · ausente · invisivel), `avatar`, `capa`, `tema` (cores/estampa), `emoticon`, `destinos_desejados[]`, `privacidade` (por seção: publico · amigos · privado), `visto_em` |
| `amizades` | `de_identidade`, `para_identidade`, `estado` (pendente · aceita · bloqueada), datas |
| `albuns` | `id`, `identidade_id`, `titulo`, `descricao`, `lugar_id` (liga ao catálogo, ex. `ibirapuera`) ou `local` livre + coordenadas, `data_inicio/fim`, `viagem_id`, `visibilidade`, `capa_foto` |
| `lugares_visitados` | `identidade_id`, `lugar_id` ou nome/coords, `data`, `nota` |
| `recados` | `alvo_identidade`, `autor_identidade`, `texto` (≤ 500), `oculto`, data |
| `denuncias` | quem denunciou, o quê, motivo, estado |

Alterações aditivas: `fotos` ganha `album_id`, `legenda` já existe, `tirada_em`, `local`.

### Permissões
- Função central `pode_ver(identidade_dono, nivel)`: público → todos; amigos → amizade aceita; privado → só o dono. Bloqueio sempre vence.
- **Perfil por seção**: o perfil é lido por uma função `perfil(apelido)` que já devolve só as seções que quem está vendo pode ver (RLS por linha não consegue esconder colunas).
- **Álbuns e fotos**: RLS com `pode_ver(...)`; o bucket `fotos` continua privado e a política de leitura passa a liberar o arquivo quando o álbum é visível para quem pede (links assinados de curta duração).
- **Avatar e capa** em bucket público `perfil` (são feitos para serem vistos; a interface avisa isso).
- **Recados**: escrever só se o dono permitir (amigos/ninguém); apagar: autor ou dono do mural.
- Limites no banco: recados por hora, tamanho de textos, número de identidades por conta (3: perfil + 2 personas).

---

## 4. Etapas

| Etapa | Entrega | Precisa de você |
|---|---|---|
| **0 — Preparação** | Dividir `app.js` em módulos sem mudar nada visível + roteador + base do design system | — |
| **1 — Painel** | Cards com foto (Wikimedia, com crédito), hierarquia clara, "confirmado × estimado"; linha do tempo do dia com horários livres, conflitos e deslocamentos inviáveis; hospedagem/refeições na linha do tempo; mapa com agrupamento; custos por pessoa × grupo, por dia, gráfico por categoria e orçamento disponível × projetado | — (só arquivos do site) |
| **2 — Perfil** | Página de perfil com capa, avatar, nome, bio, mensagem, status, destinos desejados, lugares visitados, privacidade por seção; editar perfil | Rodar `002_perfis.sql` no SQL Editor |
| **3 — Identidades** | Criar/editar/apagar personas com assistente divertido (tipo → visual → história), temas, emoticons originais, selo de perfil temático | — |
| **4 — Mural de lembranças** | Álbuns com fotos, local, datas, descrição e privacidade; "Transformar em lembrança" a partir do roteiro; mural de recados; amigos (pedido/aceite/bloqueio); denunciar | Revisar termos de uso e política de privacidade |
| **5 — Integração** | Testes dos fluxos antigos e novos, desktop/tablet/celular, console limpo, revisão de acessibilidade | Testar com a sua conta |

Cada etapa é entregue funcionando e testada no endereço de teste da branch antes de seguir.
O site principal só muda quando você aprovar a junção com a `main`.

---

## 5. Decisões pendentes (com a recomendação padrão)
1. Fotos das atrações pelo **Wikimedia Commons com crédito** — recomendado.
2. Modelo social: **amigos com aceite** (sem seguidores por enquanto) — recomendado.
3. Recursos sociais públicos **só para maiores de 18** no lançamento — recomendado.
4. Personas históricas **apenas de figuras já falecidas**, com selo de "não oficial" — recomendado.
5. Começar pela **Etapa 0** (divisão em módulos), que não muda nada visível mas evita que o redesign vire um arquivo de 4 mil linhas — recomendado.

---

## 6. Etapa 5 — integração e testes (feito) e checklist para publicar

**Testado** (servidor local, banco simulado no navegador + testes de SQL em Postgres real):
- Planejador: busca, adicionar lugares, linha do tempo, alertas, detalhe, dias, horário de início, mapa, custos — em 1280 px, tablet (768 px) e celular (375 px), sem erros no console e sem rolagem lateral.
- Área social: perfil (dono, amigo, visitante sem login), identidades, amigos, álbum, editor de lembrança, denúncia, visualizador de fotos.
- SQL: `perfis.test.mjs` (44 verificações) e `mural.test.mjs` (66).
- Acessibilidade (auditoria automática por tela): nomes de botões, rótulos de campos, textos alternativos, ids duplicados, contraste AA, foco visível e uso por teclado.

**Corrigido nesta etapa:** cards do Explorar vazavam para o lado no celular; botão "!" com área de toque pequena; 5 campos sem rótulo para leitor de tela;
contraste de "Fora das datas" e das abas Lugares/Eventos; selo da Classificação Indicativa sem descrição para leitor de tela; detalhe do lugar
só abria com mouse (agora o nome é um botão); Política de Privacidade desatualizada (agora cobre perfis, personas, álbuns, recados, amizades,
bloqueios, denúncias e regras de uso).

**Mantido de propósito:** selos da Classificação Indicativa com as cores oficiais (branco sobre verde/laranja/azul fica abaixo do contraste AA,
mas o selo é padronizado e agora tem descrição completa para leitor de tela).

**Checklist antes de juntar com a `main` (publicar):**
1. Testar o endereço de teste da branch com a sua conta e uma segunda conta (pedido de amizade, recado, álbum público × só amigos).
2. ~~Preencher `privacidade.html`~~ (feito em 31/10/2026). Ainda vale uma revisão com orientação jurídica.
3. Combinar quem vai olhar as denúncias e com que frequência (Supabase → Table Editor → `denuncias`).
4. Lembrar do limite do plano gratuito: 50 fotos / 20 MB por conta e 1 GB no total.
