// ---- Edit this block for your section of the map ----
const CONFIG = {
  mapBaseUrl: "https://map.earthmc.net",
  world: "minecraft_overworld",

  // squaremap's most zoomed-in level (1 px == 1 block). Check
  // <mapBaseUrl>/tiles/settings.json if tiles look misaligned.
  nativeZoom: 3,
  minZoom: -3,
  maxZoom: 3,

  // The section to display, in Minecraft block coordinates (x, z).
  center: { x: 0, z: 0 },
  initialZoom: 0,

  // Optional: lock panning/zoom to a bounding box around the section.
  // Set to null to allow free panning across the whole map.
  bounds: {
    nw: { x: -2000, z: -2000 },
    se: { x: 2000, z: 2000 },
  },
};
// -------------------------------------------------------

const { crs, layer } = createSquaremapTileLayer(CONFIG.mapBaseUrl, CONFIG.world, {
  nativeZoom: CONFIG.nativeZoom,
  minZoom: CONFIG.minZoom,
  maxZoom: CONFIG.maxZoom,
});

const map = L.map("map", {
  crs,
  center: blockToLatLng(CONFIG.center.x, CONFIG.center.z),
  zoom: CONFIG.initialZoom,
  attributionControl: false,
});

layer.addTo(map);

if (CONFIG.bounds) {
  const bounds = L.latLngBounds(
    blockToLatLng(CONFIG.bounds.nw.x, CONFIG.bounds.nw.z),
    blockToLatLng(CONFIG.bounds.se.x, CONFIG.bounds.se.z)
  );
  map.setMaxBounds(bounds);
  map.fitBounds(bounds);
}
