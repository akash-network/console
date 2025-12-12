!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      a = new e.Error().stack;
    a &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[a] = "575311cc-5655-4d9a-a83a-65bf68a1a532"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-575311cc-5655-4d9a-a83a-65bf68a1a532"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.23.1" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["8377"],
  {
    63400: function (e, a, t) {
      t.d(a, { u: () => o });
      var l = t(52322),
        n = t(71769);
      t(2784);
      var s = t(70514);
      function o(e) {
        let { className: a } = e;
        return (0, l.jsxs)("div", {
          className: (0, s.cn)("w-full flex flex-row items-start px-4 py-3 justify-start dark:bg-red-900 bg-red-100 rounded-2xl", a),
          children: [
            (0, l.jsx)(n.v, { weight: "fill", size: 20, className: "mr-2 text-destructive-100 p-[2px]" }),
            (0, l.jsxs)("div", {
              children: [
                (0, l.jsx)("p", { className: "text-sm text-foreground font-bold !leading-[20px]", children: "Unable to connect to ledger device" }),
                (0, l.jsx)("p", {
                  className: "text-xs text-secondary-800 font-medium !leading-[19px] mt-1",
                  children: "Please check if your ledger is connected and try again."
                })
              ]
            })
          ]
        });
      }
    },
    23751: function (e, a, t) {
      t.d(a, { D: () => s, KE: () => o });
      var l = t(52322);
      t(2784);
      var n = t(86874);
      function s() {
        return (0, l.jsxs)("div", {
          className: "flex rounded-2xl bg-secondary gap-y-1.5 flex-col p-4 w-full",
          children: [(0, l.jsx)(n.Z, { className: "w-24 h-5" }), (0, l.jsx)(n.Z, { className: "w-80 h-10" }), (0, l.jsx)(n.Z, { className: "w-24 h-6" })]
        });
      }
      function o(e) {
        return (0, l.jsx)("div", {
          className: "flex flex-col gap-4 text-xs",
          children: Array.from({ length: e.count ?? 1 }).map((e, a) =>
            (0, l.jsxs)(
              "div",
              {
                className: "flex items-center px-4 py-3 bg-secondary-100 w-full rounded-xl gap-4",
                children: [
                  (0, l.jsx)(n.Z, { width: 36, height: 36, circle: !0 }),
                  (0, l.jsx)(n.Z, { width: 100, height: 12 }),
                  (0, l.jsxs)("div", {
                    className: "flex flex-col items-end ml-auto ",
                    children: [(0, l.jsx)(n.Z, { width: 40, height: 8 }), (0, l.jsx)(n.Z, { width: 48, height: 6 })]
                  })
                ]
              },
              a
            )
          )
        });
      }
    },
    49728: function (e, a, t) {
      t.d(a, { U: () => d });
      var l = t(2784),
        n = t(10289),
        s = t(55736),
        o = t(48534),
        i = t(72565),
        r = t.n(i);
      let d = () => {
        let e = (0, n.s0)();
        return (0, l.useCallback)(async () => {
          let a = r().extension.getViews({ type: "popup" }),
            t = 0 === a.length && 600 === window.outerHeight && 400 === window.outerWidth,
            l = -1 !== a.findIndex(e => e === window);
          if (t || l || (0, o.oj)()) {
            if (!(0, o.oj)()) {
              let e = (await r().windows.getAll()).find(e => "popup" !== e.type);
              e && r().tabs.create({ url: r().runtime.getURL("index.html#/reconnect-ledger"), windowId: e.id }), window.close();
              return;
            }
            window.open("index.html#/reconnect-ledger", "_blank"), (0, s.I)();
          } else e("/reconnect-ledger");
        }, [e]);
      };
    },
    30942: function (e, a, t) {
      t.d(a, { X: () => i });
      var l = t(41172),
        n = t(92642),
        s = t(2784),
        o = t(37906);
      function i(e) {
        let { rpcUrl: a } = (0, l.U9i)();
        (0, s.useEffect)(() => {
          e &&
            !(
              e.includes("was submitted but was not yet found on the chain. You might want to check later. There was a wait of 60 seconds.") ||
              e.includes("Reward is too low")
            ) &&
            (e.includes("You don't have enough") || n.Tb(`${e} - node: ${a}`, { tags: o.rw }));
        }, [e, a]);
      }
    },
    56001: function (e, a, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(a, { Z: () => R });
          var n = t(52322),
            s = t(41172),
            o = t(6391),
            i = t.n(o),
            r = t(27963),
            d = t(23259),
            c = t(79533),
            u = t(74229),
            m = t(76131),
            x = t(72059),
            v = t(50449),
            f = t(34844),
            h = t(42941),
            g = t(30464),
            p = t(75958),
            w = t(2784),
            b = t(10289),
            j = t(26245),
            N = t(83275),
            k = t(58022),
            y = t(84335),
            C = t(49298),
            S = t(78884),
            _ = t(68708),
            D = t(86798),
            M = t(46078),
            E = t(46798),
            A = t(81248),
            T = t(95380),
            L = t(92006),
            B = t(28345),
            Z = e([x, N, f, j, m, L, M, D, E, B, S, k, T, A, C]);
          [x, N, f, j, m, L, M, D, E, B, S, k, T, A, C] = Z.then ? (await Z)() : Z;
          let R = (0, p.Pi)(e => {
            var a, t, l;
            let {
                forceChain: o,
                forceNetwork: p,
                showBackAction: Z,
                onBackClick: R,
                rootDenomsStore: F,
                delegationsStore: O,
                validatorsStore: P,
                unDelegationsStore: G,
                claimRewardsStore: I,
                rootBalanceStore: J,
                chainTagsStore: H
              } = e,
              z = (0, s.a74)(),
              V = (0, x.N8)(),
              $ = (0, w.useMemo)(() => o || z, [z, o]),
              [U, W] = (0, w.useState)(null),
              Y = (0, s.obn)(),
              K = (0, w.useMemo)(() => p || Y, [Y, p]),
              { walletAvatar: q, walletName: X, activeWallet: Q } = (0, u.vL)(),
              { headerChainImgSrc: ee } = (0, u.Cd)();
            (0, v._)(N.t), (0, f.G)($);
            let ea = (0, h.Z)(),
              et = ea.get("validatorAddress") ?? void 0,
              el = ea.get("chainId") ?? void 0,
              en = ea.get("action") ?? void 0,
              es = (0, b.s0)(),
              eo = F.allDenoms,
              ei = O.delegationsForChain($),
              er = P.validatorsForChain($),
              ed = G.unDelegationsForChain($),
              ec = I.claimRewardsForChain($),
              {
                rewards: eu,
                delegations: em,
                loadingDelegations: ex,
                loadingNetwork: ev,
                loadingRewards: ef,
                loadingUnboundingDelegations: eh
              } = (0, s.nDu)(eo, ei, er, ed, ec, $, K, J.allSpendableTokens),
              eg = (0, w.useMemo)(() => ex || ef || eh, [ex, ef, eh]),
              [ep] = (0, s.JsT)(eo, $, K),
              [ew, eb] = (0, w.useState)(!1),
              [ej, eN] = (0, w.useState)(!1),
              [ek, ey] = (0, w.useState)(!1),
              [eC, eS] = (0, w.useState)(!1),
              [e_, eD] = (0, w.useState)(!1),
              [eM, eE] = (0, w.useState)(!1),
              { isLoading: eA, data: eT = {} } = (0, s.ViV)(),
              { data: eL } = (0, s.S2A)(),
              eB = (0, w.useMemo)(() => {
                var e;
                return null === (e = eT[null == ep ? void 0 : ep.coinDenom]) || void 0 === e
                  ? void 0
                  : e.sort((e, a) => {
                      let t = e.priority,
                        l = a.priority;
                      return void 0 !== t && void 0 !== l ? t - l : void 0 !== t ? -1 : +(void 0 !== l);
                    });
              }, [null == ep ? void 0 : ep.coinDenom, eT]),
              eZ = (0, w.useMemo)(() => {
                var e;
                let a = {};
                null == eu ||
                  null === (e = eu.rewards) ||
                  void 0 === e ||
                  e.forEach(e => {
                    let t = e.validator_address;
                    a[t] || (a[t] = { validator_address: t, reward: [] });
                    let l = {};
                    e.reward.forEach(e => {
                      let { denom: a, amount: t, tokenInfo: n } = e,
                        s = parseFloat(t);
                      l[a]
                        ? (l[a] += s * Math.pow(10, (null == n ? void 0 : n.coinDecimals) ?? 6))
                        : (l[a] = s * Math.pow(10, (null == n ? void 0 : n.coinDecimals) ?? 6));
                    }),
                      a[t].reward.push(...Object.keys(l).map(e => ({ denom: e, amount: l[e] })));
                  });
                let t = null == eu ? void 0 : eu.total.find(e => e.denom === (null == ep ? void 0 : ep.coinMinimalDenom));
                return {
                  rewardsUsdValue: new (i())((null == t ? void 0 : t.currencyAmount) ?? "0"),
                  rewardsStatus: "",
                  usdValueStatus: "",
                  denom: null == t ? void 0 : t.denom,
                  rewardsDenomValue: new (i())((null == t ? void 0 : t.amount) ?? "0"),
                  rewards: { rewardMap: a }
                };
              }, [ep, eu]);
            (0, w.useEffect)(() => {
              !(async function () {
                if (el && z !== d.HW) {
                  let e = (await (0, c._d)())[el];
                  V(e);
                }
              })();
            }, [el]);
            let eR = (0, w.useMemo)(() => {
              var e;
              return null === (e = er.validatorData.validators) || void 0 === e ? void 0 : e.reduce((e, a) => ((e[a.address] = a), e), {});
            }, [er.validatorData.validators]);
            (0, s.Ewi)(eR, j.RZ, $, K);
            let eF = (0, w.useCallback)(async () => {
              let e = $;
              el && z !== d.HW && (e = (await (0, c._d)())[el]);
              let a = et ? (null == eR ? void 0 : eR[et]) : void 0,
                t = { mode: "DELEGATE", toValidator: a, forceChain: e, forceNetwork: K };
              sessionStorage.setItem("navigate-stake-input-state", JSON.stringify(t));
              let l = a ? "" : `?validatorAddress=${et}`;
              es(`/stake/input${l}`, { state: t, replace: !0 });
            }, [z, $, K, es, el, et, eR]);
            (0, w.useEffect)(() => {
              switch (en) {
                case "CLAIM_REWARDS":
                  eb(!0);
                  break;
                case "OPEN_LIQUID_STAKING":
                  eE(!0);
                  break;
                case "DELEGATE":
                  eF();
              }
            }, [en, eF]);
            let eO = (0, w.useCallback)(() => {
              var e;
              "lava" === $ && (null == eL ? void 0 : null === (e = eL.restaking) || void 0 === e ? void 0 : e.extension)
                ? eD(!0)
                : "celestia" === $
                  ? eb(!0)
                  : eS(!0);
            }, [$, null == eL ? void 0 : null === (a = eL.restaking) || void 0 === a ? void 0 : a.extension]);
            return ((0, m.$)({
              enabled: !!Q,
              page: "stake",
              op: "stakePageLoad",
              description: "loading state on stake page",
              queryStatus: eg ? "loading" : "success"
            }),
            Q)
              ? (0, n.jsxs)(n.Fragment, {
                  children: [
                    (0, n.jsx)(L.w, { onBackClick: R }),
                    (0, n.jsxs)("div", {
                      className: "flex flex-col gap-y-5 px-6 py-7 w-full flex-1",
                      children: [
                        (0, n.jsx)(M.Z, { forceChain: $, forceNetwork: K }),
                        eg || Object.values(em ?? {}).length > 0
                          ? (0, n.jsx)(D.Z, { onClaim: eO, forceChain: $, forceNetwork: K })
                          : (0, n.jsx)(y.Z, {
                              forceChain: $,
                              forceNetwork: K,
                              title: "Stake tokens to earn rewards",
                              subtitle: `You haven't staked any ${null == ep ? void 0 : ep.coinDenom}`,
                              buttonText: "Stake now"
                            }),
                        (0, n.jsx)(E.Z, { forceChain: $, forceNetwork: K, setClaimTxMode: W })
                      ]
                    }),
                    (0, n.jsx)(B.U, { mode: U, isOpen: !!U, onClose: () => W(null), forceChain: $, forceNetwork: K }),
                    !ev &&
                      (0, n.jsxs)(n.Fragment, {
                        children: [
                          (0, n.jsx)(S.C, { isOpen: ew, onClose: () => eb(!1), validators: eR, forceChain: $, forceNetwork: K, setClaimTxMode: W }),
                          (0, n.jsx)(k.C, {
                            isOpen: eC,
                            onClose: () => eS(!1),
                            onClaim: () => {
                              eS(!1), eb(!0);
                            },
                            onClaimAndStake: () => {
                              eS(!1), ey(!0);
                            },
                            forceChain: $,
                            forceNetwork: K
                          }),
                          "lava" === $ &&
                            (null == eL ? void 0 : null === (t = eL.restaking) || void 0 === t ? void 0 : t.extension) === "active" &&
                            (0, n.jsx)(T.C, {
                              isOpen: ej,
                              onClose: () => eN(!1),
                              rootDenomsStore: F,
                              rootBalanceStore: J,
                              forceChain: $,
                              forceNetwork: K,
                              setClaimTxMode: W
                            }),
                          "lava" === $ &&
                            (null == eL ? void 0 : null === (l = eL.restaking) || void 0 === l ? void 0 : l.extension) === "active" &&
                            (0, n.jsx)(A.Z, {
                              isOpen: e_,
                              onClose: () => eD(!1),
                              onClaimValidatorRewards: () => {
                                eD(!1), eb(!0);
                              },
                              onClaimProviderRewards: () => {
                                eD(!1), eN(!0);
                              },
                              rootDenomsStore: F,
                              delegationsStore: O,
                              validatorsStore: P,
                              unDelegationsStore: G,
                              claimRewardsStore: I,
                              rootBalanceStore: J,
                              forceChain: o,
                              forceNetwork: p
                            }),
                          eZ &&
                            (0, n.jsx)(C.Z, {
                              isOpen: ek,
                              onClose: () => ey(!1),
                              validators: eR,
                              chainRewards: eZ,
                              forceChain: $,
                              forceNetwork: K,
                              setClaimTxMode: W
                            })
                        ]
                      }),
                    eB && (0, n.jsx)(_.Z, { isVisible: eM, onClose: () => eE(!1), providers: eB, rootDenomsStore: F, forceChain: $, forceNetwork: K })
                  ]
                })
              : (0, n.jsx)("div", {
                  className: "relative w-full overflow-clip panel-height flex items-center justify-center",
                  children: (0, n.jsx)(r.S, { src: g.r.Logos.LeapCosmos, heading: "No wallet found", logoClassName: "size-14" })
                });
          });
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    28345: function (e, a, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(a, { U: () => p });
          var n = t(52322),
            s = t(56594),
            o = t(41172),
            i = t(89187),
            r = t(96217),
            d = t(91486),
            c = t(72059),
            u = t(30464),
            m = t(75958),
            x = t(2784),
            v = t(62833),
            f = t(48346),
            h = t(90258),
            g = e([c, f]);
          [c, f] = g.then ? (await g)() : g;
          let p = (0, m.Pi)(e => {
            let { isOpen: a, onClose: t, mode: l, forceChain: m, forceNetwork: g } = e,
              p = (0, c.a7)(),
              w = (0, o.obn)(),
              b = m ?? p,
              j = g ?? w,
              { pendingTx: N, setPendingTx: k } = (0, o.EEe)(),
              { explorerTxnUrl: y } = (0, o.xGX)({ forceChain: b, forceNetwork: j, forceTxHash: null == N ? void 0 : N.txHash });
            return (
              (0, x.useEffect)(() => {
                (null == N ? void 0 : N.promise) &&
                  N.promise
                    .then(
                      e => {
                        e && (0, s.isDeliverTxSuccess)(e) ? k({ ...N, txStatus: "success" }) : k({ ...N, txStatus: "failed" });
                      },
                      () => k({ ...N, txStatus: "failed" })
                    )
                    .catch(() => {
                      k({ ...N, txStatus: "failed" });
                    })
                    .finally(() => {
                      f.jZ.refetchBalances(b, j), f.lc.updateStake(b, j, !0);
                    });
              }, [null == N ? void 0 : N.promise]),
              (0, n.jsxs)(r.Z, {
                fullScreen: !0,
                isOpen: a,
                onClose: t,
                containerClassName: "bg-secondary-50",
                className: "h-full flex flex-col",
                children: [
                  (0, n.jsxs)("div", {
                    className: "flex flex-col gap-6 items-center my-auto",
                    children: [
                      (0, n.jsxs)("div", {
                        className: "flex flex-col gap-10 items-center",
                        children: [
                          (0, n.jsxs)("div", {
                            className: "flex items-center justify-center",
                            children: [
                              (null == N ? void 0 : N.txStatus) === "loading" &&
                                (0, n.jsx)("div", {
                                  className: "size-[100px] p-8 rounded-full bg-secondary-200 animate-spin",
                                  children: (0, n.jsx)("img", { className: "size-full", src: u.r.Swap.Rotate })
                                }),
                              (null == N ? void 0 : N.txStatus) === "success" &&
                                (0, n.jsx)("div", {
                                  className: "size-[100px] p-8 rounded-full bg-green-400",
                                  children: (0, n.jsx)("img", { className: "size-full", src: u.r.Swap.CheckGreen })
                                }),
                              (null == N ? void 0 : N.txStatus) === "failed" &&
                                (0, n.jsx)("div", {
                                  className: "size-[100px] p-8 rounded-full bg-red-600 dark:bg-red-400",
                                  children: (0, n.jsx)("img", { className: "size-full", src: u.r.Swap.FailedRed })
                                })
                            ]
                          }),
                          (0, n.jsxs)("div", {
                            className: "flex flex-col gap-3 items-center",
                            children: [
                              (0, n.jsxs)("span", {
                                className: "font-bold text-[1.5rem] text-center text-foreground",
                                children: [h.d6[l || "DELEGATE"], " ", h.KT[(null == N ? void 0 : N.txStatus) || "loading"]]
                              }),
                              (null == N ? void 0 : N.subtitle2) && "success" === N.txStatus
                                ? (0, n.jsx)("span", { className: "text-sm text-secondary-800 text-center mx-6", children: N.subtitle2 })
                                : null
                            ]
                          })
                        ]
                      }),
                      y
                        ? (0, n.jsxs)("a", {
                            target: "_blank",
                            rel: "noreferrer",
                            href: y,
                            className: "flex font-medium items-center gap-1 text-sm text-accent-green hover:text-accent-green-200 transition-colors",
                            children: ["View transaction", (0, n.jsx)(i.T, { size: 12 })]
                          })
                        : null
                    ]
                  }),
                  (0, n.jsxs)("div", {
                    className: "flex gap-x-4 mt-auto [&>*]:flex-1",
                    children: [
                      (0, n.jsx)(d.zx, { variant: "mono", asChild: !0, children: (0, n.jsx)(v.rU, { to: "/home", children: "Home" }) }),
                      (0, n.jsx)(d.zx, {
                        onClick: t,
                        disabled: (null == N ? void 0 : N.txStatus) === "loading",
                        children: (null == N ? void 0 : N.txStatus) === "failed" ? "Retry" : "DELEGATE" === l ? "Stake Again" : "Done"
                      })
                    ]
                  })
                ]
              })
            );
          });
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    83208: function (e, a, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(a, { j: () => D });
          var n = t(52322),
            s = t(41172),
            o = t(48039),
            i = t(48272),
            r = t(63161),
            d = t(6391),
            c = t.n(d),
            u = t(99272),
            m = t(27963),
            x = t(84916),
            v = t(96128),
            f = t.n(v),
            h = t(79533),
            g = t(6401),
            p = t(38313),
            w = t(42941),
            b = t(30464),
            j = t(75958),
            N = t(2784),
            k = t(92006),
            y = t(56001),
            C = t(67684),
            S = t(13906),
            _ = e([p, y, k, u]);
          [p, y, k, u] = _.then ? (await _)() : _;
          let D = (0, j.Pi)(e => {
            let {
                chainTagsStore: a,
                aggregateStakeStore: t,
                rootDenomsStore: l,
                delegationsStore: d,
                validatorsStore: v,
                unDelegationsStore: j,
                claimRewardsStore: _,
                rootBalanceStore: D
              } = e,
              {
                perChainDelegations: M,
                totalCurrencyAmountDelegation: E,
                averageApr: A,
                totalClaimRewardsAmount: T,
                isEveryChainLoading: L,
                isSomeChainLoading: B
              } = t.aggregatedStake,
              [Z, R] = (0, N.useState)(""),
              [F, O] = (0, N.useState)(!1),
              [P] = (0, g.nB)(),
              G = (0, s.DI5)(),
              [I, J] = (0, N.useState)(!0),
              [H, z] = (0, N.useState)(!0),
              [V, $] = (0, N.useState)("amount"),
              U = (0, p.ob)(),
              [W, Y] = (0, N.useState)(null),
              K = (0, w.Z)(),
              q = K.get("chainId") ?? void 0,
              X = (0, N.useMemo)(() => (A ? `${f()((100 * A).toString(), { precision: 2, symbol: "" }).format()}%` : "-"), [A]),
              Q = ["ATOM", "TIA", "CORE", "OSMO", "INJ", "BABY", "NIBI", "OM"],
              ee = (0, N.useMemo)(() => {
                let e = Z.trim().toLowerCase(),
                  a = Object.keys(M)
                    .reduce((a, t) => (t.toLowerCase().includes(e) || M[t].stakingDenom.toLowerCase().includes(e) ? [...a, { ...M[t], chain: t }] : a), [])
                    .sort((e, a) => {
                      let t = Q.indexOf(e.stakingDenom),
                        l = Q.indexOf(a.stakingDenom);
                      return -1 === t ? 1 : -1 === l ? -1 : t - l;
                    });
                switch (V) {
                  case "apr":
                    return a.sort((e, a) => (I ? a.apr - e.apr : e.apr - a.apr));
                  case "amount":
                    return a.sort((e, a) => {
                      let t = e.currencyAmountDelegation && !isNaN(Number(e.currencyAmountDelegation));
                      if (!(a.currencyAmountDelegation && !isNaN(Number(a.currencyAmountDelegation)))) {
                        if (t) return H ? -1 : 1;
                        let l = e.totalDelegation,
                          n = a.totalDelegation;
                        return !n || n.isNaN() || n.isZero()
                          ? !l || l.isNaN() || l.isZero()
                            ? H
                              ? 1
                              : -1
                            : H
                              ? -1
                              : 1
                          : !l || l.isNaN() || l.isZero()
                            ? H
                              ? 1
                              : -1
                            : H
                              ? n.minus(l).toNumber()
                              : e.totalDelegation.minus(a.totalDelegation).toNumber();
                      }
                      return t
                        ? H
                          ? Number(a.currencyAmountDelegation) - Number(e.currencyAmountDelegation)
                          : Number(e.currencyAmountDelegation) - Number(a.currencyAmountDelegation)
                        : H
                          ? 1
                          : -1;
                    });
                }
              }, [M, Z, H, I, V]),
              ea = (0, N.useCallback)(
                e => {
                  var a;
                  Y(e),
                    0 === ((null === (a = v.validatorsForChain(e).validatorData) || void 0 === a ? void 0 : a.validators) ?? []).length &&
                      v.loadValidators(e, U);
                },
                [U, v]
              ),
              et = (0, N.useCallback)(() => Y(null), []);
            return ((0, N.useEffect)(() => {
              (async function () {
                if (q) {
                  let e = (await (0, h._d)())[q];
                  Y(e), K.delete("chainId");
                }
              })();
            }, [q]),
            W)
              ? (0, n.jsx)(y.Z, {
                  forceChain: W,
                  forceNetwork: "mainnet",
                  showBackAction: !0,
                  onBackClick: et,
                  rootDenomsStore: l,
                  delegationsStore: d,
                  validatorsStore: v,
                  unDelegationsStore: j,
                  claimRewardsStore: _,
                  rootBalanceStore: D,
                  chainTagsStore: a
                })
              : (0, n.jsxs)(n.Fragment, {
                  children: [
                    (0, n.jsx)(k.w, { setShowSearchInput: O }),
                    (0, n.jsxs)("div", {
                      className: "flex flex-col pt-6 px-6 w-full h-full overflow-y-scroll bg-secondary-50",
                      children: [
                        F
                          ? (0, n.jsxs)("div", {
                              className: "flex gap-4 items-center mb-6",
                              children: [
                                (0, n.jsx)(x.M, { value: Z, placeholder: "Search staked tokens", onChange: e => R(e.target.value), onClear: () => R("") }),
                                (0, n.jsx)(o.X, {
                                  size: 24,
                                  className: "text-muted-foreground  cursor-pointer p-3.5 h-auto w-12 rounded-full bg-secondary-100 hover:bg-secondary-200",
                                  onClick: () => {
                                    O(!1), R("");
                                  }
                                })
                              ]
                            })
                          : (0, n.jsxs)("div", {
                              className:
                                "bg-white-100 dark:bg-gray-950 border-[1px] border-solid border-gray-200 dark:border-gray-850 rounded-xl flex p-3 mb-6",
                              children: [
                                (0, n.jsx)(C.d, {
                                  label: "Staked",
                                  value: P(E),
                                  className: "border-r-[1px] border-solid border-gray-200 dark:border-gray-850"
                                }),
                                (0, n.jsx)(C.d, {
                                  label: "Claimable",
                                  value: P(T),
                                  className: "border-r-[1px] border-solid border-gray-200 dark:border-gray-850"
                                }),
                                (0, n.jsx)(C.d, { label: "Avg APR", value: X })
                              ]
                            }),
                        ee.length > 0 &&
                          (0, n.jsxs)("p", {
                            className: "text-gray-800 dark:text-gray-200 text-[12px] text-[500] flex items-center justify-between mb-2 px-[12px]",
                            children: [
                              (0, n.jsx)("span", { className: "block w-[150px]", children: "Tokens" }),
                              (0, n.jsxs)("button", {
                                className: "flex items-center justify-between gap-1",
                                onClick: () => {
                                  J(!I), $("apr");
                                },
                                children: [
                                  "APR",
                                  "apr" === V &&
                                    (0, n.jsx)(n.Fragment, {
                                      children: I
                                        ? (0, n.jsx)(i.p, { size: 16, className: "text-black-100 dark:text-white-100" })
                                        : (0, n.jsx)(r.U, { size: 16, className: "text-black-100 dark:text-white-100" })
                                    })
                                ]
                              }),
                              (0, n.jsxs)("button", {
                                className: "w-[90px] text-right flex items-center justify-end gap-1",
                                onClick: () => {
                                  z(!H), $("amount");
                                },
                                children: [
                                  "Amount",
                                  "amount" === V &&
                                    (0, n.jsx)(n.Fragment, {
                                      children: H
                                        ? (0, n.jsx)(i.p, { size: 16, className: "text-black-100 dark:text-white-100" })
                                        : (0, n.jsx)(r.U, { size: 16, className: "text-black-100 dark:text-white-100" })
                                    })
                                ]
                              })
                            ]
                          }),
                        (0, n.jsx)("div", {
                          className: "h-full w-full overflow-y-scroll",
                          children: (0, n.jsxs)("div", {
                            className: "flex flex-col gap-3 pb-6",
                            children: [
                              L ? (0, n.jsx)(u.MC, {}) : null,
                              L
                                ? null
                                : ee.length > 0
                                  ? (0, n.jsx)(n.Fragment, {
                                      children: ee.map(e => {
                                        let { totalDelegationAmount: a, currencyAmountDelegation: t, stakingDenom: l, apr: s, chain: o } = e,
                                          i = s ? `${f()((100 * s).toString(), { precision: 2, symbol: "" }).format()} %` : "-";
                                        return (0, n.jsx)(
                                          S.h,
                                          {
                                            tokenName: l,
                                            chainName: G[o].chainName,
                                            chainLogo: G[o].chainSymbolImageUrl ?? "",
                                            apr: i,
                                            dollarAmount: P(new (c())(t)),
                                            amount: a,
                                            onClick: () => ea(o)
                                          },
                                          o
                                        );
                                      })
                                    })
                                  : (0, n.jsx)(m.S, {
                                      isRounded: !0,
                                      subHeading: "Please try again with something else",
                                      heading: "No results for “" + (0, s.jrB)(Z) + "”",
                                      src: b.r.Misc.Explore,
                                      classname: "dark:!bg-gray-950",
                                      imgContainerClassname: "dark:!bg-gray-900"
                                    }),
                              B && !F ? (0, n.jsx)(u.MC, {}) : null
                            ]
                          })
                        })
                      ]
                    })
                  ]
                });
          });
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    67684: function (e, a, t) {
      t.d(a, { d: () => o });
      var l = t(52322),
        n = t(72779),
        s = t.n(n);
      function o(e) {
        let { label: a, value: t, className: n } = e;
        return (0, l.jsxs)("div", {
          className: s()("flex flex-col gap-1 items-center flex-1", n),
          children: [
            (0, l.jsx)("h3", { className: "text-gray-600 dark:text-gray-400 text-[12px]", children: a }),
            (0, l.jsx)("p", { className: "text-black-100 dark:text-white-100 font-[700]", children: t })
          ]
        });
      }
      t(2784);
    },
    58022: function (e, a, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(a, { C: () => p, Z: () => g });
          var n = t(52322),
            s = t(41172),
            o = t(6391),
            i = t.n(o),
            r = t(96217),
            d = t(91486),
            c = t(6401),
            u = t(75958),
            m = t(2784),
            x = t(42799),
            v = t(84994),
            f = t(84601),
            h = e([f]);
          f = (h.then ? (await h)() : h)[0];
          let g = e =>
              (0, n.jsxs)("div", {
                className: "flex gap-2 items-center justify-between bg-secondary-100 p-6 rounded-xl",
                children: [
                  (0, n.jsxs)("div", {
                    className: "flex flex-col gap-1",
                    children: [
                      (0, n.jsx)("span", { className: "text-lg font-bold", children: e.titleAmount }),
                      (0, n.jsx)("span", { className: "text-sm text-muted-foreground", children: e.secondaryAmount })
                    ]
                  }),
                  e.button
                ]
              }),
            p = (0, u.Pi)(e => {
              let { isOpen: a, onClose: t, onClaim: l, onClaimAndStake: o, forceChain: u, forceNetwork: h } = e,
                p = (0, s.a74)(),
                w = (0, m.useMemo)(() => u || p, [u, p]),
                b = (0, s.obn)(),
                j = (0, m.useMemo)(() => h || b, [h, b]),
                [N] = (0, c.nB)(),
                k = x.gb.allDenoms,
                y = f.xO.delegationsForChain(w),
                C = f.fe.validatorsForChain(w),
                S = f.GO.unDelegationsForChain(w),
                _ = f.eq.claimRewardsForChain(w),
                [D] = (0, s.JsT)(k, w, j),
                { totalRewardsDollarAmt: M, rewards: E } = (0, s.nDu)(k, y, C, S, _, w, j),
                A = (0, m.useMemo)(() => {
                  if (E) {
                    var e;
                    return null === (e = E.total) || void 0 === e ? void 0 : e.find(e => e.denom === (null == D ? void 0 : D.coinMinimalDenom));
                  }
                }, [null == D ? void 0 : D.coinMinimalDenom, E]),
                T = (0, m.useMemo)(() => !A || new (i())(A.amount).lt(1e-5), [A]),
                L = (0, m.useMemo)(
                  () => v.J.formatHideBalance((0, s.LHZ)((null == A ? void 0 : A.amount) ?? "", null == D ? void 0 : D.coinDenom)),
                  [null == D ? void 0 : D.coinDenom, null == A ? void 0 : A.amount]
                ),
                B = (0, m.useMemo)(
                  () =>
                    new (i())((null == A ? void 0 : A.currencyAmount) ?? "").gt(0)
                      ? v.J.formatHideBalance(N(new (i())((null == A ? void 0 : A.currencyAmount) ?? "")))
                      : L,
                  [N, L, null == A ? void 0 : A.currencyAmount]
                ),
                Z = (0, m.useMemo)(() => (new (i())((null == A ? void 0 : A.currencyAmount) ?? "").gt(0) ? L : ""), [L, null == A ? void 0 : A.currencyAmount]),
                R = (0, m.useMemo)(
                  () => v.J.formatHideBalance(`${(0, s.LHZ)((null == A ? void 0 : A.amount) ?? "", null == D ? void 0 : D.coinDenom)}`),
                  [null == D ? void 0 : D.coinDenom, null == A ? void 0 : A.amount]
                ),
                F = (0, m.useMemo)(() => (M && new (i())(M).gt(0) ? v.J.formatHideBalance(N(new (i())(M))) : R), [N, R, M]),
                O = (0, m.useMemo)(() => (M && new (i())(M).gt(0) ? R : ""), [R, M]);
              return (0, n.jsxs)(r.Z, {
                isOpen: a,
                onClose: t,
                title: "Claim rewards",
                className: "flex flex-col gap-8 mt-4",
                children: [
                  (0, n.jsxs)("div", {
                    className: "flex flex-col gap-4 w-full",
                    children: [
                      (0, n.jsx)("span", { className: "text-muted-foreground text-sm", children: `Claim rewards on ${D.coinDenom}` }),
                      (0, n.jsx)(g, {
                        titleAmount: F,
                        secondaryAmount: O,
                        button: (0, n.jsx)(d.zx, {
                          onClick: l,
                          variant: "secondary",
                          size: "md",
                          className: "w-[7.5rem] bg-secondary-350 disabled:bg-secondary-300 hover:bg-secondary-300",
                          "aria-label": "claim info card claim button in stake v2 flow",
                          children: (0, n.jsx)("span", { "aria-label": "claim info card claim button text in stake v2 flow", children: "Claim" })
                        })
                      })
                    ]
                  }),
                  (0, n.jsxs)("div", {
                    className: "flex flex-col gap-4 w-full",
                    children: [
                      (0, n.jsx)("span", { className: "text-muted-foreground text-sm", children: "Auto stake the rewards earned" }),
                      (0, n.jsx)(g, {
                        titleAmount: B,
                        secondaryAmount: Z,
                        button: (0, n.jsx)(d.zx, {
                          size: "md",
                          className: "w-[7.5rem] whitespace-nowrap",
                          onClick: o,
                          disabled: T,
                          "aria-label": "claim info card claim and stake button in stake v2 flow",
                          children: (0, n.jsx)("span", {
                            "aria-label": "claim info card claim and stake button text in stake v2 flow",
                            children: "Claim & stake"
                          })
                        })
                      })
                    ]
                  })
                ]
              });
            });
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    84335: function (e, a, t) {
      t.d(a, { Z: () => c });
      var l = t(52322),
        n = t(41172),
        s = t(91486),
        o = t(30464),
        i = t(75958);
      t(2784);
      var r = t(10289),
        d = t(42799);
      let c = (0, i.Pi)(e => {
        let { forceChain: a, forceNetwork: t, onClick: i, title: c, subtitle: u, buttonText: m } = e,
          x = (0, n.a74)(),
          v = (0, n.obn)(),
          f = a ?? x,
          h = t ?? v,
          g = (0, r.s0)(),
          [p] = (0, n.JsT)(d.gb.allDenoms, f, h);
        return (0, l.jsxs)("div", {
          className: "flex flex-col gap-7 py-[90px] px-4 border border-secondary-100 rounded-2xl",
          children: [
            (0, l.jsxs)("div", {
              className: "flex flex-col w-full items-center",
              children: [
                (0, l.jsx)("img", { className: "w-[88px] mb-1", src: o.r.Logos.LeapLogo }),
                (0, l.jsx)("span", { className: "text-foreground text-[18px] mb-2 font-bold", children: c }),
                (0, l.jsx)("span", { className: "text-secondary-800 text-xs text-center", children: u })
              ]
            }),
            (0, l.jsx)(s.zx, {
              className: "w-full",
              onClick: () => {
                if (i) i();
                else {
                  let e = { mode: "DELEGATE", forceChain: f, forceNetwork: h };
                  sessionStorage.setItem("navigate-stake-input-state", JSON.stringify(e)), g("/stake/input", { state: e });
                }
              },
              "aria-label": "not staked card button in stake v2 flow",
              children: (0, l.jsx)("span", { "aria-label": "not staked card button text in stake v2 flow", children: m })
            })
          ]
        });
      });
    },
    14048: function (e, a, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(a, { Z: () => v });
          var n = t(52322),
            s = t(41172),
            o = t(15969),
            i = t(23751),
            r = t(75958),
            d = t(2784),
            c = t(94629),
            u = t(25550),
            m = t(99447),
            x = e([u]);
          u = (x.then ? (await x)() : x)[0];
          let v = (0, r.Pi)(e => {
            let {
                rootDenomsStore: a,
                delegationsStore: t,
                validatorsStore: l,
                unDelegationsStore: r,
                claimRewardsStore: x,
                forceChain: v,
                forceNetwork: f,
                rootBalanceStore: h,
                setClaimTxMode: g
              } = e,
              p = (0, s.a74)(),
              w = (0, s.obn)(),
              b = v ?? p,
              j = f ?? w,
              N = a.allDenoms,
              k = t.delegationsForChain(b),
              y = l.validatorsForChain(b),
              C = r.unDelegationsForChain(b),
              S = x.claimRewardsForChain(b),
              { unboundingDelegationsInfo: _, loadingUnboundingDelegations: D } = (0, s.nDu)(N, k, y, C, S, b, j),
              M = (0, d.useMemo)(() => {
                var e;
                return null === (e = y.validatorData.validators) || void 0 === e ? void 0 : e.reduce((e, a) => ((e[a.address] = a), e), {});
              }, [y.validatorData.validators]),
              E = (0, d.useMemo)(() => {
                var e;
                return null === (e = Object.values(_ ?? {})) || void 0 === e ? void 0 : e[0];
              }, [_]),
              { isCancleUnstakeSupported: A } = (0, s.MY5)(E, b, j),
              [T, L] = (0, d.useState)(!1),
              [B, Z] = (0, d.useState)(),
              [R, F] = (0, d.useState)();
            return D || (0 !== Object.values(_ ?? {}).length && M)
              ? (0, n.jsxs)(n.Fragment, {
                  children: [
                    D &&
                      (0, n.jsxs)("div", {
                        className: "flex flex-col w-full gap-4",
                        children: [
                          (0, n.jsxs)("div", {
                            className: "flex justify-between",
                            children: [
                              (0, n.jsx)("span", { className: "text-xs text-muted-foreground", children: "Validator" }),
                              (0, n.jsx)("span", { className: "text-xs text-muted-foreground", children: "Amount Staked" })
                            ]
                          }),
                          (0, n.jsx)(i.KE, { count: 5 })
                        ]
                      }),
                    !D &&
                      M &&
                      _ &&
                      (0, n.jsxs)("div", {
                        className: "flex flex-col w-full gap-4",
                        children: [
                          (0, n.jsxs)("div", {
                            className: "flex justify-between",
                            children: [
                              (0, n.jsx)("span", { className: "text-xs text-muted-foreground", children: "Validator" }),
                              (0, n.jsx)("span", { className: "text-xs text-muted-foreground", children: "Amount Staked" })
                            ]
                          }),
                          Object.values(_ ?? {}).map(e => {
                            let a = M[null == e ? void 0 : e.validator_address];
                            return a
                              ? e.entries.map((t, l) =>
                                  (0, n.jsx)(
                                    m.v,
                                    {
                                      entry: t,
                                      isCancleUnstakeSupported: A,
                                      validator: a,
                                      subText: (0, o.sSP)(b) ? void 0 : (0, c.z)(t.completion_time),
                                      onClick: () => {
                                        A && (L(!0), Z(e), F(t));
                                      }
                                    },
                                    `${null == a ? void 0 : a.address} ${l}`
                                  )
                                )
                              : null;
                          })
                        ]
                      }),
                    B &&
                      R &&
                      M &&
                      (0, n.jsx)(u.Z, {
                        isOpen: T,
                        onClose: () => L(!1),
                        unbondingDelegation: B,
                        unbondingDelegationEntry: R,
                        validator: M[B.validator_address],
                        rootDenomsStore: a,
                        rootBalanceStore: h,
                        delegationsStore: t,
                        validatorsStore: l,
                        unDelegationsStore: r,
                        claimRewardsStore: x,
                        forceChain: b,
                        forceNetwork: j,
                        setClaimTxMode: g
                      })
                  ]
                })
              : (0, n.jsx)(n.Fragment, {});
          });
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    90139: function (e, a, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(a, { Z: () => B });
          var n = t(52322),
            s = t(41172),
            o = t(75377),
            i = t(6391),
            r = t.n(i),
            d = t(58885),
            c = t(51994),
            u = t(80588),
            m = t(42152),
            x = t(96217),
            v = t(91486),
            f = t(13287),
            h = t(6401),
            g = t(30942),
            p = t(65027),
            w = t(30464),
            b = t(63242),
            j = t(97680),
            N = t.n(j),
            k = t(75958),
            y = t(2784),
            C = t(10289),
            S = t(42799),
            _ = t(48346),
            D = t(48534),
            M = t(90258),
            E = t(78884),
            A = t(92642),
            T = e([p, d, _, E, c, u]);
          [p, d, _, E, c, u] = T.then ? (await T)() : T;
          let L = p.w.useGetWallet,
            B = (0, k.Pi)(e => {
              let { isOpen: a, onClose: t, validator: l, unbondingDelegationEntry: i, forceChain: p, forceNetwork: j, setClaimTxMode: k } = e,
                T = S.gb.allDenoms,
                B = L(),
                Z = (0, s.a74)(),
                R = (0, y.useMemo)(() => p || Z, [Z, p]),
                F = (0, s.obn)(),
                O = (0, y.useMemo)(() => j || F, [F, j]),
                P = (0, d.e7)(T, { activeChain: R, selectedNetwork: O }),
                [G] = (0, h.nB)(),
                [I] = (0, s.JsT)(T, R, O),
                { theme: J } = (0, o.useTheme)(),
                {
                  showLedgerPopup: H,
                  onReviewTransaction: z,
                  isLoading: V,
                  error: $,
                  setAmount: U,
                  recommendedGasLimit: W,
                  userPreferredGasLimit: Y,
                  setUserPreferredGasLimit: K,
                  setUserPreferredGasPrice: q,
                  gasOption: X,
                  setGasOption: Q,
                  userPreferredGasPrice: ee,
                  setFeeDenom: ea,
                  setCreationHeight: et,
                  ledgerError: el,
                  setLedgerError: en,
                  customFee: es,
                  feeDenom: eo
                } = (0, s.rKd)(T, "CANCEL_UNDELEGATION", l, void 0, void 0, R, O),
                [ei, er] = (0, y.useState)(!1),
                [ed, ec] = (0, y.useState)(null),
                [eu, em] = (0, y.useState)({ option: X, gasPrice: ee ?? P.gasPrice });
              (0, C.s0)();
              let { data: ex } = (0, s.pD_)((null == l ? void 0 : l.image) ? void 0 : l),
                ev = (null == l ? void 0 : l.image) || ex || w.r.Misc.Validator;
              (0, g.X)($),
                (0, y.useEffect)(() => {
                  et(i.creation_height), U(i.balance);
                }, [i]),
                (0, y.useEffect)(() => {
                  eu.option && Q(eu.option), eu.gasPrice && q(eu.gasPrice);
                }, [eu, Q, q]);
              let ef = (0, y.useCallback)(
                  (e, a) => {
                    em(e), ea(a.denom);
                  },
                  [ea]
                ),
                eh = (0, y.useCallback)(() => {
                  er(!1);
                }, []),
                eg = (0, y.useCallback)(() => {
                  k("CANCEL_UNDELEGATION"), t();
                }, [t, k]),
                ep = (0, y.useCallback)(async () => {
                  try {
                    let e = await B(R);
                    z(e, eg, !1, { stdFee: es, feeDenom: eo });
                  } catch (e) {
                    en(e.message),
                      setTimeout(() => {
                        en("");
                      }, 6e3),
                      (0, A.Tb)(e, {
                        tags: {
                          errorType: "stake_v2_transaction_error",
                          source: "stake_v2_review_cancel_unstake_tx",
                          severity: "error",
                          errorName: e instanceof Error ? e.name : "StakeV2TransactionError"
                        },
                        fingerprint: ["stake_v2_review_cancel_unstake_tx", "stake_v2_review_cancel_unstake_tx_error"],
                        level: "error",
                        contexts: { transaction: { type: "stake_v2_review_cancel_unstake_tx", errorMessage: e instanceof Error ? e.message : String(e) } },
                        extra: { chain: R, feeDenom: eo, customFee: es }
                      });
                  }
                }, [es, eo, B, z, en, eg, R]);
              return (
                (0, f.U)(el || $, { activeChain: R, activeNetwork: O }),
                (0, n.jsxs)(d.ZP, {
                  recommendedGasLimit: W,
                  gasLimit: (null == Y ? void 0 : Y.toString()) ?? W,
                  setGasLimit: e => K(Number(e.toString())),
                  gasPriceOption: eu,
                  onGasPriceOptionChange: ef,
                  error: ed,
                  setError: ec,
                  chain: R,
                  network: O,
                  rootBalanceStore: _.jZ,
                  rootDenomsStore: S.gb,
                  children: [
                    (0, n.jsxs)(x.Z, {
                      isOpen: a,
                      onClose: t,
                      title: M.PV.CANCEL_UNDELEGATION,
                      className: "p-6",
                      children: [
                        (0, n.jsxs)("div", {
                          className: "flex flex-col items-center w-full gap-y-4",
                          children: [
                            (0, n.jsx)("span", {
                              className: "text-sm text-foreground",
                              children: "This will reset the unstaking period and stake the tokens back to the validator"
                            }),
                            (0, n.jsx)(E.Z, {
                              title: G(new (r())((null == i ? void 0 : i.currencyBalance) ?? "")),
                              subText: null == i ? void 0 : i.formattedBalance,
                              imgSrc: I.icon
                            }),
                            (0, n.jsx)(E.Z, {
                              title: (0, s.MDB)(
                                null == l ? void 0 : l.moniker,
                                (0, D.oj)() ? 15 + Math.floor(((Math.min(window.innerWidth, 400) - 320) / 81) * 7) : 10,
                                3
                              ),
                              subText: "Validator",
                              imgSrc: ev
                            })
                          ]
                        }),
                        (0, n.jsxs)("div", {
                          className: "flex items-center w-full justify-between mt-5 mb-7",
                          children: [
                            (0, n.jsx)("span", { className: "text-sm text-muted-foreground font-medium", children: "Fees" }),
                            (0, n.jsx)(c.a, { setShowFeesSettingSheet: er })
                          ]
                        }),
                        (0, n.jsxs)("div", {
                          className: "flex flex-col items-center w-full gap-y-2",
                          children: [
                            el && (0, n.jsx)("p", { className: "text-sm font-bold text-destructive-100 px-2", children: el }),
                            $ && (0, n.jsx)("p", { className: "text-sm font-bold text-destructive-100 px-2", children: $ }),
                            ed && !ei && (0, n.jsx)("p", { className: "text-sm font-bold text-destructive-100 px-2", children: ed }),
                            (0, n.jsx)(v.zx, {
                              onClick: ep,
                              className: "w-full",
                              disabled: V || !!$ || !!ed || !!el,
                              "aria-label": "review cancel unstake tx confirm button in stake v2 flow",
                              children: V
                                ? (0, n.jsx)(N(), {
                                    loop: !0,
                                    autoplay: !0,
                                    animationData: b,
                                    rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
                                    className: "h-[24px] w-[24px]"
                                  })
                                : (0, n.jsx)("span", { "aria-label": "review cancel unstake tx confirm button text in stake v2 flow", children: "Confirm" })
                            })
                          ]
                        })
                      ]
                    }),
                    H && (0, n.jsx)(m.Z, { showLedgerPopup: H }),
                    (0, n.jsx)(u.k, { showFeesSettingSheet: ei, onClose: eh, gasError: ed })
                  ]
                })
              );
            });
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    49298: function (e, a, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(a, { Z: () => O });
          var n = t(52322),
            s = t(41172),
            o = t(6391),
            i = t.n(o),
            r = t(58885),
            d = t(51994),
            c = t(80588),
            u = t(42152),
            m = t(96217),
            x = t(6401),
            v = t(30942),
            f = t(65027),
            h = t(30464),
            g = t(63242),
            p = t(75958),
            w = t(2784),
            b = t(10289),
            j = t(48534),
            N = t(92642),
            k = t(63400),
            y = t(91486),
            C = t(13287),
            S = t(49728),
            _ = t(97680),
            D = t.n(_),
            M = t(42799),
            E = t(84994),
            A = t(48346),
            T = t(84601),
            L = t(12499),
            B = t(90258),
            Z = t(78884),
            R = e([f, T, r, A, Z, d, c]);
          [f, T, r, A, Z, d, c] = R.then ? (await R)() : R;
          let F = f.w.useGetWallet,
            O = (0, p.Pi)(e => {
              var a, t;
              let { isOpen: l, onClose: o, validators: f, chainRewards: p, setClaimTxMode: _, forceChain: R, forceNetwork: O } = e,
                P = (0, s.a74)(),
                G = (0, s.obn)(),
                I = R ?? P,
                J = O ?? G,
                H = F(I),
                [z] = (0, x.nB)(),
                V = M.gb.allDenoms,
                $ = T.xO.delegationsForChain(I),
                U = T.fe.validatorsForChain(I),
                W = T.GO.unDelegationsForChain(I),
                Y = T.eq.claimRewardsForChain(I),
                K = (0, S.U)(),
                [q] = (0, s.JsT)(V, I, J),
                { delegations: X, totalRewardsDollarAmt: Q, rewards: ee } = (0, s.nDu)(V, $, U, W, Y, I, J),
                [ea, et] = (0, w.useState)(""),
                el = (0, r.e7)(V, { activeChain: I, selectedNetwork: J }),
                {
                  claimAndStakeRewards: en,
                  loading: es,
                  recommendedGasLimit: eo,
                  userPreferredGasLimit: ei,
                  setUserPreferredGasLimit: er,
                  setUserPreferredGasPrice: ed,
                  gasOption: ec,
                  setGasOption: eu,
                  userPreferredGasPrice: em,
                  setFeeDenom: ex,
                  setMemo: ev,
                  showLedgerPopup: ef,
                  ledgerError: eh,
                  setLedgerError: eg
                } = (0, s.QnK)(V, X, p, Y.refetchDelegatorRewards, et, I, void 0, J),
                [ep, ew] = (0, w.useState)(null),
                [eb, ej] = (0, w.useState)(!1),
                [eN, ek] = (0, w.useState)({ option: ec, gasPrice: em ?? el.gasPrice });
              (0, b.s0)();
              let ey = (0, w.useMemo)(() => {
                  if (ee) {
                    var e;
                    return null === (e = ee.total) || void 0 === e ? void 0 : e.find(e => e.denom === (null == q ? void 0 : q.coinMinimalDenom));
                  }
                }, [null == q ? void 0 : q.coinMinimalDenom, ee]),
                eC = (0, w.useMemo)(() => {
                  if (ee && Object.values(f ?? {}).length)
                    return ee.rewards
                      .filter(e => e.reward.some(e => e.denom === (null == q ? void 0 : q.coinMinimalDenom)) && (null == X ? void 0 : X[e.validator_address]))
                      .map(e => f[e.validator_address]);
                }, [null == q ? void 0 : q.coinMinimalDenom, X, ee, f]),
                { data: eS } = (0, s.pD_)(
                  (null == eC ? void 0 : null === (a = eC[0]) || void 0 === a ? void 0 : a.image) ? void 0 : null == eC ? void 0 : eC[0]
                ),
                e_ = (null == eC ? void 0 : null === (t = eC[0]) || void 0 === t ? void 0 : t.image) || eS || h.r.Misc.Validator;
              (0, v.X)(ea),
                (0, w.useEffect)(() => {
                  let e = !1;
                  if (null == eC ? void 0 : eC.length)
                    for (let t of eC) {
                      var a;
                      if (t && (null === (a = t.custom_attributes) || void 0 === a ? void 0 : a.priority) && t.custom_attributes.priority > 0) {
                        e = !0;
                        break;
                      }
                    }
                  ev(e ? "Staked with Leap Wallet" : "");
                }, [eC, ev]);
              let eD = (0, w.useCallback)(() => {
                  _("CLAIM_AND_DELEGATE"), o();
                }, [o, _]),
                eM = (0, w.useCallback)(async () => {
                  try {
                    let e = await H();
                    await en(e, { success: eD });
                  } catch (e) {
                    eg(e.message),
                      setTimeout(() => {
                        eg("");
                      }, 6e3),
                      (0, N.Tb)(e, {
                        tags: {
                          errorType: "stake_v2_transaction_error",
                          source: "stake_v2_review_claim_and_stake_tx",
                          severity: "error",
                          errorName: e instanceof Error ? e.name : "StakeV2TransactionError"
                        },
                        fingerprint: ["stake_v2_review_claim_and_stake_tx", "stake_v2_review_claim_and_stake_tx_error"],
                        level: "error",
                        contexts: { transaction: { type: "stake_v2_review_claim_and_stake_tx", errorMessage: e instanceof Error ? e.message : String(e) } }
                      });
                  }
                }, [en, H, eg, eD]);
              (0, w.useEffect)(() => {
                eN.option && eu(eN.option), eN.gasPrice && ed(eN.gasPrice);
              }, [eN, eu, ed]);
              let eE = (0, w.useCallback)(
                  (e, a) => {
                    ek(e), ex(a.denom);
                  },
                  [ex]
                ),
                eA = (0, w.useCallback)(() => {
                  ej(!1);
                }, []),
                eT = (0, w.useMemo)(
                  () => E.J.formatHideBalance((0, s.LHZ)((null == ey ? void 0 : ey.amount) ?? "", null == q ? void 0 : q.coinDenom)),
                  [null == q ? void 0 : q.coinDenom, null == ey ? void 0 : ey.amount]
                ),
                eL = (0, w.useMemo)(() => (Q && new (i())(Q).gt(0) ? E.J.formatHideBalance(z(new (i())(Q))) : eT), [z, eT, Q]),
                eB = (0, w.useMemo)(() => (Q && new (i())(Q).gt(0) ? eT : ""), [eT, Q]);
              (0, C.U)(eh || ea, { activeChain: I, activeNetwork: J });
              let eZ = (0, w.useMemo)(() => {
                  var e;
                  let a =
                      eC &&
                      (0, s.MDB)(
                        null === (e = eC[0]) || void 0 === e ? void 0 : e.moniker,
                        j.sN ? 15 + Math.floor(((Math.min(window.innerWidth, 400) - 320) / 81) * 7) : 10,
                        3
                      ),
                    t = eC && (eC.length > 1 ? `+${eC.length - 1} more validators` : "");
                  return { title: a, subText: t, imgSrc: e_, fallbackImgSrc: h.r.Misc.Validator };
                }, [e_, eC]),
                eR = (0, w.useMemo)(() => (0, L.h)(eh), [eh]),
                eF = (0, w.useCallback)(async () => {
                  if (eR) {
                    K();
                    return;
                  }
                  eM();
                }, [eR, eM, K]);
              return (0, n.jsxs)(r.ZP, {
                recommendedGasLimit: eo,
                gasLimit: (null == ei ? void 0 : ei.toString()) ?? eo,
                setGasLimit: e => er(Number(e.toString())),
                gasPriceOption: eN,
                onGasPriceOptionChange: eE,
                error: ep,
                setError: ew,
                chain: I,
                network: J,
                rootBalanceStore: A.jZ,
                rootDenomsStore: M.gb,
                children: [
                  (0, n.jsxs)(m.Z, {
                    isOpen: l,
                    onClose: o,
                    title: (0, n.jsx)("span", { className: "whitespace-nowrap", children: B.PV.CLAIM_AND_DELEGATE }),
                    className: "p-6 mt-4",
                    children: [
                      (0, n.jsxs)("div", {
                        className: "flex flex-col items-center w-full gap-y-4",
                        children: [(0, n.jsx)(Z.Z, { title: eL, subText: eB, imgSrc: null == q ? void 0 : q.icon }), (0, n.jsx)(Z.Z, { ...eZ })]
                      }),
                      (0, n.jsxs)("div", {
                        className: "flex items-center w-full justify-between mt-5 mb-7",
                        children: [
                          (0, n.jsx)("span", { className: "text-sm text-muted-foreground font-medium", children: "Fees" }),
                          (0, n.jsx)(d.a, { setShowFeesSettingSheet: ej })
                        ]
                      }),
                      (0, n.jsxs)("div", {
                        className: "flex flex-col gap-y-2 items-center",
                        children: [
                          !eR && eh && (0, n.jsx)("p", { className: "text-sm font-bold text-destructive-100 px-2", children: eh }),
                          eR && (0, n.jsx)(k.u, {}),
                          ea && (0, n.jsx)("p", { className: "text-sm font-bold text-destructive-100 px-2", children: ea }),
                          ep && !eb && (0, n.jsx)("p", { className: "text-sm font-bold text-destructive-100 px-2", children: ep }),
                          (0, n.jsx)(y.zx, {
                            className: "w-full",
                            disabled: es || !!ea || !!ep || ef || (!eR && !!eh),
                            onClick: eF,
                            "aria-label": "review claim and stake tx confirm button in stake v2 flow",
                            children: eR
                              ? "Connect Ledger"
                              : es
                                ? (0, n.jsx)(D(), {
                                    loop: !0,
                                    autoplay: !0,
                                    animationData: g,
                                    rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
                                    className: "h-[24px] w-[24px]"
                                  })
                                : (0, n.jsx)("span", {
                                    "aria-label": "review claim and stake tx confirm button text in stake v2 flow",
                                    children: "Confirm Claim"
                                  })
                          })
                        ]
                      })
                    ]
                  }),
                  (0, n.jsx)(u.Z, { showLedgerPopup: ef }),
                  (0, n.jsx)(c.k, { showFeesSettingSheet: eb, onClose: eA, gasError: ep })
                ]
              });
            });
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    78884: function (e, a, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(a, { C: () => P, Z: () => O });
          var n = t(52322),
            s = t(41172),
            o = t(6391),
            i = t.n(o),
            r = t(58885),
            d = t(51994),
            c = t(80588),
            u = t(42152),
            m = t(96217),
            x = t(6401),
            v = t(30942),
            f = t(57124),
            h = t(65027),
            g = t(30464),
            p = t(63242),
            w = t(75958),
            b = t(2784),
            j = t(49409),
            N = t(48534),
            k = t(92642),
            y = t(63400),
            C = t(91486),
            S = t(13287),
            _ = t(49728),
            D = t(97680),
            M = t.n(D),
            E = t(42799),
            A = t(84994),
            T = t(48346),
            L = t(84601),
            B = t(12499),
            Z = t(90258),
            R = e([h, L, r, T, d, c]);
          [h, L, r, T, d, c] = R.then ? (await R)() : R;
          let F = h.w.useGetWallet,
            O = e => {
              let a = (0, f.a)();
              return (0, n.jsxs)("div", {
                className: "flex gap-2 items-center justify-between bg-secondary-100 p-6 rounded-xl w-full",
                children: [
                  (0, n.jsxs)("div", {
                    className: "flex flex-col",
                    children: [
                      (0, n.jsx)("span", { className: "text-lg font-bold", children: e.title }),
                      (0, n.jsx)("span", { className: "text-sm text-muted-foreground", children: e.subText })
                    ]
                  }),
                  (0, n.jsx)("img", { src: e.imgSrc, alt: "validator", className: "size-12 rounded-full", onError: (0, j._)(e.fallbackImgSrc ?? a) })
                ]
              });
            },
            P = (0, w.Pi)(e => {
              var a, t;
              let { isOpen: l, onClose: o, validator: f, validators: h, setClaimTxMode: w, forceChain: j, forceNetwork: D } = e,
                R = (0, s.a74)(),
                P = j ?? R,
                G = (0, s.obn)(),
                I = D ?? G,
                J = (0, _.U)(),
                H = F(P),
                z = E.gb.allDenoms,
                V = (0, r.e7)(z, { activeChain: P, selectedNetwork: I }),
                [$] = (0, x.nB)(),
                [U] = (0, s.JsT)(z, P, I),
                W = L.xO.delegationsForChain(P),
                Y = L.fe.validatorsForChain(P),
                K = L.GO.unDelegationsForChain(P),
                q = L.eq.claimRewardsForChain(P),
                { delegations: X, totalRewardsDollarAmt: Q, rewards: ee, totalRewards: ea } = (0, s.nDu)(z, W, Y, K, q, P, I),
                {
                  showLedgerPopup: et,
                  onReviewTransaction: el,
                  isLoading: en,
                  error: es,
                  setAmount: eo,
                  recommendedGasLimit: ei,
                  userPreferredGasLimit: er,
                  setUserPreferredGasLimit: ed,
                  gasOption: ec,
                  setGasOption: eu,
                  userPreferredGasPrice: em,
                  setFeeDenom: ex,
                  ledgerError: ev,
                  setLedgerError: ef,
                  customFee: eh,
                  feeDenom: eg,
                  setUserPreferredGasPrice: ep
                } = (0, s.rKd)(z, "CLAIM_REWARDS", f, void 0, Object.values(X ?? {}), P, I),
                [ew, eb] = (0, b.useState)(!1),
                [ej, eN] = (0, b.useState)(null),
                [ek, ey] = (0, b.useState)({ option: ec, gasPrice: em ?? V.gasPrice }),
                eC = (0, b.useMemo)(() => {
                  if (ee && h) return ee.rewards.filter(e => (null == X ? void 0 : X[e.validator_address])).map(e => h[e.validator_address]);
                }, [X, ee, h]),
                { data: eS } = (0, s.pD_)(
                  (null == eC ? void 0 : null === (a = eC[0]) || void 0 === a ? void 0 : a.image) ? void 0 : null == eC ? void 0 : eC[0]
                ),
                e_ = (null == eC ? void 0 : null === (t = eC[0]) || void 0 === t ? void 0 : t.image) || eS || g.r.Misc.Validator,
                eD = (0, b.useMemo)(() => {
                  if (ee) {
                    var e;
                    return null == ee
                      ? void 0
                      : null === (e = ee.total) || void 0 === e
                        ? void 0
                        : e.find(e => e.denom === (null == U ? void 0 : U.coinMinimalDenom));
                  }
                }, [null == U ? void 0 : U.coinMinimalDenom, ee]);
              (0, v.X)(es),
                (0, b.useEffect)(() => {
                  eo((null == eD ? void 0 : eD.amount) ?? "0");
                }, [ea]),
                (0, b.useEffect)(() => {
                  ek.option && eu(ek.option), ek.gasPrice && ep(ek.gasPrice);
                }, [ek, eu, ep]);
              let eM = (0, b.useCallback)(
                  (e, a) => {
                    ey(e), ex(a.denom);
                  },
                  [ex]
                ),
                eE = (0, b.useCallback)(() => {
                  eb(!1);
                }, []),
                eA = (0, b.useMemo)(
                  () => A.J.formatHideBalance(`${(0, s.LHZ)((null == eD ? void 0 : eD.amount) ?? "", null == U ? void 0 : U.coinDenom)}`),
                  [null == U ? void 0 : U.coinDenom, null == eD ? void 0 : eD.amount]
                ),
                eT = (0, b.useMemo)(() => (Q && new (i())(Q).gt(0) ? A.J.formatHideBalance($(new (i())(Q))) : eA), [$, eA, Q]),
                eL = (0, b.useMemo)(() => (Q && new (i())(Q).gt(0) ? eA : ""), [eA, Q]),
                eB = (0, b.useCallback)(() => {
                  w("CLAIM_REWARDS"), o();
                }, [o, w]),
                eZ = (0, b.useCallback)(async () => {
                  try {
                    let e = await H(P);
                    el(e, eB, !1, { stdFee: eh, feeDenom: eg });
                  } catch (e) {
                    ef(e.message),
                      setTimeout(() => {
                        ef("");
                      }, 6e3),
                      (0, k.Tb)(e, {
                        tags: {
                          errorType: "stake_v2_transaction_error",
                          source: "stake_v2_review_claim_tx",
                          severity: "error",
                          errorName: e instanceof Error ? e.name : "StakeV2TransactionError"
                        },
                        fingerprint: ["stake_v2_review_claim_tx", "stake_v2_review_claim_tx_error"],
                        level: "error",
                        contexts: { transaction: { type: "stake_v2_review_claim_tx", errorMessage: e instanceof Error ? e.message : String(e) } },
                        extra: { chain: P, feeDenom: eg, customFee: eh }
                      });
                  }
                }, [P, eh, eg, H, el, ef, eB]),
                eR = (0, b.useMemo)(() => {
                  var e;
                  let a =
                      eC &&
                      (0, s.MDB)(
                        null === (e = eC[0]) || void 0 === e ? void 0 : e.moniker,
                        N.sN ? 15 + Math.floor(((Math.min(window.innerWidth, 400) - 320) / 81) * 7) : 10,
                        3
                      ),
                    t = eC && (eC.length > 1 ? `+${eC.length - 1} more validators` : "");
                  return { title: a, subText: t, imgSrc: e_ };
                }, [e_, eC]);
              (0, S.U)(ev || es, { activeChain: P, activeNetwork: I });
              let eF = (0, b.useMemo)(() => (0, B.h)(ev), [ev]),
                eO = (0, b.useCallback)(async () => {
                  if (eF) {
                    J();
                    return;
                  }
                  eZ();
                }, [eF, eZ, J]);
              return (0, n.jsxs)(r.ZP, {
                recommendedGasLimit: ei,
                gasLimit: (null == er ? void 0 : er.toString()) ?? ei,
                setGasLimit: e => ed(Number(e.toString())),
                gasPriceOption: ek,
                onGasPriceOptionChange: eM,
                error: ej,
                setError: eN,
                chain: P,
                network: I,
                rootBalanceStore: T.jZ,
                rootDenomsStore: E.gb,
                children: [
                  (0, n.jsxs)(m.Z, {
                    isOpen: l,
                    onClose: o,
                    title: Z.PV.CLAIM_REWARDS,
                    className: "p-6 mt-4",
                    children: [
                      (0, n.jsxs)("div", {
                        className: "flex flex-col items-center w-full gap-y-4",
                        children: [(0, n.jsx)(O, { title: eT, subText: eL, imgSrc: U.icon }), (0, n.jsx)(O, { ...eR })]
                      }),
                      (0, n.jsxs)("div", {
                        className: "flex items-center w-full justify-between mt-5 mb-7",
                        children: [
                          (0, n.jsx)("span", { className: "text-sm text-muted-foreground font-medium", children: "Fees" }),
                          (0, n.jsx)(d.a, { setShowFeesSettingSheet: eb })
                        ]
                      }),
                      (0, n.jsxs)("div", {
                        className: "flex flex-col items-center w-full gap-y-2",
                        children: [
                          !eF && ev && (0, n.jsx)("p", { className: "text-sm font-bold text-destructive-100 px-2", children: ev }),
                          eF && (0, n.jsx)(y.u, {}),
                          es && (0, n.jsx)("p", { className: "text-sm font-bold text-destructive-100 px-2", children: es }),
                          ej && !ew && (0, n.jsx)("p", { className: "text-sm font-bold text-destructive-100 px-2", children: ej }),
                          (0, n.jsx)(C.zx, {
                            className: "w-full",
                            disabled: en || !!es || !!ej || et || (!eF && !!ev),
                            onClick: eO,
                            "aria-label": "review claim tx confirm button in stake v2 flow",
                            children: eF
                              ? "Connect Ledger"
                              : en
                                ? (0, n.jsx)(M(), {
                                    loop: !0,
                                    autoplay: !0,
                                    animationData: p,
                                    rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
                                    className: "h-[24px] w-[24px]"
                                  })
                                : (0, n.jsx)("span", { "aria-label": "review claim tx confirm button text in stake v2 flow", children: "Confirm Claim" })
                          })
                        ]
                      })
                    ]
                  }),
                  (0, n.jsx)(u.Z, { showLedgerPopup: et }),
                  (0, n.jsx)(c.k, { showFeesSettingSheet: ew, onClose: eE, gasError: ej })
                ]
              });
            });
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    30200: function (e, a, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(a, { Z: () => Z });
          var n = t(52322),
            s = t(41172),
            o = t(6391),
            i = t.n(o),
            r = t(58885),
            d = t(51994),
            c = t(80588),
            u = t(42152),
            m = t(96217),
            x = t(6401),
            v = t(30942),
            f = t(57124),
            h = t(65027),
            g = t(30464),
            p = t(63242),
            w = t(97680),
            b = t.n(w),
            j = t(75958),
            N = t(2784),
            k = t(10289),
            y = t(48534),
            C = t(92642),
            S = t(91486),
            _ = t(13287),
            D = t(42799),
            M = t(48346),
            E = t(84601),
            A = t(90258),
            T = t(78884),
            L = e([h, E, r, M, T, d, c]);
          [h, E, r, M, T, d, c] = L.then ? (await L)() : L;
          let B = h.w.useGetWallet,
            Z = (0, j.Pi)(e => {
              let { isOpen: a, onClose: t, validator: l, forceChain: o, forceNetwork: h, selectedDelegation: w, setClaimTxMode: j } = e,
                L = (0, s.a74)(),
                Z = o ?? L,
                R = (0, s.obn)(),
                F = h ?? R,
                O = B(Z),
                P = D.gb.allDenoms,
                G = (0, r.e7)(P, { activeChain: Z, selectedNetwork: F }),
                [I] = (0, x.nB)();
              (0, f.a)();
              let [J] = (0, s.JsT)(P, Z, F),
                H = E.eq.claimRewardsForChain(Z),
                {
                  showLedgerPopup: z,
                  onReviewTransaction: V,
                  isLoading: $,
                  error: U,
                  setAmount: W,
                  recommendedGasLimit: Y,
                  userPreferredGasLimit: K,
                  setUserPreferredGasLimit: q,
                  gasOption: X,
                  setGasOption: Q,
                  userPreferredGasPrice: ee,
                  setFeeDenom: ea,
                  ledgerError: et,
                  setLedgerError: el,
                  customFee: en,
                  feeDenom: es,
                  setUserPreferredGasPrice: eo
                } = (0, s.rKd)(P, "CLAIM_REWARDS", l, void 0, [w], Z, F),
                [ei, er] = (0, N.useState)(!1),
                [ed, ec] = (0, N.useState)(null),
                [eu, em] = (0, N.useState)({ option: X, gasPrice: ee ?? G.gasPrice });
              (0, k.s0)();
              let { data: ex } = (0, s.pD_)((null == l ? void 0 : l.image) ? void 0 : l),
                ev = (null == l ? void 0 : l.image) || ex || g.r.Misc.Validator,
                [ef, eh, eg] = (0, N.useMemo)(() => {
                  var e, a;
                  let t =
                      null == H
                        ? void 0
                        : null === (a = H.rewards) || void 0 === a
                          ? void 0
                          : null === (e = a.rewards) || void 0 === e
                            ? void 0
                            : e[(null == l ? void 0 : l.address) ?? ""],
                    n = null == t ? void 0 : t.reward.reduce((e, a) => e.plus(new (i())(a.currencyAmount ?? "")), new (i())(0)),
                    o = null == t ? void 0 : t.reward.find(e => e.denom === (null == J ? void 0 : J.coinMinimalDenom)),
                    r = (0, s.LHZ)((null == o ? void 0 : o.amount) ?? "", null == J ? void 0 : J.coinDenom),
                    d = null == t ? void 0 : t.reward.reduce((e, a) => e.plus(new (i())(a.amount)), new (i())(0));
                  return [n, r, d];
                }, [J, H, l]);
              (0, v.X)(U),
                (0, N.useEffect)(() => {
                  W((null == eg ? void 0 : eg.toString()) ?? "0");
                }, [eg]),
                (0, N.useEffect)(() => {
                  eu.option && Q(eu.option), eu.gasPrice && eo(eu.gasPrice);
                }, [eu, Q, eo]);
              let ep = (0, N.useCallback)(
                  (e, a) => {
                    em(e), ea(a.denom);
                  },
                  [ea]
                ),
                ew = (0, N.useCallback)(() => {
                  er(!1);
                }, []),
                eb = (0, N.useCallback)(() => {
                  j("CLAIM_REWARDS"), t();
                }, [j, t]),
                ej = (0, N.useCallback)(async () => {
                  try {
                    let e = await O(Z);
                    V(e, eb, !1, { stdFee: en, feeDenom: es });
                  } catch (e) {
                    el(e.message),
                      setTimeout(() => {
                        el("");
                      }, 6e3),
                      (0, C.Tb)(e, {
                        tags: {
                          errorType: "stake_v2_transaction_error",
                          source: "stake_v2_review_validator_claim_tx",
                          severity: "error",
                          errorName: e instanceof Error ? e.name : "StakeV2TransactionError"
                        },
                        fingerprint: ["stake_v2_review_validator_claim_tx", "stake_v2_review_validator_claim_tx_error"],
                        level: "error",
                        contexts: { transaction: { type: "stake_v2_review_validator_claim_tx", errorMessage: e instanceof Error ? e.message : String(e) } },
                        extra: { chain: Z, feeDenom: es, customFee: en }
                      });
                  }
                }, [Z, en, es, O, V, el, eb]);
              return (
                (0, _.U)(et || U, { activeChain: Z, activeNetwork: F }),
                (0, n.jsxs)(r.ZP, {
                  recommendedGasLimit: Y,
                  gasLimit: (null == K ? void 0 : K.toString()) ?? Y,
                  setGasLimit: e => q(Number(e.toString())),
                  gasPriceOption: eu,
                  onGasPriceOptionChange: ep,
                  error: ed,
                  setError: ec,
                  chain: Z,
                  network: F,
                  rootBalanceStore: M.jZ,
                  rootDenomsStore: D.gb,
                  children: [
                    (0, n.jsxs)(m.Z, {
                      isOpen: a,
                      onClose: t,
                      title: A.PV.CLAIM_REWARDS,
                      className: "p-6 mt-4",
                      children: [
                        (0, n.jsxs)("div", {
                          className: "flex flex-col items-center w-full gap-y-4",
                          children: [
                            (0, n.jsx)(T.Z, { title: I(ef ?? new (i())("")), subText: eh, imgSrc: J.icon }),
                            (0, n.jsx)(T.Z, {
                              title: l && (0, s.MDB)(l.moniker, (0, y.oj)() ? 15 + Math.floor(((Math.min(window.innerWidth, 400) - 320) / 81) * 7) : 10, 3),
                              imgSrc: ev
                            })
                          ]
                        }),
                        (0, n.jsxs)("div", {
                          className: "flex items-center w-full justify-between mt-5 mb-7",
                          children: [
                            (0, n.jsx)("span", { className: "text-sm text-muted-foreground font-medium", children: "Fees" }),
                            (0, n.jsx)(d.a, { setShowFeesSettingSheet: er })
                          ]
                        }),
                        (0, n.jsxs)("div", {
                          className: "flex flex-col items-center w-full gap-y-2",
                          children: [
                            et && (0, n.jsx)("p", { className: "text-sm font-bold text-destructive-100 px-2", children: et }),
                            U && (0, n.jsx)("p", { className: "text-sm font-bold text-destructive-100 px-2", children: U }),
                            ed && !ei && (0, n.jsx)("p", { className: "text-sm font-bold text-destructive-100 px-2", children: ed }),
                            (0, n.jsx)(S.zx, {
                              className: "w-full",
                              disabled: $ || !!U || !!ed || z || !!et,
                              onClick: ej,
                              "aria-label": "review validator claim tx confirm button in stake v2 flow",
                              children: $
                                ? (0, n.jsx)(b(), {
                                    loop: !0,
                                    autoplay: !0,
                                    animationData: p,
                                    rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
                                    className: "h-[24px] w-[24px]"
                                  })
                                : (0, n.jsx)("span", {
                                    "aria-label": "review validator claim tx confirm button text in stake v2 flow",
                                    children: "Confirm Claim"
                                  })
                            })
                          ]
                        })
                      ]
                    }),
                    z && (0, n.jsx)(u.Z, { showLedgerPopup: z }),
                    (0, n.jsx)(c.k, { showFeesSettingSheet: ei, onClose: ew, gasError: ed })
                  ]
                })
              );
            });
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    68708: function (e, a, t) {
      t.d(a, { F: () => g, Z: () => p });
      var l = t(52322),
        n = t(41172),
        s = t(75377),
        o = t(26007),
        i = t(14281),
        r = t(23751),
        d = t(69816),
        c = t(26571),
        u = t(96128),
        m = t.n(u),
        x = t(29750),
        v = t(24542),
        f = t.n(v);
      t(2784);
      var h = t(49409);
      function g(e) {
        let { provider: a, backgroundColor: t, rootDenomsStore: i, activeChain: r, activeNetwork: u } = e,
          [v] = (0, n.JsT)(i.allDenoms, r, u);
        return (0, l.jsx)(s.GenericCard, {
          onClick: () => {
            window.open(a.url, "_blank"),
              f().track(c.B_.ButtonClick, { buttonType: "stake", buttonName: "liquid staking redirection", redirectURL: a.url, stakeToken: v.coinDenom });
          },
          className: `${t} w-full`,
          img: (0, l.jsx)("img", { src: a.image ?? x.GenericLight, onError: (0, h._)(x.GenericLight), width: 30, height: 30, className: "rounded-full mr-4" }),
          isRounded: !0,
          size: "md",
          title: (0, l.jsx)(d.Z, { size: "sm", color: "text-black-100 dark:text-white-100", className: "font-bold overflow-hidden", children: a.name }),
          subtitle: (0, l.jsx)(d.Z, {
            size: "xs",
            color: "dark:text-gray-400 text-gray-600",
            className: "font-medium",
            children: a.apy ? `APY ${m()((100 * a.apy).toString(), { precision: 2, symbol: "" }).format()}%` : "N/A"
          }),
          icon: (0, l.jsx)(o.O, { size: 16, weight: "bold", className: "dark:text-white-100 text-black-100" })
        });
      }
      function p(e) {
        let { isVisible: a, onClose: t, providers: n, rootDenomsStore: s, forceChain: o, forceNetwork: d } = e;
        return (0, l.jsx)(i.Z, {
          isOpen: a,
          onClose: t,
          closeOnBackdropClick: !0,
          title: "Select Provider",
          className: "p-6",
          children: (0, l.jsxs)("div", {
            className: "flex flex-col gap-y-4",
            children: [
              0 === n.length && (0, l.jsx)(r.KE, {}),
              n.length > 0 &&
                n.map(e =>
                  (0, l.jsxs)(
                    "div",
                    {
                      className: "relative",
                      children: [
                        e.priority &&
                          (0, l.jsx)("div", {
                            className:
                              "text-white-100 dark:text-white-100 absolute top-0 right-4 px-1.5 py-0.5 bg-green-600 rounded-b-[4px] text-[10px] font-bold",
                            children: "Promoted"
                          }),
                        (0, l.jsx)(g, {
                          provider: e,
                          backgroundColor: `${e.priority ? "!bg-[#29A87426]" : "bg-white-100 dark:bg-gray-950"}`,
                          rootDenomsStore: s,
                          activeChain: o,
                          activeNetwork: d
                        })
                      ]
                    },
                    e.name
                  )
                )
            ]
          })
        });
      }
    },
    86798: function (e, a, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(a, { Z: () => y });
          var n = t(52322),
            s = t(41172),
            o = t(44658),
            i = t(6391),
            r = t.n(i),
            d = t(91486),
            c = t(14981),
            u = t(4370),
            m = t(6401),
            x = t(75958),
            v = t(2784),
            f = t(86874),
            h = t(10289),
            g = t(42799),
            p = t(84994),
            w = t(84601),
            b = t(70514),
            j = t(46338),
            N = e([w]);
          w = (N.then ? (await N)() : N)[0];
          let k = e =>
              (0, n.jsxs)("div", {
                className: "flex flex-col gap-2",
                children: [
                  (0, n.jsx)("span", { className: "text-xs text-muted-foreground", children: e.title }),
                  (0, n.jsx)(c.M, {
                    mode: "wait",
                    children: e.loading
                      ? (0, n.jsx)(
                          u.E.div,
                          {
                            className: "h-[1.875rem] flex flex-col justify-end",
                            transition: j._M,
                            variants: j.K0,
                            initial: "hidden",
                            animate: "visible",
                            exit: "hidden",
                            children: (0, n.jsx)(f.Z, { className: "w-24 h-5 grow-0" })
                          },
                          "loading"
                        )
                      : (0, n.jsx)(
                          u.E.span,
                          {
                            className: "flex gap-1 items-baseline",
                            transition: j._M,
                            variants: j.K0,
                            initial: "hidden",
                            animate: "visible",
                            exit: "hidden",
                            children: e.children
                          },
                          "loaded"
                        )
                  })
                ]
              }),
            y = (0, x.Pi)(e => {
              var a, t, l;
              let { onClaim: i, forceChain: c, forceNetwork: u } = e,
                x = (0, s.a74)(),
                f = c ?? x,
                j = (0, s.obn)(),
                N = u ?? j,
                y = g.gb.allDenoms,
                C = w.xO.delegationsForChain(f),
                S = w.fe.validatorsForChain(f),
                _ = w.GO.unDelegationsForChain(f),
                D = w.eq.claimRewardsForChain(f),
                [M] = (0, s.JsT)(y, f, N),
                {
                  totalRewardsDollarAmt: E,
                  loadingDelegations: A,
                  currencyAmountDelegation: T,
                  totalDelegationAmount: L,
                  loadingRewards: B,
                  totalRewards: Z,
                  rewards: R
                } = (0, s.nDu)(y, C, S, _, D, f, N),
                [F] = (0, m.nB)(),
                O = (0, s.rTu)(),
                P = (0, h.s0)(),
                G = (0, v.useMemo)(() => {
                  if (T && new (r())(T).gt(0)) return F(new (r())(T));
                }, [T, F]),
                I = (0, v.useMemo)(() => {
                  if ("evmos" === f && (null == O ? void 0 : O.walletType) === o._K.LEDGER) return !0;
                  if ("celestia" === f) {
                    var e, a;
                    return (
                      (null == D ? void 0 : null === (a = D.rewards) || void 0 === a ? void 0 : null === (e = a.result) || void 0 === e ? void 0 : e.rewards) ??
                      []
                    )
                      .reduce((e, a) => {
                        var t, l;
                        if (
                          !(null == C
                            ? void 0
                            : null === (l = C.delegationInfo) || void 0 === l
                              ? void 0
                              : null === (t = l.delegations) || void 0 === t
                                ? void 0
                                : t[a.validator_address])
                        )
                          return e;
                        let n = a.reward.find(e => e.denom === (null == M ? void 0 : M.coinMinimalDenom));
                        return n ? new (r())(n.amount).plus(e) : e;
                      }, new (r())(0))
                      .lt(1e-5);
                  }
                  return !Z || new (r())(Z).lt(1e-5);
                }, [
                  f,
                  null == M ? void 0 : M.coinMinimalDenom,
                  null == O ? void 0 : O.walletType,
                  null == D ? void 0 : null === (t = D.rewards) || void 0 === t ? void 0 : null === (a = t.result) || void 0 === a ? void 0 : a.rewards,
                  null == C ? void 0 : null === (l = C.delegationInfo) || void 0 === l ? void 0 : l.delegations,
                  Z
                ]),
                J = (0, v.useMemo)(() => {
                  var e, a;
                  let t =
                    null == R ? void 0 : null === (e = R.total) || void 0 === e ? void 0 : e.find(e => e.denom === (null == M ? void 0 : M.coinMinimalDenom));
                  return E && new (r())(E).gt(0)
                    ? p.J.formatHideBalance(F(new (r())(E)))
                    : (null == R || null === (a = R.total) || void 0 === a || a.length,
                      p.J.formatHideBalance(`${(0, s.LHZ)((null == t ? void 0 : t.amount) ?? "", null == M ? void 0 : M.coinDenom)}`));
                }, [M, F, R, E]);
              return (0, n.jsxs)("div", {
                className: "flex flex-col w-full bg-secondary-100 rounded-2xl p-5 gap-y-6",
                children: [
                  (0, n.jsxs)("div", {
                    className: "flex gap-x-2 [&>*]:flex-1",
                    children: [
                      (0, n.jsx)(k, {
                        title: "Deposited Amount",
                        loading: A,
                        children: (0, n.jsxs)("div", {
                          className: "flex flex-col",
                          children: [
                            (0, n.jsx)("span", { className: "font-bold text-[18px]", children: G && p.J.formatHideBalance(G) }),
                            (0, n.jsxs)("span", { className: "text-sm text-muted-foreground", children: ["(", p.J.formatHideBalance(L ?? "-"), ")"] })
                          ]
                        })
                      }),
                      (0, n.jsx)(k, {
                        title: "Total Earnings",
                        loading: B,
                        children: (0, n.jsx)("span", { className: (0, b.cn)("font-bold text-[18px]", J && "text-accent-success"), children: J || "-" })
                      })
                    ]
                  }),
                  (0, n.jsxs)("div", {
                    className: "flex gap-x-4 [&>*]:flex-1",
                    children: [
                      (0, n.jsx)(d.zx, {
                        size: "md",
                        onClick: () => {
                          let e = { mode: "DELEGATE", forceChain: f, forceNetwork: N };
                          sessionStorage.setItem("navigate-stake-input-state", JSON.stringify(e)), P("/stake/input", { state: e });
                        },
                        "aria-label": "stake amount card stake button in stake v2 flow",
                        children: (0, n.jsx)("span", { "aria-label": "stake amount card stake button text in stake v2 flow", children: "Stake" })
                      }),
                      (0, n.jsx)(d.zx, {
                        variant: "secondary",
                        size: "md",
                        className: "bg-secondary-350 disabled:bg-secondary-350 hover:bg-secondary-300",
                        onClick: i,
                        disabled: I,
                        "aria-label": "stake amount card claim button in stake v2 flow",
                        children: (0, n.jsx)("span", { "aria-label": "stake amount card claim button text in stake v2 flow", children: "Claim" })
                      })
                    ]
                  })
                ]
              });
            });
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    46078: function (e, a, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(a, { Z: () => b });
          var n = t(52322),
            s = t(41172),
            o = t(96128),
            i = t.n(o),
            r = t(14981),
            d = t(4370),
            c = t(72059),
            u = t(57124),
            m = t(75958),
            x = t(2784),
            v = t(86874),
            f = t(42799),
            h = t(84601),
            g = t(49409),
            p = t(46338),
            w = e([c, h]);
          [c, h] = w.then ? (await w)() : w;
          let b = (0, m.Pi)(e => {
            let { forceChain: a, forceNetwork: t } = e,
              l = (0, c.a7)(),
              o = (0, s.obn)(),
              m = a ?? l,
              w = (0, u.a)(),
              b = (0, s.QSC)(m),
              j = f.gb.allDenoms,
              N = h.xO.delegationsForChain(m),
              k = h.fe.validatorsForChain(m),
              y = h.GO.unDelegationsForChain(m),
              C = h.eq.claimRewardsForChain(m),
              { network: S, loadingNetwork: _ } = (0, s.nDu)(j, N, k, y, C, m, t ?? o),
              D = (0, x.useMemo)(() => {
                if (null == S ? void 0 : S.chainApr) return i()(((null == S ? void 0 : S.chainApr) * 100).toString(), { precision: 2, symbol: "" }).format();
              }, [null == S ? void 0 : S.chainApr]);
            return (0, n.jsxs)("div", {
              className: "flex justify-between w-full items-center",
              children: [
                (0, n.jsxs)("div", {
                  className: "flex gap-x-2 items-center",
                  children: [
                    (0, n.jsx)("img", {
                      width: 24,
                      height: 24,
                      src: b.chainSymbolImageUrl ?? w,
                      onError: (0, g._)(w),
                      className: "size-6 bg-secondary-300 rounded-full"
                    }),
                    (0, n.jsx)("span", { className: "font-medium text-lg", children: b.chainName })
                  ]
                }),
                (0, n.jsx)(r.M, {
                  mode: "wait",
                  children:
                    (null == S ? void 0 : S.chainApr) === void 0
                      ? (0, n.jsx)(
                          d.E.div,
                          {
                            transition: p._M,
                            variants: p.K0,
                            initial: "hidden",
                            animate: "visible",
                            exit: "hidden",
                            children: (0, n.jsx)(v.Z, { className: "w-20 h-5" })
                          },
                          "skeleton"
                        )
                      : (0, n.jsx)(
                          d.E.span,
                          {
                            transition: p._M,
                            variants: p.K0,
                            initial: "hidden",
                            animate: "visible",
                            exit: "hidden",
                            className: "font-medium text-muted-foreground",
                            children: D && `APR ${D}%`
                          },
                          "span"
                        )
                })
              ]
            });
          });
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    13906: function (e, a, t) {
      t.d(a, { h: () => s });
      var l = t(52322),
        n = t(26091);
      function s(e) {
        let { tokenName: a, chainName: t, chainLogo: s, apr: o, amount: i, dollarAmount: r, onClick: d } = e;
        return (0, l.jsxs)("div", {
          className: "bg-secondary-100 hover:bg-secondary-200 rounded-xl flex items-center justify-between px-4 py-3 cursor-pointer",
          onClick: d,
          "aria-label": "stake token card in stake v2 flow",
          children: [
            (0, l.jsxs)("div", {
              className: "flex items-center justify-start gap-2 w-[150px]",
              children: [
                (0, l.jsx)(n.m, {
                  assetImg: s,
                  text: a,
                  altText: t + " logo",
                  imageClassName: "w-[36px] h-[36px]",
                  containerClassName: "w-[36px] h-[36px] rounded-full bg-gray-100 dark:bg-gray-850",
                  textClassName: "text-[10px] !leading-[14px]"
                }),
                (0, l.jsxs)("div", {
                  className: "flex flex-col",
                  children: [
                    (0, l.jsx)("p", { className: "text-black-100 dark:text-white-100 font-[700]", children: a }),
                    (0, l.jsx)("p", { className: "text-gray-600 dark:text-gray-400 text-[12px] font-[500]", children: t })
                  ]
                })
              ]
            }),
            (0, l.jsx)("p", { className: "text-black-100 dark:text-white-100 text-[14px]", children: o }),
            (0, l.jsxs)("div", {
              className: "flex flex-col items-end w-[90px]",
              children: [
                "-" !== r ? (0, l.jsx)("p", { className: "text-black-100 dark:text-white-100 font-[700] text-[14px] text-right", children: r }) : null,
                (0, l.jsx)("p", { className: "text-gray-600 dark:text-gray-400 text-[12px] font-[500] text-right", children: i })
              ]
            })
          ]
        });
      }
      t(2784);
    },
    29816: function (e, a, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(a, { Z: () => v });
          var n = t(52322),
            s = t(27963),
            o = t(74229),
            i = t(72059),
            r = t(30464),
            d = t(75958);
          t(2784);
          var c = t(10289),
            u = t(84335),
            m = t(46078),
            x = e([i, m]);
          [i, m] = x.then ? (await x)() : x;
          let v = (0, d.Pi)(e => {
            let { isStakeNotSupported: a, isStakeComingSoon: t } = e,
              l = (0, c.s0)(),
              { activeWallet: d } = (0, o.vL)(),
              x = (0, i.a7)();
            return d
              ? (0, n.jsx)("div", {
                  className: "relative w-full overflow-clip panel-height",
                  children: (0, n.jsxs)("div", {
                    className: "flex flex-col gap-y-6 p-6 mb-10 overflow-scroll",
                    children: [
                      (0, n.jsx)(m.Z, {}),
                      a
                        ? (0, n.jsx)(u.Z, {
                            title: "Staking unavailable",
                            subtitle: `Staking is not yet available for ${x}. You can stake on other chains in the meantime.`,
                            buttonText: "Stake on a different chain",
                            onClick: () => l("/home")
                          })
                        : t
                          ? (0, n.jsx)(u.Z, {
                              title: "Coming soon!",
                              subtitle: `Staking for ${x} is coming soon! Devs are hard at work. Stay tuned!`,
                              buttonText: "Stake on a different chain",
                              onClick: () => l("/home")
                            })
                          : void 0
                    ]
                  })
                })
              : (0, n.jsx)("div", {
                  className: "relative w-full overflow-clip panel-height flex justify-center items-center",
                  children: (0, n.jsx)(s.S, { src: r.r.Logos.LeapCosmos, heading: "No wallet found", logoClassName: "size-14" })
                });
          });
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    46798: function (e, a, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(a, { Z: () => j });
          var n = t(52322),
            s = t(41172),
            o = t(14981),
            i = t(4370),
            r = t(75958),
            d = t(5833),
            c = t(2784),
            u = t(42799),
            m = t(34733),
            x = t(48346),
            v = t(84601),
            f = t(46338),
            h = t(43963),
            g = t(14048),
            p = t(94991),
            w = t(25053),
            b = e([p, g, v, x]);
          [p, g, v, x] = b.then ? (await b)() : b;
          let j = (0, r.Pi)(e => {
            var a;
            let { forceChain: t, forceNetwork: l, setClaimTxMode: r } = e,
              b = (0, s.a74)(),
              j = (0, s.obn)(),
              N = t ?? b,
              k = l ?? j,
              y = u.gb.allDenoms,
              C = v.xO.delegationsForChain(N),
              S = v.fe.validatorsForChain(N),
              _ = v.GO.unDelegationsForChain(N),
              D = v.eq.claimRewardsForChain(N),
              { delegations: M, unboundingDelegationsInfo: E, loadingDelegations: A, loadingUnboundingDelegations: T } = (0, s.nDu)(y, C, S, _, D, N, k),
              { delegations: L } = (0, s.fHb)(),
              [B] = (0, s.JsT)(y, N, k),
              [Z, R] = (0, c.useState)(),
              { data: F } = (0, s.S2A)(),
              O = (0, c.useMemo)(() => {
                var e;
                let a = m.b.getDelegationEpochMessages(B),
                  t = m.b.getUnDelegationEpochMessages(B),
                  l = [];
                return (
                  (Object.values(M ?? {}).length > 0 || a.length > 0) && l.push({ label: "Your delegations" }),
                  Object.values(L ?? {}).length > 0 &&
                    (null == F ? void 0 : null === (e = F.restaking) || void 0 === e ? void 0 : e.extension) === "active" &&
                    "lava" === N &&
                    l.push({ label: "Your providers" }),
                  (Object.values(E ?? {}).length > 0 || t.length > 0) && l.push({ label: "Pending unstake" }),
                  l.length > 0 && R(l[0]),
                  l
                );
              }, [N, B, M, null == F ? void 0 : null === (a = F.restaking) || void 0 === a ? void 0 : a.extension, L, E]);
            return A || T
              ? (0, n.jsx)(n.Fragment, {})
              : (0, n.jsxs)("div", {
                  className: "flex flex-col gap-6",
                  children: [
                    (0, n.jsx)("div", {
                      className: "flex gap-x-2 border-b border-border-bottom -mx-6 px-6",
                      children: (0, n.jsx)(w.z, {
                        buttons: O,
                        setSelectedTab: R,
                        selectedIndex: O.findIndex(e => {
                          let { label: a } = e;
                          return a === (null == Z ? void 0 : Z.label);
                        })
                      })
                    }),
                    (0, n.jsxs)(o.M, {
                      mode: "wait",
                      initial: !1,
                      children: [
                        (null == Z ? void 0 : Z.label) === "Your delegations" &&
                          (0, n.jsx)(
                            i.E.div,
                            {
                              transition: f._M,
                              variants: h.dJ,
                              initial: "exit",
                              animate: "animate",
                              exit: "exit",
                              className: "relative",
                              children: (0, n.jsx)(p.Z, {
                                rootDenomsStore: u.gb,
                                rootBalanceStore: x.jZ,
                                delegationsStore: v.xO,
                                validatorsStore: v.fe,
                                unDelegationsStore: v.GO,
                                claimRewardsStore: v.eq,
                                forceChain: N,
                                forceNetwork: k,
                                setClaimTxMode: r
                              })
                            },
                            "Your delegations"
                          ),
                        (null == Z ? void 0 : Z.label) === "Pending unstake" &&
                          (0, n.jsx)(
                            i.E.div,
                            {
                              transition: f._M,
                              variants: h.dJ,
                              initial: "enter",
                              animate: "animate",
                              exit: "enter",
                              className: "relative",
                              children: (0, n.jsx)(g.Z, {
                                rootDenomsStore: u.gb,
                                delegationsStore: v.xO,
                                validatorsStore: v.fe,
                                unDelegationsStore: v.GO,
                                claimRewardsStore: v.eq,
                                forceChain: N,
                                forceNetwork: k,
                                rootBalanceStore: x.jZ,
                                setClaimTxMode: r
                              })
                            },
                            "Pending unstake"
                          ),
                        (null == Z ? void 0 : Z.label) === "Your providers" && (0, n.jsx)(d.Z, { forceChain: N, forceNetwork: k })
                      ]
                    })
                  ]
                });
          });
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    25053: function (e, a, t) {
      t.d(a, { z: () => c });
      var l = t(52322),
        n = t(91486),
        s = t(65903),
        o = t(2784),
        i = t(70514);
      let r = (0, o.forwardRef)((e, a) =>
        (0, l.jsx)("button", {
          ref: a,
          className: (0, i.cn)(
            "text-sm font-medium text-foreground transition-colors capitalize pb-3.5 rounded-full",
            n.YV,
            e.active ? "text-accent-green" : "text-secondary-700 hover:text-foreground",
            e.className
          ),
          onClick: e.onClick,
          "aria-label": `tab button in stake v2 flow ${e.children}`,
          children: (0, l.jsx)("span", { "aria-label": `tab button text in stake v2 flow ${e.children}`, children: e.children })
        })
      );
      r.displayName = "TabButton";
      let d = { transform: "translateX(0px) scaleX(0.441654)" },
        c = e => {
          var a;
          let { setSelectedTab: t, selectedIndex: n, buttons: o, buttonClassName: c, className: u, indicatorDefaultScale: m } = e,
            { containerRef: x, indicatorRef: v, childRefs: f } = (0, s.r)({ navItems: o, activeLabel: null === (a = o[n]) || void 0 === a ? void 0 : a.label });
          return (0, l.jsxs)("div", {
            ref: x,
            className: (0, i.cn)("relative flex items-center isolate gap-7", u),
            children: [
              o.map((e, a) =>
                (0, l.jsx)(
                  r,
                  {
                    ref: e => f.current.set(a, e),
                    active: a === n,
                    onClick: () => t(e),
                    className: c,
                    "aria-label": `tab button in stake v2 flow ${e.label}`,
                    children: (0, l.jsx)("span", { "aria-label": `tab button text in stake v2 flow ${e.label}`, children: e.label })
                  },
                  e.id ?? e.label
                )
              ),
              (0, l.jsx)("div", {
                className:
                  "absolute bottom-0 h-0.5 origin-left scale-0 translate-x-3 transition-transform duration-200 w-full rounded-[50vmin/10vmin] z-10 bg-accent-green",
                ref: v,
                style: m ?? d
              })
            ]
          });
        };
      c.displayName = "TabSelectors";
    },
    25550: function (e, a, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(a, { Z: () => y });
          var n = t(52322),
            s = t(41172),
            o = t(75377),
            i = t(6391),
            r = t.n(i),
            d = t(96217),
            c = t(91486),
            u = t(96128),
            m = t.n(u),
            x = t(6401),
            v = t(30464),
            f = t(75958),
            h = t(2784),
            g = t(34733),
            p = t(84994),
            w = t(49409),
            b = t(48534),
            j = t(94629),
            N = t(90139),
            k = e([N]);
          N = (k.then ? (await k)() : k)[0];
          let y = (0, f.Pi)(e => {
            var a, t, l, i, u, f;
            let {
                isOpen: k,
                onClose: y,
                validator: C,
                unbondingDelegation: S,
                unbondingDelegationEntry: _,
                rootDenomsStore: D,
                delegationsStore: M,
                validatorsStore: E,
                unDelegationsStore: A,
                claimRewardsStore: T,
                rootBalanceStore: L,
                forceChain: B,
                forceNetwork: Z,
                setClaimTxMode: R
              } = e,
              F = (0, s.a74)(),
              O = (0, h.useMemo)(() => B || F, [F, B]),
              P = (0, s.obn)(),
              G = (0, h.useMemo)(() => Z || P, [P, Z]),
              I = D.allDenoms,
              J = M.delegationsForChain(O),
              H = E.validatorsForChain(O),
              z = A.unDelegationsForChain(O),
              V = T.claimRewardsForChain(O),
              [$] = (0, s.JsT)(I, O, G),
              [U] = (0, x.nB)(),
              { theme: W } = (0, o.useTheme)(),
              [Y, K] = (0, h.useState)(!1),
              { network: q } = (0, s.nDu)(I, J, H, z, V, O, G),
              X = null == q ? void 0 : q.validatorAprs,
              { data: Q } = (0, s.pD_)((null == C ? void 0 : C.image) ? void 0 : C),
              ee = (null == C ? void 0 : C.image) || Q || v.r.Misc.Validator,
              ea = (0, h.useMemo)(
                () =>
                  new (r())((null == _ ? void 0 : _.currencyBalance) ?? "").gt(0)
                    ? p.J.formatHideBalance(U(new (r())((null == _ ? void 0 : _.currencyBalance) ?? "")))
                    : p.J.formatHideBalance((null == _ ? void 0 : _.formattedBalance) ?? ""),
                [U, null == _ ? void 0 : _.currencyBalance, null == _ ? void 0 : _.formattedBalance]
              ),
              et = (0, h.useMemo)(
                () =>
                  new (r())((null == _ ? void 0 : _.currencyBalance) ?? "").gt(0) ? p.J.formatHideBalance((null == _ ? void 0 : _.formattedBalance) ?? "") : "",
                [null == _ ? void 0 : _.currencyBalance, null == _ ? void 0 : _.formattedBalance]
              ),
              el =
                S &&
                _ &&
                (null === (a = g.b.canceledUnBondingDelegationsMap[S.validator_address]) || void 0 === a ? void 0 : a.some(e => e === _.creation_height));
            return (0, n.jsxs)(n.Fragment, {
              children: [
                (0, n.jsxs)(d.Z, {
                  isOpen: k,
                  onClose: y,
                  fullScreen: !0,
                  title: "Validator Details",
                  className: "!p-0 relative h-full",
                  headerClassName: "border-secondary-200 border-b",
                  children: [
                    (0, n.jsxs)("div", {
                      className: "p-6 pt-8 px-6 flex flex-col gap-4 h-[calc(100%-84px)] overflow-y-scroll",
                      children: [
                        (0, n.jsxs)("div", {
                          className: "flex w-full gap-4 items-center",
                          children: [
                            (0, n.jsx)("img", {
                              width: 40,
                              height: 40,
                              className: "rounded-full",
                              src: ee,
                              onError: (0, w._)(v.r.Misc.Validator),
                              "aria-label": "unstaked validator details image in stake v2 flow"
                            }),
                            (0, n.jsx)("span", {
                              className: "font-bold text-lg",
                              "aria-label": "unstaked validator details name in stake v2 flow",
                              children: (0, s.MDB)(
                                (null == C ? void 0 : C.moniker) ?? "",
                                (0, b.oj)() ? 18 + Math.floor(((Math.min(window.innerWidth, 400) - 320) / 81) * 7) : 10,
                                3
                              )
                            })
                          ]
                        }),
                        (0, n.jsxs)("div", {
                          className: "flex flex-col gap-4 p-6 bg-secondary-100 rounded-xl",
                          children: [
                            (0, n.jsxs)("div", {
                              className: "flex items-center justify-between",
                              children: [
                                (0, n.jsx)("span", {
                                  className: "text-sm text-muted-foreground",
                                  "aria-label": "unstaked validator details total staked in stake v2 flow",
                                  children: "Total Staked"
                                }),
                                (0, n.jsx)("span", {
                                  className: "font-bold text-sm",
                                  "aria-label": "unstaked validator details total staked amount in stake v2 flow",
                                  children: m()(
                                    (null == C ? void 0 : null === (t = C.delegations) || void 0 === t ? void 0 : t.total_tokens_display) ??
                                      (null == C ? void 0 : C.tokens) ??
                                      "",
                                    { symbol: "", precision: 0 }
                                  ).format()
                                })
                              ]
                            }),
                            (0, n.jsxs)("div", {
                              className: "flex items-center justify-between",
                              children: [
                                (0, n.jsx)("span", { className: "text-sm text-muted-foreground", children: "Commission" }),
                                (0, n.jsx)("span", {
                                  className: "font-bold text-sm",
                                  children: (
                                    null == C
                                      ? void 0
                                      : null === (i = C.commission) || void 0 === i
                                        ? void 0
                                        : null === (l = i.commission_rates) || void 0 === l
                                          ? void 0
                                          : l.rate
                                  )
                                    ? `${new (r())((null == C ? void 0 : null === (f = C.commission) || void 0 === f ? void 0 : null === (u = f.commission_rates) || void 0 === u ? void 0 : u.rate) ?? "").multipliedBy(100).toFixed(0)}%`
                                    : "N/A"
                                })
                              ]
                            }),
                            (0, n.jsxs)("div", {
                              className: "flex items-center justify-between",
                              children: [
                                (0, n.jsx)("span", { className: "text-sm text-muted-foreground", children: "APR" }),
                                (0, n.jsx)("span", {
                                  className: "font-bold text-sm text-accent-success",
                                  children:
                                    X &&
                                    (X[(null == C ? void 0 : C.address) ?? ""]
                                      ? `${m()(100 * X[(null == C ? void 0 : C.address) ?? ""], { precision: 2, symbol: "" }).format()}%`
                                      : "N/A")
                                })
                              ]
                            })
                          ]
                        }),
                        (0, n.jsx)("span", { className: "text-sm text-muted-foreground mt-4", children: "Pending Unstake" }),
                        (0, n.jsxs)("div", {
                          className: "p-6 bg-secondary-100 rounded-xl flex justify-between items-center",
                          children: [
                            (0, n.jsxs)("div", {
                              className: "flex flex-col items-start gap-y-0.5",
                              children: [
                                (0, n.jsxs)("span", { className: "font-bold text-[18px] text-foreground", children: [ea, " "] }),
                                (0, n.jsx)("span", { className: "text-muted-foreground text-sm", children: et })
                              ]
                            }),
                            (0, n.jsxs)("div", {
                              className: "flex flex-col items-end gap-y-0.5",
                              children: [
                                (0, n.jsx)("span", {
                                  className: "font-bold text-[18px] text-foreground",
                                  children: (0, j.z)((null == _ ? void 0 : _.completion_time) ?? "")
                                }),
                                (0, n.jsx)("span", {
                                  className: "text-muted-foreground text-sm",
                                  children: (null == _ ? void 0 : _.completion_time) && (0, s.E0P)(null == _ ? void 0 : _.completion_time)
                                })
                              ]
                            })
                          ]
                        })
                      ]
                    }),
                    !el &&
                      (0, n.jsx)("div", {
                        className: "py-4 px-5 bg-secondary-200",
                        children: (0, n.jsx)(c.zx, {
                          onClick: () => {
                            K(!0), y();
                          },
                          className: "w-full",
                          variant: "mono",
                          "aria-label": "cancel unstake button in stake v2 flow",
                          children: (0, n.jsx)("span", { "aria-label": "cancel unstake button text in stake v2 flow", children: "Cancel Unstake" })
                        })
                      })
                  ]
                }),
                (0, n.jsx)(N.Z, {
                  isOpen: Y,
                  onClose: () => K(!1),
                  unbondingDelegationEntry: _,
                  validator: C,
                  forceChain: O,
                  forceNetwork: G,
                  setClaimTxMode: R
                })
              ]
            });
          });
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    99447: function (e, a, t) {
      t.d(a, { v: () => x });
      var l = t(52322),
        n = t(41172),
        s = t(6391),
        o = t.n(s),
        i = t(6401),
        r = t(30464),
        d = t(75958),
        c = t(2784),
        u = t(84994),
        m = t(63479);
      let x = (0, d.Pi)(e => {
        let { validator: a, onClick: t, entry: s, isCancleUnstakeSupported: d, subText: x } = e,
          { data: v } = (0, n.pD_)((null == a ? void 0 : a.image) ? void 0 : a),
          f = (null == a ? void 0 : a.image) || v || r.r.Misc.Validator,
          [h] = (0, i.nB)(),
          g = (0, c.useMemo)(
            () =>
              new (o())(s.currencyBalance ?? "").gt(0)
                ? u.J.formatHideBalance(h(new (o())(s.currencyBalance ?? "")))
                : u.J.formatHideBalance(s.formattedBalance ?? ""),
            [s.currencyBalance, s.formattedBalance, h]
          ),
          p = (0, c.useMemo)(
            () => (new (o())(s.currencyBalance ?? "").gt(0) ? u.J.formatHideBalance(s.formattedBalance ?? "") : ""),
            [s.currencyBalance, s.formattedBalance]
          );
        return (0, l.jsx)(m.O, { onClick: t, imgSrc: f, moniker: a.moniker, titleAmount: g, subAmount: p, disabled: !d, subText: x });
      });
    },
    63479: function (e, a, t) {
      t.d(a, { O: () => u });
      var l = t(52322),
        n = t(41172),
        s = t(91486),
        o = t(30464),
        i = t(2784),
        r = t(70514),
        d = t(49409),
        c = t(48534);
      let u = i.memo(e => {
        let { onClick: a, imgSrc: t, moniker: i, titleAmount: u, subAmount: m, jailed: x, disabled: v, subText: f } = e;
        return (0, l.jsxs)("button", {
          disabled: v || !a,
          onClick: a,
          className: (0, r.cn)(
            "flex justify-between items-center px-4 py-3 bg-secondary-100 disabled:hover:bg-secondary-100 hover:bg-secondary-200 disabled:cursor-auto rounded-xl",
            s.YV
          ),
          "aria-label": `validator card view in stake v2 flow ${i}`,
          children: [
            (0, l.jsx)("img", {
              src: t,
              onError: (0, d._)(o.r.Misc.Validator),
              width: 36,
              height: 36,
              className: "mr-4 rounded-full",
              "aria-label": `validator card view image in stake v2 flow ${i}`
            }),
            (0, l.jsxs)("div", {
              className: "flex justify-between items-center w-full",
              children: [
                (0, l.jsxs)("div", {
                  className: "flex flex-col items-start gap-y-0.5",
                  children: [
                    (0, l.jsx)("span", {
                      className: "font-bold text-sm overflow-hidden",
                      "aria-label": `validator card view name in stake v2 flow ${i}`,
                      children: (0, n.MDB)(i, c.sN ? 5 + Math.floor(((Math.min(window.innerWidth, 400) - 320) / 81) * 7) : 10, 3)
                    }),
                    f
                      ? (0, l.jsx)("span", {
                          className: "font-medium text-right text-xs text-muted-foreground",
                          "aria-label": `validator card view sub text in stake v2 flow ${i}`,
                          children: f
                        })
                      : x
                        ? (0, l.jsx)("span", {
                            className: "font-medium text-xs text-destructive-100 mt-0.5",
                            "aria-label": `validator card view jailed in stake v2 flow ${i}`,
                            children: "Jailed"
                          })
                        : null
                  ]
                }),
                (0, l.jsxs)("div", {
                  className: "flex flex-col items-end gap-y-0.5",
                  children: [
                    (0, l.jsx)("span", {
                      className: "font-bold text-right text-sm",
                      "aria-label": `validator card view title amount in stake v2 flow ${i}`,
                      children: u
                    }),
                    (0, l.jsx)("span", {
                      className: "font-medium text-right text-xs text-muted-foreground",
                      "aria-label": `validator card view sub amount in stake v2 flow ${i}`,
                      children: m
                    })
                  ]
                })
              ]
            })
          ]
        });
      });
      u.displayName = "ValidatorCardView";
    },
    94991: function (e, a, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(a, { Z: () => _ });
          var n = t(52322),
            s = t(41172),
            o = t(6391),
            i = t.n(o),
            r = t(96217),
            d = t(23751),
            c = t(91486),
            u = t(96128),
            m = t.n(u),
            x = t(6401),
            v = t(42941),
            f = t(30464),
            h = t(75958),
            g = t(2784),
            p = t(10289),
            w = t(84994),
            b = t(49409),
            j = t(48534),
            N = t(30200),
            k = t(63479),
            y = e([N]);
          N = (y.then ? (await y)() : y)[0];
          let C = (0, h.Pi)(e => {
              var a, t, l, o, d;
              let {
                  isOpen: u,
                  onClose: v,
                  onSwitchValidator: h,
                  onUnstake: p,
                  validator: N,
                  delegation: k,
                  rootDenomsStore: y,
                  delegationsStore: C,
                  validatorsStore: S,
                  unDelegationsStore: _,
                  claimRewardsStore: D,
                  forceChain: M,
                  forceNetwork: E,
                  onValidatorClaim: A
                } = e,
                T = (0, s.a74)(),
                L = (0, g.useMemo)(() => M || T, [T, M]),
                B = (0, s.obn)(),
                Z = (0, g.useMemo)(() => E || B, [B, E]),
                R = y.allDenoms,
                F = C.delegationsForChain(L),
                O = S.validatorsForChain(L),
                P = _.unDelegationsForChain(L),
                G = D.claimRewardsForChain(L),
                [I] = (0, s.JsT)(R, L, Z),
                [J] = (0, x.nB)(),
                { network: H } = (0, s.nDu)(R, F, O, P, G, L, Z),
                z = null == H ? void 0 : H.validatorAprs,
                { data: V } = (0, s.pD_)((null == N ? void 0 : N.image) ? void 0 : N),
                $ = (null == N ? void 0 : N.image) || V || f.r.Misc.Validator,
                [U, W, Y] = (0, g.useMemo)(() => {
                  var e, a;
                  let t =
                      null == G
                        ? void 0
                        : null === (a = G.rewards) || void 0 === a
                          ? void 0
                          : null === (e = a.rewards) || void 0 === e
                            ? void 0
                            : e[(null == N ? void 0 : N.address) ?? ""],
                    l = null == t ? void 0 : t.reward.reduce((e, a) => e.plus(new (i())(a.currencyAmount ?? "")), new (i())(0)),
                    n = null == t ? void 0 : t.reward.find(e => e.denom === (null == I ? void 0 : I.coinMinimalDenom)),
                    o = (0, s.LHZ)((null == n ? void 0 : n.amount) ?? "", null == I ? void 0 : I.coinDenom),
                    r = null == t ? void 0 : t.reward.reduce((e, a) => e.plus(new (i())(a.amount)), new (i())(0));
                  return [l, o, r];
                }, [I, G, N]),
                K = (0, g.useMemo)(() => {
                  let e = new (i())((null == k ? void 0 : k.balance.currencyAmount) ?? "");
                  return e.gt(0)
                    ? w.J.formatHideBalance(J(e))
                    : w.J.formatHideBalance((null == k ? void 0 : k.balance.formatted_amount) || (null == k ? void 0 : k.balance.amount) || "");
                }, [k, J]),
                q = (0, g.useMemo)(
                  () =>
                    new (i())((null == k ? void 0 : k.balance.currencyAmount) ?? "").gt(0)
                      ? w.J.formatHideBalance((null == k ? void 0 : k.balance.formatted_amount) || (null == k ? void 0 : k.balance.amount) || "")
                      : "",
                  [k]
                );
              return (0, n.jsxs)(r.Z, {
                fullScreen: !0,
                isOpen: u,
                onClose: v,
                title: "Validator details",
                className: "!p-0 relative h-full",
                headerClassName: "border-secondary-200 border-b",
                children: [
                  (0, n.jsxs)("div", {
                    className: "p-6 flex flex-col gap-4 h-[calc(100%-84px)] overflow-y-scroll",
                    children: [
                      (0, n.jsxs)("div", {
                        className: "flex w-full gap-4 items-center",
                        children: [
                          (0, n.jsx)("img", { width: 40, height: 40, className: "rounded-full", src: $, onError: (0, b._)(f.r.Misc.Validator) }),
                          (0, n.jsx)("span", {
                            className: "font-bold text-lg",
                            children: (0, s.MDB)(
                              (null == N ? void 0 : N.moniker) ?? "",
                              (0, j.oj)() ? 18 + Math.floor(((Math.min(window.innerWidth, 400) - 320) / 81) * 7) : 10,
                              3
                            )
                          })
                        ]
                      }),
                      (0, n.jsxs)("div", {
                        className: "flex flex-col gap-4 p-5 bg-secondary-100 rounded-xl",
                        children: [
                          (0, n.jsxs)("div", {
                            className: "flex items-center justify-between",
                            children: [
                              (0, n.jsx)("span", { className: "text-sm text-muted-foreground !leading-[19px]", children: "Total Staked" }),
                              (0, n.jsx)("span", {
                                className: "font-bold text-sm !leading-[19px]",
                                children: m()(
                                  (null == N ? void 0 : null === (a = N.delegations) || void 0 === a ? void 0 : a.total_tokens_display) ??
                                    (null == N ? void 0 : N.tokens) ??
                                    "",
                                  { symbol: "", precision: 0 }
                                ).format()
                              })
                            ]
                          }),
                          (0, n.jsxs)("div", {
                            className: "flex items-center justify-between",
                            children: [
                              (0, n.jsx)("span", { className: "text-sm text-muted-foreground !leading-[19px]", children: "Commission" }),
                              (0, n.jsx)("span", {
                                className: "font-bold text-sm !leading-[19px]",
                                children: (
                                  null == N
                                    ? void 0
                                    : null === (l = N.commission) || void 0 === l
                                      ? void 0
                                      : null === (t = l.commission_rates) || void 0 === t
                                        ? void 0
                                        : t.rate
                                )
                                  ? `${new (i())((null == N ? void 0 : null === (d = N.commission) || void 0 === d ? void 0 : null === (o = d.commission_rates) || void 0 === o ? void 0 : o.rate) ?? "").multipliedBy(100).toFixed(0)}%`
                                  : "N/A"
                              })
                            ]
                          }),
                          (0, n.jsxs)("div", {
                            className: "flex items-center justify-between",
                            children: [
                              (0, n.jsx)("span", { className: "text-sm text-muted-foreground !leading-[19px]", children: "APR" }),
                              (0, n.jsx)("span", {
                                className: "font-bold text-sm text-accent-success !leading-[19px]",
                                children:
                                  z &&
                                  (z[(null == N ? void 0 : N.address) ?? ""]
                                    ? `${m()(100 * z[(null == N ? void 0 : N.address) ?? ""], { precision: 2, symbol: "" }).format()}%`
                                    : "N/A")
                              })
                            ]
                          })
                        ]
                      }),
                      (0, n.jsxs)("div", {
                        className: "mt-3 flex flex-col gap-3",
                        children: [
                          (0, n.jsx)("span", { className: "text-sm text-muted-foreground", children: "Your deposited amount" }),
                          (0, n.jsxs)("div", {
                            className: "p-5 bg-secondary-100 rounded-xl",
                            children: [
                              (0, n.jsxs)("span", { className: "font-bold text-[18px]", children: [K, " "] }),
                              (0, n.jsxs)("span", { className: "text-muted-foreground text-sm", children: ["(", q, ")"] })
                            ]
                          })
                        ]
                      }),
                      (0, n.jsxs)("div", {
                        className: "mt-3 flex flex-col gap-3",
                        children: [
                          (0, n.jsx)("span", { className: "text-sm text-muted-foreground", children: "Your Rewards" }),
                          (0, n.jsxs)("div", {
                            className: "flex items-center justify-between gap-4 p-5 bg-secondary-100 rounded-xl",
                            children: [
                              (0, n.jsxs)("span", {
                                className: "flex flex-col",
                                children: [
                                  (0, n.jsx)("span", { className: "font-bold text-[18px]", children: J(U ?? new (i())("")) }),
                                  (0, n.jsx)("span", { className: "text-muted-foreground text-sm", children: W })
                                ]
                              }),
                              (0, n.jsx)(c.zx, {
                                size: "md",
                                variant: "secondary",
                                className: "bg-secondary-350 disabled:bg-secondary-300 h-fit w-[121px]",
                                disabled: !Y || Y.lt(1e-5),
                                onClick: A,
                                "aria-label": "claim button in stake v2 flow",
                                children: (0, n.jsx)("span", { "aria-label": "claim button text in stake v2 flow", children: "Claim" })
                              })
                            ]
                          })
                        ]
                      })
                    ]
                  }),
                  (0, n.jsxs)("div", {
                    className: "flex gap-x-3 bg-secondary-200 w-full [&>*]:flex-1 mt-auto absolute bottom-0 py-4 px-5",
                    children: [
                      (0, n.jsxs)(c.zx, {
                        onClick: h,
                        "aria-label": "switch validator button in stake v2 flow",
                        children: [" ", (0, n.jsx)("span", { "aria-label": "switch validator button text in stake v2 flow", children: "Switch validator" })]
                      }),
                      (0, n.jsx)(c.zx, {
                        variant: "mono",
                        onClick: p,
                        "aria-label": "unstake button in stake v2 flow",
                        children: (0, n.jsx)("span", { "aria-label": "unstake button text in stake v2 flow", children: "Unstake" })
                      })
                    ]
                  })
                ]
              });
            }),
            S = (0, h.Pi)(e => {
              let { validator: a, delegation: t, onClick: l } = e,
                [o] = (0, x.nB)(),
                { data: r } = (0, s.pD_)((null == a ? void 0 : a.image) ? void 0 : a),
                d = (null == a ? void 0 : a.image) || r || f.r.Misc.Validator,
                c = (0, g.useMemo)(
                  () =>
                    new (i())(t.balance.currencyAmount ?? "").gt(0)
                      ? w.J.formatHideBalance(o(new (i())(t.balance.currencyAmount ?? "")))
                      : w.J.formatHideBalance(t.balance.formatted_amount ?? t.balance.amount),
                  [t.balance.amount, t.balance.currencyAmount, t.balance.formatted_amount, o]
                ),
                u = (0, g.useMemo)(
                  () => (new (i())(t.balance.currencyAmount ?? "").gt(0) ? w.J.formatHideBalance(t.balance.formatted_amount ?? t.balance.amount) : ""),
                  [t.balance.amount, t.balance.currencyAmount, t.balance.formatted_amount]
                ),
                m = (0, g.useCallback)(() => {
                  l(t);
                }, [l, t]);
              return (0, n.jsx)(k.O, { onClick: m, imgSrc: d, moniker: a.moniker, titleAmount: c, subAmount: u, jailed: a.jailed });
            }),
            _ = (0, h.Pi)(e => {
              var a;
              let {
                  rootDenomsStore: t,
                  delegationsStore: l,
                  validatorsStore: o,
                  unDelegationsStore: i,
                  claimRewardsStore: r,
                  forceChain: c,
                  forceNetwork: u,
                  rootBalanceStore: m,
                  setClaimTxMode: x
                } = e,
                f = (0, p.s0)(),
                [h, w] = (0, g.useState)(!1),
                [b, j] = (0, g.useState)(!1),
                [k, y] = (0, g.useState)(),
                _ = (0, s.a74)(),
                D = (0, g.useMemo)(() => c || _, [_, c]),
                M = (0, s.obn)(),
                E = (0, g.useMemo)(() => u || M, [M, u]),
                A = t.allDenoms,
                T = l.delegationsForChain(D),
                L = o.validatorsForChain(D),
                B = i.unDelegationsForChain(D),
                Z = r.claimRewardsForChain(D),
                { delegations: R, loadingNetwork: F, loadingDelegations: O } = (0, s.nDu)(A, T, L, B, Z, D, E),
                P = (0, g.useMemo)(() => {
                  var e;
                  return null === (e = L.validatorData.validators) || void 0 === e ? void 0 : e.reduce((e, a) => ((e[a.address] = a), e), {});
                }, [L.validatorData.validators]),
                G = F || O,
                I = (0, v.Z)(),
                J = I.get("validatorAddress") ?? void 0,
                H = I.get("action") ?? void 0;
              (0, g.useEffect)(() => {
                if (J && "DELEGATE" !== H) {
                  let e = Object.values(R ?? {}).find(e => e.delegation.validator_address === J);
                  e && (y(e), w(!0));
                }
              }, [R, H, J]);
              let [z, V] = (0, g.useMemo)(() => {
                  let e = Object.values(R ?? {}).sort((e, a) => parseFloat(a.balance.amount) - parseFloat(e.balance.amount)),
                    a = e.filter(e => {
                      var a;
                      let t = null == P ? void 0 : P[null == e ? void 0 : null === (a = e.delegation) || void 0 === a ? void 0 : a.validator_address];
                      return !!t && !1 !== t.active;
                    }),
                    t = e.filter(e => {
                      var a;
                      let t = null == P ? void 0 : P[null == e ? void 0 : null === (a = e.delegation) || void 0 === a ? void 0 : a.validator_address];
                      return !!t && !1 === t.active;
                    });
                  return [a, t];
                }, [R, P]),
                $ = (0, g.useCallback)(() => {
                  w(!1), j(!0);
                }, []),
                U = (0, g.useCallback)(e => {
                  y(e), w(!0);
                }, []);
              return (0, n.jsxs)("div", {
                className: "flex flex-col w-full gap-7",
                children: [
                  G &&
                    (0, n.jsxs)("div", {
                      className: "flex flex-col w-full gap-4",
                      children: [
                        (0, n.jsxs)("div", {
                          className: "flex justify-between",
                          children: [
                            (0, n.jsx)("span", { className: "text-xs text-muted-foreground", children: "Validator" }),
                            (0, n.jsx)("span", { className: "text-xs text-muted-foreground", children: "Amount Staked" })
                          ]
                        }),
                        (0, n.jsx)(d.KE, { count: 5 })
                      ]
                    }),
                  !G &&
                    P &&
                    z.length > 0 &&
                    (0, n.jsxs)("div", {
                      className: "flex flex-col w-full gap-4",
                      children: [
                        (0, n.jsxs)("div", {
                          className: "flex justify-between",
                          children: [
                            (0, n.jsx)("span", { className: "text-xs text-muted-foreground", children: "Validator" }),
                            (0, n.jsx)("span", { className: "text-xs text-muted-foreground", children: "Amount Staked" })
                          ]
                        }),
                        (0, n.jsx)("div", {
                          className: "flex flex-col w-full gap-4",
                          children: z.map(e => {
                            var a;
                            let t = null == P ? void 0 : P[null == e ? void 0 : null === (a = e.delegation) || void 0 === a ? void 0 : a.validator_address];
                            return (0, n.jsx)(S, { delegation: e, validator: t, onClick: U }, t.address);
                          })
                        })
                      ]
                    }),
                  !G &&
                    P &&
                    V.length > 0 &&
                    (0, n.jsxs)("div", {
                      className: "flex flex-col w-full gap-4",
                      children: [
                        (0, n.jsxs)("div", {
                          className: "flex justify-between",
                          children: [
                            (0, n.jsx)("span", { className: "text-xs text-muted-foreground", children: "Inactive validator" }),
                            (0, n.jsx)("span", { className: "text-xs text-muted-foreground", children: "Amount Staked" })
                          ]
                        }),
                        (0, n.jsx)("div", {
                          className: "flex flex-col w-full gap-4",
                          children: V.map(e => {
                            var a;
                            let t = null == P ? void 0 : P[null == e ? void 0 : null === (a = e.delegation) || void 0 === a ? void 0 : a.validator_address];
                            return (0, n.jsx)(S, { delegation: e, validator: t, onClick: U }, null == t ? void 0 : t.address);
                          })
                        })
                      ]
                    }),
                  (0, n.jsx)(C, {
                    isOpen: !!(h && k),
                    onClose: () => w(!1),
                    onSwitchValidator: () => {
                      let e = {
                        mode: "REDELEGATE",
                        fromValidator: P[(null == k ? void 0 : k.delegation.validator_address) || ""],
                        delegation: k,
                        forceChain: D,
                        forceNetwork: E
                      };
                      sessionStorage.setItem("navigate-stake-input-state", JSON.stringify(e)), f("/stake/input", { state: e });
                    },
                    onUnstake: () => {
                      let e = {
                        mode: "UNDELEGATE",
                        toValidator: P[(null == k ? void 0 : k.delegation.validator_address) || ""],
                        delegation: k,
                        forceChain: D,
                        forceNetwork: E
                      };
                      sessionStorage.setItem("navigate-stake-input-state", JSON.stringify(e)), f("/stake/input", { state: e });
                    },
                    validator: null == P ? void 0 : P[(null == k ? void 0 : null === (a = k.delegation) || void 0 === a ? void 0 : a.validator_address) || ""],
                    delegation: k,
                    rootDenomsStore: t,
                    delegationsStore: l,
                    validatorsStore: o,
                    unDelegationsStore: i,
                    claimRewardsStore: r,
                    forceChain: D,
                    forceNetwork: E,
                    onValidatorClaim: $
                  }),
                  b &&
                    k &&
                    (0, n.jsx)(N.Z, {
                      isOpen: b,
                      onClose: () => j(!1),
                      validator: null == P ? void 0 : P[k.delegation.validator_address],
                      selectedDelegation: k,
                      forceChain: D,
                      forceNetwork: E,
                      setClaimTxMode: x
                    })
                ]
              });
            });
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    54316: function (e, a, t) {
      t.a(e, async function (e, l) {
        try {
          t.r(a), t.d(a, { default: () => p });
          var n = t(52322),
            s = t(41172),
            o = t(23259),
            i = t(42941),
            r = t(2784),
            d = t(36321),
            c = t(42799),
            u = t(48346),
            m = t(84601),
            x = t(83208),
            v = t(29816),
            f = t(92006),
            h = t(56001),
            g = e([x, f, v, h, m, u]);
          function p() {
            let e = (0, i.Z)().get("pageSource") ?? void 0;
            (0, r.useMemo)(() => ({ pageViewSource: e }), [e]);
            let a = (0, s.a74)(),
              t = (0, s.Xmk)({ checkForExistenceType: "comingSoon", feature: "stake", platform: "Extension" }),
              l = (0, s.Xmk)({ checkForExistenceType: "notSupported", feature: "stake", platform: "Extension" });
            return a === o.HW
              ? (0, n.jsx)(x.j, {
                  aggregateStakeStore: m.jo,
                  rootDenomsStore: c.gb,
                  delegationsStore: m.xO,
                  validatorsStore: m.fe,
                  unDelegationsStore: m.GO,
                  claimRewardsStore: m.eq,
                  rootBalanceStore: u.jZ,
                  chainTagsStore: d.HN
                })
              : l || t
                ? (0, n.jsxs)(n.Fragment, { children: [(0, n.jsx)(f.w, {}), (0, n.jsx)(v.Z, { isStakeComingSoon: t, isStakeNotSupported: l })] })
                : (0, n.jsx)(h.Z, {
                    rootDenomsStore: c.gb,
                    delegationsStore: m.xO,
                    validatorsStore: m.fe,
                    unDelegationsStore: m.GO,
                    claimRewardsStore: m.eq,
                    rootBalanceStore: u.jZ,
                    chainTagsStore: d.HN
                  });
          }
          ([x, f, v, h, m, u] = g.then ? (await g)() : g), l();
        } catch (e) {
          l(e);
        }
      });
    },
    81248: function (e, a, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(a, { Z: () => p });
          var n = t(52322),
            s = t(41172),
            o = t(6391),
            i = t.n(o),
            r = t(96217),
            d = t(91486),
            c = t(72059),
            u = t(6401),
            m = t(38313),
            x = t(75958),
            v = t(2784),
            f = t(84994),
            h = t(58022),
            g = e([c, m, h]);
          [c, m, h] = g.then ? (await g)() : g;
          let p = (0, x.Pi)(e => {
            let {
                isOpen: a,
                onClose: t,
                onClaimValidatorRewards: l,
                onClaimProviderRewards: o,
                rootDenomsStore: x,
                delegationsStore: g,
                validatorsStore: p,
                unDelegationsStore: w,
                claimRewardsStore: b,
                forceChain: j,
                forceNetwork: N
              } = e,
              [k] = (0, u.nB)(),
              y = x.allDenoms,
              C = (0, c.a7)(),
              S = (0, v.useMemo)(() => j || C, [C, j]),
              _ = (0, m.ob)(),
              D = (0, v.useMemo)(() => N || _, [_, N]),
              [M] = (0, s.JsT)(y, S, D),
              E = g.delegationsForChain(S),
              A = p.validatorsForChain(S),
              T = w.unDelegationsForChain(S),
              L = b.claimRewardsForChain(S),
              { totalRewardsDollarAmt: B = 0, rewards: Z = { total: [] }, totalRewards: R } = (0, s.nDu)(y, E, A, T, L, S, D),
              F = (0, v.useMemo)(() => !R || new (i())(R).lt(1e-5), [R]),
              { rewards: O } = (0, s.fHb)(),
              P = (0, v.useMemo)(
                () => !(null == O ? void 0 : O.totalRewards) || new (i())(null == O ? void 0 : O.totalRewards).lt(1e-5),
                [null == O ? void 0 : O.totalRewards]
              ),
              G = (0, v.useMemo)(() => {
                if (Z) {
                  var e;
                  return null == Z
                    ? void 0
                    : null === (e = Z.total) || void 0 === e
                      ? void 0
                      : e.find(e => e.denom === (null == M ? void 0 : M.coinMinimalDenom));
                }
              }, [null == M ? void 0 : M.coinMinimalDenom, Z]),
              I = (0, v.useMemo)(() => {
                if (O) {
                  var e;
                  let a =
                      null === (e = O.rewards) || void 0 === e
                        ? void 0
                        : e
                            .flatMap(e => e.amount)
                            .reduce((e, a) => ((e[a.denom] = e[a.denom] ? new (i())(e[a.denom]).plus(new (i())(a.amount)) : new (i())(a.amount)), e), {}),
                    t = Object.keys(a ?? {}).length;
                  return f.J.formatHideBalance(`${O.formattedTotalRewards} ${t > 1 ? `+${t - 1} more` : ""}`);
                }
              }, [O]),
              J = (0, v.useMemo)(() => {
                var e, a;
                return f.J.formatHideBalance(
                  `${(0, s.LHZ)((null == G ? void 0 : G.amount) ?? "", M.coinDenom)} ${(null == Z ? void 0 : null === (e = Z.total) || void 0 === e ? void 0 : e.length) > 1 ? `+${(null == Z ? void 0 : null === (a = Z.total) || void 0 === a ? void 0 : a.length) - 1} more` : ""}`
                );
              }, [null == M ? void 0 : M.coinDenom, null == G ? void 0 : G.amount, null == Z ? void 0 : Z.total.length]),
              H = (0, v.useMemo)(() => (new (i())(B).gt(0) ? f.J.formatHideBalance(k(new (i())(B))) : J), [k, J, B]),
              z = (0, v.useMemo)(() => (new (i())(B).gt(0) ? J : ""), [J, B]),
              V = (0, v.useMemo)(
                () =>
                  new (i())(null == O ? void 0 : O.totalRewardsDollarAmt).gt(0)
                    ? f.J.formatHideBalance(k(new (i())(null == O ? void 0 : O.totalRewardsDollarAmt)))
                    : I,
                [k, I, null == O ? void 0 : O.totalRewardsDollarAmt]
              ),
              $ = (0, v.useMemo)(
                () => (new (i())(null == O ? void 0 : O.totalRewardsDollarAmt).gt(0) ? I : ""),
                [I, null == O ? void 0 : O.totalRewardsDollarAmt]
              );
            return (0, n.jsxs)(r.Z, {
              isOpen: a,
              onClose: t,
              title: "Claim rewards",
              className: "flex flex-col gap-8 mt-4",
              children: [
                (0, n.jsxs)("div", {
                  className: "flex flex-col gap-4 w-full",
                  children: [
                    (0, n.jsx)("span", { className: "text-muted-foreground text-sm", children: "Validator Rewards" }),
                    (0, n.jsx)(h.Z, {
                      titleAmount: H,
                      secondaryAmount: z,
                      button: (0, n.jsx)(d.zx, {
                        onClick: l,
                        disabled: F,
                        size: "md",
                        variant: "secondary",
                        className: "w-[7.5rem] bg-secondary-350 disabled:bg-secondary-300 hover:bg-secondary-300",
                        "aria-label": "claim validator rewards button in stake v2 flow",
                        children: (0, n.jsx)("span", { "aria-label": "claim validator rewards button text in stake v2 flow", children: "Claim" })
                      })
                    })
                  ]
                }),
                (0, n.jsxs)("div", {
                  className: "flex flex-col gap-4 w-full",
                  children: [
                    (0, n.jsx)("span", { className: "text-muted-foreground text-sm", children: "Provider Rewards" }),
                    (0, n.jsx)(h.Z, {
                      titleAmount: V ?? "",
                      secondaryAmount: $ ?? "",
                      button: (0, n.jsx)(d.zx, {
                        size: "md",
                        variant: "secondary",
                        className: "w-[7.5rem] bg-secondary-350 disabled:bg-secondary-300 hover:bg-secondary-300",
                        onClick: o,
                        disabled: P,
                        "aria-label": "claim provider rewards button in stake v2 flow",
                        children: (0, n.jsx)("span", { "aria-label": "claim provider rewards button text in stake v2 flow", children: "Claim" })
                      })
                    })
                  ]
                })
              ]
            });
          });
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    5833: function (e, a, t) {
      t.d(a, { Z: () => k });
      var l = t(52322),
        n = t(41172),
        s = t(75377),
        o = t(6391),
        i = t.n(o),
        r = t(96217),
        d = t(23751),
        c = t(6401),
        u = t(30464),
        m = t(2784),
        x = t(10289),
        v = t(49409),
        f = t(91486),
        h = t(75958),
        g = t(42799),
        p = t(84994),
        w = t(48534),
        b = t(63479);
      let j = (0, h.Pi)(e => {
          let { isOpen: a, onClose: t, onSwitchValidator: o, provider: d, delegation: x, rootDenomsStore: h, forceChain: g, forceNetwork: b } = e,
            j = h.allDenoms,
            N = (0, n.a74)(),
            k = (0, m.useMemo)(() => g || N, [N, g]),
            y = (0, n.obn)(),
            C = (0, m.useMemo)(() => b || y, [y, b]),
            [S] = (0, n.JsT)(j, k, C),
            [_] = (0, c.nB)(),
            { theme: D } = (0, s.useTheme)(),
            M = (0, m.useMemo)(
              () =>
                new (i())(x.amount.currencyAmount ?? "").gt(0)
                  ? p.J.formatHideBalance(_(new (i())(x.amount.currencyAmount ?? "")))
                  : p.J.formatHideBalance(x.amount.formatted_amount ?? x.amount.amount),
              [x.amount.amount, x.amount.currencyAmount, x.amount.formatted_amount, _]
            ),
            E = (0, m.useMemo)(
              () => (new (i())(x.amount.currencyAmount ?? "").gt(0) ? p.J.formatHideBalance(x.amount.formatted_amount ?? x.amount.amount) : ""),
              [x.amount.amount, x.amount.currencyAmount, x.amount.formatted_amount]
            );
          return (0, l.jsxs)(r.Z, {
            fullScreen: !0,
            isOpen: a,
            onClose: t,
            title: "Provider Details",
            className: "!p-0 relative h-full",
            headerClassName: "border-secondary-200 border-b",
            children: [
              (0, l.jsxs)("div", {
                className: "p-6 pt-8 px-6 flex flex-col gap-4 h-[calc(100%-84px)] overflow-y-scroll",
                children: [
                  (0, l.jsxs)("div", {
                    className: "flex w-full gap-4 items-center",
                    children: [
                      (0, l.jsx)("img", {
                        width: 40,
                        height: 40,
                        className: "rounded-full",
                        src: (null == d ? void 0 : d.image) || u.r.Misc.Validator,
                        onError: (0, v._)(u.r.Misc.Validator)
                      }),
                      (0, l.jsx)("span", {
                        className: "font-bold text-lg",
                        children: (0, n.MDB)(
                          (null == d ? void 0 : d.moniker) ?? "",
                          (0, w.oj)() ? 18 + Math.floor(((Math.min(window.innerWidth, 400) - 320) / 81) * 7) : 10,
                          3
                        )
                      })
                    ]
                  }),
                  (0, l.jsxs)("div", {
                    className: "flex flex-col gap-4 p-6 bg-secondary-100 rounded-xl",
                    children: [
                      (0, l.jsxs)("div", {
                        className: "flex items-center justify-between",
                        children: [
                          (0, l.jsx)("span", { className: "text-sm text-muted-foreground", children: "Total Staked" }),
                          (0, l.jsx)("span", { className: "font-bold text-sm", children: "N/A" })
                        ]
                      }),
                      (0, l.jsxs)("div", {
                        className: "flex items-center justify-between",
                        children: [
                          (0, l.jsx)("span", { className: "text-sm text-muted-foreground", children: "Commission" }),
                          (0, l.jsx)("span", { className: "font-bold text-sm", children: "N/A" })
                        ]
                      }),
                      (0, l.jsxs)("div", {
                        className: "flex items-center justify-between",
                        children: [
                          (0, l.jsx)("span", { className: "text-sm text-muted-foreground", children: "APR" }),
                          (0, l.jsx)("span", { className: "font-bold text-sm text-accent-success", children: "N/A" })
                        ]
                      })
                    ]
                  }),
                  (0, l.jsx)("span", { className: "text-sm text-muted-foreground mt-4", children: "Your deposited amount" }),
                  (0, l.jsxs)("div", {
                    className: "p-6 bg-secondary-100 rounded-xl",
                    children: [
                      (0, l.jsxs)("span", { className: "font-bold text-lg", children: [M, " "] }),
                      E && (0, l.jsxs)("span", { className: "text-muted-foreground", children: ["(", E, ")"] })
                    ]
                  })
                ]
              }),
              (0, l.jsx)("div", {
                className: "flex gap-x-3 bg-secondary-200 w-full [&>*]:flex-1 mt-auto absolute bottom-0 py-4 px-5",
                children: (0, l.jsxs)(f.zx, {
                  onClick: o,
                  "aria-label": "switch provider button in stake v2 flow",
                  children: [" ", (0, l.jsx)("span", { "aria-label": "switch provider button text in stake v2 flow", children: "Switch provider" })]
                })
              })
            ]
          });
        }),
        N = (0, h.Pi)(e => {
          let { provider: a, delegation: t, onClick: n } = e,
            [s] = (0, c.nB)(),
            o = (0, m.useMemo)(
              () =>
                new (i())(t.amount.currencyAmount ?? "").gt(0)
                  ? p.J.formatHideBalance(s(new (i())(t.amount.currencyAmount ?? "")))
                  : p.J.formatHideBalance(t.amount.formatted_amount ?? t.amount.amount),
              [t.amount.amount, t.amount.currencyAmount, t.amount.formatted_amount, s]
            ),
            r = (0, m.useMemo)(
              () => (new (i())(t.amount.currencyAmount ?? "").gt(0) ? p.J.formatHideBalance(t.amount.formatted_amount ?? t.amount.amount) : ""),
              [t.amount.amount, t.amount.currencyAmount, t.amount.formatted_amount]
            );
          return (0, l.jsx)(b.O, { onClick: n, imgSrc: u.r.Misc.Validator, moniker: a.moniker ?? "", titleAmount: o, subAmount: r, jailed: !1 });
        });
      function k(e) {
        let { forceChain: a, forceNetwork: t } = e,
          s = (0, x.s0)(),
          [o, i] = (0, m.useState)(!1),
          [r, c] = (0, m.useState)(),
          { delegations: u, loadingDelegations: v, providers: f } = (0, n.fHb)(),
          h = (0, m.useMemo)(() => Object.values(u ?? {}).find(e => "empty_provider" === e.provider), [u]),
          p = (0, m.useMemo)(() => Object.values(u ?? {}).sort((e, a) => parseFloat(a.amount.amount) - parseFloat(e.amount.amount)), [u]),
          w = (0, m.useMemo)(
            () => ({
              provider: (null == h ? void 0 : h.provider) ?? "",
              moniker: "Empty Provider",
              address: (null == h ? void 0 : h.provider) ?? "",
              specs: []
            }),
            [null == h ? void 0 : h.provider]
          );
        return (0, l.jsxs)(l.Fragment, {
          children: [
            v && (0, l.jsx)(d.KE, {}),
            (0, l.jsx)("div", {
              className: "flex flex-col w-full gap-y-2",
              children:
                !v &&
                f &&
                p.length > 0 &&
                (0, l.jsxs)(l.Fragment, {
                  children: [
                    h &&
                      (0, l.jsxs)(l.Fragment, {
                        children: [
                          (0, l.jsxs)("div", {
                            className: "flex justify-between",
                            children: [
                              (0, l.jsx)("span", { className: "text-xs text-muted-foreground", children: "Empty Provider" }),
                              (0, l.jsx)("span", { className: "text-xs text-muted-foreground", children: "Amount Staked" })
                            ]
                          }),
                          (0, l.jsx)(N, {
                            delegation: h,
                            provider: w,
                            onClick: () => {
                              c(h), i(!0);
                            }
                          })
                        ]
                      }),
                    p.length > 1 &&
                      (0, l.jsxs)("div", {
                        className: "flex justify-between",
                        children: [
                          (0, l.jsx)("span", { className: "text-xs text-muted-foreground", children: "Provider" }),
                          (0, l.jsx)("span", { className: "text-xs text-muted-foreground", children: "Amount Staked" })
                        ]
                      }),
                    p.map(e => {
                      let a = null == f ? void 0 : f.find(a => a.address === e.provider);
                      return (
                        a &&
                        (0, l.jsx)(
                          N,
                          {
                            delegation: e,
                            provider: a,
                            onClick: () => {
                              c(e), i(!0);
                            }
                          },
                          null == a ? void 0 : a.address
                        )
                      );
                    })
                  ]
                })
            }),
            r &&
              (0, l.jsx)(j, {
                rootDenomsStore: g.gb,
                isOpen: o,
                onClose: () => i(!1),
                provider: r.provider === (null == h ? void 0 : h.provider) ? w : f.find(e => e.address === r.provider),
                delegation: r,
                onSwitchValidator: () => {
                  let e = {
                    mode: "REDELEGATE",
                    fromProvider: r.provider === (null == h ? void 0 : h.provider) ? w : f.find(e => e.address === r.provider),
                    providerDelegation: r,
                    forceChain: "lava"
                  };
                  sessionStorage.setItem("navigate-stake-input-state", JSON.stringify(e)), s("/stake/input", { state: e });
                },
                forceChain: a,
                forceNetwork: t
              })
          ]
        });
      }
    },
    95380: function (e, a, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(a, { C: () => Z });
          var n = t(52322),
            s = t(41172),
            o = t(6391),
            i = t.n(o),
            r = t(58885),
            d = t(51994),
            c = t(80588),
            u = t(42152),
            m = t(96217),
            x = t(91486),
            v = t(13287),
            f = t(6401),
            h = t(30942),
            g = t(65027),
            p = t(30464),
            w = t(63242),
            b = t(75958),
            j = t(2784),
            N = t(10289),
            k = t(84994),
            y = t(48534),
            C = t(92642),
            S = t(63400),
            _ = t(49728),
            D = t(97680),
            M = t.n(D),
            E = t(12499),
            A = t(78884),
            T = t(90258),
            L = e([g, r, A, d, c]);
          [g, r, A, d, c] = L.then ? (await L)() : L;
          let B = g.w.useGetWallet,
            Z = (0, b.Pi)(e => {
              var a;
              let { isOpen: t, onClose: l, validator: o, rootDenomsStore: g, rootBalanceStore: b, forceChain: D, forceNetwork: L, setClaimTxMode: Z } = e,
                R = g.allDenoms,
                F = (0, s.a74)(),
                O = (0, j.useMemo)(() => D || F, [F, D]),
                P = (0, s.obn)(),
                G = (0, j.useMemo)(() => L || P, [P, L]),
                I = B(),
                J = (0, r.e7)(R, { activeChain: O, selectedNetwork: G }),
                [H] = (0, f.nB)(),
                [z] = (0, s.JsT)(R, O, G),
                { rewards: V, providers: $ } = (0, s.fHb)(),
                U = (0, j.useMemo)(() => {
                  if (V && $) {
                    var e;
                    return null == V
                      ? void 0
                      : null === (e = V.rewards) || void 0 === e
                        ? void 0
                        : e.map(e => $.find(a => a.address === e.provider)).filter(e => void 0 !== e);
                  }
                }, [$, V]),
                {
                  showLedgerPopup: W,
                  onReviewTransaction: Y,
                  isLoading: K,
                  error: q,
                  setAmount: X,
                  recommendedGasLimit: Q,
                  userPreferredGasLimit: ee,
                  setUserPreferredGasLimit: ea,
                  gasOption: et,
                  setGasOption: el,
                  userPreferredGasPrice: en,
                  setFeeDenom: es,
                  customFee: eo,
                  feeDenom: ei,
                  ledgerError: er,
                  setLedgerError: ed
                } = (0, s.$l7)(R, "CLAIM_REWARDS", o, void 0, void 0, void 0, void 0, void 0, U, O, G),
                [ec, eu] = (0, j.useState)(!1),
                [em, ex] = (0, j.useState)(null),
                [ev, ef] = (0, j.useState)({ option: et, gasPrice: en ?? J.gasPrice });
              (0, N.s0)();
              let eh = (0, _.U)();
              (0, h.X)(q),
                (0, j.useEffect)(() => {
                  X((null == V ? void 0 : V.totalRewards) ?? "0");
                }, [null == V ? void 0 : V.totalRewards]);
              let eg = (0, j.useMemo)(() => {
                  if (V) {
                    var e;
                    let a =
                        null === (e = V.rewards) || void 0 === e
                          ? void 0
                          : e
                              .flatMap(e => e.amount)
                              .reduce((e, a) => ((e[a.denom] = e[a.denom] ? new (i())(e[a.denom]).plus(new (i())(a.amount)) : new (i())(a.amount)), e), {}),
                      t = Object.keys(a ?? {}).length;
                    return k.J.formatHideBalance(`${V.formattedTotalRewards} ${t > 1 ? `+${t - 1} more` : ""}`);
                  }
                }, [V]),
                ep = (0, j.useCallback)(
                  (e, a) => {
                    ef(e), es(a.denom), e.option && el(e.option);
                  },
                  [es, el]
                ),
                ew = (0, j.useCallback)(() => {
                  eu(!1);
                }, []),
                eb = (0, j.useCallback)(() => {
                  Z("CLAIM_REWARDS"), l();
                }, [l, Z]),
                ej = (0, j.useCallback)(async () => {
                  try {
                    let e = await I(O);
                    Y(e, eb, !1, { stdFee: eo, feeDenom: ei });
                  } catch (e) {
                    ed(e.message),
                      setTimeout(() => {
                        ed("");
                      }, 6e3),
                      (0, C.Tb)(e, {
                        tags: {
                          errorType: "stake_v2_transaction_error",
                          source: "stake_v2_review_claim_lava_tx",
                          severity: "error",
                          errorName: e instanceof Error ? e.name : "StakeV2TransactionError"
                        },
                        fingerprint: ["stake_v2_review_claim_lava_tx", "stake_v2_review_claim_lava_tx_error"],
                        level: "error",
                        contexts: { transaction: { type: "stake_v2_review_claim_lava_tx", errorMessage: e instanceof Error ? e.message : String(e) } },
                        extra: { chain: O, feeDenom: ei, customFee: eo }
                      });
                  }
                }, [O, eo, ei, I, Y, ed, eb]);
              (0, v.U)(er || q);
              let eN = (0, j.useMemo)(() => (0, E.h)(er), [er]),
                ek = (0, j.useCallback)(async () => {
                  if (eN) {
                    eh();
                    return;
                  }
                  ej();
                }, [eN, ej, eh]);
              return (0, n.jsxs)(r.ZP, {
                recommendedGasLimit: Q,
                gasLimit: (null == ee ? void 0 : ee.toString()) ?? Q,
                setGasLimit: e => ea(Number(e.toString())),
                gasPriceOption: ev,
                onGasPriceOptionChange: ep,
                error: em,
                chain: O,
                network: G,
                setError: ex,
                rootDenomsStore: g,
                rootBalanceStore: b,
                children: [
                  (0, n.jsxs)(m.Z, {
                    isOpen: t,
                    onClose: l,
                    title: T.PV.CLAIM_REWARDS,
                    className: "p-6 mt-4",
                    children: [
                      (0, n.jsxs)("div", {
                        className: "flex flex-col items-center w-full gap-y-4",
                        children: [
                          (0, n.jsx)(A.Z, {
                            title: k.J.formatHideBalance(H(new (i())((null == V ? void 0 : V.totalRewardsDollarAmt) ?? "0"))),
                            subText: eg,
                            imgSrc: z.icon
                          }),
                          (0, n.jsx)(A.Z, {
                            title:
                              U &&
                              (0, s.MDB)(
                                null === (a = U[0]) || void 0 === a ? void 0 : a.moniker,
                                (0, y.oj)() ? 2 + Math.floor(((Math.min(window.innerWidth, 400) - 320) / 81) * 7) : 10,
                                3
                              ),
                            subText: U && (U.length > 1 ? `+${U.length - 1} more providers` : ""),
                            imgSrc: p.r.Misc.Validator
                          })
                        ]
                      }),
                      (0, n.jsxs)("div", {
                        className: "flex items-center w-full justify-between mt-5 mb-7",
                        children: [
                          (0, n.jsx)("span", { className: "text-sm text-muted-foreground font-medium", children: "Fees" }),
                          (0, n.jsx)(d.a, { setShowFeesSettingSheet: eu })
                        ]
                      }),
                      (0, n.jsxs)("div", {
                        className: "flex flex-col items-center w-full gap-y-2",
                        children: [
                          !eN && er && (0, n.jsx)("p", { className: "text-sm font-bold text-destructive-100 px-2", children: er }),
                          eN && (0, n.jsx)(S.u, {}),
                          q && (0, n.jsx)("p", { className: "text-sm font-bold text-destructive-100 px-2", children: q }),
                          em && !ec && (0, n.jsx)("p", { className: "text-sm font-bold text-destructive-100 px-2", children: em }),
                          (0, n.jsx)(x.zx, {
                            className: "w-full",
                            disabled: K || !!q || !!em || W || (!eN && !!er),
                            onClick: ek,
                            "aria-label": "claim rewards button in stake v2 flow",
                            children: eN
                              ? "Connect Ledger"
                              : K
                                ? (0, n.jsx)(M(), {
                                    loop: !0,
                                    autoplay: !0,
                                    animationData: w,
                                    rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
                                    className: "h-[24px] w-[24px]"
                                  })
                                : (0, n.jsx)("span", { "aria-label": "claim rewards button text in stake v2 flow", children: "Confirm Claim" })
                          })
                        ]
                      })
                    ]
                  }),
                  (0, n.jsx)(u.Z, { showLedgerPopup: W }),
                  (0, n.jsx)(c.k, { showFeesSettingSheet: ec, onClose: ew, gasError: em })
                ]
              });
            });
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    92006: function (e, a, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(a, { w: () => v });
          var n = t(52322),
            s = t(43166),
            o = t(22764),
            i = t(16283),
            r = t(85027),
            d = t(86240),
            c = t(35065),
            u = t(2784),
            m = t(10289),
            x = e([c]);
          c = (x.then ? (await x)() : x)[0];
          let v = e => {
            let { disableWalletButton: a, setShowSearchInput: t, onBackClick: l } = e,
              x = (0, m.s0)(),
              v = (0, d.v)(),
              [f, h] = (0, u.useState)(!1);
            return (0, n.jsxs)(n.Fragment, {
              children: [
                (0, n.jsxs)(r.m, {
                  children: [
                    (0, n.jsx)(s.X, {
                      size: 36,
                      className: "text-muted-foreground hover:text-foreground cursor-pointer p-2",
                      onClick: () => {
                        l ? l() : x(-1);
                      },
                      "aria-label": "stake header back button in stake v2 flow"
                    }),
                    (0, n.jsx)(i.G2, {
                      showDropdown: !0,
                      showWalletAvatar: !0,
                      className: "absolute top-1/2 right-1/2 translate-x-1/2 -translate-y-1/2",
                      walletName: v.walletName,
                      walletAvatar: v.walletAvatar,
                      handleDropdownClick: () => h(!a)
                    }),
                    t &&
                      (0, n.jsx)(o.Y, {
                        size: 36,
                        className: "text-muted-foreground hover:text-foreground cursor-pointer p-2",
                        onClick: () => t(e => !e),
                        "aria-label": "stake header search button in stake v2 flow"
                      })
                  ]
                }),
                (0, n.jsx)(c.Z, { isVisible: f, onClose: () => h(!1), title: "Your Wallets" })
              ]
            });
          };
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    90258: function (e, a, t) {
      t.d(a, { KT: () => l, Nb: () => s, PV: () => o, d6: () => n });
      let l = { loading: "in progress", success: "successful", submitted: "submitted", failed: "failed" },
        n = {
          DELEGATE: "Stake",
          UNDELEGATE: "Unstake",
          REDELEGATE: "Switching",
          CLAIM_REWARDS: "Claim",
          CANCEL_UNDELEGATION: "Cancel unstake",
          CLAIM_AND_DELEGATE: "Claim"
        },
        s = {
          DELEGATE: "Enter amount to be staked",
          REDELEGATE: "Enter amount to be redelegated",
          UNDELEGATE: "Enter unstaking amount",
          CLAIM_REWARDS: "Enter amount to be claimed",
          CANCEL_UNDELEGATION: "Enter amount to be cancelled",
          CLAIM_AND_DELEGATE: "Enter amount to be claimed"
        },
        o = {
          CLAIM_REWARDS: "Review claim",
          CLAIM_AND_DELEGATE: "Review claim and stake",
          DELEGATE: "Review stake",
          UNDELEGATE: "Review unstake",
          REDELEGATE: "Review validator switching",
          CANCEL_UNDELEGATION: "Review cancel unstake"
        };
    },
    12499: function (e, a, t) {
      t.d(a, { h: () => l });
      let l = e => {
        var a;
        return (
          !!e &&
          (null == e
            ? void 0
            : null === (a = e.toLowerCase()) || void 0 === a
              ? void 0
              : a.includes("unable to connect to ledger device. please check if your ledger is connected and try again."))
        );
      };
    },
    94629: function (e, a, t) {
      t.d(a, { z: () => s });
      var l = t(28879),
        n = t.n(l);
      let s = (e, a, t) => {
        let l = n()(e).diff(t ?? new Date()),
          s = Math.floor(l / 864e5),
          o = Math.floor(l / 36e5),
          i = Math.floor((l - 36e5 * o) / 6e4),
          r = Math.floor((l - 36e5 * o - 6e4 * i) / 1e3),
          d = "";
        for (let e of [
          [s, "day"],
          [o, "hour"],
          [i, "minute"],
          [r, "second"]
        ])
          if (0 !== e[0]) {
            d = `${e[0]} ${1 === e[0] ? e[1] : e[1] + "s"} ${a ?? "left"}`;
            break;
          }
        return d;
      };
    }
  }
]);
//# sourceMappingURL=8377.js.map
