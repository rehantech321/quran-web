/** Static seed data: Arabic names and other fixtures reused by seed.ts. */

export const ADMIN_NAME = "عبد الرحمن السديس";

export const SUPERVISOR_NAMES = ["يوسف القرني", "خالد العتيبي"];

export const CIRCLE_NAMES = ["الحلقة الأولى", "الحلقة الثانية", "الحلقة الثالثة"];

export const MEMORIZATION_LEVELS = [
  "جزء عم",
  "جزء تبارك",
  "الجزء الأول",
  "الجزء الثاني",
  "خمسة أجزاء",
  "عشرة أجزاء",
  "خمسة عشر جزءًا",
  "حافظ كامل",
];

// 30 distinct Arabic student names.
export const STUDENT_NAMES = [
  "أحمد محمد",
  "عبد الله سالم",
  "عمر خالد",
  "يوسف إبراهيم",
  "زياد عبد العزيز",
  "فيصل ناصر",
  "سلطان فهد",
  "طلال عبد الرحمن",
  "ماجد سعود",
  "بندر تركي",
  "نايف حمد",
  "راشد جاسم",
  "سعد منصور",
  "عبد الملك عادل",
  "حمزة وليد",
  "إسماعيل رشيد",
  "معاذ صالح",
  "أنس هشام",
  "كريم شاكر",
  "مالك فراس",
  "عبد العزيز لطفي",
  "تميم غازي",
  "ريان جميل",
  "سامي مروان",
  "وائل أيمن",
  "جابر عصام",
  "خطاب سامر",
  "لؤي باسل",
  "مهند أشرف",
  "براء نضال",
] as const;

export const PARENT_PHONE_PREFIX = "+9665";

export function studentAvatarUrl(seed: string): string {
  return `https://api.dicebear.com/7.x/personas/svg?seed=${encodeURIComponent(seed)}`;
}
