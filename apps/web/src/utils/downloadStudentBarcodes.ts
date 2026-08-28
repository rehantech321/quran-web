import JSZip from "jszip";

import { apiClient } from "@/lib/apiClient";

interface BarcodeStudent {
  _id: string;
  fullName: string;
}

export async function downloadStudentBarcodes(
  students: BarcodeStudent[],
  filename = "halaqat-barcodes.zip",
) {
  const zip = new JSZip();
  await Promise.all(
    students.map(async (student, index) => {
      const response = await apiClient.get<ArrayBuffer>(
        `/students/${student._id}/qr.png`,
        { responseType: "arraybuffer" },
      );
      const safeName = student.fullName.replace(/[^\w\u0600-\u06ff -]/g, "").trim();
      zip.file(
        `${String(index + 1).padStart(2, "0")}-${safeName || student._id}.png`,
        response.data,
      );
    }),
  );

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
