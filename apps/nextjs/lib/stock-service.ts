const STOCK_SERVICE_URL =
  process.env.STOCK_SERVICE_URL || "http://localhost:8000";

export async function stockServiceGet(path: string) {
  const res = await fetch(`${STOCK_SERVICE_URL}${path}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Stock service error: ${res.status}`);
  return res.json();
}

export async function stockServicePost(path: string, body?: unknown) {
  const res = await fetch(`${STOCK_SERVICE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Stock service error: ${res.status}`);
  return res.json();
}
