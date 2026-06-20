import { useState, useEffect, useMemo } from "react";
import axios from "axios";

const fmt = v => (v >= 0 ? "+" : "") + "€ " + Math.abs(v).toLocaleString("de-DE", { minimumFractionDigits: 2 });
const fmtE = v => "€ " + Math.abs(v).toLocaleString("de-DE", { minimumFractionDigits: 2 });
const GREEN = "#10b981", RED = "#f43f5e", BLUE = "#4f6af5", MUTE = "#4e6080";
const TEAL = "#14b8a6", VIOLET = "#a78bfa", AMBER = "#f59e0b";

// Badge de resultado — cor distinta e intuitiva por tipo de movimento
function ResultBadge({ label, color }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 9px", borderRadius: 20,
      fontSize: "0.68rem", fontWeight: 700, whiteSpace: "nowrap",
      background: `${color}22`, color, border: `1px solid ${color}66`,
    }}>{label}</span>
  );
}

const fmtN  = (v, dec = 2) => v != null && v !== 0 ? Number(v).toFixed(dec) : "—";
const fmtEu = v => v != null && v !== 0 ? `€ ${Math.abs(Number(v)).toLocaleString("de-DE", { minimumFractionDigits: 2 })}` : "—";
const fmtDT = v => v ? String(v).slice(0, 19).replace("T", " ") : "—";
const parseMovs = d => { try { return JSON.parse(d.movimentos || "[]"); } catch { return []; } };

// ── Pré-filtros de período ──────────────────────────────────────
const PRESETS = [
  ["today", "Hoje"],
  ["week",  "Semana atual"],
  ["month", "Mês atual"],
  ["30d",   "Últimos 30 dias"],
  ["3m",    "Últimos 3 meses"],
  ["year",  "Ano atual"],
  ["all",   "Todos"],
];
const _pad = n => String(n).padStart(2, "0");
const _ymd = d => `${d.getFullYear()}-${_pad(d.getMonth() + 1)}-${_pad(d.getDate())}`;
function presetRange(preset) {
  const now = new Date();
  const today = _ymd(now);
  switch (preset) {
    case "today": return { from: today, to: today };
    case "week": {                       // semana começa à segunda-feira
      const d = new Date(now);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return { from: _ymd(d), to: today };
    }
    case "month": return { from: `${now.getFullYear()}-${_pad(now.getMonth() + 1)}-01`, to: today };
    case "30d": { const d = new Date(now); d.setDate(d.getDate() - 30); return { from: _ymd(d), to: today }; }
    case "3m":  { const d = new Date(now); d.setMonth(d.getMonth() - 3); return { from: _ymd(d), to: today }; }
    case "year": return { from: `${now.getFullYear()}-01-01`, to: today };
    case "all":  return { from: null, to: null };
    default:     return { from: null, to: null };
  }
}

// Colunas do registo (mantêm o alinhamento entre todas as linhas)
const LOG_COLS = "110px minmax(130px,1.6fr) 80px 92px 84px 78px 96px 112px 104px 22px";
const LOG_MINW = 960;

// Botão de pré-filtro — segue o estilo "Ver Movimentos" com animação
function PresetBtn({ active, onClick, children }) {
  const base   = active ? "rgba(96,165,250,0.18)" : "rgba(255,255,255,0.03)";
  const hover  = active ? "rgba(96,165,250,0.28)" : "rgba(255,255,255,0.07)";
  return (
    <button onClick={onClick} style={{
      padding: "6px 12px", borderRadius: 8, fontSize: "0.78rem", fontWeight: active ? 700 : 600,
      cursor: "pointer", whiteSpace: "nowrap",
      border: `1px solid ${active ? "rgba(96,165,250,0.45)" : "var(--border)"}`,
      background: base, color: active ? "#60a5fa" : MUTE,
      transition: "background .15s, transform .15s", fontFamily: "var(--font)",
    }}
      onMouseEnter={e => { e.currentTarget.style.background = hover; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = base;  e.currentTarget.style.transform = "translateY(0)"; }}
    >{children}</button>
  );
}

