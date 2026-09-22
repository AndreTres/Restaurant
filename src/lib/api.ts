async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof data?.error === "string" ? data.error : "Falha na requisição";
    throw new Error(message);
  }

  return data as T;
}

export async function apiGet<T>(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  return parseResponse<T>(response);
}

export async function apiSend<T>(
  url: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown
) {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  return parseResponse<T>(response);
}
