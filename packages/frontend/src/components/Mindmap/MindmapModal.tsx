import { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { api } from '../../api/client.ts';
import { useUiStore } from '../../store/uiStore.ts';
import { useMapping, COLOR_PROPERTY } from '../../store/mappingStore.ts';
import { getShapePath } from '../shapes/index.ts';
import type { GraphNode } from '../../types.ts';

type HNode = { id: string; children?: HNode[] };
type PNode = d3.HierarchyPointNode<HNode>;

const CIRCLE_PATH = (r: number) =>
  `M 0,${-r} A ${r},${r} 0 1,1 0,${r} A ${r},${r} 0 1,1 0,${-r}`;

export function MindmapModal() {
  const { mindmapNodeId, setMindmapNode } = useUiStore();
  const { colorMap, labelShapes } = useMapping();
  const svgRef = useRef<SVGSVGElement>(null);
  const [depth, setDepth] = useState(2);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMindmapNode(null); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [setMindmapNode]);

  const render = useCallback(async () => {
    if (!mindmapNodeId || !svgRef.current) return;
    setStatus('loading');
    setError('');

    try {
      const data = await api.neighbors(mindmapNodeId, depth);

      const adj = new Map<string, string[]>();
      const nodeMap = new Map<string, GraphNode>();
      for (const node of data.nodes) { adj.set(node.id, []); nodeMap.set(node.id, node); }
      for (const edge of data.edges) {
        if (edge.source !== edge.target) {
          adj.get(edge.source)?.push(edge.target);
          adj.get(edge.target)?.push(edge.source);
        }
      }

      // BFS spanning tree
      const visited = new Set<string>([mindmapNodeId]);
      const childrenMap = new Map<string, string[]>();
      for (const nd of data.nodes) childrenMap.set(nd.id, []);
      const queue = [mindmapNodeId];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const nb of (adj.get(cur) ?? [])) {
          if (!visited.has(nb)) {
            visited.add(nb);
            childrenMap.get(cur)!.push(nb);
            queue.push(nb);
          }
        }
      }

      const sortByLabel = (ids: string[]) =>
        [...ids].sort((a, b) =>
          (nodeMap.get(a)?.primaryLabel ?? '').localeCompare(nodeMap.get(b)?.primaryLabel ?? ''),
        );

      const buildHNode = (id: string): HNode => {
        const ch = sortByLabel(childrenMap.get(id) ?? []);
        return ch.length > 0 ? { id, children: ch.map(buildHNode) } : { id };
      };

      const countLeaves = (id: string): number => {
        const ch = childrenMap.get(id) ?? [];
        return ch.length === 0 ? 1 : ch.reduce((s, c) => s + countLeaves(c), 0);
      };

      const nodeColor = (id: string) => {
        const nd = nodeMap.get(id);
        const domain = String(nd?.properties[COLOR_PROPERTY] ?? '');
        return domain && colorMap[domain] ? colorMap[domain] : '#6366f1';
      };

      const nodeShape = (id: string) =>
        labelShapes[nodeMap.get(id)?.primaryLabel ?? ''] ?? 'circle';

      const nodeLabel = (id: string) => {
        const nd = nodeMap.get(id);
        const raw = nd?.properties?.name ?? nd?.properties?.Name ?? nd?.primaryLabel ?? id;
        const s = String(raw);
        return s.length > 24 ? s.slice(0, 22) + '…' : s;
      };

      const svgEl = svgRef.current;
      const W = svgEl.clientWidth  || 900;
      const H = svgEl.clientHeight || 700;
      const cx = W / 2, cy = H / 2;

      // Scale outer radius so leaves never overlap
      const totalLeaves = countLeaves(mindmapNodeId);
      const MIN_ARC_PX   = 30;
      const minOuterR    = (totalLeaves * MIN_ARC_PX) / (2 * Math.PI);
      const outerR       = Math.max(Math.min(W, H) * 0.42, minOuterR);

      // Build radial tree — d3.tree uses x=angle [0..2π], y=radius [0..outerR]
      const pointRoot = d3.tree<HNode>()
        .size([2 * Math.PI, outerR])
        .separation((a, b) => (a.parent === b.parent ? 1 : 2) / Math.max(1, a.depth))
        (d3.hierarchy<HNode>(buildHNode(mindmapNodeId)));

      // d3.linkRadial convention: angle 0 = top, x grows clockwise
      // node screen position (relative to centre):
      const nx = (d: PNode) =>  d.y * Math.sin(d.x);
      const ny = (d: PNode) => -d.y * Math.cos(d.x);

      // SVG setup
      const svg = d3.select(svgEl);
      svg.selectAll('*').remove();
      const g = svg.append('g');

      svg.call(
        d3.zoom<SVGSVGElement, unknown>()
          .scaleExtent([0.05, 4])
          .on('zoom', (event) => g.attr('transform', event.transform)),
      );

      // All content centred on (cx, cy)
      const root = g.append('g').attr('transform', `translate(${cx},${cy})`);

      // Links using d3.linkRadial — produces smooth bezier curves
      root.selectAll('path.link')
        .data(pointRoot.links())
        .join('path')
        .attr('class', 'link')
        .attr('fill', 'none')
        .attr('stroke', '#4B5563')
        .attr('stroke-width', (d) => (d.source.depth === 0 ? 2 : 1.5))
        .attr('opacity', 0.6)
        .attr('d',
          d3.linkRadial<d3.HierarchyPointLink<HNode>, PNode>()
            .angle((d) => d.x)
            .radius((d) => d.y),
        );

      // Nodes
      const nodeG = root.selectAll<SVGGElement, PNode>('g.node')
        .data(pointRoot.descendants() as PNode[])
        .join('g')
        .attr('class', 'node')
        .attr('transform', (d) => `translate(${nx(d)},${ny(d)})`);

      nodeG.append('path')
        .attr('d', (d) => {
          const r = d.depth === 0 ? 18 : d.depth === 1 ? 9 : 6;
          const shape = nodeShape(d.data.id);
          return shape === 'circle' ? CIRCLE_PATH(r) : getShapePath(shape, r);
        })
        .attr('fill', (d) => nodeColor(d.data.id))
        .attr('stroke', '#111827')
        .attr('stroke-width', (d) => (d.depth === 0 ? 2.5 : 1.5));

      // Labels: horizontal text, anchored outside the node relative to screen centre
      nodeG.append('text')
        .attr('x', (d) => {
          if (d.depth === 0) return 0;
          const r = d.depth === 1 ? 9 : 6;
          return Math.sin(d.x) >= 0 ? r + 5 : -(r + 5);
        })
        .attr('dy', (d) => (d.depth === 0 ? 30 : '0.35em'))
        .attr('text-anchor', (d) => {
          if (d.depth === 0) return 'middle';
          return Math.sin(d.x) >= 0 ? 'start' : 'end';
        })
        .attr('font-size', (d) => (d.depth === 0 ? 12 : d.depth === 1 ? 10 : 9))
        .attr('font-weight', (d) => (d.depth === 0 ? 'bold' : 'normal'))
        .attr('fill', '#d1d5db')
        .attr('pointer-events', 'none')
        .text((d) => nodeLabel(d.data.id));

      setStatus('idle');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setStatus('error');
    }
  }, [mindmapNodeId, depth, colorMap, labelShapes]);

  useEffect(() => { render(); }, [render]);

  const exportPNG = () => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    // Get the true bounding box of all rendered content (in g's local coords)
    const contentG = svgEl.querySelector('g > g') as SVGGElement | null;
    if (!contentG) return;

    const bbox  = contentG.getBBox();
    const pad   = 80;
    const vx    = bbox.x - pad, vy = bbox.y - pad;
    const vw    = bbox.width  + 2 * pad;
    const vh    = bbox.height + 2 * pad;

    // Output: 1920×1080 @ 2× pixel density
    const outW  = 1920, outH = 1080, scale = 2;

    const svgClone = svgEl.cloneNode(true) as SVGElement;
    svgClone.setAttribute('width',   String(outW));
    svgClone.setAttribute('height',  String(outH));
    svgClone.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`);

    // Reset zoom/pan transform on the outer g so the viewBox covers everything
    const outerG = svgClone.querySelector('g') as SVGGElement | null;
    if (outerG) outerG.removeAttribute('transform');

    // Background and font
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', String(vx)); bg.setAttribute('y', String(vy));
    bg.setAttribute('width', String(vw)); bg.setAttribute('height', String(vh));
    bg.setAttribute('fill', '#030712');
    svgClone.insertBefore(bg, svgClone.firstChild);

    const fontStyle = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    fontStyle.textContent = 'text { font-family: ui-sans-serif, system-ui, Arial, sans-serif; }';
    svgClone.insertBefore(fontStyle, svgClone.firstChild);

    const blob = new Blob([new XMLSerializer().serializeToString(svgClone)], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = outW * scale;
      canvas.height = outH * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, outW, outH);
      ctx.drawImage(img, 0, 0, outW, outH);
      URL.revokeObjectURL(url);
      const a = document.createElement('a');
      a.href     = canvas.toDataURL('image/png');
      a.download = `mindmap-${mindmapNodeId}.png`;
      a.click();
    };
    img.src = url;
  };

  if (!mindmapNodeId) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-700 flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Mind Map</h2>
        <span className="text-xs text-gray-500">— {mindmapNodeId.split(':').pop()}</span>

        <div className="flex items-center gap-1 ml-4">
          {([1, 2, 3] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDepth(d)}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                depth === d
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {d} hop{d > 1 ? 's' : ''}
            </button>
          ))}
        </div>

        <button
          onClick={exportPNG}
          disabled={status === 'loading'}
          className="px-2.5 py-1 text-xs rounded bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-40 transition-colors"
          title="Export as PNG"
        >
          PNG
        </button>

        {status === 'loading' && <span className="text-xs text-gray-500">Loading…</span>}
        {status === 'error'   && <span className="text-xs text-red-400">{error}</span>}

        <button
          onClick={() => setMindmapNode(null)}
          className="ml-auto text-gray-400 hover:text-gray-200 text-xl leading-none transition-colors"
          title="Close (Esc)"
        >
          ✕
        </button>
      </div>

      <svg ref={svgRef} className="flex-1 w-full" />
    </div>
  );
}
