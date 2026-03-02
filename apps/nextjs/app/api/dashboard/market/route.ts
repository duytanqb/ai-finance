import { NextResponse } from "next/server";
import { stockServiceGet } from "@/lib/stock-service";

interface OhlcCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface IndexResponse {
  symbol: string;
  data: OhlcCandle[];
}

function computeChange(candles: OhlcCandle[]): {
  value: number;
  change: number;
  changePercent: number;
} {
  if (!candles || candles.length === 0) {
    return { value: 0, change: 0, changePercent: 0 };
  }
  const latest = candles[candles.length - 1];
  if (!latest) return { value: 0, change: 0, changePercent: 0 };
  const prev =
    candles.length >= 2 ? (candles[candles.length - 2] ?? latest) : latest;
  const value = latest.close;
  const change = value - prev.close;
  const changePercent = prev.close > 0 ? (change / prev.close) * 100 : 0;
  return { value, change, changePercent };
}

export async function GET() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const from = now - 7 * 86400;

    const [vnRes, hnxRes] = await Promise.allSettled([
      stockServiceGet(
        `/api/price/index/VNINDEX/history?resolution=1D&from_ts=${from}&to_ts=${now}`,
      ) as Promise<IndexResponse>,
      stockServiceGet(
        `/api/price/index/HNXINDEX/history?resolution=1D&from_ts=${from}&to_ts=${now}`,
      ) as Promise<IndexResponse>,
    ]);

    const vnData =
      vnRes.status === "fulfilled" ? computeChange(vnRes.value.data) : null;
    const hnxData =
      hnxRes.status === "fulfilled" ? computeChange(hnxRes.value.data) : null;

    return NextResponse.json({
      vnindex: vnData,
      hnxindex: hnxData,
    });
  } catch {
    return NextResponse.json({ vnindex: null, hnxindex: null });
  }
}
