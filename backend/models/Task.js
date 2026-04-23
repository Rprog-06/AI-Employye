const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema({
  employeeName: String,
  title: String,
  description: String,
  priority: String,
  storyPoints: { type: Number, default: 0 },
  assignedTo:{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",
  },
  status: { type: String, default: "Assigned" },
  assignedDate: Date,
  dueDate: Date,
  jiraIssueKey: String
});

module.exports = mongoose.model("Task", TaskSchema);
