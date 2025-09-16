import { redirect } from "next/navigation";

export default async function PaymentCancelPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  redirect(params.redirect || "/");
}
