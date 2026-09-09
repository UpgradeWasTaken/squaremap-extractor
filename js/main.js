// ---- Edit this block for your section of the map ----
const CONFIG = {
  mapBaseUrl: "https://map.earthmc.net",
  world: "minecraft_overworld",
  tileSize: 512,

  // squaremap's native (most zoomed-in) level. Confirmed against the
  // top-left tile at each zoom (they halve cleanly, as expected):
  //   zoom 5: 104_32   zoom 4: 52_16   zoom 3: 26_8
  // 104 * 512 == 53248 and 32 * 512 == 16384 -> 1 block == 1 pixel at
  // zoom 5. Every zoom below that halves resolution (2x blocks/pixel).
  nativeZoom: 5,
  minZoom: 2,
  maxZoom: 5,

  // The section to display, as inclusive tile x_z ranges per zoom level.
  // These aren't a single block-coordinate box scaled across zooms: at
  // zoom 2 the top-left is nudged one tile down (13_5, not the "clean"
  // 13_4 you'd get by halving zoom 5's 104_32) because that row is mostly
  // transparent (edge-of-render) at that zoom's coarser tile size.
  zoomTileBounds: {
    5: { topLeft: { x: 104, z: 32 }, bottomRight: { x: 125, z: 62 } },
    4: { topLeft: { x: 52, z: 16 }, bottomRight: { x: 62, z: 31 } },
    3: { topLeft: { x: 26, z: 8 }, bottomRight: { x: 31, z: 15 } },
    2: { topLeft: { x: 13, z: 5 }, bottomRight: { x: 15, z: 7 } },
  },
};
// -------------------------------------------------------

const { crs, layer } = createSquaremapTileLayer(CONFIG.mapBaseUrl, CONFIG.world, {
  tileSize: CONFIG.tileSize,
  minZoom: CONFIG.minZoom,
  maxZoom: CONFIG.maxZoom,
  nativeZoom: CONFIG.nativeZoom,
});

const map = L.map("map", {
  crs,
  minZoom: CONFIG.minZoom,
  maxZoom: CONFIG.maxZoom,
  attributionControl: false,
  // Fully solid bounds (no elastic overscroll past the edge), so panning
  // can never reveal the transparent margin beyond the configured tiles.
  maxBoundsViscosity: 1.0,
});

layer.addTo(map);

// Converts a per-zoom tile x_z range into a LatLngBounds.
function tileRangeBounds(zoom, { topLeft, bottomRight }) {
  const blocksPerTile = CONFIG.tileSize * Math.pow(2, CONFIG.nativeZoom - zoom);
  return L.latLngBounds(
    blockToLatLng(topLeft.x * blocksPerTile, topLeft.z * blocksPerTile),
    blockToLatLng((bottomRight.x + 1) * blocksPerTile, (bottomRight.z + 1) * blocksPerTile)
  );
}

// maxBounds/tile bounds are zoom-specific (see zoomTileBounds above), so
// they're recalculated every time the zoom level changes.
function applyBoundsForZoom(zoom) {
  const bounds = tileRangeBounds(zoom, CONFIG.zoomTileBounds[zoom]);
  map.setMaxBounds(bounds);
  layer.options.bounds = bounds;
  return bounds;
}

const initialBounds = applyBoundsForZoom(CONFIG.maxZoom);
map.setView(initialBounds.getCenter(), CONFIG.maxZoom);
map.on("zoomend", () => applyBoundsForZoom(map.getZoom()));

// Cull the border overlay against the widest (zoom 5) extent, since every
// other zoom's area is a subset of it.
loadTownBorders(map, "data/markers.json", tileRangeBounds(5, CONFIG.zoomTileBounds[5]));
