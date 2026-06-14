import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";

const fmt = v => v == null ? "—"
  : (v >= 0 ? "+" : "") + "€ " + Math.abs(v).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BROKERS = [
  {
    id: "xtb", label: "XTB", ext: ".xlsx", accept: ".xlsx",
    color: "#f59e0b", colorBg: "rgba(245,158,11,0.08)",
    hint: "Histórico → Operações fechadas → Exportar Excel",
  },
  {
    id: "ibkr", label: "IBKR", ext: ".csv", accept: ".csv",
    color: "#4f6af5", colorBg: "rgba(79,106,245,0.08)",
    hint: "Reports → Activity Statement → Exportar CSV",
  },
];

function DropCard({ broker, onFile }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleDrop = e => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f, broker.id);
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current.click()}
      style={{
        border: `2px dashed ${dragging ? broker.color : "var(--border)"}`,
        borderRadius: 16, padding: "40px 24px", textAlign: "center",
        cursor: "pointer", transition: "all .2s",
        background: dragging ? broker.colorBg : "var(--card)",
        flex: 1,
      }}
    >
      <input
        ref={inputRef} type="file" accept={broker.accept}
        style={{ display: "none" }}
        onChange={e => { if (e.target.files[0]) onFile(e.target.files[0], broker.id); }}
      />
      <div style={{
        width: 52, height: 52, borderRadius: 14, margin: "0 auto 14px",
        background: broker.colorBg, border: `1.5px solid ${broker.color}33`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: "1.5rem" }}>{broker.id === "xtb" ? "📊" : "📋"}</span>
      </div>
      <div style={{ fontWeight: 800, fontSize: "1.1rem", color: broker.color, marginBottom: 4 }}>
        {broker.label}
      </div>
      <div style={{ fontSize: "0.72rem", color: "var(--mute)", marginBottom: 16, lineHeight: 1.5 }}>
        {broker.hint}
      </div>
      <div style={{
        display: "inline-block", padding: "8px 18px",
        border: `1px solid ${broker.color}55`, borderRadius: 20,
        fontSize: "0.78rem", color: broker.color, fontWeight: 600,
        background: broker.colorBg,
      }}>
        Arrasta {broker.ext} ou clica para selecionar
      </div>
    </div>
  );
}

const BROKER_COLOR = { XTB: "#f59e0b", IBKR: "#4f6af5" };

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: "0.7rem", fontWeight: 700, color: "var(--muted)",
      textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 14,
    }}>{children}</div>
  );
}

