// ── Câmbios de referência do BCE (tabela local) ───────────────────────────
// Substitui a dependência de uma API externa por trade (instructions.md §6):
// descarrega UMA vez o ficheiro histórico público do BCE (eurofxref-hist.zip),
// guarda-o localmente e faz todas as conversões a partir daí. O download não
// envia qualquer dado de operações — é só um ficheiro público.
//
// O BCE publica as taxas como "1 EUR = X moeda". Para converter um montante numa
// moeda estrangeira para EUR usamos: eur = montante / (X moeda por EUR).
const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const JSZip = require("jszip");

const ECB_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.zip";
const DB_PATH = path.join(__dirname, "fxrates.db");

let _db = null;
function db() {
  if (_db) return _db;
  _db = new DatabaseSync(DB_PATH);
  _db.exec(`
    CREATE TABLE IF NOT EXISTS fx_rates (
      date     TEXT NOT NULL,   -- YYYY-MM-DD
      currency TEXT NOT NULL,   -- código ISO (USD, GBP, ...)
      rate     REAL NOT NULL,   -- unidades de 'currency' por 1 EUR (formato BCE)
      PRIMARY KEY (date, currency)
    );
    CREATE INDEX IF NOT EXISTS idx_fx_cur_date ON fx_rates (currency, date);
    CREATE TABLE IF NOT EXISTS fx_meta (key TEXT PRIMARY KEY, value TEXT);
  `);
  return _db;
}

function _getMeta(key) {
  try { return db().prepare("SELECT value FROM fx_meta WHERE key = ?").get(key)?.value ?? null; }
  catch { return null; }
}
function _setMeta(key, value) {
  db().prepare("INSERT OR REPLACE INTO fx_meta (key, value) VALUES (?, ?)").run(key, value);
}

// Cache em memória para o ciclo de importação (currency|date -> eur por unidade)
const _cache = new Map();

// Taxa do BCE (unidades de 'currency' por 1 EUR) na data dada, com recuo até ao
// dia útil anterior mais próximo (fins de semana/feriados não têm cotação).
function _ecbRate(currency, date) {
  const stmt = db().prepare(
    "SELECT rate FROM fx_rates WHERE currency = ? AND date <= ? ORDER BY date DESC LIMIT 1"
  );
  const row = stmt.get(currency, date);
  return row ? row.rate : null;
}

// EUR por 1 unidade de 'currency' à data (mesma semântica do antigo fetchEURRate).
// EUR → 1. Devolve null se não houver cotação (tabela vazia ou data anterior aos dados).
function eurPerUnit(currency, dateStr) {
  if (!currency || currency === "EUR") return 1.0;
  const date = (dateStr || "").slice(0, 10);
  if (!date) return null;
  const key = `${currency}|${date}`;
  if (_cache.has(key)) return _cache.get(key);
  const ecb = _ecbRate(currency, date);
  const val = ecb ? 1 / ecb : null;
  _cache.set(key, val);
  return val;
}

// Estado da tabela local (para diagnóstico/UI).
function status() {
  try {
    const r = db().prepare(
      "SELECT COUNT(*) n, MIN(date) minDate, MAX(date) maxDate, COUNT(DISTINCT currency) nCur FROM fx_rates"
    ).get();
    return { loaded: r.n > 0, count: r.n, minDate: r.minDate, maxDate: r.maxDate, currencies: r.nCur, lastUpdate: _getMeta("last_update") };
  } catch {
    return { loaded: false, count: 0, minDate: null, maxDate: null, currencies: 0, lastUpdate: null };
  }
}

// Descarrega e (re)popula a tabela a partir do BCE. Opt-in: só corre quando
// chamado explicitamente (endpoint admin ou script). Devolve um resumo.
async function updateFromEcb() {
  const res = await fetch(ECB_URL);
  if (!res.ok) throw new Error(`Falha ao descarregar do BCE (HTTP ${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());

  const zip = await JSZip.loadAsync(buf);
  const entry = zip.file(/eurofxref-hist\.csv$/i)[0];
  if (!entry) throw new Error("CSV do BCE não encontrado dentro do ZIP.");
  const csv = await entry.async("string");

  const lines = csv.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error("CSV do BCE vazio ou inválido.");

  // Cabeçalho: Date, USD, JPY, ... (pode terminar em vírgula/coluna vazia)
  const header = lines[0].split(",").map(s => s.trim());
  const cols = header.map((h, i) => ({ i, cur: h })).slice(1).filter(c => c.cur && c.cur.toUpperCase() !== "");

  const conn = db();
  conn.exec("BEGIN");
  try {
    conn.exec("DELETE FROM fx_rates");
    const ins = conn.prepare("INSERT OR REPLACE INTO fx_rates (date, currency, rate) VALUES (?, ?, ?)");
    let inserted = 0;
    for (let r = 1; r < lines.length; r++) {
      const parts = lines[r].split(",");
      const date = (parts[0] || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      for (const c of cols) {
        const raw = (parts[c.i] || "").trim();
        if (!raw || raw.toUpperCase() === "N/A") continue;
        const rate = parseFloat(raw);
        if (!isFinite(rate) || rate <= 0) continue;
        ins.run(date, c.cur.toUpperCase(), rate);
        inserted++;
      }
    }
    _setMeta("last_update", new Date().toISOString());
    conn.exec("COMMIT");
    _cache.clear();
    const st = status();
    return { inserted, ...st };
  } catch (e) {
    conn.exec("ROLLBACK");
    throw e;
  }
}

// ── Atualização automática ────────────────────────────────────────────────
// Mantém a tabela fresca sem intervenção do utilizador. Só descarrega quando a
// tabela está vazia ou já não é atualizada há mais de `minIntervalHours` (default 20h,
// ou seja, no máximo ~1x/dia). A marca de tempo é persistente (fx_meta), por isso
// reiniciar o servidor não força re-download. Nunca lança — em falha mantém os dados
// atuais. Evita downloads concorrentes. Desativável com FX_AUTO_UPDATE=0.
let _updating = null;
let _lastTry  = 0;

function _hoursSince(iso) {
  if (!iso) return Infinity;
  const t = Date.parse(iso);
  return isNaN(t) ? Infinity : (Date.now() - t) / 3600_000;
}

async function ensureFresh(opts = {}) {
  if (process.env.FX_AUTO_UPDATE === "0") return { ok: true, skipped: "disabled", ...status() };

  const envH = Number(process.env.FX_UPDATE_INTERVAL_HOURS);
  const minIntervalH = opts.minIntervalHours ?? (Number.isFinite(envH) && envH > 0 ? envH : 20);
  const st  = status();
  const due = !st.loaded || _hoursSince(st.lastUpdate) >= minIntervalH;
  if (!due) return { ok: true, skipped: "fresh", ...st };

  if (_updating) return _updating;                              // já em curso
  // Após uma falha, espera ≥1h antes de tentar de novo (se já houver dados), para não
  // martelar o BCE quando há, p.ex., falta de rede.
  if (st.loaded && Date.now() - _lastTry < 3600_000) return { ok: false, skipped: "cooldown", ...st };

  _lastTry = Date.now();
  _updating = updateFromEcb()
    .then(r => ({ ok: true, ...r }))
    .catch(e => { console.error("[fx] atualização automática falhou:", e.message); return { ok: false, error: e.message, ...status() }; })
    .finally(() => { _updating = null; });
  return _updating;
}

module.exports = { eurPerUnit, status, updateFromEcb, ensureFresh };
