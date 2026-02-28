import { randomBytes } from "node:crypto";
import { inviteCode } from "@acme/db/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { env } from "~/env";
import { publicProcedure } from "../trpc";

const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DEFAULT_INVITE_CODE_LENGTH = 10;
const MAX_GENERATION_ATTEMPTS = 8;

function isLocalRequest(headers: Headers) {
  const forwardedHost = headers.get("x-forwarded-host");
  const hostHeader = headers.get("host");
  const host = (forwardedHost ?? hostHeader ?? "").toLowerCase();

  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

function generateInviteCode(length = DEFAULT_INVITE_CODE_LENGTH) {
  const bytes = randomBytes(length);
  let code = "";

  for (const byte of bytes) {
    code += INVITE_CODE_ALPHABET[byte % INVITE_CODE_ALPHABET.length];
  }

  return code;
}

export const inviteRouter = {
  createCode: publicProcedure
    .input(
      z
        .object({
          expiresInDays: z.number().int().positive().max(365).optional(),
          maxUses: z.number().int().positive().max(100).default(1),
        })
        .default({ maxUses: 1 }),
    )
    .mutation(async ({ ctx, input }) => {
      const isDevelopment = env.NODE_ENV === "development";
      const publicWebUrl = env.PUBLIC_WEB_URL;
      const isLocalPublicWebUrl =
        publicWebUrl.includes("localhost") ||
        publicWebUrl.includes("127.0.0.1");

      if (
        !isDevelopment ||
        !isLocalPublicWebUrl ||
        !isLocalRequest(ctx.headers)
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Invite code creation is only enabled for local development.",
        });
      }

      const expiresAt = input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
        : null;

      for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
        const code = generateInviteCode();

        try {
          await ctx.db.insert(inviteCode).values({
            code,
            expiresAt,
            maxUses: input.maxUses,
          });

          return {
            code,
            expiresAt,
            invitePath: `/invite?code=${code}`,
            inviteUrl: `${publicWebUrl}/invite?code=${code}`,
            maxUses: input.maxUses,
          };
        } catch {}
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Unable to create invite code. Please try again.",
      });
    }),
} satisfies TRPCRouterRecord;
