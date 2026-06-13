const express  = require("express");
const multer   = require("multer");
const path     = require("path");
const fs       = require("fs");
const ExcelJS  = require("exceljs");
const { DatabaseSync } = require("node:sqlite");
const { clearDb, getDb } = require("../db");

const router     = express.Router();
const DATA_DIR   = path.join(__dirname, "..", "data");
const USERS_FILE = path.join(__dirname, "..", "users.json");

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}
function hasCustomDb(username) {
  const u = loadUsers().find(u => u.username.toLowerCase() === username.toLowerCase());
  return !!u?.dbPath;
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
  const d = new Date(s);
  return isNaN(d) ? s : d.toISOString().slice(0, 19).replace("T", " ");
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
  wb.eachSheet(ws => {
    if (sheet) return;
    const cells = [];
    ws.getRow(1).eachCell(c => cells.push((cellVal(c) || "").toString().toLowerCase()));
    if (cells.some(c => c.includes("símbolo") || c.includes("symbol") || c.includes("lucro") || c.includes("profit"))) {
      sheet = ws;
    }
  });
  if (!sheet) throw new Error("Não foi encontrada uma folha de operações no ficheiro XTB.");

  const headers = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, c => {
    headers.push((cellVal(c) || "").toString().toLowerCase().trim());
  });

  const col = (...keys) => headers.findIndex(h => keys.some(k => h.includes(k)));

  const iSym   = col("símbolo", "symbol");
  const iOpen  = col("hora de abertura", "open time", "data de abertura", "abertura");
  const iClose = col("hora de encerramento", "close time", "data de encerramento", "encerramento");
  const iVol   = col("volume");
  const iPL    = col("lucro / perda", "lucro/perda", "net profit", "profit", "lucro");
  const iFees  = col("comissão", "commission", "swap");
  const iType  = col("tipo", "type");

  if (iSym < 0 || iPL < 0) throw new Error("Colunas obrigatórias não encontradas (Símbolo, Lucro/Perda).");

  const trades = [];
  sheet.eachRow((row, n) => {
    if (n === 1) return;
    const get = i => i >= 0 ? cellVal(row.getCell(i + 1)) : null;
    const sym = get(iSym);
    if (!sym) return;

    const symStr  = sym.toString().trim();
    // XTB: ações têm sufixo de bolsa (ex: TSLA.US, NVO.NL); CFDs não têm (ou terminam em números)
    const isStock = /\.[A-Z]{2,4}(_\d+)?$/.test(symStr);

    trades.push({
      simbolo:       symStr.split(".")[0].toUpperCase(),
      data_abertura: toDate(get(iOpen)),
      data_fecho:    toDate(get(iClose)),
      pl_eur:        toFloat(get(iPL)),
      volume:        toFloat(get(iVol)),
      fees:          Math.abs(toFloat(get(iFees))),
      categoria:     isStock ? "STOCK" : "CFD",
      corretora:     "XTB",
      tipo:          get(iType)?.toString() ?? null,
    });
  });

  if (!trades.length) throw new Error("Nenhuma operação encontrada no ficheiro XTB.");
  return trades;
}

// ── IBKR Activity Statement CSV parser ────────────────────
function parseIBKR(buffer) {
  const text  = buffer.toString("utf8");
  const lines = text.split(/\r?\n/);

  const trades    = [];
  const dividends = [];

  let tradeHeaders    = null;
  let divHeaders      = null;

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

      const pl = toFloat(g("Realized P/L"));
      trades.push({
        simbolo:       (g("Symbol") || "").replace(" ", "").toUpperCase(),
        data_abertura: null,
        data_fecho:    toDate(g("Date/Time")),
        pl_eur:        pl,
        volume:        Math.abs(toFloat(g("Quantity"))),
        fees:          Math.abs(toFloat(g("Comm/Fee") || g("Comm/Fees"))),
        valor_compra_eur:  pl < 0 ? Math.abs(toFloat(g("Basis"))) : null,
        valor_venda_eur:   Math.abs(toFloat(g("Proceeds"))),
        moeda_original:    g("Currency"),
        categoria,
        corretora: "IBKR",
        tipo: null,
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
      const desc = g("Description") || "";
      const sym  = (g("Symbol") || desc.split("(")[0]).trim().toUpperCase();
      if (!sym) continue;

      dividends.push({
        simbolo:         sym,
        data_pagamento:  toDate(g("Date") || g("Payment Date")),
        valor_bruto_eur: toFloat(g("Amount")),
        retencao_eur:    0,
        valor_liq_eur:   toFloat(g("Amount")),
        pais_fonte:      null,
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
  }

  if (!trades.length && !dividends.length)
    throw new Error("Nenhuma operação encontrada no ficheiro IBKR. Certifica-te que é um Activity Statement completo.");

  return { trades, dividends };
}

// ── salvar no SQLite do utilizador ────────────────────────
function saveData(username, trades, dividends) {
  const db = getDb(username);

  const insTrade = db.prepare(`INSERT INTO trades
    (simbolo, data_abertura, data_fecho, pl_eur, volume, fees,
     valor_compra_eur, valor_venda_eur, moeda_original, categoria, corretora, tipo)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);

  const insDiv = db.prepare(`INSERT INTO dividendos
    (simbolo, data_pagamento, valor_bruto_eur, retencao_eur, valor_liq_eur, pais_fonte, moeda, corretora)
    VALUES (?,?,?,?,?,?,?,?)`);

  const insertAll = db.transaction(() => {
    for (const t of trades) {
      insTrade.run(
        t.simbolo, t.data_abertura, t.data_fecho, t.pl_eur,
        t.volume ?? null, t.fees ?? null,
        t.valor_compra_eur ?? null, t.valor_venda_eur ?? null,
        t.moeda_original ?? null, t.categoria, t.corretora, t.tipo ?? null
      );
    }
    for (const d of dividends) {
      insDiv.run(
        d.simbolo, d.data_pagamento, d.valor_bruto_eur,
        d.retencao_eur, d.valor_liq_eur,
        d.pais_fonte ?? null, d.moeda ?? null, d.corretora
      );
    }
  });

  insertAll();
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
    let trades = [], dividends = [];
    if (tipo === "xtb") {
      trades = await parseXTB(req.file.buffer);
    } else if (tipo === "ibkr") {
      ({ trades, dividends } = parseIBKR(req.file.buffer));
    } else {
      return res.status(400).json({ error: "Tipo inválido." });
    }
    res.json({
      nTrades:    trades.length,
      nDividends: dividends.length,
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
    let trades = [], dividends = [];
    if (tipo === "xtb") {
      trades = await parseXTB(req.file.buffer);
    } else if (tipo === "ibkr") {
      ({ trades, dividends } = parseIBKR(req.file.buffer));
    } else {
      return res.status(400).json({ error: "Tipo inválido." });
    }
    saveData(req.session.user.username, trades, dividends);
    res.json({ ok: true, nTrades: trades.length, nDividends: dividends.length });
  } catch (e) {
    res.status(422).json({ error: e.message });
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
