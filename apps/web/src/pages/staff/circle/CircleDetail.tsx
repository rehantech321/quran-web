import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { Skeleton, Tab, TabList, TabPanel, Tabs } from "@/components/ui";
import { useCircle } from "@/queries/circles";

import { AttendanceTab } from "./AttendanceTab";
import { GradesTab } from "./GradesTab";
import { QuestionsTab } from "./QuestionsTab";
import { ReportTab } from "./ReportTab";
import { StudentsTab } from "./StudentsTab";
import { TasksTab } from "./TasksTab";

export function CircleDetail() {
  const { t } = useTranslation();
  const { circleId } = useParams<{ circleId: string }>();
  const { data: circle, isLoading } = useCircle(circleId);

  if (isLoading || !circle) {
    return (
      <div className="mx-auto max-w-3xl p-4 lg:max-w-5xl">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 pb-24 lg:max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/app/circles" className="text-xs text-ink-600 hover:underline">
            &rarr; {t("circles.title")}
          </Link>
          <h1 className="font-display text-2xl text-primary-900">{circle.name}</h1>
        </div>
        <Link
          to={`/app/circles/${circle._id}/scan`}
          className="inline-flex h-11 items-center rounded-lg bg-primary-900 px-4 text-sm font-medium text-cream-50"
        >
          {t("nav.scan")}
        </Link>
      </div>

      <Tabs defaultValue="students">
        <TabList>
          <Tab value="students">{t("nav.students")}</Tab>
          <Tab value="attendance">{t("nav.attendance")}</Tab>
          <Tab value="grades">{t("nav.grades")}</Tab>
          <Tab value="questions">{t("nav.questions")}</Tab>
          <Tab value="tasks">{t("nav.tasks")}</Tab>
          <Tab value="report">{t("nav.report")}</Tab>
        </TabList>
        <TabPanel value="students">
          <StudentsTab circleId={circle._id} />
        </TabPanel>
        <TabPanel value="attendance">
          <AttendanceTab circleId={circle._id} />
        </TabPanel>
        <TabPanel value="grades">
          <GradesTab circleId={circle._id} />
        </TabPanel>
        <TabPanel value="questions">
          <QuestionsTab circleId={circle._id} />
        </TabPanel>
        <TabPanel value="tasks">
          <TasksTab circleId={circle._id} />
        </TabPanel>
        <TabPanel value="report">
          <ReportTab circleId={circle._id} />
        </TabPanel>
      </Tabs>
    </div>
  );
}
