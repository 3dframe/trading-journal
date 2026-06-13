import { useState, useEffect } from "react";
import axios from "axios";

const fmt = v => (v >= 0 ? "+" : "") + "€ " + Math.abs(v).toLocaleString("pt-PT", { minimumFractionDigits: 2 });
const fmtE = v => "€ " + Math.abs(v).toLocaleString("pt-PT", { minimumFractionDigits: 2 });
const GREEN = "#10b981", RED = "#f43f5e", BLUE = "#4f6af5", MUTE = "#4e6080";

export default function TradeLog() {
  const [trades, setTrades]     = useState([]);
  const [divs, setDivs]         = useState([]);
  const [anos, setAnos]         = useState([]);
  const [ano, setAno]           = useState("");
  const [categoria, setCat]     = useState("");
  const [resultado, setRes]     = useState("");
  const [simbolo, setSim]       = useState("");
  const [corretora, setCor]     = useState("");
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    axios.get("/api/trades/anos").then(r => {
      setAnos(r.data);
      if (r.data.length) setAno(r.data[0]);
    });
  }, []);

  useEffect(() => {
    if (!ano) return;
    setLoading(true);
    const params = new URLSearchParams({ ano });
    if (categoria) params.append("categoria", categoria);
    if (simbolo)   params.append("simbolo", simbolo);
    if (corretora) params.append("corretora", corretora);

    Promise.all([
      axios.get(`/api/trades?${params}`),
      axios.get(`/api/dividends?ano=${ano}`),
    ]).then(([tr, dv]) => {
      let data = categoria === "DIVIDENDO" ? [] : tr.data;
      if (resultado === "win")  data = data.filter(t => t.pl_eur > 0);
      if (resultado === "loss") data = data.filter(t => t.pl_eur < 0);
      setTrades(data);

      let dvData = dv.data;
      if (simbolo)              dvData = dvData.filter(d => d.simbolo?.toLowerCase().includes(simbolo.toLowerCase()));
      if (corretora)            dvData = dvData.filter(d => (d.corretora ?? "IBKR") === corretora);
      if (resultado === "loss") dvData = [];
      if (categoria && categoria !== "DIVIDENDO") dvData = [];
      setDivs(dvData);

      setLoading(false);
    });
  }, [ano, categoria, resultado, simbolo, corretora]);

  // Merge e ordena por data descendente
  const rows = [
    ...trades.map(t => ({ ...t, _type: "trade", _date: t.data_fecho })),
    ...divs.map(d => ({ ...d, _type: "div",   _date: d.data_pagamento })),
  ].sort((a, b) => (b._date ?? "").localeCompare(a._date ?? ""));

  const tradeTotal = trades.reduce((s, t) => s + (t.pl_eur ?? 0), 0);
  const divTotal   = divs.reduce((s, d) => s + (d.valor_liq_eur ?? 0), 0);
  const total      = tradeTotal + divTotal;

  return (
    <>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="page-title">Registo de Operações</div>
          <div className="page-sub">
            {trades.length} trades{divs.length > 0 ? ` · ${divs.length} dividendos` : ""}
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

      <div className="filter-bar">
        <select value={ano} onChange={e => setAno(Number(e.target.value))}>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={categoria} onChange={e => setCat(e.target.value)}>
          <option value="">Todas as categorias</option>
          <option value="STOCK">STOCK</option>
          <option value="CFD">CFD</option>
          <option value="OPTION">OPTION</option>
          <option value="DIVIDENDO">DIVIDENDOS</option>
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

      {loading ? <div className="spinner" /> : rows.length === 0 ? (
        <div className="empty">Nenhuma operação corresponde aos filtros aplicados.</div>
      ) : rows.map(row => {
        if (row._type === "trade") {
          const t = row;
          const key = `t-${t.id}`;
          return (
            <div key={key}>
              <div className="trade-row" onClick={() => setExpanded(expanded === key ? null : key)}>
                <span className="trade-symbol">{t.simbolo}</span>
                <span className={`badge ${t.pl_eur > 0 ? "win" : "loss"}`}>{t.pl_eur > 0 ? "Ganho" : "Perda"}</span>
                <span style={{ fontSize: 12, color: t.categoria === "CFD" ? RED : MUTE, fontWeight: t.categoria === "CFD" ? 700 : 400 }}>{t.categoria}</span>
                <span style={{ color: MUTE, fontSize: 12 }}>{t.corretora}</span>
                <span style={{ color: MUTE, fontSize: 12 }}>{t.pais}</span>
                <span className={`trade-pl ${t.pl_eur > 0 ? "win" : "loss"}`}>{fmt(t.pl_eur)}</span>
                <span className="trade-date">{t.data_fecho?.slice(0, 10)}</span>
                <span style={{ color: MUTE, marginLeft: 8 }}>{expanded === key ? "▲" : "▼"}</span>
              </div>
              {expanded === key && (
                <div style={{ background:"var(--hover)", border:"1px solid var(--border)", borderTop:"none",
                              borderRadius:"0 0 8px 8px", padding:"14px 20px", marginBottom:6,
                              display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:"10px 20px",
                              fontSize:12 }}>
                  {[
                    ["Corretora",       t.corretora],
                    ["Conta",           t.conta],
                    ["Abertura",        t.data_abertura?.slice(0,19)?.replace("T"," ")],
                    ["Fecho",           t.data_fecho?.slice(0,19)?.replace("T"," ")],
                    ["Volume",          t.volume],
                    ["Preço Abertura",  t.preco_abertura ? `€ ${t.preco_abertura}` : "—"],
                    ["Preço Fecho",     t.preco_fecho ? `€ ${t.preco_fecho}` : "—"],
                    ["Valor Compra",    t.valor_compra_eur ? `€ ${Number(t.valor_compra_eur).toFixed(2)}` : "—"],
                    ["Valor Venda",     t.valor_venda_eur ? `€ ${Number(t.valor_venda_eur).toFixed(2)}` : "—"],
                    ["Comissão",        t.comissao_eur ? `€ ${Number(t.comissao_eur).toFixed(2)}` : "—"],
                    ["Moeda",           t.moeda_original],
                    ["País",            t.pais],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div style={{ color: MUTE, textTransform:"uppercase", fontSize:10, letterSpacing:".06em" }}>{k}</div>
                      <div style={{ color: "var(--text)", marginTop:2 }}>{v ?? "—"}</div>
                    </div>
                  ))}
                  {t.pl_eur !== null && (
                    <div>
                      <div style={{ color: MUTE, textTransform:"uppercase", fontSize:10, letterSpacing:".06em" }}>P&L</div>
                      <div style={{ color: t.pl_eur >= 0 ? GREEN : RED, fontWeight:700, marginTop:2 }}>{fmt(t.pl_eur)}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        }

        // Dividendo
        const d = row;
        const key = `d-${d.simbolo}-${d.data_pagamento}`;
        return (
          <div key={key}>
            <div className="trade-row" onClick={() => setExpanded(expanded === key ? null : key)}>
              <span className="trade-symbol">{d.simbolo}</span>
              <span className="badge" style={{ background: "rgba(79,106,245,0.15)", color: BLUE, borderColor: BLUE }}>Dividendo</span>
              <span style={{ color: MUTE, fontSize: 12 }}>IBKR</span>
              <span style={{ color: MUTE, fontSize: 12 }}>{d.pais_fonte}</span>
              <span className="trade-pl win">{fmt(d.valor_liq_eur ?? 0)}</span>
              <span className="trade-date">{d.data_pagamento?.slice(0, 10)}</span>
              <span style={{ color: MUTE, marginLeft: 8 }}>{expanded === key ? "▲" : "▼"}</span>
            </div>
            {expanded === key && (
              <div style={{ background:"var(--hover)", border:"1px solid var(--border)", borderTop:"none",
                            borderRadius:"0 0 8px 8px", padding:"14px 20px", marginBottom:6,
                            display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:"10px 20px",
                            fontSize:12 }}>
                {[
                  ["Data Pagamento",  d.data_pagamento?.slice(0, 10)],
                  ["País Fonte",      d.pais_fonte],
                  ["Moeda",           d.moeda],
                  ["Valor Bruto",     d.valor_bruto_eur != null ? fmtE(d.valor_bruto_eur) : "—"],
                  ["Retenção",        d.retencao_eur    != null ? `-${fmtE(d.retencao_eur)}` : "—"],
                  ["Valor Líquido",   d.valor_liq_eur   != null ? fmtE(d.valor_liq_eur)   : "—"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ color: MUTE, textTransform:"uppercase", fontSize:10, letterSpacing:".06em" }}>{k}</div>
                    <div style={{ color: "var(--text)", marginTop:2 }}>{v ?? "—"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
