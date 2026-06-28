import { useState, useEffect, useLayoutEffect, useCallback } from "react";
import axios from "axios";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
} from "recharts";
import Modal from "../components/Modal.jsx";
import TradeDetail from "../components/TradeDetail.jsx";

const fmt = v =>
  (v < 0 ? "-" : "") + "€ " +
  Math.abs(v).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtAbs = v =>
  "€ " + Math.abs(v).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Formata um valor na moeda nativa do ativo (preço/preço médio das posições abertas).
const CUR_SYMBOL = { USD: "US$ ", EUR: "€ ", GBP: "£ ", CHF: "CHF ", CAD: "C$ ", JPY: "¥ ", AUD: "A$ " };
const fmtCur = (v, moeda) => {
  if (v == null) return "—";
  const sym = CUR_SYMBOL[moeda] || (moeda ? moeda + " " : "");
  return sym + Number(v).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const GREEN = "#10b981", RED = "#f43f5e", BLUE = "#60a5fa",
      PINK = "#f472b6", AMBER = "#fbbf24", PURPLE = "#a78bfa", TEAL = "#14b8a6", MUTE = "#6b7280";

// Clareia (p>0) ou escurece (p<0) uma cor hex — usado para gerar o degradê das fatias dos donuts.
const shade = (hex, p) => {
  const n = parseInt(hex.slice(1), 16);
  const adj = c => Math.max(0, Math.min(255, Math.round(c + 255 * p)));
  const r = adj((n >> 16) & 255), g = adj((n >> 8) & 255), b = adj(n & 255);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

// Metadados das categorias de trades conhecidas (rótulo PT, cor e emoji).
// As categorias são detetadas automaticamente a partir dos dados — se aparecer
// uma categoria nova no relatório (ex.: FUTURE), o card mostra-a na mesma,
// usando o rótulo/cor/emoji por defeito (ver prettyCat / CAT_FALLBACK_COLORS).
// `grad: [topo, fundo]` define o degradê das fatias do donut; `color` é a cor sólida
// usada na legenda e nos mini-donuts (representa a categoria).
const CAT_META = {
  STOCK:  { label: "Ações",      color: "#7FB3FF", grad: ["#7FB3FF", "#A7CCFF"], emoji: "📈" },
  OPTION: { label: "Opções",     color: PINK,      emoji: "🎯" },
  CFD:    { label: "CFDs",       color: "#F28F8F", grad: ["#F28F8F", "#F5B3B3"], emoji: "⚡" },
  FUTURE: { label: "Futuros",    color: "#C9A3E6", grad: ["#C9A3E6", "#DCC4F2"], emoji: "📊" },
  FUT:    { label: "Futuros",    color: "#C9A3E6", grad: ["#C9A3E6", "#DCC4F2"], emoji: "📊" },
  FOREX:  { label: "Forex",      color: "#22d3ee", emoji: "💱" },
  CRYPTO: { label: "Cripto",     color: "#FFA94D", grad: ["#FFA94D", "#FFD580"], emoji: "₿" },
  BOND:   { label: "Obrigações", color: "#94a3b8", emoji: "📜" },
};
// Cores atribuídas por ordem de aparição a categorias sem entrada em CAT_META.
const CAT_FALLBACK_COLORS = ["#a78bfa", "#22d3ee", "#fb7185", "#34d399", "#facc15", "#c084fc", "#fb923c"];
// Paleta para as fatias do donut de ativos em carteira (junto ao Win/Loss).
const ASSET_COLORS = ["#f7931a", "#627eea", "#14f195", "#2a5ada", "#26a17b", "#a78bfa", "#22d3ee", "#fb7185", "#34d399", "#facc15", "#c084fc", "#fb923c"];
// Rótulo legível para uma categoria não mapeada: "FUTURE" → "Future".
const prettyCat = cat => !cat ? "Outros" : cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();

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

// Card de métrica (estilo dos cards antigos): ícone com fundo da cor do card, a borda
// muda para essa cor ao passar o rato, e ícone "i" com tooltip que abre POR BAIXO (para
// não ser cortado no topo da página).
function MetricCard({ icon, color, label, value, sub, subColor, info, onClick }) {
  const [iShow, setIShow] = useState(false);
  return (
    <div onClick={onClick} style={{
      position: "relative", flex: "1 1 0", minWidth: 190,
      background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14,
      padding: "16px 18px", display: "flex", alignItems: "center", gap: 14,
      cursor: onClick ? "pointer" : "default", transition: "border-color .2s, transform .2s",
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "translateY(0)"; }}>
      {/* Símbolo (ícone) com fundo da cor do card */}
      <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: `${color}26`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </div>
      {/* Conteúdo */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: "0.68rem", color: MUTE, fontWeight: 500, paddingRight: 16 }}>{label}</div>
        <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text)", lineHeight: 1.15, letterSpacing: "-0.5px" }}>{value}</div>
        {sub && <div style={{ fontSize: "0.68rem", color: subColor || GREEN, marginTop: 2, fontWeight: 600 }}>{sub}</div>}
      </div>
      {/* "i" com tooltip por baixo */}
      {info && (
        <span style={{ position: "absolute", top: 11, right: 11 }}
          onMouseEnter={() => setIShow(true)} onMouseLeave={() => setIShow(false)}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 15, height: 15, borderRadius: "50%", border: `1px solid ${MUTE}`,
            color: MUTE, fontSize: "0.58rem", fontStyle: "italic", fontWeight: 800, cursor: "help",
          }}>i</span>
          {iShow && (
            <div style={{
              position: "absolute", top: "calc(100% + 7px)", right: 0, width: 220,
              background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 8, padding: "8px 11px", fontSize: "0.68rem", color: "#c4c4d4",
              zIndex: 400, lineHeight: 1.5, boxShadow: "0 8px 22px rgba(0,0,0,0.5)",
            }}>{info}</div>
          )}
        </span>
      )}
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
  const [holdings, setHoldings]   = useState([]);
  const [fvEdit, setFvEdit]       = useState(null);   // edição do valor justo: { simbolo, valor }
  const [allTrades, setAllTrades] = useState([]);
  const [allDivs, setAllDivs]     = useState([]);
  const [divTotal, setDivTotal]   = useState(null);
  const [deposits, setDeposits]   = useState([]);
  const [equityAll, setEquityAll] = useState([]);   // equity acumulada desde sempre
  const [eqDetail, setEqDetail]   = useState({ categories: [], series: [] }); // equity acumulada por categoria
  const [eqRange, setEqRange]     = useState("MAX"); // 1D|5D|6M|YTD|1A|3A|5A|10A|MAX
  const [perfTab, setPerfTab]     = useState("value");     // value | market (market = brevemente)
  const [chartMode, setChartMode] = useState("combined");  // combined | stacked
  const [modal, setModal]               = useState(null);
  const [modalStack, setModalStack]     = useState([]);   // histórico para voltar atrás entre modais
  const [loading, setLoading]           = useState(true);

  // Abre um modal a partir de dentro de outro, guardando o anterior para poder voltar.
  // `parentPatch` permite anotar o modal-pai (ex: { selectedId } da linha clicada) para
  // que, ao voltar atrás, se possa destacar e fazer scroll até essa linha.
  const pushModal = (m, parentPatch = {}) => {
    setModalStack(s => [...s, { ...modal, ...parentPatch }]);
    setModal(m);
  };
  // Fecha o modal atual: se houver anterior, volta a ele; senão fecha tudo.
  const closeModal = () => {
    if (modalStack.length > 0) {
      setModal(modalStack[modalStack.length - 1]);
      setModalStack(modalStack.slice(0, -1));
    } else {
      setModal(null);
    }
  };

  // Ao voltar a um modal com linha previamente clicada, faz scroll até ela (centrada).
  useLayoutEffect(() => {
    if (modal?.selectedId == null) return;
    const el = document.querySelector(`.modal-body [data-modal-row="${modal.selectedId}"]`);
    if (el) el.scrollIntoView({ block: "center" });
  }, [modal]);
  const [anosReady, setAnosReady]       = useState(false);

  useEffect(() => {
    // Pedido que "porteia" a página: se falhar transitoriamente no arranque mostraria o
    // ecrã "sem dados". Tenta algumas vezes com backoff antes de desistir (ver load()).
    const getAnosWithRetry = async (tries = 3) => {
      for (let attempt = 1; attempt <= tries; attempt++) {
        try { return await axios.get("/api/trades/anos"); }
        catch (e) {
          if (attempt < tries) { await new Promise(r => setTimeout(r, 400 * attempt)); continue; }
          throw e;
        }
      }
    };
    getAnosWithRetry().then(r => {
      setAnos(r.data);
      if (r.data.length) setAno(r.data[0]);
      else setLoading(false); // sem nenhum ano (nem trades nem dividendos) — não há nada para carregar
    }).catch(() => setLoading(false)).finally(() => setAnosReady(true));
    axios.get("/api/import/deposits").then(r => setDeposits(r.data)).catch(() => {});
    axios.get("/api/trades/equity").then(r => setEquityAll(r.data)).catch(() => {}); // sem ?ano = desde início
    axios.get("/api/trades/equity-detailed").then(r => setEqDetail(r.data)).catch(() => {}); // por categoria
    loadHoldings(); // posições abertas (não dependem do ano)
  }, []);

  // Recarrega as "Ações em Carteira" (posições abertas). Usado no arranque e após
  // editar o valor justo manual de um símbolo.
  const loadHoldings = useCallback(() => {
    axios.get("/api/trades/holdings").then(r => setHoldings(r.data)).catch(() => {});
  }, []);

  // Edição inline do Valor Justo (manual). fvEdit = { simbolo, valor } ou null.
  const saveFairValue = async (simbolo, valor, moeda) => {
    try { await axios.post("/api/trades/fair-value", { simbolo, valor, moeda }); } catch { /* ignora */ }
    setFvEdit(null);
    loadHoldings();
  };

  // Define manualmente o ticker da Yahoo de um símbolo (quando o automático não acerta).
  const setTicker = async (h) => {
    const atual = h.yahoo_ticker_efetivo || "";
    const tk = window.prompt(
      `Ticker da Yahoo Finance para ${h.simbolo} (ex.: AAPL, SAP.DE, COR.LS).\nDeixa vazio para voltar ao automático.`,
      atual,
    );
    if (tk === null) return;                       // cancelou
    try { await axios.post("/api/trades/yahoo-ticker", { simbolo: h.simbolo, ticker: tk.trim() }); } catch { /* ignora */ }
    loadHoldings();
  };

  const load = useCallback(async (a) => {
    if (!a) return;
    setLoading(true);
    // Na primeira entrada o backend recebe um burst de pedidos em paralelo enquanto
    // ainda está a "aquecer" (1ª abertura da BD + leituras concorrentes do ficheiro de
    // sessão). Em Windows uma dessas leituras falha ocasionalmente. Como é transitório
    // (um refresh resolve), tentamos automaticamente algumas vezes antes de desistir.
    const MAX_TRIES = 3;
    for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
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
        setLoading(false);
        return;
      } catch {
        if (attempt < MAX_TRIES) {
          await new Promise(r => setTimeout(r, 400 * attempt)); // backoff: 400ms, 800ms
          continue;
        }
        setStats(null);
        setLoading(false);
      }
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
  const expectancy  = stats.n_trades > 0 ? (stats.net_pl ?? 0) / stats.n_trades : 0;
  const top10sym    = [...bySymbol].filter(s => Math.abs(s.pl_total) > 0.001).sort((a, b) => a.pl_total - b.pl_total);

  const catStats = (cat) => {
    const trades = allTrades.filter(t => t.categoria === cat);
    const pl     = tradeSum(trades);
    const wins   = trades.filter(t => t.pl_eur > 0).length;
    return { trades, pl, n: trades.length, wr: trades.length > 0 ? wins / trades.length * 100 : 0 };
  };
  // ── Categorias de trades detetadas automaticamente a partir dos dados ──
  // Em vez de uma lista fixa (STOCK/OPTION/CFD), percorremos as categorias
  // realmente presentes em allTrades. Assim, basta o relatório trazer uma
  // categoria nova (ex.: FUTURE) para ela aparecer no card sem alterar código.
  let _fallbackColorIdx = 0;
  const tradeCats = [...new Set(allTrades.map(t => t.categoria || "OUTROS"))]
    .map(cat => {
      const st    = catStats(cat);
      const meta  = CAT_META[cat] || {};
      const color = meta.color || CAT_FALLBACK_COLORS[_fallbackColorIdx++ % CAT_FALLBACK_COLORS.length];
      const label = meta.label || prettyCat(cat);
      const emoji = meta.emoji || "📂";
      return { label, color, grad: meta.grad, value: st.pl, n: st.n, onClick: () => openCategory(cat, label, emoji) };
    })
    .filter(c => c.n > 0)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  // Dividendos e Juros vêm de allDivs (não de allTrades) — entram como categorias próprias.
  const nDividendos = allDivs.filter(d => d.tipo !== "INTEREST").length;
  const nJuros      = allDivs.filter(d => d.tipo === "INTEREST").length;
  const incomeCats  = [
    { label: "Dividendos", color: "#8FD8B0", grad: ["#8FD8B0", "#B8E8CC"], value: dividendsLiq, onClick: openDivs,     show: dividendsLiq !== 0 },
    { label: "Juros",      color: "#AEB5C0", grad: ["#AEB5C0", "#C9CED6"], value: interestLiq,  onClick: openInterest, show: interestLiq !== 0 },
  ].filter(c => c.show);

  // Criptomoedas em "hold" (posições Bybit) — sem trades fechados, entram na repartição
  // pelo seu valor de mercado atual (somatório das posições de categoria CRYPTO).
  const cryptoHoldings = holdings.filter(h => h.categoria === "CRYPTO");
  const cryptoValue    = cryptoHoldings.reduce((s, h) => s + (h.valor_eur || 0), 0);
  const cryptoCat      = cryptoValue !== 0
    ? [{ label: "Criptomoedas", color: CAT_META.CRYPTO.color, grad: CAT_META.CRYPTO.grad, value: cryptoValue }]
    : [];

  // Repartição completa (trades + rendimento + cripto em carteira) — partilhada pelo donut
  // dedicado "Repartição por Categoria" e pelo card "Categorias" (mini-donuts).
  // Fatias dimensionadas pelo valor absoluto; legenda mostra o valor com sinal e a % do total absoluto.
  const catBreakdown    = [...tradeCats, ...incomeCats, ...cryptoCat];
  const catBreakdownAbs = catBreakdown.reduce((s, c) => s + Math.abs(c.value), 0);
  const catBreakdownNet = catBreakdown.reduce((s, c) => s + c.value, 0);
  const catPct          = val => catBreakdownAbs > 0 ? Math.abs(val) / catBreakdownAbs * 100 : 0;
  const catDonuts       = catBreakdown.map(c => ({ ...c, pct: catPct(c.value) }));

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

  // ── Métricas do card "Total Acumulado" (estilo carteira) ──
  // Base de custo = capital líquido injetado (depósitos − levantamentos).
  const costBasis = deposits.reduce((s, d) =>
    s + (d.tipo === "deposito" ? (d.valor || 0) : d.tipo === "levantamento" ? -(d.valor || 0) : 0), 0);
  // Resultado realizado acumulado (todas as contas, desde sempre) = último ponto da equity.
  const realizedAll   = equityAll.length ? equityAll[equityAll.length - 1].equity : 0;
  // Valor da carteira = capital injetado + resultado acumulado.
  const portfolioValue = costBasis + realizedAll;
  // Retorno total sobre o capital.
  const totalReturnPct = costBasis > 0 ? realizedAll / costBasis * 100 : 0;
  // Retorno do último dia com movimento (delta da equity) e % sobre o valor da carteira na véspera.
  const lastEqDelta = equityAll.length >= 2
    ? equityAll[equityAll.length - 1].equity - equityAll[equityAll.length - 2].equity
    : (equityAll.length === 1 ? equityAll[0].equity : 0);
  const prevPortfolio = costBasis + (equityAll.length >= 2 ? equityAll[equityAll.length - 2].equity : 0);
  const oneDayPct     = prevPortfolio > 0 ? lastEqDelta / prevPortfolio * 100 : 0;
  // Nº de contas distintas (proxy para "participações" — não há posições abertas).
  const nContas = new Set([
    ...allTrades.map(t => t.conta).filter(Boolean),
    ...deposits.map(d => d.conta).filter(Boolean),
  ]).size;
  // TIR anualizada (CAGR) sobre o período investido — retorno anualizado do capital.
  const annualisedPct = (() => {
    if (costBasis <= 0 || portfolioValue <= 0 || equityAll.length === 0) return null;
    const firstDay = equityAll[0].dia, lastDay = equityAll[equityAll.length - 1].dia;
    const years = (new Date(lastDay) - new Date(firstDay)) / (365.25 * 24 * 3600 * 1000);
    if (years < 0.08) return totalReturnPct;     // período demasiado curto → usa o retorno total
    return (Math.pow(portfolioValue / costBasis, 1 / years) - 1) * 100;
  })();
  // Retorno da carteira na janela escolhida (para a legenda junto ao gráfico).
  const rangeStartEq   = eqData.length ? eqData[0].equity : 0;
  const rangeDelta     = (eqData.length ? eqData[eqData.length - 1].equity : 0) - rangeStartEq;
  const rangeReturnPct = (costBasis + rangeStartEq) !== 0 ? rangeDelta / (costBasis + rangeStartEq) * 100 : 0;
  // Série por categoria filtrada pela mesma janela (modo "Empilhado").
  const eqDetailData = eqStart ? eqDetail.series.filter(p => p.dia >= eqStart) : eqDetail.series;
  // Categorias presentes, com cor/rótulo (reaproveita CAT_META).
  const eqStackCats = (eqDetail.categories || []).map(cat => ({
    key: cat,
    label: CAT_META[cat]?.label || prettyCat(cat),
    color: CAT_META[cat]?.color || CAT_FALLBACK_COLORS[(eqDetail.categories.indexOf(cat)) % CAT_FALLBACK_COLORS.length],
  }));
  const pctTxt = v => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;
  // Valor de mercado total da carteira (base para o "Peso" de cada posição).
  const holdingsTotalValue = holdings.reduce((s, h) => s + (h.valor_eur || 0), 0);

  // Donut dos vários ativos em carteira (junto ao Win/Loss): peso de cada ativo pelo
  // seu valor de mercado. Inclui cripto (Bybit) e quaisquer outras posições abertas.
  const assetDonut = holdings
    .filter(h => (h.valor_eur || 0) > 0)
    .sort((a, b) => (b.valor_eur || 0) - (a.valor_eur || 0))
    .map((h, i) => ({ name: h.simbolo, v: h.valor_eur, color: ASSET_COLORS[i % ASSET_COLORS.length] }));
  const assetDonutTotal = assetDonut.reduce((s, a) => s + a.v, 0);

  // ── Métricas dos 5 cards de topo ──
  // Unrealized Returns: ganhos/perdas das posições ainda não vendidas (P/L não realizado).
  const unrealTotal = holdings.reduce((s, h) => s + (h.pl_eur || 0), 0);
  const unrealCost  = holdings.reduce((s, h) => s + (h.custo_eur || 0), 0);
  const unrealPct   = unrealCost ? unrealTotal / unrealCost * 100 : null;
  // Realized Returns: resultado de posições já vendidas (trades fechados).
  const realizedNet = stats.net_pl ?? 0;
  const realizedPct = costBasis ? realizedNet / costBasis * 100 : null;
  // Dividends: rendimento de dividendos.
  const divPct = costBasis ? dividendsLiq / costBasis * 100 : null;
  // Currency Impact: efeito do câmbio nos resultados realizados de ativos estrangeiros.
  const fxClosed = allTrades.filter(t => t.moeda_original && t.moeda_original !== "EUR" && t.pl_orig != null && t.taxa_cambio);
  const currencyImpact = fxClosed.length
    ? fxClosed.reduce((s, t) => s + (Math.abs(t.pl_eur || 0) - Math.abs(t.pl_orig || 0)), 0)
    : null;
  const realizedAbs = fxClosed.reduce((s, t) => s + Math.abs(t.pl_orig || 0), 0);
  const currencyPct = currencyImpact != null && realizedAbs ? currencyImpact / realizedAbs * 100 : null;

  return (
    <div>
      {/* ── Header (desliza com a página, como nas outras) ── */}
      <div className="page-header">
        <div className="page-title">Diário de Trading</div>
        <div className="page-sub">Resumo do desempenho e da sua atividade de trading</div>
      </div>

      {/* ── 5 cards de topo (estilo dos cards antigos) ── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, overflowX: "auto", paddingTop: 4, paddingBottom: 4 }}>
        <MetricCard
          icon={IcoBar(BLUE)} color={BLUE}
          label="Retornos Não Realizados"
          value={fmt(unrealTotal)}
          sub={unrealPct != null ? pctTxt(unrealPct) : "—"}
          subColor={unrealTotal >= 0 ? GREEN : RED}
          info="Ganhos ou perdas das posições que ainda não vendeste (em carteira)."
        />
        <MetricCard
          icon={IcoLine(PINK)} color={PINK}
          label="Retornos Realizados"
          value={fmt(realizedNet)}
          sub={realizedPct != null ? pctTxt(realizedPct) : "—"}
          subColor={realizedNet >= 0 ? GREEN : RED}
          info="Ganhos ou perdas de posições já vendidas (operações fechadas)."
          onClick={openAllTrades}
        />
        <MetricCard
          icon={IcoCoin(GREEN)} color={GREEN}
          label="Dividendos"
          value={fmt(dividendsLiq)}
          sub={divPct != null ? pctTxt(divPct) : "—"}
          subColor={GREEN}
          info="Rendimento recebido de pagamentos de dividendos."
          onClick={openDivs}
        />
        <MetricCard
          icon={IcoBank(AMBER)} color={AMBER}
          label="Impacto Cambial"
          value={currencyImpact != null ? fmt(currencyImpact) : "n/d"}
          sub={currencyPct != null ? pctTxt(currencyPct) : "n/d"}
          subColor={(currencyImpact ?? 0) >= 0 ? GREEN : RED}
          info="Impacto das variações cambiais nos resultados realizados de ativos estrangeiros. Aparece após importar operações em moeda diferente do EUR."
        />
        <MetricCard
          icon={IcoCoin(PURPLE)} color={PURPLE}
          label="Dividendos Estimados"
          value="n/d"
          sub="próximos 12 meses"
          subColor={MUTE}
          info="Rendimento futuro estimado de dividendos nos próximos 12 meses. Requer dados de previsão que a aplicação ainda não tem."
        />
      </div>

      {/* ── Total Acumulado + Repartição por categoria (lado a lado) ── */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20, alignItems: "stretch" }}>
      <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>

          {/* ── Tabs: Valor ao longo do tempo · Desempenho vs Mercado ── */}
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            {[
              { id: "value",  label: "Valor ao Longo do Tempo", enabled: true },
              { id: "market", label: "Desempenho vs Mercado",   enabled: false },
            ].map(t => {
              const active = perfTab === t.id;
              return (
                <button key={t.id}
                  onClick={() => t.enabled && setPerfTab(t.id)}
                  disabled={!t.enabled}
                  title={t.enabled ? undefined : "Disponível em breve — requer dados de um índice de referência"}
                  style={{
                    padding: "8px 14px", borderRadius: 9, fontSize: "0.78rem", fontFamily: "var(--font)",
                    fontWeight: 700, whiteSpace: "nowrap",
                    cursor: t.enabled ? "pointer" : "not-allowed", opacity: t.enabled ? 1 : 0.45,
                    border: `1px solid ${active ? "rgba(96,165,250,0.45)" : "var(--border)"}`,
                    background: active ? "rgba(96,165,250,0.16)" : "transparent",
                    color: active ? "#60a5fa" : MUTE, transition: "background .15s",
                  }}
                >
                  {t.label}{!t.enabled && <span style={{ fontSize: "0.62rem", marginLeft: 6, opacity: 0.8 }}>(brevemente)</span>}
                </button>
              );
            })}
          </div>

          {/* ── 4 painéis de métricas ── */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 0, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 18 }}>
            {[
              { value: fmtAbs(portfolioValue), valColor: "var(--text)", label: `Valor Total · ${nContas} ${nContas === 1 ? "conta" : "contas"}`, sub: null },
              { value: fmt(lastEqDelta), valColor: lastEqDelta >= 0 ? GREEN : RED, label: "Retornos 1D", sub: pctTxt(oneDayPct), subColor: lastEqDelta >= 0 ? GREEN : RED },
              { value: fmt(realizedAll), valColor: realizedAll >= 0 ? GREEN : RED, label: "Retornos Totais", sub: pctTxt(totalReturnPct), subColor: realizedAll >= 0 ? GREEN : RED },
              { value: annualisedPct == null ? "—" : pctTxt(annualisedPct), valColor: (annualisedPct ?? 0) >= 0 ? GREEN : RED, label: "TIR Anualizada", sub: null },
            ].map((m, i) => (
              <div key={i} style={{ flex: "1 1 150px", minWidth: 130, paddingRight: 16, borderRight: i < 3 ? "1px solid var(--border)" : "none", paddingLeft: i > 0 ? 16 : 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 7, flexWrap: "wrap" }}>
                  <span style={{ fontSize: "1.35rem", fontWeight: 800, letterSpacing: "-0.5px", color: m.valColor }}>{m.value}</span>
                  {m.sub && <span style={{ fontSize: "0.74rem", fontWeight: 700, color: m.subColor }}>{m.sub}</span>}
                </div>
                <div style={{ fontSize: "0.7rem", color: MUTE, marginTop: 4, fontWeight: 500 }}>{m.label}</div>
              </div>
            ))}
          </div>

          {/* ── Valor da carteira / Base de custo (esq.) + intervalos (dir.) ── */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 26 }}>
              <div>
                <div style={{ fontSize: "0.66rem", color: MUTE, fontWeight: 600, marginBottom: 3 }}>Valor da Carteira</div>
                <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text)" }}>{fmtAbs(portfolioValue)}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.66rem", color: MUTE, fontWeight: 600, marginBottom: 3 }}>Base de Custo</div>
                <div style={{ fontSize: "1.05rem", fontWeight: 800, color: MUTE }}>{fmtAbs(costBasis)}</div>
              </div>
            </div>
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

          {/* ── Legenda: retorno da carteira na janela + mercado (n/d) ── */}
          <div style={{ display: "flex", gap: 18, marginBottom: 6, fontSize: "0.72rem" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 14, height: 3, borderRadius: 2, background: rangeReturnPct >= 0 ? GREEN : RED }} />
              <span style={{ color: MUTE }}>Carteira</span>
              <span style={{ fontWeight: 700, color: rangeReturnPct >= 0 ? GREEN : RED }}>{pctTxt(rangeReturnPct)}</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.5 }}>
              <span style={{ width: 14, height: 3, borderRadius: 2, background: MUTE }} />
              <span style={{ color: MUTE }}>Mercado</span>
              <span style={{ color: MUTE }}>n/d</span>
            </span>
          </div>

          {/* ── Gráfico (combinado ou empilhado) ── */}
          <div style={{ flex: 1, minHeight: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              {chartMode === "stacked" ? (
                <AreaChart data={eqDetailData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fill: MUTE, fontSize: 9 }} tickFormatter={d => d?.slice(5)} interval="preserveStartEnd" minTickGap={28} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: MUTE, fontSize: 9 }} tickFormatter={v => `€${v}`} width={46} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v, n) => [fmt(v), CAT_META[n]?.label || prettyCat(n)]}
                    contentStyle={{ background: "#252530", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: MUTE }}
                  />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />
                  {eqStackCats.map(c => (
                    <Area key={c.key} type="monotone" dataKey={c.key} stackId="eq" stroke={c.color} fill={c.color} fillOpacity={0.5} strokeWidth={1.5} dot={false} />
                  ))}
                </AreaChart>
              ) : (
                <AreaChart data={eqData}>
                  <defs>
                    <linearGradient id="eqStroke" x1="0" y1="0" x2="0" y2="1">
                      <stop offset={eqOff} stopColor="#10b981" stopOpacity={1} />
                      <stop offset={eqOff} stopColor="#f43f5e" stopOpacity={1} />
                    </linearGradient>
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
              )}
            </ResponsiveContainer>
          </div>

          {/* ── Toggle Empilhado / Combinado ── */}
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            {[
              { id: "stacked",  label: "Empilhado" },
              { id: "combined", label: "Combinado" },
            ].map(m => {
              const active = chartMode === m.id;
              return (
                <button key={m.id} onClick={() => setChartMode(m.id)} style={{
                  padding: "6px 14px", borderRadius: 8, fontSize: "0.72rem", fontWeight: 700,
                  cursor: "pointer", fontFamily: "var(--font)",
                  border: `1px solid ${active ? "rgba(96,165,250,0.45)" : "var(--border)"}`,
                  background: active ? "rgba(96,165,250,0.16)" : "transparent",
                  color: active ? "#60a5fa" : MUTE, transition: "background .15s",
                }}>{m.label}</button>
              );
            })}
          </div>
          <div className="card-footer">Evolução do valor da carteira ao longo do tempo. Alterna entre vista empilhada (por conta) e combinada.</div>
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
                    <defs>
                      {catBreakdown.map((c, i) => (
                        <linearGradient key={i} id={`catGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor={c.grad ? c.grad[0] : shade(c.color, 0.18)} />
                          <stop offset="100%" stopColor={c.grad ? c.grad[1] : shade(c.color, -0.12)} />
                        </linearGradient>
                      ))}
                    </defs>
                    <Pie data={catBreakdown.map(c => ({ name: c.label, v: Math.abs(c.value) }))} dataKey="v"
                      innerRadius={54} outerRadius={80} paddingAngle={2} stroke="none">
                      {catBreakdown.map((c, i) => <Cell key={i} fill={`url(#catGrad${i})`} />)}
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
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: c.grad ? `linear-gradient(180deg, ${c.grad[0]}, ${c.grad[1]})` : c.color, flexShrink: 0 }} />
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
          <div className="card-footer">Peso de cada categoria no P&L do ano (valores absolutos). As criptomoedas em carteira entram pelo seu valor de mercado atual.</div>
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
                    <defs>
                      <linearGradient id="wlWin" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={shade("#34d399", 0.18)} />
                        <stop offset="100%" stopColor={shade("#34d399", -0.12)} />
                      </linearGradient>
                      <linearGradient id="wlLoss" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={shade("#fb7185", 0.18)} />
                        <stop offset="100%" stopColor={shade("#fb7185", -0.12)} />
                      </linearGradient>
                    </defs>
                    <Pie data={[{ v: stats.n_wins }, { v: stats.n_losses }]} dataKey="v" innerRadius={44} outerRadius={64} paddingAngle={3}
                      onClick={(_, index) => index === 0 ? openWins() : openLosses()} style={{ cursor: "pointer" }}>
                      <Cell fill="url(#wlWin)" /><Cell fill="url(#wlLoss)" />
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
              {/* Melhor / Pior Dia — por baixo do donut de Win Rate */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 180, marginTop: 14 }}>
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

            {/* Donut dos vários ativos em carteira (cripto em hold + outras posições) */}
            {assetDonut.length > 0 && (
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ position: "relative", width: 150, height: 150 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        {assetDonut.map((a, i) => (
                          <linearGradient key={i} id={`assetGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={shade(a.color, 0.18)} />
                            <stop offset="100%" stopColor={shade(a.color, -0.12)} />
                          </linearGradient>
                        ))}
                      </defs>
                      <Pie data={assetDonut} dataKey="v" nameKey="name" innerRadius={44} outerRadius={64} paddingAngle={3} stroke="none">
                        {assetDonut.map((a, i) => <Cell key={i} fill={`url(#assetGrad${i})`} />)}
                      </Pie>
                      <Tooltip formatter={(v, n) => [fmtAbs(v), n]}
                        contentStyle={{ background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontSize: 12 }}
                        itemStyle={{ color: "#fff" }} wrapperStyle={{ zIndex: 9999 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center", pointerEvents: "none" }}>
                    <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text)", lineHeight: 1 }}>{assetDonut.length}</div>
                    <div style={{ fontSize: "0.55rem", color: MUTE, marginTop: 2 }}>Ativos</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3, marginTop: 8, fontSize: "0.68rem" }}>
                  {assetDonut.slice(0, 6).map(a => (
                    <span key={a.name} style={{ color: a.color, whiteSpace: "nowrap" }}>
                      ● <span style={{ color: "var(--text)" }}>{a.name}</span>
                      <span style={{ color: MUTE }}> {assetDonutTotal ? (a.v / assetDonutTotal * 100).toFixed(0) : 0}%</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>

          <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px dashed rgba(255,255,255,0.1)", fontSize: "0.68rem", color: MUTE, lineHeight: 1.6 }}>
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
              // Win Rate, Trades Ganhos e Trades Perdidos foram removidos por já constarem
              // no donut Win/Loss ao lado (centro = Win Rate; legenda = nº de Wins/Losses).
              { label: "Total de Trades", value: stats.n_trades,            sub: "operações fechadas", color: "var(--text)", onClick: openAllTrades },
              { label: "Profit Factor",   value: pf.toFixed(2),             sub: "ganhos ÷ perdas",    color: pf >= 1 ? GREEN : RED, onClick: openAllTrades },
              { label: "Juros",           value: fmt(interestLiq),          sub: "saldos à ordem",     color: interestLiq >= 0 ? GREEN : RED, onClick: openInterest },
              { label: "Expectancy",      value: fmt(expectancy),           sub: "por trade",          color: expectancy >= 0 ? GREEN : RED, onClick: openAllTrades },
              { label: "Max Drawdown",    value: `-${fmtAbs(maxDrawdown)}`, sub: "pico → vale",        color: RED,   onClick: openAllTrades },
              { label: "Avg Win",         value: fmt(stats.avg_win ?? 0),   sub: "por trade ganho",    color: GREEN, onClick: openWins },
              { label: "Avg Loss",        value: fmt(stats.avg_loss ?? 0),  sub: "por trade perdido",  color: RED,   onClick: openLosses },
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
        <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column" }}>
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
          <div style={{ borderTop: "1px dashed rgba(255,255,255,0.1)", marginTop: "auto", paddingTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
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
        <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column" }}>
          <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--text)", marginBottom: 2 }}>Categorias</div>
          <div style={{ fontSize: "0.72rem", color: MUTE, marginBottom: 22 }}>% do P&L total por categoria</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, justifyItems: "center" }}>
            {catDonuts.map(c => (
              <MiniDonut key={c.label} pct={c.pct} label={c.label} color={c.color} onClick={c.onClick} value={c.value} />
            ))}
          </div>
          <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px dashed rgba(255,255,255,0.13)", display: "flex", alignItems: "center", gap: 12 }}>
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

      {/* ── Ações em Carteira (posições abertas) ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text)" }}>Ações em Carteira</span>
        <span style={{ background: "var(--hover)", color: MUTE, fontSize: "0.72rem", fontWeight: 700, borderRadius: 20, padding: "2px 10px" }}>{holdings.length}</span>
      </div>
      {holdings.length === 0 ? (
        <div style={{ color: MUTE, fontSize: "0.85rem", padding: "16px 0", lineHeight: 1.6 }}>
          Sem posições abertas. Importa um <strong>Activity Statement do IBKR</strong> que inclua a secção <em>“Open Positions”</em> — as ações em carteira são atualizadas automaticamente a cada importação.
        </div>
      ) : (() => {
        const COLS = "minmax(150px,1.6fr) 1fr 1.4fr 1.1fr 1.2fr 1fr 1fr";
        const HEADERS = ["Símbolo", "Último Preço", "Valor Justo", "Retorno Total", "Valor/Custo", "Peso/Ações", "Preço Médio"];
        return (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 860 }}>
              {/* Títulos (como cabeçalho de tabela) */}
              <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 12, padding: "0 16px 8px", borderBottom: "1px solid var(--border)" }}>
                {HEADERS.map(h => (
                  <div key={h} style={{ fontSize: "0.7rem", color: MUTE, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</div>
                ))}
              </div>

              {/* Cada ativo = um card */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {holdings.map(h => {
                  const retPct  = h.custo_eur ? (h.pl_eur || 0) / h.custo_eur * 100 : 0;
                  const peso    = holdingsTotalValue ? (h.valor_eur || 0) / holdingsTotalValue * 100 : 0;
                  const pos     = (h.pl_eur || 0) >= 0;
                  const fvMoeda = h.valor_justo_moeda || h.moeda;
                  // Desconto vs último preço: positivo = subvalorizada.
                  const disc = (h.valor_justo != null && h.preco_atual)
                    ? (h.valor_justo - h.preco_atual) / h.valor_justo * 100 : null;
                  const editing = fvEdit?.simbolo === h.simbolo;
                  const stop = e => e.stopPropagation();
                  return (
                    <div key={h.simbolo} className="card" onClick={() => openSymbolHistory(h.simbolo)}
                      style={{ display: "grid", gridTemplateColumns: COLS, gap: 12, alignItems: "center",
                        padding: "14px 16px", cursor: "pointer", transition: "border-color .15s" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = "var(--accent)"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}>

                      {/* Nome do ativo + corretora */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ fontWeight: 800, color: "#fbbf24" }}>{h.simbolo}</span>
                          {h.corretora && (
                            <span style={{ fontSize: "0.6rem", fontWeight: 700, color: MUTE,
                              border: "1px solid var(--border)", borderRadius: 5, padding: "1px 5px", whiteSpace: "nowrap" }}>
                              {h.corretora}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.7rem", color: MUTE, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {h.nome || CAT_META[h.categoria]?.label || h.categoria || "—"}
                        </div>
                      </div>

                      {/* Último preço (ao vivo da Yahoo, com fallback ao relatório) */}
                      <div style={{ whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 700, color: "var(--text)" }}>{fmtCur(h.preco_atual, h.moeda)}</div>
                        {h.preco_fonte === "yahoo" ? (
                          <div style={{ fontSize: "0.62rem", color: GREEN, display: "flex", alignItems: "center", gap: 3 }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: GREEN, display: "inline-block" }} />
                            ao vivo
                          </div>
                        ) : (
                          <button onClick={e => { e.stopPropagation(); setTicker(h); }} title="Cotação ao vivo indisponível — definir ticker da Yahoo"
                            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "0.62rem", color: "#f59e0b", textDecoration: "underline" }}>
                            do relatório · definir ticker
                          </button>
                        )}
                      </div>

                      {/* Valor Justo (manual, com lápis) */}
                      <div onClick={stop} style={{ minWidth: 0 }}>
                        {editing ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <input type="number" autoFocus value={fvEdit.valor}
                              onChange={e => setFvEdit({ ...fvEdit, valor: e.target.value })}
                              onKeyDown={e => { if (e.key === "Enter") saveFairValue(h.simbolo, fvEdit.valor, fvMoeda); if (e.key === "Escape") setFvEdit(null); }}
                              style={{ width: 90, padding: "4px 6px", fontSize: "0.78rem" }} />
                            <button onClick={() => saveFairValue(h.simbolo, fvEdit.valor, fvMoeda)} title="Guardar"
                              style={{ background: "none", border: "none", cursor: "pointer", color: GREEN, padding: 2 }}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            </button>
                            <button onClick={() => setFvEdit(null)} title="Cancelar"
                              style={{ background: "none", border: "none", cursor: "pointer", color: MUTE, padding: 2 }}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ minWidth: 0 }}>
                              {h.valor_justo != null ? (
                                <>
                                  <div style={{ fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}>{fmtCur(h.valor_justo, fvMoeda)}</div>
                                  {disc != null && (
                                    <div style={{ fontSize: "0.68rem", color: disc >= 0 ? GREEN : RED, whiteSpace: "nowrap" }}>
                                      {Math.abs(disc).toFixed(1)}% {disc >= 0 ? "subvalorizada" : "sobrevalorizada"}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <span style={{ color: MUTE, fontStyle: "italic" }}>definir</span>
                              )}
                            </div>
                            <button onClick={() => setFvEdit({ simbolo: h.simbolo, valor: h.valor_justo ?? "" })} title="Editar valor justo"
                              style={{ background: "none", border: "none", cursor: "pointer", color: MUTE, padding: 2, flexShrink: 0 }}
                              onMouseEnter={e => e.currentTarget.style.color = "var(--accent)"}
                              onMouseLeave={e => e.currentTarget.style.color = MUTE}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Retorno Total (não realizado) */}
                      <div style={{ whiteSpace: "nowrap" }}>
                        <div style={{ color: pos ? GREEN : RED, fontWeight: 700 }}>{pctTxt(retPct)}</div>
                        <div style={{ fontSize: "0.7rem", color: pos ? GREEN : RED }}>{fmt(h.pl_eur || 0)}</div>
                      </div>

                      {/* Valor / Custo (EUR) */}
                      <div style={{ whiteSpace: "nowrap" }}>
                        <div style={{ color: "var(--text)", fontWeight: 700 }}>{fmtAbs(h.valor_eur || 0)}</div>
                        <div style={{ fontSize: "0.7rem", color: MUTE }}>{fmtAbs(h.custo_eur || 0)}</div>
                      </div>

                      {/* Peso / Ações */}
                      <div style={{ whiteSpace: "nowrap" }}>
                        <div style={{ color: "var(--text)", fontWeight: 700 }}>{peso.toFixed(1)}%</div>
                        <div style={{ fontSize: "0.7rem", color: MUTE }}>{(h.quantidade ?? 0).toLocaleString("de-DE")}</div>
                      </div>

                      {/* Preço Médio (moeda nativa) */}
                      <div style={{ color: "var(--text)", whiteSpace: "nowrap" }}>{fmtCur(h.preco_medio, h.moeda)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
      <div style={{ fontSize: "0.66rem", color: MUTE, marginTop: 12, lineHeight: 1.5 }}>
        Posições abertas atualizadas a cada importação (secção <em>“Open Positions”</em> do relatório). <strong>Valor/Custo</strong> e <strong>Retorno Total</strong> em EUR; <strong>Último Preço</strong> e <strong>Preço Médio</strong> na moeda do ativo. <strong>Valor Justo</strong> é manual (ícone do lápis). A XTB normalmente não exporta posições abertas — usa o IBKR.
      </div>

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
                  <tr key={t.id} data-modal-row={t.id}
                    style={{
                      cursor: "pointer",
                      outline: modal.selectedId === t.id ? "2px solid var(--accent)" : "none",
                      outlineOffset: "-2px",
                      background: modal.selectedId === t.id ? "var(--hover)" : undefined,
                    }}
                    onClick={() => pushModal(
                      { title: `📌 ${t.simbolo} — ${t.data_fecho?.slice(0,10)??""}`, trades: [t], detailed: true, brokers: brokerTotals([t]), summary: { label: "1 trade", value: t.pl_eur ?? 0 } },
                      { selectedId: t.id },
                    )}>
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
                <div key={t.id}>
                  {/* Cabeçalho da operação (cantos superiores arredondados; o detalhe encaixa por baixo) */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                    background: "var(--hover)", border: "1px solid var(--border)", borderBottom: "none",
                    borderRadius: "10px 10px 0 0",
                  }}>
                    <span style={{ fontWeight: 700, color: "var(--text)", minWidth: 70 }}>{t.simbolo}</span>
                    <span className={`badge ${t.pl_eur > 0 ? "win" : "loss"}`}>{t.pl_eur > 0 ? "Win" : "Loss"}</span>
                    <span style={{ fontSize: 11, color: t.categoria === "CFD" ? RED : MUTE, fontWeight: t.categoria === "CFD" ? 700 : 400 }}>{t.categoria}</span>
                    <span style={{ color: MUTE, fontSize: 11 }}>{t.tipo_ordem}</span>
                    <span style={{ marginLeft: "auto", fontWeight: 700, color: t.pl_eur >= 0 ? GREEN : RED }}>{fmt(t.pl_eur)}</span>
                  </div>
                  <TradeDetail t={t} />
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
