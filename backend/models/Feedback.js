const mongoose = require("mongoose");

const FeedbackSchema = new mongoose.Schema({
  employeeId:{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee"
  },
  managerId:{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee"
  },
  employeeName: String,
  date: {
    type: Date,
    default: Date.now
  },
  category: String,
  comments: String,
  rating: Number
});

module.exports = mongoose.model("Feedback", FeedbackSchema);