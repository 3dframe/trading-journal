const express  = require("express");
const multer   = require("multer");
const path     = require("path");
const fs       = require("fs");
const https    = require("https");
const ExcelJS  = require("exceljs");
const { getDb, clearDb } = require("../db");

const router   = express.Router();
const DATA_DIR = path.join(__dirname, "..", "data");

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

// Empresas europeias/internacionais com listagem cruzada em bolsas americanas.
// Em IBKR o ticker aparece sem sufixo e a moeda é USD — sem esta tabela o
// fallback por moeda daria erradamente "Estados Unidos".
const KNOWN_SYMBOLS_COUNTRY = {
  // Alemanha — AT 276
  SAP:"DE",  BAYN:"DE", BMW:"DE",  DTE:"DE",  ALV:"DE",  MBG:"DE",
  SIE:"DE",  VOW:"DE",  ADS:"DE",  BAS:"DE",  EOAN:"DE", RWE:"DE",
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
  BBVA:"ES", TEF:"ES",  ITX:"ES",
  // Dinamarca — AT 208
  NVO:"DK",  NOVO:"DK",
  // Suécia — AT 752
  ERIC:"SE", VOLV:"SE",
  // Irlanda — AT 372
  CRH:"IE",
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

/**
 * Resolve o país de sede fiscal com hierarquia obrigatória (ver instructions.md §2.C):
 *   1. Override explícito  (ex: EDPR → Espanha, ignora sufixo .PT)
 *   2. ISIN (prefixo ISO — fonte mais fiável de país de incorporação)
 *   3. Sufixo do ticker   (.DE → Alemanha, .US → EUA, etc.)
 *   4. Exceções conhecidas (blue chips europeus sem sufixo em IBKR)
 *   5. Moeda como estimativa (ADRs europeus em USD seriam mal classificados)
 */
function resolveCountry(symbol, isinIso, currency) {
  const base   = symbol.split(".")[0].toUpperCase();
  const suffix = symbol.includes(".") ? symbol.split(".").pop().toUpperCase() : "";

  if (SYMBOL_OVERRIDES[base])
    return EXCHANGE_COUNTRY[SYMBOL_OVERRIDES[base]] || null;
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

// ── Taxa de câmbio histórica (frankfurter.app / BCE) ──────
const rateCache = new Map();
function fetchEURRate(currency, dateStr) {
  if (!currency || currency === "EUR") return Promise.resolve(1.0);
  const date = (dateStr || "").slice(0, 10);
  if (!date || date < "2000-01-01") return Promise.resolve(null);
  const key = `${currency}|${date}`;
  if (rateCache.has(key)) return Promise.resolve(rateCache.get(key));

  return new Promise(resolve => {
    const url = `https://api.frankfurter.app/${date}?from=${currency}&to=EUR`;
    const req = https.get(url, res => {
      let body = "";
      res.on("data", d => body += d);
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          const rate = json.rates?.EUR;
          if (rate) { rateCache.set(key, rate); return resolve(rate); }
        } catch {}
        resolve(null);
      });
    });
    req.on("error", () => resolve(null));
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
  });
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

