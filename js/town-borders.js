// Overlays live town-claim borders from squaremap's marker API as thin
// dotted gray outlines with centered name labels, similar to how Google
// Maps renders subnational region borders.
//
// Two things here couldn't be verified from a sandboxed environment with
// no network access to the live map:
//   1. The exact shape of markers.json (marker-set/marker field names) —
//      extractRings/extractName below handle a couple of likely variants,
//      but the real squaremap response may use different names.
//   2. CONFIG.nativeZoom actually matching squaremap's configured native
//      zoom — if it's off, borders will be scaled/offset relative to the
//      tiles beneath them (drifting further from world origin 0,0).
// If borders don't line up (or don't appear), open the browser console:
// this logs the raw fetched JSON, which is enough to fix either issue.
async function loadTownBorders(map, mapBaseUrl, world) {
  const url = `${mapBaseUrl}/tiles/${world}/markers.json`;
  let markerSets;
  try {
    const res = await fetch(url);
    markerSets = await res.json();
  } catch (err) {
    console.error("Failed to load town borders from", url, err);
    return;
  }
  console.debug("squaremap markers.json:", markerSets);

  const sets = Array.isArray(markerSets) ? markerSets : Object.values(markerSets || {});
  const viewBounds = map.getBounds();
  let drawn = 0;

  for (const set of sets) {
    const entries = toEntries(set.markers);

    for (const marker of entries) {
      const type = (marker.type || "").toLowerCase();
      if (type !== "polygon" && type !== "multipolygon") continue;

      const rings = extractRings(marker);
      if (!rings.length) continue;

      const polygon = L.polygon(rings, {
        color: "#888888",
        weight: 1.5,
        opacity: 0.85,
        fill: false,
        dashArray: "2 6",
        interactive: false,
      });

      const polyBounds = polygon.getBounds();
      if (!polyBounds.isValid() || !polyBounds.intersects(viewBounds)) continue;

      polygon.addTo(map);
      drawn++;

      const name = extractName(marker);
      if (name) {
        polygon.bindTooltip(name, {
          permanent: true,
          direction: "center",
          className: "town-label",
        });
      }
    }
  }

  console.debug(`Drew ${drawn} town border(s) in view.`);
}

function toEntries(markers) {
  if (Array.isArray(markers)) {
    return markers.map((m) => (Array.isArray(m) ? m[1] : m));
  }
  return Object.values(markers || {});
}

// Handles a few likely field-name variants for polygon point data.
function extractRings(marker) {
  const raw = marker.points || marker.data?.points || marker.polygons || [];
  const ringsRaw = Array.isArray(raw[0]) ? raw : [raw];
  return ringsRaw
    .filter((ring) => Array.isArray(ring) && ring.length)
    .map((ring) => ring.map((pt) => blockToLatLng(pt.x, pt.z ?? pt.y)));
}

function extractName(marker) {
  const raw =
    marker.options?.popupContent ??
    marker.options?.name ??
    marker.popup ??
    marker.name ??
    marker.key ??
    "";
  return String(raw)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
