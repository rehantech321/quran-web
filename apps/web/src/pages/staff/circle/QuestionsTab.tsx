import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, Card, Input, SkeletonText, StatusChip } from "@/components/ui";
import { getApiErrorMessage } from "@/lib/apiClient";
import { useCreateQuestion, usePublishQuestion, useQuestions } from "@/queries/questions";

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

function currentWeekOf(): string {
  const now = new Date();
  const day = now.getDay();
  const saturday = new Date(now);
  saturday.setDate(now.getDate() - ((day + 1) % 7));
  return saturday.toISOString().slice(0, 10);
}

export function QuestionsTab({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const { data: questions, isLoading } = useQuestions(circleId);
  const createQuestion = useCreateQuestion();
  const publishQuestion = usePublishQuestion(circleId);

  const [questionText, setQuestionText] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [points, setPoints] = useState<number | "">("");
  const [explanation, setExplanation] = useState("");

  function updateOption(i: number, value: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  }

  function addOption() {
    if (options.length < 6) setOptions((prev) => [...prev, ""]);
  }

  async function onSubmit(e: React.FormEvent, publish: boolean) {
    e.preventDefault();
    const filledOptions = options
      .map((text, i) => ({ key: OPTION_KEYS[i]!, text }))
      .filter((o) => o.text.trim().length > 0);
    if (filledOptions.length < 2 || !questionText.trim()) return;

    await createQuestion.mutateAsync({
      circleId,
      weekOf: new Date(currentWeekOf()),
      questionText,
      options: filledOptions,
      correctOptionKey: OPTION_KEYS[correctIndex]!,
      points: points === "" ? undefined : Number(points),
      explanation: explanation || undefined,
      isPublished: publish,
    });
    setQuestionText("");
    setOptions(["", ""]);
    setCorrectIndex(0);
    setPoints("");
    setExplanation("");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink-900">
          {t("questions.weeklyQuestion")}
        </h2>
        <form className="flex flex-col gap-3">
          <Input
            label={t("questions.questionText")}
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
          />
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-ink-900">{t("questions.options")}</p>
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct-option"
                  checked={correctIndex === i}
                  onChange={() => setCorrectIndex(i)}
                  aria-label={t("questions.correctOption")}
                  className="h-4 w-4 accent-gold-600"
                />
                <Input
                  className="flex-1"
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`${t("questions.options")} ${OPTION_KEYS[i]}`}
                />
              </div>
            ))}
            {options.length < 6 && (
              <button
                type="button"
                onClick={addOption}
                className="self-start text-xs text-primary-700 hover:underline"
              >
                + {t("questions.addOption")}
              </button>
            )}
          </div>
          <Input
            label={`${t("questions.points")} (${t("common.optional")})`}
            type="number"
            value={points}
            onChange={(e) =>
              setPoints(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
          <Input
            label={`${t("questions.explanation")} (${t("common.optional")})`}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
          />
          {createQuestion.isError && (
            <p role="alert" className="text-sm text-danger">
              {getApiErrorMessage(createQuestion.error, t("common.error"))}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={(e) => onSubmit(e, false)}
              disabled={createQuestion.isPending}
            >
              {t("questions.createQuestion")}
            </Button>
            <Button
              onClick={(e) => onSubmit(e, true)}
              disabled={createQuestion.isPending}
            >
              {t("questions.publish")}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="hidden overflow-hidden lg:block">
        <div className="border-b-2 border-gold-500 bg-primary-900 px-4 py-3">
          <p className="text-sm text-cream-100">{t("questions.preview")}</p>
        </div>
        <div className="p-4">
          <p className="mb-3 font-display text-lg text-ink-900">{questionText || "…"}</p>
          <div className="flex flex-col gap-2">
            {options
              .filter((o) => o.trim())
              .map((o, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-cream-200 bg-cream-50 p-3 text-sm"
                >
                  {OPTION_KEYS[i]}. {o}
                </div>
              ))}
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-2 lg:col-span-2">
        {isLoading ? (
          <SkeletonText lines={3} />
        ) : (
          questions?.map((q) => (
            <Card key={q._id} className="flex items-center justify-between p-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink-900">{q.questionText}</p>
                <p className="text-xs text-ink-600">
                  {new Date(q.weekOf).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusChip
                  tone={q.isPublished ? "success" : "neutral"}
                  label={t(q.isPublished ? "questions.published" : "questions.draft")}
                />
                {!q.isPublished && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => publishQuestion.mutate(q._id)}
                  >
                    {t("questions.publish")}
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
