import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import ManagerDashboard from "./pages/ManagerDashboard";
import AddEmployee from "./pages/AddEmployee";
import AssignTask from "./pages/AssignTask";
import MeetingFeedback from "./pages/MeetingFeedback";
import EmpLogin from "./components/EmpLogin";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import ManagerRegister from "./pages/ManagerRegister";
import EmployeeList from "./pages/EmployeeList";
import EmployeeRankingComparison from "./pages/EmployeeRankingComparison";
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/EmpLogin" element={<EmpLogin />} />
        <Route path="/dashboard" element={<ManagerDashboard />} />
        <Route path="/add-employee" element={<AddEmployee />} />
        <Route path="/assign-task" element={<AssignTask />} />
        <Route path="/meeting-feedback" element={<MeetingFeedback />} />
        <Route path="/EmployeeDashboard" element={<EmployeeDashboard />} />     
        <Route path="/register-manager" element={<ManagerRegister />} />
        <Route path="/view-employees" element={<EmployeeList />} />
        <Route path="/employee-rankings" element={<EmployeeRankingComparison />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
