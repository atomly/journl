/** Shared contracts for tRPC and future agent tools; implementations are independently bounded. */

export { getCluster, listClusters, listRecentNotes } from "./discovery-service";
export {
  getClusterMap,
  listRelatedThreads,
  listThreadConnections,
} from "./map-service";
export {
  listClusterMembers,
  listClusterSources,
  listSourceContexts,
} from "./members-service";
export { type ExploreInput, exploreContext, loadNotes } from "./query-context";
