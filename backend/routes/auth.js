const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Employee = require("../models/Employee");

const router = express.Router();
const JWT_SECRET = "codescore360_secret";

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = (email || "").trim().toLowerCase();

  const employee = await Employee.findOne({ email: normalizedEmail });
  if (!employee) return res.status(401).json({ message: "Invalid email or password" });

  const isMatch = await bcrypt.compare(password, employee.password);
  if (!isMatch) return res.status(401).json({ message: "Invalid email or password" });
  
  const token = jwt.sign({ id: employee._id, role: employee.role }, JWT_SECRET, {
    expiresIn: "1h"
  });

  res.json({ token, userId: employee._id, role: employee.role, name: employee.name });
  
});
router.post("/register-manager", async (req, res) => {
  const { name, email, password } = req.body;
  const normalizedEmail = (email || "").trim().toLowerCase();

  const existingManager = await Employee.findOne({ role: "manager" });
  if (existingManager)
    return res.status(403).json({ message: "Manager already exists" });

  const hashedPassword = await bcrypt.hash(password, 10);

  const manager = new Employee({
    name,
    email: normalizedEmail,
    password: hashedPassword,
    role: "manager"
  });

  await manager.save();
  res.json({ message: "Manager registered successfully" });
});

module.exports = router;
