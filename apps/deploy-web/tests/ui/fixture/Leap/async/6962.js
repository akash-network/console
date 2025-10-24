!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "3c03b7d3-1a4e-495d-9bce-204537bbfb6b"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-3c03b7d3-1a4e-495d-9bce-204537bbfb6b"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.22.9" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["6962"],
  {
    35415: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.r(t), a.d(t, { default: () => w });
          var s = a(52322),
            i = a(41172),
            l = a(84166),
            o = a(49183),
            r = a(74703),
            d = a(53108),
            c = a(72059),
            u = a(2784),
            x = a(10289),
            p = a(42799),
            g = a(48346),
            m = a(72565),
            b = a.n(m),
            f = a(35198),
            h = a(66675),
            y = e([g, c, f]);
          [g, c, f] = y.then ? (await y)() : y;
          let w = (e => {
            let t = () => {
              let t = (0, i.a74)(),
                a = (0, c.N8)(),
                [n, l] = (0, u.useState)(!1),
                [d, x] = (0, u.useState)(null);
              (0, u.useEffect)(() => {
                !(async function () {
                  (0, o.mq)(t) || (await a("bitcoin")), l(!0);
                })();
              }, [t]);
              let p = (0, u.useCallback)(async (e, t) => {
                if (t.id === b().runtime.id && e.type === r.u.signTransaction) {
                  let t = e.payload;
                  x(t);
                }
              }, []);
              return ((0, u.useEffect)(() => {
                if (n)
                  return (
                    b().runtime.sendMessage({ type: r.u.signingPopupOpen }),
                    b().runtime.onMessage.addListener(p),
                    () => {
                      b().runtime.onMessage.removeListener(p);
                    }
                  );
              }, [n, p]),
              d)
                ? (0, s.jsx)(e, { txnData: d })
                : (0, s.jsx)(f.gb, {});
            };
            return (t.displayName = `withBitcoinTxnSigningRequest(${e.displayName})`), t;
          })(
            u.memo(function (e) {
              let { txnData: t } = e,
                a = (0, x.s0)();
              switch (
                ((0, u.useEffect)(
                  () => (
                    window.addEventListener("beforeunload", () => (0, h.B)(a, null == t ? void 0 : t.payloadId)),
                    b().storage.local.remove(d.u1),
                    () => {
                      window.removeEventListener("beforeunload", () => (0, h.B)(a, null == t ? void 0 : t.payloadId));
                    }
                  ),
                  []
                ),
                t.signTxnData.methodType)
              ) {
                case l.z3.SEND_BITCOIN:
                  return (0, s.jsx)(f.$g, { txnData: t, rootDenomsStore: p.gb, rootBalanceStore: g.jZ });
                case l.z3.SIGN_PSBT:
                  return (0, s.jsx)(f.v5, { txnData: t, rootDenomsStore: p.gb });
                case l.z3.SIGN_PSBTS:
                  return (0, s.jsx)(f.nG, { txnData: t, rootDenomsStore: p.gb });
                case l.z3.SIGN_MESSAGE:
                  return (0, s.jsx)(f.Qi, { txnData: t });
                default:
                  return null;
              }
            })
          );
          n();
        } catch (e) {
          n(e);
        }
      });
    },
    35147: function (e, t, a) {
      a.d(t, { g: () => i });
      var n = a(52322),
        s = a(19623);
      function i() {
        return (0, n.jsx)("div", { className: "h-full w-full flex flex-col gap-4 items-center justify-center", children: (0, n.jsx)(s.T, { color: "white" }) });
      }
      a(2784);
    },
    49597: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { $: () => _ });
          var s = a(52322),
            i = a(56594),
            l = a(41172),
            o = a(15969),
            r = a(92642),
            d = a(71696),
            c = a.n(d),
            u = a(79215),
            x = a(86200),
            p = a(58885),
            g = a(19623),
            m = a(91486),
            b = a(74703),
            f = a(74229),
            h = a(72059),
            y = a(78935),
            w = a(65027),
            j = a(75958),
            v = a(2784),
            N = a(10289),
            S = a(48534),
            D = a(72565),
            k = a.n(D),
            T = a(66675),
            I = a(51426),
            E = e([w, h, p, I]);
          [w, h, p, I] = E.then ? (await E)() : E;
          let B = w.w.useGetWallet,
            _ = (0, j.Pi)(e => {
              let { txnData: t, rootDenomsStore: a, rootBalanceStore: n } = e,
                d = B(),
                w = (0, l.FmJ)(),
                j = (0, N.s0)(),
                D = (0, h.a7)(),
                E = (0, l.rTu)();
              c()(null !== E, "activeWallet is null");
              let _ = (0, l.SFn)(),
                G = null == t ? void 0 : t.origin,
                C = (0, y.G)(G),
                L = (0, f.a1)(),
                { rpcUrl: A } = (0, l.U9i)(D),
                [M, P] = (0, v.useState)(""),
                $ = (0, l.dco)(),
                R = (0, l._ty)(D),
                z = (0, v.useMemo)(() => {
                  var e;
                  return parseInt((((null === (e = $[D]) || void 0 === e ? void 0 : e.DEFAULT_GAS_IBC) ?? o.N7W.DEFAULT_GAS_IBC) * R).toString());
                }, [D, $, R]),
                [H, O] = (0, v.useState)(z),
                [W, F] = (0, v.useState)(null),
                Q = (0, p.e7)(a.allDenoms, { activeChain: D }),
                [U, Z] = (0, v.useState)({ gasPrice: Q.gasPrice, option: l.j1p.LOW }),
                [J, q] = (0, v.useState)("idle"),
                [K, X] = (0, v.useState)(null),
                [V, Y] = (0, v.useState)(!1),
                ee = l.rNU.useLogCosmosDappTx(),
                et = (0, v.useMemo)(() => {
                  let e = M ?? H;
                  if (U.gasPrice) return (0, i.calculateFee)(Math.ceil(Number(e)), U.gasPrice);
                }, [M, H, U.gasPrice]);
              (0, v.useEffect)(() => {
                !(async function () {
                  if (A) {
                    Y(!0);
                    let e = await (0, o.ZrD)(_, A),
                      t = (0, o.XWe)(e.length, 2, "p2wpkh");
                    O(t), Y(!1);
                  }
                })();
              }, [_, A]);
              let ea = (0, v.useCallback)(() => {
                  setTimeout(() => {
                    n.refetchBalances(D);
                  }, 3e3);
                }, [D, n]),
                en = async () => {
                  try {
                    if (E.walletType === l._KQ.LEDGER) throw Error("Ledger transactions are not supported yet");
                    if (et) {
                      X(null), q("loading");
                      let e = await d(D),
                        a = "bitcoin" === D ? "mainnet" : "testnet",
                        n = new o.DwL(a, e, A),
                        s = parseInt(et.amount[0].amount) / parseInt(et.gas),
                        i = e.getAccounts();
                      if (!i[0].pubkey) throw Error("No public key found");
                      let c = await n.createTransaction({
                        sourceAddress: _,
                        addressType: "p2wpkh",
                        destinationAddress: t.signTxnData.to,
                        amount: Number(t.signTxnData.amount),
                        feeRate: s,
                        pubkey: i[0].pubkey
                      });
                      try {
                        await ee({
                          txHash: c.txHex,
                          txType: l.pb0.Dapp,
                          metadata: { ...w, dapp_url: G ?? origin },
                          feeQuantity: et.amount[0].amount,
                          feeDenomination: et.amount[0].denom,
                          address: _,
                          chain: D
                        });
                      } catch (e) {
                        (0, r.Tb)(e, { extra: { extra_info: "Bitcoin dApp sendBitcoin Error -- txPostToDB: " } });
                      }
                      q("success");
                      try {
                        k().runtime.sendMessage({
                          type: b.u.signBitcoinResponse,
                          payloadId: null == t ? void 0 : t.payloadId,
                          payload: { status: "success", data: c.txId }
                        });
                      } catch {
                        throw Error("Could not send transaction to the dApp");
                      }
                      (0, S.oj)() ? (ea(), j("/home")) : window.close();
                    }
                  } catch (e) {
                    q("error"), X(e.message);
                  }
                },
                es = !!K || "loading" === J || !!W || V;
              return (0, s.jsxs)("div", {
                className: "h-full",
                children: [
                  (0, s.jsxs)(u.og, {
                    className: "bg-secondary-50",
                    subTitle: G || "Unknown site",
                    logo: C || L,
                    title: "Approve transaction",
                    children: [
                      (0, s.jsx)(p.ZP, {
                        className: "flex flex-col gap-6",
                        gasLimit: M || (null == H ? void 0 : H.toString()),
                        setGasLimit: e => P(e.toString()),
                        recommendedGasLimit: null == H ? void 0 : H.toString(),
                        gasPriceOption: U,
                        onGasPriceOptionChange: e => Z(e),
                        error: W,
                        setError: F,
                        considerGasAdjustment: !1,
                        chain: D,
                        isSeiEvmTransaction: !0,
                        rootBalanceStore: n,
                        rootDenomsStore: a,
                        children: (0, s.jsx)(I.t, { gasPriceError: W, txData: t.signTxnData.details })
                      }),
                      K && "error" === J ? (0, s.jsx)(x._, { text: K }) : null
                    ]
                  }),
                  (0, s.jsxs)("div", {
                    className: "flex items-center justify-center w-full gap-3 mt-auto [&>*]:flex-1 sticky bottom-0 p-6 bg-secondary-50",
                    children: [
                      (0, s.jsx)(m.zx, {
                        variant: "mono",
                        onClick: () => (0, T.B)(j, null == t ? void 0 : t.payloadId),
                        disabled: "loading" === J,
                        "aria-label": "sign bitcoin dapp reject button in sign bitcoin send bitcoin flow",
                        children: (0, s.jsx)("span", {
                          "aria-label": "sign bitcoin dapp reject button text in sign bitcoin send bitcoin flow",
                          children: "Reject"
                        })
                      }),
                      (0, s.jsx)(m.zx, {
                        onClick: en,
                        disabled: es,
                        className: `${es ? "cursor-not-allowed opacity-50" : ""}`,
                        "aria-label": "sign bitcoin dapp approve button in sign bitcoin send bitcoin flow",
                        children:
                          "loading" === J
                            ? (0, s.jsx)(g.T, { color: "white" })
                            : (0, s.jsx)("span", {
                                "aria-label": "sign bitcoin dapp approve button text in sign bitcoin send bitcoin flow",
                                children: "Approve"
                              })
                      })
                    ]
                  })
                ]
              });
            });
          n();
        } catch (e) {
          n(e);
        }
      });
    },
    94989: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { Q: () => T });
          var s = a(52322),
            i = a(41172),
            l = a(15969),
            o = a(71696),
            r = a.n(o),
            d = a(79215),
            c = a(86200),
            u = a(19623),
            x = a(91486),
            p = a(74703),
            g = a(4370),
            m = a(74229),
            b = a(78935),
            f = a(65027),
            h = a(2784),
            y = a(10289),
            w = a(48534),
            j = a(46338),
            v = a(43963),
            N = a(72565),
            S = a.n(N),
            D = a(66675),
            k = e([f]);
          let I = (f = (k.then ? (await k)() : k)[0]).w.useGetWallet;
          function T(e) {
            let { txnData: t } = e,
              a = I(),
              n = (0, y.s0)(),
              o = (0, i.a74)(),
              f = (0, i.rTu)();
            r()(null !== f, "activeWallet is null");
            let N = null == t ? void 0 : t.origin,
              k = (0, b.G)(N),
              T = (0, m.a1)(),
              [E, B] = (0, h.useState)("idle"),
              [_, G] = (0, h.useState)(null),
              C = async () => {
                try {
                  if (f.walletType === i._KQ.LEDGER) throw Error("Ledger transactions are not supported yet");
                  G(null), B("loading");
                  let e = await a(o),
                    s = "";
                  "bip322-simple" === t.signTxnData.type && (s = l.DwL.SignBIP322SimpleMessage(t.signTxnData.message, e)),
                    "ecdsa" === t.signTxnData.type && (s = await l.DwL.SignECDSA(t.signTxnData.message, e));
                  try {
                    S().runtime.sendMessage({
                      type: p.u.signBitcoinResponse,
                      payloadId: null == t ? void 0 : t.payloadId,
                      payload: { status: "success", data: s }
                    });
                  } catch {
                    throw Error("Could not send transaction to the dApp");
                  }
                  (0, w.oj)() ? n("/home") : window.close();
                } catch (e) {
                  B("error"), G(e.message);
                }
              },
              L = !!_ || "loading" === E;
            return (0, s.jsxs)("div", {
              className: "h-full",
              children: [
                (0, s.jsxs)(d.og, {
                  className: "bg-secondary-50",
                  title: "Signature request",
                  subTitle: N || "Unknown site",
                  logo: k || T,
                  children: [
                    (0, s.jsxs)("div", {
                      className: "flex flex-col gap-3 p-4 rounded-xl border border-secondary-200 bg-secondary-50",
                      children: [
                        (0, s.jsx)("span", { className: "text-muted-foreground text-xs font-medium", children: "Data" }),
                        (0, s.jsx)(g.E.pre, {
                          transition: j._M,
                          variants: v.dJ,
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
                    _ && "error" === E ? (0, s.jsx)(c._, { text: _, className: "mt-3" }) : null
                  ]
                }),
                (0, s.jsxs)("div", {
                  className: "flex items-center justify-center w-full gap-3 mt-auto [&>*]:flex-1 sticky bottom-0 p-6 bg-secondary-50",
                  children: [
                    (0, s.jsx)(x.zx, {
                      variant: "mono",
                      onClick: () => (0, D.B)(n, null == t ? void 0 : t.payloadId),
                      disabled: "loading" === E,
                      "aria-label": "sign bitcoin dapp reject button in sign bitcoin message flow",
                      children: (0, s.jsx)("span", { "aria-label": "sign bitcoin dapp reject button text in sign bitcoin message flow", children: "Reject" })
                    }),
                    (0, s.jsx)(x.zx, {
                      onClick: C,
                      disabled: L,
                      className: `${L ? "cursor-not-allowed opacity-50" : ""}`,
                      "aria-label": "sign bitcoin dapp approve button in sign bitcoin message flow",
                      children:
                        "loading" === E
                          ? (0, s.jsx)(u.T, { color: "white" })
                          : (0, s.jsx)("span", { "aria-label": "sign bitcoin dapp approve button text in sign bitcoin message flow", children: "Sign" })
                    })
                  ]
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
    56249: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { v: () => M });
          var s = a(52322),
            i = a(41172),
            l = a(15969),
            o = a(75377),
            r = a(8974),
            d = a(76354),
            c = a(71696),
            u = a.n(c),
            x = a(6391),
            p = a.n(x),
            g = a(72779),
            m = a.n(g),
            b = a(86200),
            f = a(78454),
            h = a(19623),
            y = a(74703),
            w = a(78935),
            j = a(65027),
            v = a(30464),
            N = a(75958),
            S = a(2784),
            D = a(10289),
            k = a(46103),
            T = a(32374),
            I = a(49409),
            E = a(48534),
            B = a(71198),
            _ = a(72565),
            G = a.n(_),
            C = a(66675),
            L = e([j, f]);
          [j, f] = L.then ? (await L)() : L;
          let A = j.w.useGetWallet,
            M = (0, N.Pi)(e => {
              var t, a, n, c, x;
              let { txnData: g, rootDenomsStore: j, isRedirected: N, handleBack: _ } = e,
                L = A(),
                M = (0, D.s0)(),
                P = (0, i.a74)(),
                $ = (0, i.QSC)(P),
                R = (0, i.rTu)();
              u()(null !== R, "activeWallet is null");
              let z = (0, S.useMemo)(() => (0, T.k)(R.name), [R.name]),
                H = null == g ? void 0 : g.origin,
                O =
                  null == H
                    ? void 0
                    : null === (n = H.split("//")) || void 0 === n
                      ? void 0
                      : null === (a = n.at(-1)) || void 0 === a
                        ? void 0
                        : null === (t = a.split(".")) || void 0 === t
                          ? void 0
                          : t.at(-2),
                W = (0, w.G)(H),
                F = (0, S.useMemo)(() => l.DwL.GetPsbtHexDetails(g.signTxnData.psbtHex, "bitcoinSignet" === P ? d.Pq : d.IB), [P, g.signTxnData.psbtHex]),
                Q = (0, S.useMemo)(() => j.allDenoms[Object.keys($.nativeDenoms)[0]], [$.nativeDenoms, j.allDenoms]),
                U = (0, i.SFn)(),
                [Z, J] = (0, S.useState)("idle"),
                [q, K] = (0, S.useState)(null),
                X = async () => {
                  try {
                    if (R.walletType === i._KQ.LEDGER) throw Error("Ledger transactions are not supported yet");
                    let e = g.signTxnData.options,
                      t = !e || !1 != e.autoFinalized;
                    K(null), J("loading");
                    let a = await L(P);
                    if (
                      (F.inputs.forEach((e, t) => {
                        if (e.tapScriptInfo) {
                          let a = e.tapScriptInfo;
                          F.tx.updateInput(t, {
                            tapMerkleRoot: a.merklePath,
                            tapScriptSig: a.controlBlock,
                            tapInternalKey: a.internalKey,
                            tapLeafScript: a.scriptTree
                          });
                        }
                        a.signIdx(U, F.tx, t);
                      }),
                      t)
                    ) {
                      for (let e = 0; e < F.inputs.length; e++) F.tx.finalizeIdx(e);
                      F.tx.extract();
                    }
                    let n = r.$v.encode(F.tx.toPSBT());
                    J("success");
                    try {
                      G().runtime.sendMessage({
                        type: y.u.signBitcoinResponse,
                        payloadId: null == g ? void 0 : g.payloadId,
                        payload: { status: "success", data: n }
                      });
                    } catch {
                      throw Error("Could not send transaction to the dApp");
                    }
                    (0, E.oj)() ? M("/home") : window.close();
                  } catch (e) {
                    J("error"), K(e.message);
                  }
                },
                V = !!q || "loading" === Z;
              return (0, s.jsx)("div", {
                className: m()("panel-width enclosing-panel h-full relative self-center justify-self-center flex justify-center items-center", {
                  "mt-2": !(0, E.oj)()
                }),
                children: (0, s.jsx)("div", {
                  className: m()("relative w-full overflow-clip rounded-md border border-gray-300 dark:border-gray-900", { "panel-height": (0, E.oj)() }),
                  children: (0, s.jsxs)(f.Z, {
                    header: (0, s.jsx)("div", {
                      className: "w-[396px]",
                      children: (0, s.jsx)(o.Header, {
                        action: N ? { type: o.HeaderActionType.BACK, onClick: _ } : void 0,
                        imgSrc: $.chainSymbolImageUrl ?? v.r.Logos.GenericLight,
                        title: (0, s.jsx)(o.Buttons.Wallet, { title: (0, B.fy)(z, 10), className: "pr-4 cursor-default" })
                      })
                    }),
                    children: [
                      (0, s.jsxs)("div", {
                        className: `px-7 py-3 overflow-y-auto relative ${N ? "h-[500px]" : "h-[450px]"}`,
                        children: [
                          (0, s.jsx)("h2", {
                            className: "text-center text-lg font-bold dark:text-white-100 text-gray-900 w-full",
                            children: N ? "Transaction Details" : "Sign Transaction"
                          }),
                          N
                            ? null
                            : (0, s.jsx)("p", {
                                className: "text-center text-sm dark:text-gray-300 text-gray-500 w-full",
                                children: "Only sign this transaction if you fully understand the content and trust the requesting site"
                              }),
                          N
                            ? null
                            : (0, s.jsxs)("div", {
                                className: "flex items-center mt-3 rounded-2xl dark:bg-gray-900 bg-white-100 p-4",
                                children: [
                                  (0, s.jsx)(o.Avatar, {
                                    avatarImage: W,
                                    avatarOnError: (0, I._)(v.r.Misc.Globe),
                                    size: "sm",
                                    className: "rounded-full overflow-hidden"
                                  }),
                                  (0, s.jsxs)("div", {
                                    className: "ml-3",
                                    children: [
                                      (0, s.jsx)("p", { className: "capitalize text-gray-900 dark:text-white-100 text-base font-bold", children: O }),
                                      (0, s.jsx)("p", { className: "lowercase text-gray-500 dark:text-gray-400 text-xs font-medium", children: H })
                                    ]
                                  })
                                ]
                              }),
                          (null == F ? void 0 : F.txAmount)
                            ? (0, s.jsxs)("p", {
                                className: "mt-3",
                                children: [
                                  (0, s.jsx)("span", { className: "font-semibold text-gray-900 dark:text-white-100 pl-1", children: "Amount" }),
                                  (0, s.jsx)("pre", {
                                    className:
                                      "text-xs text-gray-900 dark:text-white-100 dark:bg-gray-900 bg-white-100 p-4 w-full overflow-x-auto rounded-2xl mt-1",
                                    children: `${new (p())(Number(F.txAmount)).dividedBy(10 ** (Q.coinDecimals ?? 8)).toNumber()} ${$.denom}`
                                  })
                                ]
                              })
                            : null,
                          (null == F ? void 0 : F.fee)
                            ? (0, s.jsxs)("p", {
                                className: "mt-3",
                                children: [
                                  (0, s.jsx)("span", { className: "font-semibold text-gray-900 dark:text-white-100 pl-1", children: "Fee" }),
                                  (0, s.jsx)("pre", {
                                    className:
                                      "text-xs text-gray-900 dark:text-white-100 dark:bg-gray-900 bg-white-100 p-4 w-full overflow-x-auto rounded-2xl mt-1",
                                    children: `${new (p())(Number(F.fee)).dividedBy(10 ** (Q.coinDecimals ?? 8)).toNumber()} ${$.denom}`
                                  })
                                ]
                              })
                            : null,
                          (null == F ? void 0 : null === (c = F.inputs) || void 0 === c ? void 0 : c.length)
                            ? (0, s.jsxs)("p", {
                                className: "mt-3",
                                children: [
                                  (0, s.jsx)("span", { className: "font-semibold text-gray-900 dark:text-white-100 pl-1", children: "Inputs" }),
                                  (0, s.jsx)("pre", {
                                    className:
                                      "text-xs text-gray-900 dark:text-white-100 dark:bg-gray-900 bg-white-100 p-4 w-full overflow-x-auto rounded-2xl mt-1",
                                    children: JSON.stringify(
                                      F.inputs,
                                      (e, t) => {
                                        if ("tapScriptInfo" !== e)
                                          return "bigint" == typeof t
                                            ? `${new (p())(Number(t)).dividedBy(10 ** (Q.coinDecimals ?? 8)).toNumber()} ${$.denom}`
                                            : t;
                                      },
                                      2
                                    )
                                  })
                                ]
                              })
                            : null,
                          (null == F ? void 0 : null === (x = F.outputs) || void 0 === x ? void 0 : x.length)
                            ? (0, s.jsxs)("p", {
                                className: "mt-3",
                                children: [
                                  (0, s.jsx)("span", { className: "font-semibold text-gray-900 dark:text-white-100 pl-1", children: "Outputs" }),
                                  (0, s.jsx)("pre", {
                                    className:
                                      "text-xs text-gray-900 dark:text-white-100 dark:bg-gray-900 bg-white-100 p-4 w-full overflow-x-auto rounded-2xl mt-1",
                                    children: JSON.stringify(
                                      F.outputs,
                                      (e, t) =>
                                        "bigint" == typeof t ? `${new (p())(Number(t)).dividedBy(10 ** (Q.coinDecimals ?? 8)).toNumber()} ${$.denom}` : t,
                                      2
                                    )
                                  })
                                ]
                              })
                            : null,
                          q && "error" === Z ? (0, s.jsx)(b._, { text: q, className: "mt-3" }) : null
                        ]
                      }),
                      N
                        ? null
                        : (0, s.jsx)("div", {
                            className: "absolute bottom-0 left-0 py-3 px-7 dark:bg-black-100 bg-gray-50 w-full",
                            children: (0, s.jsxs)("div", {
                              className: "flex items-center justify-center w-full space-x-3",
                              children: [
                                (0, s.jsx)(o.Buttons.Generic, {
                                  title: "Reject Button",
                                  color: k.w.gray900,
                                  onClick: () => (0, C.B)(M, null == g ? void 0 : g.payloadId),
                                  disabled: "loading" === Z,
                                  "aria-label": "sign bitcoin dapp reject button in sign bitcoin psbt flow",
                                  children: (0, s.jsx)("span", {
                                    "aria-label": "sign bitcoin dapp reject button text in sign bitcoin psbt flow",
                                    children: "Reject"
                                  })
                                }),
                                (0, s.jsx)(o.Buttons.Generic, {
                                  title: "Approve Button",
                                  color: k.w.green600,
                                  onClick: X,
                                  disabled: V,
                                  className: `${V ? "cursor-not-allowed opacity-50" : ""}`,
                                  "aria-label": "sign bitcoin dapp approve button in sign bitcoin psbt flow",
                                  children:
                                    "loading" === Z
                                      ? (0, s.jsx)(h.T, { color: "white" })
                                      : (0, s.jsx)("span", {
                                          "aria-label": "sign bitcoin dapp approve button text in sign bitcoin psbt flow",
                                          children: "Sign"
                                        })
                                })
                              ]
                            })
                          })
                    ]
                  })
                })
              });
            });
          n();
        } catch (e) {
          n(e);
        }
      });
    },
    72971: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { n: () => A });
          var s = a(52322),
            i = a(41172),
            l = a(15969),
            o = a(75377),
            r = a(8974),
            d = a(76354),
            c = a(71696),
            u = a.n(c),
            x = a(72779),
            p = a.n(x),
            g = a(86200),
            m = a(78454),
            b = a(19623),
            f = a(74703),
            h = a(78935),
            y = a(65027),
            w = a(30464),
            j = a(75958),
            v = a(2784),
            N = a(10289),
            S = a(46103),
            D = a(32374),
            k = a(49409),
            T = a(48534),
            I = a(71198),
            E = a(72565),
            B = a.n(E),
            _ = a(66675),
            G = a(56249),
            C = e([y, G, m]);
          [y, G, m] = C.then ? (await C)() : C;
          let L = y.w.useGetWallet,
            A = (0, j.Pi)(e => {
              var t, a, n;
              let { txnData: c, rootDenomsStore: x } = e,
                y = L(),
                j = (0, N.s0)(),
                E = (0, i.a74)(),
                C = (0, i.QSC)(E),
                A = (0, i.rTu)();
              u()(null !== A, "activeWallet is null");
              let M = (0, v.useMemo)(() => (0, D.k)(A.name), [A.name]),
                P = null == c ? void 0 : c.origin,
                $ =
                  null == P
                    ? void 0
                    : null === (n = P.split("//")) || void 0 === n
                      ? void 0
                      : null === (a = n.at(-1)) || void 0 === a
                        ? void 0
                        : null === (t = a.split(".")) || void 0 === t
                          ? void 0
                          : t.at(-2),
                R = (0, h.G)(P),
                z = (0, v.useMemo)(
                  () => c.signTxnData.psbtsHexes.map(e => l.DwL.GetPsbtHexDetails(e, "bitcoinSignet" === E ? d.Pq : d.IB)),
                  [E, c.signTxnData.psbtsHexes]
                ),
                H = (0, i.SFn)(),
                [O, W] = (0, v.useState)("idle"),
                [F, Q] = (0, v.useState)(null),
                [U, Z] = (0, v.useState)(null),
                J = async () => {
                  try {
                    if (A.walletType === i._KQ.LEDGER) throw Error("Ledger transactions are not supported yet");
                    Q(null), W("loading");
                    let e = await y(E),
                      t = [];
                    for (let a of z) {
                      a.inputs.forEach((t, n) => {
                        e.signIdx(H, a.tx, n);
                      });
                      for (let e = 0; e < a.inputs.length; e++) z.tx.finalizeIdx(e);
                      t.push(r.$v.encode(a.tx.extract()));
                    }
                    W("success");
                    try {
                      B().runtime.sendMessage({
                        type: f.u.signBitcoinResponse,
                        payloadId: null == c ? void 0 : c.payloadId,
                        payload: { status: "success", data: t }
                      });
                    } catch {
                      throw Error("Could not send transaction to the dApp");
                    }
                    (0, T.oj)() ? j("/home") : window.close();
                  } catch (e) {
                    W("error"), Q(e.message);
                  }
                },
                q = !!F || "loading" === O;
              return null !== U
                ? (0, s.jsx)(G.v, {
                    txnData: { ...c, signTxnData: { psbtHex: c.signTxnData.psbtsHexes[U] } },
                    rootDenomsStore: x,
                    isRedirected: !0,
                    handleBack: () => Z(null)
                  })
                : (0, s.jsx)("div", {
                    className: p()("panel-width enclosing-panel h-full relative self-center justify-self-center flex justify-center items-center", {
                      "mt-2": !(0, T.oj)()
                    }),
                    children: (0, s.jsx)("div", {
                      className: p()("relative w-full overflow-clip rounded-md border border-gray-300 dark:border-gray-900", { "panel-height": (0, T.oj)() }),
                      children: (0, s.jsxs)(m.Z, {
                        header: (0, s.jsx)("div", {
                          className: "w-[396px]",
                          children: (0, s.jsx)(o.Header, {
                            imgSrc: C.chainSymbolImageUrl ?? w.r.Logos.GenericLight,
                            title: (0, s.jsx)(o.Buttons.Wallet, { title: (0, I.fy)(M, 10), className: "pr-4 cursor-default" })
                          })
                        }),
                        children: [
                          (0, s.jsxs)("div", {
                            className: "px-7 py-3 overflow-y-auto relative h-[450px]",
                            children: [
                              (0, s.jsx)("h2", {
                                className: "text-center text-lg font-bold dark:text-white-100 text-gray-900 w-full",
                                children: "Sign Multiple Transactions"
                              }),
                              (0, s.jsx)("p", {
                                className: "text-center text-sm dark:text-gray-300 text-gray-500 w-full",
                                children: "Only sign these transactions if you fully understand the content and trust the requesting site"
                              }),
                              (0, s.jsxs)("div", {
                                className: "flex items-center mt-3 rounded-2xl dark:bg-gray-900 bg-white-100 p-4",
                                children: [
                                  (0, s.jsx)(o.Avatar, {
                                    avatarImage: R,
                                    avatarOnError: (0, k._)(w.r.Misc.Globe),
                                    size: "sm",
                                    className: "rounded-full overflow-hidden"
                                  }),
                                  (0, s.jsxs)("div", {
                                    className: "ml-3",
                                    children: [
                                      (0, s.jsx)("p", { className: "capitalize text-gray-900 dark:text-white-100 text-base font-bold", children: $ }),
                                      (0, s.jsx)("p", { className: "lowercase text-gray-500 dark:text-gray-400 text-xs font-medium", children: P })
                                    ]
                                  })
                                ]
                              }),
                              c.signTxnData.psbtsHexes.length
                                ? c.signTxnData.psbtsHexes.map((e, t) =>
                                    (0, s.jsxs)(
                                      "div",
                                      {
                                        className: "flex items-center justify-between gap-4 dark:bg-gray-900 bg-white-100 p-4 rounded-2xl mt-3",
                                        children: [
                                          (0, s.jsxs)("p", {
                                            className: "flex flex-col text-gray-900 dark:text-white-100",
                                            children: [
                                              (0, s.jsxs)("span", { className: "font-semibold", children: ["Transaction ", t + 1] }),
                                              (0, s.jsx)("span", { children: (0, I.Hn)(e, 7) })
                                            ]
                                          }),
                                          (0, s.jsx)("button", {
                                            className: "rounded-lg text-white-100 py-[4px] px-[12px] font-semibold",
                                            style: { backgroundColor: S.w.getChainColor(E) },
                                            onClick: () => Z(t),
                                            children: "View"
                                          })
                                        ]
                                      },
                                      `${e}--${t}`
                                    )
                                  )
                                : null,
                              F && "error" === O ? (0, s.jsx)(g._, { text: F, className: "mt-3" }) : null
                            ]
                          }),
                          (0, s.jsx)("div", {
                            className: "absolute bottom-0 left-0 py-3 px-7 dark:bg-black-100 bg-gray-50 w-full",
                            children: (0, s.jsxs)("div", {
                              className: "flex items-center justify-center w-full space-x-3",
                              children: [
                                (0, s.jsx)(o.Buttons.Generic, {
                                  title: "Reject Button",
                                  color: S.w.gray900,
                                  onClick: () => (0, _.B)(j, null == c ? void 0 : c.payloadId),
                                  disabled: "loading" === O,
                                  "aria-label": "sign bitcoin dapp reject button in sign bitcoin psbts flow",
                                  children: (0, s.jsx)("span", {
                                    "aria-label": "sign bitcoin dapp reject button text in sign bitcoin psbts flow",
                                    children: "Reject"
                                  })
                                }),
                                (0, s.jsx)(o.Buttons.Generic, {
                                  title: "Approve Button",
                                  color: S.w.green600,
                                  onClick: J,
                                  disabled: q,
                                  className: `${q ? "cursor-not-allowed opacity-50" : ""}`,
                                  "aria-label": "sign bitcoin dapp approve button in sign bitcoin psbts flow",
                                  children:
                                    "loading" === O
                                      ? (0, s.jsx)(b.T, { color: "white" })
                                      : (0, s.jsx)("span", {
                                          "aria-label": "sign bitcoin dapp approve button text in sign bitcoin psbts flow",
                                          children: "Sign"
                                        })
                                })
                              ]
                            })
                          })
                        ]
                      })
                    })
                  });
            });
          n();
        } catch (e) {
          n(e);
        }
      });
    },
    35198: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { $g: () => i.$, Qi: () => l.Q, gb: () => s.g, nG: () => r.n, v5: () => o.v });
          var s = a(35147),
            i = a(49597),
            l = a(94989),
            o = a(56249),
            r = a(72971),
            d = e([i, l, o, r]);
          ([i, l, o, r] = d.then ? (await d)() : d), n();
        } catch (e) {
          n(e);
        }
      });
    },
    51426: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { t: () => f });
          var s = a(52322),
            i = a(58885),
            l = a(4370),
            o = a(14981),
            r = a(25053),
            d = a(2784),
            c = a(42799),
            u = a(48346),
            x = a(46338),
            p = a(43963),
            g = e([i, u]);
          [i, u] = g.then ? (await g)() : g;
          let m = [
              { id: "fees", label: "Fees" },
              { id: "details", label: "Details" }
            ],
            b = { transform: "translateX(0px) scaleX(0.161044)" },
            f = e => {
              let [t, a] = (0, d.useState)(m[0]);
              return (0, s.jsxs)(s.Fragment, {
                children: [
                  (0, s.jsx)("div", {
                    className: "border-b border-border-bottom",
                    children: (0, s.jsx)(r.z, {
                      buttons: m,
                      setSelectedTab: a,
                      selectedIndex: m.findIndex(e => {
                        let { id: a } = e;
                        return a === t.id;
                      }),
                      className: "gap-0.5",
                      buttonClassName: "px-3.5",
                      indicatorDefaultScale: b
                    })
                  }),
                  (0, s.jsx)("div", {
                    className: "flex flex-col gap-6",
                    children: (0, s.jsxs)(o.M, {
                      mode: "wait",
                      initial: !1,
                      children: [
                        "fees" === t.id &&
                          (0, s.jsxs)(
                            l.E.div,
                            {
                              className: "flex flex-col gap-7",
                              transition: x._M,
                              variants: p.dJ,
                              initial: "exit",
                              animate: "animate",
                              exit: "exit",
                              children: [
                                (0, s.jsx)(i.ZP.Selector, {}),
                                (0, s.jsxs)("div", {
                                  className: "border border-border-bottom rounded-xl ",
                                  children: [
                                    (0, s.jsx)(i.ZP.AdditionalSettingsToggle, {}),
                                    (0, s.jsx)(i.ZP.AdditionalSettings, { showGasLimitWarning: !0, rootBalanceStore: u.jZ, rootDenomsStore: c.gb })
                                  ]
                                }),
                                !!e.gasPriceError &&
                                  (0, s.jsx)("p", { className: "text-destructive-100 text-sm font-medium mt-2 px-1", children: e.gasPriceError })
                              ]
                            },
                            "fees"
                          ),
                        "details" === t.id &&
                          (0, s.jsxs)("div", {
                            className: "flex flex-col gap-3 p-4 rounded-xl border border-secondary-200 bg-secondary-50",
                            children: [
                              (0, s.jsx)("span", { className: "text-muted-foreground text-xs font-medium", children: "Data" }),
                              (0, s.jsx)(
                                l.E.pre,
                                {
                                  transition: x._M,
                                  variants: p.dJ,
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
          n();
        } catch (e) {
          n(e);
        }
      });
    },
    66675: function (e, t, a) {
      a.d(t, { B: () => o });
      var n = a(74703),
        s = a(48534),
        i = a(72565),
        l = a.n(i);
      async function o(e, t) {
        await l().runtime.sendMessage({ type: n.u.signBitcoinResponse, payloadId: t, payload: { status: "error", data: "User rejected the transaction" } }),
          (0, s.oj)() ? e("/home") : window.close();
      }
    }
  }
]);
//# sourceMappingURL=6962.js.map
