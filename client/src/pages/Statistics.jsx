import { useState, useEffect } from "react";
import axios from "axios";
import Modal from "../components/Modal.jsx";
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, ReferenceLine, ScatterChart, Scatter,
  PieChart, Pie,
} from "recharts";

const GREEN="#10b981",RED="#f43f5e",BLUE="#4f6af5",MUTE="#4e6080";
const fmt    = v => (v>=0?"+":"")+"€ "+Math.abs(v).toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtPL  = v => (v<0?"-":"")+"€ "+Math.abs(v).toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2});
// Valor em € com sinal explícito (+/−) — usado na diferença cambial.
const fmtSigned = v => (v>=0?"+":"-")+"€ "+Math.abs(v).toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2});
// Valor na moeda original do ativo (ex: US$, igual ao da corretora).
const CUR_SYMBOL = { USD:"US$ ", EUR:"€ ", GBP:"£ ", CHF:"CHF ", CAD:"C$ ", JPY:"¥ ", AUD:"A$ " };
// Bandeira por país de sede fiscal (nome em português, como gravado em trades.pais).
const COUNTRY_FLAG = {
  "Portugal":"🇵🇹", "Estados Unidos":"🇺🇸", "Países Baixos":"🇳🇱", "Alemanha":"🇩🇪",
  "Espanha":"🇪🇸", "Itália":"🇮🇹", "França":"🇫🇷", "Reino Unido":"🇬🇧", "Bélgica":"🇧🇪",
  "Suíça":"🇨🇭", "Áustria":"🇦🇹", "Finlândia":"🇫🇮", "Irlanda":"🇮🇪", "Luxemburgo":"🇱🇺",
  "Mercadoria":"🛢️", "Índice":"📊", "Forex":"💱", "Cripto":"₿", "Desconhecido":"🏳️",
};
const flag = pais => COUNTRY_FLAG[pais] || "🏳️";
// Paleta para as fatias do donut por país.
const PIE_COLORS = ["#4f6af5","#10b981","#f59e0b","#a855f7","#ec4899","#14b8a6","#f43f5e","#6366f1","#84cc16","#06b6d4"];
// Clareia (p>0) ou escurece (p<0) uma cor hex — usado para gerar o degradê das fatias.
const shade = (hex, p) => {
  const n = parseInt(hex.slice(1), 16);
  const adj = c => Math.max(0, Math.min(255, Math.round(c + 255 * p)));
  const r = adj((n >> 16) & 255), g = adj((n >> 8) & 255), b = adj(n & 255);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};
const fmtOrig = (v, moeda) => {
  if (v == null) return "—";
  const sym = CUR_SYMBOL[moeda] || (moeda ? moeda+" " : "");
  return (v>=0?"+":"-")+sym+Math.abs(v).toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2});
};
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

// Tooltip do donut "Resumo por país": país, nº de trades, win rate e P&L em euros.
const CountryTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const c = payload[0].payload;
  const wr = c.n ? c.wins / c.n * 100 : 0;
  return (
    <div style={{
      background: "rgba(13,17,27,0.97)", border: "1px solid #2a3a5c",
      borderRadius: 8, padding: "9px 14px", fontSize: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
    }}>
      <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{flag(c.pais)} {c.pais}</div>
      <div style={{ color: MUTE }}>{c.n} trade{c.n !== 1 ? "s" : ""} · {wr.toFixed(1)}% WR</div>
      <div style={{ fontWeight: 700, color: c.pl >= 0 ? GREEN : RED, marginTop: 2 }}>{fmt(c.pl)}</div>
    </div>
  );
};

