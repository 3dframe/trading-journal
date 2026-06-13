import { useState } from "react";
import axios from "axios";

export default function Login({ onLogin }) {
  const [mode, setMode]       = useState("login"); // "login" | "register"
  const [username, setUser]   = useState("");
  const [fullName, setName]   = useState("");
  const [password, setPass]   = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoad]    = useState(false);

  const switchMode = (m) => {
    setMode(m);
    setError("");
    setUser("");
    setName("");
    setPass("");
    setConfirm("");
  };

  const submit = async e => {
    e.preventDefault();
    setError("");

    if (mode === "register" && password !== confirm) {
      setError("As passwords não coincidem.");
      return;
    }

    setLoad(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const { data } = await axios.post(endpoint, { username, password, fullName }, { withCredentials: true });
      onLogin(data);
    } catch (err) {
      setError(err.response?.data?.error || "Ocorreu um erro. Tenta novamente.");
    } finally {
      setLoad(false);
    }
  };

  const isLogin = mode === "login";

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)",
    }}>
      <div style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: 16, padding: "40px 36px", width: "100%", maxWidth: 380,
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 28, textAlign: "center" }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, margin: "0 auto 14px",
            background: "linear-gradient(135deg, #4f6af5, #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)" }}>Diário de Trading</div>
          <div style={{ fontSize: "0.75rem", color: "var(--mute)", marginTop: 4 }}>
            {isLogin ? "Inicia sessão para continuar" : "Cria a tua conta"}
          </div>
        </div>

        {/* Tab toggle */}
        <div style={{
          display: "flex", background: "var(--bg)", borderRadius: 10,
          padding: 4, marginBottom: 24, gap: 4,
        }}>
          {["login", "register"].map(m => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              style={{
                flex: 1, padding: "7px 0", border: "none", borderRadius: 7,
                fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
                background: mode === m ? "var(--card)" : "transparent",
                color: mode === m ? "var(--text)" : "var(--mute)",
                boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.18)" : "none",
                transition: "all .18s",
              }}
            >
              {m === "login" ? "Entrar" : "Criar conta"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--mute)", textTransform: "uppercase", letterSpacing: ".08em" }}>
              Utilizador
            </label>
            <input
              value={username} onChange={e => setUser(e.target.value)}
              autoFocus autoComplete="username"
              style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--mute)", textTransform: "uppercase", letterSpacing: ".08em" }}>
              Password
            </label>
            <input
              type="password" value={password} onChange={e => setPass(e.target.value)}
              autoComplete={isLogin ? "current-password" : "new-password"}
              style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
            />
          </div>
          {!isLogin && (
            <>
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--mute)", textTransform: "uppercase", letterSpacing: ".08em" }}>
                  Nome Completo
                </label>
                <input
                  type="text" value={fullName} onChange={e => setName(e.target.value)}
                  autoComplete="name" placeholder="Ex: Paulo Jorge Carmo"
                  style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--mute)", textTransform: "uppercase", letterSpacing: ".08em" }}>
                  Confirmar Password
                </label>
                <input
                  type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
                />
              </div>
            </>
          )}

          {error && (
            <div style={{ fontSize: "0.8rem", color: "#f43f5e", textAlign: "center",
              background: "rgba(244,63,94,0.08)", borderRadius: 8, padding: "8px 12px" }}>
              {error}
            </div>
          )}

          <button
            type="submit" className="btn btn-primary" disabled={loading}
            style={{ marginTop: 6, padding: "10px", fontSize: "0.9rem" }}
          >
            {loading
              ? (isLogin ? "A entrar..." : "A criar conta...")
              : (isLogin ? "Entrar" : "Criar conta")}
          </button>
        </form>
      </div>
    </div>
  );
}
