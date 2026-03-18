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
