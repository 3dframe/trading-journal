// Detalhe de uma posição de criptomoeda (holding) para o modal — partilhado entre o
// Dashboard ("Ativos em Carteira") e o "Registo de Operações". Mostra o resumo da
// posição e o histórico de movimentos (depósitos/levantamentos importados da Bybit).

const DEC   = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
const GREEN = "#10b981", RED = "#f43f5e", BLUE = "#4f6af5", LGRAY = "#9ca3af";

const fmtEur = v => v == null ? "—" : "€ " + Number(v).toLocaleString("de-DE", DEC);
// Quantidade de cripto: até 8 casas decimais, sem zeros desnecessários.
const fmtQty = v => v == null ? "—" : Number(v).toLocaleString("de-DE", { maximumFractionDigits: 8 });
const fmtDT  = v => v ? String(v).slice(0, 19).replace("T", " ") : "—";

function Field({ label, value, color }) {
  return (
    <div>
      <div style={{ color: LGRAY, textTransform: "uppercase", fontSize: 9.5, letterSpacing: ".07em", marginBottom: 3 }}>{label}</div>
      <div style={{ color: color || "var(--text)", fontWeight: color ? 700 : 600, fontSize: 12.5 }}>{value ?? "—"}</div>
    </div>
  );
}

const SecTitle = ({ children }) => (
  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em",
    color: BLUE, borderBottom: "1px solid var(--border)", paddingBottom: 4, marginBottom: 10 }}>{children}</div>
);

export default function CryptoDetail({ h }) {
  let movs = [];
  try { movs = JSON.parse(h.movimentos || "[]"); } catch { movs = []; }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, fontSize: 12 }}>
      {/* ── Resumo da posição ── */}
      <div>
        <SecTitle>Posição</SecTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "10px 16px" }}>
          <Field label="Ativo"            value={`${h.nome || h.simbolo} (${h.simbolo})`} />
          <Field label="Quantidade"       value={`${fmtQty(h.quantidade)} ${h.simbolo}`} />
          <Field label="Preço Atual"      value={h.preco_atual != null ? fmtEur(h.preco_atual) : "—"} />
          <Field label="Valor de Mercado" value={fmtEur(h.valor_eur)} color={GREEN} />
          <Field label="Corretora"        value={h.corretora} />
          <Field label="Conta"            value={h.conta} />
          <Field label="Titular"          value={h.conta_nome} />
          <Field label="Atualizado"       value={fmtDT(h.atualizado_em)} />
        </div>
      </div>

      {/* ── Histórico de movimentos ── */}
      {movs.length > 0 ? (
        <div>
          <SecTitle>Histórico de Movimentos ({movs.length})</SecTitle>
          <table className="data-table no-sticky">
            <thead><tr>
              <th>Tipo</th><th>Data/Hora</th>
              <th style={{ textAlign: "right" }}>Quantidade</th><th>ID</th>
            </tr></thead>
            <tbody>
              {movs.map((m, i) => {
                const neg = (m.qtd ?? 0) < 0;
                return (
                  <tr key={i}>
                    <td style={{ color: neg ? RED : GREEN, fontWeight: 600 }}>{m.tipo}</td>
                    <td style={{ fontSize: 11 }}>{fmtDT(m.data)}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: neg ? RED : GREEN, whiteSpace: "nowrap" }}>
                      {neg ? "−" : "+"}{fmtQty(Math.abs(m.qtd ?? 0))} {h.simbolo}
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: 10.5, color: LGRAY, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={m.id || ""}>{m.id ?? "—"}</td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: "1px solid var(--border)" }}>
                <td colSpan={2} style={{ fontWeight: 700, color: "var(--text)" }}>Saldo atual</td>
                <td style={{ textAlign: "right", fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}>{fmtQty(h.quantidade)} {h.simbolo}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ color: LGRAY, fontSize: 12, fontStyle: "italic", lineHeight: 1.5 }}>
          Sem histórico de movimentos guardado para esta posição.
          Reimporta o relatório Bybit para passar a ver os depósitos e levantamentos linha-a-linha.
        </div>
      )}
    </div>
  );
}
