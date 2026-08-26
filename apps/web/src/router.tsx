import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter } from "react-router-dom";

import { StaffProtectedRoute, StudentProtectedRoute } from "@/components/ProtectedRoute";
import { Skeleton } from "@/components/ui";
import { StaffLayout } from "@/layouts/StaffLayout";
import { StudentLayout } from "@/layouts/StudentLayout";
import { Home } from "@/pages/Home";
import { NotFound } from "@/pages/NotFound";

// Route-level code splitting: each page (and its own dependencies — react-hook-form,
// recharts, html5-qrcode, pdfkit-adjacent report helpers, ...) only downloads when
// that route is actually visited, instead of one ~1.4MB bundle up front. Matters for
// the Lighthouse performance budget (SPEC.md §11) on the mobile connections
// supervisors actually use standing in the mosque.
const KitchenSink = lazy(() =>
  import("@/pages/dev/KitchenSink").then((m) => ({ default: m.KitchenSink })),
);
const Login = lazy(() =>
  import("@/pages/staff/Login").then((m) => ({ default: m.Login })),
);
const CirclesList = lazy(() =>
  import("@/pages/staff/CirclesList").then((m) => ({ default: m.CirclesList })),
);
const CircleDetail = lazy(() =>
  import("@/pages/staff/circle/CircleDetail").then((m) => ({ default: m.CircleDetail })),
);
const ScanBarcode = lazy(() =>
  import("@/pages/staff/ScanBarcode").then((m) => ({ default: m.ScanBarcode })),
);
const ScanCirclePicker = lazy(() =>
  import("@/pages/staff/ScanCirclePicker").then((m) => ({ default: m.ScanCirclePicker })),
);
const StudentForm = lazy(() =>
  import("@/pages/staff/StudentForm").then((m) => ({ default: m.StudentForm })),
);
const ApprovalsQueue = lazy(() =>
  import("@/pages/staff/ApprovalsQueue").then((m) => ({ default: m.ApprovalsQueue })),
);
const Reports = lazy(() =>
  import("@/pages/staff/Reports").then((m) => ({ default: m.Reports })),
);
const Settings = lazy(() =>
  import("@/pages/staff/Settings").then((m) => ({ default: m.Settings })),
);
const PrintStudentCards = lazy(() =>
  import("@/pages/staff/PrintStudentCards").then((m) => ({
    default: m.PrintStudentCards,
  })),
);
const StudentAccessResolver = lazy(() =>
  import("@/pages/student/StudentAccessResolver").then((m) => ({
    default: m.StudentAccessResolver,
  })),
);
const StudentDashboard = lazy(() =>
  import("@/pages/student/StudentDashboard").then((m) => ({
    default: m.StudentDashboard,
  })),
);
const PointsHistory = lazy(() =>
  import("@/pages/student/PointsHistory").then((m) => ({ default: m.PointsHistory })),
);
const WeeklyQuestion = lazy(() =>
  import("@/pages/student/WeeklyQuestion").then((m) => ({ default: m.WeeklyQuestion })),
);
const MyTasks = lazy(() =>
  import("@/pages/student/MyTasks").then((m) => ({ default: m.MyTasks })),
);
const Profile = lazy(() =>
  import("@/pages/student/Profile").then((m) => ({ default: m.Profile })),
);

function withSuspense(node: ReactNode) {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <Skeleton className="h-40 w-full" />
        </div>
      }
    >
      {node}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/login", element: withSuspense(<Login />) },
  { path: "/dev/kitchen-sink", element: withSuspense(<KitchenSink />) },
  { path: "/student/:slug", element: withSuspense(<StudentAccessResolver />) },
  {
    path: "/app/circles/:circleId/print",
    element: (
      <StaffProtectedRoute>{withSuspense(<PrintStudentCards />)}</StaffProtectedRoute>
    ),
  },
  {
    path: "/app",
    element: (
      <StaffProtectedRoute>
        <StaffLayout />
      </StaffProtectedRoute>
    ),
    children: [
      { path: "circles", element: withSuspense(<CirclesList />) },
      { path: "circles/:circleId", element: withSuspense(<CircleDetail />) },
      { path: "circles/:circleId/scan", element: withSuspense(<ScanBarcode />) },
      { path: "scan", element: withSuspense(<ScanCirclePicker />) },
      { path: "students/new", element: withSuspense(<StudentForm />) },
      { path: "students/:studentId", element: withSuspense(<StudentForm />) },
      { path: "approvals", element: withSuspense(<ApprovalsQueue />) },
      { path: "reports", element: withSuspense(<Reports />) },
      { path: "settings", element: withSuspense(<Settings />) },
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
      { index: true, element: withSuspense(<StudentDashboard />) },
      { path: "points-history", element: withSuspense(<PointsHistory />) },
      { path: "question", element: withSuspense(<WeeklyQuestion />) },
      { path: "tasks", element: withSuspense(<MyTasks />) },
      { path: "profile", element: withSuspense(<Profile />) },
    ],
  },
  { path: "*", element: <NotFound /> },
]);
