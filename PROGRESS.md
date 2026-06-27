# Progress / Estado do Trabalho

> Ficheiro de continuidade entre sessões. Atualizar no fim de cada sessão de trabalho.

## Em curso
- (nada a meio)

## Por validar (no browser, próxima sessão)
- **Ações em Carteira (Holdings)**: importar o CSV IBKR `U6673215_202605_202605.csv` em
  Importar Dados → deve mostrar "📊 16 posições abertas detetadas" na pré-visualização e,
  após confirmar, "16 posições em carteira atualizadas". No Dashboard, secção "Ações em
  Carteira" com 16 cards. Testar o lápis do Valor Justo (grava e mostra % sub/sobrevalorizada).
  Dry-run já validado contra os CSV reais 2025 (12 pos.) e 2026 (16 pos.).
- **Menu de utilizador global**: confirmar que aparece no canto sup. direito em TODAS as
  páginas (Tema/Administração/Definições/Sair) e que não há sobreposição com cabeçalhos.
- **Card Total Acumulado (Simply Wall St)**: testar tabs, intervalos, e o toggle
  Empilhado/Combinado.
- **Modais com linha selecionada**: (pendente da sessão anterior) confirmar destaque +
  scroll ao voltar atrás.

## Pendente (decisão do utilizador)
- Redundância: o card "Categorias" (mini-donuts) duplica o novo donut "Repartição por
  Categoria" — decidir se se remove.
- **Seletor de ano removido** do cabeçalho do Dashboard (a pedido) — Dashboard fica no ano
  mais recente. Se quiser trocar de ano, é preciso realocar o seletor.
- **Feed de cotações / valor justo automático**: "Último Preço" das Holdings é o preço de
  fecho à data do relatório (atualiza a cada importação), não em tempo real. Valor Justo é
  manual. Integrar API externa fica para decisão futura.

## Feito na sessão de 2026-06-27
- **Sessão/login**: cookie passou a ser de sessão (sem maxAge → expira ao fechar o browser,
  obriga sempre a login); ttl do FileStore reduzido p/ 1 dia; sessões antigas limpas. Em
  `server/index.js`.
- **Repartição por Categoria dinâmica**: categorias detetadas automaticamente dos dados
  (deixou de ser lista fixa STOCK/OPTION/CFD). Mapa `CAT_META` + fallback de cor/rótulo;
  parser IBKR passou a reconhecer `Futures`→FUTURE (`import.js`). Em `Dashboard.jsx`.
- **Card "Total Acumulado" estilo Simply Wall St**: tabs (Valor ao Longo do Tempo / vs
  Mercado [inativo, "brevemente"]), 4 painéis (Valor Total, Retornos 1D, Retornos Totais,
  TIR anualizada), Valor da Carteira/Base de Custo, intervalos, e toggle Empilhado/Combinado.
  Novo endpoint `GET /api/trades/equity-detailed` (equity acumulada por categoria).
- **Menu de utilizador**: removido da sidebar; novo componente `components/UserMenu.jsx`
  global (fixo, canto sup. direito, em todas as páginas), suave (sem card). "Administração"
  movida da sidebar para dentro deste menu.
- **Ações em Carteira (posições abertas)** — funcionalidade nova:
  - BD: tabelas `posicoes` (snapshot) e `fair_value` (valor justo manual, persiste) em `db.js`.
  - Import: parser lê a secção **"Open Positions"** do CSV IBKR (Summary rows), converte
    p/ EUR, e em `saveData` substitui as posições por (corretora, conta) a cada importação.
    Pré-passagem capta também o nome do instrumento (Description).
  - Rotas: `GET /api/trades/holdings` (posições + valor justo) e `POST /api/trades/fair-value`.
  - Frontend: substituiu "Últimas Trades" por cards "Ações em Carteira" (Nome, Último Preço,
    Valor Justo c/ lápis + % sub/sobrevalorizada, Retorno Total, Valor/Custo, Peso/Ações,
    Preço Médio). Contagem na pré-visualização e na msg de sucesso da importação.
  - **XTB não exporta posições abertas** (só Cash Operations + Closed Positions) → Holdings
    só do IBKR. Importar o **CSV** do IBKR (não o PDF).
- **Barra de topo (fix do overlap)**: o menu de utilizador estava `position:fixed` e tapava
  o conteúdo ao fazer scroll. Passou para uma `.topbar` dentro de `.layout-right`, fora da
  área de scroll (var `--topbar-h` no `theme.css`; Dashboard/TradeLog descontam-na na altura).
- **Histórico de importações**: removido o botão "Remover" (e rota `DELETE /history/:id`) —
  só apagava o registo do log, não os dados, pelo que confundia. Histórico fica só de leitura.
- **Menu de utilizador**: iniciais do 1.º+último nome ("Paulo Carmo"→"PC"); dropdown deixou
  de repetir nome/função (já estão no botão).
