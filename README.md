# Trading Journal

Diário de trading pessoal para acompanhamento de operações e dividendos importados da **XTB** e **IBKR**, com relatório de IRS para Portugal.

## Funcionalidades

- **Dashboard** — P&L total, win rate, drawdown, curva de equity, P&L semanal, breakdown por Ações / CFDs / Opções / Dividendos
- **Registo de Operações** — lista completa de trades e dividendos com filtros por ano, categoria, resultado, corretora e símbolo; histórico por símbolo
- **Calendário** — visualização de trades por dia/mês
- **Estatísticas** — P&L por símbolo, win rate, métricas de risco (Profit Factor, R:R, Avg Win/Loss)
- **Relatório IRS** — quadros estruturados para o Portal das Finanças com exportação para Excel:
  - Anexo G · Quadro 9 (Ações Nacionais)
  - Anexo J · Quadro 9.2A (Mais-Valias de Ativos Estrangeiros)
  - Anexo J · Quadro 9.2B (Derivados: CFDs e Opções)
  - Anexo J · Quadro 8 (Dividendos e Juros de Fonte Estrangeira)
  - Anexo J · Quadro 11 (Contas no Estrangeiro — IBKR)
- **Importação** — upload drag-and-drop de relatórios XTB (`.xlsx`) e IBKR (`.csv`) diretamente no browser
- **Definições** — configuração de perfil e conta
- **Modo claro/escuro**

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite + Recharts + Tailwind CSS |
| Backend | Node.js + Express (porta 3001) |
| Base de dados | SQLite 3 (ficheiro local por utilizador em `server/data/`) |

## Pré-requisitos

- Node.js 18+

## Instalação

```bash
# Instalar dependências do servidor
cd server
npm install

# Instalar dependências do cliente
cd ../client
npm install
```

## Executar

```bash
# Terminal 1 — servidor (porta 3001)
cd server
npm run dev

# Terminal 2 — cliente (porta 5173)
cd client
npm run dev
```

Abre o browser em `http://localhost:5173`.

## Estrutura

```
trading_app_web/
├── client/          # React + Vite
│   └── src/
│       ├── pages/   # Dashboard, TradeLog, Calendar, Statistics, IRS, Import, Settings
│       └── components/
└── server/          # Express API
    ├── routes/      # trades, dividends, irs, import
    └── data/        # ficheiros .db por utilizador (gerados automaticamente)
```

## Regras Fiscais (IRS Portugal)

- **Anexo G Q9** — Ações portuguesas. EDPR excluída (sede fiscal em Espanha → Anexo J, país 724).
- **Anexo J Q9.2A** — Ações/ETFs estrangeiros (cód. AT: G01). Inclui EDPR.
- **Anexo J Q9.2B** — CFDs (resultado = Gross P/L + Swap + Rollover − Comissão) e Opções. Ganhos e perdas por país separados (cód. AT: G20). A AT proíbe fundir.
- **Anexo J Q8** — Dividendos (E21) e Juros (E20) de fonte estrangeira com retenção na fonte para crédito de dupla tributação.
- **Câmbio:** valores XTB já em EUR; valores IBKR convertidos à taxa histórica da data de cada evento.

## Notas

- Importação feita diretamente no browser via página de Importação (XTB `.xlsx` / IBKR `.csv`)
- Todos os dados são processados localmente — nenhum ficheiro financeiro é enviado para servidores externos
- Uso pessoal, sem autenticação robusta nem cloud
