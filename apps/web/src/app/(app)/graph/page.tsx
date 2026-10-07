import { redirect } from "next/navigation";
import { withAuth } from "~/app/_guards/page-guards";

export default withAuth(async function GraphPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value)
      ? value
      : value === undefined
        ? []
        : [value])
      params.append(key, item);
  }
  redirect(`/explore${params.size ? `?${params.toString()}` : ""}`);
});
