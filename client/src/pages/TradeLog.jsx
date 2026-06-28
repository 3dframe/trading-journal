import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import Modal from "../components/Modal.jsx";
import TradeDetail from "../components/TradeDetail.jsx";
import CryptoDetail from "../components/CryptoDetail.jsx";

const DEC = { minimumFractionDigits: 2, maximumFractionDigits: 2 };  // sempre 2 casas decimais
const fmt = v => (v >= 0 ? "+" : "") + "€ " + Math.abs(v).toLocaleString("de-DE", DEC);
const fmtE = v => "€ " + Math.abs(v).toLocaleString("de-DE", DEC);
const GREEN = "#10b981", RED = "#f43f5e", BLUE = "#4f6af5", MUTE = "#4e6080";
const LGRAY = "#9ca3af";  // cinza claro (títulos, valores originais, país, data)
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

const fmtEu = v => v != null && v !== 0 ? `€ ${Math.abs(Number(v)).toLocaleString("de-DE", DEC)}` : "—";

// Valores na moeda original do ativo (igual à corretora), com sinal e 2 casas decimais.
const CUR_SYMBOL = { USD:"US$ ", EUR:"€ ", GBP:"£ ", CHF:"CHF ", CAD:"C$ ", JPY:"¥ ", AUD:"A$ " };
const curSym = m => CUR_SYMBOL[m] || (m ? m+" " : "");
const isEur  = m => !m || m === "EUR";
const fmtEsign = v => v == null ? "—" : (v<0?"-":"")+"€ "+Math.abs(Number(v)).toLocaleString("de-DE", DEC);
const fmtNatSign = (v, m) => v == null ? "—" : (v<0?"-":"")+curSym(m)+Math.abs(Number(v)).toLocaleString("de-DE", DEC);
// Valor original (moeda da corretora) reconstruído a partir da taxa de câmbio guardada.
const toOrig = (eur, t) => (eur == null || !t.taxa_cambio || t.taxa_cambio === 1) ? eur : eur / t.taxa_cambio;
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
// Colunas: Empresa(+ticker) · Corretora(+conta) · País · Categoria · Valor · Swap · Resultado · Data · seta
// Colunas: Data · Empresa(+ticker) · Corretora(+conta) · País · Categoria · Valor · Swap · Resultado · seta
const LOG_COLS = "0.95fr 1.7fr 1.1fr 0.8fr 1fr 1.2fr 1.1fr 0.95fr 24px";
const LOG_MINW = 1090;

// Descrição curta para a coluna Empresa (a descrição completa fica no modal).
const shortDesc = (txt) => {
  const s = (txt || "").toLowerCase();
  if (s.includes("ewallet"))  return "eWallet";
  if (s.includes("paypal"))   return "PayPal";
  return txt || "—";
};

// Célula de valor: original (moeda da corretora, cinza e a negrito) por cima e convertido
// (€, a negrito, verde/vermelho) por baixo. Trades em EUR mostram só o € a negrito.
function ColOC({ eur, t, win }) {
  if (eur == null) return <span className="log-cell" style={{ textAlign: "right", color: MUTE }}>—</span>;
  const cor = win == null ? (eur >= 0 ? GREEN : RED) : (win ? GREEN : RED);
  if (isEur(t?.moeda_original) || !t?.taxa_cambio || t.taxa_cambio === 1) {
    return <span className="log-cell" style={{ textAlign: "right", fontWeight: 700, color: cor }}>{fmtEsign(eur)}</span>;
  }
  return (
    <span className="log-cell" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.22, minWidth: 0 }}>
      <span style={{ fontWeight: 700, color: cor, whiteSpace: "nowrap" }}>{fmtEsign(eur)}</span>
      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: LGRAY, whiteSpace: "nowrap" }}>{fmtNatSign(toOrig(eur, t), t.moeda_original)}</span>
    </span>
  );
}