function HistoryTable({ history, onDelete }) {
  if (!history.length) return (
    <div style={{ textAlign: "center", padding: "28px 16px", color: "var(--muted)", fontSize: "0.8rem" }}>
      Ainda não foram importados relatórios.
    </div>
  );

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
        <thead>
          <tr>
            {["Corretora", "Ficheiro", "Operações", "Dividendos", "Ignorados", "Data Importação", ""].map(h => (
              <th key={h} style={{
                padding: "8px 12px", textAlign: h === "Operações" || h === "Dividendos" || h === "Ignorados" ? "center" : "left",
                background: "var(--hover)", color: "var(--muted)", fontWeight: 700,
                fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: ".05em",
                whiteSpace: "nowrap", borderBottom: "1px solid var(--border)",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {history.map(h => (
            <tr key={h.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "9px 12px" }}>
                <span style={{
                  fontSize: "0.68rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                  background: `${BROKER_COLOR[h.corretora] ?? "var(--accent)"}22`,
                  color: BROKER_COLOR[h.corretora] ?? "var(--accent)",
                }}>{h.corretora}</span>
              </td>
              <td style={{ padding: "9px 12px", color: "var(--text)", fontWeight: 600,
                maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                title={h.filename}>{h.filename}</td>
              <td style={{ padding: "9px 12px", textAlign: "center", fontWeight: 700, color: "var(--text)" }}>
                {h.n_trades > 0 ? h.n_trades : <span style={{ color: "var(--muted)" }}>—</span>}
              </td>
              <td style={{ padding: "9px 12px", textAlign: "center", fontWeight: 700, color: "var(--text)" }}>
                {h.n_dividends > 0 ? h.n_dividends : <span style={{ color: "var(--muted)" }}>—</span>}
              </td>
              <td style={{ padding: "9px 12px", textAlign: "center",
                color: h.n_skipped > 0 ? "#f59e0b" : "var(--muted)" }}>
                {h.n_skipped > 0 ? h.n_skipped : "—"}
              </td>
              <td style={{ padding: "9px 12px", color: "var(--muted)", whiteSpace: "nowrap" }}>
                {h.imported_at?.replace("T", " ").slice(0, 16)}
              </td>
              <td style={{ padding: "9px 12px", textAlign: "center" }}>
                <button onClick={() => onDelete(h.id)} title="Remover importação"
                  style={{
                    background: "none", border: "1px solid var(--border)", borderRadius: 6,
                    color: "var(--muted)", cursor: "pointer", fontSize: "0.72rem",
                    padding: "3px 8px", lineHeight: 1,
                  }}>✕ Remover</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Import() {
  const [mode, setMode]         = useState(null);
  const [file, setFile]         = useState(null);
  const [preview, setPreview]   = useState(null);
  const [status, setStatus]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [history, setHistory]   = useState([]);
  const [deposits, setDeposits] = useState([]);

  const fetchHistory = useCallback(() => {
    axios.get("/api/import/history").then(r => setHistory(r.data)).catch(() => {});
    axios.get("/api/import/deposits").then(r => setDeposits(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    axios.get("/api/import/info").then(r => setMode(r.data.mode)).catch(() => setMode("local"));
    fetchHistory();
  }, [fetchHistory]);

  const reset = () => { setFile(null); setPreview(null); setStatus(null); };

  const handleFile = (f, tipo) => {
    setPreview(null);
    setStatus(null);
    setFile({ f, tipo });
  };

  const doPreview = async () => {
    if (!file) return;
    setLoading(true);
    setStatus(null);
    try {
      const form = new FormData();
      form.append("file", file.f);
      form.append("tipo", file.tipo);
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
      form.append("file", file.f);
      form.append("tipo", file.tipo);
      const { data } = await axios.post("/api/import/confirm", form);
      setStatus({ ok: true, nTrades: data.nTrades, nDividends: data.nDividends, nDeposits: data.nDeposits, nSkipped: data.nSkipped });
      setPreview(null);
      setFile(null);
      fetchHistory();
    } catch (err) {
      setStatus({ error: err.response?.data?.error || "Erro ao importar." });
    } finally {
      setLoading(false);
    }
  };

  const deleteHistory = async (id) => {
    await axios.delete(`/api/import/history/${id}`).catch(() => {});
    fetchHistory();
  };

  if (mode === null) return <div className="spinner" />;

  if (mode === "custom") {
    return (
      <>
        <div className="page-header">
          <div className="page-title">Importar Dados</div>
          <div className="page-sub">A tua conta usa uma base de dados externa</div>
        </div>
        <div className="card" style={{ maxWidth: 560, textAlign: "center", padding: "40px 32px" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>📥</div>
          <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text)", marginBottom: 12 }}>
            Importação via aplicação Python
          </div>
          <div style={{ color: "var(--mute)", lineHeight: 1.7, fontSize: "0.88rem" }}>
            Os ficheiros XTB (.xlsx) e IBKR (.csv) são importados através da aplicação Streamlit.<br />
            Esta aplicação web lê diretamente a mesma base de dados SQLite.
          </div>
        </div>
      </>
    );
  }

  const broker = BROKERS.find(b => b.id === file?.tipo);

  return (
    <>
      <div className="page-header">
        <div className="page-title">Importar Dados</div>
        <div className="page-sub">Importa os teus relatórios diretamente da corretora</div>
      </div>

      {/* ── Zona de importação ── */}
      {!file ? (
        <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
          {BROKERS.map(b => <DropCard key={b.id} broker={b} onFile={handleFile} />)}
        </div>
      ) : (
        <div style={{
          background: "var(--card)", border: `1.5px solid ${broker.color}55`,
          borderRadius: 16, padding: "20px 24px",
          display: "flex", alignItems: "center", gap: 16, marginBottom: 8,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: broker.colorBg, border: `1.5px solid ${broker.color}33`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem",
          }}>{broker.id === "xtb" ? "📊" : "📋"}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: broker.color, fontSize: "0.78rem", marginBottom: 2 }}>
              {broker.label}
            </div>
            <div style={{ fontWeight: 600, color: "var(--text)", fontSize: "0.88rem",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {file.f.name}
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: 2 }}>
              {(file.f.size / 1024).toFixed(1)} KB
            </div>
          </div>
          <button onClick={reset} style={{
            background: "none", border: "1px solid var(--border)", borderRadius: 8,
            color: "var(--muted)", cursor: "pointer", padding: "6px 12px", fontSize: "0.78rem",
          }}>Trocar</button>
        </div>
      )}

      {/* Botão pré-visualizar */}
      {file && !preview && (
        <button className="btn btn-primary" onClick={doPreview} disabled={loading}
          style={{ width: "100%", padding: "11px", fontSize: "0.9rem", marginBottom: 8 }}>
          {loading ? "A analisar..." : "Pré-visualizar"}
        </button>
      )}

      {/* Pré-visualização */}
      {preview && (
        <div style={{ marginBottom: 8, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 18px" }}>
            <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text)", marginBottom: 8 }}>
              Resultado da análise
            </div>
            <div style={{ display: "flex", gap: 20, fontSize: "0.82rem", color: "var(--muted)", flexWrap: "wrap" }}>
              <span>📈 <strong style={{ color: "var(--text)" }}>{preview.nTrades}</strong> operações</span>
              {preview.nDividends > 0 &&
                <span>💰 <strong style={{ color: "var(--text)" }}>{preview.nDividends}</strong> dividendos</span>}
              {preview.nDeposits > 0 &&
                <span>🏦 <strong style={{ color: "var(--text)" }}>{preview.nDeposits}</strong> depósitos/levantamentos</span>}
            </div>
          </div>

          {preview.preview?.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginBottom: 6 }}>
                Primeiras {preview.preview.length} operações:
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                <thead>
                  <tr>
                    {["Símbolo","Categoria","Data Fecho","P&L €","Volume"].map(h => (
                      <th key={h} style={{
                        padding: "6px 10px", textAlign: "left", background: "var(--hover)",
                        color: "var(--muted)", fontWeight: 700, fontSize: "0.68rem",
                        textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((t, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "7px 10px", fontWeight: 700, color: "var(--text)" }}>{t.simbolo}</td>
                      <td style={{ padding: "7px 10px", color: t.categoria === "CFD" ? "#f43f5e" : "var(--muted)",
                        fontWeight: t.categoria === "CFD" ? 700 : 400 }}>{t.categoria}</td>
                      <td style={{ padding: "7px 10px", color: "var(--muted)" }}>{t.data_fecho?.slice(0,10) ?? "—"}</td>
                      <td style={{ padding: "7px 10px", fontWeight: 700,
                        color: (t.pl_eur ?? 0) >= 0 ? "#22c55e" : "#f43f5e" }}>{fmt(t.pl_eur)}</td>
                      <td style={{ padding: "7px 10px", color: "var(--muted)" }}>{t.volume ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={reset} style={{
              flex: 1, padding: "10px", borderRadius: 8,
              border: "1px solid var(--border)", background: "transparent",
              cursor: "pointer", fontSize: "0.85rem", color: "var(--muted)", fontWeight: 600,
            }}>Cancelar</button>
            <button className="btn btn-primary" onClick={doConfirm} disabled={loading}
              style={{ flex: 2, padding: "10px", fontSize: "0.9rem" }}>
              {loading ? "A importar..." : `Confirmar e importar ${preview.nTrades} operações`}
            </button>
          </div>
        </div>
      )}

      {/* Feedback */}
      {status?.ok && (
        <div style={{
          marginBottom: 8, background: "rgba(34,197,94,0.1)", border: "1px solid #22c55e",
          borderRadius: 10, padding: "14px 18px", display: "flex", gap: 12, alignItems: "center",
        }}>
          <span style={{ fontSize: "1.3rem" }}>✅</span>
          <div>
            <div style={{ fontWeight: 700, color: "#22c55e", fontSize: "0.88rem" }}>Importação concluída!</div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 2 }}>
              {status.nTrades} operações{status.nDividends ? `, ${status.nDividends} dividendos` : ""}{status.nDeposits ? `, ${status.nDeposits} depósitos` : ""} importados.
              {status.nSkipped > 0 && ` ${status.nSkipped} duplicados ignorados.`}
            </div>
          </div>
        </div>
      )}
      {status?.error && (
        <div style={{
          marginBottom: 8, background: "rgba(244,63,94,0.08)", border: "1px solid #f43f5e",
          borderRadius: 10, padding: "14px 18px", display: "flex", gap: 12, alignItems: "center",
        }}>
          <span style={{ fontSize: "1.3rem" }}>❌</span>
          <div style={{ fontSize: "0.85rem", color: "#f43f5e", fontWeight: 600 }}>{status.error}</div>
        </div>
      )}

      {/* ── Histórico de Importações ── */}
      <div className="card" style={{ padding: "18px 20px", marginTop: 28 }}>
        <SectionTitle>📋 Histórico de Importações</SectionTitle>
        <HistoryTable history={history} onDelete={deleteHistory} />
      </div>

      {/* ── Depósitos / Levantamentos ── */}
      <div className="card" style={{ padding: "18px 20px", marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
          <SectionTitle>🏦 Depósitos / Levantamentos</SectionTitle>
          {deposits.length > 0 && (
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              Total depositado:{" "}
              <strong style={{ color: "#22c55e" }}>
                +€{deposits.filter(d => d.tipo === "deposito").reduce((s, d) => s + d.valor, 0)
                  .toLocaleString("pt-PT", { minimumFractionDigits: 2 })}
              </strong>
            </span>
          )}
        </div>
        {deposits.length === 0 ? (
          <div style={{ textAlign: "center", padding: "28px 16px", color: "var(--muted)", fontSize: "0.8rem" }}>
            Nenhum movimento detectado.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
              <thead>
                <tr>
                  {["Data", "Corretora", "Tipo", "Valor", "Descrição"].map(h => (
                    <th key={h} style={{
                      padding: "8px 12px", textAlign: h === "Valor" ? "right" : "left",
                      background: "var(--hover)", color: "var(--muted)", fontWeight: 700,
                      fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: ".05em",
                      whiteSpace: "nowrap", borderBottom: "1px solid var(--border)",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deposits.map(d => {
                  const isDep = d.tipo === "deposito";
                  return (
                    <tr key={d.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "9px 12px", color: "var(--muted)", whiteSpace: "nowrap" }}>
                        {d.data?.slice(0, 10)}
                      </td>
                      <td style={{ padding: "9px 12px" }}>
                        <span style={{
                          fontSize: "0.68rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                          background: `${BROKER_COLOR[d.corretora] ?? "var(--accent)"}22`,
                          color: BROKER_COLOR[d.corretora] ?? "var(--accent)",
                        }}>{d.corretora}</span>
                      </td>
                      <td style={{ padding: "9px 12px" }}>
                        <span style={{
                          fontSize: "0.72rem", fontWeight: 600,
                          color: isDep ? "#22c55e" : "#f43f5e",
                        }}>{isDep ? "Depósito" : "Levantamento"}</span>
                      </td>
                      <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700,
                        color: isDep ? "#22c55e" : "#f43f5e", whiteSpace: "nowrap" }}>
                        {isDep ? "+" : "−"}€{d.valor.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: "9px 12px", color: "var(--muted)", fontSize: "0.75rem",
                        maxWidth: 340, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        title={d.descricao}>{d.descricao || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
