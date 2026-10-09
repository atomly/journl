declare module "ngraph.leiden" {
  import type { Graph } from "ngraph.graph";
  export function detectClusters(
    graph: Graph<undefined, { weight: number }>,
    options: {
      quality: "cpm";
      resolution: number;
      randomSeed: number;
      refine: boolean;
    },
  ): { getCommunities(): Map<number, string[]> };
}
