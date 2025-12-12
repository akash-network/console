!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      n = new e.Error().stack;
    n &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[n] = "7999057c-cd6d-4cee-a358-d4872eadd0dd"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-7999057c-cd6d-4cee-a358-d4872eadd0dd"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.23.1" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["3672"],
  {
    63400: function (e, n, t) {
      t.d(n, { u: () => l });
      var a = t(52322),
        i = t(71769);
      t(2784);
      var s = t(70514);
      function l(e) {
        let { className: n } = e;
        return (0, a.jsxs)("div", {
          className: (0, s.cn)("w-full flex flex-row items-start px-4 py-3 justify-start dark:bg-red-900 bg-red-100 rounded-2xl", n),
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
    57767: function (e, n, t) {
      t.d(n, { Z: () => o });
      var a = t(52322),
        i = t(14281);
      t(2784);
      var s = t(86376),
        l = t(69816);
      function o(e) {
        let { showLedgerPopup: n, onClose: t } = e;
        return (0, a.jsx)(i.Z, {
          isOpen: n,
          onClose: t,
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
    49728: function (e, n, t) {
      t.d(n, { U: () => d });
      var a = t(2784),
        i = t(10289),
        s = t(55736),
        l = t(48534),
        o = t(72565),
        r = t.n(o);
      let d = () => {
        let e = (0, i.s0)();
        return (0, a.useCallback)(async () => {
          let n = r().extension.getViews({ type: "popup" }),
            t = 0 === n.length && 600 === window.outerHeight && 400 === window.outerWidth,
            a = -1 !== n.findIndex(e => e === window);
          if (t || a || (0, l.oj)()) {
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
    26409: function (e, n, t) {
      t.a(e, async function (e, a) {
        try {
          t.r(n), t.d(n, { default: () => b });
          var i = t(52322),
            s = t(84166),
            l = t(15969),
            o = t(74703),
            r = t(53108),
            d = t(79533),
            c = t(2784),
            u = t(10289),
            m = t(26245),
            v = t(42799),
            x = t(48346),
            g = t(72565),
            p = t.n(g),
            f = t(57895),
            h = t(56611),
            y = e([x, m, f]);
          [x, m, f] = y.then ? (await y)() : y;
          let b = (e => {
            let n = () => {
              let [n, t] = (0, c.useState)(null),
                [a, s] = (0, c.useState)(null),
                r = (0, c.useCallback)(async (e, n) => {
                  if (n.id === p().runtime.id && e.type === o.u.signTransaction) {
                    var a;
                    let i = e.payload,
                      o = (0, d.DY)(i.origin),
                      { chainKey: r = "ethereum", network: c = "mainnet" } = (await p().storage.local.get(o))[o] || {},
                      u = await (0, d.Hg)(),
                      m = u[r],
                      v = Number("testnet" === c ? (null == m ? void 0 : m.evmChainIdTestnet) : null == m ? void 0 : m.evmChainId);
                    s({ activeChain: r, activeNetwork: c });
                    let { evmJsonRpc: x } = (0, l.Nf9)(r, c, u);
                    if (null == i ? void 0 : null === (a = i.signTxnData) || void 0 === a ? void 0 : a.spendPermissionCapValue)
                      try {
                        let e;
                        try {
                          (e = await (0, l.d_E)(i.signTxnData.to, x ?? "", Number(v))),
                            (i.signTxnData.details = {
                              Permission: `This allows the third party to spend ${(0, l.DZ4)(i.signTxnData.spendPermissionCapValue, (null == e ? void 0 : e.decimals) ?? 18)} ${e.symbol} from your current balance.`,
                              spendPermissionCapValue: i.signTxnData.spendPermissionCapValue,
                              tokenDetails: e,
                              ...i.signTxnData.details
                            });
                        } catch (n) {
                          console.error("Error fetching token details as ERC20 token, retrying as ERC721 token", n),
                            (e = await (0, l.mPt)(i.signTxnData.to, x ?? "", Number(v))),
                            (i.signTxnData.details = {
                              Permission: `This allows the third party to transfer your ${i.signTxnData.spendPermissionCapValue} ${e.symbol} token.`,
                              ...i.signTxnData.details
                            });
                        }
                      } catch (e) {
                        console.error("Error fetching token details", e);
                      }
                    t(e =>
                      (e = e ?? []).some(e => {
                        var n, t;
                        return (
                          (null == e ? void 0 : null === (n = e.origin) || void 0 === n ? void 0 : n.toLowerCase()) !==
                          (null == i ? void 0 : null === (t = i.origin) || void 0 === t ? void 0 : t.toLowerCase())
                        );
                      })
                        ? e
                        : [...e, { ...i, customId: `${n.id}-00${e.length}` }]
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
              null == n ? void 0 : n.length)
                ? (0, i.jsx)(e, { txnDataList: n, setTxnDataList: t, txOriginData: a })
                : (0, i.jsx)(f.gb, {});
            };
            return (n.displayName = `withSeiEvmTxnSigningRequest(${e.displayName})`), n;
          })(
            c.memo(function (e) {
              let { txnDataList: n, setTxnDataList: t, txOriginData: a } = e,
                l = (0, u.s0)(),
                [o, d] = (0, c.useState)(0);
              (0, c.useEffect)(
                () => (
                  window.addEventListener("beforeunload", () => {
                    var e;
                    return (0, h.B)(l, null === (e = n[0]) || void 0 === e ? void 0 : e.payloadId);
                  }),
                  p().storage.local.remove(r.u1),
                  () => {
                    window.removeEventListener("beforeunload", () => {
                      var e;
                      return (0, h.B)(l, null === (e = n[0]) || void 0 === e ? void 0 : e.payloadId);
                    });
                  }
                ),
                []
              );
              let g = e => {
                let a = n.filter(n => n.customId !== e);
                t(a), d(0);
              };
              return (0, i.jsx)(i.Fragment, {
                children: n.map((e, t) => {
                  if (t !== o) return null;
                  switch (e.signTxnData.methodType) {
                    case s.JY.PERSONAL_SIGN:
                    case s.JY.ETH__SIGN:
                    case s.JY.ETH__SIGN_TYPED_DATA_V4:
                      return (0, i.jsx)(f.bl, { txnData: e, donotClose: n.length > 1, handleTxnListUpdate: () => g(e.customId) }, e.customId);
                  }
                  return (0, i.jsx)(
                    f.E4,
                    {
                      activeChain: a.activeChain,
                      activeNetwork: a.activeNetwork,
                      txnData: e,
                      rootDenomsStore: v.gb,
                      rootBalanceStore: x.jZ,
                      unifiedEvmBalanceStore: m.g5,
                      donotClose: n.length > 1,
                      handleTxnListUpdate: () => g(e.customId),
                      activeIndex: o,
                      setActiveIndex: d,
                      limit: n.length
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
    74210: function (e, n, t) {
      t.d(n, { g: () => s });
      var a = t(52322),
        i = t(19623);
      function s() {
        return (0, a.jsx)("div", { className: "h-full w-full flex flex-col gap-4 items-center justify-center", children: (0, a.jsx)(i.T, { color: "white" }) });
      }
      t(2784);
    },
    6876: function (e, n, t) {
      t.a(e, async function (e, a) {
        try {
          t.d(n, { b: () => B });
          var i = t(52322),
            s = t(41172),
            l = t(84166),
            o = t(15969),
            r = t(22078),
            d = t(75959),
            c = t(48272),
            u = t(92642),
            m = t(71696),
            v = t.n(m),
            x = t(79215),
            g = t(86200),
            p = t(63400),
            f = t(57767),
            h = t(19623),
            y = t(91486),
            b = t(23259),
            j = t(74703),
            w = t(4370),
            N = t(74229),
            D = t(49728),
            T = t(78935),
            C = t(65027),
            S = t(2784),
            E = t(10289),
            k = t(42799),
            _ = t(70514),
            I = t(12499),
            L = t(48534),
            P = t(46338),
            M = t(43963),
            A = t(72565),
            O = t.n(A),
            Z = t(56611),
            R = t(41263),
            G = e([C]);
          let F = (C = (G.then ? (await G)() : G)[0]).w.useGetWallet;
          function B(e) {
            var n;
            let { txnData: t, donotClose: a, handleTxnListUpdate: m } = e,
              C = (0, s.h8K)(),
              A = (0, S.useMemo)(() => (t.signTxnData.data ? (0, d.tu)(t.signTxnData.data) || (0, d.rZ)(t.signTxnData.data) : null), [t.signTxnData.data]),
              G = (0, S.useMemo)(() => {
                var e;
                if (null == A ? void 0 : null === (e = A.token) || void 0 === e ? void 0 : e.address)
                  return Object.values(k.gb.allDenoms).find(e => {
                    var n;
                    return e.coinMinimalDenom.toLowerCase() === (null === (n = A.token) || void 0 === n ? void 0 : n.address.toLowerCase());
                  });
              }, [null == A ? void 0 : null === (n = A.token) || void 0 === n ? void 0 : n.address, k.gb.readyPromise]),
              B = (0, S.useMemo)(() => {
                var e;
                return A
                  ? {
                      ...A,
                      token: { address: null == G ? void 0 : G.coinMinimalDenom, name: null == G ? void 0 : G.name, symbol: null == G ? void 0 : G.coinDenom },
                      amount: {
                        ...A.amount,
                        formatted: new r.O$((null == A ? void 0 : null === (e = A.amount) || void 0 === e ? void 0 : e.raw) ?? "0")
                          .multipliedBy(new r.O$(10).pow((null == G ? void 0 : G.coinDecimals) ?? 0))
                          .toString()
                      }
                    }
                  : null;
              }, [A, G]),
              V = (0, s.rTu)(),
              U = (0, E.s0)();
            v()(null !== V, "activeWallet is null");
            let H = null == t ? void 0 : t.origin,
              z = (0, T.G)(H),
              $ = (0, N.a1)(),
              J = F(),
              [W, K] = (0, S.useState)("idle"),
              [Y, q] = (0, S.useState)(null),
              [Q, X] = (0, S.useState)(!1),
              [ee, en] = (0, S.useState)(!A),
              et = (0, D.U)(),
              { chains: ea } = (0, s._IL)(),
              ei = ea[C],
              es = (0, S.useMemo)(
                () => Object.values(ea).find(e => e.evmChainId === (Number(null == B ? void 0 : B.chainId) ?? 0).toString()) ?? void 0,
                [ea, null == B ? void 0 : B.chainId]
              ),
              el = (0, S.useMemo)(() => (0, I.h)(Y), [Y]),
              eo = async () => {
                try {
                  let e;
                  if (el) {
                    await (0, Z.B)(U, null == t ? void 0 : t.payloadId, !0), et();
                    return;
                  }
                  if (V.walletType === s._KQ.LEDGER) {
                    if ((null == ei ? void 0 : ei.evmOnlyChain) === !0) X(!0);
                    else throw Error(b.tR);
                  }
                  q(null), K("loading");
                  let n = await J(C, !0);
                  e =
                    t.signTxnData.methodType === l.JY.ETH__SIGN_TYPED_DATA_V4
                      ? await (0, o.xqy)(t.signTxnData.data, V.addresses[C], n)
                      : await (0, o.W0A)(t.signTxnData.data, V.addresses[C], n);
                  try {
                    await O().runtime.sendMessage({
                      type: j.u.signSeiEvmResponse,
                      payloadId: null == t ? void 0 : t.payloadId,
                      payload: { status: "success", data: e }
                    });
                  } catch {
                    throw Error("Could not send transaction to the dApp");
                  }
                  a ? m() : (0, L.oj)() ? U("/home") : window.close();
                } catch (e) {
                  K("error"),
                    q(e.message),
                    (0, u.Tb)(e, {
                      tags: {
                        errorType: "sei_evm_transaction_error",
                        source: "message_signature",
                        severity: "error",
                        errorName: e instanceof Error ? e.name : "SeiEvmTransactionError"
                      },
                      fingerprint: ["message_signature", "message_signature_error"],
                      level: "error",
                      contexts: { transaction: { type: "message_signature", errorMessage: e instanceof Error ? e.message : String(e) } },
                      extra: { chain: C }
                    });
                }
              },
              er = (!!Y && !el) || "loading" === W;
            return (0, i.jsxs)("div", {
              className: "h-full",
              children: [
                (0, i.jsxs)(x.og, {
                  className: "bg-secondary-50",
                  title: "Signature request",
                  subTitle: H || "Unknown site",
                  logo: z || $,
                  children: [
                    B &&
                      (0, i.jsx)(R.g, {
                        updatedDecodedPermit: B,
                        chain: es,
                        getDenomInfo: G,
                        handleThirdPartyClick: e => {
                          window.open(`https://etherscan.io/address/${e}`, "_blank");
                        }
                      }),
                    (0, i.jsxs)("div", {
                      role: "button",
                      tabIndex: 0,
                      onClick: () => en(e => !e),
                      className: "w-full flex flex-col rounded-2xl border border-secondary-200 bg-white ",
                      children: [
                        (0, i.jsxs)("div", {
                          className: "w-full flex justify-between items-center px-4 py-3",
                          children: [
                            (0, i.jsx)("span", { className: "text-muted-foreground text-xs font-medium", children: "Message" }),
                            (0, i.jsx)(c.p, { size: 14, className: (0, _.cn)("text-muted-foreground transition-transform", ee && "rotate-180") })
                          ]
                        }),
                        ee &&
                          (0, i.jsx)("div", {
                            className: "px-4 py-3 bg-secondary-50",
                            children: (0, i.jsx)(w.E.pre, {
                              transition: P._M,
                              variants: M.dJ,
                              initial: "enter",
                              animate: "animate",
                              exit: "enter",
                              className: "text-xs w-full text-wrap break-words",
                              children:
                                t.signTxnData.details.Message && "object" != typeof t.signTxnData.details.Message
                                  ? t.signTxnData.details.Message
                                  : JSON.stringify(t.signTxnData.details, (e, n) => ("bigint" == typeof n ? n.toString() : n), 2)
                            })
                          })
                      ]
                    }),
                    !el && Y && "error" === W ? (0, i.jsx)(g._, { text: Y, disableSentryCapture: !0, className: "mt-3" }) : null,
                    el && "error" === W ? (0, i.jsx)(p.u, { className: "mt-3" }) : null,
                    "error" !== W && Q ? (0, i.jsx)(f.Z, { showLedgerPopup: Q, onClose: () => X(!1) }) : null
                  ]
                }),
                (0, i.jsxs)("div", {
                  className: "flex items-center justify-center w-full gap-3 mt-auto [&>*]:flex-1 sticky bottom-0 p-6 bg-secondary-50",
                  children: [
                    (0, i.jsx)(y.zx, {
                      variant: "mono",
                      onClick: () => {
                        (0, Z.B)(U, null == t ? void 0 : t.payloadId, a), a && m();
                      },
                      disabled: "loading" === W,
                      "aria-label": "sei evm dapp reject button in sign sei evm message signature flow",
                      children: (0, i.jsx)("span", {
                        "aria-label": "sei evm dapp reject button text in sign sei evm message signature flow",
                        children: "Reject"
                      })
                    }),
                    (0, i.jsx)(y.zx, {
                      onClick: eo,
                      disabled: er,
                      className: `${er ? "cursor-not-allowed opacity-50" : ""}`,
                      "aria-label": "sei evm dapp sign button in sign sei evm message signature flow",
                      children: el
                        ? "Connect Ledger"
                        : "loading" === W
                          ? (0, i.jsx)(h.T, { color: "white" })
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
    61472: function (e, n, t) {
      t.d(n, { g: () => c });
      var a = t(52322),
        i = t(41172),
        s = t(15969),
        l = t(65016),
        o = t(14361),
        r = t(2784),
        d = t(42799);
      let c = e => {
        var n, t, c, u, m, v, x, g, p, f;
        let { txData: h, activeChain: y } = e,
          b = (0, s.DZ4)(
            (null == h ? void 0 : null === (n = h.details) || void 0 === n ? void 0 : n.spendPermissionCapValue) ?? "0",
            (null == h ? void 0 : null === (c = h.details) || void 0 === c ? void 0 : null === (t = c.tokenDetails) || void 0 === t ? void 0 : t.decimals) ?? 18
          ),
          { chains: j } = (0, i._IL)(),
          w = j[y],
          N = (0, r.useMemo)(
            () =>
              Object.values(d.gb.allDenoms).find(e => {
                var n, t;
                return (
                  e.coinMinimalDenom.toLowerCase() ===
                  (null == h ? void 0 : null === (t = h.payload) || void 0 === t ? void 0 : null === (n = t.to) || void 0 === n ? void 0 : n.toLowerCase())
                );
              }) ?? void 0,
            [null == h ? void 0 : null === (u = h.payload) || void 0 === u ? void 0 : u.to, d.gb.readyPromise]
          );
        return (0, a.jsx)("div", {
          className: "border border-secondary-200 rounded-xl p-4",
          children: (0, a.jsxs)("div", {
            className: "flex flex-col gap-3",
            children: [
              (0, a.jsxs)("div", {
                className: "flex justify-between items-center",
                children: [
                  (0, a.jsx)("span", { className: "text-sm text-muted-foreground", children: "Chain" }),
                  (0, a.jsxs)("div", {
                    className: "flex items-center gap-2 text-sm font-medium cursor-default truncate capitalize",
                    children: [
                      (0, a.jsx)("img", { src: null == w ? void 0 : w.chainSymbolImageUrl, alt: "chain", className: "w-4 h-4 rounded-full" }),
                      null == w ? void 0 : w.chainName
                    ]
                  })
                ]
              }),
              (0, a.jsxs)("div", {
                className: "flex justify-between items-center",
                children: [
                  (0, a.jsx)("span", { className: "text-sm text-muted-foreground", children: Number(b) > 0 ? "Approve token" : "Revoke" }),
                  (0, a.jsx)("div", {
                    className: "flex items-center gap-2 bg-secondary-50 rounded-lg py-1.5 max-w-[60%]",
                    children: (0, a.jsx)(o.pn, {
                      children: (0, a.jsxs)(o.u, {
                        children: [
                          (0, a.jsx)(o.aJ, {
                            asChild: !0,
                            children: (0, a.jsxs)("div", {
                              className: "flex items-center gap-2 text-sm font-medium cursor-default truncate capitalize",
                              children: [(0, a.jsx)("img", { src: null == N ? void 0 : N.icon, alt: "token", className: "w-4 h-4 rounded-full" }), b]
                            })
                          }),
                          (0, a.jsx)(o._v, {
                            children: (0, a.jsxs)("p", {
                              children: [
                                b,
                                " ",
                                null == h
                                  ? void 0
                                  : null === (v = h.details) || void 0 === v
                                    ? void 0
                                    : null === (m = v.tokenDetails) || void 0 === m
                                      ? void 0
                                      : m.symbol
                              ]
                            })
                          })
                        ]
                      })
                    })
                  })
                ]
              }),
              (0, a.jsxs)("div", {
                className: "flex justify-between items-center group cursor-pointer",
                onClick: () => {
                  var e;
                  let n = null == h ? void 0 : null === (e = h.details) || void 0 === e ? void 0 : e["Third Party"];
                  n && window.open(`https://etherscan.io/address/${n}`, "_blank");
                },
                children: [
                  (0, a.jsx)("span", { className: "text-sm text-muted-foreground", children: "Interact with" }),
                  (0, a.jsxs)("div", {
                    className: "flex items-center gap-1 text-sm font-medium text-primary-100 group-hover:text-primary-60",
                    children: [
                      (0, a.jsxs)("span", {
                        children: [
                          null == h
                            ? void 0
                            : null === (g = h.details) || void 0 === g
                              ? void 0
                              : null === (x = g["Third Party"]) || void 0 === x
                                ? void 0
                                : x.slice(0, 6),
                          "...",
                          null == h
                            ? void 0
                            : null === (f = h.details) || void 0 === f
                              ? void 0
                              : null === (p = f["Third Party"]) || void 0 === p
                                ? void 0
                                : p.slice(-4)
                        ]
                      }),
                      (0, a.jsx)(l.G, { className: "size-4" })
                    ]
                  })
                ]
              })
            ]
          })
        });
      };
    },
    41263: function (e, n, t) {
      t.d(n, { g: () => c });
      var a = t(52322),
        i = t(15969),
        s = t(65016),
        l = t(14361),
        o = t(4370),
        r = t(74229);
      t(2784);
      var d = t(43963);
      function c(e) {
        var n, t, c, u;
        let { updatedDecodedPermit: m, chain: v, getDenomInfo: x, handleThirdPartyClick: g } = e,
          p = (0, r.a1)();
        return m
          ? (0, a.jsx)(o.E.div, {
              transition: d.eR,
              variants: d.dJ,
              initial: "enter",
              animate: "animate",
              exit: "enter",
              className: "border border-secondary-200 rounded-xl p-4",
              children: (0, a.jsxs)("div", {
                className: "flex flex-col gap-3",
                children: [
                  (null == m ? void 0 : m.chainId) &&
                    (0, a.jsxs)("div", {
                      className: "flex justify-between items-center",
                      children: [
                        (0, a.jsx)("span", { className: "text-sm text-muted-foreground", children: "Chain" }),
                        (0, a.jsx)("div", {
                          className: "flex items-center gap-2 bg-secondary-50 rounded-lg px-3 py-1.5 max-w-[60%]",
                          children: (0, a.jsxs)("div", {
                            className: "flex items-center gap-2",
                            children: [
                              (0, a.jsx)("img", { src: (null == v ? void 0 : v.chainSymbolImageUrl) || p, alt: "token", className: "w-5 h-5 rounded-full" }),
                              (0, a.jsx)("span", { className: "text-sm font-medium cursor-default truncate", children: null == v ? void 0 : v.chainName })
                            ]
                          })
                        })
                      ]
                    }),
                  (null == m ? void 0 : null === (n = m.token) || void 0 === n ? void 0 : n.symbol) &&
                    (0, a.jsxs)("div", {
                      className: "flex justify-between items-center",
                      children: [
                        (0, a.jsx)("span", { className: "text-sm text-muted-foreground", children: "Token" }),
                        (0, a.jsx)("div", {
                          className: "flex items-center gap-2 bg-secondary-50 rounded-lg px-3 py-1.5 max-w-[60%]",
                          children: (0, a.jsxs)("div", {
                            className: "flex items-center gap-2",
                            children: [
                              (0, a.jsx)("img", { src: (null == x ? void 0 : x.icon) || p, alt: "token", className: "w-5 h-5 rounded-full" }),
                              (0, a.jsx)("span", { className: "text-sm font-medium cursor-default truncate", children: m.token.symbol })
                            ]
                          })
                        })
                      ]
                    }),
                  (null == m ? void 0 : null === (t = m.amount) || void 0 === t ? void 0 : t.raw) &&
                    (0, a.jsxs)("div", {
                      className: "flex justify-between items-center",
                      children: [
                        (0, a.jsx)("span", { className: "text-sm text-muted-foreground", children: "Amount" }),
                        (0, a.jsx)("div", {
                          className: "flex items-center gap-2 bg-secondary-50 rounded-lg px-3 py-1.5 max-w-[60%]",
                          children: (0, a.jsx)(l.pn, {
                            children: (0, a.jsxs)(l.u, {
                              children: [
                                (0, a.jsx)(l.aJ, {
                                  asChild: !0,
                                  children: (0, a.jsxs)("span", {
                                    className: "text-sm font-medium cursor-default truncate",
                                    children: [
                                      (0, i.DZ4)(m.amount.raw, (null == x ? void 0 : x.coinDecimals) ?? 18),
                                      " ",
                                      null === (c = m.token) || void 0 === c ? void 0 : c.symbol
                                    ]
                                  })
                                }),
                                (0, a.jsx)(l._v, {
                                  children: (0, a.jsxs)("p", {
                                    children: [
                                      (0, i.DZ4)(m.amount.raw, (null == x ? void 0 : x.coinDecimals) ?? 18),
                                      " ",
                                      null === (u = m.token) || void 0 === u ? void 0 : u.symbol
                                    ]
                                  })
                                })
                              ]
                            })
                          })
                        })
                      ]
                    }),
                  (null == m ? void 0 : m.spender) &&
                    (0, a.jsxs)("div", {
                      className: "flex justify-between items-center",
                      children: [
                        (0, a.jsx)("span", { className: "text-sm text-muted-foreground", children: "Approve to" }),
                        (0, a.jsx)("div", {
                          className: "flex items-center gap-2 bg-secondary-50 rounded-lg px-3 py-1.5 max-w-[60%]",
                          children: (0, a.jsx)(l.pn, {
                            children: (0, a.jsxs)(l.u, {
                              children: [
                                (0, a.jsx)(l.aJ, {
                                  asChild: !0,
                                  children: (0, a.jsxs)("div", {
                                    className: "flex items-center gap-2 cursor-pointer",
                                    onClick: () => g((null == m ? void 0 : m.spender) ?? ""),
                                    children: [
                                      (0, a.jsxs)("span", {
                                        className: "text-sm font-medium cursor-default truncate",
                                        children: [m.spender.slice(0, 6), "...", m.spender.slice(-4)]
                                      }),
                                      (0, a.jsx)(s.G, { className: "size-4" })
                                    ]
                                  })
                                }),
                                (0, a.jsx)(l._v, { children: (0, a.jsx)("p", { children: m.spender }) })
                              ]
                            })
                          })
                        })
                      ]
                    }),
                  (null == m ? void 0 : m.verifyingContract) &&
                    (0, a.jsxs)("div", {
                      className: "flex justify-between items-center",
                      children: [
                        (0, a.jsx)("span", { className: "text-sm text-muted-foreground", children: "Protocol" }),
                        (0, a.jsx)("div", {
                          className: "flex items-center gap-2 bg-secondary-50 rounded-lg px-3 py-1.5 max-w-[60%]",
                          children: (0, a.jsx)(l.pn, {
                            children: (0, a.jsxs)(l.u, {
                              children: [
                                (0, a.jsx)(l.aJ, {
                                  asChild: !0,
                                  children: (0, a.jsxs)("div", {
                                    className: "flex items-center gap-2 cursor-pointer",
                                    onClick: () => g((null == m ? void 0 : m.verifyingContract) ?? ""),
                                    children: [
                                      (0, a.jsxs)("span", {
                                        className: "text-sm font-medium cursor-default truncate",
                                        children: [m.verifyingContract.slice(0, 6), "...", m.verifyingContract.slice(-4)]
                                      }),
                                      (0, a.jsx)(s.G, { className: "size-4" })
                                    ]
                                  })
                                }),
                                (0, a.jsx)(l._v, { children: (0, a.jsx)("p", { children: m.verifyingContract }) })
                              ]
                            })
                          })
                        })
                      ]
                    }),
                  (null == m ? void 0 : m.sigDeadline) &&
                    (0, a.jsxs)("div", {
                      className: "flex justify-between items-center",
                      children: [
                        (0, a.jsx)("span", { className: "text-sm text-muted-foreground", children: "Signature expire time" }),
                        (0, a.jsx)("div", {
                          className: "flex items-center gap-2 bg-secondary-50 rounded-lg px-3 py-1.5 max-w-[60%]",
                          children: (0, a.jsx)("span", {
                            className: "text-sm font-medium cursor-default truncate",
                            children: new Date(m.sigDeadline).toLocaleString()
                          })
                        })
                      ]
                    }),
                  (null == m ? void 0 : m.expiration) &&
                    (0, a.jsxs)("div", {
                      className: "flex justify-between items-center",
                      children: [
                        (0, a.jsx)("span", { className: "text-sm text-muted-foreground", children: "Approval expire time" }),
                        (0, a.jsx)("div", {
                          className: "flex items-center gap-2 bg-secondary-50 rounded-lg px-3 py-1.5 max-w-[60%]",
                          children: (0, a.jsx)("span", {
                            className: "text-sm font-medium cursor-default truncate",
                            children: new Date(m.expiration).toLocaleString()
                          })
                        })
                      ]
                    })
                ]
              })
            })
          : null;
      }
    },
    81032: function (e, n, t) {
      t.d(n, { z: () => s });
      var a = t(52322),
        i = t(15969);
      t(2784);
      let s = e => {
        var n, t;
        let { simulateResult: s, sentDenomInfo: l, receivedDenomInfo: o } = e;
        return (0, a.jsxs)("div", {
          className: "flex flex-col gap-2",
          children: [
            (0, a.jsx)("p", { className: "text-sm font-medium", children: "Simulation Result" }),
            (0, a.jsxs)("div", {
              className: "flex flex-col gap-4 bg-secondary-100 p-5 rounded-2xl",
              children: [
                null === (n = s.sent) || void 0 === n
                  ? void 0
                  : n.map((e, n) =>
                      (0, a.jsx)(
                        "div",
                        {
                          className: "flex items-center justify-between",
                          children: (0, a.jsxs)("div", {
                            className: "flex items-center gap-2",
                            children: [
                              (0, a.jsx)("img", {
                                src: null == l ? void 0 : l.icon,
                                alt: (null == l ? void 0 : l.coinDenom) || e.token,
                                className: "w-8 h-8 rounded-full"
                              }),
                              (0, a.jsxs)("span", {
                                className: "text-destructive-100 text-sm",
                                children: [
                                  "- ",
                                  (0, i.DZ4)(e.amount, (null == l ? void 0 : l.coinDecimals) ?? 18),
                                  " ",
                                  (null == l ? void 0 : l.coinDenom) || e.token
                                ]
                              })
                            ]
                          })
                        },
                        `sent-${n}`
                      )
                    ),
                null === (t = s.received) || void 0 === t
                  ? void 0
                  : t.map((e, n) =>
                      (0, a.jsx)(
                        "div",
                        {
                          className: "flex items-center justify-between",
                          children: (0, a.jsxs)("div", {
                            className: "flex items-center gap-2",
                            children: [
                              (0, a.jsx)("img", {
                                src: null == o ? void 0 : o.icon,
                                alt: (null == o ? void 0 : o.coinDenom) || e.token,
                                className: "w-8 h-8 rounded-full"
                              }),
                              (0, a.jsxs)("span", {
                                className: "text-success-100 text-sm",
                                children: [
                                  "+ ",
                                  (0, i.DZ4)(e.amount, (null == o ? void 0 : o.coinDecimals) ?? 18),
                                  " ",
                                  (null == o ? void 0 : o.coinDenom) || e.token
                                ]
                              })
                            ]
                          })
                        },
                        `received-${n}`
                      )
                    )
              ]
            })
          ]
        });
      };
    },
    53338: function (e, n, t) {
      t.a(e, async function (e, a) {
        try {
          t.d(n, { E: () => R });
          var i = t(52322),
            s = t(33569),
            l = t(41172),
            o = t(15969),
            r = t(44658),
            d = t(92642),
            c = t(60431),
            u = t(6391),
            m = t.n(u),
            v = t(79215),
            x = t(86200),
            g = t(58885),
            p = t(57767),
            f = t(19623),
            h = t(91486),
            y = t(23259),
            b = t(74703),
            j = t(74229),
            w = t(78935),
            N = t(65027),
            D = t(75958),
            T = t(2784),
            C = t(10289),
            S = t(36321),
            E = t(44818),
            k = t(48534),
            _ = t(37906),
            I = t(72565),
            L = t.n(I),
            P = t(56611),
            M = t(57895),
            A = t(62360),
            O = e([N, M, g, A]);
          [N, M, g, A] = O.then ? (await O)() : O;
          let Z = N.w.useGetWallet,
            R = (0, D.Pi)(e => {
              var n;
              let {
                  txnData: t,
                  rootDenomsStore: a,
                  rootBalanceStore: u,
                  unifiedEvmBalanceStore: N,
                  donotClose: D,
                  handleTxnListUpdate: I,
                  activeChain: O,
                  activeNetwork: R,
                  activeIndex: G,
                  setActiveIndex: B,
                  limit: F
                } = e,
                V = Z(O),
                { addressLinkState: U } = (0, l.uaF)(O),
                H = N.evmBalanceForChain(O, R, void 0),
                z = (0, l.QSC)(O),
                $ = (0, l.rTu)(),
                J = u.getBalancesForChain(O, R, void 0),
                [W, K] = (0, T.useState)(!1),
                Y = (0, T.useMemo)(() => {
                  let e = J;
                  return (0, l.hI9)(!1, U, (null == z ? void 0 : z.evmOnlyChain) ?? !1) && (e = [...e, ...(H ?? [])].filter(e => new (m())(e.amount).gt(0))), e;
                }, [U, J, null == z ? void 0 : z.evmOnlyChain, H]),
                q = (0, T.useMemo)(
                  () =>
                    (Y ?? []).some(
                      e => (null == e ? void 0 : e.isEvm) && ((null == e ? void 0 : e.coinMinimalDenom) === "usei" || (null == z ? void 0 : z.evmOnlyChain))
                    ),
                  [Y, null == z ? void 0 : z.evmOnlyChain]
                );
              (0, E.h)(null !== $, "activeWallet is null");
              let Q = (0, l.FmJ)(),
                X = l.rNU.useLogCosmosDappTx(),
                ee = (0, C.s0)(),
                en = (0, l.SFn)(O),
                et = (0, l.xxU)(O, R, !0),
                { evmJsonRpc: ea } = (0, l.U9i)(O, R),
                ei = (0, g.e7)(a.allDenoms, { activeChain: O, isSeiEvmTransaction: !0 }),
                { status: es } = (0, l.CIk)(O, R),
                el = (0, r.Bf)(S.Ui.chainInfos, O, R),
                [eo, er] = (0, T.useState)("idle"),
                [ed, ec] = (0, T.useState)(""),
                [eu, em] = (0, T.useState)(null),
                [ev, ex] = (0, T.useState)(null),
                [eg, ep] = (0, T.useState)(null);
              (0, T.useEffect)(() => {
                !(async function () {
                  var e;
                  let n = await o.kZr.simulateDappTransaction(
                    (null == t ? void 0 : t.payload) ?? "",
                    (null == t ? void 0 : null === (e = t.payload) || void 0 === e ? void 0 : e.from) ?? ""
                  );
                  ep(n);
                })();
              }, [null == t ? void 0 : t.payload]);
              let ef = (0, l.dco)(),
                eh = (0, l._ty)(O),
                ey = (0, T.useMemo)(() => {
                  var e;
                  return parseInt((((null === (e = ef[O]) || void 0 === e ? void 0 : e.DEFAULT_GAS_IBC) ?? o.N7W.DEFAULT_GAS_IBC) * eh).toString());
                }, [O, ef, eh]),
                [eb, ej] = (0, T.useState)({ gasPrice: ei.gasPrice, option: l.j1p.LOW }),
                ew = null == t ? void 0 : t.origin,
                eN = (0, w.G)(ew),
                eD = (0, j.a1)(),
                eT = (0, l.bkk)(a.allDenoms, O, R),
                eC = (0, T.useMemo)(() => {
                  if (eT) return (Y ?? []).find(e => (null == e ? void 0 : e.coinMinimalDenom) === eT.coinMinimalDenom);
                }, [Y, eT]);
              (0, T.useEffect)(() => {
                u.loadBalances(O, R);
              }, [O, R]);
              let { data: eS, isLoading: eE } = (0, c.useQuery)({
                queryKey: [
                  O,
                  null == $ ? void 0 : $.pubKeys,
                  ey,
                  ea,
                  eh,
                  t.signTxnData.data,
                  t.signTxnData.gas,
                  t.signTxnData.params,
                  t.signTxnData.to,
                  t.signTxnData.value
                ],
                queryFn: async function () {
                  var e, n;
                  if (null == t ? void 0 : null === (e = t.signTxnData) || void 0 === e ? void 0 : e.gas) return Math.ceil(Number(t.signTxnData.gas) * eh);
                  try {
                    let e = ey;
                    if (t.signTxnData.params) {
                      let n = await o.kZr.ExecuteEthEstimateGas(t.signTxnData.params, ea);
                      e = Math.ceil(Number(n) * eh);
                    } else {
                      let a = r.SZ.getEvmAddress(null == $ ? void 0 : null === (n = $.pubKeys) || void 0 === n ? void 0 : n[O]);
                      (e = await o.kZr.SimulateTransaction(t.signTxnData.to, t.signTxnData.value, ea, t.signTxnData.data, void 0, a)),
                        (e = Math.ceil(Number(e) * eh));
                    }
                    return e;
                  } catch (e) {
                    return ey;
                  }
                },
                initialData: ey
              });
              (0, T.useEffect)(() => {
                function e() {
                  (null == eu ? void 0 : eu.includes("Insufficient funds to cover gas and transaction amount.")) && em("");
                }
                !(async function () {
                  var n;
                  if ("loading" === es || !(null == eb ? void 0 : null === (n = eb.gasPrice) || void 0 === n ? void 0 : n.amount)) {
                    e();
                    return;
                  }
                  let a = t.signTxnData.value,
                    i = new (m())(ed || eS).multipliedBy(eb.gasPrice.amount.toString()),
                    l = Number((null == eC ? void 0 : eC.coinDecimals) ?? 18);
                  if (
                    eC &&
                    a &&
                    0 !== Number(a) &&
                    i.plus((0, s.vz)(Number(a).toFixed(l), l).toString()).gt((0, s.vz)(Number(eC.amount).toFixed(l), l).toString())
                  ) {
                    em("Insufficient funds to cover gas and transaction amount.");
                    return;
                  }
                  e();
                })();
              }, [ea, eb, es, eC, eS, t.signTxnData.value, ed]);
              let ek = (0, T.useCallback)(() => {
                  setTimeout(() => {
                    u.refetchBalances(O, R);
                  }, 3e3);
                }, [O, R, u]),
                e_ = async () => {
                  var e, n, a, i, s, c, u, v;
                  try {
                    if ($.walletType === l._KQ.LEDGER) {
                      if (null == z ? void 0 : z.evmOnlyChain) K(!0);
                      else throw Error(y.tR);
                    }
                    ex(null), er("loading");
                    let n = await V(O, !0),
                      a = o.kZr.GetSeiEvmClient(n, ea ?? "", Number(et)),
                      i = await a.sendTransaction(
                        "",
                        t.signTxnData.to,
                        t.signTxnData.value,
                        parseInt(Number(ed || eS).toString()),
                        parseInt(eb.gasPrice.amount.toString()),
                        t.signTxnData.data,
                        !1
                      );
                    try {
                      let n = i.hash,
                        t = new (m())(Number(ed || eS).toString()).multipliedBy(eb.gasPrice.amount.toString()).dividedBy(1).toFixed(0),
                        a = eT.coinMinimalDenom;
                      if (null == z ? void 0 : z.evmOnlyChain)
                        await X({
                          txType: l.pb0.Dapp,
                          txHash: n,
                          metadata: { ...Q, dapp_url: ew ?? origin },
                          address: r.SZ.getEvmAddress(null == $ ? void 0 : null === (e = $.pubKeys) || void 0 === e ? void 0 : e[O]),
                          chain: O,
                          network: R,
                          isEvmOnly: !0,
                          feeQuantity: t,
                          feeDenomination: a
                        });
                      else {
                        let e = await o.kZr.GetCosmosTxHash(n, ea ?? "");
                        await X({
                          txType: l.pb0.Dapp,
                          txHash: e,
                          metadata: { ...Q, dapp_url: ew ?? origin },
                          address: en,
                          chain: O,
                          network: R,
                          feeQuantity: t,
                          feeDenomination: a
                        });
                      }
                    } catch {}
                    er("success");
                    try {
                      L().runtime.sendMessage({
                        type: b.u.signSeiEvmResponse,
                        payloadId: null == t ? void 0 : t.payloadId,
                        payload: { status: "success", data: i.hash }
                      });
                    } catch {
                      throw Error("Could not send transaction to the dApp");
                    }
                    D ? I() : (0, k.oj)() ? (ek(), ee("/home")) : window.close();
                  } catch (l) {
                    er("error"),
                      l instanceof o.KW8 &&
                        setTimeout(() => {
                          ex(null);
                        }, 5e3);
                    let e = l instanceof Error ? l.message : "Something went wrong.";
                    e.includes("intrinsic gas too low") ? ex("Please try again with higher gas fee.") : ex(e),
                      (0, d.Tb)(l, {
                        fingerprint: ["sei_evm_dapp_transaction", "sei_evm_dapp_transaction_error"],
                        level: "error",
                        extra: {
                          feeQuantity: new (m())(Number(ed || eS).toString())
                            .multipliedBy(
                              null == eb
                                ? void 0
                                : null === (a = eb.gasPrice) || void 0 === a
                                  ? void 0
                                  : null === (n = a.amount) || void 0 === n
                                    ? void 0
                                    : n.toString()
                            )
                            .dividedBy(1)
                            .toFixed(0),
                          feeDenomination: null == eT ? void 0 : eT.coinMinimalDenom,
                          chain: O,
                          address: en,
                          network: R,
                          isEvmOnly: null == z ? void 0 : z.evmOnlyChain,
                          appUrl: ew,
                          level: "error",
                          preferredGasLimit: ed,
                          recommendedGasLimit: null == eS ? void 0 : eS.toString(),
                          gasPriceOption: null == eb ? void 0 : eb.option,
                          gasPriceAmount:
                            null == eb
                              ? void 0
                              : null === (s = eb.gasPrice) || void 0 === s
                                ? void 0
                                : null === (i = s.amount) || void 0 === i
                                  ? void 0
                                  : i.toString(),
                          gasPriceDenom: null == eb ? void 0 : null === (c = eb.gasPrice) || void 0 === c ? void 0 : c.denom,
                          isLoadingGasLimit: eE,
                          hasUserTouchedFees: !!ed,
                          permissionCapValue:
                            (null == t ? void 0 : null === (u = t.signTxnData) || void 0 === u ? void 0 : u.spendPermissionCapValue) ??
                            (null == t ? void 0 : null === (v = t.signTxnData) || void 0 === v ? void 0 : v.value)
                        },
                        contexts: { transaction: { chain: O, address: en, errorMessage: e } },
                        tags: {
                          ..._.rw,
                          errorType: "sei_evm_dapp_transaction_error",
                          source: "sei_evm_dapp_transaction",
                          severity: "error",
                          errorName: l instanceof Error ? l.name : "SeiEvmTransactionError",
                          transactionType: "sei_evm_dapp_transaction"
                        }
                      });
                  }
                };
              if ((null == z ? void 0 : z.evmOnlyChain) && "loading" === N.statusNative)
                return (0, i.jsx)("div", {
                  className: "h-full",
                  children: (0, i.jsx)(v.og, {
                    className: "bg-secondary-50",
                    subTitle: ew || "Unknown site",
                    logo: eN || eD,
                    title: "Approve transaction",
                    children: (0, i.jsx)(M.gb, {})
                  })
                });
              let eI = !!ev || "loading" === eo || !!eu || eE || "loading" === es;
              return (0, i.jsxs)("div", {
                className: "h-full",
                children: [
                  (0, i.jsxs)(v.og, {
                    className: "bg-secondary-50",
                    subTitle: ew || "Unknown site",
                    logo: eN || eD,
                    title: "Approve transaction",
                    activeIndex: G,
                    setActiveIndex: B,
                    limit: F,
                    children: [
                      (0, i.jsx)(g.ZP, {
                        className: "flex flex-col gap-6",
                        gasLimit: ed || (null == eS ? void 0 : eS.toString()),
                        setGasLimit: e => ec(e.toString()),
                        recommendedGasLimit: null == eS ? void 0 : eS.toString(),
                        gasPriceOption: eb,
                        onGasPriceOptionChange: e => ej(e),
                        error: eu,
                        setError: em,
                        considerGasAdjustment: !1,
                        chain: O,
                        network: R,
                        isSelectedTokenEvm: q,
                        isSeiEvmTransaction: !0,
                        rootBalanceStore: u,
                        rootDenomsStore: a,
                        children: (0, i.jsx)(A.t, {
                          activeChain: O,
                          simulateResult: eg,
                          gasPriceError: eu,
                          txData: {
                            abi: null == t ? void 0 : t.abi,
                            payload: null == t ? void 0 : t.payload,
                            details: null == t ? void 0 : null === (n = t.signTxnData) || void 0 === n ? void 0 : n.details
                          },
                          nativeDenom: el
                        })
                      }),
                      ev && "error" === eo ? (0, i.jsx)(x._, { text: ev, disableSentryCapture: !0 }) : null,
                      "error" !== eo && W ? (0, i.jsx)(p.Z, { showLedgerPopup: W, onClose: () => K(!1) }) : null
                    ]
                  }),
                  (0, i.jsxs)("div", {
                    className: "flex items-center justify-center w-full gap-3 mt-auto [&>*]:flex-1 sticky bottom-0 p-6 bg-secondary-50",
                    children: [
                      (0, i.jsx)(h.zx, {
                        variant: "mono",
                        onClick: () => {
                          (0, P.B)(ee, null == t ? void 0 : t.payloadId, D), D && I();
                        },
                        disabled: "loading" === eo,
                        "aria-label": "sei evm dapp reject button in sign sei evm transaction flow",
                        children: (0, i.jsx)("span", { "aria-label": "sei evm dapp reject button text in sign sei evm transaction flow", children: "Reject" })
                      }),
                      (0, i.jsx)(h.zx, {
                        onClick: e_,
                        disabled: eI,
                        className: `${eI ? "cursor-not-allowed opacity-50" : ""}`,
                        "aria-label": "sei evm dapp approve button in sign sei evm transaction flow",
                        children:
                          "loading" === eo
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
    62360: function (e, n, t) {
      t.a(e, async function (e, a) {
        try {
          t.d(n, { t: () => b });
          var i = t(52322),
            s = t(58885),
            l = t(14981),
            o = t(4370),
            r = t(25053),
            d = t(2784),
            c = t(42799),
            u = t(48346),
            m = t(46338),
            v = t(43963),
            x = t(61472),
            g = t(81032),
            p = e([s, u]);
          [s, u] = p.then ? (await p)() : p;
          let f = [
              { id: "fees", label: "Fees" },
              { id: "details", label: "Details" }
            ],
            h = [
              { id: "raw", label: "Raw" },
              { id: "abi", label: "ABI" },
              { id: "hex", label: "Hex" }
            ],
            y = { transform: "translateX(0px) scaleX(0.161044)" },
            b = e => {
              var n, t, a, p, b, j, w, N, D, T, C;
              let [S, E] = (0, d.useState)(f[0]),
                [k, _] = (0, d.useState)(h[0]),
                I = (0, d.useMemo)(() => {
                  var n, t;
                  if ((null === (t = e.simulateResult) || void 0 === t ? void 0 : null === (n = t.sent) || void 0 === n ? void 0 : n.length) > 0)
                    return "eth" === e.simulateResult.sent[0].token.toLowerCase()
                      ? e.nativeDenom
                      : Object.values(c.gb.allDenoms).find(n => {
                          var t, a;
                          return null === (a = e.simulateResult) || void 0 === a
                            ? void 0
                            : null === (t = a.sent) || void 0 === t
                              ? void 0
                              : t.find(e => e.token.toLowerCase() === n.coinMinimalDenom.toLowerCase());
                        });
                }, [null === (n = e.simulateResult) || void 0 === n ? void 0 : n.sent, c.gb.readyPromise]),
                L = (0, d.useMemo)(() => {
                  var n, t;
                  if ((null === (t = e.simulateResult) || void 0 === t ? void 0 : null === (n = t.received) || void 0 === n ? void 0 : n.length) > 0)
                    return "eth" === e.simulateResult.received[0].token.toLowerCase()
                      ? e.nativeDenom
                      : Object.values(c.gb.allDenoms).find(n => {
                          var t, a;
                          return null === (a = e.simulateResult) || void 0 === a
                            ? void 0
                            : null === (t = a.received) || void 0 === t
                              ? void 0
                              : t.find(e => e.token.toLowerCase() === n.coinMinimalDenom.toLowerCase());
                        });
                }, [null === (t = e.simulateResult) || void 0 === t ? void 0 : t.received, c.gb.readyPromise]);
              return (0, i.jsxs)(i.Fragment, {
                children: [
                  (0, i.jsx)("div", {
                    className: "border-b border-secondary-300",
                    children: (0, i.jsx)(r.z, {
                      buttons: f,
                      setSelectedTab: E,
                      selectedIndex: f.findIndex(e => {
                        let { id: n } = e;
                        return n === S.id;
                      }),
                      className: "gap-0.5",
                      buttonClassName: "px-3.5",
                      indicatorDefaultScale: y
                    })
                  }),
                  (0, i.jsx)("div", {
                    className: "flex flex-col gap-6",
                    children: (0, i.jsxs)(l.M, {
                      mode: "wait",
                      initial: !1,
                      children: [
                        "fees" === S.id &&
                          (0, i.jsx)(
                            o.E.div,
                            {
                              className: "flex flex-col gap-7",
                              transition: m._M,
                              variants: v.dJ,
                              initial: "exit",
                              animate: "animate",
                              exit: "exit",
                              children: (0, i.jsxs)("div", {
                                className: "flex flex-col gap-6",
                                children: [
                                  (null === (b = e.txData) || void 0 === b
                                    ? void 0
                                    : null === (p = b.abi) || void 0 === p
                                      ? void 0
                                      : null === (a = p.func) || void 0 === a
                                        ? void 0
                                        : a.toLowerCase()) === "approve" && (0, i.jsx)(x.g, { txData: e.txData, activeChain: e.activeChain }),
                                  (0, i.jsx)(l.M, {
                                    children:
                                      e.simulateResult &&
                                      I &&
                                      L &&
                                      (0, i.jsx)(o.E.div, {
                                        initial: { opacity: 0, y: 10 },
                                        animate: { opacity: 1, y: 0 },
                                        exit: { opacity: 0, y: -10 },
                                        transition: { duration: 0.2 },
                                        children: (0, i.jsx)(g.z, { simulateResult: e.simulateResult, sentDenomInfo: I, receivedDenomInfo: L })
                                      })
                                  }),
                                  (0, i.jsx)(s.ZP.Selector, {}),
                                  (0, i.jsxs)("div", {
                                    className: "border border-border-bottom rounded-xl",
                                    children: [
                                      (0, i.jsx)(s.ZP.AdditionalSettingsToggle, {}),
                                      (0, i.jsx)(s.ZP.AdditionalSettings, { showGasLimitWarning: !0, rootBalanceStore: u.jZ, rootDenomsStore: c.gb })
                                    ]
                                  }),
                                  !!e.gasPriceError &&
                                    (0, i.jsx)("p", { className: "text-destructive-100 text-sm font-medium mt-2 px-1", children: e.gasPriceError })
                                ]
                              })
                            },
                            "fees"
                          ),
                        "details" === S.id &&
                          (0, i.jsxs)("div", {
                            className: "flex flex-col gap-3",
                            children: [
                              (0, i.jsx)("div", {
                                className: "border-b border-secondary-300",
                                children: (0, i.jsx)(r.z, {
                                  buttons: h,
                                  setSelectedTab: _,
                                  selectedIndex: h.findIndex(e => {
                                    let { id: n } = e;
                                    return n === k.id;
                                  }),
                                  className: "gap-0.5",
                                  buttonClassName: "px-3.5",
                                  indicatorDefaultScale: y
                                })
                              }),
                              (0, i.jsx)("div", {
                                className: "p-4 rounded-xl border border-secondary-200 bg-secondary-50",
                                children: (0, i.jsx)(
                                  o.E.pre,
                                  {
                                    transition: m._M,
                                    variants: v.dJ,
                                    initial: "enter",
                                    animate: "animate",
                                    exit: "enter",
                                    className: "text-xs w-full text-wrap break-words",
                                    children: JSON.stringify(
                                      "raw" === k.id
                                        ? null === (j = e.txData) || void 0 === j
                                          ? void 0
                                          : j.payload
                                        : "abi" === k.id
                                          ? null === (w = e.txData) || void 0 === w
                                            ? void 0
                                            : w.abi
                                          : "hex" === k.id
                                            ? null === (D = e.txData) || void 0 === D
                                              ? void 0
                                              : null === (N = D.payload) || void 0 === N
                                                ? void 0
                                                : N.data
                                            : null === (C = e.txData) || void 0 === C
                                              ? void 0
                                              : null === (T = C.payload) || void 0 === T
                                                ? void 0
                                                : T.data,
                                      (e, n) => ("bigint" == typeof n ? n.toString() : n),
                                      2
                                    )
                                  },
                                  `details-${k}`
                                )
                              })
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
    57895: function (e, n, t) {
      t.a(e, async function (e, a) {
        try {
          t.d(n, { E4: () => l.E, bl: () => s.b, gb: () => i.g });
          var i = t(74210),
            s = t(6876),
            l = t(53338),
            o = e([s, l]);
          ([s, l] = o.then ? (await o)() : o), a();
        } catch (e) {
          a(e);
        }
      });
    },
    56611: function (e, n, t) {
      t.d(n, { B: () => o });
      var a = t(74703),
        i = t(48534),
        s = t(72565),
        l = t.n(s);
      async function o(e, n, t) {
        await l().runtime.sendMessage({ type: a.u.signSeiEvmResponse, payloadId: n, payload: { status: "error", data: "User rejected the transaction" } }),
          t || ((0, i.oj)() ? e("/home") : window.close());
      }
    },
    12499: function (e, n, t) {
      t.d(n, { h: () => a });
      let a = e => {
        var n;
        return (
          !!e &&
          (null == e
            ? void 0
            : null === (n = e.toLowerCase()) || void 0 === n
              ? void 0
              : n.includes("unable to connect to ledger device. please check if your ledger is connected and try again."))
        );
      };
    },
    75959: function (e, n, t) {
      function a(e) {
        var n, t, a;
        if (
          !(
            (null == e ? void 0 : e.primaryType) === "PermitSingle" &&
            (null == e ? void 0 : null === (n = e.types) || void 0 === n ? void 0 : n.PermitSingle) &&
            (null == e ? void 0 : null === (t = e.types) || void 0 === t ? void 0 : t.PermitDetails) &&
            (null == e ? void 0 : null === (a = e.domain) || void 0 === a ? void 0 : a.verifyingContract) === "0x000000000022d473030f116ddee9f6b43ac78ba3"
          )
        )
          return null;
        let { domain: i, message: s } = e,
          { details: l, spender: o, sigDeadline: r } = s,
          { token: d, amount: c, expiration: u } = l,
          { chainId: m, verifyingContract: v } = i;
        return {
          token: { address: d, symbol: "", name: "" },
          amount: { raw: c, formatted: 0 },
          spender: o,
          expiration: new Date(1e3 * Number(u)),
          sigDeadline: new Date(1e3 * Number(r)),
          chainId: m,
          verifyingContract: v
        };
      }
      function i(e) {
        var n, t, a, i, s;
        if (
          !(
            (null == e ? void 0 : e.primaryType) === "PermitTransferFrom" &&
            (null == e ? void 0 : null === (n = e.message) || void 0 === n ? void 0 : n.spender) === "0x89c6340b1a1f4b25d36cd8b063d49045caf3f818" &&
            (null == e ? void 0 : null === (a = e.message) || void 0 === a ? void 0 : null === (t = a.permitted) || void 0 === t ? void 0 : t.token) &&
            (null == e ? void 0 : null === (s = e.message) || void 0 === s ? void 0 : null === (i = s.permitted) || void 0 === i ? void 0 : i.amount)
          )
        )
          return null;
        let { permitted: l, spender: o, deadline: r } = e.message,
          { token: d, amount: c } = l;
        return { token: { address: d, symbol: "", name: "" }, amount: { raw: c, formatted: 0 }, spender: o, expiration: new Date(1e3 * Number(r)) };
      }
      t.d(n, { rZ: () => i, tu: () => a });
    },
    65016: function (e, n, t) {
      t.d(n, { G: () => g });
      var a = t(2784),
        i = t(6806);
      let s = new Map([
        [
          "bold",
          a.createElement(
            a.Fragment,
            null,
            a.createElement("path", { d: "M204,64V168a12,12,0,0,1-24,0V93L72.49,200.49a12,12,0,0,1-17-17L163,76H88a12,12,0,0,1,0-24H192A12,12,0,0,1,204,64Z" })
          )
        ],
        [
          "duotone",
          a.createElement(
            a.Fragment,
            null,
            a.createElement("path", { d: "M192,64V168L88,64Z", opacity: "0.2" }),
            a.createElement("path", {
              d: "M192,56H88a8,8,0,0,0-5.66,13.66L128.69,116,58.34,186.34a8,8,0,0,0,11.32,11.32L140,127.31l46.34,46.35A8,8,0,0,0,200,168V64A8,8,0,0,0,192,56Zm-8,92.69-38.34-38.34h0L107.31,72H184Z"
            })
          )
        ],
        [
          "fill",
          a.createElement(
            a.Fragment,
            null,
            a.createElement("path", {
              d: "M200,64V168a8,8,0,0,1-13.66,5.66L140,127.31,69.66,197.66a8,8,0,0,1-11.32-11.32L128.69,116,82.34,69.66A8,8,0,0,1,88,56H192A8,8,0,0,1,200,64Z"
            })
          )
        ],
        [
          "light",
          a.createElement(
            a.Fragment,
            null,
            a.createElement("path", {
              d: "M198,64V168a6,6,0,0,1-12,0V78.48L68.24,196.24a6,6,0,0,1-8.48-8.48L177.52,70H88a6,6,0,0,1,0-12H192A6,6,0,0,1,198,64Z"
            })
          )
        ],
        [
          "regular",
          a.createElement(
            a.Fragment,
            null,
            a.createElement("path", {
              d: "M200,64V168a8,8,0,0,1-16,0V83.31L69.66,197.66a8,8,0,0,1-11.32-11.32L172.69,72H88a8,8,0,0,1,0-16H192A8,8,0,0,1,200,64Z"
            })
          )
        ],
        [
          "thin",
          a.createElement(
            a.Fragment,
            null,
            a.createElement("path", { d: "M196,64V168a4,4,0,0,1-8,0V73.66L66.83,194.83a4,4,0,0,1-5.66-5.66L182.34,68H88a4,4,0,0,1,0-8H192A4,4,0,0,1,196,64Z" })
          )
        ]
      ]);
      var l = Object.defineProperty,
        o = Object.defineProperties,
        r = Object.getOwnPropertyDescriptors,
        d = Object.getOwnPropertySymbols,
        c = Object.prototype.hasOwnProperty,
        u = Object.prototype.propertyIsEnumerable,
        m = (e, n, t) => (n in e ? l(e, n, { enumerable: !0, configurable: !0, writable: !0, value: t }) : (e[n] = t)),
        v = (e, n) => {
          for (var t in n || (n = {})) c.call(n, t) && m(e, t, n[t]);
          if (d) for (var t of d(n)) u.call(n, t) && m(e, t, n[t]);
          return e;
        },
        x = (e, n) => o(e, r(n));
      let g = (0, a.forwardRef)((e, n) => a.createElement(i.Z, x(v({ ref: n }, e), { weights: s })));
      g.displayName = "ArrowUpRight";
    }
  }
]);
//# sourceMappingURL=3672.js.map
