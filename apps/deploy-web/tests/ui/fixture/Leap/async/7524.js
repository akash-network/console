!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      n = new e.Error().stack;
    n &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[n] = "8afbf305-e4ac-4233-9875-1220634c2c3e"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-8afbf305-e4ac-4233-9875-1220634c2c3e"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.23.1" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["7524"],
  {
    47505: function (e, n, o) {
      o.r(n), o.d(n, { default: () => d });
      var s = o(6809),
        f = o(7473),
        t = o(2784),
        a = o(43335);
      (0, s.fx)({ "x-app-type": "leap-extension" }),
        (0, s.sb)(a.F),
        (0, s.o5)("c1577525-a1e8-463a-9202-826e36c03784"),
        (0, s.fC)("9u2U91DrlrQ__3uBDAWygFyjKxiNSM6K");
      let d = (0, t.memo)(function () {
        return (0, s.C$)(), (0, s.Uj)({ chainTypes: ["cosmos", "evm"] }), (0, s.P4)({ chainTypes: ["evm", "svm"] }), (0, s.Mm)(), (0, f.Z)(), null;
      });
    }
  }
]);
//# sourceMappingURL=7524.js.map
