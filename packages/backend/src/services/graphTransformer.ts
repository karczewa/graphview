import neo4j, { type QueryResult, type Node, type Relationship, type Path, isInt } from 'neo4j-driver';
import type { GraphData, GraphNode, GraphEdge } from '../types.js';

/** Convert neo4j.Integer and nested values to plain JS types */
function serializeValue(v: unknown): unknown {
  if (isInt(v)) return v.toNumber();
  if (Array.isArray(v)) return v.map(serializeValue);
  if (v !== null && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, serializeValue(val)]),
    );
  }
  return v;
}

function serializeProperties(props: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(props).map(([k, v]) => [k, serializeValue(v)]),
  );
}

function addNode(raw: Node, map: Map<string, GraphNode>) {
  const id = raw.elementId;
  if (!map.has(id)) {
    map.set(id, {
      id,
      labels: raw.labels,
      properties: serializeProperties(raw.properties as Record<string, unknown>),
      primaryLabel: raw.labels[0] ?? 'Unknown',
    });
  }
}

function addRelationship(raw: Relationship, map: Map<string, GraphEdge>) {
  const id = raw.elementId;
  if (!map.has(id)) {
    map.set(id, {
      id,
      source: raw.startNodeElementId,
      target: raw.endNodeElementId,
      type: raw.type,
      properties: serializeProperties(raw.properties as Record<string, unknown>),
    });
  }
}

function extractValue(
  val: unknown,
  nodesMap: Map<string, GraphNode>,
  edgesMap: Map<string, GraphEdge>,
) {
  if (neo4j.isNode(val)) {
    addNode(val as Node, nodesMap);
  } else if (neo4j.isRelationship(val)) {
    addRelationship(val as Relationship, edgesMap);
  } else if (neo4j.isPath(val)) {
    const path = val as Path;
    addNode(path.start as Node, nodesMap);
    addNode(path.end as Node, nodesMap);
    for (const segment of path.segments) {
      addNode(segment.start as Node, nodesMap);
      addNode(segment.end as Node, nodesMap);
      addRelationship(segment.relationship as Relationship, edgesMap);
    }
  } else if (Array.isArray(val)) {
    for (const item of val) extractValue(item, nodesMap, edgesMap);
  }
}

export function transformQueryResult(result: QueryResult, queryTimeMs: number): GraphData {
  const nodesMap = new Map<string, GraphNode>();
  const edgesMap = new Map<string, GraphEdge>();

  for (const record of result.records) {
    for (const key of record.keys) {
      extractValue(record.get(key), nodesMap, edgesMap);
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
