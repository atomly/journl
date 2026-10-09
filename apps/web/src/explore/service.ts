/** Shared contracts for tRPC and future agent tools; implementations are independently bounded. */
export { exploreContext, loadNotes, type ExploreInput } from "./query-context";
export { listClusters, getCluster, listRecentNotes } from "./discovery-service";
export {
  listClusterMembers,
  listClusterSources,
  listSourceContexts,
} from "./members-service";
export {
  getClusterMap,
  listRelatedThreads,
  listThreadConnections,
} from "./map-service";
