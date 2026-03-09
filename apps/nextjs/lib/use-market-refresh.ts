"use client";

import { useEffect, useRef } from "react";

const VN_OFFSET = 7 * 60; // UTC+7 in minutes

function isMarketHours(): boolean {
  const now = new Date();
  const utcMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const vnMin = (utcMin + VN_OFFSET) % (24 * 60);
  const vnHour = Math.floor(vnMin / 60);
  const day = now.getUTCDay();

  // Adjust day for VN timezone
  const utcHour = now.getUTCHours();
  let vnDay = day;
  if (utcHour + 7 >= 24) vnDay = (day + 1) % 7;

  // Mon(1) - Fri(5), 9:00 - 15:00
  return vnDay >= 1 && vnDay <= 5 && vnHour >= 9 && vnHour < 15;
}

/**
 * Auto-refresh callback every `intervalMs` during VN market hours (9-15, Mon-Fri).
 * Does nothing outside market hours.
 */
export function useMarketRefresh(
  callback: () => void,
  intervalMs: number = 30 * 60 * 1000,
) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    const id = setInterval(() => {
      if (isMarketHours()) {
        cbRef.current();
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
