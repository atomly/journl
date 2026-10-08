import createGraph from "ngraph.graph";
import { detectClusters } from "ngraph.leiden";

import { CLUSTER_CONFIG } from "./config";

export { ALGORITHM_VERSION, CLUSTER_CONFIG } from "./config";
export type ClusterNote = {
  id: string;
  title: string;
  kind: "page" | "journal";
  href: string;
  updatedAt: string;
};
export type ClusterReference = {
  id: string;
  source: string;
  target?: string | null;
  sourceKey?: string | null;
  url?: string | null;
};
export type ClusterCandidate = {
  primaryDocumentIds: string[];
  evidenceByDocument: Record<string, string[]>;
  representativeDocumentIds: string[];
  generatedName: string;
  lastActivity: string;
  related: { documentId: string; evidenceIds: string[] }[];
  sources: { key: string; url: string; documentCount: number }[];
};

export function buildClusters(
  notes: ClusterNote[],
  references: ClusterReference[],
): ClusterCandidate[] {
  const byId = new Map(notes.map((n) => [n.id, n]));
  const direct = new Map<string, Set<string>>();
  const shared = new Map<string, { count: number; weight: number }>();
  const sources = new Map<string, { url: string; documents: Set<string> }>();
  const pair = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  for (const r of references) {
    if (!byId.has(r.source)) continue;
    if (r.target && byId.has(r.target) && r.source !== r.target) {
      const key = pair(r.source, r.target);
      const evidence = direct.get(key) ?? new Set<string>();
      evidence.add(r.id);
      direct.set(key, evidence);
    } else if (r.sourceKey && r.url) {
      const source = sources.get(r.sourceKey) ?? {
        documents: new Set<string>(),
        url: r.url,
      };
      source.documents.add(r.source);
      sources.set(r.sourceKey, source);
    }
  }
  for (const source of sources.values()) {
    const ids = [...source.documents].sort();
    if (ids.length < 2 || ids.length > CLUSTER_CONFIG.sourceMaxDegree) continue;
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const key = pair(ids[i]!, ids[j]!);
        const previous = shared.get(key) ?? { count: 0, weight: 0 };
        previous.count++;
        previous.weight += 1 / (ids.length - 1);
        shared.set(key, previous);
      }
  }
  const graph = createGraph<undefined, { weight: number }>();
  const weights = new Map<string, number>();
  for (const key of new Set([...direct.keys(), ...shared.keys()])) {
    const evidence = shared.get(key);
    const weight =
      (direct.has(key) ? CLUSTER_CONFIG.directWeight : 0) +
      (evidence && evidence.count >= 2
        ? Math.min(CLUSTER_CONFIG.sharedWeightCap, evidence.weight)
        : 0);
    if (weight > 0) weights.set(key, weight);
  }
  // Canonical insertion order makes the seeded result independent of database order.
  for (const id of [...byId.keys()].sort()) graph.addNode(id);
  for (const [key, weight] of [...weights].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const [a, b] = key.split("|");
    graph.addLink(a!, b!, { weight });
  }
  const partition = detectClusters(graph, {
    quality: "cpm",
    randomSeed: CLUSTER_CONFIG.seed,
    refine: true,
    resolution: CLUSTER_CONFIG.resolution,
  });
  const candidates: ClusterCandidate[] = [
    ...partition.getCommunities().values(),
  ]
    .filter((ids) => ids.length > 1)
    .map((ids) => {
      const members = new Set(ids);
      const strength = new Map(ids.map((id) => [id, 0]));
      // Scan local adjacency rather than all global edges for each community.
      for (const id of ids)
        graph.forEachLinkedNode(id, (node, link) => {
          if (members.has(String(node.id)))
            strength.set(id, strength.get(id)! + link.data.weight);
        });
      const representatives = [...ids]
        .sort((a, b) => {
          const na = byId.get(a)!;
          const nb = byId.get(b)!;
          return (
            Number(nb.kind === "page" && !!nb.title.trim()) -
              Number(na.kind === "page" && !!na.title.trim()) ||
            strength.get(b)! - strength.get(a)! ||
            nb.updatedAt.localeCompare(na.updatedAt) ||
            a.localeCompare(b)
          );
        })
        .slice(0, 3);
      const lastActivity = ids.reduce(
        (latest, id) =>
          byId.get(id)!.updatedAt > latest ? byId.get(id)!.updatedAt : latest,
        "",
      );
      const named = representatives
        .map((id) => byId.get(id)!)
        .find((n) => n.kind === "page" && n.title.trim());
      const month = new Intl.DateTimeFormat("en", {
        month: "long",
        timeZone: "UTC",
        year: "numeric",
      }).format(new Date(lastActivity));
      return {
        evidenceByDocument: {},
        generatedName: named?.title.trim() ?? `Notes around ${month}`,
        lastActivity,
        primaryDocumentIds: [...ids].sort(),
        related: [],
        representativeDocumentIds: representatives,
        sources: [],
      };
    })
    .sort((a, b) =>
      a.primaryDocumentIds[0]!.localeCompare(b.primaryDocumentIds[0]!),
    );
  const primary = new Map<string, number>();
  candidates.forEach((c, i) => {
    for (const id of c.primaryDocumentIds) primary.set(id, i);
  });
  const relatedEvidence = new Map<
    string,
    Map<number, { members: Set<string>; ids: Set<string> }>
  >();
  for (const r of references) {
    if (
      !r.target ||
      r.source === r.target ||
      !byId.has(r.source) ||
      !byId.has(r.target)
    )
      continue;
    for (const [note, member] of [
      [r.source, r.target],
      [r.target, r.source],
    ]) {
      const cluster = primary.get(member!);
      if (cluster === undefined || primary.get(note!) === cluster) continue;
      const groups = relatedEvidence.get(note!) ?? new Map();
      const evidence = groups.get(cluster) ?? {
        ids: new Set<string>(),
        members: new Set<string>(),
      };
      evidence.members.add(member!);
      evidence.ids.add(r.id);
      groups.set(cluster, evidence);
      relatedEvidence.set(note!, groups);
    }
  }
  for (const [documentId, groups] of relatedEvidence) {
    const eligible = [...groups]
      .filter(([, e]) => e.members.size >= 2)
      .sort(([a, ea], [b, eb]) => eb.members.size - ea.members.size || a - b)
      .slice(0, CLUSTER_CONFIG.relatedLimit);
    for (const [i, e] of eligible)
      candidates[i]!.related.push({
        documentId,
        evidenceIds: [...e.ids].sort().slice(0, 3),
      });
  }
  // Invert membership once: O(references + memberships), including high-degree sources.
  const membership = new Map<string, number[]>();
  candidates.forEach((c, i) => {
    for (const id of [
      ...c.primaryDocumentIds,
      ...c.related.map((r) => r.documentId),
    ]) {
      const list = membership.get(id) ?? [];
      list.push(i);
      membership.set(id, list);
    }
  });
  for (const [key, source] of sources) {
    const counts = new Map<number, number>();
    for (const id of source.documents)
      for (const i of membership.get(id) ?? [])
        counts.set(i, (counts.get(i) ?? 0) + 1);
    for (const [i, documentCount] of counts)
      candidates[i]!.sources.push({ documentCount, key, url: source.url });
  }
  const sourceGroups = new Map<string, Set<number>>();
  for (const [key, source] of sources) {
    if (source.documents.size > CLUSTER_CONFIG.sourceMaxDegree) continue;
    const counts = new Map<number, number>();
    for (const id of source.documents) {
      const group = primary.get(id);
      if (group !== undefined) counts.set(group, (counts.get(group) ?? 0) + 1);
    }
    sourceGroups.set(
      key,
      new Set(
        [...counts].filter(([, count]) => count >= 2).map(([group]) => group),
      ),
    );
  }
  const addEvidence = (group: number, id: string, evidenceId: string) => {
    const evidence = candidates[group]!.evidenceByDocument[id] ?? [];
    if (evidence.length < 3 && !evidence.includes(evidenceId))
      evidence.push(evidenceId);
    candidates[group]!.evidenceByDocument[id] = evidence;
  };
  const orderedReferences = [...references].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const r of orderedReferences) {
    const group = primary.get(r.source);
    if (
      group !== undefined &&
      r.target &&
      r.target !== r.source &&
      primary.get(r.target) === group
    ) {
      addEvidence(group, r.source, r.id);
      addEvidence(group, r.target, r.id);
    }
  }
  for (const r of orderedReferences) {
    const group = primary.get(r.source);
    if (
      group !== undefined &&
      r.sourceKey &&
      r.url &&
      sourceGroups.get(r.sourceKey)?.has(group)
    )
      addEvidence(group, r.source, r.id);
  }
  return candidates;
}

