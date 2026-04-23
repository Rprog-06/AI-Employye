const express = require("express");
const Attendance = require("../models/Attendance");
const WorkSession = require("../models/WorkSession");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

const getLocalDateKey = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

const roundMinutesBetween = (start, end) => {
  if (!start || !end) return 0;
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(diffMs / 60000));
};

const applyElapsedMinutes = (session, nextTime = new Date()) => {
  if (!session?.lastActivityAt) {
    session.lastActivityAt = nextTime;
    return;
  }

  const elapsedMinutes = roundMinutesBetween(session.lastActivityAt, nextTime);
  if (session.activityState === "Idle") {
    session.idleMinutes = (session.idleMinutes || 0) + elapsedMinutes;
  } else {
    session.activeMinutes = (session.activeMinutes || 0) + elapsedMinutes;
  }

  session.totalMinutes = (session.activeMinutes || 0) + (session.idleMinutes || 0);
  session.lastActivityAt = nextTime;
};

router.post(
  "/start",
  authMiddleware,
  roleMiddleware(["employee"]),
  async (req, res) => {
    try {
      const date = getLocalDateKey();
      const attendance = await Attendance.findOne({ employeeId: req.user.id, date });

      if (!attendance?.checkIn) {
        return res.status(400).json({ message: "Check-in required before starting work" });
      }

      if (attendance.checkOut) {
        return res.status(400).json({ message: "Work session cannot start after check-out" });
      }

      let session = await WorkSession.findOne({ employeeId: req.user.id, date });

      if (session?.status === "In Progress") {
        return res.status(400).json({ message: "Work session already started" });
      }

      if (session?.endTime || session?.status === "Completed") {
        return res.status(400).json({ message: "Today's work session is already completed" });
      }

      if (!session) {
        session = new WorkSession({ employeeId: req.user.id, date });
      }

      session.startTime = new Date();
      session.endTime = null;
      session.totalMinutes = 0;
      session.activeMinutes = 0;
      session.idleMinutes = 0;
      session.status = "In Progress";
      session.activityState = "Active";
      session.lastActivityAt = session.startTime;

      await session.save();
      res.json({ message: "Work session started", data: session });
    } catch (error) {
      console.error("Start work session error:", error);
      res.status(500).json({ message: "Failed to start work session" });
    }
  }
);

router.post(
  "/end",
  authMiddleware,
  roleMiddleware(["employee"]),
  async (req, res) => {
    try {
      const date = getLocalDateKey();
      const session = await WorkSession.findOne({ employeeId: req.user.id, date });

      if (!session?.startTime) {
        return res.status(400).json({ message: "No active work session found for today" });
      }

      if (session.endTime) {
        return res.status(400).json({ message: "Work session already ended" });
      }

      session.endTime = new Date();
      applyElapsedMinutes(session, session.endTime);
      session.status = "Completed";
      session.activityState = "Completed";

      await session.save();
      res.json({ message: "Work session ended", data: session });
    } catch (error) {
      console.error("End work session error:", error);
      res.status(500).json({ message: "Failed to end work session" });
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
      const session = await WorkSession.findOne({ employeeId: req.user.id, date });
      res.json(session || null);
    } catch (error) {
      console.error("Fetch today work session error:", error);
      res.status(500).json({ message: "Failed to fetch today work session" });
    }
  }
);

router.post(
  "/activity",
  authMiddleware,
  roleMiddleware(["employee"]),
  async (req, res) => {
    try {
      const date = getLocalDateKey();
      const { activityState } = req.body;
      const nextState = activityState === "Idle" ? "Idle" : "Active";
      const session = await WorkSession.findOne({ employeeId: req.user.id, date });

      if (!session?.startTime || session.status !== "In Progress") {
        return res.status(400).json({ message: "No running work session found" });
      }

      if (session.activityState === nextState) {
        return res.json({ message: "Activity state unchanged", data: session });
      }

      applyElapsedMinutes(session, new Date());
      session.activityState = nextState;

      await session.save();
      res.json({ message: `Work session marked ${nextState.toLowerCase()}`, data: session });
    } catch (error) {
      console.error("Update work activity error:", error);
      res.status(500).json({ message: "Failed to update work activity" });
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
      const sessions = await WorkSession.find({
        employeeId: req.user.id,
        date: { $regex: `^${month}` },
      }).sort({ date: -1 });
      res.json(sessions);
    } catch (error) {
      console.error("Fetch my work sessions error:", error);
      res.status(500).json({ message: "Failed to fetch work sessions" });
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
      const sessions = await WorkSession.find({ date })
        .populate("employeeId", "name email designation")
        .sort({ updatedAt: -1 });
      res.json(sessions);
    } catch (error) {
      console.error("Fetch all work sessions error:", error);
      res.status(500).json({ message: "Failed to fetch work sessions" });
    }
  }
);

module.exports = router;
