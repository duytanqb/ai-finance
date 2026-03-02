import { Suspense } from "react";
import { TradingData } from "./_components/trading-data";

export default function TradingPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          DNSE Trading
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Tài khoản, số dư và danh mục thực từ DNSE Lightspeed
        </p>
      </div>
      <Suspense>
        <TradingData />
      </Suspense>
    </div>
  );
}
