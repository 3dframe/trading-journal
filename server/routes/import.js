const express  = require("express");
const multer   = require("multer");
const path     = require("path");
const fs       = require("fs");
const ExcelJS  = require("exceljs");
const fx       = require("../fx");
const quotes   = require("../quotes");
const { getDb, clearDb } = require("../db");
const { cryptoName } = require("../crypto-names");

const router   = express.Router();
const DATA_DIR = path.join(__dirname, "..", "data");

// Normaliza várias formas de data para YYYY-MM-DD (ISO, DD-MM-YYYY, DD/MM/YYYY, timestamps).
function toYMD(s) {
  if (!s) return null;
  const str = String(s).trim();
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = str.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(str);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

// Período (data mínima/máxima) a que o ficheiro importado respeita, a partir de todas as
// datas presentes (trades, dividendos, depósitos e movimentos das posições/cripto).
function computePeriod(trades = [], dividends = [], deposits = [], holdings = []) {
  const dates = [];
  const push = s => { const y = toYMD(s); if (y) dates.push(y); };
  trades.forEach(t => { push(t.data_abertura); push(t.data_fecho); });
  dividends.forEach(d => push(d.data_pagamento));
  deposits.forEach(d => push(d.data));
  holdings.forEach(h => {
    let movs = []; try { movs = JSON.parse(h.movimentos || "[]"); } catch { movs = []; }
    movs.forEach(m => push(m.data));
  });
  if (!dates.length) return { de: null, ate: null };
  dates.sort();
  return { de: dates[0], ate: dates[dates.length - 1] };
}

const USERS_FILE = path.join(__dirname, "..", "users.json");
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}
function hasCustomDb(username) {
  const u = loadUsers().find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!u?.dbPath) return false;
  const resolved = path.resolve(u.dbPath);
  const local    = path.resolve(DATA_DIR);
  return !resolved.startsWith(local + path.sep) && resolved !== local;
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// ── Tabelas de mapeamento ──────────────────────────────────

// ISO 3166-1 alpha-2 → nome do país em português (para ISIN e sufixo de bolsa)
const EXCHANGE_COUNTRY = {
  PT:"Portugal",    US:"Estados Unidos", NL:"Países Baixos", DE:"Alemanha",
  FR:"França",      GB:"Reino Unido",    UK:"Reino Unido",   ES:"Espanha",
  IT:"Itália",      SE:"Suécia",         CH:"Suíça",         BE:"Bélgica",
  DK:"Dinamarca",   NO:"Noruega",        FI:"Finlândia",     IE:"Irlanda",
  LU:"Luxemburgo",  AT:"Áustria",        AU:"Austrália",     CA:"Canadá",
  JP:"Japão",       HK:"Hong Kong",      SG:"Singapura",     PL:"Polónia",
  CN:"China",       KR:"Coreia do Sul",  TW:"Taiwan",        BR:"Brasil",
  IN:"Índia",       IL:"Israel",         MX:"México",        ZA:"África do Sul",
};

// Overrides explícitos: ações cujo sufixo de bolsa não corresponde à sede fiscal real.
// Executa ANTES da leitura do sufixo — máxima prioridade.
// Chave: símbolo base sem sufixo (maiúsculas); Valor: ISO do país de sede.
const SYMBOL_OVERRIDES = {
  EDPR: "ES", // EDP Renováveis — sufixo .PT mas sede fiscal em Espanha (AT: 724)
};

// Overrides de país APENAS para dividendos: empresas cujo país de sede (mais-valias)
// difere do país da holding que paga dividendos (§7 Skill 1).
// Chave: símbolo base (maiúsculas); Valor: ISO do país de origem dos dividendos.
const DIVIDEND_COUNTRY_OVERRIDES = {
  JMT: "NL", // Jerónimo Martins — mais-valias em Portugal (Anexo G), mas dividendos pagos pela holding neerlandesa (AT: 528)
};

// Empresas europeias/internacionais com listagem cruzada em bolsas americanas.
// Em IBKR o ticker aparece sem sufixo e a moeda é USD — sem esta tabela o
// fallback por moeda daria erradamente "Estados Unidos".
const KNOWN_SYMBOLS_COUNTRY = {
  // Alemanha — AT 276
  SAP:"DE",  BAYN:"DE", BMW:"DE",  DTE:"DE",  ALV:"DE",  MBG:"DE",
  SIE:"DE",  VOW:"DE",  ADS:"DE",  BAS:"DE",  EOAN:"DE", RWE:"DE",
  AFXD:"DE", // Carl Zeiss Meditec AG (DE0005313704) — em IBKR sem sufixo nem ISIN captado
  // Países Baixos — AT 528
  ASML:"NL", SHEL:"NL", PHG:"NL",  HEIA:"NL", WKL:"NL",
  // Reino Unido — AT 826
  AZN:"GB",  GSK:"GB",  HSBC:"GB", BP:"GB",   RIO:"GB",
  BTI:"GB",  VOD:"GB",  LSEG:"GB", EXPN:"GB",
  // França — AT 250
  TTE:"FR",  BN:"FR",   CS:"FR",   AI:"FR",
  // Suíça — AT 756
  NVS:"CH",  ROG:"CH",  UBS:"CH",  CFR:"CH",
  // Espanha — AT 724
  BBVA:"ES", TEF:"ES",  ITX:"ES",  SAN:"ES",  IBE:"ES",  REP:"ES",  NTGY:"ES",
  // Dinamarca — AT 208
  NVO:"DK",  NOVO:"DK",
  // Suécia — AT 752
  ERIC:"SE", VOLV:"SE",
  // Irlanda — AT 372
  CRH:"IE",
  // ETFs UCITS domiciliados na Irlanda (em IBKR aparecem sem sufixo nem ISIN captado).
  // O ISIN US (versão americana) é resolvido antes por sufixo/ISIN, por isso estes só
  // se aplicam à versão UCITS irlandesa negociada em EUR sem ISIN no relatório.
  QDVE:"IE", // iShares S&P 500 IT Sector UCITS (IE00B3WJKG14)
  NQSE:"IE", // iShares Nasdaq 100 EUR-H Acc UCITS (IE00BYVQ9F29)
  SMH:"IE",  // VanEck Semiconductor UCITS (IE00BMC38736) — distinta da VanEck US (US92189F6768)
  // Portugal — AT 620 (em IBKR aparecem sem sufixo .PT nem ISIN)
  COR:"PT",  // Corticeira Amorim
  // Japão — AT 392
  TM:"JP",   HMC:"JP",  SONY:"JP", NTT:"JP",
};

// Moeda → ISO do país (fallback de último recurso).
// NÃO usar como critério principal: empresas europeias podem negociar em USD (ADRs).
const CURRENCY_COUNTRY = {
  USD:"US", GBP:"GB", CAD:"CA", AUD:"AU", JPY:"JP",
  HKD:"HK", SGD:"SG", CHF:"CH", SEK:"SE", DKK:"DK",
  NOK:"NO", PLN:"PL", CNY:"CN",
};

// CFDs sobre subjacentes que NÃO são ações — não têm país de incorporação.
// Classificados pelo tipo de subjacente (mercadoria/índice/forex/cripto) em vez de país,
// para ficarem coerentes em todas as vistas (registo, estatísticas, IRS).
const COMMODITIES = new Set([
  "GOLD","SILVER","OIL","OILWTI","WTI","BRENT","NATGAS","GAS","COCOA","COFFEE",
  "SUGAR","WHEAT","CORN","COTTON","COPPER","PLATINUM","PALLADIUM","SOYBEAN","RICE",
  "ALUMINIUM","NICKEL","ZINC","LEAD","EMISSIONS",
]);
const CRYPTOS = new Set([
  "BITCOIN","ETHEREUM","CARDANO","SOLANA","DOGECOIN","POLYGON","FILECOIN","DECENTRALAND",
  "RIPPLE","LITECOIN","POLKADOT","CHAINLINK","STELLAR","TRON","SHIBA","AVALANCHE",
  "UNISWAP","COSMOS","ALGORAND","TEZOS","EOS","MONERO","DASH","SANDBOX","VECHAIN",
]);
const FX_CODES = new Set([
  "EUR","USD","GBP","JPY","CHF","CAD","AUD","NZD","SEK","NOK","DKK","PLN",
  "CNH","CNY","HUF","CZK","TRY","ZAR","MXN","SGD","HKD","ILS","RON",
]);