// Título de coluna com tooltip de informação ao passar o rato por cima.
function HeadTip({ label, info }) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4, cursor: "help" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {label}
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 14, height: 14, borderRadius: "50%", border: `1px solid ${MUTE}`,
        color: MUTE, fontSize: "0.55rem", fontStyle: "italic", fontWeight: 800,
      }}>i</span>
      {show && (
        <div style={{
          position: "absolute", top: "calc(100% + 7px)", left: "50%", transform: "translateX(-50%)",
          width: 230, background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 8, padding: "8px 11px", fontSize: "0.68rem", color: "#c4c4d4",
          fontWeight: 400, textTransform: "none", whiteSpace: "normal", textAlign: "left",
          zIndex: 400, lineHeight: 1.5, boxShadow: "0 8px 22px rgba(0,0,0,0.5)",
        }}>{info}</div>
      )}
    </span>
  );
}

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

  // Efeito cambial agregado por moeda (apenas instrumentos em moeda ≠ EUR). A diferença
  // mede quanto a conversão para euro alterou o P&L face ao valor na moeda original.
  const fxByMoeda = Object.values(bySymbol.reduce((acc, s) => {
    if (!s.moeda || s.moeda === "EUR") return acc;
    const r = acc[s.moeda] || (acc[s.moeda] = { moeda: s.moeda, orig: 0, eur: 0, n: 0 });
    r.orig += s.pl_total_orig ?? 0;
    r.eur  += s.pl_total ?? 0;
    r.n    += s.n_trades ?? 0;
    return acc;
  }, {})).map(r => ({ ...r, delta: r.eur - r.orig, pct: r.orig ? (r.eur - r.orig) / Math.abs(r.orig) * 100 : 0 }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const fxTotalDelta = fxByMoeda.reduce((s, r) => s + r.delta, 0);
  const fxTotalEur   = fxByMoeda.reduce((s, r) => s + r.eur, 0);
  const fxRawTotal   = fxByMoeda.reduce((s, r) => s + r.orig, 0);
  const fxTotalPct   = fxRawTotal ? (fxTotalDelta / Math.abs(fxRawTotal)) * 100 : 0;

  // Resumo por país (sede fiscal do instrumento): agrega os trades fechados por país,
  // com nº de trades, win rate e P&L total em euros. Exclui classificações que não são
  // países (subjacentes de CFD: mercadoria/índice/forex/cripto).
  const NAO_PAIS = new Set(["Mercadoria", "Índice", "Forex", "Cripto"]);
  const byCountry = Object.values(all.reduce((acc, t) => {
    const k = t.pais || "Desconhecido";
    if (NAO_PAIS.has(k)) return acc;
    const r = acc[k] || (acc[k] = { pais: k, n: 0, wins: 0, pl: 0 });
    r.n++;
    if ((t.pl_eur ?? 0) > 0) r.wins++;
    r.pl += t.pl_eur ?? 0;
    return acc;
  }, {})).sort((a, b) => b.pl - a.pl);
  const countryTotalPl     = byCountry.reduce((s, c) => s + c.pl, 0);
  const countryTotalTrades = byCountry.reduce((s, c) => s + c.n, 0);

  // Arrays já ordenados/derivados para os gráficos de barras — usar o MESMO array nas
  // barras e nas <Cell> garante que a cor de cada barra corresponde ao seu valor.
  const plBySymbol = [...bySymbol].sort((a, b) => a.pl_total - b.pl_total);
  const wrBySymbol = bySymbol.map(s => ({ ...s, wr: s.n_trades ? s.n_wins / s.n_trades * 100 : 0 }));

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
                <BarChart data={plBySymbol} layout="vertical" barSize={12}>
                  <defs>
                    <linearGradient id="barPlGreen" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={GREEN} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={GREEN} stopOpacity={0.95} />
                    </linearGradient>
                    <linearGradient id="barPlRed" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={RED} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={RED} stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <XAxis type="number" tick={{fill:MUTE,fontSize:10}} />
                  <YAxis dataKey="simbolo" type="category" tick={{fill:MUTE,fontSize:10}} width={65} />
                  <Tooltip content={<ChartTooltip formatter={v => [fmt(v),"P&L"]} />} cursor={{ fill: "transparent" }} />
                  <ReferenceLine x={0} stroke={MUTE} />
                  <Bar dataKey="pl_total">
                    {plBySymbol.map((s,i) => <Cell key={i} fill={s.pl_total>=0?"url(#barPlGreen)":"url(#barPlRed)"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="card-footer">Resultado líquido em euros de cada símbolo no ano, ordenado do pior para o melhor.</div>
            </div>
            <div className="card">
              <div className="section-title">Percentagem de ganhos por símbolo</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={wrBySymbol} layout="vertical" barSize={12}>
                  <defs>
                    <linearGradient id="barWrGreen" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={GREEN} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={GREEN} stopOpacity={0.95} />
                    </linearGradient>
                    <linearGradient id="barWrRed" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={RED} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={RED} stopOpacity={0.95} />
                    </linearGradient>
                  </defs>
                  <XAxis type="number" domain={[0,100]} tickFormatter={v=>v+"%"} tick={{fill:MUTE,fontSize:10}} />
                  <YAxis dataKey="simbolo" type="category" tick={{fill:MUTE,fontSize:10}} width={65} />
                  <Tooltip content={<ChartTooltip formatter={v => [v.toFixed(1)+"%","Win Rate"]} />} cursor={{ fill: "transparent" }} />
                  <ReferenceLine x={50} stroke={MUTE} strokeDasharray="4 2" />
                  <Bar dataKey="wr">
                    {wrBySymbol.map((s,i)=><Cell key={i} fill={s.wr>=50?"url(#barWrGreen)":"url(#barWrRed)"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="card-footer">Percentagem de trades vencedoras por símbolo; a linha a tracejado marca os 50%.</div>
            </div>
          </div>
          <div className="grid-2" style={{ marginBottom: 20 }}>
          {byCountry.length > 0 && (
            <div className="card" style={{ display: "flex", flexDirection: "column" }}>
              <div className="section-title">🌍 Resumo por país</div>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
                {/* Donut */}
                <div style={{ position: "relative", width: 200, height: 200, flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        {PIE_COLORS.map((c, i) => (
                          <linearGradient key={i} id={`countryGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={shade(c, 0.18)} />
                            <stop offset="100%" stopColor={shade(c, -0.12)} />
                          </linearGradient>
                        ))}
                      </defs>
                      <Pie data={byCountry} dataKey="n" nameKey="pais" cx="50%" cy="50%"
                        innerRadius={62} outerRadius={92} paddingAngle={2} stroke="none">
                        {byCountry.map((c, i) => <Cell key={i} fill={`url(#countryGrad${i % PIE_COLORS.length})`} />)}
                      </Pie>
                      <Tooltip content={<CountryTooltip />} wrapperStyle={{ zIndex: 50 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{
                    position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", pointerEvents: "none",
                  }}>
                    <div style={{ fontSize: "0.62rem", color: MUTE }}>P&L total</div>
                    <div style={{ fontSize: "1.15rem", fontWeight: 800, color: countryTotalPl >= 0 ? GREEN : RED }}>{fmt(countryTotalPl)}</div>
                    <div style={{ fontSize: "0.62rem", color: MUTE }}>{countryTotalTrades} trades</div>
                  </div>
                </div>
                {/* Legenda vertical, à direita do donut */}
                <div style={{ flex: 1, minWidth: 180, display: "flex", flexDirection: "column", gap: 7 }}>
                  {byCountry.map((c, i) => (
                    <div key={c.pais} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.75rem" }}>
                      <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                      <span>{flag(c.pais)}</span>
                      <span style={{ color: "var(--text)", fontWeight: 600 }}>{c.pais}</span>
                      <span style={{ color: MUTE, marginLeft: "auto" }}>{c.n}t · {(c.n ? c.wins / c.n * 100 : 0).toFixed(0)}%</span>
                      <span style={{ color: c.pl >= 0 ? GREEN : RED, fontWeight: 700, minWidth: 72, textAlign: "right" }}>{fmt(c.pl)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card-footer">Distribuição das trades pelo país de sede do instrumento, com P&L e win rate por país.</div>
            </div>
          )}
          {fxByMoeda.length > 0 && (
            <div className="card">
              <div className="section-title">💱 Efeito cambial</div>

              {/* Destaque: diferença total + % */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 14, margin: "4px 0 16px" }}>
                <span style={{ fontSize: "1.7rem", fontWeight: 800, color: fxTotalDelta >= 0 ? GREEN : RED }}>
                  {fmtSigned(fxTotalDelta)}
                </span>
                <span style={{ fontSize: "1rem", fontWeight: 700, color: fxTotalDelta >= 0 ? GREEN : RED }}>
                  {(fxTotalPct >= 0 ? "+" : "") + fxTotalPct.toFixed(2)}%
                </span>
                <span style={{ fontSize: "0.78rem", color: MUTE }}>
                  sobre {fmt(fxTotalEur)} em moeda estrangeira
                </span>
              </div>

              {/* Detalhe por moeda */}
              <table className="data-table no-sticky">
                <thead><tr>
                  <th>Moeda</th><th>Trades</th><th>P&L Original</th><th>P&L em €</th><th>Diferença</th><th>%</th>
                </tr></thead>
                <tbody>
                  {fxByMoeda.map(r => (
                    <tr key={r.moeda}>
                      <td style={{ fontWeight: 700, color: "var(--text)" }}>{r.moeda}</td>
                      <td>{r.n}</td>
                      <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{fmtOrig(r.orig, r.moeda)}</td>
                      <td style={{ whiteSpace: "nowrap", color: r.eur >= 0 ? GREEN : RED }}>{fmt(r.eur)}</td>
                      <td style={{ whiteSpace: "nowrap", fontWeight: 700, color: r.delta >= 0 ? GREEN : RED }}>{fmtSigned(r.delta)}</td>
                      <td style={{ whiteSpace: "nowrap", fontWeight: 700, color: r.delta >= 0 ? GREEN : RED }}>{(r.pct >= 0 ? "+" : "") + r.pct.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Rodapé com a explicação do card */}
              <div className="card-footer">
                Diferença entre o P&L na moeda original e o convertido para euro
              </div>
            </div>
          )}
          </div>

          <div className="section-title">Resumo por instrumento</div>
          <table className="data-table no-sticky">
            <thead><tr><th>Símbolo</th><th>País</th><th>Trades</th><th>Wins</th><th>Win Rate</th><th><HeadTip label="P&L Total" info="Resultado líquido acumulado (lucros e perdas) de todos os trades fechados deste instrumento, convertido para euros." /></th><th>P&L Médio</th></tr></thead>
            <tbody>
              {bySymbol.map(s => {
                // Instrumentos em moeda ≠ EUR mostram o valor na moeda original e, entre
                // parênteses, o convertido para euro. O efeito cambial agregado está no
                // card "💱 Efeito cambial" (mais claro do que por instrumento).
                const naoEur = s.moeda && s.moeda !== "EUR";
                return (
                  <tr key={s.simbolo}>
                    <td style={{fontWeight:700,color:"var(--text)"}}>{s.simbolo}</td>
                    <td style={{whiteSpace:"nowrap"}}><span style={{marginRight:6}}>{flag(s.pais)}</span>{s.pais || "—"}</td>
                    <td>{s.n_trades}</td>
                    <td>{s.n_wins}</td>
                    <td>{(s.n_wins/s.n_trades*100).toFixed(1)}%</td>
                    <td style={{color:s.pl_total>=0?GREEN:RED,whiteSpace:"nowrap"}}>
                      {naoEur ? <><strong>{fmtOrig(s.pl_total_orig, s.moeda)}</strong> <span style={{color:MUTE,fontWeight:600}}>({fmt(s.pl_total)})</span></> : <strong>{fmt(s.pl_total)}</strong>}
                    </td>
                    <td style={{color:s.avg_pl>=0?GREEN:RED,whiteSpace:"nowrap"}}>
                      {naoEur ? <><strong>{fmtOrig(s.avg_pl_orig, s.moeda)}</strong> <span style={{color:MUTE}}>({fmt(s.avg_pl)})</span></> : fmt(s.avg_pl)}
                    </td>
                  </tr>
                );
              })}
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
              <div className="card-footer">Resultado e taxa de acerto por tipo de instrumento (ações, CFDs e opções).</div>
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
              <div className="card-footer">Indicadores de risco e desempenho do ano: factor de lucro, rácio risco/benefício, médias e extremos.</div>
            </div>
          </div>
        </>
      )}

      {tab === 2 && (
        <div className="grid-2">
          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ marginBottom: 14 }}>
              <div className="section-title" style={{ margin: 0 }}>Distribuição de P&L por Trade</div>
              <div style={{ fontSize: "0.7rem", color: MUTE, marginTop: 4 }}>Ano {ano}</div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={bins} barSize={10}>
                <defs>
                  <linearGradient id="barHistGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GREEN} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={GREEN} stopOpacity={0.3} />
                  </linearGradient>
                  <linearGradient id="barHistRed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={RED} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={RED} stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="bin" tick={{fill:MUTE,fontSize:9}} />
                <YAxis tick={{fill:MUTE,fontSize:10}} />
                <Tooltip content={<ChartTooltip formatter={v=>[v+" trades","Frequência"]} />} cursor={{ fill: "transparent" }} />
                <ReferenceLine x="0" stroke="rgba(255,255,255,0.22)" />
                <Bar dataKey="count" style={{ cursor: "pointer" }} onClick={openBin}>
                  {bins.map((b,i)=><Cell key={i} fill={b.pl>=0?"url(#barHistGreen)":"url(#barHistRed)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ borderTop: "1px dashed rgba(255,255,255,0.1)", marginTop: "auto", paddingTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
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
          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ marginBottom: 14 }}>
              <div className="section-title" style={{ margin: 0 }}>Dispersão de Trades</div>
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
            <div style={{ borderTop: "1px dashed rgba(255,255,255,0.1)", marginTop: "auto", paddingTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
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
