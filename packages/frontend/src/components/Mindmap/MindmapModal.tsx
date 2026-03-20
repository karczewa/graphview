import { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { api } from '../../api/client.ts';
import { useUiStore } from '../../store/uiStore.ts';
import { useMapping, COLOR_PROPERTY } from '../../store/mappingStore.ts';
import { getShapePath } from '../shapes/index.ts';
import type { GraphNode } from '../../types.ts';

type HNode = { id: string; children?: HNode[] };

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

      // Sort children at every level by primaryLabel so same-type nodes group together
      const sortByLabel = (ids: string[]) =>
        [...ids].sort((a, b) => {
          const la = nodeMap.get(a)?.primaryLabel ?? '';
          const lb = nodeMap.get(b)?.primaryLabel ?? '';
          return la.localeCompare(lb);
        });

      const buildHNode = (id: string): HNode => {
        const ch = sortByLabel(childrenMap.get(id) ?? []);
        return ch.length > 0 ? { id, children: ch.map(buildHNode) } : { id };
      };

      const nodeColor = (id: string) => {
        const nd = nodeMap.get(id);
        const domain = String(nd?.properties[COLOR_PROPERTY] ?? '');
        return (domain && colorMap[domain]) ? colorMap[domain] : '#6366f1';
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
      const cx = W / 2;
      const cy = H / 2;
      const pad = 48;
      const rootGap = 100;
      const MIN_NODE_SPACING = 32; // px between leaf nodes — governs how tall the tree is

      // Count leaves in a subtree so we can allocate enough vertical space
      const countLeaves = (id: string): number => {
        const ch = childrenMap.get(id) ?? [];
        if (ch.length === 0) return 1;
        return ch.reduce((s, c) => s + countLeaves(c), 0);
      };

      // Split root's direct children left / right, sorted by label
      const rootCh = sortByLabel(childrenMap.get(mindmapNodeId) ?? []);
      const half = Math.ceil(rootCh.length / 2);
      const rightIds = rootCh.slice(0, half);
      const leftIds  = rootCh.slice(half);

      const svg = d3.select(svgEl);
      svg.selectAll('*').remove();
      const g = svg.append('g');

      svg.call(
        d3.zoom<SVGSVGElement, unknown>()
          .scaleExtent([0.05, 4])
          .on('zoom', (event) => g.attr('transform', event.transform)),
      );

      const drawSide = (ids: string[], direction: 1 | -1) => {
        if (ids.length === 0) return;

        const availW = cx - rootGap - pad;

        // Give each leaf at least MIN_NODE_SPACING px; never less than viewport height
        const leaves = ids.reduce((s, id) => s + countLeaves(id), 0);
        const availH = Math.max(H - 2 * pad, leaves * MIN_NODE_SPACING);

        const pointRoot = d3.tree<HNode>()
          .size([availH, availW])
          .separation((a, b) => (a.parent === b.parent ? 1 : 1.5))
          (d3.hierarchy<HNode>({ id: mindmapNodeId, children: ids.map(buildHNode) }));

        const rootX = pointRoot.x;
        const sy = (nodeX: number) => cy - rootX + nodeX;
        const sx = (nodeY: number) => cx + direction * (rootGap + nodeY);

        // S-curve bezier links
        g.selectAll(`path.link-d${direction}`)
          .data(pointRoot.links())
          .join('path')
          .attr('fill', 'none')
          .attr('stroke', '#4B5563')
          .attr('stroke-width', 1.5)
          .attr('opacity', 0.55)
          .attr('d', (link) => {
            const s = link.source as d3.HierarchyPointNode<HNode>;
            const t = link.target as d3.HierarchyPointNode<HNode>;
            const x1 = sx(s.y), y1 = sy(s.x);
            const x2 = sx(t.y), y2 = sy(t.x);
            const mx = (x1 + x2) / 2;
            return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
          });

        const nodes = (pointRoot.descendants() as d3.HierarchyPointNode<HNode>[])
          .filter((d) => d.depth > 0);

        const nodeG = g.selectAll<SVGGElement, d3.HierarchyPointNode<HNode>>(
          `g.node-d${direction}`,
        )
          .data(nodes)
          .join('g')
          .attr('transform', (d) => `translate(${sx(d.y)},${sy(d.x)})`);

        const r1 = 9, r2 = 6;

        nodeG.append('path')
          .attr('d', (d) => {
            const r = d.depth === 1 ? r1 : r2;
            const shape = nodeShape(d.data.id);
            return shape === 'circle'
              ? `M 0,${-r} A ${r},${r} 0 1,1 0,${r} A ${r},${r} 0 1,1 0,${-r}`
              : getShapePath(shape, r);
          })
          .attr('fill', (d) => nodeColor(d.data.id))
          .attr('stroke', '#111827')
          .attr('stroke-width', 1.5);

        nodeG.append('text')
          .attr('x', (d) => direction * ((d.depth === 1 ? r1 : r2) + 5))
          .attr('dy', '0.35em')
          .attr('text-anchor', direction === 1 ? 'start' : 'end')
          .attr('font-size', (d) => (d.depth === 1 ? 10 : 9))
          .attr('fill', '#d1d5db')
          .attr('pointer-events', 'none')
          .text((d) => nodeLabel(d.data.id));
      };

      drawSide(rightIds,  1);
      drawSide(leftIds,  -1);

      // Root node
      const rootR = 18;
      const rootShape = nodeShape(mindmapNodeId);
      const rootG = g.append('g').attr('transform', `translate(${cx},${cy})`);

      rootG.append('path')
        .attr('d', rootShape === 'circle'
          ? `M 0,${-rootR} A ${rootR},${rootR} 0 1,1 0,${rootR} A ${rootR},${rootR} 0 1,1 0,${-rootR}`
          : getShapePath(rootShape, rootR))
        .attr('fill', nodeColor(mindmapNodeId))
        .attr('stroke', '#111827')
        .attr('stroke-width', 2.5);

      rootG.append('text')
        .attr('dy', rootR + 16)
        .attr('text-anchor', 'middle')
        .attr('font-size', 12)
        .attr('font-weight', 'bold')
        .attr('fill', '#f9fafb')
        .attr('pointer-events', 'none')
        .text(nodeLabel(mindmapNodeId));

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

    const W = svgEl.clientWidth  || 1920;
    const H = svgEl.clientHeight || 1080;
    const scale = 2;

    const svgClone = svgEl.cloneNode(true) as SVGElement;
    svgClone.setAttribute('width',  String(W));
    svgClone.setAttribute('height', String(H));

    // Inject background rect and font style
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', String(W)); bg.setAttribute('height', String(H));
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
      canvas.width  = W * scale;
      canvas.height = H * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
      URL.revokeObjectURL(url);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
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
