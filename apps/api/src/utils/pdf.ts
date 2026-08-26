import PDFDocument from "pdfkit";

export interface PdfColumn {
  key: string;
  header: string;
  width: number;
}

export interface SimpleReportPdfInput {
  title: string;
  subtitle?: string;
  columns: PdfColumn[];
  rows: Record<string, unknown>[];
}

/**
 * A deliberately plain report layout — a title, a subtitle, and a left-aligned
 * column table — rather than a styled/branded PDF. SPEC.md §6 asks for CSV/PDF
 * export without specifying a design, and the polished, on-brand print
 * surface for this app is the QR-card sheet (Phase 11's print stylesheet);
 * this export exists to get the numbers into a portable document, not to look
 * like a marketing piece.
 */
export function renderSimpleReportPdf(input: SimpleReportPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text(input.title, { align: "left" });
    if (input.subtitle) {
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor("#555555").text(input.subtitle);
      doc.fillColor("#000000");
    }
    doc.moveDown(1);

    const startX = doc.x;
    let y = doc.y;
    const rowHeight = 20;

    doc.fontSize(10).font("Helvetica-Bold");
    let x = startX;
    for (const col of input.columns) {
      doc.text(col.header, x, y, { width: col.width });
      x += col.width;
    }
    y += rowHeight;
    doc
      .moveTo(startX, y - 4)
      .lineTo(x, y - 4)
      .strokeColor("#cccccc")
      .stroke();

    doc.font("Helvetica");
    for (const row of input.rows) {
      if (y > doc.page.height - 60) {
        doc.addPage();
        y = doc.y;
      }
      x = startX;
      for (const col of input.columns) {
        const value = row[col.key];
        doc.text(value === null || value === undefined ? "" : String(value), x, y, {
          width: col.width,
        });
        x += col.width;
      }
      y += rowHeight;
    }

    doc.end();
  });
}
