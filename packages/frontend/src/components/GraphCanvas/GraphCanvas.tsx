import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3';
import { useGraphStore } from '../../store/graphStore.ts';
import { useMapping, resolveNodeConfig, COLOR_PROPERTY } from '../../store/mappingStore.ts';
import { useUiStore } from '../../store/uiStore.ts';
import { getAnchorPoint, getShapePath, type ShapeType } from '../shapes/index.ts';
import type { GraphNode, GraphEdge } from '../../types.ts';
import { canvasActions } from '../../lib/canvasActions.ts';
import type { LayoutAlgorithm } from '../../store/uiStore.ts';
import type { VisualConfig } from '../../store/mappingStore.ts';

// ── D3 simulation types ────────────────────────────────────────────────────────

interface SimNode extends SimulationNodeDatum, GraphNode {}

interface SimEdge extends SimulationLinkDatum<SimNode> {
  id: string;
  type: string;
  properties: Record<string, unknown>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

  if (pinned) {
    g.append('circle').attr('class', 'pin-dot')
      .attr('r', 4).attr('cy', -r - 5)
      .attr('fill', '#f59e0b').attr('stroke', '#1e293b').attr('stroke-width', 1);
  }
}

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
  if (highlightedLabel) {
    const matchesDomain = String(d.properties[COLOR_PROPERTY] ?? '') === highlightedLabel;
    const matchesLabel  = d.primaryLabel === highlightedLabel;
    return (matchesDomain || matchesLabel) ? 1 : 0.15;
  }
  return 1;
}

