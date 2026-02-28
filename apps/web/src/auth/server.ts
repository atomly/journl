import { initAuth } from "@acme/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { env, parseAuthDevOrigins } from "../env";

const baseUrl =
  env.NODE_ENV === "development"
    ? env.PUBLIC_WEB_URL
    : env.VERCEL_ENV === "production"
      ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
      : env.VERCEL_ENV === "preview"
        ? `https://${env.VERCEL_URL}`
        : env.PUBLIC_WEB_URL;

const productionUrl =
  env.NODE_ENV === "development" && env.AUTH_DEV_PROXY_URL
    ? new URL(env.AUTH_DEV_PROXY_URL).origin
    : env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
      : env.PUBLIC_WEB_URL;

const trustedOrigins = Array.from(
  new Set([
    ...(env.NODE_ENV === "development"
      ? parseAuthDevOrigins(env.AUTH_DEV_ORIGINS)
      : []),
    env.PUBLIC_WEB_URL,
  ]),
);

export const auth = initAuth({
  appName: "Journl",
  baseUrl,
  githubClientId: env.AUTH_GITHUB_ID,
  githubClientSecret: env.AUTH_GITHUB_SECRET,
  googleClientId: env.AUTH_GOOGLE_ID,
  googleClientSecret: env.AUTH_GOOGLE_SECRET,
  productionUrl,
  secret: env.AUTH_SECRET,
  stripeSecretKey: env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
  trustedOrigins,
});

export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);
export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

export const getUser = cache(async () => {
  const session = await getSession();
  if (!session?.user) {
    return redirect("/");
  }
  return session.user;
});
export type User = Awaited<ReturnType<typeof getUser>>;
