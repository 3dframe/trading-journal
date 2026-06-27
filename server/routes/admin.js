const express  = require("express");
const bcrypt   = require("bcrypt");
const fs       = require("fs");
const path     = require("path");
const fx       = require("../fx");
const { getDb } = require("../db");

const router     = express.Router();
const USERS_FILE = path.join(__dirname, "..", "users.json");
const LOGS_FILE  = path.join(__dirname, "..", "logs", "access.json");

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// GET /api/admin/users
router.get("/users", (req, res) => {
  const users = loadUsers().map(u => ({
    username:  u.username,
    isAdmin:   !!u.isAdmin,
    lastLogin: u.lastLogin || null,
  }));
  res.json(users);
});

// POST /api/admin/users
router.post("/users", async (req, res) => {
  const { username, password, isAdmin } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Username e password obrigatórios." });
  if (username.length < 3)
    return res.status(400).json({ error: "Username deve ter pelo menos 3 caracteres." });
  if (password.length < 6)
    return res.status(400).json({ error: "Password deve ter pelo menos 6 caracteres." });

  const users = loadUsers();
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase()))
    return res.status(409).json({ error: "Utilizador já existe." });

  const passwordHash = await bcrypt.hash(password, 12);
  users.push({ username, passwordHash, isAdmin: !!isAdmin, lastLogin: null });
  saveUsers(users);
  res.json({ username, isAdmin: !!isAdmin });
});

// DELETE /api/admin/users/:username
router.delete("/users/:username", (req, res) => {
  const target = req.params.username;
  if (target.toLowerCase() === req.session.user.username.toLowerCase())
    return res.status(400).json({ error: "Não podes eliminar a tua própria conta." });

  const users = loadUsers();
  const idx   = users.findIndex(u => u.username.toLowerCase() === target.toLowerCase());
  if (idx === -1) return res.status(404).json({ error: "Utilizador não encontrado." });

  users.splice(idx, 1);
  saveUsers(users);
  res.json({ ok: true });
});

// PATCH /api/admin/users/:username/password
router.patch("/users/:username/password", async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6)
    return res.status(400).json({ error: "Password deve ter pelo menos 6 caracteres." });

  const users = loadUsers();
  const user  = users.find(u => u.username.toLowerCase() === req.params.username.toLowerCase());
  if (!user) return res.status(404).json({ error: "Utilizador não encontrado." });

  user.passwordHash = await bcrypt.hash(password, 12);
  saveUsers(users);
  res.json({ ok: true });
});

// GET /api/admin/logs
router.get("/logs", (req, res) => {
  if (!fs.existsSync(LOGS_FILE)) return res.json([]);
  const logs = JSON.parse(fs.readFileSync(LOGS_FILE, "utf8"));
  res.json(logs.slice().reverse().slice(0, 100));
});

// GET /api/admin/fx — estado da tabela local de câmbios do BCE
router.get("/fx", (req, res) => {
  res.json(fx.status());
});

// POST /api/admin/fx/update — descarrega e repopula a tabela do BCE (opt-in)
router.post("/fx/update", async (req, res) => {
  try {
    const result = await fx.updateFromEcb();
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// POST /api/admin/reset-data — APAGA todos os dados importados do utilizador atual
// (operações, dividendos, depósitos, posições, valor justo e histórico de importações),
// deixando a base de dados em branco para reimportar do zero. A conta de utilizador e as
// taxas de câmbio NÃO são afetadas. Operação irreversível — exige o nome de utilizador
// no corpo (campo `confirm`) como salvaguarda extra além da confirmação no cliente.
router.post("/reset-data", (req, res) => {
  const username = req.session.user.username;
  if (!req.body || req.body.confirm !== username)
    return res.status(400).json({ error: "Confirmação inválida: escreve o teu nome de utilizador para confirmar." });

  try {
    const db = getDb(username);
    const tables = ["trades", "dividendos", "depositos", "posicoes", "fair_value", "import_history"];
    const deleted = {};
    db.exec("BEGIN");
    try {
      for (const t of tables) {
        try { deleted[t] = db.prepare(`DELETE FROM ${t}`).run().changes; }
        catch { deleted[t] = 0; }   // a tabela pode não existir nesta BD — ignora
      }
      db.exec("COMMIT");
    } catch (e) { db.exec("ROLLBACK"); throw e; }
    res.json({ ok: true, deleted });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
