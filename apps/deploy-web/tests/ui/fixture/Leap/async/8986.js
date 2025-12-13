!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      n = new e.Error().stack;
    n &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[n] = "77b5bafc-2d1b-4a74-9aad-f0634a310021"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-77b5bafc-2d1b-4a74-9aad-f0634a310021"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.23.1" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["8986"],
  {
    60143: function (e, n, o) {
      o.a(e, async function (e, a) {
        try {
          o.r(n), o.d(n, { default: () => w });
          var r = o(52322),
            t = o(41172),
            i = o(15969),
            s = o(43069),
            l = o(92642),
            c = o(36549),
            d = o(19623),
            m = o(91486),
            u = o(75958),
            f = o(53299),
            g = o(2784),
            b = o(10289),
            h = o(78344),
            x = o(42799),
            v = o(48346),
            y = o(30809),
            p = o(53345),
            k = o(23163),
            D = e([v]);
          v = (D.then ? (await D)() : D)[0];
          let _ = (0, u.Pi)(e => {
            var n;
            let {
                betaCW20DenomsStore: o,
                betaERC20DenomsStore: a,
                betaNativeDenomsStore: u,
                activeChainStore: f,
                rootDenomsStore: h,
                selectedNetworkStore: x,
                rootBalanceStore: v,
                enabledCW20DenomsStore: y
              } = e,
              D = (0, b.s0)(),
              w = (0, b.TH)().state,
              _ = (0, t.DI5)(),
              C = f.activeChain,
              M = h.allDenoms,
              j = x.selectedNetwork,
              [E, N] = (0, g.useState)({ name: "", coinDenom: "", coinMinimalDenom: "", coinDecimals: "", coinGeckoId: "", icon: "", chain: C }),
              [S, T] = (0, g.useState)(!1),
              [I, W] = (0, g.useState)(!1),
              [A, L] = (0, g.useState)(!1),
              [O, B] = (0, g.useState)(!1),
              [R, Z] = (0, g.useState)({}),
              [G, U] = (0, g.useState)(!1),
              { name: $, coinDenom: X, coinMinimalDenom: z, coinDecimals: F, coinGeckoId: H, icon: J, chain: P } = E,
              { lcdUrl: Y, evmJsonRpc: q } = (0, t.U9i)(),
              K = (0, t.xxU)(C, j, !0),
              Q = (0, g.useRef)(null),
              V = y.getEnabledCW20DenomsForChain(C),
              ee = (0, g.useCallback)(
                async e => {
                  var n;
                  let o = e.currentTarget.value.trim();
                  if (!o && o.toLowerCase().startsWith("ibc/")) return;
                  B(!0), T(!1), W(!1);
                  let a = !1;
                  try {
                    let e = await (0, i.bt3)(C, "testnet" === j);
                    if (e && e.assets)
                      for (let n of e.assets) {
                        let e = n.denom.trim(),
                          r = !1;
                        if (
                          e &&
                          (e.startsWith("cw20:") && ((r = !0), (e = e.slice(5))),
                          o.startsWith("cw20:") && (o = o.slice(5)),
                          e.toLowerCase() === o.toLowerCase())
                        ) {
                          let { name: o, symbol: t, image: i, decimals: s, coingecko_id: l } = n;
                          (a = !0),
                            r ? T(!0) : T(!1),
                            N(n => ({ ...n, name: o, coinDenom: t, coinMinimalDenom: e, coinDecimals: String(s), coinGeckoId: l, icon: i }));
                          break;
                        }
                      }
                  } catch (e) {
                    (0, l.Tb)(e, {
                      tags: { errorType: "add_token_error", source: "add_token", severity: "error", errorName: e instanceof Error ? e.name : "AddTokenError" },
                      fingerprint: ["add_token", "add_token_error"],
                      level: "error",
                      contexts: { transaction: { type: "add_token", errorMessage: e instanceof Error ? e.message : String(e) } }
                    });
                  }
                  if (!1 === a)
                    try {
                      let e = await (0, p.s)(Y ?? "", o);
                      "string" != typeof e && e.symbol
                        ? ((a = !0), T(!0), N(n => ({ ...n, name: e.name, coinDenom: e.symbol, coinDecimals: e.decimals, coinMinimalDenom: o })))
                        : T(!1);
                    } catch (e) {
                      T(!1),
                        (0, l.Tb)(e, {
                          tags: {
                            errorType: "add_token_error",
                            source: "add_token",
                            severity: "error",
                            errorName: e instanceof Error ? e.name : "AddTokenError"
                          },
                          fingerprint: ["add_token", "add_token_error"],
                          level: "error",
                          contexts: { transaction: { type: "add_token", errorMessage: e instanceof Error ? e.message : String(e) } },
                          extra: { coinMinimalDenom: o, lcdUrl: Y }
                        });
                    }
                  if (!1 === a && (null === (n = _[C]) || void 0 === n ? void 0 : n.evmOnlyChain))
                    try {
                      let e = await (0, i.d_E)(o, q ?? "", Number(K));
                      (a = !0), W(!0), N(n => ({ ...n, name: e.name, coinDenom: e.symbol, coinDecimals: String(e.decimals), coinMinimalDenom: o }));
                    } catch (e) {
                      W(!1),
                        (0, l.Tb)(e, {
                          tags: {
                            errorType: "add_token_error",
                            source: "add_token",
                            severity: "error",
                            errorName: e instanceof Error ? e.name : "AddTokenError"
                          },
                          fingerprint: ["add_token", "add_token_error"],
                          level: "error",
                          contexts: { transaction: { type: "add_token", errorMessage: e instanceof Error ? e.message : String(e) } },
                          extra: { coinMinimalDenom: o, evmJsonRpc: q, evmChainId: K }
                        });
                    }
                  if (!1 === a && ["mainCoreum", "coreum"].includes(P))
                    try {
                      let { symbol: e, precision: n } = await (0, t.yaX)(Y ?? "", o);
                      (a = !0), N(a => ({ ...a, coinDenom: e, coinMinimalDenom: o, coinDecimals: n }));
                    } catch (e) {
                      (0, l.Tb)(e, {
                        tags: {
                          errorType: "add_token_error",
                          source: "add_token",
                          severity: "error",
                          errorName: e instanceof Error ? e.name : "AddTokenError"
                        },
                        fingerprint: ["add_token", "add_token_error"],
                        level: "error",
                        contexts: { transaction: { type: "add_token", errorMessage: e instanceof Error ? e.message : String(e) } },
                        extra: { coinMinimalDenom: o, lcdUrl: Y }
                      });
                    }
                  L(a), B(!1);
                },
                [_, C, P, j, Y, q, K]
              ),
              en = (0, g.useCallback)(
                e => {
                  let { name: n, value: o } = e.currentTarget,
                    a = "";
                  if (o) {
                    if ("coinMinimalDenom" === n) {
                      var r, t;
                      let e = o.trim().toLowerCase();
                      Object.keys(M)
                        .map(e => e.toLowerCase())
                        .includes(e)
                        ? (a = "Token with same minimal denom already exists")
                        : (null === (r = _[C]) || void 0 === r ? void 0 : r.evmOnlyChain) && !(0, i.Ohs)(e)
                          ? (a = "Invalid contract address")
                          : !(null === (t = _[C]) || void 0 === t ? void 0 : t.evmOnlyChain) && (e.startsWith("erc20/") || (0, i.Ohs)(e))
                            ? (a = "We don't support adding erc20 token yet.")
                            : e.startsWith("ibc/") && (a = "We don't support adding ibc token yet.");
                    } else "coinDecimals" === n && (0, k.W)(o) ? (a = "Incorrect decimal value") : "icon" === n && (0, k.S)(o) && (a = "Invalid Icon URL");
                  }
                  a ? Z(e => ({ ...e, [n]: a })) : R[n] && (delete R[n], Z(R)), N(e => ({ ...e, [n]: o.trim() }));
                },
                [C, _, M, R]
              );
            (0, g.useEffect)(() => {
              w && w.coinMinimalDenom && en({ currentTarget: { name: "coinMinimalDenom", value: w.coinMinimalDenom } });
            }, [w]),
              (0, g.useEffect)(() => {
                Q.current && Q.current.focus();
              }, []);
            let eo = (0, g.useCallback)(async () => {
                U(!0);
                let e = { ...E, coinDecimals: Number(E.coinDecimals) };
                e.name || (e.name = void 0),
                  S
                    ? await o.setBetaCW20Denoms(E.coinMinimalDenom, e, P)
                    : I
                      ? await a.setBetaERC20Denoms(E.coinMinimalDenom, e, P)
                      : await u.setBetaNativeDenoms(E.coinMinimalDenom, e, P);
                let n = [...V, E.coinMinimalDenom];
                await y.setEnabledCW20Denoms(n, C), v.refetchBalances(), U(!1), D("/");
              }, [C, o, a, u, P, y, V, S, I, D, v, E]),
              ea = (0, g.useMemo)(() => !O && !A && z && !R.coinMinimalDenom, [O, A, z, R]),
              er = (0, g.useMemo)(
                () => !X || !z || !F || G || O || !!R.coinMinimalDenom || !!R.coinDenom || !!R.coinDecimals || !!R.coinGeckoId || !!R.name || !!R.icon,
                [X, z, F, G, O, R]
              ),
              { coinMinimalDenomPlaceholder: et, coinDenomPlaceholder: ei } = (0, g.useMemo)(() => {
                var e;
                let n = "Coin minimal denom (ex: juno1...5awr)",
                  o = "Coin denom (ex: NETA)";
                return (
                  (null === (e = _[C]) || void 0 === e ? void 0 : e.evmOnlyChain) && ((n = "Contract address (ex: 0x...)"), (o = "Symbol (ex: PYTH)")),
                  { coinMinimalDenomPlaceholder: n, coinDenomPlaceholder: o }
                );
              }, [C, _]);
            return (0, r.jsxs)(r.Fragment, {
              children: [
                (0, r.jsxs)("form", {
                  className: "mx-auto w-[344px] mb-5 pb-6 overflow-y-auto h-[calc(100%-66px)]",
                  children: [
                    (0, r.jsxs)("div", {
                      className: "rounded-lg w-full flex items-center h-[56px] p-4 bg-secondary-100 my-6 gap-x-[10px]",
                      children: [
                        (0, r.jsx)(s.C, { className: "text-secondary-100 bg-accent-yellow rounded-full h-5 w-5 p-[2px]" }),
                        (0, r.jsx)("div", { className: "font-medium text-foreground text-sm !leading-[22px]", children: "Only add tokens you trust." })
                      ]
                    }),
                    (0, r.jsx)(c.a, {
                      placeholder: et,
                      value: z,
                      name: "coinMinimalDenom",
                      onChange: en,
                      error: R.coinMinimalDenom,
                      warning: ea
                        ? `Make sure the coin minimal denom is correct and it belongs to ${null === (n = _[C]) || void 0 === n ? void 0 : n.chainName} chain`
                        : "",
                      onBlur: ee,
                      ref: Q
                    }),
                    (0, r.jsx)(c.a, { placeholder: ei, value: X, name: "coinDenom", onChange: en, error: R.coinDenom }),
                    (0, r.jsx)(c.a, { placeholder: "Coin decimals (ex: 6)", value: F, name: "coinDecimals", onChange: en, error: R.coinDecimals }),
                    (0, r.jsx)(c.a, { placeholder: "Token name (optional)", value: $, name: "name", onChange: en, error: R.name }),
                    (0, r.jsx)(c.a, { placeholder: "Coin gecko id (optional)", value: H, name: "coinGeckoId", onChange: en, error: R.coinGeckoId }),
                    (0, r.jsx)(c.a, { placeholder: "Icon url (optional)", value: J, name: "icon", onChange: en, error: R.icon })
                  ]
                }),
                (0, r.jsx)("div", {
                  className: "absolute bottom-0 left-0 right-0 p-4 bg-secondary-100 backdrop-blur-xl",
                  children:
                    O || G
                      ? (0, r.jsx)("div", { className: "h-[44px]", children: (0, r.jsx)(d.Z, {}) })
                      : (0, r.jsx)(m.zx, {
                          className: "rounded-full w-full font-bold text-sm !leading-5 text-gray-900 dark:text-white-100 h-11 !bg-primary",
                          type: "submit",
                          disabled: er,
                          onClick: eo,
                          children: "Add token"
                        })
                })
              ]
            });
          });
          function w() {
            return (0, r.jsxs)("div", {
              className: "bg-secondary-50 flex flex-col h-full",
              children: [
                (0, r.jsx)(f.Z, { title: "Add Token" }),
                (0, r.jsx)("div", {
                  className: "panel-width px-6 flex-1 overflow-y-hidden relative",
                  children: (0, r.jsx)(_, {
                    selectedNetworkStore: y.i,
                    betaCW20DenomsStore: x.Xy,
                    betaERC20DenomsStore: x.EM,
                    betaNativeDenomsStore: x.vk,
                    activeChainStore: h.J,
                    rootDenomsStore: x.gb,
                    rootBalanceStore: v.jZ,
                    enabledCW20DenomsStore: x.bI
                  })
                })
              ]
            });
          }
          a();
        } catch (e) {
          a(e);
        }
      });
    },
    53299: function (e, n, o) {
      o.d(n, { Z: () => l });
      var a = o(52322),
        r = o(43166),
        t = o(85027),
        i = o(69816);
      o(2784);
      var s = o(10289);
      let l = e => {
        let { title: n, onBack: o } = e,
          l = (0, s.s0)();
        return (0, a.jsxs)(t.m, {
          className: "bg-secondary-50 border-b border-secondary-300",
          children: [
            (0, a.jsx)(r.X, {
              className: "size-9 p-2 cursor-pointer text-muted-foreground hover:text-foreground",
              onClick: () => {
                o ? o() : l(-1);
              }
            }),
            (0, a.jsx)(i.Z, { className: "text-[18px] font-bold !leading-6", color: "text-monochrome", children: n ?? "Manage tokens" }),
            (0, a.jsx)("div", { className: "w-9 h-9" })
          ]
        });
      };
    },
    53345: function (e, n, o) {
      o.d(n, { s: () => t });
      var a = o(55334),
        r = o(48834).Buffer;
      async function t(e, n) {
        let o = `${e}/cosmwasm/wasm/v1/contract/${n}/smart/${r.from('{"token_info":{}}').toString("base64")}`,
          { data: t } = await a.Z.get(o);
        return t.error && t.error.toLowerCase().includes("decoding bech32 failed") ? "Invalid Contract Address" : t.data;
      }
    }
  }
]);
//# sourceMappingURL=8986.js.map
