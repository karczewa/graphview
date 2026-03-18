# GraphView

A web application that connects to a Neo4j graph database and renders its data as an interactive graph visualization. Node labels map to geometric shapes and domain properties map to colors, making complex graph data easy to read at a glance.

---

## Requirements

- [Node.js](https://nodejs.org/) 18 or newer
- A running Neo4j instance (local or remote)

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/karczewa/graphview.git
cd graphview
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create the environment file

Create a `.env` file in the root of the repository:

```
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
NEO4J_DATABASE=neo4j
```

| Variable | Description |
|----------|-------------|
| `NEO4J_URI` | Bolt connection URI to your Neo4j instance |
| `NEO4J_USER` | Neo4j username |
| `NEO4J_PASSWORD` | Neo4j password |
| `NEO4J_DATABASE` | Database name (usually `neo4j`) |

Optional variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_PORT` | `3001` | Port the backend listens on |
| `QUERY_MAX_LIMIT` | `500` | Maximum number of nodes returned per query |
| `REQUEST_TIMEOUT_MS` | `30000` | Neo4j query timeout in milliseconds |

### 4. Start the application

```bash
npm run dev
```

This starts both the backend (port 3001) and the frontend (port 5173) concurrently.

Open **http://localhost:5173** in your browser.

### 5. Verify the connection

Open **http://localhost:3001/api/health** — you should see:

```json
{ "status": "ok", "neo4jConnected": true }
```

If `neo4jConnected` is `false`, double-check your `.env` values and make sure Neo4j is reachable.

---

## Using the app

### Running queries

Type a Cypher query in the **query bar** at the top and press **Ctrl+Enter** (or click **Run**).

The query box expands automatically for multi-line queries. To load an initial overview of your graph:

```cypher
MATCH (a)-[r]->(b) RETURN a, r, b LIMIT 100
```

To load only nodes without relationships:

```cypher
MATCH (n) RETURN n LIMIT 200
```

Previously run queries are saved — click **▾ History** to access them.

---

### Visual mapping

GraphView automatically assigns visuals based on node data:

| Node label | Shape |
|------------|-------|
| `Table` | Square |
| `View` | Hexagon |
| `Procedure` | Diamond |
| anything else | Circle |

**Color** is assigned automatically per unique `domain` property value using a 20-color palette. Nodes without a `domain` property are grey.

---

### Legend (left panel)

The left panel shows a legend for the current graph:

- **Color — domain**: one entry per unique domain value with its assigned color
- **Shape — label**: shows which of Table / View / Procedure are present

**Click any legend entry** to highlight matching nodes and dim everything else. Click again or use **✕ Clear highlight** to reset.

---

### Interacting with the graph

| Action | How |
|--------|-----|
| Pan | Click and drag on empty space |
| Zoom | Scroll wheel |
| Select node | Click a node |
| Deselect | Click empty space or press `Escape` |
| Drag node | Click and drag a node |
| Pin node | Right-click → Pin, or select and press `P` |
| Hide node | Right-click → Hide, or select and press `H` / `Delete` |
| Expand neighbors | Right-click → Expand, or use the Details panel |
| Fit to screen | Click **⊡ Fit** in the toolbar or press `F` |

---

### Details panel (right panel)

Click any node to open its details:

- **Labels** — Neo4j labels on the node
- **Properties** — all key-value properties
- **Expand neighbors** — load 1, 2, or 3 hops of connected nodes into the current graph

---

### Layout algorithms

Use the **layout dropdown** in the toolbar to switch between:

| Layout | Description |
|--------|-------------|
| Force | Physics-based, groups connected nodes naturally |
| Circular | All nodes evenly spaced on a circle |
| Grid | Nodes arranged in a square grid |
| Radial | One node at center, rest in concentric rings |

---

### Export

- **PNG** — exports the current canvas as a high-resolution image
- **SVG** — exports the current canvas as a vector graphic

---

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+Enter` | Run query |
| `F` | Fit graph to screen |
| `Escape` | Deselect node |
| `H` or `Delete` | Hide selected node |
| `P` | Pin / unpin selected node |

---

## Project structure

```
graphview/
├── packages/
│   ├── frontend/       # React + Vite app (port 5173)
│   └── backend/        # Express API server (port 3001)
├── .env                # Your local environment variables (not committed)
├── .env.example        # Template for environment variables
└── package.json        # Root workspace config
```
