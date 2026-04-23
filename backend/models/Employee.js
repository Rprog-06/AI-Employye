const mongoose = require("mongoose");

const EmployeeSchema = new mongoose.Schema({
  name: String,
  email: String,
  average: {
    type: Number,
    default: 0,
  },
  count: {
    type: Number,
    default: 0,
  },
  scores: {
    type: [Number],
    default: [],
  },
  totalScore: {
    type: Number,
    default: 0,
  },
  jiraAccountId: {
    type: String,
    default: null,
  },
  jiraDisplayName: {
    type: String,
    default: null,
  },
   designation:{
    type:String,
    required:true
  },
  role:{ type:String , enum: ['admin', 'manager', 'employee'],
    required:true
   },
 
  joinedDate: { type: Date, default: Date.now },
  password:String,
  createdBy:{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee"
  }
  
});

module.exports = mongoose.model("Employee", EmployeeSchema);
