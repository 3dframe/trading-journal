import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";

// ── Constantes de cor ─────────────────────────────────────
const C = { green: "#10b981", red: "#f43f5e", blue: "#4f6af5", amber: "#f59e0b", muted: "var(--muted)" };

// ── Formatadores ──────────────────────────────────────────
const fmtE  = v => "€ " + Number(v || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtD  = v => v ? String(v).slice(0, 10) : "—";
const fmtMV = v => (v >= 0 ? "+" : "") + fmtE(v);
const clrMV = v => (v >= 0 ? C.green : C.red);

// ── Badge de código AT ────────────────────────────────────
function AtBadge({ code, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ background: "var(--accent)", color: "#fff", borderRadius: 4, padding: "1px 6px", fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}>
        {code}
      </span>
      {label && <span style={{ color: C.muted, fontSize: 12 }}>{label}</span>}
    </span>
  );
}

// ── Cabeçalho de quadro (imita AT) ───────────────────────
function QuadroHeader({ anexo, quadro, titulo, subtitulo }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 16px", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ background: "#1e3a8a", color: "#fff", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{anexo}</span>
        <span style={{ background: "var(--accent)", color: "#fff", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{quadro}</span>
        <span style={{ fontWeight: 700, color: "var(--text)", fontSize: 14 }}>{titulo}</span>
      </div>
      {subtitulo && <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{subtitulo}</div>}
    </div>
  );
}

// ── Linha de totais ───────────────────────────────────────
function TotalsBar({ items }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "12px 0" }}>
      {items.map(([label, value, color]) => (
        <div key={label} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 16px", minWidth: 140 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>{label}</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: color || "var(--text)" }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Tabela com sort ───────────────────────────────────────
function SortTable({ cols, rows, emptyMsg = "Sem dados para este quadro." }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState(1);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return sortDir * (av - bv);
      return sortDir * String(av ?? "").localeCompare(String(bv ?? ""), "pt");
    });
  }, [rows, sortKey, sortDir]);

  const onSort = key => {
    if (sortKey === key) setSortDir(d => -d);
    else { setSortKey(key); setSortDir(1); }
  };

  if (!rows.length) return <div className="empty">{emptyMsg}</div>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table" style={{ minWidth: "100%" }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c.key} onClick={() => c.sortable !== false && onSort(c.key)}
                style={{ cursor: c.sortable !== false ? "pointer" : "default", userSelect: "none",
                  textAlign: c.align || "left", whiteSpace: "nowrap",
                  paddingRight: c.sortable !== false ? 18 : undefined, position: "relative" }}>
                {c.label}
                {c.sortable !== false && (
                  <span style={{ position: "absolute", right: 4, opacity: sortKey === c.key ? 1 : 0.25 }}>
                    {sortKey === c.key ? (sortDir === 1 ? "↑" : "↓") : "↕"}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i}>
              {cols.map(c => (
                <td key={c.key} style={{ textAlign: c.align || "left", fontWeight: c.bold ? 700 : undefined, color: c.color?.(row) }}>
                  {c.render ? c.render(row) : (row[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Aviso de moeda ────────────────────────────────────────
function CurrencyWarning({ rows }) {
  const foreign = rows.filter(r => r.moeda_original && r.moeda_original !== "EUR" && !r.taxa_cambio);
  if (!foreign.length) return null;
  return (
    <div style={{ background: "#7c2d12", border: "1px solid #ea580c", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 12 }}>
      ⚠️ <strong>{foreign.length} operação(ões)</strong> em moeda estrangeira sem taxa de câmbio confirmada
      ({[...new Set(foreign.map(r => r.moeda_original))].join(", ")}).
      Verifica os valores convertidos antes de submeter ao AT.
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// TABS DE CONTEÚDO
// ══════════════════════════════════════════════════════════

// A) Anexo G Q9
function TabGQ9({ rows }) {
  const ganhos = rows.filter(r => r.mais_valia > 0).reduce((s, r) => s + r.mais_valia, 0);
  const perdas = rows.filter(r => r.mais_valia < 0).reduce((s, r) => s + r.mais_valia, 0);
  const saldo  = ganhos + perdas;

  return (
    <>
      <QuadroHeader
        anexo="Anexo G" quadro="Quadro 9"
        titulo="Alienação de Partes Sociais e Outros Valores Mobiliários — NACIONAIS"
        subtitulo="Ações com sede em Portugal (excl. EDPR) · Código G09"
      />
      <div style={{ background: "#1e3a8a22", border: "1px solid #3b82f6", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 12 }}>
        📋 <strong>Titular:</strong> selecionar no Portal AT — <code style={{ background: "var(--card)", padding: "1px 5px", borderRadius: 3 }}>A</code> = Sujeito Passivo &nbsp;|&nbsp; <code style={{ background: "var(--card)", padding: "1px 5px", borderRadius: 3 }}>B</code> = Cônjuge/Unido de Facto. Verificar e preencher manualmente no Portal das Finanças.
      </div>
      <TotalsBar items={[
        ["Mais-Valias (Ganhos)", fmtE(ganhos),  C.green],
        ["Menos-Valias (Perdas)", fmtE(Math.abs(perdas)), C.red],
        ["Saldo Líquido",        fmtMV(saldo),  clrMV(saldo)],
        ["Nº Operações",         rows.length,   C.blue],
      ]} />
      <SortTable
        rows={rows}
        cols={[
          { key: "_titular",        label: "Titular", sortable: false,
            render: () => (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ background: "#f59e0b", color: "#fff", borderRadius: 4, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>A/B</span>
                <span style={{ color: C.amber, fontSize: 10 }}>⚠ verificar</span>
              </span>
            )},
          { key: "simbolo",         label: "Cód. Ativo",             bold: true },
          { key: "pais_codigo",     label: "País (AT)", sortable: false,
            render: r => <AtBadge code={r.pais_codigo} label="Portugal" /> },
          { key: "data_abertura",   label: "Data Aquisição",
            render: r => fmtD(r.data_abertura) },
          { key: "valor_aquisicao", label: "Valor Aquisição €", align: "right",
            render: r => fmtE(r.valor_aquisicao) },
          { key: "data_fecho",      label: "Data Realização",
            render: r => fmtD(r.data_fecho) },
          { key: "valor_realizacao",label: "Valor Realização €", align: "right",
            render: r => fmtE(r.valor_realizacao) },
          { key: "despesas",        label: "Despesas €", align: "right",
            render: r => fmtE(r.despesas) },
          { key: "mais_valia",      label: "Mais-Valia €", align: "right",
            color: r => clrMV(r.mais_valia), bold: true,
            render: r => fmtMV(r.mais_valia) },
        ]}
      />
    </>
  );
}

// ── Aviso de auditoria de país (USD em país não-EUA = listagem cruzada confirmada) ──
function CountryAuditNote({ rows }) {
  // Operações em USD classificadas fora dos EUA: empresa europeia/internacional
  // corretamente identificada por ISIN ou exceção conhecida (ex: SAP → Alemanha 276)
  const crossListed = rows.filter(r => r.moeda_original === "USD" && r.pais_codigo !== "840");
  // Operações em USD classificadas como EUA sem taxa de câmbio confirmada: potencial erro
  const suspeitas   = rows.filter(r => r.moeda_original === "USD" && r.pais_codigo === "840" && !r.taxa_cambio);
  if (!crossListed.length && !suspeitas.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
      {crossListed.length > 0 && (
        <div style={{ background: "#052e1622", border: "1px solid #10b981", borderRadius: 8, padding: "9px 14px", fontSize: 12 }}>
          ✅ <strong>{crossListed.length} operação(ões)</strong> em USD identificadas como empresa não-americana (
          {[...new Set(crossListed.map(r => `${r.simbolo} → ${r.pais_codigo}`))].join(", ")}
          ) — classificação por ISIN ou tabela de exceções. Confirmar país no AT.
        </div>
      )}
      {suspeitas.length > 0 && (
        <div style={{ background: "#7c2d1222", border: "1px solid #ea580c", borderRadius: 8, padding: "9px 14px", fontSize: 12 }}>
          ⚠️ <strong>{suspeitas.length} operação(ões)</strong> em USD classificadas como EUA sem taxa de câmbio confirmada.
          Verificar se alguma é empresa europeia com listagem em bolsa americana (ADR).
          Símbolos: {[...new Set(suspeitas.map(r => r.simbolo))].join(", ")}.
        </div>
      )}
    </div>
  );
}

// B) Anexo J Q9.2A
function TabJQ92A({ rows }) {
  const ganhos = rows.filter(r => r.mais_valia > 0).reduce((s, r) => s + r.mais_valia, 0);
  const perdas = rows.filter(r => r.mais_valia < 0).reduce((s, r) => s + r.mais_valia, 0);
  const saldo  = ganhos + perdas;

  return (
    <>
      <QuadroHeader
        anexo="Anexo J" quadro="Quadro 9.2A"
        titulo="Mais-Valias de Ativos Estrangeiros (Ações, ETFs, EDPR)"
        subtitulo="Inclui todos os stocks não-PT e EDPR.PT · Cód. Ativo AT: G01 (Ações/ETFs)"
      />
      <CurrencyWarning rows={rows} />
      <CountryAuditNote rows={rows} />
      <TotalsBar items={[
        ["Mais-Valias (Ganhos)", fmtE(ganhos),  C.green],
        ["Menos-Valias (Perdas)", fmtE(Math.abs(perdas)), C.red],
        ["Saldo Líquido",        fmtMV(saldo),  clrMV(saldo)],
        ["Nº Operações",         rows.length,   C.blue],
      ]} />
      <SortTable
        rows={rows}
        cols={[
          { key: "pais_codigo",     label: "País (Cód. AT)", sortable: false,
            render: r => <AtBadge code={r.pais_codigo} label={r.pais} /> },
          { key: "_cod_ativo_at",   label: "Cód. Ativo (AT)", sortable: false,
            render: () => <AtBadge code="G01" label="Ações/ETFs" /> },
          { key: "simbolo",         label: "Ticker / Símbolo", bold: true },
          { key: "data_abertura",   label: "Data Aquisição",
            render: r => fmtD(r.data_abertura) },
          { key: "valor_aquisicao", label: "Valor Aquisição €", align: "right",
            render: r => fmtE(r.valor_aquisicao) },
          { key: "data_fecho",      label: "Data Realização",
            render: r => fmtD(r.data_fecho) },
          { key: "valor_realizacao",label: "Valor Realização €", align: "right",
            render: r => fmtE(r.valor_realizacao) },
          { key: "despesas",        label: "Despesas €", align: "right",
            render: r => fmtE(r.despesas) },
          { key: "mais_valia",      label: "Mais-Valia €", align: "right",
            color: r => clrMV(r.mais_valia), bold: true,
            render: r => fmtMV(r.mais_valia) },
          { key: "moeda_original",  label: "Moeda / Câmbio",
            render: r => r.moeda_original !== "EUR"
              ? <span style={{ color: r.taxa_cambio ? C.amber : C.red, fontSize: 11 }}>
                  {r.moeda_original}{r.taxa_cambio ? ` ×${r.taxa_cambio.toFixed(4)}` : " ⚠️"}
                </span>
              : <span style={{ color: C.muted, fontSize: 11 }}>EUR</span> },
          { key: "corretora",       label: "Corretora", sortable: false,
            render: r => <span style={{ fontSize: 11, color: r.corretora === "IBKR" ? C.blue : C.amber, fontWeight: 600 }}>{r.corretora}</span> },
        ]}
      />
    </>
  );
}

// C) Anexo J Q9.2B
function TabJQ92B({ data, ano }) {
  const { trades = [], por_pais = [] } = data || {};
  const totalGanhos = por_pais.reduce((s, r) => s + r.ganhos, 0);
  const totalPerdas = por_pais.reduce((s, r) => s + r.perdas, 0);
  const [detalhe, setDetalhe] = useState(false);

  return (
    <>
      <QuadroHeader
        anexo="Anexo J" quadro="Quadro 9.2B"
        titulo="Derivados: CFDs e Opções"
        subtitulo="Ganhos e perdas separados por país · Código G20 · A AT proíbe fundir ganhos e perdas globais"
      />
      <TotalsBar items={[
        ["Total Ganhos",  fmtE(totalGanhos),  C.green],
        ["Total Perdas",  fmtE(totalPerdas),  C.red],
        ["Nº Operações",  trades.length,       C.blue],
      ]} />

      {/* Tabela para inserir no Portal AT */}
      <div style={{ background: "#1e3a8a22", border: "1px solid #3b82f6", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 12 }}>
        📋 <strong>Para declarar no Portal das Finanças — Quadro 9.2B</strong> (um registo por país, ganhos e perdas em linhas separadas):
      </div>
      <SortTable
        rows={por_pais.map(r => ({ ...r, cod: "G20", ano }))}
        emptyMsg="Sem CFDs ou Opções para este ano."
        cols={[
          { key: "pais_codigo",  label: "País (Cód. AT)", sortable: false,
            render: r => <AtBadge code={r.pais_codigo} label={r.pais} /> },
          { key: "cod",          label: "Cód. Rendimento", bold: true },
          { key: "ano",          label: "Ano", sortable: false,
            render: r => <span style={{ fontWeight: 700, color: C.blue }}>{r.ano}</span> },
          { key: "ganhos",       label: "Rendimentos (Ganhos) €", align: "right",
            color: () => C.green, bold: true,
            render: r => fmtE(r.ganhos) },
          { key: "perdas",       label: "Perdas €", align: "right",
            color: () => C.red, bold: true,
            render: r => fmtE(r.perdas) },
        ]}
      />

      {/* Detalhe por operação */}
      <button className="btn" style={{ marginTop: 12, fontSize: 12 }} onClick={() => setDetalhe(d => !d)}>
        {detalhe ? "▲ Ocultar" : "▼ Ver"} detalhe por operação ({trades.length})
      </button>
      {detalhe && (
        <div style={{ marginTop: 10 }}>
          <SortTable
            rows={trades}
            cols={[
              { key: "simbolo",      label: "Símbolo", bold: true },
              { key: "categoria",    label: "Tipo" },
              { key: "pais_codigo",  label: "País", sortable: false,
                render: r => <AtBadge code={r.pais_codigo} label={r.pais} /> },
              { key: "data_fecho",   label: "Data Fecho", render: r => fmtD(r.data_fecho) },
              { key: "gross_pl",     label: "Gross P/L €", align: "right",
                render: r => fmtE(r.gross_pl) },
              { key: "swap",         label: "Swap €",     align: "right", render: r => fmtE(r.swap) },
              { key: "rollover",     label: "Rollover €", align: "right", render: r => fmtE(r.rollover) },
              { key: "fees",         label: "Comissão €", align: "right", render: r => fmtE(r.fees) },
              { key: "resultado_irs",label: "Resultado IRS €", align: "right", bold: true,
                color: r => clrMV(r.resultado_irs),
                render: r => fmtMV(r.resultado_irs) },
            ]}
          />
        </div>
      )}
    </>
  );
}

// D) Anexo J Q8
function TabJQ8({ data }) {
  const { linhas = [], por_pais = [] } = data || {};
  const divs  = por_pais.filter(r => r.tipo === "DIVIDEND");
  const juros = por_pais.filter(r => r.tipo === "INTEREST");
  const totalBruto    = linhas.reduce((s, r) => s + (r.valor_bruto_eur || 0), 0);
  const totalRetencao = linhas.reduce((s, r) => s + (r.retencao_eur    || 0), 0);
  const [detalhe, setDetalhe] = useState(false);

  const ResumoPorPais = ({ rows, titulo, cod }) => (
    <>
      <div style={{ fontWeight: 700, fontSize: 12, color: C.muted, margin: "12px 0 6px",
        textTransform: "uppercase", letterSpacing: 1 }}>{titulo}</div>
      <SortTable
        rows={rows}
        emptyMsg={`Sem ${titulo.toLowerCase()} para este ano.`}
        cols={[
          { key: "pais_codigo",  label: "País (Cód. AT)", sortable: false,
            render: r => <AtBadge code={r.pais_codigo} label={r.pais} /> },
          { key: "cod_rendimento", label: "Cód. Rendimento", bold: true },
          { key: "bruto_eur",    label: "Rendimento Bruto €", align: "right",
            color: () => C.green, render: r => fmtE(r.bruto_eur) },
          { key: "retencao_eur", label: "Imposto Retido €",  align: "right",
            color: () => C.red,  render: r => fmtE(r.retencao_eur) },
        ]}
      />
    </>
  );

  return (
    <>
      <QuadroHeader
        anexo="Anexo J" quadro="Quadro 8"
        titulo="Dividendos e Juros de Fonte Estrangeira"
        subtitulo="E21 = Dividendos · E20 = Juros · Agrupados por País da Fonte"
      />
      <TotalsBar items={[
        ["Total Bruto",    fmtE(totalBruto),    C.green],
        ["Total Retenção", fmtE(totalRetencao), C.red],
        ["Total Líquido",  fmtE(totalBruto - totalRetencao), C.blue],
        ["Nº Registos",    linhas.length,        C.muted],
      ]} />

      <div style={{ background: "#1e3a8a22", border: "1px solid #3b82f6", borderRadius: 8,
        padding: "10px 14px", marginBottom: 10, fontSize: 12 }}>
        📋 <strong>Para declarar no Portal das Finanças — Quadro 8</strong> (um registo por país + código):
      </div>

      <ResumoPorPais rows={divs}  titulo="Dividendos (E21)" cod="E21" />
      {juros.length > 0 && <ResumoPorPais rows={juros} titulo="Juros (E20)"     cod="E20" />}

      <button className="btn" style={{ marginTop: 16, fontSize: 12 }} onClick={() => setDetalhe(d => !d)}>
        {detalhe ? "▲ Ocultar" : "▼ Ver"} detalhe linha a linha ({linhas.length})
      </button>
      {detalhe && (
        <div style={{ marginTop: 10 }}>
          <SortTable
            rows={linhas}
            cols={[
              { key: "pais_codigo",     label: "País (AT)", sortable: false,
                render: r => <AtBadge code={r.pais_codigo} label={r.pais_fonte} /> },
              { key: "tipo",            label: "Tipo", render: r =>
                <span style={{ fontSize: 11, fontWeight: 700, color: r.tipo === "INTEREST" ? C.amber : C.blue }}>
                  {r.tipo === "INTEREST" ? "E20 Juros" : "E21 Div."}
                </span> },
              { key: "simbolo",         label: "Símbolo", bold: true },
              { key: "data_pagamento",  label: "Data", render: r => fmtD(r.data_pagamento) },
              { key: "valor_bruto_eur", label: "Bruto €",  align: "right",
                color: () => C.green, render: r => fmtE(r.valor_bruto_eur) },
              { key: "retencao_eur",    label: "Retenção €", align: "right",
                color: () => C.red,   render: r => r.retencao_eur > 0 ? `-${fmtE(r.retencao_eur)}` : "—" },
              { key: "valor_liq_eur",   label: "Líquido €", align: "right", bold: true,
                render: r => fmtE(r.valor_liq_eur) },
              { key: "moeda",           label: "Moeda", render: r =>
                <span style={{ fontSize: 11, color: C.muted }}>{r.moeda}</span> },
            ]}
          />
        </div>
      )}
    </>
  );
}

// E) Anexo J Q11
function TabJQ11({ data }) {
  if (!data) {
    return (
      <>
        <QuadroHeader anexo="Anexo J" quadro="Quadro 11"
          titulo="Contas no Estrangeiro" subtitulo="Sem dados IBKR importados" />
        <div className="empty">Nenhuma importação IBKR detectada. Importa um ficheiro IBKR para ver este quadro.</div>
      </>
    );
  }
  const Field = ({ label, value, highlight }) => (
    <div style={{ display: "flex", borderBottom: "1px solid var(--border)", padding: "10px 0" }}>
      <div style={{ width: 200, fontSize: 12, color: C.muted, flexShrink: 0 }}>{label}</div>
      <div style={{ fontWeight: highlight ? 700 : 400, color: highlight ? "var(--text)" : undefined }}>{value}</div>
    </div>
  );

  return (
    <>
      <QuadroHeader
        anexo="Anexo J" quadro="Quadro 11"
        titulo="Contas no Estrangeiro — IBKR"
        subtitulo="Obrigatório declarar se saldo > €50 000 em algum momento do ano"
      />
      <div style={{ background: "#7c2d1222", border: "1px solid #ea580c", borderRadius: 8,
        padding: "10px 14px", marginBottom: 16, fontSize: 12 }}>
        ⚠️ <strong>Atenção:</strong> A conta IBKR é obrigatoriamente declarada no Quadro 11 do Anexo J
        se o saldo máximo em qualquer momento do ano ultrapassar €50 000. Verifica o extrato anual IBKR.
      </div>
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 20px" }}>
        <Field label="País (Cód. AT)"   value={`${data.pais} — ${data.pais_nome} (código AT: ${data.pais_codigo})`} highlight />
        <Field label="Instituição"       value={data.instituicao} highlight />
        <Field label="Morada"            value={data.morada} />
        <Field label="Número de Conta"   value={data.nib} />
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════
export default function IRS() {
  const [anos,    setAnos]    = useState([]);
  const [ano,     setAno]     = useState(null);
  const [data,    setData]    = useState(null);
  const [tab,     setTab]     = useState(0);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    axios.get("/api/trades/anos").then(r => {
      setAnos(r.data);
      if (r.data.length) setAno(r.data[0]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!ano) return;
    setLoading(true);
    setError(null);
    axios.get(`/api/irs/summary?ano=${ano}`)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || "Erro ao carregar dados IRS."))
      .finally(() => setLoading(false));
  }, [ano]);

  const exportExcel = useCallback(() => {
    window.location.href = `/api/irs/export?ano=${ano}`;
  }, [ano]);

  // ── Totais para os cards de resumo ──
  const d = data || {};
  const mvGQ9    = (d.g_q9    || []).reduce((s, r) => s + r.mais_valia, 0);
  const mvJQ92A  = (d.j_q9_2a || []).reduce((s, r) => s + r.mais_valia, 0);
  const cfdsGan  = (d.j_q9_2b?.por_pais || []).reduce((s, r) => s + r.ganhos, 0);
  const cfdsPerd = (d.j_q9_2b?.por_pais || []).reduce((s, r) => s + r.perdas, 0);
  const divBruto = (d.j_q8?.por_pais || []).filter(r => r.tipo === "DIVIDEND").reduce((s, r) => s + r.bruto_eur, 0);
  const jurosBruto = (d.j_q8?.por_pais || []).filter(r => r.tipo === "INTEREST").reduce((s, r) => s + r.bruto_eur, 0);
  const totalMV  = mvGQ9 + mvJQ92A + (cfdsGan - cfdsPerd);

  const TABS = [
    { label: "Anexo G · Q9",      badge: "Ações PT" },
    { label: "Anexo J · Q9.2A",   badge: "Estrangeiro" },
    { label: "Anexo J · Q9.2B",   badge: "Derivados" },
    { label: "Anexo J · Q8",      badge: "Dividendos" },
    { label: "Anexo J · Q11",     badge: "Conta IBKR" },
  ];

  return (
    <>
      {/* ── Cabeçalho ── */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="page-title">Relatório IRS</div>
          <div className="page-sub">Quadros estruturados para o Portal das Finanças · AT Portugal</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select value={ano ?? ""} onChange={e => setAno(Number(e.target.value))}
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", color: "var(--text)" }}>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button className="btn btn-primary" onClick={exportExcel} disabled={!data}>
            📥 Exportar Excel IRS {ano}
          </button>
        </div>
      </div>

      {/* ── Cards de resumo ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginBottom: 16 }}>
        {[
          ["G · Q9\nAções Nacionais",       mvGQ9,    mvGQ9 >= 0 ? C.green : C.red,  fmtMV],
          ["J · Q9.2A\nAções Estrangeiras", mvJQ92A,  mvJQ92A >= 0 ? C.green : C.red, fmtMV],
          ["J · Q9.2B\nCFDs/Opções (G)",    cfdsGan,  C.green,  fmtE],
          ["J · Q9.2B\nCFDs/Opções (P)",    cfdsPerd, C.red,    fmtE],
          ["J · Q8\nDividendos (bruto)",     divBruto, C.blue,   fmtE],
          ["J · Q8\nJuros (bruto)",          jurosBruto, C.amber, fmtE],
        ].map(([label, value, color, fmt]) => (
          <div key={label} className="metric-card" style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: "0.65rem", color: C.muted, lineHeight: 1.3, whiteSpace: "pre-line", marginBottom: 6 }}>{label}</div>
            <div style={{ fontWeight: 700, fontSize: "1rem", color }}>{fmt(value)}</div>
          </div>
        ))}
      </div>

      {/* ── Total consolidado ── */}
      <div style={{ background: "var(--card)", border: `2px solid ${clrMV(totalMV)}`, borderRadius: 12,
        padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontWeight: 700, color: "var(--text)" }}>Saldo Total Mais/Menos-Valias {ano}</div>
          <div style={{ fontSize: 12, color: C.muted }}>G·Q9 + J·Q9.2A + J·Q9.2B (excl. dividendos e juros)</div>
        </div>
        <div style={{ fontSize: "1.6rem", fontWeight: 800, color: clrMV(totalMV) }}>{fmtMV(totalMV)}</div>
      </div>

      {error && (
        <div style={{ background: "#7c2d12", border: "1px solid #ea580c", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#fef2f2" }}>
          ❌ {error}
        </div>
      )}

      {loading ? <div className="spinner" /> : (
        <>
          {/* ── Tabs ── */}
          <div className="tabs" style={{ flexWrap: "wrap" }}>
            {TABS.map((t, i) => (
              <button key={i} className={`tab ${tab === i ? "active" : ""}`} onClick={() => setTab(i)}
                style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", padding: "8px 14px" }}>
                <span style={{ fontSize: 13 }}>{t.label}</span>
                <span style={{ fontSize: 10, opacity: 0.7, marginTop: 1 }}>{t.badge}</span>
              </button>
            ))}
          </div>

          {/* ── Conteúdo dos tabs ── */}
          <div style={{ paddingTop: 4 }}>
            {tab === 0 && <TabGQ9   rows={d.g_q9    || []} />}
            {tab === 1 && <TabJQ92A rows={d.j_q9_2a || []} />}
            {tab === 2 && <TabJQ92B data={d.j_q9_2b} ano={ano} />}
            {tab === 3 && <TabJQ8   data={d.j_q8} />}
            {tab === 4 && <TabJQ11  data={d.j_q11} />}
          </div>
        </>
      )}
    </>
  );
}
