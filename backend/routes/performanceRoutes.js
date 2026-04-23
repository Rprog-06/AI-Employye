const express = require("express");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const MonthlyPerformance = require("../models/MonthlyPerformance");
const Employee = require("../models/Employee");
const Task = require("../models/Task");
const Feedback = require("../models/Feedback");
const Attendance = require("../models/Attendance");

const router = express.Router();
const STATUS_WEIGHTS = {
  done: 1,
  completed: 1,
  assigned: 0.55,
  "in progress": 0.75,
  pending: 0.4,
};
const getLocalMonthKey = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()).slice(0, 7);
const countWorkingDaysForMonth = (monthKey) => {
  const [yearValue, monthValue] = String(monthKey || "").split("-");
  const year = Number(yearValue);
  const month = Number(monthValue);
  if (!year || !month) return 0;

  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  const daysInMonth = new Date(year, month, 0).getDate();
  const endDay = isCurrentMonth ? Math.min(now.getDate(), daysInMonth) : daysInMonth;

  let workingDays = 0;
  for (let day = 1; day <= endDay; day += 1) {
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays += 1;
    }
  }

  return workingDays;
};

const normalizeByRange = (value, min, max) => {
  if (!Number.isFinite(value)) return 0;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max === min) return 1;
  return (value - min) / (max - min);
};

const buildEmployeeMatcher = (employee) =>
  [employee.name, employee.jiraDisplayName].filter(Boolean).map((value) => value.trim());
const MODEL_SCRIPT_PATH = path.resolve(__dirname, "../../codeperformance/recommendation_model.py");
const MODEL_ARTIFACT_PATH = path.resolve(
  __dirname,
  "../../codeperformance/ml_artifacts/recommendation_model.joblib"
);
const MODEL_METADATA_PATH = path.resolve(
  __dirname,
  "../../codeperformance/ml_artifacts/recommendation_model_metadata.json"
);

const ACTION_CATALOG = {
  "Assign mentorship": {
    category: "Mentorship",
    reason: (row) =>
      `Model detected a code quality support pattern around ${row.codeScore.toFixed(1)}/100 and recommends guided pairing.`,
  },
  "Plan targeted training": {
    category: "Training",
    reason: (row) =>
      `Model found a skill-development pattern from feedback ${row.feedbackScore.toFixed(1)}/100 and delivery signals.`,
  },
  "Rebalance workload": {
    category: "Workload",
    reason: (row) =>
      `Model flagged delivery pressure from ${row.overdueCount} overdue task${row.overdueCount === 1 ? "" : "s"} and ${row.totalTasks} assigned task${row.totalTasks === 1 ? "" : "s"}.`,
  },
  "Schedule attendance follow-up": {
    category: "Support",
    reason: (row) =>
      `Model linked attendance consistency at ${row.attendanceScore.toFixed(1)}/100 with a need for manager follow-up.`,
  },
  "Create recovery plan": {
    category: "Coaching",
    reason: (row) =>
      `Model detected a declining performance pattern with a trend delta of ${calculateTrendDelta(row.monthlyRows).toFixed(1)}.`,
  },
  "Prepare stretch assignment": {
    category: "Growth",
    reason: (row) =>
      `Model identified stable high performance and a positive trend of +${Math.max(0, calculateTrendDelta(row.monthlyRows)).toFixed(1)}.`,
  },
  "Maintain current plan": {
    category: "Stability",
    reason: () => "Model found balanced performance signals without a dominant intervention pattern.",
  },
};

