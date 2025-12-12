!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      n = new e.Error().stack;
    n &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[n] = "6f4a2588-e8ee-44e1-b668-bb8db8f83160"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-6f4a2588-e8ee-44e1-b668-bb8db8f83160"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.23.1" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["3964"],
  {
    79215: function (e, n, a) {
      a.d(n, { og: () => f });
      var i = a(52322),
        l = a(26793),
        o = a(89187),
        t = a(16283),
        s = a(85027),
        r = a(86240),
        d = a(65953);
      a(2784);
      var c = a(70514),
        u = a(49409);
      let h = e => {
          let { activeIndex: n, setActiveIndex: a, limit: d } = e,
            { walletAvatar: u, walletName: h } = (0, r.v)();
          return (0, i.jsxs)(s.m, {
            className: "bg-secondary-50 border-b border-secondary-100",
            children: [
              (0, i.jsx)("div", { className: "w-[72px]" }),
              (0, i.jsx)(t.G2, { className: "bg-secondary-200", showWalletAvatar: !0, walletName: h, walletAvatar: u, handleDropdownClick: () => void 0 }),
              (0, i.jsx)("div", {
                className: "min-w-[72px]",
                children:
                  void 0 !== n &&
                  void 0 !== d &&
                  d > 1 &&
                  (0, i.jsxs)("div", {
                    className: "flex items-center rounded-full bg-secondary-200 p-2 justify-between",
                    children: [
                      (0, i.jsx)(l.W, {
                        size: 14,
                        className: (0, c.cn)("", { "text-muted-foreground": 0 === n, "text-foreground cursor-pointer": 0 !== n }),
                        onClick: () => {
                          a && void 0 !== n && n > 0 && a(n - 1);
                        }
                      }),
                      (0, i.jsxs)("p", { className: "text-sm font-bold text-foreground", children: [n + 1, "/", d] }),
                      (0, i.jsx)(o.T, {
                        size: 14,
                        className: (0, c.cn)("", { "text-muted-foreground": n === d - 1, "text-foreground cursor-pointer": n !== d - 1 }),
                        onClick: () => {
                          a && void 0 !== n && d && n < d - 1 && a(n + 1);
                        }
                      })
                    ]
                  })
              })
            ]
          });
        },
        v = e =>
          (0, i.jsxs)("div", {
            className: "flex items-center gap-5",
            children: [
              (0, i.jsx)("img", { src: e.logo, onError: (0, u._)(d.Globe), className: "size-[54px] rounded-full" }),
              (0, i.jsxs)("div", {
                className: "flex flex-col gap-[3px]",
                children: [
                  (0, i.jsx)("span", { className: "text-lg font-bold", children: e.title }),
                  (0, i.jsx)("span", { className: "text-xs text-muted-foreground", children: e.subTitle })
                ]
              })
            ]
          }),
        f = e =>
          (0, i.jsxs)(i.Fragment, {
            children: [
              (0, i.jsx)(h, { activeIndex: e.activeIndex, setActiveIndex: e.setActiveIndex, limit: e.limit }),
              (0, i.jsxs)("div", {
                className: (0, c.cn)(
                  "flex flex-col gap-6 mx-auto h-[calc(100%-165px)] w-full max-w-2xl box-border overflow-y-scroll pt-6 px-6 bg-secondary-50",
                  e.className
                ),
                children: [(0, i.jsx)(v, { ...e }), e.children]
              })
            ]
          });
    },
    91503: function (e, n, a) {
      a.d(n, { GL: () => u, X6: () => c, zb: () => b, No: () => r, $_: () => o });
      var i = a(52322),
        l = a(2784);
      function o(e) {
        let { children: n } = e;
        return (0, i.jsx)("div", { className: "w-full flex flex-col justify-center items-center box-border mt-4", children: n });
      }
      var t = a(75377),
        s = a(46103);
      function r(e) {
        let { rejectBtnClick: n, rejectBtnText: a, confirmBtnClick: l, confirmBtnText: o } = e;
        return (0, i.jsxs)("div", {
          className: "flex flex-row justify-between w-full",
          children: [
            (0, i.jsx)(t.Buttons.Generic, {
              style: { height: "48px", background: s.w.gray900, color: s.w.white100 },
              onClick: n,
              "aria-label": "reject button in suggest chain flow",
              children: (0, i.jsx)("span", { "aria-label": "reject button text in suggest chain flow", children: a })
            }),
            (0, i.jsx)(t.Buttons.Generic, {
              style: { height: "48px", background: s.w.cosmosPrimary, color: s.w.white100 },
              className: "ml-3 bg-gray-800",
              onClick: l,
              "aria-label": "confirm button in suggest chain flow",
              children: (0, i.jsx)("span", { "aria-label": "confirm button text in suggest chain flow", children: o })
            })
          ]
        });
      }
      var d = a(69816);
      function c(e) {
        let { text: n } = e;
        return (0, i.jsx)(d.Z, { size: "lg", className: "font-bold mt-5", children: n });
      }
      function u(e) {
        let { text: n } = e;
        return (0, i.jsx)(d.Z, {
          size: "xs",
          className: "font-bold text-center mt-[2px] max-w-[250px]",
          color: "text-gray-800 dark:text-gray-600 mb-2",
          children: n
        });
      }
      var h = a(53108),
        v = a(75958),
        f = a(10289),
        g = a(48534),
        x = a(72565),
        m = a.n(x);
      let b = (0, v.Pi)(e => {
        let { children: n, suggestKey: a, chainTagsStore: o } = e,
          t = (0, f.s0)(),
          s = (0, l.useCallback)(
            async e => {
              await m().storage.local.set({ [h.u1]: { error: e } }),
                setTimeout(async () => {
                  await m().storage.local.remove([a]), await m().storage.local.remove(h.u1), (0, g.oj)() ? t("/home") : window.close();
                }, 10);
            },
            [t, a]
          ),
          r = (0, l.useCallback)(async () => {
            await s("Rejected by the user.");
          }, [s]);
        return (
          (0, l.useEffect)(
            () => (
              window.addEventListener("beforeunload", r),
              m().storage.local.remove(h.u1),
              () => {
                window.removeEventListener("beforeunload", r);
              }
            ),
            [r]
          ),
          (0, i.jsx)("div", { children: n({ handleRejectBtnClick: r, handleError: s, chainTagsStore: o }) })
        );
      });
    },
    90065: function (e, n, a) {
      a.a(e, async function (e, i) {
        try {
          a.r(n), a.d(n, { default: () => _ });
          var l = a(52322),
            o = a(41172),
            t = a(15969),
            s = a(92642),
            r = a(79215),
            d = a(19623),
            c = a(91486),
            u = a(53108),
            h = a(76131),
            v = a(72059),
            f = a(10706),
            g = a(36400),
            x = a(57124),
            m = a(75958),
            b = a(2784),
            w = a(10289),
            p = a(36321),
            y = a(48534),
            I = a(72565),
            j = a.n(I),
            N = a(70734),
            C = a(91503),
            k = e([g, f, v, h]);
          [g, f, v, h] = k.then ? (await k)() : k;
          let T = (0, m.Pi)(e => {
            var n;
            let { handleError: a, handleRejectBtnClick: i, chainTagsStore: m } = e,
              p = (0, w.s0)(),
              I = (0, g.pb)(),
              C = (0, o.lfg)(),
              k = (0, g.oS)(),
              [_, T] = (0, b.useState)(!1),
              [S, E] = (0, b.useState)(null),
              P = (0, f.Af)(),
              { activeWallet: A, setActiveWallet: R } = (0, f.ZP)(),
              z = (0, b.useRef)(),
              B = (0, v.N8)(),
              D = (0, x.a)(),
              L = (0, b.useMemo)(() => {
                var e, n, a;
                return S
                  ? (null ===
                      (n = C.filter(e => {
                        var n;
                        return e.chainId === (null === (n = S.chainInfo) || void 0 === n ? void 0 : n.chainId);
                      })) || void 0 === n
                      ? void 0
                      : null === (e = n[0]) || void 0 === e
                        ? void 0
                        : e.chainRegistryPath) || (null === (a = S.chainInfo) || void 0 === a ? void 0 : a.chainRegistryPath)
                  : null;
              }, [C, S]);
            (0, b.useEffect)(() => {
              j()
                .storage.local.get([u.A_])
                .then(e => {
                  let n = e[u.A_];
                  k({ ...I, [L]: null == n ? void 0 : n.chainInfo }), E(n), (z.current = null == n ? void 0 : n.origin);
                });
            }, []);
            let G = (0, b.useCallback)(async () => {
                var e, n, a, i;
                (null == S ? void 0 : null === (e = S.chainInfo) || void 0 === e ? void 0 : e.chainId) &&
                  (await m.setBetaChainTags(S.chainInfo.chainId, ["Cosmos"])),
                  (null == S ? void 0 : null === (n = S.chainInfo) || void 0 === n ? void 0 : n.testnetChainId) &&
                    (await m.setBetaChainTags(S.chainInfo.testnetChainId, ["Cosmos"])),
                  (null == S ? void 0 : null === (a = S.chainInfo) || void 0 === a ? void 0 : a.evmChainId) &&
                    (await m.setBetaChainTags(S.chainInfo.evmChainId, ["Cosmos"])),
                  (null == S ? void 0 : null === (i = S.chainInfo) || void 0 === i ? void 0 : i.evmChainIdTestnet) &&
                    (await m.setBetaChainTags(S.chainInfo.evmChainIdTestnet, ["Cosmos"]));
              }, [S, m]),
              U = async () => {
                await (0, t._vH)(200), T(!0);
                try {
                  let e = await P(A, L, "UPDATE", S.chainInfo),
                    n = await j().storage.local.get([u.Pw]),
                    a = { ...JSON.parse(n[u.Pw] ?? "{}"), [L]: S.chainInfo };
                  await j().storage.local.set({ [u.Pw]: JSON.stringify(a) }),
                    await G(),
                    A && (await (0, N.E)([S.chainInfo.chainId], [A.id], z.current ?? ""), await R(e[A.id])),
                    await B(L),
                    window.removeEventListener("beforeunload", i),
                    await j().storage.local.set({ [u.u1]: { data: "Approved", success: "Chain enabled" } }),
                    setTimeout(async () => {
                      await j().storage.local.remove(u.u1),
                        T(!1),
                        (0, y.oj)()
                          ? p("/home")
                          : setTimeout(async () => {
                              window.close();
                            }, 10);
                    }, 100);
                } catch (i) {
                  var e, n, l, o, r, d;
                  a("Something went wrong. Please try again."),
                    T(!1),
                    (0, s.Tb)(i, {
                      tags: {
                        errorType: "suggest_chain_error",
                        source: "suggest_chain",
                        severity: "error",
                        errorName: i instanceof Error ? i.name : "SuggestChainError"
                      },
                      fingerprint: ["suggest_chain", "suggest_chain_error"],
                      level: "error",
                      contexts: { transaction: { type: "suggest_chain", errorMessage: i instanceof Error ? i.message : String(i) } },
                      extra: {
                        chain: null == S ? void 0 : null === (e = S.chainInfo) || void 0 === e ? void 0 : e.chainId,
                        chainName: null == S ? void 0 : null === (n = S.chainInfo) || void 0 === n ? void 0 : n.chainName,
                        chainRegistryPath: null == S ? void 0 : null === (l = S.chainInfo) || void 0 === l ? void 0 : l.chainRegistryPath,
                        chainId: null == S ? void 0 : null === (o = S.chainInfo) || void 0 === o ? void 0 : o.chainId,
                        chainSymbolImageUrl: null == S ? void 0 : null === (r = S.chainInfo) || void 0 === r ? void 0 : r.chainSymbolImageUrl,
                        chainSymbol: null == S ? void 0 : null === (d = S.chainInfo) || void 0 === d ? void 0 : d.denom
                      }
                    });
                }
              },
              M = (0, b.useMemo)(() => {
                var e, n, a, i, l, o, t, s, r, d, c;
                let u = [];
                return (
                  u.push({ key: "Network Name", value: (null == S ? void 0 : null === (e = S.chainInfo) || void 0 === e ? void 0 : e.chainName) ?? "" }),
                  u.push({
                    key: "Network URL",
                    value:
                      (null == S ? void 0 : null === (a = S.chainInfo) || void 0 === a ? void 0 : null === (n = a.apis) || void 0 === n ? void 0 : n.rest) ||
                      (null == S
                        ? void 0
                        : null === (l = S.chainInfo) || void 0 === l
                          ? void 0
                          : null === (i = l.apis) || void 0 === i
                            ? void 0
                            : i.restTest) ||
                      ""
                  }),
                  u.push({ key: "Chain ID", value: (null == S ? void 0 : null === (o = S.chainInfo) || void 0 === o ? void 0 : o.chainId) ?? "" }),
                  u.push({ key: "Currency Symbol", value: (null == S ? void 0 : null === (t = S.chainInfo) || void 0 === t ? void 0 : t.denom) ?? "" }),
                  u.push({
                    key: "Coin Type",
                    value:
                      (null == S
                        ? void 0
                        : null === (r = S.chainInfo) || void 0 === r
                          ? void 0
                          : null === (s = r.bip44) || void 0 === s
                            ? void 0
                            : s.coinType) ?? ""
                  }),
                  u.push({ key: "Address Prefix", value: (null == S ? void 0 : null === (d = S.chainInfo) || void 0 === d ? void 0 : d.addressPrefix) ?? "" }),
                  u.push({
                    key: "Chain Registry Path",
                    value: (null == S ? void 0 : null === (c = S.chainInfo) || void 0 === c ? void 0 : c.chainRegistryPath) ?? ""
                  }),
                  u
                );
              }, [S]);
            return (
              (0, h.$)({
                page: "suggest-chain",
                queryStatus: S ? "loading" : "success",
                op: "suggestedChainLoad",
                description: "loading state on suggested chain approval"
              }),
              (0, l.jsxs)("div", {
                className: "h-full",
                children: [
                  (0, l.jsx)(r.og, {
                    subTitle: null == S ? void 0 : S.origin,
                    logo: (null == S ? void 0 : null === (n = S.chainInfo) || void 0 === n ? void 0 : n.chainSymbolImageUrl) ?? D,
                    title: "Adding chain",
                    children: (0, l.jsx)("div", {
                      className: "px-5 py-1 bg-secondary-100 rounded-xl",
                      children: M.map((e, n) =>
                        (0, l.jsxs)(
                          "div",
                          {
                            className: "flex flex-col gap-4 my-4",
                            children: [
                              (0, l.jsxs)("div", {
                                className: "flex flex-col gap-1.5",
                                children: [
                                  (0, l.jsx)("p", { className: "text-sm text-muted-foreground font-medium", children: e.key }),
                                  (0, l.jsx)("p", { className: "text-foreground font-bold", children: e.value })
                                ]
                              }),
                              n !== M.length - 1 && (0, l.jsx)("div", { className: "h-px bg-secondary-300 w-full" })
                            ]
                          },
                          e.key
                        )
                      )
                    })
                  }),
                  (0, l.jsxs)("div", {
                    className: "flex items-center justify-center w-full gap-3 mt-auto [&>*]:flex-1 sticky bottom-0 p-6 bg-secondary-50",
                    children: [
                      (0, l.jsx)(c.zx, {
                        variant: "mono",
                        onClick: i,
                        disabled: _,
                        "aria-label": "reject button in suggest chain flow",
                        children: (0, l.jsx)("span", { "aria-label": "reject button text in suggest chain flow", children: "Reject" })
                      }),
                      (0, l.jsx)(c.zx, {
                        onClick: U,
                        "aria-label": "approve button in suggest chain flow",
                        children: _
                          ? (0, l.jsx)(d.T, { color: "white" })
                          : (0, l.jsx)("span", { "aria-label": "approve button text in suggest chain flow", children: "Approve" })
                      })
                    ]
                  })
                ]
              })
            );
          });
          function _() {
            return (0, l.jsx)(C.zb, {
              suggestKey: u.A_,
              chainTagsStore: p.HN,
              children: e => {
                let { handleError: n, handleRejectBtnClick: a, chainTagsStore: i } = e;
                return (0, l.jsx)(T, { handleError: n, handleRejectBtnClick: a, chainTagsStore: i });
              }
            });
          }
          i();
        } catch (e) {
          i(e);
        }
      });
    }
  }
]);
//# sourceMappingURL=3964.js.map
