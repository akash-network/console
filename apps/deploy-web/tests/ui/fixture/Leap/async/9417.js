!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "c6906c6b-6913-4498-ba98-6bac01956115"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-c6906c6b-6913-4498-ba98-6bac01956115"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.23.1" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["9417"],
  {
    79215: function (e, t, n) {
      n.d(t, { og: () => g });
      var a = n(52322),
        s = n(26793),
        o = n(89187),
        i = n(16283),
        r = n(85027),
        l = n(86240),
        d = n(65953);
      n(2784);
      var c = n(70514),
        u = n(49409);
      let m = e => {
          let { activeIndex: t, setActiveIndex: n, limit: d } = e,
            { walletAvatar: u, walletName: m } = (0, l.v)();
          return (0, a.jsxs)(r.m, {
            className: "bg-secondary-50 border-b border-secondary-100",
            children: [
              (0, a.jsx)("div", { className: "w-[72px]" }),
              (0, a.jsx)(i.G2, { className: "bg-secondary-200", showWalletAvatar: !0, walletName: m, walletAvatar: u, handleDropdownClick: () => void 0 }),
              (0, a.jsx)("div", {
                className: "min-w-[72px]",
                children:
                  void 0 !== t &&
                  void 0 !== d &&
                  d > 1 &&
                  (0, a.jsxs)("div", {
                    className: "flex items-center rounded-full bg-secondary-200 p-2 justify-between",
                    children: [
                      (0, a.jsx)(s.W, {
                        size: 14,
                        className: (0, c.cn)("", { "text-muted-foreground": 0 === t, "text-foreground cursor-pointer": 0 !== t }),
                        onClick: () => {
                          n && void 0 !== t && t > 0 && n(t - 1);
                        }
                      }),
                      (0, a.jsxs)("p", { className: "text-sm font-bold text-foreground", children: [t + 1, "/", d] }),
                      (0, a.jsx)(o.T, {
                        size: 14,
                        className: (0, c.cn)("", { "text-muted-foreground": t === d - 1, "text-foreground cursor-pointer": t !== d - 1 }),
                        onClick: () => {
                          n && void 0 !== t && d && t < d - 1 && n(t + 1);
                        }
                      })
                    ]
                  })
              })
            ]
          });
        },
        p = e =>
          (0, a.jsxs)("div", {
            className: "flex items-center gap-5",
            children: [
              (0, a.jsx)("img", { src: e.logo, onError: (0, u._)(d.Globe), className: "size-[54px] rounded-full" }),
              (0, a.jsxs)("div", {
                className: "flex flex-col gap-[3px]",
                children: [
                  (0, a.jsx)("span", { className: "text-lg font-bold", children: e.title }),
                  (0, a.jsx)("span", { className: "text-xs text-muted-foreground", children: e.subTitle })
                ]
              })
            ]
          }),
        g = e =>
          (0, a.jsxs)(a.Fragment, {
            children: [
              (0, a.jsx)(m, { activeIndex: e.activeIndex, setActiveIndex: e.setActiveIndex, limit: e.limit }),
              (0, a.jsxs)("div", {
                className: (0, c.cn)(
                  "flex flex-col gap-6 mx-auto h-[calc(100%-165px)] w-full max-w-2xl box-border overflow-y-scroll pt-6 px-6 bg-secondary-50",
                  e.className
                ),
                children: [(0, a.jsx)(p, { ...e }), e.children]
              })
            ]
          });
    },
    57767: function (e, t, n) {
      n.d(t, { Z: () => r });
      var a = n(52322),
        s = n(14281);
      n(2784);
      var o = n(86376),
        i = n(69816);
      function r(e) {
        let { showLedgerPopup: t, onClose: n } = e;
        return (0, a.jsx)(s.Z, {
          isOpen: t,
          onClose: n,
          title: "Confirm on Ledger",
          children: (0, a.jsxs)("div", {
            className: "flex flex-col items-center",
            children: [
              (0, a.jsx)("div", { className: "my-10", children: (0, a.jsx)(o.Z, {}) }),
              (0, a.jsx)(i.Z, { size: "md", className: "font-bold mb-7", children: "Approve transaction on your hardware wallet" })
            ]
          })
        });
      }
    },
    74703: function (e, t, n) {
      n.d(t, { u: () => s });
      var a,
        s =
          (((a = {}).signResponse = "sign-response"),
          (a.signingPopupOpen = "signing-popup-open"),
          (a.signTransaction = "sign-transaction"),
          (a.signBitcoinResponse = "sign-bitcoin-response"),
          (a.signSeiEvmResponse = "sign-sei-evm-response"),
          a);
    },
    99548: function (e, t, n) {
      n.a(e, async function (e, a) {
        try {
          n.d(t, { Z: () => c });
          var s = n(52322),
            o = n(58885),
            i = n(96217);
          n(2784);
          var r = n(42799),
            l = n(48346),
            d = e([o, l]);
          [o, l] = d.then ? (await d)() : d;
          let c = e => {
            let { isOpen: t, onClose: n, gasPriceError: a } = e;
            return (0, s.jsxs)(i.Z, {
              isOpen: t,
              onClose: n,
              fullScreen: !0,
              title: "Edit gas fees",
              className: "p-6",
              children: [
                (0, s.jsx)("p", { className: "text-xs font-medium text-muted-foreground", children: "Select gas options" }),
                (0, s.jsx)(o.ZP.Selector, { isNoSetSelector: !0, className: "my-6" }),
                (0, s.jsxs)("div", {
                  className: "border border-secondary-100 rounded-lg ",
                  children: [
                    (0, s.jsx)(o.ZP.AdditionalSettingsToggle, {}),
                    (0, s.jsx)(o.ZP.AdditionalSettings, { showGasLimitWarning: !0, rootDenomsStore: r.gb, rootBalanceStore: l.jZ }),
                    !!a && (0, s.jsx)("p", { className: "text-destructive-100 text-sm font-medium mt-2 px-1", children: a })
                  ]
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
    94908: function (e, t, n) {
      n.a(e, async function (e, a) {
        try {
          n.r(t), n.d(t, { default: () => W });
          var s = n(52322),
            o = n(54655),
            i = n(41172),
            r = n(15969),
            l = n(59458),
            d = n(7835),
            c = n(8974),
            u = n(92642),
            m = n(72779),
            p = n.n(m),
            g = n(79215),
            f = n(86200),
            v = n(58885),
            x = n(57767),
            h = n(19623),
            b = n(69816),
            w = n(91486),
            y = n(74703),
            j = n(53108),
            N = n(79533),
            S = n(74229),
            _ = n(76131),
            T = n(78935),
            E = n(65027),
            D = n(75958),
            A = n(2784),
            k = n(10289),
            M = n(42799),
            C = n(39713),
            L = n(48346),
            Z = n(46103),
            P = n(44818),
            F = n(48534),
            I = n(72565),
            O = n.n(I),
            B = n(96238),
            R = n(96808),
            z = n(94194),
            H = n(48834).Buffer,
            G = e([E, C, _, v, z, R, L]);
          [E, C, _, v, z, R, L] = G.then ? (await G)() : G;
          let U = E.w.useGetWallet,
            $ = E.w.useAptosSigner,
            V = (0, D.Pi)(e => {
              let { data: t, chainId: n, rootBalanceStore: a, rootDenomsStore: m, activeChain: N } = e,
                E = (0, A.useRef)(!1),
                D = (0, A.useRef)(!1),
                M = (0, A.useRef)(!1),
                [L, I] = (0, A.useState)(!1),
                [G, V] = (0, A.useState)(null),
                [W] = (0, A.useState)(null),
                [Q, q] = (0, A.useState)(null),
                X = (0, i.dco)(),
                J = (0, i._ty)(N),
                K = (0, A.useMemo)(() => {
                  var e;
                  return parseInt((((null === (e = X[N]) || void 0 === e ? void 0 : e.DEFAULT_GAS_IBC) ?? r.N7W.DEFAULT_GAS_IBC) * J).toString());
                }, [N, X, J]),
                [Y, ee] = (0, A.useState)(!1),
                [et, en] = (0, A.useState)(0),
                [ea, es] = (0, A.useState)(""),
                [eo, ei] = (0, A.useState)(!1),
                er = (0, i.QSC)(N),
                el = (0, i.rTu)(),
                ed = $(),
                ec = U(N),
                eu = (0, k.s0)(),
                em = (0, A.useMemo)(
                  () => ((null == er ? void 0 : er.testnetChainId) && (null == er ? void 0 : er.testnetChainId) === n ? "testnet" : "mainnet"),
                  [null == er ? void 0 : er.testnetChainId, n]
                ),
                ep = m.allDenoms,
                eg = (0, v.e7)(ep, { activeChain: N }),
                ef = (0, i.bkk)(ep, N, em),
                ev = i.rNU.useLogCosmosDappTx(),
                ex = (0, A.useRef)(!1),
                [eh, eb] = (0, A.useState)(null),
                [ew, ey] = (0, A.useState)(!1),
                ej = (0, i.FmJ)(),
                eN = C.zT.getStore(N, em, !1),
                eS = null == eN ? void 0 : eN.data,
                e_ = (0, A.useRef)(null);
              (0, A.useEffect)(() => {
                !eh &&
                  e_.current &&
                  setTimeout(() => {
                    e_.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
                  }, 10);
              }, [eh]),
                (0, A.useEffect)(() => {
                  a.loadBalances(N, em);
                }, [N, em]);
              let [eT, eE] = (0, A.useState)({ gasPrice: eg.gasPrice, option: i.j1p.LOW });
              (0, P.h)(null !== el, "activeWallet is null");
              let {
                  shouldSubmit: eD,
                  isSignMessage: eA,
                  signOptions: ek
                } = (0, A.useMemo)(() => {
                  let e = null == t ? void 0 : t.submit,
                    n = null == t ? void 0 : t.isSignMessage,
                    a = null == t ? void 0 : t.signOptions;
                  return { shouldSubmit: e, isSignMessage: n, signOptions: a };
                }, [t]),
                { lcdUrl: eM } = (0, i.U9i)(N, em),
                {
                  allowSetFee: eC,
                  message: eL,
                  signDoc: eZ,
                  fee: eP,
                  defaultFee: eF
                } = (0, A.useMemo)(() => {
                  if (eA) {
                    var e, n, a;
                    let s =
                      null === (a = t.signDoc) || void 0 === a
                        ? void 0
                        : null === (n = a.split("\n")) || void 0 === n
                          ? void 0
                          : null === (e = n.find(e => e.includes("message: "))) || void 0 === e
                            ? void 0
                            : e.replace("message: ", "");
                    return { allowSetFee: !1, message: s, signDoc: t.signDoc, fee: void 0, defaultFee: void 0 };
                  }
                  let {
                    allowSetFee: s,
                    updatedSignDoc: o,
                    updatedFee: i,
                    defaultFee: r
                  } = (0, B.I)({ signRequestData: t, gasPrice: eT.gasPrice, gasLimit: ea, isGasOptionSelected: ex.current, nativeFeeDenom: ef });
                  return { allowSetFee: s, message: "", signDoc: o, fee: i, defaultFee: r };
                }, [t, eT.gasPrice, ea, ef, eA]),
                eI = null == t ? void 0 : t.origin,
                eO = (0, T.G)(eI),
                eB = (0, S.a1)(),
                eR = (0, A.useCallback)(() => {
                  setTimeout(() => {
                    a.refetchBalances(N, em);
                  }, 3e3);
                }, [N, a, em]),
                ez = (0, A.useCallback)(async () => {
                  D.current ||
                    M.current ||
                    ((D.current = !0),
                    O().runtime.sendMessage({ type: y.u.signResponse, payload: { status: "error", data: "Transaction cancelled by the user." } }),
                    (0, F.oj)()
                      ? eu("/home")
                      : (await (0, r._vH)(100),
                        setTimeout(async () => {
                          window.close();
                        }, 10)));
                }, [eu]),
                eH = (0, A.useMemo)(() => {
                  if (eF && (null == eF ? void 0 : eF.amount[0])) {
                    let { denom: e } = eF.amount[0];
                    return e;
                  }
                  return eg.gasPrice.denom;
                }, [eF, eg.gasPrice]),
                eG = (0, A.useCallback)(async () => {
                  var e, t, a, s, l, d, c;
                  let m = el.addresses[N];
                  if (N && eZ && m) {
                    ei(!0);
                    try {
                      let l = (await ed(N)).signer;
                      if (eA) {
                        let e = await l.sign(eZ),
                          t = new o.ei2();
                        e.serialize(t);
                        let n = H.from(t.toUint8Array()).toString("hex");
                        await (0, r._vH)(100);
                        try {
                          O().runtime.sendMessage({ type: y.u.signResponse, payload: { status: "success", data: n } });
                        } catch {
                          throw Error("Could not send transaction to the dApp");
                        }
                        ei(!1),
                          (0, F.oj)()
                            ? (eR(), eu("/home"))
                            : setTimeout(async () => {
                                window.close();
                              }, 10);
                        return;
                      }
                      let d = await l.signTransaction(eZ),
                        c = new o.rEE(new o.EZS(l.publicKey.toUint8Array()), d),
                        p = (0, o.e8z)({ transaction: eZ, senderAuthenticator: c });
                      try {
                        await ev({
                          txHash: p,
                          txType: i.pb0.Dapp,
                          metadata: { ...ej, dapp_url: eI },
                          feeQuantity: null == eP ? void 0 : null === (e = eP.amount[0]) || void 0 === e ? void 0 : e.amount,
                          feeDenomination: null == eP ? void 0 : null === (t = eP.amount[0]) || void 0 === t ? void 0 : t.denom,
                          chain: N,
                          chainId: n,
                          address: m,
                          network: em,
                          isAptos: !0
                        });
                      } catch (e) {
                        (0, u.Tb)(e, {
                          tags: {
                            errorType: "aptos_transaction_error",
                            source: "sign_aptos_transaction",
                            severity: "error",
                            errorName: e instanceof Error ? e.name : "AptosTransactionError",
                            transactionType: "aptos_dapp_transaction"
                          },
                          fingerprint: ["aptos_dapp_transaction", "aptos_dapp_transaction_error"],
                          level: "error",
                          extra: {
                            feeQuantity: null == eP ? void 0 : null === (a = eP.amount[0]) || void 0 === a ? void 0 : a.amount,
                            feeDenomination: null == eP ? void 0 : null === (s = eP.amount[0]) || void 0 === s ? void 0 : s.denom,
                            chain: N,
                            chainId: n,
                            address: m,
                            network: em,
                            isAptos: !0
                          },
                          contexts: { transaction: { type: "aptos", chain: N, network: em, errorMessage: e instanceof Error ? e.message : String(e) } }
                        });
                      }
                      let g = new o.ei2();
                      c.serialize(g);
                      let f = H.from(g.toUint8Array()).toString("hex");
                      if ((await (0, r._vH)(100), !eD)) {
                        try {
                          O().runtime.sendMessage({ type: y.u.signResponse, payload: { status: "success", data: f } });
                        } catch {
                          throw Error("Could not send transaction to the dApp");
                        }
                        ei(!1),
                          (0, F.oj)()
                            ? (eR(), eu("/home"))
                            : setTimeout(async () => {
                                window.close();
                              }, 10);
                        return;
                      }
                      let v = await r.eAr.getAptosClient(eM ?? "", l),
                        x = await v.signAndBroadcastTransaction(eZ);
                      try {
                        O().runtime.sendMessage({ type: y.u.signResponse, payload: { status: "success", data: x.hash } });
                      } catch {
                        throw Error("Could not send transaction to the dApp");
                      }
                      ei(!1),
                        (0, F.oj)()
                          ? (eR(), eu("/home"))
                          : setTimeout(async () => {
                              window.close();
                            }, 10);
                    } catch (e) {
                      (0, u.Tb)(e, {
                        tags: {
                          errorType: "aptos_transaction_error",
                          source: "sign_aptos_transaction",
                          severity: "error",
                          errorName: e instanceof Error ? e.name : "AptosTransactionError",
                          transactionType: "aptos_dapp_transaction"
                        },
                        fingerprint: ["aptos_dapp_transaction", "aptos_dapp_transaction_error"],
                        level: "error",
                        extra: {
                          feeQuantity: null == eP ? void 0 : null === (l = eP.amount[0]) || void 0 === l ? void 0 : l.amount,
                          feeDenomination: null == eP ? void 0 : null === (d = eP.amount[0]) || void 0 === d ? void 0 : d.denom,
                          chain: N,
                          chainId: n,
                          address: m,
                          network: em,
                          isAptos: !0
                        },
                        contexts: { transaction: { type: "aptos", chain: N, network: em, errorMessage: e instanceof Error ? e.message : String(e) } }
                      }),
                        ei(!1),
                        V(
                          (null == e ? void 0 : null === (c = e.data) || void 0 === c ? void 0 : c.error_code) ??
                            (null == e ? void 0 : e.message) ??
                            "Unknown error"
                        ),
                        setTimeout(() => {
                          V(null);
                        }, 3e3);
                    }
                  }
                }, [el.addresses, em, N, eR, eZ, ec, eI, eP, ev, ez, eM]);
              (0, A.useEffect)(
                () => (
                  window.addEventListener("beforeunload", ez),
                  O().storage.local.remove(j.u1),
                  () => {
                    window.removeEventListener("beforeunload", ez);
                  }
                ),
                [ez]
              ),
                (0, A.useEffect)(() => {
                  (async function () {
                    var e, t, n;
                    if (!eA) {
                      if (!eC) {
                        (null == eZ ? void 0 : null === (e = eZ.rawTransaction) || void 0 === e ? void 0 : e.max_gas_amount) !== void 0 &&
                          en(Number(null == eZ ? void 0 : null === (t = eZ.rawTransaction) || void 0 === t ? void 0 : t.max_gas_amount));
                        return;
                      }
                      try {
                        ee(!0);
                        let e = K,
                          t = await ed(N),
                          a = new o.EZS(c.US.decode((null == el ? void 0 : null === (n = el.pubKeys) || void 0 === n ? void 0 : n[N]) ?? "")),
                          s = await r.eAr.getAptosClient(eM ?? "", t.signer),
                          { gasEstimate: i } = await s.simulateTransaction(eZ, a);
                        i && (e = Number(i)), en(e);
                      } catch (e) {
                        en(K);
                      } finally {
                        ee(!1);
                      }
                    }
                  })();
                }, [N, null == el ? void 0 : el.pubKeys, K, eM]),
                (0, A.useEffect)(() => {
                  if (eI && !E.current)
                    try {
                      E.current = !0;
                    } catch (e) {
                      (0, u.Tb)(e);
                    }
                }, [el.walletType, er.chainId, er.chainName, eI]);
              let eU = (0, A.useMemo)(
                  () => !!(null == eP ? void 0 : eP.granter) || !!(null == eP ? void 0 : eP.payer) || !!(null == ek ? void 0 : ek.disableBalanceCheck),
                  [null == eP ? void 0 : eP.granter, null == eP ? void 0 : eP.payer, null == ek ? void 0 : ek.disableBalanceCheck]
                ),
                e$ = !eH || !!G || !!Q || (!1 === eh && !ew) || Y || eo,
                eV = (0, A.useMemo)(
                  () => ({
                    page: "sign-aptos-transaction",
                    queryStatus: e$ ? "loading" : "success",
                    op: "signAptosTransactionPageApproveBtnLoad",
                    description: "Load time for aptos sign transaction page's approve button",
                    terminateProps: {
                      maxDuration: 5e3,
                      logData: {
                        tags: {
                          isApproveBtnDisabled: e$,
                          dappFeeDenom: eH,
                          signingError: !!G,
                          gasPriceError: !!Q,
                          isFeesValid: !!eh,
                          highFeeAccepted: ew,
                          isSigning: eo,
                          isLoadingGasLimit: Y
                        },
                        context: { dappFeeDenom: eH, signingError: G, gasPriceError: Q }
                      }
                    }
                  }),
                  [e$, eH, G, Q, eh, ew, eo, Y]
                );
              return (
                (0, _.$)(eV),
                (0, s.jsxs)("div", {
                  className: "h-full",
                  children: [
                    (0, s.jsxs)(g.og, {
                      className: "bg-secondary-50",
                      subTitle: eI || "Unknown site",
                      logo: eO || eB,
                      title: "Approve transaction",
                      children: [
                        eA
                          ? (0, s.jsx)("pre", {
                              className: p()(
                                "text-xs text-gray-900 dark:text-white-100 dark:bg-gray-900 bg-white-100 p-4 w-full overflow-x-auto rounded-2xl whitespace-pre-line break-words"
                              ),
                              children: eL
                            })
                          : (0, s.jsx)(v.ZP, {
                              className: "flex flex-col gap-6",
                              initialFeeDenom: eH,
                              gasLimit: ea || String(et),
                              setGasLimit: e => es(e.toString()),
                              recommendedGasLimit: String(et),
                              gasPriceOption: ex.current || eC ? eT : { ...eT, option: "" },
                              onGasPriceOptionChange: e => {
                                (ex.current = !0), eE(e);
                              },
                              error: Q,
                              setError: q,
                              considerGasAdjustment: !1,
                              disableBalanceCheck: eU,
                              fee: eP,
                              chain: N,
                              network: em,
                              validateFee: !0,
                              onInvalidFees: (e, t) => {
                                try {
                                  !1 === t && eb(!1);
                                } catch (e) {
                                  var a, s;
                                  (0, u.Tb)(e, {
                                    tags: {
                                      errorType: "aptos_transaction_fee_error",
                                      source: "sign_aptos_transaction",
                                      severity: "error",
                                      errorName: e instanceof Error ? e.name : "AptosTransactionFeeError",
                                      transactionType: "aptos_dapp_transaction"
                                    },
                                    extra: {
                                      feeQuantity: null == eP ? void 0 : null === (a = eP.amount[0]) || void 0 === a ? void 0 : a.amount,
                                      feeDenomination: null == eP ? void 0 : null === (s = eP.amount[0]) || void 0 === s ? void 0 : s.denom,
                                      chain: N,
                                      chainId: n,
                                      address: null == el ? void 0 : el.addresses[N],
                                      network: em,
                                      isAptos: !0
                                    },
                                    contexts: {
                                      transaction: { type: "aptos", chain: N, network: em, errorMessage: e instanceof Error ? e.message : String(e) }
                                    }
                                  });
                                }
                              },
                              hasUserTouchedFees: !!(null == ex ? void 0 : ex.current),
                              notUpdateInitialGasPrice: !eC,
                              rootDenomsStore: m,
                              rootBalanceStore: a,
                              children: (0, s.jsx)(z.t, {
                                gasPriceError: Q,
                                txData: eZ,
                                allowSetFee: eC,
                                staticFee: (0, s.jsx)(R.Z, {
                                  fee: eP,
                                  error: Q,
                                  setError: q,
                                  disableBalanceCheck: eU,
                                  rootBalanceStore: a,
                                  activeChain: N,
                                  selectedNetwork: em,
                                  feeTokensList: eS
                                })
                              })
                            }),
                        G ?? W ? (0, s.jsx)(f._, { text: G ?? W ?? "", disableSentryCapture: !0 }) : null,
                        (0, s.jsx)(x.Z, {
                          showLedgerPopup: L,
                          onClose: () => {
                            I(!1);
                          }
                        })
                      ]
                    }),
                    (0, s.jsxs)("div", {
                      className: "flex flex-col p-6 bg-secondary-50 justify-center w-full gap-2 mt-auto [&>*]:flex-1 sticky bottom-0",
                      children: [
                        !1 === eh &&
                          (0, s.jsxs)("div", {
                            className: "flex flex-row items-center rounded-lg p-[4px]",
                            ref: e_,
                            children: [
                              (0, s.jsx)("div", {
                                className: "mr-2",
                                onClick: () => ey(!ew),
                                children: ew
                                  ? (0, s.jsx)(d.l, { size: 20, className: "cursor-pointer", color: Z.w.green600 })
                                  : (0, s.jsx)(l.b, { size: 20, className: "text-green-600" })
                              }),
                              (0, s.jsx)(b.Z, {
                                size: "xs",
                                color: "dark:text-gray-400 text-gray-600",
                                children: "The selected fee amount is unusually high. I confirm and agree to proceed"
                              })
                            ]
                          }),
                        (0, s.jsxs)("div", {
                          className: "flex items-center justify-center w-full gap-3 mt-auto [&>*]:flex-1",
                          children: [
                            (0, s.jsx)(w.zx, {
                              variant: "mono",
                              onClick: ez,
                              "aria-label": "sign aptos transaction page reject button in sign aptos transaction flow",
                              children: (0, s.jsx)("span", {
                                "aria-label": "sign aptos transaction page reject button text in sign aptos transaction flow",
                                children: "Reject"
                              })
                            }),
                            (0, s.jsx)(w.zx, {
                              onClick: eG,
                              disabled: e$,
                              className: `${e$ ? "cursor-not-allowed opacity-50" : ""}`,
                              "aria-label": "sign aptos transaction page approve button in sign aptos transaction flow",
                              children: eo
                                ? (0, s.jsx)(h.T, { color: "white" })
                                : (0, s.jsx)("span", {
                                    "aria-label": "sign aptos transaction page approve button text in sign aptos transaction flow",
                                    children: "Approve"
                                  })
                            })
                          ]
                        })
                      ]
                    })
                  ]
                })
              );
            }),
            W = (e => {
              let t = () => {
                let [t, n] = (0, A.useState)(),
                  [a, o] = (0, A.useState)(r.NOo),
                  [i, l] = (0, A.useState)(null),
                  [d, c] = (0, A.useState)(),
                  [m] = (0, A.useState)(null),
                  p = (0, k.s0)();
                (0, A.useEffect)(() => {
                  (0, N._d)().then(o).catch(u.Tb);
                }, []);
                let g = (e, t) => {
                  if (t.id === O().runtime.id && e.type === y.u.signTransaction) {
                    var s;
                    let t = e.payload,
                      o = t.chainId ? t.chainId : null === (s = t.signDoc) || void 0 === s ? void 0 : s.chainId,
                      i = o ? a[o] : void 0;
                    if (!i) {
                      O().runtime.sendMessage({ type: y.u.signResponse, payload: { status: "error", data: `Invalid chainId ${o}` } }),
                        (0, F.oj)()
                          ? p("/home")
                          : setTimeout(async () => {
                              window.close();
                            }, 10);
                      return;
                    }
                    n(i), c(o), l(t);
                  }
                };
                if (
                  ((0, A.useEffect)(
                    () => (
                      O().runtime.sendMessage({ type: y.u.signingPopupOpen }),
                      O().runtime.onMessage.addListener(g),
                      () => {
                        O().runtime.onMessage.removeListener(g);
                      }
                    ),
                    []
                  ),
                  t && i && d)
                )
                  return (0, s.jsx)(e, { data: i, chainId: d, activeChain: t, rootDenomsStore: M.gb, rootBalanceStore: L.jZ });
                if (m) {
                  var f;
                  let e = ((f = m.code), "no-data" === f ? "No Transaction Data" : "Something Went Wrong");
                  return (0, s.jsxs)("div", {
                    className: "h-full w-full flex flex-col gap-4 items-center justify-center",
                    children: [
                      (0, s.jsx)("h1", { className: "text-red-300 text-2xl font-bold px-4 text-center", children: e }),
                      (0, s.jsx)("p", { className: "text-black-100 dark:text-white-100 text-sm font-medium px-4 text-center", children: m.message }),
                      (0, s.jsx)("button", {
                        className: "mt-8 py-1 px-4 text-center text-sm font-medium dark:text-white-100 text-black-100 bg-indigo-300 rounded-full",
                        onClick: () => {
                          (0, F.oj)() ? p("/home") : window.close();
                        },
                        "aria-label": "sign aptos transaction page close wallet button in sign aptos transaction flow",
                        children: (0, s.jsx)("span", {
                          "aria-label": "sign aptos transaction page close wallet button text in sign aptos transaction flow",
                          children: "Close Wallet"
                        })
                      })
                    ]
                  });
                }
                return (0, s.jsx)("div", {
                  className: "h-full w-full flex flex-col gap-4 items-center justify-center",
                  children: (0, s.jsx)(h.T, { color: "white" })
                });
              };
              return (t.displayName = `withTxnSigningRequest(${e.displayName})`), t;
            })(A.memo(V));
          a();
        } catch (e) {
          a(e);
        }
      });
    },
    96808: function (e, t, n) {
      n.a(e, async function (e, a) {
        try {
          n.d(t, { Z: () => h });
          var s = n(52322),
            o = n(41172),
            i = n(15969),
            r = n(91859),
            l = n(36906),
            d = n(60431),
            c = n(6391),
            u = n.n(c),
            m = n(6401),
            p = n(75958),
            g = n(2784),
            f = n(99548),
            v = e([f]);
          f = (v.then ? (await v)() : v)[0];
          let x = (e, t) => {
              var n;
              let { amount: a } = e,
                s = (null === (n = a[0]) || void 0 === n ? void 0 : n.amount) ?? "",
                o = (0, i.t7o)(new (u())(s).toString(), t),
                r = o.toFormat(5, u().ROUND_DOWN),
                l = o.isLessThan("0.00001");
              return { amount: o, formattedAmount: l && !o.isEqualTo(0) ? "< 0.00001" : r };
            },
            h = (0, p.Pi)(e => {
              var t, n, a;
              let { fee: i, error: c, setError: p, disableBalanceCheck: v, rootBalanceStore: h, activeChain: b, selectedNetwork: w, feeTokensList: y } = e,
                [j, N] = (0, g.useState)(!1),
                S = (0, o.dco)(),
                [_] = (0, o.X$P)(),
                T = h.getSpendableBalancesForChain(b, w, void 0),
                E = h.getLoadingStatusForChain(b, w),
                D = (0, g.useMemo)(() => (E ? "loading" : "success"), [E]),
                A = (0, o.xxU)(),
                [k] = (0, m.nB)(),
                M = (0, g.useMemo)(() => {
                  var e, t;
                  let n = null == i ? void 0 : null === (e = i.amount[0]) || void 0 === e ? void 0 : e.denom,
                    a = null == y ? void 0 : y.find(e => (e.ibcDenom ? e.ibcDenom === n : e.denom.coinMinimalDenom === n)),
                    s =
                      null ===
                        (t = T.find(e => {
                          var t;
                          return (null == a ? void 0 : a.ibcDenom) || (null == e ? void 0 : e.ibcDenom)
                            ? (null == e ? void 0 : e.ibcDenom) === (null == a ? void 0 : a.ibcDenom)
                            : (null == e ? void 0 : e.coinMinimalDenom) ===
                                (null == a ? void 0 : null === (t = a.denom) || void 0 === t ? void 0 : t.coinMinimalDenom);
                        })) || void 0 === t
                        ? void 0
                        : t.amount;
                  return { ...a, amount: s };
                }, [T, null == i ? void 0 : i.amount, y]),
                { data: C } = (0, d.useQuery)(
                  ["fee-token-fiat-value", null == M ? void 0 : null === (t = M.denom) || void 0 === t ? void 0 : t.coinDenom],
                  async () => {
                    var e, t, n;
                    return (0, o.knL)(
                      "1",
                      (null == M ? void 0 : null === (e = M.denom) || void 0 === e ? void 0 : e.coinGeckoId) ?? "",
                      null == M ? void 0 : null === (t = M.denom) || void 0 === t ? void 0 : t.chain,
                      o.r95[_].currencyPointer,
                      `${A}-${null == M ? void 0 : null === (n = M.denom) || void 0 === n ? void 0 : n.coinMinimalDenom}`
                    );
                  }
                ),
                L = (0, g.useMemo)(() => {
                  var e;
                  return i ? x(i, (null == M ? void 0 : null === (e = M.denom) || void 0 === e ? void 0 : e.coinDecimals) ?? 0) : null;
                }, [b, S, i, null == M ? void 0 : null === (n = M.denom) || void 0 === n ? void 0 : n.coinDecimals]);
              return (
                (0, g.useEffect)(() => {
                  var e, t;
                  let n = null == L ? void 0 : null === (e = L.amount) || void 0 === e ? void 0 : e.toString();
                  !v &&
                    n &&
                    "loading" !== D &&
                    (new (u())(n).isGreaterThan((null == M ? void 0 : M.amount) ?? 0)
                      ? p(`You don't have enough ${null == M ? void 0 : null === (t = M.denom) || void 0 === t ? void 0 : t.coinDenom} to pay the gas fee`)
                      : p(null));
                }, [M, L, D, v]),
                (0, s.jsxs)("div", {
                  className: "mt-3",
                  children: [
                    L
                      ? (0, s.jsxs)("div", {
                          className: "rounded-lg bg-secondary-100 border border-secondary-200",
                          children: [
                            (0, s.jsxs)("div", {
                              className: "p-4",
                              children: [
                                (0, s.jsxs)("div", {
                                  className: "flex justify-between",
                                  children: [
                                    (0, s.jsx)("p", { className: "text-muted-foreground text-xs font-medium", children: "Gas Fees" }),
                                    (0, s.jsx)(r.R, {
                                      size: 14,
                                      className: "text-muted-foreground cursor-pointer",
                                      weight: "fill",
                                      onClick: () => N(!0),
                                      "aria-label": "sign aptos dapp edit static fee button in sign aptos transaction flow"
                                    })
                                  ]
                                }),
                                (0, s.jsxs)("p", {
                                  className: "font-medium text-foreground text-sm mt-3 list-none ml-0",
                                  children: [
                                    L.formattedAmount,
                                    " ",
                                    null == M ? void 0 : null === (a = M.denom) || void 0 === a ? void 0 : a.coinDenom,
                                    " ",
                                    C ? k(new (u())((null == L ? void 0 : L.amount) ?? 0).multipliedBy(C)) : null
                                  ]
                                }),
                                c ? (0, s.jsx)("p", { className: "font-medium text-destructive-400 text-sm mt-3 list-none ml-0", children: c }) : null
                              ]
                            }),
                            (0, s.jsxs)("div", {
                              className: "flex px-4 py-3 gap-2 items-center bg-secondary-200",
                              children: [
                                (0, s.jsx)(l.k, { size: 16, className: "text-muted-foreground" }),
                                (0, s.jsx)("p", {
                                  className: "text-muted-foreground text-xs font-medium",
                                  children: "dApp doesn't recommend changing the gas fees"
                                })
                              ]
                            })
                          ]
                        })
                      : null,
                    (0, s.jsx)(f.Z, { isOpen: j, onClose: () => N(!1), gasPriceError: c })
                  ]
                })
              );
            });
          a();
        } catch (e) {
          a(e);
        }
      });
    },
    94194: function (e, t, n) {
      n.a(e, async function (e, a) {
        try {
          n.d(t, { t: () => x });
          var s = n(52322),
            o = n(58885),
            i = n(4370),
            r = n(14981),
            l = n(25053),
            d = n(2784),
            c = n(42799),
            u = n(48346),
            m = n(46338),
            p = n(43963),
            g = e([o, u]);
          [o, u] = g.then ? (await g)() : g;
          let f = [
              { id: "fees", label: "Fees" },
              { id: "details", label: "Details" }
            ],
            v = { transform: "translateX(0px) scaleX(0.161044)" },
            x = e => {
              let [t, n] = (0, d.useState)(f[0]);
              return (0, s.jsxs)(s.Fragment, {
                children: [
                  (0, s.jsx)("div", {
                    className: "border-b border-border-bottom",
                    children: (0, s.jsx)(l.z, {
                      buttons: f,
                      setSelectedTab: n,
                      selectedIndex: f.findIndex(e => {
                        let { id: n } = e;
                        return n === t.id;
                      }),
                      className: "gap-0.5",
                      buttonClassName: "px-3.5",
                      indicatorDefaultScale: v
                    })
                  }),
                  (0, s.jsx)("div", {
                    className: "flex flex-col gap-6",
                    children: (0, s.jsxs)(r.M, {
                      mode: "wait",
                      initial: !1,
                      children: [
                        "fees" === t.id &&
                          (0, s.jsxs)(
                            i.E.div,
                            {
                              className: "flex flex-col gap-7",
                              transition: m._M,
                              variants: p.dJ,
                              initial: "exit",
                              animate: "animate",
                              exit: "exit",
                              children: [
                                (0, s.jsx)(o.ZP.Selector, {}),
                                (0, s.jsxs)("div", {
                                  className: "border border-border-bottom rounded-xl ",
                                  children: [
                                    (0, s.jsx)(o.ZP.AdditionalSettingsToggle, {}),
                                    (0, s.jsx)(o.ZP.AdditionalSettings, { showGasLimitWarning: !0, rootBalanceStore: u.jZ, rootDenomsStore: c.gb })
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
                                i.E.pre,
                                {
                                  transition: m._M,
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
          a();
        } catch (e) {
          a(e);
        }
      });
    },
    91128: function (e, t, n) {
      n.d(t, { R: () => s });
      var a = n(56594);
      function s(e, t) {
        return (0, a.calculateFee)(parseInt(e), t);
      }
    },
    96238: function (e, t, n) {
      n.d(t, { I: () => c });
      var a = n(54655),
        s = n(56594),
        o = n(15969),
        i = n(6391),
        r = n.n(i),
        l = n(91128),
        d = n(48834).Buffer;
      function c(e) {
        let { signRequestData: t, gasPrice: n, gasLimit: i, isGasOptionSelected: c, nativeFeeDenom: u } = e,
          { signDoc: m, signOptions: p } = (function (e) {
            let t = Uint8Array.from(d.from(e.signDoc, "hex")),
              n = null == e ? void 0 : e.signOptions;
            return { signDoc: new a.ZKs(t).deserialize(a._tO), signOptions: n };
          })(t),
          g = (0, s.calculateFee)(
            Number(m.rawTransaction.max_gas_amount ?? 0),
            o.DB5.fromString(`${m.rawTransaction.gas_unit_price ?? 0}${u.coinMinimalDenom}`)
          ),
          f = (function (e, t, n, a, s) {
            let o = new (r())(t);
            return (null == s ? void 0 : s.preferNoSetFee) && !a ? e : (0, l.R)(!o.isNaN() && o.isGreaterThan(0) ? o.toString() : e.gas, n);
          })(g, i, n, c, p);
        return {
          updatedSignDoc: (function (e, t) {
            let n = new a.S75(
              e.rawTransaction.sender,
              e.rawTransaction.sequence_number,
              e.rawTransaction.payload,
              BigInt(t.gas),
              e.rawTransaction.gas_unit_price,
              e.rawTransaction.expiration_timestamp_secs,
              e.rawTransaction.chain_id
            );
            return new a._tO(n, e.feePayerAddress);
          })(m, f),
          updatedFee: f,
          allowSetFee: !(null == p ? void 0 : p.preferNoSetFee),
          defaultFee: g,
          defaultMemo: ""
        };
      }
    },
    25053: function (e, t, n) {
      n.d(t, { z: () => c });
      var a = n(52322),
        s = n(91486),
        o = n(65903),
        i = n(2784),
        r = n(70514);
      let l = (0, i.forwardRef)((e, t) =>
        (0, a.jsx)("button", {
          ref: t,
          className: (0, r.cn)(
            "text-sm font-medium text-foreground transition-colors capitalize pb-3.5 rounded-full",
            s.YV,
            e.active ? "text-accent-green" : "text-secondary-700 hover:text-foreground",
            e.className
          ),
          onClick: e.onClick,
          "aria-label": `tab button in stake v2 flow ${e.children}`,
          children: (0, a.jsx)("span", { "aria-label": `tab button text in stake v2 flow ${e.children}`, children: e.children })
        })
      );
      l.displayName = "TabButton";
      let d = { transform: "translateX(0px) scaleX(0.441654)" },
        c = e => {
          var t;
          let { setSelectedTab: n, selectedIndex: s, buttons: i, buttonClassName: c, className: u, indicatorDefaultScale: m } = e,
            { containerRef: p, indicatorRef: g, childRefs: f } = (0, o.r)({ navItems: i, activeLabel: null === (t = i[s]) || void 0 === t ? void 0 : t.label });
          return (0, a.jsxs)("div", {
            ref: p,
            className: (0, r.cn)("relative flex items-center isolate gap-7", u),
            children: [
              i.map((e, t) =>
                (0, a.jsx)(
                  l,
                  {
                    ref: e => f.current.set(t, e),
                    active: t === s,
                    onClick: () => n(e),
                    className: c,
                    "aria-label": `tab button in stake v2 flow ${e.label}`,
                    children: (0, a.jsx)("span", { "aria-label": `tab button text in stake v2 flow ${e.label}`, children: e.label })
                  },
                  e.id ?? e.label
                )
              ),
              (0, a.jsx)("div", {
                className:
                  "absolute bottom-0 h-0.5 origin-left scale-0 translate-x-3 transition-transform duration-200 w-full rounded-[50vmin/10vmin] z-10 bg-accent-green",
                ref: g,
                style: m ?? d
              })
            ]
          });
        };
      c.displayName = "TabSelectors";
    },
    91859: function (e, t, n) {
      n.d(t, { R: () => f });
      var a = n(2784),
        s = n(6806);
      let o = new Map([
        [
          "bold",
          a.createElement(
            a.Fragment,
            null,
            a.createElement("path", {
              d: "M230.15,70.54,185.46,25.86a20,20,0,0,0-28.28,0L33.86,149.17A19.86,19.86,0,0,0,28,163.31V208a20,20,0,0,0,20,20H216a12,12,0,0,0,0-24H125L230.15,98.83A20,20,0,0,0,230.15,70.54ZM91,204H52V165l84-84,39,39ZM192,103,153,64l18.34-18.34,39,39Z"
            })
          )
        ],
        [
          "duotone",
          a.createElement(
            a.Fragment,
            null,
            a.createElement("path", { d: "M221.66,90.34,192,120,136,64l29.66-29.66a8,8,0,0,1,11.31,0L221.66,79A8,8,0,0,1,221.66,90.34Z", opacity: "0.2" }),
            a.createElement("path", {
              d: "M227.32,73.37,182.63,28.69a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H216a8,8,0,0,0,0-16H115.32l112-112A16,16,0,0,0,227.32,73.37ZM48,163.31l88-88L180.69,120l-88,88H48Zm144-54.62L147.32,64l24-24L216,84.69Z"
            })
          )
        ],
        [
          "fill",
          a.createElement(
            a.Fragment,
            null,
            a.createElement("path", {
              d: "M227.32,73.37,182.63,28.69a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H216a8,8,0,0,0,0-16H115.32l112-112A16,16,0,0,0,227.32,73.37ZM192,108.69,147.32,64l24-24L216,84.69Z"
            })
          )
        ],
        [
          "light",
          a.createElement(
            a.Fragment,
            null,
            a.createElement("path", {
              d: "M225.91,74.79,181.22,30.1a14,14,0,0,0-19.8,0L38.1,153.41a13.94,13.94,0,0,0-4.1,9.9V208a14,14,0,0,0,14,14H216a6,6,0,0,0,0-12H110.49L225.91,94.59A14,14,0,0,0,225.91,74.79ZM93.52,210H48a2,2,0,0,1-2-2V163.31a2,2,0,0,1,.59-1.41L136,72.49,183.52,120ZM217.42,86.1,192,111.52,144.49,64,169.9,38.59a2,2,0,0,1,2.83,0l44.69,44.68A2,2,0,0,1,217.42,86.1Z"
            })
          )
        ],
        [
          "regular",
          a.createElement(
            a.Fragment,
            null,
            a.createElement("path", {
              d: "M227.32,73.37,182.63,28.69a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H216a8,8,0,0,0,0-16H115.32l112-112A16,16,0,0,0,227.32,73.37ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.69,147.32,64l24-24L216,84.69Z"
            })
          )
        ],
        [
          "thin",
          a.createElement(
            a.Fragment,
            null,
            a.createElement("path", {
              d: "M224.49,76.2,179.8,31.51a12,12,0,0,0-17,0L39.51,154.83A12,12,0,0,0,36,163.31V208a12,12,0,0,0,12,12H216a4,4,0,0,0,0-8H105.66L224.49,93.17A12,12,0,0,0,224.49,76.2ZM94.34,212H48a4,4,0,0,1-4-4V163.31a4,4,0,0,1,1.17-2.82L136,69.66,186.35,120ZM218.83,87.51,192,114.34,141.66,64l26.83-26.83a4,4,0,0,1,5.66,0l44.68,44.69A4,4,0,0,1,218.83,87.51Z"
            })
          )
        ]
      ]);
      var i = Object.defineProperty,
        r = Object.defineProperties,
        l = Object.getOwnPropertyDescriptors,
        d = Object.getOwnPropertySymbols,
        c = Object.prototype.hasOwnProperty,
        u = Object.prototype.propertyIsEnumerable,
        m = (e, t, n) => (t in e ? i(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : (e[t] = n)),
        p = (e, t) => {
          for (var n in t || (t = {})) c.call(t, n) && m(e, n, t[n]);
          if (d) for (var n of d(t)) u.call(t, n) && m(e, n, t[n]);
          return e;
        },
        g = (e, t) => r(e, l(t));
      let f = (0, a.forwardRef)((e, t) => a.createElement(s.Z, g(p({ ref: t }, e), { weights: o })));
      f.displayName = "PencilSimpleLine";
    }
  }
]);
//# sourceMappingURL=9417.js.map