function Field({ label, value, color }) {
  return (
    <div>
      <div style={{ color: MUTE, textTransform: "uppercase", fontSize: 9.5, letterSpacing: ".07em", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ color: color || "var(--text)", fontWeight: color ? 700 : 400, fontSize: 12.5 }}>
        {value ?? "—"}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div style={{
        fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em",
        color: BLUE, borderBottom: `1px solid var(--border)`, paddingBottom: 4, marginBottom: 10,
      }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "10px 16px" }}>
        {children}
      </div>
    </div>
  );
}

function TradeDetail({ t }) {
  const hasPrices  = t.preco_abertura || t.preco_fecho;
  const hasRisk    = t.sl || t.tp || t.margin;
  const hasSwap    = t.swap || t.rollover || t.gross_pl;
  const hasComment = t.comment;

  return (
    <div style={{
      background: "var(--hover)", border: "1px solid var(--border)", borderTop: "none",
      borderRadius: "0 0 10px 10px", padding: "16px 20px", marginBottom: 6,
      display: "flex", flexDirection: "column", gap: 16, fontSize: 12,
    }}>
      {/* ── Identificação ── */}
      <Section title="Identificação">
        <Field label="Posição / Ref"   value={t.ref_externa} />
        <Field label="Símbolo"         value={t.simbolo} />
        <Field label="Instrumento"     value={t.nome_instrumento} />
        <Field label="Tipo de Ordem"   value={t.tipo_ordem} />
        <Field label="Categoria"       value={t.categoria} />
        <Field label="Corretora"       value={t.corretora} />
        <Field label="Conta"           value={t.conta} />
        <Field label="Titular Conta"   value={t.conta_nome} />
        <Field label="País"            value={t.pais} />
        <Field label="Moeda Original"  value={t.moeda_original} />
        {t.taxa_cambio && t.taxa_cambio !== 1 &&
          <Field label="Taxa Câmbio" value={`× ${Number(t.taxa_cambio).toFixed(4)}`} />}
        <Field label="Produto"         value={t.produto} />
        <Field label="Origem (Plataforma)" value={t.origem} />
      </Section>

      {/* ── Datas ── */}
      <Section title="Datas">
        <Field label="Data/Hora Abertura" value={fmtDT(t.data_abertura)} />
        <Field label="Data/Hora Fecho"    value={fmtDT(t.data_fecho)} />
      </Section>

      {/* ── Preços e Volume ── */}
      {(hasPrices || t.volume) && (
        <Section title="Preços e Volume">
          <Field label="Volume"         value={fmtN(t.volume, 4)} />
          {hasPrices && <Field label="Preço Abertura" value={fmtN(t.preco_abertura, 5)} />}
          {hasPrices && <Field label="Preço Fecho"    value={fmtN(t.preco_fecho, 5)} />}
        </Section>
      )}

      {/* ── Valores de Negociação ── */}
      <Section title="Valores de Negociação">
        <Field label="Purchase Value"  value={fmtEu(t.valor_compra_eur)} />
        <Field label="Sale Value"      value={fmtEu(t.valor_venda_eur)} />
        <Field label="Comissão"        value={fmtEu(t.fees)} />
        {hasSwap && <Field label="Swap"     value={fmtEu(t.swap)} />}
        {hasSwap && <Field label="Rollover" value={fmtEu(t.rollover)} />}
        {hasSwap && <Field label="Gross P/L" value={fmtEu(t.gross_pl)} />}
        {t.conversao_abertura && <Field label="Taxa Conv. Abertura" value={fmtN(t.conversao_abertura, 4)} />}
        {t.conversao_fecho    && <Field label="Taxa Conv. Fecho"    value={fmtN(t.conversao_fecho, 4)} />}
      </Section>

      {/* ── Risco (SL/TP/Margem) ── */}
      {hasRisk && (
        <Section title="Gestão de Risco">
          <Field label="Stop Loss (SL)"  value={fmtN(t.sl, 5)} />
          <Field label="Take Profit (TP)" value={fmtN(t.tp, 5)} />
          <Field label="Margem"          value={fmtEu(t.margin)} />
        </Section>
      )}

      {/* ── Resultado ── */}
      <Section title="Resultado">
        <Field label="Net P/L" value={fmt(t.pl_eur)} color={t.pl_eur >= 0 ? GREEN : RED} />
      </Section>

      {/* ── Comentário ── */}
      {hasComment && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em",
            color: BLUE, borderBottom: "1px solid var(--border)", paddingBottom: 4, marginBottom: 8 }}>
            Comentário
          </div>
          <div style={{ fontSize: 12, color: "var(--text)", fontStyle: "italic" }}>{t.comment}</div>
        </div>
      )}
    </div>
  );
}

