const express = require("express");
const Feedback = require("../models/Feedback");
const Employee = require("../models/Employee");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const router = express.Router();

// Add Feedback
router.post("/", authMiddleware, roleMiddleware(["manager"]), async (req, res) => {
  try {
    const { employeeId, comments, rating, category, date } = req.body;

    if (!employeeId || !comments) {
      return res.status(400).json({ message: "Employee and comments are required" });
    }

    const [employee, manager] = await Promise.all([
      Employee.findById(employeeId).select("name"),
      Employee.findById(req.user.id).select("name"),
    ]);

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const feedback = new Feedback({
      employeeId,
      employeeName: employee.name,
      managerId: req.user.id,
      category,
      comments,
      rating: Number(rating),
      date: date || new Date(),
    });

    await feedback.save();

    const populatedFeedback = await Feedback.findById(feedback._id)
      .populate("managerId", "name")
      .populate("employeeId", "name");

    res.json({
      ...populatedFeedback.toObject(),
      managerName: manager?.name || "Manager",
    });
  } catch (error) {
    console.error("Error saving feedback:", error);
    res.status(500).json({ message: "Failed to save feedback" });
  }
});

router.get("/", authMiddleware, roleMiddleware(["employee"]), async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ employeeId: req.user.id })
      .populate("managerId", "name")
      .sort({ date: -1, _id: -1 });

    const response = feedbacks.map((row) => ({
      ...row.toObject(),
      managerName: row.managerId?.name || "Manager",
    }));

    res.json(response);
  } catch (error) {
    console.error("Error fetching feedback:", error);
    res.status(500).json({ message: "Failed to fetch feedback" });
  }
});

module.exports = router;
