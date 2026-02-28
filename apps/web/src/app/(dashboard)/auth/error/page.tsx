import Link from "next/link";
import { withoutAuth } from "~/app/_guards/page-guards";
import { Button } from "~/components/ui/button";

type SearchParams = Record<string, string | string[] | undefined>;

async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const errorCode = getSearchParam(params.error) ?? "unknown_error";
  const { description, title } = getErrorCopy(errorCode);

  return (
    <div className="mx-auto w-full max-w-lg rounded-2xl border bg-card/80 p-6 text-card-foreground shadow-xl">
      <p className="text-primary text-xs uppercase">Error</p>
      <h1 className="mt-2 text-3xl">{title}</h1>
      <p className="mt-3 text-muted-foreground">{description}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}

export default withoutAuth(AuthErrorPage);

function getSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function getErrorCopy(errorCode: string) {
  switch (errorCode) {
    case "unable_to_create_user":
      return {
        description:
          "We couldn't finish creating your account. This invite may be invalid, expired, or already used.",
        title: "We couldn't create your account",
      };
    case "invite_code_required":
      return {
        description:
          "An invite code is required for new account sign-up. Enter your code and try again.",
        title: "Invite code required",
      };
    case "invite_code_invalid":
      return {
        description:
          "That invite code is invalid, expired, disabled, or fully used. Please ask for a new code.",
        title: "Invite code not valid",
      };
    default:
      return {
        description:
          "Something went wrong while signing you in. Please try again or return to the home page.",
        title: "Authentication error",
      };
  }
}
