const express  = require("express");
const multer   = require("multer");
const path     = require("path");
const fs       = require("fs");
const ExcelJS  = require("exceljs");
const { DatabaseSync } = require("node:sqlite");
const { clearDb, getDb } = require("../db");

const router     = express.Router();
const DATA_DIR   = path.join(__dirname, "..", "data");

const EXCHANGE_COUNTRY = {
  PT:"Portugal", US:"Estados Unidos", NL:"Países Baixos", DE:"Alemanha",
  FR:"França", GB:"Reino Unido", UK:"Reino Unido", ES:"Espanha", IT:"Itália",
  SE:"Suécia", CH:"Suíça", BE:"Bélgica", DK:"Dinamarca", NO:"Noruega",
  FI:"Finlândia", IE:"Irlanda", LU:"Luxemburgo", AT:"Áustria", AU:"Austrália",
  CA:"Canadá", JP:"Japão", HK:"Hong Kong", SG:"Singapura", PL:"Polónia",
};
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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

// ── helpers ────────────────────────────────────────────────
function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 19).replace("T", " ");
  const s = v.toString().trim();
  if (!s || s === "0") return null;
  // DD/MM/YYYY or DD-MM-YYYY (European format used by IBKR PT)
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
  if (cell.type === 4) return cell.value; // date
  if (cell.value && typeof cell.value === "object" && "result" in cell.value) return cell.value.result;
  return cell.value;
}