// Assign fixed positions for non-force layouts
function applyLayout(simNodes: SimNode[], layout: LayoutAlgorithm, cx: number, cy: number) {
  const n = simNodes.length;
  if (n === 0) return;

  if (layout === 'circular') {
    const radius = Math.min(cx, cy) * 0.75;
    simNodes.forEach((d, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      d.fx = cx + radius * Math.cos(angle);
      d.fy = cy + radius * Math.sin(angle);
      d.x = d.fx; d.y = d.fy;
    });
  } else if (layout === 'grid') {
    const cols = Math.ceil(Math.sqrt(n));
    const spacing = Math.min(120, Math.max(60, Math.min(cx, cy) * 1.5 / cols));
    const totalW = (cols - 1) * spacing;
    const rows = Math.ceil(n / cols);
    const totalH = (rows - 1) * spacing;
    simNodes.forEach((d, i) => {
      d.fx = cx - totalW / 2 + (i % cols) * spacing;
      d.fy = cy - totalH / 2 + Math.floor(i / cols) * spacing;
      d.x = d.fx; d.y = d.fy;
    });
  } else if (layout === 'radial') {
    simNodes[0].fx = cx; simNodes[0].fy = cy;
    simNodes[0].x = cx; simNodes[0].y = cy;
    const ringSize = 8;
    let placed = 1, ring = 1;
    while (placed < n) {
      const inRing = Math.min(ringSize * ring, n - placed);
      const radius = ring * 120;
      for (let j = 0; j < inRing; j++) {
        const angle = (2 * Math.PI * j) / inRing - Math.PI / 2;
        const px = cx + radius * Math.cos(angle);
        const py = cy + radius * Math.sin(angle);
        simNodes[placed].fx = px; simNodes[placed].fy = py;
        simNodes[placed].x = px; simNodes[placed].y = py;
        placed++;
      }
      ring++;
    }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GraphCanvas() {
  const svgRef     = useRef<SVGSVGElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const { nodes, edges } = useGraphStore();
  const { colorMap, labelShapes, edgeConfig } = useMapping();
  const {
    selectedNodeId, highlightedLabel, searchQuery,
    pinnedNodeIds, hiddenNodeIds, hiddenEdgeTypes, layoutAlgorithm,
    setSelectedNode, setContextMenu,
  } = useUiStore();

  const positionsRef    = useRef<Map<string, { x: number; y: number }>>(new Map());
  const simNodesRef     = useRef<SimNode[]>([]);
  const nodeConfigsRef  = useRef<Map<string, VisualConfig>>(new Map());
  const zoomRef         = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const applySelectionRef  = useRef<(id: string | null) => void>(() => {});
  const applyOpacityRef    = useRef<(hl: string | null, sq: string) => void>(() => {});
  const applyEdgeLabelsRef = useRef<(hidden: Set<string>) => void>(() => {});

  const drawMinimap = () => {
    const canvas = minimapRef.current;
    const svgEl  = svgRef.current;
    if (!canvas || !svgEl) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const simNodes = simNodesRef.current;
    if (simNodes.length === 0) return;

    const mw = canvas.width, mh = canvas.height;
    const xs = simNodes.map((n) => n.x ?? 0);
    const ys = simNodes.map((n) => n.y ?? 0);
    const pad = 20;
    const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
    const s = Math.min(mw / (maxX - minX), mh / (maxY - minY));
    const ox = (mw - (maxX - minX) * s) / 2 - minX * s;
    const oy = (mh - (maxY - minY) * s) / 2 - minY * s;

    ctx.clearRect(0, 0, mw, mh);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, mw, mh);

    // Nodes as dots
    for (const n of simNodes) {
      const config = nodeConfigsRef.current.get(n.id);
      ctx.fillStyle = config?.color ?? '#94a3b8';
      ctx.beginPath();
      ctx.arc((n.x ?? 0) * s + ox, (n.y ?? 0) * s + oy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Viewport rectangle
    const t = d3.zoomTransform(svgEl);
    const vw = svgEl.clientWidth, vh = svgEl.clientHeight;
    const rx = (-t.x / t.k) * s + ox;
    const ry = (-t.y / t.k) * s + oy;
    const rw = (vw / t.k) * s;
    const rh = (vh / t.k) * s;
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 1;
    ctx.strokeRect(rx, ry, rw, rh);
  };

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

    const visibleNodes = nodes.filter((n) => !hiddenNodeIds.has(n.id));
    if (visibleNodes.length === 0) return;

    const g = svg.append('g');
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 8])
      .on('zoom', (e) => { g.attr('transform', e.transform.toString()); drawMinimap(); });
    svg.call(zoomBehavior);
    zoomRef.current = zoomBehavior;

    const cx = width / 2, cy = height / 2;

    const simNodes: SimNode[] = visibleNodes.map((n) => {
      const saved  = positionsRef.current.get(n.id);
      const pinned = pinnedNodeIds.has(n.id);
      // Spread new nodes randomly around the canvas center instead of
      // all spawning at (0,0) — prevents explosive initial repulsion
      const angle  = Math.random() * 2 * Math.PI;
      const radius = 80 + Math.random() * 200;
      return {
        ...n,
        x:  saved?.x ?? (cx + Math.cos(angle) * radius),
        y:  saved?.y ?? (cy + Math.sin(angle) * radius),
        fx: pinned && saved ? saved.x : undefined,
        fy: pinned && saved ? saved.y : undefined,
      };
    });
    simNodesRef.current = simNodes;

    // Compute degree (connection count) for each node
    const degreeMap = new Map<string, number>();
    for (const e of edges) {
      degreeMap.set(e.source, (degreeMap.get(e.source) ?? 0) + 1);
      degreeMap.set(e.target, (degreeMap.get(e.target) ?? 0) + 1);
    }
    const degrees = [...degreeMap.values()];
    const minDeg = Math.min(...degrees, 1);
    const maxDeg = Math.max(...degrees, 1);

    // Scale degree to node size using sqrt scale (handles power-law distributions)
    const MIN_SIZE = 36, MAX_SIZE = 70;
    const sizeForDegree = (deg: number) => {
      if (maxDeg === minDeg) return (MIN_SIZE + MAX_SIZE) / 2;
      const t = Math.sqrt((deg - minDeg) / (maxDeg - minDeg));
      return MIN_SIZE + t * (MAX_SIZE - MIN_SIZE);
    };

    // Pre-compute visual config for every node once
    const nodeConfigs = new Map<string, VisualConfig>();
    for (const node of simNodes) {
      const deg = degreeMap.get(node.id) ?? 0;
      nodeConfigs.set(node.id, resolveNodeConfig(node, colorMap, labelShapes, sizeForDegree(deg)));
    }
    nodeConfigsRef.current = nodeConfigs;

    const nodeById = new Map(simNodes.map((n) => [n.id, n]));
    const simEdges: SimEdge[] = edges
      .filter((e) => e.source !== e.target && nodeById.has(e.source) && nodeById.has(e.target))
      .map((e: GraphEdge) => ({ ...e }));

    const n     = simNodes.length;
    const sqrtN = Math.sqrt(Math.max(1, n));

    if (layoutAlgorithm !== 'force') applyLayout(simNodes, layoutAlgorithm, cx, cy);

    // alphaDecay scales up with node count so larger graphs settle faster
    const alphaDecay = Math.min(0.15, Math.max(0.04, n / 1500));

    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force('link', d3.forceLink<SimNode, SimEdge>(simEdges).id((d) => d.id)
        .distance(Math.min(200, Math.max(60, 1200 / sqrtN))))
      .force('charge', d3.forceManyBody<SimNode>()
        .strength(-Math.min(800, Math.max(150, 4000 / sqrtN)))
        .theta(0.9))           // higher theta = faster Barnes-Hut approximation
      .force('x', d3.forceX<SimNode>(cx).strength(Math.min(0.08, Math.max(0.01, n / 3000))))
      .force('y', d3.forceY<SimNode>(cy).strength(Math.min(0.08, Math.max(0.01, n / 3000))))
      .force('collision', d3.forceCollide<SimNode>(Math.min(60, Math.max(25, 400 / sqrtN))))
      .velocityDecay(0.65)
      .alphaDecay(alphaDecay)
      .alphaMin(0.005);        // stop simulation earlier once sufficiently settled

    if (layoutAlgorithm !== 'force') { simulation.stop(); simulation.tick(); }

    const linkGroup = g.append('g').attr('class', 'links');
    const nodeGroup = g.append('g').attr('class', 'nodes');

    const linkEl = linkGroup.selectAll<SVGLineElement, SimEdge>('line').data(simEdges).join('line')
      .attr('stroke', (d) => edgeConfig[d.type]?.color ?? '#4b5563')
      .attr('stroke-width', (d) => edgeConfig[d.type]?.width ?? 1.5)
      .attr('marker-end', 'url(#arrow)');

    const edgeLabelEl = linkGroup.selectAll<SVGTextElement, SimEdge>('text').data(simEdges).join('text')
      .attr('text-anchor', 'middle').attr('fill', '#6b7280').attr('font-size', '9px')
      .attr('pointer-events', 'none').text((d) => d.type);

    applyEdgeLabelsRef.current = (hidden: Set<string>) => {
      edgeLabelEl.style('display', (d) => hidden.has(d.type) ? 'none' : null);
    };
    applyEdgeLabelsRef.current(useUiStore.getState().hiddenEdgeTypes);

    const curSelectedId = useUiStore.getState().selectedNodeId;
    const curHighlight  = useUiStore.getState().highlightedLabel;
    const curSearch     = useUiStore.getState().searchQuery;

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
            if (!useUiStore.getState().pinnedNodeIds.has(d.id)) { d.fx = null; d.fy = null; }
          }),
      );

    nodeEl.each(function (d) {
      const config = nodeConfigs.get(d.id)!;
      appendShape(
        d3.select(this) as unknown as d3.Selection<SVGGElement, SimNode, SVGGElement, unknown>,
        config,
        d.id === curSelectedId,
        pinnedNodeIds.has(d.id),
      );
    });

    nodeEl.append('text')
      .attr('text-anchor', 'middle').attr('fill', '#e2e8f0').attr('font-size', '11px')
      .attr('dy', (d) => (nodeConfigs.get(d.id)?.size ?? 36) / 2 + 13)
      .attr('pointer-events', 'none')
      .text((d) => (d.properties['name'] as string) ?? d.primaryLabel);

    svg.on('click', () => setSelectedNode(null));

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

    const tick = () => {
      linkEl.each(function (d) {
        const src = d.source as SimNode, tgt = d.target as SimNode;
        const sx = src.x ?? 0, sy = src.y ?? 0, tx = tgt.x ?? 0, ty = tgt.y ?? 0;
        const angle = Math.atan2(ty - sy, tx - sx);
        const srcCfg = nodeConfigs.get(src.id)!;
        const tgtCfg = nodeConfigs.get(tgt.id)!;
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

      // Auto-pin nodes whose velocity has dropped to near zero so they no
      // longer participate in force calculations — dramatically reduces cost
      // with large graphs. Skip user-dragged nodes (already have fx/fy set).
      const alpha = simulation.alpha();
      if (alpha < 0.05) {
        for (const nd of simNodes) {
          if (nd.fx == null && nd.fy == null) {
            const vx = nd.vx ?? 0, vy = nd.vy ?? 0;
            if (Math.abs(vx) < 0.01 && Math.abs(vy) < 0.01) {
              nd.fx = nd.x; nd.fy = nd.y;
            }
          }
        }
      }

      drawMinimap();
    };

    if (layoutAlgorithm !== 'force') { tick(); drawMinimap(); }
    else simulation.on('tick', tick);

    return () => {
      simulation.stop();
      for (const nd of simNodes) {
        if (nd.x !== undefined && nd.y !== undefined) {
          positionsRef.current.set(nd.id, { x: nd.x, y: nd.y });
          // Clear auto-pins so only user-pinned nodes stay fixed on rebuild
          if (!pinnedNodeIds.has(nd.id)) { nd.fx = undefined; nd.fy = undefined; }
        }
      }
      svg.on('click', null);
      applySelectionRef.current  = () => {};
      applyOpacityRef.current    = () => {};
      applyEdgeLabelsRef.current = () => {};
    };
  }, [nodes, edges, colorMap, labelShapes, edgeConfig, pinnedNodeIds, hiddenNodeIds, layoutAlgorithm, setSelectedNode, setContextMenu]);

  // ── Effect 2: selection ────────────────────────────────────────────────────
  useEffect(() => { applySelectionRef.current(selectedNodeId); }, [selectedNodeId]);

  // ── Effect 3: opacity + search fly-to ────────────────────────────────────
  useEffect(() => {
    applyOpacityRef.current(highlightedLabel, searchQuery);

    if (searchQuery && svgRef.current && zoomRef.current) {
      const matching = simNodesRef.current.filter((n) =>
        String(n.properties['name'] ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.primaryLabel.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      if (matching.length > 0) {
        const xs = matching.map((n) => n.x ?? 0);
        const ys = matching.map((n) => n.y ?? 0);
        const minX = Math.min(...xs) - 80, maxX = Math.max(...xs) + 80;
        const minY = Math.min(...ys) - 80, maxY = Math.max(...ys) + 80;
        const w = svgRef.current.clientWidth || 800, h = svgRef.current.clientHeight || 600;
        const scale = Math.min(0.9 * w / (maxX - minX), 0.9 * h / (maxY - minY), 4);
        const tx = w / 2 - scale * ((minX + maxX) / 2);
        const ty = h / 2 - scale * ((minY + maxY) / 2);
        d3.select(svgRef.current).transition().duration(400)
          .call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
      }
    }
  }, [highlightedLabel, searchQuery]);

  // ── Effect 4: edge label visibility ───────────────────────────────────────
  useEffect(() => {
    applyEdgeLabelsRef.current(hiddenEdgeTypes);
  }, [hiddenEdgeTypes]);

  // ── Effect 4: register canvas actions ─────────────────────────────────────
  useEffect(() => {
    canvasActions.register('fitToScreen', () => {
      const svgEl = svgRef.current;
      const zoom  = zoomRef.current;
      if (!svgEl || !zoom) return;
      const simNodes = simNodesRef.current;
      if (simNodes.length === 0) return;

      const xs = simNodes.map((d) => d.x ?? 0);
      const ys = simNodes.map((d) => d.y ?? 0);
      const minX = Math.min(...xs) - 60, maxX = Math.max(...xs) + 60;
      const minY = Math.min(...ys) - 60, maxY = Math.max(...ys) + 60;

      const w = svgEl.clientWidth || 800, h = svgEl.clientHeight || 600;
      const scale = Math.min(0.9 * w / (maxX - minX), 0.9 * h / (maxY - minY), 4);
      const tx = w / 2 - scale * ((minX + maxX) / 2);
      const ty = h / 2 - scale * ((minY + maxY) / 2);

      d3.select(svgEl).transition().duration(500)
        .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    });

    canvasActions.register('exportSVG', () => {
      const svgEl = svgRef.current;
      if (!svgEl) return;
      const blob = new Blob([new XMLSerializer().serializeToString(svgEl)], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'graph.svg'; a.click();
      URL.revokeObjectURL(url);
    });

    canvasActions.register('exportPNG', () => {
      const svgEl = svgRef.current;
      if (!svgEl) return;
      const simNodes = simNodesRef.current;

      // Convert all node positions to screen space using current zoom transform
      const t = d3.zoomTransform(svgEl);
      const pad = 80;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of simNodes) {
        const sx = t.applyX(n.x ?? 0);
        const sy = t.applyY(n.y ?? 0);
        if (sx < minX) minX = sx;
        if (sy < minY) minY = sy;
        if (sx > maxX) maxX = sx;
        if (sy > maxY) maxY = sy;
      }
      if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 800; maxY = 450; }
      minX -= pad; minY -= pad; maxX += pad; maxY += pad;

      // Expand bounding box to 16:9 ratio, keeping content centered
      const contentW = maxX - minX, contentH = maxY - minY;
      const ratio = 16 / 9;
      let boxW = contentW, boxH = contentH;
      if (contentW / contentH > ratio) {
        boxH = contentW / ratio;
      } else {
        boxW = contentH * ratio;
      }
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      const viewX = cx - boxW / 2, viewY = cy - boxH / 2;

      // Clone SVG, set viewBox to the 16:9 region (SVG user coords = screen coords)
      // and set output dimensions to 1920×1080 @ 2× = 3840×2160
      const outW = 1920, outH = 1080, scale = 3;
      const svgClone = svgEl.cloneNode(true) as SVGElement;
      svgClone.setAttribute('width', String(outW));
      svgClone.setAttribute('height', String(outH));
      svgClone.setAttribute('viewBox', `${viewX} ${viewY} ${boxW} ${boxH}`);
      const fontStyle = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      fontStyle.textContent = 'text { font-family: ui-sans-serif, system-ui, Arial, sans-serif; }';
      svgClone.insertBefore(fontStyle, svgClone.firstChild);

      const blob = new Blob([new XMLSerializer().serializeToString(svgClone)], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = outW * scale; canvas.height = outH * scale;
        const ctx = canvas.getContext('2d')!;
        ctx.scale(scale, scale);
        ctx.fillStyle = '#030712';
        ctx.fillRect(0, 0, outW, outH);
        ctx.drawImage(img, 0, 0, outW, outH);
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
    <div className="w-full h-full relative">
      <svg ref={svgRef} className="w-full h-full bg-gray-950" style={{ display: 'block' }} />
      <canvas
        ref={minimapRef}
        width={300}
        height={180}
        className="absolute top-3 right-3 rounded border border-gray-700 opacity-80 hover:opacity-100 transition-opacity"
        style={{ background: '#0f172a' }}
      />
    </div>
  );
}
