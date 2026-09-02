import { motion, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, Skeleton } from "@/components/ui";
import { getApiErrorMessage, isConnectionProblem } from "@/lib/apiClient";
import { useActiveQuestion, useAnswerQuestion } from "@/queries/questions";
import { cn } from "@/utils/cn";
import { shuffle } from "@/utils/shuffle";

interface AnswerResult {
  isCorrect: boolean;
  pointsAwarded: number;
  explanation?: string;
}

function ResultCard({
  result,
  reduceMotion,
}: {
  result: AnswerResult;
  reduceMotion: boolean | null;
}) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, scale: 0.95 }}
      animate={{
        opacity: 1,
        scale: 1,
        boxShadow: reduceMotion
          ? undefined
          : result.isCorrect
            ? [
                "0 0 0 0 rgba(200,162,74,0)",
                "0 0 32px 6px rgba(200,162,74,0.5)",
                "0 0 0 0 rgba(200,162,74,0)",
              ]
            : undefined,
      }}
      transition={{ duration: 0.5 }}
      className={cn(
        "mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border p-6 text-center",
        result.isCorrect
          ? "border-success/30 bg-success/5"
          : "border-danger/30 bg-danger/5",
      )}
    >
      <svg viewBox="0 0 48 48" className="h-14 w-14">
        {result.isCorrect ? (
          <motion.path
            d="M10 25 20 35 38 13"
            fill="none"
            stroke="var(--c-success)"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduceMotion ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        ) : (
          <path
            d="M14 14 34 34M34 14 14 34"
            stroke="var(--c-danger)"
            strokeWidth={4}
            strokeLinecap="round"
          />
        )}
      </svg>
      <p
        className={cn(
          "font-display text-2xl",
          result.isCorrect ? "text-success" : "text-danger",
        )}
      >
        {t(result.isCorrect ? "weeklyQuestion.correct" : "weeklyQuestion.incorrect")}
      </p>
      {result.isCorrect && (
        <p className="text-sm text-ink-600">
          {t("weeklyQuestion.earnedPoints", { points: result.pointsAwarded })}
        </p>
      )}
      {result.explanation && <p className="text-sm text-ink-600">{result.explanation}</p>}
    </motion.div>
  );
}

export function WeeklyQuestion() {
  const { t } = useTranslation();
  const { data: question, isLoading } = useActiveQuestion();
  const answerQuestion = useAnswerQuestion();
  const reduceMotion = useReducedMotion();
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);

  // Whoever created the question tends to leave the correct answer wherever
  // they typed it (often the first option, out of habit) — shuffling display
  // order here means a student can never learn "the right answer is always
  // in this position" regardless of how it was entered. Grading only ever
  // compares by `key`, so display order has no effect on correctness.
  // Memoized on the question's id so it stays put while the student is
  // deciding, even if the underlying query silently refetches in the
  // background.
  const displayOptions = useMemo(
    () => (question ? shuffle(question.options) : []),
    [question],
  );

  async function onSubmit() {
    if (!question || !selected) return;
    try {
      const data = await answerQuestion.mutateAsync({
        questionId: question._id,
        selectedOptionKey: selected,
      });
      setResult({
        isCorrect: data.answer.isCorrect,
        pointsAwarded: data.answer.pointsAwarded,
        explanation: data.question.explanation,
      });
    } catch {
      // No error boundary catches a rejected mutateAsync here — without this,
      // a failed submit (e.g. answering the same question twice, or a
      // network hiccup) failed completely silently: the button just sat
      // there with no feedback at all. Surfaced below via
      // `answerQuestion.isError` instead.
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-md p-4 pb-24">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Checked before `!question`: answering invalidates the active-question query,
  // which then (correctly) resolves to null — but the result card must still show
  // regardless, or the student never sees whether they got it right.
  if (result) {
    return (
      <div className="p-4 pb-24">
        <ResultCard result={result} reduceMotion={reduceMotion} />
      </div>
    );
  }

  if (!question) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 p-8 pb-24 text-center">
        <p className="text-ink-600">{t("weeklyQuestion.noActive")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4 pb-24">
      <h1 className="font-display text-xl text-primary-900">
        {t("weeklyQuestion.title")}
      </h1>
      <motion.div
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col gap-4"
      >
        <p className="font-display text-2xl leading-relaxed text-ink-900">
          {question.questionText}
        </p>
        <div className="flex flex-col gap-2">
          {displayOptions.map((opt, i) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSelected(opt.key)}
              className={cn(
                "min-h-14 rounded-xl border-2 px-4 py-3 text-start text-base transition-colors",
                selected === opt.key
                  ? "border-primary-900 bg-primary-900/5 text-primary-900"
                  : "border-cream-200 bg-cream-50 text-ink-900 hover:border-cream-200/70",
              )}
            >
              {/* Labeled by display position (A, B, C, ...), not the option's
                  stored key — the stored key is only ever used for grading,
                  never shown, so a shuffled visual order never looks "out of
                  order" to the student. */}
              <span className="me-2 font-semibold">{String.fromCharCode(65 + i)}.</span>
              {opt.text}
            </button>
          ))}
        </div>
        <Button onClick={onSubmit} disabled={!selected || answerQuestion.isPending}>
          {t("weeklyQuestion.submit")}
        </Button>
        {!selected && (
          <p className="text-center text-xs text-ink-600">
            {t("weeklyQuestion.selectFirst")}
          </p>
        )}
        {answerQuestion.isError && (
          <p role="alert" className="text-center text-sm text-danger">
            {isConnectionProblem(answerQuestion.error)
              ? t("common.networkError")
              : getApiErrorMessage(answerQuestion.error, t("common.error"))}
          </p>
        )}
      </motion.div>
    </div>
  );
}
