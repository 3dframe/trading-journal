import { useState, useRef, useEffect } from "react";

/* Menu de utilizador para cabeçalhos de página: avatar + nome + dropdown com
   alternar tema, abrir Definições e Sair. As ações são passadas por props
   (vivem no App, que detém o estado de sessão/tema). */
export default function UserMenu({ fullName, username, isAdmin, darkMode, onToggleTheme, onLogout, onOpenSettings, onOpenAdmin }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const name     = fullName || username || "Utilizador";
  // Iniciais a partir dos nomes: "Paulo Carmo" → "PC"; um só nome → 2 primeiras letras.
  const parts    = name.trim().split(/\s+/).filter(Boolean);
  const initials = (parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : name.slice(0, 2)).toUpperCase();

  const item = {
    display: "flex", alignItems: "center", gap: 10, width: "100%",
    background: "transparent", border: "none", cursor: "pointer",
    padding: "9px 12px", fontSize: "0.8rem", fontWeight: 600,
    color: "var(--text)", fontFamily: "var(--font)", textAlign: "left",
    transition: "background .15s",
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          background: open ? "var(--hover)" : "transparent", border: "none",
          borderRadius: 10, padding: "5px 10px 5px 5px", cursor: "pointer",
          fontFamily: "var(--font)", transition: "background .15s",
        }}
        onMouseEnter={e => e.currentTarget.style.background = "var(--hover)"}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = "transparent"; }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: "linear-gradient(135deg, #4f6af5, #7c3aed)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: "0.78rem", fontWeight: 800,
        }}>{initials}</div>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15, minWidth: 0 }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}>{name}</span>
          <span style={{ fontSize: "0.64rem", color: "var(--mute)" }}>{isAdmin ? "Administrador" : "Conta local"}</span>
        </div>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ color: "var(--mute)", opacity: 0.6, flexShrink: 0, transition: "transform .2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 200,
          width: 230, background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 12, padding: 6, boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
        }}>
          <button style={item} onClick={() => { setOpen(false); onToggleTheme?.(); }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--hover)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <span style={{ display: "inline-flex", color: "var(--mute)" }}>
              {darkMode ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
              )}
            </span>
            {darkMode ? "Tema Claro" : "Tema Escuro"}
          </button>

          {onOpenAdmin && (
            <button style={item} onClick={() => { setOpen(false); onOpenAdmin(); }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--hover)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ display: "inline-flex", color: "var(--mute)" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              </span>
              Administração
            </button>
          )}

          {onOpenSettings && (
            <button style={item} onClick={() => { setOpen(false); onOpenSettings(); }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--hover)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ display: "inline-flex", color: "var(--mute)" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </span>
              Definições
            </button>
          )}

          <div style={{ height: 1, background: "var(--border)", margin: "2px 0" }} />

          <button style={{ ...item, color: "#f43f5e" }} onClick={() => { setOpen(false); onLogout?.(); }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(244,63,94,0.1)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <span style={{ display: "inline-flex" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </span>
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
