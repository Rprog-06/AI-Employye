import React, { useState } from "react";
import API from "../services/api";

function AddEmployee() {
  const [employee, setEmployee] = useState({
    name: "",
    email: "",
    designation: "",
    jiraAccountId: ""
  });
  const handleSubmit = async (e) => {
    
    e.preventDefault();
    try{
      const token=localStorage.getItem("token");
    await API.post("/employees", employee,{
        headers: {
      Authorization: `Bearer ${token}`
    }     
    }
     

    );

    alert("Employee added successfully!");
    setEmployee({ name: "", email: "", designation: "" });
    } catch (error) {
      console.error("Error adding employee:", error);
      alert("Error adding employee. Please try again.");
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
  <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">

    <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
      Add Employee
    </h2>

    {/* Name */}
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-600 mb-1">
        Name
      </label>
      <input
        type="text"
        placeholder="Enter employee name"
        onChange={(e) =>
          setEmployee({ ...employee, name: e.target.value })
        }
        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>

    {/* Email */}
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-600 mb-1">
        Email
      </label>
      <input
        type="email"
        placeholder="Enter employee email"
        onChange={(e) =>
          setEmployee({ ...employee, email: e.target.value })
        }
        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>

    {/* Designation */}
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-600 mb-1">
        Designation
      </label>
      <input
        type="text"
        placeholder="Frontend / Backend"
        onChange={(e) =>
          setEmployee({ ...employee, designation: e.target.value })
        }
        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>

    {/* Jira Account ID */}
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-600 mb-1">
        Jira Account ID (optional)
      </label>
      <input
        type="text"
        placeholder="e.g. 712020:6a53f4fc-166d-4bb4-9002-90ba5137fc02"
        value={employee.jiraAccountId}
        onChange={(e) =>
          setEmployee({ ...employee, jiraAccountId: e.target.value })
        }
        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>

    {/* Submit Button */}
    <button
      onClick={handleSubmit}
      className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition duration-200"
    >
      Add Employee
    </button>

  </div>
</div>

  )
  
}
  
  

export default AddEmployee;
