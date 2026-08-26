import { createBrowserRouter } from "react-router-dom";

import { StaffProtectedRoute, StudentProtectedRoute } from "@/components/ProtectedRoute";
import { StaffLayout } from "@/layouts/StaffLayout";
import { StudentLayout } from "@/layouts/StudentLayout";
import { Home } from "@/pages/Home";
import { KitchenSink } from "@/pages/dev/KitchenSink";
import { ApprovalsQueue } from "@/pages/staff/ApprovalsQueue";
import { CircleDetail } from "@/pages/staff/circle/CircleDetail";
import { CirclesList } from "@/pages/staff/CirclesList";
import { Login } from "@/pages/staff/Login";
import { Reports } from "@/pages/staff/Reports";
import { ScanBarcode } from "@/pages/staff/ScanBarcode";
import { ScanCirclePicker } from "@/pages/staff/ScanCirclePicker";
import { Settings } from "@/pages/staff/Settings";
import { StudentForm } from "@/pages/staff/StudentForm";
import { MyTasks } from "@/pages/student/MyTasks";
import { PointsHistory } from "@/pages/student/PointsHistory";
import { Profile } from "@/pages/student/Profile";
import { StudentAccessResolver } from "@/pages/student/StudentAccessResolver";
import { StudentDashboard } from "@/pages/student/StudentDashboard";
import { WeeklyQuestion } from "@/pages/student/WeeklyQuestion";

export const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/login", element: <Login /> },
  { path: "/dev/kitchen-sink", element: <KitchenSink /> },
  { path: "/student/:slug", element: <StudentAccessResolver /> },
  {
    path: "/app",
    element: (
      <StaffProtectedRoute>
        <StaffLayout />
      </StaffProtectedRoute>
    ),
    children: [
      { path: "circles", element: <CirclesList /> },
      { path: "circles/:circleId", element: <CircleDetail /> },
      { path: "circles/:circleId/scan", element: <ScanBarcode /> },
      { path: "scan", element: <ScanCirclePicker /> },
      { path: "students/new", element: <StudentForm /> },
      { path: "students/:studentId", element: <StudentForm /> },
      { path: "approvals", element: <ApprovalsQueue /> },
      { path: "reports", element: <Reports /> },
      { path: "settings", element: <Settings /> },
    ],
  },
  {
    path: "/student",
    element: (
      <StudentProtectedRoute>
        <StudentLayout />
      </StudentProtectedRoute>
    ),
    children: [
      { index: true, element: <StudentDashboard /> },
      { path: "points-history", element: <PointsHistory /> },
      { path: "question", element: <WeeklyQuestion /> },
      { path: "tasks", element: <MyTasks /> },
      { path: "profile", element: <Profile /> },
    ],
  },
]);
