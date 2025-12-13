!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "dbfc012c-e4ab-4e87-adb9-1c6fc3db9592"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-dbfc012c-e4ab-4e87-adb9-1c6fc3db9592"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.23.1" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["6551"],
  {
    30927: function (e, t, a) {
      a.d(t, { Z: () => i });
      var s = a(42765),
        l = a(91310),
        n = a(19785);
      function i(e, t) {
        (0, n.Z)(2, arguments);
        var a = (0, s.Z)(t);
        return (0, l.Z)(e, 1e3 * a);
      }
    },
    63400: function (e, t, a) {
      a.d(t, { u: () => i });
      var s = a(52322),
        l = a(71769);
      a(2784);
      var n = a(70514);
      function i(e) {
        let { className: t } = e;
        return (0, s.jsxs)("div", {
          className: (0, n.cn)("w-full flex flex-row items-start px-4 py-3 justify-start dark:bg-red-900 bg-red-100 rounded-2xl", t),
          children: [
            (0, s.jsx)(l.v, { weight: "fill", size: 20, className: "mr-2 text-destructive-100 p-[2px]" }),
            (0, s.jsxs)("div", {
              children: [
                (0, s.jsx)("p", { className: "text-sm text-foreground font-bold !leading-[20px]", children: "Unable to connect to ledger device" }),
                (0, s.jsx)("p", {
                  className: "text-xs text-secondary-800 font-medium !leading-[19px] mt-1",
                  children: "Please check if your ledger is connected and try again."
                })
              ]
            })
          ]
        });
      }
    },
    23751: function (e, t, a) {
      a.d(t, { D: () => n, KE: () => i });
      var s = a(52322);
      a(2784);
      var l = a(86874);
      function n() {
        return (0, s.jsxs)("div", {
          className: "flex rounded-2xl bg-secondary gap-y-1.5 flex-col p-4 w-full",
          children: [(0, s.jsx)(l.Z, { className: "w-24 h-5" }), (0, s.jsx)(l.Z, { className: "w-80 h-10" }), (0, s.jsx)(l.Z, { className: "w-24 h-6" })]
        });
      }
      function i(e) {
        return (0, s.jsx)("div", {
          className: "flex flex-col gap-4 text-xs",
          children: Array.from({ length: e.count ?? 1 }).map((e, t) =>
            (0, s.jsxs)(
              "div",
              {
                className: "flex items-center px-4 py-3 bg-secondary-100 w-full rounded-xl gap-4",
                children: [
                  (0, s.jsx)(l.Z, { width: 36, height: 36, circle: !0 }),
                  (0, s.jsx)(l.Z, { width: 100, height: 12 }),
                  (0, s.jsxs)("div", {
                    className: "flex flex-col items-end ml-auto ",
                    children: [(0, s.jsx)(l.Z, { width: 40, height: 8 }), (0, s.jsx)(l.Z, { width: 48, height: 6 })]
                  })
                ]
              },
              t
            )
          )
        });
      }
    },
    17469: function (e, t, a) {
      a.d(t, { Z: () => i });
      var s = a(52322);
      a(2784);
      var l = a(86874);
      function n() {
        return (0, s.jsxs)("div", {
          className: "flex items-center px-4 py-3 bg-white-100 dark:bg-gray-900 w-full rounded-2xl my-2",
          children: [
            (0, s.jsx)(l.Z, { circle: !0, width: 28, height: 28, className: "z-0" }),
            (0, s.jsxs)("div", {
              className: "w-[120px] ml-2",
              children: [(0, s.jsx)(l.Z, { count: 1, className: "z-0" }), (0, s.jsx)(l.Z, { count: 1, className: "z-0" })]
            })
          ]
        });
      }
      function i() {
        return (0, s.jsxs)(s.Fragment, { children: [(0, s.jsx)(n, {}), (0, s.jsx)(n, {}), (0, s.jsx)(n, {}), (0, s.jsx)(n, {}), (0, s.jsx)(n, {})] });
      }
    },
    49728: function (e, t, a) {
      a.d(t, { U: () => d });
      var s = a(2784),
        l = a(10289),
        n = a(55736),
        i = a(48534),
        o = a(72565),
        r = a.n(o);
      let d = () => {
        let e = (0, l.s0)();
        return (0, s.useCallback)(async () => {
          let t = r().extension.getViews({ type: "popup" }),
            a = 0 === t.length && 600 === window.outerHeight && 400 === window.outerWidth,
            s = -1 !== t.findIndex(e => e === window);
          if (a || s || (0, i.oj)()) {
            if (!(0, i.oj)()) {
              let e = (await r().windows.getAll()).find(e => "popup" !== e.type);
              e && r().tabs.create({ url: r().runtime.getURL("index.html#/reconnect-ledger"), windowId: e.id }), window.close();
              return;
            }
            window.open("index.html#/reconnect-ledger", "_blank"), (0, n.I)();
          } else e("/reconnect-ledger");
        }, [e]);
      };
    },
    17328: function (e, t, a) {
      a.d(t, { M: () => l });
      var s = a(52322);
      a(2784);
      let l = e =>
        (0, s.jsx)("svg", {
          width: "16",
          height: "16",
          viewBox: "0 0 16 16",
          fill: "none",
          xmlns: "http://www.w3.org/2000/svg",
          ...e,
          children: (0, s.jsx)("path", {
            d: "M9.37248 6.01333L9.98581 6.62667L3.94581 12.6667H3.33248V12.0533L9.37248 6.01333ZM11.7725 2C11.6058 2 11.4325 2.06667 11.3058 2.19333L10.0858 3.41333L12.5858 5.91333L13.8058 4.69333C14.0658 4.43333 14.0658 4.01333 13.8058 3.75333L12.2458 2.19333C12.1125 2.06 11.9458 2 11.7725 2ZM9.37248 4.12667L1.99915 11.5V14H4.49915L11.8725 6.62667L9.37248 4.12667Z",
            fill: "currentColor"
          })
        });
    },
    71845: function (e, t, a) {
      a.d(t, { Z: () => r });
      var s = a(52322),
        l = a(6806),
        n = a(2784);
      let i = new Map([
          [
            "regular",
            (0, s.jsxs)(
              n.Fragment,
              {
                children: [
                  (0, s.jsxs)("g", {
                    clipPath: "url(#clip0_241_1099)",
                    children: [
                      (0, s.jsx)("path", {
                        d: "M3 12.75H14.0625",
                        stroke: "currentColor",
                        strokeWidth: "1.5",
                        strokeLinecap: "round",
                        strokeLinejoin: "round"
                      }),
                      (0, s.jsx)("path", { d: "M3 8.25H21", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }),
                      (0, s.jsx)("path", { d: "M3 17.25H7.125", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" })
                    ]
                  }),
                  (0, s.jsx)("defs", {
                    children: (0, s.jsx)("clipPath", {
                      id: "clip0_241_1099",
                      children: (0, s.jsx)("rect", { width: "24", height: "24", fill: "currentColor" })
                    })
                  })
                ]
              },
              "regular"
            )
          ],
          [
            "bold",
            (0, s.jsxs)(
              n.Fragment,
              {
                children: [
                  (0, s.jsxs)("g", {
                    clipPath: "url(#clip0_256_253)",
                    children: [
                      (0, s.jsx)("path", {
                        d: "M3 12.75H14.0625",
                        stroke: "currentColor",
                        strokeWidth: "2.25",
                        strokeLinecap: "round",
                        strokeLinejoin: "round"
                      }),
                      (0, s.jsx)("path", { d: "M3 8.25H21", stroke: "currentColor", strokeWidth: "2.25", strokeLinecap: "round", strokeLinejoin: "round" }),
                      (0, s.jsx)("path", { d: "M3 17.25H7.125", stroke: "currentColor", strokeWidth: "2.25", strokeLinecap: "round", strokeLinejoin: "round" })
                    ]
                  }),
                  (0, s.jsx)("defs", {
                    children: (0, s.jsx)("clipPath", { id: "clip0_256_253", children: (0, s.jsx)("rect", { width: "24", height: "24", fill: "currentColor" }) })
                  })
                ]
              },
              "bold"
            )
          ],
          [
            "fill",
            (0, s.jsx)(
              "path",
              {
                fillRule: "evenodd",
                clipRule: "evenodd",
                d: "M4 0H20C22.2091 0 24 1.79086 24 4V20C24 22.2091 22.2091 24 20 24H4C1.79086 24 0 22.2091 0 20V4C0 1.79086 1.79086 0 4 0ZM3 12C2.58579 12 2.25 12.3358 2.25 12.75C2.25 13.1642 2.58579 13.5 3 13.5H14.0625C14.4767 13.5 14.8125 13.1642 14.8125 12.75C14.8125 12.3358 14.4767 12 14.0625 12H3ZM2.25 8.25C2.25 7.83579 2.58579 7.5 3 7.5H21C21.4142 7.5 21.75 7.83579 21.75 8.25C21.75 8.66421 21.4142 9 21 9H3C2.58579 9 2.25 8.66421 2.25 8.25ZM3 16.5C2.58579 16.5 2.25 16.8358 2.25 17.25C2.25 17.6642 2.58579 18 3 18H7.125C7.53921 18 7.875 17.6642 7.875 17.25C7.875 16.8358 7.53921 16.5 7.125 16.5H3Z",
                fill: "currentColor"
              },
              "fill"
            )
          ]
        ]),
        o = (0, n.forwardRef)((e, t) => (0, s.jsx)(l.Z, { viewBox: "0 0 24 24", ref: t, ...e, weights: i }));
      o.displayName = "Sort";
      let r = o;
    },
    42751: function (e, t, a) {
      a.a(e, async function (e, s) {
        try {
          a.r(t), a.d(t, { default: () => U });
          var l = a(52322),
            n = a(41172),
            i = a(15969),
            o = a(35164),
            r = a(48272),
            d = a(6391),
            c = a.n(d),
            u = a(58885),
            m = a(51994),
            x = a(80588),
            v = a(23751),
            f = a(30927),
            h = a(10706),
            p = a(42941),
            g = a(65027),
            b = a(75958),
            j = a(2784),
            w = a(10289),
            k = a(94629),
            E = a(11764),
            N = a(81398),
            y = a(78220),
            C = a(15249),
            D = a(26869),
            S = a(92642),
            L = a(69816),
            A = a(91486),
            T = a(13287),
            M = a(18823),
            G = a(80502),
            _ = a(92621),
            P = a(20537),
            Z = a(26908),
            R = a(39719),
            z = a(92006),
            F = a(28345),
            V = e([g, h, z, C, F, u, m, x]);
          [g, h, z, C, F, u, m, x] = V.then ? (await V)() : V;
          let I = g.w.useGetWallet,
            U = (0, b.Pi)(e => {
              var t, a, s, d, g, b, V;
              let {
                  rootDenomsStore: U,
                  delegationsStore: O,
                  validatorsStore: H,
                  unDelegationsStore: $,
                  claimRewardsStore: B,
                  rootBalanceStore: W,
                  nmsStore: K
                } = e,
                [Y, J] = (0, j.useState)(),
                [X, q] = (0, j.useState)(!1),
                [Q, ee] = (0, j.useState)(!1),
                [et, ea] = (0, j.useState)(!1),
                [es, el] = (0, j.useState)(!1),
                [en, ei] = (0, j.useState)(!1),
                [eo, er] = (0, j.useState)(!1),
                [ed, ec] = (0, j.useState)(!1),
                [eu, em] = (0, j.useState)(!1),
                [ex, ev] = (0, j.useState)(null),
                ef = (0, w.s0)(),
                eh = (0, w.TH)(),
                ep = (0, p.Z)().get("validatorAddress") ?? void 0,
                {
                  toValidator: eg,
                  fromValidator: eb,
                  mode: ej = "DELEGATE",
                  delegation: ew,
                  forceChain: ek,
                  forceNetwork: eE,
                  toProvider: eN,
                  fromProvider: ey,
                  providerDelegation: eC
                } = (0, j.useMemo)(() => {
                  let e = JSON.parse(sessionStorage.getItem("navigate-stake-input-state") ?? "null");
                  return (null == eh ? void 0 : eh.state) || e || {};
                }, [null == eh ? void 0 : eh.state]),
                [eD, eS] = (0, j.useState)(eN),
                eL = (0, n.a74)(),
                eA = (0, n.obn)(),
                eT = (0, j.useMemo)(() => ek || eL, [eL, ek]),
                eM = (0, j.useMemo)(() => eE || eA, [eA, eE]),
                eG = U.allDenoms,
                e_ = O.delegationsForChain(eT),
                eP = H.validatorsForChain(eT),
                eZ = $.unDelegationsForChain(eT),
                eR = B.claimRewardsForChain(eT);
              (0, j.useEffect)(() => {
                H.ensureValidatorsLoaded(eT, eM);
              }, [eT, eM, H]);
              let [ez] = (0, n.JsT)(eG, eT, eM);
              (0, M.S)();
              let { network: eF } = (0, n.nDu)(eG, e_, eP, eZ, eR, eT, eM),
                { providers: eV } = (0, n.fHb)(),
                eI = (0, j.useMemo)(() => {
                  var e, t;
                  return (0, k.z)(
                    (0, f.Z)(
                      new Date(),
                      (null == eF
                        ? void 0
                        : null === (t = eF.chain) || void 0 === t
                          ? void 0
                          : null === (e = t.params) || void 0 === e
                            ? void 0
                            : e.unbonding_time) ?? 86410
                    ).toISOString(),
                    ""
                  );
                }, [eF]),
                eU = (0, j.useMemo)(() => {
                  var e;
                  return null === (e = eP.validatorData.validators) || void 0 === e ? void 0 : e.reduce((e, t) => ((e[t.address] = t), e), {});
                }, [eP.validatorData.validators]),
                eO = (0, j.useMemo)(
                  () =>
                    Object.values(eU ?? {}).some(e => {
                      var t;
                      return (null === (t = e.custom_attributes) || void 0 === t ? void 0 : t.priority) === 0;
                    }),
                  [eU]
                ),
                [eH, e$] = (0, j.useState)(("DELEGATE" === ej && !eO) || ("REDELEGATE" === ej && !ey)),
                eB = null == eF ? void 0 : eF.validatorAprs,
                { data: eW } = (0, n.S2A)(),
                {
                  amount: eK,
                  setAmount: eY,
                  recommendedGasLimit: eJ,
                  userPreferredGasLimit: eX,
                  setUserPreferredGasLimit: eq,
                  userPreferredGasPrice: eQ,
                  setUserPreferredGasPrice: e0,
                  gasOption: e2,
                  setFeeDenom: e1,
                  isLoading: e4,
                  onReviewTransaction: e5,
                  customFee: e6,
                  feeDenom: e3,
                  setGasOption: e7,
                  error: e8,
                  ledgerError: e9,
                  setLedgerError: te,
                  showLedgerPopup: tt,
                  setMemo: ta
                } = "lava" === eT && (null == eW ? void 0 : null === (t = eW.restaking) || void 0 === t ? void 0 : t.extension) === "active"
                  ? (0, n.$l7)(eG, ej, Y, eb, [ew], [eC], eD, ey, void 0, eT, eM)
                  : (0, n.rKd)(eG, ej, Y, eb, [ew], eT, eM),
                ts = (0, u.e7)(eG, { activeChain: eT, selectedNetwork: eM }),
                tl = I(eT),
                { activeWallet: tn } = (0, h.ZP)(),
                [ti, to] = (0, j.useState)(null),
                [tr, td] = (0, j.useState)({ option: e2, gasPrice: eQ ?? ts.gasPrice }),
                [tc, tu] = (0, j.useState)(),
                tm = (0, j.useMemo)(() => {
                  var e;
                  return null === (e = W.allTokens) || void 0 === e
                    ? void 0
                    : e.find(e => e.symbol === (null == ez ? void 0 : ez.coinDenom) && e.tokenBalanceOnChain === eT && !e.ibcChainInfo);
                }, [null == ez ? void 0 : ez.coinDenom, W.allTokens, eT]),
                tx = (0, j.useMemo)(() => {
                  var e;
                  return null === (e = W.allSpendableTokens) || void 0 === e
                    ? void 0
                    : e.find(e => e.symbol === (null == ez ? void 0 : ez.coinDenom) && e.tokenBalanceOnChain === eT && !e.ibcChainInfo);
                }, [null == ez ? void 0 : ez.coinDenom, W.allSpendableTokens, eT]),
                tv = (!tx || (null == tx ? void 0 : tx.amount) === "0") && (null == tm ? void 0 : tm.amount) && parseFloat(tm.amount) > 0,
                tf = (0, n.Ewi)(eU, K, eT, eM),
                th = (0, j.useMemo)(
                  () =>
                    tf
                      .filter(e => !e.jailed)
                      .filter(e => e.address !== (null == eb ? void 0 : eb.address))
                      .filter(e => "cosmosvaloper1j78gfl4ml9h2xdduhw2cpgheu3hdalkpuvk7m5" !== e.address),
                  [tf, null == eb ? void 0 : eb.address]
                ),
                tp = (0, j.useMemo)(() => eg || (ep ? (null == eU ? void 0 : eU[ep]) : void 0), [eg, ep, eU]),
                tg = (0, j.useMemo)(() => {
                  let e = [...eV];
                  return (
                    "REDELEGATE" === ej &&
                      e.push({
                        provider: "empty_provider",
                        moniker: "Empty Provider",
                        address: "empty_provider",
                        specs: [],
                        stakestatus: "Active",
                        delegateCommission: "",
                        delegateLimit: "",
                        delegateTotal: ""
                      }),
                    e.filter(e => e.address !== (null == ey ? void 0 : ey.address))
                  );
                }, [null == ey ? void 0 : ey.address, ej, eV]);
              (0, j.useEffect)(() => {
                td({ option: e2, gasPrice: ts.gasPrice });
              }, [ts.gasPrice.amount.toString(), ts.gasPrice.denom]),
                (0, j.useEffect)(() => {
                  if (!Y) {
                    if ((er(!0), tp)) J(tp), e$(!1);
                    else if ("DELEGATE" === ej) {
                      let e = Object.values(eU ?? {}).find(e => {
                        var t;
                        return (null === (t = e.custom_attributes) || void 0 === t ? void 0 : t.priority) === 0;
                      });
                      e && J(e);
                    }
                    er(!1);
                  }
                }, [ej, Y, tp, eU]),
                (0, j.useEffect)(() => {
                  tr.option && e7(tr.option), tr.gasPrice && e0(tr.gasPrice);
                }, [tr, e7, e0]);
              let tb = (0, j.useCallback)(
                  (e, t) => {
                    td(e), e1(t.denom);
                  },
                  [e1]
                ),
                tj = (0, j.useCallback)(() => {
                  ev(ej), ea(!1);
                }, [ey, ej]),
                tw = (0, j.useCallback)(async () => {
                  try {
                    let e = await tl(eT);
                    await e5(e, tj, !1, { stdFee: e6, feeDenom: e3 });
                  } catch (e) {
                    te(e.message),
                      setTimeout(() => {
                        te("");
                      }, 6e3),
                      (0, S.Tb)(e, {
                        tags: {
                          errorType: "stake_v2_transaction_error",
                          source: "stake_v2",
                          severity: "error",
                          errorName: e instanceof Error ? e.name : "StakeV2TransactionError"
                        },
                        fingerprint: ["stake_v2", "stake_v2_error"],
                        level: "error",
                        contexts: { transaction: { type: "stake_v2", errorMessage: e instanceof Error ? e.message : String(e) } },
                        extra: { chain: eT, feeDenom: e3, customFee: e6 }
                      });
                  }
                }, [eT, e6, e3, tl, e5, te, tj]);
              (0, j.useEffect)(() => {
                eu && new (c())(eK).gt(0) && ea(!0);
              }, [eu, eK]),
                (0, j.useEffect)(() => {
                  var e, t;
                  ("DELEGATE" === ej || "REDELEGATE" === ej) &&
                  (null == Y ? void 0 : null === (e = Y.custom_attributes) || void 0 === e ? void 0 : e.priority) &&
                  (null == Y ? void 0 : null === (t = Y.custom_attributes) || void 0 === t ? void 0 : t.priority) > 0
                    ? ta("Staked with Leap Wallet")
                    : ta("");
                }, [ej, null == Y ? void 0 : null === (a = Y.custom_attributes) || void 0 === a ? void 0 : a.priority, ta]);
              let tk = (0, j.useMemo)(() => (ew ? ew.balance : eC ? eC.amount : void 0), [ew, eC]);
              (0, T.U)(e9 || e8, { activeChain: eT, activeNetwork: eM, mode: ej });
              let tE = W.getLoadingStatusForChain(eT, eM),
                tN = null === (s = O.delegationsForChain(eT)) || void 0 === s ? void 0 : s.loadingDelegations;
              return (
                (0, j.useEffect)(
                  () => () => {
                    eh.state || sessionStorage.removeItem("navigate-stake-input-state");
                  },
                  [eh.state]
                ),
                (0, l.jsxs)(l.Fragment, {
                  children: [
                    Y || ey
                      ? (0, l.jsxs)(l.Fragment, {
                          children: [
                            (0, l.jsx)(z.w, {}),
                            (0, l.jsxs)("div", {
                              className: "flex flex-col gap-y-5 px-6 pb-6 pt-7 w-full flex-1 h-[calc(100%-132px)] overflow-y-scroll bg-secondary",
                              children: [
                                eb &&
                                  (0, l.jsx)(y.Z, {
                                    title: "Current Validator",
                                    selectedValidator: eb,
                                    setShowSelectValidatorSheet: e$,
                                    selectDisabled: !0,
                                    apr: eB && eB[(null == eb ? void 0 : eb.address) ?? ""]
                                  }),
                                ey &&
                                  (0, l.jsx)(P.s, {
                                    title: "Current Provider",
                                    selectedProvider: ey,
                                    setShowSelectProviderSheet: q,
                                    selectDisabled: !0,
                                    rootDenomsStore: U
                                  }),
                                (0, l.jsx)(D.Z, {
                                  amount: eK,
                                  setAmount: eY,
                                  adjustAmount: eu,
                                  setAdjustAmount: em,
                                  token: tm,
                                  fees: null == e6 ? void 0 : e6.amount[0],
                                  hasError: en,
                                  setHasError: ei,
                                  mode: ej,
                                  tokenLoading: tE,
                                  delegationBalance: tk,
                                  rootDenomsStore: U,
                                  activeChain: eT,
                                  activeNetwork: eM,
                                  delegationBalanceLoading: tN
                                }),
                                !ey &&
                                  (eo
                                    ? (0, l.jsx)(v.D, {})
                                    : (0, l.jsx)(y.Z, {
                                        title:
                                          "lava" === eT &&
                                          (null == eW ? void 0 : null === (d = eW.restaking) || void 0 === d ? void 0 : d.extension) === "active" &&
                                          "DELEGATE" === ej
                                            ? "Stake to Validator"
                                            : "Validator",
                                        selectedValidator: Y,
                                        setShowSelectValidatorSheet: e$,
                                        selectDisabled: "UNDELEGATE" === ej && !!tp,
                                        apr: eB && eB[(null == Y ? void 0 : Y.address) ?? ""]
                                      })),
                                "lava" === eT &&
                                  (null == eW ? void 0 : null === (g = eW.restaking) || void 0 === g ? void 0 : g.extension) === "active" &&
                                  ("DELEGATE" === ej || ("REDELEGATE" === ej && ey) || ("UNDELEGATE" === ej && eN)) &&
                                  (0, l.jsx)(P.s, {
                                    title: "DELEGATE" === ej ? "Restake to Provider" : "Provider",
                                    optional: "DELEGATE" === ej,
                                    selectedProvider: eD,
                                    setShowSelectProviderSheet: q,
                                    selectDisabled: "UNDELEGATE" === ej,
                                    rootDenomsStore: U
                                  }),
                                tm && new (c())(tm.amount).isEqualTo(0) && (0, l.jsx)(E.Z, { rootDenomsStore: U, activeChain: eT, activeNetwork: eM }),
                                new (c())(eK).isGreaterThan(0) &&
                                  (0, l.jsxs)("div", {
                                    className: "flex items-center justify-between px-2",
                                    children: [
                                      !(0, i.sSP)(eT) &&
                                        (0, l.jsxs)("div", {
                                          className: "text-xs font-medium",
                                          children: [
                                            (0, l.jsx)("span", { className: "text-muted-foreground", children: "Unstaking period: " }),
                                            (0, l.jsx)("span", { children: eI })
                                          ]
                                        }),
                                      (null == tc ? void 0 : tc.fiatValue) &&
                                        (0, l.jsxs)("button", {
                                          onClick: () => ee(!0),
                                          className: "flex items-center hover:cursor-pointer ml-auto gap-1 group",
                                          "aria-label": "stake input page fees button in stake v2 flow",
                                          children: [
                                            (0, l.jsx)(o.P, { size: 16 }),
                                            (0, l.jsx)("span", {
                                              className: "text-xs text-secondary-800 font-medium group-hover:text-foreground transition-colors",
                                              "aria-label": "stake input page fees button text in stake v2 flow",
                                              children: null == tc ? void 0 : tc.fiatValue
                                            }),
                                            (0, l.jsx)(r.p, {
                                              size: 12,
                                              className: "text-secondary-600 group-hover:text-secondary-800 transition-colors",
                                              "aria-label": "stake input page fees button icon in stake v2 flow"
                                            })
                                          ]
                                        })
                                    ]
                                  }),
                                tv &&
                                  (0, l.jsxs)(L.Z, {
                                    className: "px-3 font-medium text-center",
                                    size: "sm",
                                    color: "text-red-300",
                                    children: ["Insufficient unlocked ", null == tm ? void 0 : tm.symbol, " for gas fees. Please buy some and try again"]
                                  })
                              ]
                            }),
                            (0, l.jsx)("div", {
                              className: "flex flex-col gap-4 w-full p-4 mt-auto sticky bottom-0 bg-secondary-100",
                              children: (0, l.jsx)(A.zx, {
                                className: "w-full",
                                variant: en ? "destructive" : "default",
                                onClick: () => {
                                  if (
                                    "DELEGATE" === ej &&
                                    parseFloat(eK) + ((null == tc ? void 0 : tc.value) ?? 0) > parseFloat((null == tm ? void 0 : tm.amount) ?? "")
                                  )
                                    ec(!0);
                                  else {
                                    var e;
                                    "lava" !== eT ||
                                    (null == eW ? void 0 : null === (e = eW.restaking) || void 0 === e ? void 0 : e.extension) !== "active" ||
                                    "DELEGATE" !== ej ||
                                    eD
                                      ? (null == tn ? void 0 : tn.watchWallet)
                                        ? G.o.setShowPopup(!0)
                                        : ea(!0)
                                      : el(!0);
                                  }
                                },
                                disabled: !new (c())(eK).isGreaterThan(0) || en || tv || ((eb || "DELEGATE" === ej) && !Y) || (ey && !eD) || !!e9,
                                "aria-label": "stake input page review button in stake v2 flow",
                                children: en
                                  ? (0, l.jsx)("span", {
                                      "aria-label": "stake input page review button text in stake v2 flow",
                                      children: "Insufficient Balance"
                                    })
                                  : (0, l.jsxs)("span", {
                                      "aria-label": "stake input page review button text in stake v2 flow",
                                      children: ["Review ", (0, N.P)(ej, !!ey)]
                                    })
                              })
                            })
                          ]
                        })
                      : null,
                    (0, l.jsx)(C.Z, {
                      isVisible: eH,
                      onClose: () => {
                        Y ? e$(!1) : ef(-1);
                      },
                      onValidatorSelect: e => {
                        J(e), e$(!1);
                      },
                      validators: th,
                      apr: eB,
                      forceChain: eT,
                      forceNetwork: eM
                    }),
                    "lava" === eT &&
                      (null == eW ? void 0 : null === (b = eW.restaking) || void 0 === b ? void 0 : b.extension) === "active" &&
                      (0, l.jsx)(Z.Z, {
                        isVisible: X,
                        onClose: () => q(!1),
                        onProviderSelect: e => {
                          eS(e), q(!1);
                        },
                        providers: tg
                      }),
                    (Y || ("REDELEGATE" === ej && eD)) &&
                      (0, l.jsx)(N.Z, {
                        isVisible: et,
                        isLoading: e4,
                        onClose: () => ea(!1),
                        onSubmit: tw,
                        tokenAmount: eK,
                        token: tm,
                        validator: Y,
                        provider: eD,
                        error: e8,
                        gasError: ti,
                        mode: ej,
                        unstakingPeriod: eI,
                        showLedgerPopup: tt,
                        ledgerError: e9,
                        activeChain: eT
                      }),
                    "DELEGATE" === ej && tm && e6 && ed
                      ? (0, l.jsx)(_.Z, {
                          tokenAmount: eK,
                          setTokenAmount: eY,
                          token: tm,
                          fee: e6.amount[0],
                          onAdjust: () => {
                            ec(!1), em(!0), ea(!0);
                          },
                          onCancel: () => {
                            ec(!1);
                          },
                          isOpen: ed
                        })
                      : null,
                    "lava" === eT &&
                      (null == eW ? void 0 : null === (V = eW.restaking) || void 0 === V ? void 0 : V.extension) === "active" &&
                      "DELEGATE" === ej &&
                      (0, l.jsx)(R.Z, {
                        isVisible: es,
                        onClose: () => el(!1),
                        setShowSelectProviderSheet: () => {
                          el(!1), q(!0);
                        },
                        onReviewStake: () => {
                          el(!1), ea(!0);
                        }
                      }),
                    (0, l.jsx)(F.U, {
                      mode: ex,
                      isOpen: !!ex,
                      onClose: () => {
                        eY(""), ev(null);
                      },
                      forceChain: eT,
                      forceNetwork: eM
                    }),
                    (0, l.jsxs)(u.ZP, {
                      recommendedGasLimit: eJ,
                      gasLimit: (null == eX ? void 0 : eX.toString()) ?? eJ,
                      setGasLimit: e => eq(Number(e.toString())),
                      gasPriceOption: tr,
                      onGasPriceOptionChange: tb,
                      error: ti,
                      setError: to,
                      chain: eT,
                      network: eM,
                      rootDenomsStore: U,
                      rootBalanceStore: W,
                      children: [
                        (0, l.jsx)(m.a, { className: "hidden", setDisplayFeeValue: tu, setShowFeesSettingSheet: ee }),
                        (0, l.jsx)(x.k, { showFeesSettingSheet: Q, onClose: () => ee(!1), gasError: null })
                      ]
                    })
                  ]
                })
              );
            });
          s();
        } catch (e) {
          s(e);
        }
      });
    },
    28345: function (e, t, a) {
      a.a(e, async function (e, s) {
        try {
          a.d(t, { U: () => g });
          var l = a(52322),
            n = a(56594),
            i = a(41172),
            o = a(89187),
            r = a(96217),
            d = a(91486),
            c = a(72059),
            u = a(30464),
            m = a(75958),
            x = a(2784),
            v = a(62833),
            f = a(48346),
            h = a(90258),
            p = e([c, f]);
          [c, f] = p.then ? (await p)() : p;
          let g = (0, m.Pi)(e => {
            let { isOpen: t, onClose: a, mode: s, forceChain: m, forceNetwork: p } = e,
              g = (0, c.a7)(),
              b = (0, i.obn)(),
              j = m ?? g,
              w = p ?? b,
              { pendingTx: k, setPendingTx: E } = (0, i.EEe)(),
              { explorerTxnUrl: N } = (0, i.xGX)({ forceChain: j, forceNetwork: w, forceTxHash: null == k ? void 0 : k.txHash });
            return (
              (0, x.useEffect)(() => {
                (null == k ? void 0 : k.promise) &&
                  k.promise
                    .then(
                      e => {
                        e && (0, n.isDeliverTxSuccess)(e) ? E({ ...k, txStatus: "success" }) : E({ ...k, txStatus: "failed" });
                      },
                      () => E({ ...k, txStatus: "failed" })
                    )
                    .catch(() => {
                      E({ ...k, txStatus: "failed" });
                    })
                    .finally(() => {
                      f.jZ.refetchBalances(j, w), f.lc.updateStake(j, w, !0);
                    });
              }, [null == k ? void 0 : k.promise]),
              (0, l.jsxs)(r.Z, {
                fullScreen: !0,
                isOpen: t,
                onClose: a,
                containerClassName: "bg-secondary-50",
                className: "h-full flex flex-col",
                children: [
                  (0, l.jsxs)("div", {
                    className: "flex flex-col gap-6 items-center my-auto",
                    children: [
                      (0, l.jsxs)("div", {
                        className: "flex flex-col gap-10 items-center",
                        children: [
                          (0, l.jsxs)("div", {
                            className: "flex items-center justify-center",
                            children: [
                              (null == k ? void 0 : k.txStatus) === "loading" &&
                                (0, l.jsx)("div", {
                                  className: "size-[100px] p-8 rounded-full bg-secondary-200 animate-spin",
                                  children: (0, l.jsx)("img", { className: "size-full", src: u.r.Swap.Rotate })
                                }),
                              (null == k ? void 0 : k.txStatus) === "success" &&
                                (0, l.jsx)("div", {
                                  className: "size-[100px] p-8 rounded-full bg-green-400",
                                  children: (0, l.jsx)("img", { className: "size-full", src: u.r.Swap.CheckGreen })
                                }),
                              (null == k ? void 0 : k.txStatus) === "failed" &&
                                (0, l.jsx)("div", {
                                  className: "size-[100px] p-8 rounded-full bg-red-600 dark:bg-red-400",
                                  children: (0, l.jsx)("img", { className: "size-full", src: u.r.Swap.FailedRed })
                                })
                            ]
                          }),
                          (0, l.jsxs)("div", {
                            className: "flex flex-col gap-3 items-center",
                            children: [
                              (0, l.jsxs)("span", {
                                className: "font-bold text-[1.5rem] text-center text-foreground",
                                children: [h.d6[s || "DELEGATE"], " ", h.KT[(null == k ? void 0 : k.txStatus) || "loading"]]
                              }),
                              (null == k ? void 0 : k.subtitle2) && "success" === k.txStatus
                                ? (0, l.jsx)("span", { className: "text-sm text-secondary-800 text-center mx-6", children: k.subtitle2 })
                                : null
                            ]
                          })
                        ]
                      }),
                      N
                        ? (0, l.jsxs)("a", {
                            target: "_blank",
                            rel: "noreferrer",
                            href: N,
                            className: "flex font-medium items-center gap-1 text-sm text-accent-green hover:text-accent-green-200 transition-colors",
                            children: ["View transaction", (0, l.jsx)(o.T, { size: 12 })]
                          })
                        : null
                    ]
                  }),
                  (0, l.jsxs)("div", {
                    className: "flex gap-x-4 mt-auto [&>*]:flex-1",
                    children: [
                      (0, l.jsx)(d.zx, { variant: "mono", asChild: !0, children: (0, l.jsx)(v.rU, { to: "/home", children: "Home" }) }),
                      (0, l.jsx)(d.zx, {
                        onClick: a,
                        disabled: (null == k ? void 0 : k.txStatus) === "loading",
                        children: (null == k ? void 0 : k.txStatus) === "failed" ? "Retry" : "DELEGATE" === s ? "Stake Again" : "Done"
                      })
                    ]
                  })
                ]
              })
            );
          });
          s();
        } catch (e) {
          s(e);
        }
      });
    },
    92621: function (e, t, a) {
      a.d(t, { Z: () => u });
      var s = a(52322),
        l = a(15969),
        n = a(75377),
        i = a(6391),
        o = a.n(i),
        r = a(96217),
        d = a(2784),
        c = a(46103);
      function u(e) {
        let { isOpen: t, tokenAmount: a, fee: i, setTokenAmount: u, onAdjust: m, onCancel: x, token: v } = e,
          { theme: f } = (0, n.useTheme)(),
          h = (0, d.useMemo)(() => {
            let e = (0, l.hI1)(v.amount ?? "0", (null == v ? void 0 : v.coinDecimals) ?? 6),
              t = new (o())(e).minus((null == i ? void 0 : i.amount) ?? "");
            return t.lte(0) ? "0" : new (o())((0, l.TGo)(t.toString(), (null == v ? void 0 : v.coinDecimals) ?? 6)).toFixed(6, 1);
          }, [null == i ? void 0 : i.amount, v.amount, null == v ? void 0 : v.coinDecimals]),
          p = (0, d.useCallback)(() => {
            h ? (u(h), m()) : x();
          }, [m, x, u, h]);
        (0, d.useEffect)(() => {
          h ? (u(h), m()) : x();
        }, [m, x, u, h]);
        let g = (0, d.useMemo)(() => `${a} ${v.symbol ?? ""}`, [v.symbol, a]),
          b = (0, d.useMemo)(() => (h ? `${h} ${v.symbol ?? ""}` : null), [v.symbol, h]);
        return (0, s.jsxs)(r.Z, {
          isOpen: t,
          onClose: x,
          title: "Adjust for Transaction Fees",
          children: [
            (0, s.jsxs)("div", {
              className: "rounded-2xl p-4 dark:bg-gray-900 bg-white-100 dark:text-gray-200 text-gray-800",
              children: [
                (0, s.jsxs)("p", { children: ["Insufficient ", v.symbol ?? "", " balance to pay transaction fees."] }),
                (0, s.jsxs)("p", {
                  className: "mt-2",
                  children: [
                    "Should we adjust the amount from",
                    " ",
                    (0, s.jsx)("span", { className: "text-green-500 font-medium", children: g }),
                    " to",
                    " ",
                    (0, s.jsx)("span", { className: "text-green-500 font-medium", children: b ?? "-" }),
                    "?"
                  ]
                })
              ]
            }),
            (0, s.jsxs)("div", {
              className: "flex flex-col items-center gap-y-3 mt-5",
              children: [
                (0, s.jsx)(n.Buttons.Generic, {
                  color: f === n.ThemeName.DARK ? c.w.gray900 : c.w.gray300,
                  size: "normal",
                  className: "w-full",
                  title: "Don't adjust",
                  onClick: x,
                  "aria-label": "auto adjust modal cancel button in stake v2 flow",
                  children: (0, s.jsx)("span", { "aria-label": "auto adjust modal cancel button text in stake v2 flow", children: "Cancel Transaction" })
                }),
                (0, s.jsx)(n.Buttons.Generic, {
                  color: c.w.green600,
                  size: "normal",
                  className: "w-full",
                  title: "Auto-adjust",
                  onClick: p,
                  "aria-label": "auto adjust modal auto adjust button in stake v2 flow",
                  children: (0, s.jsx)("span", { "aria-label": "auto adjust modal auto adjust button text in stake v2 flow", children: "Auto-adjust" })
                })
              ]
            })
          ]
        });
      }
    },
    11764: function (e, t, a) {
      a.d(t, { Z: () => r });
      var s = a(52322),
        l = a(41172),
        n = a(91486),
        i = a(75958);
      a(2784);
      var o = a(10289);
      let r = (0, i.Pi)(e => {
        let { rootDenomsStore: t, activeChain: a, activeNetwork: i } = e,
          [r] = (0, l.JsT)(t.allDenoms, a, i),
          d = (0, l.QSC)(),
          c = (0, o.s0)(),
          u = (0, l.QSC)("osmosis");
        return (0, s.jsxs)("div", {
          className: "flex w-full items-center justify-between p-5 rounded-xl bg-secondary-100",
          children: [
            (0, s.jsxs)("div", {
              className: "flex flex-col gap-1",
              children: [
                (0, s.jsx)("span", { className: "font-medium", children: "Insufficient balance to stake" }),
                (0, s.jsxs)("span", { className: "text-muted-foreground text-xs", children: ["Get ", r.coinDenom ?? "", " to stake and earn rewards"] })
              ]
            }),
            (0, s.jsx)(n.zx, {
              size: "slim",
              variant: "mono",
              asChild: !0,
              onClick: () => {
                c(`/swap?sourceChainId=${u.chainId}&sourceToken=${u.denom}&destinationChainId=${d.chainId}&destinationToken=${r.coinDenom}&pageSource=stake`);
              },
              "aria-label": "insufficient balance card button in stake v2 flow",
              children: (0, s.jsxs)("span", { "aria-label": "insufficient balance card button text in stake v2 flow", children: ["Get ", r.coinDenom ?? ""] })
            })
          ]
        });
      });
    },
    81398: function (e, t, a) {
      a.d(t, { P: () => N, Z: () => C });
      var s = a(52322),
        l = a(41172),
        n = a(36906),
        i = a(6391),
        o = a.n(i),
        r = a(63400),
        d = a(42152),
        c = a(96217),
        u = a(91486),
        m = a(49728),
        x = a(30464),
        v = a(29750),
        f = a(63242),
        h = a(97680),
        p = a.n(h),
        g = a(2784),
        b = a(70514),
        j = a(49409),
        w = a(12499),
        k = a(48534),
        E = a(90258);
      let N = function (e) {
          let t = arguments.length > 1 && void 0 !== arguments[1] && arguments[1];
          switch (e) {
            case "DELEGATE":
              return "Stake";
            case "UNDELEGATE":
              return "Unstake";
            case "CANCEL_UNDELEGATION":
              return "Cancel Unstake";
            case "CLAIM_REWARDS":
              return "Claiming";
            case "REDELEGATE":
              return `Switching ${t ? "Provider" : "Validator"}`;
          }
        },
        y = e =>
          (0, s.jsxs)("div", {
            className: (0, b.cn)("flex justify-between items-center p-6 rounded-xl bg-secondary-100 w-full", e.className),
            children: [
              (0, s.jsxs)("div", {
                className: "flex flex-col gap-1",
                children: [
                  (0, s.jsx)("span", { className: "font-bold text-lg", children: e.title }),
                  (0, s.jsx)("span", { className: "text-sm text-muted-foreground", children: e.subTitle })
                ]
              }),
              (0, s.jsx)("img", { width: 48, height: 48, src: e.imgSrc, onError: (0, j._)(v.GenericLight), className: "border rounded-full bg-secondary-50" })
            ]
          });
      function C(e) {
        let {
            isVisible: t,
            onClose: a,
            onSubmit: i,
            tokenAmount: v,
            token: h,
            validator: b,
            isLoading: j,
            error: C,
            mode: D,
            unstakingPeriod: S,
            gasError: L,
            showLedgerPopup: A,
            provider: T,
            ledgerError: M,
            activeChain: G
          } = e,
          [_] = (0, l.fOz)(),
          P = (0, m.U)(),
          { data: Z } = (0, l.pD_)((null == b ? void 0 : b.image) ? void 0 : b),
          R = (null == b ? void 0 : b.image) || Z || x.r.Misc.Validator,
          z = (0, g.useMemo)(
            () => (new (o())((null == h ? void 0 : h.usdPrice) ?? "").gt(0) ? _(new (o())(v).times((null == h ? void 0 : h.usdPrice) ?? "")) : ""),
            [_, null == h ? void 0 : h.usdPrice, v]
          ),
          F = (0, g.useMemo)(() => (0, w.h)(M), [M]),
          V = (0, g.useCallback)(() => {
            if (F) {
              P();
              return;
            }
            i();
          }, [F, i, P]),
          I = M || C || L;
        return (0, s.jsxs)(s.Fragment, {
          children: [
            (0, s.jsx)(c.Z, {
              isOpen: t,
              onClose: a,
              title: (0, s.jsx)("span", { className: "", children: "REDELEGATE" === D && T ? "Review provider switching" : E.PV[D || "DELEGATE"] }),
              className: "p-6 pt-8",
              children: (0, s.jsxs)("div", {
                className: "flex flex-col gap-4 items-center",
                children: [
                  (0, s.jsx)(y, { title: `${(0, l.LHZ)(v)} ${null == h ? void 0 : h.symbol}`, subTitle: z, imgSrc: null == h ? void 0 : h.img }),
                  b &&
                    (0, s.jsxs)("div", {
                      className: "w-full",
                      children: [
                        (0, s.jsx)(y, {
                          title: (0, l.MDB)(
                            null == b ? void 0 : b.moniker,
                            k.sN ? 15 + Math.floor(((Math.min(window.innerWidth, 400) - 320) / 81) * 7) : 10,
                            2
                          ),
                          subTitle: "Validator",
                          imgSrc: R,
                          className: "REDELEGATE" === D || ("UNDELEGATE" === D && "celestia" === G) ? "!rounded-b-none" : ""
                        }),
                        "REDELEGATE" === D &&
                          b &&
                          "celestia" !== G &&
                          (0, s.jsxs)("div", {
                            className: "flex items-start gap-1.5 px-3 py-2.5 rounded-b-xl text-blue-400 bg-blue-400/10",
                            children: [
                              (0, s.jsx)(n.k, { size: 16, className: "shrink-0" }),
                              (0, s.jsxs)("span", {
                                className: "text-xs font-medium",
                                children: [
                                  "Redelegating to a new validator takes ",
                                  S,
                                  " as funds unbond from the source validator, then moved to the new one."
                                ]
                              })
                            ]
                          }),
                        ("UNDELEGATE" === D || "REDELEGATE" === D) &&
                          b &&
                          "celestia" === G &&
                          (0, s.jsxs)("div", {
                            className: "flex items-start gap-1.5 px-3 py-2.5 rounded-b-xl bg-orange-200 dark:bg-orange-900",
                            children: [
                              (0, s.jsx)(n.k, { size: 16, className: "shrink-0 text-orange-500 dark:text-orange-300" }),
                              (0, s.jsx)("span", {
                                className: "text-xs font-medium text-orange-500 dark:text-orange-300",
                                children:
                                  "REDELEGATE" === D
                                    ? `Claim your rewards from the existing validator before moving to a new one to
                    avoid loss of rewards`
                                    : "Claim your rewards from the validator before undelegating to avoid loss of rewards"
                              })
                            ]
                          })
                      ]
                    }),
                  T &&
                    (0, s.jsx)(y, {
                      title: (0, l.MDB)(T.moniker, k.sN ? 15 + Math.floor(((Math.min(window.innerWidth, 400) - 320) / 81) * 7) : 10, 2),
                      subTitle: "Provider",
                      imgSrc: x.r.Misc.Validator
                    }),
                  !F && I && (0, s.jsx)("p", { className: "text-xs font-bold text-destructive-100 px-2", children: I }),
                  F && (0, s.jsx)(r.u, {}),
                  (0, s.jsx)(u.zx, {
                    className: "w-full mt-4",
                    disabled: j || (!!C && !M) || !!L,
                    onClick: V,
                    "aria-label": "review stake tx confirm button in stake v2 flow",
                    children: F
                      ? "Connect Ledger"
                      : j
                        ? (0, s.jsx)(p(), {
                            loop: !0,
                            autoplay: !0,
                            animationData: f,
                            rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
                            className: "h-[24px] w-[24px]"
                          })
                        : (0, s.jsxs)("span", { "aria-label": "review stake tx confirm button text in stake v2 flow", children: ["Confirm ", N(D, !!T)] })
                  })
                ]
              })
            }),
            A && (0, s.jsx)(d.Z, { showLedgerPopup: A })
          ]
        });
      }
    },
    18223: function (e, t, a) {
      a.d(t, { Z: () => o });
      var s = a(52322),
        l = a(26227),
        n = a(96217);
      a(2784);
      let i = ["Random", "Amount staked", "APR"];
      function o(e) {
        let { sortBy: t, setSortBy: a, isVisible: o, setVisible: r, onClose: d } = e;
        return (0, s.jsx)(n.Z, {
          isOpen: o,
          onClose: d,
          title: "Sort By",
          className: "p-6",
          children: (0, s.jsx)("div", {
            className: "flex flex-col gap-y-3",
            children: i.map(e =>
              (0, s.jsxs)(
                "button",
                {
                  className: "bg-secondary p-4 rounded-xl flex font-medium items-center justify-between gap-4 hover:bg-secondary-200 transition-colors",
                  onClick: () => {
                    r(!1), a(e);
                  },
                  "aria-label": "select sort by sheet sort button in stake v2 flow",
                  children: [
                    (0, s.jsx)("span", { "aria-label": "select sort by sheet sort button text in stake v2 flow", children: e }),
                    t === e && (0, s.jsx)(l.f, { size: 24, weight: "fill", "aria-label": "select sort by sheet sort button icon in stake v2 flow" })
                  ]
                },
                e
              )
            )
          })
        });
      }
    },
    78220: function (e, t, a) {
      a.d(t, { Z: () => m });
      var s = a(52322),
        l = a(41172),
        n = a(75377),
        i = a(91486),
        o = a(17328),
        r = a(30464),
        d = a(29750);
      a(2784);
      var c = a(49409),
        u = a(48534);
      function m(e) {
        let { selectedValidator: t, setShowSelectValidatorSheet: a, selectDisabled: m, title: x, apr: v, loading: f } = e,
          { data: h } = (0, l.pD_)((null == t ? void 0 : t.image) ? void 0 : t),
          p = (null == t ? void 0 : t.image) || h || r.r.Misc.Validator,
          g = (0, n.useTheme)().theme;
        return (0, s.jsxs)("div", {
          className: "flex flex-col gap-4 p-5 rounded-xl bg-secondary-100",
          children: [
            (0, s.jsx)("span", { className: "font-medium text-sm text-muted-foreground", children: x }),
            (0, s.jsxs)("div", {
              className: "flex w-full items-center cursor-pointer justify-between",
              children: [
                (0, s.jsxs)("div", {
                  className: "flex items-center gap-4",
                  children: [
                    (0, s.jsx)("img", {
                      src: t ? p : g === n.ThemeName.DARK ? d.GenericDark : d.GenericLight,
                      onError: (0, c._)(d.GenericLight),
                      className: "rounded-full",
                      width: 44,
                      height: 44
                    }),
                    (0, s.jsxs)("div", {
                      className: "flex flex-col gap-1",
                      children: [
                        (0, s.jsx)("span", {
                          className: "font-bold text-sm",
                          "aria-label": "select validator card name in stake v2 flow",
                          children: t
                            ? (0, l.MDB)(t.moniker ?? "", u.sN ? 21 + Math.floor(((Math.min(window.innerWidth, 400) - 320) / 81) * 7) : 30, 0)
                            : f
                              ? "Loading..."
                              : "Select Validator"
                        }),
                        v && !isNaN(+v)
                          ? (0, s.jsxs)("span", {
                              className: "text-xs text-accent-success font-medium",
                              "aria-label": "select validator card apr in stake v2 flow",
                              children: [Number(100 * v).toFixed(2), "%"]
                            })
                          : null
                      ]
                    })
                  ]
                }),
                !m &&
                  !f &&
                  (0, s.jsx)(i.zx, {
                    size: "icon",
                    variant: "secondary",
                    className: "bg-secondary-300 hover:bg-secondary-400",
                    onClick: () => a(!0),
                    "aria-label": "select validator card select button in stake v2 flow",
                    children: (0, s.jsx)(o.M, { size: 24, "aria-label": "select validator card select button icon in stake v2 flow" })
                  })
              ]
            })
          ]
        });
      }
    },
    15249: function (e, t, a) {
      a.a(e, async function (e, s) {
        try {
          a.d(t, { Z: () => S });
          var l = a(52322),
            n = a(41172),
            i = a(6391),
            o = a.n(i),
            r = a(27963),
            d = a(96217),
            c = a(17469),
            u = a(91486),
            m = a(84916),
            x = a(96128),
            v = a.n(x),
            f = a(72059),
            h = a(71845),
            p = a(30464),
            g = a(29750),
            b = a(75958),
            j = a(2784),
            w = a(86874),
            k = a(7474),
            E = a(42799),
            N = a(70514),
            y = a(49409),
            C = a(18223),
            D = e([f]);
          f = (D.then ? (await D)() : D)[0];
          let L = (0, b.Pi)(e => {
            var t;
            let { validator: a, onClick: s, activeChain: i, activeNetwork: r, isSelected: d } = e,
              [c, u] = (0, j.useState)(!1),
              [m] = (0, n.JsT)(E.gb.allDenoms, i, r),
              { data: x } = (0, n.pD_)((null == a ? void 0 : a.image) ? void 0 : a),
              f = (null == a ? void 0 : a.image) || x || p.r.Misc.Validator,
              {
                commission: h,
                moniker: b,
                tokens: k
              } = (0, j.useMemo)(() => {
                var e, t;
                let s = (0, n.MDB)(a.moniker, 26 + Math.floor(((Math.min(window.innerWidth, 400) - 320) / 81) * 7), 0),
                  l = `${v()((null === (e = a.delegations) || void 0 === e ? void 0 : e.total_tokens_display) ?? a.tokens ?? "", { symbol: "", precision: 0 }).format()} ${m.coinDenom}`,
                  i = (null === (t = a.commission) || void 0 === t ? void 0 : t.commission_rates.rate)
                    ? `${new (o())(a.commission.commission_rates.rate).multipliedBy(100).toFixed(0)}%`
                    : "N/A";
                return { moniker: s, tokens: l, commission: i };
              }, [m.coinDenom, a]),
              C = (null === (t = a.custom_attributes) || void 0 === t ? void 0 : t.priority) !== void 0 && a.custom_attributes.priority >= 1;
            return (0, l.jsxs)("button", {
              onClick: s,
              className: (0, N.cn)(
                "relative flex items-center flex-grow gap-4 px-5 py-4 mb-4 cursor-pointer rounded-xl w-full bg-secondary-100 hover:bg-secondary-200 transition-colors",
                C && "py-[22.5px]",
                d && "border border-monochrome"
              ),
              "aria-label": "select validator sheet validator card in stake v2 flow",
              children: [
                (0, l.jsxs)("div", {
                  className: "relative shrink-0 h-9 w-9",
                  children: [
                    (0, l.jsx)("img", {
                      src: f,
                      onError: (0, y._)(g.GenericLight),
                      onLoadCapture: () => {
                        u(!0);
                      },
                      width: 36,
                      height: 36,
                      className: "border rounded-full border-secondary-100"
                    }),
                    !c && (0, l.jsx)(w.Z, { circle: !0, className: "absolute inset-0" })
                  ]
                }),
                (0, l.jsxs)("div", {
                  className: "flex flex-col gap-0.5 justify-center items-start w-full",
                  children: [
                    (0, l.jsx)("span", {
                      className: "font-bold text-sm text-start",
                      "aria-label": "select validator sheet validator card name in stake v2 flow",
                      children: b
                    }),
                    C && (0, l.jsx)("span", { className: "text-xs text-accent-success font-medium", children: "Promoted" })
                  ]
                }),
                (0, l.jsxs)("div", {
                  className: "flex flex-col gap-0.5 items-end w-full",
                  children: [
                    (0, l.jsx)("span", {
                      className: "font-medium text-sm",
                      "aria-label": "select validator sheet validator card tokens in stake v2 flow",
                      children: k
                    }),
                    (0, l.jsxs)("span", { className: "font-medium text-xs text-muted-foreground", children: ["Commission: ", h] })
                  ]
                })
              ]
            });
          });
          function S(e) {
            let { isVisible: t, onClose: a, onValidatorSelect: s, validators: i, apr: o, selectedValidator: x, forceChain: v, forceNetwork: g } = e,
              [b, w] = (0, j.useState)(""),
              [E, N] = (0, j.useState)(!1),
              [y, D] = (0, j.useState)("Random"),
              S = (0, f.a7)(),
              A = (0, n.obn)(),
              T = v ?? S,
              M = g ?? A,
              [G, _] = (0, j.useState)(!1),
              [P, Z] = (0, j.useMemo)(() => {
                _(!0);
                let e = i.filter(e => e.moniker.toLowerCase().includes(b.toLowerCase()) || e.address.includes(b));
                e.sort((e, t) => {
                  switch (y) {
                    case "Amount staked":
                      return +(e.tokens ?? "") < +(t.tokens ?? "") ? 1 : -1;
                    case "APR":
                      return o ? (o[e.address] < o[t.address] ? 1 : -1) : 0;
                    case "Random":
                      return Math.random() - 0.5;
                  }
                }),
                  "Random" === y &&
                    e.sort((e, t) => {
                      var a, s;
                      let l = null === (a = e.custom_attributes) || void 0 === a ? void 0 : a.priority,
                        n = null === (s = t.custom_attributes) || void 0 === s ? void 0 : s.priority;
                      return void 0 !== l && void 0 !== n ? (l !== n ? l - n : Math.random() - 0.5) : void 0 !== l ? -1 : +(void 0 !== n);
                    });
                let t = e.filter(e => !1 !== e.active),
                  a = e.filter(e => !1 === e.active);
                return _(!1), [t, b ? a : []];
              }, [i, b, y, o]),
              R = (0, j.useMemo)(() => {
                let e = [...P];
                return Z.length > 0 && (e.push({ itemType: "inactiveHeader" }), e.push(...Z)), e;
              }, [P, Z]),
              z = (0, j.useCallback)(
                (e, t) =>
                  "itemType" in t
                    ? null
                    : (0, l.jsx)(L, {
                        validator: t,
                        onClick: () => s(t),
                        activeChain: T,
                        activeNetwork: M,
                        isSelected: (null == x ? void 0 : x.address) === t.address
                      }),
                [T, M, s, null == x ? void 0 : x.address]
              );
            return (0, l.jsxs)(d.Z, {
              fullScreen: !0,
              isOpen: t,
              onClose: () => {
                w(""), a();
              },
              title: "Select Validator",
              className: "p-6 overflow-auto flex flex-col gap-7 h-full !pb-0",
              children: [
                (0, l.jsxs)("div", {
                  className: "flex gap-x-2 justify-between items-center",
                  children: [
                    (0, l.jsx)(m.M, {
                      value: b,
                      onChange: e => w(e.target.value),
                      "data-testing-id": "validator-input-search",
                      placeholder: "Enter validator name",
                      onClear: () => w("")
                    }),
                    (0, l.jsx)(u.zx, {
                      size: "icon",
                      variant: "secondary",
                      className: "text-muted-foreground h-12 w-14",
                      onClick: () => N(!0),
                      "aria-label": "select validator sheet sort button in stake v2 flow",
                      children: (0, l.jsx)(h.Z, { size: 20, "aria-label": "select validator sheet sort button icon in stake v2 flow" })
                    })
                  ]
                }),
                G && (0, l.jsx)(c.Z, {}),
                !G &&
                  0 === R.length &&
                  (0, l.jsx)(r.S, {
                    isRounded: !0,
                    subHeading: "Try a different search term",
                    src: p.r.Misc.Explore,
                    heading: `No validators found for '${b}'`,
                    "data-testing-id": "select-validator-empty-card",
                    "aria-label": "select validator sheet empty card in stake v2 flow"
                  }),
                !G && R.length > 0 && (0, l.jsx)(k.OO, { data: R, itemContent: z, className: "flex-1 w-full overflow-auto pb-4" }),
                (0, l.jsx)(C.Z, { onClose: () => N(!1), isVisible: E, setVisible: N, setSortBy: D, sortBy: y, activeChain: T })
              ]
            });
          }
          s();
        } catch (e) {
          s(e);
        }
      });
    },
    26869: function (e, t, a) {
      a.d(t, { Z: () => g });
      var s = a(52322),
        l = a(41172),
        n = a(15969),
        i = a(6391),
        o = a.n(i),
        r = a(91486),
        d = a(18919),
        c = a(14981),
        u = a(4370),
        m = a(9832),
        x = a(75958),
        v = a(2784),
        f = a(81354),
        h = a(46338),
        p = a(90258);
      let g = (0, x.Pi)(e => {
        let {
            token: t,
            amount: a,
            setAmount: i,
            fees: x,
            hasError: g,
            setHasError: b,
            mode: j,
            delegationBalance: w,
            adjustAmount: k,
            setAdjustAmount: E,
            tokenLoading: N,
            rootDenomsStore: y,
            activeChain: C,
            activeNetwork: D,
            delegationBalanceLoading: S
          } = e,
          L = (0, v.useRef)(null);
        (0, v.useRef)(!1);
        let [A] = (0, l.JsT)(y.allDenoms, C, D),
          [T] = (0, l.fOz)(),
          [M, G] = (0, v.useState)(""),
          [_, P] = (0, v.useState)(!1),
          [Z, R] = (0, v.useState)(!1),
          z = (0, v.useMemo)(
            () =>
              M
                ? _
                  ? new (o())(M).dividedBy(new (o())((null == t ? void 0 : t.usdPrice) ?? "0")).toString()
                  : new (o())(M).multipliedBy(new (o())((null == t ? void 0 : t.usdPrice) ?? "0")).toString()
                : "",
            [M, _, null == t ? void 0 : t.usdPrice]
          ),
          F = (0, v.useMemo)(() => {
            if ("DELEGATE" !== j) return new (o())(_ ? (null == w ? void 0 : w.currencyAmount) ?? "" : (null == w ? void 0 : w.amount) ?? "");
            let e = (0, n.hI1)((null == t ? void 0 : t.amount) ?? "0", (null == t ? void 0 : t.coinDecimals) ?? 6),
              a = new (o())(e).minus((null == x ? void 0 : x.amount) ?? "0");
            if (a.lte(0)) return new (o())(0);
            let s = new (o())((0, n.TGo)(a.toString(), (null == t ? void 0 : t.coinDecimals) ?? 6));
            return _ ? new (o())(s).multipliedBy((null == t ? void 0 : t.usdPrice) ?? "0") : s;
          }, [w, null == x ? void 0 : x.amount, _, j, t]),
          V = (0, v.useCallback)(
            e => {
              let a;
              let s = new (o())(e);
              if (
                s.isLessThan(0) ||
                ((a =
                  "DELEGATE" === j
                    ? _
                      ? (null == t ? void 0 : t.usdValue) ?? "0"
                      : (null == t ? void 0 : t.amount) ?? "0"
                    : _
                      ? (null == w ? void 0 : w.currencyAmount) ?? ""
                      : (null == w ? void 0 : w.amount) ?? ""),
                s.isGreaterThan(a))
              ) {
                b(!0);
                return;
              }
              b(!1);
            },
            [null == w ? void 0 : w.amount, null == w ? void 0 : w.currencyAmount, _, j, b, t]
          ),
          I = (0, v.useMemo)(
            () =>
              new (o())(
                _
                  ? ("DELEGATE" === j ? (null == t ? void 0 : t.usdValue) : null == w ? void 0 : w.currencyAmount) ?? ""
                  : ("DELEGATE" === j ? (null == t ? void 0 : t.amount) : null == w ? void 0 : w.amount) ?? ""
              ),
            [null == w ? void 0 : w.amount, null == w ? void 0 : w.currencyAmount, _, j, null == t ? void 0 : t.amount, null == t ? void 0 : t.usdValue]
          ),
          U = (0, v.useCallback)(
            e => {
              G(e), V(e);
            },
            [V]
          );
        return (
          (0, v.useEffect)(() => {
            k && (_ ? G((parseFloat(a) * parseFloat((null == t ? void 0 : t.usdPrice) ?? "0")).toFixed(6)) : G(a), E(!1));
          }, [k]),
          (0, v.useEffect)(() => {
            M && !g ? i((_ ? parseFloat(M) / parseFloat((null == t ? void 0 : t.usdPrice) ?? "0") : parseFloat(M)).toFixed(6)) : i("");
          }, [M, _, null == t ? void 0 : t.usdPrice, g]),
          (0, v.useEffect)(() => {
            "DELEGATE" === j ? R(N) : R(S);
          }, [j, N, S]),
          (0, v.useEffect)(() => {
            if (!f.K5.updateAllowed() || !x || !(null == t ? void 0 : t.amount) || !M || "DELEGATE" !== j) return;
            let e = new (o())(M ?? 0),
              a = new (o())((null == t ? void 0 : t.amount) ?? 0);
            if (e.lte(0) || e.gt(a)) return;
            let s = x.denom,
              l =
                (null == t ? void 0 : t.ibcDenom) || (null == s ? void 0 : s.startsWith("ibc/"))
                  ? (null == t ? void 0 : t.ibcDenom) === s
                  : (null == t ? void 0 : t.coinMinimalDenom) === s,
              i = f.K5.shouldTerminate(),
              r = (null == t ? void 0 : t.coinDecimals) || 6,
              d = new (o())((0, n.TGo)(x.amount ?? "0", r));
            if (i && (!l || e.plus(d).lte(a))) return;
            let c = a.minus(l ? d : 0),
              u = c.toFixed(r, o().ROUND_DOWN),
              m = e.toFixed(r, o().ROUND_DOWN);
            if (!c.lte(0) && u != m && (!i || !(u > m))) {
              if (_) {
                if (!(null == t ? void 0 : t.usdPrice)) return;
                U(c.multipliedBy(t.usdPrice).toString());
              } else U(u);
              f.K5.incrementUpdateCount();
            }
          }, [
            x,
            U,
            M,
            _,
            j,
            null == t ? void 0 : t.amount,
            null == t ? void 0 : t.coinDecimals,
            null == t ? void 0 : t.coinMinimalDenom,
            null == t ? void 0 : t.ibcDenom,
            null == t ? void 0 : t.usdPrice
          ]),
          (0, s.jsxs)("div", {
            className: "flex flex-col gap-y-3 rounded-xl bg-secondary-100 p-5",
            children: [
              (0, s.jsx)("span", { className: "text-sm text-muted-foreground font-medium", children: p.Nb[j] }),
              (0, s.jsx)("input", {
                ref: L,
                className: "bg-transparent text-[1.5rem] font-bold caret-blue-200 outline-none border-none focus-within:placeholder:opacity-0",
                value: _ ? `$${M}` : M,
                onChange: e => {
                  var t, a, s, l;
                  let n =
                    null === (s = (l = e.target.value.replace(/\$/, "")).replace) || void 0 === s
                      ? void 0
                      : null === (a = s.call(l, /^0+(?=\d)/, "")) || void 0 === a
                        ? void 0
                        : null === (t = a.replace) || void 0 === t
                          ? void 0
                          : t.call(a, /(\.+)/g, ".");
                  /^\d*\.?\d*$/.test(n) && (G(n), V(n), f.K5.disableUpdateInput());
                },
                placeholder: "0",
                autoFocus: !0
              }),
              (0, s.jsxs)("div", {
                className: "flex items-center justify-between w-full",
                children: [
                  (0, s.jsxs)("div", {
                    className: "flex items-center gap-1",
                    children: [
                      (0, s.jsx)("span", {
                        className: "text-sm text-muted-foreground",
                        children: M ? (_ ? `${(0, l.LHZ)(z)} ${null == A ? void 0 : A.coinDenom}` : T(new (o())(z))) : _ ? "$0.00" : "0.00"
                      }),
                      (0, s.jsx)("button", {
                        onClick: () => {
                          var e;
                          M &&
                            G(
                              _
                                ? (parseFloat(M) / parseFloat((null == t ? void 0 : t.usdPrice) ?? "0")).toFixed(6)
                                : (parseFloat(M) * parseFloat((null == t ? void 0 : t.usdPrice) ?? "0")).toFixed(6)
                            ),
                            P(!_),
                            null === (e = L.current) || void 0 === e || e.focus();
                        },
                        title: _ ? "Switch to amount" : "Switch to USD",
                        className: "rounded-full size-5 bg-secondary-200 hover:bg-secondary-300 items-center flex gap-1 justify-center shrink-0 " + r.YV,
                        "aria-label": "swap button in stake v2 flow",
                        children: (0, s.jsx)(m.T, { className: "!leading-[12px] rotate-90 p-1 size-[18px]", "aria-label": "swap button icon in stake v2 flow" })
                      })
                    ]
                  }),
                  (0, s.jsxs)("div", {
                    className: "flex items-center gap-1",
                    children: [
                      (0, s.jsx)(c.M, {
                        mode: "wait",
                        children: Z
                          ? (0, s.jsx)(
                              d.O,
                              {
                                className: "w-16 h-5",
                                asChild: !0,
                                children: (0, s.jsx)(u.E.div, { transition: h._M, variants: h.K0, initial: "hidden", animate: "visible", exit: "hidden" })
                              },
                              "loading"
                            )
                          : (0, s.jsxs)(
                              u.E.span,
                              {
                                className: "text-sm font-medium text-muted-foreground",
                                transition: h._M,
                                variants: h.K0,
                                initial: "hidden",
                                animate: "visible",
                                exit: "hidden",
                                children: [I.eq(0) ? "0" : _ ? T(I) : (0, l.LHZ)(I.toString()), " ", null == A ? void 0 : A.coinDenom]
                              },
                              "balance"
                            )
                      }),
                      (0, s.jsx)("button", {
                        className:
                          "ml-0.5 text-muted-foreground text-sm font-medium bg-secondary-200 px-1.5 rounded-full hover:text-foreground hover:bg-secondary-300 transition-colors " +
                          r.YV,
                        onClick: () => {
                          U(F.dividedBy(2).toFixed(6, 1).toString()), f.K5.disableUpdateInput();
                        },
                        "aria-label": "50% button in stake v2 flow",
                        children: (0, s.jsx)("span", { "aria-label": "50% button text in stake v2 flow", children: "50%" })
                      }),
                      (0, s.jsx)("button", {
                        className:
                          "text-muted-foreground text-sm font-medium bg-secondary-200 px-2 rounded-full hover:text-foreground hover:bg-secondary-300 transition-colors " +
                          r.YV,
                        onClick: () => {
                          U(F.toFixed(6, 1).toString()), f.K5.allowUpdateInput();
                        },
                        "aria-label": "max button in stake v2 flow",
                        children: (0, s.jsx)("span", { "aria-label": "max button text in stake v2 flow", children: "Max" })
                      })
                    ]
                  })
                ]
              })
            ]
          })
        );
      });
    },
    61012: function (e, t, a) {
      a.d(t, { Z: () => n });
      var s = a(52322),
        l = a(69816);
      function n(e) {
        let { provider: t } = e;
        return (0, s.jsxs)("div", {
          className: "flex flex-col py-3 px-4 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-800 rounded-lg gap-y-2 w-[220px]",
          children: [
            t.specs.length > 0 &&
              (0, s.jsx)(l.Z, {
                size: "sm",
                className: "font-bold text-left",
                color: "text-gray-900 dark:text-gray-100",
                children: t.specs.map(e => e.charAt(0).toUpperCase() + e.slice(1).toLowerCase()).join(", ")
              }),
            (0, s.jsxs)(l.Z, {
              size: "xs",
              className: "font-medium text-left",
              color: "text-gray-700 dark:text-gray-300",
              children: ["Commission", " ", parseInt(t.delegateCommission ?? "0") > 0 ? `${t.delegateCommission}%` : "-"]
            }),
            (0, s.jsx)(l.Z, {
              size: "xs",
              className: "font-medium text-left",
              color: "text-gray-700 dark:text-gray-300",
              children:
                "APR is estimated and influenced by various factors such as number of delegators. More information is available in our tokenomics: docs.lavanet.xyz/token"
            })
          ]
        });
      }
      a(2784);
    },
    20537: function (e, t, a) {
      a.d(t, { s: () => p });
      var s = a(52322),
        l = a(41172),
        n = a(75377),
        i = a(36906),
        o = a(91486),
        r = a(14361),
        d = a(17328),
        c = a(30464),
        u = a(29750),
        m = a(75958),
        x = a(2784),
        v = a(49409),
        f = a(48534),
        h = a(61012);
      let p = (0, m.Pi)(e => {
        let { selectedProvider: t, setShowSelectProviderSheet: a, selectDisabled: m, title: p, optional: g, rootDenomsStore: b } = e,
          j = (0, n.useTheme)().theme,
          { apr: w } = (0, l.EXf)((null == t ? void 0 : t.provider) ?? "", b.allDenoms),
          [k, E] = (0, x.useState)(!1);
        return (
          (0, x.useCallback)(() => {
            E(!0);
          }, []),
          (0, x.useCallback)(() => {
            E(!1);
          }, []),
          (0, s.jsxs)("div", {
            className: "flex flex-col gap-4 p-5 rounded-xl bg-secondary-100",
            children: [
              (0, s.jsxs)("div", {
                className: "flex justify-between w-full",
                children: [
                  (0, s.jsx)("span", {
                    className: "font-medium text-sm text-muted-foreground",
                    "aria-label": "select provider card title in stake v2 flow",
                    children: p
                  }),
                  t &&
                    (0, s.jsx)(r.pn, {
                      delayDuration: 100,
                      children: (0, s.jsxs)(r.u, {
                        children: [
                          (0, s.jsx)(r.aJ, {
                            children: (0, s.jsx)(i.k, {
                              size: 18,
                              className: "text-gray-400 dark:text-gray-600",
                              "aria-label": "select provider card info icon in stake v2 flow"
                            })
                          }),
                          (0, s.jsx)(r._v, { side: "left", className: "bg-transparent border-none", children: (0, s.jsx)(h.Z, { provider: t }) })
                        ]
                      })
                    })
                ]
              }),
              (0, s.jsxs)("div", {
                className: "flex w-full items-center cursor-pointer justify-between",
                children: [
                  (0, s.jsxs)("div", {
                    className: "flex items-center gap-4",
                    children: [
                      (0, s.jsx)("img", {
                        src: t ? c.r.Misc.Validator : j === n.ThemeName.DARK ? u.GenericDark : u.GenericLight,
                        onError: (0, v._)(u.GenericLight),
                        className: "rounded-full",
                        "aria-label": "select provider card image in stake v2 flow",
                        width: 44,
                        height: 44
                      }),
                      (0, s.jsxs)("div", {
                        className: "flex flex-col gap-1",
                        children: [
                          (0, s.jsx)("span", {
                            className: "font-bold text-sm",
                            "aria-label": "select provider card name in stake v2 flow",
                            children: t
                              ? (0, l.MDB)(t.moniker, f.sN ? 21 + Math.floor(((Math.min(window.innerWidth, 400) - 320) / 81) * 7) : 30, 0)
                              : `Select Provider ${g ? "(optional)" : ""}`
                          }),
                          t &&
                            parseFloat(w ?? "0") > 0 &&
                            (0, s.jsxs)("span", {
                              className: "text-xs text-accent-success font-medium",
                              "aria-label": "select provider card apr in stake v2 flow",
                              children: ["Estimated APR\xa0", (0, s.jsx)("span", { className: "font-bold", children: (0, l._6x)(w ?? "", 1) }), "%"]
                            })
                        ]
                      })
                    ]
                  }),
                  !m &&
                    (0, s.jsx)(o.zx, {
                      size: "icon",
                      variant: "secondary",
                      className: "bg-secondary-300 hover:bg-secondary-400",
                      onClick: () => a(!0),
                      "aria-label": "select provider card pen icon in stake v2 flow",
                      children: (0, s.jsx)(d.M, { size: 24, "aria-label": "select provider card pen icon in stake v2 flow" })
                    })
                ]
              })
            ]
          })
        );
      });
    },
    26908: function (e, t, a) {
      a.d(t, { Z: () => E });
      var s = a(52322),
        l = a(41172),
        n = a(36906),
        i = a(27963),
        o = a(96217),
        r = a(17469),
        d = a(69816),
        c = a(84916),
        u = a(14361),
        m = a(30464),
        x = a(29750),
        v = a(75958),
        f = a(2784),
        h = a(7474),
        p = a(42799),
        g = a(70514),
        b = a(49409),
        j = a(48534),
        w = a(61012);
      let k = (0, v.Pi)(e => {
        let { provider: t, onClick: a, rootDenomsStore: i } = e,
          [o, r] = (0, f.useState)(!1),
          { apr: d } = (0, l.EXf)(t.provider, i.allDenoms);
        return (
          (0, f.useCallback)(() => {
            r(!0);
          }, []),
          (0, f.useCallback)(() => {
            r(!1);
          }, []),
          (0, s.jsxs)("button", {
            onClick: a,
            className: (0, g.cn)(
              "relative flex items-center flex-grow gap-4 px-5 py-4 mb-4 cursor-pointer rounded-xl w-full bg-secondary-100 hover:bg-secondary-200 transition-colors"
            ),
            "aria-label": "provider card in stake v2 flow",
            children: [
              (0, s.jsx)("img", {
                src: m.r.Misc.Validator,
                onError: (0, b._)(x.GenericLight),
                width: 36,
                height: 36,
                className: "border rounded-full border-secondary-100",
                "aria-label": "provider card image in stake v2 flow"
              }),
              (0, s.jsx)("div", {
                className: "flex flex-col flex-grow gap-0.5 justify-center items-start w-full",
                children: (0, s.jsxs)("div", {
                  className: "flex flex-col items-start justify-between w-full",
                  children: [
                    (0, s.jsx)("span", {
                      className: "font-bold text-sm text-start",
                      "aria-label": "provider card name in stake v2 flow",
                      children: (0, l.MDB)(t.moniker, (0, j.oj)() ? 22 + Math.floor(((Math.min(window.innerWidth, 400) - 320) / 81) * 7) : 25, 0)
                    }),
                    t.specs.length > 0 &&
                      (0, s.jsx)("span", {
                        className: "font-medium text-muted-foreground text-xs",
                        "aria-label": "provider card services in stake v2 flow",
                        children: `${t.specs.length} Services`
                      })
                  ]
                })
              }),
              (0, s.jsxs)("div", {
                className: "flex flex-col gap-0.5 items-end w-full",
                children: [
                  (0, s.jsx)(u.pn, {
                    delayDuration: 100,
                    children: (0, s.jsxs)(u.u, {
                      children: [
                        (0, s.jsx)(u.aJ, {
                          children: (0, s.jsx)(n.k, {
                            size: 18,
                            className: "text-gray-400 dark:text-gray-600",
                            "aria-label": "provider card info icon in stake v2 flow"
                          })
                        }),
                        (0, s.jsx)(u._v, { side: "left", className: "bg-transparent border-none", children: (0, s.jsx)(w.Z, { provider: t }) })
                      ]
                    })
                  }),
                  parseFloat(d ?? "0") > 0 &&
                    (0, s.jsxs)("span", {
                      className: "font-medium text-xs text-muted-foreground",
                      "aria-label": "provider card apr in stake v2 flow",
                      children: ["Estimated APR\xa0", (0, s.jsx)("span", { className: "font-bold", children: (0, l._6x)(d ?? "", 1) }), "%"]
                    })
                ]
              })
            ]
          })
        );
      });
      function E(e) {
        let { isVisible: t, onClose: a, onProviderSelect: l, providers: n } = e,
          [u, x] = (0, f.useState)(""),
          [v, g] = (0, f.useState)(!1),
          [b, j] = (0, f.useMemo)(() => {
            g(!0);
            let e = n.filter(e => e.moniker && e.moniker.toLowerCase().includes(u.toLowerCase())).slice(0, 100);
            e.sort(() => Math.random() - 0.5);
            let t = e.filter(e => "Active" === e.stakestatus),
              a = e.filter(e => "Inactive" === e.stakestatus);
            return g(!1), [t, u ? a : []];
          }, [n, u]),
          w = (0, f.useMemo)(() => {
            let e = [...b];
            return j.length > 0 && (e.push({ itemType: "inactiveHeader" }), e.push(...j)), e;
          }, [b, j]),
          E = (0, f.useCallback)(
            (e, t) =>
              "itemType" in t
                ? (0, s.jsx)(d.Z, { size: "xs", color: "text-gray-700 dark:text-gray-400", className: "mb-4", children: "Inactive Provider" })
                : (0, s.jsx)(k, { provider: t, onClick: () => l(t), rootDenomsStore: p.gb }),
            [l]
          );
        return (0, s.jsxs)(o.Z, {
          fullScreen: !0,
          isOpen: t,
          onClose: () => {
            x(""), a();
          },
          title: "Select Provider",
          className: "p-6 overflow-auto flex flex-col gap-7 h-full !pb-0",
          children: [
            (0, s.jsx)(c.M, {
              value: u,
              onChange: e => x(e.target.value),
              "data-testing-id": "validator-input-search",
              placeholder: "Enter provider name",
              onClear: () => x("")
            }),
            v && (0, s.jsx)(r.Z, {}),
            !v &&
              0 === w.length &&
              (0, s.jsx)(i.S, {
                isRounded: !0,
                subHeading: "Try a different search term",
                src: m.r.Misc.Explore,
                heading: `No providers found for '${u}'`,
                "data-testing-id": "select-provider-empty-card"
              }),
            !v && w.length > 0 && (0, s.jsx)(h.OO, { data: w, itemContent: E, className: "flex-1 w-full overflow-auto pb-4" })
          ]
        });
      }
    },
    39719: function (e, t, a) {
      a.d(t, { Z: () => d });
      var s = a(52322),
        l = a(96217),
        n = a(69816),
        i = a(91486);
      a(2784);
      var o = a(42799),
        r = a(20537);
      function d(e) {
        let { isVisible: t, onClose: a, setShowSelectProviderSheet: d, onReviewStake: c } = e;
        return (0, s.jsx)(l.Z, {
          isOpen: t,
          onClose: a,
          title: "Restake with a Provider",
          className: "p-6",
          children: (0, s.jsxs)("div", {
            className: "flex flex-col gap-y-6",
            children: [
              (0, s.jsx)(n.Z, {
                className: "text-gray-400 dark:text-gray-600 text-center",
                size: "sm",
                children: "You're missing out on increased rewards. Select a provider to restake with for increased APR."
              }),
              (0, s.jsx)(r.s, { selectDisabled: !1, title: "Provider", setShowSelectProviderSheet: d, rootDenomsStore: o.gb }),
              (0, s.jsx)(i.zx, {
                onClick: c,
                className: "w-full",
                "aria-label": "review stake button",
                children: (0, s.jsx)("span", { "aria-label": "review stake button text", children: "Review Stake" })
              })
            ]
          })
        });
      }
    },
    92006: function (e, t, a) {
      a.a(e, async function (e, s) {
        try {
          a.d(t, { w: () => v });
          var l = a(52322),
            n = a(43166),
            i = a(22764),
            o = a(16283),
            r = a(85027),
            d = a(86240),
            c = a(35065),
            u = a(2784),
            m = a(10289),
            x = e([c]);
          c = (x.then ? (await x)() : x)[0];
          let v = e => {
            let { disableWalletButton: t, setShowSearchInput: a, onBackClick: s } = e,
              x = (0, m.s0)(),
              v = (0, d.v)(),
              [f, h] = (0, u.useState)(!1);
            return (0, l.jsxs)(l.Fragment, {
              children: [
                (0, l.jsxs)(r.m, {
                  children: [
                    (0, l.jsx)(n.X, {
                      size: 36,
                      className: "text-muted-foreground hover:text-foreground cursor-pointer p-2",
                      onClick: () => {
                        s ? s() : x(-1);
                      },
                      "aria-label": "stake header back button in stake v2 flow"
                    }),
                    (0, l.jsx)(o.G2, {
                      showDropdown: !0,
                      showWalletAvatar: !0,
                      className: "absolute top-1/2 right-1/2 translate-x-1/2 -translate-y-1/2",
                      walletName: v.walletName,
                      walletAvatar: v.walletAvatar,
                      handleDropdownClick: () => h(!t)
                    }),
                    a &&
                      (0, l.jsx)(i.Y, {
                        size: 36,
                        className: "text-muted-foreground hover:text-foreground cursor-pointer p-2",
                        onClick: () => a(e => !e),
                        "aria-label": "stake header search button in stake v2 flow"
                      })
                  ]
                }),
                (0, l.jsx)(c.Z, { isVisible: f, onClose: () => h(!1), title: "Your Wallets" })
              ]
            });
          };
          s();
        } catch (e) {
          s(e);
        }
      });
    },
    90258: function (e, t, a) {
      a.d(t, { KT: () => s, Nb: () => n, PV: () => i, d6: () => l });
      let s = { loading: "in progress", success: "successful", submitted: "submitted", failed: "failed" },
        l = {
          DELEGATE: "Stake",
          UNDELEGATE: "Unstake",
          REDELEGATE: "Switching",
          CLAIM_REWARDS: "Claim",
          CANCEL_UNDELEGATION: "Cancel unstake",
          CLAIM_AND_DELEGATE: "Claim"
        },
        n = {
          DELEGATE: "Enter amount to be staked",
          REDELEGATE: "Enter amount to be redelegated",
          UNDELEGATE: "Enter unstaking amount",
          CLAIM_REWARDS: "Enter amount to be claimed",
          CANCEL_UNDELEGATION: "Enter amount to be cancelled",
          CLAIM_AND_DELEGATE: "Enter amount to be claimed"
        },
        i = {
          CLAIM_REWARDS: "Review claim",
          CLAIM_AND_DELEGATE: "Review claim and stake",
          DELEGATE: "Review stake",
          UNDELEGATE: "Review unstake",
          REDELEGATE: "Review validator switching",
          CANCEL_UNDELEGATION: "Review cancel unstake"
        };
    },
    12499: function (e, t, a) {
      a.d(t, { h: () => s });
      let s = e => {
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
    },
    94629: function (e, t, a) {
      a.d(t, { z: () => n });
      var s = a(28879),
        l = a.n(s);
      let n = (e, t, a) => {
        let s = l()(e).diff(a ?? new Date()),
          n = Math.floor(s / 864e5),
          i = Math.floor(s / 36e5),
          o = Math.floor((s - 36e5 * i) / 6e4),
          r = Math.floor((s - 36e5 * i - 6e4 * o) / 1e3),
          d = "";
        for (let e of [
          [n, "day"],
          [i, "hour"],
          [o, "minute"],
          [r, "second"]
        ])
          if (0 !== e[0]) {
            d = `${e[0]} ${1 === e[0] ? e[1] : e[1] + "s"} ${t ?? "left"}`;
            break;
          }
        return d;
      };
    }
  }
]);
//# sourceMappingURL=6551.js.map
