import { NextResponse } from "next/server";
import { authGuard } from "@/adapters/guards/auth.guard";
import { getInjection } from "@/common/di/container";

export async function GET() {
  const guard = await authGuard();
  if (!guard.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const useCase = getInjection("GetPortfolioUseCase");
  const result = await useCase.execute({ userId: guard.session.user.id });

  if (result.isFailure) {
    return NextResponse.json({ error: result.getError() }, { status: 500 });
  }

  const output = result.getValue();
  return NextResponse.json({
    holdings: output.holdings.map((h) => ({
      ...h,
      stopLoss: h.stopLoss ?? null,
      takeProfit: h.takeProfit ?? null,
      createdAt: h.createdAt.toISOString(),
      updatedAt: h.updatedAt?.toISOString() ?? null,
    })),
    totalHoldings: output.totalHoldings,
  });
}

export async function POST(request: Request) {
  const guard = await authGuard();
  if (!guard.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const useCase = getInjection("AddHoldingUseCase");
  const result = await useCase.execute({
    userId: guard.session.user.id,
    symbol: body.symbol,
    quantity: body.quantity,
    averagePrice: body.averagePrice,
    horizon: body.horizon,
    stopLoss: body.stopLoss,
    takeProfit: body.takeProfit,
  });

  if (result.isFailure) {
    return NextResponse.json({ error: result.getError() }, { status: 400 });
  }

  const output = result.getValue();
  return NextResponse.json(
    {
      ...output,
      createdAt: output.createdAt.toISOString(),
    },
    { status: 201 },
  );
}