// ── XTB Excel parser ───────────────────────────────────────
async function parseXTB(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  let sheet = null;
  let headerRowNum = 1;

  wb.eachSheet(ws => {
    if (sheet) return;
    // Scan up to 15 rows to find the header row (XTB reports have metadata rows at top)
    for (let r = 1; r <= 15; r++) {
      const cells = [];
      ws.getRow(r).eachCell(c => cells.push((cellVal(c) || "").toString().toLowerCase()));
      if (cells.some(c => c.includes("símbolo") || c.includes("symbol") || c.includes("lucro") || c.includes("profit"))) {
        sheet = ws;
        headerRowNum = r;
        break;
      }
    }
  });
  if (!sheet) throw new Error("Não foi encontrada uma folha de operações no ficheiro XTB.");

  const headers = [];
  sheet.getRow(headerRowNum).eachCell({ includeEmpty: true }, c => {
    headers.push((cellVal(c) || "").toString().toLowerCase().trim());
  });

  const col = (...keys) => headers.findIndex(h => keys.some(k => h.includes(k)));

  const iPos      = col("position", "posição", "id");
  const iSym      = col("símbolo", "symbol");
  const iOpen     = col("hora de abertura", "open time", "data de abertura", "abertura");
  const iClose    = col("hora de encerramento", "close time", "data de encerramento", "encerramento");
  const iVol      = col("volume");
  const iPL       = col("lucro / perda", "lucro/perda", "net profit", "profit", "lucro");
  const iPurchase = col("purchase value", "valor de compra");
  const iSale     = col("sale value", "valor de venda");
  const iComm     = col("comissão", "commission");
  const iSwap     = col("swap");
  const iType     = col("tipo", "type");

  if (iSym < 0) throw new Error("Coluna de símbolo não encontrada no ficheiro XTB.");
  if (iPL < 0 && (iPurchase < 0 || iSale < 0))
    throw new Error("Colunas de P&L não encontradas. Esperado: 'Profit' ou 'Purchase value'+'Sale value'.");

  const trades = [];
  sheet.eachRow((row, n) => {
    if (n <= headerRowNum) return;
    const get = i => i >= 0 ? cellVal(row.getCell(i + 1)) : null;
    const sym = get(iSym);
    if (!sym) return;

    const symStr  = sym.toString().trim();
    // XTB: ações têm sufixo de bolsa (ex: TSLA.US, NVO.NL); CFDs não têm (ou terminam em números)
    const isStock = /\.[A-Z]{2,4}(_\d+)?$/.test(symStr);

    const purchaseVal = toFloat(get(iPurchase));
    const saleVal     = toFloat(get(iSale));
    const pl = iPL >= 0
      ? toFloat(get(iPL))
      : saleVal - purchaseVal;
    const fees = Math.abs(toFloat(get(iComm))) + Math.abs(toFloat(get(iSwap)));

    const posId  = iPos >= 0 ? get(iPos)?.toString().trim() : null;
    const suffix = symStr.includes(".") ? symStr.split(".").pop().toUpperCase() : "";
    const pais   = EXCHANGE_COUNTRY[suffix] || null;
    trades.push({
      simbolo:          symStr.split(".")[0].toUpperCase(),
      data_abertura:    toDate(get(iOpen)),
      data_fecho:       toDate(get(iClose)),
      pl_eur:           pl,
      volume:           toFloat(get(iVol)),
      fees,
      valor_compra_eur: iPurchase >= 0 ? purchaseVal : null,
      valor_venda_eur:  iSale >= 0 ? saleVal : null,
      categoria:        isStock ? "STOCK" : "CFD",
      corretora:        "XTB",
      tipo_ordem:       get(iType)?.toString() ?? null,
      pais,
      ref_externa:      posId || null,
    });
  });

  if (!trades.length) throw new Error("Nenhuma operação encontrada no ficheiro XTB.");

  // ── Parse dividends from CASH OPERATION HISTORY sheet ─────
  const dividends = [];
  const deposits  = [];
  let cashSheet = null;
  let cashHeaderRow = 1;

  wb.eachSheet(ws => {
    if (cashSheet) return;
    const name = ws.name.toLowerCase();
    if (!name.includes("cash")) return;
    for (let r = 1; r <= 15; r++) {
      const cells = [];
      ws.getRow(r).eachCell(c => cells.push((cellVal(c) || "").toString().toLowerCase()));
      if (cells.some(c => c.includes("type") || c.includes("tipo") || c.includes("comment") || c.includes("amount"))) {
        cashSheet = ws;
        cashHeaderRow = r;
        break;
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

    // Track dividends and withholding taxes per (symbol, date)
    const divMap = new Map();

    cashSheet.eachRow((row, n) => {
      if (n <= cashHeaderRow) return;
      const get = i => i >= 0 ? cellVal(row.getCell(i + 1)) : null;

      const type = (get(cType) || "").toString().toLowerCase().trim();
      const isDivid    = type.includes("divid");
      // Só "withholding tax" — exclui "free-funds interest tax" e similares
      const isWithhold = type.includes("withhold");
      const isDeposit  = type.includes("deposit") || type.includes("deposito") || type.includes("entrada de fundos") || type.includes("fund");
      const isWithdraw = type.includes("withdrawal") || type.includes("levantamento") || type.includes("saída") || type.includes("saida");

      if (isDeposit || isWithdraw) {
        const amount = toFloat(get(cAmount));
        const date   = toDate(get(cDate));
        if (date && amount !== 0) {
          deposits.push({
            data: date, valor: Math.abs(amount),
            tipo: isDeposit ? "deposito" : "levantamento",
            corretora: "XTB", descricao: get(cType)?.toString() ?? null,
          });
        }
        return;
      }
      if (!isDivid && !isWithhold) return;

      const sym    = (get(cSym) || "").toString().trim();
      if (!sym) return;
      const amount = toFloat(get(cAmount));
      const date   = toDate(get(cDate));
      const key    = `${sym}|${date?.slice(0, 10)}`;

      // País a partir do sufixo do símbolo (ex: EDP.PT → Portugal)
      const suffix = sym.includes(".") ? sym.split(".").pop().toUpperCase() : "";
      const pais   = EXCHANGE_COUNTRY[suffix] || null;

      if (isDivid) {
        if (!divMap.has(key)) {
          divMap.set(key, { simbolo: sym.split(".")[0].toUpperCase(), data_pagamento: date,
            valor_bruto_eur: 0, retencao_eur: 0, moeda: "EUR", corretora: "XTB", pais_fonte: pais });
        }
        divMap.get(key).valor_bruto_eur += amount;
      } else if (isWithhold) {
        // Só aplica retenção se já existir um dividendo para este símbolo/data
        if (divMap.has(key)) {
          divMap.get(key).retencao_eur += Math.abs(amount);
        }
      }
    });

    for (const d of divMap.values()) {
      d.valor_liq_eur = d.valor_bruto_eur - d.retencao_eur;
      dividends.push(d);
    }
  }

  return { trades, dividends, deposits };
}

// ── IBKR Activity Statement CSV parser ────────────────────
function parseIBKR(buffer) {
  const text  = buffer.toString("utf8");
  const lines = text.split(/\r?\n/);

  const trades    = [];
  const dividends = [];
  const deposits  = [];

  let tradeHeaders    = null;
  let divHeaders      = null;
  let depHeaders      = null;

  for (const raw of lines) {
    const cols = raw.split(",").map(c => c.replace(/^"|"$/g, "").trim());

    if (cols[0] === "Trades" && cols[1] === "Header") {
      tradeHeaders = cols;
      continue;
    }
    if (cols[0] === "Trades" && cols[1] === "Data" && cols[2] === "Order" && tradeHeaders) {
      const g = key => {
        const i = tradeHeaders.findIndex(h => h === key);
        return i >= 0 ? cols[i] : null;
      };
      const cat = g("Asset Category") || "";
      let categoria = "STOCK";
      if (cat.toLowerCase().includes("option")) categoria = "OPTION";
      else if (cat.toLowerCase().includes("forex") || cat.toLowerCase().includes("cfd")) categoria = "CFD";

      const pl      = toFloat(g("Realized P/L"));
      const sym     = (g("Symbol") || "").replace(" ", "").toUpperCase();
      const dt      = g("Date/Time") || "";
      const rawQty  = toFloat(g("Quantity"));
      const qty     = Math.abs(rawQty);
      trades.push({
        simbolo:          sym,
        data_abertura:    null,
        data_fecho:       toDate(dt),
        pl_eur:           pl,
        volume:           qty,
        fees:             Math.abs(toFloat(g("Comm/Fee") || g("Comm/Fees"))),
        valor_compra_eur: pl < 0 ? Math.abs(toFloat(g("Basis"))) : null,
        valor_venda_eur:  Math.abs(toFloat(g("Proceeds"))),
        moeda_original:   g("Currency"),
        categoria,
        corretora:        "IBKR",
        tipo_ordem:       rawQty >= 0 ? "BUY" : "SELL",
        ref_externa:      `${sym}|${dt}|${qty}`,
      });
      continue;
    }

    if (cols[0] === "Dividends" && cols[1] === "Header") {
      divHeaders = cols;
      continue;
    }
    if (cols[0] === "Dividends" && cols[1] === "Data" && divHeaders) {
      const g = key => {
        const i = divHeaders.findIndex(h => h === key);
        return i >= 0 ? cols[i] : null;
      };
      const desc  = g("Description") || "";
      const sym   = (g("Symbol") || desc.split("(")[0]).trim().toUpperCase();
      if (!sym) continue;

      // País a partir do código do país no ISIN  (ex: "(US1234567890)")
      const isinMatch = desc.match(/\(([A-Z]{2})\d{8,10}\)/);
      const pais = isinMatch ? (EXCHANGE_COUNTRY[isinMatch[1]] || isinMatch[1]) : null;

      dividends.push({
        simbolo:         sym,
        data_pagamento:  toDate(g("Date") || g("Payment Date")),
        valor_bruto_eur: toFloat(g("Amount")),
        retencao_eur:    0,
        valor_liq_eur:   toFloat(g("Amount")),
        pais_fonte:      pais,
        moeda:           g("Currency"),
        corretora:       "IBKR",
      });
      continue;
    }

    // Withholding tax (reduz o dividendo líquido)
    if ((cols[0] === "Withholding Tax" || cols[0] === "Taxes Withheld") && cols[1] === "Data" && divHeaders) {
      if (dividends.length) {
        const ret = Math.abs(toFloat(cols[divHeaders.findIndex(h => h === "Amount")]));
        dividends[dividends.length - 1].retencao_eur += ret;
        dividends[dividends.length - 1].valor_liq_eur -= ret;
      }
    }

    // Deposits & Withdrawals
    if (cols[0] === "Deposits & Withdrawals" && cols[1] === "Header") { depHeaders = cols; continue; }
    if (cols[0] === "Deposits & Withdrawals" && cols[1] === "Data" && depHeaders) {
      const g = key => { const i = depHeaders.findIndex(h => h === key); return i >= 0 ? cols[i] : null; };
      const amount = toFloat(g("Amount"));
      const date   = toDate(g("Date") || g("Settle Date"));
      const desc   = g("Description") || "";
      if (date && amount !== 0) {
        deposits.push({
          data: date, valor: Math.abs(amount),
          tipo: amount >= 0 ? "deposito" : "levantamento",
          corretora: "IBKR", descricao: desc || null,
        });
      }
    }
  }

  if (!trades.length && !dividends.length)
    throw new Error("Nenhuma operação encontrada no ficheiro IBKR. Certifica-te que é um Activity Statement completo.");

  return { trades, dividends, deposits };
}

// ── salvar no SQLite do utilizador ────────────────────────
function saveData(username, trades, dividends, deposits = []) {
  const db = getDb(username);

  const insTrade = db.prepare(`INSERT OR IGNORE INTO trades
    (simbolo, data_abertura, data_fecho, pl_eur, volume, fees,
     valor_compra_eur, valor_venda_eur, moeda_original, categoria, corretora, tipo_ordem, pais, ref_externa)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  const insDiv = db.prepare(`INSERT OR IGNORE INTO dividendos
    (simbolo, data_pagamento, valor_bruto_eur, retencao_eur, valor_liq_eur, pais_fonte, moeda, corretora)
    VALUES (?,?,?,?,?,?,?,?)`);

  const updDivPais = db.prepare(`UPDATE dividendos SET pais_fonte = ?
    WHERE simbolo = ? AND data_pagamento = ? AND corretora = ? AND pais_fonte IS NULL`);

  const insDep = db.prepare(`INSERT OR IGNORE INTO depositos
    (data, valor, tipo, corretora, descricao) VALUES (?,?,?,?,?)`);

  let insertedTrades = 0, insertedDivs = 0, insertedDeps = 0;

  db.exec("BEGIN");
  try {
    for (const t of trades) {
      const r = insTrade.run(
        t.simbolo, t.data_abertura, t.data_fecho, t.pl_eur,
        t.volume ?? null, t.fees ?? null,
        t.valor_compra_eur ?? null, t.valor_venda_eur ?? null,
        t.moeda_original ?? null, t.categoria, t.corretora, t.tipo_ordem ?? null,
        t.pais ?? null, t.ref_externa ?? null
      );
      insertedTrades += r.changes;
    }
    for (const d of dividends) {
      const r = insDiv.run(
        d.simbolo, d.data_pagamento, d.valor_bruto_eur,
        d.retencao_eur, d.valor_liq_eur,
        d.pais_fonte ?? null, d.moeda ?? null, d.corretora
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
    insertedTrades,
    insertedDivs,
    insertedDeps,
    skipped: (trades.length - insertedTrades) + (dividends.length - insertedDivs) + (deposits.length - insertedDeps),
  };
}

// ── GET /api/import/info ──────────────────────────────────
router.get("/info", (req, res) => {
  res.json({ mode: hasCustomDb(req.session.user.username) ? "custom" : "local" });
});

// ── POST /api/import/preview — parse sem gravar ───────────
router.post("/preview", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Nenhum ficheiro enviado." });
  const tipo = req.body.tipo; // "xtb" | "ibkr" | "database"
  try {
    let trades = [], dividends = [], deposits = [];
    if (tipo === "xtb") {
      ({ trades, dividends, deposits } = await parseXTB(req.file.buffer));
    } else if (tipo === "ibkr") {
      ({ trades, dividends, deposits } = parseIBKR(req.file.buffer));
    } else {
      return res.status(400).json({ error: "Tipo inválido." });
    }
    res.json({
      nTrades:    trades.length,
      nDividends: dividends.length,
      nDeposits:  deposits.length,
      preview:    trades.slice(0, 5),
    });
  } catch (e) {
    res.status(422).json({ error: e.message });
  }
});

// ── POST /api/import/confirm — parse e grava ─────────────
router.post("/confirm", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Nenhum ficheiro enviado." });
  if (hasCustomDb(req.session.user.username))
    return res.status(403).json({ error: "Utilizador com base de dados externa." });

  const tipo = req.body.tipo;
  try {
    let trades = [], dividends = [], deposits = [];
    if (tipo === "xtb") {
      ({ trades, dividends, deposits } = await parseXTB(req.file.buffer));
    } else if (tipo === "ibkr") {
      ({ trades, dividends, deposits } = parseIBKR(req.file.buffer));
    } else {
      return res.status(400).json({ error: "Tipo inválido." });
    }
    const stats = saveData(req.session.user.username, trades, dividends, deposits);
    const db = getDb(req.session.user.username);
    db.prepare(`INSERT INTO import_history (filename, corretora, n_trades, n_dividends, n_skipped)
      VALUES (?,?,?,?,?)`)
      .run(req.file.originalname, tipo.toUpperCase(), stats.insertedTrades, stats.insertedDivs, stats.skipped);
    res.json({ ok: true, nTrades: stats.insertedTrades, nDividends: stats.insertedDivs, nDeposits: stats.insertedDeps, nSkipped: stats.skipped });
  } catch (e) {
    res.status(422).json({ error: e.message });
  }
});

// ── GET /api/import/deposits ─────────────────────────────
router.get("/deposits", (req, res) => {
  try {
    const db   = getDb(req.session.user.username);
    const rows = db.prepare("SELECT * FROM depositos ORDER BY data DESC").all();
    res.json(rows);
  } catch {
    res.json([]);
  }
});

// ── GET /api/import/history ───────────────────────────────
router.get("/history", (req, res) => {
  try {
    const db   = getDb(req.session.user.username);
    const rows = db.prepare("SELECT * FROM import_history ORDER BY imported_at DESC LIMIT 50").all();
    res.json(rows);
  } catch {
    res.json([]);
  }
});

// ── DELETE /api/import/history/:id ───────────────────────
router.delete("/history/:id", (req, res) => {
  try {
    const db = getDb(req.session.user.username);
    db.prepare("DELETE FROM import_history WHERE id = ?").run(Number(req.params.id));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro ao apagar entrada." });
  }
});

// ── POST /api/import/database — substitui .db ────────────
router.post("/database", upload.single("database"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Nenhum ficheiro enviado." });
  const sig = req.file.buffer.slice(0, 16).toString("utf8");
  if (!sig.startsWith("SQLite format 3"))
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
