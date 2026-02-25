import { redirect } from "next/navigation";
import { authGuard } from "@/adapters/guards/auth.guard";

export default async function Home() {
  const guardResult = await authGuard();

  if (guardResult.authenticated) {
    redirect("/dashboard");
  }

  redirect("/login");
}
