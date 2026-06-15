import { useState, useEffect, useRef } from "react";
import axios from "axios";
import Dashboard   from "./pages/Dashboard.jsx";
import TradeLog    from "./pages/TradeLog.jsx";
import Calendar    from "./pages/Calendar.jsx";
import Statistics  from "./pages/Statistics.jsx";
import Import      from "./pages/Import.jsx";
import IRS         from "./pages/IRS.jsx";
import Login       from "./pages/Login.jsx";
import Admin       from "./pages/Admin.jsx";
import Settings    from "./pages/Settings.jsx";

axios.defaults.withCredentials = true;

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
const AdminIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87"/>
    <path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>
);

/* ── Navigation config ───────────────────────────────────── */
const PAGES = [
  { id: "dashboard",  label: "Visão Geral",    icon: <GridIcon /> },
  { id: "tradelog",   label: "Registo",        icon: <ListIcon /> },
  { id: "calendar",   label: "Calendário",     icon: <CalIcon /> },
  { id: "statistics", label: "Estatísticas",   icon: <ChartIcon /> },
  { id: "import",     label: "Importar Dados", icon: <UploadIcon /> },
  { id: "irs",        label: "Relatório IRS",  icon: <DocIcon /> },
];

export default function App() {
  const [page, setPage]               = useState("dashboard");
  const [pageLoading, setPageLoading] = useState(false);
  const [collapsed, setCollapsed]     = useState(false);
  const [hovered, setHovered]         = useState(false);
  const [darkMode, setDarkMode]       = useState(true);
  const [user, setUser]               = useState(null);
  const [fullName, setFullName]       = useState(null);
  const [isAdmin, setIsAdmin]         = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [cookiesOk, setCookiesOk]     = useState(() => localStorage.getItem("cookies_accepted") === "1");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  const navigateTo = (id) => {
    if (id === page) return;
    setPageLoading(true);
    setPage(id);
    setTimeout(() => setPageLoading(false), 400);
  };

  useEffect(() => {
    axios.get("/api/auth/me")
      .then(r => { setUser(r.data.username); setFullName(r.data.fullName); setIsAdmin(!!r.data.isAdmin); })
      .catch(() => { setUser(null); setFullName(null); setIsAdmin(false); })
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const logout = async () => {
    await axios.post("/api/auth/logout");
    setUser(null);
    setFullName(null);
    setIsAdmin(false);
  };

  const acceptCookies = () => {
    localStorage.setItem("cookies_accepted", "1");
    setCookiesOk(true);
  };

  if (!authChecked) return null;
  if (!user) return <Login onLogin={d => { setUser(d.username); setFullName(d.fullName); setIsAdmin(!!d.isAdmin); setPage("dashboard"); }} />;

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
  };

  const navPages = isAdmin
    ? [...PAGES, { id: "admin", label: "Administração", icon: <AdminIcon /> }]
    : PAGES;

  const renderPage = () => {
    switch (page) {
      case "dashboard":  return <Dashboard user={fullName || user} />;
      case "tradelog":   return <TradeLog />;
      case "calendar":   return <Calendar />;
      case "statistics": return <Statistics />;
      case "import":     return <Import />;
      case "irs":        return <IRS />;
      case "admin":      return isAdmin ? <Admin /> : <Dashboard />;
      case "settings":   return <Settings user={user} fullName={fullName} onFullNameChange={n => setFullName(n)} />;
      default:           return <Dashboard />;
    }
  };

  const sidebarClass = [
    "sidebar",
    collapsed            ? "collapsed" : "",
    collapsed && hovered ? "hovered"   : "",
  ].filter(Boolean).join(" ");

  const toggleCollapse = () => {
    setCollapsed(c => !c);
    setHovered(false);
  };

  const initials = (fullName || user)?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <div className="layout">

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside
        className={sidebarClass}
        onMouseEnter={() => collapsed && setHovered(true)}
        onMouseLeave={() => { setHovered(false); setUserMenuOpen(false); }}
      >
        {/* Hamburger + título */}
        <div className="sidebar-ham-area">
          <button
            className="sidebar-ham-btn"
            onClick={toggleCollapse}
            title={collapsed && !hovered ? "Expandir menu" : "Colapsar menu"}
          >
            <MenuIcon />
          </button>
          <span className="sidebar-text sidebar-ham-title">Diário de Trading</span>
        </div>

        {/* User section */}
        <div className="sidebar-user" ref={userMenuRef}>
          {userMenuOpen && (
            <div className="sidebar-user-menu">
              <div className="sidebar-user-menu-header">
                <div style={{ fontWeight: 700, color: "var(--text)", fontSize: "0.82rem" }}>{fullName || user}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--mute)", marginTop: 2 }}>{isAdmin ? "Administrador" : "Conta local"}</div>
              </div>

              <button className="sidebar-menu-item" onClick={toggleTheme}>
                <span className="sidebar-menu-icon">{darkMode ? <SunIcon /> : <MoonIcon />}</span>
                {darkMode ? "Tema Claro" : "Tema Escuro"}
              </button>

              <div className="sidebar-menu-divider" />

              <button className="sidebar-menu-item" onClick={() => { setUserMenuOpen(false); navigateTo("settings"); }}>
                <span className="sidebar-menu-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                </span>
                Definições
              </button>

              <div className="sidebar-menu-divider" />

              <button className="sidebar-menu-item sidebar-menu-item-danger" onClick={() => { setUserMenuOpen(false); logout(); }}>
                <span className="sidebar-menu-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </span>
                Sair
              </button>
            </div>
          )}

          <button
            className="sidebar-user-btn"
            onClick={() => setUserMenuOpen(o => !o)}
            title={collapsed && !hovered ? (fullName || user) : undefined}
          >
            <div className="sidebar-user-avatar">{initials}</div>
            <div className="sidebar-text sidebar-user-info">
              <div className="sidebar-user-name">{fullName || user}</div>
              <div className="sidebar-user-role">{isAdmin ? "Administrador" : "Conta local"}</div>
            </div>
            <svg
              width="10" height="10" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className="sidebar-text"
              style={{ opacity: .5, flexShrink: 0, transition: "transform .2s", transform: userMenuOpen ? "rotate(180deg)" : "rotate(0deg)" }}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <span className="nav-section-label sidebar-text">MENU</span>

          {navPages.map(p => (
            <button
              key={p.id}
              className={`nav-item ${page === p.id ? "active" : ""}`}
              onClick={() => navigateTo(p.id)}
              title={collapsed && !hovered ? p.label : undefined}
            >
              <span className="nav-icon">{p.icon}</span>
              <span className="sidebar-text">{p.label}</span>
            </button>
          ))}
        </nav>

        {/* Copyright */}
        <div className="sidebar-copyright sidebar-text">
          © {new Date().getFullYear()} Diário de Trading<br />
          Todos os direitos reservados
        </div>
      </aside>

      {/* ── Right side ──────────────────────────────────── */}
      <div className={`layout-right${collapsed ? " collapsed" : ""}`}>
        <main className="main-content">
          {pageLoading && (
            <div style={{
              position: "fixed", top: 0, left: 0, right: 0,
              height: 3, zIndex: 9999,
              background: "linear-gradient(90deg, var(--accent), #7c5cfc)",
              animation: "page-bar 0.4s ease-out forwards",
            }} />
          )}
          <div key={page} style={{ animation: "page-fade 0.25s ease-out" }}>
            {renderPage()}
          </div>
        </main>
      </div>

      {/* Cookie consent banner */}
      {!cookiesOk && (
        <div className="cookie-banner">
          <div className="cookie-banner-inner">
            <div className="cookie-banner-text">
              <span className="cookie-banner-title">🍪 Este site utiliza cookies</span>
              <span className="cookie-banner-desc">
                Utilizamos cookies essenciais para manter a tua sessão ativa e guardar as tuas preferências (tema, etc.).
                Não partilhamos dados com terceiros.
              </span>
            </div>
            <div className="cookie-banner-actions">
              <button className="btn btn-primary cookie-btn-accept" onClick={acceptCookies}>
                Aceitar e continuar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
