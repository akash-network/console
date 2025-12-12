!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "beb1ce08-ec83-4d52-b755-5a2d50227b75"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-beb1ce08-ec83-4d52-b755-5a2d50227b75"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.23.1" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["684"],
  {
    84562: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { W: () => w });
          var l,
            i = a(52322),
            s = a(41172),
            r = a(75377),
            o = a(14863),
            c = a(45863),
            d = a(2543),
            u = a(29828),
            m = a(72779),
            v = a.n(m),
            h = a(23259),
            x = a(72059),
            g = a(30464),
            f = a(75958),
            p = a(4079),
            y = a(2784),
            b = a(10289),
            j = e([x]);
          x = (j.then ? (await j)() : j)[0];
          var w =
            (((l = {}).Home = "Home"),
            (l.NFTs = "NFTs"),
            (l.Stake = "Stake"),
            (l.Activity = "Activity"),
            (l.Governance = "Governance"),
            (l.Earn = "Earn"),
            (l.Airdrops = "Airdrops"),
            (l.Rewards = "Rewards"),
            (l.Swap = "Swap"),
            (l.Search = "Search"),
            l);
          (0, f.Pi)(e => {
            var t, a;
            let { label: n, disabled: l } = e,
              [m, f] = (0, y.useState)(n),
              j = (0, b.s0)(),
              w = (0, x.a7)(),
              { chains: C } = (0, s._IL)(),
              N = C[w],
              { data: S } = (0, s.S2A)(),
              { theme: A } = (0, r.useTheme)(),
              E = A === r.ThemeName.DARK,
              k = (0, y.useCallback)(() => {
                let e = `${h.x3}/airdrops`;
                window.open(e, "_blank");
              }, []),
              L = (0, y.useCallback)(() => {
                window.open("https://app.testnet.initia.xyz/stake", "_blank");
              }, []),
              T = (0, y.useMemo)(() => {
                var e, t, a;
                let n =
                  (null == S ? void 0 : null === (e = S.swaps) || void 0 === e ? void 0 : e.extension) === "disabled" || ["nomic", "seiDevnet"].includes(w);
                return [
                  { label: "Home", icon: (0, i.jsx)(o.w, { size: 22, weight: "fill" }), path: "/home", show: !0 },
                  {
                    label: "Stake",
                    icon: (0, i.jsx)(c.X, { size: 22, weight: "fill" }),
                    path: "/stake?pageSource=bottomNav",
                    show: !0,
                    disabled: (null == N ? void 0 : N.disableStaking) || (null == N ? void 0 : N.evmOnlyChain),
                    redirectHandler: L
                  },
                  { label: "Swap", icon: (0, i.jsx)(d.m, { size: 22, weight: "bold" }), path: "/swap?pageSource=bottomNav", show: !0, disabled: n },
                  {
                    label: "Rewards",
                    icon: (0, i.jsx)(p.Z, {}),
                    path: "/alpha",
                    show: (null == S ? void 0 : null === (t = S.airdrops) || void 0 === t ? void 0 : t.extension) !== "disabled",
                    shouldRedirect: (null == S ? void 0 : null === (a = S.airdrops) || void 0 === a ? void 0 : a.extension) === "redirect",
                    redirectHandler: k
                  },
                  { label: "Activity", icon: (0, i.jsx)(u.G, { size: 22, weight: "fill" }), path: "/activity", show: !0 }
                ];
              }, [
                null == S ? void 0 : null === (t = S.swaps) || void 0 === t ? void 0 : t.extension,
                null == S ? void 0 : null === (a = S.airdrops) || void 0 === a ? void 0 : a.extension,
                w,
                null == N ? void 0 : N.disableStaking,
                null == N ? void 0 : N.evmOnlyChain,
                L,
                k
              ]);
            return (0, i.jsxs)("div", {
              className:
                "flex absolute justify-around bottom-0 h-[65px] w-full rounded-b-lg z-[0] bg-white-100 dark:bg-gray-950 shadow-[0_-8px_20px_0px_rgba(0,0,0,0.04)] dark:shadow-[0_-8px_20px_0px_rgba(0,0,0,0.26)]",
              children: [
                (0, i.jsx)(g.r.Nav.BottomNav, { fill: E ? "#141414" : "#FFF", stroke: E ? "#2C2C2C" : "#E8E8E8", className: "absolute bottom-0" }),
                T.filter(e => {
                  let { show: t } = e;
                  return t;
                }).map((e, t) => {
                  let { label: a, icon: n, path: s, shouldRedirect: r, redirectHandler: o, disabled: c } = e,
                    d = l || c;
                  return (0, i.jsxs)(
                    "div",
                    {
                      onClick: () => {
                        if (!d) {
                          if (!0 === r && o) {
                            o();
                            return;
                          }
                          f(a), j(s);
                        }
                      },
                      className: v()("flex flex-1 justify-center items-center cursor-pointer relative", { "!cursor-not-allowed": d }),
                      children: [
                        m === a ? (0, i.jsx)("div", { className: "w-full h-1 bg-green-600 rounded-b absolute top-0" }) : null,
                        (0, i.jsxs)("div", {
                          className: "flex flex-col items-center justify-center",
                          children: [
                            "Swap" === a
                              ? (0, i.jsx)("div", {
                                  style: { fontSize: 24 },
                                  className: v()("mt-[-20px] w-10 h-10 rounded-full flex items-center justify-center", {
                                    "bg-green-600 text-white-100": !d,
                                    "bg-gray-100 text-gray-400 dark:bg-gray-900 dark:text-gray-600": d
                                  }),
                                  children: n
                                })
                              : (0, i.jsx)("div", {
                                  style: { fontSize: 20 },
                                  className: v()({ "text-black-100 dark:text-white-100": m === a, "text-gray-400 dark:text-gray-600": m !== a }),
                                  children: n
                                }),
                            (0, i.jsx)("div", {
                              className: v()("text-xs font-bold mt-1", {
                                "text-black-100 dark:text-white-100": m === a && !d,
                                "text-gray-400 dark:text-gray-600": m !== a && !d,
                                "text-[#D3D3D3] dark:text-[#2C2C2C]": d
                              }),
                              children: a
                            })
                          ]
                        })
                      ]
                    },
                    `${a}_${t}`
                  );
                })
              ]
            });
          }),
            n();
        } catch (e) {
          n(e);
        }
      });
    },
    53462: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { h: () => h });
          var l = a(52322),
            i = a(74229),
            s = a(50449),
            r = a(30464),
            o = a(75958),
            c = a(89794),
            d = a(7345),
            u = a(2784),
            m = a(83275),
            v = e([m, c, d]);
          [m, c, d] = v.then ? (await v)() : v;
          let h = (0, o.Pi)(e => {
            let { chainTagsStore: t, title: a, bottomNavLabel: n } = e,
              [o, v] = (0, u.useState)(!1),
              { headerChainImgSrc: h } = (0, i.Cd)();
            return (
              (0, s._)(m.t),
              (0, l.jsxs)(l.Fragment, {
                children: [
                  (0, l.jsx)(c.l, {}),
                  (0, l.jsx)("div", {
                    className: "h-[calc(100%-128px)] p-6",
                    children: (0, l.jsxs)("div", {
                      className: "rounded-2xl bg-secondary-100 px-2 h-full flex flex-col items-center justify-center text-center",
                      children: [
                        (0, l.jsx)("img", { className: "w-[180px]", src: r.r.Logos.LeapLogo, alt: "frog-coming-soon" }),
                        (0, l.jsx)("h3", { className: "text-foreground font-bold text-[24px] mb-3", children: "Coming Soon!" }),
                        (0, l.jsxs)("p", {
                          className: "text-secondary-800 text-sm",
                          children: ["We're working on it. Or perhaps the chain is...", (0, l.jsx)("br", {}), "Either way, this page is coming soon!"]
                        })
                      ]
                    })
                  }),
                  (0, l.jsx)(d.Z, { isVisible: o, onClose: () => v(!1), chainTagsStore: t })
                ]
              })
            );
          });
          n();
        } catch (e) {
          n(e);
        }
      });
    },
    3465: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { h: () => l.h });
          var l = a(53462),
            i = e([l]);
          (l = (i.then ? (await i)() : i)[0]), n();
        } catch (e) {
          n(e);
        }
      });
    },
    25736: function (e, t, a) {
      a.d(t, { C: () => o });
      var n = a(41172),
        l = a(75377),
        i = a(2784),
        s = a(30464);
      let r = e => ("juno" === e ? s.r.Logos.JunoSwap : s.r.Logos.ChainLogos[e]);
      function o(e, t) {
        let a = (0, n.DI5)(),
          o = (0, l.useTheme)().theme,
          c = (0, n.a74)(),
          d = t || c,
          u = o === l.ThemeName.DARK ? s.r.Logos.GenericDark : s.r.Logos.GenericLight;
        return (0, i.useMemo)(() => {
          var t, n, l;
          return {
            send: (null === (t = a[d]) || void 0 === t ? void 0 : t.chainSymbolImageUrl) ?? u,
            receive: (null === (n = a[d]) || void 0 === n ? void 0 : n.chainSymbolImageUrl) ?? u,
            vote: s.r.Activity.Voting,
            fallback: u,
            delegate: u,
            undelegate: u,
            "ibc/transfer": u,
            pending: u,
            secretTokenTransfer: (null === (l = a[d]) || void 0 === l ? void 0 : l.chainSymbolImageUrl) ?? u,
            swap: r(d),
            "liquidity/add": s.r.Logos.ChainLogos[d] ?? u,
            "liquidity/remove": s.r.Logos.ChainLogos[d] ?? u,
            grant: s.r.Logos.ChainLogos[d] ?? u,
            revoke: s.r.Logos.ChainLogos[d] ?? u,
            cw20TokenTransfer: u
          }[e];
        }, [d, a, u, e]);
      }
    },
    21770: function (e, t, a) {
      a.d(t, { L: () => s });
      var n = a(41172),
        l = a(2784),
        i = a(86411);
      let s = (e, t) => {
        let a = (0, n.DI5)(),
          s = (0, n.rTu)();
        return (0, l.useMemo)(
          () =>
            e.aggregatedChainsData.reduce((e, l) => {
              var r;
              let o = a[l];
              if (
                !(null == s ? void 0 : s.addresses[l]) ||
                (null == o ? void 0 : o.chainId) === (null == o ? void 0 : o.testnetChainId) ||
                (null == o ? void 0 : o.apiStatus) === !1 ||
                ((null == s ? void 0 : s.walletType) === n._KQ.LEDGER &&
                  !(0, i.i)(l, null == o ? void 0 : null === (r = o.bip44) || void 0 === r ? void 0 : r.coinType, Object.values(a)))
              )
                return e;
              let c = t.chains.find(e => e.chainName === l);
              return c && c.active ? [...e, c] : e;
            }, []),
          [null == s ? void 0 : s.addresses, null == s ? void 0 : s.walletType, e.aggregatedChainsData, t.chains, a]
        );
      };
    },
    71897: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.r(t), a.d(t, { default: () => g });
          var l = a(52322),
            i = a(41172),
            s = a(84562),
            r = a(3465),
            o = a(23259);
          a(2784);
          var c = a(78344),
            d = a(85019),
            u = a(26245),
            m = a(36321),
            v = a(30809),
            h = a(80841),
            x = e([u, r, s, h, d]);
          function g() {
            let e = (0, i.a74)(),
              t = (0, i.Xmk)({ checkForExistenceType: "comingSoon", feature: "activity", platform: "Extension" });
            return e === o.HW
              ? (0, l.jsx)(h.sP, { chainTagsStore: m.HN, aggregatedChainsStore: u.Gl, selectedNetworkStore: v.i })
              : t
                ? (0, l.jsx)(r.h, { title: "Activity", bottomNavLabel: s.W.Activity, chainTagsStore: m.HN })
                : (0, l.jsx)(h.Ye, { chainTagsStore: m.HN, activityStore: d.s, activeChainStore: c.J, selectedNetworkStore: v.i });
          }
          ([u, r, s, h, d] = x.then ? (await x)() : x), n();
        } catch (e) {
          n(e);
        }
      });
    },
    77445: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { o: () => d });
          var l = a(52322),
            i = a(23222),
            s = a(2784),
            r = a(42799),
            o = a(32722),
            c = e([i]);
          function d(e) {
            let { onClose: t, ...a } = e,
              n = (0, s.useMemo)(() => {
                var e;
                return (0, o.JV)(
                  (null == a ? void 0 : a.routingInfo) ?? { messages: null == a ? void 0 : null === (e = a.route) || void 0 === e ? void 0 : e.messages }
                );
              }, [a]);
            return (
              (0, s.useEffect)(() => {
                n && (0, o.zy)(n);
              }, [n]),
              (0, l.jsx)(i.sS, { onClose: t, ...a, isTrackingPage: !0, rootDenomsStore: r.gb, rootCW20DenomsStore: r.UE })
            );
          }
          (i = (c.then ? (await c)() : c)[0]), n();
        } catch (e) {
          n(e);
        }
      });
    },
    6702: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { U: () => v });
          var l = a(52322),
            i = a(89187),
            s = a(25736),
            r = a(75958);
          a(2784);
          var o = a(84994),
            c = a(70514),
            d = a(71198),
            u = a(80841),
            m = e([u]);
          u = (m.then ? (await m)() : m)[0];
          let v = (0, r.Pi)(function (e) {
            let { content: t, onClick: a, showLoader: n, isSuccessful: r, containerClassNames: m, forceChain: v, titleClassName: h, imgSize: x } = e,
              {
                txType: g,
                title1: f,
                subtitle1: p,
                sentTokenInfo: y,
                sentAmount: b,
                receivedAmount: j,
                sentUsdValue: w,
                img: C,
                secondaryImg: N,
                receivedTokenInfo: S
              } = t,
              A = (0, s.C)(g, v),
              E = b && y ? (0, d.LH)(b, y.coinDenom) : void 0,
              k = j && S ? (0, d.LH)(j, S.coinDenom) : void 0,
              L = "delegate" === g || "send" === g || "liquidity/add" === g,
              T = "undelegate" === g || "receive" === g || "liquidity/remove" === g;
            return (0, l.jsx)("button", {
              className: (0, c.cn)("flex rounded-2xl justify-between items-center p-4 bg-secondary-100 hover:bg-secondary-200 transition-colors", m),
              onClick: a,
              children: (0, l.jsxs)("div", {
                className: "flex items-center flex-grow gap-3",
                children: [
                  (0, l.jsx)(u.AH, {
                    showLoader: n,
                    voteOption: "vote" === t.txType ? t.title1 : "",
                    secondaryImg: N,
                    type: g,
                    isSuccessful: r,
                    size: x,
                    img: C || A
                  }),
                  (0, l.jsxs)("div", {
                    className: "flex flex-col justify-center items-start",
                    children: [
                      (0, l.jsx)("span", { className: (0, c.cn)("text-base font-bold", h), children: f }),
                      (0, l.jsx)("span", { className: "text-xs font-medium text-muted-foreground", children: p })
                    ]
                  }),
                  (0, l.jsx)("div", { className: "flex flex-grow" }),
                  (0, l.jsx)("div", {
                    className: "flex flex-col justify-center items-end",
                    children:
                      "swap" === g
                        ? (0, l.jsxs)(l.Fragment, {
                            children: [
                              k &&
                                (0, l.jsxs)("p", {
                                  className: "text-xs text-right font-semibold text-green-600 dark:text-green-600",
                                  children: [L && "-", " ", o.J.formatHideBalance(k)]
                                }),
                              E &&
                                (0, l.jsxs)("p", {
                                  className: "text-xs font-medium text-muted-foreground text-end",
                                  children: [L && "-", " ", o.J.formatHideBalance(E)]
                                })
                            ]
                          })
                        : (0, l.jsxs)(l.Fragment, {
                            children: [
                              w &&
                                (0, l.jsxs)("p", {
                                  className: (0, c.cn)("text-sm text-end font-bold", {
                                    "text-black-100 dark:text-white-100": !T && !L,
                                    "text-destructive-200": L,
                                    "text-accent-success": T
                                  }),
                                  children: [L && "-", " $", o.J.formatHideBalance(Number(w).toFixed(2))]
                                }),
                              E &&
                                (0, l.jsxs)("p", {
                                  className: "text-xs font-medium text-muted-foreground",
                                  children: [L && "-", " ", o.J.formatHideBalance(E)]
                                })
                            ]
                          })
                  }),
                  a ? (0, l.jsx)(i.T, { size: 12, className: "text-muted-foreground" }) : null
                ]
              })
            });
          });
          n();
        } catch (e) {
          n(e);
        }
      });
    },
    10452: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { s: () => h });
          var l = a(52322),
            i = a(41172),
            s = a(76131),
            r = a(21770),
            o = a(75958),
            c = a(2784),
            d = a(85019),
            u = a(83275),
            m = a(80841),
            v = e([u, s, m, d]);
          [u, s, m, d] = v.then ? (await v)() : v;
          let h = (0, o.Pi)(e => {
            let { chainTagsStore: t, aggregatedChainsStore: a, selectedNetworkStore: n } = e,
              o = (0, i.DI5)();
            (0, i.rTu)();
            let v = (0, r.L)(a, u.t),
              [h, x] = (0, c.useState)(o.cosmos.key),
              g = (0, i.SFn)(h),
              f = n.selectedNetwork;
            d.s.getActivity(h, f, g);
            let p = d.s.getLoadingStatus(h, f, g),
              y = d.s.getErrorStatus(h, f, g),
              b = (0, c.useMemo)(() => v.map(e => o[e.chainName].chainRegistryPath), [o, v]),
              j = (0, c.useMemo)(() => {
                let e = "loading" === p ? "loading" : "success";
                return (e = y ? "error" : e);
              }, [y, p]);
            return (
              (0, s.$)({ page: `activity-${h}`, queryStatus: j, op: "activityPageLoad", description: "loading state on activity page" }),
              (0, l.jsx)(m.iD, { activityStore: d.s, filteredChains: b, forceNetwork: f, forceChain: h, setSelectedChain: x, chainTagsStore: t })
            );
          });
          (h.displayName = "AggregatedActivity"), n();
        } catch (e) {
          n(e);
        }
      });
    },
    60790: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { Y: () => m });
          var l = a(52322),
            i = a(41172),
            s = a(23259),
            r = a(76131),
            o = a(75958),
            c = a(2784),
            d = a(80841),
            u = e([r, d]);
          [r, d] = u.then ? (await u)() : u;
          let m = (0, o.Pi)(e => {
            let { chainTagsStore: t, activityStore: a, activeChainStore: n, selectedNetworkStore: o } = e,
              u = n.activeChain,
              m = o.selectedNetwork,
              v = (0, i.SFn)(u === s.HW ? "cosmos" : u),
              h = a.getLoadingStatus(u, m, v),
              x = a.getErrorStatus(u, m, v),
              g = (0, c.useMemo)(() => {
                let e = "loading" === h ? "loading" : "success";
                return (e = x ? "error" : e);
              }, [x, h]);
            return (
              (0, r.$)({ page: "activity", queryStatus: g, op: "activityPageLoad", description: "loading state on activity page" }),
              (0, l.jsx)(d.iD, { chainTagsStore: t, activityStore: a })
            );
          });
          (m.displayName = "ChainActivity"), n();
        } catch (e) {
          n(e);
        }
      });
    },
    4417: function (e, t, a) {
      a.d(t, { l: () => r });
      var n = a(52322),
        l = a(27963),
        i = a(30464);
      a(2784);
      var s = a(46103);
      function r(e) {
        let { accountExplorerLink: t } = e;
        return (0, n.jsxs)("div", {
          className: "flex flex-col h-[350px]",
          children: [
            (0, n.jsx)(l.S, { src: i.r.Activity.ActivityIcon, heading: "Unable to fetch activity" }),
            t
              ? (0, n.jsx)("a", {
                  href: t,
                  target: "_blank",
                  className: "font-semibold text-base mt-4 text-center",
                  style: { color: s.w.green600 },
                  rel: "noreferrer",
                  children: "Check on Explorer"
                })
              : null
          ]
        });
      }
    },
    30447: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { i: () => k });
          var l = a(52322),
            i = a(41172),
            s = a(99272),
            r = a(23259),
            o = a(53108),
            c = a(74229),
            d = a(30464),
            u = a(75958),
            m = a(17065),
            v = a(7345),
            h = a(19126),
            x = a.n(h),
            g = a(2784),
            f = a(10289),
            p = a(32796),
            y = a(46103),
            b = a(32722),
            j = a(72565),
            w = a.n(j),
            C = a(77445),
            N = a(36031),
            S = a(89794),
            A = a(80841),
            E = e([s, S, A, v, C]);
          [s, S, A, v, C] = E.then ? (await E)() : E;
          let k = (0, u.Pi)(e => {
            var t;
            let { activityStore: a, filteredChains: n, forceChain: u, forceNetwork: h, setSelectedChain: j, chainTagsStore: E } = e,
              k = (0, i.DI5)(),
              L = (0, i.a74)(),
              [T, H] = (0, g.useState)(!1),
              M = (0, i.obn)(),
              { headerChainImgSrc: Z } = (0, c.Cd)(),
              [O, D] = (0, g.useState)([]),
              [V, F] = (0, g.useState)(void 0),
              _ = (0, f.s0)(),
              I = (0, g.useMemo)(() => (L !== r.HW ? L : u ?? k.cosmos.key), [L, u, k.cosmos.key]),
              P = (0, i.SFn)(I),
              [z, R] = (0, g.useState)(!1),
              [U, $] = (0, g.useState)("Popular"),
              [J, G] = (0, g.useState)(null),
              q = (0, g.useMemo)(() => h || M, [M, h]),
              B = a.getActivity(I, q, P),
              Y = a.getLoadingStatus(I, q, P),
              W = a.getErrorStatus(I, q, P);
            (0, g.useEffect)(() => {
              (Y && "error" !== Y) || a.fetchActivity(I, q, P);
            }, [I, q, P]);
            let K = (0, g.useMemo)(() => {
              var e, t, a, n, l, s, r, o, c;
              if (
                null === (a = k[I]) || void 0 === a
                  ? void 0
                  : null === (t = a.txExplorer) || void 0 === t
                    ? void 0
                    : null === (e = t[q]) || void 0 === e
                      ? void 0
                      : e.accountUrl
              ) {
                let e =
                  null === (s = k[I]) || void 0 === s
                    ? void 0
                    : null === (l = s.txExplorer) || void 0 === l
                      ? void 0
                      : null === (n = l[q]) || void 0 === n
                        ? void 0
                        : n.accountUrl;
                return (null == e ? void 0 : e.includes("PLACEHOLDER_FOR_WALLET_ADDRESS"))
                  ? (0, i.Qj6)((e ?? "").replace("PLACEHOLDER_FOR_WALLET_ADDRESS", P)) ?? ""
                  : `${(0, i.Qj6)((null === (c = k[I]) || void 0 === c ? void 0 : null === (o = c.txExplorer) || void 0 === o ? void 0 : null === (r = o[q]) || void 0 === r ? void 0 : r.accountUrl) ?? "")}/${P}`;
              }
              return "";
            }, [q, P, k, I]);
            (0, g.useEffect)(() => {
              async function e() {
                let e = await w().storage.local.get([o.wv]);
                if (e[o.wv]) {
                  let t = Object.values(JSON.parse(e[o.wv]) ?? {});
                  D(t);
                } else D([]);
              }
              return (
                (0, b.lM)(),
                e(),
                w().storage.onChanged.addListener(t => {
                  t[o.wv] && e();
                }),
                w().storage.onChanged.removeListener(t => {
                  t[o.wv] && e();
                })
              );
            }, []);
            let X = (0, g.useMemo)(() => {
                let e = null == B ? void 0 : B.reduce(N.z, {});
                return Object.entries(e ?? {}).map(e => ({ title: e[0], data: e[1] }));
              }, [B]),
              Q = (0, g.useMemo)(() => (null == O ? void 0 : O.length) > 0, [O]),
              ee = (0, g.useMemo)(
                () =>
                  Q || (null == B ? void 0 : B.length) !== 0 || "loading" === Y
                    ? !Q && W
                      ? (0, l.jsx)("div", { className: "mt-4", children: (0, l.jsx)(A.lB, { accountExplorerLink: K, chain: I }) })
                      : (0, l.jsxs)(l.Fragment, {
                          children: [
                            Q
                              ? (0, l.jsxs)(l.Fragment, {
                                  children: [
                                    (0, l.jsx)("div", { className: "font-bold text-sm text-gray-600 dark:text-gray-200 mb-2 mt-4", children: "Recent swaps" }),
                                    (0, l.jsx)("div", {
                                      className: "flex flex-col gap-3",
                                      children: O.map(e => {
                                        var t, a, n, i, s, r;
                                        return (0, l.jsx)(
                                          m.Z,
                                          { setShowSwapTxPageFor: F, selectedPendingSwapTx: e },
                                          `${null === (n = e.routingInfo) || void 0 === n ? void 0 : null === (a = n.messages) || void 0 === a ? void 0 : null === (t = a[0]) || void 0 === t ? void 0 : t.customTxHash}-${null === (r = e.routingInfo) || void 0 === r ? void 0 : null === (s = r.messages) || void 0 === s ? void 0 : null === (i = s[0]) || void 0 === i ? void 0 : i.customMessageChainId}`
                                        );
                                      })
                                    })
                                  ]
                                })
                              : null,
                            "loading" === Y ? (0, l.jsx)(s.MC, { className: "mt-4" }) : null,
                            "loading" !== Y &&
                              X &&
                              X.map((e, t) => {
                                let { data: a, title: n } = e;
                                return (0, l.jsxs)(
                                  "div",
                                  {
                                    className: "mt-4",
                                    id: "activity-list",
                                    children: [
                                      (0, l.jsx)("div", { className: "font-bold text-sm text-gray-600 dark:text-gray-200 mb-2", children: n }),
                                      (0, l.jsx)("div", {
                                        className: "flex flex-col gap-3",
                                        children: a.map(e =>
                                          (0, l.jsx)(
                                            g.Fragment,
                                            {
                                              children: (0, l.jsx)(A.Um, {
                                                content: e.content,
                                                isSuccessful: 0 === e.parsedTx.code,
                                                forceChain: I,
                                                titleClassName: "!font-normal",
                                                imgSize: "sm",
                                                onClick: () => G(e)
                                              })
                                            },
                                            e.parsedTx.txHash
                                          )
                                        )
                                      })
                                    ]
                                  },
                                  `${n}_${t}`
                                );
                              }),
                            "loading" !== Y && K
                              ? (0, l.jsx)("a", {
                                  href: K,
                                  target: "_blank",
                                  className: "font-semibold text-base mt-4 text-center block",
                                  style: { color: y.w.green600 },
                                  rel: "noreferrer",
                                  children: "Check more on Explorer"
                                })
                              : null
                          ]
                        })
                    : (0, l.jsx)("div", { className: "mt-4", children: (0, l.jsx)(A.JK, { accountExplorerLink: K, chain: I }) }),
                [K, null == B ? void 0 : B.length, X, I, W, Y, Q, O]
              );
            (0, g.useEffect)(() => {
              z || $("Popular");
            }, [z]);
            let et = (0, g.useCallback)(
              e => {
                j && j(e), H(!1);
              },
              [j]
            );
            return (
              (0, g.useCallback)((e, t) => {
                R(!0), (null == t ? void 0 : t.defaultFilter) && $(t.defaultFilter);
              }, []),
              (0, g.useCallback)(() => p.r.toggleSideNav(), []),
              (0, l.jsx)(l.Fragment, {
                children: J
                  ? (0, l.jsx)(A.OO, { open: !!J, tx: J, onBack: () => G(null), forceChain: I })
                  : (0, l.jsxs)(l.Fragment, {
                      children: [
                        (0, l.jsx)(S.l, {}),
                        (0, l.jsxs)("div", {
                          className: "flex flex-col pt-8 px-6 pb-6 mb-16",
                          children: [
                            (0, l.jsxs)("h1", {
                              className: "flex items-center justify-between text-black-100 dark:text-white-100",
                              children: [
                                (0, l.jsxs)("div", {
                                  className: "flex flex-col items-start justify-start",
                                  children: [
                                    (0, l.jsx)("span", { className: "text-[24px] font-[700]", children: "Activity" }),
                                    (0, l.jsx)("span", {
                                      className: "text-[12px] font-[500] text-gray-600 dark:text-gray-400",
                                      children: (null === (t = k[I]) || void 0 === t ? void 0 : t.chainName) ?? "Unknown Chain"
                                    })
                                  ]
                                }),
                                (null == n ? void 0 : n.length)
                                  ? (0, l.jsx)("button", {
                                      className: " rounded-full flex items-center justify-center",
                                      onClick: () => H(!0),
                                      children: (0, l.jsx)("img", { src: d.r.Misc.TuneIcon, className: "w-4 h-4 invert dark:invert-0" })
                                    })
                                  : null
                              ]
                            }),
                            ee
                          ]
                        }),
                        (null == n ? void 0 : n.length)
                          ? (0, l.jsx)(A.lM, { isVisible: T, onClose: () => H(!1), onChainSelect: et, chainsToShow: n, selectedChain: I, chainTagsStore: E })
                          : null,
                        (0, l.jsx)(v.Z, { isVisible: z, onClose: () => R(!1), chainTagsStore: E, defaultFilter: U }),
                        V
                          ? (0, l.jsx)(C.o, {
                              onClose: (e, t, a, n) => {
                                F(void 0);
                                let l = "";
                                (e || t || a || n) &&
                                  ((l = `?${x().stringify({ sourceChainId: e, sourceToken: t, destinationChainId: a, destinationToken: n, pageSource: "swapAgain" })}`),
                                  _(`/swap${l}`));
                              },
                              ...V
                            })
                          : null
                      ]
                    })
              })
            );
          });
          (k.displayName = "GeneralActivity"), n();
        } catch (e) {
          n(e);
        }
      });
    },
    73714: function (e, t, a) {
      a.d(t, { J: () => r });
      var n = a(52322),
        l = a(27963),
        i = a(30464);
      a(2784);
      var s = a(46103);
      function r(e) {
        let { accountExplorerLink: t } = e;
        return (0, n.jsxs)("div", {
          className: "flex flex-col h-[350px]",
          children: [
            (0, n.jsx)(l.S, { src: i.r.Activity.ActivityIcon, heading: "No activity", subHeading: "Your activity will appear here" }),
            t
              ? (0, n.jsx)("a", {
                  href: t,
                  target: "_blank",
                  className: "font-semibold text-base mt-4 text-center",
                  style: { color: s.w.green600 },
                  rel: "noreferrer",
                  children: "Check on Explorer"
                })
              : null
          ]
        });
      }
    },
    45939: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { l: () => c });
          var l = a(52322),
            i = a(96217),
            s = a(75958),
            r = a(7345);
          a(2784);
          var o = e([r]);
          r = (o.then ? (await o)() : o)[0];
          let c = (0, s.Pi)(e => {
            let { isVisible: t, onClose: a, chainsToShow: n, selectedChain: s, onChainSelect: o, chainTagsStore: c } = e;
            return (0, l.jsx)(i.Z, {
              isOpen: t,
              onClose: a,
              fullScreen: !0,
              className: "h-full",
              title: "Switch chain",
              children: (0, l.jsx)(r.c, { selectedChain: s, onChainSelect: o, chainsToShow: n, chainTagsStore: c })
            });
          });
          n();
        } catch (e) {
          n(e);
        }
      });
    },
    50554: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { O: () => f });
          var l = a(52322),
            i = a(41172),
            s = a(62423),
            r = a(26007),
            o = a(96217),
            c = a(91486),
            d = a(72059),
            u = a(38313),
            m = a(36400),
            v = a(2784),
            h = a(54525),
            x = a(74047),
            g = e([m, u, d]);
          [m, u, d] = g.then ? (await g)() : g;
          let p = { name: "", emoji: 0 };
          function f(e) {
            var t, a, n, g;
            let { open: f, tx: y, onBack: b, forceChain: j } = e,
              w = (0, m.pb)(),
              C = (0, u.ob)(),
              N = (0, d.a7)(),
              S = (0, v.useMemo)(() => j || N, [j, N]),
              [A, E] = (0, v.useState)(p),
              k = (0, i.SFn)(S),
              L = null == y ? void 0 : null === (t = y.parsedTx) || void 0 === t ? void 0 : t.messages[0];
            (0, v.useEffect)(() => {
              if ((null == L ? void 0 : L.__type) === s.ax.BankSend) {
                let e = k === L.toAddress;
                h.o.getEntry(e ? L.fromAddress : L.toAddress).then(e => {
                  e ? E({ name: e.name, emoji: e.emoji }) : E(p);
                });
              }
            }, [y, E, L, k]);
            let { explorerTxnUrl: T } = (0, i.xGX)({
              forceTxHash: null == y ? void 0 : null === (a = y.parsedTx) || void 0 === a ? void 0 : a.txHash,
              forceChain: S,
              forceNetwork: C
            });
            return (0, l.jsxs)(o.Z, {
              fullScreen: !0,
              title: "Transaction details",
              isOpen: f,
              onClose: b,
              className: "px-6 pb-6 pt-8 flex flex-col gap-8 overflow-auto h-full",
              children: [
                y && (0, l.jsx)(x.d, { tx: y, contact: A, txnMessage: L, activeChain: S }),
                T &&
                  (0, l.jsx)(c.zx, {
                    className: "w-full mt-auto",
                    onClick: () => window.open(T, "_blank"),
                    children: (0, l.jsxs)("div", {
                      className: "flex justify-center items-center",
                      children: [
                        (0, l.jsx)(r.O, { size: 20, className: "mr-1" }),
                        (0, l.jsxs)("span", {
                          children: [
                            "View on ",
                            null === (g = w[S].txExplorer) || void 0 === g ? void 0 : null === (n = g[C]) || void 0 === n ? void 0 : n.name
                          ]
                        })
                      ]
                    })
                  })
              ]
            });
          }
          n();
        } catch (e) {
          n(e);
        }
      });
    },
    31992: function (e, t, a) {
      a.d(t, { A: () => d });
      var n = a(52322),
        l = a(72779),
        i = a.n(l),
        s = a(30464);
      a(2784);
      var r = a(19623);
      let o = e => {
          switch (e) {
            case "Yes":
              return s.r.Gov.VoteOptionYes;
            case "No":
              return s.r.Gov.VoteOptionNo;
            case "No with Veto":
              return s.r.Gov.VoteOptionNoWithVeto;
            case "Abstain":
              return s.r.Gov.VoteOptionAbstain;
          }
          return s.r.Activity.Voting;
        },
        c = (e, t) => {
          switch (e) {
            case "send":
            case "secretTokenTransfer":
              return s.r.Activity.SendIcon;
            case "receive":
              return s.r.Activity.ReceiveIcon;
            case "fallback":
              return s.r.Activity.Fallback;
            case "delegate":
            case "liquidity/add":
              return s.r.Activity.Delegate;
            case "undelegate":
            case "liquidity/remove":
              return s.r.Activity.Undelegate;
            case "pending":
              return s.r.Activity.Pending;
            case "ibc/transfer":
            case "swap":
              return s.r.Activity.SwapIcon;
            case "vote":
              return o(t);
          }
        };
      function d(e) {
        let { img: t, secondaryImg: a, type: l, showLoader: o, voteOption: d, size: u = "md", isSuccessful: m } = e,
          v = c(l, d);
        return (0, n.jsxs)("div", {
          className: i()("relative", { "h-8 w-8": "sm" === u, "h-10 w-10": "md" === u, "h-16 w-16": "lg" === u }),
          children: [
            (0, n.jsx)("img", {
              src: "fallback" === l ? s.r.Activity.Hash : t,
              className: i()("absolute", { "w-full h-full": !a, "w-7 h-7 ": "md" === u, "w-12 h-12": "lg" === u, "left-0 bottom-0": !!a })
            }),
            a &&
              (0, n.jsx)("img", {
                src: a,
                className: i()("absolute top-0 right-0", { "w-4 h-4": "sm" === u, "w-7 h-7": "md" === u, "w-12 h-12": "lg" === u })
              }),
            o &&
              (0, n.jsx)("div", {
                className: "absolute right-0 bottom-0",
                children: (0, n.jsx)(r.T, { color: "#29a874", className: "h-5 w-5 bg-white-100 rounded-2xl" })
              }),
            !a && !o && (0, n.jsx)("img", { src: m ? v : s.r.Activity.Error, className: i()("absolute right-0 bottom-0", { "w-4 h-4": "sm" === u }) })
          ]
        });
      }
    },
    80841: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { AH: () => l.A, JK: () => d.J, OO: () => m.O, Um: () => i.U, Ye: () => r.Y, iD: () => c.i, lB: () => o.l, lM: () => u.l, sP: () => s.s });
          var l = a(31992),
            i = a(6702),
            s = a(10452),
            r = a(60790),
            o = a(4417),
            c = a(30447),
            d = a(73714),
            u = a(45939),
            m = a(50554),
            v = e([i, s, r, c, u, m]);
          ([i, s, r, c, u, m] = v.then ? (await v)() : v), n();
        } catch (e) {
          n(e);
        }
      });
    },
    74047: function (e, t, a) {
      a.d(t, { d: () => S });
      var n = a(52322),
        l = a(41172),
        i = a(75377),
        s = a(28879),
        r = a.n(s),
        o = a(25736),
        c = a(2892),
        d = a(30464),
        u = a(2784),
        m = a(53221),
        v = a(70514),
        h = a(71198),
        x = a(91486),
        g = a(14981),
        f = a(4370),
        p = a(64651);
      let y = { duration: 0.15, type: "easeIn" },
        b = { hide: { opacity: 0, scale: 0.8 }, animate: { opacity: 1, scale: 1 } },
        j = e => {
          let [t, a] = (0, u.useState)(!1);
          return (
            (0, u.useEffect)(() => {
              t &&
                setTimeout(() => {
                  a(!1);
                }, 2e3);
            }, [t]),
            (0, n.jsx)(x.zx, {
              variant: "ghost",
              size: "sm",
              ...e,
              title: "Copy",
              className: (0, v.cn)(e.className, t ? "text-accent-success" : "text-muted-foreground"),
              onClick: t => {
                var n;
                a(!0), null === (n = e.onClick) || void 0 === n || n.call(e, t);
              },
              children: (0, n.jsx)(g.M, {
                mode: "wait",
                children: t
                  ? (0, n.jsx)(
                      f.E.img,
                      {
                        src: d.r.Misc.CheckGreenOutline,
                        alt: "check",
                        className: "size-5",
                        transition: y,
                        variants: b,
                        initial: "hide",
                        animate: "animate",
                        exit: "hide"
                      },
                      "check"
                    )
                  : (0, n.jsx)(
                      f.E.div,
                      { transition: y, variants: b, initial: "hide", animate: "animate", exit: "hide", children: (0, n.jsx)(p.T, { className: "size-5" }) },
                      "copy"
                    )
              })
            })
          );
        };
      j.displayName = "CopyButton";
      var w = a(49409);
      let C = e => {
          let t = (0, o.C)(e.txType ?? "fallback", e.activeChain);
          return (0, n.jsxs)("div", {
            className: (0, v.cn)("flex items-center p-5 gap-3 bg-secondary-100 rounded-xl w-full", e.className),
            children: [
              "string" == typeof e.imgSrc ? (0, n.jsx)("img", { src: e.imgSrc, onError: (0, w._)(t), className: "size-10" }) : e.imgSrc,
              (0, n.jsxs)("span", {
                className: "flex flex-col gap-px",
                children: [
                  (0, n.jsx)("span", { className: "text-sm font-medium text-muted-foreground", children: e.title }),
                  (0, n.jsx)("span", { className: "font-bold text-base", children: e.subtitle })
                ]
              }),
              (0, n.jsx)("span", { className: "text-muted-foreground ml-auto", children: e.trailing })
            ]
          });
        },
        N = e => ({
          send: { icon: d.r.Activity.SendIcon, title: "Sent" },
          receive: { icon: d.r.Activity.ReceiveIcon, title: "Received" },
          pending: { icon: d.r.Activity.PendingDetails, title: "Pending" },
          delegate: { icon: d.r.Activity.Delegate, title: "Delegated" },
          undelegate: { icon: d.r.Activity.Undelegate, title: "Undelegated" },
          "ibc/transfer": { icon: d.r.Activity.SwapIcon, title: "IBC Transfer" },
          vote: { icon: d.r.Activity.TxHash, title: "Voted" },
          swap: { icon: d.r.Logos.ChainLogos[e] ?? d.r.Activity.SendDetails, title: "Swap" },
          fallback: { icon: d.r.Activity.SendIcon, title: "Success" },
          secretTokenTransfer: { icon: d.r.Activity.SendDetails, title: "Sent" },
          "liquidity/add": { icon: d.r.Activity.Delegate, title: "Add Liquidity" },
          "liquidity/remove": { icon: d.r.Activity.Undelegate, title: "Remove Liquidity" }
        }),
        S = e => {
          var t, a, s, x, g, f, p, y, b, w, S, A, E, k, L, T, H, M;
          let { tx: Z, contact: O, activeChain: D, txnMessage: V } = e,
            F = (0, l.DI5)()[D],
            _ =
              (null == Z ? void 0 : null === (t = Z.content) || void 0 === t ? void 0 : t.txType) === "send" ||
              (null == Z ? void 0 : null === (a = Z.content) || void 0 === a ? void 0 : a.txType) === "receive" ||
              (null == Z ? void 0 : null === (s = Z.content) || void 0 === s ? void 0 : s.txType) === "ibc/transfer",
            I = (null == Z ? void 0 : null === (x = Z.parsedTx) || void 0 === x ? void 0 : x.code) === 0,
            {
              sentAmount: P,
              sentTokenInfo: z,
              receivedAmount: R,
              receivedTokenInfo: U,
              sentUsdValue: $,
              receivedUsdValue: J,
              txType: G
            } = (null == Z ? void 0 : Z.content) ?? {},
            q = (0, o.C)(G ?? "fallback", D),
            B = N(D),
            { icon: Y, title: W } = B[G ?? ""] || B.fallback,
            K = (0, u.useMemo)(() => {
              var e;
              return r()(null == Z ? void 0 : null === (e = Z.parsedTx) || void 0 === e ? void 0 : e.timestamp).format("D MMMM YYYY h:mm A");
            }, [Z]),
            X = P && (null == z ? void 0 : z.coinDenom) ? (0, h.LH)(P, z.coinDenom) : void 0,
            Q = R && (null == U ? void 0 : U.coinDenom) ? (0, h.LH)(R, U.coinDenom) : void 0;
          return (0, n.jsxs)("div", {
            className: "flex flex-col gap-4",
            children: [
              (0, n.jsxs)("div", {
                className: "w-full flex flex-col items-center shrink-0 gap-3 mb-4",
                children: [
                  (0, n.jsx)("img", { src: I ? Y : d.r.Activity.Error, className: "size-[4.5rem]" }),
                  (0, n.jsx)("span", {
                    className: "font-bold text-2xl mt-4",
                    children:
                      (null == Z ? void 0 : null === (g = Z.content) || void 0 === g ? void 0 : g.txType) === "vote"
                        ? null == Z
                          ? void 0
                          : null === (f = Z.content) || void 0 === f
                            ? void 0
                            : f.title1
                        : I
                          ? W
                          : "Fail"
                  }),
                  (0, n.jsx)("span", { className: "text-sm font-medium text-muted-foreground", children: K })
                ]
              }),
              X || Q
                ? (0, n.jsx)(C, {
                    title: null == Z ? void 0 : null === (p = Z.content) || void 0 === p ? void 0 : p.title1,
                    imgSrc: F.chainSymbolImageUrl ?? q,
                    subtitle: X ?? Q ?? "",
                    activeChain: D,
                    txType: null == Z ? void 0 : null === (y = Z.content) || void 0 === y ? void 0 : y.txType,
                    trailing: (0, n.jsx)("span", {
                      className: (0, v.cn)("text-muted-foreground ml-auto font-medium", { "text-accent-success": J, "text-destructive-100": $ }),
                      children: $ ? `- $${Number($).toFixed(2)}` : J ? `+ $${Number(J).toFixed(2)}` : ""
                    })
                  })
                : null,
              _ &&
                (0, n.jsx)("div", {
                  className: "rounded-2xl w-full overflow-auto shrink-0",
                  children:
                    (null == Z ? void 0 : null === (b = Z.content) || void 0 === b ? void 0 : b.txType) === "send"
                      ? (0, n.jsx)(C, {
                          title: "Sent to " + O.name,
                          imgSrc: (0, n.jsx)(i.Avatar, { emoji: O.emoji, size: "sm" }),
                          subtitle: (0, h.Hn)(V.toAddress),
                          activeChain: D,
                          txType: null == Z ? void 0 : null === (w = Z.content) || void 0 === w ? void 0 : w.txType,
                          trailing: (0, n.jsx)(j, {
                            onClick: () => {
                              m.i.copyText(V.toAddress);
                            }
                          })
                        })
                      : (null == Z ? void 0 : null === (S = Z.content) || void 0 === S ? void 0 : S.txType) === "receive"
                        ? (0, n.jsx)(C, {
                            title: "Received from " + O.name,
                            imgSrc: (0, n.jsx)(i.Avatar, { emoji: O.emoji, size: "sm" }),
                            subtitle: (0, h.Hn)(V.fromAddress),
                            activeChain: D,
                            txType: null == Z ? void 0 : null === (A = Z.content) || void 0 === A ? void 0 : A.txType,
                            trailing: (0, n.jsx)(j, {
                              onClick: () => {
                                m.i.copyText(V.fromAddress);
                              }
                            })
                          })
                        : null
                }),
              (0, n.jsxs)("div", {
                children: [
                  (0, n.jsx)(C, {
                    title: "Transaction ID",
                    imgSrc: (0, n.jsx)("span", {
                      className: "size-10 grid place-content-center bg-secondary-250 text-secondary-foreground rounded-full text-mdl font-medium",
                      children: "#"
                    }),
                    subtitle: (0, h.Hn)((null == Z ? void 0 : null === (E = Z.parsedTx) || void 0 === E ? void 0 : E.txHash) ?? ""),
                    activeChain: D,
                    txType: null == Z ? void 0 : null === (k = Z.content) || void 0 === k ? void 0 : k.txType,
                    className: (null == Z ? void 0 : null === (L = Z.content) || void 0 === L ? void 0 : L.feeAmount) ? "!rounded-b-none" : "",
                    trailing: (0, n.jsx)(j, {
                      onClick: () => {
                        var e;
                        m.i.copyText((null == Z ? void 0 : null === (e = Z.parsedTx) || void 0 === e ? void 0 : e.txHash) ?? "");
                      }
                    })
                  }),
                  (null == Z ? void 0 : null === (T = Z.content) || void 0 === T ? void 0 : T.feeAmount) &&
                    (0, n.jsx)(C, {
                      className: "!rounded-t-none !pt-0",
                      title: "Transaction Fee",
                      imgSrc: (0, n.jsx)("span", {
                        className: "size-10 grid place-content-center bg-secondary-250 text-secondary-foreground rounded-full",
                        children: (0, n.jsx)(c.t, { className: "size-4" })
                      }),
                      subtitle: null == Z ? void 0 : null === (H = Z.content) || void 0 === H ? void 0 : H.feeAmount,
                      activeChain: D,
                      txType: null == Z ? void 0 : null === (M = Z.content) || void 0 === M ? void 0 : M.txType
                    })
                ]
              })
            ]
          });
        };
    },
    36031: function (e, t, a) {
      a.d(t, { z: () => i });
      var n = a(28879),
        l = a.n(n);
      function i(e, t) {
        if (!t.parsedTx) return e;
        let a = l()(t.parsedTx.timestamp).format("MMMM DD");
        return e[a] ? e[a].push(t) : (e = { ...e, [a]: [t] }), e;
      }
    },
    4079: function (e, t, a) {
      a.d(t, { Z: () => i });
      var n = a(52322);
      a(2784);
      let l = e =>
          (0, n.jsxs)("svg", {
            xmlns: "http://www.w3.org/2000/svg",
            xmlnsXlink: "http://www.w3.org/1999/xlink",
            viewBox: "0 0 96 96",
            width: "96",
            height: "96",
            preserveAspectRatio: "xMidYMid meet",
            ...e,
            children: [
              (0, n.jsx)("defs", {
                children: (0, n.jsx)("clipPath", { id: "__lottie_element_46", children: (0, n.jsx)("rect", { width: "96", height: "96", x: "0", y: "0" }) })
              }),
              (0, n.jsx)("g", {
                clipPath: "url(#__lottie_element_46)",
                children: (0, n.jsx)("g", {
                  id: "612",
                  transform: "matrix(4.119999885559082,0,0,4.119999885559082,48.165000915527344,49.09299850463867)",
                  opacity: "1",
                  style: { display: "block" },
                  children: (0, n.jsx)("g", {
                    opacity: "1",
                    transform: "matrix(1,0,0,1,0,0)",
                    children: (0, n.jsx)("path", {
                      fill: "currentColor",
                      fillOpacity: 1,
                      d: " M1.8949999809265137,8.607999801635742 C2.203000068664551,8.515000343322754 2.503999948501587,8.401000022888184 2.7950000762939453,8.265999794006348 C5.389999866485596,7.039000034332275 6.835000038146973,4.218999862670898 6.664000034332275,0.7260000109672546 C6.5980000495910645,-0.8500000238418579 6.209000110626221,-2.3949999809265137 5.520999908447266,-3.812999963760376 C4.833000183105469,-5.23199987411499 3.8610000610351562,-6.49399995803833 2.6640000343322754,-7.519999980926514 C3.384000062942505,-5.364999771118164 3.6640000343322754,-2.5179998874664307 1.1640000343322754,-0.7649999856948853 C0.6449999809265137,-0.3659999966621399 0.04600000008940697,-0.08299999684095383 -0.5929999947547913,0.06400000303983688 C-1.2309999465942383,0.21199999749660492 -1.8940000534057617,0.22100000083446503 -2.5360000133514404,0.09000000357627869 C-3.703000068664551,-0.2199999988079071 -4.749000072479248,-0.8769999742507935 -5.535999774932861,-1.7929999828338623 C-6.150000095367432,-0.7609999775886536 -6.514999866485596,0.39899998903274536 -6.604000091552734,1.5959999561309814 C-6.692999839782715,2.7939999103546143 -6.502999782562256,3.994999885559082 -6.047999858856201,5.10699987411499 C-5.486999988555908,6.285999774932861 -4.591000080108643,7.275000095367432 -3.4719998836517334,7.948999881744385 C-2.3529999256134033,8.623000144958496 -1.0609999895095825,8.95199966430664 0.24400000274181366,8.897000312805176 C-0.7620000243186951,8.944999694824219 -1.746000051498413,8.593999862670898 -2.49399995803833,7.920000076293945 C-3.242000102996826,7.244999885559082 -3.693000078201294,6.302000045776367 -3.747999906539917,5.296999931335449 C-3.7769999504089355,5.093999862670898 -3.749000072479248,4.888000011444092 -3.6659998893737793,4.701000213623047 C-3.5829999446868896,4.513999938964844 -3.447999954223633,4.354000091552734 -3.2780001163482666,4.241000175476074 C-3.1070001125335693,4.127999782562256 -2.9079999923706055,4.065000057220459 -2.7039999961853027,4.060999870300293 C-2.499000072479248,4.056000232696533 -2.2980000972747803,4.110000133514404 -2.122999906539917,4.216000080108643 C0.593999981880188,5.855000019073486 3.871000051498413,2.869999885559082 3.6710000038146973,-0.09200000017881393 C5.139999866485596,1.190000057220459 5.307000160217285,7.208000183105469 1.8949999809265137,8.607999801635742z M0.1679999977350235,-10.862000465393066 C0.36899998784065247,-10.920000076293945 0.5820000171661377,-10.913000106811523 0.7789999842643738,-10.842000007629395 C5.926000118255615,-8.993000030517578 8.446999549865723,-3.753000020980835 8.657999992370605,0.621999979019165 C8.871000289916992,4.952000141143799 6.997000217437744,8.484000205993652 3.6470000743865967,10.071000099182129 C1.5759999752044678,11.050999641418457 -0.800000011920929,11.168000221252441 -2.9579999446868896,10.395999908447266 C-5.114999771118164,9.625 -6.879000186920166,8.029000282287598 -7.860000133514404,5.958000183105469 C-10.276000022888184,0.8529999852180481 -6.566999912261963,-3.9730000495910645 -6.408999919891357,-4.172999858856201 C-6.308000087738037,-4.302999973297119 -6.177999973297119,-4.40500020980835 -6.0279998779296875,-4.4710001945495605 C-5.877999782562256,-4.538000106811523 -5.715000152587891,-4.565999984741211 -5.552000045776367,-4.552999973297119 C-5.38700008392334,-4.541999816894531 -5.229000091552734,-4.491000175476074 -5.089000225067139,-4.4039998054504395 C-4.948999881744385,-4.315999984741211 -4.834000110626221,-4.196000099182129 -4.751999855041504,-4.052999973297119 C-4.150000095367432,-3.0350000858306885 -3.2100000381469727,-2.260999917984009 -2.0959999561309814,-1.8650000095367432 C-1.725000023841858,-1.7970000505447388 -1.343000054359436,-1.809999942779541 -0.9769999980926514,-1.902999997138977 C-0.6119999885559082,-1.996000051498413 -0.2709999978542328,-2.1670000553131104 0.02199999988079071,-2.4049999713897705 C2.7950000762939453,-4.349999904632568 -0.36500000953674316,-9.307000160217285 -0.3970000147819519,-9.357000350952148 C-0.5099999904632568,-9.532999992370605 -0.5659999847412109,-9.739999771118164 -0.5559999942779541,-9.947999954223633 C-0.5460000038146973,-10.156999588012695 -0.47099998593330383,-10.357999801635742 -0.3409999907016754,-10.522000312805176 C-0.210999995470047,-10.6850004196167 -0.032999999821186066,-10.805000305175781 0.1679999977350235,-10.862000465393066z"
                    })
                  })
                })
              })
            ]
          }),
        i = (0, a(75958).Pi)(() =>
          (0, n.jsx)("div", { className: "relative", children: (0, n.jsx)(l, { height: 24, width: 24, className: "text-muted-foreground" }) })
        );
    },
    17065: function (e, t, a) {
      a.d(t, { Z: () => A });
      var n = a(52322),
        l = a(66815),
        i = a(26227),
        s = a(2784),
        r = a(6806);
      let o = new Map([
        [
          "bold",
          s.createElement(
            s.Fragment,
            null,
            s.createElement("path", {
              d: "M168.49,104.49,145,128l23.52,23.51a12,12,0,0,1-17,17L128,145l-23.51,23.52a12,12,0,0,1-17-17L111,128,87.51,104.49a12,12,0,0,1,17-17L128,111l23.51-23.52a12,12,0,0,1,17,17ZM236,128A108,108,0,1,1,128,20,108.12,108.12,0,0,1,236,128Zm-24,0a84,84,0,1,0-84,84A84.09,84.09,0,0,0,212,128Z"
            })
          )
        ],
        [
          "duotone",
          s.createElement(
            s.Fragment,
            null,
            s.createElement("path", { d: "M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z", opacity: "0.2" }),
            s.createElement("path", {
              d: "M165.66,101.66,139.31,128l26.35,26.34a8,8,0,0,1-11.32,11.32L128,139.31l-26.34,26.35a8,8,0,0,1-11.32-11.32L116.69,128,90.34,101.66a8,8,0,0,1,11.32-11.32L128,116.69l26.34-26.35a8,8,0,0,1,11.32,11.32ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"
            })
          )
        ],
        [
          "fill",
          s.createElement(
            s.Fragment,
            null,
            s.createElement("path", {
              d: "M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm37.66,130.34a8,8,0,0,1-11.32,11.32L128,139.31l-26.34,26.35a8,8,0,0,1-11.32-11.32L116.69,128,90.34,101.66a8,8,0,0,1,11.32-11.32L128,116.69l26.34-26.35a8,8,0,0,1,11.32,11.32L139.31,128Z"
            })
          )
        ],
        [
          "light",
          s.createElement(
            s.Fragment,
            null,
            s.createElement("path", {
              d: "M164.24,100.24,136.48,128l27.76,27.76a6,6,0,1,1-8.48,8.48L128,136.48l-27.76,27.76a6,6,0,0,1-8.48-8.48L119.52,128,91.76,100.24a6,6,0,0,1,8.48-8.48L128,119.52l27.76-27.76a6,6,0,0,1,8.48,8.48ZM230,128A102,102,0,1,1,128,26,102.12,102.12,0,0,1,230,128Zm-12,0a90,90,0,1,0-90,90A90.1,90.1,0,0,0,218,128Z"
            })
          )
        ],
        [
          "regular",
          s.createElement(
            s.Fragment,
            null,
            s.createElement("path", {
              d: "M165.66,101.66,139.31,128l26.35,26.34a8,8,0,0,1-11.32,11.32L128,139.31l-26.34,26.35a8,8,0,0,1-11.32-11.32L116.69,128,90.34,101.66a8,8,0,0,1,11.32-11.32L128,116.69l26.34-26.35a8,8,0,0,1,11.32,11.32ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"
            })
          )
        ],
        [
          "thin",
          s.createElement(
            s.Fragment,
            null,
            s.createElement("path", {
              d: "M162.83,98.83,133.66,128l29.17,29.17a4,4,0,0,1-5.66,5.66L128,133.66,98.83,162.83a4,4,0,0,1-5.66-5.66L122.34,128,93.17,98.83a4,4,0,0,1,5.66-5.66L128,122.34l29.17-29.17a4,4,0,1,1,5.66,5.66ZM228,128A100,100,0,1,1,128,28,100.11,100.11,0,0,1,228,128Zm-8,0a92,92,0,1,0-92,92A92.1,92.1,0,0,0,220,128Z"
            })
          )
        ]
      ]);
      var c = Object.defineProperty,
        d = Object.defineProperties,
        u = Object.getOwnPropertyDescriptors,
        m = Object.getOwnPropertySymbols,
        v = Object.prototype.hasOwnProperty,
        h = Object.prototype.propertyIsEnumerable,
        x = (e, t, a) => (t in e ? c(e, t, { enumerable: !0, configurable: !0, writable: !0, value: a }) : (e[t] = a)),
        g = (e, t) => {
          for (var a in t || (t = {})) v.call(t, a) && x(e, a, t[a]);
          if (m) for (var a of m(t)) h.call(t, a) && x(e, a, t[a]);
          return e;
        },
        f = (e, t) => d(e, u(t));
      let p = (0, s.forwardRef)((e, t) => s.createElement(r.Z, f(g({ ref: t }, e), { weights: o })));
      p.displayName = "XCircle";
      var y = a(89187),
        b = a(14981),
        j = a(4370),
        w = a(30464),
        C = a(43963),
        N = a(32722),
        S = a(71198);
      let A = e => {
        var t, a, r, o, c, d;
        let { setShowSwapTxPageFor: u, selectedPendingSwapTx: m } = e,
          v = (0, s.useCallback)(() => {
            u(m);
          }, [m, u]);
        (0, s.useEffect)(() => {
          [l.uK.SUCCESS, l.uK.FAILED].includes((null == m ? void 0 : m.state) ?? l.uK.PENDING) &&
            setTimeout(() => {
              var e;
              let t = (0, N.JV)(
                (null == m ? void 0 : m.routingInfo) ?? { messages: null == m ? void 0 : null === (e = m.route) || void 0 === e ? void 0 : e.messages }
              );
              t && (0, N.zy)(t);
            }, 5e3);
        }, [m]);
        let { icon: h, title: x } = (0, s.useMemo)(
          () =>
            (null == m ? void 0 : m.state) === l.uK.SUCCESS
              ? { icon: (0, n.jsx)(i.f, { size: 36, className: "text-foreground" }), title: "Swap successful" }
              : (null == m ? void 0 : m.state) === l.uK.FAILED
                ? { icon: (0, n.jsx)(p, { size: 36, className: "text-foreground" }), title: "Swap failed" }
                : { icon: w.r.Swap.Rotate, title: "Swap in progress..." },
          [null == m ? void 0 : m.state]
        );
        return (0, n.jsxs)("div", {
          className: "flex rounded-2xl justify-between items-center p-4 bg-secondary-100 hover:bg-secondary-200 transition-colors cursor-pointer",
          onClick: v,
          children: [
            (0, n.jsxs)("div", {
              className: "flex items-center flex-grow gap-3",
              children: [
                (0, n.jsx)(b.M, {
                  mode: "popLayout",
                  initial: !1,
                  children:
                    "string" == typeof h
                      ? (0, n.jsx)(
                          j.E.img,
                          {
                            variants: C.Qq,
                            transition: C.eR,
                            initial: "hidden",
                            animate: "visible",
                            exit: "hidden",
                            src: h,
                            alt: "alert-icon",
                            className: "w-8 h-8"
                          },
                          h
                        )
                      : (0, n.jsx)(
                          j.E.div,
                          {
                            variants: C.Qq,
                            transition: C.eR,
                            initial: "hidden",
                            animate: "visible",
                            exit: "hidden",
                            className: "flex justify-center items-center overflow-hidden -mr-1",
                            children: h
                          },
                          x
                        )
                }),
                (0, n.jsxs)("div", {
                  className: "flex flex-col justify-center items-start",
                  children: [
                    (0, n.jsx)("span", { className: "text-base font-normal", children: x }),
                    (null == m
                      ? void 0
                      : null === (r = m.routingInfo) || void 0 === r
                        ? void 0
                        : null === (a = r.messages) || void 0 === a
                          ? void 0
                          : null === (t = a[0]) || void 0 === t
                            ? void 0
                            : t.customTxHash) &&
                      (0, n.jsx)("span", {
                        className: "text-xs font-medium text-muted-foreground",
                        children: (0, S.MD)(
                          null == m
                            ? void 0
                            : null === (d = m.routingInfo) || void 0 === d
                              ? void 0
                              : null === (c = d.messages) || void 0 === c
                                ? void 0
                                : null === (o = c[0]) || void 0 === o
                                  ? void 0
                                  : o.customTxHash,
                          5,
                          5
                        )
                      })
                  ]
                })
              ]
            }),
            (0, n.jsx)(y.T, { size: 12, className: "text-muted-foreground" })
          ]
        });
      };
    },
    59079: function (e, t, a) {
      a.d(t, { d: () => r, o: () => s });
      var n = a(41172),
        l = a(15969),
        i = a(2784);
      function s(e) {
        return /^(0x|0X)?[a-fA-F0-9]+$/.test(e) && e.length % 2 == 0 && 32 == (/^(0x|0X)/.test(e) ? (e.length - 2) / 2 : e.length / 2);
      }
      function r(e) {
        let { setAddressError: t, setAddressWarning: a, recipientInputValue: s, showNameServiceResults: r, sendActiveChain: o } = e,
          c = (0, n.SFn)(o);
        (0, i.useEffect)(() => {
          !(async function () {
            s && c !== s
              ? (0, l.AtH)(s) || (0, l.Ohs)(s) || (0, l.$v)(s) || (0, l.BVJ)(s) || r
                ? (a(n.wL6), t(void 0))
                : t("The entered address is invalid")
              : (a(n.wL6), t(void 0));
          })();
        }, [c, s, r]);
      }
    },
    85019: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { s: () => m });
          var l = a(44658),
            i = a(78344),
            s = a(61100),
            r = a(26245),
            o = a(36321),
            c = a(74713),
            d = a(30809),
            u = e([r]);
          r = (u.then ? (await u)() : u)[0];
          let m = new l.WJ(o.Ui, s.M, d.i, i.J, r.JY, r.w3, c.NH);
          n();
        } catch (e) {
          n(e);
        }
      });
    },
    54525: function (e, t, a) {
      a.d(t, { o: () => n });
      var n,
        l = a(15969),
        i = a(59079),
        s = a(2784),
        r = a(72565),
        o = a.n(r);
      let c = (e, t, a) => {};
      !(function (e) {
        let t = "all-saved-contacts";
        async function a(e) {
          if (!(0, l.AtH)(e.address) && !(0, l.Ohs)(e.address) && !(0, l.$v)(e.address) && !(0, l.BVJ)(e.address) && !(0, i.o)(e.address)) {
            c("Save contact", "Address not valid");
            return;
          }
          let { address: a, blockchain: s } = e,
            r = await n(a);
          s || (e.blockchain = (0, l.z_q)(a));
          let d = (await o().storage.local.get([t]))[t] ?? {},
            u = {};
          r ? (u[a] = { ...r, ...e }) : (u[a] = e);
          let m = { ...d, ...u };
          return await o().storage.local.set({ [t]: m }), e;
        }
        async function n(e) {
          return ((await o().storage.local.get([t]))[t] ?? {})[e];
        }
        async function r(e) {
          let a = (await o().storage.local.get([t]))[t] ?? {};
          (await n(e)) && delete a[e], delete a[e], await o().storage.local.set({ [t]: a });
        }
        (e.subscribe = function (e) {
          o().storage.onChanged.addListener((a, n) => {
            "local" === n && a[t] && e(a[t].newValue);
          });
        }),
          (e.unsubscribe = function (e) {
            o().storage.onChanged.removeListener((a, n) => {
              "local" === n && a[t] && e(a[t].newValue);
            });
          }),
          (e.save = a),
          (e.getEntry = n),
          (e.useGetContact = function (e) {
            let [a, l] = (0, s.useState)();
            return (
              (0, s.useEffect)(() => {
                let a = !1;
                if (e) {
                  if (a) return;
                  n(e)
                    .then(e => {
                      a || l(e);
                    })
                    .catch(() => {
                      a || l(void 0);
                    });
                } else l(void 0);
                let i = (a, n) => {
                  if ("local" === n && a[t]) {
                    let n = a[t].newValue;
                    n[e] && l(n[e]);
                  }
                };
                return (
                  o().storage.onChanged.addListener(i),
                  () => {
                    (a = !0), o().storage.onChanged.removeListener(i);
                  }
                );
              }, [e]),
              a
            );
          }),
          (e.getAllEntries = async () => (await o().storage.local.get([t]))[t] ?? {}),
          (e.removeEntry = r),
          (e.clear = function () {
            o().storage.local.set({ [t]: {} });
          });
      })(n || (n = {}));
    },
    45863: function (e, t, a) {
      a.d(t, { X: () => x });
      var n = a(2784),
        l = a(6806);
      let i = new Map([
        [
          "bold",
          n.createElement(
            n.Fragment,
            null,
            n.createElement("path", {
              d: "M152,116H140V60h4a28,28,0,0,1,28,28,12,12,0,0,0,24,0,52.06,52.06,0,0,0-52-52h-4V24a12,12,0,0,0-24,0V36h-4a52,52,0,0,0,0,104h4v56H104a28,28,0,0,1-28-28,12,12,0,0,0-24,0,52.06,52.06,0,0,0,52,52h12v12a12,12,0,0,0,24,0V220h12a52,52,0,0,0,0-104Zm-40,0a28,28,0,0,1,0-56h4v56Zm40,80H140V140h12a28,28,0,0,1,0,56Z"
            })
          )
        ],
        [
          "duotone",
          n.createElement(
            n.Fragment,
            null,
            n.createElement("path", { d: "M192,168a40,40,0,0,1-40,40H128V128h24A40,40,0,0,1,192,168ZM112,48a40,40,0,0,0,0,80h16V48Z", opacity: "0.2" }),
            n.createElement("path", {
              d: "M152,120H136V56h8a32,32,0,0,1,32,32,8,8,0,0,0,16,0,48.05,48.05,0,0,0-48-48h-8V24a8,8,0,0,0-16,0V40h-8a48,48,0,0,0,0,96h8v64H104a32,32,0,0,1-32-32,8,8,0,0,0-16,0,48.05,48.05,0,0,0,48,48h16v16a8,8,0,0,0,16,0V216h16a48,48,0,0,0,0-96Zm-40,0a32,32,0,0,1,0-64h8v64Zm40,80H136V136h16a32,32,0,0,1,0,64Z"
            })
          )
        ],
        [
          "fill",
          n.createElement(
            n.Fragment,
            null,
            n.createElement("path", {
              d: "M160,152a16,16,0,0,1-16,16h-8V136h8A16,16,0,0,1,160,152Zm72-24A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-56,24a32,32,0,0,0-32-32h-8V88h4a16,16,0,0,1,16,16,8,8,0,0,0,16,0,32,32,0,0,0-32-32h-4V64a8,8,0,0,0-16,0v8h-4a32,32,0,0,0,0,64h4v32h-8a16,16,0,0,1-16-16,8,8,0,0,0-16,0,32,32,0,0,0,32,32h8v8a8,8,0,0,0,16,0v-8h8A32,32,0,0,0,176,152Zm-76-48a16,16,0,0,0,16,16h4V88h-4A16,16,0,0,0,100,104Z"
            })
          )
        ],
        [
          "light",
          n.createElement(
            n.Fragment,
            null,
            n.createElement("path", {
              d: "M152,122H134V54h10a34,34,0,0,1,34,34,6,6,0,0,0,12,0,46.06,46.06,0,0,0-46-46H134V24a6,6,0,0,0-12,0V42H112a46,46,0,0,0,0,92h10v68H104a34,34,0,0,1-34-34,6,6,0,0,0-12,0,46.06,46.06,0,0,0,46,46h18v18a6,6,0,0,0,12,0V214h18a46,46,0,0,0,0-92Zm-40,0a34,34,0,0,1,0-68h10v68Zm40,80H134V134h18a34,34,0,0,1,0,68Z"
            })
          )
        ],
        [
          "regular",
          n.createElement(
            n.Fragment,
            null,
            n.createElement("path", {
              d: "M152,120H136V56h8a32,32,0,0,1,32,32,8,8,0,0,0,16,0,48.05,48.05,0,0,0-48-48h-8V24a8,8,0,0,0-16,0V40h-8a48,48,0,0,0,0,96h8v64H104a32,32,0,0,1-32-32,8,8,0,0,0-16,0,48.05,48.05,0,0,0,48,48h16v16a8,8,0,0,0,16,0V216h16a48,48,0,0,0,0-96Zm-40,0a32,32,0,0,1,0-64h8v64Zm40,80H136V136h16a32,32,0,0,1,0,64Z"
            })
          )
        ],
        [
          "thin",
          n.createElement(
            n.Fragment,
            null,
            n.createElement("path", {
              d: "M152,124H132V52h12a36,36,0,0,1,36,36,4,4,0,0,0,8,0,44.05,44.05,0,0,0-44-44H132V24a4,4,0,0,0-8,0V44H112a44,44,0,0,0,0,88h12v72H104a36,36,0,0,1-36-36,4,4,0,0,0-8,0,44.05,44.05,0,0,0,44,44h20v20a4,4,0,0,0,8,0V212h20a44,44,0,0,0,0-88Zm-40,0a36,36,0,0,1,0-72h12v72Zm40,80H132V132h20a36,36,0,0,1,0,72Z"
            })
          )
        ]
      ]);
      var s = Object.defineProperty,
        r = Object.defineProperties,
        o = Object.getOwnPropertyDescriptors,
        c = Object.getOwnPropertySymbols,
        d = Object.prototype.hasOwnProperty,
        u = Object.prototype.propertyIsEnumerable,
        m = (e, t, a) => (t in e ? s(e, t, { enumerable: !0, configurable: !0, writable: !0, value: a }) : (e[t] = a)),
        v = (e, t) => {
          for (var a in t || (t = {})) d.call(t, a) && m(e, a, t[a]);
          if (c) for (var a of c(t)) u.call(t, a) && m(e, a, t[a]);
          return e;
        },
        h = (e, t) => r(e, o(t));
      let x = (0, n.forwardRef)((e, t) => n.createElement(l.Z, h(v({ ref: t }, e), { weights: i })));
      x.displayName = "CurrencyDollar";
    },
    29828: function (e, t, a) {
      a.d(t, { G: () => x });
      var n = a(2784),
        l = a(6806);
      let i = new Map([
        [
          "bold",
          n.createElement(
            n.Fragment,
            null,
            n.createElement("path", {
              d: "M244,128a12,12,0,0,1-12,12H207.42l-36.69,73.37A12,12,0,0,1,160,220h-.6a12,12,0,0,1-10.61-7.72L95,71.15,66.92,133A12,12,0,0,1,56,140H24a12,12,0,0,1,0-24H48.27L85.08,35a12,12,0,0,1,22.13.7l54.28,142.46,27.78-55.56A12,12,0,0,1,200,116h32A12,12,0,0,1,244,128Z"
            })
          )
        ],
        [
          "duotone",
          n.createElement(
            n.Fragment,
            null,
            n.createElement("path", { d: "M96,40l33.52,88H56Zm104,88H129.52L160,208Z", opacity: "0.2" }),
            n.createElement("path", {
              d: "M240,128a8,8,0,0,1-8,8H204.94l-37.78,75.58A8,8,0,0,1,160,216h-.4a8,8,0,0,1-7.08-5.14L95.35,60.76,63.28,131.31A8,8,0,0,1,56,136H24a8,8,0,0,1,0-16H50.85L88.72,36.69a8,8,0,0,1,14.76.46l57.51,151,31.85-63.71A8,8,0,0,1,200,120h32A8,8,0,0,1,240,128Z"
            })
          )
        ],
        [
          "fill",
          n.createElement(
            n.Fragment,
            null,
            n.createElement("path", {
              d: "M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm-8,96H188.64L159,188a8,8,0,0,1-6.95,4h-.46a8,8,0,0,1-6.89-4.84L103,89.92,79,132a8,8,0,0,1-7,4H48a8,8,0,0,1,0-16H67.36L97.05,68a8,8,0,0,1,14.3.82L153,166.08l24-42.05a8,8,0,0,1,6.95-4h24a8,8,0,0,1,0,16Z"
            })
          )
        ],
        [
          "light",
          n.createElement(
            n.Fragment,
            null,
            n.createElement("path", {
              d: "M238,128a6,6,0,0,1-6,6H203.71l-38.34,76.68A6,6,0,0,1,160,214h-.3a6,6,0,0,1-5.31-3.85L95.51,55.57,61.46,130.48A6,6,0,0,1,56,134H24a6,6,0,0,1,0-12H52.14l38.4-84.48a6,6,0,0,1,11.07.34L160.74,193.1l33.89-67.78A6,6,0,0,1,200,122h32A6,6,0,0,1,238,128Z"
            })
          )
        ],
        [
          "regular",
          n.createElement(
            n.Fragment,
            null,
            n.createElement("path", {
              d: "M240,128a8,8,0,0,1-8,8H204.94l-37.78,75.58A8,8,0,0,1,160,216h-.4a8,8,0,0,1-7.08-5.14L95.35,60.76,63.28,131.31A8,8,0,0,1,56,136H24a8,8,0,0,1,0-16H50.85L88.72,36.69a8,8,0,0,1,14.76.46l57.51,151,31.85-63.71A8,8,0,0,1,200,120h32A8,8,0,0,1,240,128Z"
            })
          )
        ],
        [
          "thin",
          n.createElement(
            n.Fragment,
            null,
            n.createElement("path", {
              d: "M236,128a4,4,0,0,1-4,4H202.47l-38.89,77.79A4,4,0,0,1,160,212h-.2a4,4,0,0,1-3.54-2.58l-60.59-159-36,79.28A4,4,0,0,1,56,132H24a4,4,0,0,1,0-8H53.42L92.36,38.35a4,4,0,0,1,7.38.23L160.5,198.06l35.92-71.85A4,4,0,0,1,200,124h32A4,4,0,0,1,236,128Z"
            })
          )
        ]
      ]);
      var s = Object.defineProperty,
        r = Object.defineProperties,
        o = Object.getOwnPropertyDescriptors,
        c = Object.getOwnPropertySymbols,
        d = Object.prototype.hasOwnProperty,
        u = Object.prototype.propertyIsEnumerable,
        m = (e, t, a) => (t in e ? s(e, t, { enumerable: !0, configurable: !0, writable: !0, value: a }) : (e[t] = a)),
        v = (e, t) => {
          for (var a in t || (t = {})) d.call(t, a) && m(e, a, t[a]);
          if (c) for (var a of c(t)) u.call(t, a) && m(e, a, t[a]);
          return e;
        },
        h = (e, t) => r(e, o(t));
      let x = (0, n.forwardRef)((e, t) => n.createElement(l.Z, h(v({ ref: t }, e), { weights: i })));
      x.displayName = "Pulse";
    }
  }
]);
//# sourceMappingURL=684.js.map
