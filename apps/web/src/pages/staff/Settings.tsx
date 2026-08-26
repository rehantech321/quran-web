import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, Card, CardBody, Input } from "@/components/ui";
import { getApiErrorMessage } from "@/lib/apiClient";
import { useOrganization, useUpdateOrganization } from "@/queries/organizations";
import { useCreateStaff, useStaff } from "@/queries/users";
import { useAuthStore } from "@/store/authStore";

export function Settings() {
  const { t } = useTranslation();
  const { data: org } = useOrganization();
  const updateOrg = useUpdateOrganization();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [primary, setPrimary] = useState("#0B3B2E");
  const [accent, setAccent] = useState("#C8A24A");
  const [sage, setSage] = useState("#7FB98A");
  const [requireStudentPin, setRequireStudentPin] = useState(false);
  const [pointsConfig, setPointsConfig] = useState({
    attendancePresent: 10,
    attendanceLate: -5,
    attendanceAbsent: -10,
    attendanceExcused: 0,
    defaultQuestionPoints: 20,
  });

  useEffect(() => {
    if (!org) return;
    setName(org.name);
    setTagline(org.tagline ?? "");
    setPrimary(org.theme.primary);
    setAccent(org.theme.accent);
    setSage(org.theme.sage);
    setRequireStudentPin(org.requireStudentPin);
    setPointsConfig({
      attendancePresent: org.pointsConfig.attendancePresent,
      attendanceLate: org.pointsConfig.attendanceLate,
      attendanceAbsent: org.pointsConfig.attendanceAbsent,
      attendanceExcused: org.pointsConfig.attendanceExcused,
      defaultQuestionPoints: org.pointsConfig.defaultQuestionPoints,
    });
  }, [org]);

  async function saveBranding() {
    await updateOrg.mutateAsync({ name, tagline, theme: { primary, accent, sage } });
  }

  async function savePointsConfig() {
    await updateOrg.mutateAsync({ pointsConfig, requireStudentPin });
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-24">
      <h1 className="font-display text-2xl text-primary-900">{t("nav.settings")}</h1>

      <Card>
        <CardBody className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-ink-900">
            {t("settings.orgBranding")}
          </h2>
          <Input
            label={t("settings.orgName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isAdmin}
          />
          <Input
            label={t("settings.tagline")}
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            disabled={!isAdmin}
          />
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink-900">
              {t("settings.themeColors")}
            </p>
            <div className="grid grid-cols-3 gap-3">
              <ColorField
                label="Primary"
                value={primary}
                onChange={setPrimary}
                disabled={!isAdmin}
              />
              <ColorField
                label="Accent"
                value={accent}
                onChange={setAccent}
                disabled={!isAdmin}
              />
              <ColorField
                label="Sage"
                value={sage}
                onChange={setSage}
                disabled={!isAdmin}
              />
            </div>
          </div>
          <div
            className="flex items-center gap-3 rounded-lg border p-3"
            style={{ borderColor: primary, background: `${primary}0d` }}
          >
            <div className="h-8 w-8 rounded-full" style={{ background: accent }} />
            <span className="font-display text-sm" style={{ color: primary }}>
              {name || t("app.title")}
            </span>
          </div>
          {isAdmin && (
            <Button
              onClick={saveBranding}
              disabled={updateOrg.isPending}
              className="self-start"
            >
              {t("common.save")}
            </Button>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-ink-900">
            {t("settings.pointsConfig")}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("settings.attendancePresent")}
              type="number"
              value={pointsConfig.attendancePresent}
              onChange={(e) =>
                setPointsConfig((p) => ({
                  ...p,
                  attendancePresent: Number(e.target.value),
                }))
              }
              disabled={!isAdmin}
            />
            <Input
              label={t("settings.attendanceLate")}
              type="number"
              value={pointsConfig.attendanceLate}
              onChange={(e) =>
                setPointsConfig((p) => ({ ...p, attendanceLate: Number(e.target.value) }))
              }
              disabled={!isAdmin}
            />
            <Input
              label={t("settings.attendanceAbsent")}
              type="number"
              value={pointsConfig.attendanceAbsent}
              onChange={(e) =>
                setPointsConfig((p) => ({
                  ...p,
                  attendanceAbsent: Number(e.target.value),
                }))
              }
              disabled={!isAdmin}
            />
            <Input
              label={t("settings.attendanceExcused")}
              type="number"
              value={pointsConfig.attendanceExcused}
              onChange={(e) =>
                setPointsConfig((p) => ({
                  ...p,
                  attendanceExcused: Number(e.target.value),
                }))
              }
              disabled={!isAdmin}
            />
            <Input
              label={t("settings.defaultQuestionPoints")}
              type="number"
              value={pointsConfig.defaultQuestionPoints}
              onChange={(e) =>
                setPointsConfig((p) => ({
                  ...p,
                  defaultQuestionPoints: Number(e.target.value),
                }))
              }
              disabled={!isAdmin}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-900">
            <input
              type="checkbox"
              checked={requireStudentPin}
              onChange={(e) => setRequireStudentPin(e.target.checked)}
              disabled={!isAdmin}
              className="h-4 w-4 accent-primary-900"
            />
            {t("settings.requirePin")}
          </label>
          {isAdmin && (
            <Button
              onClick={savePointsConfig}
              disabled={updateOrg.isPending}
              className="self-start"
            >
              {t("common.save")}
            </Button>
          )}
        </CardBody>
      </Card>

      {isAdmin && <SupervisorsSection />}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-ink-600">{label}</p>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-9 w-full rounded-md border border-cream-200"
      />
    </div>
  );
}

function SupervisorsSection() {
  const { t } = useTranslation();
  const { data: staff } = useStaff();
  const createStaff = useCreateStaff();
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    await createStaff.mutateAsync({ fullName, email, password, role: "supervisor" });
    setFullName("");
    setEmail("");
    setPassword("");
    setShowForm(false);
  }

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-900">
            {t("settings.supervisors")}
          </h2>
          <Button size="sm" variant="secondary" onClick={() => setShowForm((v) => !v)}>
            {t("settings.addSupervisor")}
          </Button>
        </div>

        {showForm && (
          <form
            onSubmit={onCreate}
            className="flex flex-col gap-2 rounded-lg border border-cream-200 p-3"
          >
            <Input
              label={t("student.fullName")}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label={t("auth.password")}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {createStaff.isError && (
              <p role="alert" className="text-sm text-danger">
                {getApiErrorMessage(createStaff.error, t("common.error"))}
              </p>
            )}
            <Button type="submit" size="sm" disabled={createStaff.isPending}>
              {t("common.save")}
            </Button>
          </form>
        )}

        <div className="flex flex-col gap-1.5">
          {staff
            ?.filter((s) => s.role === "supervisor")
            .map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span>{s.fullName}</span>
                <span className="text-xs text-ink-600">{s.email}</span>
              </div>
            ))}
        </div>
      </CardBody>
    </Card>
  );
}
