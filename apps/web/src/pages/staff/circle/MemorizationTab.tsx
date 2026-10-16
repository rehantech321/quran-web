import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { QURAN_SURAHS } from "@halaqat/shared";

import { Button, Card, EmptyState, Select, SkeletonText } from "@/components/ui";
import { getApiErrorMessage } from "@/lib/apiClient";
import { useMemorizationHistory, useRecordMemorization } from "@/queries/memorization";
import { useStudentsByCircle } from "@/queries/students";
import type { AyahRange, MemorizationLogEntry } from "@/types/api";

interface RangeDraft {
  surahNumber: number | "";
  fromAyah: number | "";
  toAyah: number | "";
}

const EMPTY_RANGE: RangeDraft = { surahNumber: "", fromAyah: "", toAyah: "" };

function ayahOptions(surahNumber: number | ""): number[] {
  if (surahNumber === "") return [];
  const surah = QURAN_SURAHS.find((s) => s.number === surahNumber);
  return surah ? Array.from({ length: surah.ayahCount }, (_, i) => i + 1) : [];
}

function toApiRange(draft: RangeDraft): Omit<AyahRange, "surahName"> | undefined {
  if (draft.surahNumber === "" || draft.fromAyah === "" || draft.toAyah === "") {
    return undefined;
  }
  return {
    surahNumber: draft.surahNumber,
    fromAyah: draft.fromAyah,
    toAyah: draft.toAyah,
  };
}

/** One Surah + from/to-Ayah picker, reused for both the "new memorization" and "revision" portions of the form below. */
function RangePicker({
  legend,
  value,
  onChange,
}: {
  legend: string;
  value: RangeDraft;
  onChange: (next: RangeDraft) => void;
}) {
  const { t } = useTranslation();
  const ayahs = ayahOptions(value.surahNumber);

  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-cream-200 p-3">
      <legend className="px-1 text-xs font-semibold text-ink-900">{legend}</legend>
      <Select
        label={t("memorization.surah")}
        value={value.surahNumber}
        onChange={(e) => {
          const surahNumber = e.target.value === "" ? "" : Number(e.target.value);
          // Changing the surah invalidates any previously-picked ayah range
          // (it almost certainly won't exist in the new surah) — reset both
          // rather than silently keep an out-of-range value selected.
          onChange({ surahNumber, fromAyah: "", toAyah: "" });
        }}
      >
        <option value="">—</option>
        {QURAN_SURAHS.map((s) => (
          <option key={s.number} value={s.number}>
            {s.number}. {s.nameAr}
          </option>
        ))}
      </Select>
      <div className="grid grid-cols-2 gap-2">
        <Select
          label={t("memorization.fromAyah")}
          value={value.fromAyah}
          onChange={(e) =>
            onChange({
              ...value,
              fromAyah: e.target.value === "" ? "" : Number(e.target.value),
            })
          }
          disabled={ayahs.length === 0}
        >
          <option value="">—</option>
          {ayahs.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
        <Select
          label={t("memorization.toAyah")}
          value={value.toAyah}
          onChange={(e) =>
            onChange({
              ...value,
              toAyah: e.target.value === "" ? "" : Number(e.target.value),
            })
          }
          disabled={ayahs.length === 0}
        >
          <option value="">—</option>
          {ayahs
            .filter((n) => value.fromAyah === "" || n >= value.fromAyah)
            .map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
        </Select>
      </div>
    </fieldset>
  );
}

function RangeSummary({ range }: { range: AyahRange }) {
  return (
    <span>
      {range.surahName} ({range.fromAyah}-{range.toAyah})
    </span>
  );
}

export function MemorizationTab({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const { data: students } = useStudentsByCircle(circleId);
  const { data: history, isLoading } = useMemorizationHistory(circleId);
  const recordMemorization = useRecordMemorization();

  const [studentId, setStudentId] = useState("");
  const [newMemorization, setNewMemorization] = useState<RangeDraft>(EMPTY_RANGE);
  const [revision, setRevision] = useState<RangeDraft>(EMPTY_RANGE);

  const studentById = useMemo(
    () => new Map((students ?? []).map((s) => [s._id, s.fullName])),
    [students],
  );

  const newRange = toApiRange(newMemorization);
  const revisionRange = toApiRange(revision);
  const canSubmit = Boolean(studentId) && Boolean(newRange ?? revisionRange);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      await recordMemorization.mutateAsync({
        studentId,
        circleId,
        newMemorization: newRange,
        revision: revisionRange,
      });
      setStudentId("");
      setNewMemorization(EMPTY_RANGE);
      setRevision(EMPTY_RANGE);
    } catch {
      // surfaced below via recordMemorization.isError
    }
  }

  // Grouped by student, most recent first — same rationale as GradesTab:
  // a supervisor reviewing one student's memorization progress needs their
  // history together, not interleaved with everyone else's.
  const groups: {
    studentId: string;
    fullName: string;
    entries: MemorizationLogEntry[];
  }[] = [];
  if (history) {
    const byStudent = new Map<string, MemorizationLogEntry[]>();
    for (const entry of history) {
      const list = byStudent.get(entry.studentId) ?? [];
      list.push(entry);
      byStudent.set(entry.studentId, list);
    }
    for (const [sid, entries] of byStudent) {
      groups.push({
        studentId: sid,
        fullName: studentById.get(sid) ?? entries[0]!.studentId,
        entries,
      });
    }
    groups.sort((a, b) => b.entries[0]!.date.localeCompare(a.entries[0]!.date));
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink-900">
          {t("memorization.addEntry")}
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

          <RangePicker
            legend={t("memorization.newMemorization")}
            value={newMemorization}
            onChange={setNewMemorization}
          />
          <RangePicker
            legend={t("memorization.revision")}
            value={revision}
            onChange={setRevision}
          />

          {recordMemorization.isError && (
            <p role="alert" className="text-sm text-danger">
              {getApiErrorMessage(recordMemorization.error, t("common.error"))}
            </p>
          )}
          <Button type="submit" disabled={recordMemorization.isPending || !canSubmit}>
            {t("common.save")}
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
              <div className="border-b border-cream-200 bg-cream-100/60 px-4 py-2">
                <p className="text-sm font-semibold text-ink-900">{group.fullName}</p>
              </div>
              <div className="flex flex-col divide-y divide-cream-200">
                {group.entries.map((entry) => (
                  <div key={entry._id} className="flex flex-col gap-1 px-4 py-3 text-sm">
                    <p className="text-xs text-ink-400">
                      {new Date(entry.date).toLocaleDateString()}
                    </p>
                    {entry.newMemorization && (
                      <p className="text-ink-900">
                        {t("memorization.newMemorization")}:{" "}
                        <RangeSummary range={entry.newMemorization} />
                      </p>
                    )}
                    {entry.revision && (
                      <p className="text-ink-600">
                        {t("memorization.revision")}:{" "}
                        <RangeSummary range={entry.revision} />
                      </p>
                    )}
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
