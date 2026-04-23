const mongoose = require("mongoose");

const MonthlyPerformanceSchema = new mongoose.Schema(
  {
    employee: { type: String, required: true },
    performance_score: { type: Number, default: 0 },
    story_points: { type: Number, default: 0 },
    time_spent: { type: Number, default: 0 },
    priority: { type: String, default: "None" },
    month: { type: String, default: null },
    created_at: { type: Date, default: Date.now },
  },
  {
    collection: "monthly_performance",
  }
);

module.exports = mongoose.model("MonthlyPerformance", MonthlyPerformanceSchema);
