import { describe, expect, it } from "vitest";

import { toVisualRtl } from "./rtlText.js";

describe("toVisualRtl", () => {
  it("reverses word order for Arabic text, without touching a word's own characters", () => {
    expect(toVisualRtl("تقرير الحلقة: الحلقة الأولى")).toBe(
      "الأولى الحلقة الحلقة: تقرير",
    );
  });

  it("leaves an embedded number's digit order intact — only its position among words moves", () => {
    expect(toVisualRtl("عدد الطلاب: 10 · مجموع النقاط: 837")).toBe(
      "837 النقاط: مجموع · 10 الطلاب: عدد",
    );
  });

  it("leaves non-Arabic text (e.g. a filename or pure number) unchanged", () => {
    expect(toVisualRtl("Circle Report")).toBe("Circle Report");
    expect(toVisualRtl("837")).toBe("837");
    expect(toVisualRtl("")).toBe("");
  });
});