// Célula "Corretora + conta" (substitui o ID, que fica feio quando agrega vários).
function ColBroker({ corretora, conta }) {
  return (
    <span className="log-cell" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", lineHeight: 1.25, minWidth: 0 }}>
      <span style={{ color: "var(--text)", fontWeight: 600, whiteSpace: "nowrap" }}>{corretora || "—"}</span>
      <span style={{ fontSize: "0.66rem", color: LGRAY, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{conta || "—"}</span>
    </span>
  );
}

// Botão de pré-filtro — segue o estilo "Ver Movimentos" com animação
function PresetBtn({ active, onClick, children, disabled }) {
  const base   = active ? "rgba(96,165,250,0.18)" : "rgba(255,255,255,0.03)";
  const hover  = active ? "rgba(96,165,250,0.28)" : "rgba(255,255,255,0.07)";
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "6px 12px", borderRadius: 8, fontSize: "0.78rem", fontWeight: active ? 700 : 600,
      cursor: disabled ? "not-allowed" : "pointer", whiteSpace: "nowrap",
      border: `1px solid ${active ? "rgba(96,165,250,0.45)" : "var(--border)"}`,
      background: base, color: active ? "#60a5fa" : MUTE, opacity: disabled ? 0.4 : 1,
      transition: "background .15s, transform .15s", fontFamily: "var(--font)",
    }}
      onMouseEnter={e => { if (disabled) return; e.currentTarget.style.background = hover; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { if (disabled) return; e.currentTarget.style.background = base;  e.currentTarget.style.transform = "translateY(0)"; }}
    >{children}</button>
  );
}

