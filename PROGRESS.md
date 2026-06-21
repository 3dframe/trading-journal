# Progress / Estado do Trabalho

> Ficheiro de continuidade entre sessões. Atualizar no fim de cada sessão de trabalho.

## Em curso
- (nada pendente de momento)

## Feito na sessão de 2026-06-21
- **Registo de Operações:** paginação do lado do cliente (25/50/100/Todos) e
  navegação por mês/ano no calendário de período (título clicável).
- **Sessões:** limpeza automática de ficheiros temporários órfãos (`<id>.json.<n>`)
  no arranque e de hora a hora; config explícita de `ttl`/`reapInterval`.
- **Câmbios (instructions.md §6 resolvido):** nova tabela local do BCE em
  `server/fx.js` (`server/fxrates.db`), atualizada **automaticamente** (arranque,
  24h, e antes de cada importação). O IBKR deixou de usar `api.frankfurter.app`.
- **Moeda das contas XTB:** o XTB reporta na moeda da conta; conta `52663818` é USD.
  Parser passa a converter contas não-EUR para EUR à data (mapa `XTB_ACCOUNT_CURRENCY`).
  Dados existentes migrados via `server/migrate-xtb-usd.js`.

## Próximos passos / ideias
- Possível botão "Atualizar câmbios" na página de Administração (estado em `GET /api/admin/fx`).
- Auto-deteção da moeda da conta XTB a partir do cabeçalho do ficheiro (falta ficheiro de exemplo).
- Pontos de atenção por tratar: paginação server-side, export Excel/parsing em memória, testes.

## Decisões / bloqueios
- Câmbios automáticos: o download do BCE não envia dados de operações (privacidade OK);
  desativável com `FX_AUTO_UPDATE=0`.

## Última atualização
2026-06-21
