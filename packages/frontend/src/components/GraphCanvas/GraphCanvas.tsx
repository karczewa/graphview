import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3';
import { useGraphStore } from '../../store/graphStore.ts';
import { useMapping, type VisualConfig } from '../../store/mappingStore.ts';
import { useUiStore } from '../../store/uiStore.ts';
import { getAnchorPoint, getShapePath, type ShapeType } from '../shapes/index.ts';
import type { GraphNode, GraphEdge } from '../../types.ts';

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
) {
  const r = config.size / 2;
  const stroke = selected ? '#f59e0b' : '#1e293b';
  const strokeW = selected ? 3 : 1.5;

  if (config.shape === 'circle') {
    g.append('circle')
      .attr('class', 'node-shape')
      .attr('r', r)
      .attr('fill', config.color)
      .attr('stroke', stroke)
      .attr('stroke-width', strokeW);
  } else if (config.shape === 'ellipse') {
    g.append('ellipse')
      .attr('class', 'node-shape')
      .attr('rx', r * 1.5)
      .attr('ry', r)
      .attr('fill', config.color)
      .attr('stroke', stroke)
      .attr('stroke-width', strokeW);
  } else {
    g.append('path')
      .attr('class', 'node-shape')
      .attr('d', getShapePath(config.shape, r))
      .attr('fill', config.color)
      .attr('stroke', stroke)
      .attr('stroke-width', strokeW);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GraphCanvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const { nodes, edges } = useGraphStore();
  const { labelConfig } = useMapping();
  const { selectedNodeId, highlightedLabel, setSelectedNode } = useUiStore();

  // Saved node positions — persisted across rebuilds so layout is preserved
  // when new nodes are added (expand node) or mapping changes.
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Bridge refs: let lightweight effects update visuals without full rebuild.
  const applySelectionRef = useRef<(id: string | null) => void>(() => {});
  const applyHighlightRef = useRef<(label: string | null) => void>(() => {});

  // ── Effect 1: rebuild graph when data or mapping changes ────────────────────
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 600;

    svg.selectAll('*').remove();

    // Arrow marker
    const defs = svg.append('defs');
    defs.append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 10)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#4b5563');

    if (nodes.length === 0) return;

    // Zoom container
    const g = svg.append('g');
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.05, 8])
        .on('zoom', (e) => g.attr('transform', e.transform.toString())),
    );

    // Build simulation data — restore saved positions so layout is preserved
    const simNodes: SimNode[] = nodes.map((n) => {
      const saved = positionsRef.current.get(n.id);
      return { ...n, x: saved?.x, y: saved?.y };
    });
    const nodeById = new Map(simNodes.map((n) => [n.id, n]));

    const simEdges: SimEdge[] = edges
      .filter((e) => e.source !== e.target && nodeById.has(e.source) && nodeById.has(e.target))
      .map((e: GraphEdge) => ({ ...e }));

    const cx = width / 2;
    const cy = height / 2;

    // Scale forces by node count: fewer nodes → more spread; more nodes → tighter clusters.
    // sqrt(n) gives a natural curve that doesn't over-compress large graphs.
    const n = simNodes.length;
    const sqrtN = Math.sqrt(Math.max(1, n));
    const chargeStrength = -Math.min(800, Math.max(150, 4000 / sqrtN));
    const linkDistance   =  Math.min(200, Math.max(60,  1200 / sqrtN));
    const collisionR     =  Math.min(60,  Math.max(25,   400 / sqrtN));
    const centerStrength =  Math.min(0.08, Math.max(0.01, n / 3000));

    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force('link', d3.forceLink<SimNode, SimEdge>(simEdges).id((d) => d.id).distance(linkDistance))
      .force('charge', d3.forceManyBody<SimNode>().strength(chargeStrength))
      .force('x', d3.forceX<SimNode>(cx).strength(centerStrength))
      .force('y', d3.forceY<SimNode>(cy).strength(centerStrength))
      .force('collision', d3.forceCollide<SimNode>(collisionR))
      // Higher velocityDecay = more friction = settles faster without jitter.
      .velocityDecay(0.65)
      // Cool down quicker so the graph stops wiggling sooner.
      .alphaDecay(0.04);

    // Groups (links behind nodes)
    const linkGroup = g.append('g').attr('class', 'links');
    const nodeGroup = g.append('g').attr('class', 'nodes');

    // ── Links ──
    const linkEl = linkGroup
      .selectAll<SVGLineElement, SimEdge>('line')
      .data(simEdges)
      .join('line')
      .attr('stroke', (d) => useMapping.getState().edgeConfig[d.type]?.color ?? '#4b5563')
      .attr('stroke-width', (d) => useMapping.getState().edgeConfig[d.type]?.width ?? 1.5)
      .attr('marker-end', 'url(#arrow)');

    const edgeLabelEl = linkGroup
      .selectAll<SVGTextElement, SimEdge>('text')
      .data(simEdges)
      .join('text')
      .attr('text-anchor', 'middle')
      .attr('fill', '#6b7280')
      .attr('font-size', '9px')
      .attr('pointer-events', 'none')
      .text((d) => d.type);

    // ── Nodes ──
    const currentSelectedId = useUiStore.getState().selectedNodeId;
    const currentHighlight = useUiStore.getState().highlightedLabel;

    const nodeEl = nodeGroup
      .selectAll<SVGGElement, SimNode>('g')
      .data(simNodes)
      .join('g')
      .attr('cursor', 'pointer')
      .attr('opacity', (d) =>
        currentHighlight && d.primaryLabel !== currentHighlight ? 0.15 : 1,
      )
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(d.id === useUiStore.getState().selectedNodeId ? null : d.id);
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
            d.fx = null; d.fy = null;
          }),
      );

    nodeEl.each(function (d) {
      const config = labelConfig[d.primaryLabel] ?? DEFAULT_CONFIG;
      appendShape(
        d3.select(this) as unknown as d3.Selection<SVGGElement, SimNode, SVGGElement, unknown>,
        config,
        d.id === currentSelectedId,
      );
    });

    nodeEl
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('fill', '#e2e8f0')
      .attr('font-size', '11px')
      .attr('dy', (d) => (labelConfig[d.primaryLabel]?.size ?? DEFAULT_CONFIG.size) / 2 + 13)
      .attr('pointer-events', 'none')
      .text((d) => (d.properties['name'] as string) ?? d.primaryLabel);

    svg.on('click', () => setSelectedNode(null));

    // ── Bridge functions for Effects 2 & 3 ────────────────────────────────────
    applySelectionRef.current = (id) => {
      nodeEl.each(function (d) {
        const sel = d.id === id;
        d3.select(this).select('.node-shape')
          .attr('stroke', sel ? '#f59e0b' : '#1e293b')
          .attr('stroke-width', sel ? 3 : 1.5);
      });
    };

    applyHighlightRef.current = (label) => {
      nodeEl.attr('opacity', (d) => (label && d.primaryLabel !== label ? 0.15 : 1));
    };

    // ── Tick ──────────────────────────────────────────────────────────────────
    simulation.on('tick', () => {
      linkEl.each(function (d) {
        const src = d.source as SimNode;
        const tgt = d.target as SimNode;
        const sx = src.x ?? 0, sy = src.y ?? 0;
        const tx = tgt.x ?? 0, ty = tgt.y ?? 0;
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
    });

    return () => {
      simulation.stop();
      // Save positions before teardown
      for (const n of simNodes) {
        if (n.x !== undefined && n.y !== undefined) {
          positionsRef.current.set(n.id, { x: n.x, y: n.y });
        }
      }
      svg.on('click', null);
      applySelectionRef.current = () => {};
      applyHighlightRef.current = () => {};
    };
  }, [nodes, edges, labelConfig, setSelectedNode]);

  // ── Effect 2: selection highlight ──────────────────────────────────────────
  useEffect(() => {
    applySelectionRef.current(selectedNodeId);
  }, [selectedNodeId]);

  // ── Effect 3: label highlight ──────────────────────────────────────────────
  useEffect(() => {
    applyHighlightRef.current(highlightedLabel);
  }, [highlightedLabel]);

  return (
    <svg ref={svgRef} className="w-full h-full bg-gray-950" style={{ display: 'block' }} />
  );
}
