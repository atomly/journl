import { db } from "@acme/db/client";
import { inviteCode } from "@acme/db/schema";
import { APIError, getOAuthState } from "better-auth/api";
import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";

const INVITE_ENFORCED_PATHS = new Set(["/callback/:id", "/sign-in/social"]);
const INVITE_CODE_PATTERN = /^[A-Z0-9]{8,128}$/;

type HookContext = {
  body?: unknown;
  path?: unknown;
} | null;

function normalizeInviteCode(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "");

  if (!INVITE_CODE_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}

function getInviteCodeFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const additionalData = (body as Record<string, unknown>).additionalData;

  if (!additionalData || typeof additionalData !== "object") {
    return null;
  }

  return normalizeInviteCode(
    (additionalData as Record<string, unknown>).inviteCode,
  );
}

function getContextPath(context: HookContext): string | null {
  return typeof context?.path === "string" ? context.path : null;
}

async function getInviteCodeFromOAuthState(): Promise<string | null> {
  try {
    const oauthState = await getOAuthState();

    if (!oauthState || typeof oauthState !== "object") {
      return null;
    }

    return normalizeInviteCode(
      (oauthState as Record<string, unknown>).inviteCode,
    );
  } catch {
    return null;
  }
}

async function resolveInviteCode(context: HookContext): Promise<string | null> {
  const path = getContextPath(context);

  if (path === "/callback/:id") {
    return getInviteCodeFromOAuthState();
  }

  if (path === "/sign-in/social") {
    return getInviteCodeFromBody(context?.body);
  }

  return null;
}

export async function enforceInviteCodeForSignUp(options: {
  context: HookContext;
}) {
  const path = getContextPath(options.context);

  if (!path || !INVITE_ENFORCED_PATHS.has(path)) {
    return;
  }

  const code = await resolveInviteCode(options.context);

  if (!code) {
    throw new APIError("BAD_REQUEST", {
      message: "invite_code_required",
    });
  }

  const [consumedInviteCode] = await db
    .update(inviteCode)
    .set({
      consumedAt: sql`case when ${inviteCode.usedCount} + 1 >= ${inviteCode.maxUses} then now() else ${inviteCode.consumedAt} end`,
      lastUsedAt: sql`now()`,
      updatedAt: sql`now()`,
      usedCount: sql`${inviteCode.usedCount} + 1`,
    })
    .where(
      and(
        eq(inviteCode.code, code),
        eq(inviteCode.disabled, false),
        lt(inviteCode.usedCount, inviteCode.maxUses),
        or(isNull(inviteCode.expiresAt), gt(inviteCode.expiresAt, sql`now()`)),
      ),
    )
    .returning({
      id: inviteCode.id,
    });

  if (!consumedInviteCode) {
    throw new APIError("BAD_REQUEST", {
      message: "invite_code_invalid",
    });
  }
}
