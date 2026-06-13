import { useState, useEffect, useRef } from "react";
import axios from "axios";

const TABS = [
  { id: "xtb",      label: "XTB",       ext: ".xlsx", icon: "📊", desc: "Histórico de operações (.xlsx)" },
  { id: "ibkr",     label: "IBKR",      ext: ".csv",  icon: "📋", desc: "Activity Statement (.csv)" },
  { id: "database", label: "Base Dados", ext: ".db",   icon: "🗄️",  desc: "SQLite (.db)" },
];

const fmt = v => v == null ? "—"
  : (v >= 0 ? "+" : "") + "€ " + Math.abs(v).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Import() {
  const [mode, setMode]         = useState(null);
  const [tab, setTab]           = useState("xtb");
  const [file, setFile]         = useState(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview]   = useState(null);   // { nTrades, nDividends, preview[] }
  const [status, setStatus]     = useState(null);   // { ok, error, msg }
  const [loading, setLoading]   = useState(false);
  const inputRef = useRef();

  useEffect(() => {
    axios.get("/api/import/info")
      .then(r => setMode(r.data.mode))
      .catch(() => setMode("local"));
  }, []);

  const reset = () => { setFile(null); setPreview(null); setStatus(null); };
  const onTabChange = t => { setTab(t); reset(); };

  const accept = TABS.find(t => t.id === tab)?.ext ?? "*";

  const handleFile = f => {
    if (!f) return;
    setPreview(null);
    setStatus(null);
    setFile(f);
  };

  const onDrop = e => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const doPreview = async () => {
    if (!file || tab === "database") return;
    setLoading(true);
    setStatus(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("tipo", tab);
      const { data } = await axios.post("/api/import/preview", form);
      setPreview(data);
    } catch (err) {
      setStatus({ error: err.response?.data?.error || "Erro ao analisar o ficheiro." });
    } finally {
      setLoading(false);
    }
  };

  const doConfirm = async () => {
    if (!file) return;
    setLoading(true);
    setStatus(null);
    try {
      const form = new FormData();
      const endpoint = tab === "database" ? "/api/import/database" : "/api/import/confirm";
      form.append(tab === "database" ? "database" : "file", file);
      if (tab !== "database") form.append("tipo", tab);
      const { data } = await axios.post(endpoint, form);
      setStatus({ ok: true, nTrades: data.nTrades, nDividends: data.nDividends });
      setPreview(null);
      setFile(null);
    } catch (err) {
      setStatus({ error: err.response?.data?.error || "Erro ao importar." });
    } finally {
      setLoading(false);
    }
  };

  if (mode === null) return <div className="spinner" />;

  // Utilizador com base de dados externa (Streamlit)
  if (mode === "custom") {
    return (
      <>
        <div className="page-header">
          <div className="page-title">Importar Dados</div>
          <div className="page-sub">A tua conta usa uma base de dados externa</div>
        </div>
        <div className="card" style={{ maxWidth: 600, textAlign: "center", padding: "40px 32px" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>📥</div>
          <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text)", marginBottom: 12 }}>
            Importação via aplicação Python
          </div>
          <div style={{ color: "var(--mute)", lineHeight: 1.7, fontSize: "0.88rem" }}>
            Os ficheiros XTB (.xlsx) e IBKR (.csv) são importados através da aplicação Streamlit.<br />
            Esta aplicação web lê diretamente a mesma base de dados SQLite.<br /><br />
            Para importar novos relatórios, abre o{" "}
            <strong style={{ color: "var(--text)" }}>arrancar_app.bat</strong> na pasta{" "}
            <code style={{ background: "var(--hover)", padding: "2px 6px", borderRadius: 4 }}>trading_app</code>{" "}
            e utiliza a página <strong style={{ color: "var(--text)" }}>Importar Dados</strong> da aplicação Streamlit.
          </div>
        </div>
      </>
    );
  }

  // Utilizador local — import direto
  return (
    <>
      <div className="page-header">
        <div className="page-title">Importar Dados</div>
        <div className="page-sub">Importa os teus relatórios diretamente da corretora</div>
      </div>

      <div style={{ maxWidth: 640 }}>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              style={{
                flex: 1, padding: "10px 8px", border: "1px solid",
                borderColor: tab === t.id ? "var(--accent)" : "var(--border)",
                borderRadius: 10, cursor: "pointer",
                background: tab === t.id ? "rgba(79,106,245,0.1)" : "var(--card)",
                color: tab === t.id ? "var(--accent)" : "var(--mute)",
                fontWeight: 700, fontSize: "0.82rem", transition: "all .15s",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              }}
            >
              <span style={{ fontSize: "1.2rem" }}>{t.icon}</span>
              <span>{t.label}</span>
              <span style={{ fontSize: "0.68rem", fontWeight: 400, opacity: .7 }}>{t.desc}</span>
            </button>
          ))}
        </div>

        {/* Instruções por tipo */}
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 10, padding: "14px 18px", marginBottom: 16,
          fontSize: "0.8rem", color: "var(--mute)", lineHeight: 1.7,
        }}>
          {tab === "xtb" && <>
            No portal XTB, vai a <strong style={{ color: "var(--text)" }}>Histórico → Operações fechadas</strong> → exporta em Excel (.xlsx).
          </>}
          {tab === "ibkr" && <>
            No portal IBKR, vai a <strong style={{ color: "var(--text)" }}>Reports → Activity Statement</strong> → seleciona o período → exporta em CSV.
          </>}
          {tab === "database" && <>
            Faz upload do ficheiro <code style={{ background: "var(--hover)", padding: "1px 5px", borderRadius: 4 }}>.db</code> SQLite completo.{" "}
            <strong style={{ color: "#f43f5e" }}>Atenção: substitui todos os dados existentes.</strong>
          </>}
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current.click()}
          style={{
            border: `2px dashed ${dragging ? "var(--accent)" : file ? "#22c55e" : "var(--border)"}`,
            borderRadius: 14, padding: "36px 24px", textAlign: "center",
            cursor: "pointer", transition: "all .2s",
            background: dragging ? "rgba(79,106,245,0.05)" : file ? "rgba(34,197,94,0.05)" : "var(--card)",
          }}
        >
          <input
            ref={inputRef} type="file" accept={accept}
            style={{ display: "none" }}
            onChange={e => handleFile(e.target.files[0])}
          />
          <div style={{ fontSize: "1.8rem", marginBottom: 10 }}>{file ? "✅" : "📂"}</div>
          {file ? (
            <>
              <div style={{ fontWeight: 700, color: "#22c55e", fontSize: "0.88rem" }}>{file.name}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--mute)", marginTop: 4 }}>
                {(file.size / 1024).toFixed(1)} KB · clica para escolher outro
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 700, color: "var(--text)", fontSize: "0.88rem" }}>
                Arrasta o ficheiro {accept} aqui
              </div>
              <div style={{ fontSize: "0.73rem", color: "var(--mute)", marginTop: 4 }}>ou clica para selecionar</div>
            </>
          )}
        </div>

        {/* Botão pré-visualizar / upload direto (.db) */}
        {file && !preview && (
          <button
            className="btn btn-primary"
            onClick={tab === "database" ? doConfirm : doPreview}
            disabled={loading}
            style={{ width: "100%", marginTop: 14, padding: "11px", fontSize: "0.9rem" }}
          >
            {loading ? "A analisar..." : tab === "database" ? "Importar base de dados" : "Pré-visualizar"}
          </button>
        )}

        {/* Pré-visualização */}
        {preview && (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: 10, padding: "14px 18px",
            }}>
              <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text)", marginBottom: 8 }}>
                Resultado da análise
              </div>
              <div style={{ display: "flex", gap: 20, fontSize: "0.82rem", color: "var(--mute)" }}>
                <span>📈 <strong style={{ color: "var(--text)" }}>{preview.nTrades}</strong> operações</span>
                {preview.nDividends > 0 &&
                  <span>💰 <strong style={{ color: "var(--text)" }}>{preview.nDividends}</strong> dividendos</span>}
              </div>
            </div>

            {preview.preview?.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--mute)", marginBottom: 6 }}>
                  Primeiras {preview.preview.length} operações:
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                  <thead>
                    <tr>
                      {["Símbolo","Categoria","Data Fecho","P&L €","Volume"].map(h => (
                        <th key={h} style={{ padding: "6px 10px", textAlign: "left", background: "var(--hover)",
                          color: "var(--mute)", fontWeight: 700, fontSize: "0.68rem",
                          textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview.map((t, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "7px 10px", fontWeight: 700, color: "var(--text)" }}>{t.simbolo}</td>
                        <td style={{ padding: "7px 10px", color: t.categoria === "CFD" ? "#f43f5e" : "var(--mute)",
                          fontWeight: t.categoria === "CFD" ? 700 : 400 }}>{t.categoria}</td>
                        <td style={{ padding: "7px 10px", color: "var(--mute)" }}>{t.data_fecho?.slice(0,10) ?? "—"}</td>
                        <td style={{ padding: "7px 10px", fontWeight: 700,
                          color: (t.pl_eur ?? 0) >= 0 ? "#22c55e" : "#f43f5e" }}>{fmt(t.pl_eur)}</td>
                        <td style={{ padding: "7px 10px", color: "var(--mute)" }}>{t.volume ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={reset}
                style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid var(--border)",
                  background: "transparent", cursor: "pointer", fontSize: "0.85rem",
                  color: "var(--mute)", fontWeight: 600 }}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={doConfirm}
                disabled={loading}
                style={{ flex: 2, padding: "10px", fontSize: "0.9rem" }}
              >
                {loading ? "A importar..." : `Confirmar e importar ${preview.nTrades} operações`}
              </button>
            </div>
          </div>
        )}

        {/* Feedback */}
        {status?.ok && (
          <div style={{ marginTop: 14, background: "rgba(34,197,94,0.1)", border: "1px solid #22c55e",
            borderRadius: 10, padding: "14px 18px", display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: "1.3rem" }}>✅</span>
            <div>
              <div style={{ fontWeight: 700, color: "#22c55e", fontSize: "0.88rem" }}>Importação concluída!</div>
              <div style={{ fontSize: "0.75rem", color: "var(--mute)", marginTop: 2 }}>
                {status.nTrades} operações{status.nDividends ? ` e ${status.nDividends} dividendos` : ""} importados com sucesso.
                Vai ao Dashboard para ver os teus dados.
              </div>
            </div>
          </div>
        )}
        {status?.error && (
          <div style={{ marginTop: 14, background: "rgba(244,63,94,0.08)", border: "1px solid #f43f5e",
            borderRadius: 10, padding: "14px 18px", display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: "1.3rem" }}>❌</span>
            <div style={{ fontSize: "0.85rem", color: "#f43f5e", fontWeight: 600 }}>{status.error}</div>
          </div>
        )}
      </div>
    </>
  );
}
