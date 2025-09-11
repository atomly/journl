import { redirect } from "next/navigation";
import { getUser } from "~/auth/server";

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const user = await getUser();

  console.log("[stripe/success]", user);

  redirect(params.redirect || "/");
}
