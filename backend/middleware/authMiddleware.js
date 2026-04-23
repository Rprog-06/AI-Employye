const jwt = require("jsonwebtoken");
const JWT_SECRET = "codescore360_secret";

module.exports = function (req, res, next) {
  console.log("Headers", req.headers.authorization);
  const token = req.headers.authorization;

  if (!token || !token.startsWith("Bearer "))
    return res.status(403).json({ message: "No token provided" });
  const tokens = token.split(" ")[1];

  try {
    const decoded = jwt.verify(tokens, JWT_SECRET);
    console.log("Decoded", decoded);
    req.user = decoded;

    next();
  } catch (err) {
    console.log(err);
    return res.status(401).json({ message: "Invalid token" });
  }
};