// ---- Edit this block for your section of the map ----
const CONFIG = {
  mapBaseUrl: "https://map.earthmc.net",
  world: "minecraft_overworld",
  tileSize: 512,

  // Zoom is locked to this level — panning/zooming to any other level is
  // disabled, so only tiles at this zoom are ever requested.
  lockedZoom: 5,

  // Which tile files to show, by the x_z index in the tile filenames
  // (tiles/<world>/<lockedZoom>/<x>_<z>.png). Both ends are inclusive.
  tiles: {
    minX: 111,
    maxX: 125,
    minZ: 37,
    maxZ: 62,
  },
};
// -------------------------------------------------------

const { crs, layer } = createSquaremapTileLayer(CONFIG.mapBaseUrl, CONFIG.world, {
  tileSize: CONFIG.tileSize,
  minZoom: CONFIG.lockedZoom,
  maxZoom: CONFIG.lockedZoom,
});

const map = L.map("map", {
  crs,
  minZoom: CONFIG.lockedZoom,
  maxZoom: CONFIG.lockedZoom,
  zoomControl: false,
  scrollWheelZoom: false,
  doubleClickZoom: false,
  boxZoom: false,
  touchZoom: false,
  attributionControl: false,
});

// Tile (x, z) covers pixel [x*tileSize, (x+1)*tileSize) at CONFIG.lockedZoom,
// so the requested tile range maps directly to a pixel box at that zoom —
// no dependency on squaremap's block-coordinate transform.
const pixelMin = L.point(CONFIG.tiles.minX * CONFIG.tileSize, CONFIG.tiles.minZ * CONFIG.tileSize);
const pixelMax = L.point((CONFIG.tiles.maxX + 1) * CONFIG.tileSize, (CONFIG.tiles.maxZ + 1) * CONFIG.tileSize);
const bounds = L.latLngBounds(
  map.unproject(pixelMin, CONFIG.lockedZoom),
  map.unproject(pixelMax, CONFIG.lockedZoom)
);

// Belt-and-braces: also stop the layer itself from ever requesting tiles
// outside the box (GridLayer keeps a small buffer of surrounding tiles).
layer.options.bounds = bounds;
layer.addTo(map);

map.setMaxBounds(bounds);
map.fitBounds(bounds);
