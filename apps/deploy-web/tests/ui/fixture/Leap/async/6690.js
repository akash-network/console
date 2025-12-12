!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      n = new e.Error().stack;
    n &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[n] = "38180bab-b858-4c64-80fd-8dfcfd3a969c"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-38180bab-b858-4c64-80fd-8dfcfd3a969c"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.23.1" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["6690"],
  {
    79215: function (e, n, t) {
      t.d(n, { og: () => f });
      var a = t(52322),
        o = t(26793),
        s = t(89187),
        i = t(16283),
        r = t(85027),
        l = t(86240),
        d = t(65953);
      t(2784);
      var c = t(70514),
        u = t(49409);
      let m = e => {
          let { activeIndex: n, setActiveIndex: t, limit: d } = e,
            { walletAvatar: u, walletName: m } = (0, l.v)();
          return (0, a.jsxs)(r.m, {
            className: "bg-secondary-50 border-b border-secondary-100",
            children: [
              (0, a.jsx)("div", { className: "w-[72px]" }),
              (0, a.jsx)(i.G2, { className: "bg-secondary-200", showWalletAvatar: !0, walletName: m, walletAvatar: u, handleDropdownClick: () => void 0 }),
              (0, a.jsx)("div", {
                className: "min-w-[72px]",
                children:
                  void 0 !== n &&
                  void 0 !== d &&
                  d > 1 &&
                  (0, a.jsxs)("div", {
                    className: "flex items-center rounded-full bg-secondary-200 p-2 justify-between",
                    children: [
                      (0, a.jsx)(o.W, {
                        size: 14,
                        className: (0, c.cn)("", { "text-muted-foreground": 0 === n, "text-foreground cursor-pointer": 0 !== n }),
                        onClick: () => {
                          t && void 0 !== n && n > 0 && t(n - 1);
                        }
                      }),
                      (0, a.jsxs)("p", { className: "text-sm font-bold text-foreground", children: [n + 1, "/", d] }),
                      (0, a.jsx)(s.T, {
                        size: 14,
                        className: (0, c.cn)("", { "text-muted-foreground": n === d - 1, "text-foreground cursor-pointer": n !== d - 1 }),
                        onClick: () => {
                          t && void 0 !== n && d && n < d - 1 && t(n + 1);
                        }
                      })
                    ]
                  })
              })
            ]
          });
        },
        g = e =>
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
        f = e =>
          (0, a.jsxs)(a.Fragment, {
            children: [
              (0, a.jsx)(m, { activeIndex: e.activeIndex, setActiveIndex: e.setActiveIndex, limit: e.limit }),
              (0, a.jsxs)("div", {
                className: (0, c.cn)(
                  "flex flex-col gap-6 mx-auto h-[calc(100%-165px)] w-full max-w-2xl box-border overflow-y-scroll pt-6 px-6 bg-secondary-50",
                  e.className
                ),
                children: [(0, a.jsx)(g, { ...e }), e.children]
              })
            ]
          });
    },
    57767: function (e, n, t) {
      t.d(n, { Z: () => r });
      var a = t(52322),
        o = t(14281);
      t(2784);
      var s = t(86376),
        i = t(69816);
      function r(e) {
        let { showLedgerPopup: n, onClose: t } = e;
        return (0, a.jsx)(o.Z, {
          isOpen: n,
          onClose: t,
          title: "Confirm on Ledger",
          children: (0, a.jsxs)("div", {
            className: "flex flex-col items-center",
            children: [
              (0, a.jsx)("div", { className: "my-10", children: (0, a.jsx)(s.Z, {}) }),
              (0, a.jsx)(i.Z, { size: "md", className: "font-bold mb-7", children: "Approve transaction on your hardware wallet" })
            ]
          })
        });
      }
    },
    74703: function (e, n, t) {
      t.d(n, { u: () => o });
      var a,
        o =
          (((a = {}).signResponse = "sign-response"),
          (a.signingPopupOpen = "signing-popup-open"),
          (a.signTransaction = "sign-transaction"),
          (a.signBitcoinResponse = "sign-bitcoin-response"),
          (a.signSeiEvmResponse = "sign-sei-evm-response"),
          a);
    },
    91128: function (e, n, t) {
      t.d(n, { R: () => o });
      var a = t(56594);
      function o(e, n) {
        return (0, a.calculateFee)(parseInt(e), n);
      }
    },
    980: function (e, n, t) {
      t.a(e, async function (e, a) {
        try {
          t.r(n), t.d(n, { default: () => J });
          var o = t(52322),
            s = t(41172),
            i = t(15969),
            r = t(59458),
            l = t(7835),
            d = t(92642),
            c = t(6391),
            u = t.n(c),
            m = t(72779),
            g = t.n(m),
            f = t(79215),
            v = t(86200),
            p = t(58885),
            x = t(57767),
            h = t(19623),
            b = t(69816),
            w = t(91486),
            y = t(74703),
            N = t(53108),
            S = t(79533),
            j = t(74229),
            _ = t(76131),
            D = t(10706),
            T = t(78935),
            E = t(65027),
            k = t(75958),
            I = t(70734),
            C = t(2784),
            M = t(10289),
            A = t(42799),
            F = t(39713),
            L = t(48346),
            P = t(46103),
            O = t(44818),
            G = t(48534),
            B = t(72565),
            R = t.n(B),
            U = t(99895),
            z = t(64241),
            Z = t(26738),
            $ = e([E, D, F, _, p, Z, L]);
          [E, D, F, _, p, Z, L] = $.then ? (await $)() : $;
          let W = E.w.useGetWallet,
            X = E.w.useSolanaSigner,
            q = (0, k.Pi)(e => {
              let { data: n, chainId: t, rootBalanceStore: a, rootDenomsStore: c, activeChain: m } = e,
                S = (0, C.useRef)(!1),
                E = (0, C.useRef)(!1),
                k = (0, C.useRef)(!1),
                [A, L] = (0, C.useState)(!1),
                [B, $] = (0, C.useState)(null),
                [q] = (0, C.useState)(null),
                [J, H] = (0, C.useState)(null),
                [Q, K] = (0, C.useState)([]),
                [V, Y] = (0, C.useState)(void 0),
                ee = (0, s.dco)(),
                en = (0, s._ty)(m),
                et = (0, C.useMemo)(() => {
                  var e;
                  return parseInt((((null === (e = ee[m]) || void 0 === e ? void 0 : e.DEFAULT_GAS_IBC) ?? i.N7W.DEFAULT_GAS_IBC) * en).toString());
                }, [m, ee, en]),
                [ea, eo] = (0, C.useState)(!1),
                [es, ei] = (0, C.useState)(0),
                [er, el] = (0, C.useState)(""),
                [ed, ec] = (0, C.useState)(0),
                [eu, em] = (0, C.useState)(!1),
                eg = ["101", "103"],
                ef = (0, s.rTu)(),
                ev = X(),
                ep = W(m),
                ex = (0, M.s0)(),
                { chains: eh } = (0, s._IL)(),
                eb = (0, D.Af)(),
                ew = (0, C.useMemo)(() => ("solana:devnet" === t ? "testnet" : "mainnet"), [t]),
                ey = c.allDenoms,
                eN = (0, p.e7)(ey, { activeChain: m }),
                eS = (0, s.bkk)(ey, m, ew),
                ej = s.rNU.useLogCosmosDappTx(),
                e_ = (0, C.useRef)(!1),
                [eD, eT] = (0, C.useState)(null),
                [eE, ek] = (0, C.useState)(!1),
                eI = (0, s.FmJ)(),
                { lcdUrl: eC, rpcUrl: eM } = (0, s.U9i)(m, ew),
                eA = F.zT.getStore(m, ew, !1),
                eF = null == eA ? void 0 : eA.data,
                eL = (0, C.useRef)(null);
              (0, C.useEffect)(() => {
                !(async function () {
                  if (!ef || k.current) return;
                  let e = ["solana"].filter(e => {
                    var n, t, a, o;
                    let s = null == Q ? void 0 : null === (t = Q[0]) || void 0 === t ? void 0 : null === (n = t.addresses) || void 0 === n ? void 0 : n[e],
                      i = null == Q ? void 0 : null === (o = Q[0]) || void 0 === o ? void 0 : null === (a = o.pubKeys) || void 0 === a ? void 0 : a[e];
                    return (eh[e] && !s) || !i;
                  });
                  if (!(null == e ? void 0 : e.length)) return;
                  let n = {};
                  for await (let t of e) n[t] = eh[t];
                  let t = await eb(ef, e, "UPDATE", void 0, n);
                  k.current = !0;
                  let a = Q.map(e => {
                    if (!t) return e;
                    let n = t[e.id];
                    return n || e;
                  });
                  K(a);
                })();
              }, []);
              let eP = (0, C.useMemo)(async () => {
                let e = await ev(m);
                return await i.MPm.getSolanaClient(eM ?? "", e, ew);
              }, [m, eM, ev, ew]);
              (0, C.useEffect)(() => {
                !eD &&
                  eL.current &&
                  setTimeout(() => {
                    eL.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
                  }, 10);
              }, [eD]),
                (0, C.useEffect)(() => {
                  a.loadBalances(m, ew);
                }, [m, ew]);
              let [eO, eG] = (0, C.useState)({ gasPrice: eN.gasPrice, option: s.j1p.LOW });
              (0, O.h)(null !== ef, "activeWallet is null");
              let {
                  shouldSubmit: eB,
                  isSignMessage: eR,
                  signOptions: eU
                } = (0, C.useMemo)(() => {
                  let e = null == n ? void 0 : n.submit,
                    t = null == n ? void 0 : n.isSignMessage,
                    a = null == n ? void 0 : n.signOptions;
                  return { shouldSubmit: e, isSignMessage: t, signOptions: a };
                }, [n]),
                {
                  allowSetFee: ez,
                  message: eZ,
                  signDoc: e$,
                  fee: eW,
                  defaultFee: eX
                } = (0, C.useMemo)(() => {
                  if (eR) {
                    let e = n.signDoc.replace("SIGNINMESSAGESOLANA", ef.addresses[m]);
                    return { allowSetFee: !1, message: e, signDoc: n.signDoc.replace("SIGNINMESSAGESOLANA", ef.addresses[m]), fee: void 0, defaultFee: void 0 };
                  }
                  let {
                    allowSetFee: e,
                    updatedSignDoc: t,
                    updatedFee: a,
                    defaultFee: o
                  } = (0, U.I1)({ signRequestData: n, gasPrice: eO.gasPrice, gasLimit: er, isGasOptionSelected: e_.current, nativeFeeDenom: eS });
                  return { allowSetFee: e, message: "", signDoc: t, fee: a, defaultFee: o };
                }, [eR, n, eO.gasPrice, er, eS, ef.addresses, m]),
                eq = null == n ? void 0 : n.origin,
                eJ = (0, T.G)(eq),
                eH = (0, j.a1)(),
                eQ = (0, C.useCallback)(() => {
                  setTimeout(() => {
                    a.refetchBalances(m, ew);
                  }, 3e3);
                }, [m, a, ew]),
                eK = (0, C.useCallback)(async () => {
                  S.current ||
                    E.current ||
                    ((S.current = !0),
                    await R().runtime.sendMessage({ type: y.u.signResponse, payload: { status: "error", data: "Transaction cancelled by the user." } }),
                    (0, G.oj)()
                      ? ex("/home")
                      : (await (0, i._vH)(100),
                        setTimeout(async () => {
                          window.close();
                        }, 10)));
                }, [ex]),
                eV = (0, C.useMemo)(() => {
                  if (eX && (null == eX ? void 0 : eX.amount[0])) {
                    let { denom: e } = eX.amount[0];
                    return e;
                  }
                  return eN.gasPrice.denom;
                }, [eX, eN.gasPrice]),
                eY = (0, C.useCallback)(async () => {
                  var e, n, a, o, r, l, c, g, f, v;
                  let p = ef.addresses[m];
                  if (!m || !e$ || !p) return;
                  let x = await eP;
                  em(!0);
                  try {
                    if (eR) {
                      let e = await x.signMessage(e$);
                      await (0, i._vH)(100);
                      try {
                        let n = (await R().storage.local.get(["CONNECTIONS"])).CONNECTIONS || [],
                          t = eq || "";
                        if (!n.some(e => e.origin === t && e.walletIds.includes(ef.id) && e.chainIds.includes("101") && e.chainIds.includes("103")) && t) {
                          let e = [ef.id];
                          await (0, I.E)(["101", "103"], e, t);
                        }
                        R().runtime.sendMessage({ type: y.u.signResponse, payload: { status: "success", data: { signedTxData: e, activeAddress: p } } });
                      } catch (e) {
                        throw Error("Could not send transaction to the dApp");
                      }
                      em(!1),
                        (0, G.oj)()
                          ? (eQ(), ex("/home"))
                          : setTimeout(async () => {
                              window.close();
                            }, 10);
                      return;
                    }
                    let { tx: g, signature: f } = await x.signTransaction(e$);
                    try {
                      let i =
                        (null == eW ? void 0 : null === (n = eW.amount) || void 0 === n ? void 0 : null === (e = n[0]) || void 0 === e ? void 0 : e.amount) &&
                        !new (u())(eW.amount[0].amount).isNaN()
                          ? new (u())(eW.amount[0].amount).plus(5e3).toString()
                          : null == eW
                            ? void 0
                            : null === (o = eW.amount) || void 0 === o
                              ? void 0
                              : null === (a = o[0]) || void 0 === a
                                ? void 0
                                : a.amount;
                      await ej({
                        txHash: f,
                        txType: s.pb0.Dapp,
                        metadata: { ...eI, dapp_url: eq },
                        feeQuantity: i,
                        feeDenomination: (null == eW ? void 0 : null === (r = eW.amount[0]) || void 0 === r ? void 0 : r.denom) ?? "lamports",
                        chain: m,
                        chainId: t,
                        address: p,
                        network: ew,
                        isSolana: !0
                      });
                    } catch (e) {
                      (0, d.Tb)(e, {
                        tags: {
                          errorType: "solana_transaction_error",
                          source: "sign_solana_transaction",
                          severity: "error",
                          errorName: e instanceof Error ? e.name : "SolanaTransactionError",
                          transactionType: "solana_dapp_transaction"
                        },
                        fingerprint: ["solana_dapp_transaction", "solana_dapp_transaction_error"],
                        level: "error",
                        extra: {
                          feeQuantity: null == eW ? void 0 : null === (l = eW.amount[0]) || void 0 === l ? void 0 : l.amount.toString(),
                          feeDenomination: (null == eW ? void 0 : null === (c = eW.amount[0]) || void 0 === c ? void 0 : c.denom) ?? "lamports",
                          chain: m,
                          chainId: t,
                          address: p,
                          network: ew,
                          isSolana: !0,
                          appUrl: eq
                        },
                        contexts: { transaction: { type: "solana", chain: m, network: ew, errorMessage: e instanceof Error ? e.message : String(e) } }
                      });
                    }
                    if ((await (0, i._vH)(100), !eB)) {
                      try {
                        let e = (await R().storage.local.get(["CONNECTIONS"])).CONNECTIONS || [],
                          n = eq || "";
                        eg.every(async t => {
                          if (!e.some(e => e.origin === n && e.walletIds.includes(ef.id) && e.chainIds.includes(t)) && n) {
                            let e = [ef.id];
                            await (0, I.E)([t], e, n);
                          }
                        }),
                          R().runtime.sendMessage({ type: y.u.signResponse, payload: { status: "success", data: g } });
                      } catch {
                        throw Error("Could not send transaction to the dApp");
                      }
                      em(!1),
                        (0, G.oj)()
                          ? (eQ(), ex("/home"))
                          : setTimeout(async () => {
                              window.close();
                            }, 10);
                      return;
                    }
                    let v = await x.broadcastTransaction(g);
                    try {
                      let e = (await R().storage.local.get(["CONNECTIONS"])).CONNECTIONS || [],
                        n = eq || "";
                      if (!e.some(e => e.origin === n && e.walletIds.includes(ef.id) && e.chainIds.includes("101")) && n) {
                        let e = [ef.id];
                        await (0, I.E)(["101", "103"], e, n);
                      }
                      R().runtime.sendMessage({ type: y.u.signResponse, payload: { status: "success", data: v } });
                    } catch {
                      throw Error("Could not send transaction to the dApp");
                    }
                    em(!1),
                      (0, G.oj)()
                        ? (eQ(), ex("/home"))
                        : setTimeout(async () => {
                            window.close();
                          }, 10);
                  } catch (e) {
                    (0, d.Tb)(e, {
                      tags: {
                        errorType: "solana_transaction_error",
                        source: "sign_solana_transaction",
                        severity: "error",
                        errorName: e instanceof Error ? e.name : "SolanaTransactionError",
                        transactionType: "solana_dapp_transaction"
                      },
                      fingerprint: ["solana_dapp_transaction", "solana_dapp_transaction_error"],
                      level: "error",
                      extra: {
                        feeQuantity: null == eW ? void 0 : null === (g = eW.amount[0]) || void 0 === g ? void 0 : g.amount.toString(),
                        feeDenomination: (null == eW ? void 0 : null === (f = eW.amount[0]) || void 0 === f ? void 0 : f.denom) ?? "lamports",
                        chain: m,
                        chainId: t,
                        address: p,
                        network: ew,
                        isSolana: !0,
                        appUrl: eq
                      },
                      contexts: { transaction: { type: "solana", chain: m, network: ew, errorMessage: e instanceof Error ? e.message : String(e) } }
                    }),
                      em(!1),
                      $(
                        (null == e ? void 0 : null === (v = e.data) || void 0 === v ? void 0 : v.error_code) ??
                          (null == e ? void 0 : e.message) ??
                          "Unknown error"
                      ),
                      setTimeout(() => {
                        $(null);
                      }, 3e3);
                  }
                }, [ef.addresses, ew, m, eQ, e$, ep, eq, eW, ej, eK, eC]);
              (0, C.useEffect)(
                () => (
                  window.addEventListener("beforeunload", eK),
                  R().storage.local.remove(N.u1),
                  () => {
                    window.removeEventListener("beforeunload", eK);
                  }
                ),
                [eK]
              ),
                (0, C.useEffect)(() => {
                  (async function () {
                    if (!eR)
                      try {
                        eo(!0);
                        let e = et,
                          n = await ev(m),
                          t = await i.MPm.getSolanaClient(eM ?? "", n, ew, m),
                          { error: a } = await t.simulateTx(e$);
                        a && ($("Simulation failed. This transaction will likely fail if submitted. "), Y(JSON.stringify(a)));
                        let { limit: o, price: s } = (0, U.kS)(e$);
                        o && (e = Number(o)), s && ec(s), ei(e);
                      } catch (e) {
                        ei(et);
                      } finally {
                        eo(!1);
                      }
                  })();
                }, [m, null == ef ? void 0 : ef.pubKeys, et, eM]);
              let e0 = (0, C.useMemo)(
                  () => !!(null == eW ? void 0 : eW.granter) || !!(null == eW ? void 0 : eW.payer) || !!(null == eU ? void 0 : eU.disableBalanceCheck),
                  [null == eW ? void 0 : eW.granter, null == eW ? void 0 : eW.payer, null == eU ? void 0 : eU.disableBalanceCheck]
                ),
                e1 = !eV || !!B || !!J || (!1 === eD && !eE) || ea || eu,
                e2 = (0, C.useMemo)(
                  () => ({
                    page: "sign-solana-transaction",
                    queryStatus: e1 ? "loading" : "success",
                    op: "signSolanaTransactionPageApproveBtnLoad",
                    description: "Load time for solana sign transaction page's approve button",
                    terminateProps: {
                      maxDuration: 5e3,
                      logData: {
                        tags: {
                          isApproveBtnDisabled: e1,
                          dappFeeDenom: eV,
                          signingError: !!B,
                          gasPriceError: !!J,
                          isFeesValid: !!eD,
                          highFeeAccepted: eE,
                          isSigning: eu,
                          isLoadingGasLimit: ea
                        },
                        context: { dappFeeDenom: eV, signingError: B, gasPriceError: J }
                      }
                    }
                  }),
                  [e1, eV, B, J, eD, eE, eu, ea]
                );
              return (
                (0, _.$)(e2),
                (0, o.jsxs)("div", {
                  className: "h-full",
                  children: [
                    (0, o.jsxs)(f.og, {
                      className: "bg-secondary-50",
                      subTitle: eq || "Unknown site",
                      logo: eJ || eH,
                      title: "Approve transaction",
                      children: [
                        eR
                          ? (0, o.jsx)("pre", {
                              className: g()(
                                "text-xs text-gray-900 dark:text-white-100 dark:bg-gray-900 bg-white-100 p-4 w-full overflow-x-auto rounded-2xl whitespace-pre-line break-words"
                              ),
                              children: eZ
                            })
                          : (0, o.jsx)(p.ZP, {
                              className: "flex flex-col gap-6",
                              initialFeeDenom: eV,
                              gasLimit: er || String(es),
                              setGasLimit: e => el(e.toString()),
                              recommendedGasLimit: String(es),
                              gasPriceOption: e_.current || ez ? eO : { ...eO, option: "" },
                              onGasPriceOptionChange: e => {
                                (e_.current = !0), eG(e);
                              },
                              error: J,
                              setError: H,
                              considerGasAdjustment: !1,
                              disableBalanceCheck: e0,
                              fee: eW,
                              chain: m,
                              network: ew,
                              validateFee: !0,
                              onInvalidFees: (e, n) => {
                                try {
                                  !1 === n && eT(!1);
                                } catch (e) {
                                  var a, o;
                                  (0, d.Tb)(e, {
                                    tags: {
                                      errorType: "solana_transaction_fee_error",
                                      source: "sign_solana_transaction",
                                      severity: "error",
                                      errorName: e instanceof Error ? e.name : "SolanaTransactionFeeError",
                                      transactionType: "solana_dapp_transaction"
                                    },
                                    fingerprint: ["solana_dapp_transaction", "solana_dapp_transaction_error"],
                                    level: "error",
                                    contexts: { transaction: { type: "solana", errorMessage: e instanceof Error ? e.message : String(e) } },
                                    extra: {
                                      feeQuantity: null == eW ? void 0 : null === (a = eW.amount[0]) || void 0 === a ? void 0 : a.amount.toString(),
                                      feeDenomination: (null == eW ? void 0 : null === (o = eW.amount[0]) || void 0 === o ? void 0 : o.denom) ?? "lamports",
                                      chain: m,
                                      chainId: t,
                                      address: null == ef ? void 0 : ef.addresses[m],
                                      network: ew,
                                      isSolana: !0,
                                      appUrl: eq
                                    }
                                  });
                                }
                              },
                              hasUserTouchedFees: !!(null == e_ ? void 0 : e_.current),
                              notUpdateInitialGasPrice: !ez,
                              rootDenomsStore: c,
                              rootBalanceStore: a,
                              children: (0, o.jsx)(Z.t, {
                                gasPriceError: J,
                                txData: (0, U.AX)(e$, !0).signDoc,
                                allowSetFee: ez,
                                staticFee: (0, o.jsx)(z.Z, {
                                  fee: eW,
                                  error: J,
                                  setError: H,
                                  disableBalanceCheck: e0,
                                  rootBalanceStore: a,
                                  activeChain: m,
                                  selectedNetwork: ew,
                                  feeTokensList: eF,
                                  computedGas: es * ed
                                })
                              })
                            }),
                        B ?? q ? (0, o.jsx)(v._, { text: B ?? q ?? "", disableSentryCapture: !0, errorLog: V ?? void 0 }) : null,
                        (0, o.jsx)(x.Z, {
                          showLedgerPopup: A,
                          onClose: () => {
                            L(!1);
                          }
                        })
                      ]
                    }),
                    (0, o.jsxs)("div", {
                      className: "flex flex-col p-6 bg-secondary-50 justify-center w-full gap-2 mt-auto [&>*]:flex-1 sticky bottom-0",
                      children: [
                        !1 === eD &&
                          (0, o.jsxs)("div", {
                            className: "flex flex-row items-center rounded-lg p-[4px]",
                            ref: eL,
                            children: [
                              (0, o.jsx)("div", {
                                className: "mr-2",
                                onClick: () => ek(!eE),
                                children: eE
                                  ? (0, o.jsx)(l.l, { size: 20, className: "cursor-pointer", color: P.w.green600 })
                                  : (0, o.jsx)(r.b, { size: 20, className: "text-green-600" })
                              }),
                              (0, o.jsx)(b.Z, {
                                size: "xs",
                                color: "dark:text-gray-400 text-gray-600",
                                children: "The selected fee amount is unusually high. I confirm and agree to proceed"
                              })
                            ]
                          }),
                        (0, o.jsxs)("div", {
                          className: "flex items-center justify-center w-full gap-3 mt-auto [&>*]:flex-1",
                          children: [
                            (0, o.jsx)(w.zx, {
                              variant: "mono",
                              onClick: eK,
                              children: (0, o.jsx)("span", {
                                "aria-label": "sign solana transaction page reject button text in sign solana transaction flow",
                                children: "Reject"
                              })
                            }),
                            (0, o.jsx)(w.zx, {
                              onClick: eY,
                              disabled: e1,
                              className: `${e1 ? "cursor-not-allowed opacity-50" : ""}`,
                              "aria-label": "sign solana transaction page approve button in sign solana transaction flow",
                              children: eu
                                ? (0, o.jsx)(h.T, { color: "white" })
                                : (0, o.jsx)("span", {
                                    "aria-label": "sign solana transaction page approve button text in sign solana transaction flow",
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
            J = (e => {
              let n = () => {
                let [n, t] = (0, C.useState)(),
                  [a, s] = (0, C.useState)(i.NOo),
                  [r, l] = (0, C.useState)(null),
                  [c, u] = (0, C.useState)(),
                  [m] = (0, C.useState)(null),
                  g = (0, M.s0)();
                (0, C.useEffect)(() => {
                  (0, S._d)().then(s).catch(d.Tb);
                }, []);
                let f = (e, n) => {
                  if (n.id === R().runtime.id && e.type === y.u.signTransaction) {
                    let n = e.payload,
                      o = n.chainId ? n.chainId : "101",
                      s = o ? a["101"] : void 0;
                    if (!s) {
                      R().runtime.sendMessage({ type: y.u.signResponse, payload: { status: "error", data: `Invalid chainId rggfgsfgsfgsgsg ${o}` } }),
                        (0, G.oj)()
                          ? g("/home")
                          : setTimeout(async () => {
                              window.close();
                            }, 10);
                      return;
                    }
                    t(s), u(o), l(n);
                  }
                };
                if (
                  ((0, C.useEffect)(
                    () => (
                      R().runtime.sendMessage({ type: y.u.signingPopupOpen }),
                      R().runtime.onMessage.addListener(f),
                      () => {
                        R().runtime.onMessage.removeListener(f);
                      }
                    ),
                    []
                  ),
                  n && r && c)
                )
                  return (0, o.jsx)(e, { data: r, chainId: c, activeChain: n, rootDenomsStore: A.gb, rootBalanceStore: L.jZ });
                if (m) {
                  var v;
                  let e = ((v = m.code), "no-data" === v ? "No Transaction Data" : "Something Went Wrong");
                  return (0, o.jsxs)("div", {
                    className: "h-full w-full flex flex-col gap-4 items-center justify-center",
                    children: [
                      (0, o.jsx)("h1", { className: "text-red-300 text-2xl font-bold px-4 text-center", children: e }),
                      (0, o.jsx)("p", { className: "text-black-100 dark:text-white-100 text-sm font-medium px-4 text-center", children: m.message }),
                      (0, o.jsx)("button", {
                        className: "mt-8 py-1 px-4 text-center text-sm font-medium dark:text-white-100 text-black-100 bg-indigo-300 rounded-full",
                        onClick: () => {
                          (0, G.oj)() ? g("/home") : window.close();
                        },
                        "aria-label": "sign solana transaction page close wallet button in sign solana transaction flow",
                        children: (0, o.jsx)("span", {
                          "aria-label": "sign solana transaction page close wallet button text in sign solana transaction flow",
                          children: "Close Wallet"
                        })
                      })
                    ]
                  });
                }
                return (0, o.jsx)("div", {
                  className: "h-full w-full flex flex-col gap-4 items-center justify-center",
                  children: (0, o.jsx)(h.T, { color: "white" })
                });
              };
              return (n.displayName = `withTxnSigningRequest(${e.displayName})`), n;
            })(C.memo(q));
          a();
        } catch (e) {
          a(e);
        }
      });
    },
    64241: function (e, n, t) {
      t.d(n, { Z: () => g });
      var a = t(52322),
        o = t(41172),
        s = t(15969),
        i = t(60431),
        r = t(6391),
        l = t.n(r),
        d = t(6401),
        c = t(75958),
        u = t(2784);
      let m = (e, n, t) => {
          var a;
          let { amount: o } = e,
            i = (null === (a = o[0]) || void 0 === a ? void 0 : a.amount) ?? "",
            r = (0, s.t7o)(new (l())(t).toString(), n),
            d = (0, s.t7o)(new (l())(i).toString(), n),
            c = d.plus(r),
            u = c.toFormat(5, l().ROUND_DOWN),
            m = c.isLessThan("0.00001");
          return { amount: c, formattedAmount: m && !d.isEqualTo(0) ? "< 0.00001" : u };
        },
        g = (0, c.Pi)(e => {
          var n, t, s;
          let {
              fee: r,
              error: c,
              setError: g,
              disableBalanceCheck: f,
              rootBalanceStore: v,
              activeChain: p,
              selectedNetwork: x,
              feeTokensList: h,
              computedGas: b
            } = e,
            w = (0, o.dco)(),
            [y] = (0, o.X$P)(),
            N = v.getSpendableBalancesForChain(p, x, void 0),
            S = v.getLoadingStatusForChain(p, x),
            j = (0, u.useMemo)(() => (S ? "loading" : "success"), [S]),
            _ = (0, o.xxU)(),
            [D] = (0, d.nB)(),
            T = (0, u.useMemo)(() => {
              var e, n;
              let t = null == r ? void 0 : null === (e = r.amount[0]) || void 0 === e ? void 0 : e.denom,
                a = null == h ? void 0 : h.find(e => (e.ibcDenom ? e.ibcDenom === t : e.denom.coinMinimalDenom === t)),
                o =
                  null ===
                    (n = N.find(e => {
                      var n;
                      return (null == a ? void 0 : a.ibcDenom) || (null == e ? void 0 : e.ibcDenom)
                        ? (null == e ? void 0 : e.ibcDenom) === (null == a ? void 0 : a.ibcDenom)
                        : (null == e ? void 0 : e.coinMinimalDenom) ===
                            (null == a ? void 0 : null === (n = a.denom) || void 0 === n ? void 0 : n.coinMinimalDenom);
                    })) || void 0 === n
                    ? void 0
                    : n.amount;
              return { ...a, amount: o };
            }, [N, null == r ? void 0 : r.amount, h]),
            { data: E } = (0, i.useQuery)(
              ["fee-token-fiat-value", null == T ? void 0 : null === (n = T.denom) || void 0 === n ? void 0 : n.coinDenom],
              async () => {
                var e, n, t;
                return (0, o.knL)(
                  "1",
                  (null == T ? void 0 : null === (e = T.denom) || void 0 === e ? void 0 : e.coinGeckoId) ?? "",
                  null == T ? void 0 : null === (n = T.denom) || void 0 === n ? void 0 : n.chain,
                  o.r95[y].currencyPointer,
                  `${_}-${null == T ? void 0 : null === (t = T.denom) || void 0 === t ? void 0 : t.coinMinimalDenom}`
                );
              }
            ),
            k = (0, u.useMemo)(() => {
              var e;
              return r ? m(r, (null == T ? void 0 : null === (e = T.denom) || void 0 === e ? void 0 : e.coinDecimals) ?? 0, b) : null;
            }, [p, w, r, null == T ? void 0 : null === (t = T.denom) || void 0 === t ? void 0 : t.coinDecimals, b]);
          return (
            (0, u.useEffect)(() => {
              var e, n;
              let t = null == k ? void 0 : null === (e = k.amount) || void 0 === e ? void 0 : e.toString();
              !f &&
                t &&
                "loading" !== j &&
                (new (l())(t).isGreaterThan((null == T ? void 0 : T.amount) ?? 0)
                  ? g(`You don't have enough ${null == T ? void 0 : null === (n = T.denom) || void 0 === n ? void 0 : n.coinDenom} to pay the gas fee`)
                  : g(null));
            }, [T, k, j, f]),
            (0, a.jsx)("div", {
              className: "mt-3",
              children: k
                ? (0, a.jsx)("div", {
                    className: "rounded-lg bg-secondary-100 border border-secondary-200",
                    children: (0, a.jsxs)("div", {
                      className: "p-4",
                      children: [
                        (0, a.jsx)("div", {
                          className: "flex justify-between",
                          children: (0, a.jsx)("p", { className: "text-muted-foreground text-xs font-medium", children: "Gas Fees" })
                        }),
                        (0, a.jsxs)("p", {
                          className: "font-medium text-foreground text-sm mt-3 list-none ml-0",
                          children: [
                            k.formattedAmount,
                            " ",
                            null == T ? void 0 : null === (s = T.denom) || void 0 === s ? void 0 : s.coinDenom,
                            " ",
                            E ? D(new (l())((null == k ? void 0 : k.amount) ?? 0).multipliedBy(E)) : null
                          ]
                        }),
                        c ? (0, a.jsx)("p", { className: "font-medium text-destructive-400 text-sm mt-3 list-none ml-0", children: c }) : null
                      ]
                    })
                  })
                : null
            })
          );
        });
    },
    26738: function (e, n, t) {
      t.a(e, async function (e, a) {
        try {
          t.d(n, { t: () => x });
          var o = t(52322),
            s = t(58885),
            i = t(4370),
            r = t(14981),
            l = t(25053),
            d = t(2784),
            c = t(42799),
            u = t(48346),
            m = t(46338),
            g = t(43963),
            f = e([s, u]);
          [s, u] = f.then ? (await f)() : f;
          let v = [
              { id: "fees", label: "Fees" },
              { id: "details", label: "Details" }
            ],
            p = { transform: "translateX(0px) scaleX(0.161044)" },
            x = e => {
              let [n, t] = (0, d.useState)(v[0]);
              return (0, o.jsxs)(o.Fragment, {
                children: [
                  (0, o.jsx)("div", {
                    className: "border-b border-secondary-300",
                    children: (0, o.jsx)(l.z, {
                      buttons: v,
                      setSelectedTab: t,
                      selectedIndex: v.findIndex(e => {
                        let { id: t } = e;
                        return t === n.id;
                      }),
                      className: "gap-0.5",
                      buttonClassName: "px-3.5",
                      indicatorDefaultScale: p
                    })
                  }),
                  (0, o.jsx)("div", {
                    className: "flex flex-col gap-6",
                    children: (0, o.jsxs)(r.M, {
                      mode: "wait",
                      initial: !1,
                      children: [
                        "fees" === n.id &&
                          (0, o.jsx)(
                            i.E.div,
                            {
                              className: "flex flex-col gap-7",
                              transition: m._M,
                              variants: g.dJ,
                              initial: "exit",
                              animate: "animate",
                              exit: "exit",
                              children: e.allowSetFee
                                ? (0, o.jsxs)(o.Fragment, {
                                    children: [
                                      (0, o.jsx)(s.ZP.Selector, {}),
                                      (0, o.jsxs)("div", {
                                        className: "border border-border-bottom rounded-xl ",
                                        children: [
                                          (0, o.jsx)(s.ZP.AdditionalSettingsToggle, {}),
                                          (0, o.jsx)(s.ZP.AdditionalSettings, { showGasLimitWarning: !0, rootBalanceStore: u.jZ, rootDenomsStore: c.gb })
                                        ]
                                      }),
                                      !!e.gasPriceError &&
                                        (0, o.jsx)("p", { className: "text-destructive-100 text-sm font-medium px-1", children: e.gasPriceError }),
                                      " "
                                    ]
                                  })
                                : e.staticFee
                            },
                            "fees"
                          ),
                        "details" === n.id &&
                          (0, o.jsxs)("div", {
                            className: "flex flex-col gap-3 p-4 rounded-xl border border-secondary-200 bg-secondary-50",
                            children: [
                              (0, o.jsx)("span", { className: "text-muted-foreground text-xs font-medium", children: "Data" }),
                              (0, o.jsx)(
                                i.E.pre,
                                {
                                  transition: m._M,
                                  variants: g.dJ,
                                  initial: "enter",
                                  animate: "animate",
                                  exit: "enter",
                                  className: "text-xs  w-full text-wrap break-words",
                                  children: JSON.stringify(e.txData, (e, n) => ("bigint" == typeof n ? n.toString() : n), 2)
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
    99895: function (e, n, t) {
      t.d(n, { AX: () => c, I1: () => m, kS: () => u });
      var a = t(56594),
        o = t(15969),
        s = t(62101),
        i = t(6391),
        r = t.n(i),
        l = t(91128),
        d = t(48834).Buffer;
      function c(e) {
        let n = arguments.length > 1 && void 0 !== arguments[1] && arguments[1],
          t = s.GS.deserialize(e);
        if (n) {
          let n = new Uint8Array(d.from(e, "base64"));
          return { signDoc: s.GS.deserialize(n), signOptions: {} };
        }
        return { signDoc: t, signOptions: {} };
      }
      function u(e) {
        let n = 0,
          t = 0,
          a = new Uint8Array(d.from(e, "base64")),
          o = s.GS.deserialize(a);
        for (let [e, a] of o.message.compiledInstructions.entries())
          if (o.message.staticAccountKeys[a.programIdIndex].equals(s.Lb.programId)) {
            let e = d.from(a.data),
              o = e[0];
            2 === o && (n = e.readUInt32LE(1)), 3 === o && (t = Number(e.readBigUInt64LE(1)) / 1e6);
          }
        return { limit: n, price: t };
      }
      function m(e) {
        let { signRequestData: n, gasPrice: t, gasLimit: s, isGasOptionSelected: i, nativeFeeDenom: d } = e,
          { signOptions: u } = c(n.signDoc),
          m = (function (e, n, t, a, o) {
            let s = new (r())(n),
              i = (null == o ? void 0 : o.preferNoSetFee) && !a ? e : (0, l.R)(!s.isNaN() && s.isGreaterThan(0) ? s.toString() : e.gas, t);
            return (i.amount[0].amount = new (r())(i.amount[0].amount).plus(5e3).toString()), i;
          })((0, a.calculateFee)(Number(5e3), o.DB5.fromString(`0${d.coinMinimalDenom}`)), s, t, i, u);
        return { updatedSignDoc: n.signDoc, updatedFee: m, allowSetFee: !1, defaultFee: m, defaultMemo: "" };
      }
    },
    25053: function (e, n, t) {
      t.d(n, { z: () => c });
      var a = t(52322),
        o = t(91486),
        s = t(65903),
        i = t(2784),
        r = t(70514);
      let l = (0, i.forwardRef)((e, n) =>
        (0, a.jsx)("button", {
          ref: n,
          className: (0, r.cn)(
            "text-sm font-medium text-foreground transition-colors capitalize pb-3.5 rounded-full",
            o.YV,
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
          var n;
          let { setSelectedTab: t, selectedIndex: o, buttons: i, buttonClassName: c, className: u, indicatorDefaultScale: m } = e,
            { containerRef: g, indicatorRef: f, childRefs: v } = (0, s.r)({ navItems: i, activeLabel: null === (n = i[o]) || void 0 === n ? void 0 : n.label });
          return (0, a.jsxs)("div", {
            ref: g,
            className: (0, r.cn)("relative flex items-center isolate gap-7", u),
            children: [
              i.map((e, n) =>
                (0, a.jsx)(
                  l,
                  {
                    ref: e => v.current.set(n, e),
                    active: n === o,
                    onClick: () => t(e),
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
                ref: f,
                style: m ?? d
              })
            ]
          });
        };
      c.displayName = "TabSelectors";
    }
  }
]);
//# sourceMappingURL=6690.js.map
