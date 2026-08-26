import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CreateQuestionInput } from "@halaqat/shared";

import { apiClient } from "@/lib/apiClient";
import type { QuestionAnswer, WeeklyQuestion } from "@/types/api";

export function useQuestions(circleId: string | undefined) {
  return useQuery({
    queryKey: ["questions", circleId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: WeeklyQuestion[] }>("/questions", {
        params: { circleId },
      });
      return res.data.data;
    },
    enabled: Boolean(circleId),
  });
}

export function useCreateQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateQuestionInput) => {
      const res = await apiClient.post<{ data: WeeklyQuestion }>("/questions", input);
      return res.data.data;
    },
    onSuccess: (question) =>
      queryClient.invalidateQueries({ queryKey: ["questions", question.circleId] }),
  });
}

export function usePublishQuestion(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (questionId: string) => {
      const res = await apiClient.post<{ data: WeeklyQuestion }>(
        `/questions/${questionId}/publish`,
      );
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["questions", circleId] }),
  });
}

// --- student-scoped ---

export function useActiveQuestion() {
  return useQuery({
    queryKey: ["student", "questions", "active"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: WeeklyQuestion | null }>(
        "/questions/active",
      );
      return res.data.data;
    },
  });
}

export function useAnswerQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      questionId,
      selectedOptionKey,
    }: {
      questionId: string;
      selectedOptionKey: string;
    }) => {
      const res = await apiClient.post<{
        data: { answer: QuestionAnswer; question: WeeklyQuestion };
      }>(`/questions/${questionId}/answer`, { selectedOptionKey });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", "questions", "active"] });
    },
  });
}
