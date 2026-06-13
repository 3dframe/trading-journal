module.exports = function requireAdmin(req, res, next) {
  if (req.session?.user?.isAdmin) return next();
  res.status(403).json({ error: "Acesso negado." });
};
