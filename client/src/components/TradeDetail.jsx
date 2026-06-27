// Detalhe de uma operação (trade) para mostrar dentro de um modal.
// Componente partilhado entre o "Registo de Operações" (TradeLog) e a "Visão Geral"
// (Dashboard) para que ambos mostrem exatamente o mesmo layout melhorado: secções
// organizadas e valores no par "moeda original / euro".

const DEC = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
const GREEN = "#10b981", RED = "#f43f5e", BLUE = "#4f6af5";
const LGRAY = "#9ca3af";  // cinza claro (títulos, valores originais)

const CUR_SYMBOL = { USD: "US$ ", EUR: "€ ", GBP: "£ ", CHF: "CHF ", CAD: "C$ ", JPY: "¥ ", AUD: "A$ " };
const curSym = m => CUR_SYMBOL[m] || (m ? m + " " : "");
const isEur  = m => !m || m === "EUR";
const fmtEsign   = v => v == null ? "—" : (v < 0 ? "-" : "") + "€ " + Math.abs(Number(v)).toLocaleString("de-DE", DEC);
const fmtNatSign = (v, m) => v == null ? "—" : (v < 0 ? "-" : "") + curSym(m) + Math.abs(Number(v)).toLocaleString("de-DE", DEC);
const fmtN  = (v, dec = 2) => v != null && v !== 0 ? Number(v).toFixed(dec) : "—";
const fmtDT = v => v ? String(v).slice(0, 19).replace("T", " ") : "—";
// Valor original (moeda da corretora) reconstruído a partir da taxa de câmbio guardada.
const toOrig = (eur, t) => (eur == null || !t.taxa_cambio || t.taxa_cambio === 1) ? eur : eur / t.taxa_cambio;
// "$ orig ● € convertido" — só mostra o par quando a moeda ≠ EUR; senão só €.
const pairVal = (eur, t) => eur == null ? "—"
  : isEur(t.moeda_original) ? fmtEsign(eur)
  : <><span style={{ fontWeight: 700, color: LGRAY }}>{fmtNatSign(toOrig(eur, t), t.moeda_original)}</span> <span style={{ color: "var(--text)", fontWeight: 700 }}>● {fmtEsign(eur)}</span></>;
// Net P/L: original + € na MESMA cor (herdada do Field), original a negrito, € normal.
const pairPL = (eur, t) => eur == null ? "—"
  : isEur(t.moeda_original) ? fmtEsign(eur)
  : <><span style={{ fontWeight: 700 }}>{fmtNatSign(toOrig(eur, t), t.moeda_original)}</span> <span style={{ fontWeight: 400 }}>● {fmtEsign(eur)}</span></>;

export function Field({ label, value, color }) {
  return (
    <div>
      <div style={{ color: LGRAY, textTransform: "uppercase", fontSize: 9.5, letterSpacing: ".07em", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ color: color || "var(--text)", fontWeight: color ? 700 : 400, fontSize: 12.5 }}>
        {value ?? "—"}
      </div>
    </div>
  );
}

export function Section({ title, children }) {
  return (
    <div>
      <div style={{
        fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em",
        color: BLUE, borderBottom: `1px solid var(--border)`, paddingBottom: 4, marginBottom: 10,
      }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "10px 16px" }}>
        {children}
      </div>
    </div>
  );
}

export default function TradeDetail({ t }) {
  const hasPrices  = t.preco_abertura || t.preco_fecho;
  const hasRisk    = t.sl || t.tp || t.margin;
  const hasSwap    = t.swap || t.rollover || t.gross_pl;
  const hasComment = t.comment;

  return (
    <div style={{
      background: "var(--hover)", border: "1px solid var(--border)", borderTop: "none",
      borderRadius: "0 0 10px 10px", padding: "16px 20px", marginBottom: 6,
      display: "flex", flexDirection: "column", gap: 16, fontSize: 12,
    }}>
      {/* ── Identificação ── */}
      <Section title="Identificação">
        <Field label="Posição / Ref"   value={t.ref_externa} />
        <Field label="Símbolo"         value={t.simbolo} />
        <Field label="ISIN"            value={t.isin} />
        <Field label="Instrumento"     value={t.nome_instrumento} />
        <Field label="Tipo de Ordem"   value={t.tipo_ordem} />
        <Field label="Categoria"       value={t.categoria} />
        <Field label="Corretora"       value={t.corretora} />
        <Field label="Conta"           value={t.conta} />
        <Field label="Titular Conta"   value={t.conta_nome} />
        <Field label="País"            value={t.pais} />
        <Field label="Moeda Original"  value={t.moeda_original} />
        {t.taxa_cambio && t.taxa_cambio !== 1 &&
          <Field label="Taxa Câmbio" value={`× ${Number(t.taxa_cambio).toFixed(4)}`} />}
        <Field label="Produto"         value={t.produto} />
        <Field label="Origem (Plataforma)" value={t.origem} />
      </Section>

      {/* ── Datas ── */}
      <Section title="Datas">
        <Field label="Data/Hora Abertura" value={fmtDT(t.data_abertura)} />
        <Field label="Data/Hora Fecho"    value={fmtDT(t.data_fecho)} />
      </Section>

      {/* ── Preços e Volume ── */}
      {(hasPrices || t.volume) && (
        <Section title="Preços e Volume">
          <Field label="Volume"         value={fmtN(t.volume, 4)} />
          {hasPrices && <Field label="Preço Abertura" value={fmtN(t.preco_abertura, 5)} />}
          {hasPrices && <Field label="Preço Fecho"    value={fmtN(t.preco_fecho, 5)} />}
        </Section>
      )}

      {/* ── Valores de Negociação ── */}
      <Section title="Valores de Negociação">
        <Field label="Purchase Value"  value={pairVal(t.valor_compra_eur, t)} />
        <Field label="Sale Value"      value={pairVal(t.valor_venda_eur,  t)} />
        <Field label="Comissão"        value={pairVal(t.fees, t)} />
        {hasSwap && <Field label="Swap"     value={pairVal(t.swap, t)} />}
        {hasSwap && <Field label="Rollover" value={pairVal(t.rollover, t)} />}
        {hasSwap && <Field label="Gross P/L" value={pairVal(t.gross_pl, t)} />}
        {t.conversao_abertura && <Field label="Taxa Conv. Abertura" value={fmtN(t.conversao_abertura, 4)} />}
        {t.conversao_fecho    && <Field label="Taxa Conv. Fecho"    value={fmtN(t.conversao_fecho, 4)} />}
      </Section>

      {/* ── Risco (SL/TP/Margem) ── */}
      {hasRisk && (
        <Section title="Gestão de Risco">
          <Field label="Stop Loss (SL)"  value={fmtN(t.sl, 5)} />
          <Field label="Take Profit (TP)" value={fmtN(t.tp, 5)} />
          <Field label="Margem"          value={pairVal(t.margin, t)} />
        </Section>
      )}

      {/* ── Resultado ── */}
      <Section title="Resultado">
        <Field label="Net P/L" value={pairPL(t.pl_eur, t)} color={t.pl_eur >= 0 ? GREEN : RED} />
      </Section>

      {/* ── Comentário ── */}
      {hasComment && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em",
            color: BLUE, borderBottom: "1px solid var(--border)", paddingBottom: 4, marginBottom: 8 }}>
            Comentário
          </div>
          <div style={{ fontSize: 12, color: "var(--text)", fontStyle: "italic" }}>{t.comment}</div>
        </div>
      )}
    </div>
  );
}
