import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, Card, EmptyState, Input, Select, SkeletonText } from "@/components/ui";
import { getApiErrorMessage } from "@/lib/apiClient";
import { useCreateGrade, useGrades } from "@/queries/grades";
import { useStudentsByCircle } from "@/queries/students";
import type { CircleGrade } from "@/types/api";

/**
 * Plain local "YYYY-MM-DD" for the date input's default value. Deliberately
 * avoids `.toISOString()` — converting a local midnight `Date` to an ISO
 * string shifts it to UTC, which rolls the calendar day backward for any
 * positive UTC offset (e.g. Asia/Riyadh, UTC+3) and silently defaulted the
 * picker to the wrong day.
 */
function todayLocal(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function GradesTab({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const { data: students } = useStudentsByCircle(circleId);
  const { data: grades, isLoading } = useGrades(circleId);
  const createGrade = useCreateGrade();

  const [studentId, setStudentId] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [grade, setGrade] = useState<number | "">("");
  const [points, setPoints] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const studentById = new Map((students ?? []).map((s) => [s._id, s.fullName]));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!studentId || grade === "") return;

    // A cleared/invalid native date input yields "" here, which `new Date()`
    // turns into an Invalid Date — guard it explicitly rather than letting
    // `.toISOString()` throw synchronously and silently drop the submission
    // (the surrounding form has no error boundary, so an uncaught throw here
    // previously meant the "Save grade" button just... did nothing).
    const dateValue = new Date(date);
    if (Number.isNaN(dateValue.getTime())) {
      setFormError(t("grades.invalidWeek"));
      return;
    }

    try {
      await createGrade.mutateAsync({
        studentId,
        circleId,
        weekOf: dateValue.toISOString(),
        grade: Number(grade),
        points: points === "" ? undefined : Number(points),
        notes: notes || undefined,
      });
      setStudentId("");
      setDate(todayLocal());
      setGrade("");
      setPoints("");
      setNotes("");
    } catch {
      // surfaced below via createGrade.isError
    }
  }

  // Grouped by student (most recently graded student first) rather than one
  // flat list — with grades no longer pinned to one-per-week, a supervisor
  // reviewing a student's progress needs their history together, not
  // interleaved with everyone else's.
  const groups: { studentId: string; fullName: string; entries: CircleGrade[] }[] = [];
  if (grades) {
    const byStudent = new Map<string, CircleGrade[]>();
    for (const g of grades) {
      const list = byStudent.get(g.studentId) ?? [];
      list.push(g);
      byStudent.set(g.studentId, list);
    }
    for (const [sid, entries] of byStudent) {
      groups.push({
        studentId: sid,
        fullName: studentById.get(sid) ?? entries[0]!.studentId,
        entries,
      });
    }
    groups.sort((a, b) => b.entries[0]!.weekOf.localeCompare(a.entries[0]!.weekOf));
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink-900">
          {t("grades.addGrade")}
        </h2>
        <form className="flex flex-col gap-3" onSubmit={onSubmit}>
          <Select
            label={t("grades.selectStudent")}
            hint={t("grades.selectStudentHint")}
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            required
          >
            <option value="">—</option>
            {students?.map((s) => (
              <option key={s._id} value={s._id}>
                {s.fullName}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("grades.grade")}
              type="number"
              min={0}
              max={100}
              value={grade}
              onChange={(e) =>
                setGrade(e.target.value === "" ? "" : Number(e.target.value))
              }
              required
              className="text-center text-lg font-semibold"
            />
            <Input
              label={`${t("grades.date")} (${t("common.optional")})`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <Input
            label={`${t("grades.points")} (${t("common.optional")})`}
            type="number"
            value={points}
            onChange={(e) =>
              setPoints(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
          <Input
            label={`${t("grades.notes")} (${t("common.optional")})`}
            placeholder={t("grades.notesPlaceholder")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          {(formError || createGrade.isError) && (
            <p role="alert" className="text-sm text-danger">
              {formError ?? getApiErrorMessage(createGrade.error, t("common.error"))}
            </p>
          )}
          <Button
            type="submit"
            disabled={createGrade.isPending || !studentId || grade === ""}
          >
            {t("grades.saveGrade")}
          </Button>
        </form>
      </Card>

      {isLoading ? (
        <Card className="p-4">
          <SkeletonText lines={4} />
        </Card>
      ) : groups.length === 0 ? (
        <EmptyState title={t("common.noResults")} />
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <Card key={group.studentId} className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-cream-200 bg-cream-100/60 px-4 py-2">
                <p className="text-sm font-semibold text-ink-900">{group.fullName}</p>
                <p className="text-xs text-ink-600">
                  {t("grades.entryCount", { count: group.entries.length })}
                </p>
              </div>
              <div className="flex flex-col divide-y divide-cream-200">
                {group.entries.map((g) => (
                  <div
                    key={g._id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div>
                      <p className="font-display text-2xl text-primary-900">{g.grade}</p>
                      <p className="text-xs text-ink-600">
                        {new Date(g.weekOf).toLocaleDateString()}
                      </p>
                      {g.notes && <p className="mt-1 text-xs text-ink-600">{g.notes}</p>}
                    </div>
                    <p className="whitespace-nowrap text-sm font-medium text-primary-700">
                      +{g.pointsAwarded} {t("common.points")}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