- **Reset à BD (Administração)**: "Zona de Perigo" com "Apagar tudo" → `POST /api/admin/reset-data`
  limpa trades/dividendos/depósitos/posições/fair_value/import_history (conta e câmbios
  intactos). Confirmação dupla: escrever o username no modal + validação no servidor
  (`confirm===username`). Lógica validada com BD de teste descartável.
- **Transparência dos "Ignorados"**: `countExisting` devolve `dupItems` (tipo/símbolo/data/
  valor/motivo); pré-visualização tem link "Ver o que vai ser ignorado" com tabela detalhada;
  mensagem de sucesso e cabeçalho do histórico ("Ignorados ⓘ") explicam que = já existia na BD.

## Feito na sessão de 2026-06-22
- **start.bat / stop.bat** na raiz: arranque (server+client+browser) e paragem (taskkill
  das portas 3001/5173).
- **Bug "Erro ao carregar dados" na 1ª entrada**: retry automático (3x, backoff) no
  `load()` e no fetch de `/api/trades/anos` do Dashboard. Causa: burst de pedidos em
  paralelo no arranque (1ª abertura da BD + leituras concorrentes do ficheiro de sessão
  em Windows). Refresh resolvia → retry automático faz o mesmo.
- **ETFs/ações IBKR sem país (13 trades) — RESOLVIDO**: QDVE/NQSE/SMH→Irlanda,
  AFXD→Alemanha (afinal é a ação Carl Zeiss Meditec, não ETF). Adicionados a
  `KNOWN_SYMBOLS_COUNTRY` + dados migrados. Ticker SMH é ambíguo (VanEck US via XTB vs
  VanEck UCITS via IBKR) — separados por preço/origem. Ver memória etfs-sem-pais-pendente.
- **Bug raiz do parser IBKR (causa dos países nulos) — CORRIGIDO**: a pré-passagem do ISIN
  lia a coluna `ISIN`, mas no relatório IBKR a coluna chama-se **`Security ID`** → mapa de
  ISINs vinha sempre vazio. Ações US escapavam pelo fallback da moeda (USD); ETFs em EUR
  ficavam nulos. Fix em `import.js`: ler `Security ID` (fallback `ISIN`) com validação de
  formato ISIN (`/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/`). Validado contra os CSV 2023/2024 — os 4
  resolvem direto do ISIN. As entradas em `KNOWN_SYMBOLS_COUNTRY` ficam como rede de
  segurança (o ISIN resolve primeiro). **Confirmado end-to-end** com importação real do
  CSV IBKR 2024 num utilizador de teste descartável: os 4 resolveram automaticamente
  (QDVE/NQSE/SMH→Irlanda, AFXD→Alemanha), zero trades sem país. Decidido NÃO fazer reset
  da BD (32 importações/5 contas/2020-2026; nem todos os originais disponíveis; dados já
  corretos).
- **nodemon a reiniciar a meio dos pedidos — CORRIGIDO**: o `dev` vigiava `.json`, e o
  login (escreve `users.json`) e outras escritas em runtime reiniciavam o servidor,
  cortando pedidos (resposta vazia). Script `dev` passou a ignorar `data/`, `users.json`
  e `logs/` (além de `sessions/`). Aplicar exige reiniciar o nodemon (os `--ignore` são
  args do processo).
- **Modais — linha clicada destacada e scroll de regresso**: ao abrir o detalhe a partir
  de uma linha de tabela num modal (`pushModal`), guarda-se `selectedId` no modal-pai; ao
  voltar, a linha ganha contorno (`--accent`) e faz-se `scrollIntoView` até ela (antes a
  tabela voltava ao topo). Em `Dashboard.jsx`. Falta validar no browser.

## Feito na sessão de 2026-06-21
- **Câmbios locais do BCE** (`server/fx.js`) com atualização automática; §6 resolvido;
  conta XTB USD (52663818) convertida; ver memória fx-cambios-e-moeda-contas.
- **Registo**: paginação + navegação mês/ano no calendário.
- **Sessões**: limpeza de órfãos + config explícita.
- **Visão Geral (Dashboard)**:
  - Card "Total Acumulado": botões de intervalo 1D/5D/6M/YTD/1A/3A/5A/10A/Max.
  - Novo card "Repartição por Categoria" (donut Ações/Opções/CFDs/Dividendos/Juros + legenda € (%)).
  - Card "Win/Loss" reorganizado: Métricas Detalhadas (em linhas) à esquerda, Win/Loss à
    direita, divisória vertical "cravada"; removidas linhas Ações/CFDs/Opções das métricas.
  - Cabeçalho fixo + conteúdo com scroll (título e botões sempre visíveis).
  - Modais com pilha (voltar atrás em vez de fechar tudo).
- **País COR**: Corticeira Amorim → `COR:"PT"` no mapa + dados IBKR migrados.

## Última atualização
2026-06-27
