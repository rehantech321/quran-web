import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CreateQuestionInput } from "@halaqat/shared";

import { apiClient, isConnectionProblem } from "@/lib/apiClient";
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
    // A weak mobile connection can drop the request, or get intercepted
    // before it ever reaches our server (e.g. a carrier-injected error page)
    // — retry that case a couple of times, since the payload is tiny and
    // worth one more try. A real rejection from our own API (already
    // answered, wrong circle, etc.) always comes back with our API's own
    // JSON error shape and must not be retried.
    retry: (failureCount, error) => isConnectionProblem(error) && failureCount < 2,
    retryDelay: 1000,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", "questions", "active"] });
      // A correct answer awards points immediately server-side — the
      // dashboard's cached totals (`useMyProfile`) need telling too, or the
      // student sees "you earned 20 points" and then a stale 0 on their own
      // profile until something else happens to refetch it.
      queryClient.invalidateQueries({ queryKey: ["student", "me"] });
    },
  });
}
