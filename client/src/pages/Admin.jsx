import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const fmt = s => s.slice(0, 2).toUpperCase();

const fmtDate = iso => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" })
    + " " + d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
};

const timeAgo = iso => {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60000);
  const h    = Math.floor(min / 60);
  const d    = Math.floor(h / 24);
  if (min < 1)  return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  if (h < 24)   return `há ${h}h`;
  if (d < 7)    return `há ${d} dia${d > 1 ? "s" : ""}`;
  return null;
};

const ACTION_LABELS = {
  login:        { label: "Login",         color: "#22c55e" },
  logout:       { label: "Logout",        color: "#64748b" },
  login_failed: { label: "Login falhado", color: "#f43f5e" },
  register:     { label: "Registo",       color: "#4f6af5" },
};

export default function Admin() {
  const [users, setUsers]     = useState([]);
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const [showForm, setShowForm] = useState(false);
  const [newUser, setNewUser]   = useState({ username: "", password: "", isAdmin: false });
  const [formErr, setFormErr]   = useState("");
  const [formLoad, setFormLoad] = useState(false);

  const [resetTarget, setResetTarget] = useState(null);
  const [newPass, setNewPass]         = useState("");
  const [resetErr, setResetErr]       = useState("");
  const [resetLoad, setResetLoad]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [u, l] = await Promise.all([
        axios.get("/api/admin/users"),
        axios.get("/api/admin/logs"),
      ]);
      setUsers(Array.isArray(u.data) ? u.data : []);
      setLogs(Array.isArray(l.data) ? l.data : []);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Erro desconhecido.";
      setError(`Erro ao carregar dados: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createUser = async e => {
    e.preventDefault();
    setFormErr("");
    setFormLoad(true);
    try {
      await axios.post("/api/admin/users", newUser);
      setNewUser({ username: "", password: "", isAdmin: false });
      setShowForm(false);
      load();
    } catch (err) {
      setFormErr(err.response?.data?.error || "Erro ao criar utilizador.");
    } finally {
      setFormLoad(false);
    }
  };

  const deleteUser = async username => {
    if (!confirm(`Eliminar o utilizador "${username}"? Esta ação não pode ser revertida.`)) return;
    try {
      await axios.delete(`/api/admin/users/${username}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || "Erro ao eliminar.");
    }
  };

  const resetPassword = async e => {
    e.preventDefault();
    setResetErr("");
    setResetLoad(true);
    try {
      await axios.patch(`/api/admin/users/${resetTarget}/password`, { password: newPass });
      setResetTarget(null);
      setNewPass("");
    } catch (err) {
      setResetErr(err.response?.data?.error || "Erro ao redefinir password.");
    } finally {
      setResetLoad(false);
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800, color: "var(--text)" }}>
            Administração
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--mute)" }}>
            Gestão de utilizadores e registos de acesso
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(f => !f); setFormErr(""); }}>
          {showForm ? "Cancelar" : "+ Novo utilizador"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 12, padding: "22px 24px", marginBottom: 24,
        }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>
            Criar novo utilizador
          </div>
          <form onSubmit={createUser} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--mute)", textTransform: "uppercase", letterSpacing: ".08em" }}>
                  Utilizador
                </label>
                <input
                  value={newUser.username}
                  onChange={e => setNewUser(u => ({ ...u, username: e.target.value }))}
                  autoComplete="off"
                  style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--mute)", textTransform: "uppercase", letterSpacing: ".08em" }}>
                  Password
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))}
                  autoComplete="new-password"
                  style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
                />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
              fontSize: "0.82rem", color: "var(--text)", userSelect: "none" }}>
              <input
                type="checkbox"
                checked={newUser.isAdmin}
                onChange={e => setNewUser(u => ({ ...u, isAdmin: e.target.checked }))}
              />
              Dar permissões de administrador
            </label>
            {formErr && (
              <div style={{ fontSize: "0.8rem", color: "#f43f5e",
                background: "rgba(244,63,94,0.08)", borderRadius: 8, padding: "8px 12px" }}>
                {formErr}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="btn btn-primary" disabled={formLoad}>
                {formLoad ? "A criar..." : "Criar utilizador"}
              </button>
            </div>
          </form>
        </div>
      )}

      {error && <div style={{ color: "#f43f5e", fontSize: "0.85rem", marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ color: "var(--mute)", fontSize: "0.85rem" }}>A carregar...</div>
      ) : (<>

        {/* ── Utilizadores ── */}
        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--mute)", textTransform: "uppercase",
          letterSpacing: ".08em", marginBottom: 10 }}>
          Utilizadores ({users.length})
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
          {users.map(u => {
            const ago = timeAgo(u.lastLogin);
            return (
              <div key={u.username} style={{
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: 12, padding: "16px 20px",
                display: "flex", alignItems: "center", gap: 16,
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                  background: u.isAdmin
                    ? "linear-gradient(135deg, #f43f5e, #9f1239)"
                    : "linear-gradient(135deg, #4f6af5, #7c3aed)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.72rem", fontWeight: 800, color: "#fff",
                }}>
                  {fmt(u.username)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text)" }}>
                    {u.username}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--mute)", marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {u.isAdmin
                      ? <span style={{ color: "#f43f5e", fontWeight: 700 }}>Administrador</span>
                      : <span>Utilizador</span>
                    }
                    <span style={{ color: "var(--border)" }}>·</span>
                    <span>
                      Último acesso: <span style={{ color: "var(--text)" }}>{fmtDate(u.lastLogin)}</span>
                      {ago && <span style={{ color: "var(--mute)", marginLeft: 4 }}>({ago})</span>}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => { setResetTarget(u.username); setNewPass(""); setResetErr(""); }}
                    style={{
                      background: "transparent", border: "1px solid var(--border)",
                      borderRadius: 8, padding: "6px 12px", cursor: "pointer",
                      fontSize: "0.76rem", fontWeight: 600, color: "var(--mute)", transition: "all .15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--mute)"; }}
                  >
                    Reset password
                  </button>
                  {!u.isAdmin && (
                    <button
                      onClick={() => deleteUser(u.username)}
                      style={{
                        background: "transparent", border: "1px solid var(--border)",
                        borderRadius: 8, padding: "6px 12px", cursor: "pointer",
                        fontSize: "0.76rem", fontWeight: 600, color: "var(--mute)", transition: "all .15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "#f43f5e"; e.currentTarget.style.color = "#f43f5e"; e.currentTarget.style.background = "rgba(244,63,94,0.08)"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--mute)"; e.currentTarget.style.background = "transparent"; }}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Registos de acesso ── */}
        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--mute)", textTransform: "uppercase",
          letterSpacing: ".08em", marginBottom: 10 }}>
          Registos de acesso (últimas {logs.length} entradas)
        </div>
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 12, overflow: "hidden",
        }}>
          {logs.length === 0 ? (
            <div style={{ padding: "20px 24px", color: "var(--mute)", fontSize: "0.82rem" }}>
              Sem registos ainda.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--hover)" }}>
                  {["Utilizador", "Ação", "Data / Hora", "IP"].map(h => (
                    <th key={h} style={{
                      padding: "10px 16px", textAlign: "left",
                      fontSize: "0.68rem", fontWeight: 700, color: "var(--mute)",
                      textTransform: "uppercase", letterSpacing: ".06em",
                      borderBottom: "1px solid var(--border)",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => {
                  const act = ACTION_LABELS[log.action] || { label: log.action, color: "var(--mute)" };
                  return (
                    <tr key={i} style={{ borderBottom: i < logs.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <td style={{ padding: "10px 16px", fontSize: "0.82rem", fontWeight: 600, color: "var(--text)" }}>
                        {log.username}
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <span style={{
                          display: "inline-block", padding: "2px 8px", borderRadius: 6,
                          fontSize: "0.72rem", fontWeight: 700,
                          color: act.color, background: act.color + "18",
                        }}>
                          {act.label}
                        </span>
                      </td>
                      <td style={{ padding: "10px 16px", fontSize: "0.8rem", color: "var(--mute)" }}>
                        {fmtDate(log.timestamp)}
                      </td>
                      <td style={{ padding: "10px 16px", fontSize: "0.78rem", color: "var(--mute)", fontFamily: "monospace" }}>
                        {log.ip || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </>)}

      {/* Reset password modal */}
      {resetTarget && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }} onClick={() => setResetTarget(null)}>
          <div style={{
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 14, padding: "28px 32px", width: "100%", maxWidth: 380,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text)", marginBottom: 6 }}>
              Reset de password
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--mute)", marginBottom: 20 }}>
              Nova password para <strong style={{ color: "var(--text)" }}>{resetTarget}</strong>
            </div>
            <form onSubmit={resetPassword} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <input
                type="password"
                placeholder="Nova password (mín. 6 caracteres)"
                value={newPass}
                onChange={e => setNewPass(e.target.value)}
                autoFocus
                style={{ width: "100%", boxSizing: "border-box" }}
              />
              {resetErr && (
                <div style={{ fontSize: "0.78rem", color: "#f43f5e",
                  background: "rgba(244,63,94,0.08)", borderRadius: 8, padding: "8px 12px" }}>
                  {resetErr}
                </div>
              )}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setResetTarget(null)}
                  style={{ background: "transparent", border: "1px solid var(--border)",
                    borderRadius: 8, padding: "8px 16px", cursor: "pointer",
                    fontSize: "0.82rem", color: "var(--mute)", fontWeight: 600 }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={resetLoad}>
                  {resetLoad ? "A guardar..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
