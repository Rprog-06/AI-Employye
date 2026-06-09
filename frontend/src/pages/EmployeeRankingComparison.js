import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";

const metricOptions = [
  { key: "overall", label: "Overall", scale: "/10" },
  { key: "task", label: "Task", scale: "/10" },
  { key: "code", label: "Code", scale: "/10" },
  { key: "feedback", label: "Feedback", scale: "/10" },
  { key: "attendance", label: "Attendance", scale: "/10" },
];

const getMetricScore = (row, metric) => {
  if (!row) return 0;

  if (metric === "overall") return Number(row.evaluationScore || 0);
  if (metric === "task") return Number(((row.raw?.taskEfficiency || 0) / 10).toFixed(2));
  if (metric === "code") return Number(((row.raw?.codeScore || 0) / 10).toFixed(2));
  if (metric === "feedback") return Number(((row.raw?.feedbackScore || 0) / 10).toFixed(2));
  if (metric === "attendance") return Number(((row.raw?.attendanceScore || 0) / 10).toFixed(2));

  return 0;
};

const getRankTone = (rank) => {
  if (rank === 1) return "bg-emerald-100 text-emerald-700";
  if (rank === 2) return "bg-sky-100 text-sky-700";
  if (rank === 3) return "bg-indigo-100 text-indigo-700";
  return "bg-slate-100 text-slate-600";
};

