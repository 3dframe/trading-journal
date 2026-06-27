# System Instructions & Fiscal Rules: Trading Journal

Este documento serve como fonte única da verdade (Single Source of Truth) para o desenvolvimento, refatoração e manutenção do ecossistema Full-Stack **Trading Journal**. Toda e qualquer alteração de código ou adição de novas funcionalidades deve respeitar estritamente a arquitetura técnica e as regras fiscais portuguesas aqui descritas.

---

## 1. Arquitetura Técnico-Funcional do Projeto
A aplicação é um sistema focado no mercado português e funciona de forma local e isolada:
- **Frontend:** React 18 (Vite) + Axios para requisições HTTP + Tailwind CSS para estilização (Dark Mode por defeito).
- **Backend:** Node.js + Express (Porta 3001).
- **Base de Dados:** SQLite 3 (um ficheiro `.db` local e isolado por utilizador em `server/data/`).

### Ficheiros e Rotas Críticas:
- `client/src/pages/Import.jsx` -> Interface de upload drag-and-drop para os relatórios das corretoras.
- `client/src/pages/IRS.jsx` -> Interface de controlo visual, auditoria e exportação do IRS.
- `server/routes/import.js` -> Rota Express encarregue do parsing, conversão de moeda e inserção no SQLite.

---

## 2. Requisitos do Motor de Parsing (Campos Completos)
O importador no backend deve processar os ficheiros sem perdas e mapear TODOS os campos originais antes de os persistir nas tabelas correspondentes do SQLite:

### A) XTB (.xlsx / Excel)
- **Mais-valias (Ações/Derivados):** Ler a aba `CLOSED POSITION HISTORY`. Ignorar as linhas iniciais de metadados do topo. O parsing real começa estritamente na linha de cabeçalho que arranca com "Position". Extrair obrigatoriamente: `Position`, `Symbol`, `Type`, `Volume`, `Open time`, `Open price`, `Close time`, `Close price`, `Open origin`, `Close origin`, `Purchase value`, `Sale value`, `SL`, `TP`, `Margin`, `Commission`, `Swap`, `Rollover`, `Gross P/L`, `Comment`.
- **Rendimentos Passivos:** Ler a aba `CASH OPERATION HISTORY` filtrando as linhas pelas categorias 'DIVIDENT' (Dividendos), 'Withholding Tax' (Imposto retido), 'Free-funds Interest' (Juros brutos recebidos) e 'Free-funds Interest Tax' (Imposto retido sobre juros).

### B) Interactive Brokers - IBKR (.csv / Texto Estruturado)
- **Mais-valias (Ações/Opções):** Filtrar as linhas onde a Coluna 1 = 'Trades' e a Coluna 2 = 'Data'. Isolar exclusivamente os fechos de posição (onde o `Realized P/L` é diferente de zero). Extrair obrigatoriamente: `DataDiscriminator`, `Asset Category`, `Currency`, `Symbol`, `Date/Time`, `Quantity`, `T. Price`, `C. Price`, `Proceeds`, `Comm/Fee`, `Basis`, `Realized P/L`.
- **Rendimentos Passivos:** Filtrar as linhas onde a Coluna 1 é 'Dividends', 'Withholding Tax' ou 'Interest' e a Coluna 2 é 'Data'.

---

## 3. Lógica de Resolução do País de Sede Fiscal
A função backend `resolveCountry(symbol, isinIso, currency)` deve determinar o país de sede fiscal do ativo seguindo esta hierarquia abstrata por ordem estrita de prioridade. A moeda da transação NÃO é um indicador fiável de sede (ex: ações europeias cotadas em USD via ADRs nas bolsas americanas).

### Prioridade 1 — ISIN (Mais Fiável)
As duas primeiras letras do ISIN identificam o país de incorporação segundo a norma ISO 3166-1 alpha-2. Esta é a fonte de verdade oficial.
- Exemplo: ISIN `DE0007164600` → prefixo `DE` → Alemanha (código AT: 276)
- **Para IBKR (trades):** Fazer uma pré-passagem sobre o CSV para extrair a secção `Financial Instrument Information` que contém a coluna `ISIN` mapeada por `Symbol`. Guardar num `Map<symbol, isoCode>` em memória antes de processar os trades.
- **Para IBKR (dividendos):** O ISIN surge na coluna `Description` entre parênteses — ex: `SAP(DE0007164600) Cash Dividend`. Extrair dinamicamente via expressão regular `/\(([A-Z]{2}\d{8,12})\)/`.
- **Para XTB:** O ISIN não consta normalmente do ficheiro Excel de posições fechadas; transitar de imediato para a Prioridade 2.

