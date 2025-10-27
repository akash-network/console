!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      n = new e.Error().stack;
    n &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[n] = "4d741f4e-13c3-4716-a515-2758cba4f548"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-4d741f4e-13c3-4716-a515-2758cba4f548"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.22.9" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["7524"],
  {
    47505: function (e, n, o) {
      o.r(n), o.d(n, { default: () => t });
      var f = o(6809),
        s = o(2784),
        d = o(43335);
      (0, f.fx)({ "x-app-type": "leap-extension" }),
        (0, f.sb)(d.F),
        (0, f.o5)("c1577525-a1e8-463a-9202-826e36c03784"),
        (0, f.fC)("9u2U91DrlrQ__3uBDAWygFyjKxiNSM6K");
      let t = (0, s.memo)(function () {
        return (0, f.C$)(), (0, f.Uj)({ chainTypes: ["cosmos", "evm"] }), null;
      });
    }
  }
]);
//# sourceMappingURL=7524.js.map
