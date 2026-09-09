// ---- Edit this block for your section of the map ----
const CONFIG = {
  mapBaseUrl: "https://map.earthmc.net",
  world: "minecraft_overworld",
  tileSize: 512,

  // squaremap's native (most zoomed-in) level. Confirmed against the
  // top-left tile at each zoom (they halve cleanly, as expected):
  //   zoom 5: 104_32   zoom 4: 52_16   zoom 3: 26_8   zoom 2: 13_4
  // 104 * 512 == 53248 and 32 * 512 == 16384 -> 1 block == 1 pixel at
  // zoom 5. Every zoom below that halves resolution (2x blocks/pixel).
  nativeZoom: 5,
  minZoom: 2,
  maxZoom: 5,

  // The section to display, as Minecraft block coordinates. topLeft is
  // exactly the zoom-5 tile 104_32 (104*512, 32*512); bottomRight keeps
  // the same span as before, just re-anchored to the corrected origin.
  topLeft: { x: 53248, z: 16384 },
  bottomRight: { x: 60928, z: 29696 },
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
});

// A plain block-coordinate box — the CRS handles projecting it correctly
// at whichever zoom (2-5) the map is currently showing, so tile requests
// and the border overlay both stay aligned across zoom levels.
const bounds = L.latLngBounds(
  blockToLatLng(CONFIG.topLeft.x, CONFIG.topLeft.z),
  blockToLatLng(CONFIG.bottomRight.x, CONFIG.bottomRight.z)
);

layer.options.bounds = bounds;
layer.addTo(map);

map.setMaxBounds(bounds);
map.fitBounds(bounds);

loadTownBorders(map, "data/markers.json", bounds);
