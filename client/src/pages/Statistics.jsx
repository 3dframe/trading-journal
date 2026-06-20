import { useState, useEffect } from "react";
import axios from "axios";
import Modal from "../components/Modal.jsx";
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, ReferenceLine, ScatterChart, Scatter,
} from "recharts";

const GREEN="#10b981",RED="#f43f5e",BLUE="#4f6af5",MUTE="#4e6080";
const fmt    = v => (v>=0?"+":"")+"€ "+Math.abs(v).toLocaleString("de-DE",{minimumFractionDigits:2});
const fmtPL  = v => (v<0?"-":"")+"€ "+Math.abs(v).toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2});
const brokerTotals = trades => Object.entries(
  trades.reduce((acc,t) => {
    const b = t.corretora||"—";
    if (!acc[b]) acc[b]={pl:0,n:0};
    acc[b].pl += t.pl_eur??0; acc[b].n++;
    return acc;
  }, {})
).sort((a,b) => Math.abs(b[1].pl)-Math.abs(a[1].pl));

const ChartTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(13,17,27,0.97)", border: "1px solid #2a3a5c",
      borderRadius: 8, padding: "9px 14px", fontSize: 12,
      boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
    }}>
      {label != null && <div style={{ color: MUTE, marginBottom: 5, fontWeight: 600 }}>{label}</div>}
      {payload.map((p, i) => {
        const [val, name] = formatter ? formatter(p.value, p.name, p) : [p.value, p.name];
        return (
          <div key={i} style={{ color: p.value >= 0 ? GREEN : RED, fontWeight: 700 }}>
            {name && <span style={{ color: MUTE, fontWeight: 400, marginRight: 6 }}>{name}:</span>}
            {val}
          </div>
        );
      })}
    </div>
  );
};

