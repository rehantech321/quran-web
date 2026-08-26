import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Button, Card, Input, SkeletonText } from "@/components/ui";
import {
  useApproveSubmission,
  usePendingApprovals,
  useRejectSubmission,
} from "@/queries/tasks";

export function ApprovalsQueue() {
  const { t } = useTranslation();
  const { data: approvals, isLoading } = usePendingApprovals();
  const approve = useApproveSubmission();
  const reject = useRejectSubmission();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3 p-4 pb-24">
      <Link to="/app/circles" className="text-xs text-ink-600 hover:underline">
        &rarr; {t("circles.title")}
      </Link>
      <h1 className="font-display text-2xl text-primary-900">
        {t("tasks.pendingApprovals")}
      </h1>

      {isLoading && (
        <Card className="p-4">
          <SkeletonText lines={4} />
        </Card>
      )}

      {!isLoading && approvals?.length === 0 && (
        <Card className="p-6 text-center text-sm text-ink-600">
          {t("tasks.noPendingApprovals")}
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {approvals?.map(({ submission, task }) => (
          <Card key={submission._id} className="flex flex-col gap-2 p-3">
            <div className="flex items-center justify-between">
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
            </div>
            {rejectingId === submission._id && (
              <div className="flex items-center gap-2">
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
  );
}
