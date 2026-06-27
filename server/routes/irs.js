const express = require("express");
const router  = express.Router();
const { getDb } = require("../db");
const ExcelJS   = require("exceljs");

// Códigos AT (Autoridade Tributária) por país
// Sincronizado com EXCHANGE_COUNTRY em server/routes/import.js
const COUNTRY_AT = {
  "Portugal":"620",       "Estados Unidos":"840", "Irlanda":"372",
  "Alemanha":"276",       "França":"250",         "Reino Unido":"826",
  "Países Baixos":"528",  "Espanha":"724",        "Itália":"380",
  "Suécia":"752",         "Suíça":"756",          "Bélgica":"056",
  "Dinamarca":"208",      "Noruega":"578",        "Finlândia":"246",
  "Luxemburgo":"442",     "Áustria":"040",        "Austrália":"036",
  "Canadá":"124",         "Japão":"392",          "Hong Kong":"344",
  "Singapura":"702",      "Polónia":"616",        "China":"156",
  "Coreia do Sul":"410",  "Taiwan":"158",         "Brasil":"076",
  "Índia":"356",          "Israel":"376",         "México":"484",
  "África do Sul":"710",
};
const atCode = pais => COUNTRY_AT[pais] || "000";

function calcValores(t) {
  const vAq    = Math.abs(t.valor_compra_eur || 0);
  const vReal  = Math.abs(t.valor_venda_eur  || 0);
  const desp   = Math.abs(t.fees || 0);
  const mv     = t.pl_eur || 0;
  return { valor_aquisicao: vAq, valor_realizacao: vReal, despesas: desp, mais_valia: mv };
}

