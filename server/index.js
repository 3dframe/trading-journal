const express = require("express");
const cors    = require("cors");
const path    = require("path");

const app  = express();
const PORT = 3001;

app.use(cors({ origin: ["http://localhost:5173", "http://localhost:4173"] }));
app.use(express.json());

// Rotas API
app.use("/api/trades",    require("./routes/trades"));
app.use("/api/dividends", require("./routes/dividends"));
app.use("/api/irs",       require("./routes/irs"));

// Em produção serve o React buildado
const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));
app.get("*", (req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n  Trading Journal API → http://localhost:${PORT}\n`);
});
