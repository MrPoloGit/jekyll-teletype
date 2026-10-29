// Venue map. The contiguous United States as a grid of small dots (a
// hand-simplified outline, equirectangular with a cos(lat) squeeze), with
// venue markers on top. Redraws at the rendered width (via ResizeObserver)
// so labels stay 10px regardless of column width.
//
// Ported from teletype.html (source: pokerbot.sequoiacap.com), ~line 3418.
// Self-contained — no shared poker-engine dependency, unlike exhibits B/E.
//
// Markup it expects (see exhibits.md):
//   <figure id="map" class="map-fig">
//     <svg id="map-svg" role="img" aria-label="..."></svg>
//   </figure>
(() => {
  "use strict";
  const fig = document.getElementById("map"), svg = document.getElementById("map-svg");
  if (!fig || !svg) return;
  const NS = "http://www.w3.org/2000/svg";

  // [lon, lat], clockwise from the Olympic Peninsula. Lake Michigan is cut out separately.
  const US = [
    [-124.7, 48.4], [-123.0, 49.0], [-95.2, 49.0], [-89.6, 48.0], [-84.7, 46.5], [-84.7, 45.8], [-83.4, 45.0],
    [-83.9, 43.9], [-82.6, 43.9], [-82.4, 43.0], [-82.5, 42.3], [-83.3, 41.8], [-81.7, 41.5], [-80.1, 42.1],
    [-78.9, 42.9], [-79.0, 43.3], [-77.6, 43.3], [-76.2, 43.5], [-76.3, 44.2], [-74.7, 45.0], [-71.5, 45.0],
    [-70.9, 45.3], [-70.0, 46.7], [-69.2, 47.4], [-67.8, 47.1], [-67.8, 45.7], [-67.0, 44.8], [-68.8, 44.3],
    [-70.2, 43.6], [-70.6, 42.6], [-71.0, 42.3], [-70.0, 41.8], [-71.4, 41.4], [-73.6, 41.0], [-74.0, 40.6],
    [-74.0, 39.6], [-74.9, 38.9], [-75.1, 38.8], [-75.9, 37.2], [-76.0, 36.9], [-75.5, 35.3], [-76.7, 34.7],
    [-77.9, 33.9], [-79.2, 33.2], [-80.0, 32.6], [-81.1, 32.0], [-81.4, 30.4], [-80.6, 28.4], [-80.1, 26.7],
    [-80.4, 25.2], [-81.1, 25.1], [-81.8, 26.1], [-82.7, 27.9], [-83.7, 29.9], [-84.4, 30.0], [-85.6, 30.1],
    [-87.6, 30.3], [-89.6, 30.2], [-89.2, 29.2], [-90.5, 29.1], [-91.8, 29.5], [-93.8, 29.7], [-94.8, 29.3],
    [-96.8, 28.2], [-97.4, 27.2], [-97.2, 25.9], [-99.5, 27.5], [-101.0, 29.4], [-103.3, 29.0], [-104.5, 29.6],
    [-106.5, 31.8], [-108.2, 31.8], [-108.2, 31.3], [-111.1, 31.3], [-114.8, 32.5], [-117.1, 32.5], [-118.5, 34.0],
    [-120.6, 34.6], [-121.9, 36.6], [-122.5, 37.8], [-123.8, 39.8], [-124.4, 40.4], [-124.2, 42.0], [-124.0, 46.2],
  ];
  const LAKE = [[-87.5, 41.6], [-87.8, 42.5], [-87.9, 43.5], [-87.4, 44.5], [-86.8, 45.7], [-85.0, 46.0],
    [-85.4, 45.2], [-86.4, 44.2], [-86.3, 43.0], [-86.6, 42.0]];
  const VENUES = [
    { lon: -71.06, lat: 42.36, name: "BOSTON", date: "NOV 9", at: "upleft" },
    { lon: -79.99, lat: 40.44, name: "PITTSBURGH", date: "NOV 12", at: "downleft" },
    { lon: -122.25, lat: 37.6, name: "BAY AREA", date: "NOV 6", at: "right", finals: "FINALS, SF", finalsDate: "NOV 15" },
  ];
  const LON0 = -125, LON1 = -66.5, LAT0 = 24.3, LAT1 = 49.5, SQ = Math.cos((38 * Math.PI) / 180);

  const inside = (pt, poly) => {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  };
  const el = (name, attrs, text) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text) e.textContent = text;
    return e;
  };

  let drawnW = 0;
  function draw() {
    const W = Math.round(fig.clientWidth);
    if (!W || W === drawnW) return;
    drawnW = W;
    const k = W / ((LON1 - LON0) * SQ), H = Math.round((LAT1 - LAT0) * k);
    const x = lon => (lon - LON0) * SQ * k, y = lat => (LAT1 - lat) * k;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", W); svg.setAttribute("height", H);
    // The map takes whole lines, so the margin numbers beside it keep the page's rhythm.
    const lh = parseFloat(getComputedStyle(fig).lineHeight) || 27;
    fig.style.height = Math.ceil(H / lh) * lh + "px";
    svg.textContent = "";
    // Land: one path of tiny circles on a regular grid.
    const step = Math.max(6, Math.round(W / 80)), r = Math.max(1, step * 0.17);
    let d = "";
    for (let py = step / 2; py < H; py += step) {
      for (let px = step / 2; px < W; px += step) {
        const pt = [LON0 + px / (SQ * k), LAT1 - py / k];
        if (inside(pt, US) && !inside(pt, LAKE)) d += `M${(px - r).toFixed(1)} ${py.toFixed(1)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
      }
    }
    svg.appendChild(el("path", { class: "land", d }));
    VENUES.forEach((v, i) => {
      const cx = x(v.lon), cy = y(v.lat);
      const g = el("g", {});
      g.appendChild(el("circle", { class: "pulse", cx, cy, r: 3, style: `animation-delay:${i * 0.5}s` }));
      if (v.finals) g.appendChild(el("circle", { class: "ring", cx, cy, r: 6.5 }));
      g.appendChild(el("circle", { class: "city", cx, cy, r: 3 }));
      const label = (tx, ty, anchor, name, date) => {
        const t = el("text", { x: tx, y: ty, "text-anchor": anchor });
        t.appendChild(document.createTextNode(name + " "));
        t.appendChild(el("tspan", { class: "d" }, "· " + date));
        g.appendChild(t);
      };
      if (v.at === "upleft") label(cx - 9, cy - 8, "end", v.name, v.date);
      // On narrow maps a label to the left would run into the Bay Area label, so centre it below.
      if (v.at === "downleft") { if (W < 480) label(cx, cy + 16, "middle", v.name, v.date); else label(cx - 9, cy + 15, "end", v.name, v.date); }
      if (v.at === "right") { label(cx + 12, cy - 2, "start", v.name, v.date); label(cx + 12, cy + 11, "start", v.finals, v.finalsDate); }
      svg.appendChild(g);
    });
  }
  new ResizeObserver(draw).observe(fig);
  draw();
})();
