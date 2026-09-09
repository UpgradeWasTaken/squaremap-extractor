// ---- Edit this block for your section of the map ----
const CONFIG = {
  mapBaseUrl: "https://map.earthmc.net",
  world: "minecraft_overworld",
  tileSize: 512,

  // squaremap's native (most zoomed-in) level — confirmed empirically:
  // tile 111_37 at zoom 5 starts exactly at block (56832, 18944), i.e.
  // 111 * 512 == 56832 and 37 * 512 == 18944, so 1 block == 1 pixel at
  // zoom 5. Every zoom below that halves resolution (2x blocks/pixel).
  nativeZoom: 5,
  minZoom: 2,
  maxZoom: 5,

  // The section to display, as Minecraft block coordinates.
  topLeft: { x: 56832, z: 18944 },
  bottomRight: { x: 64512, z: 32256 },
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

loadTownBorders(map, CONFIG.mapBaseUrl, CONFIG.world, bounds);
