import { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { api } from '../../api/client.ts';
import { useUiStore } from '../../store/uiStore.ts';
import { useMapping, COLOR_PROPERTY } from '../../store/mappingStore.ts';
import { getShapePath } from '../shapes/index.ts';
import type { GraphNode } from '../../types.ts';

type HNode = { id: string; children?: HNode[] };

const CIRCLE_PATH = (r: number) =>
  `M 0,${-r} A ${r},${r} 0 1,1 0,${r} A ${r},${r} 0 1,1 0,${-r}`;

export function MindmapModal() {
  const { mindmapNodeId, setMindmapNode } = useUiStore();
  const { colorMap, labelShapes } = useMapping();
  const svgRef    = useRef<SVGSVGElement>(null);
  const centerRef = useRef<{ cx: number; cy: number }>({ cx: 0, cy: 0 });
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
      centerRef.current = { cx, cy };

      // ── Recursive fan layout ────────────────────────────────────────────────
      // Each node's children are spread in a fan centred on the direction from
      // the node's parent, so hop-2 nodes cluster around their hop-1 parent
      // rather than all sitting on one global outer ring.

      const MIN_GAP = 30; // minimum arc gap between sibling nodes (px)

      type Pos = { x: number; y: number; depth: number };
      const positions = new Map<string, Pos>();
      // parent→child pairs for link drawing
      const links: Array<{ src: string; tgt: string }> = [];

      const place = (
        id: string,
        x: number, y: number,
        angle: number,       // direction this node extends from its parent
        sector: number,      // angular width available for this node's children
        depth: number,
      ) => {
        positions.set(id, { x, y, depth });
        const ch = sortByLabel(childrenMap.get(id) ?? []);
        if (ch.length === 0) return;

        const totalLeaves = ch.reduce((s, c) => s + countLeaves(c), 0);

        // Radius: far enough that siblings have at least MIN_GAP of arc space
        const levelR = Math.max(130, (MIN_GAP * totalLeaves) / Math.max(0.01, sector));

        let cursor = angle - sector / 2;
        for (const childId of ch) {
          const leaves    = countLeaves(childId);
          const childSector = (leaves / totalLeaves) * sector;
          const childAngle  = cursor + childSector / 2;
          cursor += childSector;

          const childX = x + levelR * Math.cos(childAngle);
          const childY = y + levelR * Math.sin(childAngle);
          links.push({ src: id, tgt: childId });
          // Narrow sector slightly so sub-children don't overlap siblings
          place(childId, childX, childY, childAngle, childSector * 0.82, depth + 1);
        }
      };

      // Root at origin; its children spread over full 360°
      positions.set(mindmapNodeId, { x: 0, y: 0, depth: 0 });
      const rootCh = sortByLabel(childrenMap.get(mindmapNodeId) ?? []);
      const rootLeaves = rootCh.reduce((s, c) => s + countLeaves(c), 0);
      const rootR = Math.max(160, (MIN_GAP * rootLeaves) / (2 * Math.PI));
      let rootCursor = -Math.PI;
      for (const childId of rootCh) {
        const leaves      = countLeaves(childId);
        const childSector = (leaves / rootLeaves) * 2 * Math.PI;
        const childAngle  = rootCursor + childSector / 2;
        rootCursor += childSector;
        const childX = rootR * Math.cos(childAngle);
        const childY = rootR * Math.sin(childAngle);
        links.push({ src: mindmapNodeId, tgt: childId });
        place(childId, childX, childY, childAngle, childSector * 0.82, 1);
      }

      // Visual radius per depth level
      const visR = (d: number) => d === 0 ? 18 : d === 1 ? 9 : 6;

      // ── SVG setup ──────────────────────────────────────────────────────────
      const svg = d3.select(svgEl);
      svg.selectAll('*').remove();
      const g = svg.append('g');
      svg.call(
        d3.zoom<SVGSVGElement, unknown>()
          .scaleExtent([0.05, 4])
          .on('zoom', (event) => g.attr('transform', event.transform)),
      );
      const rootG = g.append('g').attr('transform', `translate(${cx},${cy})`);

      // ── Links ──────────────────────────────────────────────────────────────
      rootG.selectAll('path.link')
        .data(links)
        .join('path')
        .attr('class', 'link')
        .attr('fill', 'none')
        .attr('stroke', '#4B5563')
        .attr('stroke-width', (d) => (positions.get(d.src)!.depth === 0 ? 2 : 1.5))
        .attr('opacity', 0.6)
        .attr('d', (d) => {
          const s = positions.get(d.src)!;
          const t = positions.get(d.tgt)!;
          const dx = t.x - s.x, dy = t.y - s.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const ux = dx / len, uy = dy / len;
          const sr = visR(s.depth), tr = visR(t.depth);
          // Start/end at node perimeter
          const x1 = s.x + ux * sr, y1 = s.y + uy * sr;
          const x2 = t.x - ux * tr, y2 = t.y - uy * tr;
          // Gentle S-curve
          return `M${x1},${y1} C${x1 + ux * len * 0.4},${y1 + uy * len * 0.4} ${x2 - ux * len * 0.4},${y2 - uy * len * 0.4} ${x2},${y2}`;
        });

      // ── Nodes ──────────────────────────────────────────────────────────────
      const allNodes = [...positions.entries()].map(([id, pos]) => ({ id, ...pos }));

      const nodeG = rootG.selectAll<SVGGElement, typeof allNodes[0]>('g.node')
        .data(allNodes)
        .join('g')
        .attr('class', 'node')
        .attr('transform', (d) => `translate(${d.x},${d.y})`);

      nodeG.append('path')
        .attr('d', (d) => {
          const r = visR(d.depth);
          const shape = nodeShape(d.id);
          return shape === 'circle' ? CIRCLE_PATH(r) : getShapePath(shape, r);
        })
        .attr('fill', (d) => nodeColor(d.id))
        .attr('stroke', '#111827')
        .attr('stroke-width', (d) => (d.depth === 0 ? 2.5 : 1.5));

      nodeG.append('text')
        .attr('x', (d) => {
          if (d.depth === 0) return 0;
          return d.x >= 0 ? visR(d.depth) + 5 : -(visR(d.depth) + 5);
        })
        .attr('dy', (d) => (d.depth === 0 ? 30 : '0.35em'))
        .attr('text-anchor', (d) => {
          if (d.depth === 0) return 'middle';
          return d.x >= 0 ? 'start' : 'end';
        })
        .attr('font-size', (d) => (d.depth === 0 ? 12 : d.depth === 1 ? 10 : 9))
        .attr('font-weight', (d) => (d.depth === 0 ? 'bold' : 'normal'))
        .attr('fill', '#d1d5db')
        .attr('pointer-events', 'none')
        .text((d) => nodeLabel(d.id));

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

    // getBBox() returns coords in the inner g's local space (centred at 0,0).
    // The inner g has translate(cx,cy), so we offset by cx/cy to get SVG coords.
    const contentG = svgEl.querySelector('g > g') as SVGGElement | null;
    if (!contentG) return;

    const { cx, cy } = centerRef.current;
    const bbox  = contentG.getBBox();
    const pad   = 80;
    const vx    = cx + bbox.x - pad;
    const vy    = cy + bbox.y - pad;
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
    bg.setAttribute('x',      String(vx));
    bg.setAttribute('y',      String(vy));
    bg.setAttribute('width',  String(vw));
    bg.setAttribute('height', String(vh));
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
