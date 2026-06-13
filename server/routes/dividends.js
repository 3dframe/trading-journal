const express = require("express");
const router = express.Router();
const { getDb } = require("../db");

// GET /api/dividends
router.get("/", (req, res) => {
  try {
    const db = getDb(req.session.user.username);
    const { ano } = req.query;
    const params = [];
    let where = "";
    if (ano) { where = "WHERE strftime('%Y', data_pagamento) = ?"; params.push(String(ano)); }
    res.json(db.prepare(`SELECT * FROM dividendos ${where} ORDER BY data_pagamento DESC`).all(...params));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/dividends/total
router.get("/total", (req, res) => {
  try {
    const db = getDb(req.session.user.username);
    const { ano } = req.query;
    const params = [];
    let where = "";
    if (ano) { where = "WHERE strftime('%Y', data_pagamento) = ?"; params.push(String(ano)); }
    res.json(db.prepare(`SELECT
      COUNT(*) as n,
      SUM(valor_bruto_eur) as total_bruto,
      SUM(retencao_eur) as total_retencao,
      SUM(valor_liq_eur) as total_liq
    FROM dividendos ${where}`).get(...params));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
