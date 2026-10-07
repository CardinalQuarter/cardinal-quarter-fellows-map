import { Fragment, useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import maplibregl, { type Map as MlMap, type MapMouseEvent, type StyleSpecification } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { UNSPECIFIED, sameSpot, type Fellow } from "../types";
import { CLUSTER_PALETTE, clusterColorIndex } from "../colors";

export type Pin = { fellow: Fellow; color: string };
/**
 * The open pin. `fly` moves the map there (list click, shared link); a map click leaves the view alone.
 * `nearby` lists a max-zoom cluster's fellows, whose pins are too close to separate.
 */
export type Selection = { fellow: Fellow; fly: boolean; nearby?: Fellow[]; at?: [number, number] };

/**
 * Basemap: OpenFreeMap "positron" (free, no key, no usage cap).
 * If Haas gets a Google Cloud billing account, this component is the only file
 * that changes to swap in Google Maps.
 */
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const SOURCE = "fellows";
const LAYER = "fellows-circles";
/** Unclustered copy of the data, shown only while exporting "individual pins". */
const FLAT_SOURCE = "fellows-flat";
const FLAT_LAYER = "fellows-flat-circles";
/**
 * Cluster at every zoom, including the last, so pins too close to separate
 * always show as a counted ring rather than overlapping.
 */
const MAX_ZOOM = 15;
const CLUSTER_MAX_ZOOM = MAX_ZOOM;
const POPUP_MARGIN = 12;
/** Below this width a popup is replaced by a bottom sheet, which reads far better on a phone. */
const SHEET_QUERY = "(max-width: 767px)";
const FLY_ZOOM = 12;

/** Warm the positron basemap up a little: cream land, soft blue water, quieter roads. */
const TINT: Record<string, Record<string, unknown>> = {
  background: { "background-color": "#f3f1ec" },
  park: { "fill-color": "#e1e8dc" },
  landcover_wood: { "fill-color": "#e3e8df" },
  landuse_residential: { "fill-color": "#ece9e2" },
  water: { "fill-color": "#c9d9e3" },
  waterway: { "line-color": "#b7cbd8" },
  building: { "fill-color": "#e7e3da", "fill-outline-color": "#d9d4c9" },
  boundary_2: { "line-color": "#b9b4aa", "line-opacity": 0.8 },
  boundary_3: { "line-color": "#c9c4ba" },
  boundary_disputed: { "line-color": "#b9b4aa" },
  highway_motorway_inner: { "line-color": "#ffffff" },
  highway_major_inner: { "line-color": "#ffffff" },
  highway_minor: { "line-color": "#e6e2da" },
  highway_path: { "line-color": "#e6e2da" },
  highway_major_casing: { "line-color": "#d5d0c6" },
  highway_motorway_casing: { "line-color": "#d5d0c6" },
  label_country_1: { "text-color": "#3b3a36", "text-halo-color": "#f3f1ec" },
  label_country_2: { "text-color": "#3b3a36", "text-halo-color": "#f3f1ec" },
  label_country_3: { "text-color": "#3b3a36", "text-halo-color": "#f3f1ec" },
  label_state: { "text-color": "#767674", "text-halo-color": "#f3f1ec" },
  label_city_capital: { "text-color": "#2e2d29", "text-halo-color": "#f3f1ec" },
  label_city: { "text-color": "#2e2d29", "text-halo-color": "#f3f1ec" },
  label_town: { "text-color": "#43423e", "text-halo-color": "#f3f1ec" },
  label_village: { "text-color": "#585754", "text-halo-color": "#f3f1ec" },
  label_other: { "text-color": "#585754", "text-halo-color": "#f3f1ec" },
  water_name_point_label: { "text-color": "#6f8ba2", "text-halo-color": "#c9d9e3" },
  water_name_line_label: { "text-color": "#6f8ba2", "text-halo-color": "#c9d9e3" },
};

function applyTint(map: MlMap) {
  for (const [id, paint] of Object.entries(TINT)) {
    if (!map.getLayer(id)) continue;
    for (const [k, v] of Object.entries(paint)) map.setPaintProperty(id, k, v);
  }
}

/** Rewrite every label layer to prefer English names, falling back to local. */
function useEnglishLabels(map: MlMap) {
  const style = map.getStyle() as StyleSpecification;
  for (const layer of style.layers) {
    if (layer.type !== "symbol") continue;
    const field = layer.layout?.["text-field"];
    if (!field) continue;
    // Only label layers that render a place/feature name (not housenumber etc).
    if (!/\{name|"name(:[a-z_]+)?"/.test(JSON.stringify(field))) continue;
    map.setLayoutProperty(layer.id, "text-field", [
      "coalesce",
      ["get", "name:en"],
      ["get", "name:latin"],
      ["get", "name"],
    ]);
  }
}

/** A card value, or "" when blank; older periods lack some columns. */
const shown = (v: string | undefined) => (v && v !== UNSPECIFIED ? v : "");

function OrgHeader({ f }: { f: Fellow }) {
  const where = [shown(f.fellowship_loc), shown(f.country)].filter(Boolean).join(", ");
  return (
    <div className="mb-2 flex items-start gap-3">
      {f.partner_logo && (
        <img
          src={f.partner_logo}
          alt=""
          width={40}
          height={40}
          loading="lazy"
          className="h-10 w-10 shrink-0 rounded border border-black-20 bg-white object-contain p-0.5"
          onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
        />
      )}
      <div className="min-w-0">
        {f.partner_website ? (
          <a
            href={f.partner_website}
            target="_blank"
            rel="external noopener"
            className="block font-semibold leading-tight text-digital-blue hover:underline"
          >
            {f.partner_organization}
          </a>
        ) : (
          <span className="block font-semibold leading-tight">{f.partner_organization}</span>
        )}
        {where && <span className="text-xs text-cool-grey">{where}</span>}
      </div>
    </div>
  );
}

function FellowDetails({ f }: { f: Fellow }) {
  const subtitle = [shown(f.class_year) && `Class of ${f.class_year}`, shown(f.major)].filter(Boolean).join(" · ");
  const rows = ([["Interest", f.interest_area], ["Program", f.fellowship], ["Affiliation", f.affiliation], ["Period", f.period]] as const)
    .map(([label, v]) => [label, shown(v)] as const)
    .filter(([, v]) => v);
  return (
    <div>
      <div className="font-semibold leading-tight">{f.name}</div>
      {subtitle && <div className="text-[13px] text-cool-grey">{subtitle}</div>}
      {rows.length > 0 && (
        <dl className="m-0 mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[13px]">
          {rows.map(([label, v]) => (
            <Fragment key={label}><dt className="text-cool-grey">{label}</dt><dd className="m-0">{v}</dd></Fragment>
          ))}
        </dl>
      )}
    </div>
  );
}

/** One or many fellows at a spot, grouped by organization so the org header appears once. */
function PopupList({ pins, full = false, nearby = false }: { pins: Pin[]; full?: boolean; nearby?: boolean }) {
  const groups = new Map<string, Fellow[]>();
  for (const p of pins) {
    const key = p.fellow.partner_organization;
    groups.set(key, [...(groups.get(key) ?? []), p.fellow]);
  }
  return (
    <div className={full ? "font-sans" : "w-64 font-sans " + (pins.length > 1 ? "max-h-80 overflow-y-auto pr-1" : "")}>
      {pins.length > 1 && (
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-cool-grey">
          {pins.length} fellows {nearby ? "nearby" : "at this location"}
        </div>
      )}
      {[...groups.entries()].map(([org, fellows], gi) => (
        <div key={org} className={gi > 0 ? "mt-3 border-t border-black-20 pt-3" : ""}>
          <OrgHeader f={fellows[0]} />
          <div className="flex flex-col gap-2.5">
            {fellows.map((f, i) => (
              <div key={i} className={i > 0 ? "border-t border-dashed border-black-20 pt-2" : ""}>
                <FellowDetails f={f} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function toGeoJson(pins: Pin[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: pins.map((p, i) => ({
      type: "Feature",
      id: i,
      geometry: { type: "Point", coordinates: [p.fellow.longitude, p.fellow.latitude] },
      properties: { color: p.color, i, ci: clusterColorIndex(p.color) },
    })),
  };
}

/** Per-palette-slot counts, so a cluster knows its category mix without fetching leaves. */
const CLUSTER_PROPS = Object.fromEntries(
  CLUSTER_PALETTE.map((_, ci) => [`c${ci}`, ["+", ["case", ["==", ["get", "ci"], ci], 1, 0]]]),
);

/** A donut ring showing the cluster's category mix, with the count in the middle. */
function donut(props: Record<string, unknown>): HTMLElement {
  const total = props.point_count as number;
  const counts = CLUSTER_PALETTE.map((_, ci) => (props[`c${ci}`] as number) ?? 0);
  const size = total >= 50 ? 44 : total >= 10 ? 38 : 32;
  const r = size / 2;
  const r0 = r - 5;
  const arcs: string[] = [];
  let offset = 0;
  counts.forEach((n, ci) => {
    if (!n) return;
    const a0 = (offset / total) * 2 * Math.PI;
    const a1 = ((offset + n) / total) * 2 * Math.PI;
    offset += n;
    if (n === total) {
      arcs.push(`<circle cx="${r}" cy="${r}" r="${r - 2.5}" fill="none" stroke="${CLUSTER_PALETTE[ci]}" stroke-width="5"/>`);
      return;
    }
    const x0 = r + (r - 2.5) * Math.sin(a0), y0 = r - (r - 2.5) * Math.cos(a0);
    const x1 = r + (r - 2.5) * Math.sin(a1), y1 = r - (r - 2.5) * Math.cos(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    arcs.push(`<path d="M ${x0} ${y0} A ${r - 2.5} ${r - 2.5} 0 ${large} 1 ${x1} ${y1}" fill="none" stroke="${CLUSTER_PALETTE[ci]}" stroke-width="5"/>`);
  });
  const el = document.createElement("div");
  el.className = "cluster";
  el.setAttribute("aria-label", `${total} fellows`);
  el.innerHTML =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/>` +
    arcs.join("") +
    `<circle cx="${r}" cy="${r}" r="${r0}" fill="#fff"/>` +
    `<text x="${r}" y="${r}" text-anchor="middle" dominant-baseline="central" font-size="${total >= 100 ? 11 : 13}" font-weight="600" font-family="'Source Sans 3','Helvetica Neue',Arial,sans-serif" fill="#2e2d29">${total}</text>` +
    `</svg>`;
  return el;
}

/** Pan the map just enough that the popup sits fully inside it, clear of the zoom control. */
function nudgeIntoView(map: MlMap, popup: maplibregl.Popup) {
  const el = popup.getElement();
  if (!el) return;
  const box = el.getBoundingClientRect();
  const view = map.getContainer().getBoundingClientRect();
  let dx = 0, dy = 0;
  if (box.left < view.left + POPUP_MARGIN) dx = box.left - (view.left + POPUP_MARGIN);
  else if (box.right > view.right - POPUP_MARGIN) dx = box.right - (view.right - POPUP_MARGIN);
  if (box.top < view.top + POPUP_MARGIN) dy = box.top - (view.top + POPUP_MARGIN);
  else if (box.bottom > view.bottom - POPUP_MARGIN) dy = box.bottom - (view.bottom - POPUP_MARGIN);
  // The zoom control sits top-right; slide the popup below it rather than behind it.
  const ctrl = map.getContainer().querySelector(".maplibregl-ctrl-top-right")?.getBoundingClientRect();
  if (ctrl && box.right - dx > ctrl.left - POPUP_MARGIN && box.top - dy < ctrl.bottom + POPUP_MARGIN) {
    dy = box.top - (ctrl.bottom + POPUP_MARGIN);
  }
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) map.panBy([dx, dy], { duration: 300 });
}

/**
 * Keep an open popup fully inside the map. Its content renders after the popup
 * is placed and grows as logos load, so re-check whenever its size changes,
 * until the popup closes or the user moves the map themselves.
 */
function keepPopupInView(map: MlMap, popup: maplibregl.Popup) {
  const el = popup.getElement();
  if (!el) return;
  let frame = 0;
  const check = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      // Re-placing the popup lets MapLibre pick the side that fits its new size.
      popup.setLngLat(popup.getLngLat());
      nudgeIntoView(map, popup);
    });
  };
  const observer = new ResizeObserver(check);
  observer.observe(el);
  const stop = () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
    map.off("dragstart", stop);
  };
  map.on("dragstart", stop);
  popup.once("close", stop);
  check();
}

/**
 * Compose the WebGL canvas and the HTML cluster markers into one PNG. The map alone
 * would miss every cluster, since those are DOM elements rather than map layers.
 */
async function exportPng(map: MlMap, markers: Iterable<maplibregl.Marker>): Promise<Blob | null> {
  const src = map.getCanvas();
  const ratio = src.width / map.getContainer().clientWidth;
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(src, 0, 0);
  for (const m of markers) {
    const svg = m.getElement().querySelector("svg");
    if (!svg) continue;
    const { x, y } = map.project(m.getLngLat());
    const w = Number(svg.getAttribute("width")), h = Number(svg.getAttribute("height"));
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg.outerHTML], { type: "image/svg+xml" }));
    const ok = await new Promise<boolean>((resolve) => { img.onload = () => resolve(true); img.onerror = () => resolve(false); img.src = url; });
    if (ok) ctx.drawImage(img, (x - w / 2) * ratio, (y - h / 2) * ratio, w * ratio, h * ratio);
    URL.revokeObjectURL(url);
  }
  // Attribution is a licence requirement for the basemap; kept small and quiet, like a caption.
  const credit = "© OpenStreetMap contributors · OpenMapTiles · OpenFreeMap";
  ctx.font = `${9 * ratio}px "Source Sans 3", "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = "rgba(46,45,41,.55)";
  ctx.fillText(credit, 8 * ratio, out.height - 6 * ratio);
  return new Promise((resolve) => out.toBlob(resolve, "image/png"));
}

/** A "download image" button styled like the zoom control, placed beneath it. */
/** Wait until the map has loaded and drawn everything, so a layer change is really on the canvas. */
const whenIdle = (map: MlMap) => new Promise<void>((r) => { map.once("idle", () => r()); map.triggerRepaint(); });

async function download(map: MlMap, markers: Iterable<maplibregl.Marker>, mode: "clusters" | "pins") {
  const flat = mode === "pins";
  if (flat) {
    // Swap the clustered layer and its HTML markers for the plain copy, just for the capture.
    map.setLayoutProperty(LAYER, "visibility", "none");
    map.setLayoutProperty(FLAT_LAYER, "visibility", "visible");
    for (const m of markers) m.getElement().style.visibility = "hidden";
    await whenIdle(map);
  }
  try {
    const blob = await exportPng(map, flat ? [] : markers);
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cardinal-quarter-map-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } finally {
    if (flat) {
      map.setLayoutProperty(FLAT_LAYER, "visibility", "none");
      map.setLayoutProperty(LAYER, "visibility", "visible");
      for (const m of markers) m.getElement().style.visibility = "";
    }
  }
}

/** A "download image" button styled like the zoom control, with a choice of clusters or plain pins. */
class ExportControl implements maplibregl.IControl {
  private el?: HTMLElement;
  constructor(private getMarkers: () => Iterable<maplibregl.Marker>) {}
  onAdd(map: MlMap) {
    const el = document.createElement("div");
    el.className = "maplibregl-ctrl maplibregl-ctrl-group export-ctrl";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = "Download map as image";
    btn.setAttribute("aria-label", btn.title);
    btn.setAttribute("aria-haspopup", "menu");
    btn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2e2d29" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
    const menu = document.createElement("div");
    menu.className = "export-menu";
    menu.setAttribute("role", "menu");
    menu.hidden = true;
    const close = () => { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); };
    for (const [mode, label] of [["clusters", "Clusters as shown"], ["pins", "Individual pins"]] as const) {
      const item = document.createElement("button");
      item.type = "button";
      item.setAttribute("role", "menuitem");
      item.textContent = label;
      item.addEventListener("click", async () => {
        close();
        btn.disabled = true;
        try { await download(map, [...this.getMarkers()], mode); } finally { btn.disabled = false; }
      });
      menu.appendChild(item);
    }
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
      btn.setAttribute("aria-expanded", String(!menu.hidden));
    });
    document.addEventListener("click", close);
    el.append(btn, menu);
    this.el = el;
    return el;
  }
  onRemove() {
    this.el?.remove();
  }
}

type Props = {
  pins: Pin[];
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
};

export function MapView({ pins, selection, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const pinsRef = useRef<Pin[]>(pins);
  const onSelectRef = useRef(onSelect);
  const popupRoot = useRef<Root | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const markers = useRef<Map<number, maplibregl.Marker>>(new Map());
  const [ready, setReady] = useState(false);
  const [sheet, setSheet] = useState<{ pins: Pin[]; nearby: boolean } | null>(null);
  pinsRef.current = pins;
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      center: [10, 20],
      zoom: 1.4,
      // Below 0 so a phone can fit pins spread across several continents.
      minZoom: -1,
      maxZoom: MAX_ZOOM,
      attributionControl: { compact: true },
      // Lets the canvas be read back for the image download.
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new ExportControl(() => markers.current.values()), "top-right");
    mapRef.current = map;
    // The sidebar and phone layout can resize the container without a window resize.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container.current);

    // Cluster markers are HTML (donut SVG); refresh them whenever the view or data changes.
    const updateClusters = () => {
      const source = map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (!source) return;
      const seen = new Set<number>();
      for (const f of map.querySourceFeatures(SOURCE)) {
        const props = f.properties as Record<string, unknown>;
        if (!props.cluster) continue;
        const id = props.cluster_id as number;
        if (seen.has(id)) continue;
        seen.add(id);
        if (markers.current.has(id)) continue;
        const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
        const el = donut(props);
        el.addEventListener("click", async (ev) => {
          ev.stopPropagation();
          let leaves: GeoJSON.Feature[], expansion: number;
          try {
            [leaves, expansion] = await Promise.all([source.getClusterLeaves(id, Infinity, 0), source.getClusterExpansionZoom(id)]);
          } catch {
            // A ring clicked mid-zoom can name a cluster the new zoom level no longer has.
            map.easeTo({ center: coords, zoom: Math.min(map.getZoom() + 1, MAX_ZOOM), duration: 400 });
            return;
          }
          const bounds = new maplibregl.LngLatBounds();
          for (const l of leaves) bounds.extend((l.geometry as GeoJSON.Point).coordinates as [number, number]);
          const ne = bounds.getNorthEast(), sw = bounds.getSouthWest();
          const fellows = leaves.map((l) => pinsRef.current[(l.properties as { i: number }).i]?.fellow).filter((f): f is Fellow => !!f);
          if (Math.abs(ne.lng - sw.lng) < 1e-6 && Math.abs(ne.lat - sw.lat) < 1e-6) {
            // Everyone here shares one address; zooming would not separate them.
            if (fellows[0]) onSelectRef.current({ fellow: fellows[0], fly: false });
          } else if (expansion > MAX_ZOOM) {
            // Separate addresses, but too close to split even at the last zoom: list them all.
            if (fellows[0]) onSelectRef.current({ fellow: fellows[0], fly: false, nearby: fellows, at: coords });
          } else {
            const {clientWidth, clientHeight} = map.getContainer();
            const padding = Math.round(Math.min(80, clientWidth * 0.15, clientHeight * 0.15));
            map.fitBounds(bounds, { padding, maxZoom: MAX_ZOOM, duration: 600 });
          }
        });
        const marker = new maplibregl.Marker({ element: el }).setLngLat(coords).addTo(map);
        marker.getElement().setAttribute("aria-label", `${props.point_count} fellows`);
        markers.current.set(id, marker);
      }
      for (const [id, m] of markers.current) {
        if (!seen.has(id)) { m.remove(); markers.current.delete(id); }
      }
    };

    map.on("load", () => {
      useEnglishLabels(map);
      applyTint(map);
      map.addSource(SOURCE, {
        type: "geojson",
        data: toGeoJson(pinsRef.current),
        cluster: true,
        clusterRadius: 40,
        clusterMaxZoom: CLUSTER_MAX_ZOOM,
        clusterProperties: CLUSTER_PROPS,
      });
      map.addLayer({
        id: LAYER,
        type: "circle",
        source: SOURCE,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 5, 8, 8],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.95,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.75,
        },
      });
      map.addSource(FLAT_SOURCE, { type: "geojson", data: toGeoJson(pinsRef.current) });
      map.addLayer({
        id: FLAT_LAYER,
        type: "circle",
        source: FLAT_SOURCE,
        layout: { visibility: "none" },
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 5, 8, 8],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.95,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.75,
        },
      });
      map.on("mouseenter", LAYER, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", LAYER, () => (map.getCanvas().style.cursor = ""));
      map.on("click", LAYER, (e: MapMouseEvent) => {
        const feats = map.queryRenderedFeatures(e.point, { layers: [LAYER] });
        const pin = feats.length ? pinsRef.current[feats[0].properties.i as number] : undefined;
        if (pin) onSelectRef.current({ fellow: pin.fellow, fly: false });
      });
      // Rebuild markers only from fully loaded tiles. Mid-zoom the source still holds the
      // previous zoom's tiles (or none), which left stale rings or dropped them entirely.
      map.on("render", () => {
        if (map.getSource(SOURCE) && map.isSourceLoaded(SOURCE)) updateClusters();
      });
      setReady(true);
    });

    return () => {
      resizeObserver.disconnect();
      popupRoot.current?.unmount();
      for (const m of markers.current.values()) m.remove();
      markers.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const closePopup = () => {
    const old = popupRef.current;
    popupRef.current = null;
    old?.remove();
    setSheet(null);
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined;
    // Cluster ids are reassigned on new data, so drop every cached marker.
    for (const m of markers.current.values()) m.remove();
    markers.current.clear();
    const geo = toGeoJson(pins);
    src?.setData(geo);
    (map.getSource(FLAT_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(geo);
    // A popup for a fellow who was just filtered out would be misleading.
    closePopup();
    if (pins.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    for (const p of pins) bounds.extend([p.fellow.longitude, p.fellow.latitude]);
    const { clientWidth: w, clientHeight: h } = map.getContainer();
    const pad = Math.round(Math.min(60, w * 0.08, h * 0.08));
    // The right edge also clears the zoom and download buttons.
    map.fitBounds(bounds, { padding: { top: pad, bottom: pad, left: pad, right: pad + 40 }, maxZoom: 11, duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, ready]);

  // Open (or close) the popup for the selected fellow, showing everyone at that address.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!selection) { closePopup(); return; }
    const nearby = selection.nearby && new Set(selection.nearby);
    const hits = pins.filter((p) => (nearby ? nearby.has(p.fellow) : sameSpot(p.fellow, selection.fellow)));
    if (hits.length === 0) { closePopup(); return; }
    const lngLat: [number, number] = selection.at ?? [selection.fellow.longitude, selection.fellow.latitude];
    const mobile = window.matchMedia(SHEET_QUERY).matches;

    const open = () => {
      if (mobile) {
        closePopup();
        setSheet({ pins: hits, nearby: !!nearby });
        return;
      }
      const el = document.createElement("div");
      // This can run inside React's commit; unmounting another root there logs a race warning.
      const oldRoot = popupRoot.current;
      if (oldRoot) setTimeout(() => oldRoot.unmount());
      popupRoot.current = createRoot(el);
      popupRoot.current.render(<PopupList pins={hits} nearby={!!nearby} />);
      const popup = new maplibregl.Popup({ offset: 12, maxWidth: "320px" }).setLngLat(lngLat).setDOMContent(el);
      // Closing with the × clears the selection; replacing the popup must not.
      popup.on("close", () => { if (popupRef.current === popup) { popupRef.current = null; onSelectRef.current(null); } });
      const old = popupRef.current;
      popupRef.current = popup;
      old?.remove();
      popup.addTo(map);
      keepPopupInView(map, popup);
    };

    if (selection.fly) {
      map.once("moveend", open);
      map.flyTo({
        center: lngLat,
        zoom: Math.max(map.getZoom(), FLY_ZOOM),
        duration: 800,
        // Keep the pin above a bottom sheet on phones.
        padding: mobile ? { top: 0, bottom: Math.round(map.getContainer().clientHeight * 0.5), left: 0, right: 0 } : 0,
      });
      return () => { map.off("moveend", open); };
    }
    open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, pins, ready]);

  return (
    <div className="relative h-3/5 w-full lg:h-full lg:flex-1">
      <div ref={container} className="h-full w-full" />
      {sheet && (
        <div
          role="dialog"
          aria-label="Fellows at this location"
          className="absolute inset-x-0 bottom-0 z-10 max-h-[60%] overflow-y-auto rounded-t-lg bg-white px-4 pb-4 pt-3 shadow-[0_-2px_12px_rgba(46,45,41,.22)]"
        >
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              aria-label="Close"
              className="text-xl leading-none text-black-60 hover:text-black"
              onClick={() => onSelectRef.current(null)}
            >
              ×
            </button>
          </div>
          <PopupList pins={sheet.pins} nearby={sheet.nearby} full />
        </div>
      )}
    </div>
  );
}
