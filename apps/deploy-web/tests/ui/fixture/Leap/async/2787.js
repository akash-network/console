!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      n = new e.Error().stack;
    n &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[n] = "c85a7356-b10b-476b-a602-9ef9624072eb"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-c85a7356-b10b-476b-a602-9ef9624072eb"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.23.1" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["2787"],
  {
    98622: function (e, n, o) {
      o.d(n, { z: () => s });
      var d = o(52322),
        l = o(4370);
      o(2784);
      var f = o(70514);
      let s = e => {
        let { className: n, children: o, ...s } = e;
        return (0, d.jsx)(l.E.div, {
          className: (0, f.cn)("overflow-auto bg-secondary overflow-x-hidden my-auto mx-auto rounded-3xl flex h-full w-full", n),
          ...s,
          children: o
        });
      };
    }
  }
]);
//# sourceMappingURL=2787.js.map
