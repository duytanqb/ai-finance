import { db } from "@packages/drizzle/config";
import { userCredential } from "@packages/drizzle/schema/stock";
import { and, eq } from "drizzle-orm";

export async function getDnseCredentials(
  userId: string,
): Promise<{ apiKey: string; apiSecret: string } | null> {
  const [row] = await db
    .select({ encryptedCredentials: userCredential.encryptedCredentials })
    .from(userCredential)
    .where(
      and(
        eq(userCredential.userId, userId),
        eq(userCredential.provider, "dnse"),
      ),
    )
    .limit(1);

  if (!row) return null;

  try {
    const creds = JSON.parse(row.encryptedCredentials);
    if (!creds.apiKey || !creds.apiSecret) return null;
    return { apiKey: creds.apiKey, apiSecret: creds.apiSecret };
  } catch {
    return null;
  }
}