function EmployeeRankingComparison() {
  const [evaluations, setEvaluations] = useState([]);
  const [metric, setMetric] = useState("overall");
  const [firstEmployeeId, setFirstEmployeeId] = useState("");
  const [secondEmployeeId, setSecondEmployeeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const token = localStorage.getItem("token");
  const managerName = localStorage.getItem("name") || "Manager";

  useEffect(() => {
    const fetchRankings = async () => {
      try {
        setLoading(true);
        setErrorMessage("");
        const res = await API.get("/performance/manager/evaluations", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const rows = res.data || [];
        setEvaluations(rows);
        if (rows[0]?._id || rows[0]?.employeeId) {
          setFirstEmployeeId(rows[0].employeeId);
        }
        if (rows[1]?._id || rows[1]?.employeeId) {
          setSecondEmployeeId(rows[1].employeeId);
        }
      } catch (error) {
        setErrorMessage(error.response?.data?.message || "Unable to load employee rankings.");
      } finally {
        setLoading(false);
      }
    };

    fetchRankings();
  }, [token]);

  const rankedEmployees = useMemo(() => {
    return [...evaluations]
      .sort((a, b) => getMetricScore(b, metric) - getMetricScore(a, metric))
      .map((row, index) => ({
        ...row,
        rank: index + 1,
        metricScore: getMetricScore(row, metric),
      }));
  }, [evaluations, metric]);

  const firstEmployee = rankedEmployees.find((row) => row.employeeId === firstEmployeeId) || rankedEmployees[0] || null;
  const secondEmployee =
    rankedEmployees.find((row) => row.employeeId === secondEmployeeId) || rankedEmployees[1] || rankedEmployees[0] || null;
  const selectedMetric = metricOptions.find((option) => option.key === metric) || metricOptions[0];
  const scoreGap = firstEmployee && secondEmployee
    ? Math.abs(firstEmployee.metricScore - secondEmployee.metricScore).toFixed(2)
    : "0.00";

  const logout = () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  const menuItems = [
    { label: "Dashboard", to: "/dashboard", active: false },
    { label: "Meeting Feedback", to: "/meeting-feedback", active: false },
    { label: "Tasks", to: "/assign-task", active: false },
    { label: "Attendance", to: "/dashboard", active: false },
    { label: "Employees", to: "/view-employees", active: false },
    { label: "Rank Compare", to: "/employee-rankings", active: true },
    { label: "Add-Employee", to: "/add-employee", active: false },
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
                      : "text-slate-200 hover:bg-white/10"
                  }`}
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-xs">
                    {item.label.slice(0, 1)}
                  </span>
                  <span className="hidden md:inline">{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>

          <div className="border-t border-white/10 px-3 py-4 md:px-4">
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-left text-sm text-slate-100 transition hover:bg-white/15"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-xs">L</span>
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-4 md:p-7">
          <section className="mb-6 rounded-[24px] bg-white px-4 py-4 shadow-sm md:px-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-600">Employee Rankings</p>
            <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="font-['Trebuchet_MS'] text-3xl font-bold text-slate-900 md:text-5xl">
                  Compare team rank, {managerName}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Rank employees by overall score or individual performance signals.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {metricOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setMetric(option.key)}
                    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                      metric === option.key
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 bg-slate-50 text-slate-600 hover:border-sky-300"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {loading ? (
            <div className="rounded-[28px] bg-white p-6 text-sm text-slate-500 shadow-sm">Loading rankings...</div>
          ) : errorMessage ? (
            <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
              {errorMessage}
            </div>
          ) : rankedEmployees.length === 0 ? (
            <div className="rounded-[28px] bg-white p-6 text-sm text-slate-500 shadow-sm">
              No employee evaluation data is available yet.
            </div>
          ) : (
            <div className="space-y-6">
              <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-[28px] bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-slate-900">Head-to-head</h2>
                    <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                      {selectedMetric.label}
                    </span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-sm font-medium text-slate-600">
                      Employee A
                      <select
                        value={firstEmployeeId}
                        onChange={(e) => setFirstEmployeeId(e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-sky-400"
                      >
                        {rankedEmployees.map((row) => (
                          <option key={row.employeeId} value={row.employeeId}>
                            #{row.rank} {row.employeeName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm font-medium text-slate-600">
                      Employee B
                      <select
                        value={secondEmployeeId}
                        onChange={(e) => setSecondEmployeeId(e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-sky-400"
                      >
                        {rankedEmployees.map((row) => (
                          <option key={row.employeeId} value={row.employeeId}>
                            #{row.rank} {row.employeeName}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {[firstEmployee, secondEmployee].filter(Boolean).map((employee) => (
                      <div key={employee.employeeId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{employee.employeeName}</p>
                            <p className="text-sm text-slate-500">{employee.designation || "Employee"}</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getRankTone(employee.rank)}`}>
                            Rank #{employee.rank}
                          </span>
                        </div>
                        <p className="mt-5 text-4xl font-black text-slate-900">
                          {employee.metricScore.toFixed(2)}
                          <span className="ml-1 text-sm font-semibold text-slate-400">{selectedMetric.scale}</span>
                        </p>
                        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-600"
                            style={{ width: `${Math.min(employee.metricScore * 10, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Score gap</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">
                      {scoreGap}
                      <span className="ml-1 text-sm font-semibold text-slate-400">{selectedMetric.scale}</span>
                    </p>
                  </div>
                </div>

                <div className="rounded-[28px] bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-slate-900">Top ranked</h2>
                    <span className="text-sm text-slate-500">{rankedEmployees.length} employees</span>
                  </div>
                  <div className="space-y-3">
                    {rankedEmployees.slice(0, 5).map((employee) => (
                      <div key={employee.employeeId} className="rounded-2xl border border-slate-200 px-4 py-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getRankTone(employee.rank)}`}>
                              #{employee.rank}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">{employee.employeeName}</p>
                              <p className="truncate text-sm text-slate-500">{employee.designation || "Employee"}</p>
                            </div>
                          </div>
                          <p className="shrink-0 text-lg font-black text-slate-900">
                            {employee.metricScore.toFixed(2)}
                          </p>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-500"
                            style={{ width: `${Math.min(employee.metricScore * 10, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] bg-white p-6 shadow-sm">
                <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <h2 className="text-xl font-semibold text-slate-900">Full ranking table</h2>
                  <p className="text-sm text-slate-500">Sorted by {selectedMetric.label.toLowerCase()} score</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-y-3">
                    <thead>
                      <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        <th className="px-4">Rank</th>
                        <th className="px-4">Employee</th>
                        <th className="px-4">Overall</th>
                        <th className="px-4">Task</th>
                        <th className="px-4">Code</th>
                        <th className="px-4">Feedback</th>
                        <th className="px-4">Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankedEmployees.map((employee) => (
                        <tr key={employee.employeeId} className="bg-slate-50 text-sm text-slate-700">
                          <td className="rounded-l-2xl px-4 py-4">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getRankTone(employee.rank)}`}>
                              #{employee.rank}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-semibold text-slate-900">{employee.employeeName}</p>
                            <p className="text-xs text-slate-500">{employee.designation || "Employee"}</p>
                          </td>
                          <td className="px-4 py-4 font-semibold">{getMetricScore(employee, "overall").toFixed(2)}</td>
                          <td className="px-4 py-4">{getMetricScore(employee, "task").toFixed(2)}</td>
                          <td className="px-4 py-4">{getMetricScore(employee, "code").toFixed(2)}</td>
                          <td className="px-4 py-4">{getMetricScore(employee, "feedback").toFixed(2)}</td>
                          <td className="rounded-r-2xl px-4 py-4">{getMetricScore(employee, "attendance").toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default EmployeeRankingComparison;
