const express      = require("express");
const cors         = require("cors");
const path         = require("path");
const session      = require("express-session");
const FileStore    = require("session-file-store")(session);
const requireAuth  = require("./middleware/requireAuth");
const requireAdmin = require("./middleware/requireAdmin");

const app  = express();
const PORT = 3001;

app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:4173"],
  credentials: true,
}));
app.use(express.json());

app.use(session({
  store: new FileStore({ path: path.join(__dirname, "sessions"), logFn: () => {} }),
  secret: process.env.SESSION_SECRET || "trading-journal-secret-dev",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
  },
}));

// Rotas pÃºblicas
app.use("/api/auth", require("./routes/auth"));

// Rotas protegidas
app.use("/api/trades",    requireAuth, require("./routes/trades"));
app.use("/api/dividends", requireAuth, require("./routes/dividends"));
app.use("/api/irs",       requireAuth, require("./routes/irs"));
app.use("/api/admin",     requireAuth, requireAdmin, require("./routes/admin"));
app.use("/api/import",    requireAuth, require("./routes/import"));

// Em produÃ§Ã£o serve o React buildado
const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));
app.get("*", (req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n  Trading Journal API â†’ http://localhost:${PORT}\n`);
});
