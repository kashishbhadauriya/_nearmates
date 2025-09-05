const jwt = require("jsonwebtoken");
const secret = process.env.JWT_SECRET || "superSecretKey";

// Create JWT token for a user
function createTokenForUser(user) {
  const payload = {
    _id: user._id,
    username: user.username,
    role: user.role || "user",
  };
  return jwt.sign(payload, secret, { expiresIn: "1h" });
}

// Middleware to check authentication
function checkForAuthentication(req, res, next) {
  const token =
    req.cookies?.token || req.headers["authorization"]?.split(" ")[1];

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
  } catch {
    req.user = null;
  }

  next();
}

// Middleware to authorize based on roles

module.exports = { createTokenForUser, checkForAuthentication };