// Calendário de intervalo (dias do mês vivos, dias do mês adjacente a cinzento)
const WEEKDAYS_PT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
function RangeCalendar({ from, to, onChange }) {
  const init = from ? new Date(from + "T00:00:00") : new Date();
  const [view, setView] = useState(new Date(init.getFullYear(), init.getMonth(), 1));
  const y = view.getFullYear(), m = view.getMonth();
  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7;       // segunda = 0
  const dim      = new Date(y, m + 1, 0).getDate();
  const prevDim  = new Date(y, m, 0).getDate();

  const cells = [];
  for (let i = firstDow - 1; i >= 0; i--) cells.push({ d: new Date(y, m - 1, prevDim - i), cur: false });
  for (let day = 1; day <= dim; day++)    cells.push({ d: new Date(y, m, day), cur: true });
  while (cells.length < 42) { const l = cells[cells.length - 1].d; cells.push({ d: new Date(l.getFullYear(), l.getMonth(), l.getDate() + 1), cur: false }); }

  const pick = ds => {
    if (!from || (from && to)) onChange(ds, "");           // inicia novo intervalo
    else if (ds < from)        onChange(ds, from);
    else                       onChange(from, ds);
  };

  const navStyle = {
    width: 28, height: 28, borderRadius: 8, cursor: "pointer",
    border: "1px solid rgba(96,165,250,0.35)", background: "rgba(96,165,250,0.12)",
    color: "#60a5fa", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background .15s, transform .15s",
  };
  const nav = dir => ({
    onClick: () => setView(new Date(y, m + dir, 1)),
    onMouseEnter: e => { e.currentTarget.style.background = "rgba(96,165,250,0.22)"; e.currentTarget.style.transform = "translateY(-1px)"; },
    onMouseLeave: e => { e.currentTarget.style.background = "rgba(96,165,250,0.12)"; e.currentTarget.style.transform = "translateY(0)"; },
    style: navStyle,
  });

  return (
    <div style={{
      position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 50,
      background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
      padding: 14, width: 280, boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button {...nav(-1)}>‹</button>
        <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text)", textTransform: "capitalize" }}>
          {view.toLocaleDateString("pt-PT", { month: "long", year: "numeric" })}
        </span>
        <button {...nav(1)}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 4 }}>
        {WEEKDAYS_PT.map(w => (
          <div key={w} style={{ textAlign: "center", fontSize: "0.6rem", fontWeight: 700, color: MUTE, textTransform: "uppercase" }}>{w}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
        {cells.map((c, i) => {
          const ds    = `${c.d.getFullYear()}-${_pad(c.d.getMonth() + 1)}-${_pad(c.d.getDate())}`;
          const isFrom = ds === from, isTo = ds === to;
          const isEnd  = isFrom || isTo;
          const inR    = from && to && ds > from && ds < to;
          return (
            <button key={i} onClick={() => pick(ds)}
              style={{
                height: 30, borderRadius: 7, cursor: "pointer", fontSize: "0.75rem",
                fontWeight: isEnd ? 800 : c.cur ? 600 : 400,
                border: "1px solid " + (isEnd ? "rgba(96,165,250,0.6)" : "transparent"),
                background: isEnd ? "rgba(96,165,250,0.30)" : inR ? "rgba(96,165,250,0.13)" : "transparent",
                color: isEnd ? "#bcd4ff" : c.cur ? "var(--text)" : MUTE,
                opacity: c.cur ? 1 : 0.45,
                transition: "background .12s",
              }}
              onMouseEnter={e => { if (!isEnd) e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
              onMouseLeave={e => { if (!isEnd) e.currentTarget.style.background = inR ? "rgba(96,165,250,0.13)" : "transparent"; }}
            >{c.d.getDate()}</button>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, fontSize: "0.7rem", color: MUTE }}>
        <span>{from ? from : "—"} {to ? `→ ${to}` : from ? "→ …" : ""}</span>
        <button onClick={() => onChange("", "")} style={{
          background: "none", border: "none", color: "#fb7185", cursor: "pointer", fontSize: "0.72rem", fontWeight: 600,
        }}>Limpar</button>
      </div>
    </div>
  );
}

export default function TradeLog() {
  const [allTrades, setAllTrades]   = useState([]);
  const [allDivs, setAllDivs]       = useState([]);
  const [allDeps, setAllDeps]       = useState([]);
  const [categoria, setCat]         = useState("");
  const [resultado, setRes]         = useState("");
  const [simbolo, setSim]           = useState("");
  const [corretora, setCor]         = useState("");
  const [preset, setPreset]         = useState("year");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo]     = useState("");
  const [showCal, setShowCal]       = useState(false);
  const [expanded, setExpanded]     = useState(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      axios.get("/api/trades"),
      axios.get("/api/dividends"),
      axios.get("/api/import/deposits"),
    ]).then(([tr, dv, dp]) => {
      setAllTrades(tr.data);
      setAllDivs(dv.data);
      setAllDeps(dp.data);
    }).finally(() => setLoading(false));
  }, []);

  // Intervalo de datas (preset ou personalizado)
  const range = preset === "custom"
    ? { from: customFrom || null, to: customTo || null }
    : presetRange(preset);

  const inRange = dateStr => {
    const d = (dateStr || "").slice(0, 10);
    if (!d) return false;
    if (range.from && d < range.from) return false;
    if (range.to   && d > range.to)   return false;
    return true;
  };

  // Categorias que NÃO são trades (dividendos/juros/movimentos)
  const TRADE_CATS = ["STOCK", "CFD", "OPTION"];

  const trades = useMemo(() => {
    if (categoria && !TRADE_CATS.includes(categoria)) return [];
    let data = allTrades.filter(t => inRange(t.data_fecho));
    if (categoria) data = data.filter(t => t.categoria === categoria);
    if (corretora) data = data.filter(t => t.corretora === corretora);
    if (simbolo)   data = data.filter(t => t.simbolo?.toLowerCase().includes(simbolo.toLowerCase()));
    if (resultado === "win")  data = data.filter(t => t.pl_eur > 0);
    if (resultado === "loss") data = data.filter(t => t.pl_eur < 0);
    return data;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTrades, categoria, corretora, simbolo, resultado, range.from, range.to]);

  const divs = useMemo(() => {
    if (resultado === "loss") return [];
    if (categoria && categoria !== "DIVIDENDO" && categoria !== "JUROS") return [];
    let data = allDivs.filter(d => inRange(d.data_pagamento));
    if (categoria === "DIVIDENDO") data = data.filter(d => d.tipo !== "INTEREST");
    if (categoria === "JUROS")     data = data.filter(d => d.tipo === "INTEREST");
    if (corretora) data = data.filter(d => (d.corretora ?? "IBKR") === corretora);
    if (simbolo)   data = data.filter(d => d.simbolo?.toLowerCase().includes(simbolo.toLowerCase()));
    return data;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDivs, categoria, corretora, simbolo, resultado, range.from, range.to]);

  const deps = useMemo(() => {
    if (resultado === "win" || resultado === "loss") return [];
    if (simbolo) return [];                                   // depósitos não têm símbolo
    if (categoria && categoria !== "MOVIMENTO") return [];
    let data = allDeps.filter(d => inRange(d.data));
    if (corretora) data = data.filter(d => d.corretora === corretora);
    return data;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDeps, categoria, corretora, simbolo, resultado, range.from, range.to]);

  // Merge e ordena por data descendente
  const rows = [
    ...trades.map(t => ({ ...t, _type: "trade", _date: t.data_fecho })),
    ...divs.map(d => ({ ...d, _type: "div",   _date: d.data_pagamento })),
    ...deps.map(d => ({ ...d, _type: "dep",   _date: d.data })),
  ].sort((a, b) => (b._date ?? "").localeCompare(a._date ?? ""));

  const tradeTotal = trades.reduce((s, t) => s + (t.pl_eur ?? 0), 0);
  const divTotal   = divs.reduce((s, d) => s + (d.valor_liq_eur ?? 0), 0);
  const total      = tradeTotal + divTotal;     // depósitos/levantamentos não entram no P&L

  return (
    <div style={{ height: "calc(100vh - 56px)", display: "flex", flexDirection: "column" }}>
      <div className="page-header" style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0,
      }}>
        <div>
          <div className="page-title">Registo de Operações</div>
          <div className="page-sub">
            {trades.length} trades
            {divs.length > 0 ? ` · ${divs.length} dividendos/juros` : ""}
            {deps.length > 0 ? ` · ${deps.length} movimentos` : ""}
          </div>
        </div>
        {!loading && rows.length > 0 && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: total >= 0 ? GREEN : RED }}>
              {fmt(total)}
            </div>
            <div style={{ fontSize: "0.7rem", color: MUTE, marginTop: 2 }}>
              P&L {divs.length > 0 ? "+ dividendos" : "filtrado"}
            </div>
          </div>
        )}
      </div>

      {/* ── Zona fixa de filtros ── */}
      <div style={{ flexShrink: 0 }}>
      {/* ── Pré-filtros de período ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center" }}>
        {PRESETS.map(([k, label]) => (
          <PresetBtn key={k} active={preset === k} onClick={() => { setPreset(k); setShowCal(false); }}>
            {label}
          </PresetBtn>
        ))}
        <span style={{ position: "relative" }}>
          <PresetBtn active={preset === "custom"} onClick={() => { setPreset("custom"); setShowCal(s => !s); }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {preset === "custom" && customFrom ? `${customFrom}${customTo ? ` → ${customTo}` : " → …"}` : "Período…"}
            </span>
          </PresetBtn>
          {showCal && (
            <RangeCalendar
              from={customFrom} to={customTo}
              onChange={(f, t) => { setCustomFrom(f); setCustomTo(t); setPreset("custom"); }}
            />
          )}
        </span>
      </div>

      <div className="filter-bar">
        <select value={categoria} onChange={e => setCat(e.target.value)}>
          <option value="">Todas as categorias</option>
          <option value="STOCK">STOCK</option>
          <option value="CFD">CFD</option>
          <option value="OPTION">OPTION</option>
          <option value="DIVIDENDO">DIVIDENDOS</option>
          <option value="JUROS">JUROS</option>
          <option value="MOVIMENTO">DEPÓSITOS / LEVANTAMENTOS</option>
        </select>
        <select value={resultado} onChange={e => setRes(e.target.value)}>
          <option value="">Todos os resultados</option>
          <option value="win">Ganhos</option>
          <option value="loss">Perdas</option>
        </select>
        <select value={corretora} onChange={e => setCor(e.target.value)}>
          <option value="">Todas as corretoras</option>
          <option value="XTB">XTB</option>
          <option value="IBKR">IBKR</option>
        </select>
        <div style={{ position: "relative", marginLeft: "auto", width: 180 }}>
          <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", opacity: 0.45 }}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            placeholder="Símbolo..."
            value={simbolo}
            onChange={e => setSim(e.target.value)}
            style={{
              width: "100%", boxSizing: "border-box",
              paddingLeft: 32, paddingRight: simbolo ? 28 : 10,
              paddingTop: 7, paddingBottom: 7,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              color: "var(--text)", fontSize: "0.83rem",
              outline: "none", fontFamily: "var(--font)",
              transition: "border-color .15s",
            }}
            onFocus={e => e.target.style.borderColor = "rgba(79,106,245,0.6)"}
            onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
          />
          {simbolo && (
            <button onClick={() => setSim("")}
              style={{
                position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", padding: 0,
                color: MUTE, fontSize: 14, lineHeight: 1, display: "flex", alignItems: "center",
              }}>✕</button>
          )}
        </div>
      </div>
      </div>{/* fim da zona fixa de filtros */}

      {/* ── Zona com scroll (informação) ── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
      {loading ? <div className="spinner" /> : rows.length === 0 ? (
        <div className="empty">Nenhuma operação corresponde aos filtros aplicados.</div>
      ) : (
      <div style={{ overflowX: "auto" }}>
       <div style={{ minWidth: LOG_MINW }}>
        {rows.map(row => {
        if (row._type === "trade") {
          const t = row;
          const key = `t-${t.id}`;
          const win = (t.pl_eur ?? 0) >= 0;
          return (
            <div key={key}>
              <div className="log-row" style={{ gridTemplateColumns: LOG_COLS }} onClick={() => setExpanded(expanded === key ? null : key)}>
                <span className="log-cell" style={{ fontFamily: "monospace", fontSize: 11, color: MUTE }} title={t.ref_externa}>{t.ref_externa || "—"}</span>
                <span className="log-cell" style={{ color: "var(--text)" }} title={t.nome_instrumento}>{t.nome_instrumento || "—"}</span>
                <span className="log-cell" style={{ fontWeight: 700, color: "var(--text)" }}>{t.simbolo}</span>
                <span><ResultBadge label={win ? "Ganho" : "Perda"} color={win ? GREEN : RED} /></span>
                <span className="log-cell" style={{ color: t.categoria === "CFD" ? RED : MUTE, fontWeight: t.categoria === "CFD" ? 700 : 400 }}>{t.categoria}</span>
                <span className="log-cell" style={{ color: MUTE }}>{t.corretora}</span>
                <span className="log-cell" style={{ color: MUTE }}>{t.pais || "—"}</span>
                <span className="log-cell" style={{ textAlign: "right", fontWeight: 700, color: win ? GREEN : RED }}>{fmt(t.pl_eur)}</span>
                <span className="log-cell" style={{ color: MUTE, fontSize: "0.75rem" }}>{t.data_fecho?.slice(0, 10)}</span>
                <span style={{ color: MUTE, textAlign: "center" }}>{expanded === key ? "▲" : "▼"}</span>
              </div>
              {expanded === key && (
                <TradeDetail t={t} />
              )}
            </div>
          );
        }

        if (row._type === "dep") {
          const d = row;
          const key = `p-${d.id}`;
          const isDep = d.tipo === "deposito";
          const val = isDep ? d.valor : -d.valor;
          return (
            <div key={key}>
              <div className="log-row" style={{ gridTemplateColumns: LOG_COLS }} onClick={() => setExpanded(expanded === key ? null : key)}>
                <span className="log-cell" style={{ fontFamily: "monospace", fontSize: 11, color: MUTE }} title={d.ref_externa}>{d.ref_externa || "—"}</span>
                <span className="log-cell" style={{ color: "var(--text)" }} title={d.descricao}>{d.descricao || d.nome_instrumento || "—"}</span>
                <span className="log-cell" style={{ color: MUTE }}>—</span>
                <span><ResultBadge label={isDep ? "Depósito" : "Levantamento"} color={isDep ? VIOLET : AMBER} /></span>
                <span className="log-cell" style={{ color: MUTE }}>Movimento</span>
                <span className="log-cell" style={{ color: MUTE }}>{d.corretora}</span>
                <span className="log-cell" style={{ color: MUTE }}>—</span>
                <span className="log-cell" style={{ textAlign: "right", fontWeight: 700, color: isDep ? GREEN : RED }}>{fmt(val)}</span>
                <span className="log-cell" style={{ color: MUTE, fontSize: "0.75rem" }}>{d.data?.slice(0, 10)}</span>
                <span style={{ color: MUTE, textAlign: "center" }}>{expanded === key ? "▲" : "▼"}</span>
              </div>
              {expanded === key && (
                <div style={{ background:"var(--hover)", border:"1px solid var(--border)", borderTop:"none",
                              borderRadius:"0 0 8px 8px", padding:"14px 20px", marginBottom:6,
                              display:"grid", gridTemplateColumns:"repeat(4, minmax(0, 1fr))", gap:"10px 20px", fontSize:12 }}>
                  {[
                    ["Data",          d.data?.slice(0, 10)],
                    ["Tipo",          isDep ? "Depósito" : "Levantamento"],
                    ["Valor",         fmtE(d.valor)],
                    ["Corretora",     d.corretora],
                    ["Conta",         d.conta],
                    ["Titular Conta", d.conta_nome],
                    ["ID Operação",   d.ref_externa],
                    ["Descrição",     d.descricao],
                  ].map(([k, v]) => (
                    <div key={k} style={{ minWidth: 0 }}>
                      <div style={{ color: MUTE, textTransform:"uppercase", fontSize:10, letterSpacing:".06em" }}>{k}</div>
                      <div style={{ color: "var(--text)", marginTop:2, wordBreak: "break-word" }}>{v ?? "—"}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }

        // Dividendo / Juros
        const d = row;
        const key = `d-${d.simbolo}-${d.data_pagamento}`;
        const isInt = d.tipo === "INTEREST";
        return (
          <div key={key}>
            <div className="log-row" style={{ gridTemplateColumns: LOG_COLS }} onClick={() => setExpanded(expanded === key ? null : key)}>
              <span className="log-cell" style={{ fontFamily: "monospace", fontSize: 11, color: MUTE }} title={d.ref_externa}>{d.ref_externa || "—"}</span>
              <span className="log-cell" style={{ color: "var(--text)" }} title={d.nome_instrumento}>{d.nome_instrumento || "—"}</span>
              <span className="log-cell" style={{ fontWeight: 700, color: "var(--text)" }}>{d.simbolo}</span>
              <span><ResultBadge label={isInt ? "Juros" : "Dividendo"} color={isInt ? TEAL : BLUE} /></span>
              <span className="log-cell" style={{ color: MUTE }}>{isInt ? "JUROS" : "DIVIDENDO"}</span>
              <span className="log-cell" style={{ color: MUTE }}>{d.corretora}</span>
              <span className="log-cell" style={{ color: MUTE }}>{d.pais_fonte || "—"}</span>
              <span className="log-cell" style={{ textAlign: "right", fontWeight: 700, color: GREEN }}>{fmt(d.valor_liq_eur ?? 0)}</span>
              <span className="log-cell" style={{ color: MUTE, fontSize: "0.75rem" }}>{d.data_pagamento?.slice(0, 10)}</span>
              <span style={{ color: MUTE, textAlign: "center" }}>{expanded === key ? "▲" : "▼"}</span>
            </div>
            {expanded === key && (
              <div style={{ background:"var(--hover)", border:"1px solid var(--border)", borderTop:"none",
                            borderRadius:"0 0 8px 8px", padding:"14px 20px", marginBottom:6,
                            display:"grid", gridTemplateColumns:"repeat(4, minmax(0, 1fr))", gap:"10px 20px",
                            fontSize:12 }}>
                {[
                  ["Data Pagamento",  d.data_pagamento?.slice(0, 10)],
                  ["País Fonte",      d.pais_fonte],
                  ["Moeda",           d.moeda],
                  ["Valor Bruto",     d.valor_bruto_eur != null ? fmtE(d.valor_bruto_eur) : "—"],
                  ["Retenção",        d.retencao_eur    != null ? `-${fmtE(d.retencao_eur)}` : "—"],
                  ["Valor Líquido",   d.valor_liq_eur   != null ? fmtE(d.valor_liq_eur)   : "—"],
                  ["Conta",           d.conta],
                  ["Titular Conta",   d.conta_nome],
                  ["Instrumento",     d.nome_instrumento],
                ].map(([k, v]) => (
                  <div key={k} style={{ minWidth: 0 }}>
                    <div style={{ color: MUTE, textTransform:"uppercase", fontSize:10, letterSpacing:".06em" }}>{k}</div>
                    <div style={{ color: "var(--text)", marginTop:2 }}>{v ?? "—"}</div>
                  </div>
                ))}
              </div>
            )}
            {expanded === key && (() => {
              const movs = parseMovs(d);
              if (!movs.length) return null;
              return (
                <div style={{ background:"var(--hover)", border:"1px solid var(--border)", borderTop:"none",
                              borderRadius:"0 0 8px 8px", padding:"0 20px 14px", marginTop:-6, marginBottom:6 }}>
                  <div style={{ color: MUTE, textTransform:"uppercase", fontSize:10, letterSpacing:".06em", marginBottom:8 }}>
                    Registo de Operações ({movs.length})
                  </div>
                  <table className="data-table">
                    <thead><tr>
                      <th>ID</th><th>Tipo</th><th>Data/Hora</th><th style={{ textAlign:"right" }}>Valor €</th>
                    </tr></thead>
                    <tbody>
                      {movs.map((m, i) => (
                        <tr key={i}>
                          <td style={{ fontFamily:"monospace", fontSize:11 }}>{m.id ?? "—"}</td>
                          <td>{m.tipo}</td>
                          <td style={{ fontSize:11 }}>{m.data ?? "—"}</td>
                          <td style={{ textAlign:"right", fontWeight:600, color: m.valor >= 0 ? "#10b981" : "#f43f5e" }}>
                            {fmtEu(m.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        );
        })}
       </div>
      </div>
      )}
      </div>{/* fim da zona com scroll */}
    </div>
  );
}