// ── Parser XTB (.xlsx) ────────────────────────────────────
async function parseXTB(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  // ── Aba de operações fechadas ──
  let sheet = null, headerRowNum = 1;
  wb.eachSheet(ws => {
    if (sheet) return;
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
  const iSym        = col("símbolo", "symbol");
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

  if (iSym < 0) throw new Error("Coluna de símbolo não encontrada no ficheiro XTB.");

  const trades = [];
  sheet.eachRow((row, n) => {
    if (n <= headerRowNum) return;
    const get = i => (i >= 0 ? cellVal(row.getCell(i + 1)) : null);
    const sym = get(iSym);
    if (!sym) return;

    const symStr     = sym.toString().trim();
    const isStock    = /\.[A-Z]{2,4}(_\d+)?$/.test(symStr);
    const commission = Math.abs(toFloat(get(iComm)));
    const swap       = toFloat(get(iSwap));
    const rollover   = toFloat(get(iRollover));
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
    const pais  = resolveCountry(symStr, null, "EUR");

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
      preco_abertura:   iOpenPrice  >= 0 ? toFloat(get(iOpenPrice))  || null : null,
      preco_fecho:      iClosePrice >= 0 ? toFloat(get(iClosePrice)) || null : null,
      sl:               iSL     >= 0 ? toFloat(get(iSL))     || null : null,
      tp:               iTP     >= 0 ? toFloat(get(iTP))     || null : null,
      margin:           iMargin >= 0 ? toFloat(get(iMargin)) || null : null,
      comment:          iComment >= 0 ? get(iComment)?.toString().trim() || null : null,
      moeda_original:   "EUR",
      taxa_cambio:      1.0,
      categoria:        isStock ? "STOCK" : "CFD",
      corretora:        "XTB",
      tipo_ordem:       get(iType)?.toString() ?? null,
      pais,
      ref_externa:      posId || null,
    });
  });

  if (!trades.length) throw new Error("Nenhuma operação encontrada no ficheiro XTB.");

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
    const cType   = cc("type", "tipo", "comment", "operation");
    const cDate   = cc("time", "date", "data");
    const cSym    = cc("symbol", "símbolo");
    const cAmount = cc("amount", "valor", "montante");

    const divMap      = new Map();
    const interestMap = new Map(); // agrupa juros por data

    cashSheet.eachRow((row, n) => {
      if (n <= cashHeaderRow) return;
      const get   = i => (i >= 0 ? cellVal(row.getCell(i + 1)) : null);
      const type  = (get(cType) || "").toString().toLowerCase().trim();
      const amount = toFloat(get(cAmount));
      const date   = toDate(get(cDate));

      const isDivid           = type.includes("divid");
      const isWithhold        = type.includes("withhold") && !type.includes("interest");
      const isFreeInterest    = type.includes("free-funds interest") && !type.includes("tax");
      const isFreeInterestTax = type.includes("free-funds interest") && type.includes("tax");
      const isDeposit         = type.includes("deposit") || type.includes("entrada de fundos") || type.includes("fund");
      const isWithdraw        = type.includes("withdrawal") || type.includes("levantamento") || type.includes("saída");

      if (isDeposit || isWithdraw) {
        if (date && amount !== 0) {
          deposits.push({ data: date, valor: Math.abs(amount), tipo: isDeposit ? "deposito" : "levantamento", corretora: "XTB", descricao: get(cType)?.toString() ?? null });
        }
        return;
      }

      if (isFreeInterest) {
        // Agrupa juros do mesmo dia
        const key = date?.slice(0, 10) || "?";
        if (!interestMap.has(key)) {
          interestMap.set(key, { simbolo: "JUROS_XTB", data_pagamento: date, valor_bruto_eur: 0, retencao_eur: 0, valor_liq_eur: 0, pais_fonte: "Polónia", moeda: "EUR", corretora: "XTB", tipo: "INTEREST" });
        }
        interestMap.get(key).valor_bruto_eur += Math.abs(amount);
        return;
      }

      if (isFreeInterestTax) {
        const key = date?.slice(0, 10) || "?";
        if (interestMap.has(key)) interestMap.get(key).retencao_eur += Math.abs(amount);
        return;
      }

      const sym = (get(cSym) || "").toString().trim();
      if (!sym) return;
      const key = `${sym}|${date?.slice(0, 10)}`;
      const pais = resolveCountry(sym, null, "EUR");

      if (isDivid) {
        if (!divMap.has(key)) {
          divMap.set(key, { simbolo: sym.split(".")[0].toUpperCase(), data_pagamento: date, valor_bruto_eur: 0, retencao_eur: 0, moeda: "EUR", corretora: "XTB", pais_fonte: pais, tipo: "DIVIDEND" });
        }
        divMap.get(key).valor_bruto_eur += amount;
      } else if (isWithhold && divMap.has(key)) {
        divMap.get(key).retencao_eur += Math.abs(amount);
      }
    });

    for (const d of divMap.values()) {
      d.valor_liq_eur = d.valor_bruto_eur - d.retencao_eur;
      dividends.push(d);
    }
    for (const i of interestMap.values()) {
      i.valor_liq_eur = i.valor_bruto_eur - i.retencao_eur;
      if (i.valor_bruto_eur > 0) dividends.push(i);
    }
  }

  return { trades, dividends, deposits };
}

