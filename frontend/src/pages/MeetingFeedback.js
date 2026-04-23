import React,{useState,useEffect} from "react";
import API from "../services/api";

function MeetingFeedback() {
  const today = new Date().toISOString().split("T")[0];
  const [employees, setEmployees] = useState([]);
  const [feedbackData, setFeedbackData] = useState({
    employeeId: "", 
    date: today,
    comments: "",
    rating: 5,
    category: "Technical",
  });
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!feedbackData.employeeId || !feedbackData.comments) {
      alert("Please fill all fields.");
      return;
    }
    try {
      await API.post("/feedback", feedbackData,{
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      setFeedbackData({
        employeeId: "",
        date: today,
        comments: "",
        rating: 5,
        category: "Technical",
      });
      alert("Feedback submitted successfully!");
    } catch (error) {
      console.error("Error submitting feedback:", error.response?.data || error.message);
      alert("Error submitting feedback. Please try again.");
    }
  };
  useEffect(() => {
    fetchEmployees();
  }, []);
  const fetchEmployees = async () => {
    try {
      const response = await API.get("/employees",{
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      setEmployees(response.data);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  return (
   <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
  <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">

    <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
      Meeting Feedback
    </h2>

    {/* Employee Name */}
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-600 mb-1">
        Employee Name
      </label>
      <select
        value={feedbackData.employeeId}
        onChange={(e) =>
          setFeedbackData({ ...feedbackData, employeeId: e.target.value })
        }
        className="w-full px-4 py-2 border bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="">Select Employee</option>
        {employees.map((emp) => (
          <option key={emp._id} value={emp._id}>
            {emp.name}
          </option>
        ))}
      </select>

    </div>

    {/* Meeting Date */}
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-600 mb-1">
        Meeting Date
      </label>
      <input
        type="date"
        value={feedbackData.date}
        onChange={(e) =>
          setFeedbackData({
            ...feedbackData,
            date: e.target.value,
          })
        }
        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>

    {/* Category */}
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-600 mb-1">
        Feedback Category
      </label>
      <select
        onChange={(e) =>
          setFeedbackData({
            ...feedbackData,
            category: e.target.value,
          })
        }
        className="w-full px-4 py-2 border bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="Technical">Technical</option>
        <option value="Communication">Communication</option>
        <option value="Behavior">Behavior</option>
      </select>
    </div>

    {/* Comments */}
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-600 mb-1">
        Feedback Comments
      </label>
      <textarea
        rows="4"
        placeholder="Write feedback comments..."
        value={feedbackData.comments}
        onChange={(e) =>
          setFeedbackData({
            ...feedbackData,
            comments: e.target.value,
          })
        }
        className="w-full px-4 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
      ></textarea>
    </div>

    {/* Rating */}
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-600 mb-1">
        Rating
      </label>
      <select
        value={feedbackData.rating}
        onChange={(e) =>
          setFeedbackData({
            ...feedbackData,
            rating: Number(e.target.value),
          })
        }
        className="w-full px-4 py-2 border bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="5">5 - Excellent</option>
        <option value="4">4 - Good</option>
        <option value="3">3 - Average</option>
        <option value="2">2 - Needs Improvement</option>
        <option value="1">1 - Poor</option>
      </select>
    </div>

    {/* Submit Button */}
    <button
      type="button"
      onClick={handleSubmit}
      className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition duration-200"
    >
      Submit Feedback
    </button>

  </div>
</div>

  );
}

export default MeetingFeedback;
