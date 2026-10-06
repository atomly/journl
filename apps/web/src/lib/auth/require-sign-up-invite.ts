import { redirect } from "next/navigation";
import { normalizeInviteCode } from "~/components/auth/invite-code";
import { isInviteCodeAvailable } from "./available-invite-code";

export async function requireSignUpInvite(pathname: string, value?: string) {
  if (pathname !== "sign-up") return undefined;
  const code = normalizeInviteCode(value);
  if (!code) redirect("/invite");
  if (!(await isInviteCodeAvailable(code))) {
    redirect(`/invite?code=${encodeURIComponent(code)}`);
  }
  return code;
}