export default function Statistics() {
  const [anos, setAnos]   = useState([]);
  const [ano, setAno]     = useState(null);
  const [tab, setTab]     = useState(0);
  const [bySymbol, setSym] = useState([]);
  const [stats, setStats] = useState(null);
  const [all, setAll]     = useState([]);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    axios.get("/api/trades/anos").then(r => {
      setAnos(r.data);
      if (r.data.length) setAno(r.data[0]);
    });
  }, []);

  useEffect(() => {
    if (!ano) return;
    Promise.all([
      axios.get(`/api/trades/by-symbol?ano=${ano}`),
      axios.get(`/api/trades/stats?ano=${ano}`),
      axios.get(`/api/trades?ano=${ano}`),
    ]).then(([s, st, all]) => {
      setSym(s.data);
      setStats(st.data);
      setAll(all.data);
    });
  }, [ano]);

  const wins   = all.filter(t => t.pl_eur > 0);
  const losses = all.filter(t => t.pl_eur < 0);
  const pf     = stats?.profit_factor ?? 0;
  const rr     = stats?.avg_loss ? Math.abs((stats.avg_win||0) / stats.avg_loss) : 0;

  // Histogram bins
  const bins = (() => {
    if (!all.length) return [];
    const vals = all.map(t => t.pl_eur);
    const min = Math.floor(Math.min(...vals) / 25) * 25;
    const max = Math.ceil (Math.max(...vals) / 25) * 25;
    const result = [];
    for (let b = min; b < max; b += 25) {
      result.push({ bin: `${b}`, count: vals.filter(v => v >= b && v < b+25).length, pl: b });
    }
    return result;
  })();

  const openBin = (binData) => {
    const lo = Number(binData.bin);
    const hi = lo + 25;
    const trades = all.filter(t => (t.pl_eur ?? 0) >= lo && (t.pl_eur ?? 0) < hi);
    const total  = trades.reduce((s,t) => s+(t.pl_eur??0), 0);
    setModal({ title: `📊 Intervalo ${lo >= 0 ? "+" : ""}€${lo} a ${hi >= 0 ? "+" : ""}€${hi}`, trades, brokers: brokerTotals(trades), summary: { label: `${trades.length} trade${trades.length!==1?"s":""}`, value: total } });
  };

  const openAllDist = () => {
    const total = all.reduce((s,t) => s+(t.pl_eur??0), 0);
    setModal({ title: "📊 Distribuição — Todas as Trades", trades: all, brokers: brokerTotals(all), summary: { label: `${all.length} trades`, value: total } });
  };

  const tabs = ["📊 Por instrumento","📅 Por período","🎯 Distribuição"];

  return (
    <>
      <div className="page-header" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div><div className="page-title">Estatísticas</div></div>
        <select value={ano??""} onChange={e => setAno(Number(e.target.value))}>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="tabs">
        {tabs.map((t,i) => (
          <button key={i} className={`tab ${tab===i?"active":""}`} onClick={()=>setTab(i)}>{t}</button>
        ))}
      </div>

      {tab === 0 && (
        <>
          <div className="grid-2" style={{marginBottom:20}}>
            <div className="card">
              <div className="section-title">P&L por símbolo</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={[...bySymbol].sort((a,b)=>a.pl_total-b.pl_total)} layout="vertical" barSize={12}>
                  <XAxis type="number" tick={{fill:MUTE,fontSize:10}} />
                  <YAxis dataKey="simbolo" type="category" tick={{fill:MUTE,fontSize:10}} width={65} />
                  <Tooltip content={<ChartTooltip formatter={v => [fmt(v),"P&L"]} />} cursor={{ fill: "transparent" }} />
                  <ReferenceLine x={0} stroke={MUTE} />
                  <Bar dataKey="pl_total">
                    {bySymbol.map((s,i) => <Cell key={i} fill={s.pl_total>=0?GREEN:RED} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <div className="section-title">Percentagem de ganhos por símbolo</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={bySymbol.map(s=>({...s, wr:s.n_wins/s.n_trades*100}))} layout="vertical" barSize={12}>
                  <XAxis type="number" domain={[0,100]} tickFormatter={v=>v+"%"} tick={{fill:MUTE,fontSize:10}} />
                  <YAxis dataKey="simbolo" type="category" tick={{fill:MUTE,fontSize:10}} width={65} />
                  <Tooltip content={<ChartTooltip formatter={v => [v.toFixed(1)+"%","Win Rate"]} />} cursor={{ fill: "transparent" }} />
                  <ReferenceLine x={50} stroke={MUTE} strokeDasharray="4 2" />
                  <Bar dataKey="wr">
                    {bySymbol.map((s,i)=><Cell key={i} fill={s.n_wins/s.n_trades*100>=50?GREEN:RED} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="section-title">Resumo por instrumento</div>
          <table className="data-table">
            <thead><tr><th>Símbolo</th><th>Trades</th><th>Wins</th><th>Win Rate</th><th>P&L Total</th><th>P&L Médio</th></tr></thead>
            <tbody>
              {bySymbol.map(s => (
                <tr key={s.simbolo}>
                  <td style={{fontWeight:700,color:"var(--text)"}}>{s.simbolo}</td>
                  <td>{s.n_trades}</td>
                  <td>{s.n_wins}</td>
                  <td>{(s.n_wins/s.n_trades*100).toFixed(1)}%</td>
                  <td style={{color:s.pl_total>=0?GREEN:RED,fontWeight:700}}>{fmt(s.pl_total)}</td>
                  <td style={{color:s.avg_pl>=0?GREEN:RED}}>{fmt(s.avg_pl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === 1 && (
        <>
          <div className="grid-2">
            <div className="card">
              <div className="section-title">P&L por instrumento</div>
              {["STOCK","CFD","OPTION"].map(cat => {
                const catTrades = all.filter(t => t.categoria === cat);
                if (!catTrades.length) return null;
                const pl = catTrades.reduce((s,t)=>s+t.pl_eur,0);
                const wr = catTrades.filter(t=>t.pl_eur>0).length/catTrades.length*100;
                return (
                  <div key={cat} style={{background:"var(--hover)",border:"1px solid var(--border)",borderRadius:8,
                    padding:"14px 16px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontWeight:700,color:cat==="CFD"?RED:"var(--text)"}}>{cat}</div>
                      <div style={{fontSize:11,color:MUTE}}>{catTrades.length} trades · {wr.toFixed(1)}% WR</div>
                    </div>
                    <div style={{fontWeight:700,fontSize:"1.1rem",color:pl>=0?GREEN:RED}}>{fmt(pl)}</div>
                  </div>
                );
              })}
            </div>
            <div className="card">
              <div className="section-title">Métricas de risco</div>
              {[
                ["Factor de lucro", pf.toFixed(2),   pf>=1?GREEN:RED],
                ["Rácio risco/benefício",     rr.toFixed(2),   rr>=1?GREEN:RED],
                ["Ganho médio",       fmt(stats?.avg_win??0),   GREEN],
                ["Perda média",      fmt(stats?.avg_loss??0),  RED],
                ["Maior ganho",     fmt(stats?.max_win??0),   GREEN],
                ["Maior perda",    fmt(stats?.max_loss??0),  RED],
              ].map(([l,v,c]) => (
                <div key={l} style={{display:"flex",justifyContent:"space-between",
                  padding:"10px 0",borderBottom:"1px solid var(--border)"}}>
                  <span style={{color:MUTE}}>{l}</span>
                  <span style={{fontWeight:700,color:c}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 2 && (
        <div className="grid-2">
          <div className="card">
            <div style={{ marginBottom: 14 }}>
              <div className="section-title" style={{ color: "var(--text)", margin: 0 }}>Distribuição de P&L por Trade</div>
              <div style={{ fontSize: "0.7rem", color: MUTE, marginTop: 4 }}>Ano {ano}</div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={bins} barSize={10}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="bin" tick={{fill:MUTE,fontSize:9}} />
                <YAxis tick={{fill:MUTE,fontSize:10}} />
                <Tooltip content={<ChartTooltip formatter={v=>[v+" trades","Frequência"]} />} cursor={{ fill: "transparent" }} />
                <ReferenceLine x="0" stroke="rgba(255,255,255,0.22)" />
                <Bar dataKey="count" style={{ cursor: "pointer" }} onClick={openBin}>
                  {bins.map((b,i)=><Cell key={i} fill={b.pl>=0?GREEN:RED} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ borderTop: "1px dashed rgba(255,255,255,0.1)", marginTop: 12, paddingTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, fontSize: "0.67rem", color: MUTE, lineHeight: 1.6 }}>
                Frequência de trades agrupadas por intervalo de P&L em <span style={{ color: "var(--text)", fontWeight: 600 }}>Ano {ano}</span>. Barras a <span style={{ color: GREEN, fontWeight: 600 }}>verde</span> representam trades lucrativas, a <span style={{ color: RED, fontWeight: 600 }}>vermelho</span> trades com prejuízo. Clica numa barra para ver as trades desse intervalo.
              </div>
              <button
                onClick={openAllDist}
                style={{
                  flexShrink: 0, background: "rgba(79,106,245,0.12)", border: "1px solid rgba(79,106,245,0.3)",
                  borderRadius: 8, padding: "6px 14px", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                  transition: "background .15s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(79,106,245,0.22)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(79,106,245,0.12)"}
              >
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>Ver</span>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>Movimentos</span>
              </button>
            </div>
          </div>
          <div className="card">
            <div style={{ marginBottom: 14 }}>
              <div className="section-title" style={{ color: "var(--text)", margin: 0 }}>Dispersão de Trades</div>
              <div style={{ fontSize: "0.7rem", color: MUTE, marginTop: 4 }}>Ano {ano}</div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <ScatterChart>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="idx" hide />
                <YAxis dataKey="pl_eur" tick={{fill:MUTE,fontSize:10}} tickFormatter={v => `€${v}`} />
                <Tooltip content={<ChartTooltip formatter={v=>[fmtPL(v),"P&L"]} />} cursor={{ strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.2)" }} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.22)" />
                <Scatter data={wins.map((t,i)=>({...t,idx:i}))} fill={GREEN} opacity={0.8} r={4} style={{ cursor: "pointer" }}
                  onClick={d => setModal({ title: `📌 ${d.simbolo} — ${d.data_fecho?.slice(0,10)??""}`, trades: [d], brokers: brokerTotals([d]), summary: { label: "1 trade", value: d.pl_eur??0 } })} />
                <Scatter data={losses.map((t,i)=>({...t,idx:i}))} fill={RED} opacity={0.8} r={4} style={{ cursor: "pointer" }}
                  onClick={d => setModal({ title: `📌 ${d.simbolo} — ${d.data_fecho?.slice(0,10)??""}`, trades: [d], brokers: brokerTotals([d]), summary: { label: "1 trade", value: d.pl_eur??0 } })} />
              </ScatterChart>
            </ResponsiveContainer>
            <div style={{ borderTop: "1px dashed rgba(255,255,255,0.1)", marginTop: 12, paddingTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, fontSize: "0.67rem", color: MUTE, lineHeight: 1.6 }}>
                Cada ponto representa uma trade do <span style={{ color: "var(--text)", fontWeight: 600 }}>Ano {ano}</span>. Pontos a <span style={{ color: GREEN, fontWeight: 600 }}>verde</span> são trades lucrativas, a <span style={{ color: RED, fontWeight: 600 }}>vermelho</span> com prejuízo. Clica num ponto para ver o detalhe da trade.
              </div>
              <button
                onClick={openAllDist}
                style={{
                  flexShrink: 0, background: "rgba(79,106,245,0.12)", border: "1px solid rgba(79,106,245,0.3)",
                  borderRadius: 8, padding: "6px 14px", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                  transition: "background .15s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(79,106,245,0.22)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(79,106,245,0.12)"}
              >
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>Ver</span>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>Movimentos</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <Modal title={modal.title} summary={modal.summary} brokers={modal.brokers} onClose={() => setModal(null)}>
          <table className="data-table">
            <thead><tr>
              <th>Símbolo</th><th>Data</th><th>Tipo</th><th>Corretora</th>
              <th style={{ textAlign: "right" }}>P&L €</th>
            </tr></thead>
            <tbody>
              {modal.trades.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 700, color: "var(--text)" }}>{t.simbolo}</td>
                  <td>{t.data_fecho?.slice(0, 10) ?? "—"}</td>
                  <td>{t.tipo_ordem ?? <span style={{ color: MUTE }}>—</span>}</td>
                  <td>{t.corretora}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: (t.pl_eur ?? 0) >= 0 ? GREEN : RED }}>{fmtPL(t.pl_eur ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </>
  );
}
