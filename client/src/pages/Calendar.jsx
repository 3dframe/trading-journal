import { useState, useEffect, useRef, useMemo, Fragment } from "react";
import axios from "axios";

// ── Constantes ─────────────────────────────────────────────────
const MONTHS_PT    = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                      "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MONTHS_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun",
                      "Jul","Ago","Set","Out","Nov","Dez"];
const WEEKDAYS     = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

const G   = "#10b981";
const R   = "#f43f5e";
const B   = "#4f6af5";
const T   = "#14b8a6";
const MUT = "var(--mute)";

const fmtPL  = v => (v >= 0 ? "+" : "−") + "€ " + Math.abs(v).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = v => v.toFixed(0) + "%";
// Encargos (comissão/swap/rollover): valor em € com sinal, ou "—" se nulo/zero.
const fmtEnc = v => (v == null || v === 0) ? "—" : (v < 0 ? "-" : "") + "€ " + Math.abs(v).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function isoWeek(year, month, day) {
  const d = new Date(Date.UTC(year, month - 1, day));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - jan1) / 86400000) + 1) / 7);
}

const COUNTRY_NAME = {
  PT:"Portugal", US:"EUA", NL:"Países Baixos", DE:"Alemanha",
  FR:"França", GB:"Reino Unido", ES:"Espanha", IT:"Itália",
  SE:"Suécia", CH:"Suíça", BE:"Bélgica", DK:"Dinamarca",
  FI:"Finlândia", AU:"Austrália", CA:"Canadá", JP:"Japão",
};

