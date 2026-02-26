import { NextResponse } from "next/server";
import { authGuard } from "@/adapters/guards/auth.guard";
import { getInjection } from "@/common/di/container";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await authGuard();
  if (!guard.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const useCase = getInjection("RemoveFromWatchlistUseCase");
  const result = await useCase.execute({
    itemId: id,
    userId: guard.session.user.id,
  });

  if (result.isFailure) {
    return NextResponse.json({ error: result.getError() }, { status: 400 });
  }

  return NextResponse.json(result.getValue());
}
