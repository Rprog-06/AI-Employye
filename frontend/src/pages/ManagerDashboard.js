import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";

function ManagerDashboard() {
  const [performanceRows, setPerformanceRows] = useState([]);
  const [evaluationRows, setEvaluationRows] = useState([]);
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [workSessionRows, setWorkSessionRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceMonth, setAttendanceMonth] = useState(new Date().toISOString().slice(0, 7));
  const [monthlyAttendanceRows, setMonthlyAttendanceRows] = useState([]);
  const [attendanceDrafts, setAttendanceDrafts] = useState({});
  const [monthlyAttendanceSaving, setMonthlyAttendanceSaving] = useState(false);
  const [liveNow, setLiveNow] = useState(Date.now());
  const [insightDrawerOpen, setInsightDrawerOpen] = useState(false);
  const [activePanel, setActivePanel] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const token = localStorage.getItem("token");
  const managerName = localStorage.getItem("name") || "Manager";
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchPerformance = useCallback(async () => {
    try {
      const [performanceRes, evaluationRes] = await Promise.all([
        API.get("/performance/manager", { headers: authHeaders }),
        API.get("/performance/manager/evaluations", { headers: authHeaders }),
      ]);
      setPerformanceRows(performanceRes.data || []);
      setEvaluationRows(evaluationRes.data || []);
    } catch (error) {
      console.error("Error fetching manager performance:", error.response?.data || error.message);
    }
  }, [authHeaders]);

  const fetchAttendance = useCallback(async (dateValue = attendanceDate) => {
    try {
      const [attendanceRes, workSessionRes] = await Promise.all([
        API.get(`/attendance/all?date=${dateValue}`, { headers: authHeaders }),
        API.get(`/work-sessions/all?date=${dateValue}`, { headers: authHeaders }),
      ]);
      setAttendanceRows(attendanceRes.data || []);
      setWorkSessionRows(workSessionRes.data || []);
    } catch (error) {
      console.error("Error fetching attendance:", error.response?.data || error.message);
    }
  }, [attendanceDate, authHeaders]);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await API.get("/employees", { headers: authHeaders });
      setEmployees(res.data || []);
      if (res.data?.length && !selectedEmployeeId) {
        setSelectedEmployeeId(res.data[0]._id);
      }
    } catch (error) {
      console.error("Error fetching employees:", error.response?.data || error.message);
    }
  }, [selectedEmployeeId, authHeaders]);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await API.get("/tasks/all", { headers: authHeaders });
      setTasks(res.data || []);
    } catch (error) {
      console.error("Error fetching tasks:", error.response?.data || error.message);
    }
  }, [authHeaders]);

  const fetchMonthlyAttendance = useCallback(async (monthValue = attendanceMonth) => {
    try {
      const res = await API.get(`/attendance/manager/monthly?month=${monthValue}`, {
        headers: authHeaders,
      });
      const rows = res.data?.employees || [];
      setMonthlyAttendanceRows(rows);
      setAttendanceDrafts((current) => {
        const next = { ...current };
        rows.forEach((row) => {
          const existingRecord = row.records.find((record) => record.date === attendanceDate);
          next[row.employeeId] = {
            status: current[row.employeeId]?.status || existingRecord?.status || "Present",
            managerNote: current[row.employeeId]?.managerNote ?? existingRecord?.managerNote ?? "",
          };
        });
        return next;
      });
    } catch (error) {
      console.error("Error fetching monthly attendance:", error.response?.data || error.message);
    }
  }, [attendanceDate, attendanceMonth, authHeaders]);

  useEffect(() => {
    fetchPerformance();
    fetchAttendance(attendanceDate);
    fetchEmployees();
    fetchTasks();
    fetchMonthlyAttendance(attendanceMonth);
  }, [attendanceDate, attendanceMonth, fetchAttendance, fetchEmployees, fetchMonthlyAttendance, fetchPerformance, fetchTasks]);

  useEffect(() => {
    const dashboardRefreshInterval = setInterval(() => {
      fetchAttendance(attendanceDate);
    }, 30000);

    return () => clearInterval(dashboardRefreshInterval);
  }, [attendanceDate, fetchAttendance]);

  useEffect(() => {
    setAttendanceDrafts((current) => {
      const next = { ...current };
      monthlyAttendanceRows.forEach((row) => {
        const existingRecord = row.records.find((record) => record.date === attendanceDate);
        next[row.employeeId] = {
          status: current[row.employeeId]?.status || existingRecord?.status || "Present",
          managerNote: current[row.employeeId]?.managerNote ?? existingRecord?.managerNote ?? "",
        };
      });
      return next;
    });
  }, [attendanceDate, monthlyAttendanceRows]);

  useEffect(() => {
    if (!workSessionRows.some((row) => row.status === "In Progress")) return undefined;

    const timer = setInterval(() => {
      setLiveNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [workSessionRows]);

  const verifyAttendance = async (id) => {
    try {
      await API.patch(
        `/attendance/${id}/verify`,
        { status: "Present", managerNote: "Verified by manager" },
        { headers: authHeaders }
      );
      await fetchAttendance(attendanceDate);
    } catch (error) {
      alert(error.response?.data?.message || "Verification failed");
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  const handleAttendanceDraftChange = (employeeId, field, value) => {
    setAttendanceDrafts((current) => ({
      ...current,
      [employeeId]: {
        status: current[employeeId]?.status || "Present",
        managerNote: current[employeeId]?.managerNote || "",
        [field]: value,
      },
    }));
  };

  const handleSaveMonthlyAttendance = async () => {
    try {
      setMonthlyAttendanceSaving(true);
      await API.post(
        "/attendance/manager/bulk-upsert",
        {
          date: attendanceDate,
          records: monthlyAttendanceRows.map((row) => ({
            employeeId: row.employeeId,
            status: attendanceDrafts[row.employeeId]?.status || "Present",
            managerNote: attendanceDrafts[row.employeeId]?.managerNote || "",
          })),
        },
        { headers: authHeaders }
      );
      await Promise.all([fetchAttendance(attendanceDate), fetchMonthlyAttendance(attendanceMonth)]);
      alert("Monthly attendance saved successfully");
    } catch (error) {
      alert(error.response?.data?.message || "Failed to save monthly attendance");
    } finally {
      setMonthlyAttendanceSaving(false);
    }
  };

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const collectSearchText = (value) => {
    if (value === null || value === undefined) return "";
    if (["string", "number", "boolean"].includes(typeof value)) return String(value);
    if (Array.isArray(value)) return value.map(collectSearchText).join(" ");
    if (typeof value === "object") return Object.values(value).map(collectSearchText).join(" ");
    return "";
  };
  const matchesSearch = (value) =>
    !normalizedSearchQuery || collectSearchText(value).toLowerCase().includes(normalizedSearchQuery);
  const filteredEmployees = employees.filter(matchesSearch);
  const filteredEmployeeIds = new Set(filteredEmployees.map((employee) => String(employee._id)));
  const filteredPerformanceRows = performanceRows.filter((row) => {
    if (!normalizedSearchQuery) return true;
    const employeeId = String(row.employeeId?._id || row.employeeId || "");
    return filteredEmployeeIds.has(employeeId) || matchesSearch(row);
  });
  const filteredEvaluationRows = evaluationRows.filter((row) => {
    if (!normalizedSearchQuery) return true;
    const employeeId = String(row.employeeId?._id || row.employeeId || "");
    return filteredEmployeeIds.has(employeeId) || matchesSearch(row);
  });
  const filteredAttendanceRows = attendanceRows.filter((row) => {
    if (!normalizedSearchQuery) return true;
    const employeeId = String(row.employeeId?._id || row.employeeId || "");
    return filteredEmployeeIds.has(employeeId) || matchesSearch(row);
  });
  const filteredMonthlyAttendanceRows = monthlyAttendanceRows.filter((row) => {
    if (!normalizedSearchQuery) return true;
    return filteredEmployeeIds.has(String(row.employeeId)) || matchesSearch(row);
  });
  const filteredTasks = tasks.filter(matchesSearch);

  useEffect(() => {
    if (!normalizedSearchQuery || filteredEmployees.length === 0) return;
    if (filteredEmployees.some((employee) => employee._id === selectedEmployeeId)) return;
    setSelectedEmployeeId(filteredEmployees[0]._id);
  }, [filteredEmployees, normalizedSearchQuery, selectedEmployeeId]);

  const averagePerformance = filteredPerformanceRows.length
    ? (
        filteredPerformanceRows.reduce((sum, row) => sum + (row.performance_score || 0), 0) / filteredPerformanceRows.length
      ).toFixed(1)
    : "0.0";
  const avgCodeQuality = filteredEvaluationRows.length
    ? (
        filteredEvaluationRows.reduce((sum, row) => sum + (row.average || 0), 0) / filteredEvaluationRows.length
      ).toFixed(1)
    : "0.0";
  const attendanceProofRows = filteredAttendanceRows.slice(0, 4);
  const getSessionMinutes = (row) => {
    if (!row?.startTime) return 0;
    if (row.status === "In Progress" && row.activityState === "Active") {
      return Math.max(
        0,
        Math.floor((liveNow - new Date(row.lastActivityAt || row.startTime).getTime()) / 60000)
      );
    }
    return 0;
  };
  const getActiveMinutes = (row) => {
    if (!row?.startTime) return 0;
    return (row.activeMinutes || 0) + getSessionMinutes(row);
  };
  const getIdleMinutes = (row) => {
    if (!row?.startTime) return 0;
    if (row.status === "In Progress" && row.activityState === "Idle") {
      return (row.idleMinutes || 0) + Math.max(0, Math.floor((liveNow - new Date(row.lastActivityAt || row.startTime).getTime()) / 60000));
    }
    return row.idleMinutes || 0;
  };
  const workHoursByEmployee = new Map(
    workSessionRows.map((row) => [String(row.employeeId?._id || row.employeeId), row])
  );
  const selectedEmployee =
    employees.find((employee) => employee._id === selectedEmployeeId) ||
    filteredEmployees[0] ||
    employees[0] ||
    null;
  const selectedEmployeeWorkSession = selectedEmployee
    ? workHoursByEmployee.get(String(selectedEmployee._id)) || null
    : null;
  const selectedEmployeeWorkMinutes = getActiveMinutes(selectedEmployeeWorkSession);
  const selectedEmployeeIdleMinutes = getIdleMinutes(selectedEmployeeWorkSession);
  const selectedEmployeeIsInProgress = selectedEmployeeWorkSession?.status === "In Progress";
  const selectedEmployeeIsIdle =
    selectedEmployeeIsInProgress && selectedEmployeeWorkSession?.activityState === "Idle";
  const selectedEmployeeEvaluation =
    evaluationRows.find((row) => row.employeeId === selectedEmployee?._id) || null;
  const selectedEmployeePerformanceRows = selectedEmployeeEvaluation?.monthlyPerformance || [];
  const selectedEmployeeLatestPerformance =
    selectedEmployeePerformanceRows[selectedEmployeePerformanceRows.length - 1] || null;
  const selectedEmployeeSmartRecommendations =
    selectedEmployeeEvaluation?.smartRecommendations || [];
  const selectedEmployeeMlInsights = selectedEmployeeEvaluation?.mlInsights || null;
  const selectedEmployeeAppraisalReport =
    selectedEmployeeEvaluation?.appraisalReport || null;
  const selectedEmployeeBars = selectedEmployeeEvaluation
    ? [
        {
          label: "Task",
          value: Number(((selectedEmployeeEvaluation.raw?.taskEfficiency || 0) / 10).toFixed(2)),
          color: "from-sky-400 to-blue-500",
        },
        {
          label: "Code",
          value: Number(((selectedEmployeeEvaluation.raw?.codeScore || 0) / 10).toFixed(2)),
          color: "from-indigo-400 to-blue-600",
        },
        {
          label: "Feedback",
          value: Number(((selectedEmployeeEvaluation.raw?.feedbackScore || 0) / 10).toFixed(2)),
          color: "from-emerald-400 to-teal-500",
        },
        {
          label: "Attendance",
          value: Number(((selectedEmployeeEvaluation.raw?.attendanceScore || 0) / 10).toFixed(2)),
          color: "from-cyan-400 to-sky-500",
        },
      ]
    : [];
  const completedStatuses = ["done", "completed"];
  const formatMinutes = (minutes) => {
    const safeMinutes = Math.max(0, Number(minutes) || 0);
    const hrs = Math.floor(safeMinutes / 60);
    const mins = safeMinutes % 60;
    return `${hrs}h ${mins}m`;
  };
  const attendanceStatusOptions = ["Present", "Late", "WFH", "Absent"];
  const getTaskEmployeeId = (task) => {
    const owner =
      task.employeeId ||
      task.assignedTo ||
      task.assignee ||
      task.employee ||
      task.userId ||
      task.user;
    return String(owner?._id || owner || "");
  };
  const analyzeBehaviorNotes = (notes) => {
    const combinedNotes = notes.filter(Boolean).join(" ").toLowerCase();
    const positiveWords = ["improved", "excellent", "good", "consistent", "helpful", "proactive", "focused"];
    const concernWords = ["late", "absent", "blocked", "issue", "inactive", "delay", "poor", "conflict", "missed"];
    const keywordGroups = [
      { label: "Late", terms: ["late", "delay", "delayed"] },
      { label: "Absent", terms: ["absent", "leave", "missed"] },
      { label: "Blocked", terms: ["blocked", "stuck", "dependency"] },
      { label: "Improved", terms: ["improved", "better", "progress"] },
      { label: "Communication", terms: ["communication", "communicate", "discussion", "meeting"] },
      { label: "Focus", terms: ["focus", "focused", "inactive", "idle"] },
    ];
    const positiveMatches = positiveWords.filter((word) => combinedNotes.includes(word)).length;
    const concernMatches = concernWords.filter((word) => combinedNotes.includes(word)).length;
    const sentiment =
      !combinedNotes
        ? "No Notes"
        : concernMatches > positiveMatches
          ? "Concern"
          : positiveMatches > concernMatches
            ? "Positive"
            : "Neutral";
    const keywords = keywordGroups
      .filter((group) => group.terms.some((term) => combinedNotes.includes(term)))
      .map((group) => group.label);

    return {
      sentiment,
      keywords,
      noteCount: notes.filter(Boolean).length,
    };
  };
  const behaviorInsights = filteredEmployees.map((employee) => {
    const employeeId = String(employee._id);
    const monthlyRow = monthlyAttendanceRows.find((row) => String(row.employeeId) === employeeId);
    const evaluationRow = evaluationRows.find((row) => {
      const rowEmployeeId = String(row.employeeId?._id || row.employeeId || "");
      return rowEmployeeId === employeeId || row.employeeName === employee.name;
    });
    const workSession = workHoursByEmployee.get(employeeId);
    const employeeTasks = filteredTasks.filter((task) => getTaskEmployeeId(task) === employeeId);
    const employeeOverdueTasks = employeeTasks.filter((task) => {
      const statusKey = String(task.status || "").trim().toLowerCase();
      return task.dueDate && new Date(task.dueDate) < new Date() && !completedStatuses.includes(statusKey);
    });
    const totals = monthlyRow?.totals || {};
    const presentDays = (totals.present || 0) + (totals.wfh || 0);
    const lateDays = totals.late || 0;
    const absentDays = totals.absent || 0;
    const behaviorNoteTexts = [
      attendanceDrafts[employeeId]?.managerNote,
      ...(monthlyRow?.records || []).map((record) => record.managerNote),
    ];
    const noteAnalysis = analyzeBehaviorNotes(behaviorNoteTexts);
    const attendanceSignals = presentDays + lateDays + absentDays;
    const punctualityScore = attendanceSignals
      ? Math.max(0, Math.round(((presentDays + lateDays * 0.6) / attendanceSignals) * 100))
      : null;
    const activeMinutes = getActiveMinutes(workSession);
    const idleMinutes = getIdleMinutes(workSession);
    const totalTrackedMinutes = activeMinutes + idleMinutes;
    const focusScore = totalTrackedMinutes
      ? Math.max(0, Math.round((activeMinutes / totalTrackedMinutes) * 100))
      : null;
    const evaluationScore = evaluationRow?.evaluationScore || 0;
    const riskPoints =
      absentDays * 2 +
      lateDays +
      employeeOverdueTasks.length * 2 +
      (focusScore !== null && focusScore < 60 ? 2 : 0) +
      (evaluationScore > 0 && evaluationScore < 6 ? 2 : 0);
    const riskLevel = riskPoints >= 5 ? "At Risk" : riskPoints >= 2 ? "Needs Support" : "Stable";
    const tone =
      riskLevel === "At Risk"
        ? "bg-rose-100 text-rose-700"
        : riskLevel === "Needs Support"
          ? "bg-amber-100 text-amber-700"
          : "bg-emerald-100 text-emerald-700";
    const action =
      riskLevel === "At Risk"
        ? "Schedule a 1:1 and agree on a recovery plan."
        : riskLevel === "Needs Support"
          ? "Check blockers and reinforce daily priorities."
          : "Recognize consistency and keep normal check-ins.";

    return {
      employee,
      punctualityScore,
      focusScore,
      activeMinutes,
      idleMinutes,
      lateDays,
      absentDays,
      overdueCount: employeeOverdueTasks.length,
      noteAnalysis,
      riskLevel,
      tone,
      action,
    };
  });
  const behaviorSummary = {
    stable: behaviorInsights.filter((item) => item.riskLevel === "Stable").length,
    needsSupport: behaviorInsights.filter((item) => item.riskLevel === "Needs Support").length,
    atRisk: behaviorInsights.filter((item) => item.riskLevel === "At Risk").length,
  };
  const selectedEmployeeBehavior =
    behaviorInsights.find((item) => item.employee._id === selectedEmployee?._id) || behaviorInsights[0] || null;
  const behaviorWatchlist = [...behaviorInsights]
    .sort((a, b) => {
      const priority = { "At Risk": 0, "Needs Support": 1, Stable: 2 };
      return priority[a.riskLevel] - priority[b.riskLevel] || b.overdueCount - a.overdueCount;
    })
    .slice(0, 3);

  const menuItems = [
    { label: "Dashboard", to: "/dashboard", active: true },
    { label: "Meeting Feedback", to: "/meeting-feedback", active: false },
    { label: "Tasks", to: "/assign-task", active: false },
    { label: "Employees", to: "/view-employees", active: false },
    { label: "Rank Compare", to: "/employee-rankings", active: false },
    { label: "Add-Employee",to:"/add-employee",active:false}
  ];

  return (
    <div className="min-h-screen bg-slate-200 px-3 py-4 md:px-6">
      <div className="mx-auto flex min-h-[92vh] max-w-7xl overflow-hidden rounded-[28px] border border-slate-200 bg-[#f6fbff] shadow-[0_28px_90px_rgba(15,23,42,0.18)]">
        <aside className="flex w-[92px] flex-col justify-between bg-[#162536] text-white md:w-[248px]">
          <div>
            <div className="border-b border-white/10 px-5 py-7 md:px-7">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 via-blue-500 to-cyan-300 text-2xl font-black text-slate-950">
                  C
                </div>
                <div className="hidden md:block">
                  <p className="font-['Trebuchet_MS'] text-lg font-semibold tracking-wide">CodeScore 360</p>
                  <p className="text-xs text-slate-300">Manager Console</p>
                </div>
              </div>
            </div>

            <nav className="px-3 py-6 md:px-4">
              {menuItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className={`mb-2 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    item.active
                      ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg"
                      : "text-slate-200 hover:bg-white/8"
                  }`}
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-xs">
                    {item.label.slice(0, 1)}
                  </span>
                  <span className="hidden md:inline">{item.label}</span>
                </Link>
              ))}

              <button
                type="button"
                onClick={() => setInsightDrawerOpen(true)}
                className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-sky-400/30 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-100 transition hover:bg-sky-500/20"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-sky-400/20 text-xs">
                  AI
                </span>
                <span className="hidden md:inline">Open Appraisal Panel</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePanel(activePanel === "behavior" ? "overview" : "behavior")}
                className={`mt-4 flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                  activePanel === "behavior"
                    ? "border-emerald-300/40 bg-emerald-400/20 text-emerald-50"
                    : "border-emerald-300/20 bg-emerald-400/10 text-slate-100 hover:bg-emerald-400/15"
                }`}
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-300/20 text-xs">
                  NLP
                </span>
                <span className="hidden md:inline">Open Behaviour Pulse</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePanel(activePanel === "attendance" ? "overview" : "attendance")}
                className={`mt-2 flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                  activePanel === "attendance"
                    ? "border-cyan-300/40 bg-cyan-400/20 text-cyan-50"
                    : "border-cyan-300/20 bg-cyan-400/10 text-slate-100 hover:bg-cyan-400/15"
                }`}
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-300/20 text-xs">
                  MR
                </span>
                <span className="hidden md:inline">Month Register</span>
              </button>
            </nav>
          </div>

          <div className="border-t border-white/10 px-3 py-4 md:px-4">
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-2xl bg-white/8 px-4 py-3 text-left text-sm text-slate-100 transition hover:bg-white/12"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-xs">L</span>
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-7">
          <div className="mb-6 flex flex-col gap-4 rounded-[24px] bg-white px-4 py-4 shadow-sm md:flex-row md:items-center md:justify-between md:px-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 text-xl text-slate-500">
                Q
              </div>
              <div className="min-w-0">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search employees, tasks, reviews"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-400 md:w-[320px]"
                />
              </div>
            </div>

          </div>

          <div className="space-y-6">
            <section>
              <h1 className="font-['Trebuchet_MS'] text-3xl font-bold text-slate-900 md:text-5xl">
                Welcome back, {managerName}!
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Live view of performance, attendance proof, and team activity.
              </p>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[28px] border-2 border-sky-400/60 bg-white p-6 shadow-[0_18px_50px_rgba(56,189,248,0.12)]">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-600">Overall Score KPI</p>
                <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(260px,0.9fr)_minmax(320px,1.1fr)] lg:items-end">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {selectedEmployee?.name || "No employee selected"}
                    </p>
                    <p className="mt-2 text-6xl font-black text-slate-900">
                      {selectedEmployeeEvaluation?.evaluationScore ?? averagePerformance}
                    </p>
                    <p className="mt-2 text-sm text-emerald-600">
                      {selectedEmployeeEvaluation
                        ? `Weighted evaluation built from task, code, feedback, and attendance scores`
                        : performanceRows.length > 0
                          ? `${filteredPerformanceRows.length} team records tracked this month`
                          : "No monthly records yet"}
                    </p>
                    <div className="mt-4 max-w-xs">
                      <select
                        value={
                          filteredEmployees.some((employee) => employee._id === selectedEmployeeId)
                            ? selectedEmployeeId
                            : ""
                        }
                        onChange={(e) => setSelectedEmployeeId(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-400"
                      >
                        {filteredEmployees.length === 0 ? (
                          <option value="">No matching employees</option>
                        ) : null}
                        {filteredEmployees.map((employee) => (
                          <option key={employee._id} value={employee._id}>
                            {employee.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="relative min-h-[220px] overflow-hidden rounded-3xl bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-5">
                      {selectedEmployeeEvaluation ? (
                        <>
                          <div className="grid h-[180px] grid-cols-4 items-end gap-4">
                            {selectedEmployeeBars.map((point) => (
                              <div key={point.label} className="flex h-full flex-col justify-end">
                                <div className="mb-3 text-center">
                                  <p className="text-sm font-bold text-slate-900">{point.value}/10</p>
                                </div>
                                <div className="relative flex-1 rounded-[24px] bg-white/70 p-2 shadow-inner">
                                  <div
                                    className={`absolute bottom-2 left-2 right-2 rounded-[18px] bg-gradient-to-t ${point.color} shadow-lg`}
                                    style={{ height: `${Math.max(12, (point.value / 10) * 100)}%` }}
                                  />
                                </div>
                                <p className="mt-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                  {point.label}
                                </p>
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                            <div className="rounded-2xl bg-white/80 px-3 py-3 shadow-sm">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                Task Weight
                              </p>
                              <p className="mt-1 text-sm font-bold text-slate-900">35%</p>
                            </div>
                            <div className="rounded-2xl bg-white/80 px-3 py-3 shadow-sm">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                Code Weight
                              </p>
                              <p className="mt-1 text-sm font-bold text-slate-900">30%</p>
                            </div>
                            <div className="rounded-2xl bg-white/80 px-3 py-3 shadow-sm">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                Feedback
                              </p>
                              <p className="mt-1 text-sm font-bold text-slate-900">20%</p>
                            </div>
                            <div className="rounded-2xl bg-white/80 px-3 py-3 shadow-sm">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                Attendance
                              </p>
                              <p className="mt-1 text-sm font-bold text-slate-900">15%</p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex h-[180px] items-center justify-center rounded-3xl bg-white/70 text-sm text-slate-500">
                          No employee evaluation data yet.
                        </div>
                      )}
                      <span className="absolute bottom-4 right-4 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        Target: 8.0
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
                <div className="rounded-[24px] bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-slate-500">This Week PRs</p>
                  <p className="mt-3 text-4xl font-black text-slate-900">{filteredTasks.length}</p>
                  <p className="mt-2 text-sm text-sky-600">Tasks assigned in system</p>
                </div>
                <div className="rounded-[24px] bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-slate-500">Avg Code Quality</p>
                  <p className="mt-3 text-4xl font-black text-slate-900">{avgCodeQuality}</p>
                  <p className="mt-2 text-sm text-emerald-600">Average code score from employee records</p>
                </div>
                <div className="rounded-[24px] bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-slate-500">Today Work Hours</p>
                  <p className="mt-3 text-4xl font-black text-slate-900">
                    {formatMinutes(selectedEmployeeWorkMinutes)}
                  </p>
                  <p className="mt-2 text-sm text-blue-600">
                    {selectedEmployeeIsInProgress && !selectedEmployeeIsIdle ? "Active now" : "Not active"} |{" "}
                    {selectedEmployeeIsIdle ? "Idle" : "Not idle"} |{" "}
                    {formatMinutes(selectedEmployeeIdleMinutes)} idle time
                  </p>
                </div>
              </div>
            </section>

            {activePanel === "behavior" ? (
            <section className="rounded-[28px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-6 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                    Employee Behaviour Management
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-slate-900">Behaviour pulse and support cues</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Tracks attendance consistency, focus time, idle signals, and overdue workload using the same
                    dashboard data, so managers can support employees early without adding another backend flow.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                    <p className="text-2xl font-black text-emerald-700">{behaviorSummary.stable}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Stable</p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                    <p className="text-2xl font-black text-amber-600">{behaviorSummary.needsSupport}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Support</p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                    <p className="text-2xl font-black text-rose-600">{behaviorSummary.atRisk}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">At Risk</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-500">Selected Employee</p>
                      <h4 className="mt-1 text-xl font-bold text-slate-900">
                        {selectedEmployeeBehavior?.employee.name || "No employee selected"}
                      </h4>
                    </div>
                    {selectedEmployeeBehavior ? (
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${selectedEmployeeBehavior.tone}`}>
                        {selectedEmployeeBehavior.riskLevel}
                      </span>
                    ) : null}
                  </div>

                  {selectedEmployeeBehavior ? (
                    <div className="mt-5 space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-slate-50 px-4 py-4">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Punctuality
                          </p>
                          <p className="mt-2 text-3xl font-black text-slate-900">
                            {selectedEmployeeBehavior.punctualityScore ?? "--"}%
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-4">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Focus Ratio
                          </p>
                          <p className="mt-2 text-3xl font-black text-slate-900">
                            {selectedEmployeeBehavior.focusScore ?? "--"}%
                          </p>
                        </div>
                      </div>
                      <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                        <p>Active: {formatMinutes(selectedEmployeeBehavior.activeMinutes)}</p>
                        <p>Idle: {formatMinutes(selectedEmployeeBehavior.idleMinutes)}</p>
                        <p>Late days: {selectedEmployeeBehavior.lateDays}</p>
                        <p>Absent days: {selectedEmployeeBehavior.absentDays}</p>
                      </div>
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                          Manager Action
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{selectedEmployeeBehavior.action}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">No behavior data available yet.</p>
                  )}
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="text-lg font-bold text-slate-900">Behaviour Watchlist</h4>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                      top 3
                    </span>
                  </div>
                  <div className="space-y-3">
                    {behaviorWatchlist.length === 0 ? (
                      <p className="text-sm text-slate-500">No employees match the current search.</p>
                    ) : (
                      behaviorWatchlist.map((item) => (
                        <div
                          key={item.employee._id}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="font-semibold text-slate-900">{item.employee.name}</p>
                              <p className="mt-1 text-sm text-slate-500">
                                {item.overdueCount} overdue | {item.lateDays} late | {item.absentDays} absent
                              </p>
                              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">
                                NLP: {item.noteAnalysis.sentiment}
                                {item.noteAnalysis.keywords.length > 0
                                  ? ` | ${item.noteAnalysis.keywords.slice(0, 2).join(", ")}`
                                  : ""}
                              </p>
                            </div>
                            <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${item.tone}`}>
                              {item.riskLevel}
                            </span>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-600">{item.action}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>
            ) : null}

            {activePanel === "attendance" ? (
            <section className="grid gap-6">
              <div className="rounded-[28px] bg-white p-6 shadow-sm">
                <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">Monthly Attendance Register</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Mark attendance for every employee on the selected date and review month-wise totals.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-2">
                      <label htmlFor="attendance-month" className="text-sm text-slate-500">Month</label>
                      <input
                        id="attendance-month"
                        type="month"
                        value={attendanceMonth}
                        onChange={(e) => {
                          setAttendanceMonth(e.target.value);
                          fetchMonthlyAttendance(e.target.value);
                        }}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-sky-400"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label htmlFor="attendance-date-register" className="text-sm text-slate-500">Date</label>
                      <input
                        id="attendance-date-register"
                        type="date"
                        value={attendanceDate}
                        onChange={(e) => {
                          setAttendanceDate(e.target.value);
                          fetchAttendance(e.target.value);
                        }}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-sky-400"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveMonthlyAttendance}
                      disabled={monthlyAttendanceSaving || monthlyAttendanceRows.length === 0}
                      className="rounded-2xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
                    >
                      {monthlyAttendanceSaving ? "Saving..." : "Save Attendance"}
                    </button>
                  </div>
                </div>

                {filteredMonthlyAttendanceRows.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    {normalizedSearchQuery
                      ? "No monthly attendance rows match your search."
                      : "No employees found for monthly attendance."}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-y-3">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                          <th className="px-4">Employee</th>
                          <th className="px-4">Designation</th>
                          <th className="px-4">Status</th>
                          <th className="px-4">Manager Note</th>
                          <th className="px-4">Month Summary</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMonthlyAttendanceRows.map((row) => {
                          const draft = attendanceDrafts[row.employeeId] || {
                            status: "Present",
                            managerNote: "",
                          };
                          return (
                            <tr key={row.employeeId} className="rounded-2xl bg-slate-50 shadow-sm">
                              <td className="rounded-l-2xl px-4 py-4">
                                <p className="font-semibold text-slate-900">{row.employeeName}</p>
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-600">{row.designation || "N/A"}</td>
                              <td className="px-4 py-4">
                                <select
                                  value={draft.status}
                                  onChange={(e) =>
                                    handleAttendanceDraftChange(row.employeeId, "status", e.target.value)
                                  }
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400"
                                >
                                  {attendanceStatusOptions.map((status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 py-4">
                                <input
                                  type="text"
                                  value={draft.managerNote}
                                  onChange={(e) =>
                                    handleAttendanceDraftChange(row.employeeId, "managerNote", e.target.value)
                                  }
                                  placeholder="Optional note"
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400"
                                />
                              </td>
                              <td className="rounded-r-2xl px-4 py-4 text-sm text-slate-600">
                                <div className="flex flex-wrap gap-2">
                                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                                    Present {row.totals.present}
                                  </span>
                                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                                    Late {row.totals.late}
                                  </span>
                                  <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">
                                    WFH {row.totals.wfh}
                                  </span>
                                  <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                                    Absent {row.totals.absent}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </section>
            ) : null}

            <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-[28px] bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-slate-900">Attendance Proof</h3>
                  <div className="flex items-center gap-2">
                    <label htmlFor="attendance-date" className="text-sm text-slate-500">
                      Date
                    </label>
                    <input
                      id="attendance-date"
                      type="date"
                      value={attendanceDate}
                      onChange={(e) => {
                        setAttendanceDate(e.target.value);
                        fetchAttendance(e.target.value);
                      }}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-sky-400"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  {attendanceProofRows.length === 0 ? (
                    <p className="text-sm text-slate-500">No attendance records found for the selected date.</p>
                  ) : (
                    attendanceProofRows.map((row) => (
                      <div
                        key={row._id}
                        className="flex flex-col gap-3 rounded-2xl border border-slate-200 px-4 py-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <p className="font-semibold text-slate-800">{row.employeeId?.name || "N/A"}</p>
                          <p className="text-sm text-slate-500">
                            {row.status} | {row.checkIn ? new Date(row.checkIn).toLocaleTimeString() : "No check-in"}
                          </p>
                          <p className="text-sm text-slate-500">
                            Work Hours: {formatMinutes(getActiveMinutes(workHoursByEmployee.get(String(row.employeeId?._id))))}
                          </p>
                          <p className="text-sm text-slate-500">
                            State: {workHoursByEmployee.get(String(row.employeeId?._id))?.activityState || "Not Started"} | Idle: {formatMinutes(getIdleMinutes(workHoursByEmployee.get(String(row.employeeId?._id))))}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {row.checkInProofUrl ? (
                            <a
                              href={row.checkInProofUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700"
                            >
                              View Proof
                            </a>
                          ) : (
                            <span className="rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-400">No Proof</span>
                          )}
                          {row.verifiedAt ? (
                            <span className="rounded-2xl bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-700">
                              Verified
                            </span>
                          ) : (
                            <button
                              onClick={() => verifyAttendance(row._id)}
                              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                            >
                              Verify
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[28px] bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-slate-900">Selected Employee Evaluation</h3>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                      formula based
                    </span>
                    <button
                      type="button"
                      onClick={() => setInsightDrawerOpen(true)}
                      className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700"
                    >
                      Open AI Panel
                    </button>
                  </div>
                </div>
                {!selectedEmployeeEvaluation ? (
                  <p className="text-sm text-slate-500">No evaluation data found for the selected employee.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Latest KPI</p>
                            <p className="mt-2 text-3xl font-black text-slate-900">
                              {selectedEmployeeLatestPerformance?.performance_score ?? 0}
                            </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {selectedEmployeeLatestPerformance?.month || "No monthly record"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Average Code Quality</p>
                        <p className="mt-2 text-3xl font-black text-slate-900">
                          {typeof selectedEmployeeEvaluation.average === "number"
                            ? selectedEmployeeEvaluation.average.toFixed(1)
                            : "0.0"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          From {selectedEmployeeEvaluation.count ?? 0} code reviews
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                        <p className="text-sm font-semibold text-slate-800">Normalized Inputs</p>
                        <div className="mt-3 space-y-2 text-sm text-slate-600">
                          <p>Task (Tn): {selectedEmployeeEvaluation.normalized.tn}</p>
                          <p>Code (Cn): {selectedEmployeeEvaluation.normalized.cn}</p>
                          <p>Feedback (Fn): {selectedEmployeeEvaluation.normalized.fn}</p>
                          <p>Attendance (An): {selectedEmployeeEvaluation.normalized.an}</p>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                        <p className="text-sm font-semibold text-slate-800">Raw Inputs</p>
                        <div className="mt-3 space-y-2 text-sm text-slate-600">
                          <p>Task Efficiency: {selectedEmployeeEvaluation.raw.taskEfficiency}</p>
                          <p>Code Score: {selectedEmployeeEvaluation.raw.codeScore}</p>
                          <p>Feedback: {selectedEmployeeEvaluation.raw.feedbackScore}</p>
                          <p>Attendance: {selectedEmployeeEvaluation.raw.attendanceScore}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>

      {insightDrawerOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-sm">
          <div className="h-full w-full max-w-[460px] overflow-y-auto border-l border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">AI Review Panel</p>
                  <h3 className="mt-1 text-xl font-bold text-slate-900">
                    {selectedEmployee?.name || "Selected Employee"}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Smart recommendations and appraisal report in one place.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInsightDrawerOpen(false)}
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="space-y-5 px-5 py-5">
              <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-slate-50 px-5 py-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-800">ML Smart Recommendations</p>
                  <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                    additive only
                  </span>
                </div>
                {selectedEmployeeMlInsights ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Trend</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {selectedEmployeeMlInsights.trendDelta >= 0 ? "+" : ""}
                        {selectedEmployeeMlInsights.trendDelta}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Tasks</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{selectedEmployeeMlInsights.totalTasks}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Overdue</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{selectedEmployeeMlInsights.overdueCount}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Feedback Rows</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{selectedEmployeeMlInsights.feedbackCount}</p>
                    </div>
                  </div>
                ) : null}
                <div className="mt-5 space-y-3">
                  {selectedEmployeeSmartRecommendations.length === 0 ? (
                    <p className="text-sm text-slate-500">No recommendations available.</p>
                  ) : (
                    selectedEmployeeSmartRecommendations.map((item) => (
                      <div
                        key={`${item.category}-${item.action}`}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">{item.action}</p>
                            <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                            {item.confidence}
                          </span>
                        </div>
                        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">
                          {item.category}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50 px-5 py-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-800">Appraisal Report</p>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    manager ready
                  </span>
                </div>
                {!selectedEmployeeAppraisalReport ? (
                  <p className="mt-3 text-sm text-slate-500">No appraisal report available.</p>
                ) : (
                  <div className="mt-4 space-y-4 text-sm text-slate-600">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Employee</p>
                        <p className="mt-1 font-semibold text-slate-900">{selectedEmployeeAppraisalReport.employeeName}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Rating</p>
                        <p className="mt-1 font-semibold text-slate-900">{selectedEmployeeAppraisalReport.rating}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:col-span-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Review Month</p>
                        <p className="mt-1 font-semibold text-slate-900">{selectedEmployeeAppraisalReport.reviewMonth}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Summary</p>
                      <p className="mt-3 text-sm leading-6 text-slate-700">{selectedEmployeeAppraisalReport.summary}</p>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Strengths</p>
                        <ul className="mt-3 space-y-3">
                          {selectedEmployeeAppraisalReport.strengths.map((item) => (
                            <li key={item} className="rounded-2xl bg-emerald-50 px-3 py-3 text-slate-700">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Focus Areas</p>
                        <ul className="mt-3 space-y-3">
                          {selectedEmployeeAppraisalReport.focusAreas.map((item) => (
                            <li key={item} className="rounded-2xl bg-amber-50 px-3 py-3 text-slate-700">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Recommended Manager Actions</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedEmployeeAppraisalReport.recommendedManagerActions.map((item) => (
                          <span
                            key={item}
                            className="rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ManagerDashboard;
