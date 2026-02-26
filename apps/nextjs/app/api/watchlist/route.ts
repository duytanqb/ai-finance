import { NextResponse } from "next/server";
import { authGuard } from "@/adapters/guards/auth.guard";
import { getInjection } from "@/common/di/container";

export async function GET() {
  const guard = await authGuard();
  if (!guard.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const useCase = getInjection("GetWatchlistUseCase");
  const result = await useCase.execute({ userId: guard.session.user.id });

  if (result.isFailure) {
    return NextResponse.json({ error: result.getError() }, { status: 500 });
  }

  const output = result.getValue();
  return NextResponse.json({
    items: output.items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
    totalItems: output.totalItems,
  });
}

export async function POST(request: Request) {
  const guard = await authGuard();
  if (!guard.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const useCase = getInjection("AddToWatchlistUseCase");
  const result = await useCase.execute({
    userId: guard.session.user.id,
    symbol: body.symbol,
    targetPrice: body.targetPrice,
    notes: body.notes,
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
