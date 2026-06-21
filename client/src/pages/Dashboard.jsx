import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
} from "recharts";
import Modal from "../components/Modal.jsx";

const fmt = v =>
  (v < 0 ? "-" : "") + "€ " +
  Math.abs(v).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtAbs = v =>
  "€ " + Math.abs(v).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const GREEN = "#10b981", RED = "#f43f5e", BLUE = "#60a5fa",
      PINK = "#f472b6", AMBER = "#fbbf24", PURPLE = "#a78bfa", TEAL = "#14b8a6", MUTE = "#6b7280";

const COUNTRY_NAME = {
  PT:"Portugal", US:"Estados Unidos", NL:"Países Baixos", DE:"Alemanha",
  FR:"França", GB:"Reino Unido", UK:"Reino Unido", ES:"Espanha", IT:"Itália",
  SE:"Suécia", CH:"Suíça", BE:"Bélgica", DK:"Dinamarca", NO:"Noruega",
  FI:"Finlândia", IE:"Irlanda", LU:"Luxemburgo", AT:"Áustria", AU:"Austrália",
  CA:"Canadá", JP:"Japão", HK:"Hong Kong", SG:"Singapura", PL:"Polónia",
  EU:"Europa", NZ:"Nova Zelândia",
};
const fmtPais = code => (code && COUNTRY_NAME[code]) ? COUNTRY_NAME[code] : (code ?? null);

const TooltipDark = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#252530", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <div style={{ color: MUTE, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.value >= 0 ? GREEN : RED, fontWeight: 700 }}>
          {fmt(p.value)}
        </div>
      ))}
    </div>
  );
};

function StatIconCard({ icon, value, label, color, colorBg, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: 14, padding: "16px 18px",
        display: "flex", alignItems: "center", gap: 14,
        cursor: onClick ? "pointer" : "default", flexShrink: 0, minWidth: 190,
        transition: "border-color .2s",
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.borderColor = color; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      <div style={{ width: 46, height: 46, borderRadius: 12, flexShrink: 0, background: colorBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text)", lineHeight: 1.1, letterSpacing: "-0.5px" }}>
          {value}
        </div>
        <div style={{ fontSize: "0.68rem", color: MUTE, marginTop: 3, fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  );
}

function Tip({ text, children }) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 7px)", left: "50%", transform: "translateX(-50%)",
          background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 7, padding: "7px 11px", fontSize: "0.68rem", color: "#c4c4d4",
          whiteSpace: "pre-line", zIndex: 300, pointerEvents: "none",
          boxShadow: "0 6px 18px rgba(0,0,0,0.45)", lineHeight: 1.5,
        }}>
          {text}
        </div>
      )}
    </span>
  );
}