/**
 * Extrai o ativo subjacente de um símbolo de opção, ou null se não for opção.
 * Formato: <TICKER><dia><MÊS><ano><strike><C|P>
 * Ex: SAN17APR269.75C → SAN ; BBVA20MAR2619C → BBVA ; DB15MAY2630C → DB
 */
function optionUnderlying(symbol) {
  const m = (symbol || "").toUpperCase().match(/^([A-Z]+)\d{1,2}[A-Z]{3}\d{2}[\d.]+[CP]$/);
  return m ? m[1] : null;
}

/**
 * Classifica um CFD pelo tipo de subjacente (ou null se for/parecer uma ação).
 * Ex: COCOA→Mercadoria, US100→Índice, EURUSD/EUR.USD→Forex, ETHEREUM→Cripto.
 */
function classifyUnderlying(symbol) {
  const s = (symbol || "").toUpperCase().replace(/\./g, "").replace(/_\d+$/, "");
  if (COMMODITIES.has(s)) return "Mercadoria";
  if (CRYPTOS.has(s))     return "Cripto";
  if (/^[A-Z]{6}$/.test(s) && FX_CODES.has(s.slice(0, 3)) && FX_CODES.has(s.slice(3, 6)))
    return "Forex";
  if (/^[A-Z]{2,5}\d{2,4}$/.test(s)) return "Índice"; // US100, DE30, EU50, FRA40, JP225…
  return null;
}

/**
 * Resolve o país de sede fiscal com hierarquia obrigatória (ver instructions.md §3):
 *   1. Override explícito  (ex: EDPR → Espanha, ignora sufixo .PT)
 *   2. Tipo de subjacente  (mercadoria/índice/forex/cripto — não são ações)
 *   3. ISIN (prefixo ISO — fonte mais fiável de país de incorporação)
 *   4. Sufixo do ticker   (.DE → Alemanha, .US → EUA, etc.)
 *   5. Exceções conhecidas (blue chips europeus sem sufixo em IBKR)
 *   6. Moeda como estimativa (ADRs europeus em USD seriam mal classificados)
 */
function resolveCountry(symbol, isinIso, currency) {
  const base   = symbol.split(".")[0].toUpperCase();
  const suffix = symbol.includes(".") ? symbol.split(".").pop().toUpperCase() : "";

  if (SYMBOL_OVERRIDES[base])
    return EXCHANGE_COUNTRY[SYMBOL_OVERRIDES[base]] || null;
  // Opções: resolver pelo país do ativo subjacente (ex: SAN/BBVA → Madrid/Espanha)
  const optUnd = optionUnderlying(symbol);
  if (optUnd) return resolveCountry(optUnd, isinIso, currency);
  const tipo = classifyUnderlying(symbol);
  if (tipo) return tipo;
  if (isinIso && EXCHANGE_COUNTRY[isinIso])
    return EXCHANGE_COUNTRY[isinIso];
  if (suffix && EXCHANGE_COUNTRY[suffix])
    return EXCHANGE_COUNTRY[suffix];
  if (KNOWN_SYMBOLS_COUNTRY[base])
    return EXCHANGE_COUNTRY[KNOWN_SYMBOLS_COUNTRY[base]] || null;
  if (currency && CURRENCY_COUNTRY[currency])
    return EXCHANGE_COUNTRY[CURRENCY_COUNTRY[currency]] || null;
  return null;
}

/**
 * Resolve o país de origem para dividendos.
 * Aplica DIVIDEND_COUNTRY_OVERRIDES antes da lógica geral (§7 Skill 1):
 * ex: JMT.PT → mais-valias em Portugal, dividendos em Países Baixos (holding).
 */
function resolveDividendCountry(symbol, isinIso, currency) {
  const base = symbol.split(".")[0].toUpperCase();
  if (DIVIDEND_COUNTRY_OVERRIDES[base])
    return EXCHANGE_COUNTRY[DIVIDEND_COUNTRY_OVERRIDES[base]] || null;
  return resolveCountry(symbol, isinIso, currency);
}

// ── Taxa de câmbio histórica (tabela local do BCE) ────────
// Conformidade §6: nenhuma informação de operações sai do servidor. As taxas vêm
// da tabela local alimentada pelo eurofxref-hist do BCE (ver ../fx.js e o endpoint
// admin POST /api/admin/fx/update). Devolve EUR por 1 unidade da moeda, ou null se
// a tabela não tiver cotação para a data (ex.: tabela ainda não atualizada).
function eurRate(currency, dateStr) {
  return fx.eurPerUnit(currency, dateStr);
}

