// Migração pontual: corrige uma conta XTB cujos valores foram importados na moeda da
// conta (ex.: USD) mas guardados como se fossem EUR (taxa_cambio = 1). Converte os
// montantes para EUR à data de cada operação, usando a tabela local de câmbios do BCE.
//
// Uso:
//   node migrate-xtb-usd.js <username> [conta] [moeda]            (dry-run, não grava)
//   node migrate-xtb-usd.js <username> [conta] [moeda] --apply    (grava)
//
// Default: conta=52663818, moeda=USD.
// Idempotente: usa moeda_original/moeda como marcador (trades passam a 'USD' após
// migrar), por isso uma 2ª execução não encontra nada para converter e aborta.
const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fx   = require("./fx");

const [username, conta = "52663818", moeda = "USD"] = process.argv.slice(2);
const APPLY = process.argv.includes("--apply");

if (!username) {
  console.error("Falta o username. Uso: node migrate-xtb-usd.js <username> [conta] [moeda] [--apply]");
  process.exit(1);
}

const dbPath = path.join(__dirname, "data", `${username}.db`);
const db = new DatabaseSync(dbPath);
const CUR = moeda.toUpperCase();
const r4 = v => Math.round(v * 10000) / 10000;

const fxStatus = fx.status();
if (!fxStatus.loaded) {
  console.error("Tabela de câmbios vazia. Corre primeiro a atualização do BCE (POST /api/admin/fx/update).");
  process.exit(1);
}

// Pré-condição: existem trades por migrar (moeda_original ainda = 'EUR')?
const pending = db.prepare("SELECT COUNT(*) n FROM trades WHERE conta = ? AND moeda_original = 'EUR'").get(conta).n;
if (pending === 0) {
  console.log(`Nada a migrar: a conta ${conta} não tem trades com moeda_original='EUR'. (Provavelmente já migrada.)`);
  process.exit(0);
}

console.log(`${APPLY ? "A APLICAR" : "DRY-RUN"} — conta ${conta}, moeda ${CUR}, utilizador ${username}`);
console.log(`Câmbios BCE: ${fxStatus.minDate} → ${fxStatus.maxDate}\n`);

const TRADE_MONEY = ["pl_eur", "valor_compra_eur", "valor_venda_eur", "fees", "swap", "rollover", "gross_pl", "margin"];
const failed = [];
let nTrades = 0, nDivs = 0, nDeps = 0;
let plBefore = 0, plAfter = 0;

if (APPLY) db.exec("BEGIN");
try {
  // ── Trades ──
  const trades = db.prepare("SELECT * FROM trades WHERE conta = ? AND moeda_original = 'EUR'").all(conta);
  const updTrade = db.prepare(
    `UPDATE trades SET ${TRADE_MONEY.map(f => `${f} = ?`).join(", ")}, moeda_original = ?, taxa_cambio = ? WHERE id = ?`
  );
  for (const t of trades) {
    const rate = fx.eurPerUnit(CUR, t.data_fecho);
    if (!rate) { failed.push(`trade#${t.id} ${t.simbolo} (${t.data_fecho})`); continue; }
    plBefore += t.pl_eur ?? 0;
    const vals = TRADE_MONEY.map(f => (t[f] != null ? r4(t[f] * rate) : t[f]));
    plAfter += vals[0] ?? 0;
    if (APPLY) updTrade.run(...vals, CUR, rate, t.id);
    nTrades++;
  }

  // ── Dividendos / juros ──
  const divs = db.prepare("SELECT * FROM dividendos WHERE conta = ? AND moeda = 'EUR'").all(conta);
  const updDiv = db.prepare("UPDATE dividendos SET valor_bruto_eur = ?, retencao_eur = ?, valor_liq_eur = ?, moeda = ? WHERE id = ?");
  for (const d of divs) {
    const rate = fx.eurPerUnit(CUR, d.data_pagamento);
    if (!rate) { failed.push(`div#${d.id} ${d.simbolo} (${d.data_pagamento})`); continue; }
    if (APPLY) updDiv.run(r4((d.valor_bruto_eur ?? 0) * rate), r4((d.retencao_eur ?? 0) * rate), r4((d.valor_liq_eur ?? 0) * rate), CUR, d.id);
    nDivs++;
  }

  // ── Depósitos / levantamentos (sem marcador de moeda — protegidos pela pré-condição) ──
  const deps = db.prepare("SELECT * FROM depositos WHERE conta = ?").all(conta);
  const updDep = db.prepare("UPDATE depositos SET valor = ? WHERE id = ?");
  for (const dp of deps) {
    const rate = fx.eurPerUnit(CUR, dp.data);
    if (!rate) { failed.push(`dep#${dp.id} (${dp.data})`); continue; }
    if (APPLY) updDep.run(r4((dp.valor ?? 0) * rate), dp.id);
    nDeps++;
  }

  if (APPLY) db.exec("COMMIT");
} catch (e) {
  if (APPLY) db.exec("ROLLBACK");
  console.error("ERRO — rollback:", e.message);
  process.exit(1);
}

console.log(`Trades:     ${nTrades}  (P&L ${plBefore.toFixed(2)} ${CUR}  →  ${plAfter.toFixed(2)} EUR)`);
console.log(`Dividendos: ${nDivs}`);
console.log(`Depósitos:  ${nDeps}`);
if (failed.length) {
  console.log(`\n⚠️  ${failed.length} sem câmbio (não convertidos):`);
  failed.slice(0, 10).forEach(f => console.log("   - " + f));
}
console.log(APPLY ? "\n✅ Migração aplicada." : "\nℹ️  Dry-run. Corre com --apply para gravar.");