// ── Parser IBKR (.csv) ────────────────────────────────────
async function parseIBKR(buffer) {
  const text   = buffer.toString("utf8");
  const lines  = text.split(/\r?\n/);
  const parsed = lines.map(raw => raw.split(",").map(c => c.replace(/^"|"$/g, "").trim()));

  // ── Passo 1: pré-passagem para extrair ISINs ──────────────
  // A secção "Financial Instrument Information" do CSV da IBKR contém a coluna ISIN
  // mapeada pelo Symbol. As duas primeiras letras do ISIN identificam o país de
  // incorporação da empresa (ISO 3166-1 alpha-2) — fonte mais fiável de país.
  const isinBySymbol = new Map(); // symbol → prefixo ISO 2 letras (ex: "DE")
  let fiiHeaders = null;
  for (const cols of parsed) {
    if (cols[0] === "Financial Instrument Information" && cols[1] === "Header") {
      fiiHeaders = cols; continue;
    }
    if (cols[0] === "Financial Instrument Information" && cols[1] === "Data" && fiiHeaders) {
      const g    = key => { const i = fiiHeaders.indexOf(key); return i >= 0 ? cols[i] : null; };
      const sym  = (g("Symbol") || "").replace(/\s/g, "").toUpperCase();
      const isin = (g("ISIN") || "").trim();
      if (sym && isin.length >= 2) isinBySymbol.set(sym, isin.slice(0, 2).toUpperCase());
    }
  }

  // ── Passo 2: parsear trades, dividendos e depósitos ───────
  const trades      = [];
  const dividends   = [];
  const deposits    = [];
  const needsConv   = [];

  let tradeHeaders    = null;
  let divHeaders      = null;
  let depHeaders      = null;
  let interestHeaders = null;

  for (const cols of parsed) {

    // ── Trades ──
    if (cols[0] === "Trades" && cols[1] === "Header") { tradeHeaders = cols; continue; }
    if (cols[0] === "Trades" && cols[1] === "Data" && cols[2] === "Order" && tradeHeaders) {
      const g   = key => { const i = tradeHeaders.indexOf(key); return i >= 0 ? cols[i] : null; };
      const cat = (g("Asset Category") || "").toLowerCase();
      let categoria = "STOCK";
      if (cat.includes("option"))              categoria = "OPTION";
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
        preco_abertura:   null,
        preco_fecho:      tPrice,
        sl:               null,
        tp:               null,
        margin:           null,
        comment:          null,
        moeda_original:   currency,
        taxa_cambio:      currency === "EUR" ? 1.0 : null,
        categoria,
        corretora:        "IBKR",
        tipo_ordem:       rawQty >= 0 ? "BUY" : "SELL",
        pais,
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
      const pais      = resolveCountry(sym, isinIso, g("Currency") || "USD");
      const currency = g("Currency") || "USD";
      const amount = toFloat(g("Amount"));
      if (amount === 0) continue;
      dividends.push({
        simbolo:         sym,
        data_pagamento:  toDate(g("Date") || g("Payment Date")),
        valor_bruto_eur: amount,
        retencao_eur:    0,
        valor_liq_eur:   amount,
        pais_fonte:      pais,
        moeda:           currency,
        corretora:       "IBKR",
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
        deposits.push({ data: date, valor: Math.abs(amount), tipo: amount >= 0 ? "deposito" : "levantamento", corretora: "IBKR", descricao: g("Description") || null });
      }
    }
  }

  if (!trades.length && !dividends.length)
    throw new Error("Nenhuma operação encontrada no ficheiro IBKR. Certifica-te que é um Activity Statement completo.");

  // ── Conversão cambial para EUR ──
  const convFailed = [];
  for (const idx of needsConv) {
    const t    = trades[idx];
    const date = t.data_fecho;
    const rate = await fetchEURRate(t.moeda_original, date);
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
      const rate = await fetchEURRate(d._currency, d.data_pagamento);
      if (rate) {
        d.valor_bruto_eur = +(d.valor_bruto_eur * rate).toFixed(4);
        d.retencao_eur    = +(d.retencao_eur    * rate).toFixed(4);
        d.valor_liq_eur   = +(d.valor_liq_eur   * rate).toFixed(4);
      }
    }
    delete d._currency;
  }

  return { trades, dividends, deposits, convFailed };
}

