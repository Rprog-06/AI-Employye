import { useEffect, useState } from "react";
import API from "../services/api";

function EmployeeList() {
  const [employees, setEmployees] = useState([]);

  useEffect(() => {

  const res= API.get("/employees", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }
    })
    .then((res) => setEmployees(res.data))
      .catch((err) => console.error("Error fetching employees:", err));

  }, []);

  return (
  <div className="min-h-screen bg-gray-100 p-6">
    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6">

      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        Employee List
      </h2>

      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-200 rounded-lg">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">
                Name
              </th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">
                Role
              </th>
            </tr>
          </thead>

          <tbody>
            {employees.map((emp) => (
              <tr
                key={emp._id}
                className="border-t hover:bg-gray-50 transition"
              >
                <td className="px-4 py-3 text-gray-800">
                  {emp.name}
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium
                      ${
                        emp.role === "manager"
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-green-100 text-green-700"
                      }`}
                  >
                    {emp.role}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {employees.length === 0 && (
        <p className="text-center text-gray-500 mt-6">
          No employees found.
        </p>
      )}

    </div>
  </div>
);

  
}

export default EmployeeList;