export function matchClusterIdentities(
  candidates: ClusterCandidate[],
  previous: { id: string; members: string[]; name: string }[],
) {
  const oldByMember = new Map<string, number[]>();
  previous.forEach((c, i) => {
    for (const id of c.members) {
      const list = oldByMember.get(id) ?? [];
      list.push(i);
      oldByMember.set(id, list);
    }
  });
  const overlaps: { next: number; old: number; score: number }[] = [];
  candidates.forEach((c, next) => {
    const intersections = new Map<number, number>();
    for (const id of c.primaryDocumentIds)
      for (const old of oldByMember.get(id) ?? [])
        intersections.set(old, (intersections.get(old) ?? 0) + 1);
    for (const [old, intersection] of intersections)
      overlaps.push({
        next,
        old,
        score:
          intersection /
          (c.primaryDocumentIds.length +
            previous[old]!.members.length -
            intersection),
      });
  });
  overlaps.sort(
    (a, b) =>
      b.score - a.score ||
      previous[a.old]!.id.localeCompare(previous[b.old]!.id) ||
      a.next - b.next,
  );
  const assigned = new Map<number, { id: string; name: string }>();
  const used = new Set<number>();
  for (const entry of overlaps)
    if (
      entry.score >= 0.5 &&
      !assigned.has(entry.next) &&
      !used.has(entry.old)
    ) {
      assigned.set(entry.next, {
        id: previous[entry.old]!.id,
        name: previous[entry.old]!.name,
      });
      used.add(entry.old);
    }
  return { assigned, overlaps };
}
