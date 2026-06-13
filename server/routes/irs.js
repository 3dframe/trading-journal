const express = require("express");
const router = express.Router();
const { getDb } = require("../db");
const ExcelJS = require("exceljs");

// GET /api/irs/summary
router.get("/summary", (req, res) => {
  try {
    const db = getDb(req.session.user.username);
    const { ano } = req.query;
    if (!ano) return res.status(400).json({ error: "ano obrigatório" });

    const q = (corretora, categoria) =>
      db.prepare(`SELECT simbolo, data_abertura, data_fecho, pl_eur,
        valor_compra_eur, valor_venda_eur, pais, moeda_original, conta
        FROM trades
        WHERE strftime('%Y', data_fecho) = ? AND corretora = ? AND categoria = ?
        ORDER BY data_fecho ASC`).all(ano, corretora, categoria).map(r => ({
          ...r,
          valor_aquisicao:  Math.abs(r.valor_compra_eur || (r.pl_eur < 0 ? 0 : (r.valor_venda_eur || 0) - r.pl_eur)),
          valor_realizacao: Math.abs(r.valor_venda_eur  || (r.valor_compra_eur || 0) + r.pl_eur),
          mais_valia: r.pl_eur,
        }));

    const divs = db.prepare(`SELECT * FROM dividendos
      WHERE strftime('%Y', data_pagamento) = ? ORDER BY data_pagamento ASC`).all(ano);

    res.json({
      xtb_stocks:  q("XTB",  "STOCK"),
      xtb_cfds:    q("XTB",  "CFD"),
      ibkr_stocks: q("IBKR", "STOCK"),
      ibkr_opcoes: q("IBKR", "OPTION"),
      dividendos:  divs,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/irs/export
router.get("/export", async (req, res) => {
  try {
    const db = getDb(req.session.user.username);
    const { ano } = req.query;
    if (!ano) return res.status(400).json({ error: "ano obrigatório" });

    const wb = new ExcelJS.Workbook();

    const addSheet = (name, rows, cols) => {
      const ws = wb.addWorksheet(name);
      ws.addRow(cols.map(c => c.header));
      ws.getRow(1).font = { bold: true };
      if (!rows.length) { ws.addRow(["Sem dados para este quadro."]); return; }
      rows.forEach(r => ws.addRow(cols.map(c => r[c.key] ?? "")));
    };

    const q = (corretora, categoria) =>
      db.prepare(`SELECT simbolo, data_abertura, data_fecho, pl_eur,
        valor_compra_eur, valor_venda_eur, pais, moeda_original
        FROM trades WHERE strftime('%Y', data_fecho) = ? AND corretora = ? AND categoria = ?
        ORDER BY data_fecho ASC`).all(ano, corretora, categoria).map(r => ({
          ...r,
          mais_valia:       r.pl_eur,
          valor_aquisicao:  Math.abs(r.valor_compra_eur || 0),
          valor_realizacao: Math.abs(r.valor_venda_eur  || 0),
        }));

    const mv_cols = [
      { header: "Símbolo",            key: "simbolo" },
      { header: "Data Aquisição",     key: "data_abertura" },
      { header: "Data Realização",    key: "data_fecho" },
      { header: "Valor Aquisição €",  key: "valor_aquisicao" },
      { header: "Valor Realização €", key: "valor_realizacao" },
      { header: "Mais-Valia €",       key: "mais_valia" },
      { header: "País",               key: "pais" },
    ];

    const ws0 = wb.addWorksheet("Resumo");
    ws0.addRow([`IRS ${ano} – Trading Journal`]);
    ws0.addRow(["Gerado automaticamente. Verificar antes de submeter às Finanças."]);
    ws0.getRow(1).font = { bold: true, size: 14 };

    addSheet("AnexoG_Q9_XTB",      q("XTB",  "STOCK"), mv_cols);
    addSheet("AnexoG_Q13_CFDs",    q("XTB",  "CFD"),
      [{header:"Símbolo",key:"simbolo"},{header:"Data Fecho",key:"data_fecho"},
       {header:"Resultado €",key:"pl_eur"},{header:"País",key:"pais"}]);
    addSheet("AnexoJ_Q9_2A_Acoes", q("IBKR", "STOCK"),  [...mv_cols, {header:"Moeda",key:"moeda_original"}]);
    addSheet("AnexoJ_Q9_2B_Opcoes",q("IBKR", "OPTION"), [...mv_cols, {header:"Moeda",key:"moeda_original"}]);

    const divs = db.prepare(`SELECT simbolo, data_pagamento, valor_bruto_eur,
      retencao_eur, valor_liq_eur, pais_fonte, moeda
      FROM dividendos WHERE strftime('%Y', data_pagamento) = ?
      ORDER BY data_pagamento ASC`).all(ano);
    addSheet("AnexoJ_Q8_Dividendos", divs, [
      {header:"Símbolo",key:"simbolo"},{header:"Data Pagamento",key:"data_pagamento"},
      {header:"Valor Bruto €",key:"valor_bruto_eur"},{header:"Retenção €",key:"retencao_eur"},
      {header:"Valor Líquido €",key:"valor_liq_eur"},{header:"País Fonte",key:"pais_fonte"},
      {header:"Moeda",key:"moeda"},
    ]);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=IRS_${ano}_Trading.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
