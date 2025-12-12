!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      a = new e.Error().stack;
    a &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[a] = "56b3bd06-db98-4e9a-91f4-e78fd6b68e99"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-56b3bd06-db98-4e9a-91f4-e78fd6b68e99"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.23.1" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["8001"],
  {
    97070: function (e, a, t) {
      t.a(e, async function (e, n) {
        try {
          t.r(a), t.d(a, { default: () => I });
          var i = t(52322),
            l = t(41172),
            s = t(75377),
            r = t(92642),
            o = t(41477),
            c = t(19623),
            d = t(53108),
            u = t(74229),
            h = t(72059),
            g = t(10706),
            m = t(75958),
            w = t(70734),
            f = t(2784),
            x = t(10289),
            v = t(36321),
            b = t(48346),
            y = t(46103),
            j = t(49409),
            p = t(48534),
            _ = t(72565),
            C = t.n(_),
            N = t(91503),
            k = e([g, h, b]);
          [g, h, b] = k.then ? (await k)() : k;
          let E = (0, m.Pi)(e => {
            var a, t;
            let { handleRejectBtnClick: n, handleError: m, rootStore: v, chainTagsStore: b } = e,
              _ = (0, x.s0)(),
              [k, I] = (0, f.useState)(void 0),
              [E, T] = (0, f.useState)(""),
              [S, B] = (0, f.useState)(!1),
              A = (0, u.a1)(),
              R = (0, g.Af)(),
              { activeWallet: P, setActiveWallet: L } = (0, g.ZP)(),
              z = (0, h.N8)(),
              { setChains: M, chains: D } = (0, l._IL)(),
              U = (0, f.useMemo)(() => E.replace("https://", ""), [E]),
              G = (0, f.useMemo)(() => (null == k ? void 0 : k.key) || (null == k ? void 0 : k.chainName) || "", [k]);
            (0, f.useEffect)(() => {
              C()
                .storage.local.get([d.A_])
                .then(async function (e) {
                  let { chainInfo: a, origin: t } = e[d.A_].msg;
                  I(a), T(t);
                });
            }, []);
            let J = (0, f.useCallback)(async () => {
                (null == k ? void 0 : k.chainId) && (await b.setBetaChainTags(k.chainId, ["EVM"])),
                  (null == k ? void 0 : k.testnetChainId) && (await b.setBetaChainTags(k.testnetChainId, ["EVM"])),
                  (null == k ? void 0 : k.evmChainId) && (await b.setBetaChainTags(k.evmChainId, ["EVM"])),
                  (null == k ? void 0 : k.evmChainIdTestnet) && (await b.setBetaChainTags(k.evmChainIdTestnet, ["EVM"]));
              }, [k, b]),
              V = async () => {
                B(!0);
                try {
                  let e = await R(P, G, "UPDATE", k),
                    a = await C().storage.local.get([d.Pw]),
                    t = { ...JSON.parse(a[d.Pw] ?? "{}"), [G]: k };
                  await C().storage.local.set({ [d.Pw]: JSON.stringify(t) }),
                    await J(),
                    await z(G, k),
                    P && (await (0, w.E)([(null == k ? void 0 : k.evmChainId) || ""], [P.id], E ?? ""), await L(e[P.id])),
                    M({ ...D, [G]: k }),
                    v.setChains({ ...D, [G]: k }),
                    v.reloadAddresses(),
                    window.removeEventListener("beforeunload", n),
                    await C().storage.local.set({ [d.u1]: { data: "Approved" } }),
                    await C().storage.local.remove([d.A_]),
                    await C().storage.local.remove(d.u1),
                    (0, p.oj)() ? _("/home") : window.close(),
                    B(!1);
                } catch (e) {
                  m("Failed to add network"),
                    B(!1),
                    (0, r.Tb)(e, {
                      tags: {
                        errorType: "suggest_chain_error",
                        source: "suggest_chain",
                        severity: "error",
                        errorName: e instanceof Error ? e.name : "SuggestChainError"
                      },
                      fingerprint: ["suggest_chain", "suggest_chain_error"],
                      level: "error",
                      contexts: { transaction: { type: "suggest_chain", errorMessage: e instanceof Error ? e.message : String(e) } },
                      extra: {
                        chain: null == k ? void 0 : k.chainId,
                        chainName: null == k ? void 0 : k.chainName,
                        chainRegistryPath: null == k ? void 0 : k.chainRegistryPath,
                        chainId: null == k ? void 0 : k.chainId,
                        chainSymbolImageUrl: null == k ? void 0 : k.chainSymbolImageUrl,
                        chainSymbol: null == k ? void 0 : k.denom
                      }
                    });
                }
              };
            return (0, i.jsxs)(i.Fragment, {
              children: [
                (0, i.jsxs)("div", {
                  className: "flex flex-col items-center",
                  children: [
                    (0, i.jsx)(N.X6, { text: "Add Network" }),
                    (0, i.jsx)(N.GL, { text: "This will allow this network to be used within Leap Wallet." }),
                    (0, i.jsx)(s.GenericCard, {
                      title: (0, i.jsx)("span", { className: "text-[15px] truncate", children: (null == k ? void 0 : k.chainName) ?? "" }),
                      subtitle: U,
                      className: "py-8 my-5",
                      img: (0, i.jsx)("img", { src: (null == k ? void 0 : k.chainSymbolImageUrl) ?? A, className: "h-10 w-10 mr-3", onError: (0, j._)(A) }),
                      size: "sm",
                      isRounded: !0
                    }),
                    (0, i.jsxs)("div", {
                      className: "flex flex-col gap-y-[10px] bg-white-100 dark:bg-gray-900 rounded-2xl p-4 w-full",
                      children: [
                        (0, i.jsx)(o.sr, { children: "Network Name" }),
                        (0, i.jsx)(o.B4, { children: (null == k ? void 0 : k.chainName) ?? "" }),
                        o.iz,
                        (0, i.jsx)(o.sr, { children: "Network URL" }),
                        (0, i.jsx)(o.B4, {
                          children:
                            (null == k ? void 0 : null === (a = k.apis) || void 0 === a ? void 0 : a.evmJsonRpc) ||
                            (null == k ? void 0 : null === (t = k.apis) || void 0 === t ? void 0 : t.evmJsonRpcTest) ||
                            ""
                        }),
                        o.iz,
                        (0, i.jsx)(o.sr, { children: "Chain ID" }),
                        (0, i.jsx)(o.B4, { children: (null == k ? void 0 : k.evmChainId) ?? "" }),
                        o.iz,
                        (0, i.jsx)(o.sr, { children: "Currency Symbol" }),
                        (0, i.jsx)(o.B4, { children: (null == k ? void 0 : k.denom) ?? "" })
                      ]
                    })
                  ]
                }),
                (0, i.jsx)(N.$_, {
                  children: (0, i.jsx)(N.No, {
                    rejectBtnClick: n,
                    rejectBtnText: "Reject",
                    confirmBtnText: S ? (0, i.jsx)(c.T, { color: y.w.white100 }) : "Approve",
                    confirmBtnClick: V
                  })
                })
              ]
            });
          });
          function I() {
            return (0, i.jsx)(N.zb, {
              chainTagsStore: v.HN,
              suggestKey: d.A_,
              children: e => {
                let { handleRejectBtnClick: a, handleError: t, chainTagsStore: n } = e;
                return (0, i.jsx)(E, { chainTagsStore: n, handleRejectBtnClick: a, handleError: t, rootStore: b.Ux });
              }
            });
          }
          n();
        } catch (e) {
          n(e);
        }
      });
    },
    91503: function (e, a, t) {
      t.d(a, { GL: () => u, X6: () => d, zb: () => v, No: () => o, $_: () => l });
      var n = t(52322),
        i = t(2784);
      function l(e) {
        let { children: a } = e;
        return (0, n.jsx)("div", { className: "w-full flex flex-col justify-center items-center box-border mt-4", children: a });
      }
      var s = t(75377),
        r = t(46103);
      function o(e) {
        let { rejectBtnClick: a, rejectBtnText: t, confirmBtnClick: i, confirmBtnText: l } = e;
        return (0, n.jsxs)("div", {
          className: "flex flex-row justify-between w-full",
          children: [
            (0, n.jsx)(s.Buttons.Generic, {
              style: { height: "48px", background: r.w.gray900, color: r.w.white100 },
              onClick: a,
              "aria-label": "reject button in suggest chain flow",
              children: (0, n.jsx)("span", { "aria-label": "reject button text in suggest chain flow", children: t })
            }),
            (0, n.jsx)(s.Buttons.Generic, {
              style: { height: "48px", background: r.w.cosmosPrimary, color: r.w.white100 },
              className: "ml-3 bg-gray-800",
              onClick: i,
              "aria-label": "confirm button in suggest chain flow",
              children: (0, n.jsx)("span", { "aria-label": "confirm button text in suggest chain flow", children: l })
            })
          ]
        });
      }
      var c = t(69816);
      function d(e) {
        let { text: a } = e;
        return (0, n.jsx)(c.Z, { size: "lg", className: "font-bold mt-5", children: a });
      }
      function u(e) {
        let { text: a } = e;
        return (0, n.jsx)(c.Z, {
          size: "xs",
          className: "font-bold text-center mt-[2px] max-w-[250px]",
          color: "text-gray-800 dark:text-gray-600 mb-2",
          children: a
        });
      }
      var h = t(53108),
        g = t(75958),
        m = t(10289),
        w = t(48534),
        f = t(72565),
        x = t.n(f);
      let v = (0, g.Pi)(e => {
        let { children: a, suggestKey: t, chainTagsStore: l } = e,
          s = (0, m.s0)(),
          r = (0, i.useCallback)(
            async e => {
              await x().storage.local.set({ [h.u1]: { error: e } }),
                setTimeout(async () => {
                  await x().storage.local.remove([t]), await x().storage.local.remove(h.u1), (0, w.oj)() ? s("/home") : window.close();
                }, 10);
            },
            [s, t]
          ),
          o = (0, i.useCallback)(async () => {
            await r("Rejected by the user.");
          }, [r]);
        return (
          (0, i.useEffect)(
            () => (
              window.addEventListener("beforeunload", o),
              x().storage.local.remove(h.u1),
              () => {
                window.removeEventListener("beforeunload", o);
              }
            ),
            [o]
          ),
          (0, n.jsx)("div", { children: a({ handleRejectBtnClick: o, handleError: r, chainTagsStore: l }) })
        );
      });
    }
  }
]);
//# sourceMappingURL=8001.js.map
