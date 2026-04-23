import { useCallback, useEffect, useMemo, useState } from "react";
import API from "../services/api";

const IDLE_THRESHOLD_MS = 2 * 60 * 1000;

function EmployeeDashboard() {
  const [tasks, setTasks] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [codeScore, setCodeScore] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [todayWorkSession, setTodayWorkSession] = useState(null);
  const [workSessionHistory, setWorkSessionHistory] = useState([]);
  const [feedbackFilterDate, setFeedbackFilterDate] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [note, setNote] = useState("");
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [workSessionLoading, setWorkSessionLoading] = useState(false);
  const [liveNow, setLiveNow] = useState(Date.now());
  const [lastInteractionAt, setLastInteractionAt] = useState(Date.now());
  const [activitySyncing, setActivitySyncing] = useState(false);
  const name = localStorage.getItem("name");
  const token = localStorage.getItem("token");
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const upsertWorkSession = useCallback((session) => {
    if (!session?._id) return;
    setTodayWorkSession(session);
    setWorkSessionHistory((current) => {
      const existingIndex = current.findIndex((row) => row._id === session._id);
      if (existingIndex === -1) {
        return [session, ...current];
      }

      const next = [...current];
      next[existingIndex] = session;
      return next;
    });
  }, []);

  const fetchTasks = useCallback(async () => {
    const taskRes = await API.get("/tasks", { headers: authHeaders });
    setTasks(taskRes.data || []);
  }, [authHeaders]);

  const fetchFeedback = useCallback(async () => {
    const feedbackRes = await API.get("/feedback", { headers: authHeaders });
    setFeedback(feedbackRes.data || []);
  }, [authHeaders]);

  const fetchCodeScore = useCallback(async () => {
    const codeScoreRes = await API.get("/employees/me", { headers: authHeaders });
    setCodeScore(codeScoreRes.data || null);
  }, [authHeaders]);

  const fetchPerformance = useCallback(async () => {
    const performanceRes = await API.get("/performance/me", { headers: authHeaders });
    setPerformance(performanceRes.data?.data || null);
  }, [authHeaders]);

  const fetchAttendance = useCallback(async () => {
    const [todayRes, historyRes] = await Promise.all([
      API.get("/attendance/today", { headers: authHeaders }),
      API.get("/attendance/me", { headers: authHeaders }),
    ]);
    setTodayAttendance(todayRes.data || null);
    setAttendanceHistory(historyRes.data || []);
  }, [authHeaders]);

  const fetchWorkSessions = useCallback(async () => {
    const [todayRes, historyRes] = await Promise.all([
      API.get("/work-sessions/today", { headers: authHeaders }),
      API.get("/work-sessions/me", { headers: authHeaders }),
    ]);
    setTodayWorkSession(todayRes.data || null);
    setWorkSessionHistory(historyRes.data || []);
  }, [authHeaders]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        await Promise.all([
          fetchTasks(),
          fetchFeedback(),
          fetchCodeScore(),
          fetchPerformance(),
          fetchAttendance(),
          fetchWorkSessions(),
        ]);
      } catch (error) {
        console.error("Error fetching dashboard data:", error.response?.data || error.message);
      }
    };

    fetchData();

    const taskRefreshInterval = setInterval(() => {
      fetchTasks().catch((error) => {
        console.error("Error refreshing tasks:", error.response?.data || error.message);
      });
    }, 30000);

    return () => clearInterval(taskRefreshInterval);
  }, [fetchAttendance, fetchCodeScore, fetchFeedback, fetchPerformance, fetchTasks, fetchWorkSessions]);

  useEffect(() => {
    if (todayWorkSession?.status !== "In Progress") return undefined;

    const timer = setInterval(() => {
      setLiveNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [todayWorkSession?.status]);

  useEffect(() => {
    if (todayWorkSession?.status !== "In Progress") return undefined;

    const refreshTimer = setInterval(() => {
      fetchWorkSessions().catch((error) => {
        console.error("Error refreshing work sessions:", error.response?.data || error.message);
      });
    }, 15000);

    return () => clearInterval(refreshTimer);
  }, [fetchWorkSessions, todayWorkSession?.status]);

  const syncActivityState = useCallback(
    async (nextState) => {
      if (
        activitySyncing ||
        !todayWorkSession ||
        todayWorkSession.status !== "In Progress" ||
        todayWorkSession.activityState === nextState
      ) {
        return;
      }

      try {
        setActivitySyncing(true);
        const res = await API.post(
          "/work-sessions/activity",
          { activityState: nextState },
          { headers: authHeaders }
        );
        upsertWorkSession(res.data?.data || null);
        setLastInteractionAt(new Date(res.data?.data?.lastActivityAt || Date.now()).getTime());
      } catch (error) {
        console.error("Error syncing activity state:", error.response?.data || error.message);
      } finally {
        setActivitySyncing(false);
      }
    },
    [activitySyncing, authHeaders, todayWorkSession, upsertWorkSession]
  );

  useEffect(() => {
    if (!todayWorkSession || todayWorkSession.status !== "In Progress") return undefined;

    const markActive = () => {
      setLastInteractionAt(Date.now());
      if (todayWorkSession.activityState === "Idle") {
        syncActivityState("Active");
      }
    };

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((eventName) => window.addEventListener(eventName, markActive, { passive: true }));

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, markActive));
    };
  }, [syncActivityState, todayWorkSession]);

  useEffect(() => {
    if (!todayWorkSession || todayWorkSession.status !== "In Progress") return undefined;

    const idleCheckTimer = setInterval(() => {
      const inactiveFor = Date.now() - lastInteractionAt;
      if (inactiveFor >= IDLE_THRESHOLD_MS && todayWorkSession.activityState !== "Idle") {
        syncActivityState("Idle");
      }
    }, 15000);

    return () => clearInterval(idleCheckTimer);
  }, [lastInteractionAt, syncActivityState, todayWorkSession]);

  const handleCheckIn = async () => {
    try {
      setAttendanceLoading(true);
      await API.post(
        "/attendance/check-in",
        { proofUrl: proofUrl || null, note: note || null },
        { headers: authHeaders }
      );
      setProofUrl("");
      setNote("");
      await fetchAttendance();
      alert("Checked in successfully");
    } catch (error) {
      alert(error.response?.data?.message || "Check-in failed");
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setAttendanceLoading(true);
      await API.post(
        "/attendance/check-out",
        { proofUrl: proofUrl || null, note: note || null },
        { headers: authHeaders }
      );
      setProofUrl("");
      setNote("");
      await Promise.all([fetchAttendance(), fetchWorkSessions()]);
      alert("Checked out successfully");
    } catch (error) {
      alert(error.response?.data?.message || "Check-out failed");
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleStartWork = async () => {
    try {
      setWorkSessionLoading(true);
      const res = await API.post("/work-sessions/start", {}, { headers: authHeaders });
      setLastInteractionAt(new Date(res.data?.data?.lastActivityAt || Date.now()).getTime());
      upsertWorkSession(res.data?.data || null);
      await fetchWorkSessions();
      alert("Work session started");
    } catch (error) {
      alert(error.response?.data?.message || "Unable to start work");
    } finally {
      setWorkSessionLoading(false);
    }
  };

  const handleEndWork = async () => {
    try {
      setWorkSessionLoading(true);
      const res = await API.post("/work-sessions/end", {}, { headers: authHeaders });
      upsertWorkSession(res.data?.data || null);
      await fetchWorkSessions();
      alert("Work session ended");
    } catch (error) {
      alert(error.response?.data?.message || "Unable to end work");
    } finally {
      setWorkSessionLoading(false);
    }
  };

  const formatMinutes = (minutes) => {
    const safeMinutes = Math.max(0, Number(minutes) || 0);
    const hrs = Math.floor(safeMinutes / 60);
    const mins = safeMinutes % 60;
    return `${hrs}h ${mins}m`;
  };

  const getSessionMinutes = (session) => {
    if (!session?.startTime) return 0;
    if (session.status === "In Progress" && session.activityState === "Active") {
      const runningMinutes = Math.max(
        0,
        Math.floor((liveNow - new Date(session.lastActivityAt || session.startTime).getTime()) / 60000)
      );
      return (session.activeMinutes || 0) + runningMinutes;
    }
    return session.activeMinutes || 0;
  };

  const getIdleMinutes = (session) => {
    if (!session?.startTime) return 0;
    if (session.status === "In Progress" && session.activityState === "Idle") {
      const runningMinutes = Math.max(
        0,
        Math.floor((liveNow - new Date(session.lastActivityAt || session.startTime).getTime()) / 60000)
      );
      return (session.idleMinutes || 0) + runningMinutes;
    }
    return session.idleMinutes || 0;
  };

  const todayWorkMinutes = getSessionMinutes(todayWorkSession);
  const todayIdleMinutes = getIdleMinutes(todayWorkSession);
  const liveSessionRow =
    todayWorkSession?._id
      ? workSessionHistory.find((row) => row._id === todayWorkSession._id) || todayWorkSession
      : null;
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDate = today.getDate();
  const workingDaysElapsed = Array.from({ length: currentDate }, (_, index) => {
    const day = new Date(currentYear, currentMonth, index + 1).getDay();
    return day !== 0 && day !== 6;
  }).filter(Boolean).length;
  const monthlyPresentDays = attendanceHistory.filter((row) =>
    ["Present", "Late", "WFH"].includes(row.status)
  ).length;
  const recordedAbsentDays = attendanceHistory.filter((row) => row.status === "Absent").length;
  const monthlyAbsentDays = Math.max(workingDaysElapsed - monthlyPresentDays, recordedAbsentDays, 0);
  const monthlyAttendancePercentage =
    workingDaysElapsed > 0
      ? ((monthlyPresentDays / workingDaysElapsed) * 100).toFixed(1)
      : "0.0";

  const logout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  const formatFeedbackDate = (value) => {
    if (!value) return "N/A";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "N/A";
    return parsed.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getFeedbackDateKey = (value) => {
    if (!value) return "undated";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "undated";
    const year = parsed.getFullYear();
    const month = `${parsed.getMonth() + 1}`.padStart(2, "0");
    const day = `${parsed.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const feedbackByDate = feedback.reduce((groups, item) => {
    const key = getFeedbackDateKey(item?.date);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {});
  const filteredFeedbackEntries = Object.entries(feedbackByDate).filter(([dateKey]) =>
    !feedbackFilterDate || dateKey === feedbackFilterDate
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Employee Dashboard</h1>
        <h2 className="text-xl font-bold">Welcome, {name}</h2>
        <button onClick={logout} className="bg-red-500 text-white px-4 py-2 rounded">
          Logout
        </button>
      </div>

      {performance ? (
        <div className="bg-white shadow rounded p-4 mb-6">
          <h3 className="font-semibold mb-3">Performance Overview</h3>
          <p><strong>Overview:</strong> {performance.month || "Overall Average"}</p>
          <p><strong>Average Performance Score:</strong> {performance.performance_score ?? 0}</p>
          <p><strong>Average Story Points:</strong> {performance.story_points ?? 0}</p>
          <p><strong>Average Time Spent (hrs):</strong> {performance.time_spent ?? 0}</p>
          <p><strong>Records Included:</strong> {performance.recordsCount ?? 0}</p>
        </div>
      ) : (
        <p>No performance data available.</p>
      )}

      {codeScore ? (
        <div className="bg-white shadow rounded p-4 mb-6">
          <h3 className="font-semibold mb-3">Code Score Overview</h3>
          <p><strong>Total Score:</strong> {codeScore.totalScore ?? 0}</p>
          <p><strong>Average Score:</strong> {codeScore.average ?? 0}</p>
          <p><strong>Total Reviews:</strong> {codeScore.count ?? 0}</p>
         
        </div>
      ) : null}

      <div className="bg-white shadow rounded p-4 mb-6">
        <h3 className="font-semibold mb-3">Attendance</h3>
        <p><strong>Today Status:</strong> {todayAttendance?.status || "Not marked"}</p>
        <p>
          <strong>Check In:</strong>{" "}
          {todayAttendance?.checkIn ? new Date(todayAttendance.checkIn).toLocaleTimeString() : "Not checked in"}
        </p>
        <p>
          <strong>Check Out:</strong>{" "}
          {todayAttendance?.checkOut ? new Date(todayAttendance.checkOut).toLocaleTimeString() : "Not checked out"}
        </p>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Proof URL (optional)"
            value={proofUrl}
            onChange={(e) => setProofUrl(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={handleCheckIn}
            disabled={attendanceLoading || !!todayAttendance?.checkIn}
            className="bg-green-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
          >
            Check In
          </button>
          <button
            onClick={handleCheckOut}
            disabled={attendanceLoading || !todayAttendance?.checkIn || !!todayAttendance?.checkOut}
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
          >
            Check Out
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded p-4 mb-6">
        <h3 className="font-semibold mb-3">Monthly Attendance Summary</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded border bg-green-50 p-3">
            <p className="text-sm text-slate-600">Total Present Days</p>
            <p className="text-2xl font-bold text-green-700">{monthlyPresentDays}</p>
          </div>
          <div className="rounded border bg-rose-50 p-3">
            <p className="text-sm text-slate-600">Total Absent Days</p>
            <p className="text-2xl font-bold text-rose-700">{monthlyAbsentDays}</p>
          </div>
          <div className="rounded border bg-blue-50 p-3">
            <p className="text-sm text-slate-600">Attendance Percentage</p>
            <p className="text-2xl font-bold text-blue-700">{monthlyAttendancePercentage}%</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          Calculated using working days elapsed this month, excluding weekends.
        </p>
      </div>

      <div className="bg-white shadow rounded p-4 mb-6">
        <h3 className="font-semibold mb-3">Work Session</h3>
        <p>
          <strong>Status:</strong>{" "}
          {todayWorkSession?.status === "In Progress"
            ? todayWorkSession?.activityState || "In Progress"
            : todayWorkSession?.status || "Not Started"}
        </p>
        <p>
          <strong>Started At:</strong>{" "}
          {todayWorkSession?.startTime ? new Date(todayWorkSession.startTime).toLocaleTimeString() : "Not started"}
        </p>
        <p>
          <strong>Ended At:</strong>{" "}
          {todayWorkSession?.endTime ? new Date(todayWorkSession.endTime).toLocaleTimeString() : "Still running"}
        </p>
        <p><strong>Today's Work Hours:</strong> {formatMinutes(todayWorkMinutes)}</p>
        <p><strong>Today's Idle Time:</strong> {formatMinutes(todayIdleMinutes)}</p>
        <p className="text-sm text-slate-500 mt-2">
          Auto-idle starts after 2 minutes without mouse, keyboard, scroll, or touch activity.
        </p>

        <div className="mt-3 flex gap-2">
          <button
            onClick={handleStartWork}
            disabled={
              workSessionLoading ||
              !todayAttendance?.checkIn ||
              !!todayAttendance?.checkOut ||
              !!todayWorkSession?.startTime
            }
            className="bg-emerald-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
          >
            Start Work
          </button>
          <button
            onClick={handleEndWork}
            disabled={workSessionLoading || todayWorkSession?.status !== "In Progress"}
            className="bg-indigo-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
          >
            End Work
          </button>
        </div>
        {!todayAttendance?.checkIn ? (
          <p className="text-sm text-slate-500 mt-3">Check in first to start today&apos;s work session.</p>
        ) : null}
      </div>

      <div className="bg-white shadow rounded p-4 mb-6">
        <h3 className="font-semibold mb-3">Attendance History</h3>
        {attendanceHistory.length === 0 ? (
          <p>No attendance records yet.</p>
        ) : (
          <table className="w-full border">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2">Date</th>
                <th className="border p-2">Status</th>
                <th className="border p-2">Check In</th>
                <th className="border p-2">Check Out</th>
                <th className="border p-2">Proof</th>
              </tr>
            </thead>
            <tbody>
              {attendanceHistory.map((row) => (
                <tr key={row._id}>
                  <td className="border p-2">{row.date}</td>
                  <td className="border p-2">{row.status}</td>
                  <td className="border p-2">{row.checkIn ? new Date(row.checkIn).toLocaleString() : "N/A"}</td>
                  <td className="border p-2">{row.checkOut ? new Date(row.checkOut).toLocaleString() : "N/A"}</td>
                  <td className="border p-2">
                    {row.checkInProofUrl ? (
                      <a className="text-blue-600 underline" href={row.checkInProofUrl} target="_blank" rel="noreferrer">
                        Check-in Proof
                      </a>
                    ) : (
                      "N/A"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white shadow rounded p-4 mb-6">
        <h3 className="font-semibold mb-3">Work Session History</h3>
        {workSessionHistory.length === 0 ? (
          <p>No work sessions yet.</p>
        ) : (
          <table className="w-full border">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2">Date</th>
                <th className="border p-2">Status</th>
                <th className="border p-2">Activity</th>
                <th className="border p-2">Start</th>
                <th className="border p-2">End</th>
                <th className="border p-2">Active</th>
                <th className="border p-2">Idle</th>
              </tr>
            </thead>
            <tbody>
              {workSessionHistory.map((row) => (
                <tr key={row._id}>
                  <td className="border p-2">{row.date}</td>
                  <td className="border p-2">{row.status}</td>
                  <td className="border p-2">{row.activityState || "N/A"}</td>
                  <td className="border p-2">{row.startTime ? new Date(row.startTime).toLocaleString() : "N/A"}</td>
                  <td className="border p-2">{row.endTime ? new Date(row.endTime).toLocaleString() : "N/A"}</td>
                  <td className="border p-2">{formatMinutes(row._id === liveSessionRow?._id ? todayWorkMinutes : row.activeMinutes)}</td>
                  <td className="border p-2">{formatMinutes(row._id === liveSessionRow?._id ? todayIdleMinutes : row.idleMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white shadow rounded p-4 mb-6">
        <h3 className="font-semibold mb-3">My Tasks</h3>

        {tasks.length === 0 ? (
          <p>No tasks assigned.</p>
        ) : (
          <table className="w-full border">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2">Title</th>
                <th className="border p-2">Priority</th>
                <th className="border p-2">Status</th>
                <th className="border p-2">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task._id}>
                  <td className="border p-2">{task.title}</td>
                  <td className="border p-2">{task.priority}</td>
                  <td className="border p-2">{task.status}</td>
                  <td className="border p-2">
                    {task.assignedDate ? new Date(task.assignedDate).toLocaleDateString() : "N/A"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white shadow rounded p-4">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <h3 className="font-semibold">Meeting Feedback</h3>
          <div className="flex flex-col gap-2 md:flex-row md:items-end">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Filter by date</label>
              <input
                type="date"
                value={feedbackFilterDate}
                onChange={(e) => setFeedbackFilterDate(e.target.value)}
                className="rounded border px-3 py-2"
              />
            </div>
            <button
              type="button"
              onClick={() => setFeedbackFilterDate("")}
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700"
            >
              Clear
            </button>
          </div>
        </div>

        {feedback.length === 0 ? (
          <p>No feedback yet.</p>
        ) : filteredFeedbackEntries.length === 0 ? (
          <p>No feedback found for the selected date.</p>
        ) : (
          filteredFeedbackEntries.map(([dateKey, items]) => (
            <div key={dateKey} className="mb-4">
              <h4 className="font-semibold text-slate-700 mb-2">
                {dateKey === "undated" ? "Date not available" : formatFeedbackDate(dateKey)}
              </h4>
              {items.map((f) => (
                <div key={f._id} className="bg-blue-50 p-3 rounded mb-2">
                  <p><strong>Manager:</strong> {f.managerName || f.managerId?.name || "Manager"}</p>
                  <p><strong>Category:</strong> {f.category || "General"}</p>
                  <p><strong>Comment:</strong> {f.comments}</p>
                  <p><strong>Rating:</strong> {f.rating}/5</p>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default EmployeeDashboard;