const trainRecommendationModel = () => {
  const result = spawnSync("python", [MODEL_SCRIPT_PATH, "train"], {
    cwd: path.resolve(__dirname, "../../codeperformance"),
    encoding: "utf-8",
    timeout: 180000,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Model training failed");
  }

  return JSON.parse(result.stdout || "{}");
};

const predictRecommendationActions = (rows) => {
  if (!rows.length) {
    return { results: [], metadata: null };
  }

  if (!fs.existsSync(MODEL_ARTIFACT_PATH)) {
    trainRecommendationModel();
  }

  const payload = {
    rows: rows.map((row) => ({
      taskEfficiency: row.taskEfficiency,
      codeScore: row.codeScore,
      feedbackScore: row.feedbackScore,
      attendanceScore: row.attendanceScore,
      trendDelta: calculateTrendDelta(row.monthlyRows),
      totalTasks: row.totalTasks,
      overdueCount: row.overdueCount,
      feedbackCount: row.feedbackCount,
      attendanceDays: row.attendanceDays,
    })),
  };

  const result = spawnSync("python", [MODEL_SCRIPT_PATH, "predict"], {
    cwd: path.resolve(__dirname, "../../codeperformance"),
    encoding: "utf-8",
    input: JSON.stringify(payload),
    timeout: 120000,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Model prediction failed");
  }

  return JSON.parse(result.stdout || "{}");
};

const calculateTrendDelta = (monthlyRows) => {
  if (!Array.isArray(monthlyRows) || monthlyRows.length < 2) return 0;
  const recent = monthlyRows.slice(-2);
  const previous = monthlyRows.slice(-4, -2);
  if (!previous.length) {
    return (recent[recent.length - 1]?.performance_score || 0) - (recent[0]?.performance_score || 0);
  }

  const recentAverage =
    recent.reduce((sum, row) => sum + (Number(row.performance_score) || 0), 0) / recent.length;
  const previousAverage =
    previous.reduce((sum, row) => sum + (Number(row.performance_score) || 0), 0) / previous.length;
  return Number((recentAverage - previousAverage).toFixed(2));
};

const buildSmartRecommendations = (row) => {
  const recommendations = [];
  const overdueCount = row.overdueCount || 0;
  const currentLoad = row.totalTasks || 0;
  const monthlyTrend = calculateTrendDelta(row.monthlyRows);

  if (row.codeScore < 60) {
    recommendations.push({
      action: "Assign mentorship",
      category: "Mentorship",
      confidence: row.codeScore < 45 ? "High" : "Medium",
      reason: `Code quality is ${row.codeScore.toFixed(1)}/100, so pairing with a stronger reviewer can reduce rework.`,
    });
  }

  if (row.feedbackScore < 65) {
    recommendations.push({
      action: "Plan targeted training",
      category: "Training",
      confidence: row.feedbackScore < 50 ? "High" : "Medium",
      reason: `Feedback average is ${row.feedbackScore.toFixed(1)}/100, which suggests communication or delivery skills need reinforcement.`,
    });
  }

  if (row.taskEfficiency < 55 || overdueCount >= 2 || currentLoad >= 8) {
    recommendations.push({
      action: "Rebalance workload",
      category: "Workload",
      confidence: overdueCount >= 3 || currentLoad >= 10 ? "High" : "Medium",
      reason: `${overdueCount} overdue task${overdueCount === 1 ? "" : "s"} and ${currentLoad} assigned task${currentLoad === 1 ? "" : "s"} suggest delivery pressure is affecting output.`,
    });
  }

  if (row.attendanceScore < 75) {
    recommendations.push({
      action: "Schedule attendance follow-up",
      category: "Support",
      confidence: row.attendanceScore < 60 ? "High" : "Medium",
      reason: `Attendance score is ${row.attendanceScore.toFixed(1)}/100, so availability and routine may need manager support.`,
    });
  }

  if (monthlyTrend <= -10) {
    recommendations.push({
      action: "Create recovery plan",
      category: "Coaching",
      confidence: "High",
      reason: `Monthly KPI trend has dropped by ${Math.abs(monthlyTrend).toFixed(1)} points, so a short-term improvement plan is recommended.`,
    });
  } else if (monthlyTrend >= 8) {
    recommendations.push({
      action: "Prepare stretch assignment",
      category: "Growth",
      confidence: "Medium",
      reason: `Monthly KPI trend is improving by ${monthlyTrend.toFixed(1)} points, which indicates readiness for higher-impact work.`,
    });
  }

  if (!recommendations.length) {
    recommendations.push({
      action: "Maintain current plan",
      category: "Stability",
      confidence: "Medium",
      reason: "Recent performance, code quality, feedback, and attendance signals are stable, so continue the current support structure.",
    });
  }

  return recommendations.slice(0, 3);
};

const buildStrengths = (row) => {
  const strengths = [];
  if (row.taskEfficiency >= 75) strengths.push("Delivers assigned work with strong task completion discipline.");
  if (row.codeScore >= 75) strengths.push("Maintains healthy code quality and review outcomes.");
  if (row.feedbackScore >= 75) strengths.push("Receives positive feedback on collaboration and delivery.");
  if (row.attendanceScore >= 85) strengths.push("Shows dependable attendance and availability.");
  return strengths.slice(0, 3);
};

const buildFocusAreas = (row, trendDelta) => {
  const areas = [];
  if (row.taskEfficiency < 60) areas.push("Improve task execution speed and reduce incomplete or delayed work.");
  if (row.codeScore < 60) areas.push("Strengthen coding standards, review quality, and defect prevention.");
  if (row.feedbackScore < 65) areas.push("Improve delivery communication and responsiveness to review feedback.");
  if (row.attendanceScore < 75) areas.push("Increase attendance consistency and working-day coverage.");
  if (trendDelta <= -10) areas.push("Stabilize recent KPI decline with a short-term performance recovery plan.");
  return areas.slice(0, 3);
};

const buildAppraisalReport = (row, evaluationScore, smartRecommendations) => {
  const trendDelta = calculateTrendDelta(row.monthlyRows);
  const strengths = buildStrengths(row);
  const focusAreas = buildFocusAreas(row, trendDelta);
  const rating =
    evaluationScore >= 8
      ? "Outstanding"
      : evaluationScore >= 7
        ? "Strong"
        : evaluationScore >= 6
          ? "Stable"
          : evaluationScore >= 4.5
            ? "Needs Support"
            : "At Risk";

  const summaryParts = [
    `${row.employeeName} is currently rated as ${rating} with an overall evaluation score of ${evaluationScore}/10.`,
    `Task efficiency is ${row.taskEfficiency.toFixed(1)}/100, code quality is ${row.codeScore.toFixed(1)}/100, feedback score is ${row.feedbackScore.toFixed(1)}/100, and attendance score is ${row.attendanceScore.toFixed(1)}/100.`,
  ];

  if (trendDelta >= 8) {
    summaryParts.push(`Recent monthly KPI trend is improving by ${trendDelta.toFixed(1)} points.`);
  } else if (trendDelta <= -8) {
    summaryParts.push(`Recent monthly KPI trend shows a decline of ${Math.abs(trendDelta).toFixed(1)} points.`);
  } else {
    summaryParts.push("Recent monthly KPI trend is relatively stable.");
  }

  return {
    employeeName: row.employeeName,
    designation: row.designation,
    reviewMonth: row.month,
    rating,
    summary: summaryParts.join(" "),
    strengths: strengths.length
      ? strengths
      : ["Performance signals are balanced, with no single area standing out as a major strength this month."],
    focusAreas: focusAreas.length
      ? focusAreas
      : ["No critical risk area detected. Continue regular monitoring and development support."],
    recommendedManagerActions: smartRecommendations.map((item) => item.action),
    generatedAt: new Date().toISOString(),
  };
};

const buildMlRecommendationCard = (prediction, row, metadata) => {
  const action = prediction?.action || "Maintain current plan";
  const actionConfig = ACTION_CATALOG[action] || ACTION_CATALOG["Maintain current plan"];
  const confidenceValue = Number(prediction?.confidence || 0);

  return {
    action,
    category: actionConfig.category,
    confidence:
      confidenceValue >= 0.75 ? "High" : confidenceValue >= 0.5 ? "Medium" : "Low",
    confidenceScore: Number(confidenceValue.toFixed(4)),
    source: metadata?.modelType ? `${metadata.modelType} (${metadata.labelStrategy || "ml"})` : "RandomForestClassifier",
    reason: actionConfig.reason(row),
  };
};

router.post(
  "/ml/train",
  authMiddleware,
  roleMiddleware(["manager"]),
  async (req, res) => {
    try {
      const metadata = trainRecommendationModel();
      res.json({
        message: "Recommendation model trained successfully",
        metadata,
        modelArtifactPresent: fs.existsSync(MODEL_ARTIFACT_PATH),
        metadataPath: MODEL_METADATA_PATH,
      });
    } catch (error) {
      console.error("Error training recommendation model:", error);
      res.status(500).json({ message: "Failed to train recommendation model", error: error.message });
    }
  }
);

// Manager: view all monthly performance entries
router.get(
  "/manager",
  authMiddleware,
  roleMiddleware(["manager"]),
  async (req, res) => {
    try {
      const month = req.query.month;
      const query = month ? { month } : {};
      const data = await MonthlyPerformance.find(query).sort({
        created_at: -1,
        performance_score: -1,
      });
      res.json(data);
    } catch (error) {
      console.error("Error fetching manager performance:", error);
      res.status(500).json({ message: "Error fetching performance data" });
    }
  }
);

router.get(
  "/manager/evaluations",
  authMiddleware,
  roleMiddleware(["manager"]),
  async (req, res) => {
    try {
      const month = req.query.month || getLocalMonthKey();
      const workingDaysInMonth = countWorkingDaysForMonth(month);
      const employees = await Employee.find({ role: "employee" })
        .select("name designation totalScore average count jiraDisplayName")
        .lean();
      const tasks = await Task.find().lean();
      const feedbacks = await Feedback.find().lean();
      const attendanceRecords = await Attendance.find().lean();
      const monthlyPerformance = await MonthlyPerformance.find().lean();

      const rawRows = employees.map((employee) => {
        const employeeTaskRows = tasks.filter(
          (task) => String(task.assignedTo) === String(employee._id)
        );
        const taskEfficiency = employeeTaskRows.length
          ? (employeeTaskRows.reduce((sum, task) => {
              const statusKey = String(task.status || "").trim().toLowerCase();
              const base = STATUS_WEIGHTS[statusKey] ?? 0.45;
              const isOverdue =
                task.dueDate &&
                new Date(task.dueDate) < new Date() &&
                !["done", "completed"].includes(statusKey);
              return sum + Math.max(0, base - (isOverdue ? 0.2 : 0));
            }, 0) /
              employeeTaskRows.length) *
            100
          : 0;

        const employeeFeedbackRows = feedbacks.filter(
          (feedback) => String(feedback.employeeId) === String(employee._id)
        );
        const feedbackScore = employeeFeedbackRows.length
          ? (employeeFeedbackRows.reduce((sum, feedback) => sum + (feedback.rating || 0), 0) /
              employeeFeedbackRows.length) *
            20
          : 0;

        const employeeAttendanceRows = attendanceRecords.filter(
          (attendance) =>
            String(attendance.employeeId) === String(employee._id) &&
            String(attendance.date || "").startsWith(month)
        );
        const attendedDayWeight = employeeAttendanceRows.reduce((sum, attendance) => {
              if (attendance.status === "Present" || attendance.status === "WFH") return sum + 1;
              if (attendance.status === "Late") return sum + 0.75;
              return sum;
            }, 0);
        const attendanceScore = workingDaysInMonth
          ? (attendedDayWeight / workingDaysInMonth) * 100
          : 0;

        const monthlyRows = monthlyPerformance
          .filter((row) => buildEmployeeMatcher(employee).includes(row.employee))
          .sort((a, b) => String(a.month || "").localeCompare(String(b.month || "")));

        return {
          employeeId: String(employee._id),
          employeeName: employee.name,
          designation: employee.designation,
          totalScore: employee.totalScore || 0,
          average: employee.average || 0,
          count: employee.count || 0,
          taskEfficiency,
          codeScore: employee.average || 0,
          feedbackScore,
          attendanceScore,
          monthlyRows,
          month,
          totalTasks: employeeTaskRows.length,
          overdueCount: employeeTaskRows.filter((task) => {
            const statusKey = String(task.status || "").trim().toLowerCase();
            return (
              task.dueDate &&
              new Date(task.dueDate) < new Date() &&
              !["done", "completed"].includes(statusKey)
            );
          }).length,
          feedbackCount: employeeFeedbackRows.length,
          attendanceDays: employeeAttendanceRows.length,
        };
      });

      const taskValues = rawRows.map((row) => row.taskEfficiency);
      const codeValues = rawRows.map((row) => row.codeScore);
      const feedbackValues = rawRows.map((row) => row.feedbackScore);
      const attendanceValues = rawRows.map((row) => row.attendanceScore);

      const taskMin = Math.min(...taskValues, 0);
      const taskMax = Math.max(...taskValues, 0);
      const codeMin = Math.min(...codeValues, 0);
      const codeMax = Math.max(...codeValues, 0);
      const feedbackMin = Math.min(...feedbackValues, 0);
      const feedbackMax = Math.max(...feedbackValues, 0);
      const attendanceMin = Math.min(...attendanceValues, 0);
      const attendanceMax = Math.max(...attendanceValues, 0);
      let mlPredictionPayload = { results: [], metadata: null, failed: false };

      try {
        mlPredictionPayload = predictRecommendationActions(rawRows);
      } catch (predictionError) {
        console.error("ML recommendation prediction failed, using safe fallback:", predictionError.message);
        mlPredictionPayload = { results: [], metadata: null, failed: true };
      }

      const evaluations = rawRows.map((row) => {
        const rowIndex = rawRows.findIndex((candidate) => candidate.employeeId === row.employeeId);
        const mlPrediction = mlPredictionPayload.results?.[rowIndex] || null;
        const tn = normalizeByRange(row.taskEfficiency, taskMin, taskMax);
        const cn = normalizeByRange(row.codeScore, codeMin, codeMax);
        const fn = normalizeByRange(row.feedbackScore, feedbackMin, feedbackMax);
        const an = normalizeByRange(row.attendanceScore, attendanceMin, attendanceMax);
        const taskDisplay = Number((Math.min(row.taskEfficiency, 100) / 10).toFixed(2));
        const codeDisplay = Number((Math.min(row.codeScore, 100) / 10).toFixed(2));
        const feedbackDisplay = Number((Math.min(row.feedbackScore, 100) / 10).toFixed(2));
        const attendanceDisplay = Number((Math.min(row.attendanceScore, 100) / 10).toFixed(2));
        const evaluationScore = Number(
          (
            0.35 * taskDisplay +
            0.3 * codeDisplay +
            0.2 * feedbackDisplay +
            0.15 * attendanceDisplay
          ).toFixed(2)
        );
        const smartRecommendations = buildSmartRecommendations(row);
        const mlRecommendation = mlPrediction
          ? buildMlRecommendationCard(mlPrediction, row, mlPredictionPayload.metadata)
          : null;
        const mergedRecommendations = mlRecommendation
          ? [
              mlRecommendation,
              ...smartRecommendations.filter((item) => item.action !== mlRecommendation.action),
            ].slice(0, 3)
          : smartRecommendations;

        return {
          employeeId: row.employeeId,
          employeeName: row.employeeName,
          designation: row.designation,
          month: row.month,
          totalScore: row.totalScore,
          average: row.average,
          count: row.count,
          mlInsights: {
            trendDelta: calculateTrendDelta(row.monthlyRows),
            totalTasks: row.totalTasks,
            overdueCount: row.overdueCount,
            feedbackCount: row.feedbackCount,
            attendanceDays: row.attendanceDays,
            modelType: mlPredictionPayload.metadata?.modelType || null,
            modelAccuracy: mlPredictionPayload.metadata?.accuracy ?? null,
            modelTrainingSamples: mlPredictionPayload.metadata?.trainingSamples ?? null,
            usedMlPrediction: Boolean(mlRecommendation),
            fallbackUsed: Boolean(!mlRecommendation),
          },
          smartRecommendations: mergedRecommendations,
          appraisalReport: buildAppraisalReport(row, evaluationScore, mergedRecommendations),
          raw: {
            taskEfficiency: Number(row.taskEfficiency.toFixed(2)),
            codeScore: Number(row.codeScore.toFixed(2)),
            feedbackScore: Number(row.feedbackScore.toFixed(2)),
            attendanceScore: Number(row.attendanceScore.toFixed(2)),
          },
          normalized: {
            tn: Number(tn.toFixed(4)),
            cn: Number(cn.toFixed(4)),
            fn: Number(fn.toFixed(4)),
            an: Number(an.toFixed(4)),
          },
          evaluationScore,
          graphPoints: [
            { label: "Task", value: taskDisplay },
            { label: "Code", value: codeDisplay },
            { label: "Feedback", value: feedbackDisplay },
            { label: "Attendance", value: attendanceDisplay },
            { label: "Overall", value: evaluationScore },
          ],
          monthlyPerformance: row.monthlyRows.map((monthRow) => ({
            month: monthRow.month,
            performance_score: monthRow.performance_score ?? 0,
            story_points: monthRow.story_points ?? 0,
            time_spent: monthRow.time_spent ?? 0,
          })),
        };
      });

      res.json(evaluations);
    } catch (error) {
      console.error("Error fetching manager evaluations:", error);
      res.status(500).json({ message: "Error fetching evaluation data" });
    }
  }
);

// Employee: view own latest performance
router.get(
  "/me",
  authMiddleware,
  roleMiddleware(["employee"]),
  async (req, res) => {
    try {
      const employee = await Employee.findById(req.user.id).select("name jiraDisplayName");
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }

      const lookupKeys = [employee.name, employee.jiraDisplayName]
        .filter(Boolean)
        .map((k) => k.trim());

      const rows = await MonthlyPerformance.find({
        employee: { $in: lookupKeys },
      }).sort({ created_at: -1 });

      if (!rows.length) {
        return res.json({
          message: "No performance data found",
          data: null,
          lookupKeys,
        });
      }

      const totals = rows.reduce(
        (acc, row) => {
          acc.performance_score += Number(row.performance_score) || 0;
          acc.story_points += Number(row.story_points) || 0;
          acc.time_spent += Number(row.time_spent) || 0;
          return acc;
        },
        {
          performance_score: 0,
          story_points: 0,
          time_spent: 0,
        }
      );

      const averageData = {
        month: "Overall Average",
        performance_score: Number((totals.performance_score / rows.length).toFixed(2)),
        story_points: Number((totals.story_points / rows.length).toFixed(2)),
        time_spent: Number((totals.time_spent / rows.length).toFixed(2)),
        recordsCount: rows.length,
        lastUpdated: rows[0]?.created_at || null,
      };

      res.json({ data: averageData });
    } catch (error) {
      
      console.error("Error fetching employee performance:", error);
      res.status(500).json({ message: "Error fetching performance data" });
    }
  }
);

module.exports = router;
