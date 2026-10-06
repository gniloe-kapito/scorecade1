// kappa.lol image-hosting client (profile avatars & banners).
//
// API (customer-provided spec):
//   POST   https://kappa.lol/api/upload            multipart "file" → { id, ext, type, checksum, key, link, delete }
//   DELETE https://kappa.lol/api/delete?key=<key>  → { success: true }
//   GET    https://kappa.lol/api/object?id=<id>    → { id, type, date, size, checksums, name }
//
// Uploads happen SERVER-SIDE only: the browser sends the picture to our API,
// we forward it to kappa.lol and store the returned link + deletion key.

const UPLOAD_URL = "https://kappa.lol/api/upload";
const DELETE_URL = "https://kappa.lol/api/delete";
const TIMEOUT_MS = 20_000;

export interface KappaUploadResult {
  id: string;
  /** Public link, e.g. https://kappa.lol/7rw42r */
  link: string;
  /** Deletion key — stored so a replaced picture can be cleaned up. */
  key: string;
}

/** Upload an image file to kappa.lol. Throws on any failure. */
export async function uploadToKappa(file: File): Promise<KappaUploadResult> {
  const form = new FormData();
  form.append("file", file, file.name || "upload");

  const headers: Record<string, string> = { Accept: "application/json" };
  // Optional: attach an API key if one is configured (env KAPPA_API_KEY).
  if (process.env.KAPPA_API_KEY) {
    headers.Authorization = `Bearer ${process.env.KAPPA_API_KEY}`;
  }

  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    headers,
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`kappa.lol upload failed: HTTP ${res.status}`);
  }
  const data = (await res.json().catch(() => null)) as {
    id?: string;
    link?: string;
    key?: string;
  } | null;
  if (!data?.link || !data?.key) {
    throw new Error("kappa.lol upload failed: unexpected response");
  }
  return { id: data.id ?? "", link: data.link, key: data.key };
}

/** Best-effort deletion of a previously uploaded file. Never throws. */
export async function deleteFromKappa(key: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${DELETE_URL}?key=${encodeURIComponent(key)}`,
      {
        method: "DELETE",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}
