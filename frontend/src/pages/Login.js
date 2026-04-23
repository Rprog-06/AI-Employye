import React from "react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import API from "../services/api";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const login = async () => {
    try {
      const response = await API.post("/auth/login",{email, password },
             {
                headers:{
                  Authorization:`Bearer ${localStorage.getItem("token")}`
                }
              });

     
      
      
      localStorage.setItem("token",response.data.token);
      localStorage.setItem("userId",response.data.userId);
      localStorage.setItem("role",response.data.role);
      localStorage.setItem("name",response.data.name);
      window.location.href = response.data.role === "manager" ? "/dashboard" : "/EmployeeDashboard";
    } catch (err) {
      const message=err.response?.data?.message||"Login failed";
      setError(message);
    }
  };

  return (
   <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
    <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
      
      <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
        CodeScore360 Login
      </h2>

      {/* Email */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-600 mb-1">
          Email
        </label>
        <input
          type="email"
          placeholder="Enter your email"
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Password */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-600 mb-1">
          Password
        </label>
        <input
          type="password"
          placeholder="Enter your password"
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-500 mb-3 text-center">
          {error}
        </p>
      )}

      {/* Login Button */}
      <button
        onClick={login}
        className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition duration-200"
      >
        Login
      </button>

    </div>
  </div>
  );
}
export default Login;