// Calendário de intervalo (dias do mês vivos, dias do mês adjacente a cinzento)
const WEEKDAYS_PT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTHS_PT   = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
function RangeCalendar({ from, to, onChange }) {
  const init = from ? new Date(from + "T00:00:00") : new Date();
  const [view, setView] = useState(new Date(init.getFullYear(), init.getMonth(), 1));
  const [mode, setMode] = useState("days");          // "days" | "months" | "years"
  const y = view.getFullYear(), m = view.getMonth();
  const yearBlock = Math.floor(y / 12) * 12;          // bloco de 12 anos para a grelha de anos
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
  const navStep = dir => {
    if (mode === "months")     setView(new Date(y + dir, m, 1));        // ±1 ano
    else if (mode === "years") setView(new Date(y + dir * 12, m, 1));  // ±1 bloco de 12 anos
    else                       setView(new Date(y, m + dir, 1));        // ±1 mês
  };
  const nav = dir => ({
    onClick: () => navStep(dir),
    onMouseEnter: e => { e.currentTarget.style.background = "rgba(96,165,250,0.22)"; e.currentTarget.style.transform = "translateY(-1px)"; },
    onMouseLeave: e => { e.currentTarget.style.background = "rgba(96,165,250,0.12)"; e.currentTarget.style.transform = "translateY(0)"; },
    style: navStyle,
  });

  // Título central clicável: dias → meses → anos
  const titleLabel = mode === "days"
    ? view.toLocaleDateString("pt-PT", { month: "long", year: "numeric" })
    : mode === "months"
      ? String(y)
      : `${yearBlock} – ${yearBlock + 11}`;
  const titleBtn = {
    fontWeight: 700, fontSize: "0.85rem", color: "var(--text)", textTransform: "capitalize",
    background: "none", border: "none", cursor: mode === "years" ? "default" : "pointer",
    padding: "4px 8px", borderRadius: 7, fontFamily: "var(--font)", transition: "background .15s",
  };
  const onTitleClick = () => setMode(mode === "days" ? "months" : mode === "months" ? "years" : "years");

  // Célula reutilizável para grelhas de mês/ano
  const cellBtn = (active) => ({
    height: 40, borderRadius: 8, cursor: "pointer", fontSize: "0.8rem",
    fontWeight: active ? 800 : 600,
    border: "1px solid " + (active ? "rgba(96,165,250,0.6)" : "transparent"),
    background: active ? "rgba(96,165,250,0.30)" : "transparent",
    color: active ? "#bcd4ff" : "var(--text)", transition: "background .12s",
  });

  return (
    <div style={{
      position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 50,
      background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
      padding: 14, width: 280, boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button {...nav(-1)}>‹</button>
        <button onClick={onTitleClick} style={titleBtn}
          onMouseEnter={e => { if (mode !== "years") e.currentTarget.style.background = "rgba(96,165,250,0.12)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
        >{titleLabel}</button>
        <button {...nav(1)}>›</button>
      </div>
      {mode === "days" && (<>
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
      </>)}

      {mode === "months" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {MONTHS_PT.map((label, i) => {
            const active = i === m;
            const st = cellBtn(active);
            return (
              <button key={label} onClick={() => { setView(new Date(y, i, 1)); setMode("days"); }} style={st}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >{label}</button>
            );
          })}
        </div>
      )}

      {mode === "years" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {Array.from({ length: 12 }, (_, i) => yearBlock + i).map(yr => {
            const active = yr === y;
            const st = cellBtn(active);
            return (
              <button key={yr} onClick={() => { setView(new Date(yr, m, 1)); setMode("months"); }} style={st}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >{yr}</button>
            );
          })}
        </div>
      )}
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
  const [allHoldings, setAllHoldings] = useState([]);
  const [categoria, setCat]         = useState("");
  const [resultado, setRes]         = useState("");
  const [simbolo, setSim]           = useState("");
  const [corretora, setCor]         = useState("");
  const [preset, setPreset]         = useState("year");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo]     = useState("");
  const [showCal, setShowCal]       = useState(false);
  const [modalRow, setModalRow]     = useState(null); // operação aberta em modal
  const [selectedKey, setSelKey]    = useState(null); // linha clicada (fica delineada ao voltar)
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      axios.get("/api/trades"),
      axios.get("/api/dividends"),
      axios.get("/api/import/deposits"),
      axios.get("/api/trades/holdings"),
    ]).then(([tr, dv, dp, hd]) => {
      setAllTrades(tr.data);
      setAllDivs(dv.data);
      setAllDeps(dp.data);
      setAllHoldings(hd.data);
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
    if (simbolo) {
      const q = simbolo.toLowerCase();
      data = data.filter(t =>
        t.simbolo?.toLowerCase().includes(q) ||
        String(t.ref_externa ?? "").toLowerCase().includes(q) ||
        t.isin?.toLowerCase().includes(q) ||
        t.nome_instrumento?.toLowerCase().includes(q)
      );
    }
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
    if (simbolo) {
      const q = simbolo.toLowerCase();
      data = data.filter(d =>
        d.simbolo?.toLowerCase().includes(q) ||
        String(d.ref_externa ?? "").toLowerCase().includes(q) ||
        d.isin?.toLowerCase().includes(q) ||
        d.nome_instrumento?.toLowerCase().includes(q)
      );
    }
    return data;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDivs, categoria, corretora, simbolo, resultado, range.from, range.to]);

  const deps = useMemo(() => {
    if (resultado === "win" || resultado === "loss") return [];
    if (categoria && categoria !== "MOVIMENTO") return [];
    let data = allDeps.filter(d => inRange(d.data));
    if (corretora) data = data.filter(d => d.corretora === corretora);
    if (simbolo) {                                            // depósitos não têm símbolo → procura por ID/descrição
      const q = simbolo.toLowerCase();
      data = data.filter(d =>
        String(d.ref_externa ?? "").toLowerCase().includes(q) ||
        d.descricao?.toLowerCase().includes(q)
      );
    }
    return data;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDeps, categoria, corretora, simbolo, resultado, range.from, range.to]);

  // Posições de criptomoeda (holdings) — uma linha por ativo. São posições atuais (sem data
  // de operação), por isso ignoram o filtro de período e de resultado (P/L não realizado).
  const cryptoRows = useMemo(() => {
    if (categoria && categoria !== "CRYPTO") return [];
    if (resultado) return [];
    let data = allHoldings.filter(h => h.categoria === "CRYPTO");
    if (corretora) data = data.filter(h => h.corretora === corretora);
    if (simbolo) {
      const q = simbolo.toLowerCase();
      data = data.filter(h => h.simbolo?.toLowerCase().includes(q) || h.nome?.toLowerCase().includes(q));
    }
    return data;
  }, [allHoldings, categoria, corretora, simbolo, resultado]);

  // Merge e ordena por data descendente
  const rows = [
    ...trades.map(t => ({ ...t, _type: "trade",  _date: t.data_fecho })),
    ...divs.map(d => ({ ...d, _type: "div",    _date: d.data_pagamento })),
    ...deps.map(d => ({ ...d, _type: "dep",    _date: d.data })),
    ...cryptoRows.map(h => ({ ...h, _type: "crypto", _date: h.atualizado_em })),
  ].sort((a, b) => (b._date ?? "").localeCompare(a._date ?? ""));

  const tradeTotal = trades.reduce((s, t) => s + (t.pl_eur ?? 0), 0);
  const divTotal   = divs.reduce((s, d) => s + (d.valor_liq_eur ?? 0), 0);
  const total      = tradeTotal + divTotal;     // depósitos/levantamentos não entram no P&L

  // Efeito do câmbio (B): diferença entre o valor convertido em € e o valor bruto (moeda
  // original) das operações em moeda ≠ EUR. Positivo = o € ficou acima do valor bruto.
  const fxTrades = trades.filter(t => t.taxa_cambio && t.taxa_cambio !== 1);
  const fxEur    = fxTrades.reduce((s, t) => s + (t.pl_eur ?? 0), 0);
  const fxRaw    = fxTrades.reduce((s, t) => s + (t.pl_eur ?? 0) / t.taxa_cambio, 0);
  const fxDelta  = fxEur - fxRaw;
  const fxPct    = fxRaw ? (fxDelta / Math.abs(fxRaw)) * 100 : 0;

  // Limpa a seleção quando os filtros mudam.
  useEffect(() => { setModalRow(null); setSelKey(null); }, [categoria, resultado, simbolo, corretora, preset, customFrom, customTo]);

  // Sem paginação: a lista mostra todas as linhas (página livre até ao fim).
  const pagedRows = rows;

  // Chave única por linha (para abrir o modal e delinear a linha clicada ao voltar).
  const keyOf = row => row._type === "trade" ? `t-${row.id}`
    : row._type === "dep" ? `p-${row.id}`
    : row._type === "crypto" ? `c-${row.simbolo}`
    : `d-${row.simbolo}-${row.data_pagamento}`;
  const openRow  = row => { setSelKey(keyOf(row)); setModalRow(row); };
  const closeRow = () => {
    const k = selectedKey;
    setModalRow(null);
    requestAnimationFrame(() => {
      const el = k && document.querySelector(`[data-row-key="${(window.CSS?.escape ? CSS.escape(k) : k)}"]`);
      if (el) el.scrollIntoView({ block: "center" });
    });
  };

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
            {cryptoRows.length > 0 ? ` · ${cryptoRows.length} cripto` : ""}
          </div>
        </div>
        {!loading && rows.length > 0 && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: total >= 0 ? GREEN : RED }}>
              {fmt(total)}
            </div>
            {fxTrades.length > 0 && (
              <div style={{ fontSize: "0.68rem", marginTop: 2 }}>
                <span style={{ color: MUTE }}>efeito do câmbio </span>
                <span style={{ color: fxDelta >= 0 ? GREEN : RED, fontWeight: 700 }}>
                  ({fmt(fxDelta)} · {(fxPct >= 0 ? "+" : "") + fxPct.toFixed(2)}%)
                </span>
              </div>
            )}
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
          <option value="CRYPTO">CRIPTO</option>
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
          <option value="Bybit">Bybit</option>
        </select>
        <div style={{ position: "relative", marginLeft: "auto", width: 180 }}>
          <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", opacity: 0.45 }}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            placeholder="Símbolo, ISIN, ID..."
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
        {/* Cabeçalho de colunas */}
        <div className="log-head" style={{ gridTemplateColumns: LOG_COLS, color: LGRAY }}>
          <span className="log-cell" style={{ textAlign: "center" }}>Data</span>
          <span className="log-cell">Empresa</span>
          <span className="log-cell" style={{ textAlign: "center" }}>Corretora</span>
          <span className="log-cell" style={{ textAlign: "center" }}>País</span>
          <span className="log-cell" style={{ textAlign: "center" }}>Categoria</span>
          <span className="log-cell" style={{ textAlign: "right" }}>Valor</span>
          <span className="log-cell" style={{ textAlign: "right" }}>Swap</span>
          <span className="log-cell" style={{ textAlign: "center" }}>Resultado</span>
          <span />
        </div>
        {pagedRows.map(row => {
        if (row._type === "trade") {
          const t = row;
          const key = `t-${t.id}`;
          const win = (t.pl_eur ?? 0) >= 0;
          return (
            <div key={key}>
              <div className="log-row" data-row-key={key} style={{ gridTemplateColumns: LOG_COLS, outline: selectedKey === key ? "2px solid var(--accent)" : "none", outlineOffset: -2 }} onClick={() => openRow(row)}>
                {/* Data */}
                <span className="log-cell" style={{ color: LGRAY, fontSize: "0.75rem", textAlign: "center" }}>{t.data_fecho?.slice(0, 10)}</span>
                {/* TICKER + nome */}
                <span className="log-cell" style={{ display: "flex", flexDirection: "column", lineHeight: 1.25, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, color: "#fbbf24", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.simbolo || "—"}</span>
                  <span style={{ fontSize: "0.72rem", color: LGRAY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.nome_instrumento}>{t.nome_instrumento || "—"}</span>
                </span>
                {/* Corretora + conta */}
                <ColBroker corretora={t.corretora} conta={t.conta} />
                {/* País */}
                <span className="log-cell" style={{ color: LGRAY, textAlign: "center" }}>{t.pais || "—"}</span>
                {/* Categoria */}
                <span className="log-cell" style={{ color: t.categoria === "CFD" ? RED : MUTE, fontWeight: t.categoria === "CFD" ? 700 : 400, textAlign: "center" }}>{t.categoria}</span>
                {/* Valor */}
                <ColOC eur={t.pl_eur} t={t} win={win} />
                {/* Swap */}
                <ColOC eur={t.swap} t={t} />
                {/* Resultado */}
                <span style={{ textAlign: "center" }}><ResultBadge label={win ? "Ganho" : "Perda"} color={win ? GREEN : RED} /></span>
                <span style={{ color: MUTE, textAlign: "center" }}>›</span>
              </div>
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
              <div className="log-row" data-row-key={key} style={{ gridTemplateColumns: LOG_COLS, outline: selectedKey === key ? "2px solid var(--accent)" : "none", outlineOffset: -2 }} onClick={() => openRow(row)}>
                {/* Data */}
                <span className="log-cell" style={{ color: LGRAY, fontSize: "0.75rem", textAlign: "center" }}>{d.data?.slice(0, 10)}</span>
                {/* Empresa (descrição curta) */}
                <span className="log-cell" style={{ color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.descricao}>{shortDesc(d.descricao || d.nome_instrumento)}</span>
                {/* Corretora + conta */}
                <ColBroker corretora={d.corretora} conta={d.conta} />
                {/* País */}
                <span className="log-cell" style={{ color: LGRAY, textAlign: "center" }}>—</span>
                {/* Categoria */}
                <span className="log-cell" style={{ color: MUTE, textAlign: "center" }}>Movimento</span>
                {/* Valor */}
                <ColOC eur={val} t={d} win={isDep} />
                {/* Swap */}
                <span className="log-cell" style={{ textAlign: "right", color: MUTE }}>—</span>
                {/* Resultado */}
                <span style={{ textAlign: "center" }}><ResultBadge label={isDep ? "Depósito" : "Levantamento"} color={isDep ? VIOLET : AMBER} /></span>
                <span style={{ color: MUTE, textAlign: "center" }}>›</span>
              </div>
            </div>
          );
        }

        if (row._type === "crypto") {
          const h = row;
          const key = `c-${h.simbolo}`;
          return (
            <div key={key}>
              <div className="log-row" data-row-key={key} style={{ gridTemplateColumns: LOG_COLS, outline: selectedKey === key ? "2px solid var(--accent)" : "none", outlineOffset: -2 }} onClick={() => openRow(row)}>
                {/* Data (última atualização) */}
                <span className="log-cell" style={{ color: LGRAY, fontSize: "0.75rem", textAlign: "center" }}>{h.atualizado_em?.slice(0, 10) || "—"}</span>
                {/* TICKER + nome */}
                <span className="log-cell" style={{ display: "flex", flexDirection: "column", lineHeight: 1.25, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, color: "#fbbf24", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.simbolo}</span>
                  <span style={{ fontSize: "0.72rem", color: LGRAY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={h.nome}>{h.nome || "—"}</span>
                </span>
                {/* Corretora + conta */}
                <ColBroker corretora={h.corretora} conta={h.conta} />
                {/* País */}
                <span className="log-cell" style={{ color: LGRAY, textAlign: "center" }}>—</span>
                {/* Categoria */}
                <span className="log-cell" style={{ color: AMBER, fontWeight: 700, textAlign: "center" }}>CRIPTO</span>
                {/* Valor de mercado */}
                <span className="log-cell" style={{ textAlign: "right", fontWeight: 700, color: "var(--text)" }}>{h.valor_eur != null ? fmtE(h.valor_eur) : "—"}</span>
                {/* Swap */}
                <span className="log-cell" style={{ textAlign: "right", color: MUTE }}>—</span>
                {/* Resultado */}
                <span style={{ textAlign: "center" }}><ResultBadge label="Em carteira" color={AMBER} /></span>
                <span style={{ color: MUTE, textAlign: "center" }}>›</span>
              </div>
            </div>
          );
        }

        // Dividendo / Juros
        const d = row;
        const key = `d-${d.simbolo}-${d.data_pagamento}`;
        const isInt = d.tipo === "INTEREST";
        return (
          <div key={key}>
            <div className="log-row" data-row-key={key} style={{ gridTemplateColumns: LOG_COLS, outline: selectedKey === key ? "2px solid var(--accent)" : "none", outlineOffset: -2 }} onClick={() => openRow(row)}>
              {/* Data */}
              <span className="log-cell" style={{ color: LGRAY, fontSize: "0.75rem", textAlign: "center" }}>{d.data_pagamento?.slice(0, 10)}</span>
              {/* TICKER + nome */}
              <span className="log-cell" style={{ display: "flex", flexDirection: "column", lineHeight: 1.25, minWidth: 0 }}>
                <span style={{ fontWeight: 700, color: "#fbbf24", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.simbolo || "—"}</span>
                <span style={{ fontSize: "0.72rem", color: LGRAY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.nome_instrumento}>{d.nome_instrumento || "—"}</span>
              </span>
              {/* Corretora + conta */}
              <ColBroker corretora={d.corretora} conta={d.conta} />
              {/* País */}
              <span className="log-cell" style={{ color: LGRAY, textAlign: "center" }}>{d.pais_fonte || "—"}</span>
              {/* Categoria */}
              <span className="log-cell" style={{ color: MUTE, textAlign: "center" }}>{isInt ? "JUROS" : "DIVIDENDO"}</span>
              {/* Valor */}
              <ColOC eur={d.valor_liq_eur ?? 0} t={d} win={true} />
              {/* Swap */}
              <span className="log-cell" style={{ textAlign: "right", color: MUTE }}>—</span>
              {/* Resultado */}
              <span style={{ textAlign: "center" }}><ResultBadge label={isInt ? "Juros" : "Dividendo"} color={isInt ? TEAL : BLUE} /></span>
              <span style={{ color: MUTE, textAlign: "center" }}>›</span>
            </div>
          </div>
          );
        })}
       </div>
      </div>
      )}
      </div>{/* fim da zona com scroll */}

      {/* ── Modal com o detalhe da operação clicada ── */}
      {modalRow && (
        <Modal header={<ModalHeader row={modalRow} />} onClose={closeRow}>
          <RowDetail row={modalRow} />
        </Modal>
      )}
    </div>
  );
}

// Cabeçalho do modal: empresa+ticker (esq.) · categoria (centro) · Net P/L com câmbio (dir.)
function ModalHeader({ row }) {
  let nome, sub, categoria, eur, data;
  if (row._type === "dep") {
    nome = row.descricao || row.nome_instrumento || "Movimento";
    sub  = row.corretora;
    categoria = row.tipo === "deposito" ? "Depósito" : "Levantamento";
    eur  = row.tipo === "deposito" ? row.valor : -row.valor;
    data = row.data?.slice(0, 10);
  } else if (row._type === "div") {
    nome = row.nome_instrumento || row.simbolo;
    sub  = row.simbolo;
    categoria = row.tipo === "INTEREST" ? "Juros" : "Dividendo";
    eur  = row.valor_liq_eur ?? 0;
    data = row.data_pagamento?.slice(0, 10);
  } else if (row._type === "crypto") {
    nome = row.nome || row.simbolo;
    sub  = row.simbolo;
    categoria = "CRIPTO";
    eur  = row.valor_eur ?? 0;
    data = row.atualizado_em?.slice(0, 10);
  } else {
    nome = row.nome_instrumento || row.simbolo;
    sub  = row.simbolo;
    categoria = row.categoria;
    eur  = row.pl_eur ?? 0;
    data = row.data_fecho?.slice(0, 10);
  }
  const isCrypto = row._type === "crypto";
  const hasTicker = row._type !== "dep";   // depósitos/levantamentos não têm ticker
  const naoEur = !isCrypto && !isEur(row.moeda_original) && row.taxa_cambio && row.taxa_cambio !== 1;
  const orig   = naoEur ? toOrig(eur, row) : null;
  const cor    = isCrypto ? "var(--text)" : (eur >= 0 ? GREEN : RED);  // cor do total
  // Efeito do câmbio = quanto a conversão reduziu/aumentou a MAGNITUDE do valor
  // (consistente em ganhos e perdas). Ex.: $31,36 → €27,36 = −€4,00 / −12,75%.
  const fxDiff = naoEur ? Math.abs(eur) - Math.abs(orig) : 0;
  const fxPct  = naoEur && orig ? (fxDiff / Math.abs(orig)) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      {/* Esquerda: ticker (em cima) + nome (em baixo) + data. Para depósitos não há ticker. */}
      <div style={{ minWidth: 0 }}>
        {hasTicker ? (
          <>
            <div style={{ fontWeight: 800, fontSize: "1rem", color: "#fbbf24", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>
            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={nome}>{nome}</div>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nome}</div>
            <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "#fbbf24" }}>{sub}</div>
          </>
        )}
        {data && <div style={{ fontSize: "0.7rem", color: LGRAY, marginTop: 1 }}>{data}</div>}
      </div>
      {/* Centro: categoria */}
      <div style={{ flex: 1, textAlign: "center" }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: ".06em", padding: "3px 12px", borderRadius: 20, background: "rgba(255,255,255,0.08)", border: "1px solid var(--border)", whiteSpace: "nowrap" }}>{categoria}</span>
      </div>
      {/* Direita: Net P/L (original cinza claro / € branco) + diferença cambial */}
      <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
        <div style={{ fontSize: "0.58rem", color: LGRAY, textTransform: "uppercase", letterSpacing: ".06em" }}>{isCrypto ? "Valor" : "Net P/L"}</div>
        <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>
          {naoEur
            ? <><span style={{ fontWeight: 800, color: cor }}>{fmtNatSign(orig, row.moeda_original)}</span><span style={{ fontWeight: 400, color: cor }}> ● </span><span style={{ fontWeight: 400, color: cor }}>{fmtEsign(eur)}</span></>
            : <span style={{ color: cor }}>{fmtEsign(eur)}</span>}
        </div>
        {naoEur && (
          <div style={{ fontSize: "0.64rem", color: fxDiff >= 0 ? GREEN : RED }}>
            câmbio {fmtEsign(fxDiff)} · {(fxPct >= 0 ? "+" : "") + fxPct.toFixed(2)}%
          </div>
        )}
      </div>
    </div>
  );
}

// Detalhe da operação dentro do modal (trade, movimento ou dividendo/juros).
function RowDetail({ row }) {
  if (row._type === "trade")  return <TradeDetail t={row} />;
  if (row._type === "crypto") return <CryptoDetail h={row} />;

  if (row._type === "dep") {
    const d = row;
    const isDep = d.tipo === "deposito";
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px 22px", fontSize: 12.5 }}>
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
            <div style={{ color: LGRAY, textTransform: "uppercase", fontSize: 10, letterSpacing: ".06em" }}>{k}</div>
            <div style={{ color: "var(--text)", marginTop: 2, wordBreak: "break-word" }}>{v ?? "—"}</div>
          </div>
        ))}
      </div>
    );
  }

  // Dividendo / Juros
  const d = row;
  const movs = parseMovs(d);
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px 22px", fontSize: 12.5 }}>
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
            <div style={{ color: LGRAY, textTransform: "uppercase", fontSize: 10, letterSpacing: ".06em" }}>{k}</div>
            <div style={{ color: "var(--text)", marginTop: 2 }}>{v ?? "—"}</div>
          </div>
        ))}
      </div>
      {movs.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ color: LGRAY, textTransform: "uppercase", fontSize: 10, letterSpacing: ".06em", marginBottom: 8 }}>
            Todas as Operações ({movs.length})
          </div>
          <table className="data-table no-sticky">
            <thead><tr><th>ID</th><th>Tipo</th><th>Data/Hora</th><th style={{ textAlign: "right" }}>Valor €</th></tr></thead>
            <tbody>
              {movs.map((m, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>{m.id ?? "—"}</td>
                  <td>{m.tipo}</td>
                  <td style={{ fontSize: 11 }}>{m.data ?? "—"}</td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: m.valor >= 0 ? GREEN : RED }}>{fmtEu(m.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
