!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "e16bce14-cb7c-4370-8dd1-d87619fc65c4"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-e16bce14-cb7c-4370-8dd1-d87619fc65c4"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.22.9" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["2105"],
  {
    11375: function (e, t, a) {
      a.d(t, { H: () => n });
      var l = a(52322),
        s = a(57124);
      a(2784);
      var i = a(49409);
      function n(e) {
        let { src: t, bodyText: a, alt: n = "chain logo", network: c } = e,
          o = (0, s.a)();
        return (0, l.jsxs)("div", {
          className: "flex flex-col items-center justify-center gap-1 shrink-0 flex-1",
          children: [
            (0, l.jsx)("img", { src: t, onError: (0, i._)(o), alt: n, className: "w-[36px] h-[36px] rounded-full" }),
            (0, l.jsxs)("p", {
              className: "dark:text-white-100 text-gray-900 text-center",
              children: [a, "Movement" === a && "testnet" === c ? " Porto" : "", "testnet" === c ? " Testnet" : ""]
            })
          ]
        });
      }
    },
    27290: function (e, t, a) {
      a.a(e, async function (e, l) {
        try {
          a.r(t), a.d(t, { default: () => D });
          var s = a(52322),
            i = a(41172),
            n = a(75377),
            c = a(12887),
            o = a(71696),
            r = a.n(o),
            d = a(78454),
            u = a(19623),
            h = a(23259),
            f = a(53108),
            m = a(79533),
            v = a(74229),
            x = a(72059),
            w = a(38313),
            g = a(30464),
            y = a(29750),
            b = a(70734),
            p = a(2784),
            j = a(10289),
            k = a(46103),
            I = a(19288),
            N = a(32374),
            S = a(48534),
            _ = a(71198),
            C = a(72565),
            T = a.n(C),
            A = a(11375),
            E = e([x, w, d]);
          function D() {
            var e, t, a;
            let { theme: l } = (0, n.useTheme)(),
              o = (0, i.DI5)(),
              C = (0, i.rTu)(),
              { topChainColor: E } = (0, v.Cd)();
            r()(null !== C, "activeWallet is null");
            let D = (0, p.useMemo)(() => (0, N.k)(C.name), [C.name]),
              [U, M] = (0, p.useState)(!1),
              [R, B] = (0, p.useState)(""),
              [H, K] = (0, p.useState)(),
              [G, L] = (0, p.useState)(""),
              [O, W] = (0, p.useState)("solana:mainnet"),
              [z, V] = (0, p.useState)(),
              Y = (0, j.s0)(),
              [P, Q] = (0, p.useState)(""),
              Z = (0, x.a7)(),
              $ = (0, p.useMemo)(() => {
                if (R) {
                  let e = Object.values(o).find(e => e.chainId === R || e.testnetChainId === R);
                  if (e) return e.key;
                }
                return Z;
              }, [R, Z, o]),
              q = (0, w.ob)(),
              F = (0, p.useMemo)(() => H || q, [H, q]),
              J = (0, i.QSC)($),
              X = (0, p.useMemo)(
                () =>
                  J ||
                  ($ === h.HW
                    ? { chainName: "All chains", chainSymbolImageUrl: l === n.ThemeName.DARK ? g.r.Misc.AggregatedViewDarkSvg : g.r.Misc.AggregatedViewSvg }
                    : { chainName: "Unknown chain", chainSymbolImageUrl: "" }),
                [J, $, l]
              );
            (0, p.useEffect)(() => {
              T()
                .storage.local.get([f.AI])
                .then(async function (e) {
                  let { network: t, url: a, origin: l } = e[f.AI].payload;
                  L(t), B(a), Q(l);
                });
            }, []),
              (0, p.useEffect)(() => {
                if (G) {
                  let e = Object.values(o).find(e => e.chainId === G || e.testnetChainId === G);
                  if (e) {
                    W(e.key);
                    let t = e.testnetChainId === G ? "testnet" : "mainnet";
                    V(t);
                  }
                }
              }, [o, G]),
              (0, p.useEffect)(() => {
                if (R) {
                  let e = Object.values(o).find(e => e.chainId === R || e.testnetChainId === R);
                  if (e) {
                    let t = e.testnetChainId === R ? "testnet" : "mainnet";
                    K(t);
                  }
                }
              }, [o, R]);
            let ee = async () => {
                await T().storage.local.set({ [f.u1]: { success: !1, error: "Rejected by the user." } }),
                  setTimeout(async () => {
                    await T().storage.local.remove([f.AI]), await T().storage.local.remove(f.u1), (0, S.oj)() ? Y("/home") : window.close();
                  }, 10);
              },
              et = async () => {
                var e, t, a, l, s, i, n, c;
                if (!O) return;
                M(!0), await (0, b.E)([G], [C.id], P);
                let r = (0, m.DY)(P);
                await T().storage.local.set({ [r]: { chainKey: O, network: z } }),
                  await (0, I.Kz)({
                    event: "leap_activeChainInfoChanged",
                    data: {
                      chainId: G,
                      network: z,
                      restUrl:
                        "testnet" === z
                          ? null === (t = o[O]) || void 0 === t
                            ? void 0
                            : null === (e = t.apis) || void 0 === e
                              ? void 0
                              : e.restTest
                          : null === (l = o[O]) || void 0 === l
                            ? void 0
                            : null === (a = l.apis) || void 0 === a
                              ? void 0
                              : a.rest,
                      rpcUrl:
                        "testnet" === z
                          ? null === (i = o[O]) || void 0 === i
                            ? void 0
                            : null === (s = i.apis) || void 0 === s
                              ? void 0
                              : s.rpcTest
                          : null === (c = o[O]) || void 0 === c
                            ? void 0
                            : null === (n = c.apis) || void 0 === n
                              ? void 0
                              : n.rpc,
                      chainKey: O
                    }
                  }),
                  await T().storage.local.set({ [f.u1]: { success: !0, chainId: G } }),
                  setTimeout(async () => {
                    await T().storage.local.remove([f.AI]), await T().storage.local.remove(f.u1), M(!1), (0, S.oj)() ? Y("/home") : window.close();
                  }, 50);
              };
            return (0, s.jsx)("div", {
              className: "w-[400px] h-full relative self-center justify-self-center flex justify-center items-center mt-2",
              children: (0, s.jsx)("div", {
                className: "panel-height relative w-full overflow-clip rounded-md border border-gray-300 dark:border-gray-900",
                children: (0, s.jsxs)(d.Z, {
                  header: (0, s.jsx)("div", {
                    className: "w-[396px]",
                    children: (0, s.jsx)(n.Header, {
                      imgSrc: (null == X ? void 0 : X.chainSymbolImageUrl) ?? y.GenericLight,
                      title: (0, s.jsx)(n.Buttons.Wallet, { title: (0, _.fy)(D, 10), className: "pr-4 cursor-default" })
                    })
                  }),
                  children: [
                    (0, s.jsxs)("div", {
                      className: "px-7 py-3 overflow-y-auto relative h-[450px]",
                      children: [
                        (0, s.jsx)("h2", {
                          className: "text-center text-lg font-bold dark:text-white-100 text-gray-900 w-full",
                          children: "Allow this site to switch the chain?fjsdlfhjskdfj"
                        }),
                        (0, s.jsx)("p", {
                          className: "text-center text-sm dark:text-gray-300 text-gray-500 w-full",
                          children: "This will switch the selected chain within Leap to a previously added chain:"
                        }),
                        (0, s.jsxs)("div", {
                          className: "flex w-full p-8 items-start justify-between",
                          children: [
                            (0, s.jsx)(A.H, {
                              src: (null == X ? void 0 : X.chainSymbolImageUrl) ?? "",
                              bodyText: (null == X ? void 0 : X.chainName) ?? "",
                              alt: (null == X ? void 0 : X.chainName) + " logo",
                              network: F
                            }),
                            (0, s.jsx)("div", {
                              className: "flex items-center justify-center shrink-- w-[36px] h-[36px]",
                              children: (0, s.jsx)("div", {
                                className: "bg-gray-100 dark:bg-gray-850 flex justify-center items-center w-[24px] h-[24px] rounded-full",
                                children: (0, s.jsx)(c.o, { size: 16, className: "dark:text-white-100 text-black-100" })
                              })
                            }),
                            (0, s.jsx)(A.H, {
                              src: (null === (e = o[O]) || void 0 === e ? void 0 : e.chainSymbolImageUrl) ?? "",
                              bodyText: (null === (t = o[O]) || void 0 === t ? void 0 : t.chainName) ?? "",
                              alt: (null === (a = o[O]) || void 0 === a ? void 0 : a.chainName) + " logo",
                              network: z
                            })
                          ]
                        })
                      ]
                    }),
                    (0, s.jsx)("div", {
                      className: "absolute bottom-[36px] left-0 py-3 px-7 dark:bg-black-100 bg-gray-50 w-full",
                      children: (0, s.jsxs)("div", {
                        className: "flex items-center justify-center w-full space-x-3",
                        children: [
                          (0, s.jsx)(n.Buttons.Generic, {
                            title: "Reject Button",
                            color: k.w.gray900,
                            onClick: ee,
                            disabled: U,
                            "aria-label": "switch solanachain reject button",
                            children: "Reject"
                          }),
                          (0, s.jsx)(n.Buttons.Generic, {
                            title: "Approve Button",
                            color: E,
                            onClick: et,
                            disabled: U,
                            className: `${U ? "cursor-not-allowed opacity-50" : ""}`,
                            "aria-label": "switch solanachain button",
                            children: U ? (0, s.jsx)(u.T, { color: "white" }) : "Switch chain"
                          })
                        ]
                      })
                    })
                  ]
                })
              })
            });
          }
          ([x, w, d] = E.then ? (await E)() : E), l();
        } catch (e) {
          l(e);
        }
      });
    }
  }
]);
//# sourceMappingURL=2105.js.map
