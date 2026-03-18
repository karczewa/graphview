import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3';
import { useGraphStore } from '../../store/graphStore.ts';
import { useMapping, type VisualConfig } from '../../store/mappingStore.ts';
import { useUiStore } from '../../store/uiStore.ts';
import { getAnchorPoint, getShapePath, type ShapeType } from '../shapes/index.ts';
import type { GraphNode, GraphEdge } from '../../types.ts';
import { canvasActions } from '../../lib/canvasActions.ts';
import type { LayoutAlgorithm } from '../../store/uiStore.ts';

// ── D3 simulation types ────────────────────────────────────────────────────────

interface SimNode extends SimulationNodeDatum, GraphNode {}

interface SimEdge extends SimulationLinkDatum<SimNode> {
  id: string;
  type: string;
  properties: Record<string, unknown>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: VisualConfig = { color: '#94a3b8', shape: 'circle', size: 40 };

function appendShape(
  g: d3.Selection<SVGGElement, SimNode, SVGGElement, unknown>,
  config: VisualConfig,
  selected: boolean,
  pinned: boolean,
) {
  const r = config.size / 2;
  const stroke = selected ? '#f59e0b' : '#1e293b';
  const strokeW = selected ? 3 : 1.5;

  if (config.shape === 'circle') {
    g.append('circle').attr('class', 'node-shape').attr('r', r)
      .attr('fill', config.color).attr('stroke', stroke).attr('stroke-width', strokeW);
  } else if (config.shape === 'ellipse') {
    g.append('ellipse').attr('class', 'node-shape').attr('rx', r * 1.5).attr('ry', r)
      .attr('fill', config.color).attr('stroke', stroke).attr('stroke-width', strokeW);
  } else {
    g.append('path').attr('class', 'node-shape').attr('d', getShapePath(config.shape, r))
      .attr('fill', config.color).attr('stroke', stroke).attr('stroke-width', strokeW);
  }

  // Pin indicator: small amber dot above the node
  if (pinned) {
    g.append('circle').attr('class', 'pin-dot')
      .attr('r', 4).attr('cy', -r - 5)
      .attr('fill', '#f59e0b').attr('stroke', '#1e293b').attr('stroke-width', 1);
  }
}

// Compute opacity based on highlight + search (search takes priority)
function nodeOpacity(
  d: SimNode,
  highlightedLabel: string | null,
  searchQuery: string,
): number {
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    const matches =
      d.labels.some((l) => l.toLowerCase().includes(q)) ||
      Object.values(d.properties).some((v) => String(v).toLowerCase().includes(q));
    return matches ? 1 : 0.08;
  }
  if (highlightedLabel) return d.primaryLabel === highlightedLabel ? 1 : 0.15;
  return 1;
}

