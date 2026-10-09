import { getSession } from "~/auth/server";
import { ExplorePageScroll } from "./_components/explore-page-scroll";
import { ExploreStateProvider } from "./_components/explore-state-provider";

export default async function ExploreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  return (
    <ExploreStateProvider owner={session?.user.id}>
      <ExplorePageScroll>{children}</ExplorePageScroll>
    </ExploreStateProvider>
  );
}
