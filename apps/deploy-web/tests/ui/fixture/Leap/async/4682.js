!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "800a29c0-4015-4023-83a2-64442dc18d97"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-800a29c0-4015-4023-83a2-64442dc18d97"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.22.9" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["4682"],
  {
    51302: function (e, t, a) {
      a.a(e, async function (e, l) {
        try {
          a.d(t, { Z: () => E });
          var i = a(52322),
            s = a(41172),
            n = a(75377),
            o = a(12887),
            c = a(71696),
            r = a.n(c),
            d = a(78454),
            u = a(19623),
            h = a(23259),
            m = a(53108),
            f = a(74229),
            g = a(72059),
            w = a(38313),
            x = a(30464),
            y = a(29750),
            v = a(70734),
            b = a(2784),
            p = a(10289),
            j = a(48346),
            N = a(46103),
            k = a(32374),
            I = a(48534),
            S = a(71198),
            _ = a(72565),
            A = a.n(_),
            T = a(16686),
            C = e([g, w, j, d]);
          function E() {
            var e, t, a;
            let { theme: l } = (0, n.useTheme)(),
              c = (0, g.a7)(),
              _ = (0, s.QSC)(),
              C = (0, b.useMemo)(
                () =>
                  _ ||
                  (c === h.HW
                    ? { chainName: "All chains", chainSymbolImageUrl: l === n.ThemeName.DARK ? x.r.Misc.AggregatedViewDarkSvg : x.r.Misc.AggregatedViewSvg }
                    : { chainName: "Unknown chain", chainSymbolImageUrl: "" }),
                [_, c, l]
              ),
              E = (0, s.rTu)(),
              { topChainColor: D } = (0, f.Cd)(),
              U = (0, g.N8)(),
              R = (0, w.fn)();
            r()(null !== E, "activeWallet is null");
            let B = (0, b.useMemo)(() => (0, k.k)(E.name), [E.name]),
              H = (0, s.DI5)(),
              [M, G] = (0, b.useState)(!1),
              [L, W] = (0, b.useState)(""),
              [Z, K] = (0, b.useState)(),
              O = (0, p.s0)(),
              [V, Y] = (0, b.useState)("");
            (0, b.useEffect)(() => {
              A()
                .storage.local.get([m.AI])
                .then(async function (e) {
                  let { requestedActiveChain: t, setNetworkTo: a, origin: l } = e[m.AI].msg;
                  W(t), K(a), Y(l);
                });
            }, []);
            let z = async () => {
                await A().storage.local.set({ [m.u1]: { error: "Rejected by the user." } }),
                  setTimeout(async () => {
                    await A().storage.local.remove([m.AI]), await A().storage.local.remove(m.u1), (0, I.oj)() ? O("/home") : window.close();
                  }, 10);
              },
              Q = async () => {
                var e, t, a;
                G(!0);
                let l =
                  ("testnet" === Z
                    ? null === (e = H[L]) || void 0 === e
                      ? void 0
                      : e.testnetChainId
                    : null === (t = H[L]) || void 0 === t
                      ? void 0
                      : t.chainId) ?? "";
                await (0, v.E)([l], [E.id], V),
                  await A().storage.local.set({ [m.hs]: L }),
                  U(L),
                  j.Ux.setActiveChain(L),
                  (null === (a = H[L]) || void 0 === a ? void 0 : a.evmOnlyChain) && (await A().storage.local.set({ [m.YK]: L })),
                  Z && (R(Z), await A().storage.local.set({ [m.Ol]: Z })),
                  await A().storage.local.set({ [m.u1]: { data: "Approved" } }),
                  setTimeout(async () => {
                    await A().storage.local.remove([m.AI]), await A().storage.local.remove(m.u1), G(!1), (0, I.oj)() ? O("/home") : window.close();
                  }, 50);
              };
            return (0, i.jsx)("div", {
              className: "w-[400px] h-full relative self-center justify-self-center flex justify-center items-center mt-2",
              children: (0, i.jsx)("div", {
                className: "panel-height relative w-full overflow-clip rounded-md border border-gray-300 dark:border-gray-900",
                children: (0, i.jsxs)(d.Z, {
                  header: (0, i.jsx)("div", {
                    className: "w-[396px]",
                    children: (0, i.jsx)(n.Header, {
                      imgSrc: (null == C ? void 0 : C.chainSymbolImageUrl) ?? y.GenericLight,
                      title: (0, i.jsx)(n.Buttons.Wallet, { title: (0, S.fy)(B, 10), className: "pr-4 cursor-default" })
                    })
                  }),
                  children: [
                    (0, i.jsxs)("div", {
                      className: "px-7 py-3 overflow-y-auto relative h-[450px]",
                      children: [
                        (0, i.jsx)("h2", {
                          className: "text-center text-lg font-bold dark:text-white-100 text-gray-900 w-full",
                          children: "Allow this site to switch the chain?"
                        }),
                        (0, i.jsx)("p", {
                          className: "text-center text-sm dark:text-gray-300 text-gray-500 w-full",
                          children: "This will switch the selected chain within Leap to a previously added chain:"
                        }),
                        (0, i.jsxs)("div", {
                          className: "flex w-full p-8 items-center justify-between",
                          children: [
                            (0, i.jsx)(T.H, {
                              src: (null == C ? void 0 : C.chainSymbolImageUrl) ?? "",
                              bodyText: (null == C ? void 0 : C.chainName) ?? "",
                              alt: (null == C ? void 0 : C.chainName) + " logo"
                            }),
                            (0, i.jsx)("div", {
                              className: "bg-gray-100 dark:bg-gray-850 shrink-0 flex justify-center items-center w-[36px] h-[36px] rounded-full",
                              children: (0, i.jsx)(o.o, { size: 24, className: "dark:text-white-100 text-black-100" })
                            }),
                            (0, i.jsx)(T.H, {
                              src: (null === (e = H[L]) || void 0 === e ? void 0 : e.chainSymbolImageUrl) ?? "",
                              bodyText: (null === (t = H[L]) || void 0 === t ? void 0 : t.chainName) ?? "",
                              alt: (null === (a = H[L]) || void 0 === a ? void 0 : a.chainName) + " logo"
                            })
                          ]
                        })
                      ]
                    }),
                    (0, i.jsx)("div", {
                      className: "absolute bottom-[36px] left-0 py-3 px-7 dark:bg-black-100 bg-gray-50 w-full",
                      children: (0, i.jsxs)("div", {
                        className: "flex items-center justify-center w-full space-x-3",
                        children: [
                          (0, i.jsx)(n.Buttons.Generic, {
                            title: "Reject Button",
                            color: N.w.gray900,
                            onClick: z,
                            disabled: M,
                            "aria-label": "switch ethereumchain reject button",
                            children: "Reject"
                          }),
                          (0, i.jsx)(n.Buttons.Generic, {
                            title: "Approve Button",
                            color: D,
                            onClick: Q,
                            disabled: M,
                            className: `${M ? "cursor-not-allowed opacity-50" : ""}`,
                            "aria-label": "switch ethereumchain button",
                            children: M ? (0, i.jsx)(u.T, { color: "white" }) : "Switch chain"
                          })
                        ]
                      })
                    })
                  ]
                })
              })
            });
          }
          ([g, w, j, d] = C.then ? (await C)() : C), l();
        } catch (e) {
          l(e);
        }
      });
    },
    16686: function (e, t, a) {
      a.d(t, { H: () => n });
      var l = a(52322),
        i = a(57124);
      a(2784);
      var s = a(49409);
      function n(e) {
        let { src: t, bodyText: a, alt: n = "chain logo" } = e,
          o = (0, i.a)();
        return (0, l.jsxs)("div", {
          className: "flex flex-col items-center justify-center gap-1",
          children: [
            (0, l.jsx)("img", { src: t, onError: (0, s._)(o), alt: n, className: "w-[36px] h-[36px] rounded-full" }),
            (0, l.jsx)("p", { className: "dark:text-white-100 text-gray-900", children: a })
          ]
        });
      }
    },
    55899: function (e, t, a) {
      a.a(e, async function (e, l) {
        try {
          a.r(t), a.d(t, { default: () => i.Z });
          var i = a(51302),
            s = e([i]);
          (i = (s.then ? (await s)() : s)[0]), l();
        } catch (e) {
          l(e);
        }
      });
    }
  }
]);
//# sourceMappingURL=4682.js.map
