import { withAuth } from "~/app/_guards/page-guards";
import { GraphExplorer } from "../graph/_components/graph-explorer";

export default withAuth(async function ExplorePage() {
  return <GraphExplorer />;
});
