const express = require("express");
const router = express.Router();
const { getDb } = require("../db");

const yearParam = (v) => (v && /^\d{4}$/.test(String(v)) ? String(v) : null);

// GET /api/trades?ano=2025&corretora=XTB&categoria=STOCK
router.get("/", (req, res) => {
  try {
    const db = getDb();
    const { ano, corretora, categoria, simbolo } = req.query;

    let sql = "SELECT * FROM trades WHERE 1=1";
    const params = [];

    if (ano) {
      sql += " AND strftime('%Y', data_fecho) = ?";
      params.push(String(ano));
    }
    if (corretora) { sql += " AND corretora = ?"; params.push(corretora); }
    if (categoria) { sql += " AND categoria = ?"; params.push(categoria); }
    if (simbolo)   { sql += " AND simbolo LIKE ?"; params.push(`%${simbolo}%`); }

    sql += " ORDER BY data_fecho DESC";

    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/trades/anos
router.get("/anos", (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(
      "SELECT DISTINCT strftime('%Y', data_fecho) as ano FROM trades WHERE data_fecho IS NOT NULL ORDER BY ano DESC"
    ).all();
    res.json(rows.map(r => parseInt(r.ano)));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/trades/stats?ano=2025
router.get("/stats", (req, res) => {
  try {
    const db = getDb();
    const aYear  = yearParam(req.query.ano);
    const where  = aYear ? "WHERE strftime('%Y', data_fecho) = ?" : "";
    const params = aYear ? [aYear] : [];

    const total = db.prepare(`SELECT
      COUNT(*) as n_trades,
      SUM(pl_eur) as net_pl,
      SUM(CASE WHEN pl_eur > 0 THEN 1 ELSE 0 END) as n_wins,
      SUM(CASE WHEN pl_eur < 0 THEN 1 ELSE 0 END) as n_losses,
      AVG(CASE WHEN pl_eur > 0 THEN pl_eur END) as avg_win,
      AVG(CASE WHEN pl_eur < 0 THEN pl_eur END) as avg_loss,
      SUM(CASE WHEN pl_eur > 0 THEN pl_eur ELSE 0 END) as gross_win,
      SUM(CASE WHEN pl_eur < 0 THEN pl_eur ELSE 0 END) as gross_loss,
      MAX(pl_eur) as max_win,
      MIN(pl_eur) as max_loss
    FROM trades ${where}`).get(...params);

    const byDay = db.prepare(`SELECT
      date(data_fecho) as dia,
      SUM(pl_eur) as pl
    FROM trades ${where}
    GROUP BY dia ORDER BY pl DESC`).all(...params);

    const best_day       = byDay[0]?.pl  ?? 0;
    const best_day_date  = byDay[0]?.dia ?? null;
    const worst_day      = byDay[byDay.length - 1]?.pl  ?? 0;
    const worst_day_date = byDay[byDay.length - 1]?.dia ?? null;

    const win_rate = total.n_trades > 0 ? (total.n_wins / total.n_trades) * 100 : 0;
    const profit_factor = total.gross_loss !== 0
      ? Math.abs(total.gross_win / total.gross_loss) : 0;

    res.json({ ...total, win_rate, profit_factor, best_day, best_day_date, worst_day, worst_day_date });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/trades/equity?ano=2025
router.get("/equity", (req, res) => {
  try {
    const db = getDb();
    const aYear  = yearParam(req.query.ano);
    const where  = aYear ? "WHERE strftime('%Y', data_fecho) = ?" : "";
    const params = aYear ? [aYear] : [];

    const rows = db.prepare(`SELECT date(data_fecho) as dia, SUM(pl_eur) as pl
      FROM trades ${where}
      GROUP BY dia ORDER BY dia ASC`).all(...params);

    let cumul = 0;
    const equity = rows.map(r => {
      cumul += r.pl;
      return { dia: r.dia, equity: Math.round(cumul * 100) / 100 };
    });

    res.json(equity);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/trades/by-week?ano=2025
router.get("/by-week", (req, res) => {
  try {
    const db = getDb();
    const aYear  = yearParam(req.query.ano);
    const where  = aYear ? "WHERE strftime('%Y', data_fecho) = ?" : "";
    const params = aYear ? [aYear] : [];

    const rows = db.prepare(`SELECT
      strftime('%Y-W%W', data_fecho) as semana,
      SUM(pl_eur) as pl
    FROM trades ${where}
    GROUP BY semana ORDER BY semana ASC`).all(...params);

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/trades/by-symbol?ano=2025
router.get("/by-symbol", (req, res) => {
  try {
    const db = getDb();
    const aYear  = yearParam(req.query.ano);
    const where  = aYear ? "WHERE strftime('%Y', data_fecho) = ?" : "";
    const params = aYear ? [aYear] : [];

    const rows = db.prepare(`SELECT
      simbolo,
      COUNT(*) as n_trades,
      SUM(pl_eur) as pl_total,
      SUM(CASE WHEN pl_eur > 0 THEN 1 ELSE 0 END) as n_wins,
      AVG(pl_eur) as avg_pl
    FROM trades ${where}
    GROUP BY simbolo ORDER BY pl_total DESC`).all(...params);

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/trades/calendar?ano=2025&mes=3
router.get("/calendar", (req, res) => {
  try {
    const db = getDb();
    const { mes } = req.query;
    const aYear  = yearParam(req.query.ano);

    let sql = `SELECT
      date(data_fecho) as dia,
      COUNT(*) as n_trades,
      SUM(pl_eur) as pl,
      SUM(CASE WHEN pl_eur > 0 THEN 1 ELSE 0 END) as n_wins
    FROM trades WHERE 1=1`;
    const params = [];

    if (aYear) { sql += " AND strftime('%Y', data_fecho) = ?"; params.push(aYear); }
    if (mes)   { sql += " AND strftime('%m', data_fecho) = ?"; params.push(String(mes).padStart(2, "0")); }
    sql += " GROUP BY dia";

    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
