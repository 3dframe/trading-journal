const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs   = require("fs");

const DATA_DIR = path.join(__dirname, "data");
const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".db"));

for (const file of files) {
  const dbPath = path.join(DATA_DIR, file);
  const db = new DatabaseSync(dbPath);

  const before = db.prepare("SELECT COUNT(*) as n FROM dividendos WHERE valor_bruto_eur = 0 OR valor_bruto_eur IS NULL").get();
  db.exec("DELETE FROM dividendos WHERE valor_bruto_eur = 0 OR valor_bruto_eur IS NULL");
  const after = db.prepare("SELECT COUNT(*) as n FROM dividendos").get();

  console.log(`[${file}] Removidos ${before.n} dividendos inválidos. Ficaram ${after.n}.`);
  db.close();
}

console.log("\nLimpeza concluída. Podes apagar este ficheiro cleanup.js.");
