import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CreateTaskInput, SubmissionStatus } from "@halaqat/shared";

import { apiClient } from "@/lib/apiClient";
import type { TaskSubmission, WeeklyTask } from "@/types/api";

export function useTasks(circleId: string | undefined) {
  return useQuery({
    queryKey: ["tasks", circleId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: WeeklyTask[] }>("/tasks", {
        params: { circleId },
      });
      return res.data.data;
    },
    enabled: Boolean(circleId),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const res = await apiClient.post<{ data: WeeklyTask }>("/tasks", input);
      return res.data.data;
    },
    onSuccess: (task) =>
      queryClient.invalidateQueries({ queryKey: ["tasks", task.circleId] }),
  });
}

export interface PendingApproval {
  submission: TaskSubmission;
  task: WeeklyTask;
}

export function usePendingApprovals(circleId?: string) {
  return useQuery({
    queryKey: ["tasks", "pending-approvals", circleId ?? "all"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: PendingApproval[] }>(
        "/tasks/pending-approvals",
        {
          params: circleId ? { circleId } : undefined,
        },
      );
      return res.data.data;
    },
  });
}

export function useApproveSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      submissionId,
    }: {
      taskId: string;
      submissionId: string;
    }) => {
      const res = await apiClient.post<{ data: TaskSubmission }>(
        `/tasks/${taskId}/submissions/${submissionId}/approve`,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", "pending-approvals"] });
    },
  });
}

export function useRejectSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      submissionId,
      rejectionReason,
    }: {
      taskId: string;
      submissionId: string;
      rejectionReason: string;
    }) => {
      const res = await apiClient.post<{ data: TaskSubmission }>(
        `/tasks/${taskId}/submissions/${submissionId}/reject`,
        { rejectionReason },
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", "pending-approvals"] });
    },
  });
}

// --- student-scoped ---

export interface MyTasksResponse {
  active: { task: WeeklyTask; submission: TaskSubmission | null }[];
  completed: { task: WeeklyTask; submission: TaskSubmission | null }[];
}

export function useMyTasks() {
  return useQuery({
    queryKey: ["student", "tasks", "mine"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: MyTasksResponse }>("/tasks/mine");
      return res.data.data;
    },
  });
}

export function useUpdateMySubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      status,
      studentNote,
    }: {
      taskId: string;
      status: SubmissionStatus;
      studentNote?: string;
    }) => {
      const res = await apiClient.patch<{ data: TaskSubmission }>(
        `/tasks/${taskId}/submission`,
        {
          status,
          studentNote,
        },
      );
      return res.data.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["student", "tasks", "mine"] }),
  });
}
