# Progress / Estado do Trabalho

> Ficheiro de continuidade entre sessões. Atualizar no fim de cada sessão de trabalho.

## Em curso
- (nada a meio)

## Por validar (no browser, próxima sessão)
- **Modais com linha selecionada**: ao clicar numa linha da tabela de um modal e abrir o
  detalhe, ao voltar atrás a linha fica destacada (contorno `--accent`) e faz-se scroll
  até ela (antes voltava ao topo). Confirmar UX em http://localhost:5173.

## Pendente (decisão do utilizador)
- Redundância: o card "Categorias" (mini-donuts) duplica o novo donut "Repartição por
  Categoria" — decidir se se remove.

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
2026-06-22
