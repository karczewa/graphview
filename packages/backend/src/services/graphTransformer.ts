import type { GraphData, GraphNode, GraphEdge, Neo4jRawResponse } from '../types.js';

export function transformGraphResponse(raw: Neo4jRawResponse, queryTimeMs: number): GraphData {
  const nodesMap = new Map<string, GraphNode>();
  const edgesMap = new Map<string, GraphEdge>();

  for (const result of raw.results) {
    for (const row of result.data) {
      const graph = row.graph;
      if (!graph) continue;

      for (const rawNode of graph.nodes) {
        if (!nodesMap.has(rawNode.id)) {
          nodesMap.set(rawNode.id, {
            id: rawNode.id,
            labels: rawNode.labels,
            properties: rawNode.properties,
            primaryLabel: rawNode.labels[0] ?? 'Unknown',
          });
        }
      }

      for (const rawRel of graph.relationships) {
        if (!edgesMap.has(rawRel.id)) {
          edgesMap.set(rawRel.id, {
            id: rawRel.id,
            source: rawRel.startNode,
            target: rawRel.endNode,
            type: rawRel.type,
            properties: rawRel.properties,
          });
        }
      }
    }
  }

  const nodes = Array.from(nodesMap.values());
  const edges = Array.from(edgesMap.values());

  return {
    nodes,
    edges,
    metadata: {
      nodeLabels: [...new Set(nodes.flatMap((n) => n.labels))],
      edgeTypes: [...new Set(edges.map((e) => e.type))],
      totalNodes: nodes.length,
      totalEdges: edges.length,
      queryTimeMs,
    },
  };
}

/** Extract a flat string[] from a single-column row result */
export function extractStringColumn(raw: Neo4jRawResponse, columnIndex = 0): string[] {
  const values: string[] = [];
  for (const result of raw.results) {
    for (const row of result.data) {
      const val = row.row?.[columnIndex];
      if (typeof val === 'string') values.push(val);
    }
  }
  return values;
}
