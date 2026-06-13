import { useState, useEffect } from "react";
import axios from "axios";

const GREEN="#10b981",RED="#f43f5e",BLUE="#4f6af5",MUTE="#4e6080";
const fmtE = v => "€ " + Number(v||0).toLocaleString("pt-PT",{minimumFractionDigits:2});
const fmtMV = v => (v>=0?"+":"")+fmtE(v);

function TotalsRow({ items }) {
  return (
    <div className="totals-row">
      {items.map(([l,v,c]) => (
        <div key={l} className="total-box">
          <div className="label">{l}</div>
          <div className="value" style={{color:c||"#fff"}}>{v}</div>
        </div>
      ))}
    </div>
  );
}

function MaisValiaTable({ data, showPais = false }) {
  if (!data?.length) return <div className="empty">Sem dados para este quadro.</div>;
  const totalAq   = data.reduce((s,r)=>s+(r.valor_aquisicao||0),0);
  const totalReal = data.reduce((s,r)=>s+(r.valor_realizacao||0),0);
  const totalMV   = data.reduce((s,r)=>s+(r.mais_valia||0),0);
  return (
    <>
      <table className="data-table">
        <thead><tr>
          <th>Símbolo</th>
          {showPais && <th>País</th>}
          <th>Data Aquisição</th><th>Data Realização</th>
          <th style={{textAlign:"right"}}>Valor Aquisição €</th>
          <th style={{textAlign:"right"}}>Valor Realização €</th>
          <th style={{textAlign:"right"}}>Mais-Valia €</th>
        </tr></thead>
        <tbody>
          {data.map((r,i) => (
            <tr key={i}>
              <td style={{fontWeight:700,color:"var(--text)"}}>{r.simbolo}</td>
              {showPais && <td>{r.pais}</td>}
              <td>{r.data_abertura?.slice(0,10)}</td>
              <td>{r.data_fecho?.slice(0,10)}</td>
              <td style={{textAlign:"right"}}>{fmtE(r.valor_aquisicao)}</td>
              <td style={{textAlign:"right"}}>{fmtE(r.valor_realizacao)}</td>
              <td style={{textAlign:"right",fontWeight:700,color:r.mais_valia>=0?GREEN:RED}}>
                {fmtMV(r.mais_valia)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <TotalsRow items={[
        ["Total Aquisição",  fmtE(totalAq),   BLUE],
        ["Total Realização", fmtE(totalReal), BLUE],
        ["Saldo Mais-Valias",fmtMV(totalMV),  totalMV>=0?GREEN:RED],
      ]} />
    </>
  );
}

export default function IRS() {
  const [anos, setAnos]   = useState([]);
  const [ano, setAno]     = useState(null);
  const [data, setData]   = useState(null);
  const [tab, setTab]     = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get("/api/trades/anos").then(r => {
      setAnos(r.data);
      if (r.data.length) setAno(r.data[0]);
    });
  }, []);

  useEffect(() => {
    if (!ano) return;
    setLoading(true);
    axios.get(`/api/irs/summary?ano=${ano}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [ano]);

  const exportExcel = () => {
    window.location.href = `/api/irs/export?ano=${ano}`;
  };

  const mvXTB  = (data?.xtb_stocks||[]).reduce((s,r)=>s+(r.mais_valia||0),0);
  const cfds   = (data?.xtb_cfds||[]).reduce((s,r)=>s+(r.pl_eur||0),0);
  const mvIBKRS= (data?.ibkr_stocks||[]).reduce((s,r)=>s+(r.mais_valia||0),0);
  const mvIBKRO= (data?.ibkr_opcoes||[]).reduce((s,r)=>s+(r.mais_valia||0),0);
  const divBruto=(data?.dividendos||[]).reduce((s,d)=>s+(d.valor_bruto_eur||0),0);
  const total  = mvXTB + cfds + mvIBKRS + mvIBKRO;

  const tabs = [
    "AnexoG Q9 · Acções XTB",
    "AnexoG Q13 · CFDs XTB",
    "AnexoJ Q9.2A · Acções IBKR",
    "AnexoJ Q9.2B · Opções IBKR",
    "AnexoJ Q8 · Dividendos",
  ];

  return (
    <>
      <div className="page-header" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <div className="page-title">Relatório IRS</div>
          <div className="page-sub">Quadros estruturados para o Portal das Finanças</div>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <select value={ano??""} onChange={e => setAno(Number(e.target.value))}>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button className="btn btn-primary" onClick={exportExcel}>
            📥 Exportar para Excel
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="irs-summary">
        {[
          ["Acções XTB (G·Q9)",     mvXTB],
          ["CFDs XTB (G·Q13)",      cfds],
          ["Acções IBKR (J·Q9.2A)", mvIBKRS],
          ["Opções IBKR (J·Q9.2B)", mvIBKRO],
          ["Dividendos IBKR (J·Q8)",divBruto],
        ].map(([l,v]) => (
          <div key={l} className="metric-card">
            <div className="metric-label" style={{fontSize:"0.62rem"}}>{l}</div>
            <div className={`metric-value ${v>=0?"green":"red"}`} style={{fontSize:"1rem"}}>
              {v>=0?"+":""}€ {Math.abs(v).toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      <div style={{ background:"var(--card)", border:`2px solid ${total>=0?GREEN:RED}`,
        borderRadius:12, padding:"14px 24px", display:"flex",
        justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div style={{ fontWeight:700, color:"var(--text)" }}>Total Mais-Valias {ano}</div>
        <div style={{ fontSize:"1.4rem", fontWeight:700, color:total>=0?GREEN:RED }}>
          {total>=0?"+":""}€ {Math.abs(total).toFixed(2)}
        </div>
      </div>

      {loading ? <div className="spinner" /> : (
        <>
          <div className="tabs">
            {tabs.map((t,i) => (
              <button key={i} className={`tab ${tab===i?"active":""}`} onClick={()=>setTab(i)}>{t}</button>
            ))}
          </div>

          {tab === 0 && <MaisValiaTable data={data?.xtb_stocks} />}
          {tab === 1 && (
            <>
              {!data?.xtb_cfds?.length
                ? <div className="empty">Sem CFDs para este ano.</div>
                : <>
                  <table className="data-table">
                    <thead><tr><th>Símbolo</th><th>Data Fecho</th><th style={{textAlign:"right"}}>Resultado €</th><th>País</th></tr></thead>
                    <tbody>
                      {data.xtb_cfds.map((r,i) => (
                        <tr key={i}>
                          <td style={{fontWeight:700,color:"var(--text)"}}>{r.simbolo}</td>
                          <td>{r.data_fecho?.slice(0,10)}</td>
                          <td style={{textAlign:"right",fontWeight:700,color:r.pl_eur>=0?GREEN:RED}}>{fmtMV(r.pl_eur)}</td>
                          <td>{r.pais}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <TotalsRow items={[["Resultado Total CFDs", fmtMV(cfds), cfds>=0?GREEN:RED]]} />
                </>
              }
            </>
          )}
          {tab === 2 && <MaisValiaTable data={data?.ibkr_stocks} showPais />}
          {tab === 3 && <MaisValiaTable data={data?.ibkr_opcoes} showPais />}
          {tab === 4 && (
            <>
              {!data?.dividendos?.length
                ? <div className="empty">Sem dividendos para este ano.</div>
                : <>
                  <table className="data-table">
                    <thead><tr>
                      <th>Símbolo</th><th>Data</th>
                      <th style={{textAlign:"right"}}>Bruto €</th>
                      <th style={{textAlign:"right"}}>Retenção €</th>
                      <th style={{textAlign:"right"}}>Líquido €</th>
                      <th>País Fonte</th><th>Moeda</th>
                    </tr></thead>
                    <tbody>
                      {data.dividendos.map((d,i) => (
                        <tr key={i}>
                          <td style={{fontWeight:700,color:"var(--text)"}}>{d.simbolo}</td>
                          <td>{d.data_pagamento?.slice(0,10)}</td>
                          <td style={{textAlign:"right",color:GREEN}}>{fmtE(d.valor_bruto_eur)}</td>
                          <td style={{textAlign:"right",color:RED}}>-{fmtE(d.retencao_eur)}</td>
                          <td style={{textAlign:"right",fontWeight:700,color:GREEN}}>{fmtE(d.valor_liq_eur)}</td>
                          <td>{d.pais_fonte}</td>
                          <td>{d.moeda}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <TotalsRow items={[
                    ["Total Bruto",    fmtE(divBruto), BLUE],
                    ["Total Retenção", fmtE((data.dividendos||[]).reduce((s,d)=>s+(d.retencao_eur||0),0)), RED],
                    ["Total Líquido",  fmtE((data.dividendos||[]).reduce((s,d)=>s+(d.valor_liq_eur||0),0)), GREEN],
                  ]} />
                </>
              }
            </>
          )}
        </>
      )}
    </>
  );
}
