import { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { api } from '../../api/client.ts';
import { useUiStore } from '../../store/uiStore.ts';
import { useMapping } from '../../store/mappingStore.ts';
import type { GraphNode } from '../../types.ts';

type HNode = { id: string; children?: HNode[] };

export function MindmapModal() {
  const { mindmapNodeId, setMindmapNode } = useUiStore();
  const { colorMap } = useMapping();
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

      // Build adjacency
      const adj = new Map<string, string[]>();
      const nodeMap = new Map<string, GraphNode>();
      for (const node of data.nodes) { adj.set(node.id, []); nodeMap.set(node.id, node); }
      for (const edge of data.edges) {
        if (edge.source !== edge.target) {
          adj.get(edge.source)?.push(edge.target);
          adj.get(edge.target)?.push(edge.source);
        }
      }

      // BFS spanning tree from root
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

      const buildHNode = (id: string): HNode => {
        const ch = childrenMap.get(id) ?? [];
        return ch.length > 0 ? { id, children: ch.map(buildHNode) } : { id };
      };

      const root = d3.hierarchy<HNode>(buildHNode(mindmapNodeId));

      const svgEl = svgRef.current;
      const W = svgEl.clientWidth  || 900;
      const H = svgEl.clientHeight || 700;
      const cx = W / 2, cy = H / 2;

      let maxDepth = 0;
      root.each((nd) => { if (nd.depth > maxDepth) maxDepth = nd.depth; });
      const radius = Math.min(W, H) / 2 * 0.88;
      const levelSpacing = maxDepth > 0 ? radius / maxDepth : radius;

      d3.tree<HNode>()
        .size([2 * Math.PI, levelSpacing * Math.max(1, maxDepth)])
        .separation((a, b) => (a.parent === b.parent ? 1 : 2) / Math.max(1, a.depth))
        (root);

      const svg = d3.select(svgEl);
      svg.selectAll('*').remove();

      const g = svg.append('g');

      svg.call(
        d3.zoom<SVGSVGElement, unknown>()
          .scaleExtent([0.1, 4])
          .on('zoom', (event) => g.attr('transform', event.transform)),
      );

      const angle = (d: d3.HierarchyPointNode<HNode>) =>
        (d as unknown as { x: number }).x - Math.PI / 2;
      const r = (d: d3.HierarchyPointNode<HNode>) =>
        (d as unknown as { y: number }).y;
      const px = (d: d3.HierarchyPointNode<HNode>) => cx + r(d) * Math.cos(angle(d));
      const py = (d: d3.HierarchyPointNode<HNode>) => cy + r(d) * Math.sin(angle(d));

      // Curved links
      g.selectAll('path.link')
        .data(root.links())
        .join('path')
        .attr('class', 'link')
        .attr('fill', 'none')
        .attr('stroke', '#4B5563')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.6)
        .attr('d', (d) => {
          const sx = px(d.source as d3.HierarchyPointNode<HNode>);
          const sy = py(d.source as d3.HierarchyPointNode<HNode>);
          const tx = px(d.target as d3.HierarchyPointNode<HNode>);
          const ty = py(d.target as d3.HierarchyPointNode<HNode>);
          const mx = (sx + tx) / 2;
          const my = (sy + ty) / 2;
          return `M${sx},${sy} Q${cx + (mx - cx) * 0.5},${cy + (my - cy) * 0.5} ${tx},${ty}`;
        });

      // Nodes
      const node = g.selectAll<SVGGElement, d3.HierarchyPointNode<HNode>>('g.node')
        .data(root.descendants() as d3.HierarchyPointNode<HNode>[])
        .join('g')
        .attr('class', 'node')
        .attr('transform', (d) => `translate(${px(d)},${py(d)})`);

      node.append('circle')
        .attr('r', (d) => d.depth === 0 ? 16 : d.depth === 1 ? 10 : 7)
        .attr('fill', (d) => colorMap[nodeMap.get(d.data.id)?.primaryLabel ?? ''] ?? '#6366f1')
        .attr('stroke', '#111827')
        .attr('stroke-width', 2);

      node.append('text')
        .attr('dy', (d) => (d.depth === 0 ? 28 : d.depth === 1 ? 20 : 16))
        .attr('text-anchor', 'middle')
        .attr('font-size', (d) => (d.depth === 0 ? 12 : 9))
        .attr('font-weight', (d) => (d.depth === 0 ? 'bold' : 'normal'))
        .attr('fill', '#e5e7eb')
        .attr('pointer-events', 'none')
        .text((d) => {
          const nd = nodeMap.get(d.data.id);
          const raw = nd?.properties?.name ?? nd?.properties?.Name ?? nd?.primaryLabel ?? d.data.id;
          const s = String(raw);
          return s.length > 22 ? s.slice(0, 20) + '…' : s;
        });

      setStatus('idle');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setStatus('error');
    }
  }, [mindmapNodeId, depth, colorMap]);

  useEffect(() => { render(); }, [render]);

  if (!mindmapNodeId) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950/96 backdrop-blur-sm">
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

        {status === 'loading' && (
          <span className="text-xs text-gray-500 ml-2">Loading…</span>
        )}
        {status === 'error' && (
          <span className="text-xs text-red-400 ml-2">{error}</span>
        )}

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