// ── Detalhe de um trade ─────────────────────────────────────────
function TradeDetail({ t }) {
  const fmtPais = code => COUNTRY_NAME[code] || code || null;
  const fields = [
    ["Corretora",    t.corretora],
    ["Conta",        t.conta],
    ["Abertura",     t.data_abertura?.slice(0,19)?.replace("T"," ")],
    ["Fecho",        t.data_fecho?.slice(0,19)?.replace("T"," ")],
    ["Volume",       t.volume],
    ["Preço Ab.",    t.preco_abertura != null ? `€ ${Number(t.preco_abertura).toFixed(4)}` : null],
    ["Preço Fecho",  t.preco_fecho    != null ? `€ ${Number(t.preco_fecho).toFixed(4)}`    : null],
    ["Moeda",        t.moeda_original],
    ["Valor Compra", t.valor_compra_eur != null ? `€ ${Number(t.valor_compra_eur).toFixed(2)}` : null],
    ["Valor Venda",  t.valor_venda_eur  != null ? `€ ${Number(t.valor_venda_eur).toFixed(2)}`  : null],
    ["Comissão",     t.fees             != null ? `€ ${Number(t.fees).toFixed(2)}`             : null],
    ["País",         fmtPais(t.pais)],
  ].filter(([, v]) => v != null && v !== "");

  const pl = t.pl_eur ?? 0;
  return (
    <div style={{ background: "var(--hover)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontWeight: 700, color: "var(--text)", minWidth: 70 }}>{t.simbolo}</span>
        <span className={`badge ${pl > 0 ? "win" : "loss"}`}>{pl > 0 ? "Win" : "Loss"}</span>
        <span style={{ fontSize: 11, color: t.categoria === "CFD" ? R : MUT, fontWeight: t.categoria === "CFD" ? 700 : 400 }}>{t.categoria}</span>
        <span style={{ color: MUT, fontSize: 11 }}>{t.tipo_ordem}</span>
        <span style={{ marginLeft: "auto", fontWeight: 700, color: pl >= 0 ? G : R }}>{fmtPL(pl)}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px 16px", padding: "12px 14px", fontSize: 12 }}>
        {fields.map(([label, value]) => (
          <div key={label}>
            <div style={{ color: MUT, fontSize: "0.62rem", marginBottom: 2 }}>{label}</div>
            <div style={{ color: "var(--text)", fontWeight: 600 }}>{value ?? "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Barra de estatísticas ───────────────────────────────────────
function StatsBar({ stats }) {
  const items = [
    { label: "NET P&L",   value: fmtPL(stats.netPL),   color: stats.netPL   >= 0 ? G : R },
    { label: "GROSS P&L", value: fmtPL(stats.grossPL), color: stats.grossPL >= 0 ? G : R },
    { label: "COMISSÕES", value: stats.fees > 0 ? "−€ " + stats.fees.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "€ 0,00", color: stats.fees > 0 ? R : MUT },
    { label: "DIAS +",    value: stats.winDays,         color: "var(--text)" },
    { label: "TRADES",    value: stats.trades,          color: "var(--text)" },
    { label: "WIN RATE",  value: fmtPct(stats.winRate), color: stats.winRate >= 50 ? G : R },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 1, background: "var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 20, border: "1px solid var(--border)" }}>
      {items.map(({ label, value, color }) => (
        <div key={label} style={{ background: "var(--card)", padding: "14px 16px" }}>
          <div style={{ fontSize: "0.6rem", fontWeight: 700, color: MUT, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>{label}</div>
          <div style={{ fontWeight: 700, fontSize: "0.95rem", color }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Painel de trades + dividendos (dia ou mês) ──────────────────
function TradesPanel({ title, trades, divs = [], expanded, onExpand, panelRef }) {
  const divTotal = divs.reduce((s, d) => s + (d.valor_liq_eur || 0), 0);
  return (
    <div ref={panelRef} style={{ marginTop: 20 }}>
      <div style={{ fontSize: "0.7rem", fontWeight: 700, color: MUT, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10 }}>
        {title}
        {trades.length > 0 && ` · ${trades.length} trade${trades.length !== 1 ? "s" : ""}`}
        {divs.length > 0   && ` · ${divs.length} dividendo${divs.length !== 1 ? "s" : ""}`}
      </div>
      {trades.length > 0 && (
        <>
        <div style={panelSubhead}>Trades</div>
        <table className="data-table" style={{ marginBottom: divs.length > 0 ? 16 : 0 }}>
          <thead><tr>
            <th>Símbolo</th><th>Categoria</th><th>Corretora</th>
            <th>Abertura</th><th>Fecho</th><th style={{ textAlign: "right" }}>P&amp;L €</th>
            <th style={{ textAlign: "right" }}>Comissão €</th>
            <th style={{ textAlign: "right" }}>Swap €</th>
            <th style={{ textAlign: "right" }}>Rollover €</th>
          </tr></thead>
          <tbody>
            {trades.map(t => {
              const isOpen = expanded === t.id;
              const pl     = t.pl_eur ?? 0;
              return (
                <Fragment key={t.id}>
                  <tr style={{ cursor: "pointer", background: isOpen ? "rgba(255,255,255,0.03)" : undefined }}
                    onClick={() => onExpand(t.id)}>
                    <td style={{ fontWeight: 700, color: "var(--text)" }}>
                      <span style={{ marginRight: 6, fontSize: 10, opacity: .5 }}>{isOpen ? "▲" : "▼"}</span>
                      {t.simbolo}
                    </td>
                    <td style={{ color: t.categoria === "CFD" ? R : undefined, fontWeight: t.categoria === "CFD" ? 700 : undefined }}>{t.categoria}</td>
                    <td>{t.corretora}</td>
                    <td style={{ fontSize: 11 }}>{t.data_abertura?.slice(0,19)?.replace("T"," ")}</td>
                    <td style={{ fontSize: 11 }}>{t.data_fecho?.slice(0,19)?.replace("T"," ")}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: pl >= 0 ? G : R }}>{fmtPL(pl)}</td>
                    <td style={{ textAlign: "right", color: MUT, fontSize: 11 }}>{fmtEnc(t.fees)}</td>
                    <td style={{ textAlign: "right", color: MUT, fontSize: 11 }}>{fmtEnc(t.swap)}</td>
                    <td style={{ textAlign: "right", color: MUT, fontSize: 11 }}>{fmtEnc(t.rollover)}</td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={9} style={{ padding: "0 0 12px", background: "rgba(255,255,255,0.02)" }}>
                        <TradeDetail t={t} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        </>
      )}
      {divs.length > 0 && (
        <>
        <div style={panelSubhead}>Dividendos / Juros</div>
        <table className="data-table">
          <thead><tr>
            <th>Símbolo</th><th>Corretora</th><th>Conta</th><th>País Fonte</th>
            <th style={{ textAlign: "right" }}>Bruto €</th><th style={{ textAlign: "right" }}>Retenção €</th>
            <th style={{ textAlign: "right" }}>Líquido €</th>
          </tr></thead>
          <tbody>
            {divs.map((d, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 700, color: "var(--text)" }}>{d.simbolo}</td>
                <td>{d.corretora}</td>
                <td style={{ fontSize: 11 }}>{d.conta || "—"}</td>
                <td>{d.pais_fonte || "—"}</td>
                <td style={{ textAlign: "right", color: G }}>{fmtPL(d.valor_bruto_eur || 0).replace("+", "")}</td>
                <td style={{ textAlign: "right", color: R }}>{(d.retencao_eur || 0).toFixed(2)}</td>
                <td style={{ textAlign: "right", fontWeight: 700, color: G }}>{fmtPL(d.valor_liq_eur || 0).replace("+", "")}</td>
              </tr>
            ))}
            {divs.length > 1 && (
              <tr style={{ borderTop: "1px solid var(--border)" }}>
                <td colSpan={6} style={{ fontWeight: 700, color: "var(--text)" }}>Total</td>
                <td style={{ textAlign: "right", fontWeight: 700, color: G }}>{fmtPL(divTotal).replace("+", "")}</td>
              </tr>
            )}
          </tbody>
        </table>
        </>
      )}
    </div>
  );
}

// ── Vista de Ano ────────────────────────────────────────────────
function YearView({ ano, setAno, yearData, divsByMonth, selectedMonth, onMonthClick }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <button onClick={() => setAno(a => a - 1)} style={navBtnStyle}>‹</button>
        <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text)", minWidth: 60, textAlign: "center" }}>{ano}</span>
        <button onClick={() => setAno(a => a + 1)} style={navBtnStyle}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {MONTHS_SHORT.map((m, i) => {
          const mNum   = i + 1;
          const d      = yearData[mNum] || {};
          const div    = divsByMonth?.[mNum];
          const hasData = !!d.trades || !!div;
          const pl     = (d.pl || 0) + (div?.valor || 0);
          const isSel  = selectedMonth === mNum;
          return (
            <div key={i} onClick={() => hasData && onMonthClick(mNum)}
              style={{
                background: isSel ? "rgba(79,106,245,0.12)" : pl > 0 ? "rgba(16,185,129,0.07)" : pl < 0 ? "rgba(244,63,94,0.07)" : "var(--card)",
                border: `${isSel ? 2 : 1}px solid ${isSel ? B : pl > 0 ? "rgba(16,185,129,0.35)" : pl < 0 ? "rgba(244,63,94,0.3)" : "var(--border)"}`,
                borderRadius: 10, padding: "16px 14px",
                cursor: hasData ? "pointer" : "default",
                transition: "border-color .2s",
              }}
              onMouseEnter={e => { if (hasData) e.currentTarget.style.borderColor = pl > 0 ? G : pl < 0 ? R : "rgba(255,255,255,0.2)"; }}
              onMouseLeave={e => { if (hasData) e.currentTarget.style.borderColor = isSel ? B : pl > 0 ? "rgba(16,185,129,0.35)" : pl < 0 ? "rgba(244,63,94,0.3)" : "var(--border)"; }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: isSel ? B : MUT, textTransform: "uppercase", marginBottom: 8 }}>{m}</div>
              {hasData ? (
                <>
                  <div style={{ fontWeight: 800, fontSize: "1.05rem", color: pl >= 0 ? G : R }}>{fmtPL(pl)}</div>
                  <div style={{ fontSize: 11, color: MUT, marginTop: 4 }}>
                    {d.trades ? `${d.trades} trade${d.trades !== 1 ? "s" : ""}` : null}
                    {d.trades && div ? " · " : null}
                    {div ? <span style={{ color: G }}>💰 {div.n}</span> : null}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: "0.78rem", color: MUT }}>Sem dados</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Vista de Semana ─────────────────────────────────────────────
function WeekView({ weekOffset, setWeekOffset, calData, divsByDay, onSelectDay, selected }) {
  const today    = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const baseDate = new Date(today);
  baseDate.setDate(today.getDate() - today.getDay() + weekOffset * 7);

  const weekDays  = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    return d;
  });
  const weekStart = weekDays[0];
  const weekEnd   = weekDays[6];
  const fmtDate   = d => `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={() => setWeekOffset(o => o - 1)} style={navBtnStyle}>‹</button>
        <span style={{ color: "var(--text)", fontWeight: 600, fontSize: "0.9rem" }}>
          {fmtDate(weekStart)} – {fmtDate(weekEnd)} {weekEnd.getFullYear()}
        </span>
        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: MUT, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 5, padding: "2px 8px" }}>
          S{isoWeek(weekStart.getFullYear(), weekStart.getMonth() + 1, weekStart.getDate())}
        </span>
        <button onClick={() => setWeekOffset(o => o + 1)} style={navBtnStyle}>›</button>
        {weekOffset !== 0 && (
          <button onClick={() => setWeekOffset(0)} style={{ ...navBtnStyle, fontSize: 11, padding: "4px 10px", color: MUT }}>Hoje</button>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
        {WEEKDAYS.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: "0.65rem", fontWeight: 700, color: MUT, textTransform: "uppercase", letterSpacing: ".08em", paddingBottom: 8 }}>{d}</div>
        ))}
        {weekDays.map(d => {
          const ds      = d.toISOString().slice(0, 10);
          const data    = calData[ds];
          const div     = divsByDay?.[ds];
          const hasData = !!data || !!div;
          const dayPl   = (data?.pl || 0) + (div?.valor || 0);
          const isToday = ds === todayStr;
          const isSel   = selected === ds;
          return (
            <div key={ds} onClick={() => hasData && onSelectDay(ds)}
              style={{ minHeight: 110, borderRadius: 8, padding: "10px 10px 8px",
                cursor: hasData ? "pointer" : "default",
                background: hasData ? (dayPl >= 0 ? "rgba(16,185,129,0.1)" : "rgba(244,63,94,0.1)") : "rgba(0,0,0,0.18)",
                border: `${isToday ? 2 : 1}px solid ${isToday ? T : isSel ? B : hasData ? (dayPl >= 0 ? "rgba(16,185,129,0.3)" : "rgba(244,63,94,0.25)") : "rgba(255,255,255,0.04)"}`,
                transition: "border-color .2s" }}
              onMouseEnter={e => { if (hasData) e.currentTarget.style.borderColor = dayPl >= 0 ? G : R; }}
              onMouseLeave={e => {
                if (!hasData) return;
                e.currentTarget.style.borderColor = isToday ? T : isSel ? B : dayPl >= 0 ? "rgba(16,185,129,0.3)" : "rgba(244,63,94,0.25)";
              }}>
              <div style={{ fontSize: "0.67rem", color: isToday ? T : MUT, fontWeight: isToday ? 700 : 400 }}>{d.getDate()}</div>
              {hasData && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.85rem", color: dayPl >= 0 ? G : R }}>{fmtPL(dayPl)}</div>
                  <div style={{ fontSize: 10, color: MUT, marginTop: 2 }}>
                    {data ? `${data.n_trades} trade${data.n_trades !== 1 ? "s" : ""}` : null}
                    {data && div ? " · " : null}
                    {div ? <span style={{ color: G }}>💰 {div.n}</span> : null}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Estilos partilhados ─────────────────────────────────────────
const navBtnStyle = {
  background: "var(--card)", border: "1px solid var(--border)",
  borderRadius: 6, width: 32, height: 32, cursor: "pointer",
  color: "var(--text)", fontSize: "1rem", display: "flex",
  alignItems: "center", justifyContent: "center", flexShrink: 0,
};

// Sub-etiqueta acima de cada tabela do painel (Trades / Dividendos / Juros)
const panelSubhead = {
  fontSize: "0.64rem", fontWeight: 700, color: MUT,
  textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 7,
};

// ══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════
export default function Calendar() {
  const now      = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const [view,          setView]          = useState("month");
  const [ano,           setAno]           = useState(now.getFullYear());
  const [mes,           setMes]           = useState(now.getMonth() + 1);
  const [weekOffset,    setWeekOffset]    = useState(0);
  const [calData,       setCalData]       = useState({});
  const [yearData,      setYearData]      = useState({});
  const [yearTrades,    setYearTrades]    = useState([]);
  const [yearDivs,      setYearDivs]      = useState([]);
  const [selected,      setSelected]      = useState(null);   // dia selecionado (vista mês/semana)
  const [selectedMonth, setSelectedMonth] = useState(null);   // mês selecionado (vista ano)
  const [shownTrades,   setShownTrades]   = useState([]);
  const [shownDivs,     setShownDivs]     = useState([]);
  const [expanded,      setExpanded]      = useState(null);
  const [initialized,   setInitialized]   = useState(false);

  const panelRef = useRef(null);

  // ── Na abertura: ir para o ano mais recente com dados ──
  useEffect(() => {
    axios.get("/api/trades/anos").then(r => {
      if (r.data.length) setAno(r.data[0]);
    }).catch(() => {});
  }, []);

  // ── Reset de seleção quando o ano muda ──
  useEffect(() => {
    setSelected(null);
    setSelectedMonth(null);
    setShownTrades([]);
    setShownDivs([]);
    setExpanded(null);
  }, [ano]);

  // ── Grelha do mês (com abort para evitar race conditions) ──
  useEffect(() => {
    if (view === "year") return;
    let ignore = false;
    axios.get(`/api/trades/calendar?ano=${ano}&mes=${mes}`)
      .then(r => {
        if (ignore) return;
        const map = {};
        r.data.forEach(d => { map[d.dia] = d; });
        setCalData(map);
        setSelected(null);
        setShownTrades([]);
        setShownDivs([]);
      }).catch(() => {});
    return () => { ignore = true; };
  }, [ano, mes, view]);

  // ── Trades do ano (com abort) ──
  useEffect(() => {
    let ignore = false;
    axios.get(`/api/trades?ano=${ano}`)
      .then(r => {
        if (ignore) return;
        const byMonth = {};
        r.data.forEach(t => {
          const m = parseInt(t.data_fecho?.slice(5, 7));
          if (!m) return;
          if (!byMonth[m]) byMonth[m] = { pl: 0, gross: 0, fees: 0, trades: 0, wins: 0 };
          byMonth[m].pl     += t.pl_eur    || 0;
          byMonth[m].gross  += t.gross_pl  || (t.pl_eur || 0) + Math.abs(t.fees || 0);
          byMonth[m].fees   += Math.abs(t.fees || 0);
          byMonth[m].trades += 1;
          if ((t.pl_eur || 0) > 0) byMonth[m].wins++;
        });
        setYearData(byMonth);
        setYearTrades(r.data);
      }).catch(() => {});
    return () => { ignore = true; };
  }, [ano]);

  // ── Dividendos do ano (com abort) ──
  useEffect(() => {
    let ignore = false;
    axios.get(`/api/dividends?ano=${ano}`)
      .then(r => { if (!ignore) setYearDivs(r.data); })
      .catch(() => {});
    return () => { ignore = true; };
  }, [ano]);

  // ── Dividendos agrupados por dia (para a grelha mês/semana) ──
  const divsByDay = useMemo(() => {
    const map = {};
    yearDivs.forEach(d => {
      const ds = d.data_pagamento?.slice(0, 10);
      if (!ds) return;
      if (!map[ds]) map[ds] = { valor: 0, n: 0 };
      map[ds].valor += d.valor_liq_eur || 0;
      map[ds].n++;
    });
    return map;
  }, [yearDivs]);

  // ── Dividendos agrupados por mês (para a grelha de ano) ──
  const divsByMonth = useMemo(() => {
    const map = {};
    yearDivs.forEach(d => {
      const m = parseInt(d.data_pagamento?.slice(5, 7));
      if (!m) return;
      if (!map[m]) map[m] = { valor: 0, n: 0 };
      map[m].valor += d.valor_liq_eur || 0;
      map[m].n++;
    });
    return map;
  }, [yearDivs]);

  // ── Quando yearData/yearDivs carregam pela primeira vez, saltar para o último mês com dados ──
  useEffect(() => {
    if (initialized) return;
    const monthsTrades = Object.keys(yearData).map(Number).filter(m => yearData[m]?.trades > 0);
    const monthsDivs   = Object.keys(divsByMonth).map(Number);
    const months = [...new Set([...monthsTrades, ...monthsDivs])];
    if (!months.length) return;
    setMes(Math.max(...months));
    setInitialized(true);
  }, [yearData, divsByMonth, initialized]);

  // ── Scroll automático para o painel de trades/dividendos ──
  useEffect(() => {
    if ((shownTrades.length > 0 || shownDivs.length > 0) && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [shownTrades, shownDivs]);

  // ── Stats mensais ──
  const stats = useMemo(() => {
    const d = yearData[mes] || {};
    const winDays = Object.values(calData).filter(v => v.pl > 0).length;
    return {
      netPL:   d.pl     || 0,
      grossPL: d.gross  || 0,
      fees:    d.fees   || 0,
      trades:  d.trades || 0,
      winRate: d.trades ? Math.round((d.wins || 0) / d.trades * 100) : 0,
      winDays,
    };
  }, [yearData, mes, calData]);

  // ── Selecionar dia (vista mês / semana) ──
  const selectDay = ds => {
    if (selected === ds) { setSelected(null); setShownTrades([]); setShownDivs([]); return; }
    setSelected(ds);
    setSelectedMonth(null);
    setExpanded(null);
    setShownTrades(yearTrades.filter(t => t.data_fecho?.startsWith(ds)));
    setShownDivs(yearDivs.filter(d => d.data_pagamento?.startsWith(ds)));
  };

  // ── Selecionar mês (vista ano) — mostra trades inline ──
  const selectMonth = m => {
    if (selectedMonth === m) { setSelectedMonth(null); setShownTrades([]); setShownDivs([]); return; }
    setSelectedMonth(m);
    setSelected(null);
    setExpanded(null);
    const monthStr = String(m).padStart(2, "0");
    setShownTrades(yearTrades.filter(t => t.data_fecho?.startsWith(`${ano}-${monthStr}`)));
    setShownDivs(yearDivs.filter(d => d.data_pagamento?.startsWith(`${ano}-${monthStr}`)));
  };

  // ── Navegar mês ──
  const prevMonth = () => {
    if (mes === 1) { setAno(a => a - 1); setMes(12); }
    else setMes(m => m - 1);
  };
  const nextMonth = () => {
    if (mes === 12) { setAno(a => a + 1); setMes(1); }
    else setMes(m => m + 1);
  };

  // ── Grelha do calendário (domingo primeiro) ──
  const firstDayOfWeek = new Date(ano, mes - 1, 1).getDay();
  const daysInMonth    = new Date(ano, mes, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const diaStr = d => `${ano}-${String(mes).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  // Título para o painel de trades
  const panelTitle = selectedMonth
    ? `${MONTHS_PT[selectedMonth - 1]} ${ano}`
    : selected
      ? `${parseInt(selected.slice(8))} de ${MONTHS_PT[parseInt(selected.slice(5,7))-1]} ${selected.slice(0,4)}`
      : "";

  return (
    <>
      {/* ── Cabeçalho ── */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, marginBottom: 16 }}>
        <div className="page-title">Calendário</div>
        <div style={{ display: "flex", gap: 2, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: 3 }}>
          {["year","month","week"].map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: "5px 14px", borderRadius: 6, fontSize: "0.78rem", fontWeight: 600,
                fontFamily: "var(--font)", cursor: "pointer",
                background: view === v ? B : "transparent",
                color:      view === v ? "#fff" : MUT,
                border: "none", transition: "all .15s", textTransform: "uppercase", letterSpacing: ".04em" }}>
              {v === "year" ? "Ano" : v === "month" ? "Mês" : "Semana"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Vista ANO ── */}
      {view === "year" && (
        <>
          <YearView ano={ano} setAno={setAno} yearData={yearData} divsByMonth={divsByMonth}
            selectedMonth={selectedMonth} onMonthClick={selectMonth} />
          {(shownTrades.length > 0 || shownDivs.length > 0) && (
            <TradesPanel
              panelRef={panelRef}
              title={panelTitle}
              trades={shownTrades}
              divs={shownDivs}
              expanded={expanded}
              onExpand={id => setExpanded(p => p === id ? null : id)}
            />
          )}
        </>
      )}

      {/* ── Vista SEMANA ── */}
      {view === "week" && (
        <>
          <WeekView weekOffset={weekOffset} setWeekOffset={setWeekOffset}
            calData={calData} divsByDay={divsByDay} onSelectDay={selectDay} selected={selected} />
          {(shownTrades.length > 0 || shownDivs.length > 0) && (
            <TradesPanel
              panelRef={panelRef}
              title={panelTitle}
              trades={shownTrades}
              divs={shownDivs}
              expanded={expanded}
              onExpand={id => setExpanded(p => p === id ? null : id)}
            />
          )}
        </>
      )}

      {/* ── Vista MÊS ── */}
      {view === "month" && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={prevMonth} style={navBtnStyle}>‹</button>
              <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text)", minWidth: 160 }}>
                {MONTHS_PT[mes - 1]} {ano}
              </span>
              <button onClick={nextMonth} style={navBtnStyle}>›</button>
            </div>
            <button onClick={() => setView("year")}
              style={{ background: "none", border: "none", color: MUT, fontSize: "0.78rem",
                cursor: "pointer", fontFamily: "var(--font)", textDecoration: "underline" }}>
              Voltar ao Ano
            </button>
          </div>

          <StatsBar stats={stats} />

          <div style={{ display: "grid", gridTemplateColumns: "28px repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
            <div style={{ fontSize: "0.58rem", fontWeight: 700, color: MUT, textTransform: "uppercase", letterSpacing: ".06em", textAlign: "center", padding: "4px 0" }}>Sem</div>
            {WEEKDAYS.map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: "0.63rem", fontWeight: 700, color: MUT, textTransform: "uppercase", letterSpacing: ".08em", padding: "4px 0" }}>{d}</div>
            ))}
          </div>

          {(() => {
            const rows = [];
            for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
            return rows.map((row, ri) => {
              const firstDay = row.find(d => d != null);
              const wn = firstDay ? isoWeek(ano, mes, firstDay) : null;
              return (
                <div key={ri} style={{ display: "grid", gridTemplateColumns: "28px repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 10, fontSize: "0.6rem", fontWeight: 700, color: MUT, opacity: 0.6 }}>{wn}</div>
                  {row.map((d, ci) => {
                    if (!d) return (
                      <div key={`e${ri}-${ci}`} style={{ minHeight: 110, borderRadius: 8, background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.03)" }} />
                    );
                    const ds        = diaStr(d);
                    const data      = calData[ds];
                    const div       = divsByDay[ds];
                    const isToday   = ds === todayStr;
                    const isSel     = selected === ds;
                    const hasData   = !!data || !!div;
                    const dayPl     = (data?.pl || 0) + (div?.valor || 0);

                    let bg      = "var(--card)";
                    let bdColor = "var(--border)";
                    let bdWidth = 1;

                    if (isToday)         { bdColor = T; bdWidth = 2; }
                    else if (isSel)      { bdColor = B; bdWidth = 2; }
                    else if (hasData && dayPl > 0) bdColor = "rgba(16,185,129,0.3)";
                    else if (hasData && dayPl < 0) bdColor = "rgba(244,63,94,0.25)";

                    if (hasData && dayPl > 0)      bg = "rgba(16,185,129,0.1)";
                    else if (hasData && dayPl < 0) bg = "rgba(244,63,94,0.09)";

                    return (
                      <div key={ds} onClick={() => hasData && selectDay(ds)}
                        style={{ minHeight: 110, borderRadius: 8, padding: "10px 10px 8px",
                          background: bg, border: `${bdWidth}px solid ${bdColor}`,
                          cursor: hasData ? "pointer" : "default",
                          transition: "border-color .2s", display: "flex", flexDirection: "column" }}
                        onMouseEnter={e => { if (hasData) e.currentTarget.style.borderColor = dayPl >= 0 ? G : R; }}
                        onMouseLeave={e => { if (hasData) e.currentTarget.style.borderColor = bdColor; }}>
                        <div style={{ fontSize: "0.67rem", fontWeight: isToday ? 700 : 400, color: isToday ? T : MUT, alignSelf: "flex-start" }}>{d}</div>
                        {hasData && (
                          <div style={{ marginTop: "auto", paddingTop: 8 }}>
                            <div style={{ fontWeight: 800, fontSize: "0.88rem", color: dayPl >= 0 ? G : R, lineHeight: 1.2 }}>{fmtPL(dayPl)}</div>
                            <div style={{ fontSize: "0.68rem", color: MUT, marginTop: 3 }}>
                              {data ? `${data.n_trades} trade${data.n_trades !== 1 ? "s" : ""}` : null}
                              {data && div ? " · " : null}
                              {div ? <span style={{ color: G }}>💰 {div.n}</span> : null}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            });
          })()}

          {(shownTrades.length > 0 || shownDivs.length > 0) && (
            <TradesPanel
              panelRef={panelRef}
              title={panelTitle}
              trades={shownTrades}
              divs={shownDivs}
              expanded={expanded}
              onExpand={id => setExpanded(p => p === id ? null : id)}
            />
          )}
        </>
      )}
    </>
  );
}
