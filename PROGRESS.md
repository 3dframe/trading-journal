# Progress / Estado do Trabalho

> Ficheiro de continuidade entre sessões. Atualizar no fim de cada sessão de trabalho.

## Em curso
- (nada a meio)

## Pendente (decisão do utilizador)
- **ETFs IBKR sem país**: QDVE, SMH, NQSE, AFXD (13 trades, EUR) ficaram com país nulo
  (sem sufixo/ISIN; fallback EUR é ambíguo). Tratar **um a um** — provável domicílio
  Irlanda, mas confirmar por afetar o IRS. Padrão: juntar a `KNOWN_SYMBOLS_COUNTRY` em
  `server/routes/import.js` + migrar dados (como feito para `COR:"PT"`).
- Redundância: o card "Categorias" (mini-donuts) duplica o novo donut "Repartição por
  Categoria" — decidir se se remove.

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
2026-06-21