function MiniDonut({ pct, label, color, onClick, value }) {
  const [hovered, setHovered] = useState(false);
  const safe = isFinite(pct) ? Math.min(100, Math.max(0, pct || 0)) : 0;
  const fmtVal = v => {
    const abs = Math.abs(v).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${v < 0 ? "-" : ""}€${abs}`;
  };
  return (
    <div style={{ textAlign: "center", cursor: onClick ? "pointer" : "default", position: "relative" }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {hovered && value !== undefined && (
        <div style={{
          position: "absolute", top: -38, left: "50%", transform: "translateX(-50%)",
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 8, padding: "5px 12px", fontSize: "0.75rem",
          fontWeight: 700, color: value >= 0 ? GREEN : RED,
          whiteSpace: "nowrap", zIndex: 10,
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          pointerEvents: "none",
        }}>
          {fmtVal(value)}
        </div>
      )}
      <div style={{ position: "relative", width: 88, height: 88, margin: "0 auto" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={[{ v: safe }, { v: 100 - safe }]}
              dataKey="v" innerRadius={26} outerRadius={40}
              startAngle={90} endAngle={-270} paddingAngle={3}
            >
              <Cell fill={color} />
              <Cell fill="rgba(255,255,255,0.06)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%,-50%)",
          fontWeight: 800, fontSize: "0.78rem", color: "var(--text)",
        }}>
          {safe.toFixed(0)}%
        </div>
      </div>
      <div style={{ fontSize: "0.7rem", color: MUTE, marginTop: 6, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function SkBox({ h, w = "100%", r = 6 }) {
  return <div className="skeleton-box" style={{ height: h, width: w, borderRadius: r, flexShrink: 0 }} />;
}

function DashboardSkeleton() {
  return (
    <>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <SkBox h={22} w={150} /><SkBox h={13} w={290} r={4} />
        </div>
        <SkBox h={34} w={96} r={8} />
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        {Array(5).fill(0).map((_, i) => (
          <div key={i} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, minWidth: 190 }}>
            <SkBox h={46} w={46} r={12} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
              <SkBox h={20} w={80} /><SkBox h={12} w={70} r={4} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 16, marginBottom: 20 }}>
        <div className="card"><SkBox h={330} /></div>
        <div className="card"><SkBox h={330} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div className="card"><SkBox h={270} /></div>
        <div className="card"><SkBox h={270} /></div>
        <div className="card"><SkBox h={270} /></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {Array(5).fill(0).map((_, i) => (
          <div key={i} className="trade-row" style={{ pointerEvents: "none" }}>
            <SkBox h={16} w={64} r={4} /><SkBox h={22} w={44} r={20} />
            <SkBox h={13} w={80} r={4} />
            <div style={{ marginLeft: "auto" }}><SkBox h={16} w={80} r={4} /></div>
            <SkBox h={13} w={70} r={4} />
          </div>
        ))}
      </div>
    </>
  );
}

// SVG icons
const IcoLine = c => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
const IcoGrid = c => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>;
const IcoPct  = c => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="9" r="3"/><circle cx="15" cy="15" r="3"/><line x1="6" y1="18" x2="18" y2="6"/></svg>;
const IcoCoin = c => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 12h6M12 9v6"/></svg>;
const IcoBar  = c => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>;
const IcoBank = c => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="21" x2="21" y2="21"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="5 6 12 3 19 6"/><line x1="4" y1="10" x2="4" y2="21"/><line x1="20" y1="10" x2="20" y2="21"/><line x1="9" y1="14" x2="9" y2="17"/><line x1="15" y1="14" x2="15" y2="17"/></svg>;

// Intervalos da curva de Total Acumulado (estilo corretora). A janela é ancorada à
// data mais recente dos dados (não ao "hoje" real), para nunca mostrar um gráfico vazio
// quando a última operação foi há algum tempo.
const EQ_RANGES = [
  ["1D", "1D"], ["5D", "5D"], ["6M", "6M"], ["YTD", "YTD"], ["1A", "1A"],
  ["3A", "3A"], ["5A", "5A"], ["10A", "10A"], ["MAX", "Max"],
];
const EQ_RANGE_LABEL = {
  "1D": "último dia", "5D": "últimos 5 dias", "6M": "últimos 6 meses",
  "YTD": "desde o início do ano", "1A": "último ano", "3A": "últimos 3 anos",
  "5A": "últimos 5 anos", "10A": "últimos 10 anos", "MAX": "desde o início",
};
// Devolve a data de início (YYYY-MM-DD) da janela, dado o fim; null = sem limite (MAX).
function eqRangeStart(rangeKey, endDateStr) {
  const end = new Date(endDateStr + "T00:00:00");
  const d = new Date(end);
  switch (rangeKey) {
    case "1D":  d.setDate(d.getDate() - 1); break;
    case "5D":  d.setDate(d.getDate() - 5); break;
    case "6M":  d.setMonth(d.getMonth() - 6); break;
    case "YTD": return `${end.getFullYear()}-01-01`;
    case "1A":  d.setFullYear(d.getFullYear() - 1); break;
    case "3A":  d.setFullYear(d.getFullYear() - 3); break;
    case "5A":  d.setFullYear(d.getFullYear() - 5); break;
    case "10A": d.setFullYear(d.getFullYear() - 10); break;
    default:    return null; // MAX
  }
  return d.toISOString().slice(0, 10);
}

export default function Dashboard({ user }) {
  const [anos, setAnos]           = useState([]);
  const [ano, setAno]             = useState(null);
  const [stats, setStats]         = useState(null);
  const [bySymbol, setBySymbol]   = useState([]);
  const [allTrades, setAllTrades] = useState([]);
  const [allDivs, setAllDivs]     = useState([]);
  const [divTotal, setDivTotal]   = useState(null);
  const [deposits, setDeposits]   = useState([]);
  const [equityAll, setEquityAll] = useState([]);   // equity acumulada desde sempre
  const [eqRange, setEqRange]     = useState("MAX"); // 1D|5D|6M|YTD|1A|3A|5A|10A|MAX
  const [modal, setModal]               = useState(null);
  const [modalStack, setModalStack]     = useState([]);   // histórico para voltar atrás entre modais
  const [loading, setLoading]           = useState(true);

  // Abre um modal a partir de dentro de outro, guardando o anterior para poder voltar.
  const pushModal = (m) => { setModalStack(s => [...s, modal]); setModal(m); };
  // Fecha o modal atual: se houver anterior, volta a ele; senão fecha tudo.
  const closeModal = () => {
    if (modalStack.length > 0) {
      setModal(modalStack[modalStack.length - 1]);
      setModalStack(modalStack.slice(0, -1));
    } else {
      setModal(null);
    }
  };
  const [anosReady, setAnosReady]       = useState(false);

  useEffect(() => {
    axios.get("/api/trades/anos").then(r => {
      setAnos(r.data);
      if (r.data.length) setAno(r.data[0]);
      else setLoading(false); // sem nenhum ano (nem trades nem dividendos) — não há nada para carregar
    }).catch(() => setLoading(false)).finally(() => setAnosReady(true));
    axios.get("/api/import/deposits").then(r => setDeposits(r.data)).catch(() => {});
    axios.get("/api/trades/equity").then(r => setEquityAll(r.data)).catch(() => {}); // sem ?ano = desde início
  }, []);

  const load = useCallback(async (a) => {
    if (!a) return;
    setLoading(true);
    try {
      const [s, sym, rec, divs, divsAll] = await Promise.all([
        axios.get(`/api/trades/stats?ano=${a}`),
        axios.get(`/api/trades/by-symbol?ano=${a}`),
        axios.get(`/api/trades?ano=${a}`),
        axios.get(`/api/dividends/total?ano=${a}`),
        axios.get(`/api/dividends?ano=${a}`),
      ]);
      setStats(s.data);
      setBySymbol(sym.data.slice(0, 10));
      setAllTrades(rec.data);
      setDivTotal(divs.data);
      setAllDivs(divsAll.data);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(ano); }, [ano, load]);

  const tradeSum = list => list.reduce((s, t) => s + (t.pl_eur ?? 0), 0);
  const brokerTotals = list => Object.entries(
    list.reduce((acc, t) => {
      const b = t.corretora || "—";
      if (!acc[b]) acc[b] = { pl: 0, n: 0 };
      acc[b].pl += t.pl_eur ?? 0;
      acc[b].n++;
      return acc;
    }, {})
  ).sort((a, b) => Math.abs(b[1].pl) - Math.abs(a[1].pl));

  const openAllTrades      = () => setModal({ title: "📋 Todas as Trades", trades: allTrades, brokers: brokerTotals(allTrades), summary: { label: `${allTrades.length} trades`, value: stats?.net_pl ?? 0 } });
  const openAllMovimentos  = () => {
    const divBrokers = Object.entries(
      allDivs.reduce((acc, d) => { const b = d.corretora || "—"; if (!acc[b]) acc[b] = { pl: 0, n: 0 }; acc[b].pl += d.valor_liq_eur ?? 0; acc[b].n++; return acc; }, {})
    ).sort((a, b) => Math.abs(b[1].pl) - Math.abs(a[1].pl));
    const tradeBrokers = brokerTotals(allTrades);
    const allBrokers   = Object.entries(
      [...tradeBrokers, ...divBrokers].reduce((acc, [b, st]) => {
        if (!acc[b]) acc[b] = { pl: 0, n: 0 };
        acc[b].pl += st.pl; acc[b].n += st.n; return acc;
      }, {})
    ).sort((a, b) => Math.abs(b[1].pl) - Math.abs(a[1].pl));
    const total = (stats?.net_pl ?? 0) + divLiq;
    setModal({
      title: "📊 Todos os Movimentos",
      trades: allTrades,
      divs:   allDivs.length > 0 ? allDivs : null,
      brokers: allBrokers,
      summary: { label: `${allTrades.length} trades · ${allDivs.length} dividendos`, value: total },
    });
  };
  const openWins       = () => { const t = allTrades.filter(t => t.pl_eur > 0);  setModal({ title: "✅ Trades Ganhas",   trades: t, brokers: brokerTotals(t), summary: { label: `${t.length} trades`, value: tradeSum(t) } }); };
  const openLosses     = () => { const t = allTrades.filter(t => t.pl_eur < 0);  setModal({ title: "❌ Trades Perdidas", trades: t, brokers: brokerTotals(t), summary: { label: `${t.length} trades`, value: tradeSum(t) } }); };
  const brokersFromDivs = list => Object.entries(
    list.reduce((acc, d) => { const b = d.corretora || "—"; if (!acc[b]) acc[b] = { pl: 0, n: 0 }; acc[b].pl += d.valor_liq_eur ?? 0; acc[b].n++; return acc; }, {})
  ).sort((a, b) => Math.abs(b[1].pl) - Math.abs(a[1].pl));
  const openDivs       = () => {
    const list = allDivs.filter(d => d.tipo !== "INTEREST");
    const total = list.reduce((s, d) => s + (d.valor_liq_eur ?? 0), 0);
    setModal({ title: "💰 Dividendos", divs: list, brokers: brokersFromDivs(list), summary: { label: `${list.length} pagamentos`, value: total } });
  };
  const openInterest   = () => {
    const list = allDivs.filter(d => d.tipo === "INTEREST");
    const total = list.reduce((s, d) => s + (d.valor_liq_eur ?? 0), 0);
    setModal({ title: "🏦 Juros", divs: list, brokers: brokersFromDivs(list), summary: { label: `${list.length} pagamentos`, value: total } });
  };
  const openBestDay    = () => { const d = stats?.best_day_date;  const t = allTrades.filter(t => t.data_fecho?.slice(0, 10) === d); setModal({ title: `📈 Melhor Dia — ${d ?? ""}`, trades: t, brokers: brokerTotals(t), summary: { label: `${t.length} trades`, value: stats?.best_day ?? 0 } }); };
  const openWorstDay   = () => { const d = stats?.worst_day_date; const t = allTrades.filter(t => t.data_fecho?.slice(0, 10) === d); setModal({ title: `📉 Pior Dia — ${d ?? ""}`,   trades: t, brokers: brokerTotals(t), summary: { label: `${t.length} trades`, value: stats?.worst_day ?? 0 } }); };
  const openCategory   = (cat, label, emoji) => { const t = allTrades.filter(t => t.categoria === cat); setModal({ title: `${emoji} ${label}`, trades: t, brokers: brokerTotals(t), summary: { label: `${t.length} trades`, value: tradeSum(t) } }); };

  const matchSymbol = (a, b) => {
    if (!a || !b) return false;
    if (a === b) return true;
    const base = s => s.split(".")[0].toUpperCase();
    return base(a) === base(b);
  };

  const openSymbolHistory = (simbolo, { tradesOnly = false } = {}) => {
    const trades  = allTrades.filter(t => matchSymbol(t.simbolo, simbolo));
    const symDivs = tradesOnly ? [] : allDivs.filter(d => matchSymbol(d.simbolo, simbolo));
    const plT = trades.reduce((s, t) => s + (t.pl_eur ?? 0), 0);
    const plD = symDivs.reduce((s, d) => s + (d.valor_liq_eur ?? 0), 0);
    const subLabel = [
      trades.length  ? `${trades.length} trade${trades.length !== 1 ? "s" : ""}` : null,
      symDivs.length ? `${symDivs.length} dividendo${symDivs.length !== 1 ? "s" : ""}` : null,
    ].filter(Boolean).join(" · ");
    setModal({ title: `📌 ${simbolo} — Histórico`, trades, detailed: true, divs: symDivs.length > 0 ? symDivs : null, brokers: brokerTotals(trades), summary: { label: subLabel, value: plT + plD } });
  };

  if (!anosReady || loading) return <DashboardSkeleton />;

  if (anos.length === 0) {
    const initials = user?.slice(0, 2).toUpperCase() ?? "?";
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", textAlign: "center", gap: 24 }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg, #4f6af5, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", fontWeight: 800, color: "#fff", letterSpacing: "-1px" }}>
          {initials}
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "var(--text)" }}>Bem-vindo, {user}!</h2>
          <p style={{ margin: "10px 0 0", fontSize: "0.9rem", color: MUTE, maxWidth: 420, lineHeight: 1.7 }}>
            A tua conta está pronta. Ainda não tens relatórios carregados — começa por importar as tuas operações para veres o teu desempenho aqui.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {[["📥", "Importar Dados", "Carrega os teus ficheiros de operações via a página de importação"],
            ["📊", "Ver Estatísticas", "Após importares, as tuas métricas e gráficos aparecem aqui automaticamente"]].map(([icon, title, desc]) => (
            <div key={title} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", width: 180, textAlign: "left" }}>
              <div style={{ fontSize: "1.4rem", marginBottom: 6 }}>{icon}</div>
              <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text)" }}>{title}</div>
              <div style={{ fontSize: "0.72rem", color: MUTE, marginTop: 4, lineHeight: 1.5 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"60vh", gap:12, color: MUTE }}>
      <span style={{ fontSize:"2rem" }}>⚠️</span>
      <span style={{ fontSize:"0.9rem" }}>Erro ao carregar dados. Tenta recarregar a página.</span>
      <button className="btn btn-primary" onClick={() => load(ano)} style={{ marginTop:8 }}>Tentar novamente</button>
    </div>
  );

  // ── Derived values ──
  const wr          = stats.win_rate ?? 0;
  const pf          = stats.profit_factor ?? 0;
  const divLiq      = divTotal?.total_liq ?? 0;
  const interestLiq  = allDivs.filter(d => d.tipo === "INTEREST").reduce((s, d) => s + (d.valor_liq_eur ?? 0), 0);
  const dividendsLiq = allDivs.filter(d => d.tipo !== "INTEREST").reduce((s, d) => s + (d.valor_liq_eur ?? 0), 0);
  const totalIncome = (stats.net_pl ?? 0) + divLiq;
  const expectancy  = stats.n_trades > 0 ? (stats.net_pl ?? 0) / stats.n_trades : 0;
  const top10sym    = [...bySymbol].filter(s => Math.abs(s.pl_total) > 0.001).sort((a, b) => a.pl_total - b.pl_total);
  const recent      = allTrades.slice(0, 8);

  const catStats = (cat) => {
    const trades = allTrades.filter(t => t.categoria === cat);
    const pl     = tradeSum(trades);
    const wins   = trades.filter(t => t.pl_eur > 0).length;
    return { trades, pl, n: trades.length, wr: trades.length > 0 ? wins / trades.length * 100 : 0 };
  };
  const stockSt  = catStats("STOCK");
  const cfdSt    = catStats("CFD");
  const optionSt = catStats("OPTION");

  // % of total absolute P&L each category contributes (dividendos e juros separados)
  const allCatAbs = Math.abs(stockSt.pl) + Math.abs(cfdSt.pl) + Math.abs(optionSt.pl) + Math.abs(dividendsLiq) + Math.abs(interestLiq);
  const catPct    = val => allCatAbs > 0 ? Math.abs(val) / allCatAbs * 100 : 0;
  const nDividendos = allDivs.filter(d => d.tipo !== "INTEREST").length;
  const nJuros      = allDivs.filter(d => d.tipo === "INTEREST").length;
  const catDonuts = [
    { pct: catPct(stockSt.pl),    label: "Ações",      color: BLUE,  onClick: () => openCategory("STOCK", "Ações", "📈"),  value: stockSt.pl,    show: stockSt.n > 0 },
    { pct: catPct(optionSt.pl),   label: "Opções",     color: PINK,  onClick: () => openCategory("OPTION", "Opções", "🎯"), value: optionSt.pl,   show: optionSt.n > 0 },
    { pct: catPct(cfdSt.pl),      label: "CFDs",       color: AMBER, onClick: () => openCategory("CFD", "CFDs", "⚡"),      value: cfdSt.pl,      show: cfdSt.n > 0 },
    { pct: catPct(dividendsLiq),  label: "Dividendos", color: GREEN, onClick: openDivs,                                     value: dividendsLiq,  show: dividendsLiq !== 0 },
    { pct: catPct(interestLiq),   label: "Juros",      color: TEAL,  onClick: openInterest,                                 value: interestLiq,   show: interestLiq !== 0 },
  ].filter(c => c.show);

  // Repartição para o donut dedicado (Ações, Opções, CFDs, Dividendos, Juros).
  // Fatias dimensionadas pelo valor absoluto; legenda mostra o valor com sinal e a % do total absoluto.
  const catBreakdown = [
    { label: "Ações",      value: stockSt.pl,   color: BLUE,  onClick: () => openCategory("STOCK", "Ações", "📈"),   show: stockSt.n > 0 },
    { label: "Opções",     value: optionSt.pl,  color: PINK,  onClick: () => openCategory("OPTION", "Opções", "🎯"), show: optionSt.n > 0 },
    { label: "CFDs",       value: cfdSt.pl,     color: AMBER, onClick: () => openCategory("CFD", "CFDs", "⚡"),       show: cfdSt.n > 0 },
    { label: "Dividendos", value: dividendsLiq, color: GREEN, onClick: openDivs,                                     show: dividendsLiq !== 0 },
    { label: "Juros",      value: interestLiq,  color: TEAL,  onClick: openInterest,                                 show: interestLiq !== 0 },
  ].filter(c => c.show);
  const catBreakdownAbs = catBreakdown.reduce((s, c) => s + Math.abs(c.value), 0);
  const catBreakdownNet = catBreakdown.reduce((s, c) => s + c.value, 0);

  // Série da curva de equity: sempre a série acumulada desde sempre, filtrada pelo
  // intervalo escolhido (janela ancorada à data mais recente dos dados).
  const eqEnd   = equityAll.length ? equityAll[equityAll.length - 1].dia : null;
  const eqStart = eqEnd ? eqRangeStart(eqRange, eqEnd) : null;
  const eqData  = eqStart ? equityAll.filter(p => p.dia >= eqStart) : equityAll;
  // Posição do zero na curva (para colorir verde acima / vermelho abaixo)
  const eqVals = eqData.map(d => d.equity);
  const eqMax  = eqVals.length ? Math.max(...eqVals, 0) : 0;
  const eqMin  = eqVals.length ? Math.min(...eqVals, 0) : 0;
  const eqOff  = eqMax <= 0 ? 0 : eqMin >= 0 ? 1 : eqMax / (eqMax - eqMin);
  // Max Drawdown da série apresentada (pico → vale)
  const maxDrawdown = (() => {
    let peak = eqData[0]?.equity ?? 0, dd = 0;
    for (const p of eqData) { if (p.equity > peak) peak = p.equity; if (peak - p.equity > dd) dd = peak - p.equity; }
    return dd;
  })();

  const brokerStats = Object.entries(
    allTrades.reduce((acc, t) => {
      const b = t.corretora || "—";
      if (!acc[b]) acc[b] = { ganhos: 0, perdas: 0 };
      if ((t.pl_eur ?? 0) > 0) acc[b].ganhos += t.pl_eur;
      else if ((t.pl_eur ?? 0) < 0) acc[b].perdas += t.pl_eur;
      return acc;
    }, {})
  ).sort((a, b) => Math.abs(b[1].ganhos + b[1].perdas) - Math.abs(a[1].ganhos + a[1].perdas));

  // Depósitos agrupados por corretora (só entradas)
  const depositsByBroker = deposits
    .filter(d => d.tipo === "deposito")
    .reduce((acc, d) => { acc[d.corretora] = (acc[d.corretora] || 0) + d.valor; return acc; }, {});

  return (
    <div style={{ height: "calc(100vh - 56px)", display: "flex", flexDirection: "column" }}>
      {/* ── Header fixo (sempre visível) ── */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
        <div>
          <div className="page-title">Visão Geral</div>
          <div className="page-sub">Resumo do desempenho e da sua atividade de trading</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={openAllMovimentos}
          style={{
            background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.35)",
            color: "#60a5fa", borderRadius: 8, padding: "7px 14px",
            fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
            transition: "background .15s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(96,165,250,0.22)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(96,165,250,0.12)"}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          Ver Movimentos
        </button>
        <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: "absolute", left: 10, pointerEvents: "none", flexShrink: 0 }}>
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8"  y1="2" x2="8"  y2="6"/>
            <line x1="3"  y1="10" x2="21" y2="10"/>
          </svg>
          <select value={ano ?? ""} onChange={e => setAno(Number(e.target.value))} style={{ paddingLeft: 32 }}>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        </div>
      </div>

      {/* ── Conteúdo com scroll ── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 4 }}>

      {/* ── Top 5 stat icon cards ── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
        <StatIconCard icon={IcoLine(PINK)}  colorBg="rgba(244,114,182,0.15)" color={PINK}   value={fmt(stats.net_pl ?? 0)}   label="Resultado Líquido" onClick={openAllTrades} />
        <StatIconCard icon={IcoGrid(BLUE)}  colorBg="rgba(96,165,250,0.15)"  color={BLUE}   value={stats.n_trades}           label="Total de Trades"   onClick={openAllTrades} />
        <StatIconCard icon={IcoPct(AMBER)}  colorBg="rgba(251,191,36,0.15)"  color={AMBER}  value={`${wr.toFixed(1)}%`}      label="Win Rate"          onClick={openWins} />
        <StatIconCard icon={IcoCoin(GREEN)} colorBg="rgba(16,185,129,0.15)"  color={GREEN}  value={fmt(dividendsLiq)}        label="Dividendos"        onClick={openDivs} />
        <StatIconCard icon={IcoBank(TEAL)}  colorBg="rgba(20,184,166,0.15)"  color={TEAL}   value={fmt(interestLiq)}         label="Juros"             onClick={openInterest} />
        <StatIconCard icon={IcoBar(PURPLE)} colorBg="rgba(167,139,250,0.15)" color={PURPLE} value={pf.toFixed(2)}            label="Profit Factor"     onClick={openAllTrades} />
      </div>

      {/* ── Total Acumulado + Repartição por categoria (lado a lado) ── */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20, alignItems: "stretch" }}>
      <div className="card" style={{ padding: 24, display: "flex", gap: 24, flex: 1, minWidth: 0 }}>

          {/* Info column */}
          <div style={{ width: 210, flexShrink: 0, display: "flex", flexDirection: "column" }}>
            {/* Título */}
            <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--text)", marginBottom: 2 }}>Total Acumulado</div>
            <div style={{ fontSize: "0.72rem", color: MUTE, marginBottom: 16 }}>
              Ano {ano}
            </div>

            {/* P&L total + PF */}
            <div style={{ marginBottom: 12, display: "flex", alignItems: "flex-end", gap: 10 }}>
              <div style={{ fontSize: "1.55rem", fontWeight: 800, letterSpacing: "-0.5px", color: totalIncome >= 0 ? GREEN : RED }}>
                {fmtAbs(totalIncome)}
              </div>
              <span style={{ color: totalIncome >= 0 ? GREEN : RED, fontSize: "0.72rem", fontWeight: 700, opacity: 0.75 }}>
                {pf.toFixed(2)}x PF
              </span>
            </div>

            {/* Max Drawdown */}
            <div style={{ marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: "0.72rem", color: MUTE }}>Max Drawdown</span>
              <span style={{ fontSize: "0.9rem", fontWeight: 700, color: RED }}>−{fmtAbs(maxDrawdown)}</span>
            </div>

            {/* Depósitos por corretora */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--text)", marginBottom: 10 }}>Total de Depósitos</div>
              {Object.keys(depositsByBroker).length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {Object.entries(depositsByBroker).map(([broker, total]) => (
                    <div key={broker} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: "0.9rem", color: MUTE }}>{broker}</span>
                      <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text)" }}>{fmtAbs(total)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: "0.68rem", color: MUTE }}>Sem depósitos registados</div>
              )}
            </div>

            {/* Linha tracejada + explicação PF */}
            <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px dashed rgba(255,255,255,0.1)" }}>
              <div style={{ fontSize: "0.68rem", color: MUTE, lineHeight: 1.6 }}>
                <strong style={{ color: "var(--text)" }}>Profit Factor</strong> é o rácio entre ganhos e perdas totais. Valor acima de 1 significa estratégia lucrativa.
              </div>
            </div>
          </div>

          {/* Chart column */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: "0.6rem", fontWeight: 700, color: MUTE, textTransform: "uppercase", letterSpacing: ".1em" }}>Curva de Equity</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {EQ_RANGES.map(([k, label]) => {
                  const active = eqRange === k;
                  const base  = active ? "rgba(96,165,250,0.18)" : "rgba(255,255,255,0.04)";
                  const hover = active ? "rgba(96,165,250,0.28)" : "rgba(255,255,255,0.08)";
                  return (
                    <button key={k} onClick={() => setEqRange(k)} style={{
                      padding: "4px 9px", borderRadius: 7, fontSize: "0.66rem", fontWeight: active ? 700 : 600,
                      cursor: "pointer", whiteSpace: "nowrap", fontFamily: "var(--font)",
                      border: `1px solid ${active ? "rgba(96,165,250,0.45)" : "var(--border)"}`,
                      background: base, color: active ? "#60a5fa" : MUTE,
                      transition: "background .15s, transform .15s",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = hover; e.currentTarget.style.transform = "translateY(-1px)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = base;  e.currentTarget.style.transform = "translateY(0)"; }}
                    >{label}</button>
                  );
                })}
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={eqData}>
                  <defs>
                    {/* Linha: verde acima do zero, vermelho abaixo */}
                    <linearGradient id="eqStroke" x1="0" y1="0" x2="0" y2="1">
                      <stop offset={eqOff} stopColor="#10b981" stopOpacity={1} />
                      <stop offset={eqOff} stopColor="#f43f5e" stopOpacity={1} />
                    </linearGradient>
                    {/* Preenchimento: verde esbatido acima, vermelho esbatido abaixo */}
                    <linearGradient id="eqArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset={0}     stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset={eqOff} stopColor="#10b981" stopOpacity={0.04} />
                      <stop offset={eqOff} stopColor="#f43f5e" stopOpacity={0.04} />
                      <stop offset={1}     stopColor="#f43f5e" stopOpacity={0.35} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fill: MUTE, fontSize: 9 }} tickFormatter={d => d?.slice(5)} interval="preserveStartEnd" minTickGap={28} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: MUTE, fontSize: 9 }} tickFormatter={v => `€${v}`} width={46} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={v => [fmt(v), "Equity acumulada"]}
                    contentStyle={{ background: "#252530", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: MUTE }}
                  />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />
                  <Area type="monotone" dataKey="equity" stroke="url(#eqStroke)" strokeWidth={2} fill="url(#eqArea)" dot={false} activeDot={{ r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ fontSize: "0.62rem", color: MUTE, marginTop: 8, lineHeight: 1.5 }}>
              Evolução acumulada do resultado das operações ({EQ_RANGE_LABEL[eqRange]}) — não inclui dividendos/juros.
            </div>
          </div>
        </div>

        {/* ── Repartição por categoria (donut) ── */}
        <div className="card" style={{ padding: 24, width: 310, flexShrink: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--text)", marginBottom: 2 }}>Repartição por Categoria</div>
          <div style={{ fontSize: "0.72rem", color: MUTE, marginBottom: 12 }}>Ano {ano}</div>
          {catBreakdown.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: MUTE, fontSize: "0.8rem" }}>Sem dados</div>
          ) : (
            <>
              <div style={{ position: "relative", height: 188 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={catBreakdown.map(c => ({ name: c.label, v: Math.abs(c.value) }))} dataKey="v"
                      innerRadius={54} outerRadius={80} paddingAngle={2} stroke="none">
                      {catBreakdown.map((c, i) => <Cell key={i} fill={c.color} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [fmtAbs(v), n]}
                      wrapperStyle={{ zIndex: 50 }}
                      contentStyle={{ background: "#252530", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                      itemStyle={{ color: "#fff" }} labelStyle={{ color: "#fff" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: "absolute", inset: 0, zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  <div style={{ fontSize: "0.58rem", color: MUTE, textTransform: "uppercase", letterSpacing: ".08em" }}>Total</div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 800, color: catBreakdownNet >= 0 ? GREEN : RED }}>{fmt(catBreakdownNet)}</div>
                </div>
              </div>
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 2 }}>
                {catBreakdown.map(c => {
                  const pct = catBreakdownAbs > 0 ? Math.abs(c.value) / catBreakdownAbs * 100 : 0;
                  return (
                    <div key={c.label} onClick={c.onClick} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                      padding: "6px 6px", borderRadius: 6, cursor: "pointer", transition: "background .15s",
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--hover)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color, flexShrink: 0 }} />
                        <span style={{ fontSize: "0.84rem", color: "var(--text)" }}>{c.label}</span>
                      </span>
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, color: c.value >= 0 ? GREEN : RED, whiteSpace: "nowrap" }}>
                        {fmt(c.value)} <span style={{ color: MUTE, fontWeight: 600 }}>({pct.toFixed(1)}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

        {/* Win/Loss (movido para junto das Métricas Detalhadas) */}
        <div className="card" style={{ padding: 20, display: "flex", gap: 24, alignItems: "stretch", marginBottom: 24 }}>
          {/* Win / Loss (à direita via order) */}
          <div style={{ order: 2, flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--text)" }}>Win / Loss</div>
            <div style={{ fontSize: "0.72rem", color: MUTE, marginTop: 2 }}>Ano {ano}</div>
          </div>

          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

            {/* Corretoras */}
            <div style={{ width: 130, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {brokerStats.map(([broker, st]) => (
                <div key={broker}>
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text)", marginBottom: 3 }}>{broker}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem" }}>
                    <span style={{ color: MUTE }}>Ganhos</span>
                    <span style={{ color: GREEN, fontWeight: 600 }}>{fmt(st.ganhos)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem" }}>
                    <span style={{ color: MUTE }}>Perdas</span>
                    <span style={{ color: RED, fontWeight: 600 }}>{fmt(st.perdas)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 3, paddingTop: 3 }}>
                    <span style={{ color: MUTE }}>Total</span>
                    <span style={{ color: (st.ganhos + st.perdas) >= 0 ? GREEN : RED, fontWeight: 700 }}>{fmt(st.ganhos + st.perdas)}</span>
                  </div>
                </div>
              ))}
              {/* Total geral */}
              {brokerStats.length > 1 && (() => {
                const totalG = brokerStats.reduce((s, [, st]) => s + st.ganhos, 0);
                const totalP = brokerStats.reduce((s, [, st]) => s + st.perdas, 0);
                const totalL = totalG + totalP;
                return (
                  <div style={{ borderTop: "1px dashed rgba(255,255,255,0.15)", paddingTop: 8, marginTop: 4 }}>
                    <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text)", marginBottom: 3 }}>Total</div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem" }}>
                      <span style={{ color: MUTE }}>Ganhos</span>
                      <span style={{ color: GREEN, fontWeight: 600 }}>{fmt(totalG)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem" }}>
                      <span style={{ color: MUTE }}>Perdas</span>
                      <span style={{ color: RED, fontWeight: 600 }}>{fmt(totalP)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 3, paddingTop: 3 }}>
                      <span style={{ color: MUTE }}>Líquido</span>
                      <span style={{ color: totalL >= 0 ? GREEN : RED, fontWeight: 700 }}>{fmt(totalL)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Donut */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ position: "relative", width: 150, height: 150 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[{ v: stats.n_wins }, { v: stats.n_losses }]} dataKey="v" innerRadius={44} outerRadius={64} paddingAngle={3}
                      onClick={(_, index) => index === 0 ? openWins() : openLosses()} style={{ cursor: "pointer" }}>
                      <Cell fill="#34d399" /><Cell fill="#fb7185" />
                    </Pie>
                    <Tooltip
                      formatter={(v, n, p) => [v + " trades", p.dataIndex === 0 ? "Wins" : "Losses"]}
                      contentStyle={{ background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontSize: 12 }}
                      itemStyle={{ color: "#fff" }}
                      wrapperStyle={{ zIndex: 9999 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center", pointerEvents: "none" }}>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: wr >= 50 ? GREEN : RED, lineHeight: 1 }}>{wr.toFixed(0)}%</div>
                  <div style={{ fontSize: "0.55rem", color: MUTE, marginTop: 2 }}>Win Rate</div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, marginTop: 8, fontSize: "0.7rem" }}>
                <span style={{ color: GREEN }}>● Wins ({stats.n_wins})</span>
                <span style={{ color: RED }}>● Losses ({stats.n_losses})</span>
              </div>
            </div>

            {/* Melhor / Pior Dia em coluna */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 148, flexShrink: 0 }}>
              <div onClick={openBestDay} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.18)", cursor: "pointer", transition: "background .2s" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(16,185,129,0.14)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(16,185,129,0.07)"}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: GREEN, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: "0.58rem", color: GREEN, fontWeight: 700 }}>Melhor Dia</div>
                  <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--text)" }}>{fmt(stats.best_day ?? 0)}</div>
                  <div style={{ fontSize: "0.56rem", color: MUTE }}>{stats.best_day_date ?? "—"}</div>
                </div>
              </div>
              <div onClick={openWorstDay} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, background: "rgba(244,63,94,0.07)", border: "1px solid rgba(244,63,94,0.18)", cursor: "pointer", transition: "background .2s" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(244,63,94,0.14)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(244,63,94,0.07)"}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: RED, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: "0.58rem", color: RED, fontWeight: 700 }}>Pior Dia</div>
                  <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--text)" }}>{fmt(stats.worst_day ?? 0)}</div>
                  <div style={{ fontSize: "0.56rem", color: MUTE }}>{stats.worst_day_date ?? "—"}</div>
                </div>
              </div>
            </div>

          </div>

          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px dashed rgba(255,255,255,0.1)", fontSize: "0.68rem", color: MUTE, lineHeight: 1.6 }}>
            <strong style={{ color: "var(--text)" }}>Win Rate</strong> é a percentagem de trades encerradas com lucro. Os valores de ganhos e perdas referem-se exclusivamente a operações de trading — <strong style={{ color: "var(--text)" }}>os dividendos não estão incluídos</strong>. Clica em Melhor/Pior Dia para ver os detalhes das operações desse dia.
          </div>
          </div>

          {/* Divisória vertical "cravada" (sulco: 1px escuro + 1px claro) */}
          <div aria-hidden="true" style={{ order: 1, alignSelf: "stretch", width: 0, flexShrink: 0, borderLeft: "1px solid rgba(0,0,0,0.30)", borderRight: "1px solid rgba(255,255,255,0.07)" }} />

          {/* Métricas Detalhadas (à esquerda via order) */}
          <div style={{ order: 0, width: 320, flexShrink: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--text)" }}>Métricas Detalhadas</div>
              <div style={{ fontSize: "0.72rem", color: MUTE, marginTop: 2 }}>Ano {ano}</div>
            </div>
            {[
              { label: "Expectancy",      value: fmt(expectancy),           sub: "por trade",                  color: expectancy >= 0 ? GREEN : RED, onClick: openAllTrades },
              { label: "Max Drawdown",    value: `-${fmtAbs(maxDrawdown)}`, sub: "pico → vale",                color: RED,   onClick: openAllTrades },
              { label: "Avg Win",         value: fmt(stats.avg_win ?? 0),   sub: "por trade ganho",            color: GREEN, onClick: openWins },
              { label: "Avg Loss",        value: fmt(stats.avg_loss ?? 0),  sub: "por trade perdido",          color: RED,   onClick: openLosses },
              { label: "Trades Ganhos",   value: stats.n_wins,              sub: `de ${stats.n_trades} total`, color: GREEN, onClick: openWins },
              { label: "Trades Perdidos", value: stats.n_losses,            sub: `de ${stats.n_trades} total`, color: RED,   onClick: openLosses },
            ].map((m, i) => (
              <div key={m.label} onClick={m.onClick} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                padding: "7px 4px", cursor: "pointer", transition: "background .15s",
                borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.09)",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--hover)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "0.8rem", color: "var(--text)", fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontSize: "0.6rem", color: MUTE }}>{m.sub}</div>
                </div>
                <div style={{ fontSize: "0.92rem", fontWeight: 800, color: m.color, whiteSpace: "nowrap" }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>


      {/* ── P&L por Símbolo + Win/Loss donut (kept) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--text)", marginBottom: 2 }}>P&L por Símbolo (Top 10)</div>
            <div style={{ fontSize: "0.72rem", color: MUTE, marginTop: 2 }}>Ano {ano}</div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={top10sym} layout="vertical" barSize={12}>
              <defs>
                <linearGradient id="symGreen" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.9} />
                </linearGradient>
                <linearGradient id="symRed" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <XAxis type="number" tick={{ fill: MUTE, fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="simbolo" type="category" tick={{ fill: MUTE, fontSize: 9 }} width={58} axisLine={false} tickLine={false} />
              <Tooltip content={<TooltipDark />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <ReferenceLine x={0} stroke="rgba(255,255,255,0.1)" />
              <Bar dataKey="pl_total" style={{ cursor: "pointer" }} onClick={d => openSymbolHistory(d.simbolo, { tradesOnly: true })}>
                {top10sym.map((s, i) => <Cell key={i} fill={s.pl_total >= 0 ? "url(#symGreen)" : "url(#symRed)"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ borderTop: "1px dashed rgba(255,255,255,0.1)", marginTop: 12, paddingTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, fontSize: "0.67rem", color: MUTE, lineHeight: 1.6 }}>
              Os 10 símbolos com maior impacto no P&L do ano <span style={{ color: "var(--text)", fontWeight: 600 }}>{ano}</span>, ordenados do pior para o melhor resultado. Barras a <span style={{ color: GREEN, fontWeight: 600 }}>verde</span> representam lucro, a <span style={{ color: RED, fontWeight: 600 }}>vermelho</span> prejuízo.
            </div>
            <button
              onClick={openAllMovimentos}
              style={{
                flexShrink: 0, background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.3)",
                borderRadius: 8, padding: "6px 14px", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                transition: "background .15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(96,165,250,0.22)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(96,165,250,0.12)"}
            >
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>Ver</span>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>Movimentos</span>
            </button>
          </div>
        </div>
        {/* Categorias */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--text)", marginBottom: 2 }}>Categorias</div>
          <div style={{ fontSize: "0.72rem", color: MUTE, marginBottom: 22 }}>% do P&L total por categoria</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, justifyItems: "center" }}>
            {catDonuts.map(c => (
              <MiniDonut key={c.label} pct={c.pct} label={c.label} color={c.color} onClick={c.onClick} value={c.value} />
            ))}
          </div>
          <div style={{ marginTop: 20, paddingTop: 12, borderTop: "1px dashed rgba(255,255,255,0.13)", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.78rem", color: "var(--text)", fontWeight: 700, marginBottom: 4 }}>
                {stats.n_trades} operações · {nDividendos} dividendos{nJuros > 0 ? ` · ${nJuros} juros` : ""}
              </div>
              <div style={{ fontSize: "0.62rem", color: MUTE, lineHeight: 1.55 }}>
                % representa o peso de cada categoria no total absoluto de P&L (soma de ganhos e perdas sem sinal).
              </div>
            </div>
            <button
              onClick={openAllMovimentos}
              style={{
                flexShrink: 0, background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.3)",
                borderRadius: 8, padding: "6px 14px", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                transition: "background .15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(96,165,250,0.22)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(96,165,250,0.12)"}
            >
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>Ver</span>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>Movimentos</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Recent trades ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: "0.64rem", fontWeight: 700, color: MUTE, textTransform: "uppercase", letterSpacing: ".1em" }}>Últimas Trades</div>
        <button
          onClick={openAllTrades}
          style={{
            background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.3)",
            borderRadius: 8, padding: "6px 14px", cursor: "pointer",
            fontSize: "0.72rem", fontWeight: 700, color: "#fff",
            transition: "background .15s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(96,165,250,0.22)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(96,165,250,0.12)"}
        >
          Ver todas ({stats.n_trades})
        </button>
      </div>
      {recent.map(t => (
        <div key={t.id} className="trade-row" style={{ cursor: "pointer" }} onClick={() => openSymbolHistory(t.simbolo)}>
          <span className="trade-symbol">{t.simbolo}</span>
          <span className={`badge ${t.pl_eur > 0 ? "win" : "loss"}`}>{t.pl_eur > 0 ? "Win" : "Loss"}</span>
          <span style={{ color: MUTE, fontSize: 12 }}>{t.tipo_ordem}</span>
          <span style={{ color: MUTE, fontSize: 12 }}>{fmtPais(t.pais)}</span>
          <span className={`trade-pl ${t.pl_eur > 0 ? "win" : "loss"}`}>{fmt(t.pl_eur)}</span>
          <span className="trade-date">{t.data_fecho?.slice(0, 10)}</span>
        </div>
      ))}
      </div>{/* ── fim do conteúdo com scroll ── */}

      {/* ── Modal ── */}
      {modal && (
        <Modal title={modal.title} summary={modal.summary} brokers={modal.brokers} onClose={closeModal}>
          {modal.trades && !modal.detailed && (
            <table className="data-table">
              <thead><tr>
                <th>Símbolo</th><th>Data</th><th>Tipo</th><th>País</th><th>Corretora</th>
                <th style={{ textAlign: "right" }}>P&L €</th>
              </tr></thead>
              <tbody>
                {modal.trades.map(t => (
                  <tr key={t.id} style={{ cursor: "pointer" }}
                    onClick={() => pushModal({ title: `📌 ${t.simbolo} — ${t.data_fecho?.slice(0,10)??""}`, trades: [t], detailed: true, brokers: brokerTotals([t]), summary: { label: "1 trade", value: t.pl_eur ?? 0 } })}>
                    <td style={{ fontWeight: 700, color: "var(--text)" }}>{t.simbolo}</td>
                    <td>{t.data_fecho?.slice(0, 10) ?? "—"}</td>
                    <td>{t.tipo_ordem ?? <span style={{ color: MUTE }}>—</span>}</td>
                    <td>{fmtPais(t.pais) ?? <span style={{ color: MUTE }}>—</span>}</td>
                    <td>{t.corretora}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: t.pl_eur >= 0 ? GREEN : RED }}>{fmt(t.pl_eur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {modal.trades && modal.detailed && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {modal.trades.map(t => (
                <div key={t.id} style={{ background: "var(--hover)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontWeight: 700, color: "var(--text)", minWidth: 70 }}>{t.simbolo}</span>
                    <span className={`badge ${t.pl_eur > 0 ? "win" : "loss"}`}>{t.pl_eur > 0 ? "Win" : "Loss"}</span>
                    <span style={{ fontSize: 11, color: t.categoria === "CFD" ? RED : MUTE, fontWeight: t.categoria === "CFD" ? 700 : 400 }}>{t.categoria}</span>
                    <span style={{ color: MUTE, fontSize: 11 }}>{t.tipo_ordem}</span>
                    <span style={{ marginLeft: "auto", fontWeight: 700, color: t.pl_eur >= 0 ? GREEN : RED }}>{fmt(t.pl_eur)}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px 16px", padding: "12px 14px", fontSize: 12 }}>
                    {[
                      ["Corretora",      t.corretora],
                      ["Conta",          t.conta],
                      ["Data Abertura",  t.data_abertura?.slice(0, 19)?.replace("T", " ")],
                      ["Data Fecho",     t.data_fecho?.slice(0, 19)?.replace("T", " ")],
                      ["Volume",         t.volume],
                      ["Preço Abertura", t.preco_abertura != null ? `€ ${Number(t.preco_abertura).toFixed(4)}` : "—"],
                      ["Preço Fecho",    t.preco_fecho    != null ? `€ ${Number(t.preco_fecho).toFixed(4)}`    : "—"],
                      ["Moeda",          t.moeda_original],
                      ["Valor Compra",   t.valor_compra_eur != null ? `€ ${Number(t.valor_compra_eur).toFixed(2)}` : "—"],
                      ["Valor Venda",    t.valor_venda_eur  != null ? `€ ${Number(t.valor_venda_eur).toFixed(2)}`  : "—"],
                      ["Comissão",       t.comissao_eur     != null ? `€ ${Number(t.comissao_eur).toFixed(2)}`     : "—"],
                      ["País",           fmtPais(t.pais)],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <div style={{ color: MUTE, textTransform: "uppercase", fontSize: 10, letterSpacing: ".06em" }}>{k}</div>
                        <div style={{ color: "var(--text)", marginTop: 2 }}>{v ?? "—"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {modal.divs && (
            <>
              {modal.detailed && modal.trades?.length > 0 && (
                <div style={{ fontSize: "0.64rem", fontWeight: 700, color: MUTE, textTransform: "uppercase", letterSpacing: ".1em", marginTop: 20, marginBottom: 10 }}>Dividendos</div>
              )}
              <table className="data-table">
                <thead><tr>
                  <th>Símbolo</th><th>Data</th><th>Bruto €</th><th>Retenção €</th><th>Líquido €</th><th>País</th>
                </tr></thead>
                <tbody>
                  {modal.divs.map((d, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 700, color: "var(--text)" }}>{d.simbolo}</td>
                      <td>{d.data_pagamento?.slice(0, 10)}</td>
                      <td style={{ color: GREEN }}>€ {(d.valor_bruto_eur || 0).toFixed(2)}</td>
                      <td style={{ color: RED }}>-€ {(d.retencao_eur || 0).toFixed(2)}</td>
                      <td style={{ color: GREEN, fontWeight: 700 }}>€ {(d.valor_liq_eur || 0).toFixed(2)}</td>
                      <td>{d.pais_fonte}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
