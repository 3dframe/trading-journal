import { useState, useEffect } from "react";
import axios from "axios";

const DAYS_PT  = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                   "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const GREEN = "#10b981", RED = "#f43f5e", MUTE = "#4e6080";

const fmt   = v => (v >= 0 ? "+" : "") + "€ " + Math.abs(v).toLocaleString("pt-PT", { minimumFractionDigits: 2 });
const fmtPL = v => (v < 0 ? "-" : "") + "€ " + Math.abs(v).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const COUNTRY_NAME = {
  PT:"Portugal", US:"Estados Unidos", NL:"Países Baixos", DE:"Alemanha",
  FR:"França", GB:"Reino Unido", ES:"Espanha", IT:"Itália", SE:"Suécia",
  CH:"Suíça", BE:"Bélgica", DK:"Dinamarca", FI:"Finlândia", AU:"Austrália",
  CA:"Canadá", JP:"Japão", EU:"Europa",
};
const fmtPais = code => (code && COUNTRY_NAME[code]) ? COUNTRY_NAME[code] : (code ?? null);


function TradeDetail({ t }) {
  const fields = [
    ["Corretora",      t.corretora],
    ["Conta",          t.conta],
    ["Data Abertura",  t.data_abertura?.slice(0,19)?.replace("T"," ")],
    ["Data Fecho",     t.data_fecho?.slice(0,19)?.replace("T"," ")],
    ["Volume",         t.volume],
    ["Preço Abertura", t.preco_abertura != null ? `€ ${Number(t.preco_abertura).toFixed(4)}` : null],
    ["Preço Fecho",    t.preco_fecho    != null ? `€ ${Number(t.preco_fecho).toFixed(4)}`    : null],
    ["Moeda",          t.moeda_original],
    ["Valor Compra",   t.valor_compra_eur != null ? `€ ${Number(t.valor_compra_eur).toFixed(2)}` : null],
    ["Valor Venda",    t.valor_venda_eur  != null ? `€ ${Number(t.valor_venda_eur).toFixed(2)}`  : null],
    ["Comissão",       t.comissao_eur     != null ? `€ ${Number(t.comissao_eur).toFixed(2)}`     : null],
    ["País",           fmtPais(t.pais)],
  ].filter(([, v]) => v != null && v !== "");

  return (
    <div style={{ background: "var(--hover)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontWeight: 700, color: "var(--text)", minWidth: 70 }}>{t.simbolo}</span>
        <span className={`badge ${(t.pl_eur ?? 0) > 0 ? "win" : "loss"}`}>{(t.pl_eur ?? 0) > 0 ? "Win" : "Loss"}</span>
        <span style={{ fontSize: 11, color: t.categoria === "CFD" ? RED : MUTE, fontWeight: t.categoria === "CFD" ? 700 : 400 }}>{t.categoria}</span>
        <span style={{ color: MUTE, fontSize: 11 }}>{t.tipo_ordem}</span>
        <span style={{ marginLeft: "auto", fontWeight: 700, color: (t.pl_eur ?? 0) >= 0 ? GREEN : RED }}>{fmtPL(t.pl_eur ?? 0)}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px 16px", padding: "12px 14px", fontSize: 12 }}>
        {fields.map(([label, value]) => (
          <div key={label}>
            <div style={{ color: MUTE, fontSize: "0.62rem", marginBottom: 2 }}>{label}</div>
            <div style={{ color: "var(--text)", fontWeight: 600 }}>{value ?? "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Calendar() {
  const now = new Date();
  const [ano, setAno]         = useState(now.getFullYear());
  const [mes, setMes]         = useState(now.getMonth() + 1);
  const [calData, setCalData] = useState({});
  const [selected, setSelected]   = useState(null);
  const [dayTrades, setDayTrades] = useState([]);
  const [expanded, setExpanded]   = useState(null);

  useEffect(() => {
    axios.get(`/api/trades/calendar?ano=${ano}&mes=${mes}`).then(r => {
      const map = {};
      r.data.forEach(d => { map[d.dia] = d; });
      setCalData(map);
      setSelected(null);
    });
  }, [ano, mes]);

  const selectDay = async (dia) => {
    if (selected === dia) { setSelected(null); return; }
    setSelected(dia);
    const r = await axios.get(`/api/trades?ano=${ano}`);
    setDayTrades(r.data.filter(t => t.data_fecho?.startsWith(dia)));
  };

  const toggleExpand = id => setExpanded(prev => prev === id ? null : id);

  // Build calendar grid
  const firstDay   = new Date(ano, mes - 1, 1).getDay();
  const offset     = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(ano, mes, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const diaStr = d => `${ano}-${String(mes).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  return (
    <>
      <div className="page-header" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <div className="page-title">Calendário de P&L</div>
          <div className="page-sub">Clica num dia para ver as trades</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <select value={mes} onChange={e => setMes(Number(e.target.value))}>
            {MONTHS_PT.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={ano} onChange={e => setAno(Number(e.target.value))}>
            {[2024,2025,2026].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* Day headers */}
      <div className="cal-grid" style={{ marginBottom:4 }}>
        {DAYS_PT.map(d => <div key={d} className="cal-header">{d}</div>)}
      </div>

      {/* Days */}
      <div className="cal-grid">
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} className="cal-day empty" />;
          const ds   = diaStr(d);
          const data = calData[ds];
          const sel  = selected === ds;
          return (
            <div key={ds}
              className={`cal-day ${data ? "has-trades" : ""} ${sel ? "selected" : ""}`}
              onClick={() => data && selectDay(ds)}>
              <div className="cal-day-num">{d}</div>
              {data && (
                <>
                  <div className={`cal-pl ${data.pl >= 0 ? "win" : "loss"}`}>
                    {data.pl >= 0 ? "+" : ""}€{Math.abs(data.pl).toFixed(0)}
                  </div>
                  <div style={{ fontSize:10, color:MUTE }}>{data.n_trades}T</div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected day trades */}
      {selected && dayTrades.length > 0 && (
        <div style={{ marginTop:20 }}>
          <div className="section-title">
            Trades de {selected} — {dayTrades.length} trade{dayTrades.length > 1 ? "s" : ""}
          </div>
          <table className="data-table">
            <thead><tr>
              <th>Símbolo</th><th>Categoria</th><th>Corretora</th>
              <th>Abertura</th><th>Fecho</th><th style={{textAlign:"right"}}>P&L €</th>
            </tr></thead>
            <tbody>
              {dayTrades.map(t => {
                const isOpen = expanded === t.id;
                return (
                  <>
                    <tr key={t.id} style={{ cursor: "pointer", background: isOpen ? "rgba(255,255,255,0.03)" : undefined }}
                      onClick={() => toggleExpand(t.id)}>
                      <td style={{ fontWeight:700, color:"var(--text)" }}>
                        <span style={{ marginRight: 6, fontSize: 10, opacity: 0.5 }}>{isOpen ? "▲" : "▼"}</span>
                        {t.simbolo}
                      </td>
                      <td style={{ color: t.categoria === "CFD" ? RED : undefined, fontWeight: t.categoria === "CFD" ? 700 : undefined }}>{t.categoria}</td>
                      <td>{t.corretora}</td>
                      <td style={{ fontSize:11 }}>{t.data_abertura?.slice(0,19)?.replace("T"," ")}</td>
                      <td style={{ fontSize:11 }}>{t.data_fecho?.slice(0,19)?.replace("T"," ")}</td>
                      <td style={{ textAlign:"right", fontWeight:700, color: t.pl_eur >= 0 ? GREEN : RED }}>
                        {fmt(t.pl_eur)}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${t.id}-detail`}>
                        <td colSpan={6} style={{ padding: "0 0 12px 0", background: "rgba(255,255,255,0.02)" }}>
                          <TradeDetail t={t} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

    </>
  );
}
