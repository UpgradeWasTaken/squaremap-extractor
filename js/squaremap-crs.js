// Reimplementation of squaremap's Leaflet coordinate system.
//
// squaremap serves a Leaflet tile pyramid at:
//   tiles/<world>/<zoom>/<tileX>_<tileZ>.png
//
// Each tile is `tileSize` px square. At `nativeZoom` (the most zoomed-in
// level, i.e. squaremap's `zoom.max`), 1 pixel == 1 Minecraft block. Every
// zoom level below that doubles the blocks covered per pixel.
//
// IMPORTANT: `nativeZoom` and `tileSize` are the two values you must verify
// against your own server. Check `<mapUrl>/tiles/settings.json` for the
// world's zoom settings, or just load the map and nudge `nativeZoom` up/down
// until markers/tiles line up with known coordinates.
function createSquaremapCRS(nativeZoom) {
  const scale = 1 / Math.pow(2, nativeZoom);
  return L.extend({}, L.CRS.Simple, {
    // Maps Minecraft (x, z) -> Leaflet's internal point space at zoom 0.
    // L.latLng is used as (z, x) — i.e. lat holds Minecraft Z, lng holds X —
    // which is the convention squaremap itself uses. Both axes increase in
    // the same direction as pixel space (no flip): confirmed against a
    // known tile/block pair — tile 111_37 at zoom 5 starts exactly at
    // block (56832, 18944), i.e. 111*512 == 56832 and 37*512 == 18944.
    transformation: new L.Transformation(scale, 0, scale, 0),
  });
}

// Builds a Leaflet TileLayer pointed at a squaremap tile endpoint.
//   mapBaseUrl: e.g. "https://map.earthmc.net"
//   world: e.g. "minecraft_overworld"
function createSquaremapTileLayer(mapBaseUrl, world, options = {}) {
  const { tileSize = 512, minZoom = -3, maxZoom = 3, nativeZoom = maxZoom, ...rest } = options;

  return {
    crs: createSquaremapCRS(nativeZoom),
    layer: L.tileLayer(`${mapBaseUrl}/tiles/${world}/{z}/{x}_{y}.png`, {
      tileSize,
      minZoom,
      maxZoom,
      minNativeZoom: minZoom,
      maxNativeZoom: nativeZoom,
      noWrap: true,
      ...rest,
    }),
  };
}

// Converts Minecraft world coordinates to a Leaflet LatLng usable with the
// CRS above (setView, marker placement, etc).
function blockToLatLng(x, z) {
  return L.latLng(z, x);
}
