!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "d2e93d4a-c77c-4ef8-929d-aeb58842efcf"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-d2e93d4a-c77c-4ef8-929d-aeb58842efcf"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.22.9" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["3672"],
  {
    63400: function (e, t, n) {
      n.d(t, { u: () => l });
      var a = n(52322),
        i = n(71769);
      n(2784);
      var s = n(70514);
      function l(e) {
        let { className: t } = e;
        return (0, a.jsxs)("div", {
          className: (0, s.cn)("w-full flex flex-row items-start px-4 py-3 justify-start dark:bg-red-900 bg-red-100 rounded-2xl", t),
          children: [
            (0, a.jsx)(i.v, { weight: "fill", size: 20, className: "mr-2 text-destructive-100 p-[2px]" }),
            (0, a.jsxs)("div", {
              children: [
                (0, a.jsx)("p", { className: "text-sm text-foreground font-bold !leading-[20px]", children: "Unable to connect to ledger device" }),
                (0, a.jsx)("p", {
                  className: "text-xs text-secondary-800 font-medium !leading-[19px] mt-1",
                  children: "Please check if your ledger is connected and try again."
                })
              ]
            })
          ]
        });
      }
    },
    57767: function (e, t, n) {
      n.d(t, { Z: () => o });
      var a = n(52322),
        i = n(14281);
      n(2784);
      var s = n(86376),
        l = n(69816);
      function o(e) {
        let { showLedgerPopup: t, onClose: n } = e;
        return (0, a.jsx)(i.Z, {
          isOpen: t,
          onClose: n,
          title: "Confirm on Ledger",
          children: (0, a.jsxs)("div", {
            className: "flex flex-col items-center",
            children: [
              (0, a.jsx)("div", { className: "my-10", children: (0, a.jsx)(s.Z, {}) }),
              (0, a.jsx)(l.Z, { size: "md", className: "font-bold mb-7", children: "Approve transaction on your hardware wallet" })
            ]
          })
        });
      }
    },
    49728: function (e, t, n) {
      n.d(t, { U: () => d });
      var a = n(2784),
        i = n(10289),
        s = n(55736),
        l = n(48534),
        o = n(72565),
        r = n.n(o);
      let d = () => {
        let e = (0, i.s0)();
        return (0, a.useCallback)(async () => {
          let t = r().extension.getViews({ type: "popup" }),
            n = 0 === t.length && 600 === window.outerHeight && 400 === window.outerWidth,
            a = -1 !== t.findIndex(e => e === window);
          if (n || a || (0, l.oj)()) {
            if (!(0, l.oj)()) {
              let e = (await r().windows.getAll()).find(e => "popup" !== e.type);
              e && r().tabs.create({ url: r().runtime.getURL("index.html#/reconnect-ledger"), windowId: e.id }), window.close();
              return;
            }
            window.open("index.html#/reconnect-ledger", "_blank"), (0, s.I)();
          } else e("/reconnect-ledger");
        }, [e]);
      };
    },
    26409: function (e, t, n) {
      n.a(e, async function (e, a) {
        try {
          n.r(t), n.d(t, { default: () => w });
          var i = n(52322),
            s = n(84166),
            l = n(15969),
            o = n(74703),
            r = n(53108),
            d = n(79533),
            c = n(2784),
            u = n(10289),
            m = n(26245),
            g = n(42799),
            v = n(48346),
            x = n(72565),
            p = n.n(x),
            f = n(57895),
            h = n(56611),
            y = e([v, m, f]);
          [v, m, f] = y.then ? (await y)() : y;
          let w = (e => {
            let t = () => {
              let [t, n] = (0, c.useState)(null),
                [a, s] = (0, c.useState)(null),
                r = (0, c.useCallback)(async (e, t) => {
                  if (t.id === p().runtime.id && e.type === o.u.signTransaction) {
                    var a;
                    let i = e.payload,
                      o = (0, d.DY)(i.origin),
                      { chainKey: r = "ethereum", network: c = "mainnet" } = (await p().storage.local.get(o))[o] || {},
                      u = await (0, d.Hg)(),
                      m = u[r],
                      g = Number("testnet" === c ? (null == m ? void 0 : m.evmChainIdTestnet) : null == m ? void 0 : m.evmChainId);
                    s({ activeChain: r, activeNetwork: c });
                    let { evmJsonRpc: v } = (0, l.Nf9)(r, c, u);
                    if (null == i ? void 0 : null === (a = i.signTxnData) || void 0 === a ? void 0 : a.spendPermissionCapValue)
                      try {
                        let e;
                        try {
                          (e = await (0, l.d_E)(i.signTxnData.to, v ?? "", Number(g))),
                            (i.signTxnData.details = {
                              Permission: `This allows the third party to spend ${(0, l.DZ4)(i.signTxnData.spendPermissionCapValue, (null == e ? void 0 : e.decimals) ?? 18)} ${e.symbol} from your current balance.`,
                              ...i.signTxnData.details
                            });
                        } catch (t) {
                          console.error("Error fetching token details as ERC20 token, retrying as ERC721 token", t),
                            (e = await (0, l.mPt)(i.signTxnData.to, v ?? "", Number(g))),
                            (i.signTxnData.details = {
                              Permission: `This allows the third party to transfer your ${i.signTxnData.spendPermissionCapValue} ${e.symbol} token.`,
                              ...i.signTxnData.details
                            });
                        }
                      } catch (e) {
                        console.error("Error fetching token details", e);
                      }
                    n(e =>
                      (e = e ?? []).some(e => {
                        var t, n;
                        return (
                          (null == e ? void 0 : null === (t = e.origin) || void 0 === t ? void 0 : t.toLowerCase()) !==
                          (null == i ? void 0 : null === (n = i.origin) || void 0 === n ? void 0 : n.toLowerCase())
                        );
                      })
                        ? e
                        : [...e, { ...i, customId: `${t.id}-00${e.length}` }]
                    );
                  }
                }, []);
              return ((0, c.useEffect)(
                () => (
                  p().runtime.sendMessage({ type: o.u.signingPopupOpen }),
                  p().runtime.onMessage.addListener(r),
                  () => {
                    p().runtime.onMessage.removeListener(r);
                  }
                ),
                [r]
              ),
              null == t ? void 0 : t.length)
                ? (0, i.jsx)(e, { txnDataList: t, setTxnDataList: n, txOriginData: a })
                : (0, i.jsx)(f.gb, {});
            };
            return (t.displayName = `withSeiEvmTxnSigningRequest(${e.displayName})`), t;
          })(
            c.memo(function (e) {
              let { txnDataList: t, setTxnDataList: n, txOriginData: a } = e,
                l = (0, u.s0)(),
                [o, d] = (0, c.useState)(0);
              (0, c.useEffect)(
                () => (
                  window.addEventListener("beforeunload", () => {
                    var e;
                    return (0, h.B)(l, null === (e = t[0]) || void 0 === e ? void 0 : e.payloadId);
                  }),
                  p().storage.local.remove(r.u1),
                  () => {
                    window.removeEventListener("beforeunload", () => {
                      var e;
                      return (0, h.B)(l, null === (e = t[0]) || void 0 === e ? void 0 : e.payloadId);
                    });
                  }
                ),
                []
              );
              let x = e => {
                let a = t.filter(t => t.customId !== e);
                n(a), d(0);
              };
              return (0, i.jsx)(i.Fragment, {
                children: t.map((e, n) => {
                  if (n !== o) return null;
                  switch (e.signTxnData.methodType) {
                    case s.JY.PERSONAL_SIGN:
                    case s.JY.ETH__SIGN:
                    case s.JY.ETH__SIGN_TYPED_DATA_V4:
                      return (0, i.jsx)(f.bl, { txnData: e, donotClose: t.length > 1, handleTxnListUpdate: () => x(e.customId) }, e.customId);
                  }
                  return (0, i.jsx)(
                    f.E4,
                    {
                      activeChain: a.activeChain,
                      activeNetwork: a.activeNetwork,
                      txnData: e,
                      rootDenomsStore: g.gb,
                      rootBalanceStore: v.jZ,
                      unifiedEvmBalanceStore: m.g5,
                      donotClose: t.length > 1,
                      handleTxnListUpdate: () => x(e.customId),
                      activeIndex: o,
                      setActiveIndex: d,
                      limit: t.length
                    },
                    e.customId
                  );
                })
              });
            })
          );
          a();
        } catch (e) {
          a(e);
        }
      });
    },
    74210: function (e, t, n) {
      n.d(t, { g: () => s });
      var a = n(52322),
        i = n(19623);
      function s() {
        return (0, a.jsx)("div", { className: "h-full w-full flex flex-col gap-4 items-center justify-center", children: (0, a.jsx)(i.T, { color: "white" }) });
      }
      n(2784);
    },
    6876: function (e, t, n) {
      n.a(e, async function (e, a) {
        try {
          n.d(t, { b: () => L });
          var i = n(52322),
            s = n(41172),
            l = n(84166),
            o = n(15969),
            r = n(71696),
            d = n.n(r),
            c = n(79215),
            u = n(86200),
            m = n(63400),
            g = n(57767),
            v = n(19623),
            x = n(91486),
            p = n(23259),
            f = n(74703),
            h = n(4370),
            y = n(74229),
            w = n(49728),
            b = n(78935),
            T = n(65027),
            j = n(2784),
            D = n(10289),
            S = n(12499),
            N = n(48534),
            E = n(46338),
            _ = n(43963),
            C = n(72565),
            I = n.n(C),
            k = n(56611),
            P = e([T]);
          let M = (T = (P.then ? (await P)() : P)[0]).w.useGetWallet;
          function L(e) {
            let { txnData: t, donotClose: n, handleTxnListUpdate: a } = e,
              r = (0, s.h8K)(),
              T = (0, s.rTu)(),
              C = (0, D.s0)();
            d()(null !== T, "activeWallet is null");
            let P = null == t ? void 0 : t.origin,
              L = (0, b.G)(P),
              A = (0, y.a1)(),
              G = M(),
              [B, O] = (0, j.useState)("idle"),
              [Z, U] = (0, j.useState)(null),
              [F, R] = (0, j.useState)(!1),
              J = (0, w.U)(),
              { chains: W } = (0, s._IL)(),
              z = W[r],
              $ = (0, j.useMemo)(() => (0, S.h)(Z), [Z]),
              H = async () => {
                try {
                  let e;
                  if ($) {
                    await (0, k.B)(C, null == t ? void 0 : t.payloadId, !0), J();
                    return;
                  }
                  if (T.walletType === s._KQ.LEDGER) {
                    if ((null == z ? void 0 : z.evmOnlyChain) === !0) R(!0);
                    else throw Error(p.tR);
                  }
                  U(null), O("loading");
                  let i = await G(r, !0);
                  e =
                    t.signTxnData.methodType === l.JY.ETH__SIGN_TYPED_DATA_V4
                      ? await (0, o.xqy)(t.signTxnData.data, T.addresses[r], i)
                      : await (0, o.W0A)(t.signTxnData.data, T.addresses[r], i);
                  try {
                    await I().runtime.sendMessage({
                      type: f.u.signSeiEvmResponse,
                      payloadId: null == t ? void 0 : t.payloadId,
                      payload: { status: "success", data: e }
                    });
                  } catch {
                    throw Error("Could not send transaction to the dApp");
                  }
                  n ? a() : (0, N.oj)() ? C("/home") : window.close();
                } catch (e) {
                  O("error"), U(e.message);
                }
              },
              K = (!!Z && !$) || "loading" === B;
            return (0, i.jsxs)("div", {
              className: "h-full",
              children: [
                (0, i.jsxs)(c.og, {
                  className: "bg-secondary-50",
                  title: "Signature request",
                  subTitle: P || "Unknown site",
                  logo: L || A,
                  children: [
                    (0, i.jsxs)("div", {
                      className: "flex flex-col gap-3 p-4 rounded-xl border border-secondary-200 bg-secondary-50",
                      children: [
                        (0, i.jsx)("span", { className: "text-muted-foreground text-xs font-medium", children: "Data" }),
                        (0, i.jsx)(h.E.pre, {
                          transition: E._M,
                          variants: _.dJ,
                          initial: "enter",
                          animate: "animate",
                          exit: "enter",
                          className: "text-xs  w-full text-wrap break-words",
                          children:
                            t.signTxnData.details.Message && "object" != typeof t.signTxnData.details.Message
                              ? t.signTxnData.details.Message
                              : JSON.stringify(t.signTxnData.details, (e, t) => ("bigint" == typeof t ? t.toString() : t), 2)
                        })
                      ]
                    }),
                    !$ && Z && "error" === B ? (0, i.jsx)(u._, { text: Z, className: "mt-3" }) : null,
                    $ && "error" === B ? (0, i.jsx)(m.u, { className: "mt-3" }) : null,
                    "error" !== B && F ? (0, i.jsx)(g.Z, { showLedgerPopup: F, onClose: () => R(!1) }) : null
                  ]
                }),
                (0, i.jsxs)("div", {
                  className: "flex items-center justify-center w-full gap-3 mt-auto [&>*]:flex-1 sticky bottom-0 p-6 bg-secondary-50",
                  children: [
                    (0, i.jsx)(x.zx, {
                      variant: "mono",
                      onClick: () => {
                        (0, k.B)(C, null == t ? void 0 : t.payloadId, n), n && a();
                      },
                      disabled: "loading" === B,
                      "aria-label": "sei evm dapp reject button in sign sei evm message signature flow",
                      children: (0, i.jsx)("span", {
                        "aria-label": "sei evm dapp reject button text in sign sei evm message signature flow",
                        children: "Reject"
                      })
                    }),
                    (0, i.jsx)(x.zx, {
                      onClick: H,
                      disabled: K,
                      className: `${K ? "cursor-not-allowed opacity-50" : ""}`,
                      "aria-label": "sei evm dapp sign button in sign sei evm message signature flow",
                      children: $
                        ? "Connect Ledger"
                        : "loading" === B
                          ? (0, i.jsx)(v.T, { color: "white" })
                          : (0, i.jsx)("span", { "aria-label": "sei evm dapp sign button text in sign sei evm message signature flow", children: "Sign" })
                    })
                  ]
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
    53338: function (e, t, n) {
      n.a(e, async function (e, a) {
        try {
          n.d(t, { E: () => B });
          var i = n(52322),
            s = n(33569),
            l = n(41172),
            o = n(15969),
            r = n(44658),
            d = n(92642),
            c = n(60431),
            u = n(6391),
            m = n.n(u),
            g = n(79215),
            v = n(86200),
            x = n(58885),
            p = n(57767),
            f = n(19623),
            h = n(91486),
            y = n(23259),
            w = n(74703),
            b = n(74229),
            T = n(78935),
            j = n(65027),
            D = n(75958),
            S = n(2784),
            N = n(10289),
            E = n(44818),
            _ = n(48534),
            C = n(37906),
            I = n(72565),
            k = n.n(I),
            P = n(56611),
            L = n(57895),
            M = n(62360),
            A = e([j, L, x, M]);
          [j, L, x, M] = A.then ? (await A)() : A;
          let G = j.w.useGetWallet,
            B = (0, D.Pi)(e => {
              var t;
              let {
                  txnData: n,
                  rootDenomsStore: a,
                  rootBalanceStore: u,
                  unifiedEvmBalanceStore: j,
                  donotClose: D,
                  handleTxnListUpdate: I,
                  activeChain: A,
                  activeNetwork: B,
                  activeIndex: O,
                  setActiveIndex: Z,
                  limit: U
                } = e,
                F = G(A),
                { addressLinkState: R } = (0, l.uaF)(A),
                J = j.evmBalanceForChain(A, B, void 0),
                W = (0, l.QSC)(A),
                z = (0, l.rTu)(),
                $ = u.getBalancesForChain(A, B, void 0),
                [H, K] = (0, S.useState)(!1),
                V = (0, S.useMemo)(() => {
                  let e = $;
                  return (0, l.hI9)(!1, R, (null == W ? void 0 : W.evmOnlyChain) ?? !1) && (e = [...e, ...(J ?? [])].filter(e => new (m())(e.amount).gt(0))), e;
                }, [R, $, null == W ? void 0 : W.evmOnlyChain, J]),
                Y = (0, S.useMemo)(
                  () =>
                    (V ?? []).some(
                      e => (null == e ? void 0 : e.isEvm) && ((null == e ? void 0 : e.coinMinimalDenom) === "usei" || (null == W ? void 0 : W.evmOnlyChain))
                    ),
                  [V, null == W ? void 0 : W.evmOnlyChain]
                );
              (0, E.h)(null !== z, "activeWallet is null");
              let q = (0, l.FmJ)(),
                Q = l.rNU.useLogCosmosDappTx(),
                X = (0, N.s0)(),
                ee = (0, l.SFn)(A),
                et = (0, l.xxU)(A, B, !0),
                { evmJsonRpc: en } = (0, l.U9i)(A, B),
                ea = (0, x.e7)(a.allDenoms, { activeChain: A, isSeiEvmTransaction: !0 }),
                { status: ei } = (0, l.CIk)(A, B),
                [es, el] = (0, S.useState)("idle"),
                [eo, er] = (0, S.useState)(""),
                [ed, ec] = (0, S.useState)(null),
                [eu, em] = (0, S.useState)(null),
                eg = (0, l.dco)(),
                ev = (0, l._ty)(A),
                ex = (0, S.useMemo)(() => {
                  var e;
                  return parseInt((((null === (e = eg[A]) || void 0 === e ? void 0 : e.DEFAULT_GAS_IBC) ?? o.N7W.DEFAULT_GAS_IBC) * ev).toString());
                }, [A, eg, ev]),
                [ep, ef] = (0, S.useState)({ gasPrice: ea.gasPrice, option: l.j1p.LOW }),
                eh = null == n ? void 0 : n.origin,
                ey = (0, T.G)(eh),
                ew = (0, b.a1)(),
                eb = (0, l.bkk)(a.allDenoms, A, B),
                eT = (0, S.useMemo)(() => {
                  if (eb) return (V ?? []).find(e => (null == e ? void 0 : e.coinMinimalDenom) === eb.coinMinimalDenom);
                }, [V, eb]);
              (0, S.useEffect)(() => {
                u.loadBalances(A, B);
              }, [A, B]);
              let { data: ej, isLoading: eD } = (0, c.useQuery)({
                queryKey: [
                  A,
                  null == z ? void 0 : z.pubKeys,
                  ex,
                  en,
                  ev,
                  n.signTxnData.data,
                  n.signTxnData.gas,
                  n.signTxnData.params,
                  n.signTxnData.to,
                  n.signTxnData.value
                ],
                queryFn: async function () {
                  var e, t;
                  if (null == n ? void 0 : null === (e = n.signTxnData) || void 0 === e ? void 0 : e.gas) return Math.ceil(Number(n.signTxnData.gas) * ev);
                  try {
                    let e = ex;
                    if (n.signTxnData.params) {
                      let t = await o.kZr.ExecuteEthEstimateGas(n.signTxnData.params, en);
                      e = Math.ceil(Number(t) * ev);
                    } else {
                      let a = r.SZ.getEvmAddress(null == z ? void 0 : null === (t = z.pubKeys) || void 0 === t ? void 0 : t[A]);
                      (e = await o.kZr.SimulateTransaction(n.signTxnData.to, n.signTxnData.value, en, n.signTxnData.data, void 0, a)),
                        (e = Math.ceil(Number(e) * ev));
                    }
                    return e;
                  } catch (e) {
                    return ex;
                  }
                },
                initialData: ex
              });
              (0, S.useEffect)(() => {
                function e() {
                  (null == ed ? void 0 : ed.includes("Insufficient funds to cover gas and transaction amount.")) && ec("");
                }
                !(async function () {
                  var t;
                  if ("loading" === ei || !(null == ep ? void 0 : null === (t = ep.gasPrice) || void 0 === t ? void 0 : t.amount)) {
                    e();
                    return;
                  }
                  let a = n.signTxnData.value,
                    i = new (m())(eo || ej).multipliedBy(ep.gasPrice.amount.toString()),
                    l = Number((null == eT ? void 0 : eT.coinDecimals) ?? 18);
                  if (
                    eT &&
                    a &&
                    0 !== Number(a) &&
                    i.plus((0, s.vz)(Number(a).toFixed(l), l).toString()).gt((0, s.vz)(Number(eT.amount).toFixed(l), l).toString())
                  ) {
                    ec("Insufficient funds to cover gas and transaction amount.");
                    return;
                  }
                  e();
                })();
              }, [en, ep, ei, eT, ej, n.signTxnData.value, eo]);
              let eS = (0, S.useCallback)(() => {
                  setTimeout(() => {
                    u.refetchBalances(A, B);
                  }, 3e3);
                }, [A, B, u]),
                eN = async () => {
                  var e, t, a, i, s, c, u, g;
                  try {
                    if (z.walletType === l._KQ.LEDGER) {
                      if (null == W ? void 0 : W.evmOnlyChain) K(!0);
                      else throw Error(y.tR);
                    }
                    em(null), el("loading");
                    let t = await F(A, !0),
                      a = o.kZr.GetSeiEvmClient(t, en ?? "", Number(et)),
                      i = await a.sendTransaction(
                        "",
                        n.signTxnData.to,
                        n.signTxnData.value,
                        parseInt(Number(eo || ej).toString()),
                        parseInt(ep.gasPrice.amount.toString()),
                        n.signTxnData.data,
                        !1
                      );
                    try {
                      let t = i.hash,
                        n = new (m())(Number(eo || ej).toString()).multipliedBy(ep.gasPrice.amount.toString()).dividedBy(1).toFixed(0),
                        a = eb.coinMinimalDenom;
                      if (null == W ? void 0 : W.evmOnlyChain)
                        await Q({
                          txType: l.pb0.Dapp,
                          txHash: t,
                          metadata: { ...q, dapp_url: eh ?? origin },
                          address: r.SZ.getEvmAddress(null == z ? void 0 : null === (e = z.pubKeys) || void 0 === e ? void 0 : e[A]),
                          chain: A,
                          network: B,
                          isEvmOnly: !0,
                          feeQuantity: n,
                          feeDenomination: a
                        });
                      else {
                        let e = await o.kZr.GetCosmosTxHash(t, en ?? "");
                        await Q({
                          txType: l.pb0.Dapp,
                          txHash: e,
                          metadata: { ...q, dapp_url: eh ?? origin },
                          address: ee,
                          chain: A,
                          network: B,
                          feeQuantity: n,
                          feeDenomination: a
                        });
                      }
                    } catch {}
                    el("success");
                    try {
                      k().runtime.sendMessage({
                        type: w.u.signSeiEvmResponse,
                        payloadId: null == n ? void 0 : n.payloadId,
                        payload: { status: "success", data: i.hash }
                      });
                    } catch {
                      throw Error("Could not send transaction to the dApp");
                    }
                    D ? I() : (0, _.oj)() ? (eS(), X("/home")) : window.close();
                  } catch (l) {
                    el("error"),
                      l instanceof o.KW8 &&
                        setTimeout(() => {
                          em(null);
                        }, 5e3);
                    let e = l instanceof Error ? l.message : "Something went wrong.";
                    e.includes("intrinsic gas too low") ? em("Please try again with higher gas fee.") : em(e),
                      (0, d.Tb)(l, {
                        fingerprint: ["sei_evm_dapp_transaction", "sei_evm_dapp_transaction_error"],
                        level: "error",
                        extra: {
                          feeQuantity: new (m())(Number(eo || ej).toString())
                            .multipliedBy(
                              null == ep
                                ? void 0
                                : null === (a = ep.gasPrice) || void 0 === a
                                  ? void 0
                                  : null === (t = a.amount) || void 0 === t
                                    ? void 0
                                    : t.toString()
                            )
                            .dividedBy(1)
                            .toFixed(0),
                          feeDenomination: null == eb ? void 0 : eb.coinMinimalDenom,
                          chain: A,
                          address: ee,
                          network: B,
                          isEvmOnly: null == W ? void 0 : W.evmOnlyChain,
                          appUrl: eh,
                          level: "error",
                          preferredGasLimit: eo,
                          recommendedGasLimit: null == ej ? void 0 : ej.toString(),
                          gasPriceOption: null == ep ? void 0 : ep.option,
                          gasPriceAmount:
                            null == ep
                              ? void 0
                              : null === (s = ep.gasPrice) || void 0 === s
                                ? void 0
                                : null === (i = s.amount) || void 0 === i
                                  ? void 0
                                  : i.toString(),
                          gasPriceDenom: null == ep ? void 0 : null === (c = ep.gasPrice) || void 0 === c ? void 0 : c.denom,
                          isLoadingGasLimit: eD,
                          hasUserTouchedFees: !!eo,
                          permissionCapValue:
                            (null == n ? void 0 : null === (u = n.signTxnData) || void 0 === u ? void 0 : u.spendPermissionCapValue) ??
                            (null == n ? void 0 : null === (g = n.signTxnData) || void 0 === g ? void 0 : g.value)
                        },
                        contexts: { transaction: { chain: A, address: ee, errorMessage: e } },
                        tags: {
                          ...C.rw,
                          errorType: "sei_evm_dapp_transaction_error",
                          source: "sei_evm_dapp_transaction",
                          severity: "error",
                          errorName: l instanceof Error ? l.name : "SeiEvmTransactionError",
                          transactionType: "sei_evm_dapp_transaction"
                        }
                      });
                  }
                };
              if ((null == W ? void 0 : W.evmOnlyChain) && "loading" === j.statusNative)
                return (0, i.jsx)("div", {
                  className: "h-full",
                  children: (0, i.jsx)(g.og, {
                    className: "bg-secondary-50",
                    subTitle: eh || "Unknown site",
                    logo: ey || ew,
                    title: "Approve transaction",
                    children: (0, i.jsx)(L.gb, {})
                  })
                });
              let eE = !!eu || "loading" === es || !!ed || eD || "loading" === ei;
              return (0, i.jsxs)("div", {
                className: "h-full",
                children: [
                  (0, i.jsxs)(g.og, {
                    className: "bg-secondary-50",
                    subTitle: eh || "Unknown site",
                    logo: ey || ew,
                    title: "Approve transaction",
                    activeIndex: O,
                    setActiveIndex: Z,
                    limit: U,
                    children: [
                      (0, i.jsx)(x.ZP, {
                        className: "flex flex-col gap-6",
                        gasLimit: eo || (null == ej ? void 0 : ej.toString()),
                        setGasLimit: e => er(e.toString()),
                        recommendedGasLimit: null == ej ? void 0 : ej.toString(),
                        gasPriceOption: ep,
                        onGasPriceOptionChange: e => ef(e),
                        error: ed,
                        setError: ec,
                        considerGasAdjustment: !1,
                        chain: A,
                        network: B,
                        isSelectedTokenEvm: Y,
                        isSeiEvmTransaction: !0,
                        rootBalanceStore: u,
                        rootDenomsStore: a,
                        children: (0, i.jsx)(M.t, {
                          gasPriceError: ed,
                          txData: null == n ? void 0 : null === (t = n.signTxnData) || void 0 === t ? void 0 : t.details
                        })
                      }),
                      eu && "error" === es ? (0, i.jsx)(v._, { text: eu, disableSentryCapture: !0 }) : null,
                      "error" !== es && H ? (0, i.jsx)(p.Z, { showLedgerPopup: H, onClose: () => K(!1) }) : null
                    ]
                  }),
                  (0, i.jsxs)("div", {
                    className: "flex items-center justify-center w-full gap-3 mt-auto [&>*]:flex-1 sticky bottom-0 p-6 bg-secondary-50",
                    children: [
                      (0, i.jsx)(h.zx, {
                        variant: "mono",
                        onClick: () => {
                          (0, P.B)(X, null == n ? void 0 : n.payloadId, D), D && I();
                        },
                        disabled: "loading" === es,
                        "aria-label": "sei evm dapp reject button in sign sei evm transaction flow",
                        children: (0, i.jsx)("span", { "aria-label": "sei evm dapp reject button text in sign sei evm transaction flow", children: "Reject" })
                      }),
                      (0, i.jsx)(h.zx, {
                        onClick: eN,
                        disabled: eE,
                        className: `${eE ? "cursor-not-allowed opacity-50" : ""}`,
                        "aria-label": "sei evm dapp approve button in sign sei evm transaction flow",
                        children:
                          "loading" === es
                            ? (0, i.jsx)(f.T, { color: "white" })
                            : (0, i.jsx)("span", { "aria-label": "sei evm dapp approve button text in sign sei evm transaction flow", children: "Approve" })
                      })
                    ]
                  })
                ]
              });
            });
          a();
        } catch (e) {
          a(e);
        }
      });
    },
    62360: function (e, t, n) {
      n.a(e, async function (e, a) {
        try {
          n.d(t, { t: () => f });
          var i = n(52322),
            s = n(58885),
            l = n(4370),
            o = n(14981),
            r = n(25053),
            d = n(2784),
            c = n(42799),
            u = n(48346),
            m = n(46338),
            g = n(43963),
            v = e([s, u]);
          [s, u] = v.then ? (await v)() : v;
          let x = [
              { id: "fees", label: "Fees" },
              { id: "details", label: "Details" }
            ],
            p = { transform: "translateX(0px) scaleX(0.161044)" },
            f = e => {
              let [t, n] = (0, d.useState)(x[0]);
              return (0, i.jsxs)(i.Fragment, {
                children: [
                  (0, i.jsx)("div", {
                    className: "border-b border-secondary-300",
                    children: (0, i.jsx)(r.z, {
                      buttons: x,
                      setSelectedTab: n,
                      selectedIndex: x.findIndex(e => {
                        let { id: n } = e;
                        return n === t.id;
                      }),
                      className: "gap-0.5",
                      buttonClassName: "px-3.5",
                      indicatorDefaultScale: p
                    })
                  }),
                  (0, i.jsx)("div", {
                    className: "flex flex-col gap-6",
                    children: (0, i.jsxs)(o.M, {
                      mode: "wait",
                      initial: !1,
                      children: [
                        "fees" === t.id &&
                          (0, i.jsxs)(
                            l.E.div,
                            {
                              className: "flex flex-col gap-7",
                              transition: m._M,
                              variants: g.dJ,
                              initial: "exit",
                              animate: "animate",
                              exit: "exit",
                              children: [
                                (0, i.jsx)(s.ZP.Selector, {}),
                                (0, i.jsxs)("div", {
                                  className: "border border-border-bottom rounded-xl ",
                                  children: [
                                    (0, i.jsx)(s.ZP.AdditionalSettingsToggle, {}),
                                    (0, i.jsx)(s.ZP.AdditionalSettings, { showGasLimitWarning: !0, rootBalanceStore: u.jZ, rootDenomsStore: c.gb })
                                  ]
                                }),
                                !!e.gasPriceError &&
                                  (0, i.jsx)("p", { className: "text-destructive-100 text-sm font-medium mt-2 px-1", children: e.gasPriceError })
                              ]
                            },
                            "fees"
                          ),
                        "details" === t.id &&
                          (0, i.jsxs)("div", {
                            className: "flex flex-col gap-3 p-4 rounded-xl border border-secondary-200 bg-secondary-50",
                            children: [
                              (0, i.jsx)("span", { className: "text-muted-foreground text-xs font-medium", children: "Data" }),
                              (0, i.jsx)(
                                l.E.pre,
                                {
                                  transition: m._M,
                                  variants: g.dJ,
                                  initial: "enter",
                                  animate: "animate",
                                  exit: "enter",
                                  className: "text-xs  w-full text-wrap break-words",
                                  children: JSON.stringify(e.txData, (e, t) => ("bigint" == typeof t ? t.toString() : t), 2)
                                },
                                "details"
                              )
                            ]
                          })
                      ]
                    })
                  })
                ]
              });
            };
          a();
        } catch (e) {
          a(e);
        }
      });
    },
    57895: function (e, t, n) {
      n.a(e, async function (e, a) {
        try {
          n.d(t, { E4: () => l.E, bl: () => s.b, gb: () => i.g });
          var i = n(74210),
            s = n(6876),
            l = n(53338),
            o = e([s, l]);
          ([s, l] = o.then ? (await o)() : o), a();
        } catch (e) {
          a(e);
        }
      });
    },
    56611: function (e, t, n) {
      n.d(t, { B: () => o });
      var a = n(74703),
        i = n(48534),
        s = n(72565),
        l = n.n(s);
      async function o(e, t, n) {
        await l().runtime.sendMessage({ type: a.u.signSeiEvmResponse, payloadId: t, payload: { status: "error", data: "User rejected the transaction" } }),
          n || ((0, i.oj)() ? e("/home") : window.close());
      }
    },
    12499: function (e, t, n) {
      n.d(t, { h: () => a });
      let a = e => {
        var t;
        return (
          !!e &&
          (null == e
            ? void 0
            : null === (t = e.toLowerCase()) || void 0 === t
              ? void 0
              : t.includes("unable to connect to ledger device. please check if your ledger is connected and try again."))
        );
      };
    }
  }
]);
//# sourceMappingURL=3672.js.map
