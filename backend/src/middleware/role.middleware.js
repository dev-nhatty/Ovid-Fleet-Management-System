// Role gate. Always mount AFTER requireAuth, which is what fills in
// req.user (with the role freshly read from the database).
//
//   router.post('/trips/:id/assign',
//     requireRole(ROLES.MANAGER),
//     tripsController.assign);
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: 'You are not authorized to perform this action' });
    }
    next();
  };
}

module.exports = { requireRole };