// ── Helpers ───────────────────────────────────────────────
function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 19).replace("T", " ");
  const s = v.toString().trim();
  if (!s || s === "0") return null;
  const eu = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (eu) {
    const [, dd, mm, yyyy] = eu;
    const d = new Date(`${yyyy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`);
    return isNaN(d) ? null : d.toISOString().slice(0, 10) + " 00:00:00";
  }
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().slice(0, 19).replace("T", " ");
}
function toFloat(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseFloat(v.toString().replace(/\s/g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}
function cellVal(cell) {
  if (!cell) return null;
  if (cell.type === 4) return cell.value;
  if (cell.value && typeof cell.value === "object" && "result" in cell.value) return cell.value.result;
  return cell.value;
}

// Moeda da conta XTB por número de conta. O relatório XTB reporta TUDO na moeda da
// conta (não na do instrumento): contas em EUR já vêm em euros, mas contas noutra
// moeda (ex.: USD) vêm sem qualquer conversão. Para essas é preciso converter para
// EUR à data de cada operação. Mantemos um override explícito (fonte de verdade) por
// não ser fiável auto-detetar a moeda do cabeçalho do ficheiro. Acrescenta aqui novas
// contas não-EUR. Contas em falta assumem EUR (comportamento anterior, sem regressão).
const XTB_ACCOUNT_CURRENCY = {
  "52663818": "USD",
};

// ── Parser XTB (.xlsx) ────────────────────────────────────
async function parseXTB(buffer, filename = "") {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  // Moeda da conta a partir do PREFIXO do nome do ficheiro (ex: "EUR_1682079_...",
  // "USD_52663818_..."). É a forma fiável de deteção automática — o conteúdo do ficheiro
  // não traz a moeda. Fallback: mapa por nº de conta (XTB_ACCOUNT_CURRENCY) e, por fim, EUR.
  const fnameCurrency = (String(filename).match(/^([A-Z]{3})[_-]/) || [])[1] || null;

  // ── Número de conta (cabeçalho do relatório: "Account number" / "Account") ──
  let accountNumber = null;
  wb.eachSheet(ws => {
    if (accountNumber) return;
    for (let r = 1; r <= 3; r++) {
      const label = (cellVal(ws.getRow(r).getCell(1)) || "").toString().toLowerCase();
      if (label.includes("account")) {
        const v = cellVal(ws.getRow(r).getCell(2));
        if (v) { accountNumber = v.toString().trim(); break; }
      }
    }
  });

  // Moeda da conta (override por nº de conta; default EUR). Para contas não-EUR
  // os valores vêm na moeda da conta e são convertidos para EUR no fim da função.
  const accountCurrency = (fnameCurrency || XTB_ACCOUNT_CURRENCY[accountNumber] || "EUR").toUpperCase();

  // ── Aba de operações fechadas ──
  let sheet = null, headerRowNum = 1;
  wb.eachSheet(ws => {
    if (sheet) return;
    if (ws.name.toLowerCase().includes("cash")) return; // evita falsos positivos em comentários de movimentos de caixa
    for (let r = 1; r <= 15; r++) {
      const cells = [];
      ws.getRow(r).eachCell(c => cells.push((cellVal(c) || "").toString().toLowerCase()));
      if (cells.some(c => c.includes("símbolo") || c.includes("symbol") || c.includes("lucro") || c.includes("profit"))) {
        sheet = ws; headerRowNum = r; break;
      }
    }
  });
  if (!sheet) throw new Error("Não foi encontrada uma folha de operações no ficheiro XTB.");

  const headers = [];
  sheet.getRow(headerRowNum).eachCell({ includeEmpty: true }, c => {
    headers.push((cellVal(c) || "").toString().toLowerCase().trim());
  });
  const col = (...keys) => headers.findIndex(h => keys.some(k => h.includes(k)));

  const iPos        = col("position", "posição", "id");
  const iSym        = col("símbolo", "symbol", "ticker");
  const iCategory   = col("category", "categoria");
  const iType       = col("tipo", "type");
  const iVol        = col("volume");
  const iOpen       = col("hora de abertura", "open time", "data de abertura", "abertura");
  const iClose      = col("hora de encerramento", "close time", "data de encerramento", "encerramento");
  const iOpenPrice  = col("open price", "preço de abertura", "preco de abertura");
  const iClosePrice = col("close price", "preço de encerramento", "preco de encerramento");
  const iPurchase   = col("purchase value", "valor de compra");
  const iSale       = col("sale value", "valor de venda");
  const iComm       = col("comissão", "commission");
  const iSwap       = col("swap");
  const iRollover   = col("rollover");
  const iGrossPL    = col("gross p/l", "gross profit", "lucro bruto");
  const iPL         = col("lucro / perda", "lucro/perda", "net profit", "profit", "lucro");
  const iSL         = col("s/l", "sl", "stop loss", "stop");
  const iTP         = col("t/p", "tp", "take profit");
  const iMargin     = col("margin", "margem");
  const iComment    = col("comment", "comentário", "comentario", "observ");
  const iInstrument = col("instrument", "instrumento");
  const iProduct    = col("product", "produto");
  const iOpenConv   = col("open conversion", "taxa de conversão de abertura");
  const iCloseConv  = col("close conversion", "taxa de conversão de encerramento");
  const iCloseOrig  = col("close origin", "origem de encerramento");

  if (iSym < 0) throw new Error("Coluna de símbolo não encontrada no ficheiro XTB.");

  const trades = [];
  sheet.eachRow((row, n) => {
    if (n <= headerRowNum) return;
    const get = i => (i >= 0 ? cellVal(row.getCell(i + 1)) : null);
    const sym = get(iSym);
    if (!sym) return;

    const symStr     = sym.toString().trim();
    const commission = Math.abs(toFloat(get(iComm)));
    const swap       = toFloat(get(iSwap));
    const rollover   = toFloat(get(iRollover));
    const typeStr     = (get(iType) || "").toString().toLowerCase();
    const categoryStr = iCategory >= 0 ? (get(iCategory) || "").toString().toLowerCase() : "";
    const hasSuffix   = /\.[A-Z]{2,4}(_\d+)?$/.test(symStr);
    // Categoria explícita (coluna "Category") tem prioridade; sem ela, usa heurística
    // baseada em swap/rollover/sufixo (relatórios antigos não tinham esta coluna).
    const isCFD = categoryStr
      ? categoryStr.includes("cfd") || categoryStr.includes("forex")
      : (swap !== 0 || rollover !== 0 || typeStr.includes("cfd") || !hasSuffix);
    const purchaseVal = toFloat(get(iPurchase));
    const saleVal     = toFloat(get(iSale));
    const grossPL     = iGrossPL >= 0 ? toFloat(get(iGrossPL)) : null;

    // Net P/L do XTB = Gross P/L + Swap + Rollover - Commission
    const pl = iPL >= 0
      ? toFloat(get(iPL))
      : grossPL !== null
        ? grossPL + swap + rollover - commission
        : saleVal - purchaseVal - commission;

    const posId = iPos >= 0 ? get(iPos)?.toString().trim() : null;
    const pais  = resolveCountry(symStr, null, accountCurrency);

    trades.push({
      simbolo:          symStr.split(".")[0].toUpperCase(),
      data_abertura:    toDate(get(iOpen)),
      data_fecho:       toDate(get(iClose)),
      pl_eur:           pl,
      volume:           toFloat(get(iVol)),
      fees:             commission,
      swap,
      rollover,
      gross_pl:         grossPL,
      valor_compra_eur: iPurchase >= 0 ? purchaseVal : null,
      valor_venda_eur:  iSale     >= 0 ? saleVal     : null,
      pl_orig:          pl,        // moeda nativa da conta (igual à corretora)
      valor_compra_orig: iPurchase >= 0 ? purchaseVal : null,
      valor_venda_orig:  iSale     >= 0 ? saleVal     : null,
      preco_abertura:   iOpenPrice  >= 0 ? toFloat(get(iOpenPrice))  || null : null,
      preco_fecho:      iClosePrice >= 0 ? toFloat(get(iClosePrice)) || null : null,
      sl:               iSL     >= 0 ? toFloat(get(iSL))     || null : null,
      tp:               iTP     >= 0 ? toFloat(get(iTP))     || null : null,
      margin:           iMargin >= 0 ? toFloat(get(iMargin)) || null : null,
      comment:          iComment >= 0 ? get(iComment)?.toString().trim() || null : null,
      nome_instrumento: iInstrument >= 0 ? get(iInstrument)?.toString().trim() || null : null,
      produto:          iProduct    >= 0 ? get(iProduct)?.toString().trim()    || null : null,
      origem:           iCloseOrig  >= 0 ? get(iCloseOrig)?.toString().trim() || null : null,
      conversao_abertura: iOpenConv  >= 0 ? toFloat(get(iOpenConv))  || null : null,
      conversao_fecho:    iCloseConv >= 0 ? toFloat(get(iCloseConv)) || null : null,
      moeda_original:   accountCurrency,
      taxa_cambio:      1.0,
      categoria:        isCFD ? "CFD" : "STOCK",
      corretora:        "XTB",
      conta:            accountNumber,
      conta_nome:       null, // XTB não disponibiliza o nome do titular no relatório
      tipo_ordem:       get(iType)?.toString() ?? null,
      pais,
      ref_externa:      posId || null,
    });
  });

  // Nota: NÃO bloquear aqui se não houver trades — um período pode não ter operações
  // fechadas mas ter juros/dividendos/depósitos válidos na folha de Cash Operations.
  // A validação final (nada encontrado em sítio nenhum) acontece no fim da função.

  // ── Aba de movimentos de caixa ──
  const dividends = [];
  const deposits  = [];
  let cashSheet = null, cashHeaderRow = 1;

  wb.eachSheet(ws => {
    if (cashSheet) return;
    const name = ws.name.toLowerCase();
    if (!name.includes("cash")) return;
    for (let r = 1; r <= 15; r++) {
      const cells = [];
      ws.getRow(r).eachCell(c => cells.push((cellVal(c) || "").toString().toLowerCase()));
      if (cells.some(c => c.includes("type") || c.includes("tipo") || c.includes("comment") || c.includes("amount"))) {
        cashSheet = ws; cashHeaderRow = r; break;
      }
    }
  });

  if (cashSheet) {
    const cashHeaders = [];
    cashSheet.getRow(cashHeaderRow).eachCell({ includeEmpty: true }, c => {
      cashHeaders.push((cellVal(c) || "").toString().toLowerCase().trim());
    });
    const cc = (...keys) => cashHeaders.findIndex(h => keys.some(k => h.includes(k)));
    const cType      = cc("type", "tipo", "operation");
    const cDate      = cc("time", "date", "data");
    const cSym       = cc("symbol", "símbolo", "ticker");
    const cAmount    = cc("amount", "valor", "montante");
    const cId        = cc("id");
    const cInstrument = cc("instrument", "instrumento");
    const cProduct    = cc("product", "produto");
    const cComment    = cc("comment", "comentário", "comentario");

    const divMap      = new Map();
    const interestMap = new Map(); // agrupa juros por data

    cashSheet.eachRow((row, n) => {
      if (n <= cashHeaderRow) return;
      const get   = i => (i >= 0 ? cellVal(row.getCell(i + 1)) : null);
      const type  = (get(cType) || "").toString().toLowerCase().trim();
      const amount = toFloat(get(cAmount));
      const date   = toDate(get(cDate));
      const opId   = cId >= 0 ? get(cId)?.toString().trim() || null : null;
      const opInstrument = cInstrument >= 0 ? get(cInstrument)?.toString().trim() || null : null;
      const opProduct    = cProduct    >= 0 ? get(cProduct)?.toString().trim()    || null : null;
      const opComment    = cComment    >= 0 ? get(cComment)?.toString().trim()    || null : null;

      // "Free-funds interest" (formato antigo, com hífen) vs "Free funds interest" (atual, com espaço)
      const isFreeFundsType   = type.includes("free-funds interest") || type.includes("free funds interest");
      const isDivid           = type.includes("divid");
      const isWithhold        = type.includes("withhold") && !type.includes("interest");
      const isFreeInterest    = isFreeFundsType && !type.includes("tax");
      const isFreeInterestTax = isFreeFundsType && type.includes("tax");
      // "fund" isolado é demasiado genérico — apanha "free funds interest", por isso
      // os juros têm de ser verificados ANTES do depósito/levantamento.
      const isDeposit         = !isFreeFundsType && (type.includes("deposit") || type.includes("entrada de fundos") || type.includes("fund"));
      const isWithdraw        = type.includes("withdrawal") || type.includes("levantamento") || type.includes("saída");

      if (isFreeInterest) {
        // Agrupa juros do mesmo dia
        const key = date?.slice(0, 10) || "?";
        if (!interestMap.has(key)) {
          // Juros 'Free-funds' da XTB: rendimento NACIONAL (sucursal portuguesa, NIF 980/contas PT50),
          // já tributado na fonte a 28% e dispensado de declaração. País = Portugal (não a sede polaca da XTB),
          // para nunca ser confundido com juros estrangeiros (IBKR/Irlanda) no Anexo J Q8.
          interestMap.set(key, { simbolo: "JUROS_XTB", data_pagamento: date, valor_bruto_eur: 0, retencao_eur: 0, valor_liq_eur: 0, pais_fonte: "Portugal", moeda: accountCurrency, corretora: "XTB", conta: accountNumber, conta_nome: null, produto: opProduct, tipo: "INTEREST", _movs: [] });
        }
        interestMap.get(key).valor_bruto_eur += Math.abs(amount);
        interestMap.get(key)._movs.push({ id: opId, tipo: "Free funds interest", valor: amount, data: date });
        return;
      }

      if (isFreeInterestTax) {
        const key = date?.slice(0, 10) || "?";
        if (interestMap.has(key)) {
          interestMap.get(key).retencao_eur += Math.abs(amount);
          interestMap.get(key)._movs.push({ id: opId, tipo: "Free funds interest tax", valor: amount, data: date });
        }
        return;
      }

      if (isDeposit || isWithdraw) {
        if (date && amount !== 0) {
          deposits.push({
            data: date, valor: Math.abs(amount), tipo: isDeposit ? "deposito" : "levantamento",
            corretora: "XTB", conta: accountNumber, conta_nome: null, ref_externa: opId,
            tipo_raw: get(cType)?.toString() ?? null, nome_instrumento: opInstrument, produto: opProduct,
            descricao: opComment || get(cType)?.toString() || null,
          });
        }
        return;
      }

      const sym = (get(cSym) || "").toString().trim();
      if (!sym) return;
      const key = `${sym}|${date?.slice(0, 10)}`;
      const pais = resolveDividendCountry(sym, null, accountCurrency);

      if (isDivid || isWithhold) {
        // A linha de "Withholding tax" pode aparecer ANTES da linha "Dividend" correspondente
        // no ficheiro (a XTB não garante a ordem) — por isso o agregado tem de ser criado em
        // qualquer um dos dois casos, nunca só quando já existe (senão a 1ª retenção perde-se).
        if (!divMap.has(key)) {
          divMap.set(key, { simbolo: sym.split(".")[0].toUpperCase(), data_pagamento: date, valor_bruto_eur: 0, retencao_eur: 0, moeda: accountCurrency, corretora: "XTB", conta: accountNumber, conta_nome: null, nome_instrumento: opInstrument, produto: opProduct, pais_fonte: pais, tipo: "DIVIDEND", _movs: [] });
        }
        if (isDivid) divMap.get(key).valor_bruto_eur += amount;
        else         divMap.get(key).retencao_eur    += Math.abs(amount);
        divMap.get(key)._movs.push({ id: opId, tipo: isDivid ? "Dividend" : "Withholding tax", valor: amount, data: date });
      }
    });

    for (const d of divMap.values()) {
      d.valor_liq_eur  = d.valor_bruto_eur - d.retencao_eur;
      d._movs.sort((a, b) => (a.data || "").localeCompare(b.data || ""));
      d.ref_externa    = d._movs.map(m => m.id).filter(Boolean).sort().join("+") || null;
      d.movimentos     = JSON.stringify(d._movs);
      delete d._movs;
      dividends.push(d);
    }
    for (const i of interestMap.values()) {
      i.valor_liq_eur = i.valor_bruto_eur - i.retencao_eur;
      i._movs.sort((a, b) => (a.data || "").localeCompare(b.data || ""));
      i.ref_externa   = i._movs.map(m => m.id).filter(Boolean).sort().join("+") || null;
      i.movimentos    = JSON.stringify(i._movs);
      delete i._movs;
      if (i.valor_bruto_eur > 0) dividends.push(i);
    }
  }

  if (!trades.length && !dividends.length && !deposits.length)
    throw new Error("Nenhuma operação encontrada no ficheiro XTB.");

  // ── Conversão cambial para EUR (apenas contas não-EUR) ──
  // O XTB reporta na moeda da conta; para contas em EUR não há nada a converter.
  // Os preços por ação (preco_abertura/fecho, sl, tp) ficam na moeda original — são
  // cotações de mercado, não montantes em conta.
  const convFailed = [];
  if (accountCurrency !== "EUR") {
    const TRADE_MONEY = ["pl_eur", "valor_compra_eur", "valor_venda_eur", "fees", "swap", "rollover", "gross_pl", "margin"];
    for (const t of trades) {
      const rate = eurRate(accountCurrency, t.data_fecho);
      if (!rate) { convFailed.push(t.simbolo); continue; }
      for (const f of TRADE_MONEY) if (t[f] != null) t[f] = +(t[f] * rate).toFixed(4);
      t.taxa_cambio = rate;
    }
    for (const d of dividends) {
      const rate = eurRate(accountCurrency, d.data_pagamento);
      if (!rate) { convFailed.push(d.simbolo); continue; }
      for (const f of ["valor_bruto_eur", "retencao_eur", "valor_liq_eur"]) if (d[f] != null) d[f] = +(d[f] * rate).toFixed(4);
      // Converter também o detalhe linha-a-linha (movimentos) para EUR — caso contrário a
      // tabela "Todas as Operações" (cabeçalho "Valor €") mostraria os montantes na moeda
      // original (ex: USD) que não reconciliam com os totais já convertidos do cartão.
      if (d.movimentos) {
        try {
          const movs = JSON.parse(d.movimentos).map(m =>
            ({ ...m, valor: m.valor != null ? +(m.valor * rate).toFixed(4) : m.valor }));
          d.movimentos = JSON.stringify(movs);
        } catch {}
      }
    }
    for (const dp of deposits) {
      const rate = eurRate(accountCurrency, dp.data);
      if (!rate) continue;
      dp.valor = +(dp.valor * rate).toFixed(4);
    }
  }

  return { trades, dividends, deposits, convFailed };
}

// Parser de uma linha CSV que respeita aspas (campos com vírgula lá dentro,
// ex: Date/Time "2025-10-09, 09:51:54", ou números "1,385"). Suporta "" como aspa escapada.
function parseCSVLine(line) {
  const out = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ",") {
      out.push(cur.trim()); cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

// ── Parser IBKR (.csv) ────────────────────────────────────
async function parseIBKR(buffer) {
  const text   = buffer.toString("utf8");
  const lines  = text.split(/\r?\n/);
  const parsed = lines.map(parseCSVLine);

  // ── Passo 1: pré-passagem para extrair ISINs ──────────────
  // A secção "Financial Instrument Information" do CSV da IBKR contém o ISIN mapeado pelo
  // Symbol. ATENÇÃO: nos relatórios da IBKR a coluna chama-se "Security ID" (não "ISIN") e
  // pode conter outros identificadores (CUSIP, etc.) — por isso validamos o formato ISIN.
  // As duas primeiras letras do ISIN identificam o país de incorporação (ISO 3166-1
  // alpha-2) — fonte mais fiável de país.
  const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
  const isinBySymbol = new Map(); // symbol → prefixo ISO 2 letras (ex: "DE")
  const fullIsinBySymbol = new Map(); // symbol → ISIN completo (ex: "US00724F1012")
  const nameBySymbol = new Map(); // symbol → nome do instrumento (Description)
  let fiiHeaders = null;
  // Número e nome de conta — secção "Account Information" (Field Name "Account"/"Name")
  let accountNumber = null;
  let accountName   = null;
  let accHeaders = null;
  for (const cols of parsed) {
    if (cols[0] === "Account Information" && cols[1] === "Header") { accHeaders = cols; continue; }
    if (cols[0] === "Account Information" && cols[1] === "Data" && accHeaders) {
      const g = key => { const i = accHeaders.indexOf(key); return i >= 0 ? cols[i] : null; };
      const fieldName = (g("Field Name") || "").toLowerCase();
      if (fieldName === "account") accountNumber = g("Field Value");
      if (fieldName === "name")    accountName   = g("Field Value");
      continue;
    }
    if (cols[0] === "Financial Instrument Information" && cols[1] === "Header") {
      fiiHeaders = cols; continue;
    }
    if (cols[0] === "Financial Instrument Information" && cols[1] === "Data" && fiiHeaders) {
      const g    = key => { const i = fiiHeaders.indexOf(key); return i >= 0 ? cols[i] : null; };
      const sym  = (g("Symbol") || "").replace(/\s/g, "").toUpperCase();
      const isin = (g("Security ID") || g("ISIN") || "").trim().toUpperCase();
      if (sym && ISIN_RE.test(isin)) {
        isinBySymbol.set(sym, isin.slice(0, 2));
        fullIsinBySymbol.set(sym, isin);
      }
      const desc = (g("Description") || "").trim();
      if (sym && desc) nameBySymbol.set(sym, desc);
    }
  }

  // ── Passo 2: parsear trades, dividendos e depósitos ───────
  const trades      = [];
  const dividends   = [];
  const deposits    = [];
  const holdings    = [];   // posições abertas (secção "Open Positions")
  const needsConv   = [];

  let tradeHeaders    = null;
  let divHeaders      = null;
  let depHeaders      = null;
  let interestHeaders = null;
  let posHeaders      = null;

  for (const cols of parsed) {

    // ── Open Positions (Ações em Carteira) ──
    if (cols[0] === "Open Positions" && cols[1] === "Header") { posHeaders = cols; continue; }
    if (cols[0] === "Open Positions" && cols[1] === "Data" && posHeaders) {
      const g = key => { const i = posHeaders.indexOf(key); return i >= 0 ? cols[i] : null; };
      // Só as linhas-resumo por símbolo (DataDiscriminator = "Summary") — evita somar
      // os lotes individuais ("Lot") em duplicado. Se a coluna não existir, aceita a linha.
      const disc = (g("DataDiscriminator") || "").toLowerCase();
      if (disc && disc !== "summary") continue;
      const sym = (g("Symbol") || "").replace(/\s/g, "").toUpperCase();
      const qty = toFloat(g("Quantity"));
      if (!sym || !qty) continue;                       // ignora linhas vazias / quantidade 0
      const currency   = g("Currency") || "USD";
      const costPrice  = toFloat(g("Cost Price"));
      const costBasis  = toFloat(g("Cost Basis"));
      const closePrice = toFloat(g("Close Price"));
      const value      = toFloat(g("Value"));
      const unreal     = toFloat(g("Unrealized P/L"));
      const cat = (g("Asset Category") || "").toLowerCase();
      let categoria = "STOCK";
      if (cat.includes("option"))                            categoria = "OPTION";
      else if (cat.includes("future"))                       categoria = "FUTURE";
      else if (cat.includes("forex") || cat.includes("cfd")) categoria = "CFD";
      holdings.push({
        simbolo:      sym,
        nome:         nameBySymbol.get(sym) || null,
        categoria,
        moeda:        currency,
        pais:         isinBySymbol.get(sym) || null,                 // ISO 2 letras (do ISIN) p/ mapear bolsa
        quantidade:   qty,
        preco_medio:  costPrice || (qty ? costBasis / qty : null),  // por ação (moeda nativa)
        preco_atual:  closePrice,                                    // por ação (moeda nativa)
        corretora:    "IBKR",
        conta:        accountNumber,
        conta_nome:   accountName,
        _custo_native:  costBasis,
        _valor_native:  value,
        _unreal_native: unreal,
      });
      continue;
    }

    // ── Trades ──
    if (cols[0] === "Trades" && cols[1] === "Header") { tradeHeaders = cols; continue; }
    if (cols[0] === "Trades" && cols[1] === "Data" && cols[2] === "Order" && tradeHeaders) {
      const g   = key => { const i = tradeHeaders.indexOf(key); return i >= 0 ? cols[i] : null; };
      const cat = (g("Asset Category") || "").toLowerCase();
      let categoria = "STOCK";
      if (cat.includes("option"))                            categoria = "OPTION";  // inclui "Futures Options"
      else if (cat.includes("future"))                       categoria = "FUTURE";
      else if (cat.includes("forex") || cat.includes("cfd")) categoria = "CFD";

      const currency  = g("Currency") || "USD";
      const pl        = toFloat(g("Realized P/L"));
      const sym       = (g("Symbol") || "").replace(/\s/g, "").toUpperCase();
      const dt        = g("Date/Time") || "";
      const rawQty    = toFloat(g("Quantity"));
      const qty       = Math.abs(rawQty);
      const basis     = Math.abs(toFloat(g("Basis")));
      const proceeds  = Math.abs(toFloat(g("Proceeds")));
      const fees      = Math.abs(toFloat(g("Comm/Fee") || g("Comm/Fees") || "0"));

      // País: hierarquia ISIN > sufixo > exceção conhecida > moeda (ver instructions.md §2.C)
      const isinIso = isinBySymbol.get(sym) || null;
      const pais    = resolveCountry(sym, isinIso, currency);

      const tPrice = toFloat(g("T. Price")) || null;
      const idx = trades.length;
      trades.push({
        simbolo:          sym,
        data_abertura:    null,
        data_fecho:       toDate(dt),
        pl_eur:           pl,
        volume:           qty,
        fees:             fees,
        swap:             null,
        rollover:         null,
        gross_pl:         pl + fees,
        valor_compra_eur: basis,
        valor_venda_eur:  proceeds,
        pl_orig:          pl,        // moeda nativa (igual à corretora) — antes da conversão
        valor_compra_orig: basis,
        valor_venda_orig:  proceeds,
        preco_abertura:   null,
        preco_fecho:      tPrice,
        sl:               null,
        tp:               null,
        margin:           null,
        comment:          g("Notes/Codes") || null,
        nome_instrumento: g("Description") || null,
        produto:          cat || null,
        origem:           null,
        conversao_abertura: null,
        conversao_fecho:    null,
        moeda_original:   currency,
        taxa_cambio:      currency === "EUR" ? 1.0 : null,
        categoria,
        corretora:        "IBKR",
        conta:            g("ClientAccountID") || g("Account") || accountNumber,
        conta_nome:       accountName,
        tipo_ordem:       rawQty >= 0 ? "BUY" : "SELL",
        pais,
        isin:             fullIsinBySymbol.get(sym) || null,
        ref_externa:      `${sym}|${dt}|${qty}`,
      });
      if (currency !== "EUR" && pl !== 0) needsConv.push(idx);
      continue;
    }

    // ── Dividendos ──
    if (cols[0] === "Dividends" && cols[1] === "Header") { divHeaders = cols; continue; }
    if (cols[0] === "Dividends" && cols[1] === "Data" && divHeaders) {
      const g    = key => { const i = divHeaders.indexOf(key); return i >= 0 ? cols[i] : null; };
      const desc = g("Description") || "";
      const sym  = (g("Symbol") || desc.split("(")[0]).trim().toUpperCase();
      if (!sym) continue;
      // ISIN na Description: "SAP(DE0007164600) Cash Dividend" → prefixo "DE"
      const isinMatch = desc.match(/\(([A-Z]{2}\d{8,12})\)/);
      const isinIso   = isinMatch ? isinMatch[1].slice(0, 2).toUpperCase() : (isinBySymbol.get(sym) || null);
      const pais      = resolveDividendCountry(sym, isinIso, g("Currency") || "USD");
      const currency = g("Currency") || "USD";
      const amount = toFloat(g("Amount"));
      if (amount === 0) continue;
      const divDate = toDate(g("Date") || g("Payment Date"));
      const txId    = g("TransactionID") || null;
      dividends.push({
        simbolo:         sym,
        data_pagamento:  divDate,
        valor_bruto_eur: amount,
        retencao_eur:    0,
        valor_liq_eur:   amount,
        pais_fonte:      pais,
        moeda:           currency,
        corretora:       "IBKR",
        conta:           g("ClientAccountID") || g("Account") || accountNumber,
        conta_nome:      accountName,
        nome_instrumento: desc || null,
        produto:         null,
        ref_externa:     txId,
        isin:            isinMatch ? isinMatch[1].toUpperCase() : (fullIsinBySymbol.get(sym) || null),
        movimentos:      JSON.stringify([{ id: txId, tipo: "Dividend", valor: amount, data: divDate }]),
        tipo:            "DIVIDEND",
        _currency:       currency, // auxiliar para conversão
      });
      continue;
    }

    // Withholding Tax → aplica sobre o último dividendo
    if ((cols[0] === "Withholding Tax" || cols[0] === "Taxes Withheld") && cols[1] === "Data" && divHeaders) {
      const amtIdx = divHeaders.indexOf("Amount");
      if (amtIdx >= 0 && dividends.length) {
        const ret = Math.abs(toFloat(cols[amtIdx]));
        const last = dividends[dividends.length - 1];
        last.retencao_eur  += ret;
        last.valor_liq_eur -= ret;
        const movs = JSON.parse(last.movimentos || "[]");
        movs.push({ id: null, tipo: "Withholding Tax", valor: -ret, data: last.data_pagamento });
        last.movimentos = JSON.stringify(movs);
      }
      continue;
    }

    // ── Juros (Interest) ──
    if (cols[0] === "Interest" && cols[1] === "Header") { interestHeaders = cols; continue; }
    if (cols[0] === "Interest" && cols[1] === "Data" && interestHeaders) {
      const g      = key => { const i = interestHeaders.indexOf(key); return i >= 0 ? cols[i] : null; };
      const amount = toFloat(g("Amount"));
      const date   = toDate(g("Date") || g("Date/Time"));
      const currency = g("Currency") || "USD";
      // Ignora linhas de totais (símbolo "Total" ou amount = 0)
      const desc = g("Description") || "";
      if (amount === 0 || desc.toLowerCase().startsWith("total")) continue;
      if (amount > 0) {
        dividends.push({
          simbolo:         "JUROS_IBKR",
          data_pagamento:  date,
          valor_bruto_eur: amount,
          retencao_eur:    0,
          valor_liq_eur:   amount,
          pais_fonte:      "Irlanda",
          moeda:           currency,
          corretora:       "IBKR",
          conta:           g("ClientAccountID") || g("Account") || accountNumber,
          conta_nome:      accountName,
          tipo:            "INTEREST",
          _currency:       currency,
        });
      }
      continue;
    }

    // ── Depósitos ──
    if (cols[0] === "Deposits & Withdrawals" && cols[1] === "Header") { depHeaders = cols; continue; }
    if (cols[0] === "Deposits & Withdrawals" && cols[1] === "Data" && depHeaders) {
      const g    = key => { const i = depHeaders.indexOf(key); return i >= 0 ? cols[i] : null; };
      const amount = toFloat(g("Amount"));
      const date   = toDate(g("Date") || g("Settle Date"));
      if (date && amount !== 0) {
        deposits.push({ data: date, valor: Math.abs(amount), tipo: amount >= 0 ? "deposito" : "levantamento", corretora: "IBKR", conta: g("ClientAccountID") || g("Account") || accountNumber, conta_nome: accountName, ref_externa: g("TransactionID") || null, tipo_raw: g("Description") || null, descricao: g("Description") || null });
      }
    }
  }

  if (!trades.length && !dividends.length && !deposits.length && !holdings.length)
    throw new Error("Nenhuma operação encontrada no ficheiro IBKR. Certifica-te que é um Activity Statement completo.");

  // ── Conversão cambial para EUR ──
  const convFailed = [];
  for (const idx of needsConv) {
    const t    = trades[idx];
    const date = t.data_fecho;
    const rate = eurRate(t.moeda_original, date);
    if (rate) {
      t.pl_eur           = +(t.pl_eur           * rate).toFixed(4);
      t.valor_compra_eur = +(t.valor_compra_eur  * rate).toFixed(4);
      t.valor_venda_eur  = +(t.valor_venda_eur   * rate).toFixed(4);
      t.fees             = +(t.fees              * rate).toFixed(4);
      t.gross_pl         = +(t.gross_pl          * rate).toFixed(4);
      t.taxa_cambio      = rate;
    } else {
      convFailed.push(t.simbolo);
    }
  }

  // Converte dividendos IBKR não-EUR
  for (const d of dividends) {
    if (d._currency && d._currency !== "EUR") {
      const rate = eurRate(d._currency, d.data_pagamento);
      if (rate) {
        d.valor_bruto_eur = +(d.valor_bruto_eur * rate).toFixed(4);
        d.retencao_eur    = +(d.retencao_eur    * rate).toFixed(4);
        d.valor_liq_eur   = +(d.valor_liq_eur   * rate).toFixed(4);
        // Converter também o detalhe linha-a-linha para EUR, para reconciliar com o cartão
        // (a tabela "Todas as Operações" tem cabeçalho "Valor €").
        if (d.movimentos) {
          try {
            const movs = JSON.parse(d.movimentos).map(m =>
              ({ ...m, valor: m.valor != null ? +(m.valor * rate).toFixed(4) : m.valor }));
            d.movimentos = JSON.stringify(movs);
          } catch {}
        }
      }
    }
    delete d._currency;
  }

  // Converte as posições abertas para EUR — valor "à data de hoje" (a taxa recua para
  // o último dia útil disponível). Mantém preço/preço médio na moeda nativa.
  const hoje = new Date().toISOString().slice(0, 10);
  for (const h of holdings) {
    const rate = eurRate(h.moeda, hoje) || (h.moeda === "EUR" ? 1 : null);
    if (rate) {
      h.custo_eur = h._custo_native  != null ? +(h._custo_native  * rate).toFixed(2) : null;
      h.valor_eur = h._valor_native  != null ? +(h._valor_native  * rate).toFixed(2) : null;
      h.pl_eur    = h._unreal_native != null ? +(h._unreal_native * rate).toFixed(2)
                  : (h.valor_eur != null && h.custo_eur != null ? +(h.valor_eur - h.custo_eur).toFixed(2) : null);
    } else {
      convFailed.push(h.simbolo);
    }
    delete h._custo_native; delete h._valor_native; delete h._unreal_native;
  }

  return { trades, dividends, deposits, convFailed, holdings };
}

// ── Parser Bybit (.csv) — assetHistory / withdrawDepositHistory ──
// Relatório de transferências (depósitos/levantamentos) de cripto da Bybit. NÃO traz
// trades nem preços de compra — apenas quantidades por ativo. Agregamos por ativo
// (depósitos somam, levantamentos subtraem) e valorizamos a mercado (Yahoo <ATIVO>-EUR)
// como posições em carteira (categoria CRYPTO). Sem trades nem depósitos de caixa: o
// utilizador está em "hold", por isso só interessam as posições resultantes.
async function parseBybit(buffer) {
  const text  = buffer.toString("utf8");
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
  if (!lines.length) throw new Error("Ficheiro Bybit vazio.");

  // 1ª linha traz UID/Name: "UID: 548..., Name: PAULO ..., Company Name: , Country: "
  let accountNumber = null, accountName = null;
  if (/uid\s*:/i.test(lines[0])) {
    const muid = lines[0].match(/UID:\s*([^,]+)/i);
    const mnam = lines[0].match(/Name:\s*([^,]*)/i);
    accountNumber = muid ? muid[1].trim() : null;
    accountName   = mnam ? (mnam[1].trim() || null) : null;
  }

  // Linha de cabeçalho das colunas (contém "Type" e "Asset")
  const headerIdx = lines.findIndex(l => /(^|,)\s*type\s*(,|$)/i.test(l) && /asset/i.test(l));
  if (headerIdx < 0) throw new Error("Cabeçalho de colunas não encontrado no ficheiro Bybit.");
  const headers = parseCSVLine(lines[headerIdx]).map(h => h.toLowerCase().trim());
  const idx = name => headers.indexOf(name);
  const iType = idx("type"), iAsset = idx("asset"), iAmount = idx("amount"), iStatus = idx("status");
  if (iAsset < 0 || iAmount < 0)
    throw new Error("Colunas Asset/Amount não encontradas no ficheiro Bybit.");
  // Colunas opcionais para o histórico linha-a-linha (data e ID da transação).
  const iTime = headers.findIndex(h => h.includes("time") || h.includes("date"));
  const iTxid = headers.findIndex(h => h.includes("tx") || h.includes("transaction") || h === "id");

  // Agrega por ativo: depósitos somam, levantamentos subtraem (só linhas "Completed").
  // Guarda também cada movimento (para o histórico mostrado no modal).
  const byAsset = new Map();
  const movsByAsset = new Map();
  for (let r = headerIdx + 1; r < lines.length; r++) {
    const cols  = parseCSVLine(lines[r]);
    const asset = (cols[iAsset] || "").toUpperCase().trim();
    if (!asset) continue;
    const status = (iStatus >= 0 ? cols[iStatus] : "").toLowerCase();
    if (status && status !== "completed") continue;
    const type   = (iType >= 0 ? cols[iType] : "").toLowerCase();
    const amount = toFloat(cols[iAmount]);
    if (!amount) continue;
    const signed = type.includes("withdraw") ? -Math.abs(amount) : Math.abs(amount);
    byAsset.set(asset, (byAsset.get(asset) || 0) + signed);
    if (!movsByAsset.has(asset)) movsByAsset.set(asset, []);
    movsByAsset.get(asset).push({
      id:   iTxid >= 0 ? (cols[iTxid] || null) : null,
      tipo: signed < 0 ? "Levantamento" : "Depósito",
      data: iTime >= 0 ? (cols[iTime] || null) : null,
      qtd:  signed,                                    // quantidade na moeda (cripto), com sinal
    });
  }

  // Cotações de mercado em EUR (Yahoo: <ATIVO>-EUR). Stablecoins (USDC/USDT) também têm par.
  const assets  = [...byAsset.keys()].filter(a => (byAsset.get(a) || 0) > 1e-12);
  let quoteMap = {};
  try { quoteMap = await quotes.getQuotes(assets.map(a => `${a}-EUR`)); } catch { quoteMap = {}; }

  const holdings   = [];
  const convFailed = [];
  for (const asset of assets) {
    const qty   = byAsset.get(asset);
    const price = quoteMap[`${asset}-EUR`]?.price ?? null;     // por unidade (EUR)
    if (price == null) convFailed.push(asset);
    holdings.push({
      simbolo:     asset,
      nome:        cryptoName(asset),
      categoria:   "CRYPTO",
      moeda:       "EUR",
      pais:        null,                                       // cripto não tem país de incorporação
      quantidade:  qty,
      preco_medio: null,                                       // o relatório não traz preço de compra
      custo_eur:   null,
      preco_atual: price,
      valor_eur:   price != null ? +(qty * price).toFixed(2) : null,
      pl_eur:      null,                                       // sem custo → P/L não realizado desconhecido
      corretora:   "Bybit",
      conta:       accountNumber,
      conta_nome:  accountName,
      movimentos:  JSON.stringify(movsByAsset.get(asset) || []),
    });
  }

  if (!holdings.length)
    throw new Error("Nenhum ativo com saldo positivo encontrado no ficheiro Bybit.");

  return { trades: [], dividends: [], deposits: [], convFailed, holdings };
}

// ── Contar duplicados sem gravar (para a pré-visualização) ────
function countExisting(username, trades, dividends, deposits = []) {
  const db = getDb(username);

  const existsTrade = db.prepare(`SELECT 1 FROM trades WHERE corretora = ? AND ref_externa = ? LIMIT 1`);
  const existsDivRef = db.prepare(`SELECT 1 FROM dividendos WHERE corretora = ? AND ref_externa = ? LIMIT 1`);
  const existsDivKey = db.prepare(`
    SELECT 1 FROM dividendos WHERE simbolo = ? AND data_pagamento = ? AND corretora = ?
      AND (conta = ? OR (conta IS NULL AND ? IS NULL)) LIMIT 1`);
  const existsDepRef = db.prepare(`SELECT 1 FROM depositos WHERE corretora = ? AND ref_externa = ? LIMIT 1`);
  const existsDepKey = db.prepare(`
    SELECT 1 FROM depositos WHERE data = ? AND valor = ? AND corretora = ? AND tipo = ?
      AND (conta = ? OR (conta IS NULL AND ? IS NULL)) LIMIT 1`);

  const dupItems = [];   // detalhe de cada item ignorado (para o utilizador analisar)

  const dupTradeRows = trades.filter(t =>
    t.ref_externa && existsTrade.get(t.corretora, t.ref_externa)
  );
  for (const t of dupTradeRows) dupItems.push({
    tipo: "Operação", simbolo: t.simbolo, data: (t.data_fecho || "").slice(0, 10) || null,
    valor: t.pl_eur ?? null, corretora: t.corretora, conta: t.conta ?? null,
    motivo: "Já importada anteriormente (mesma referência da corretora)",
  });

  const dupDivRows = dividends.filter(d =>
    (d.ref_externa && existsDivRef.get(d.corretora, d.ref_externa)) ||
    (!d.ref_externa && existsDivKey.get(d.simbolo, d.data_pagamento, d.corretora, d.conta ?? null, d.conta ?? null))
  );
  for (const d of dupDivRows) dupItems.push({
    tipo: d.tipo === "INTEREST" ? "Juros" : "Dividendo", simbolo: d.simbolo,
    data: (d.data_pagamento || "").slice(0, 10) || null, valor: d.valor_liq_eur ?? null,
    corretora: d.corretora, conta: d.conta ?? null,
    motivo: d.ref_externa ? "Já importado (mesma referência)" : "Já importado (mesmo símbolo/data/conta)",
  });

  const dupDepRows = deposits.filter(d =>
    (d.ref_externa && existsDepRef.get(d.corretora, d.ref_externa)) ||
    (!d.ref_externa && existsDepKey.get(d.data, d.valor, d.corretora, d.tipo, d.conta ?? null, d.conta ?? null))
  );
  for (const d of dupDepRows) dupItems.push({
    tipo: d.tipo === "levantamento" ? "Levantamento" : "Depósito", simbolo: "—",
    data: (d.data || "").slice(0, 10) || null,
    valor: d.tipo === "levantamento" ? -(d.valor ?? 0) : (d.valor ?? 0),
    corretora: d.corretora, conta: d.conta ?? null,
    motivo: d.ref_externa ? "Já importado (mesma referência)" : "Já importado (mesma data/valor/conta)",
  });

  return {
    dupTrades: dupTradeRows.length, dupDividends: dupDivRows.length, dupDeposits: dupDepRows.length,
    dupItems,
  };
}

// ── Gravar no SQLite ──────────────────────────────────────
function saveData(username, trades, dividends, deposits = [], holdings = []) {
  const db = getDb(username);

  const insTrade = db.prepare(`
    INSERT OR IGNORE INTO trades
      (simbolo, data_abertura, data_fecho, pl_eur, volume, fees,
       valor_compra_eur, valor_venda_eur, moeda_original, categoria,
       corretora, conta, conta_nome, tipo_ordem, pais, isin, ref_externa,
       swap, rollover, gross_pl, taxa_cambio,
       preco_abertura, preco_fecho, sl, tp, margin, comment,
       nome_instrumento, produto, origem, conversao_abertura, conversao_fecho,
       pl_orig, valor_compra_orig, valor_venda_orig)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  const insDiv = db.prepare(`
    INSERT OR IGNORE INTO dividendos
      (simbolo, data_pagamento, valor_bruto_eur, retencao_eur, valor_liq_eur, pais_fonte,
       moeda, corretora, conta, conta_nome, ref_externa, nome_instrumento, produto, movimentos, tipo, isin)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  const updDivPais = db.prepare(
    `UPDATE dividendos SET pais_fonte = ? WHERE simbolo = ? AND data_pagamento = ? AND corretora = ? AND pais_fonte IS NULL`);

  const insDep = db.prepare(`
    INSERT OR IGNORE INTO depositos
      (data, valor, tipo, corretora, conta, conta_nome, ref_externa, nome_instrumento, produto, tipo_raw, descricao)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);

  let insertedTrades = 0, insertedDivs = 0, insertedDeps = 0;

  db.exec("BEGIN");
  try {
    for (const t of trades) {
      const r = insTrade.run(
        t.simbolo, t.data_abertura, t.data_fecho, t.pl_eur,
        t.volume   ?? null, t.fees        ?? null,
        t.valor_compra_eur ?? null, t.valor_venda_eur ?? null,
        t.moeda_original   ?? null, t.categoria, t.corretora, t.conta ?? null, t.conta_nome ?? null,
        t.tipo_ordem ?? null, t.pais ?? null, t.isin ?? null, t.ref_externa ?? null,
        t.swap       ?? null, t.rollover    ?? null,
        t.gross_pl   ?? null, t.taxa_cambio ?? null,
        t.preco_abertura ?? null, t.preco_fecho ?? null,
        t.sl ?? null, t.tp ?? null, t.margin ?? null, t.comment ?? null,
        t.nome_instrumento ?? null, t.produto ?? null, t.origem ?? null,
        t.conversao_abertura ?? null, t.conversao_fecho ?? null,
        t.pl_orig ?? null, t.valor_compra_orig ?? null, t.valor_venda_orig ?? null
      );
      insertedTrades += r.changes;
    }
    for (const d of dividends) {
      const r = insDiv.run(
        d.simbolo, d.data_pagamento, d.valor_bruto_eur,
        d.retencao_eur, d.valor_liq_eur,
        d.pais_fonte ?? null, d.moeda ?? null, d.corretora, d.conta ?? null, d.conta_nome ?? null,
        d.ref_externa ?? null, d.nome_instrumento ?? null, d.produto ?? null, d.movimentos ?? null,
        d.tipo ?? "DIVIDEND", d.isin ?? null
      );
      insertedDivs += r.changes;
      if (r.changes === 0 && d.pais_fonte) {
        updDivPais.run(d.pais_fonte, d.simbolo, d.data_pagamento, d.corretora);
      }
    }
    for (const d of deposits) {
      const r = insDep.run(
        d.data, d.valor, d.tipo, d.corretora, d.conta ?? null, d.conta_nome ?? null,
        d.ref_externa ?? null, d.nome_instrumento ?? null, d.produto ?? null,
        d.tipo_raw ?? null, d.descricao ?? null
      );
      insertedDeps += r.changes;
    }

    // Posições abertas: snapshot do relatório. Substitui as posições por (corretora,
    // conta) presentes neste relatório — assim ficam sempre atualizadas a cada importação
    // sem afetar contas que não vêm neste ficheiro. O valor justo (manual) fica intacto.
    if (holdings.length) {
      const delPos = db.prepare(
        `DELETE FROM posicoes WHERE corretora = ? AND (conta = ? OR (conta IS NULL AND ? IS NULL))`);
      const insPos = db.prepare(`INSERT INTO posicoes
        (simbolo, nome, categoria, moeda, pais, quantidade, preco_medio, custo_eur,
         preco_atual, valor_eur, pl_eur, corretora, conta, conta_nome, atualizado_em, movimentos)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      const now = new Date().toISOString();
      const cleared = new Set();
      for (const h of holdings) {
        const key = `${h.corretora}|${h.conta ?? ""}`;
        if (!cleared.has(key)) { delPos.run(h.corretora, h.conta ?? null, h.conta ?? null); cleared.add(key); }
        insPos.run(
          h.simbolo, h.nome ?? null, h.categoria ?? null, h.moeda ?? null, h.pais ?? null,
          h.quantidade ?? null, h.preco_medio ?? null, h.custo_eur ?? null,
          h.preco_atual ?? null, h.valor_eur ?? null, h.pl_eur ?? null,
          h.corretora, h.conta ?? null, h.conta_nome ?? null, now, h.movimentos ?? null
        );
      }
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  return {
    insertedTrades, insertedDivs, insertedDeps, holdings: holdings.length,
    skipped: (trades.length - insertedTrades) + (dividends.length - insertedDivs) + (deposits.length - insertedDeps),
  };
}

// ── GET /api/import/info ──────────────────────────────────
router.get("/info", (req, res) => {
  res.json({ mode: hasCustomDb(req.session.user.username) ? "custom" : "local" });
});

// ── POST /api/import/preview ──────────────────────────────
router.post("/preview", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Nenhum ficheiro enviado." });
  const tipo = req.body.tipo;
  try {
    await fx.ensureFresh();   // garante câmbios frescos antes de converter (no-op se já atualizados)
    let trades = [], dividends = [], deposits = [], convFailed = [], holdings = [];
    if (tipo === "xtb") {
      ({ trades, dividends, deposits, convFailed = [], holdings = [] } = await parseXTB(req.file.buffer, req.file.originalname));
    } else if (tipo === "ibkr") {
      ({ trades, dividends, deposits, convFailed = [], holdings = [] } = await parseIBKR(req.file.buffer));
    } else if (tipo === "bybit") {
      ({ trades, dividends, deposits, convFailed = [], holdings = [] } = await parseBybit(req.file.buffer));
    } else {
      return res.status(400).json({ error: "Tipo inválido." });
    }
    const allRows = [...trades, ...dividends, ...deposits];
    const contas     = [...new Set(allRows.map(x => x.conta).filter(Boolean))];
    const contaNomes = [...new Set(allRows.map(x => x.conta_nome).filter(Boolean))];
    const { dupTrades, dupDividends, dupDeposits, dupItems } = countExisting(req.session.user.username, trades, dividends, deposits);
    res.json({
      nTrades: trades.length, nDividends: dividends.length, nDeposits: deposits.length, nHoldings: holdings.length,
      nTradesNovas: trades.length - dupTrades, nDividendsNovas: dividends.length - dupDividends, nDepositsNovas: deposits.length - dupDeposits,
      dupItems, convFailed, preview: trades.slice(0, 5), contas, contaNomes,
      periodo: computePeriod(trades, dividends, deposits, holdings),
    });
  } catch (e) {
    res.status(422).json({ error: e.message });
  }
});

// ── POST /api/import/confirm ──────────────────────────────
router.post("/confirm", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Nenhum ficheiro enviado." });
  if (hasCustomDb(req.session.user.username))
    return res.status(403).json({ error: "Utilizador com base de dados externa." });

  const tipo = req.body.tipo;
  try {
    await fx.ensureFresh();   // garante câmbios frescos antes de converter (no-op se já atualizados)
    let trades = [], dividends = [], deposits = [], convFailed = [], holdings = [];
    if (tipo === "xtb") {
      ({ trades, dividends, deposits, convFailed = [], holdings = [] } = await parseXTB(req.file.buffer, req.file.originalname));
    } else if (tipo === "ibkr") {
      ({ trades, dividends, deposits, convFailed = [], holdings = [] } = await parseIBKR(req.file.buffer));
    } else if (tipo === "bybit") {
      ({ trades, dividends, deposits, convFailed = [], holdings = [] } = await parseBybit(req.file.buffer));
    } else {
      return res.status(400).json({ error: "Tipo inválido." });
    }
    const stats = saveData(req.session.user.username, trades, dividends, deposits, holdings);
    const allRows  = [...trades, ...dividends, ...deposits];
    const contas     = [...new Set(allRows.map(x => x.conta).filter(Boolean))].join(", ") || null;
    const contaNomes = [...new Set(allRows.map(x => x.conta_nome).filter(Boolean))].join(", ") || null;
    const periodo = computePeriod(trades, dividends, deposits, holdings);
    const db = getDb(req.session.user.username);
    db.prepare(`INSERT INTO import_history
      (filename, corretora, n_trades, n_dividends, n_skipped, conta, conta_nome, n_holdings, periodo_de, periodo_ate)
      VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(req.file.originalname, tipo.toUpperCase(), stats.insertedTrades, stats.insertedDivs, stats.skipped,
           contas, contaNomes, stats.holdings, periodo.de, periodo.ate);
    res.json({
      ok: true, nTrades: stats.insertedTrades, nDividends: stats.insertedDivs,
      nDeposits: stats.insertedDeps, nHoldings: stats.holdings, nSkipped: stats.skipped,
      convFailed, conta: contas, contaNome: contaNomes, periodo,
    });
  } catch (e) {
    res.status(422).json({ error: e.message });
  }
});

// ── GET /api/import/deposits ──────────────────────────────
router.get("/deposits", (req, res) => {
  try {
    const rows = getDb(req.session.user.username).prepare("SELECT * FROM depositos ORDER BY data DESC").all();
    res.json(rows);
  } catch { res.json([]); }
});

// ── GET /api/import/history ───────────────────────────────
router.get("/history", (req, res) => {
  try {
    const rows = getDb(req.session.user.username).prepare("SELECT * FROM import_history ORDER BY imported_at DESC LIMIT 50").all();
    res.json(rows);
  } catch { res.json([]); }
});

// ── POST /api/import/database — substitui .db ────────────
router.post("/database", upload.single("database"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Nenhum ficheiro enviado." });
  if (!req.file.buffer.slice(0, 16).toString("utf8").startsWith("SQLite format 3"))
    return res.status(400).json({ error: "O ficheiro não é uma base de dados SQLite válida." });
  if (hasCustomDb(req.session.user.username))
    return res.status(403).json({ error: "Este utilizador usa uma base de dados externa." });
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const dbPath = path.join(DATA_DIR, `${req.session.user.username}.db`);
  clearDb(req.session.user.username);
  fs.writeFileSync(dbPath, req.file.buffer);
  res.json({ ok: true, size: req.file.size });
});

module.exports = router;
