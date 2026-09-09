// Pure geometry helpers for town claims — no Leaflet, no DOM.
//
// Every claim boundary in squaremap's Towny data is axis-aligned and sits on
// Minecraft's 16-block chunk grid (verified across the full marker set), which
// makes an exact polygon union possible without a geometry library.

const CHUNK = 16;

function edgeKey(ax, az, bx, bz) {
  return `${ax},${az}>${bx},${bz}`;
}

// Merges several claims into the outline of their combined territory.
//
// Each boundary edge is split into single-chunk steps, then any step walked in
// both directions is dropped: adjacent claims traverse their shared border in
// opposite directions, so cancelling those pairs leaves exactly the outline of
// the union. The survivors are stitched back into closed rings.
function unionRings(rings) {
  const edges = new Map();

  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const stepX = Math.sign(b.x - a.x) * CHUNK;
      const stepZ = Math.sign(b.z - a.z) * CHUNK;
      const steps = (Math.abs(b.x - a.x) + Math.abs(b.z - a.z)) / CHUNK;

      for (let s = 0; s < steps; s++) {
        const ax = a.x + stepX * s;
        const az = a.z + stepZ * s;
        const bx = ax + stepX;
        const bz = az + stepZ;
        const reverse = edgeKey(bx, bz, ax, az);
        if (edges.has(reverse)) edges.delete(reverse);
        else edges.set(edgeKey(ax, az, bx, bz), [ax, az, bx, bz]);
      }
    }
  }

  const outgoing = new Map();
  for (const edge of edges.values()) {
    const from = `${edge[0]},${edge[1]}`;
    if (!outgoing.has(from)) outgoing.set(from, []);
    outgoing.get(from).push(edge);
  }

  const used = new Set();
  const result = [];
  for (const [startKey, startEdge] of edges) {
    if (used.has(startKey)) continue;

    const ring = [];
    let edge = startEdge;
    let key = startKey;
    while (edge && !used.has(key)) {
      used.add(key);
      ring.push({ x: edge[0], z: edge[1] });

      const candidates = outgoing.get(`${edge[2]},${edge[3]}`) || [];
      edge = null;
      for (const candidate of candidates) {
        const candidateKey = edgeKey(candidate[0], candidate[1], candidate[2], candidate[3]);
        if (!used.has(candidateKey)) {
          edge = candidate;
          key = candidateKey;
          break;
        }
      }
    }

    if (ring.length >= 3) result.push(dropCollinear(ring));
  }

  return result;
}

// Collapses runs of collinear points left behind by the chunk-level split.
function dropCollinear(ring) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const prev = ring[(i - 1 + ring.length) % ring.length];
    const cur = ring[i];
    const next = ring[(i + 1) % ring.length];
    const cross = (cur.x - prev.x) * (next.z - cur.z) - (cur.z - prev.z) * (next.x - cur.x);
    if (cross !== 0) out.push(cur);
  }
  return out.length >= 3 ? out : ring;
}

// Signed area — negative for outer rings, positive for holes (or vice versa),
// so summing over a claim's rings subtracts any enclaves.
function ringArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    sum += a.x * b.z - b.x * a.z;
  }
  return sum / 2;
}

function ringCentroid(ring) {
  let doubleArea = 0;
  let x = 0;
  let z = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const cross = a.x * b.z - b.x * a.z;
    doubleArea += cross;
    x += (a.x + b.x) * cross;
    z += (a.z + b.z) * cross;
  }
  if (doubleArea === 0) return { x: ring[0].x, z: ring[0].z };
  return { x: x / (3 * doubleArea), z: z / (3 * doubleArea) };
}

if (typeof module !== "undefined") {
  module.exports = { unionRings, ringArea, ringCentroid };
}