// ── Gravar no SQLite ──────────────────────────────────────
function saveData(username, trades, dividends, deposits = []) {
  const db = getDb(username);

  const insTrade = db.prepare(`
    INSERT OR IGNORE INTO trades
      (simbolo, data_abertura, data_fecho, pl_eur, volume, fees,
       valor_compra_eur, valor_venda_eur, moeda_original, categoria,
       corretora, tipo_ordem, pais, ref_externa,
       swap, rollover, gross_pl, taxa_cambio,
       preco_abertura, preco_fecho, sl, tp, margin, comment)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  const insDiv = db.prepare(`
    INSERT OR IGNORE INTO dividendos
      (simbolo, data_pagamento, valor_bruto_eur, retencao_eur, valor_liq_eur, pais_fonte, moeda, corretora, tipo)
    VALUES (?,?,?,?,?,?,?,?,?)`);

  const updDivPais = db.prepare(
    `UPDATE dividendos SET pais_fonte = ? WHERE simbolo = ? AND data_pagamento = ? AND corretora = ? AND pais_fonte IS NULL`);

  const insDep = db.prepare(
    `INSERT OR IGNORE INTO depositos (data, valor, tipo, corretora, descricao) VALUES (?,?,?,?,?)`);

  let insertedTrades = 0, insertedDivs = 0, insertedDeps = 0;

  db.exec("BEGIN");
  try {
    for (const t of trades) {
      const r = insTrade.run(
        t.simbolo, t.data_abertura, t.data_fecho, t.pl_eur,
        t.volume   ?? null, t.fees        ?? null,
        t.valor_compra_eur ?? null, t.valor_venda_eur ?? null,
        t.moeda_original   ?? null, t.categoria, t.corretora,
        t.tipo_ordem ?? null, t.pais ?? null, t.ref_externa ?? null,
        t.swap       ?? null, t.rollover    ?? null,
        t.gross_pl   ?? null, t.taxa_cambio ?? null,
        t.preco_abertura ?? null, t.preco_fecho ?? null,
        t.sl ?? null, t.tp ?? null, t.margin ?? null, t.comment ?? null
      );
      insertedTrades += r.changes;
    }
    for (const d of dividends) {
      const r = insDiv.run(
        d.simbolo, d.data_pagamento, d.valor_bruto_eur,
        d.retencao_eur, d.valor_liq_eur,
        d.pais_fonte ?? null, d.moeda ?? null, d.corretora,
        d.tipo ?? "DIVIDEND"
      );
      insertedDivs += r.changes;
      if (r.changes === 0 && d.pais_fonte) {
        updDivPais.run(d.pais_fonte, d.simbolo, d.data_pagamento, d.corretora);
      }
    }
    for (const d of deposits) {
      const r = insDep.run(d.data, d.valor, d.tipo, d.corretora, d.descricao ?? null);
      insertedDeps += r.changes;
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  return {
    insertedTrades, insertedDivs, insertedDeps,
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
    let trades = [], dividends = [], deposits = [], convFailed = [];
    if (tipo === "xtb") {
      ({ trades, dividends, deposits } = await parseXTB(req.file.buffer));
    } else if (tipo === "ibkr") {
      ({ trades, dividends, deposits, convFailed = [] } = await parseIBKR(req.file.buffer));
    } else {
      return res.status(400).json({ error: "Tipo inválido." });
    }
    res.json({
      nTrades: trades.length, nDividends: dividends.length, nDeposits: deposits.length,
      convFailed, preview: trades.slice(0, 5),
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
    let trades = [], dividends = [], deposits = [], convFailed = [];
    if (tipo === "xtb") {
      ({ trades, dividends, deposits } = await parseXTB(req.file.buffer));
    } else if (tipo === "ibkr") {
      ({ trades, dividends, deposits, convFailed = [] } = await parseIBKR(req.file.buffer));
    } else {
      return res.status(400).json({ error: "Tipo inválido." });
    }
    const stats = saveData(req.session.user.username, trades, dividends, deposits);
    const db = getDb(req.session.user.username);
    db.prepare(`INSERT INTO import_history (filename, corretora, n_trades, n_dividends, n_skipped)
      VALUES (?,?,?,?,?)`)
      .run(req.file.originalname, tipo.toUpperCase(), stats.insertedTrades, stats.insertedDivs, stats.skipped);
    res.json({
      ok: true, nTrades: stats.insertedTrades, nDividends: stats.insertedDivs,
      nDeposits: stats.insertedDeps, nSkipped: stats.skipped, convFailed,
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

// ── DELETE /api/import/history/:id ───────────────────────
router.delete("/history/:id", (req, res) => {
  try {
    getDb(req.session.user.username).prepare("DELETE FROM import_history WHERE id = ?").run(Number(req.params.id));
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Erro ao apagar entrada." }); }
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
