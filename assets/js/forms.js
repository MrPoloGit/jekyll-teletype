// Form submission. Any <form data-api="/api/path"> is intercepted, its
// fields serialized to JSON, and POSTed through Theme.api.post instead of a
// normal browser navigation. Toggles [data-success]/[data-error] elements
// inside the form (both start hidden) to show the result; set
// aria-invalid="true" on the fields yourself server-side-style if you want
// per-field error states — this script only handles the whole-form outcome.
//
//   <form data-api="/api/apply">
//     <input name="email" type="email" required>
//     <button type="submit">Submit</button>
//     <p data-success hidden>Thanks — you're in.</p>
//     <p data-error hidden></p>
//   </form>
(function () {
  "use strict";

  function setStatus(form, state, message) {
    var ok = form.querySelector("[data-success]");
    var err = form.querySelector("[data-error]");
    if (ok) ok.hidden = state !== "success";
    if (err) {
      err.hidden = state !== "error";
      if (state === "error") err.textContent = message || "Something went wrong. Try again.";
    }
  }

  function serialize(form) {
    var data = {};
    new FormData(form).forEach(function (value, key) {
      if (key in data) {
        data[key] = Array.isArray(data[key]) ? data[key].concat(value) : [data[key], value];
      } else {
        data[key] = value;
      }
    });
    return data;
  }

  document.addEventListener("submit", function (e) {
    var form = e.target;
    if (!(form instanceof HTMLFormElement) || !form.hasAttribute("data-api")) return;
    e.preventDefault();

    if (!window.Theme || !window.Theme.api) return;

    var path = form.getAttribute("data-api");
    var button = form.querySelector("[type=submit]");
    if (button) button.disabled = true;
    setStatus(form, "pending");

    window.Theme.api.post(path, serialize(form)).then(function () {
      setStatus(form, "success");
      form.reset();
    }).catch(function (err) {
      var message = err && err.body && err.body.message;
      setStatus(form, "error", message);
    }).finally(function () {
      if (button) button.disabled = false;
    });
  });
})();
