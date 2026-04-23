const mongoose = require("mongoose");

const WorkSessionSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
    startTime: {
      type: Date,
      default: null,
    },
    endTime: {
      type: Date,
      default: null,
    },
    totalMinutes: {
      type: Number,
      default: 0,
    },
    activeMinutes: {
      type: Number,
      default: 0,
    },
    idleMinutes: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["Not Started", "In Progress", "Completed"],
      default: "Not Started",
    },
    activityState: {
      type: String,
      enum: ["Active", "Idle", "Completed"],
      default: "Active",
    },
    lastActivityAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

WorkSessionSchema.index({ employeeId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("WorkSession", WorkSessionSchema);
