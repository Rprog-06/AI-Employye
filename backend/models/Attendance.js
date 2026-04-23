const mongoose = require("mongoose");

const AttendanceSchema = new mongoose.Schema(
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
    checkIn: {
      type: Date,
      default: null,
    },
    checkOut: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["Present", "Absent", "Late", "WFH"],
      default: "Present",
    },
    checkInProofUrl: {
      type: String,
      default: null,
    },
    checkOutProofUrl: {
      type: String,
      default: null,
    },
    checkInNote: {
      type: String,
      default: null,
    },
    checkOutNote: {
      type: String,
      default: null,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    managerNote: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

AttendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", AttendanceSchema);
