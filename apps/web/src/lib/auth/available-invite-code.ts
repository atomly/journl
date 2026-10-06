import { db } from "@acme/db/client";
import { inviteCode } from "@acme/db/schema";
import { and, eq, gt, isNull, lt, or } from "drizzle-orm";

export async function isInviteCodeAvailable(code: string) {
  const [availableCode] = await db
    .select({ id: inviteCode.id })
    .from(inviteCode)
    .where(
      and(
        eq(inviteCode.code, code),
        eq(inviteCode.disabled, false),
        lt(inviteCode.usedCount, inviteCode.maxUses),
        or(isNull(inviteCode.expiresAt), gt(inviteCode.expiresAt, new Date())),
      ),
    )
    .limit(1);

  return !!availableCode;
}
