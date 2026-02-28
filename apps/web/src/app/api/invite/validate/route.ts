import { db } from "@acme/db/client";
import { inviteCode } from "@acme/db/schema";
import { and, eq, gt, isNull, lt, or } from "drizzle-orm";
import { NextResponse } from "next/server";

const INVITE_CODE_PATTERN = /^[A-Z0-9]{8,128}$/;

function normalizeInviteCode(code: string | null) {
  if (!code) {
    return null;
  }

  const normalized = code
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "");

  return INVITE_CODE_PATTERN.test(normalized) ? normalized : null;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = normalizeInviteCode(requestUrl.searchParams.get("code"));

  if (!code) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  const now = new Date();
  const [availableCode] = await db
    .select({ id: inviteCode.id })
    .from(inviteCode)
    .where(
      and(
        eq(inviteCode.code, code),
        eq(inviteCode.disabled, false),
        lt(inviteCode.usedCount, inviteCode.maxUses),
        or(isNull(inviteCode.expiresAt), gt(inviteCode.expiresAt, now)),
      ),
    )
    .limit(1);

  if (!availableCode) {
    return NextResponse.json({ valid: false }, { status: 404 });
  }

  return NextResponse.json({ valid: true });
}
