export type ShapeType =
  | 'circle'
  | 'ellipse'
  | 'square'
  | 'diamond'
  | 'triangle'
  | 'pentagon'
  | 'hexagon'
  | 'star';

// ── Path generators ───────────────────────────────────────────────────────────

function regularPolygonPath(sides: number, radius: number, startAngle = 0): string {
  const pts = Array.from({ length: sides }, (_, i) => {
    const a = startAngle + (2 * Math.PI * i) / sides;
    return `${radius * Math.cos(a)},${radius * Math.sin(a)}`;
  });
  return `M${pts.join('L')}Z`;
}

function starPath(outerR: number, innerR: number, points = 5): string {
  const pts = Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (Math.PI * i) / points - Math.PI / 2;
    return `${r * Math.cos(a)},${r * Math.sin(a)}`;
  });
  return `M${pts.join('L')}Z`;
}

export function getShapePath(shape: ShapeType, radius: number): string {
  switch (shape) {
    case 'square':    return regularPolygonPath(4, radius, Math.PI / 4);
    case 'diamond':   return regularPolygonPath(4, radius, 0);
    case 'triangle':  return regularPolygonPath(3, radius, -Math.PI / 2);
    case 'pentagon':  return regularPolygonPath(5, radius, -Math.PI / 2);
    case 'hexagon':   return regularPolygonPath(6, radius, 0);
    case 'star':      return starPath(radius, radius * 0.45);
    default:          return regularPolygonPath(6, radius, 0); // fallback
  }
}

// ── Anchor point calculation ──────────────────────────────────────────────────
//
// Returns the point on the shape boundary in the direction of `angle`.
// Used so edge lines terminate at the shape surface, not the centre.

function polygonAnchor(
  angle: number,
  circumradius: number,
  sides: number,
  startAngle: number,
): { x: number; y: number } {
  const sector = (2 * Math.PI) / sides;
  // Normalise angle relative to polygon orientation
  let θ = ((angle - startAngle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const s = Math.floor(θ / sector);
  // Angle within sector, measured from edge midpoint (at sector/2)
  const θEdge = θ - s * sector - sector / 2;
  // Apothem (distance from centre to edge midpoint)
  const apothem = circumradius * Math.cos(Math.PI / sides);
  const r = apothem / Math.cos(θEdge);
  return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
}

export function getAnchorPoint(
  angle: number,
  shape: ShapeType,
  radius: number,
): { x: number; y: number } {
  switch (shape) {
    case 'circle':
      return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };

    case 'ellipse': {
      // Ellipse with rx = 1.5*r, ry = r.
      // Find parameter t such that atan2(ry·sin t, rx·cos t) = angle.
      const rx = radius * 1.5;
      const ry = radius;
      const t = Math.atan2(rx * Math.sin(angle), ry * Math.cos(angle));
      return { x: rx * Math.cos(t), y: ry * Math.sin(t) };
    }

    case 'square':   return polygonAnchor(angle, radius, 4, Math.PI / 4);
    case 'diamond':  return polygonAnchor(angle, radius, 4, 0);
    case 'triangle': return polygonAnchor(angle, radius, 3, -Math.PI / 2);
    case 'pentagon': return polygonAnchor(angle, radius, 5, -Math.PI / 2);
    case 'hexagon':  return polygonAnchor(angle, radius, 6, 0);

    case 'star':
      // Stars have concave edges; use outer circumradius as approximation.
      return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  }
}
