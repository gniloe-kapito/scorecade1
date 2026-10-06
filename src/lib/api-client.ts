"use client";

import { TOKEN_STORAGE_KEY } from "@/lib/config";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

interface ApiOptions {
  method?: string;
  body?: unknown; // JSON value or FormData (multipart upload)
}

/** JSON/multipart fetch wrapper with bearer auth and friendly error messages. */
export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const isForm =
    typeof FormData !== "undefined" && opts.body instanceof FormData;
  if (opts.body !== undefined && !isForm) {
    headers["Content-Type"] = "application/json";
  }

  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? "GET",
      headers,
      body:
        opts.body !== undefined
          ? isForm
            ? (opts.body as FormData)
            : JSON.stringify(opts.body)
          : undefined,
    });
  } catch {
    throw new ApiError("Нет соединения с сервером. Проверьте интернет.", 0);
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }

  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : "Что-то пошло не так. Попробуйте ещё раз.";
    throw new ApiError(message, res.status);
  }

  return data as T;
}
