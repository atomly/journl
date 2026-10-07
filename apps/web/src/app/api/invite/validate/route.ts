import { NextResponse } from "next/server";
import { normalizeInviteCode } from "~/components/auth/invite-code";
import { isInviteCodeAvailable } from "~/lib/auth/available-invite-code";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = normalizeInviteCode(requestUrl.searchParams.get("code"));

  if (!code) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  if (!(await isInviteCodeAvailable(code))) {
    return NextResponse.json({ valid: false }, { status: 404 });
  }

  return NextResponse.json({ valid: true });
}
