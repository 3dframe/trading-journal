import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import Modal from "../components/Modal.jsx";

const fmt = v =>
  (v >= 0 ? "+" : "") + "€ " +
  Math.abs(v).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtAbs = v =>
  "€ " + Math.abs(v).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const GREEN = "#10b981", RED = "#f43f5e", BLUE = "#60a5fa",
      PINK = "#f472b6", AMBER = "#fbbf24", PURPLE = "#a78bfa", MUTE = "#6b7280";

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

function MiniDonut({ pct, label, color, onClick }) {
  const safe = isFinite(pct) ? Math.min(100, Math.max(0, pct || 0)) : 0;
  return (
    <div style={{ textAlign: "center", cursor: onClick ? "pointer" : "default" }} onClick={onClick}>
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

export default function Dashboard({ user }) {
  const [anos, setAnos]           = useState([]);
  const [ano, setAno]             = useState(null);
  const [stats, setStats]         = useState(null);
  const [equity, setEquity]       = useState([]);
  const [weekly, setWeekly]       = useState([]);
  const [bySymbol, setBySymbol]   = useState([]);
  const [allTrades, setAllTrades] = useState([]);
  const [allDivs, setAllDivs]     = useState([]);
  const [divTotal, setDivTotal]   = useState(null);
  const [modal, setModal]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [anosReady, setAnosReady] = useState(false);

  useEffect(() => {
    axios.get("/api/trades/anos").then(r => {
      setAnos(r.data);
      if (r.data.length) setAno(r.data[0]);
    }).finally(() => setAnosReady(true));
  }, []);

  const load = useCallback(async (a) => {
    if (!a) return;
    setLoading(true);
    try {
      const [s, eq, wk, sym, rec, divs, divsAll] = await Promise.all([
        axios.get(`/api/trades/stats?ano=${a}`),
        axios.get(`/api/trades/equity?ano=${a}`),
        axios.get(`/api/trades/by-week?ano=${a}`),
        axios.get(`/api/trades/by-symbol?ano=${a}`),
        axios.get(`/api/trades?ano=${a}`),
        axios.get(`/api/dividends/total?ano=${a}`),
        axios.get(`/api/dividends?ano=${a}`),
      ]);
      setStats(s.data);
      setEquity(eq.data);
      setWeekly(wk.data);
      setBySymbol(sym.data.slice(0, 8));
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

  const openAllTrades  = () => setModal({ title: "📋 Todas as Trades", trades: allTrades, summary: { label: `${allTrades.length} trades`, value: stats?.net_pl ?? 0 } });
  const openWins       = () => { const t = allTrades.filter(t => t.pl_eur > 0);  setModal({ title: "✅ Trades Ganhas",   trades: t, summary: { label: `${t.length} trades`, value: tradeSum(t) } }); };
  const openLosses     = () => { const t = allTrades.filter(t => t.pl_eur < 0);  setModal({ title: "❌ Trades Perdidas", trades: t, summary: { label: `${t.length} trades`, value: tradeSum(t) } }); };
  const openDivs       = () => setModal({ title: "💰 Dividendos", divs: allDivs, summary: { label: `${allDivs.length} pagamentos`, value: divTotal?.total_liq ?? 0 } });
  const openBestDay    = () => { const d = stats?.best_day_date;  const t = allTrades.filter(t => t.data_fecho?.slice(0, 10) === d); setModal({ title: `📈 Melhor Dia — ${d ?? ""}`, trades: t, summary: { label: `${t.length} trades`, value: stats?.best_day ?? 0 } }); };
  const openWorstDay   = () => { const d = stats?.worst_day_date; const t = allTrades.filter(t => t.data_fecho?.slice(0, 10) === d); setModal({ title: `📉 Pior Dia — ${d ?? ""}`,   trades: t, summary: { label: `${t.length} trades`, value: stats?.worst_day ?? 0 } }); };
  const openCategory   = (cat, label, emoji) => { const t = allTrades.filter(t => t.categoria === cat); setModal({ title: `${emoji} ${label}`, trades: t, summary: { label: `${t.length} trades`, value: tradeSum(t) } }); };

  const matchSymbol = (a, b) => {
    if (!a || !b) return false;
    if (a === b) return true;
    const base = s => s.split(".")[0].toUpperCase();
    return base(a) === base(b);
  };

  const openSymbolHistory = (simbolo) => {
    const trades  = allTrades.filter(t => matchSymbol(t.simbolo, simbolo));
    const symDivs = allDivs.filter(d => matchSymbol(d.simbolo, simbolo));
    const plT = trades.reduce((s, t) => s + (t.pl_eur ?? 0), 0);
    const plD = symDivs.reduce((s, d) => s + (d.valor_liq_eur ?? 0), 0);
    const subLabel = [
      trades.length  ? `${trades.length} trade${trades.length !== 1 ? "s" : ""}` : null,
      symDivs.length ? `${symDivs.length} dividendo${symDivs.length !== 1 ? "s" : ""}` : null,
    ].filter(Boolean).join(" · ");
    setModal({ title: `📌 ${simbolo} — Histórico`, trades, detailed: true, divs: symDivs.length > 0 ? symDivs : null, summary: { label: subLabel, value: plT + plD } });
  };

  const maxDrawdown = useMemo(() => {
    if (!equity.length) return 0;
    let peak = equity[0].equity, maxDD = 0;
    for (const p of equity) {
      if (p.equity > peak) peak = p.equity;
      const dd = peak - p.equity;
      if (dd > maxDD) maxDD = dd;
    }
    return maxDD;
  }, [equity]);

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
  const totalIncome = (stats.net_pl ?? 0) + divLiq;
  const expectancy  = stats.n_trades > 0 ? (stats.net_pl ?? 0) / stats.n_trades : 0;
  const top8sym     = [...bySymbol].sort((a, b) => a.pl_total - b.pl_total);
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

  // % of total absolute P&L each category contributes
  const allCatAbs = Math.abs(stockSt.pl) + Math.abs(cfdSt.pl) + Math.abs(optionSt.pl) + Math.abs(divLiq);
  const catPct    = val => allCatAbs > 0 ? Math.abs(val) / allCatAbs * 100 : 0;

  const catDonutData = [
    stockSt.n > 0  && { name: "Ações",      value: Math.abs(stockSt.pl),  pl: stockSt.pl,  color: BLUE },
    cfdSt.n > 0    && { name: "CFDs",        value: Math.abs(cfdSt.pl),    pl: cfdSt.pl,    color: AMBER },
    optionSt.n > 0 && { name: "Opções",      value: Math.abs(optionSt.pl), pl: optionSt.pl, color: PINK },
    divLiq !== 0   && { name: "Dividendos",  value: Math.abs(divLiq),      pl: divLiq,      color: GREEN },
  ].filter(Boolean);

  const totalWinsVal   = (stats.avg_win  || 0) * (stats.n_wins   || 0);
  const totalLossesVal = Math.abs(stats.avg_loss || 0) * (stats.n_losses || 0);

  // Inline hover helpers (no CSS hover state needed for inline styles)
  const hoverGreen = { onMouseEnter: e => { e.currentTarget.style.background = "rgba(16,185,129,0.14)"; }, onMouseLeave: e => { e.currentTarget.style.background = "rgba(16,185,129,0.07)"; } };
  const hoverRed   = { onMouseEnter: e => { e.currentTarget.style.background = "rgba(244,63,94,0.14)";  }, onMouseLeave: e => { e.currentTarget.style.background = "rgba(244,63,94,0.07)"; } };

  return (
    <>
      {/* ── Header ── */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="page-title">Visão Geral</div>
          <div className="page-sub">Resumo do desempenho e da sua atividade de trading</div>
        </div>
        <select value={ano ?? ""} onChange={e => setAno(Number(e.target.value))}>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* ── Top 5 stat icon cards ── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
        <StatIconCard icon={IcoLine(PINK)}  colorBg="rgba(244,114,182,0.15)" color={PINK}   value={fmt(stats.net_pl ?? 0)}   label="Resultado Líquido" onClick={openAllTrades} />
        <StatIconCard icon={IcoGrid(BLUE)}  colorBg="rgba(96,165,250,0.15)"  color={BLUE}   value={stats.n_trades}           label="Total de Trades"   onClick={openAllTrades} />
        <StatIconCard icon={IcoPct(AMBER)}  colorBg="rgba(251,191,36,0.15)"  color={AMBER}  value={`${wr.toFixed(1)}%`}      label="Win Rate"          onClick={openWins} />
        <StatIconCard icon={IcoCoin(GREEN)} colorBg="rgba(16,185,129,0.15)"  color={GREEN}  value={fmt(divLiq)}              label="Dividendos"        onClick={openDivs} />
        <StatIconCard icon={IcoBar(PURPLE)} colorBg="rgba(167,139,250,0.15)" color={PURPLE} value={pf.toFixed(2)}            label="Profit Factor"     onClick={openAllTrades} />
      </div>

      {/* ── Middle row: Summary + Donuts ── */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 16, marginBottom: 20 }}>

        {/* Left: Total Acumulado + P&L por Semana inline */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text)", marginBottom: 2 }}>Total Acumulado</div>
          <div style={{ fontSize: "0.72rem", color: MUTE, marginBottom: 20 }}>
            {new Date().toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" })}
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: "0.64rem", color: MUTE, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>Este Ano</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: "2.1rem", fontWeight: 800, letterSpacing: "-1px", color: totalIncome >= 0 ? GREEN : RED }}>
                {totalIncome >= 0 ? "+" : ""}{fmtAbs(totalIncome)}
              </div>
              <Tip text={`Profit Factor: rácio entre ganhos e perdas totais.\nValor acima de 1 significa estratégia lucrativa.`}>
                <span style={{ background: pf >= 1 ? "rgba(16,185,129,0.12)" : "rgba(244,63,94,0.12)", color: pf >= 1 ? GREEN : RED, fontSize: "0.7rem", fontWeight: 700, padding: "3px 9px", borderRadius: 12, cursor: "help" }}>
                  {pf.toFixed(2)}x PF
                </span>
              </Tip>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
            <div onClick={openBestDay} {...hoverGreen} style={{ flex: 1, background: "rgba(16,185,129,0.07)", borderRadius: 10, padding: "12px 14px", border: "1px solid rgba(16,185,129,0.18)", cursor: "pointer", transition: "background .2s" }}>
              <div style={{ fontSize: "0.6rem", color: GREEN, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 5 }}>Melhor Dia</div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: GREEN }}>{fmt(stats.best_day ?? 0)}</div>
              <div style={{ fontSize: "0.64rem", color: MUTE, marginTop: 2 }}>{stats.best_day_date ?? "—"}</div>
            </div>
            <div onClick={openWorstDay} {...hoverRed} style={{ flex: 1, background: "rgba(244,63,94,0.07)", borderRadius: 10, padding: "12px 14px", border: "1px solid rgba(244,63,94,0.18)", cursor: "pointer", transition: "background .2s" }}>
              <div style={{ fontSize: "0.6rem", color: RED, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 5 }}>Pior Dia</div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: RED }}>{fmt(stats.worst_day ?? 0)}</div>
              <div style={{ fontSize: "0.64rem", color: MUTE, marginTop: 2 }}>{stats.worst_day_date ?? "—"}</div>
            </div>
          </div>

          <div style={{ fontSize: "0.6rem", fontWeight: 700, color: MUTE, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10 }}>P&L por Semana</div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={weekly} barSize={9}>
              <XAxis dataKey="semana" tick={{ fill: MUTE, fontSize: 9 }} tickFormatter={s => s?.slice(5)} interval="preserveStartEnd" axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<TooltipDark />} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
              <Bar dataKey="pl" radius={[3,3,0,0]}>
                {weekly.map((w, i) => <Cell key={i} fill={w.pl >= 0 ? GREEN : RED} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Right: 4 mini donuts */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: "0.64rem", fontWeight: 700, color: MUTE, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4 }}>Categorias</div>
          <div style={{ fontSize: "0.72rem", color: MUTE, marginBottom: 22 }}>% do P&L total por categoria</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, justifyItems: "center" }}>
            <MiniDonut pct={catPct(stockSt.pl)}  label="Ações"      color={BLUE}  onClick={() => openCategory("STOCK",  "Ações",  "📈")} />
            <MiniDonut pct={catPct(optionSt.pl)} label="Opções"     color={PINK}  onClick={() => openCategory("OPTION", "Opções", "🎯")} />
            <MiniDonut pct={catPct(cfdSt.pl)}    label="CFDs"       color={AMBER} onClick={() => openCategory("CFD",    "CFDs",   "⚡")} />
            <MiniDonut pct={catPct(divLiq)}       label="Dividendos" color={GREEN} onClick={openDivs} />
          </div>
          <div
            onClick={openAllTrades}
            style={{ marginTop: 24, padding: "14px 16px", background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid var(--border)", cursor: "pointer", transition: "background .2s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--text)" }}>Ver todos os movimentos</div>
                <div style={{ fontSize: "0.68rem", color: MUTE, marginTop: 3 }}>{stats.n_trades} operações · {allDivs.length} dividendos</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom row: Equity + Wins/Losses + P&L donut ── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16, marginBottom: 24 }}>

        {/* Curva de Equity — bar chart */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: "0.64rem", fontWeight: 700, color: MUTE, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 16 }}>Curva de Equity</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={equity} barSize={5}>
              <XAxis dataKey="dia" tick={{ fill: MUTE, fontSize: 9 }} tickFormatter={d => d?.slice(5)} interval="preserveStartEnd" axisLine={false} tickLine={false} />
              <YAxis domain={["auto","auto"]} tick={{ fill: MUTE, fontSize: 9 }} tickFormatter={v => `€${v.toFixed(0)}`} width={56} axisLine={false} tickLine={false} />
              <Tooltip content={<TooltipDark />} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
              <Bar dataKey="equity" radius={[3,3,0,0]}>
                {equity.map((e, i) => <Cell key={i} fill={e.equity >= 0 ? AMBER : RED} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Wins vs Losses */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: "0.64rem", fontWeight: 700, color: MUTE, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 16 }}>Wins vs Losses</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 14, fontSize: "0.7rem" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: GREEN }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: GREEN, display: "inline-block" }}/>Wins ({stats.n_wins})</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: RED   }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: RED,   display: "inline-block" }}/>Losses ({stats.n_losses})</span>
          </div>
          <div onClick={openWins} {...hoverGreen} style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.18)", borderRadius: 10, padding: "13px 15px", marginBottom: 10, cursor: "pointer", transition: "background .2s" }}>
            <div style={{ fontSize: "0.61rem", color: GREEN, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 5 }}>Income</div>
            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text)" }}>{fmtAbs(totalWinsVal)}</div>
            <div style={{ fontSize: "0.63rem", color: GREEN, marginTop: 4 }}>Avg {fmt(stats.avg_win ?? 0)}</div>
          </div>
          <div onClick={openLosses} {...hoverRed} style={{ background: "rgba(244,63,94,0.07)", border: "1px solid rgba(244,63,94,0.18)", borderRadius: 10, padding: "13px 15px", cursor: "pointer", transition: "background .2s" }}>
            <div style={{ fontSize: "0.61rem", color: RED, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 5 }}>Expense</div>
            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text)" }}>{fmtAbs(totalLossesVal)}</div>
            <div style={{ fontSize: "0.63rem", color: RED, marginTop: 4 }}>Avg {fmt(stats.avg_loss ?? 0)}</div>
          </div>
        </div>

        {/* P&L by category donut */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: "0.64rem", fontWeight: 700, color: MUTE, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>Lucro / Perda</div>
          {catDonutData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={catDonutData} dataKey="value" innerRadius={42} outerRadius={62} paddingAngle={3}>
                    {catDonutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n, { payload }) => [fmt(payload.pl), payload.name]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 10 }}>
                {catDonutData.map(d => (
                  <div key={d.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: "0.72rem" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, display: "inline-block", flexShrink: 0 }}/>
                      <span style={{ color: MUTE }}>{d.name}</span>
                    </span>
                    <span style={{ fontWeight: 700, color: d.pl >= 0 ? GREEN : RED }}>{fmt(d.pl)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", color: MUTE, padding: 40, fontSize: "0.8rem" }}>Sem dados suficientes</div>
          )}
        </div>
      </div>

      {/* ── Métricas detalhadas ── */}
      <div style={{ fontSize: "0.64rem", fontWeight: 700, color: MUTE, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 12 }}>Métricas Detalhadas</div>
      <div className="metric-grid" style={{ marginBottom: 24 }}>
        {[
          { label: "Expectancy",      value: fmt(expectancy),                   sub: "por trade",              color: expectancy >= 0 ? "green" : "red", onClick: openAllTrades },
          { label: "Max Drawdown",    value: `-${fmtAbs(maxDrawdown)}`,         sub: "pico → vale",            color: "red", onClick: openAllTrades },
          { label: "Avg Win",         value: fmt(stats.avg_win ?? 0),           sub: "por trade ganho",        color: "green", onClick: openWins },
          { label: "Avg Loss",        value: fmt(stats.avg_loss ?? 0),          sub: "por trade perdido",      color: "red", onClick: openLosses },
          { label: "Trades Ganhos",   value: stats.n_wins,                      sub: `de ${stats.n_trades} total`, color: "green", onClick: openWins },
          { label: "Trades Perdidos", value: stats.n_losses,                    sub: `de ${stats.n_trades} total`, color: "red", onClick: openLosses },
          { label: "Ações",           value: fmt(stockSt.pl),                   sub: `${stockSt.n} trades · ${stockSt.wr.toFixed(0)}% WR`, color: stockSt.pl >= 0 ? "green" : "red", onClick: () => openCategory("STOCK", "Ações", "📈") },
          { label: "CFDs",            value: fmt(cfdSt.pl),                     sub: `${cfdSt.n} trades · ${cfdSt.wr.toFixed(0)}% WR`, color: cfdSt.pl >= 0 ? "green" : "red", onClick: () => openCategory("CFD", "CFDs", "⚡") },
          { label: "Opções",          value: fmt(optionSt.pl),                  sub: `${optionSt.n} trades · ${optionSt.wr.toFixed(0)}% WR`, color: optionSt.pl >= 0 ? "green" : "red", onClick: () => openCategory("OPTION", "Opções", "🎯") },
        ].map(({ label, value, sub, color, onClick }) => (
          <div key={label} className="metric-card clickable" onClick={onClick}>
            <div className="metric-label">{label}</div>
            <div className={`metric-value ${color}`}>{value}</div>
            <div className="metric-sub">{sub}</div>
          </div>
        ))}
      </div>

      {/* ── P&L por Símbolo + Win/Loss donut (kept) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: "0.64rem", fontWeight: 700, color: MUTE, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 16 }}>P&L por Símbolo (Top 8)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={top8sym} layout="vertical" barSize={12}>
              <XAxis type="number" tick={{ fill: MUTE, fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="simbolo" type="category" tick={{ fill: MUTE, fontSize: 9 }} width={58} axisLine={false} tickLine={false} />
              <Tooltip content={<TooltipDark />} />
              <ReferenceLine x={0} stroke="rgba(255,255,255,0.1)" />
              <Bar dataKey="pl_total">
                {top8sym.map((s, i) => <Cell key={i} fill={s.pl_total >= 0 ? GREEN : RED} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: "0.64rem", fontWeight: 700, color: MUTE, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 16 }}>Win / Loss</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={[{ v: stats.n_wins }, { v: stats.n_losses }]} dataKey="v" innerRadius={48} outerRadius={70} paddingAngle={3}>
                <Cell fill={GREEN} /><Cell fill={RED} />
              </Pie>
              <Tooltip formatter={(v, n, p) => [v + " trades", p.dataIndex === 0 ? "Wins" : "Losses"]} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", justifyContent: "center", gap: 20, fontSize: "0.72rem", marginBottom: 8 }}>
            <span style={{ color: GREEN }}>● Wins ({stats.n_wins})</span>
            <span style={{ color: RED }}>● Losses ({stats.n_losses})</span>
          </div>
          <div style={{ textAlign: "center", fontSize: "0.9rem", color: wr >= 50 ? GREEN : RED, fontWeight: 800 }}>
            {wr.toFixed(0)}% Win Rate
          </div>
        </div>
      </div>

      {/* ── Recent trades ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: "0.64rem", fontWeight: 700, color: MUTE, textTransform: "uppercase", letterSpacing: ".1em" }}>Últimas Trades</div>
        <button className="btn btn-secondary" style={{ fontSize: "0.78rem", padding: "5px 12px" }} onClick={openAllTrades}>
          Ver todas ({stats.n_trades})
        </button>
      </div>
      {recent.map(t => (
        <div key={t.id} className="trade-row" style={{ cursor: "pointer" }} onClick={() => openSymbolHistory(t.simbolo)}>
          <span className="trade-symbol">{t.simbolo}</span>
          <span className={`badge ${t.pl_eur > 0 ? "win" : "loss"}`}>{t.pl_eur > 0 ? "Win" : "Loss"}</span>
          <span style={{ color: MUTE, fontSize: 12 }}>{t.tipo_ordem}</span>
          <span style={{ color: MUTE, fontSize: 12 }}>{t.pais}</span>
          <span className={`trade-pl ${t.pl_eur > 0 ? "win" : "loss"}`}>{fmt(t.pl_eur)}</span>
          <span className="trade-date">{t.data_fecho?.slice(0, 10)}</span>
        </div>
      ))}

      {/* ── Modal ── */}
      {modal && (
        <Modal title={modal.title} summary={modal.summary} onClose={() => setModal(null)}>
          {modal.trades && !modal.detailed && (
            <table className="data-table">
              <thead><tr>
                <th>Símbolo</th><th>Data</th><th>Tipo</th><th>País</th><th>Corretora</th>
                <th style={{ textAlign: "right" }}>P&L €</th>
              </tr></thead>
              <tbody>
                {modal.trades.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 700, color: "var(--text)" }}>{t.simbolo}</td>
                    <td>{t.data_fecho?.slice(0, 10)}</td>
                    <td>{t.tipo_ordem}</td>
                    <td>{t.pais}</td>
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
                      ["País",           t.pais],
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
    </>
  );
}
