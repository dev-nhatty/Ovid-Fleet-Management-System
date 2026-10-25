function requireHigherOfficer(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role !== 'Manager' || req.user.isHigherOfficer !== true) {
    return res.status(403).json({ error: 'Higher Officer access is required.' });
  }
  next();
}
module.exports = { requireHigherOfficer };
