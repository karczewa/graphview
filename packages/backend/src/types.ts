// ── Normalized graph types (what we send to the frontend) ───────────────────

export interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
  primaryLabel: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  properties: Record<string, unknown>;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    nodeLabels: string[];
    edgeTypes: string[];
    totalNodes: number;
    totalEdges: number;
    queryTimeMs: number;
  };
}

// ── Neo4j raw HTTP response types ────────────────────────────────────────────

export interface Neo4jRawNode {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
}

export interface Neo4jRawRelationship {
  id: string;
  type: string;
  startNode: string;
  endNode: string;
  properties: Record<string, unknown>;
}

export interface Neo4jRawGraph {
  nodes: Neo4jRawNode[];
  relationships: Neo4jRawRelationship[];
}

export interface Neo4jRawResult {
  columns: string[];
  data: Array<{ graph?: Neo4jRawGraph; row?: unknown[] }>;
}

export interface Neo4jRawResponse {
  results: Neo4jRawResult[];
  errors: Array<{ code: string; message: string }>;
}

// ── API response types ────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  code: string;
}

export interface HealthResponse {
  status: 'ok';
  neo4jConnected: boolean;
}

export interface SchemaResponse {
  nodeLabels: string[];
  relationshipTypes: string[];
  propertyKeys: Record<string, string[]>;
}
