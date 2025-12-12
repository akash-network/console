!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "b9a5edc4-7406-430b-b71a-1051a6287681"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-b9a5edc4-7406-430b-b71a-1051a6287681"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.23.1" };
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
            r = a(84166),
            l = a(49183),
            o = a(74703),
            c = a(53108),
            d = a(72059),
            u = a(2784),
            p = a(10289),
            x = a(42799),
            g = a(48346),
            m = a(72565),
            b = a.n(m),
            f = a(35198),
            h = a(66675),
            y = e([g, d, f]);
          [g, d, f] = y.then ? (await y)() : y;
          let w = (e => {
            let t = () => {
              let t = (0, i.a74)(),
                a = (0, d.N8)(),
                [n, r] = (0, u.useState)(!1),
                [c, p] = (0, u.useState)(null);
              (0, u.useEffect)(() => {
                !(async function () {
                  (0, l.mq)(t) || (await a("bitcoin")), r(!0);
                })();
              }, [t]);
              let x = (0, u.useCallback)(async (e, t) => {
                if (t.id === b().runtime.id && e.type === o.u.signTransaction) {
                  let t = e.payload;
                  p(t);
                }
              }, []);
              return ((0, u.useEffect)(() => {
                if (n)
                  return (
                    b().runtime.sendMessage({ type: o.u.signingPopupOpen }),
                    b().runtime.onMessage.addListener(x),
                    () => {
                      b().runtime.onMessage.removeListener(x);
                    }
                  );
              }, [n, x]),
              c)
                ? (0, s.jsx)(e, { txnData: c })
                : (0, s.jsx)(f.gb, {});
            };
            return (t.displayName = `withBitcoinTxnSigningRequest(${e.displayName})`), t;
          })(
            u.memo(function (e) {
              let { txnData: t } = e,
                a = (0, p.s0)();
              switch (
                ((0, u.useEffect)(
                  () => (
                    window.addEventListener("beforeunload", () => (0, h.B)(a, null == t ? void 0 : t.payloadId)),
                    b().storage.local.remove(c.u1),
                    () => {
                      window.removeEventListener("beforeunload", () => (0, h.B)(a, null == t ? void 0 : t.payloadId));
                    }
                  ),
                  []
                ),
                t.signTxnData.methodType)
              ) {
                case r.z3.SEND_BITCOIN:
                  return (0, s.jsx)(f.$g, { txnData: t, rootDenomsStore: x.gb, rootBalanceStore: g.jZ });
                case r.z3.SIGN_PSBT:
                  return (0, s.jsx)(f.v5, { txnData: t, rootDenomsStore: x.gb });
                case r.z3.SIGN_PSBTS:
                  return (0, s.jsx)(f.nG, { txnData: t, rootDenomsStore: x.gb });
                case r.z3.SIGN_MESSAGE:
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
          a.d(t, { $: () => I });
          var s = a(52322),
            i = a(56594),
            r = a(41172),
            l = a(15969),
            o = a(92642),
            c = a(71696),
            d = a.n(c),
            u = a(79215),
            p = a(86200),
            x = a(58885),
            g = a(19623),
            m = a(91486),
            b = a(74703),
            f = a(74229),
            h = a(72059),
            y = a(78935),
            w = a(65027),
            v = a(75958),
            j = a(2784),
            N = a(10289),
            S = a(48534),
            T = a(72565),
            D = a.n(T),
            k = a(66675),
            _ = a(51426),
            E = e([w, h, x, _]);
          [w, h, x, _] = E.then ? (await E)() : E;
          let B = w.w.useGetWallet,
            I = (0, v.Pi)(e => {
              let { txnData: t, rootDenomsStore: a, rootBalanceStore: n } = e,
                c = B(),
                w = (0, r.FmJ)(),
                v = (0, N.s0)(),
                T = (0, h.a7)(),
                E = (0, r.rTu)();
              d()(null !== E, "activeWallet is null");
              let I = (0, r.SFn)(),
                C = null == t ? void 0 : t.origin,
                G = (0, y.G)(C),
                M = (0, f.a1)(),
                { rpcUrl: L } = (0, r.U9i)(T),
                [A, P] = (0, j.useState)(""),
                $ = (0, r.dco)(),
                R = (0, r._ty)(T),
                z = (0, j.useMemo)(() => {
                  var e;
                  return parseInt((((null === (e = $[T]) || void 0 === e ? void 0 : e.DEFAULT_GAS_IBC) ?? l.N7W.DEFAULT_GAS_IBC) * R).toString());
                }, [T, $, R]),
                [H, O] = (0, j.useState)(z),
                [W, F] = (0, j.useState)(null),
                Q = (0, x.e7)(a.allDenoms, { activeChain: T }),
                [U, Z] = (0, j.useState)({ gasPrice: Q.gasPrice, option: r.j1p.LOW }),
                [J, q] = (0, j.useState)("idle"),
                [K, X] = (0, j.useState)(null),
                [V, Y] = (0, j.useState)(!1),
                ee = r.rNU.useLogCosmosDappTx(),
                et = (0, j.useMemo)(() => {
                  let e = A ?? H;
                  if (U.gasPrice) return (0, i.calculateFee)(Math.ceil(Number(e)), U.gasPrice);
                }, [A, H, U.gasPrice]);
              (0, j.useEffect)(() => {
                !(async function () {
                  if (L) {
                    Y(!0);
                    let e = await (0, l.ZrD)(I, L),
                      t = (0, l.XWe)(e.length, 2, "p2wpkh");
                    O(t), Y(!1);
                  }
                })();
              }, [I, L]);
              let ea = (0, j.useCallback)(() => {
                  setTimeout(() => {
                    n.refetchBalances(T);
                  }, 3e3);
                }, [T, n]),
                en = async () => {
                  try {
                    if (E.walletType === r._KQ.LEDGER) throw Error("Ledger transactions are not supported yet");
                    if (et) {
                      X(null), q("loading");
                      let e = await c(T),
                        a = "bitcoin" === T ? "mainnet" : "testnet",
                        n = new l.DwL(a, e, L),
                        s = parseInt(et.amount[0].amount) / parseInt(et.gas),
                        i = e.getAccounts();
                      if (!i[0].pubkey) throw Error("No public key found");
                      let d = await n.createTransaction({
                        sourceAddress: I,
                        addressType: "p2wpkh",
                        destinationAddress: t.signTxnData.to,
                        amount: Number(t.signTxnData.amount),
                        feeRate: s,
                        pubkey: i[0].pubkey
                      });
                      try {
                        await ee({
                          txHash: d.txHex,
                          txType: r.pb0.Dapp,
                          metadata: { ...w, dapp_url: C ?? origin },
                          feeQuantity: et.amount[0].amount,
                          feeDenomination: et.amount[0].denom,
                          address: I,
                          chain: T
                        });
                      } catch (e) {
                        (0, o.Tb)(e, { extra: { extra_info: "Bitcoin dApp sendBitcoin Error -- txPostToDB: " } });
                      }
                      q("success");
                      try {
                        D().runtime.sendMessage({
                          type: b.u.signBitcoinResponse,
                          payloadId: null == t ? void 0 : t.payloadId,
                          payload: { status: "success", data: d.txId }
                        });
                      } catch {
                        throw Error("Could not send transaction to the dApp");
                      }
                      (0, S.oj)() ? (ea(), v("/home")) : window.close();
                    }
                  } catch (e) {
                    q("error"),
                      X(e.message),
                      (0, o.Tb)(e, {
                        tags: {
                          errorType: "bitcoin_transaction_error",
                          source: "send_bitcoin",
                          severity: "error",
                          errorName: e instanceof Error ? e.name : "BitcoinTransactionError"
                        },
                        fingerprint: ["send_bitcoin", "send_bitcoin_error"],
                        level: "error",
                        contexts: { transaction: { type: "send_bitcoin", errorMessage: e instanceof Error ? e.message : String(e) } },
                        extra: { chain: T, address: I, amount: t.signTxnData.amount, fee: et, memo: t.signTxnData.memo }
                      });
                  }
                },
                es = !!K || "loading" === J || !!W || V;
              return (0, s.jsxs)("div", {
                className: "h-full",
                children: [
                  (0, s.jsxs)(u.og, {
                    className: "bg-secondary-50",
                    subTitle: C || "Unknown site",
                    logo: G || M,
                    title: "Approve transaction",
                    children: [
                      (0, s.jsx)(x.ZP, {
                        className: "flex flex-col gap-6",
                        gasLimit: A || (null == H ? void 0 : H.toString()),
                        setGasLimit: e => P(e.toString()),
                        recommendedGasLimit: null == H ? void 0 : H.toString(),
                        gasPriceOption: U,
                        onGasPriceOptionChange: e => Z(e),
                        error: W,
                        setError: F,
                        considerGasAdjustment: !1,
                        chain: T,
                        isSeiEvmTransaction: !0,
                        rootBalanceStore: n,
                        rootDenomsStore: a,
                        children: (0, s.jsx)(_.t, { gasPriceError: W, txData: t.signTxnData.details })
                      }),
                      K && "error" === J ? (0, s.jsx)(p._, { text: K, disableSentryCapture: !0 }) : null
                    ]
                  }),
                  (0, s.jsxs)("div", {
                    className: "flex items-center justify-center w-full gap-3 mt-auto [&>*]:flex-1 sticky bottom-0 p-6 bg-secondary-50",
                    children: [
                      (0, s.jsx)(m.zx, {
                        variant: "mono",
                        onClick: () => (0, k.B)(v, null == t ? void 0 : t.payloadId),
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
          a.d(t, { Q: () => _ });
          var s = a(52322),
            i = a(41172),
            r = a(15969),
            l = a(92642),
            o = a(71696),
            c = a.n(o),
            d = a(79215),
            u = a(86200),
            p = a(19623),
            x = a(91486),
            g = a(74703),
            m = a(4370),
            b = a(74229),
            f = a(78935),
            h = a(65027),
            y = a(2784),
            w = a(10289),
            v = a(48534),
            j = a(46338),
            N = a(43963),
            S = a(72565),
            T = a.n(S),
            D = a(66675),
            k = e([h]);
          let E = (h = (k.then ? (await k)() : k)[0]).w.useGetWallet;
          function _(e) {
            let { txnData: t } = e,
              a = E(),
              n = (0, w.s0)(),
              o = (0, i.a74)(),
              h = (0, i.rTu)();
            c()(null !== h, "activeWallet is null");
            let S = null == t ? void 0 : t.origin,
              k = (0, f.G)(S),
              _ = (0, b.a1)(),
              [B, I] = (0, y.useState)("idle"),
              [C, G] = (0, y.useState)(null),
              M = async () => {
                try {
                  if (h.walletType === i._KQ.LEDGER) throw Error("Ledger transactions are not supported yet");
                  G(null), I("loading");
                  let e = await a(o),
                    s = "";
                  "bip322-simple" === t.signTxnData.type && (s = r.DwL.SignBIP322SimpleMessage(t.signTxnData.message, e)),
                    "ecdsa" === t.signTxnData.type && (s = await r.DwL.SignECDSA(t.signTxnData.message, e));
                  try {
                    T().runtime.sendMessage({
                      type: g.u.signBitcoinResponse,
                      payloadId: null == t ? void 0 : t.payloadId,
                      payload: { status: "success", data: s }
                    });
                  } catch {
                    throw Error("Could not send transaction to the dApp");
                  }
                  (0, v.oj)() ? n("/home") : window.close();
                } catch (e) {
                  I("error"),
                    G(e.message),
                    (0, l.Tb)(e, {
                      tags: {
                        errorType: "bitcoin_transaction_error",
                        source: "sign_message",
                        severity: "error",
                        errorName: e instanceof Error ? e.name : "BitcoinTransactionError"
                      },
                      fingerprint: ["sign_message", "sign_message_error"],
                      level: "error",
                      contexts: { transaction: { type: "sign_message", errorMessage: e instanceof Error ? e.message : String(e) } },
                      extra: { chain: o, message: t.signTxnData.message }
                    });
                }
              },
              L = !!C || "loading" === B;
            return (0, s.jsxs)("div", {
              className: "h-full",
              children: [
                (0, s.jsxs)(d.og, {
                  className: "bg-secondary-50",
                  title: "Signature request",
                  subTitle: S || "Unknown site",
                  logo: k || _,
                  children: [
                    (0, s.jsxs)("div", {
                      className: "flex flex-col gap-3 p-4 rounded-xl border border-secondary-200 bg-secondary-50",
                      children: [
                        (0, s.jsx)("span", { className: "text-muted-foreground text-xs font-medium", children: "Data" }),
                        (0, s.jsx)(m.E.pre, {
                          transition: j._M,
                          variants: N.dJ,
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
                    C && "error" === B ? (0, s.jsx)(u._, { text: C, disableSentryCapture: !0, className: "mt-3" }) : null
                  ]
                }),
                (0, s.jsxs)("div", {
                  className: "flex items-center justify-center w-full gap-3 mt-auto [&>*]:flex-1 sticky bottom-0 p-6 bg-secondary-50",
                  children: [
                    (0, s.jsx)(x.zx, {
                      variant: "mono",
                      onClick: () => (0, D.B)(n, null == t ? void 0 : t.payloadId),
                      disabled: "loading" === B,
                      "aria-label": "sign bitcoin dapp reject button in sign bitcoin message flow",
                      children: (0, s.jsx)("span", { "aria-label": "sign bitcoin dapp reject button text in sign bitcoin message flow", children: "Reject" })
                    }),
                    (0, s.jsx)(x.zx, {
                      onClick: M,
                      disabled: L,
                      className: `${L ? "cursor-not-allowed opacity-50" : ""}`,
                      "aria-label": "sign bitcoin dapp approve button in sign bitcoin message flow",
                      children:
                        "loading" === B
                          ? (0, s.jsx)(p.T, { color: "white" })
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
          a.d(t, { v: () => P });
          var s = a(52322),
            i = a(41172),
            r = a(15969),
            l = a(75377),
            o = a(8974),
            c = a(76354),
            d = a(92642),
            u = a(71696),
            p = a.n(u),
            x = a(6391),
            g = a.n(x),
            m = a(72779),
            b = a.n(m),
            f = a(86200),
            h = a(78454),
            y = a(19623),
            w = a(74703),
            v = a(78935),
            j = a(65027),
            N = a(30464),
            S = a(75958),
            T = a(2784),
            D = a(10289),
            k = a(46103),
            _ = a(32374),
            E = a(49409),
            B = a(48534),
            I = a(71198),
            C = a(72565),
            G = a.n(C),
            M = a(66675),
            L = e([j, h]);
          [j, h] = L.then ? (await L)() : L;
          let A = j.w.useGetWallet,
            P = (0, S.Pi)(e => {
              var t, a, n, u, x;
              let { txnData: m, rootDenomsStore: j, isRedirected: S, handleBack: C } = e,
                L = A(),
                P = (0, D.s0)(),
                $ = (0, i.a74)(),
                R = (0, i.QSC)($),
                z = (0, i.rTu)();
              p()(null !== z, "activeWallet is null");
              let H = (0, T.useMemo)(() => (0, _.k)(z.name), [z.name]),
                O = null == m ? void 0 : m.origin,
                W =
                  null == O
                    ? void 0
                    : null === (n = O.split("//")) || void 0 === n
                      ? void 0
                      : null === (a = n.at(-1)) || void 0 === a
                        ? void 0
                        : null === (t = a.split(".")) || void 0 === t
                          ? void 0
                          : t.at(-2),
                F = (0, v.G)(O),
                Q = (0, T.useMemo)(() => r.DwL.GetPsbtHexDetails(m.signTxnData.psbtHex, "bitcoinSignet" === $ ? c.Pq : c.IB), [$, m.signTxnData.psbtHex]),
                U = (0, T.useMemo)(() => j.allDenoms[Object.keys(R.nativeDenoms)[0]], [R.nativeDenoms, j.allDenoms]),
                Z = (0, i.SFn)(),
                [J, q] = (0, T.useState)("idle"),
                [K, X] = (0, T.useState)(null),
                V = async () => {
                  try {
                    if (z.walletType === i._KQ.LEDGER) throw Error("Ledger transactions are not supported yet");
                    let e = m.signTxnData.options,
                      t = !e || !1 != e.autoFinalized;
                    X(null), q("loading");
                    let a = await L($);
                    if (
                      (Q.inputs.forEach((e, t) => {
                        if (e.tapScriptInfo) {
                          let a = e.tapScriptInfo;
                          Q.tx.updateInput(t, {
                            tapMerkleRoot: a.merklePath,
                            tapScriptSig: a.controlBlock,
                            tapInternalKey: a.internalKey,
                            tapLeafScript: a.scriptTree
                          });
                        }
                        a.signIdx(Z, Q.tx, t);
                      }),
                      t)
                    ) {
                      for (let e = 0; e < Q.inputs.length; e++) Q.tx.finalizeIdx(e);
                      Q.tx.extract();
                    }
                    let n = o.$v.encode(Q.tx.toPSBT());
                    q("success");
                    try {
                      G().runtime.sendMessage({
                        type: w.u.signBitcoinResponse,
                        payloadId: null == m ? void 0 : m.payloadId,
                        payload: { status: "success", data: n }
                      });
                    } catch {
                      throw Error("Could not send transaction to the dApp");
                    }
                    (0, B.oj)() ? P("/home") : window.close();
                  } catch (e) {
                    q("error"),
                      X(e.message),
                      (0, d.Tb)(e, {
                        tags: {
                          errorType: "bitcoin_transaction_error",
                          source: "sign_psbt",
                          severity: "error",
                          errorName: e instanceof Error ? e.name : "BitcoinTransactionError"
                        },
                        fingerprint: ["sign_psbt", "sign_psbt_error"],
                        level: "error",
                        contexts: { transaction: { type: "sign_psbt", errorMessage: e instanceof Error ? e.message : String(e) } },
                        extra: { chain: $ }
                      });
                  }
                },
                Y = !!K || "loading" === J;
              return (0, s.jsx)("div", {
                className: b()("panel-width enclosing-panel h-full relative self-center justify-self-center flex justify-center items-center", {
                  "mt-2": !(0, B.oj)()
                }),
                children: (0, s.jsx)("div", {
                  className: b()("relative w-full overflow-clip rounded-md border border-gray-300 dark:border-gray-900", { "panel-height": (0, B.oj)() }),
                  children: (0, s.jsxs)(h.Z, {
                    header: (0, s.jsx)("div", {
                      className: "w-[396px]",
                      children: (0, s.jsx)(l.Header, {
                        action: S ? { type: l.HeaderActionType.BACK, onClick: C } : void 0,
                        imgSrc: R.chainSymbolImageUrl ?? N.r.Logos.GenericLight,
                        title: (0, s.jsx)(l.Buttons.Wallet, { title: (0, I.fy)(H, 10), className: "pr-4 cursor-default" })
                      })
                    }),
                    children: [
                      (0, s.jsxs)("div", {
                        className: `px-7 py-3 overflow-y-auto relative ${S ? "h-[500px]" : "h-[450px]"}`,
                        children: [
                          (0, s.jsx)("h2", {
                            className: "text-center text-lg font-bold dark:text-white-100 text-gray-900 w-full",
                            children: S ? "Transaction Details" : "Sign Transaction"
                          }),
                          S
                            ? null
                            : (0, s.jsx)("p", {
                                className: "text-center text-sm dark:text-gray-300 text-gray-500 w-full",
                                children: "Only sign this transaction if you fully understand the content and trust the requesting site"
                              }),
                          S
                            ? null
                            : (0, s.jsxs)("div", {
                                className: "flex items-center mt-3 rounded-2xl dark:bg-gray-900 bg-white-100 p-4",
                                children: [
                                  (0, s.jsx)(l.Avatar, {
                                    avatarImage: F,
                                    avatarOnError: (0, E._)(N.r.Misc.Globe),
                                    size: "sm",
                                    className: "rounded-full overflow-hidden"
                                  }),
                                  (0, s.jsxs)("div", {
                                    className: "ml-3",
                                    children: [
                                      (0, s.jsx)("p", { className: "capitalize text-gray-900 dark:text-white-100 text-base font-bold", children: W }),
                                      (0, s.jsx)("p", { className: "lowercase text-gray-500 dark:text-gray-400 text-xs font-medium", children: O })
                                    ]
                                  })
                                ]
                              }),
                          (null == Q ? void 0 : Q.txAmount)
                            ? (0, s.jsxs)("p", {
                                className: "mt-3",
                                children: [
                                  (0, s.jsx)("span", { className: "font-semibold text-gray-900 dark:text-white-100 pl-1", children: "Amount" }),
                                  (0, s.jsx)("pre", {
                                    className:
                                      "text-xs text-gray-900 dark:text-white-100 dark:bg-gray-900 bg-white-100 p-4 w-full overflow-x-auto rounded-2xl mt-1",
                                    children: `${new (g())(Number(Q.txAmount)).dividedBy(10 ** (U.coinDecimals ?? 8)).toNumber()} ${R.denom}`
                                  })
                                ]
                              })
                            : null,
                          (null == Q ? void 0 : Q.fee)
                            ? (0, s.jsxs)("p", {
                                className: "mt-3",
                                children: [
                                  (0, s.jsx)("span", { className: "font-semibold text-gray-900 dark:text-white-100 pl-1", children: "Fee" }),
                                  (0, s.jsx)("pre", {
                                    className:
                                      "text-xs text-gray-900 dark:text-white-100 dark:bg-gray-900 bg-white-100 p-4 w-full overflow-x-auto rounded-2xl mt-1",
                                    children: `${new (g())(Number(Q.fee)).dividedBy(10 ** (U.coinDecimals ?? 8)).toNumber()} ${R.denom}`
                                  })
                                ]
                              })
                            : null,
                          (null == Q ? void 0 : null === (u = Q.inputs) || void 0 === u ? void 0 : u.length)
                            ? (0, s.jsxs)("p", {
                                className: "mt-3",
                                children: [
                                  (0, s.jsx)("span", { className: "font-semibold text-gray-900 dark:text-white-100 pl-1", children: "Inputs" }),
                                  (0, s.jsx)("pre", {
                                    className:
                                      "text-xs text-gray-900 dark:text-white-100 dark:bg-gray-900 bg-white-100 p-4 w-full overflow-x-auto rounded-2xl mt-1",
                                    children: JSON.stringify(
                                      Q.inputs,
                                      (e, t) => {
                                        if ("tapScriptInfo" !== e)
                                          return "bigint" == typeof t
                                            ? `${new (g())(Number(t)).dividedBy(10 ** (U.coinDecimals ?? 8)).toNumber()} ${R.denom}`
                                            : t;
                                      },
                                      2
                                    )
                                  })
                                ]
                              })
                            : null,
                          (null == Q ? void 0 : null === (x = Q.outputs) || void 0 === x ? void 0 : x.length)
                            ? (0, s.jsxs)("p", {
                                className: "mt-3",
                                children: [
                                  (0, s.jsx)("span", { className: "font-semibold text-gray-900 dark:text-white-100 pl-1", children: "Outputs" }),
                                  (0, s.jsx)("pre", {
                                    className:
                                      "text-xs text-gray-900 dark:text-white-100 dark:bg-gray-900 bg-white-100 p-4 w-full overflow-x-auto rounded-2xl mt-1",
                                    children: JSON.stringify(
                                      Q.outputs,
                                      (e, t) =>
                                        "bigint" == typeof t ? `${new (g())(Number(t)).dividedBy(10 ** (U.coinDecimals ?? 8)).toNumber()} ${R.denom}` : t,
                                      2
                                    )
                                  })
                                ]
                              })
                            : null,
                          K && "error" === J ? (0, s.jsx)(f._, { text: K, disableSentryCapture: !0, className: "mt-3" }) : null
                        ]
                      }),
                      S
                        ? null
                        : (0, s.jsx)("div", {
                            className: "absolute bottom-0 left-0 py-3 px-7 dark:bg-black-100 bg-gray-50 w-full",
                            children: (0, s.jsxs)("div", {
                              className: "flex items-center justify-center w-full space-x-3",
                              children: [
                                (0, s.jsx)(l.Buttons.Generic, {
                                  title: "Reject Button",
                                  color: k.w.gray900,
                                  onClick: () => (0, M.B)(P, null == m ? void 0 : m.payloadId),
                                  disabled: "loading" === J,
                                  "aria-label": "sign bitcoin dapp reject button in sign bitcoin psbt flow",
                                  children: (0, s.jsx)("span", {
                                    "aria-label": "sign bitcoin dapp reject button text in sign bitcoin psbt flow",
                                    children: "Reject"
                                  })
                                }),
                                (0, s.jsx)(l.Buttons.Generic, {
                                  title: "Approve Button",
                                  color: k.w.green600,
                                  onClick: V,
                                  disabled: Y,
                                  className: `${Y ? "cursor-not-allowed opacity-50" : ""}`,
                                  "aria-label": "sign bitcoin dapp approve button in sign bitcoin psbt flow",
                                  children:
                                    "loading" === J
                                      ? (0, s.jsx)(y.T, { color: "white" })
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
            r = a(15969),
            l = a(75377),
            o = a(8974),
            c = a(76354),
            d = a(92642),
            u = a(71696),
            p = a.n(u),
            x = a(72779),
            g = a.n(x),
            m = a(86200),
            b = a(78454),
            f = a(19623),
            h = a(74703),
            y = a(78935),
            w = a(65027),
            v = a(30464),
            j = a(75958),
            N = a(2784),
            S = a(10289),
            T = a(46103),
            D = a(32374),
            k = a(49409),
            _ = a(48534),
            E = a(71198),
            B = a(72565),
            I = a.n(B),
            C = a(66675),
            G = a(56249),
            M = e([w, G, b]);
          [w, G, b] = M.then ? (await M)() : M;
          let L = w.w.useGetWallet,
            A = (0, j.Pi)(e => {
              var t, a, n;
              let { txnData: u, rootDenomsStore: x } = e,
                w = L(),
                j = (0, S.s0)(),
                B = (0, i.a74)(),
                M = (0, i.QSC)(B),
                A = (0, i.rTu)();
              p()(null !== A, "activeWallet is null");
              let P = (0, N.useMemo)(() => (0, D.k)(A.name), [A.name]),
                $ = null == u ? void 0 : u.origin,
                R =
                  null == $
                    ? void 0
                    : null === (n = $.split("//")) || void 0 === n
                      ? void 0
                      : null === (a = n.at(-1)) || void 0 === a
                        ? void 0
                        : null === (t = a.split(".")) || void 0 === t
                          ? void 0
                          : t.at(-2),
                z = (0, y.G)($),
                H = (0, N.useMemo)(
                  () => u.signTxnData.psbtsHexes.map(e => r.DwL.GetPsbtHexDetails(e, "bitcoinSignet" === B ? c.Pq : c.IB)),
                  [B, u.signTxnData.psbtsHexes]
                ),
                O = (0, i.SFn)(),
                [W, F] = (0, N.useState)("idle"),
                [Q, U] = (0, N.useState)(null),
                [Z, J] = (0, N.useState)(null),
                q = async () => {
                  try {
                    if (A.walletType === i._KQ.LEDGER) throw Error("Ledger transactions are not supported yet");
                    U(null), F("loading");
                    let e = await w(B),
                      t = [];
                    for (let a of H) {
                      a.inputs.forEach((t, n) => {
                        e.signIdx(O, a.tx, n);
                      });
                      for (let e = 0; e < a.inputs.length; e++) H.tx.finalizeIdx(e);
                      t.push(o.$v.encode(a.tx.extract()));
                    }
                    F("success");
                    try {
                      I().runtime.sendMessage({
                        type: h.u.signBitcoinResponse,
                        payloadId: null == u ? void 0 : u.payloadId,
                        payload: { status: "success", data: t }
                      });
                    } catch {
                      throw Error("Could not send transaction to the dApp");
                    }
                    (0, _.oj)() ? j("/home") : window.close();
                  } catch (e) {
                    F("error"),
                      U(e.message),
                      (0, d.Tb)(e, {
                        tags: {
                          errorType: "bitcoin_transaction_error",
                          source: "sign_psbts",
                          severity: "error",
                          errorName: e instanceof Error ? e.name : "BitcoinTransactionError"
                        },
                        fingerprint: ["sign_psbts", "sign_psbts_error"],
                        level: "error",
                        contexts: { transaction: { type: "sign_psbts", errorMessage: e instanceof Error ? e.message : String(e) } },
                        extra: { chain: B }
                      });
                  }
                },
                K = !!Q || "loading" === W;
              return null !== Z
                ? (0, s.jsx)(G.v, {
                    txnData: { ...u, signTxnData: { psbtHex: u.signTxnData.psbtsHexes[Z] } },
                    rootDenomsStore: x,
                    isRedirected: !0,
                    handleBack: () => J(null)
                  })
                : (0, s.jsx)("div", {
                    className: g()("panel-width enclosing-panel h-full relative self-center justify-self-center flex justify-center items-center", {
                      "mt-2": !(0, _.oj)()
                    }),
                    children: (0, s.jsx)("div", {
                      className: g()("relative w-full overflow-clip rounded-md border border-gray-300 dark:border-gray-900", { "panel-height": (0, _.oj)() }),
                      children: (0, s.jsxs)(b.Z, {
                        header: (0, s.jsx)("div", {
                          className: "w-[396px]",
                          children: (0, s.jsx)(l.Header, {
                            imgSrc: M.chainSymbolImageUrl ?? v.r.Logos.GenericLight,
                            title: (0, s.jsx)(l.Buttons.Wallet, { title: (0, E.fy)(P, 10), className: "pr-4 cursor-default" })
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
                                  (0, s.jsx)(l.Avatar, {
                                    avatarImage: z,
                                    avatarOnError: (0, k._)(v.r.Misc.Globe),
                                    size: "sm",
                                    className: "rounded-full overflow-hidden"
                                  }),
                                  (0, s.jsxs)("div", {
                                    className: "ml-3",
                                    children: [
                                      (0, s.jsx)("p", { className: "capitalize text-gray-900 dark:text-white-100 text-base font-bold", children: R }),
                                      (0, s.jsx)("p", { className: "lowercase text-gray-500 dark:text-gray-400 text-xs font-medium", children: $ })
                                    ]
                                  })
                                ]
                              }),
                              u.signTxnData.psbtsHexes.length
                                ? u.signTxnData.psbtsHexes.map((e, t) =>
                                    (0, s.jsxs)(
                                      "div",
                                      {
                                        className: "flex items-center justify-between gap-4 dark:bg-gray-900 bg-white-100 p-4 rounded-2xl mt-3",
                                        children: [
                                          (0, s.jsxs)("p", {
                                            className: "flex flex-col text-gray-900 dark:text-white-100",
                                            children: [
                                              (0, s.jsxs)("span", { className: "font-semibold", children: ["Transaction ", t + 1] }),
                                              (0, s.jsx)("span", { children: (0, E.Hn)(e, 7) })
                                            ]
                                          }),
                                          (0, s.jsx)("button", {
                                            className: "rounded-lg text-white-100 py-[4px] px-[12px] font-semibold",
                                            style: { backgroundColor: T.w.getChainColor(B) },
                                            onClick: () => J(t),
                                            children: "View"
                                          })
                                        ]
                                      },
                                      `${e}--${t}`
                                    )
                                  )
                                : null,
                              Q && "error" === W ? (0, s.jsx)(m._, { text: Q, disableSentryCapture: !0, className: "mt-3" }) : null
                            ]
                          }),
                          (0, s.jsx)("div", {
                            className: "absolute bottom-0 left-0 py-3 px-7 dark:bg-black-100 bg-gray-50 w-full",
                            children: (0, s.jsxs)("div", {
                              className: "flex items-center justify-center w-full space-x-3",
                              children: [
                                (0, s.jsx)(l.Buttons.Generic, {
                                  title: "Reject Button",
                                  color: T.w.gray900,
                                  onClick: () => (0, C.B)(j, null == u ? void 0 : u.payloadId),
                                  disabled: "loading" === W,
                                  "aria-label": "sign bitcoin dapp reject button in sign bitcoin psbts flow",
                                  children: (0, s.jsx)("span", {
                                    "aria-label": "sign bitcoin dapp reject button text in sign bitcoin psbts flow",
                                    children: "Reject"
                                  })
                                }),
                                (0, s.jsx)(l.Buttons.Generic, {
                                  title: "Approve Button",
                                  color: T.w.green600,
                                  onClick: q,
                                  disabled: K,
                                  className: `${K ? "cursor-not-allowed opacity-50" : ""}`,
                                  "aria-label": "sign bitcoin dapp approve button in sign bitcoin psbts flow",
                                  children:
                                    "loading" === W
                                      ? (0, s.jsx)(f.T, { color: "white" })
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
          a.d(t, { $g: () => i.$, Qi: () => r.Q, gb: () => s.g, nG: () => o.n, v5: () => l.v });
          var s = a(35147),
            i = a(49597),
            r = a(94989),
            l = a(56249),
            o = a(72971),
            c = e([i, r, l, o]);
          ([i, r, l, o] = c.then ? (await c)() : c), n();
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
            r = a(4370),
            l = a(14981),
            o = a(25053),
            c = a(2784),
            d = a(42799),
            u = a(48346),
            p = a(46338),
            x = a(43963),
            g = e([i, u]);
          [i, u] = g.then ? (await g)() : g;
          let m = [
              { id: "fees", label: "Fees" },
              { id: "details", label: "Details" }
            ],
            b = { transform: "translateX(0px) scaleX(0.161044)" },
            f = e => {
              let [t, a] = (0, c.useState)(m[0]);
              return (0, s.jsxs)(s.Fragment, {
                children: [
                  (0, s.jsx)("div", {
                    className: "border-b border-border-bottom",
                    children: (0, s.jsx)(o.z, {
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
                    children: (0, s.jsxs)(l.M, {
                      mode: "wait",
                      initial: !1,
                      children: [
                        "fees" === t.id &&
                          (0, s.jsxs)(
                            r.E.div,
                            {
                              className: "flex flex-col gap-7",
                              transition: p._M,
                              variants: x.dJ,
                              initial: "exit",
                              animate: "animate",
                              exit: "exit",
                              children: [
                                (0, s.jsx)(i.ZP.Selector, {}),
                                (0, s.jsxs)("div", {
                                  className: "border border-border-bottom rounded-xl ",
                                  children: [
                                    (0, s.jsx)(i.ZP.AdditionalSettingsToggle, {}),
                                    (0, s.jsx)(i.ZP.AdditionalSettings, { showGasLimitWarning: !0, rootBalanceStore: u.jZ, rootDenomsStore: d.gb })
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
                                r.E.pre,
                                {
                                  transition: p._M,
                                  variants: x.dJ,
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
      a.d(t, { B: () => l });
      var n = a(74703),
        s = a(48534),
        i = a(72565),
        r = a.n(i);
      async function l(e, t) {
        await r().runtime.sendMessage({ type: n.u.signBitcoinResponse, payloadId: t, payload: { status: "error", data: "User rejected the transaction" } }),
          (0, s.oj)() ? e("/home") : window.close();
      }
    }
  }
]);
//# sourceMappingURL=6962.js.map