### Prioridade 2 — Sufixo do Ticker
O sufixo após o ponto decimal no identificador do ativo mapeia a bolsa de negociação e, por consequência direta, o país de origem na maioria das situações.
- Mapeamentos Padrão: `.DE` → Alemanha (276), `.FR` → França (250), `.NL` → Países Baixos (528), `.US` → EUA (840), `.PT` → Portugal (620).
- Para a XTB, os tickers incluem sempre esta informação nativa (ex: `SAP.DE`, `ADBE.US`). Usar diretamente.
- Exceção Registada: O ticker `EDPR.PT` possui o sufixo de Lisboa mas a sua sede fiscal real localiza-se em Espanha — resolvido pela tabela de overrides.

### Prioridade 3 — Tabela de Exceções e Overrides Mapeados
O motor deve validar os dados contra dois dicionários estáticos em memória:
- **`SYMBOL_OVERRIDES`** (Executa ANTES do sufixo): Ações cujo identificador de bolsa é enganador face à sede. Registo obrigatório: `EDPR → ES` (Espanha - 724).
- **`KNOWN_SYMBOLS_COUNTRY`** (Executa APÓS o sufixo falhar, focado em listagens cruzadas americanas sem sufixo):
  - Alemanha (276): `SAP, BAYN, BMW, ALV, SIE, DTE, ADS, BAS, EOAN, RWE, MBG, VOW`
  - Países Baixos (528): `ASML, SHEL, PHG, HEIA, WKL`
  - Reino Unido (826): `AZN, GSK, HSBC, BP, RIO, BTI, VOD`
  - França (250): `TTE, BN, CS`
  - Suíça (756): `NVS, ROG, UBS, CFR`
  - Espanha (724): `BBVA, TEF, ITX`
  - Dinamarca (208): `NVO, NOVO`
  - Japão (392): `TM, HMC, SONY, NTT`

### Prioridade 4 — Moeda do Ativo (Fallback de Último Recurso)
Utilizar apenas quando os critérios anteriores falharem por completo. Registar o log do método como `"currency_fallback"`.
- Mapeamento: `USD → EUA (840)`, `GBP → Reino Unido (826)`, `CAD → Canadá (124)`, `AUD → Austrália (036)`, `JPY → Japão (392)`.

---

## 4. Gestão de Câmbio e Múltiplas Moedas
A Autoridade Tributária (AT) em Portugal exige que todos os valores na declaração de IRS sejam submetidos convertidos para a divisa **Euro (EUR)**.
- **Regra XTB:** Os campos de valores financeiros (`Purchase value`, `Sale value` e `Gross P/L`) na aba de posições fechadas já vêm convertidos para a moeda base da conta (EUR). Devem ser usados diretamente para os cálculos fiscais, mantendo o símbolo original.
- **Regra IBKR:** Os valores surgem na moeda nativa do ativo (`Currency` = USD, GBP, etc.). O sistema DEVE aplicar uma função helper `convertToEUR(amount, currency, date)` que utilize taxas de câmbio históricas oficiais baseadas na data exata de cada evento:
  * O valor de aquisição (compra) é convertido usando a taxa de câmbio da data de compra.
  * O valor de realização (venda) é convertido usando a taxa de câmbio da data de venda.

---

## 5. Mapeamento Fiscal e Interface de Controlo (`IRS.jsx`)
A página `client/src/pages/IRS.jsx` atua como uma **Interface de Conferência e Controlo Visual Quadro a Quadro**. Carrega os dados consolidados do SQLite e renderiza sub-separadores isolados organizados da seguinte forma para auditoria de cópia direta:

