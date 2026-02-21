import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSession } from "~/auth/server";

type PageGuardOptions = {
  redirectTo?: string;
};

type PageComponent<Props> = (props: Props) => Promise<ReactNode> | ReactNode;

export function withAuth<Props>(
  component: PageComponent<Props>,
  options?: PageGuardOptions,
) {
  return async (props: Props) => {
    const session = await getSession();

    if (!session?.user) {
      redirect(options?.redirectTo ?? "/auth/sign-in");
    }

    return await component(props);
  };
}

export function withoutAuth<Props>(
  component: PageComponent<Props>,
  options?: PageGuardOptions,
) {
  return async (props: Props) => {
    const session = await getSession();

    if (session?.user) {
      redirect(options?.redirectTo ?? "/journal");
    }

    return await component(props);
  };
}
