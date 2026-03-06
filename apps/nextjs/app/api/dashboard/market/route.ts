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

function toChartPoints(
  candles: OhlcCandle[],
): { time: number; value: number }[] {
  if (!candles || candles.length === 0) return [];
  return candles.map((c) => ({ time: c.time, value: c.close }));
}

export async function GET() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const dailyFrom = now - 7 * 86400;
    const intradayFrom = now - 86400;

    const [vnDailyRes, vnIntradayRes] = await Promise.allSettled([
      stockServiceGet(
        `/api/price/index/VNINDEX/history?resolution=1D&from_ts=${dailyFrom}&to_ts=${now}`,
      ) as Promise<IndexResponse>,
      stockServiceGet(
        `/api/price/index/VNINDEX/history?resolution=15&from_ts=${intradayFrom}&to_ts=${now}`,
      ) as Promise<IndexResponse>,
    ]);

    const vnChange =
      vnDailyRes.status === "fulfilled"
        ? computeChange(vnDailyRes.value.data)
        : null;
    const vnChart =
      vnIntradayRes.status === "fulfilled"
        ? toChartPoints(vnIntradayRes.value.data)
        : [];

    return NextResponse.json({
      vnindex: vnChange ? { ...vnChange, chart: vnChart } : null,
    });
  } catch {
    return NextResponse.json({ vnindex: null });
  }
}
