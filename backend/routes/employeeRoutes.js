const express = require("express");
const bcrypt = require("bcryptjs");
const Employee = require("../models/Employee");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const router = express.Router();

// Add Employee
router.post("/",authMiddleware,roleMiddleware(["manager"]), async (req, res) => {

  try{
  const {name,email,designation,jiraAccountId,jiraDisplayName}=req.body;
  const normalizedEmail = (email || "").trim().toLowerCase();
  const hashedPassword = await bcrypt.hash("welcome123", 10);
  const employee = new Employee({
    name,
    email: normalizedEmail,
    designation,
    jiraAccountId: jiraAccountId || null,
    jiraDisplayName: jiraDisplayName || null,
    role:"employee",
    password:hashedPassword
  });
  await employee.save();
  res.json(employee);
  } catch (error) {
    console.error("Error adding employee:", error);
    res.status(500).json({ message: "Error adding employee" });
  }
});

// Get Employees
router.get("/", authMiddleware, async (req, res) => {
  const employees = await Employee.find({role:"employee"});
  res.json(employees);
});

router.get("/me",authMiddleware, async (req, res) => {
  try{
    console.log("Fetching employee data for ID:", req.user.id);
  const employee = await Employee.findById(req.user.id).select("average count totalScore scores name designation");
    if(!employee){
      return res.status(404).json({message:"Employee not found"});
    }
    res.json(employee);
  }
    catch (error) {
    console.error("Error fetching employee data:", error);
    res.status(500).json({ message: "Error fetching employee data" });
  }

});

router.patch("/:id/jira-account", authMiddleware, roleMiddleware(["manager"]), async (req, res) => {
  try {
    const { jiraAccountId, jiraDisplayName } = req.body;
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      {
        jiraAccountId: jiraAccountId || null,
        jiraDisplayName: jiraDisplayName || null,
      },
      { new: true }
    );

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json({ message: "Jira account updated", employee });
  } catch (error) {
    console.error("Error updating Jira account:", error);
    res.status(500).json({ message: "Error updating Jira account" });
  }
});
module.exports = router;
