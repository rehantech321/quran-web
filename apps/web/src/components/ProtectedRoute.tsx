import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuthStore } from "@/store/authStore";
import { useStudentAuthStore } from "@/store/studentAuthStore";

export function StaffProtectedRoute({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (!accessToken) return <Navigate to="/login" replace />;
  return children;
}

export function StudentProtectedRoute({ children }: { children: ReactNode }) {
  const token = useStudentAuthStore((s) => s.token);
  if (!token) return <Navigate to="/" replace />;
  return children;
}
