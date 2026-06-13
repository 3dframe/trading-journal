# Trading Journal

Diário de trading pessoal para acompanhamento de operações e dividendos importados da **XTB** e **IBKR**, com relatório de IRS para Portugal.

## Funcionalidades

- **Dashboard** — P&L total, win rate, drawdown, curva de equity, P&L semanal, breakdown por Ações / CFDs / Opções / Dividendos
- **Registo de Operações** — lista completa de trades e dividendos com filtros por ano, categoria, resultado, corretora e símbolo; histórico por símbolo
- **Calendário** — visualização de trades por dia/mês
- **Estatísticas** — P&L por símbolo, win rate, métricas de risco (Profit Factor, R:R, Avg Win/Loss)
- **Relatório IRS** — quadros estruturados para o Portal das Finanças (Anexo G Q9, Anexo G Q13, Anexo J Q8, Anexo J Q9.2A/B) com exportação para Excel
- **Modo claro/escuro**

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite + Recharts |
| Backend | Node.js + Express |
| Base de dados | SQLite (partilhada com a app Python de importação) |

## Pré-requisitos

- Node.js 18+
- Base de dados SQLite gerada pela app Python de importação (`trading_app`)

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
│       ├── pages/   # Dashboard, TradeLog, Calendar, Statistics, IRS, Import
│       └── components/
└── server/          # Express API
    └── routes/      # trades, dividends, irs
```

## Notas

- Os dados são importados exclusivamente através da app Python Streamlit (`arrancar_app.bat`)
- A base de dados SQLite é partilhada entre as duas apps — esta app é só de leitura
- Uso pessoal, sem autenticação nem cloud
