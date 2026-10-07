import { withAuth } from "~/app/_guards/page-guards";
import { GraphExplorer } from "./_components/graph-explorer";

export default withAuth(async function GraphPage() {
  return <GraphExplorer />;
});
