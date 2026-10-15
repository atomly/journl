import { sql } from "@acme/db";
import { TreeEdge, TreeNode } from "@acme/db/schema";
import type { TRPCContext } from "../trpc";

/** Read one owned ancestor chain, never the owner's entire Library. Cycles terminate. */
export async function ancestorNodeIds(
  db: TRPCContext["db"],
  userId: string,
  nodeId: string,
) {
  const rows = await db.execute<{ id: string }>(sql`
    WITH RECURSIVE path AS (
      SELECT ${TreeNode.id} AS id, ARRAY[${TreeNode.id}] AS visited
      FROM ${TreeNode}
      WHERE ${TreeNode.id} = ${nodeId} AND ${TreeNode.user_id} = ${userId}
      UNION ALL
      SELECT parent.id, path.visited || parent.id
      FROM path
      JOIN ${TreeEdge} edge ON edge.node_id = path.id AND edge.user_id = ${userId}
      JOIN ${TreeNode} parent ON parent.id = edge.parent_node_id AND parent.user_id = ${userId}
      WHERE NOT parent.id = ANY(path.visited) AND cardinality(path.visited) < 128
    ) SELECT id FROM path ORDER BY cardinality(visited)
  `);
  return rows.map((row) => row.id);
}
