import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import Modal from "../components/Modal.jsx";

const fmt = v =>
  (v >= 0 ? "+" : "") + "€ " +
  Math.abs(v).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtAbs = v =>
  "€ " + Math.abs(v).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const GREEN = "#10b981", RED = "#f43f5e", BLUE = "#4f6af5", MUTE = "#4e6080";

const TooltipDark = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1a2030", border: "1px solid #2a2f3e", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <div style={{ color: MUTE, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.value >= 0 ? GREEN : RED, fontWeight: 700 }}>
          {fmt(p.value)}
        </div>
      ))}
    </div>
  );
};

function MetricCard({ label, value, sub, color = "white", onClick }) {
  return (
    <div className={`metric-card ${onClick ? "clickable" : ""}`} onClick={onClick}>
      <div className="metric-label">{label}</div>
      <div className={`metric-value ${color}`}>{value}</div>
      <div className="metric-sub">{sub}</div>
    </div>
  );
}

export default function Dashboard({ user }) {
  const [anos, setAnos]         = useState([]);
  const [ano, setAno]           = useState(null);
  const [stats, setStats]       = useState(null);
  const [equity, setEquity]     = useState([]);
  const [weekly, setWeekly]     = useState([]);
  const [bySymbol, setBySymbol] = useState([]);
  const [recent, setRecent]     = useState([]);
  const [allTrades, setAllTrades] = useState([]);
  const [allDivs, setAllDivs]   = useState([]);
  const [divTotal, setDivTotal] = useState(null);
  const [modal, setModal]       = useState(null);
  const [loading, setLoading]   = useState(true);
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
      setRecent(rec.data.slice(0, 8));
      setDivTotal(divs.data);
      setAllDivs(divsAll.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(ano); }, [ano, load]);

  const tradeSum = (list) => list.reduce((s, t) => s + (t.pl_eur ?? 0), 0);

  const openAllTrades = () => {
    const value = stats?.net_pl ?? 0;
    setModal({ title: "📋 Todas as Trades", trades: allTrades,
      summary: { label: `${allTrades.length} trades`, value } });
  };
  const openWins = () => {
    const trades = allTrades.filter(t => t.pl_eur > 0);
    setModal({ title: "✅ Trades Ganhas", trades,
      summary: { label: `${trades.length} trades`, value: tradeSum(trades) } });
  };
  const openLosses = () => {
    const trades = allTrades.filter(t => t.pl_eur < 0);
    setModal({ title: "❌ Trades Perdidas", trades,
      summary: { label: `${trades.length} trades`, value: tradeSum(trades) } });
  };
  const openDivs = () => {
    setModal({ title: "💰 Dividendos", divs: allDivs,
      summary: { label: `${allDivs.length} pagamentos`, value: divTotal?.total_liq ?? 0 } });
  };
  const openBestDay = () => {
    const date   = stats?.best_day_date;
    const trades = allTrades.filter(t => t.data_fecho?.slice(0, 10) === date);
    setModal({ title: `📈 Melhor Dia — ${date ?? ""}`, trades,
      summary: { label: `${trades.length} trades`, value: stats?.best_day ?? 0 } });
  };
  const openWorstDay = () => {
    const date   = stats?.worst_day_date;
    const trades = allTrades.filter(t => t.data_fecho?.slice(0, 10) === date);
    setModal({ title: `📉 Pior Dia — ${date ?? ""}`, trades,
      summary: { label: `${trades.length} trades`, value: stats?.worst_day ?? 0 } });
  };
  const openCategory = (categoria, label, emoji) => {
    const trades = allTrades.filter(t => t.categoria === categoria);
    const pl     = tradeSum(trades);
    setModal({ title: `${emoji} ${label}`, trades,
      summary: { label: `${trades.length} trades`, value: pl } });
  };

  const matchSymbol = (a, b) => {
    if (!a || !b) return false;
    if (a === b) return true;
    const base = s => s.split(".")[0].toUpperCase();
    return base(a) === base(b);
  };

  const openSymbolHistory = (simbolo) => {
    const trades   = allTrades.filter(t => matchSymbol(t.simbolo, simbolo));
    const symDivs  = allDivs.filter(d => matchSymbol(d.simbolo, simbolo));
    const plTrades = trades.reduce((s, t) => s + (t.pl_eur ?? 0), 0);
    const plDivs   = symDivs.reduce((s, d) => s + (d.valor_liq_eur ?? 0), 0);
    const subLabel = [
      trades.length  ? `${trades.length} trade${trades.length !== 1 ? "s" : ""}` : null,
      symDivs.length ? `${symDivs.length} dividendo${symDivs.length !== 1 ? "s" : ""}` : null,
    ].filter(Boolean).join(" · ");
    setModal({
      title: `📌 ${simbolo} — Histórico`,
      trades,
      divs: symDivs.length > 0 ? symDivs : null,
      detailed: true,
      summary: { label: subLabel, value: plTrades + plDivs },
    });
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

  if (!anosReady) return <div className="spinner" />;

  if (anosReady && anos.length === 0) {
    const initials = user?.slice(0, 2).toUpperCase() ?? "?";
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        minHeight: "70vh", textAlign: "center", gap: 24 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: "linear-gradient(135deg, #4f6af5, #7c3aed)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.5rem", fontWeight: 800, color: "#fff", letterSpacing: "-1px",
        }}>{initials}</div>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "var(--text)" }}>
            Bem-vindo, {user}!
          </h2>
          <p style={{ margin: "10px 0 0", fontSize: "0.9rem", color: "var(--mute)", maxWidth: 420, lineHeight: 1.7 }}>
            A tua conta está pronta. Ainda não tens relatórios carregados —
            começa por importar as tuas operações para veres o teu desempenho aqui.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{
              background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
              padding: "16px 20px", width: 160, textAlign: "left",
            }}>
              <div style={{ fontSize: "1.4rem", marginBottom: 6 }}>📥</div>
              <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text)" }}>Importar Dados</div>
              <div style={{ fontSize: "0.72rem", color: "var(--mute)", marginTop: 4, lineHeight: 1.5 }}>
                Carrega os teus ficheiros de operações via a página de importação
              </div>
            </div>
            <div style={{
              background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
              padding: "16px 20px", width: 160, textAlign: "left",
            }}>
              <div style={{ fontSize: "1.4rem", marginBottom: 6 }}>📊</div>
              <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text)" }}>Ver Estatísticas</div>
              <div style={{ fontSize: "0.72rem", color: "var(--mute)", marginTop: 4, lineHeight: 1.5 }}>
                Após importares, as tuas métricas e gráficos aparecem aqui automaticamente
              </div>
            </div>
          </div>
          <p style={{ fontSize: "0.72rem", color: "var(--mute)", margin: 0 }}>
            Usa o menu lateral para navegar entre as secções
          </p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="spinner" />;
  if (!stats)  return null;

  const wr          = stats.win_rate ?? 0;
  const pf          = stats.profit_factor ?? 0;
  const divLiq      = divTotal?.total_liq ?? 0;
  const totalIncome = (stats.net_pl ?? 0) + divLiq;
  const expectancy  = stats.n_trades > 0 ? (stats.net_pl ?? 0) / stats.n_trades : 0;
  const top8sym     = [...bySymbol].sort((a, b) => a.pl_total - b.pl_total);

  const catStats = (cat) => {
    const trades = allTrades.filter(t => t.categoria === cat);
    const pl     = tradeSum(trades);
    const wins   = trades.filter(t => t.pl_eur > 0).length;
    const wr     = trades.length > 0 ? (wins / trades.length * 100).toFixed(0) : 0;
    return { trades, pl, n: trades.length, wr };
  };
  const stockSt  = catStats("STOCK");
  const cfdSt    = catStats("CFD");
  const optionSt = catStats("OPTION");

  return (
    <>
      {/* Header */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="page-title">Visão Geral</div>
          <div className="page-sub">Resumo do desempenho e da sua atividade de trading</div>
        </div>
        <select value={ano ?? ""} onChange={e => setAno(Number(e.target.value))}>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Featured cards — primeira linha */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 12 }}>
        <MetricCard label="Resultado líquido" value={fmt(stats.net_pl ?? 0)}
          sub={`${stats.n_trades} operações`} color={stats.net_pl >= 0 ? "green" : "red"}
          onClick={openAllTrades} />
        <MetricCard label="Ações" value={fmt(stockSt.pl)}
          sub={`${stockSt.n} trades · ${stockSt.wr}% WR`} color={stockSt.pl >= 0 ? "green" : "red"}
          onClick={() => openCategory("STOCK", "Ações", "📈")} />
        <MetricCard label="CFDs" value={fmt(cfdSt.pl)}
          sub={`${cfdSt.n} trades · ${cfdSt.wr}% WR`} color={cfdSt.pl >= 0 ? "green" : "red"}
          onClick={() => openCategory("CFD", "CFDs", "⚡")} />
        <MetricCard label="Opções" value={fmt(optionSt.pl)}
          sub={`${optionSt.n} trades · ${optionSt.wr}% WR`} color={optionSt.pl >= 0 ? "green" : "red"}
          onClick={() => openCategory("OPTION", "Opções", "🎯")} />
        <MetricCard label="Dividendos" value={fmt(divLiq)}
          sub={`${divTotal?.n ?? 0} pagamentos recebidos`} color={divLiq > 0 ? "green" : "white"}
          onClick={openDivs} />
      </div>

      {/* Detailed metrics — segunda linha */}
      <div className="metric-grid">
        <MetricCard label="Total acumulado" value={fmt(totalIncome)}
          sub="operações + dividendos" color={totalIncome >= 0 ? "green" : "red"}
          onClick={openAllTrades} />
        <MetricCard label="Percentagem de ganhos" value={`${wr.toFixed(1)}%`}
          sub={`${stats.n_wins} ganhos / ${stats.n_losses} perdas`}
          color={wr >= 50 ? "green" : "red"} onClick={openWins} />
        <MetricCard label="Profit Factor" value={pf.toFixed(2)}
          sub="ganhos / perdas" color={pf >= 1 ? "green" : "red"}
          onClick={openAllTrades} />
        <MetricCard label="Expectancy" value={fmt(expectancy)}
          sub="por trade" color={expectancy >= 0 ? "green" : "red"}
          onClick={openAllTrades} />
        <MetricCard label="Avg Win" value={fmt(stats.avg_win ?? 0)}
          sub="por trade ganho" color="green" onClick={openWins} />
        <MetricCard label="Avg Loss" value={fmt(stats.avg_loss ?? 0)}
          sub="por trade perdido" color="red" onClick={openLosses} />
        <MetricCard label="Max Drawdown" value={`-${fmtAbs(maxDrawdown)}`}
          sub="pico → vale" color="red" onClick={openAllTrades} />
        <MetricCard label="Melhor Dia" value={fmt(stats.best_day ?? 0)}
          sub={stats.best_day_date ?? "dia mais lucrativo"}
          color={stats.best_day >= 0 ? "green" : "white"} onClick={openBestDay} />
        <MetricCard label="Pior Dia" value={fmt(stats.worst_day ?? 0)}
          sub={stats.worst_day_date ?? "dia mais negativo"}
          color="red" onClick={openWorstDay} />
      </div>

      {/* Charts row 1 */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="section-title">Curva de Equity</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={equity}>
              <defs>
                <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={BLUE} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="dia" tick={{ fill: MUTE, fontSize: 9 }}
                tickFormatter={d => d?.slice(5)} interval="preserveStartEnd" />
              <YAxis domain={["auto", "auto"]} tick={{ fill: MUTE, fontSize: 10 }}
                tickFormatter={v => `€${v >= 0 ? "+" : ""}${v.toFixed(0)}`} width={68} />
              <Tooltip content={<TooltipDark />} />
              <ReferenceLine y={0} stroke={MUTE} strokeDasharray="3 3" />
              <Area type="monotone" dataKey="equity" stroke={BLUE}
                fill="url(#equityGrad)" dot={false} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="section-title">P&L por Semana</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weekly} barSize={14}>
              <XAxis dataKey="semana" tick={{ fill: MUTE, fontSize: 9 }}
                tickFormatter={s => s?.slice(5)} interval="preserveStartEnd" />
              <YAxis tick={{ fill: MUTE, fontSize: 10 }} />
              <Tooltip content={<TooltipDark />} />
              <ReferenceLine y={0} stroke={MUTE} />
              <Bar dataKey="pl">
                {weekly.map((w, i) => <Cell key={i} fill={w.pl >= 0 ? GREEN : RED} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="section-title">Win / Loss</div>
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={[{ v: stats.n_wins }, { v: stats.n_losses }]}
                dataKey="v" innerRadius={55} outerRadius={80} paddingAngle={3}>
                <Cell fill={GREEN} /><Cell fill={RED} />
              </Pie>
              <Tooltip formatter={(v, n, p) => [v + " trades", p.dataIndex === 0 ? "Wins" : "Losses"]} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", justifyContent: "center", gap: 20, fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: GREEN }}>● Wins ({stats.n_wins})</span>
            <span style={{ color: RED }}>● Losses ({stats.n_losses})</span>
          </div>
          <div style={{ textAlign: "center", fontSize: 13, color: wr >= 50 ? GREEN : RED, fontWeight: 700 }}>
            {wr.toFixed(0)}% Win Rate
          </div>
        </div>
        <div className="card">
          <div className="section-title">P&L por Símbolo (Top 8)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={top8sym} layout="vertical" barSize={12}>
              <XAxis type="number" tick={{ fill: MUTE, fontSize: 10 }} />
              <YAxis dataKey="simbolo" type="category" tick={{ fill: MUTE, fontSize: 10 }} width={60} />
              <Tooltip content={<TooltipDark />} />
              <ReferenceLine x={0} stroke={MUTE} />
              <Bar dataKey="pl_total">
                {top8sym.map((s, i) => <Cell key={i} fill={s.pl_total >= 0 ? GREEN : RED} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent trades */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "20px 0 10px" }}>
        <div style={{ fontSize: "0.78rem", fontWeight: 700, color: MUTE, textTransform: "uppercase", letterSpacing: ".1em" }}>
          Últimas Trades
        </div>
        <button className="btn btn-secondary" style={{ fontSize: "0.78rem", padding: "5px 12px" }}
          onClick={openAllTrades}>
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

      {/* Modal */}
      {modal && (
        <Modal title={modal.title} summary={modal.summary} onClose={() => setModal(null)}>
          {modal.trades && !modal.detailed && (
            <table className="data-table">
              <thead><tr>
                <th>Símbolo</th><th>Data</th><th>Tipo</th>
                <th>País</th><th>Corretora</th><th style={{ textAlign: "right" }}>P&L €</th>
              </tr></thead>
              <tbody>
                {modal.trades.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 700, color: "var(--text)" }}>{t.simbolo}</td>
                    <td>{t.data_fecho?.slice(0, 10)}</td>
                    <td>{t.tipo_ordem}</td>
                    <td>{t.pais}</td>
                    <td>{t.corretora}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: t.pl_eur >= 0 ? GREEN : RED }}>
                      {fmt(t.pl_eur)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {modal.trades && modal.detailed && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {modal.trades.map(t => (
                <div key={t.id} style={{
                  background: "var(--hover)", border: "1px solid var(--border)",
                  borderRadius: 8, overflow: "hidden",
                }}>
                  {/* Card header */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px", borderBottom: "1px solid var(--border)",
                  }}>
                    <span style={{ fontWeight: 700, color: "var(--text)", minWidth: 70 }}>{t.simbolo}</span>
                    <span className={`badge ${t.pl_eur > 0 ? "win" : "loss"}`}>{t.pl_eur > 0 ? "Win" : "Loss"}</span>
                    <span style={{ fontSize: 11, color: t.categoria === "CFD" ? RED : MUTE, fontWeight: t.categoria === "CFD" ? 700 : 400 }}>{t.categoria}</span>
                    <span style={{ color: MUTE, fontSize: 11 }}>{t.tipo_ordem}</span>
                    <span style={{ marginLeft: "auto", fontWeight: 700, color: t.pl_eur >= 0 ? GREEN : RED }}>
                      {fmt(t.pl_eur)}
                    </span>
                  </div>
                  {/* Card body — grid de campos */}
                  <div style={{
                    display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "10px 16px", padding: "12px 14px", fontSize: 12,
                  }}>
                    {[
                      ["Corretora",       t.corretora],
                      ["Conta",           t.conta],
                      ["Data Abertura",   t.data_abertura?.slice(0, 19)?.replace("T", " ")],
                      ["Data Fecho",      t.data_fecho?.slice(0, 19)?.replace("T", " ")],
                      ["Volume",          t.volume],
                      ["Preço Abertura",  t.preco_abertura != null ? `€ ${Number(t.preco_abertura).toFixed(4)}` : "—"],
                      ["Preço Fecho",     t.preco_fecho    != null ? `€ ${Number(t.preco_fecho).toFixed(4)}`    : "—"],
                      ["Moeda",           t.moeda_original],
                      ["Valor Compra",    t.valor_compra_eur != null ? `€ ${Number(t.valor_compra_eur).toFixed(2)}` : "—"],
                      ["Valor Venda",     t.valor_venda_eur  != null ? `€ ${Number(t.valor_venda_eur).toFixed(2)}`  : "—"],
                      ["Comissão",        t.comissao_eur     != null ? `€ ${Number(t.comissao_eur).toFixed(2)}`     : "—"],
                      ["País",            t.pais],
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
              <div className="section-title" style={{ marginTop: 20, marginBottom: 10 }}>
                Dividendos
              </div>
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
