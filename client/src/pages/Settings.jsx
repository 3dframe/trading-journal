import { useState } from "react";
import axios from "axios";

const MUTE  = "#6b7280";
const GREEN = "#10b981";
const RED   = "#f43f5e";

function Section({ title, children }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
      <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text)" }}>{title}</div>
      </div>
      <div style={{ padding: "20px 24px" }}>{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: MUTE, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", background: "var(--bg)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "9px 13px", color: "var(--text)", fontSize: "0.88rem",
  outline: "none", fontFamily: "var(--font)", boxSizing: "border-box",
  transition: "border-color .15s",
};

function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", bottom: 28, right: 28, zIndex: 9999,
      background: type === "ok" ? "rgba(16,185,129,0.15)" : "rgba(244,63,94,0.15)",
      border: `1px solid ${type === "ok" ? GREEN : RED}`,
      color: type === "ok" ? GREEN : RED,
      borderRadius: 10, padding: "12px 20px", fontSize: "0.85rem", fontWeight: 600,
      boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
    }}>
      {msg}
    </div>
  );
}

export default function Settings({ user, fullName, onFullNameChange }) {
  const [name, setName]         = useState(fullName || "");
  const [savingName, setSavingName] = useState(false);

  const [curPw, setCurPw]   = useState("");
  const [newPw, setNewPw]   = useState("");
  const [confPw, setConfPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const saveName = async () => {
    if (!name.trim()) return;
    setSavingName(true);
    try {
      await axios.patch("/api/auth/me", { fullName: name.trim() });
      onFullNameChange(name.trim());
      showToast("Nome actualizado com sucesso.");
    } catch (e) {
      showToast(e.response?.data?.error || "Erro ao actualizar nome.", "err");
    } finally {
      setSavingName(false);
    }
  };

  const changePassword = async () => {
    if (!curPw || !newPw || !confPw) { showToast("Preenche todos os campos.", "err"); return; }
    if (newPw !== confPw) { showToast("As passwords não coincidem.", "err"); return; }
    if (newPw.length < 6) { showToast("A nova password deve ter pelo menos 6 caracteres.", "err"); return; }
    setSavingPw(true);
    try {
      await axios.post("/api/auth/change-password", { currentPassword: curPw, newPassword: newPw });
      setCurPw(""); setNewPw(""); setConfPw("");
      showToast("Password alterada com sucesso.");
    } catch (e) {
      showToast(e.response?.data?.error || "Erro ao alterar password.", "err");
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", paddingBottom: 40 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text)", margin: 0 }}>Definições da Conta</h1>
        <p style={{ color: MUTE, fontSize: "0.82rem", marginTop: 6 }}>Gere o teu perfil e segurança</p>
      </div>

      {/* Perfil */}
      <Section title="Perfil">
        <Field label="Username">
          <input style={{ ...inputStyle, opacity: 0.5, cursor: "not-allowed" }} value={user} readOnly />
        </Field>
        <Field label="Nome de Exibição">
          <input
            style={inputStyle}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && saveName()}
            onFocus={e => e.target.style.borderColor = "var(--accent)"}
            onBlur={e => e.target.style.borderColor = "var(--border)"}
            placeholder="O teu nome completo"
          />
        </Field>
        <button
          onClick={saveName}
          disabled={savingName || !name.trim() || name.trim() === fullName}
          style={{
            background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8,
            padding: "9px 22px", fontSize: "0.84rem", fontWeight: 700, cursor: "pointer",
            opacity: (savingName || !name.trim() || name.trim() === fullName) ? 0.45 : 1,
            transition: "opacity .15s",
          }}
        >
          {savingName ? "A guardar…" : "Guardar Nome"}
        </button>
      </Section>

      {/* Segurança */}
      <Section title="Segurança">
        <Field label="Password Actual">
          <input
            type="password" style={inputStyle} value={curPw}
            onChange={e => setCurPw(e.target.value)}
            onFocus={e => e.target.style.borderColor = "var(--accent)"}
            onBlur={e => e.target.style.borderColor = "var(--border)"}
            placeholder="••••••••"
          />
        </Field>
        <Field label="Nova Password">
          <input
            type="password" style={inputStyle} value={newPw}
            onChange={e => setNewPw(e.target.value)}
            onFocus={e => e.target.style.borderColor = "var(--accent)"}
            onBlur={e => e.target.style.borderColor = "var(--border)"}
            placeholder="Mínimo 6 caracteres"
          />
        </Field>
        <Field label="Confirmar Nova Password">
          <input
            type="password" style={inputStyle} value={confPw}
            onChange={e => setConfPw(e.target.value)}
            onKeyDown={e => e.key === "Enter" && changePassword()}
            onFocus={e => e.target.style.borderColor = "var(--accent)"}
            onBlur={e => e.target.style.borderColor = "var(--border)"}
            placeholder="Repetir nova password"
          />
        </Field>
        {newPw && confPw && newPw !== confPw && (
          <div style={{ color: RED, fontSize: "0.75rem", marginBottom: 12, marginTop: -10 }}>
            As passwords não coincidem
          </div>
        )}
        <button
          onClick={changePassword}
          disabled={savingPw || !curPw || !newPw || !confPw}
          style={{
            background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8,
            padding: "9px 22px", fontSize: "0.84rem", fontWeight: 700, cursor: "pointer",
            opacity: (savingPw || !curPw || !newPw || !confPw) ? 0.45 : 1,
            transition: "opacity .15s",
          }}
        >
          {savingPw ? "A guardar…" : "Alterar Password"}
        </button>
      </Section>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}
