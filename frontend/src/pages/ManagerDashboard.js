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

  const averagePerformance = performanceRows.length
    ? (
        performanceRows.reduce((sum, row) => sum + (row.performance_score || 0), 0) / performanceRows.length
      ).toFixed(1)
    : "0.0";
  const avgCodeQuality = evaluationRows.length
    ? (
        evaluationRows.reduce((sum, row) => sum + (row.average || 0), 0) / evaluationRows.length
      ).toFixed(1)
    : "0.0";
  const attendanceProofRows = attendanceRows.slice(0, 4);
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
  const topPerformers = [...performanceRows]
    .sort((a, b) => (b.performance_score || 0) - (a.performance_score || 0))
    .slice(0, 3);
  const selectedEmployee =
    employees.find((employee) => employee._id === selectedEmployeeId) || employees[0] || null;
  const selectedEmployeeWorkSession = selectedEmployee
    ? workHoursByEmployee.get(String(selectedEmployee._id)) || null
    : null;
  const selectedEmployeeWorkMinutes = getActiveMinutes(selectedEmployeeWorkSession);
  const selectedEmployeeIdleMinutes = getIdleMinutes(selectedEmployeeWorkSession);
  const selectedEmployeeIsInProgress = selectedEmployeeWorkSession?.status === "In Progress";
  const selectedEmployeeIsIdle =
    selectedEmployeeIsInProgress && selectedEmployeeWorkSession?.activityState === "Idle";
  const selectedEmployeeEvaluation =
    evaluationRows.find((row) => row.employeeId === selectedEmployeeId) || null;
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
  const reviewAlerts = topPerformers.map((row, index) => ({
    id: `${row._id || row.employee}-${index}`,
    employee: row.employee,
    label: index === 0 ? "Strong" : index === 1 ? "Watch" : "Review",
    tone:
      index === 0
        ? "bg-emerald-100 text-emerald-700"
        : index === 1
          ? "bg-amber-100 text-amber-700"
          : "bg-rose-100 text-rose-700",
    text: `Performance score ${row.performance_score ?? 0} this month.`,
  }));
  const completedStatuses = ["done", "completed"];
  const lowEvaluationRows = [...evaluationRows]
    .filter((row) => (row.evaluationScore || 0) < 6)
    .sort((a, b) => (a.evaluationScore || 0) - (b.evaluationScore || 0));
  const lowCodeRows = [...evaluationRows]
    .filter((row) => (row.raw?.codeScore || 0) < 60)
    .sort((a, b) => (a.raw?.codeScore || 0) - (b.raw?.codeScore || 0));
  const lowAttendanceRows = [...evaluationRows]
    .filter((row) => (row.raw?.attendanceScore || 0) < 75)
    .sort((a, b) => (a.raw?.attendanceScore || 0) - (b.raw?.attendanceScore || 0));
  const unverifiedAttendanceCount = attendanceRows.filter((row) => !row.verifiedAt).length;
  const overdueTasks = tasks.filter((task) => {
    const statusKey = String(task.status || "").trim().toLowerCase();
    return task.dueDate && new Date(task.dueDate) < new Date() && !completedStatuses.includes(statusKey);
  });
  const unclearPriorityTasks = tasks.filter((task) => {
    const priorityValue = String(task.priority || "").trim().toLowerCase();
    return !priorityValue || priorityValue === "none";
  });
  const improvementSuggestions = [];
  const formatMinutes = (minutes) => {
    const safeMinutes = Math.max(0, Number(minutes) || 0);
    const hrs = Math.floor(safeMinutes / 60);
    const mins = safeMinutes % 60;
    return `${hrs}h ${mins}m`;
  };
  const attendanceStatusOptions = ["Present", "Late", "WFH", "Absent"];

  if (lowEvaluationRows.length > 0) {
    const names = lowEvaluationRows
      .slice(0, 2)
      .map((row) => row.employeeName)
      .join(" and ");
    improvementSuggestions.push(
      `Prioritize coaching for ${names}; ${lowEvaluationRows.length} employee${lowEvaluationRows.length > 1 ? "s are" : " is"} below the 6.0 evaluation target.`
    );
  }

  if (lowCodeRows.length > 0) {
    const focusRow = lowCodeRows[0];
    improvementSuggestions.push(
      `Increase code review support for ${focusRow.employeeName}; current code score is ${(focusRow.raw?.codeScore || 0).toFixed(1)}/100.`
    );
  }

  if (unverifiedAttendanceCount > 0) {
    improvementSuggestions.push(
      `Verify ${unverifiedAttendanceCount} attendance record${unverifiedAttendanceCount > 1 ? "s" : ""} for ${attendanceDate} to keep proof tracking current.`
    );
  }

  if (lowAttendanceRows.length > 0 && improvementSuggestions.length < 3) {
    const focusRow = lowAttendanceRows[0];
    improvementSuggestions.push(
      `Follow up on attendance consistency for ${focusRow.employeeName}; attendance score is ${(focusRow.raw?.attendanceScore || 0).toFixed(1)}/100.`
    );
  }

  if (overdueTasks.length > 0 && improvementSuggestions.length < 3) {
    improvementSuggestions.push(
      `Re-plan ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""} so delivery risk does not distort KPI trends.`
    );
  }

  if (unclearPriorityTasks.length > 0 && improvementSuggestions.length < 3) {
    improvementSuggestions.push(
      `Set explicit priorities for ${unclearPriorityTasks.length} task${unclearPriorityTasks.length > 1 ? "s" : ""} so monthly performance signals are easier to interpret.`
    );
  }

  if (improvementSuggestions.length === 0) {
    improvementSuggestions.push(
      "Team signals look stable right now. Keep reviewing monthly performance, code quality, and attendance for early changes."
    );
  }

  const menuItems = [
    { label: "Dashboard", to: "/dashboard", active: true },
    { label: "Meeting Feedback", to: "/meeting-feedback", active: false },
    { label: "Tasks", to: "/assign-task", active: false },
    { label: "Attendance", to: "/dashboard", active: false },
    { label: "Employees", to: "/view-employees", active: false },
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
                          ? `${performanceRows.length} team records tracked this month`
                          : "No monthly records yet"}
                    </p>
                    <div className="mt-4 max-w-xs">
                      <select
                        value={selectedEmployeeId}
                        onChange={(e) => setSelectedEmployeeId(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-400"
                      >
                        {employees.map((employee) => (
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
                  <p className="mt-3 text-4xl font-black text-slate-900">{tasks.length}</p>
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

            <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
              <div className="rounded-[28px] bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-slate-900">Latest Review Signals</h3>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                    Auto summary
                  </span>
                </div>
                <div className="space-y-4">
                  {reviewAlerts.length === 0 ? (
                    <p className="text-sm text-slate-500">No performance alerts available yet.</p>
                  ) : (
                    reviewAlerts.map((alert) => (
                      <div key={alert.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{alert.employee}</p>
                            <p className="mt-1 text-sm text-slate-500">{alert.text}</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${alert.tone}`}>
                            {alert.label}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[28px] bg-white p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-slate-900">Improvement Suggestions</h3>
                <ul className="mt-4 space-y-3 text-sm text-slate-600">
                  {improvementSuggestions.map((suggestion) => (
                    <li key={suggestion}>{suggestion}</li>
                  ))}
                </ul>

              </div>
            </section>

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

                {monthlyAttendanceRows.length === 0 ? (
                  <p className="text-sm text-slate-500">No employees found for monthly attendance.</p>
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
                        {monthlyAttendanceRows.map((row) => {
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
