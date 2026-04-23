
# CodeScore-360
Our final year Project
=======
# AI-Driven Employee Management System

A modern web application built with the MERN stack (MongoDB, Express.js, React, Node.js) for managing employees, tasks, and performance metrics with AI-powered insights.

## Features

- **Role-based Authentication** (Employee, Manager, Admin)
- **Interactive Dashboard** with data visualization
- **Task Management** for creating and tracking tasks
- **AI-Powered Insights** with dynamic recommendations
- **Responsive Design** that works on all devices
- **Modern UI** built with Tailwind CSS

## Prerequisites

- Node.js (v14 or later)
- npm or yarn
- MongoDB (local or Atlas)

## Getting Started

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the backend directory with the following variables:
   ```
   PORT=5000
   MONGODB_URI=mongodb+srv://vahorarizwan09:Rizwan%4025@cluster0.tjegdat.mongodb.net/employee?retryWrites=true&w=majority&appName=Cluster0
   JWT_SECRET=your_jwt_secret_key
   ```

4. Start the backend server:
   ```bash
   npm start
   ```
   The backend will be available at `http://localhost:5000`

### Frontend Setup

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```
   The frontend will be available at `http://localhost:3000`

## Demo Accounts

- **Employee**
  - Email: employee@example.com
  - Password: welcome123

- **Manager**
  - Email: vahorarizwan09@gmail.com
  - Password: Rizwan@25

- **Admin**
  - Email: admin@example.com
  - Password: admin123

## Project Structure

```
ai-employee-management/
├── backend/               # Backend server (Node.js/Express)
│   ├── server.js          # Main server file
│   └── package.json       # Backend dependencies
└── frontend/              # Frontend React application
    ├── public/            # Static files
    ├── src/
    │   ├── components/    # Reusable UI components
    │   ├── contexts/      # React contexts
    │   ├── pages/         # Page components
    │   ├── App.js         # Main App component
    │   └── index.js       # Entry point
    └── package.json       # Frontend dependencies
```

## Available Scripts

### Backend

- `npm start` - Start the backend server
- `npm run dev` - Start the server in development mode with nodemon

### Frontend

- `npm start` - Start the development server
- `npm test` - Run tests
- `npm run build` - Build for production

## Technologies Used

- **Frontend**: React, React Router, Chart.js, Tailwind CSS
- **Backend**: Node.js, Express.js, MongoDB, Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **UI Components**: Heroicons, Headless UI

## License

This project is licensed under the MIT License.
>>>>>>> feature