### A) Anexo G - Quadro 9 (Ações Nacionais)
- **Filtro:** Ações com sede e sufixo em Portugal (ex: `EDP.PT`, `NOS.PT`, `BCP.PT`).
- **EXCEÇÃO CRUCIAL (EDPR.PT):** O ativo *EDP Renováveis*, apesar de negociar com o sufixo `.PT`, tem sede fiscal em **Espanha**. Deve ser terminantemente excluído do Anexo G e enviado para o Anexo J (País 724).
- **Campos Visuais da Grelha:** [Titular] | [Cód. Ativo] | [Data Aquisição] | [Valor Aquisição (EUR, incluindo comissões de compra)] | [Data Realização] | [Valor Realização (EUR, líquido de comissões de venda)] | [Despesas Declaradas].

### B) Anexo J - Quadro 9.2A (Mais-valias de Ativos Estrangeiros)
- **Filtro:** Ações e ETFs internacionais (ex: `ADBE`, `ORI.US`, `QDVE`) E a exceção nacional `EDPR.PT`.
- **Campos Visuais da Grelha:** [País da Fonte (Cód. AT)] | [Cód. Ativo (G01 para ações)] | [Data Aquisição] | [Valor Aquisição (EUR)] | [Data Realização] | [Valor Realização (EUR)].

### C) Anexo J - Quadro 9.2B (Derivados: CFDs e Opções)
- **Filtro:** Operações onde `Asset Category` = 'CFD' ou 'Options' (ou linhas XTB com valores nas colunas Swap/Rollover).
- **Regra de Agrupamento Obrigatória:** A AT proíbe fundir lucros e prejuízos globais neste quadro. A interface deve agrupar por País da Fonte e separar os totais anuais. Os ganhos vão numa linha e as perdas noutra.
- **Cálculo de CFD:** O valor nocional alavancado de abertura/fecho não é preenchido. O Resultado Líquido por trade é calculado como: `Gross P/L + Swap + Rollover - Commission`. Se for positivo, acumula no campo "Rendimentos (Ganhos)"; se for negativo, acumula no campo "Perdas".
- **Cálculo de Opções:** O resultado baseia-se no valor de `Realized P/L` convertido para EUR na data de fecho ou expiração da opção.
- **Campos Visuais da Grelha:** [País da Fonte] | [Cód. Rendimento (G20)] | [Ano] | [Rendimentos (Ganhos Totais em EUR)] | [Perdas (Prejuízos Totais em EUR)].

### D) Anexo J - Quadro 8 (Rendimentos de Capitais: Dividendos e Juros)
- **Dividendos Estrangeiros:** Extrai os dividendos internacionais (incluindo `EDPR.PT`). Devem ser exibidos pelo seu valor **BRUTO** em EUR, associando na mesma linha a respetiva retenção na fonte (`Withholding Tax` convertido para EUR) e o Código do País da Fonte. Isto permite acionar o crédito por dupla tributação internacional (Cód. Rendimento E21).
- **Juros Estrangeiros:** Mapeia os juros bruros recebidos sobre saldos à ordem **da IBKR** ('Interest' positivo, com fonte na Irlanda) convertidos para EUR (Cód. Rendimento E20).
- **Campos Visuais da Grelha:** [País da Fonte] | [Cód. Rendimento (E21 ou E20)] | [Rendimento Bruto (EUR)] | [Imposto Retido no Estrangeiro (EUR)].
- **⚠️ EXCEÇÃO XTB (Juros Nacionais — EXCLUIR do Anexo J):** Os juros pagos pela XTB ('Free-funds Interest') e a respetiva retenção ('Free-funds Interest Tax') **NÃO** são rendimentos estrangeiros. Como a XTB opera em Portugal através de uma sucursal nacional (NIF português iniciado por `980` e contas `PT50`), estes juros são considerados rendimentos obtidos em Portugal. A própria XTB retém automaticamente na fonte a taxa liberatória de 28%, pelo que o rendimento fica totalmente tributado e o titular está **dispensado de o declarar no IRS** (salvo opção por englobamento, que não é objetivo desta app). Estas linhas devem ser **terminantemente excluídas do Quadro 8 do Anexo J** e nunca somadas aos juros estrangeiros da IBKR. Podem, opcionalmente, ser exibidas apenas num **cartão informativo lateral de "Rendimentos Dispensados de Declaração"**, mostrando o juro bruto, a retenção de 28% e o valor líquido — a título meramente informativo, sem qualquer impacto nos quadros declarativos.

