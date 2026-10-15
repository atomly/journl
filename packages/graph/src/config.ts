/** Version changes invalidate snapshots. CPM avoids global modularity's resolution limit. */
export const ALGORITHM_VERSION = "leiden-cpm-v3";
export const CLUSTER_CONFIG = {
  directWeight: 3,
  relatedLimit: 3,
  resolution: 0.5,
  seed: 42,
  sharedWeightCap: 1,
  sourceMaxDegree: 20,
} as const;
