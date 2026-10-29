// Minimal fetch wrapper. Reads the API base URL from window.THEME.apiBase
// (set in _includes/head.html from theme_config.api.base_url), and exposes
// Theme.api.get/post/put/del. All responses are parsed as JSON when possible.
(function () {
  "use strict";

  function resolve(path) {
    var base = (window.THEME && window.THEME.apiBase) || "";
    if (/^https?:\/\//i.test(path)) return path;
    return base.replace(/\/$/, "") + "/" + String(path).replace(/^\//, "");
  }

  function request(method, path, body) {
    var opts = { method: method, headers: {} };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    return fetch(resolve(path), opts).then(function (res) {
      return res.text().then(function (text) {
        var data;
        try {
          data = text ? JSON.parse(text) : null;
        } catch (e) {
          data = text;
        }
        if (!res.ok) {
          var err = new Error("Request failed: " + res.status);
          err.status = res.status;
          err.body = data;
          throw err;
        }
        return data;
      });
    });
  }

  window.Theme = window.Theme || {};
  window.Theme.api = {
    get: function (path) { return request("GET", path); },
    post: function (path, body) { return request("POST", path, body); },
    put: function (path, body) { return request("PUT", path, body); },
    del: function (path) { return request("DELETE", path); },
  };
})();
