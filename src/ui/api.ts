export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set("content-type", "application/json");
  const response = await fetch(path, { ...options, headers, credentials: "same-origin" });
  const data = await response.json().catch(() => ({ code: "INVALID_RESPONSE", message: "服务器响应格式异常" })) as Record<string, unknown>;
  if (!response.ok) {
    throw new ApiError(
      typeof data.message === "string" ? data.message : `请求失败（HTTP ${response.status}）`,
      typeof data.code === "string" ? data.code : "REQUEST_FAILED",
      response.status,
    );
  }
  return data as T;
}
