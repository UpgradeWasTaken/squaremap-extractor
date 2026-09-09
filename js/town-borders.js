// Overlays live town-claim borders from squaremap's marker API as thin
// dotted gray outlines with centered name labels, similar to how Google
// Maps renders subnational region borders.
//
// Schema (confirmed from a real markers.json sample): the endpoint returns
// an array of marker sets ({id, name, markers: [...]}); the "towny" set
// holds per-town markers of type "polygon" or "icon". A polygon marker's
// `points` is Array<part> -> Array<ring> -> Array<{x, z}>: each part is a
// separate (possibly disjoint) shape, and within a part the first ring is
// the outer boundary with any further rings as holes (annexed enclaves).
async function loadTownBorders(map, mapBaseUrl, world, cullBounds) {
  const url = `${mapBaseUrl}/tiles/${world}/markers.json`;
  let markerSets;
  try {
    markerSets = await (await fetch(url)).json();
  } catch (err) {
    console.error("Failed to load town borders from", url, err);
    return;
  }

  const townySet = markerSets.find((set) => set.id === "towny");
  if (!townySet) {
    console.error('No "towny" marker set found in', url);
    return;
  }

  let drawn = 0;
  for (const marker of townySet.markers) {
    if (marker.type !== "polygon") continue;

    const name = extractName(marker);
    let labelTarget = null;
    let labelArea = -1;

    for (const part of marker.points) {
      const rings = part.map((ring) => ring.map((pt) => blockToLatLng(pt.x, pt.z)));
      const polygon = L.polygon(rings, {
        color: "#888888",
        weight: 1.5,
        opacity: 0.85,
        fill: false,
        dashArray: "2 6",
        interactive: false,
      });

      const partBounds = polygon.getBounds();
      if (!partBounds.isValid() || !partBounds.intersects(cullBounds)) continue;

      polygon.addTo(map);
      drawn++;

      const area = boundsArea(partBounds);
      if (area > labelArea) {
        labelArea = area;
        labelTarget = polygon;
      }
    }

    if (name && labelTarget) {
      labelTarget.bindTooltip(name, {
        permanent: true,
        direction: "center",
        className: "town-label",
      });
    }
  }

  console.debug(`Drew ${drawn} town border part(s) in view.`);
}

function boundsArea(bounds) {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return Math.abs(ne.lat - sw.lat) * Math.abs(ne.lng - sw.lng);
}

function extractName(marker) {
  const source = marker.tooltip || marker.popup || "";
  const match = source.match(/<b>([^<]+)<\/b>/i);
  const raw = match ? match[1] : source.replace(/<[^>]*>/g, " ");
  return raw.replace(/\s+/g, " ").trim();
}
