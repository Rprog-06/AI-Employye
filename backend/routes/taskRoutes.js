const express = require("express");
const Task = require("../models/Task");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const Employee = require("../models/Employee");
const axios = require("axios");
const router = express.Router();

const canAccessJira = () =>
  process.env.JIRA_DOMAIN &&
  process.env.JIRA_EMAIL &&
  process.env.JIRA_API_TOKEN;

const jiraRequestConfig = () => ({
  auth: {
    username: process.env.JIRA_EMAIL,
    password: process.env.JIRA_API_TOKEN,
  },
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

const syncTaskStatusesFromJira = async (taskDocs) => {
  if (!canAccessJira()) {
    return taskDocs;
  }

  await Promise.all(
    taskDocs.map(async (taskDoc) => {
      if (!taskDoc?.jiraIssueKey) {
        return;
      }

      try {
        const jiraResponse = await axios.get(
          `https://${process.env.JIRA_DOMAIN}/rest/api/3/issue/${taskDoc.jiraIssueKey}?fields=status`,
          jiraRequestConfig()
        );
        const jiraStatus = jiraResponse?.data?.fields?.status?.name;
        if (jiraStatus && taskDoc.status !== jiraStatus) {
          taskDoc.status = jiraStatus;
          await taskDoc.save();
        }
      } catch (jiraError) {
        console.error(
          `Jira status sync failed for ${taskDoc.jiraIssueKey}:`,
          jiraError.response?.data || jiraError.message
        );
      }
    })
  );

  return taskDocs;
};

// Assign Task
router.post("/",authMiddleware,roleMiddleware(["manager"]), async (req, res) => {
  try{
    const { title, description, priority, employeeId, date, storyPoints } = req.body;
    const employee= await Employee.findById(employeeId);
    if(!employee){
      return res.status(404).json({message:"Employee not found"});
    }
    let jiraIssueKey = null;
    let jiraAssigned = false;
    let jiraAssignmentError = null;
    const canCreateJiraIssue =
      canAccessJira() &&
      process.env.JIRA_PROJECT_KEY;
    const jiraFields = {
      project: { key: process.env.JIRA_PROJECT_KEY },
      summary: title,
      description: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: description?.trim()
                  ? description.trim()
                  : `Task assigned to ${employee.name}`,
              },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: `Assigned to ${employee.name} from CodeScore 360`,
              },
            ],
          },
        ],
      },
      issuetype: { name: "Task" },
      priority: { name: priority || "Medium" },
    };

    if (date) {
      jiraFields.duedate = new Date(date).toISOString().split("T")[0];
    }

    const parsedStoryPoints = Number(storyPoints);
    if (
      process.env.JIRA_STORY_POINTS_FIELD &&
      Number.isFinite(parsedStoryPoints) &&
      parsedStoryPoints > 0
    ) {
      jiraFields[process.env.JIRA_STORY_POINTS_FIELD] = parsedStoryPoints;
    }

    if (canCreateJiraIssue) {
      try {
        const jiraResponse = await axios.post(
          `https://${process.env.JIRA_DOMAIN}/rest/api/3/issue`,
          {
            fields: jiraFields,
          },
          {
            ...jiraRequestConfig(),
          }
        );
        jiraIssueKey = jiraResponse?.data?.key || null;

        // Assigning via dedicated endpoint is more reliable than create payload assignee.
        if (jiraIssueKey && employee.jiraAccountId) {
          try {
            await axios.put(
              `https://${process.env.JIRA_DOMAIN}/rest/api/3/issue/${jiraIssueKey}/assignee`,
              { accountId: employee.jiraAccountId },
              {
                ...jiraRequestConfig(),
              }
            );
            jiraAssigned = true;
          } catch (assignError) {
            jiraAssignmentError = assignError.response?.data || assignError.message;
            console.error("Jira assign failed:", jiraAssignmentError);
          }
        }
      } catch (jiraError) {
        console.error("Jira sync failed:", jiraError.response?.data || jiraError.message);
      }
    }

    const task = new Task({
      title,
      description,
      priority,
      storyPoints: Number.isFinite(parsedStoryPoints) ? parsedStoryPoints : 0,
      assignedTo: employeeId,
      assignedBy: req.user.userId || req.user.id,
      status: "Assigned",
      assignedDate: date ? new Date(date) : new Date(),
      dueDate: date ? new Date(date) : undefined,
      jiraIssueKey,
    });
    await task.save();
    res.json({
      message: jiraIssueKey
        ? "Task assigned successfully and synced to Jira"
        : "Task assigned successfully",
      issueKey: jiraIssueKey,
      jiraAssigned,
      jiraAssignmentError,
      task,
    });
  } catch (error) {
    console.error("Task assignment error:", error.response?.data || error.message);
    return res.status(500).json({
      message: "Failed to assign task",
      error: error.response?.data || error.message
    });
  }
 
});
router.get("/all", authMiddleware, roleMiddleware(["manager"]), async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate("assignedTo", "name")
      .populate("assignedBy", "name");
    await syncTaskStatusesFromJira(tasks);
    res.json(tasks);
  } catch (error) {
    console.error("Fetch manager tasks error:", error.response?.data || error.message);
    res.status(500).json({ message: "Failed to fetch tasks" });
  }
});
// Get Tasks for an Employee
router.get("/",authMiddleware,roleMiddleware(["employee"]), async (req, res) => {
  try{
  const tasks = await Task.find({ assignedTo: req.user.id });
  await syncTaskStatusesFromJira(tasks);
  res.json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
