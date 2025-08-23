import Link from "next/link";
import { useAuthModal } from "~/components/auth/auth-modal-provider";
import { Button } from "~/components/ui/button";

const SECONDARY_CANCEL_URL = "/";

export function SecondaryCtaButton() {
  const { setCancelUrl } = useAuthModal();
  return (
    <Button
      asChild
      type="submit"
      size="lg"
      variant="outline"
      className="relative z-10 w-full bg-black px-8 py-4 text-lg text-white transition-all duration-200 hover:scale-105 hover:bg-gray-800 sm:w-40"
      onClick={() => {
        setCancelUrl(SECONDARY_CANCEL_URL);
      }}
    >
      <Link href="/auth/sign-in">
        <span className="font-semibold">Sign in</span>
      </Link>
    </Button>
  );
}
