const express  = require("express");
const bcrypt   = require("bcrypt");
const fs       = require("fs");
const path     = require("path");

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

module.exports = router;
