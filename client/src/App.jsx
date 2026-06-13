import { useState } from "react";
import Dashboard   from "./pages/Dashboard.jsx";
import TradeLog    from "./pages/TradeLog.jsx";
import Calendar    from "./pages/Calendar.jsx";
import Statistics  from "./pages/Statistics.jsx";
import Import      from "./pages/Import.jsx";
import IRS         from "./pages/IRS.jsx";

/* ── Inline SVG icons ────────────────────────────────────── */
const GridIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5"/>
    <rect x="14" y="3" width="7" height="7" rx="1.5"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5"/>
    <rect x="14" y="14" width="7" height="7" rx="1.5"/>
  </svg>
);
const ListIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="9" y1="6" x2="20" y2="6"/>
    <line x1="9" y1="12" x2="20" y2="12"/>
    <line x1="9" y1="18" x2="20" y2="18"/>
    <circle cx="4" cy="6"  r="1.2" fill="currentColor" stroke="none"/>
    <circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none"/>
    <circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none"/>
  </svg>
);
const CalIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8"  y1="2" x2="8"  y2="6"/>
    <line x1="3"  y1="10" x2="21" y2="10"/>
  </svg>
);
const ChartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6"  y1="20" x2="6"  y2="14"/>
    <line x1="2"  y1="20" x2="22" y2="20"/>
  </svg>
);
const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);
const DocIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="9" y1="13" x2="15" y2="13"/>
    <line x1="9" y1="17" x2="15" y2="17"/>
  </svg>
);
const MenuIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <line x1="3" y1="6"  x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);
const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
  </svg>
);
const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1"  x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22"  x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1"  y1="12" x2="3"  y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);
const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 01-3.46 0"/>
  </svg>
);

/* ── Navigation config ───────────────────────────────────── */
const PAGES = [
  { id: "dashboard",  label: "Visão Geral",   icon: <GridIcon /> },
  { id: "tradelog",   label: "Registo",       icon: <ListIcon /> },
  { id: "calendar",   label: "Calendário",    icon: <CalIcon /> },
  { id: "statistics", label: "Estatísticas",  icon: <ChartIcon /> },
  { id: "import",     label: "Importar Dados", icon: <UploadIcon /> },
  { id: "irs",        label: "Relatório IRS", icon: <DocIcon /> },
];

export default function App() {
  const [page, setPage]           = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered]     = useState(false);
  const [darkMode, setDarkMode]   = useState(true);

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
  };

  const currentPage = PAGES.find(p => p.id === page);

  const renderPage = () => {
    switch (page) {
      case "dashboard":  return <Dashboard />;
      case "tradelog":   return <TradeLog />;
      case "calendar":   return <Calendar />;
      case "statistics": return <Statistics />;
      case "import":     return <Import />;
      case "irs":        return <IRS />;
      default:           return <Dashboard />;
    }
  };

  const sidebarClass = [
    "sidebar",
    collapsed             ? "collapsed" : "",
    collapsed && hovered  ? "hovered"   : "",
  ].filter(Boolean).join(" ");

  const toggleCollapse = () => {
    setCollapsed(c => !c);
    setHovered(false);
  };

  return (
    <div className="layout">

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside
        className={sidebarClass}
        onMouseEnter={() => collapsed && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">PC</div>
          <div className="sidebar-text">
            <div className="sidebar-logo-title">Diário de Trading</div>
            <div className="sidebar-logo-sub">Gestão e IRS</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <span className="nav-section-label sidebar-text">MENU</span>

          {PAGES.map(p => (
            <button
              key={p.id}
              className={`nav-item ${page === p.id ? "active" : ""}`}
              onClick={() => setPage(p.id)}
              title={collapsed && !hovered ? p.label : undefined}
            >
              <span className="nav-icon">{p.icon}</span>
              <span className="sidebar-text">{p.label}</span>
            </button>
          ))}
        </nav>

        {/* Footer card */}
        <div className="sidebar-footer-card sidebar-text">
          <div className="sidebar-footer-value">v1.0 Local</div>
          <div className="sidebar-footer-sub">
            Dados guardados localmente<br />
            Sem sincronização na nuvem
          </div>
        </div>
      </aside>

      {/* ── Right side ──────────────────────────────────── */}
      <div className={`layout-right${collapsed ? " collapsed" : ""}`}>

        {/* Topbar */}
        <header className="topbar">
          <button className="topbar-hamburger" onClick={toggleCollapse}>
            <MenuIcon />
          </button>

          <div className="topbar-spacer" />

          <div className="topbar-breadcrumb">
            <span>Diário de Trading</span>
            <span className="crumb-sep">›</span>
            <span className="crumb-cur">{currentPage?.label}</span>
          </div>

          <div className="topbar-actions">
            <div className="topbar-icon-btn" onClick={toggleTheme} style={{ cursor: "pointer" }}>
              {darkMode ? <MoonIcon /> : <SunIcon />}
            </div>
            <div className="topbar-icon-btn"><BellIcon /></div>
            <div className="topbar-avatar">PC</div>
          </div>
        </header>

        {/* Page content */}
        <main className="main-content">
          {renderPage()}
        </main>
      </div>

    </div>
  );
}
