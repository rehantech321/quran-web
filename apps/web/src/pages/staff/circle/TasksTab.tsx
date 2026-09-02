import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { TaskAssignmentType } from "@halaqat/shared";

import {
  Button,
  Card,
  Input,
  Modal,
  Select,
  SkeletonText,
  StatusChip,
} from "@/components/ui";
import { getApiErrorMessage } from "@/lib/apiClient";
import {
  useApproveSubmission,
  useCreateTask,
  useDeleteTask,
  usePendingApprovals,
  useRejectSubmission,
  useTasks,
  useUpdateTask,
} from "@/queries/tasks";
import { useStudentsByCircle } from "@/queries/students";
import type { WeeklyTask } from "@/types/api";

export function TasksTab({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const { data: tasks, isLoading } = useTasks(circleId);
  const { data: students } = useStudentsByCircle(circleId);
  const { data: approvals } = usePendingApprovals(circleId);
  const createTask = useCreateTask();
  const deleteTask = useDeleteTask(circleId);
  const approve = useApproveSubmission();
  const reject = useRejectSubmission();
  const [editingTask, setEditingTask] = useState<WeeklyTask | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState<number | "">("");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState<TaskAssignmentType>("circle");
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || points === "" || !dueDate) return;
    await createTask.mutateAsync({
      circleId,
      title,
      description: description || undefined,
      points: Number(points),
      dueDate: new Date(dueDate),
      assignedTo,
      studentIds: assignedTo === "students" ? studentIds : undefined,
      isPublished: true,
    });
    setTitle("");
    setDescription("");
    setPoints("");
    setDueDate("");
    setStudentIds([]);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink-900">{t("tasks.addTask")}</h2>
        <form className="flex flex-col gap-3" onSubmit={onSubmit}>
          <Input
            label={t("tasks.title")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <Input
            label={`${t("tasks.description")} (${t("common.optional")})`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("tasks.points")}
              type="number"
              value={points}
              onChange={(e) =>
                setPoints(e.target.value === "" ? "" : Number(e.target.value))
              }
              required
            />
            <Input
              label={t("tasks.dueDate")}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>
          <Select
            label={t("tasks.assignTo")}
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value as TaskAssignmentType)}
          >
            <option value="circle">{t("tasks.wholeCircle")}</option>
            <option value="students">{t("tasks.selectedStudents")}</option>
          </Select>
          {assignedTo === "students" && (
            <div className="flex flex-wrap gap-1.5">
              {students?.map((s) => {
                const selected = studentIds.includes(s._id);
                return (
                  <button
                    type="button"
                    key={s._id}
                    onClick={() =>
                      setStudentIds((prev) =>
                        selected ? prev.filter((id) => id !== s._id) : [...prev, s._id],
                      )
                    }
                    className={`min-h-9 rounded-full border px-3 text-xs ${
                      selected
                        ? "border-primary-900 bg-primary-900 text-cream-50"
                        : "border-cream-200 bg-cream-50 text-ink-600"
                    }`}
                  >
                    {s.fullName}
                  </button>
                );
              })}
            </div>
          )}
          {createTask.isError && (
            <p role="alert" className="text-sm text-danger">
              {getApiErrorMessage(createTask.error, t("common.error"))}
            </p>
          )}
          <Button type="submit" disabled={createTask.isPending}>
            {t("tasks.createTask")}
          </Button>
        </form>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink-900">
          {t("tasks.pendingApprovals")}
        </h2>
        {approvals?.length === 0 && (
          <p className="text-sm text-ink-600">{t("tasks.noPendingApprovals")}</p>
        )}
        <div className="flex flex-col gap-2">
          {approvals?.map(({ submission, task }) => (
            <Card
              key={submission._id}
              className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-ink-900">{task.title}</p>
                {submission.studentNote && (
                  <p className="text-xs text-ink-600">{submission.studentNote}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    approve.mutate({ taskId: task._id, submissionId: submission._id })
                  }
                  disabled={approve.isPending}
                >
                  {t("tasks.approve")}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setRejectingId(submission._id)}
                >
                  {t("tasks.reject")}
                </Button>
              </div>
              {rejectingId === submission._id && (
                <div className="flex w-full items-center gap-2 sm:mt-2">
                  <Input
                    className="flex-1"
                    placeholder={t("tasks.rejectionReason")}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={!rejectionReason}
                    onClick={() => {
                      reject.mutate({
                        taskId: task._id,
                        submissionId: submission._id,
                        rejectionReason,
                      });
                      setRejectingId(null);
                      setRejectionReason("");
                    }}
                  >
                    {t("common.confirm")}
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink-900">{t("nav.tasks")}</h2>
        {isLoading ? (
          <SkeletonText lines={3} />
        ) : (
          <div className="flex flex-col gap-2">
            {tasks?.map((task) => (
              <Card
                key={task._id}
                className="flex items-center justify-between gap-2 p-3"
              >
                <p className="min-w-0 flex-1 truncate text-sm text-ink-900">
                  {task.title}
                </p>
                <div className="flex items-center gap-2">
                  <StatusChip
                    tone="info"
                    label={`${task.points} ${t("common.points")}`}
                  />
                  <button
                    type="button"
                    onClick={() => setEditingTask(task)}
                    className="text-xs text-primary-700 hover:underline"
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(t("tasks.deleteConfirm"))) {
                        deleteTask.mutate(task._id);
                      }
                    }}
                    className="text-xs text-danger hover:underline"
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <EditTaskModal
        task={editingTask}
        circleId={circleId}
        onClose={() => setEditingTask(null)}
      />
    </div>
  );
}

function EditTaskModal({
  task,
  circleId,
  onClose,
}: {
  task: WeeklyTask | null;
  circleId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data: students } = useStudentsByCircle(circleId);
  const updateTask = useUpdateTask();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState<number | "">("");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState<TaskAssignmentType>("circle");
  const [studentIds, setStudentIds] = useState<string[]>([]);

  // Re-seed the form fields whenever a different task is opened for editing —
  // simplest way to keep this uncontrolled-by-default form in sync with
  // whichever task the parent just set, without a form library's `values` API.
  const [loadedTaskId, setLoadedTaskId] = useState<string | null>(null);
  if (task && task._id !== loadedTaskId) {
    setLoadedTaskId(task._id);
    setTitle(task.title);
    setDescription(task.description ?? "");
    setPoints(task.points);
    setDueDate(task.dueDate.slice(0, 10));
    setAssignedTo(task.assignedTo);
    setStudentIds(task.studentIds ?? []);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!task || !title || points === "" || !dueDate) return;
    await updateTask.mutateAsync({
      id: task._id,
      title,
      description: description || undefined,
      points: Number(points),
      dueDate: new Date(dueDate),
      assignedTo,
      studentIds: assignedTo === "students" ? studentIds : undefined,
    });
    onClose();
  }

  return (
    <Modal open={Boolean(task)} onClose={onClose} title={t("tasks.editTask")}>
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <Input
          label={t("tasks.title")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <Input
          label={`${t("tasks.description")} (${t("common.optional")})`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t("tasks.points")}
            type="number"
            value={points}
            onChange={(e) =>
              setPoints(e.target.value === "" ? "" : Number(e.target.value))
            }
            required
          />
          <Input
            label={t("tasks.dueDate")}
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
        </div>
        <Select
          label={t("tasks.assignTo")}
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value as TaskAssignmentType)}
        >
          <option value="circle">{t("tasks.wholeCircle")}</option>
          <option value="students">{t("tasks.selectedStudents")}</option>
        </Select>
        {assignedTo === "students" && (
          <div className="flex flex-wrap gap-1.5">
            {students?.map((s) => {
              const selected = studentIds.includes(s._id);
              return (
                <button
                  type="button"
                  key={s._id}
                  onClick={() =>
                    setStudentIds((prev) =>
                      selected ? prev.filter((id) => id !== s._id) : [...prev, s._id],
                    )
                  }
                  className={`min-h-9 rounded-full border px-3 text-xs ${
                    selected
                      ? "border-primary-900 bg-primary-900 text-cream-50"
                      : "border-cream-200 bg-cream-50 text-ink-600"
                  }`}
                >
                  {s.fullName}
                </button>
              );
            })}
          </div>
        )}
        {updateTask.isError && (
          <p role="alert" className="text-sm text-danger">
            {getApiErrorMessage(updateTask.error, t("common.error"))}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={updateTask.isPending}>
            {t("common.save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
