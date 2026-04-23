const express = require("express");
const Attendance = require("../models/Attendance");
const WorkSession = require("../models/WorkSession");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const Employee = require("../models/Employee");

const router = express.Router();

const getLocalDateKey = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const getMonthKeyFromDate = (dateValue) => String(dateValue || getLocalDateKey()).slice(0, 7);

const buildMonthlySummary = (employees, records, month) =>
  employees.map((employee) => {
    const employeeRecords = records
      .filter((row) => String(row.employeeId?._id || row.employeeId) === String(employee._id))
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

    const totals = employeeRecords.reduce(
      (acc, row) => {
        const statusKey = String(row.status || "").trim();
        if (statusKey === "Present") acc.present += 1;
        else if (statusKey === "Late") acc.late += 1;
        else if (statusKey === "WFH") acc.wfh += 1;
        else if (statusKey === "Absent") acc.absent += 1;
        return acc;
      },
      { present: 0, late: 0, wfh: 0, absent: 0 }
    );

    return {
      employeeId: employee._id,
      employeeName: employee.name,
      designation: employee.designation,
      month,
      totals,
      records: employeeRecords.map((row) => ({
        _id: row._id,
        date: row.date,
        status: row.status,
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        managerNote: row.managerNote || null,
        verifiedAt: row.verifiedAt || null,
      })),
    };
  });

router.post(
  "/check-in",
  authMiddleware,
  roleMiddleware(["employee"]),
  async (req, res) => {
    try {
      const date = getLocalDateKey();
      const { proofUrl, note, status } = req.body;

      let attendance = await Attendance.findOne({ employeeId: req.user.id, date });

      if (attendance?.checkIn) {
        return res.status(400).json({ message: "Already checked in for today" });
      }

      if (!attendance) {
        attendance = new Attendance({ employeeId: req.user.id, date });
      }

      attendance.checkIn = new Date();
      attendance.status = status || attendance.status || "Present";
      attendance.checkInProofUrl = proofUrl || attendance.checkInProofUrl;
      attendance.checkInNote = note || attendance.checkInNote;

      await attendance.save();
      res.json({ message: "Checked in successfully", data: attendance });
    } catch (error) {
      console.error("Check-in error:", error);
      res.status(500).json({ message: "Check-in failed" });
    }
  }
);

router.post(
  "/check-out",
  authMiddleware,
  roleMiddleware(["employee"]),
  async (req, res) => {
    try {
      const date = getLocalDateKey();
      const { proofUrl, note } = req.body;
      const attendance = await Attendance.findOne({ employeeId: req.user.id, date });

      if (!attendance?.checkIn) {
        return res.status(400).json({ message: "Check-in required before check-out" });
      }

      if (attendance.checkOut) {
        return res.status(400).json({ message: "Already checked out for today" });
      }

      attendance.checkOut = new Date();
      attendance.checkOutProofUrl = proofUrl || attendance.checkOutProofUrl;
      attendance.checkOutNote = note || attendance.checkOutNote;

      await attendance.save();
      const activeSession = await WorkSession.findOne({
        employeeId: req.user.id,
        date,
        status: "In Progress",
      });

      if (activeSession?.startTime && !activeSession.endTime) {
        activeSession.endTime = attendance.checkOut;
        const elapsedMinutes = Math.max(
          0,
          Math.round((activeSession.endTime.getTime() - new Date(activeSession.lastActivityAt || activeSession.startTime).getTime()) / 60000)
        );
        if (activeSession.activityState === "Idle") {
          activeSession.idleMinutes = (activeSession.idleMinutes || 0) + elapsedMinutes;
        } else {
          activeSession.activeMinutes = (activeSession.activeMinutes || 0) + elapsedMinutes;
        }
        activeSession.totalMinutes =
          (activeSession.activeMinutes || 0) + (activeSession.idleMinutes || 0);
        activeSession.status = "Completed";
        activeSession.activityState = "Completed";
        activeSession.lastActivityAt = activeSession.endTime;
        await activeSession.save();
      }

      res.json({ message: "Checked out successfully", data: attendance });
    } catch (error) {
      console.error("Check-out error:", error);
      res.status(500).json({ message: "Check-out failed" });
    }
  }
);

