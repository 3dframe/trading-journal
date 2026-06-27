const express = require("express");
const router = express.Router();
const { getDb } = require("../db");

const yearParam = (v) => (v && /^\d{4}$/.test(String(v)) ? String(v) : null);

// GET /api/trades
router.get("/", (req, res) => {
  try {
    const db = getDb(req.session.user.username);
    const { ano, corretora, categoria, simbolo } = req.query;

    let sql = "SELECT * FROM trades WHERE 1=1";
    const params = [];

    if (ano)       { sql += " AND strftime('%Y', data_fecho) = ?"; params.push(String(ano)); }
    if (corretora) { sql += " AND corretora = ?"; params.push(corretora); }
    if (categoria) { sql += " AND categoria = ?"; params.push(categoria); }
    if (simbolo)   { sql += " AND simbolo LIKE ?"; params.push(`%${simbolo}%`); }

    sql += " ORDER BY data_fecho DESC";
    res.json(db.prepare(sql).all(...params));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/trades/anos
router.get("/anos", (req, res) => {
  try {
    const db = getDb(req.session.user.username);
    // Inclui anos que só têm dividendos/juros (sem operações fechadas) — caso contrário
    // esses anos nunca apareceriam no seletor e o Dashboard ficaria sem nenhum ano definido.
    const rows = db.prepare(`
      SELECT strftime('%Y', data_fecho) as ano FROM trades WHERE data_fecho IS NOT NULL
      UNION
      SELECT strftime('%Y', data_pagamento) as ano FROM dividendos WHERE data_pagamento IS NOT NULL
      ORDER BY ano DESC
    `).all();
    res.json(rows.map(r => parseInt(r.ano)));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/trades/stats
router.get("/stats", (req, res) => {
  try {
    const db = getDb(req.session.user.username);
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
      date(data_fecho) as dia, SUM(pl_eur) as pl
    FROM trades ${where}
    GROUP BY dia ORDER BY pl DESC`).all(...params);

    const best_day       = byDay[0]?.pl  ?? 0;
    const best_day_date  = byDay[0]?.dia ?? null;
    const worst_day      = byDay[byDay.length - 1]?.pl  ?? 0;
    const worst_day_date = byDay[byDay.length - 1]?.dia ?? null;

    const win_rate      = total.n_trades > 0 ? (total.n_wins / total.n_trades) * 100 : 0;
    const profit_factor = total.gross_loss ? Math.abs(total.gross_win / total.gross_loss) : 0;

    res.json({ ...total, win_rate, profit_factor, best_day, best_day_date, worst_day, worst_day_date });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/trades/equity
router.get("/equity", (req, res) => {
  try {
    const db = getDb(req.session.user.username);
    const aYear  = yearParam(req.query.ano);
    const where  = aYear ? "WHERE strftime('%Y', data_fecho) = ?" : "";
    const params = aYear ? [aYear] : [];

    const rows = db.prepare(`SELECT date(data_fecho) as dia, SUM(pl_eur) as pl
      FROM trades ${where} GROUP BY dia ORDER BY dia ASC`).all(...params);

    let cumul = 0;
    res.json(rows.map(r => {
      cumul += r.pl;
      return { dia: r.dia, equity: Math.round(cumul * 100) / 100 };
    }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/trades/equity-detailed
// Série diária da equity acumulada, com o total e uma coluna por categoria
// (STOCK/OPTION/CFD/FUTURE/…). Usada pelo modo "Empilhado" do card Total Acumulado.
// Sempre desde o início (não filtra por ano) — a janela é escolhida no cliente.
router.get("/equity-detailed", (req, res) => {
  try {
    const db = getDb(req.session.user.username);
    const rows = db.prepare(`SELECT date(data_fecho) as dia,
        COALESCE(NULLIF(categoria,''),'OUTROS') as categoria, SUM(pl_eur) as pl
      FROM trades GROUP BY dia, categoria ORDER BY dia ASC`).all();

    const categories = [...new Set(rows.map(r => r.categoria))];
    const byDay = new Map();              // dia -> { categoria: pl_do_dia }
    for (const r of rows) {
      if (!byDay.has(r.dia)) byDay.set(r.dia, {});
      byDay.get(r.dia)[r.categoria] = r.pl;
    }

    const cum = Object.fromEntries(categories.map(c => [c, 0]));
    const series = [...byDay.keys()].sort().map(dia => {
      const vals = byDay.get(dia);
      let total = 0;
      const row = { dia };
      for (const c of categories) {
        cum[c] += vals[c] || 0;
        row[c]  = Math.round(cum[c] * 100) / 100;
        total  += cum[c];
      }
      row.total = Math.round(total * 100) / 100;
      return row;
    });

    res.json({ categories, series });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/trades/by-week
router.get("/by-week", (req, res) => {
  try {
    const db = getDb(req.session.user.username);
    const aYear  = yearParam(req.query.ano);
    const where  = aYear ? "WHERE strftime('%Y', data_fecho) = ?" : "";
    const params = aYear ? [aYear] : [];

    res.json(db.prepare(`SELECT
      strftime('%Y-W%W', data_fecho) as semana, SUM(pl_eur) as pl
    FROM trades ${where} GROUP BY semana ORDER BY semana ASC`).all(...params));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/trades/by-symbol
router.get("/by-symbol", (req, res) => {
  try {
    const db = getDb(req.session.user.username);
    const aYear  = yearParam(req.query.ano);
    const where  = aYear ? "WHERE strftime('%Y', data_fecho) = ?" : "";
    const params = aYear ? [aYear] : [];

    res.json(db.prepare(`SELECT
      simbolo, COUNT(*) as n_trades, SUM(pl_eur) as pl_total,
      SUM(CASE WHEN pl_eur > 0 THEN 1 ELSE 0 END) as n_wins, AVG(pl_eur) as avg_pl
    FROM trades ${where} GROUP BY simbolo ORDER BY pl_total DESC`).all(...params));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/trades/holdings
// "Ações em Carteira" — posições abertas (snapshot da secção "Open Positions" dos
// relatórios, atualizado a cada importação). Junta o valor justo manual (fair_value).
router.get("/holdings", (req, res) => {
  try {
    const db = getDb(req.session.user.username);
    const rows = db.prepare(`
      SELECT p.*, f.valor AS valor_justo, f.moeda AS valor_justo_moeda
      FROM posicoes p
      LEFT JOIN fair_value f ON f.simbolo = p.simbolo
      ORDER BY ABS(COALESCE(p.valor_eur, 0)) DESC`).all();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/trades/fair-value — define/remove o valor justo manual de um símbolo.
// Body: { simbolo, valor, moeda }. valor vazio/null remove a entrada.
router.post("/fair-value", (req, res) => {
  try {
    const { simbolo, valor, moeda } = req.body || {};
    if (!simbolo) return res.status(400).json({ error: "Símbolo obrigatório." });
    const db = getDb(req.session.user.username);
    if (valor == null || valor === "" || Number.isNaN(Number(valor))) {
      db.prepare("DELETE FROM fair_value WHERE simbolo = ?").run(simbolo);
    } else {
      db.prepare(`INSERT INTO fair_value (simbolo, valor, moeda, atualizado_em)
        VALUES (?,?,?,?)
        ON CONFLICT(simbolo) DO UPDATE SET valor=excluded.valor, moeda=excluded.moeda, atualizado_em=excluded.atualizado_em`)
        .run(simbolo, Number(valor), moeda ?? null, new Date().toISOString());
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/trades/calendar
router.get("/calendar", (req, res) => {
  try {
    const db = getDb(req.session.user.username);
    const { mes } = req.query;
    const aYear   = yearParam(req.query.ano);

    let sql = `SELECT date(data_fecho) as dia, COUNT(*) as n_trades,
      SUM(pl_eur) as pl, SUM(CASE WHEN pl_eur > 0 THEN 1 ELSE 0 END) as n_wins
    FROM trades WHERE 1=1`;
    const params = [];

    if (aYear) { sql += " AND strftime('%Y', data_fecho) = ?"; params.push(aYear); }
    if (mes)   { sql += " AND strftime('%m', data_fecho) = ?"; params.push(String(mes).padStart(2, "0")); }
    sql += " GROUP BY dia";

    res.json(db.prepare(sql).all(...params));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