// Assign fixed positions for non-force layouts
function applyLayout(
  simNodes: SimNode[],
  layout: LayoutAlgorithm,
  cx: number,
  cy: number,
) {
  const n = simNodes.length;
  if (n === 0) return;

  if (layout === 'circular') {
    const radius = Math.min(cx, cy) * 0.75;
    simNodes.forEach((d, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      d.fx = cx + radius * Math.cos(angle);
      d.fy = cy + radius * Math.sin(angle);
      d.x = d.fx;
      d.y = d.fy;
    });
  } else if (layout === 'grid') {
    const cols = Math.ceil(Math.sqrt(n));
    const spacing = Math.min(120, Math.max(60, Math.min(cx, cy) * 1.5 / cols));
    const totalW = (cols - 1) * spacing;
    const rows = Math.ceil(n / cols);
    const totalH = (rows - 1) * spacing;
    simNodes.forEach((d, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      d.fx = cx - totalW / 2 + col * spacing;
      d.fy = cy - totalH / 2 + row * spacing;
      d.x = d.fx;
      d.y = d.fy;
    });
  } else if (layout === 'radial') {
    // First node at center, rest in rings of increasing radius
    simNodes[0].fx = cx;
    simNodes[0].fy = cy;
    simNodes[0].x = cx;
    simNodes[0].y = cy;
    const ringSize = 8;
    let placed = 1;
    let ring = 1;
    while (placed < n) {
      const inRing = Math.min(ringSize * ring, n - placed);
      const radius = ring * 120;
      for (let j = 0; j < inRing; j++) {
        const angle = (2 * Math.PI * j) / inRing - Math.PI / 2;
        const px = cx + radius * Math.cos(angle);
        const py = cy + radius * Math.sin(angle);
        simNodes[placed].fx = px;
        simNodes[placed].fy = py;
        simNodes[placed].x = px;
        simNodes[placed].y = py;
        placed++;
      }
      ring++;
    }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GraphCanvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const { nodes, edges } = useGraphStore();
  const { labelConfig } = useMapping();
  const {
    selectedNodeId, highlightedLabel, searchQuery,
    pinnedNodeIds, hiddenNodeIds, layoutAlgorithm,
    setSelectedNode, setContextMenu,
  } = useUiStore();

  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const simNodesRef  = useRef<SimNode[]>([]);
  const zoomRef      = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const applySelectionRef = useRef<(id: string | null) => void>(() => {});
  const applyOpacityRef   = useRef<(hl: string | null, sq: string) => void>(() => {});

  // ── Effect 1: rebuild ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width  = svgRef.current.clientWidth  || 800;
    const height = svgRef.current.clientHeight || 600;

    svg.selectAll('*').remove();

    const defs = svg.append('defs');
    defs.append('marker')
      .attr('id', 'arrow').attr('viewBox', '0 -5 10 10')
      .attr('refX', 10).attr('refY', 0)
      .attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
      .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', '#4b5563');

    // Filter hidden nodes
    const visibleNodes = nodes.filter((n) => !hiddenNodeIds.has(n.id));
    if (visibleNodes.length === 0) return;

    const g = svg.append('g');
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 8])
      .on('zoom', (e) => g.attr('transform', e.transform.toString()));
    svg.call(zoomBehavior);
    zoomRef.current = zoomBehavior;

    // Build sim nodes — restore positions; apply pin constraints
    const cx = width / 2, cy = height / 2;

    const simNodes: SimNode[] = visibleNodes.map((n) => {
      const saved   = positionsRef.current.get(n.id);
      const pinned  = pinnedNodeIds.has(n.id);
      return {
        ...n,
        x:  saved?.x,
        y:  saved?.y,
        fx: pinned && saved ? saved.x : undefined,
        fy: pinned && saved ? saved.y : undefined,
      };
    });
    simNodesRef.current = simNodes;

    const nodeById = new Map(simNodes.map((n) => [n.id, n]));

    const simEdges: SimEdge[] = edges
      .filter((e) => e.source !== e.target && nodeById.has(e.source) && nodeById.has(e.target))
      .map((e: GraphEdge) => ({ ...e }));

    const n      = simNodes.length;
    const sqrtN  = Math.sqrt(Math.max(1, n));

    // Apply fixed positions for non-force layouts
    if (layoutAlgorithm !== 'force') {
      applyLayout(simNodes, layoutAlgorithm, cx, cy);
    }

    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force('link', d3.forceLink<SimNode, SimEdge>(simEdges).id((d) => d.id)
        .distance(Math.min(200, Math.max(60, 1200 / sqrtN))))
      .force('charge', d3.forceManyBody<SimNode>()
        .strength(-Math.min(800, Math.max(150, 4000 / sqrtN))))
      .force('x', d3.forceX<SimNode>(cx).strength(Math.min(0.08, Math.max(0.01, n / 3000))))
      .force('y', d3.forceY<SimNode>(cy).strength(Math.min(0.08, Math.max(0.01, n / 3000))))
      .force('collision', d3.forceCollide<SimNode>(Math.min(60, Math.max(25, 400 / sqrtN))))
      .velocityDecay(0.65)
      .alphaDecay(0.04);

    // Non-force layouts: stop simulation after first tick so nodes stay in place
    if (layoutAlgorithm !== 'force') {
      simulation.stop();
      simulation.tick();
    }

    const linkGroup = g.append('g').attr('class', 'links');
    const nodeGroup = g.append('g').attr('class', 'nodes');

    const linkEl = linkGroup.selectAll<SVGLineElement, SimEdge>('line').data(simEdges).join('line')
      .attr('stroke', (d) => useMapping.getState().edgeConfig[d.type]?.color ?? '#4b5563')
      .attr('stroke-width', (d) => useMapping.getState().edgeConfig[d.type]?.width ?? 1.5)
      .attr('marker-end', 'url(#arrow)');

    const edgeLabelEl = linkGroup.selectAll<SVGTextElement, SimEdge>('text').data(simEdges).join('text')
      .attr('text-anchor', 'middle').attr('fill', '#6b7280').attr('font-size', '9px')
      .attr('pointer-events', 'none').text((d) => d.type);

    const curSelectedId  = useUiStore.getState().selectedNodeId;
    const curHighlight   = useUiStore.getState().highlightedLabel;
    const curSearch      = useUiStore.getState().searchQuery;

    const nodeEl = nodeGroup.selectAll<SVGGElement, SimNode>('g').data(simNodes).join('g')
      .attr('cursor', 'pointer')
      .attr('opacity', (d) => nodeOpacity(d, curHighlight, curSearch))
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(d.id === useUiStore.getState().selectedNodeId ? null : d.id);
      })
      .on('contextmenu', (event, d) => {
        event.preventDefault();
        event.stopPropagation();
        setContextMenu({ nodeId: d.id, x: event.clientX, y: event.clientY });
      })
      .call(
        d3.drag<SVGGElement, SimNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            // Keep pinned; release unpinned
            if (!useUiStore.getState().pinnedNodeIds.has(d.id)) {
              d.fx = null; d.fy = null;
            }
          }),
      );

    nodeEl.each(function (d) {
      const config = labelConfig[d.primaryLabel] ?? DEFAULT_CONFIG;
      appendShape(
        d3.select(this) as unknown as d3.Selection<SVGGElement, SimNode, SVGGElement, unknown>,
        config,
        d.id === curSelectedId,
        pinnedNodeIds.has(d.id),
      );
    });

    nodeEl.append('text')
      .attr('text-anchor', 'middle').attr('fill', '#e2e8f0').attr('font-size', '11px')
      .attr('dy', (d) => (labelConfig[d.primaryLabel]?.size ?? DEFAULT_CONFIG.size) / 2 + 13)
      .attr('pointer-events', 'none')
      .text((d) => (d.properties['name'] as string) ?? d.primaryLabel);

    svg.on('click', () => setSelectedNode(null));

    // ── Bridge refs ────────────────────────────────────────────────────────────
    applySelectionRef.current = (id) => {
      nodeEl.each(function (d) {
        const sel = d.id === id;
        d3.select(this).select('.node-shape')
          .attr('stroke', sel ? '#f59e0b' : '#1e293b')
          .attr('stroke-width', sel ? 3 : 1.5);
      });
    };

    applyOpacityRef.current = (hl, sq) => {
      nodeEl.attr('opacity', (d) => nodeOpacity(d, hl, sq));
    };

    // ── Tick function (shared by live simulation and static layouts) ───────────
    const tick = () => {
      linkEl.each(function (d) {
        const src = d.source as SimNode, tgt = d.target as SimNode;
        const sx = src.x ?? 0, sy = src.y ?? 0, tx = tgt.x ?? 0, ty = tgt.y ?? 0;
        const angle = Math.atan2(ty - sy, tx - sx);
        const srcCfg = labelConfig[src.primaryLabel] ?? DEFAULT_CONFIG;
        const tgtCfg = labelConfig[tgt.primaryLabel] ?? DEFAULT_CONFIG;
        const sa = getAnchorPoint(angle, srcCfg.shape as ShapeType, srcCfg.size / 2);
        const ta = getAnchorPoint(angle + Math.PI, tgtCfg.shape as ShapeType, tgtCfg.size / 2);
        d3.select(this)
          .attr('x1', sx + sa.x).attr('y1', sy + sa.y)
          .attr('x2', tx + ta.x).attr('y2', ty + ta.y);
      });

      edgeLabelEl
        .attr('x', (d) => (((d.source as SimNode).x ?? 0) + ((d.target as SimNode).x ?? 0)) / 2)
        .attr('y', (d) => (((d.source as SimNode).y ?? 0) + ((d.target as SimNode).y ?? 0)) / 2);

      nodeEl.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    };

    if (layoutAlgorithm !== 'force') {
      // Static layout: render once immediately
      tick();
    } else {
      simulation.on('tick', tick);
    }

    return () => {
      simulation.stop();
      for (const nd of simNodes) {
        if (nd.x !== undefined && nd.y !== undefined) {
          positionsRef.current.set(nd.id, { x: nd.x, y: nd.y });
        }
      }
      svg.on('click', null);
      applySelectionRef.current = () => {};
      applyOpacityRef.current   = () => {};
    };
  }, [nodes, edges, labelConfig, pinnedNodeIds, hiddenNodeIds, layoutAlgorithm, setSelectedNode, setContextMenu]);

  // ── Effect 2: selection ────────────────────────────────────────────────────
  useEffect(() => { applySelectionRef.current(selectedNodeId); }, [selectedNodeId]);

  // ── Effect 3: opacity (highlight + search) ─────────────────────────────────
  useEffect(() => {
    applyOpacityRef.current(highlightedLabel, searchQuery);
  }, [highlightedLabel, searchQuery]);

  // ── Effect 4: register imperative canvas actions ───────────────────────────
  useEffect(() => {
    canvasActions.register('fitToScreen', () => {
      const svgEl = svgRef.current;
      const zoom  = zoomRef.current;
      if (!svgEl || !zoom) return;
      const simNodes = simNodesRef.current;
      if (simNodes.length === 0) return;

      const xs = simNodes.map((d) => d.x ?? 0);
      const ys = simNodes.map((d) => d.y ?? 0);
      const minX = Math.min(...xs) - 60;
      const maxX = Math.max(...xs) + 60;
      const minY = Math.min(...ys) - 60;
      const maxY = Math.max(...ys) + 60;

      const w = svgEl.clientWidth  || 800;
      const h = svgEl.clientHeight || 600;
      const scale = Math.min(0.9 * w / (maxX - minX), 0.9 * h / (maxY - minY), 4);
      const tx = w / 2 - scale * ((minX + maxX) / 2);
      const ty = h / 2 - scale * ((minY + maxY) / 2);

      d3.select(svgEl)
        .transition().duration(500)
        .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    });

    canvasActions.register('exportSVG', () => {
      const svgEl = svgRef.current;
      if (!svgEl) return;
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svgEl);
      const blob = new Blob([svgStr], { type: 'image/svg+xml' });
      const url  = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'graph.svg'; a.click();
      URL.revokeObjectURL(url);
    });

    canvasActions.register('exportPNG', () => {
      const svgEl = svgRef.current;
      if (!svgEl) return;
      const w = svgEl.clientWidth  || 800;
      const h = svgEl.clientHeight || 600;
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svgEl);
      const blob = new Blob([svgStr], { type: 'image/svg+xml' });
      const url  = URL.createObjectURL(blob);
      const img  = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = w * 2; canvas.height = h * 2; // 2× for retina
        const ctx = canvas.getContext('2d')!;
        ctx.scale(2, 2);
        ctx.fillStyle = '#030712'; // bg-gray-950
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png'); a.download = 'graph.png'; a.click();
      };
      img.src = url;
    });

    return () => {
      canvasActions.unregister('fitToScreen');
      canvasActions.unregister('exportSVG');
      canvasActions.unregister('exportPNG');
    };
  }, []);

  return (
    <svg ref={svgRef} className="w-full h-full bg-gray-950" style={{ display: 'block' }} />
  );
}
