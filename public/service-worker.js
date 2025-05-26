if (!self.define) {
  let e,
    s = {};
  const t = (t, i) => (
    (t = new URL(t + ".js", i).href),
    s[t] ||
      new Promise((s) => {
        if ("document" in self) {
          const e = document.createElement("script");
          (e.src = t), (e.onload = s), document.head.appendChild(e);
        } else (e = t), importScripts(t), s();
      }).then(() => {
        let e = s[t];
        if (!e) throw new Error(`Module ${t} didn’t register its module`);
        return e;
      })
  );
  self.define = (i, n) => {
    const o =
      e ||
      ("document" in self ? document.currentScript.src : "") ||
      location.href;
    if (s[o]) return;
    let r = {};
    const c = (e) => t(e, o),
      d = { module: { uri: o }, exports: r, require: c };
    s[o] = Promise.all(i.map((e) => d[e] || c(e))).then((e) => (n(...e), r));
  };
}
define(["./workbox-3bd9af45"], function (e) {
  "use strict";
  self.addEventListener("message", (e) => {
    e.data && "SKIP_WAITING" === e.data.type && self.skipWaiting();
  }),
    e.precacheAndRoute(
      [
        { url: "app.js", revision: "d41d8cd98f00b204e9800998ecf8427e" },
        { url: "index.html", revision: "c6771b679e433e2deb618028a819a572" },
        { url: "manifest.json", revision: "b682fead3ac5416acec2666d45c083f3" },
      ],
      {}
    ),
    e.registerRoute(
      /\.(?:html|js|css|wasm)$/,
      new e.StaleWhileRevalidate(),
      "GET"
    );
});
//# sourceMappingURL=service-worker.js.map
