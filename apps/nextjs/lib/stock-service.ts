const STOCK_SERVICE_URL =
  process.env.STOCK_SERVICE_URL ||
  process.env.NEXT_PUBLIC_STOCK_SERVICE_URL ||
  "http://localhost:8000";

async function handleResponse(res: Response): Promise<unknown> {
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Stock service error ${res.status}: ${detail || res.statusText}`,
    );
  }
  return res.json();
}

export async function stockServiceGet(path: string) {
  const res = await fetch(`${STOCK_SERVICE_URL}${path}`, {
    cache: "no-store",
  });
  return handleResponse(res);
}

export async function stockServicePost(path: string, body?: unknown) {
  const res = await fetch(`${STOCK_SERVICE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  return handleResponse(res);
}
