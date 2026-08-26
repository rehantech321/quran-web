import { useState } from "react";

import {
  CornerArabesque,
  GirihPattern,
  GoldRule,
  MihrabArch,
} from "@/components/ornament";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Modal,
  Select,
  Skeleton,
  SkeletonCard,
  SkeletonText,
  StatusChip,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  useToast,
} from "@/components/ui";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl text-primary-900">{title}</h2>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  );
}

export function KitchenSink() {
  const [modalOpen, setModalOpen] = useState(false);
  const { showToast } = useToast();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-10 p-6">
      <div>
        <h1 className="font-display text-3xl text-primary-900">Kitchen Sink</h1>
        <p className="text-ink-600">
          Every design-system primitive, for visual QA. Dev-only route.
        </p>
      </div>

      <Section title="Buttons">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="primary" size="sm">
          Small
        </Button>
        <Button variant="primary" disabled>
          Disabled
        </Button>
      </Section>

      <Section title="Card">
        <Card className="w-72">
          <CardHeader>عنوان البطاقة</CardHeader>
          <CardBody>
            <p className="text-sm text-ink-600">Card body content goes here.</p>
          </CardBody>
        </Card>
        <Card className="relative w-72 p-4">
          <CornerArabesque corner="top-start" />
          <CornerArabesque corner="bottom-end" />
          <p className="text-center font-display text-2xl text-primary-900">248</p>
          <p className="text-center text-sm text-ink-600">النقاط</p>
        </Card>
      </Section>

      <Section title="Inputs & Select">
        <Input label="الاسم الكامل" placeholder="أحمد محمد" className="w-64" />
        <Input
          label="كلمة المرور"
          type="password"
          error="كلمة المرور مطلوبة"
          className="w-64"
        />
        <Select label="الحلقة" className="w-64">
          <option>الحلقة الأولى</option>
          <option>الحلقة الثانية</option>
        </Select>
      </Section>

      <Section title="Modal & Toast">
        <Button onClick={() => setModalOpen(true)}>Open modal</Button>
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="تأكيد">
          <p className="mb-4 text-sm text-ink-600">هل أنت متأكد من هذا الإجراء؟</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={() => setModalOpen(false)}>تأكيد</Button>
          </div>
        </Modal>
        <Button onClick={() => showToast("تم الحفظ بنجاح", "success")}>
          Success toast
        </Button>
        <Button onClick={() => showToast("حدث خطأ ما", "danger")}>Danger toast</Button>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="a" className="w-full">
          <TabList>
            <Tab value="a">الطلاب</Tab>
            <Tab value="b">الحضور</Tab>
            <Tab value="c">الدرجات</Tab>
          </TabList>
          <TabPanel value="a">محتوى تبويب الطلاب.</TabPanel>
          <TabPanel value="b">محتوى تبويب الحضور.</TabPanel>
          <TabPanel value="c">محتوى تبويب الدرجات.</TabPanel>
        </Tabs>
      </Section>

      <Section title="Status chips">
        <StatusChip tone="success" label="حاضر" />
        <StatusChip tone="warning" label="متأخر" />
        <StatusChip tone="danger" label="غائب" />
        <StatusChip tone="info" label="بانتظار الموافقة" />
        <StatusChip tone="neutral" label="لم يبدأ" />
      </Section>

      <Section title="Skeletons">
        <div className="w-64">
          <SkeletonText lines={3} />
        </div>
        <SkeletonCard className="w-72" />
        <Skeleton className="h-20 w-20 rounded-full" />
      </Section>

      <Section title="Ornaments">
        <div className="relative h-32 w-64 overflow-hidden rounded-lg border border-cream-200">
          <GirihPattern opacity={0.08} />
        </div>
        <div className="h-32 w-48">
          <MihrabArch variant="cap" className="h-full w-full" />
        </div>
        <div className="h-32 w-24">
          <MihrabArch variant="frame" className="h-full w-full" />
        </div>
        <div className="w-64">
          <GoldRule />
        </div>
      </Section>
    </div>
  );
}
