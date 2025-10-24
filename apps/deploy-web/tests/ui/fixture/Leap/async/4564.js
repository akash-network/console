!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      s = new e.Error().stack;
    s &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[s] = "2d1d314c-1964-400a-af48-2f95c168e315"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-2d1d314c-1964-400a-af48-2f95c168e315"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.22.9" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["4564"],
  {
    79215: function (e, s, a) {
      a.d(s, { og: () => x });
      var n = a(52322),
        l = a(26793),
        t = a(89187),
        i = a(16283),
        o = a(85027),
        d = a(86240),
        c = a(65953);
      a(2784);
      var r = a(70514),
        u = a(49409);
      let p = e => {
          let { activeIndex: s, setActiveIndex: a, limit: c } = e,
            { walletAvatar: u, walletName: p } = (0, d.v)();
          return (0, n.jsxs)(o.m, {
            className: "bg-secondary-50 border-b border-secondary-100",
            children: [
              (0, n.jsx)("div", { className: "w-[72px]" }),
              (0, n.jsx)(i.G2, { className: "bg-secondary-200", showWalletAvatar: !0, walletName: p, walletAvatar: u, handleDropdownClick: () => void 0 }),
              (0, n.jsx)("div", {
                className: "min-w-[72px]",
                children:
                  void 0 !== s &&
                  void 0 !== c &&
                  c > 1 &&
                  (0, n.jsxs)("div", {
                    className: "flex items-center rounded-full bg-secondary-200 p-2 justify-between",
                    children: [
                      (0, n.jsx)(l.W, {
                        size: 14,
                        className: (0, r.cn)("", { "text-muted-foreground": 0 === s, "text-foreground cursor-pointer": 0 !== s }),
                        onClick: () => {
                          a && void 0 !== s && s > 0 && a(s - 1);
                        }
                      }),
                      (0, n.jsxs)("p", { className: "text-sm font-bold text-foreground", children: [s + 1, "/", c] }),
                      (0, n.jsx)(t.T, {
                        size: 14,
                        className: (0, r.cn)("", { "text-muted-foreground": s === c - 1, "text-foreground cursor-pointer": s !== c - 1 }),
                        onClick: () => {
                          a && void 0 !== s && c && s < c - 1 && a(s + 1);
                        }
                      })
                    ]
                  })
              })
            ]
          });
        },
        m = e =>
          (0, n.jsxs)("div", {
            className: "flex items-center gap-5",
            children: [
              (0, n.jsx)("img", { src: e.logo, onError: (0, u._)(c.Globe), className: "size-[54px] rounded-full" }),
              (0, n.jsxs)("div", {
                className: "flex flex-col gap-[3px]",
                children: [
                  (0, n.jsx)("span", { className: "text-lg font-bold", children: e.title }),
                  (0, n.jsx)("span", { className: "text-xs text-muted-foreground", children: e.subTitle })
                ]
              })
            ]
          }),
        x = e =>
          (0, n.jsxs)(n.Fragment, {
            children: [
              (0, n.jsx)(p, { activeIndex: e.activeIndex, setActiveIndex: e.setActiveIndex, limit: e.limit }),
              (0, n.jsxs)("div", {
                className: (0, r.cn)(
                  "flex flex-col gap-6 mx-auto h-[calc(100%-165px)] w-full max-w-2xl box-border overflow-y-scroll pt-6 px-6 bg-secondary-50",
                  e.className
                ),
                children: [(0, n.jsx)(m, { ...e }), e.children]
              })
            ]
          });
    },
    31655: function (e, s, a) {
      a.a(e, async function (e, n) {
        try {
          a.r(s), a.d(s, { default: () => A });
          var l = a(52322),
            t = a(41172),
            i = a(44658),
            o = a(62695),
            d = a(48039),
            c = a(79215),
            r = a(19623),
            u = a(91486),
            p = a(53108),
            m = a(79533),
            x = a(76131),
            v = a(10706),
            h = a(86240),
            f = a(57124),
            y = a(78935),
            g = a(65953),
            b = a(2784),
            w = a(10289),
            j = a(70514),
            N = a(48534),
            I = a(71198),
            C = a(72565),
            M = a.n(C),
            k = a(70734),
            E = a(37124),
            _ = e([v, x]);
          async function L() {
            try {
              let e = await M().windows.getCurrent();
              await M().runtime.sendMessage({ type: "popup-closed", payload: { windowId: e.id } });
            } catch (e) {
              await M().runtime.sendMessage({ type: "popup-closed" });
            }
            setTimeout(() => {
              window.close();
            }, 50);
          }
          async function z(e) {
            try {
              await M().runtime.sendMessage(e);
            } catch (e) {}
          }
          [v, x] = _.then ? (await _)() : _;
          let A = () => {
            var e, s, a;
            let [n, C] = (0, b.useState)([]),
              _ = (0, w.s0)(),
              [A, S] = (0, b.useState)([]),
              [T, D] = (0, b.useState)(!1),
              [V, K] = (0, b.useState)(!1),
              [R, W] = (0, b.useState)([]),
              Z = (0, t.rTu)(),
              { chains: q } = (0, t._IL)(),
              F = (0, f.a)(),
              G = (0, v.Af)(),
              { walletName: H } = (0, h.v)(),
              $ = (0, b.useRef)(!1),
              J = (0, b.useMemo)(() => A.every(e => ["movement", "aptos"].includes(e.chain)), [A]),
              P = (0, b.useMemo)(
                () =>
                  A.every(e => {
                    var s;
                    return null === (s = q[e.chain]) || void 0 === s ? void 0 : s.evmOnlyChain;
                  }),
                [A, q]
              ),
              U = (0, b.useMemo)(() => A.every(e => ["solana"].includes(e.chain)), [A]),
              Y = (0, b.useMemo)(() => A.every(e => ["sui"].includes(e.chain)), [A]),
              O = (0, b.useMemo)(() => A.reduce((e, s) => (e.find(e => e.chain === s.chain) || e.push(s), e), []), [A]),
              X = (0, b.useMemo)(() => {
                var e, s, a, l, t, o, d, c, r, u, p;
                if (J)
                  return {
                    type: "address",
                    chains: O,
                    address:
                      (null == n
                        ? void 0
                        : null === (l = n[0]) || void 0 === l
                          ? void 0
                          : null === (a = l.addresses) || void 0 === a
                            ? void 0
                            : a[null === (s = O[0]) || void 0 === s ? void 0 : s.chain]) || ""
                  };
                if (P && (null == n ? void 0 : null === (e = n[0]) || void 0 === e ? void 0 : e.pubKeys)) {
                  let e = i.SZ.getEvmAddress(n[0].pubKeys[null === (t = O[0]) || void 0 === t ? void 0 : t.chain] || n[0].pubKeys.evmos);
                  return { type: "address", chains: O, address: e };
                }
                return U
                  ? {
                      type: "address",
                      chains: O,
                      address:
                        (null == n
                          ? void 0
                          : null === (c = n[0]) || void 0 === c
                            ? void 0
                            : null === (d = c.addresses) || void 0 === d
                              ? void 0
                              : d[null === (o = O[0]) || void 0 === o ? void 0 : o.chain]) || ""
                    }
                  : Y
                    ? {
                        type: "address",
                        chains: O,
                        address:
                          (null == n
                            ? void 0
                            : null === (p = n[0]) || void 0 === p
                              ? void 0
                              : null === (u = p.addresses) || void 0 === u
                                ? void 0
                                : u[null === (r = O[0]) || void 0 === r ? void 0 : r.chain]) || ""
                      }
                    : { type: "chains", chains: O };
              }, [J, P, U, Y, O, n]);
            (0, b.useEffect)(() => {
              !(async function () {
                var e;
                let s = n[0];
                if (!s || !(null == X ? void 0 : X.chains) || $.current) return;
                let a =
                  (null ===
                    (e = X.chains.filter(e => {
                      var s, a, l, t;
                      let i =
                          null == n ? void 0 : null === (a = n[0]) || void 0 === a ? void 0 : null === (s = a.addresses) || void 0 === s ? void 0 : s[e.chain],
                        o = null == n ? void 0 : null === (t = n[0]) || void 0 === t ? void 0 : null === (l = t.pubKeys) || void 0 === l ? void 0 : l[e.chain];
                      return (q[e.chain] && !i) || !o;
                    })) || void 0 === e
                    ? void 0
                    : e.map(e => e.chain)) ?? [];
                if (!(null == a ? void 0 : a.length)) return;
                let l = {};
                for await (let e of a) l[e] = q[e];
                let t = await G(s, a, "UPDATE", void 0, l);
                $.current = !0;
                let i = n.map(e => {
                  if (!t) return e;
                  let s = t[e.id];
                  return s || e;
                });
                C(i);
              })();
            }, [X, n]);
            let B = (0, b.useCallback)(async () => {
              if (!R[0]) {
                (0, N.oj)() ? _("/home") : L();
                return;
              }
              for (let s of R) {
                var e;
                let a = (null == s ? void 0 : s.validChainIds) ?? [null == s ? void 0 : null === (e = s[0]) || void 0 === e ? void 0 : e.chainId];
                await z({
                  type: "chain-approval-rejected",
                  payload: { origin, chainsIds: a, payloadId: s.payloadId, ecosystem: s.ecosystem },
                  status: "failed"
                });
              }
              window.removeEventListener("beforeunload", B), (0, N.oj)() ? _("/home") : L();
            }, [_, R]);
            (0, b.useEffect)(() => {
              Z && C([Z]);
            }, [Z]),
              (0, b.useEffect)(
                () => (
                  window.addEventListener("beforeunload", B),
                  M().storage.local.remove(p.u1),
                  () => {
                    window.removeEventListener("beforeunload", B);
                  }
                ),
                [R]
              );
            let Q = (0, b.useCallback)(
              async (e, s) => {
                if (s.id === M().runtime.id && "enable-access" === e.type) {
                  let s = await M().storage.local.get([p.vA, p.pV]),
                    a = s[p.vA] || [],
                    n = s[p.pV],
                    l = e.payload.validChainIds ?? [e.payload.chainId ?? ""],
                    { isNewChainPresent: t } = await (0, m.qe)(l, a, { origin: e.payload.origin }, n.id);
                  if (t) {
                    W(s => [...s, e.payload]);
                    let s = await (0, m._d)();
                    S(a => [...a, ...l.map(a => ({ chain: s[a], payloadId: e.payload.payloadId }))]), K(!0);
                  } else
                    await M().runtime.sendMessage({
                      type: "chain-enabled",
                      payload: {
                        origin,
                        chainsIds: l,
                        payloadId: e.payload.payloadId,
                        ecosystem: e.payload.ecosystem,
                        ethMethod: e.payload.ethMethod,
                        isLeap: e.payload.isLeap
                      },
                      status: "success"
                    }),
                      (0, N.oj)() ? _("/home") : L();
                }
              },
              [_]
            );
            (0, b.useEffect)(
              () => (
                M().runtime.sendMessage({ type: "approval-popup-open" }),
                M().runtime.onMessage.addListener(Q),
                () => {
                  M().runtime.onMessage.removeListener(Q);
                }
              ),
              []
            );
            let ee = async () => {
              for await (let s of R) {
                var e;
                let a = s ? (null == s ? void 0 : s.validChainIds) ?? [null === (e = s[0]) || void 0 === e ? void 0 : e.chainId] : void 0;
                if (!a) return;
                let l = n.map(e => e.id);
                await (0, k.E)(a, l, s.origin),
                  await z({
                    type: "chain-enabled",
                    payload: { origin, chainsIds: a, payloadId: s.payloadId, ecosystem: s.ecosystem, ethMethod: s.ethMethod, isLeap: s.isLeap },
                    status: "success"
                  });
              }
              window.removeEventListener("beforeunload", B), (0, N.oj)() ? _("/home") : L();
            };
            (0, x.$)({
              page: "approve-connection",
              queryStatus: V ? "success" : "loading",
              op: "approveConnectionPageLoad",
              description: "Load time for approve connection page"
            });
            let es = (null == R ? void 0 : null === (e = R[0]) || void 0 === e ? void 0 : e.origin) || "Connect Leap",
              ea = (0, y.G)(es);
            return (null == Z ? void 0 : Z.watchWallet)
              ? (0, l.jsxs)("div", {
                  className: "h-full",
                  children: [
                    (0, l.jsx)(c.og, { subTitle: es, title: "Connect wallet", logo: ea || F, children: (0, l.jsx)(E.Z, {}) }),
                    (0, l.jsx)("div", {
                      className: " w-full mt-auto [&>*]:flex-1 sticky bottom-0 bg-secondary-50 p-6",
                      children: (0, l.jsx)(u.zx, {
                        variant: "secondary",
                        className: "w-full mt-auto",
                        onClick: B,
                        "aria-label": "cancel button in approve connection flow",
                        children: (0, l.jsx)("span", { "aria-label": "cancel button text in approve connection flow", children: "Cancel" })
                      })
                    })
                  ]
                })
              : V
                ? (0, l.jsxs)("div", {
                    className: "h-full",
                    children: [
                      (0, l.jsxs)(c.og, {
                        logo: ea || F,
                        subTitle: es,
                        title: 1 === X.chains.length ? `Connect wallet for ${(0, I.kC)(X.chains[0].chain)}` : "Connect wallet",
                        children: [
                          (0, l.jsxs)("div", {
                            className: "flex flex-col bg-secondary-100 rounded-2xl py-5 px-4",
                            children: [
                              (0, l.jsxs)("div", {
                                className: "flex items-center justify-between gap-4 ",
                                children: [
                                  (0, l.jsxs)("div", {
                                    className: "flex flex-col gap-2 bg-secondary-100",
                                    children: [
                                      (0, l.jsxs)("span", { className: "text-sm text-muted-foreground font-medium", children: ["Connecting ", H] }),
                                      "address" === X.type
                                        ? (0, l.jsx)("span", { className: "text-md font-bold", children: (0, t.Hnh)(X.address) })
                                        : "chains" === X.type && 1 === X.chains.length
                                          ? (0, l.jsx)("span", {
                                              className: "text-md font-bold",
                                              children: (0, t.Hnh)(
                                                null == n
                                                  ? void 0
                                                  : null === (a = n[0]) || void 0 === a
                                                    ? void 0
                                                    : null === (s = a.addresses) || void 0 === s
                                                      ? void 0
                                                      : s[X.chains[0].chain]
                                              )
                                            })
                                          : null
                                    ]
                                  }),
                                  "address" === X.type || ("chains" === X.type && 1 === X.chains.length)
                                    ? (0, l.jsx)("img", { src: (0, g.getWalletIconAtIndex)(0), className: "size-12" })
                                    : null,
                                  X.chains.length > 3
                                    ? (0, l.jsx)("span", {
                                        className: "text-xs font-medium text-accent-green cursor-pointer",
                                        onClick: () => {
                                          D(e => !e);
                                        },
                                        children: T ? "View less" : `View more (${X.chains.length})`
                                      })
                                    : null
                                ]
                              }),
                              (0, l.jsx)("div", {
                                className: "flex flex-col",
                                children:
                                  "chains" === X.type &&
                                  X.chains.length > 1 &&
                                  X.chains.slice(0, T ? void 0 : 3).map((e, s, a) => {
                                    var i, o, d, c;
                                    let r = s === a.length - 1;
                                    return (0, l.jsxs)(l.Fragment, {
                                      children: [
                                        (0, l.jsxs)(
                                          "div",
                                          {
                                            className: (0, j.cn)("flex w-full", { "pt-1": 0 === s, "my-4": !r, "mt-4": r }),
                                            children: [
                                              (0, l.jsx)("img", {
                                                src: (null === (i = q[e.chain]) || void 0 === i ? void 0 : i.chainSymbolImageUrl) ?? F,
                                                className: "size-4 rounded-full mr-3"
                                              }),
                                              (0, l.jsxs)("div", {
                                                className: "flex w-full items-center justify-between",
                                                children: [
                                                  (0, l.jsx)("span", {
                                                    className: "text-xs text-foreground font-medium",
                                                    children: null === (o = q[e.chain]) || void 0 === o ? void 0 : o.chainName
                                                  }),
                                                  (0, l.jsx)("span", {
                                                    className: "text-xs text-muted-foreground font-medium",
                                                    children: (0, t.Hnh)(
                                                      (null == n
                                                        ? void 0
                                                        : null === (c = n[0]) || void 0 === c
                                                          ? void 0
                                                          : null === (d = c.addresses) || void 0 === d
                                                            ? void 0
                                                            : d[e.chain]) ?? ""
                                                    )
                                                  })
                                                ]
                                              })
                                            ]
                                          },
                                          e.chain
                                        ),
                                        r ? null : (0, l.jsx)("div", { className: "h-[1px] w-full bg-secondary-200" })
                                      ]
                                    });
                                  })
                              })
                            ]
                          }),
                          (0, l.jsxs)("div", {
                            className: "flex flex-col gap-4 rounded-xl p-5 bg-secondary-100 text-xs text-muted-foreground font-medium",
                            children: [
                              (0, l.jsx)("span", { children: "This app will be able to" }),
                              (0, l.jsxs)("span", {
                                className: "flex flex-col gap-3",
                                children: [
                                  (0, l.jsxs)("span", {
                                    className: "flex items-center gap-2",
                                    children: [
                                      (0, l.jsx)(o.J, { size: 16, weight: "bold", className: "my-0.5 text-accent-green" }),
                                      "View your wallet balance and activity"
                                    ]
                                  }),
                                  (0, l.jsxs)("span", {
                                    className: "flex items-center gap-2",
                                    children: [
                                      (0, l.jsx)(o.J, { size: 16, weight: "bold", className: "my-0.5 text-accent-green" }),
                                      "Request approval for transactions"
                                    ]
                                  })
                                ]
                              }),
                              (0, l.jsx)("div", { className: "my-1 border-[0.05px] border-solid border-secondary-250 opacity-50" }),
                              (0, l.jsx)("span", { className: "text-xs text-muted-foreground font-medium", children: "This app won't be able to" }),
                              (0, l.jsxs)("span", {
                                className: "flex items-center gap-2",
                                children: [
                                  (0, l.jsx)(d.X, { size: 16, weight: "bold", className: "my-0.5 text-destructive-100" }),
                                  "Move funds without your permission"
                                ]
                              })
                            ]
                          })
                        ]
                      }),
                      (0, l.jsxs)("div", {
                        className: "flex items-center justify-center w-full gap-3 mt-auto [&>*]:flex-1 sticky bottom-0 bg-secondary-50 p-6",
                        children: [
                          (0, l.jsx)(u.zx, {
                            variant: "mono",
                            onClick: B,
                            "aria-label": "cancel button in approve connection flow",
                            children: (0, l.jsx)("span", { "aria-label": "cancel button text in approve connection flow", children: "Cancel" })
                          }),
                          (0, l.jsx)(u.zx, {
                            onClick: ee,
                            disabled: n.length <= 0,
                            "aria-label": "connect button in approve connection flow",
                            children: (0, l.jsx)("span", { "aria-label": "connect button text in approve connection flow", children: "Connect" })
                          })
                        ]
                      })
                    ]
                  })
                : (0, l.jsx)("div", {
                    className: "panel-height enclosing-panel relative w-screen max-w-3xl h-full self-center p-5 pt-0",
                    children: (0, l.jsx)(r.Z, {})
                  });
          };
          n();
        } catch (e) {
          n(e);
        }
      });
    },
    37124: function (e, s, a) {
      a.d(s, { Z: () => t });
      var n = a(52322),
        l = a(66070);
      function t() {
        return (0, n.jsx)(n.Fragment, {
          children: (0, n.jsxs)("div", {
            className: "flex flex-col gap-4 items-center rounded-xl bg-secondary-100 px-4 py-12 border border-border-bottom my-auto",
            children: [
              (0, n.jsxs)("div", {
                className: "relative bg-accent-green-200 rounded-full p-4 flex items-center justify-center",
                children: [(0, n.jsx)(l.t, { className: "size-8" }), " "]
              }),
              " ",
              (0, n.jsxs)("div", {
                className: "flex flex-col gap-2 items-center",
                children: [
                  (0, n.jsx)("span", { className: "text-lg font-medium", children: "You are watching this wallet." }),
                  (0, n.jsx)("span", {
                    className: "text-sm text-muted-foreground text-center font-medium",
                    children: "Import the wallet using your recovery phrase to manage assets and sign transactions."
                  })
                ]
              })
            ]
          })
        });
      }
      a(2784);
    }
  }
]);
//# sourceMappingURL=4564.js.map
