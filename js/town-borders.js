// Overlays town-claim borders as dotted gray outlines with name labels,
// similar to how Google Maps renders subnational region borders.
//
// Two data sources, both local snapshots rather than live fetches (squaremap's
// endpoint sends no CORS headers, so a cross-origin fetch from this site is
// blocked outright):
//   data/markers.json   - squaremap's export. An array of marker sets; the
//                         "towny" set holds per-town markers of type "polygon"
//                         or "icon". A polygon's `points` is
//                         Array<part> -> Array<ring> -> Array<{x, z}>, where a
//                         part is one disjoint shape and rings after the first
//                         in a part are holes.
//   data/town-data.json - hand-maintained extras, keyed by town name. Every
//                         key is optional: `adjacentTowns` (absorbed into this
//                         town: territories merge, their own names disappear),
//                         `displayName`, and `subdivisions` (labels placed at
//                         explicit world coordinates, with optional
//                         `otherNames` shown smaller underneath).
const BORDER_STYLE = {
  color: "#7a7a7a",
  weight: 2.5,
  opacity: 1,
  fill: false,
  dashArray: "3 5",
  interactive: false,
};

async function loadTownBorders(map, options) {
  const { markersUrl, townDataUrl, cullBounds, labels } = options;

  const [markerSets, townData] = await Promise.all([
    fetchJson(markersUrl),
    fetchJson(townDataUrl),
  ]);
  if (!markerSets) return;

  const townySet = markerSets.find((set) => set.id === "towny");
  if (!townySet) {
    console.error('No "towny" marker set found in', markersUrl);
    return;
  }

  const groups = groupClaims(townySet.markers, townData || {});
  const labelLayers = [];

  for (const [groupName, group] of groups) {
    // Cheap bbox reject first — only a few dozen of the ~6000 claims are in
    // this section, and there's no point dissolving or building layers for
    // the rest.
    if (!ringsInView(group.rings, cullBounds)) continue;

    // Only groups that absorbed a neighbour need dissolving; a lone town's
    // rings are already the outline of its own territory.
    const rings = group.sources > 1 ? unionRings(group.rings) : group.rings;

    for (const ring of rings) {
      L.polygon(ring.map((pt) => blockToLatLng(pt.x, pt.z)), BORDER_STYLE).addTo(map);
    }

    const info = (townData || {})[groupName] || {};
    const areas = rings.map(ringArea);
    const totalArea = Math.abs(areas.reduce((sum, area) => sum + area, 0));
    const largest = rings[areas.reduce((best, area, i) => (Math.abs(area) > Math.abs(areas[best]) ? i : best), 0)];
    const center = ringCentroid(largest);

    labelLayers.push({
      layer: createLabel(
        blockToLatLng(center.x, center.z),
        escapeHtml(info.displayName || groupName),
        "map-label town-label"
      ),
      minZoom: minZoomForArea(totalArea, labels.townMinArea),
    });

    for (const [subName, subdivision] of Object.entries(info.subdivisions || {})) {
      const [x, z] = subdivision.coordinates;
      const otherNames = subdivision.otherNames || [];
      const alt = otherNames.length
        ? `<span class="label-alt">(${escapeHtml(otherNames.join(", "))})</span>`
        : "";

      labelLayers.push({
        layer: createLabel(
          blockToLatLng(x, z),
          `${escapeHtml(subName)}${alt}`,
          "map-label subdivision-label"
        ),
        minZoom: labels.subdivisionMinZoom,
      });
    }
  }

  const applyLabelVisibility = () => {
    const zoom = map.getZoom();
    for (const { layer, minZoom } of labelLayers) {
      if (zoom >= minZoom) {
        if (!map.hasLayer(layer)) layer.addTo(map);
      } else if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    }
  };

  applyLabelVisibility();
  map.on("zoomend", applyLabelVisibility);
}

// Buckets every claim under the town that owns it, folding `adjacentTowns`
// members into their parent so the pair renders as one territory.
function groupClaims(markers, townData) {
  const absorbedBy = new Map();
  for (const [parent, info] of Object.entries(townData)) {
    for (const child of info.adjacentTowns || []) absorbedBy.set(child, parent);
  }

  const groups = new Map();
  for (const marker of markers) {
    if (marker.type !== "polygon") continue;

    const name = extractName(marker);
    if (!name) continue;

    const groupName = resolveParent(name, absorbedBy);
    if (!groups.has(groupName)) groups.set(groupName, { rings: [], sources: 0 });

    const group = groups.get(groupName);
    group.sources++;
    for (const part of marker.points) {
      for (const ring of part) group.rings.push(ring);
    }
  }
  return groups;
}

// lat holds Minecraft Z and lng holds X, per the CRS in squaremap-crs.js.
function ringsInView(rings, cullBounds) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const ring of rings) {
    for (const pt of ring) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.z < minZ) minZ = pt.z;
      if (pt.z > maxZ) maxZ = pt.z;
    }
  }
  return (
    maxX >= cullBounds.getWest() &&
    minX <= cullBounds.getEast() &&
    maxZ >= cullBounds.getSouth() &&
    minZ <= cullBounds.getNorth()
  );
}

function resolveParent(name, absorbedBy) {
  let current = name;
  const seen = new Set();
  while (absorbedBy.has(current) && !seen.has(current)) {
    seen.add(current);
    current = absorbedBy.get(current);
  }
  return current;
}

// Bigger claims earn their label at lower zooms; everything is named by the
// time you reach the threshold configured for the highest zoom.
function minZoomForArea(area, thresholds) {
  const zooms = Object.keys(thresholds)
    .map(Number)
    .sort((a, b) => a - b);
  for (const zoom of zooms) {
    if (area >= thresholds[zoom]) return zoom;
  }
  return Infinity;
}

function createLabel(latlng, html, className) {
  return L.tooltip({
    permanent: true,
    direction: "center",
    className,
    interactive: false,
  })
    .setLatLng(latlng)
    .setContent(html);
}

async function fetchJson(url) {
  try {
    return await (await fetch(url)).json();
  } catch (err) {
    console.error("Failed to load", url, err);
    return null;
  }
}

function extractName(marker) {
  const source = marker.tooltip || marker.popup || "";
  const match = source.match(/<b>([^<]+)<\/b>/i);
  const raw = match ? match[1] : source.replace(/<[^>]*>/g, " ");
  return raw.replace(/\s+/g, " ").trim();
}

// Town names are player-supplied, so they never reach innerHTML unescaped.
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}
