const express = require("express");
const router = express.Router();
const { getDb } = require("../db");

// GET /api/dividends?ano=2025
router.get("/", (req, res) => {
  try {
    const db = getDb();
    const { ano } = req.query;
    let where = ano ? `WHERE strftime('%Y', data_pagamento) = '${ano}'` : "";
    const rows = db.prepare(
      `SELECT * FROM dividendos ${where} ORDER BY data_pagamento DESC`
    ).all();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/dividends/total?ano=2025
router.get("/total", (req, res) => {
  try {
    const db = getDb();
    const { ano } = req.query;
    let where = ano ? `WHERE strftime('%Y', data_pagamento) = '${ano}'` : "";
    const row = db.prepare(`SELECT
      COUNT(*) as n,
      SUM(valor_bruto_eur) as total_bruto,
      SUM(retencao_eur) as total_retencao,
      SUM(valor_liq_eur) as total_liq
    FROM dividendos ${where}`).get();
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
