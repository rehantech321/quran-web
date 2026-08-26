import { useTranslation } from "react-i18next";

import {
  Button,
  Card,
  Skeleton,
  StatusChip,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from "@/components/ui";
import { useMyTasks, useUpdateMySubmission, type MyTasksResponse } from "@/queries/tasks";
import type { ApprovalStatus, SubmissionStatus } from "@/types/api";

function submissionTone(
  status: SubmissionStatus,
  approval?: ApprovalStatus,
): "success" | "warning" | "danger" | "info" | "neutral" {
  if (approval === "approved") return "success";
  if (approval === "rejected") return "danger";
  if (status === "completed") return "info";
  if (status === "in_progress") return "warning";
  return "neutral";
}

function submissionLabelKey(status: SubmissionStatus, approval?: ApprovalStatus): string {
  if (approval === "approved") return "tasks.approved";
  if (approval === "rejected") return "tasks.rejected";
  if (status === "completed") return "tasks.completedPending";
  if (status === "in_progress") return "tasks.inProgress";
  return "tasks.notStarted";
}

function TaskCard({ item }: { item: MyTasksResponse["active"][number] }) {
  const { t } = useTranslation();
  const updateSubmission = useUpdateMySubmission();
  const status = item.submission?.status ?? "not_started";
  const approval = item.submission?.approvalStatus;

  return (
    <Card className="flex flex-col gap-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-ink-900">{item.task.title}</p>
          {item.task.description && (
            <p className="text-xs text-ink-600">{item.task.description}</p>
          )}
          <p className="text-xs text-ink-400">
            {new Date(item.task.dueDate).toLocaleDateString()}
          </p>
        </div>
        <StatusChip
          tone={submissionTone(status, approval)}
          label={t(submissionLabelKey(status, approval))}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="font-display text-sm text-primary-900">
          {item.task.points} {t("common.points")}
        </span>
        {approval !== "approved" && (
          <div className="flex gap-2">
            {status === "not_started" && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  updateSubmission.mutate({
                    taskId: item.task._id,
                    status: "in_progress",
                  })
                }
              >
                {t("myTasks.markInProgress")}
              </Button>
            )}
            {status !== "completed" && (
              <Button
                size="sm"
                onClick={() =>
                  updateSubmission.mutate({ taskId: item.task._id, status: "completed" })
                }
              >
                {t("myTasks.markCompleted")}
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

export function MyTasks() {
  const { t } = useTranslation();
  const { data, isLoading } = useMyTasks();

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-md p-4 pb-24">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4 pb-24">
      <h1 className="font-display text-2xl text-primary-900">{t("nav.tasks")}</h1>
      <Tabs defaultValue="active">
        <TabList>
          <Tab value="active">{t("myTasks.active")}</Tab>
          <Tab value="completed">{t("myTasks.completed")}</Tab>
        </TabList>
        <TabPanel value="active">
          {data.active.length === 0 && (
            <p className="text-center text-sm text-ink-600">{t("myTasks.empty")}</p>
          )}
          <div className="flex flex-col gap-2">
            {data.active.map((item) => (
              <TaskCard key={item.task._id} item={item} />
            ))}
          </div>
        </TabPanel>
        <TabPanel value="completed">
          {data.completed.length === 0 && (
            <p className="text-center text-sm text-ink-600">{t("myTasks.empty")}</p>
          )}
          <div className="flex flex-col gap-2">
            {data.completed.map((item) => (
              <TaskCard key={item.task._id} item={item} />
            ))}
          </div>
        </TabPanel>
      </Tabs>
    </div>
  );
}