### E) Anexo J - Quadro 11 (Contas no Estrangeiro)
- **Regra:** Exibir um cartão informativo de controlo fixo a alertar para a obrigatoriedade de declarar a conta da IBKR.
- **Campos Visuais:** [País da Conta: IE (Irlanda)] | [Instituição: Interactive Brokers Ireland Limited] | [Número de Conta / IBAN].

---

## 6. Requisito Absoluto de Privacidade
Por razões de sigilo e segurança fiscal, todos os parsings, cálculos cambiais e processamentos de ficheiros devem ser executados localmente no ecossistema da aplicação (client-side ou na API Express local do utilizador). É expressamente proibido o envio de dados financeiros ou relatórios para servidores ou APIs externas de terceiros.

---

## 7. Competências Especializadas (Core Skills)

### SKILL 1: O Especialista Fiscal (IRS Portugal)
A IA deve atuar como um perito em fiscalidade portuguesa de ativos financeiros, ditando de que forma as transações devem ser triadas, classificadas e encaminhadas para as tabelas do SQLite e ecrãs do frontend:

1. Regra de Triagem por Sede Fiscal (Resolução de Países):
   - O país de declaração no Anexo J é definido pela sede real da empresa emissora e não pela bolsa onde foi comprada.
   - Ativos Nacionais (Anexo G, Quadro 9): Tickers com sufixo '.PT' e sede em Portugal (ex: BCP.PT, NOS.PT, EDP.PT).
   - Dicionário de Exceções Absolutas (Desvio Automático para o Anexo J):
     * 'EDPR.PT' (EDP Renováveis) -> Sede em Espanha. Encaminhar mais-valias para o Anexo J (Quadro 9.2A) e dividendos para o Anexo J (Quadro 8). Código do País da Fonte: 724 (Espanha).
     * 'JMT.PT' (Jerónimo Martins) -> Sede em Portugal para mais-valias (Anexo G, Quadro 9), mas a holding que paga os dividendos está na Holanda. Encaminhar os dividendos obrigatoriamente para o Anexo J (Quadro 8). Código do País da Fonte: 528 (Países Baixos).
     * 'SAP' -> Empresa Alemã. Encaminhar mais-valias para o Anexo J (Quadro 9.2A) e dividendos para o Anexo J (Quadro 8). Código do País da Fonte: 276 (Alemanha).

2. Validação Cruzada de Produtos (Ações Puras vs. CFDs na XTB):
   - Como os CFDs na XTB usam o mesmo Ticker das ações normais, o parser deve diferenciar o produto inspecionando a coluna 'Type' em conjunto com as colunas 'Swap' ou 'Rollover'.
   - Se a linha contiver valores preenchidos em 'Swap' ou 'Rollover', ou o tipo de ativo for identificado como CFD, a transação deve ser tratada como Derivado (Anexo J, Quadro 9.2B) e nunca como Ação.

3. Regra de Segregação de Juros e Retenções Nacionais (XTB):
   - O motor de dados deve **isolar** as linhas de juros da XTB ('Free-funds Interest') e a respetiva retenção ('Free-funds Interest Tax') das restantes operações de capitais, marcando-as como **rendimento nacional já tributado na fonte**.
   - Justificação fiscal: a XTB opera em Portugal através de uma sucursal nacional (NIF português `980...` e contas `PT50...`), pelo que estes juros são rendimentos obtidos em Portugal. A XTB aplica automaticamente a taxa liberatória de 28% na fonte, deixando o rendimento totalmente tributado e dispensado de declaração no IRS (salvo englobamento, fora do âmbito da app).
   - Estas linhas **NUNCA** podem ser misturadas nem somadas com os juros estrangeiros da IBKR (que têm fonte na Irlanda e vão obrigatoriamente para o Anexo J, Quadro 8, Cód. E20). É o oposto exato do tratamento da IBKR.
   - Encaminhamento: excluir do Quadro 8 do Anexo J. O destino máximo permitido é um cartão informativo lateral de "Rendimentos Dispensados de Declaração", sem qualquer reflexo nas grelhas declarativas de copy-paste.

4. Filosofia de Output do Ecrã de IRS (`IRS.jsx`):
   - O objetivo desta página é o controlo visual e a disponibilização de dados brutos e exatos, estruturados especificamente para facilitar o 'copy-paste' direto para as grelhas do Portal das Finanças. Não deve incluir cálculos de estimativas de imposto ou simulações de englobamento no topo dos quadros.