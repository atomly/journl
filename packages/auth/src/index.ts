import { db } from "@acme/db/client";
import { stripePrice, stripeProduct } from "@acme/db/schema";
import { stripe } from "@better-auth/stripe";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { oAuthProxy, organization } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import Stripe from "stripe";

import { handleStripeWebhookEvent } from "./stripe-webhooks";

export function initAuth(options: {
  appName: string;
  baseUrl: string;
  productionUrl: string;
  secret: string | undefined;
  googleClientId: string;
  googleClientSecret: string;
  discordClientId: string;
  discordClientSecret: string;
  githubClientId: string;
  githubClientSecret: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
}) {
  const stripeClient = new Stripe(options.stripeSecretKey as string, {
    apiVersion: "2025-08-27.basil",
    typescript: true,
  });

  const config = {
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google", "github", "discord"],
      },
    },
    appName: options.appName,
    baseURL: options.baseUrl,
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      stripe({
        createCustomerOnSignUp: true,
        onEvent: handleStripeWebhookEvent,
        stripeClient,
        stripeWebhookSecret: options.stripeWebhookSecret,
        subscription: {
          authorizeReference: async ({ user, referenceId, action }) => {
            // Check if the user has permission to manage subscriptions for this reference
            if (
              action === "upgrade-subscription" ||
              action === "cancel-subscription" ||
              action === "restore-subscription"
            ) {
              return user.id === referenceId;
            }

            return true;
          },
          enabled: true,
          plans: async () => {
            // Fetch available products from database
            const products = await db.query.stripeProduct.findMany({
              where: eq(stripeProduct.active, true),
              with: {
                prices: {
                  where: eq(stripePrice.active, true),
                },
              },
            });

            return products.flatMap((product) =>
              product.prices.map((price) => ({
                limits: {
                  quota: (price.metadata?.quota as unknown as number) || 0,
                },
                name: product.name.toLowerCase(),
                priceId: price.id,
              })),
            );
          },
        },
      }),
      oAuthProxy({
        /**
         * Auto-inference blocked by https://github.com/better-auth/better-auth/pull/2891
         */
        currentURL: options.baseUrl,
        productionURL: options.productionUrl,
      }),
      organization(),
    ],
    secret: options.secret,
    socialProviders: {
      // Social providers can be added here when needed
      discord: {
        clientId: options.discordClientId,
        clientSecret: options.discordClientSecret,
        redirectURI: `${options.productionUrl}/api/auth/callback/discord`,
      },
      github: {
        clientId: options.githubClientId,
        clientSecret: options.githubClientSecret,
        redirectURI: `${options.productionUrl}/api/auth/callback/github`,
      },
      google: {
        clientId: options.googleClientId,
        clientSecret: options.googleClientSecret,
        redirectURI: `${options.productionUrl}/api/auth/callback/google`,
      },
    },
  } satisfies BetterAuthOptions;

  return betterAuth(config);
}

export type Auth = ReturnType<typeof initAuth>;
export type Session = Auth["$Infer"]["Session"];
