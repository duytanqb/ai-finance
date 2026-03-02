import { createHmac, randomUUID } from "node:crypto";

const DNSE_OPENAPI_URL = "https://openapi.dnse.com.vn";

function formatHttpDate(): string {
  return new Date().toUTCString();
}

function buildSignature(
  apiSecret: string,
  method: string,
  path: string,
  dateValue: string,
  nonce?: string,
): string {
  let signatureString = `(request-target): ${method.toLowerCase()} ${path}\ndate: ${dateValue}`;
  if (nonce) {
    signatureString += `\nnonce: ${nonce}`;
  }
  const mac = createHmac("sha256", apiSecret)
    .update(signatureString)
    .digest("base64");
  return encodeURIComponent(mac);
}

function makeDnseHeaders(
  apiKey: string,
  apiSecret: string,
  method: string,
  path: string,
): Record<string, string> {
  const dateValue = formatHttpDate();
  const nonce = randomUUID().replace(/-/g, "");
  const headersList = "(request-target) date";
  const signature = buildSignature(apiSecret, method, path, dateValue, nonce);

  let sigHeader = `Signature keyId="${apiKey}",algorithm="hmac-sha256",headers="${headersList}",signature="${signature}"`;
  sigHeader += `,nonce="${nonce}"`;

  return {
    Date: dateValue,
    "X-Signature": sigHeader,
    "x-api-key": apiKey,
  };
}

export async function dnseGet<T>(
  path: string,
  apiKey: string,
  apiSecret: string,
  query?: Record<string, string>,
): Promise<T> {
  let url = `${DNSE_OPENAPI_URL}${path}`;
  if (query) {
    const params = new URLSearchParams(query).toString();
    if (params) url += `?${params}`;
  }

  const res = await fetch(url, {
    method: "GET",
    headers: makeDnseHeaders(apiKey, apiSecret, "GET", path),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `DNSE API error ${res.status}: ${detail || res.statusText}`,
    );
  }

  return res.json() as Promise<T>;
}

export async function dnsePost<T>(
  path: string,
  apiKey: string,
  apiSecret: string,
  body?: Record<string, unknown>,
  query?: Record<string, string>,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  let url = `${DNSE_OPENAPI_URL}${path}`;
  if (query) {
    const params = new URLSearchParams(query).toString();
    if (params) url += `?${params}`;
  }

  const headers: Record<string, string> = {
    ...makeDnseHeaders(apiKey, apiSecret, "POST", path),
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `DNSE API error ${res.status}: ${detail || res.statusText}`,
    );
  }

  return res.json() as Promise<T>;
}
