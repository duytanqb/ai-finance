import { NextResponse } from "next/server";
import { authGuard } from "@/adapters/guards/auth.guard";
import { getInjection } from "@/common/di/container";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await authGuard();
  if (!guard.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const useCase = getInjection("UpdateHoldingUseCase");
  const result = await useCase.execute({
    holdingId: id,
    userId: guard.session.user.id,
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
  return NextResponse.json({
    ...output,
    updatedAt: output.updatedAt?.toISOString() ?? null,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await authGuard();
  if (!guard.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const useCase = getInjection("RemoveHoldingUseCase");
  const result = await useCase.execute({
    holdingId: id,
    userId: guard.session.user.id,
  });

  if (result.isFailure) {
    return NextResponse.json({ error: result.getError() }, { status: 400 });
  }

  return NextResponse.json(result.getValue());
}
