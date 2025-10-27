!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      n = new e.Error().stack;
    n &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[n] = "9eff380d-cb0a-4721-900d-fa6b7b6362e2"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-9eff380d-cb0a-4721-900d-fa6b7b6362e2"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.22.9" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["3964"],
  {
    79215: function (e, n, a) {
      a.d(n, { og: () => v });
      var l = a(52322),
        i = a(26793),
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
          return (0, l.jsxs)(s.m, {
            className: "bg-secondary-50 border-b border-secondary-100",
            children: [
              (0, l.jsx)("div", { className: "w-[72px]" }),
              (0, l.jsx)(t.G2, { className: "bg-secondary-200", showWalletAvatar: !0, walletName: h, walletAvatar: u, handleDropdownClick: () => void 0 }),
              (0, l.jsx)("div", {
                className: "min-w-[72px]",
                children:
                  void 0 !== n &&
                  void 0 !== d &&
                  d > 1 &&
                  (0, l.jsxs)("div", {
                    className: "flex items-center rounded-full bg-secondary-200 p-2 justify-between",
                    children: [
                      (0, l.jsx)(i.W, {
                        size: 14,
                        className: (0, c.cn)("", { "text-muted-foreground": 0 === n, "text-foreground cursor-pointer": 0 !== n }),
                        onClick: () => {
                          a && void 0 !== n && n > 0 && a(n - 1);
                        }
                      }),
                      (0, l.jsxs)("p", { className: "text-sm font-bold text-foreground", children: [n + 1, "/", d] }),
                      (0, l.jsx)(o.T, {
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
        f = e =>
          (0, l.jsxs)("div", {
            className: "flex items-center gap-5",
            children: [
              (0, l.jsx)("img", { src: e.logo, onError: (0, u._)(d.Globe), className: "size-[54px] rounded-full" }),
              (0, l.jsxs)("div", {
                className: "flex flex-col gap-[3px]",
                children: [
                  (0, l.jsx)("span", { className: "text-lg font-bold", children: e.title }),
                  (0, l.jsx)("span", { className: "text-xs text-muted-foreground", children: e.subTitle })
                ]
              })
            ]
          }),
        v = e =>
          (0, l.jsxs)(l.Fragment, {
            children: [
              (0, l.jsx)(h, { activeIndex: e.activeIndex, setActiveIndex: e.setActiveIndex, limit: e.limit }),
              (0, l.jsxs)("div", {
                className: (0, c.cn)(
                  "flex flex-col gap-6 mx-auto h-[calc(100%-165px)] w-full max-w-2xl box-border overflow-y-scroll pt-6 px-6 bg-secondary-50",
                  e.className
                ),
                children: [(0, l.jsx)(f, { ...e }), e.children]
              })
            ]
          });
    },
    91503: function (e, n, a) {
      a.d(n, { GL: () => u, X6: () => c, zb: () => b, No: () => r, $_: () => o });
      var l = a(52322),
        i = a(2784);
      function o(e) {
        let { children: n } = e;
        return (0, l.jsx)("div", { className: "w-full flex flex-col justify-center items-center box-border mt-4", children: n });
      }
      var t = a(75377),
        s = a(46103);
      function r(e) {
        let { rejectBtnClick: n, rejectBtnText: a, confirmBtnClick: i, confirmBtnText: o } = e;
        return (0, l.jsxs)("div", {
          className: "flex flex-row justify-between w-full",
          children: [
            (0, l.jsx)(t.Buttons.Generic, {
              style: { height: "48px", background: s.w.gray900, color: s.w.white100 },
              onClick: n,
              "aria-label": "reject button in suggest chain flow",
              children: (0, l.jsx)("span", { "aria-label": "reject button text in suggest chain flow", children: a })
            }),
            (0, l.jsx)(t.Buttons.Generic, {
              style: { height: "48px", background: s.w.cosmosPrimary, color: s.w.white100 },
              className: "ml-3 bg-gray-800",
              onClick: i,
              "aria-label": "confirm button in suggest chain flow",
              children: (0, l.jsx)("span", { "aria-label": "confirm button text in suggest chain flow", children: o })
            })
          ]
        });
      }
      var d = a(69816);
      function c(e) {
        let { text: n } = e;
        return (0, l.jsx)(d.Z, { size: "lg", className: "font-bold mt-5", children: n });
      }
      function u(e) {
        let { text: n } = e;
        return (0, l.jsx)(d.Z, {
          size: "xs",
          className: "font-bold text-center mt-[2px] max-w-[250px]",
          color: "text-gray-800 dark:text-gray-600 mb-2",
          children: n
        });
      }
      var h = a(53108),
        f = a(75958),
        v = a(10289),
        x = a(48534),
        g = a(72565),
        m = a.n(g);
      let b = (0, f.Pi)(e => {
        let { children: n, suggestKey: a, chainTagsStore: o } = e,
          t = (0, v.s0)(),
          s = (0, i.useCallback)(
            async e => {
              await m().storage.local.set({ [h.u1]: { error: e } }),
                setTimeout(async () => {
                  await m().storage.local.remove([a]), await m().storage.local.remove(h.u1), (0, x.oj)() ? t("/home") : window.close();
                }, 10);
            },
            [t, a]
          ),
          r = (0, i.useCallback)(async () => {
            await s("Rejected by the user.");
          }, [s]);
        return (
          (0, i.useEffect)(
            () => (
              window.addEventListener("beforeunload", r),
              m().storage.local.remove(h.u1),
              () => {
                window.removeEventListener("beforeunload", r);
              }
            ),
            [r]
          ),
          (0, l.jsx)("div", { children: n({ handleRejectBtnClick: r, handleError: s, chainTagsStore: o }) })
        );
      });
    },
    90065: function (e, n, a) {
      a.a(e, async function (e, l) {
        try {
          a.r(n), a.d(n, { default: () => k });
          var i = a(52322),
            o = a(41172),
            t = a(15969),
            s = a(79215),
            r = a(19623),
            d = a(91486),
            c = a(53108),
            u = a(76131),
            h = a(72059),
            f = a(10706),
            v = a(36400),
            x = a(57124),
            g = a(75958),
            m = a(2784),
            b = a(10289),
            w = a(36321),
            p = a(48534),
            y = a(72565),
            j = a.n(y),
            I = a(70734),
            N = a(91503),
            C = e([v, f, h, u]);
          [v, f, h, u] = C.then ? (await C)() : C;
          let T = (0, g.Pi)(e => {
            var n;
            let { handleError: a, handleRejectBtnClick: l, chainTagsStore: g } = e,
              w = (0, b.s0)(),
              y = (0, v.pb)(),
              N = (0, o.lfg)(),
              C = (0, v.oS)(),
              [k, T] = (0, m.useState)(!1),
              [_, P] = (0, m.useState)(null),
              A = (0, f.Af)(),
              { activeWallet: E, setActiveWallet: S } = (0, f.ZP)(),
              R = (0, m.useRef)(),
              z = (0, h.N8)(),
              B = (0, x.a)(),
              D = (0, m.useMemo)(() => {
                var e, n, a;
                return _
                  ? (null ===
                      (n = N.filter(e => {
                        var n;
                        return e.chainId === (null === (n = _.chainInfo) || void 0 === n ? void 0 : n.chainId);
                      })) || void 0 === n
                      ? void 0
                      : null === (e = n[0]) || void 0 === e
                        ? void 0
                        : e.chainRegistryPath) || (null === (a = _.chainInfo) || void 0 === a ? void 0 : a.chainRegistryPath)
                  : null;
              }, [N, _]);
            (0, m.useEffect)(() => {
              j()
                .storage.local.get([c.A_])
                .then(e => {
                  let n = e[c.A_];
                  C({ ...y, [D]: n.chainInfo }), P(n), (R.current = n.origin);
                });
            }, []);
            let L = (0, m.useCallback)(async () => {
                var e, n, a, l;
                (null == _ ? void 0 : null === (e = _.chainInfo) || void 0 === e ? void 0 : e.chainId) &&
                  (await g.setBetaChainTags(_.chainInfo.chainId, ["Cosmos"])),
                  (null == _ ? void 0 : null === (n = _.chainInfo) || void 0 === n ? void 0 : n.testnetChainId) &&
                    (await g.setBetaChainTags(_.chainInfo.testnetChainId, ["Cosmos"])),
                  (null == _ ? void 0 : null === (a = _.chainInfo) || void 0 === a ? void 0 : a.evmChainId) &&
                    (await g.setBetaChainTags(_.chainInfo.evmChainId, ["Cosmos"])),
                  (null == _ ? void 0 : null === (l = _.chainInfo) || void 0 === l ? void 0 : l.evmChainIdTestnet) &&
                    (await g.setBetaChainTags(_.chainInfo.evmChainIdTestnet, ["Cosmos"]));
              }, [_, g]),
              G = async () => {
                await (0, t._vH)(200), T(!0);
                try {
                  let e = await A(E, D, "UPDATE", _.chainInfo),
                    n = await j().storage.local.get([c.Pw]),
                    a = { ...JSON.parse(n[c.Pw] ?? "{}"), [D]: _.chainInfo };
                  await j().storage.local.set({ [c.Pw]: JSON.stringify(a) }),
                    await L(),
                    E && (await (0, I.E)([_.chainInfo.chainId], [E.id], R.current ?? ""), await S(e[E.id])),
                    await z(D),
                    window.removeEventListener("beforeunload", l),
                    await j().storage.local.set({ [c.u1]: { data: "Approved", success: "Chain enabled" } }),
                    setTimeout(async () => {
                      await j().storage.local.remove(c.u1),
                        T(!1),
                        (0, p.oj)()
                          ? w("/home")
                          : setTimeout(async () => {
                              window.close();
                            }, 10);
                    }, 100);
                } catch (e) {
                  a("Something went wrong. Please try again."), T(!1);
                }
              },
              U = (0, m.useMemo)(() => {
                var e, n, a, l, i, o, t, s, r, d, c;
                let u = [];
                return (
                  u.push({ key: "Network Name", value: (null == _ ? void 0 : null === (e = _.chainInfo) || void 0 === e ? void 0 : e.chainName) ?? "" }),
                  u.push({
                    key: "Network URL",
                    value:
                      (null == _ ? void 0 : null === (a = _.chainInfo) || void 0 === a ? void 0 : null === (n = a.apis) || void 0 === n ? void 0 : n.rest) ||
                      (null == _
                        ? void 0
                        : null === (i = _.chainInfo) || void 0 === i
                          ? void 0
                          : null === (l = i.apis) || void 0 === l
                            ? void 0
                            : l.restTest) ||
                      ""
                  }),
                  u.push({ key: "Chain ID", value: (null == _ ? void 0 : null === (o = _.chainInfo) || void 0 === o ? void 0 : o.chainId) ?? "" }),
                  u.push({ key: "Currency Symbol", value: (null == _ ? void 0 : null === (t = _.chainInfo) || void 0 === t ? void 0 : t.denom) ?? "" }),
                  u.push({
                    key: "Coin Type",
                    value:
                      (null == _
                        ? void 0
                        : null === (r = _.chainInfo) || void 0 === r
                          ? void 0
                          : null === (s = r.bip44) || void 0 === s
                            ? void 0
                            : s.coinType) ?? ""
                  }),
                  u.push({ key: "Address Prefix", value: (null == _ ? void 0 : null === (d = _.chainInfo) || void 0 === d ? void 0 : d.addressPrefix) ?? "" }),
                  u.push({
                    key: "Chain Registry Path",
                    value: (null == _ ? void 0 : null === (c = _.chainInfo) || void 0 === c ? void 0 : c.chainRegistryPath) ?? ""
                  }),
                  u
                );
              }, [_]);
            return (
              (0, u.$)({
                page: "suggest-chain",
                queryStatus: _ ? "loading" : "success",
                op: "suggestedChainLoad",
                description: "loading state on suggested chain approval"
              }),
              (0, i.jsxs)("div", {
                className: "h-full",
                children: [
                  (0, i.jsx)(s.og, {
                    subTitle: null == _ ? void 0 : _.origin,
                    logo: (null == _ ? void 0 : null === (n = _.chainInfo) || void 0 === n ? void 0 : n.chainSymbolImageUrl) ?? B,
                    title: "Adding chain",
                    children: (0, i.jsx)("div", {
                      className: "px-5 py-1 bg-secondary-100 rounded-xl",
                      children: U.map((e, n) =>
                        (0, i.jsxs)(
                          "div",
                          {
                            className: "flex flex-col gap-4 my-4",
                            children: [
                              (0, i.jsxs)("div", {
                                className: "flex flex-col gap-1.5",
                                children: [
                                  (0, i.jsx)("p", { className: "text-sm text-muted-foreground font-medium", children: e.key }),
                                  (0, i.jsx)("p", { className: "text-foreground font-bold", children: e.value })
                                ]
                              }),
                              n !== U.length - 1 && (0, i.jsx)("div", { className: "h-px bg-secondary-300 w-full" })
                            ]
                          },
                          e.key
                        )
                      )
                    })
                  }),
                  (0, i.jsxs)("div", {
                    className: "flex items-center justify-center w-full gap-3 mt-auto [&>*]:flex-1 sticky bottom-0 p-6 bg-secondary-50",
                    children: [
                      (0, i.jsx)(d.zx, {
                        variant: "mono",
                        onClick: l,
                        disabled: k,
                        "aria-label": "reject button in suggest chain flow",
                        children: (0, i.jsx)("span", { "aria-label": "reject button text in suggest chain flow", children: "Reject" })
                      }),
                      (0, i.jsx)(d.zx, {
                        onClick: G,
                        "aria-label": "approve button in suggest chain flow",
                        children: k
                          ? (0, i.jsx)(r.T, { color: "white" })
                          : (0, i.jsx)("span", { "aria-label": "approve button text in suggest chain flow", children: "Approve" })
                      })
                    ]
                  })
                ]
              })
            );
          });
          function k() {
            return (0, i.jsx)(N.zb, {
              suggestKey: c.A_,
              chainTagsStore: w.HN,
              children: e => {
                let { handleError: n, handleRejectBtnClick: a, chainTagsStore: l } = e;
                return (0, i.jsx)(T, { handleError: n, handleRejectBtnClick: a, chainTagsStore: l });
              }
            });
          }
          l();
        } catch (e) {
          l(e);
        }
      });
    }
  }
]);
//# sourceMappingURL=3964.js.map
