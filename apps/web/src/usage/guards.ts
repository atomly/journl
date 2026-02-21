import { db } from "@acme/db/client";
import { assertUsageQuota, UsageLimitError } from "@acme/db/usage";
import type { Session, User } from "~/auth/server";

type UsageDb = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

type GuardContext = {
  session: Session;
  user: User;
};

type UsageGuardOptions<TResult> = {
  onUsageLimitExceeded?: (error: UsageLimitError) => TResult | Promise<TResult>;
};

type UsageQuotaCheckResult<TResult> =
  | {
      ok: true;
    }
  | {
      ok: false;
      result: TResult;
    };

export async function checkUsageQuota<TResult = never>(input: {
  db: UsageDb;
  userId: string;
  onUsageLimitExceeded?: (error: UsageLimitError) => TResult | Promise<TResult>;
}): Promise<UsageQuotaCheckResult<TResult>> {
  try {
    await assertUsageQuota(input.db, input.userId);
    return { ok: true };
  } catch (error) {
    if (error instanceof UsageLimitError) {
      if (input.onUsageLimitExceeded) {
        return {
          ok: false,
          result: await input.onUsageLimitExceeded(error),
        };
      }

      throw new Error("AI usage quota exceeded for current period");
    }

    throw error;
  }
}

export function withUsageGuard<TArgs extends unknown[], TResult>(
  fn: (ctx: GuardContext, ...args: TArgs) => Promise<TResult>,
  options?: UsageGuardOptions<TResult>,
) {
  return async (ctx: GuardContext, ...args: TArgs): Promise<TResult> => {
    const check = await checkUsageQuota({
      db,
      onUsageLimitExceeded: options?.onUsageLimitExceeded,
      userId: ctx.user.id,
    });

    if (!check.ok) {
      return check.result;
    }

    return await fn(ctx, ...args);
  };
}
