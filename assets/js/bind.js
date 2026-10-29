// Live data display. Any element marked with data-source fetches that path
// through Theme.api.get and writes the result into the element as text —
// never innerHTML, so an API response can never inject markup into the page.
//
//   <span data-source="/api/stats" data-field="hands_played" data-format="number">—</span>
//
// Elements sharing the same data-source are fetched together (one request).
// Add data-poll="5000" (ms) to one of them to keep refetching on an interval.
(function () {
  "use strict";

  function getPath(obj, path) {
    return path.split(".").reduce(function (o, k) {
      return o && typeof o === "object" ? o[k] : undefined;
    }, obj);
  }

  function format(value, kind) {
    if (value === undefined || value === null) return value;
    if (kind === "number") {
      var n = Number(value);
      return isNaN(n) ? value : n.toLocaleString();
    }
    return value;
  }

  function apply(el, data) {
    var field = el.getAttribute("data-field");
    var value = field ? getPath(data, field) : data;
    if (value === undefined || value === null) return;
    el.textContent = format(value, el.getAttribute("data-format"));
  }

  function groupBySource(els) {
    var groups = {};
    els.forEach(function (el) {
      var src = el.getAttribute("data-source");
      (groups[src] = groups[src] || []).push(el);
    });
    return groups;
  }

  function refresh(source, els) {
    if (!window.Theme || !window.Theme.api) return;
    window.Theme.api.get(source).then(function (data) {
      els.forEach(function (el) { apply(el, data); });
    }).catch(function (err) {
      console.error("[theme] failed to load", source, err);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var els = Array.prototype.slice.call(document.querySelectorAll("[data-source]"));
    if (!els.length) return;
    var groups = groupBySource(els);
    Object.keys(groups).forEach(function (source) {
      var group = groups[source];
      refresh(source, group);
      var poll = group[0].getAttribute("data-poll");
      if (poll) {
        setInterval(function () { refresh(source, group); }, Math.max(1000, Number(poll)));
      }
    });
  });
})();