router.get(
  "/me",
  authMiddleware,
  roleMiddleware(["employee"]),
  async (req, res) => {
    try {
      const month = req.query.month || getLocalDateKey().slice(0, 7);
      const records = await Attendance.find({
        employeeId: req.user.id,
        date: { $regex: `^${month}` },
      }).sort({ date: -1 });
      res.json(records);
    } catch (error) {
      console.error("Fetch my attendance error:", error);
      res.status(500).json({ message: "Failed to fetch attendance" });
    }
  }
);

router.get(
  "/today",
  authMiddleware,
  roleMiddleware(["employee"]),
  async (req, res) => {
    try {
      const date = getLocalDateKey();
      const record = await Attendance.findOne({ employeeId: req.user.id, date });
      res.json(record || null);
    } catch (error) {
      console.error("Fetch today attendance error:", error);
      res.status(500).json({ message: "Failed to fetch today attendance" });
    }
  }
);

router.get(
  "/all",
  authMiddleware,
  roleMiddleware(["manager"]),
  async (req, res) => {
    try {
      const date = req.query.date || getLocalDateKey();
      const records = await Attendance.find({ date })
        .populate("employeeId", "name email designation")
        .populate("verifiedBy", "name")
        .sort({ createdAt: -1 });
      res.json(records);
    } catch (error) {
      console.error("Fetch all attendance error:", error);
      res.status(500).json({ message: "Failed to fetch attendance list" });
    }
  }
);

router.get(
  "/manager/monthly",
  authMiddleware,
  roleMiddleware(["manager"]),
  async (req, res) => {
    try {
      const month = req.query.month || getMonthKeyFromDate();
      const employees = await Employee.find({ role: "employee" })
        .select("name designation email")
        .sort({ name: 1 })
        .lean();
      const records = await Attendance.find({
        date: { $regex: `^${month}` },
      })
        .populate("employeeId", "name designation")
        .sort({ date: 1, createdAt: -1 })
        .lean();

      res.json({
        month,
        employees: buildMonthlySummary(employees, records, month),
      });
    } catch (error) {
      console.error("Fetch monthly attendance error:", error);
      res.status(500).json({ message: "Failed to fetch monthly attendance" });
    }
  }
);

router.post(
  "/manager/bulk-upsert",
  authMiddleware,
  roleMiddleware(["manager"]),
  async (req, res) => {
    try {
      const { date, records } = req.body;
      if (!date) {
        return res.status(400).json({ message: "Date is required" });
      }

      if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ message: "Attendance records are required" });
      }

      const allowedStatuses = ["Present", "Absent", "Late", "WFH"];
      const operations = records
        .filter((item) => item?.employeeId)
        .map((item) => {
          const status = allowedStatuses.includes(item.status) ? item.status : "Present";
          return Attendance.findOneAndUpdate(
            { employeeId: item.employeeId, date },
            {
              $set: {
                status,
                managerNote: item.managerNote || null,
                verifiedBy: req.user.id,
                verifiedAt: new Date(),
              },
              $setOnInsert: {
                employeeId: item.employeeId,
                date,
              },
            },
            {
              new: true,
              upsert: true,
            }
          );
        });

      const savedRecords = await Promise.all(operations);
      const populatedRecords = await Attendance.find({
        _id: { $in: savedRecords.map((row) => row._id) },
      })
        .populate("employeeId", "name designation email")
        .populate("verifiedBy", "name")
        .sort({ createdAt: -1 });

      res.json({
        message: "Monthly attendance saved",
        data: populatedRecords,
      });
    } catch (error) {
      console.error("Bulk monthly attendance update error:", error);
      res.status(500).json({ message: "Failed to save monthly attendance" });
    }
  }
);

router.patch(
  "/:id/verify",
  authMiddleware,
  roleMiddleware(["manager"]),
  async (req, res) => {
    try {
      const { status, managerNote } = req.body;
      const update = {
        verifiedBy: req.user.id,
        verifiedAt: new Date(),
      };
      if (status) update.status = status;
      if (managerNote) update.managerNote = managerNote;

      const attendance = await Attendance.findByIdAndUpdate(req.params.id, update, {
        new: true,
      })
        .populate("employeeId", "name email designation")
        .populate("verifiedBy", "name");

      if (!attendance) {
        return res.status(404).json({ message: "Attendance record not found" });
      }

      res.json({ message: "Attendance verified", data: attendance });
    } catch (error) {
      console.error("Verify attendance error:", error);
      res.status(500).json({ message: "Attendance verification failed" });
    }
  }
);

module.exports = router;
