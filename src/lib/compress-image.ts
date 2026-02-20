/**
 * ⚡ Image compression utility for Supabase Free Tier (1 GB storage)
 * Compresses images client-side before uploading to save storage space
 */

const MAX_WIDTH = 800; // Max width in pixels
const MAX_HEIGHT = 800; // Max height in pixels
const QUALITY = 0.75; // JPEG quality (0.0 - 1.0)
const MAX_FILE_SIZE = 200 * 1024; // 200 KB target max

export async function compressImage(file: File): Promise<File> {
  // Skip if already small enough
  if (file.size <= MAX_FILE_SIZE && !file.type.includes("png")) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    img.onload = () => {
      let { width, height } = img;

      // Scale down if too large
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            // Always output as JPEG for better compression
            const compressedFile = new File(
              [blob],
              file.name.replace(/\.[^.]+$/, ".jpg"),
              { type: "image/jpeg" },
            );
            resolve(compressedFile);
          } else {
            resolve(file); // Fallback to original
          }
        },
        "image/jpeg",
        QUALITY,
      );
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}
