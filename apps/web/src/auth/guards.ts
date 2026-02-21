import { getSession, type Session, type User } from "~/auth/server";

export type AuthGuardContext = {
  session: Session;
  user: User;
};

type AuthGuardOptions<TResult> = {
  onUnauthorized?: () => TResult | Promise<TResult>;
};

export function withAuthGuard<TArgs extends unknown[], TResult>(
  fn: (ctx: AuthGuardContext, ...args: TArgs) => Promise<TResult>,
  options?: AuthGuardOptions<TResult>,
) {
  return async (...args: TArgs): Promise<TResult> => {
    const session = await getSession();

    const auth = session?.user
      ? ({
          session: session as Session,
          user: session.user,
        } satisfies AuthGuardContext)
      : null;

    if (!auth) {
      if (options?.onUnauthorized) {
        return await options.onUnauthorized();
      }

      throw new Error("Unauthorized");
    }

    return await fn(auth, ...args);
  };
}
