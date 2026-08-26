import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, Card, Input, Select, SkeletonText } from "@/components/ui";
import { getApiErrorMessage } from "@/lib/apiClient";
import { useCreateGrade, useGrades } from "@/queries/grades";
import { useStudentsByCircle } from "@/queries/students";

function currentWeekOf(): string {
  const now = new Date();
  const day = now.getDay();
  const saturday = new Date(now);
  saturday.setDate(now.getDate() - ((day + 1) % 7));
  saturday.setHours(0, 0, 0, 0);
  return saturday.toISOString().slice(0, 10);
}

export function GradesTab({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const { data: students } = useStudentsByCircle(circleId);
  const { data: grades, isLoading } = useGrades(circleId);
  const createGrade = useCreateGrade();

  const [studentId, setStudentId] = useState("");
  const [weekOf, setWeekOf] = useState(currentWeekOf());
  const [grade, setGrade] = useState<number | "">("");
  const [points, setPoints] = useState<number | "">("");
  const [notes, setNotes] = useState("");

  const studentById = new Map((students ?? []).map((s) => [s._id, s.fullName]));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId || grade === "") return;
    await createGrade.mutateAsync({
      studentId,
      circleId,
      weekOf: new Date(weekOf).toISOString(),
      grade: Number(grade),
      points: points === "" ? undefined : Number(points),
      notes: notes || undefined,
    });
    setStudentId("");
    setGrade("");
    setPoints("");
    setNotes("");
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
              label={t("grades.weekOf")}
              type="date"
              value={weekOf}
              onChange={(e) => setWeekOf(e.target.value)}
            />
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
            label={t("grades.notes")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          {createGrade.isError && (
            <p role="alert" className="text-sm text-danger">
              {getApiErrorMessage(createGrade.error, t("common.error"))}
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
        <SkeletonText lines={3} />
      ) : (
        <div className="flex flex-col gap-2">
          {grades?.map((g) => (
            <Card key={g._id} className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-medium text-ink-900">
                  {studentById.get(g.studentId) ?? g.studentId}
                </p>
                <p className="text-xs text-ink-600">
                  {new Date(g.weekOf).toLocaleDateString()}
                </p>
              </div>
              <div className="text-end">
                <p className="font-display text-lg text-primary-900">{g.grade}</p>
                <p className="text-xs text-ink-600">
                  +{g.pointsAwarded} {t("common.points")}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
