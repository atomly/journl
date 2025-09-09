import { redirect } from "next/navigation";
import { getUser } from "~/auth/server";

export default async function PaymentCancelPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const user = await getUser();

  // TODO: handle any user subscription related to the user
  console.log("[stripe/success]", user);

  redirect(params.redirect || "/");
}
