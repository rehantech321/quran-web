/**
 * Resize + re-encode an image file in the browser before upload. A phone
 * camera photo routinely runs 3-8MB at full sensor resolution — far more
 * than a student headshot needs, and slow (or outright unreliable) to
 * upload over a weak mobile connection, which is exactly where this
 * matters most. Downscaling to a reasonable max dimension and re-encoding
 * as JPEG typically gets a photo under a few hundred KB.
 *
 * Falls back to returning the original file untouched if anything about
 * the compression step fails (an unsupported format, a canvas error,
 * etc.) — a failed compression attempt should never block someone from
 * uploading a photo that would otherwise have worked fine as-is.
 */
export async function compressImageForUpload(
  file: File,
  // It's only ever displayed as a small circular avatar (≈80px, so ≈160px
  // even at 2x pixel density) — 800px is already generous headroom, and
  // keeping the cap low matters specifically on a slow connection, where
  // every extra 100KB is real seconds.
  maxDimension = 800,
  quality = 0.8,
): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      const width = Math.round(bitmap.width * scale);
      const height = Math.round(bitmap.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      // If compression didn't actually shrink it (e.g. a small image already
      // near-optimal), the original is just as good and keeps its own format.
      if (!blob || blob.size >= file.size) return file;

      return new File([blob], toJpgFilename(file.name), { type: "image/jpeg" });
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}

function toJpgFilename(name: string): string {
  const base = name.replace(/\.[^./]+$/, "");
  return `${base || "photo"}.jpg`;
}
