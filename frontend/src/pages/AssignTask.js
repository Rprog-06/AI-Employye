import React,{useState,useEffect} from "react";
import API from "../services/api";

function AssignTask() {
  const [employees,setemployees]=useState([]);
  const [task,settask]=useState({
   
    title:"",
    description:"",
    date:"",
    priority:"High",
    storyPoints:"",
    employeeId:""
  })
  useEffect(()=>{
    //fetch employees
    const fetchemployees=async()=>{
      try{
        const response=await API.get("/employees",{
          headers:{
            Authorization:`Bearer ${localStorage.getItem("token")}`
          }
        });
        setemployees(response.data);
      }catch(error){
        console.error("Error fetching employees:",error);
      }
    };
    fetchemployees();
  },[]);

   
  const handleSubmit=async(e)=>{
    e.preventDefault();
    if(!task.employeeId || !task.title || !task.date){  
      alert("Please fill all fields.");
      return;
    }
    try{
      const response = await API.post("/tasks",task,{
        headers:{
          Authorization:`Bearer ${localStorage.getItem("token")}`
        }
      });
      const { message, issueKey, jiraAssigned, jiraAssignmentError } = response.data;
      if (issueKey && !jiraAssigned) {
        alert(
          `${message}. Jira issue ${issueKey} was created, but assignee update failed: ${JSON.stringify(
            jiraAssignmentError || "Unknown error"
          )}`
        );
      } else if (issueKey && jiraAssigned) {
        alert(`${message}. Jira issue: ${issueKey}`);
      } else {
        alert(message || "Task assigned successfully!");
      }
      settask({
        
        title:"",
        description:"",
        date:"",
        priority:"High",
        storyPoints:"",
        employeeId:""
      })
    } catch (error) {
      console.error("Error assigning task:", error);
      alert("Error assigning task. Please try again.");

    }
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
  <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">

    <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
      Assign Task
    </h2>

    {/* Employee Name */}
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-600 mb-1">
        Employee Name
      </label>
      <select
  value={task.employeeId}
  onChange={(e) => settask({ ...task, employeeId: e.target.value })}
>
  <option value="">Select Employee</option>
  {employees.map(emp => (
    <option key={emp._id} value={emp._id}>
      {emp.name}
    </option>
  ))}
</select>
    </div>

    {/* Task Title */}
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-600 mb-1">
        Task Title
      </label>
      <input
        type="text"
        value={task.title}
        placeholder="Enter task title"
        onChange={(e) =>
          settask({ ...task, title: e.target.value })
        }
        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>

    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-600 mb-1">
        Description
      </label>
      <textarea
        value={task.description}
        placeholder="Enter task details for Jira"
        onChange={(e) =>
          settask({ ...task, description: e.target.value })
        }
        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-24"
      />
    </div>

    {/* Due Date */}
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-600 mb-1">
        Due Date
      </label>
      <input
        type="date"
        value={task.date}
        onChange={(e) =>
          settask({ ...task, date: e.target.value })
        }
        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>

    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-600 mb-1">
        Story Points
      </label>
      <input
        type="number"
        min="0"
        step="1"
        value={task.storyPoints}
        placeholder="Enter story points"
        onChange={(e) =>
          settask({ ...task, storyPoints: e.target.value })
        }
        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>

    {/* Priority */}
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-600 mb-1">
        Priority
      </label>
      <select
        value={task.priority}
        onChange={(e) =>
          settask({ ...task, priority: e.target.value })
        }
        className="w-full px-4 py-2 border rounded-lg bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="High">High</option>
        <option value="Medium">Medium</option>
        <option value="Low">Low</option>
      </select>
    </div>

    {/* Submit Button */}
    <button
      onClick={handleSubmit}
      className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition duration-200"
    >
      Assign Task
    </button>

  </div>
</div>

  )
}

export default AssignTask;