// ── GET /api/irs/summary ──────────────────────────────────
router.get("/summary", (req, res) => {
  try {
    const db  = getDb(req.session.user.username);
    const ano = req.query.ano;
    if (!ano) return res.status(400).json({ error: "ano obrigatório" });

    // A) Anexo G Q9 — Ações nacionais (Portugal, exceto EDPR)
    const gQ9 = db.prepare(`
      SELECT simbolo, data_abertura, data_fecho, pl_eur,
             valor_compra_eur, valor_venda_eur, fees, pais, corretora, conta, taxa_cambio
      FROM   trades
      WHERE  strftime('%Y', data_fecho) = ?
        AND  categoria = 'STOCK'
        AND  LOWER(COALESCE(pais,'')) = 'portugal'
        AND  UPPER(simbolo) != 'EDPR'
      ORDER BY data_fecho ASC
    `).all(ano).map(t => ({ ...t, ...calcValores(t), pais_codigo: "620" }));

    // B) Anexo J Q9.2A — Mais-valias estrangeiras (stocks não-PT + EDPR)
    const jQ92A = db.prepare(`
      SELECT simbolo, data_abertura, data_fecho, pl_eur,
             valor_compra_eur, valor_venda_eur, fees, pais, corretora, conta, moeda_original, taxa_cambio
      FROM   trades
      WHERE  strftime('%Y', data_fecho) = ?
        AND  categoria = 'STOCK'
        AND  (LOWER(COALESCE(pais,'')) != 'portugal' OR UPPER(simbolo) = 'EDPR')
      ORDER BY data_fecho ASC
    `).all(ano).map(t => ({ ...t, ...calcValores(t), pais_codigo: atCode(t.pais) }));

    // C) Anexo J Q9.2B — Derivados: CFDs e Opções
    const jQ92BRaw = db.prepare(`
      SELECT simbolo, data_abertura, data_fecho, pl_eur,
             valor_compra_eur, valor_venda_eur, fees, pais, corretora, conta, categoria,
             COALESCE(swap,    0) AS swap,
             COALESCE(rollover,0) AS rollover,
             COALESCE(gross_pl, pl_eur) AS gross_pl,
             taxa_cambio
      FROM   trades
      WHERE  strftime('%Y', data_fecho) = ?
        AND  categoria IN ('CFD','OPTION')
      ORDER BY corretora ASC, categoria ASC, data_fecho ASC
    `).all(ano).map(t => {
      // CFD (XTB): resultado = Gross P/L + Swap + Rollover − Comissão
      // Option (IBKR): usa pl_eur (já líquido)
      const resultado = t.categoria === "CFD"
        ? (t.gross_pl + t.swap + t.rollover) - Math.abs(t.fees || 0)
        : (t.pl_eur || 0);
      return { ...t, resultado_irs: resultado, pais_codigo: atCode(t.pais) };
    });

    // Agrupamento Q9.2B por país (para entrada no Portal AT)
    const q92bPorPais = {};
    for (const t of jQ92BRaw) {
      const k = t.pais || "Desconhecido";
      if (!q92bPorPais[k]) q92bPorPais[k] = { pais: k, pais_codigo: atCode(k), ganhos: 0, perdas: 0 };
      if (t.resultado_irs >= 0) q92bPorPais[k].ganhos += t.resultado_irs;
      else                      q92bPorPais[k].perdas += Math.abs(t.resultado_irs);
    }

    // D) Anexo J Q8 — Dividendos e Juros
    // EXCEÇÃO XTB: os juros 'Free-funds' da XTB são rendimento NACIONAL já tributado na
    // fonte a 28% (sucursal portuguesa) e estão dispensados de declaração. São excluídos do
    // Anexo J Q8 e nunca somados aos juros estrangeiros da IBKR (Irlanda). Ver cartão de
    // "Rendimentos Dispensados" (jurosNacionaisXTB).
    const jQ8Linhas = db.prepare(`
      SELECT simbolo, data_pagamento, valor_bruto_eur, retencao_eur, valor_liq_eur,
             pais_fonte, moeda, corretora, conta, COALESCE(tipo,'DIVIDEND') AS tipo
      FROM   dividendos
      WHERE  strftime('%Y', data_pagamento) = ?
        AND  NOT (UPPER(COALESCE(corretora,'')) = 'XTB' AND COALESCE(tipo,'DIVIDEND') = 'INTEREST')
      ORDER BY tipo ASC, pais_fonte ASC, data_pagamento ASC
    `).all(ano).map(d => ({ ...d, pais_codigo: atCode(d.pais_fonte) }));

    // Juros nacionais da XTB (dispensados) — exibidos apenas a título informativo.
    const jurosNacionaisXTB = db.prepare(`
      SELECT simbolo, data_pagamento, valor_bruto_eur, retencao_eur, valor_liq_eur,
             pais_fonte, moeda, corretora, conta
      FROM   dividendos
      WHERE  strftime('%Y', data_pagamento) = ?
        AND  UPPER(COALESCE(corretora,'')) = 'XTB' AND COALESCE(tipo,'DIVIDEND') = 'INTEREST'
      ORDER BY data_pagamento ASC
    `).all(ano);

    // Agrupamento Q8 por país + tipo (para entrada no Portal AT)
    const q8PorPais = {};
    for (const d of jQ8Linhas) {
      const k = `${d.pais_fonte || "Desconhecido"}|${d.tipo}`;
      if (!q8PorPais[k]) {
        q8PorPais[k] = {
          pais: d.pais_fonte || "Desconhecido", pais_codigo: atCode(d.pais_fonte),
          tipo: d.tipo, cod_rendimento: d.tipo === "INTEREST" ? "E20" : "E21",
          bruto_eur: 0, retencao_eur: 0,
        };
      }
      q8PorPais[k].bruto_eur    += d.valor_bruto_eur || 0;
      q8PorPais[k].retencao_eur += d.retencao_eur    || 0;
    }

    // E) Anexo J Q11 — Contas no Estrangeiro (IBKR)
    const temIBKR = db.prepare(
      "SELECT 1 FROM import_history WHERE UPPER(corretora)='IBKR' LIMIT 1"
    ).get();

    res.json({
      g_q9:    gQ9,
      j_q9_2a: jQ92A,
      j_q9_2b: { trades: jQ92BRaw, por_pais: Object.values(q92bPorPais) },
      j_q8:    { linhas: jQ8Linhas, por_pais: Object.values(q8PorPais) },
      juros_nacionais_xtb: {
        linhas: jurosNacionaisXTB,
        bruto_eur:    jurosNacionaisXTB.reduce((s, d) => s + (d.valor_bruto_eur || 0), 0),
        retencao_eur: jurosNacionaisXTB.reduce((s, d) => s + (d.retencao_eur    || 0), 0),
        liquido_eur:  jurosNacionaisXTB.reduce((s, d) => s + (d.valor_liq_eur   || 0), 0),
      },
      j_q11: temIBKR ? {
        pais: "IE", pais_nome: "Irlanda", pais_codigo: "372",
        instituicao: "Interactive Brokers Ireland Limited",
        morada: "10 Earlsfort Terrace, Dublin, D02 T380, Irlanda",
        nib: "(verificar em: Conta → Extrato de Conta na plataforma IBKR)",
      } : null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/irs/export (Excel) ───────────────────────────
router.get("/export", async (req, res) => {
  try {
    const db  = getDb(req.session.user.username);
    const ano = req.query.ano;
    if (!ano) return res.status(400).json({ error: "ano obrigatório" });

    const wb = new ExcelJS.Workbook();
    wb.creator  = "Trading Journal";
    wb.created  = new Date();

    // ── Estilos ──
    const HDR_FILL  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F6AF5" } };
    const GOOD_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
    const BAD_FILL  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
    const hdrCell   = cell => {
      cell.font      = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.fill      = HDR_FILL;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    };
    const fmtEUR  = '#,##0.00 "€"';
    const fmtDate = "dd/mm/yyyy";

    function buildSheet(name, columns, rows, mvKey) {
      const ws = wb.addWorksheet(name);
      ws.columns = columns.map(c => ({ key: c.key, width: c.w || 16 }));
      const hr = ws.addRow(columns.map(c => c.h));
      hr.height = 24;
      hr.eachCell(hdrCell);
      if (!rows.length) { ws.addRow(["Sem dados para este quadro."]); return ws; }
      for (const r of rows) {
        const row = ws.addRow(columns.map(c => r[c.key] ?? ""));
        columns.forEach((c, i) => {
          const cell = row.getCell(i + 1);
          if (c.fmt) cell.numFmt = c.fmt;
          if (c.key === mvKey) {
            cell.fill = (r[mvKey] || 0) >= 0 ? GOOD_FILL : BAD_FILL;
            cell.font = { bold: true };
          }
        });
      }
      // Linha de totais numéricos
      const numCols = columns.filter(c => c.fmt === fmtEUR);
      if (numCols.length) {
        const totRow = ws.addRow(
          columns.map(c => (c.fmt === fmtEUR ? rows.reduce((s, r) => s + (r[c.key] || 0), 0) : c === columns[0] ? "TOTAL" : ""))
        );
        totRow.font = { bold: true };
        totRow.eachCell((cell, i) => { if (columns[i - 1]?.fmt === fmtEUR) cell.numFmt = fmtEUR; });
        ws.addRow([]);
      }
      return ws;
    }

    // ── Resumo ──
    const wsR = wb.addWorksheet("📋 Resumo");
    wsR.columns = [{ width: 65 }, { width: 20 }];
    wsR.addRow([`IRS ${ano} — Trading Journal`]).getCell(1).font = { bold: true, size: 15, color: { argb: "FF4F6AF5" } };
    wsR.addRow([`Gerado em ${new Date().toLocaleDateString("pt-PT")}`]).getCell(1).font = { italic: true, color: { argb: "FF6B7280" } };
    wsR.addRow([]);
    wsR.addRow(["⚠️  Verificar TODOS os valores antes de submeter às Finanças."]).getCell(1).font = { bold: true, color: { argb: "FFDC2626" } };
    wsR.addRow([]);
    wsR.addRow(["Quadro", "Total €"]).forEach?.();
    const summaryHdr = wsR.lastRow;
    summaryHdr?.eachCell(hdrCell);

    // ── A) Anexo G Q9 ──
    const gQ9Rows = db.prepare(`
      SELECT simbolo, data_abertura, data_fecho, COALESCE(conta,'—') AS conta,
             ABS(COALESCE(valor_compra_eur,0)) AS vaq,
             ABS(COALESCE(valor_venda_eur,0))  AS vreal,
             ABS(COALESCE(fees,0))              AS desp,
             pl_eur AS mv
      FROM trades WHERE strftime('%Y',data_fecho)=? AND categoria='STOCK'
        AND LOWER(COALESCE(pais,''))='portugal' AND UPPER(simbolo)!='EDPR'
      ORDER BY data_fecho
    `).all(ano);

    buildSheet("AnexoG · Q9 (Ações Nac.)", [
      { h: "Cód. Ativo",            key: "simbolo",      w: 14 },
      { h: "Conta",                 key: "conta",        w: 14 },
      { h: "Data Aquisição",        key: "data_abertura",w: 16, fmt: fmtDate },
      { h: "Valor Aquisição €",     key: "vaq",          w: 18, fmt: fmtEUR  },
      { h: "Data Realização",       key: "data_fecho",   w: 16, fmt: fmtDate },
      { h: "Valor Realização €",    key: "vreal",        w: 18, fmt: fmtEUR  },
      { h: "Despesas €",            key: "desp",         w: 14, fmt: fmtEUR  },
      { h: "Mais-Valia €",          key: "mv",           w: 14, fmt: fmtEUR  },
    ], gQ9Rows, "mv");

    // ── B) Anexo J Q9.2A ──
    const jQ92ARows = db.prepare(`
      SELECT simbolo, data_abertura, data_fecho, COALESCE(pais,'?') AS pais, COALESCE(conta,'—') AS conta,
             ABS(COALESCE(valor_compra_eur,0)) AS vaq,
             ABS(COALESCE(valor_venda_eur,0))  AS vreal,
             ABS(COALESCE(fees,0))              AS desp,
             pl_eur AS mv, moeda_original
      FROM trades WHERE strftime('%Y',data_fecho)=? AND categoria='STOCK'
        AND (LOWER(COALESCE(pais,''))!='portugal' OR UPPER(simbolo)='EDPR')
      ORDER BY data_fecho
    `).all(ano).map(r => ({ ...r, pais_codigo: atCode(r.pais) }));

    buildSheet("AnexoJ · Q9.2A (Estrangeiro)", [
      { h: "País (Cód. AT)",        key: "pais_codigo",  w: 14 },
      { h: "País (nome)",           key: "pais",         w: 20 },
      { h: "Cód. Ativo",            key: "simbolo",      w: 14 },
      { h: "Conta",                 key: "conta",        w: 14 },
      { h: "Data Aquisição",        key: "data_abertura",w: 16, fmt: fmtDate },
      { h: "Valor Aquisição €",     key: "vaq",          w: 18, fmt: fmtEUR  },
      { h: "Data Realização",       key: "data_fecho",   w: 16, fmt: fmtDate },
      { h: "Valor Realização €",    key: "vreal",        w: 18, fmt: fmtEUR  },
      { h: "Despesas €",            key: "desp",         w: 14, fmt: fmtEUR  },
      { h: "Mais-Valia €",          key: "mv",           w: 14, fmt: fmtEUR  },
    ], jQ92ARows, "mv");

    // ── C) Anexo J Q9.2B — Resumo por país ──
    const jQ92BRaw = db.prepare(`
      SELECT simbolo, data_fecho, COALESCE(pais,'Desconhecido') AS pais, categoria, COALESCE(conta,'—') AS conta,
             COALESCE(gross_pl, pl_eur) AS gross_pl,
             COALESCE(swap,0) AS swap, COALESCE(rollover,0) AS rollover,
             ABS(COALESCE(fees,0)) AS fees, pl_eur
      FROM trades WHERE strftime('%Y',data_fecho)=? AND categoria IN ('CFD','OPTION')
      ORDER BY data_fecho
    `).all(ano).map(t => {
      const res = t.categoria === "CFD"
        ? (t.gross_pl + t.swap + t.rollover) - t.fees
        : t.pl_eur || 0;
      return { ...t, resultado: res, pais_codigo: atCode(t.pais) };
    });

    const q92bByPais = {};
    for (const t of jQ92BRaw) {
      const k = t.pais;
      if (!q92bByPais[k]) q92bByPais[k] = { pais: k, pais_codigo: atCode(k), ganhos: 0, perdas: 0 };
      if (t.resultado >= 0) q92bByPais[k].ganhos += t.resultado;
      else                   q92bByPais[k].perdas += Math.abs(t.resultado);
    }

    buildSheet("AnexoJ · Q9.2B (Derivados) AT", [
      { h: "País (Cód. AT)",  key: "pais_codigo", w: 14 },
      { h: "País (nome)",     key: "pais",        w: 20 },
      { h: "Cód. Rendimento", key: "cod",         w: 16 },
      { h: "Rendimentos €\n(Ganhos)", key: "ganhos", w: 20, fmt: fmtEUR },
      { h: "Perdas €",        key: "perdas",      w: 16, fmt: fmtEUR },
    ], Object.values(q92bByPais).map(r => ({ ...r, cod: "G20" })), null);

    buildSheet("AnexoJ · Q9.2B (Detalhe)", [
      { h: "Símbolo",         key: "simbolo",     w: 14 },
      { h: "Categoria",       key: "categoria",   w: 12 },
      { h: "País",            key: "pais",        w: 20 },
      { h: "Conta",           key: "conta",       w: 14 },
      { h: "Data Fecho",      key: "data_fecho",  w: 16, fmt: fmtDate },
      { h: "Gross P/L €",     key: "gross_pl",    w: 14, fmt: fmtEUR  },
      { h: "Swap €",          key: "swap",        w: 12, fmt: fmtEUR  },
      { h: "Rollover €",      key: "rollover",    w: 12, fmt: fmtEUR  },
      { h: "Comissão €",      key: "fees",        w: 12, fmt: fmtEUR  },
      { h: "Resultado IRS €", key: "resultado",   w: 16, fmt: fmtEUR  },
    ], jQ92BRaw, "resultado");

    // ── D) Anexo J Q8 — Dividendos e Juros ──
    const q8Rows = db.prepare(`
      SELECT simbolo, data_pagamento, valor_bruto_eur, retencao_eur, valor_liq_eur,
             COALESCE(pais_fonte,'Desconhecido') AS pais_fonte, COALESCE(conta,'—') AS conta,
             COALESCE(ref_externa,'—') AS ref_externa,
             moeda, corretora, COALESCE(tipo,'DIVIDEND') AS tipo
      FROM dividendos WHERE strftime('%Y',data_pagamento)=?
        AND NOT (UPPER(COALESCE(corretora,'')) = 'XTB' AND COALESCE(tipo,'DIVIDEND') = 'INTEREST')
      ORDER BY tipo, pais_fonte, data_pagamento
    `).all(ano).map(d => ({ ...d, pais_codigo: atCode(d.pais_fonte), cod: d.tipo === "INTEREST" ? "E20" : "E21" }));

    buildSheet("AnexoJ · Q8 (Dividendos)", [
      { h: "País (Cód. AT)",   key: "pais_codigo",      w: 14 },
      { h: "País (nome)",      key: "pais_fonte",       w: 20 },
      { h: "Cód. Rendimento",  key: "cod",              w: 16 },
      { h: "Símbolo",          key: "simbolo",          w: 14 },
      { h: "Conta",            key: "conta",            w: 14 },
      { h: "Data Pagamento",   key: "data_pagamento",   w: 16, fmt: fmtDate },
      { h: "Rendimento Bruto €", key: "valor_bruto_eur",w: 20, fmt: fmtEUR  },
      { h: "Imposto Retido €", key: "retencao_eur",     w: 18, fmt: fmtEUR  },
      { h: "Valor Líquido €",  key: "valor_liq_eur",    w: 16, fmt: fmtEUR  },
      { h: "Refs. Operação",  key: "ref_externa",       w: 22 },
    ], q8Rows, null);

    // Resumo Q8 por país + tipo
    const q8PorPais = {};
    for (const d of q8Rows) {
      const k = `${d.pais_fonte}|${d.tipo}`;
      if (!q8PorPais[k]) q8PorPais[k] = { pais_codigo: d.pais_codigo, pais: d.pais_fonte, cod: d.cod, bruto: 0, retencao: 0 };
      q8PorPais[k].bruto    += d.valor_bruto_eur || 0;
      q8PorPais[k].retencao += d.retencao_eur    || 0;
    }
    buildSheet("AnexoJ · Q8 (Resumo AT)", [
      { h: "País (Cód. AT)",   key: "pais_codigo", w: 14 },
      { h: "País (nome)",      key: "pais",        w: 20 },
      { h: "Cód. Rendimento",  key: "cod",         w: 16 },
      { h: "Rendimento Bruto €", key: "bruto",     w: 20, fmt: fmtEUR },
      { h: "Imposto Retido €", key: "retencao",    w: 18, fmt: fmtEUR },
    ], Object.values(q8PorPais), null);

    // ── E) Quadro 11 — Conta IBKR ──
    const ws11 = wb.addWorksheet("AnexoJ · Q11 (Conta IBKR)");
    ws11.columns = [{ width: 35 }, { width: 60 }];
    const q11Hdr = ws11.addRow(["Campo", "Valor"]);
    q11Hdr.height = 22;
    q11Hdr.eachCell(hdrCell);
    [
      ["País", "IE — Irlanda (código AT: 372)"],
      ["Instituição", "Interactive Brokers Ireland Limited"],
      ["Morada", "10 Earlsfort Terrace, Dublin, D02 T380, Irlanda"],
      ["Número de Conta/IBAN", "(verificar em: Conta → Extrato de Conta na plataforma IBKR)"],
    ].forEach(([k, v]) => ws11.addRow([k, v]));

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=IRS_${ano}_TradingJournal.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
