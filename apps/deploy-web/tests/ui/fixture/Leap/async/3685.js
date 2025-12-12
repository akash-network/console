!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      n = new e.Error().stack;
    n &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[n] = "87d85f8a-7c28-4dae-b819-05291149138d"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-87d85f8a-7c28-4dae-b819-05291149138d"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.23.1" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["3685"],
  {
    98622: function (e, n, d) {
      d.d(n, { z: () => s });
      var o = d(52322),
        l = d(4370);
      d(2784);
      var f = d(70514);
      let s = e => {
        let { className: n, children: d, ...s } = e;
        return (0, o.jsx)(l.E.div, {
          className: (0, f.cn)("overflow-auto bg-secondary overflow-x-hidden my-auto mx-auto rounded-3xl flex h-full w-full", n),
          ...s,
          children: d
        });
      };
    }
  }
]);
//# sourceMappingURL=3685.js.map
