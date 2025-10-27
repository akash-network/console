!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "adbc4b88-5a32-4a5e-a86f-857941fd3baf"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-adbc4b88-5a32-4a5e-a86f-857941fd3baf"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.22.9" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["8001"],
  {
    97070: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.r(t), a.d(t, { default: () => _ });
          var l = a(52322),
            i = a(41172),
            s = a(75377),
            o = a(41477),
            r = a(19623),
            c = a(53108),
            d = a(74229),
            u = a(72059),
            h = a(10706),
            w = a(75958),
            f = a(70734),
            m = a(2784),
            x = a(10289),
            g = a(36321),
            v = a(48346),
            b = a(46103),
            j = a(49409),
            y = a(48534),
            p = a(72565),
            C = a.n(p),
            N = a(91503),
            k = e([h, u, v]);
          [h, u, v] = k.then ? (await k)() : k;
          let E = (0, w.Pi)(e => {
            var t, a;
            let { handleRejectBtnClick: n, handleError: w, rootStore: g, chainTagsStore: v } = e,
              p = (0, x.s0)(),
              [k, _] = (0, m.useState)(void 0),
              [E, I] = (0, m.useState)(""),
              [T, B] = (0, m.useState)(!1),
              S = (0, d.a1)(),
              A = (0, h.Af)(),
              { activeWallet: L, setActiveWallet: R } = (0, h.ZP)(),
              z = (0, u.N8)(),
              { setChains: P, chains: D } = (0, i._IL)(),
              M = (0, m.useMemo)(() => E.replace("https://", ""), [E]),
              G = (0, m.useMemo)(() => (null == k ? void 0 : k.key) || (null == k ? void 0 : k.chainName) || "", [k]);
            (0, m.useEffect)(() => {
              C()
                .storage.local.get([c.A_])
                .then(async function (e) {
                  let { chainInfo: t, origin: a } = e[c.A_].msg;
                  _(t), I(a);
                });
            }, []);
            let J = (0, m.useCallback)(async () => {
                (null == k ? void 0 : k.chainId) && (await v.setBetaChainTags(k.chainId, ["EVM"])),
                  (null == k ? void 0 : k.testnetChainId) && (await v.setBetaChainTags(k.testnetChainId, ["EVM"])),
                  (null == k ? void 0 : k.evmChainId) && (await v.setBetaChainTags(k.evmChainId, ["EVM"])),
                  (null == k ? void 0 : k.evmChainIdTestnet) && (await v.setBetaChainTags(k.evmChainIdTestnet, ["EVM"]));
              }, [k, v]),
              U = async () => {
                B(!0);
                try {
                  let e = await A(L, G, "UPDATE", k),
                    t = await C().storage.local.get([c.Pw]),
                    a = { ...JSON.parse(t[c.Pw] ?? "{}"), [G]: k };
                  await C().storage.local.set({ [c.Pw]: JSON.stringify(a) }),
                    await J(),
                    await z(G, k),
                    L && (await (0, f.E)([(null == k ? void 0 : k.evmChainId) || ""], [L.id], E ?? ""), await R(e[L.id])),
                    P({ ...D, [G]: k }),
                    g.setChains({ ...D, [G]: k }),
                    g.reloadAddresses(),
                    window.removeEventListener("beforeunload", n),
                    await C().storage.local.set({ [c.u1]: { data: "Approved" } }),
                    await C().storage.local.remove([c.A_]),
                    await C().storage.local.remove(c.u1),
                    (0, y.oj)() ? p("/home") : window.close(),
                    B(!1);
                } catch (e) {
                  w("Failed to add network"), B(!1);
                }
              };
            return (0, l.jsxs)(l.Fragment, {
              children: [
                (0, l.jsxs)("div", {
                  className: "flex flex-col items-center",
                  children: [
                    (0, l.jsx)(N.X6, { text: "Add Network" }),
                    (0, l.jsx)(N.GL, { text: "This will allow this network to be used within Leap Wallet." }),
                    (0, l.jsx)(s.GenericCard, {
                      title: (0, l.jsx)("span", { className: "text-[15px] truncate", children: (null == k ? void 0 : k.chainName) ?? "" }),
                      subtitle: M,
                      className: "py-8 my-5",
                      img: (0, l.jsx)("img", { src: (null == k ? void 0 : k.chainSymbolImageUrl) ?? S, className: "h-10 w-10 mr-3", onError: (0, j._)(S) }),
                      size: "sm",
                      isRounded: !0
                    }),
                    (0, l.jsxs)("div", {
                      className: "flex flex-col gap-y-[10px] bg-white-100 dark:bg-gray-900 rounded-2xl p-4 w-full",
                      children: [
                        (0, l.jsx)(o.sr, { children: "Network Name" }),
                        (0, l.jsx)(o.B4, { children: (null == k ? void 0 : k.chainName) ?? "" }),
                        o.iz,
                        (0, l.jsx)(o.sr, { children: "Network URL" }),
                        (0, l.jsx)(o.B4, {
                          children:
                            (null == k ? void 0 : null === (t = k.apis) || void 0 === t ? void 0 : t.evmJsonRpc) ||
                            (null == k ? void 0 : null === (a = k.apis) || void 0 === a ? void 0 : a.evmJsonRpcTest) ||
                            ""
                        }),
                        o.iz,
                        (0, l.jsx)(o.sr, { children: "Chain ID" }),
                        (0, l.jsx)(o.B4, { children: (null == k ? void 0 : k.evmChainId) ?? "" }),
                        o.iz,
                        (0, l.jsx)(o.sr, { children: "Currency Symbol" }),
                        (0, l.jsx)(o.B4, { children: (null == k ? void 0 : k.denom) ?? "" })
                      ]
                    })
                  ]
                }),
                (0, l.jsx)(N.$_, {
                  children: (0, l.jsx)(N.No, {
                    rejectBtnClick: n,
                    rejectBtnText: "Reject",
                    confirmBtnText: T ? (0, l.jsx)(r.T, { color: b.w.white100 }) : "Approve",
                    confirmBtnClick: U
                  })
                })
              ]
            });
          });
          function _() {
            return (0, l.jsx)(N.zb, {
              chainTagsStore: g.HN,
              suggestKey: c.A_,
              children: e => {
                let { handleRejectBtnClick: t, handleError: a, chainTagsStore: n } = e;
                return (0, l.jsx)(E, { chainTagsStore: n, handleRejectBtnClick: t, handleError: a, rootStore: v.Ux });
              }
            });
          }
          n();
        } catch (e) {
          n(e);
        }
      });
    },
    91503: function (e, t, a) {
      a.d(t, { GL: () => u, X6: () => d, zb: () => v, No: () => r, $_: () => i });
      var n = a(52322),
        l = a(2784);
      function i(e) {
        let { children: t } = e;
        return (0, n.jsx)("div", { className: "w-full flex flex-col justify-center items-center box-border mt-4", children: t });
      }
      var s = a(75377),
        o = a(46103);
      function r(e) {
        let { rejectBtnClick: t, rejectBtnText: a, confirmBtnClick: l, confirmBtnText: i } = e;
        return (0, n.jsxs)("div", {
          className: "flex flex-row justify-between w-full",
          children: [
            (0, n.jsx)(s.Buttons.Generic, {
              style: { height: "48px", background: o.w.gray900, color: o.w.white100 },
              onClick: t,
              "aria-label": "reject button in suggest chain flow",
              children: (0, n.jsx)("span", { "aria-label": "reject button text in suggest chain flow", children: a })
            }),
            (0, n.jsx)(s.Buttons.Generic, {
              style: { height: "48px", background: o.w.cosmosPrimary, color: o.w.white100 },
              className: "ml-3 bg-gray-800",
              onClick: l,
              "aria-label": "confirm button in suggest chain flow",
              children: (0, n.jsx)("span", { "aria-label": "confirm button text in suggest chain flow", children: i })
            })
          ]
        });
      }
      var c = a(69816);
      function d(e) {
        let { text: t } = e;
        return (0, n.jsx)(c.Z, { size: "lg", className: "font-bold mt-5", children: t });
      }
      function u(e) {
        let { text: t } = e;
        return (0, n.jsx)(c.Z, {
          size: "xs",
          className: "font-bold text-center mt-[2px] max-w-[250px]",
          color: "text-gray-800 dark:text-gray-600 mb-2",
          children: t
        });
      }
      var h = a(53108),
        w = a(75958),
        f = a(10289),
        m = a(48534),
        x = a(72565),
        g = a.n(x);
      let v = (0, w.Pi)(e => {
        let { children: t, suggestKey: a, chainTagsStore: i } = e,
          s = (0, f.s0)(),
          o = (0, l.useCallback)(
            async e => {
              await g().storage.local.set({ [h.u1]: { error: e } }),
                setTimeout(async () => {
                  await g().storage.local.remove([a]), await g().storage.local.remove(h.u1), (0, m.oj)() ? s("/home") : window.close();
                }, 10);
            },
            [s, a]
          ),
          r = (0, l.useCallback)(async () => {
            await o("Rejected by the user.");
          }, [o]);
        return (
          (0, l.useEffect)(
            () => (
              window.addEventListener("beforeunload", r),
              g().storage.local.remove(h.u1),
              () => {
                window.removeEventListener("beforeunload", r);
              }
            ),
            [r]
          ),
          (0, n.jsx)("div", { children: t({ handleRejectBtnClick: r, handleError: o, chainTagsStore: i }) })
        );
      });
    }
  }
]);
//# sourceMappingURL=8001.js.map
