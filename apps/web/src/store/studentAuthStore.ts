import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface StudentSession {
  id: string;
  organizationId: string;
  circleId: string;
  fullName: string;
  photoUrl?: string;
  totalPoints: number;
}

interface StudentAuthState {
  token: string | null;
  student: StudentSession | null;
  setStudentAuth: (token: string, student: StudentSession) => void;
  clearStudentAuth: () => void;
}

/** The private-link session token (90 days) — persisted so re-opening the bookmarked link keeps the student signed in. */
export const useStudentAuthStore = create<StudentAuthState>()(
  persist(
    (set) => ({
      token: null,
      student: null,
      setStudentAuth: (token, student) => set({ token, student }),
      clearStudentAuth: () => set({ token: null, student: null }),
    }),
    { name: "halaqat_student_auth" },
  ),
);
