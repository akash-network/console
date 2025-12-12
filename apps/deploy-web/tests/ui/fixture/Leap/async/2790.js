!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "0790fb78-270a-484a-9292-a147fd713782"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-0790fb78-270a-484a-9292-a147fd713782"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.23.1" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["2790"],
  {
    9274: function (e, t, s) {
      s.d(t, { Z: () => o });
      var l = s(52322),
        r = s(75377),
        a = s(30464);
      s(2784);
      var n = s(86874);
      function o(e) {
        let { isLast: t, aggregatedView: s } = e;
        return s
          ? (0, l.jsxs)("div", {
              className: "w-full p-3 min-w-[344px] flex flex-col items-start rounded-xl justify-start gap-1 bg-white-100 dark:bg-gray-950 !h-[112px]",
              children: [
                (0, l.jsx)(n.Z, { count: 1, height: 12, width: 70, containerClassName: "!block !leading-none h-[14px]" }),
                (0, l.jsx)(n.Z, { count: 1, height: 20, containerClassName: "!block !leading-none w-full" }),
                (0, l.jsx)(n.Z, { count: 1, height: 20, containerClassName: "!block !leading-none w-full" }),
                (0, l.jsx)(n.Z, { count: 1, height: 14, width: 100, containerClassName: "!block !leading-none h-[16px]" })
              ]
            })
          : (0, l.jsxs)(l.Fragment, {
              children: [
                (0, l.jsxs)("div", {
                  className: "flex-1 p-4 min-w-[344px] flex flex-row items-center justify-between",
                  children: [
                    (0, l.jsxs)("div", {
                      className: "flex flex-col items-start justify-center gap-[4px]",
                      children: [
                        (0, l.jsx)(n.Z, { count: 1, height: 18, width: 270, containerClassName: "!block !leading-none" }),
                        (0, l.jsx)(n.Z, { count: 1, height: 18, width: 270, containerClassName: "!block !leading-none" }),
                        (0, l.jsx)(n.Z, { count: 1, height: 14, width: 100, containerClassName: "!block !leading-none h-[16px] mt-[4px]" })
                      ]
                    }),
                    (0, l.jsx)("img", { className: "ml-5", src: a.r.Misc.RightArrow })
                  ]
                }),
                t ? null : (0, l.jsx)(r.CardDivider, {})
              ]
            });
      }
    },
    72817: function (e, t, s) {
      s.d(t, { Z: () => r });
      var l = s(2784);
      let r = function () {
        let e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : "natural",
          t = (0, l.useRef)(null),
          [s, r] = (0, l.useState)(null),
          [a, n] = (0, l.useState)(null),
          [o, i] = (0, l.useState)(!1),
          c = (0, l.useCallback)(e => {
            t.current && (r(e.screenX), n(t.current.scrollLeft), i(!0));
          }, []),
          d = (0, l.useCallback)(
            l => {
              if (t && t.current && (l.preventDefault(), l.stopPropagation(), null !== s && null !== a && o)) {
                let r = s - l.screenX;
                t.current.scrollLeft = "natural" === e ? a - r : a + r;
              }
            },
            [s, o, a, e]
          ),
          u = (0, l.useCallback)(() => {
            o && (r(null), n(null), i(!1));
          }, [o]);
        return { props: { onMouseDown: c, onMouseMove: d, onMouseUp: u, onMouseLeave: u }, scrollRef: t, clickStartX: s, scrollStartX: a, isDragging: o };
      };
    },
    30942: function (e, t, s) {
      s.d(t, { X: () => o });
      var l = s(41172),
        r = s(92642),
        a = s(2784),
        n = s(37906);
      function o(e) {
        let { rpcUrl: t } = (0, l.U9i)();
        (0, a.useEffect)(() => {
          e &&
            !(
              e.includes("was submitted but was not yet found on the chain. You might want to check later. There was a wait of 60 seconds.") ||
              e.includes("Reward is too low")
            ) &&
            (e.includes("You don't have enough") || r.Tb(`${e} - node: ${t}`, { tags: n.rw }));
        }, [e, t]);
      }
    },
    71845: function (e, t, s) {
      s.d(t, { Z: () => i });
      var l = s(52322),
        r = s(6806),
        a = s(2784);
      let n = new Map([
          [
            "regular",
            (0, l.jsxs)(
              a.Fragment,
              {
                children: [
                  (0, l.jsxs)("g", {
                    clipPath: "url(#clip0_241_1099)",
                    children: [
                      (0, l.jsx)("path", {
                        d: "M3 12.75H14.0625",
                        stroke: "currentColor",
                        strokeWidth: "1.5",
                        strokeLinecap: "round",
                        strokeLinejoin: "round"
                      }),
                      (0, l.jsx)("path", { d: "M3 8.25H21", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }),
                      (0, l.jsx)("path", { d: "M3 17.25H7.125", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" })
                    ]
                  }),
                  (0, l.jsx)("defs", {
                    children: (0, l.jsx)("clipPath", {
                      id: "clip0_241_1099",
                      children: (0, l.jsx)("rect", { width: "24", height: "24", fill: "currentColor" })
                    })
                  })
                ]
              },
              "regular"
            )
          ],
          [
            "bold",
            (0, l.jsxs)(
              a.Fragment,
              {
                children: [
                  (0, l.jsxs)("g", {
                    clipPath: "url(#clip0_256_253)",
                    children: [
                      (0, l.jsx)("path", {
                        d: "M3 12.75H14.0625",
                        stroke: "currentColor",
                        strokeWidth: "2.25",
                        strokeLinecap: "round",
                        strokeLinejoin: "round"
                      }),
                      (0, l.jsx)("path", { d: "M3 8.25H21", stroke: "currentColor", strokeWidth: "2.25", strokeLinecap: "round", strokeLinejoin: "round" }),
                      (0, l.jsx)("path", { d: "M3 17.25H7.125", stroke: "currentColor", strokeWidth: "2.25", strokeLinecap: "round", strokeLinejoin: "round" })
                    ]
                  }),
                  (0, l.jsx)("defs", {
                    children: (0, l.jsx)("clipPath", { id: "clip0_256_253", children: (0, l.jsx)("rect", { width: "24", height: "24", fill: "currentColor" }) })
                  })
                ]
              },
              "bold"
            )
          ],
          [
            "fill",
            (0, l.jsx)(
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
        o = (0, a.forwardRef)((e, t) => (0, l.jsx)(r.Z, { viewBox: "0 0 24 24", ref: t, ...e, weights: n }));
      o.displayName = "Sort";
      let i = o;
    },
    51918: function (e, t, s) {
      s.a(e, async function (e, l) {
        try {
          s.r(t), s.d(t, { default: () => h });
          var r = s(52322),
            a = s(76131),
            n = s(75958),
            o = s(2784),
            i = s(36321),
            c = s(43477),
            d = s(84601),
            u = s(78972),
            x = s(20365),
            m = e([d, a, x, u, c]);
          ([d, a, x, u, c] = m.then ? (await m)() : m),
            (0, n.Pi)(e => {
              let { governanceStore: t, chainTagsStore: s } = e,
                [l, n] = (0, o.useState)();
              return (
                (0, a.$)({
                  page: "governance",
                  queryStatus: t.chainProposals.status,
                  op: "governancePageLoad",
                  description: "loading state on governance page"
                }),
                void 0 === l
                  ? (0, r.jsx)(u.t_, {
                      onClick: e => n(e),
                      governanceStore: t,
                      delegationsStore: d.xO,
                      validatorsStore: d.fe,
                      unDelegationsStore: d.GO,
                      claimRewardsStore: d.eq,
                      chainTagsStore: s
                    })
                  : (0, r.jsx)(u.vu, { governanceStore: t, selectedProp: l, onBack: () => n(void 0) })
              );
            }),
            (0, n.Pi)(e => {
              let { governanceStore: t, chainTagsStore: s } = e,
                [l, n] = (0, o.useState)(),
                { data: i, status: c, shouldUseFallback: d, fetchMore: m } = t.chainProposals;
              (0, a.$)({ page: "governance", queryStatus: c, op: "governancePageLoad", description: "loading state on governance page" });
              let h = e => {
                  let t = null == e ? void 0 : e.status;
                  switch (null == e ? void 0 : e.status) {
                    case u.BC.PROPOSAL_STATUS_EXECUTED:
                      t = x.uA.EXECUTED;
                      break;
                    case u.BC.PROPOSAL_STATUS_REJECTED:
                      t = x.uA.REJECTED;
                      break;
                    case u.BC.PROPOSAL_STATUS_PASSED:
                      t = x.uA.PASSED;
                      break;
                    case u.BC.PROPOSAL_STATUS_IN_PROGRESS:
                    case u.BC.PROPOSAL_STATUS_VOTING_PERIOD:
                      t = x.uA.OPEN;
                  }
                  return { ...e, status: t };
                },
                f = (0, o.useMemo)(() => (d ? i : null == i ? void 0 : i.map(e => h(e))), [i, d]);
              return void 0 === l
                ? (0, r.jsx)(x.DJ, { proposalListStatus: c, proposalList: f, shouldPreferFallback: d, onClick: e => n(e), chainTagsStore: s, fetchMore: m })
                : (0, r.jsx)(x.CM, { selectedProp: l, onBack: () => n(void 0), proposalList: f, shouldUseFallback: d });
            });
          let h = function () {
            return (
              (0, o.useEffect)(() => {
                c.P.initialize();
              }, []),
              (0, r.jsx)(u.kK, { governanceStore: c.P, chainTagsStore: i.HN })
            );
          };
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    27573: function (e, t, s) {
      s.a(e, async function (e, l) {
        try {
          s.d(t, { k: () => b });
          var r = s(52322),
            a = s(41172),
            n = s(75377),
            o = s(9274),
            i = s(84916),
            c = s(88175),
            d = s(75958),
            u = s(2784),
            x = s(10289),
            m = s(7474),
            h = s(87315),
            f = s(2612),
            p = s(60960),
            v = s(78972),
            g = e([h, f, v]);
          [h, f, v] = g.then ? (await g)() : g;
          let b = (0, d.Pi)(e => {
            let { governanceStore: t, chainTagsStore: s } = e;
            (0, x.s0)();
            let { theme: l } = (0, n.useTheme)(),
              [d, g] = (0, u.useState)(!1),
              { votingProposals: b, nonVotingProposals: j, perChainShouldUseFallback: S } = t.aggregatedGov,
              N = t.aggregatedGovStatus,
              w = (0, a.DI5)(),
              [y, _] = (0, u.useState)(!1),
              [E, P] = (0, u.useState)(""),
              [C, T] = (0, u.useState)(),
              [O, k] = (0, u.useState)(!1),
              [A, R] = (0, u.useState)(),
              D = (0, u.useMemo)(() => {
                let e = b.filter(e => (0, h.G0)(e, E, w)).sort((e, t) => (0, h.P9)(e, t, w)),
                  t = j.filter(e => (0, h.G0)(e, E, w)).sort((e, t) => (0, h.P9)(e, t, w));
                return [...e, ...t];
              }, [b, j, E, w]),
              L = (0, u.useCallback)(
                (e, t) => {
                  T(e), k(S[t]), R(t);
                },
                [S]
              ),
              I = (0, u.useCallback)(() => {
                T(void 0), R(void 0), k(!1);
              }, []);
            return (0, r.jsx)(r.Fragment, {
              children:
                C && A
                  ? (0, r.jsx)(f.Z, {
                      selectedProposalChain: A,
                      selectedProposalId: C,
                      handleProposalDetailsBack: I,
                      allProposals: D,
                      forceNetwork: "mainnet",
                      shouldUseFallback: O
                    })
                  : (0, r.jsxs)(r.Fragment, {
                      children: [
                        (0, r.jsx)(p.Z, {}),
                        (0, r.jsxs)("div", {
                          className: "flex flex-col p-6 !pb-0 h-full",
                          children: [
                            (0, r.jsx)("div", {
                              className: "flex flex-col items-center w-full pb-6",
                              children: (0, r.jsx)(i.M, { onClear: () => P(""), placeholder: "Search proposal", onChange: e => P(e.target.value), value: E })
                            }),
                            (0, r.jsx)("div", {
                              className: "flex h-full",
                              children: N
                                ? (0, r.jsx)("div", {
                                    className: "w-full flex flex-col gap-3",
                                    children: Array.from({ length: 5 }).map((e, t) => (0, r.jsx)(o.Z, { isLast: 4 === t, aggregatedView: !0 }, t))
                                  })
                                : D.length > 0
                                  ? (0, r.jsx)(m.OO, {
                                      data: D,
                                      style: { flexGrow: "1", width: "100%" },
                                      itemContent: (e, t) =>
                                        (0, r.jsx)(v.$J, {
                                          proposal: t,
                                          handleClick: () => {
                                            var t;
                                            return L(D[e].proposal_id, (null === (t = D[e]) || void 0 === t ? void 0 : t.chain) || "cosmos");
                                          }
                                        })
                                    })
                                  : (0, r.jsx)(r.Fragment, {
                                      children: (0, r.jsx)("div", {
                                        className: "w-full pb-6 h-full ",
                                        children: (0, r.jsxs)("div", {
                                          className:
                                            "h-full px-5 w-full flex-col flex justify-center items-center gap-4 border border-secondary-200 rounded-2xl",
                                          children: [
                                            (0, r.jsx)("div", {
                                              className: "p-2 bg-secondary-200 rounded-full",
                                              children: (0, r.jsx)(c.J, { size: 40, className: "text-muted-foreground" })
                                            }),
                                            (0, r.jsxs)("div", {
                                              className: "flex flex-col justify-start items-center w-full gap-3",
                                              children: [
                                                (0, r.jsx)("div", {
                                                  className: "text-[18px] !leading-[24px] text-center font-bold text-foreground",
                                                  children: "No proposals found"
                                                }),
                                                E.trim().length > 0
                                                  ? (0, r.jsx)("div", {
                                                      className: "text-xs !leading-[16px] text-secondary-800 text-center",
                                                      children: "We couldn't find a match. Try searching again or use a different keyword."
                                                    })
                                                  : null
                                              ]
                                            })
                                          ]
                                        })
                                      })
                                    })
                            })
                          ]
                        })
                      ]
                    })
            });
          });
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    97407: function (e, t, s) {
      s.a(e, async function (e, l) {
        try {
          s.d(t, { S: () => _ });
          var r = s(52322),
            a = s(56594),
            n = s(41172),
            o = s(15969),
            i = s(92642),
            c = s(72779),
            d = s.n(c),
            u = s(58885),
            x = s(80588),
            m = s(96217),
            h = s(72059),
            f = s(65027),
            p = s(75958),
            v = s(2784),
            g = s(42799),
            b = s(48346),
            j = s(74079),
            S = s(78972),
            N = s(11613),
            w = e([f, h, u, b, x, S, N]);
          [f, h, u, b, x, S, N] = w.then ? (await w)() : w;
          let y = f.w.useGetWallet,
            _ = (0, p.Pi)(e => {
              var t, s;
              let {
                  className: l,
                  proposalId: c,
                  refetchVote: f,
                  showCastVoteSheet: p,
                  setShowCastVoteSheet: w,
                  isProposalInVotingPeriod: _,
                  forceChain: E,
                  forceNetwork: P
                } = e,
                C = (0, h.a7)(),
                [T, O] = (0, v.useState)(!1),
                k = (0, v.useMemo)(() => E || C, [C, E]),
                A = (0, n.obn)(),
                R = (0, v.useMemo)(() => P || A, [A, P]),
                D = g.gb.allDenoms,
                L = (0, u.e7)(D, { activeChain: k, selectedNetwork: R }),
                I = y(),
                M = (0, j._)(),
                U = (0, n.dco)(),
                V = (0, n.DR3)(k),
                {
                  loading: G,
                  vote: B,
                  error: F,
                  memo: Z,
                  setMemo: z,
                  feeText: H,
                  showLedgerPopup: $,
                  clearError: Y,
                  ledgerError: W
                } = (0, n.e5I)({ denoms: D, proposalId: c, forceChain: k, forceNetwork: R }),
                { lcdUrl: J } = (0, n.U9i)(k, R),
                q = (0, n.VMC)(),
                Q = (0, n.bkk)(D, k, R),
                X = (0, n._ty)(k),
                [K, ee] = (0, v.useState)(!1),
                [et, es] = (0, v.useState)(null),
                [el, er] = (0, v.useState)(Q),
                [ea, en] = (0, v.useState)(void 0),
                [eo, ei] = (0, v.useState)(
                  (null === (s = U[k]) || void 0 === s ? void 0 : null === (t = s.DEFAULT_GAS_TRANSFER) || void 0 === t ? void 0 : t.toString()) ??
                    o.N7W.DEFAULT_GAS_TRANSFER.toString()
                ),
                [ec, ed] = (0, v.useState)(eo),
                [eu, ex] = (0, v.useState)({ option: n.j1p.LOW, gasPrice: L.gasPrice }),
                em = (0, n.dju)(k, R),
                eh = (0, n.con)(k, R),
                ef = (0, n.q5i)(k, R),
                ep = (0, v.useRef)(!0);
              (0, v.useEffect)(() => {
                !(async function () {
                  let e, t, s;
                  let l = !1;
                  if (
                    ("uosmo" === el.coinMinimalDenom && "osmosis" === k
                      ? (({ low: e, medium: t, high: s } = await (0, o.Q3h)(J ?? "", q)), (l = !0))
                      : eh &&
                        el.coinMinimalDenom === (null == Q ? void 0 : Q.coinMinimalDenom) &&
                        (({ low: e, medium: t, high: s } = await ef(el.coinMinimalDenom)), (l = !0)),
                    l)
                  )
                    switch (eu.option) {
                      case n.j1p.LOW:
                        ex(t => ({ ...t, gasPrice: o.DB5.fromString(`${e}${el.coinMinimalDenom}`) }));
                        break;
                      case n.j1p.MEDIUM:
                        ex(e => ({ ...e, gasPrice: o.DB5.fromString(`${t}${el.coinMinimalDenom}`) }));
                        break;
                      case n.j1p.HIGH:
                        ex(e => ({ ...e, gasPrice: o.DB5.fromString(`${s}${el.coinMinimalDenom}`) }));
                    }
                })();
              }, [k, ec, el.coinMinimalDenom, eu.option, null == Q ? void 0 : Q.coinMinimalDenom]);
              let ev = (0, v.useMemo)(() => {
                  let e = Math.ceil(Number(ec) * X);
                  return (0, a.calculateFee)(e, eu.gasPrice);
                }, [X, ec, eu.gasPrice]),
                eg = (0, v.useCallback)((e, t) => {
                  ex(e), er({ ...t.denom, ibcDenom: t.ibcDenom });
                }, []),
                eb = (0, v.useCallback)(
                  e => {
                    O(!0);
                  },
                  [O]
                ),
                ej = (0, v.useCallback)(
                  async e => {
                    try {
                      let t = await I(k);
                      return !!(await B({ wallet: t, callback: eb, voteOption: e, customFee: { stdFee: ev, feeDenom: el }, isSimulation: !1 }));
                    } catch (t) {
                      return (
                        (0, i.Tb)(t, {
                          tags: {
                            errorType: "submit_vote_error",
                            source: "submit_vote",
                            severity: "error",
                            errorName: t instanceof Error ? t.name : "SubmitVoteError"
                          },
                          fingerprint: ["submit_vote", "submit_vote_error"],
                          level: "error",
                          contexts: { transaction: { type: "submit_vote", errorMessage: t instanceof Error ? t.message : String(t) } },
                          extra: { chain: k, proposalId: c, voteOption: e, customFee: ev, feeDenom: el }
                        }),
                        !1
                      );
                    }
                  },
                  [k, ev, el, I, M, B]
                ),
                eS = (0, v.useCallback)(() => {
                  en(void 0), w(!1), Y();
                }, [Y, w]),
                eN = (0, v.useCallback)(() => {
                  ee(!1);
                }, []);
              return (
                (0, v.useEffect)(() => {
                  let e = !1,
                    t = async () => {
                      try {
                        let t = (0, o.f3G)(el.coinMinimalDenom),
                          s = await em({ proposalId: c, voteOption: n.RWi.YES, fee: t });
                        if (null !== s && !e) {
                          let e = s.gasUsed.toString();
                          ei(String(Number(e) * (V === o.Ufz.Version_Point_47 ? 1.5 : 1))),
                            ep.current && (ed(String(Number(e) * (V === o.Ufz.Version_Point_47 ? 1.5 : 1))), (ep.current = !1));
                        }
                      } catch (e) {
                        (0, i.Tb)(e, {
                          tags: {
                            errorType: "submit_vote_simulate_error",
                            source: "submit_vote_simulate",
                            severity: "error",
                            errorName: e instanceof Error ? e.name : "SubmitVoteError"
                          },
                          fingerprint: ["submit_vote_simulate", "submit_vote_simulate_error"],
                          level: "error",
                          contexts: { transaction: { type: "submit_vote_simulate", errorMessage: e instanceof Error ? e.message : String(e) } },
                          extra: { chain: k, proposalId: c, voteOption: n.RWi.YES }
                        });
                      }
                    };
                  return (
                    _ && t().catch(i.Tb),
                    () => {
                      e = !0;
                    }
                  );
                }, [V, c, em, _]),
                (0, v.useEffect)(() => {
                  ex({ option: n.j1p.LOW, gasPrice: L.gasPrice });
                }, [L.gasPrice.amount.toString(), L.gasPrice.denom]),
                (0, r.jsx)("div", {
                  className: d()("", l),
                  children: (0, r.jsxs)(u.ZP, {
                    recommendedGasLimit: eo,
                    gasLimit: ec,
                    setGasLimit: e => ed(e.toString()),
                    gasPriceOption: eu,
                    onGasPriceOptionChange: eg,
                    error: et,
                    setError: es,
                    chain: k,
                    network: R,
                    rootDenomsStore: g.gb,
                    rootBalanceStore: b.jZ,
                    children: [
                      (0, r.jsx)(m.Z, {
                        isOpen: p && !$,
                        onClose: () => w(!1),
                        title: "Call your Vote",
                        className: "!pt-8 p-6",
                        children: (0, r.jsx)(S.at, {
                          feeDenom: el,
                          gasLimit: ec,
                          gasPrice: eu.gasPrice,
                          setShowFeesSettingSheet: ee,
                          onSubmitVote: en,
                          setRecommendedGasLimit: ei,
                          proposalId: c,
                          isProposalInVotingPeriod: _,
                          setGasLimit: ed,
                          forceChain: k,
                          forceNetwork: R
                        })
                      }),
                      (0, r.jsx)(x.k, { showFeesSettingSheet: K, onClose: eN, gasError: et }),
                      (0, r.jsx)(S.ro, {
                        isOpen: void 0 !== ea,
                        proposalId: c,
                        error: F,
                        ledgerError: W,
                        loading: G,
                        feeText: H,
                        memo: Z,
                        setMemo: z,
                        selectedVote: ea,
                        onSubmitVote: ej,
                        refetchCurrVote: f,
                        onCloseHandler: eS,
                        showLedgerPopup: $,
                        gasOption: eu.option,
                        forceChain: k
                      }),
                      T && (0, r.jsx)(N.u, { isOpen: T, onClose: () => O(!1), forceChain: E, forceNetwork: P, refetchVote: f })
                    ]
                  })
                })
              );
            });
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    8292: function (e, t, s) {
      s.a(e, async function (e, l) {
        try {
          s.d(t, { R: () => S, a: () => N });
          var r,
            a = s(52322),
            n = s(41172),
            o = s(15969),
            i = s(80229),
            c = s(89145),
            d = s(16698),
            u = s(92642),
            x = s(72779),
            m = s.n(x),
            h = s(51994),
            f = s(19623),
            p = s(91486),
            v = s(2784),
            g = s(46103),
            b = s(70514),
            j = e([h]);
          h = (j.then ? (await j)() : j)[0];
          var S = (((r = {}).YES = "Yes"), (r.NO = "No"), (r.NO_WITH_VETO = "No with Veto"), (r.ABSTAIN = "Abstain"), r);
          function N(e) {
            let {
                onSubmitVote: t,
                setShowFeesSettingSheet: s,
                setRecommendedGasLimit: l,
                proposalId: r,
                isProposalInVotingPeriod: x,
                setGasLimit: j,
                feeDenom: S,
                forceChain: N,
                forceNetwork: w
              } = e,
              y = (0, n.a74)(),
              _ = (0, v.useMemo)(() => N || y, [y, N]),
              E = (0, n.QSC)(_),
              P = (0, n.obn)(),
              C = (0, v.useMemo)(() => w || P, [P, w]),
              T = (0, n.dju)(_, C),
              O = (0, v.useRef)(!0),
              [k, A] = (0, v.useState)(!0),
              [R, D] = (0, v.useState)(void 0),
              L = (0, v.useMemo)(() => {
                let e = [
                  { label: "Yes", icon: (0, a.jsx)(i.V, { size: 20 }), selectedCSS: "text-white-100 bg-green-600" },
                  { label: "No", icon: (0, a.jsx)(c.L, { size: 20 }), selectedCSS: "text-white-100 bg-red-300" }
                ];
                return (
                  "atomone-1" !== E.chainId &&
                    e.push({ label: "No with Veto", icon: (0, a.jsx)(c.L, { size: 20 }), selectedCSS: "text-white-100 bg-indigo-300" }),
                  e.push({ label: "Abstain", icon: (0, a.jsx)(d.q, { size: 20 }), selectedCSS: "text-white-100 bg-yellow-600" }),
                  e
                );
              }, [E.chainId]);
            return (
              (0, v.useEffect)(() => {
                let e = !1,
                  t = async () => {
                    try {
                      let t = (0, o.f3G)(S.coinMinimalDenom),
                        s = await T({ proposalId: r, voteOption: "Yes", fee: t });
                      if (null !== s && !e) {
                        let e = s.gasUsed.toString();
                        l(e), O.current && (j(e), (O.current = !1));
                      }
                    } catch (e) {
                      (0, u.Tb)(e, {
                        tags: {
                          errorType: "submit_vote_simulate_error",
                          source: "submit_vote_simulate",
                          severity: "error",
                          errorName: e instanceof Error ? e.name : "SubmitVoteError"
                        },
                        fingerprint: ["submit_vote_simulate", "submit_vote_simulate_error"],
                        level: "error",
                        contexts: { transaction: { type: "submit_vote_simulate", errorMessage: e instanceof Error ? e.message : String(e) } }
                      });
                    } finally {
                      A(!1);
                    }
                  };
                return (
                  x && t().catch(u.Tb),
                  () => {
                    e = !0;
                  }
                );
              }, [S.coinMinimalDenom, r, T, x]),
              (0, a.jsxs)(a.Fragment, {
                children: [
                  (0, a.jsx)("div", {
                    className: "flex flex-col items-center gap-3",
                    children: L.map(e =>
                      (0, a.jsxs)(
                        "button",
                        {
                          onClick: () => D(e.label),
                          className: m()("flex items-center w-full px-5 py-4 rounded-xl cursor-pointer border", {
                            "bg-secondary-100 text-foreground hover:bg-secondary-200 border-transparent": R !== e.label,
                            "text-green-600 bg-green-500/10 border-green-600": R === e.label
                          }),
                          children: [
                            (0, a.jsx)("span", { className: "mr-3", children: e.icon }),
                            (0, a.jsx)("span", {
                              className: (0, b.cn)("text-base font-bold", { "text-foreground": R !== e.label, "text-green-600": R === e.label }),
                              children: e.label
                            })
                          ]
                        },
                        e.label
                      )
                    )
                  }),
                  k
                    ? (0, a.jsx)("div", { className: "flex justify-center", children: (0, a.jsx)(f.T, { color: g.w.green600 }) })
                    : (0, a.jsx)(h.a, { className: "mt-4", setShowFeesSettingSheet: s }),
                  (0, a.jsx)(p.zx, {
                    className: "w-full mt-6",
                    disabled: !R || k,
                    onClick: () => t(R),
                    "aria-label": "submit button in cast vote sheet flow",
                    children: (0, a.jsx)("span", { "aria-label": "submit button text in cast vote sheet flow", children: "Submit" })
                  })
                ]
              })
            );
          }
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    2612: function (e, t, s) {
      s.a(e, async function (e, l) {
        try {
          s.d(t, { Z: () => i });
          var r = s(52322);
          s(2784);
          var a = s(20365),
            n = s(78972),
            o = e([a, n]);
          function i(e) {
            let { selectedProposalChain: t, selectedProposalId: s, handleProposalDetailsBack: l, allProposals: o, shouldUseFallback: i, forceNetwork: c } = e;
            return "neutron" === t
              ? (0, r.jsx)(a.CM, { selectedProp: s, onBack: l, proposalList: o, shouldUseFallback: i, forceChain: t, forceNetwork: c })
              : (0, r.jsx)(n.vu, {
                  selectedProp: s,
                  onBack: l,
                  forceChain: t,
                  forceNetwork: c,
                  governanceStore: { chainProposals: { data: o, shouldUseFallback: i } }
                });
          }
          ([a, n] = o.then ? (await o)() : o), l();
        } catch (e) {
          l(e);
        }
      });
    },
    60960: function (e, t, s) {
      s.d(t, { Z: () => i });
      var l = s(52322),
        r = s(43166),
        a = s(85027),
        n = s(69816);
      s(2784);
      var o = s(10289);
      let i = e => {
        let { title: t, onBack: s } = e,
          i = (0, o.s0)();
        return (0, l.jsxs)(a.m, {
          children: [
            (0, l.jsx)(r.X, {
              className: "size-9 p-2 cursor-pointer text-muted-foreground hover:text-foreground",
              onClick: () => {
                s ? s() : i(-1);
              }
            }),
            (0, l.jsx)(n.Z, { className: "text-[18px] font-bold !leading-6", color: "text-monochrome", children: t ?? "Governance" }),
            (0, l.jsx)("div", { className: "w-9 h-9" })
          ]
        });
      };
    },
    68671: function (e, t, s) {
      s.d(t, { $: () => n });
      var l = s(52322),
        r = s(41172);
      s(2784);
      var a = s(62227);
      function n(e) {
        var t, s;
        let { proposal: n, style: o, handleClick: i } = e,
          c = (0, r.QSC)(n.chain ?? "cosmos");
        return (0, l.jsxs)("div", {
          className:
            "flex flex-col items-start justify-start p-5 cursor-pointer w-full bg-secondary-100 hover:bg-secondary-200 transition-colors rounded-xl mb-6",
          style: o,
          onClick: i,
          children: [
            (0, l.jsx)("p", { className: "text-muted-foreground text-xs font-bold mb-3", children: (null == c ? void 0 : c.chainName) ?? "Unknown Chain" }),
            (0, l.jsx)("p", {
              className: "text-foreground font-bold text-[18px] mb-1",
              title: (null == n ? void 0 : n.title) ?? (null == n ? void 0 : null === (t = n.content) || void 0 === t ? void 0 : t.title),
              children: (null == n ? void 0 : n.title) ?? (null == n ? void 0 : null === (s = n.content) || void 0 === s ? void 0 : s.title)
            }),
            (0, l.jsxs)("p", {
              className: "text-muted-foreground text-sm font-medium",
              children: ["#", n.proposal_id, " \xb7 ", (0, l.jsx)(a.M, { status: n.status })]
            })
          ]
        });
      }
    },
    24623: function (e, t, s) {
      s.a(e, async function (e, l) {
        try {
          s.d(t, { v: () => A });
          var r = s(52322),
            a = s(41172),
            n = s(15969),
            o = s(26007),
            i = s(92642),
            c = s(60431),
            d = s(55334),
            u = s(79645),
            x = s(69816),
            m = s(91486),
            h = s(74229),
            f = s(10706),
            p = s(57124),
            v = s(18203),
            g = s(75958),
            b = s(2784),
            j = s(86874),
            S = s(693),
            N = s(80502),
            w = s(84601),
            y = s(70514),
            _ = s(49409),
            E = s(87315),
            P = s(60960),
            C = s(78972),
            T = s(62227),
            O = e([f, w, E, u, C]);
          [f, w, E, u, C] = O.then ? (await O)() : O;
          let k = [T.B.PROPOSAL_STATUS_VOTING_PERIOD, T.B.PROPOSAL_STATUS_DEPOSIT_PERIOD],
            A = (0, g.Pi)(e => {
              var t, s, l, g, O, A;
              let { selectedProp: R, onBack: D, forceChain: L, forceNetwork: I, governanceStore: M } = e,
                { data: U, shouldUseFallback: V } = M.chainProposals,
                G = (0, a.a74)(),
                B = (0, b.useMemo)(() => L || G, [G, L]),
                F = (0, a.obn)(),
                Z = (0, b.useMemo)(() => I || F, [F, I]),
                { activeWallet: z } = (0, f.ZP)(),
                H = (0, a.SFn)(B),
                $ = (0, a.QSC)(B),
                { lcdUrl: Y, txUrl: W } = (0, a.U9i)(B, Z),
                [J, q] = (0, b.useState)(!1),
                Q = (0, p.a)(),
                { delegationInfo: X } = w.xO.delegationsForChain(B),
                K = (0, b.useMemo)(() => {
                  if ("cosmos" === B || "atomone-1" === $.chainId) {
                    var e;
                    return null == X ? void 0 : null === (e = X.totalDelegation) || void 0 === e ? void 0 : e.gte(1);
                  }
                  return !0;
                }, [B, null == X ? void 0 : X.totalDelegation, $.chainId]),
                { topChainColor: ee } = (0, h.Cd)(),
                et = (0, b.useMemo)(() => U.find(e => e.proposal_id === R), [U, R]),
                es = (0, b.useMemo)(() => [T.B.PROPOSAL_STATUS_VOTING_PERIOD, T.B.PROPOSAL_STATUS_IN_PROGRESS].includes(et.status), [et.status]),
                {
                  data: el,
                  refetch: er,
                  isLoading: ea
                } = (0, c.useQuery)(
                  ["currVote", B, H, R],
                  async () => {
                    if (B)
                      try {
                        let { data: e } = await d.Z.post(`https://api.leapwallet.io/gov/vote/${$.chainId}/${R}`, { userAddress: H });
                        return e;
                      } catch (t) {
                        try {
                          let e = "/cosmos";
                          return (
                            (null == $ ? void 0 : $.chainId) === "govgen-1" && (e = "/govgen"),
                            (null == $ ? void 0 : $.chainId) === "atomone-1" && (e = "/atomone"),
                            (
                              await (0, n.F$d)({ baseURL: Y ?? "", method: "get", url: `${e}/gov/v1beta1/proposals/${R}/votes/${H}` }, 1, "proposals-votes")
                            ).data.vote.options[0].option.replace("VOTE_OPTION_", "")
                          );
                        } catch (t) {
                          var e;
                          if (3 === t.response.data.code || (null === (e = t.response.data.error) || void 0 === e ? void 0 : e.code) === -32700)
                            return "NO_VOTE";
                          throw (
                            ((0, i.Tb)(t, {
                              tags: {
                                errorType: "get_proposal_vote_error",
                                source: "get_proposal_vote",
                                severity: "error",
                                errorName: t instanceof Error ? t.name : "GetProposalVoteError"
                              },
                              fingerprint: ["get_proposal_vote", "get_proposal_vote_error"],
                              level: "error",
                              contexts: { transaction: { type: "get_proposal_vote", errorMessage: t instanceof Error ? t.message : String(t) } },
                              extra: { chain: B, proposalId: R }
                            }),
                            Error(t))
                          );
                        }
                      }
                  },
                  { retry: e => 2 !== e, enabled: es }
                ),
                { data: en, status: eo } = (0, a._rB)(et.proposal_id, V, B, Z);
              eo = V ? eo : "success";
              let { yes: ei, no: ec, abstain: ed, no_with_veto: eu } = et.tally || en || et.final_tally_result,
                ex = [ei, ec, ed, eu].reduce((e, t) => e + Number(t ?? 0), 0) || 1,
                em = (0, b.useMemo)(() => {
                  if (!ex) return [{ title: "loading", value: 1, color: "#ccc", percent: "0%" }];
                  let e = [
                    { title: "YES", value: +ei, color: "#29A874", percent: (0, E.DU)(+ei, ex) },
                    { title: "NO", value: +ec, color: "#FF707E", percent: (0, E.DU)(+ec, ex) }
                  ];
                  return (
                    "atomone-1" !== $.chainId && e.push({ title: "No with Veto", value: +eu, color: "#8583EC", percent: (0, E.DU)(+eu, ex) }),
                    e.push({ title: "Abstain", value: +ed, color: "#D1A700", percent: (0, E.DU)(+ed, ex) }),
                    e
                  );
                }, [ed, ec, eu, ex, ei, $.chainId]),
                eh = (0, b.useMemo)(() => {
                  let e = null == en ? void 0 : en.bonded_tokens;
                  if (["initia", "initiaEvm"].includes(B) && Array.isArray(e) && Array.isArray(null == en ? void 0 : en.voting_power_weights)) {
                    var t;
                    let s = null == en ? void 0 : en.bonded_tokens,
                      l = null == en ? void 0 : en.voting_power_weights;
                    e =
                      null ===
                        (t = s.reduce((e, t) => {
                          var s;
                          let r = null == l ? void 0 : null === (s = l.find(e => e.denom === t.denom)) || void 0 === s ? void 0 : s.amount;
                          return r ? (e += BigInt(parseInt(t.amount)) * BigInt(parseInt(r))) : e;
                        }, BigInt(0))) || void 0 === t
                        ? void 0
                        : t.toString();
                  }
                  return [
                    { label: "Turnout", value: V ? (ex / e) * 100 : et.turnout },
                    { label: "Quorum", value: V ? (null == en ? void 0 : en.quorum) * 100 : et.quorum }
                  ];
                }, [en, B, et.quorum, et.turnout, V, ex]),
                ef = (0, b.useMemo)(() => {
                  var e, t, s, l, r, a;
                  return V
                    ? (null == en ? void 0 : null === (e = en.proposer) || void 0 === e ? void 0 : e.depositor)
                      ? {
                          address: null == en ? void 0 : null === (t = en.proposer) || void 0 === t ? void 0 : t.depositor,
                          url: null == en ? void 0 : en.proposerTxUrl
                        }
                      : void 0
                    : (null == et ? void 0 : null === (s = et.proposer) || void 0 === s ? void 0 : s.address)
                      ? {
                          address: null == et ? void 0 : null === (l = et.proposer) || void 0 === l ? void 0 : l.address,
                          url:
                            (null == et ? void 0 : null === (r = et.proposer) || void 0 === r ? void 0 : r.url) ??
                            `${null == W ? void 0 : W.replace("txs", "account")}/${null == et ? void 0 : null === (a = et.proposer) || void 0 === a ? void 0 : a.address}`
                        }
                      : void 0;
                }, [
                  null == en ? void 0 : null === (t = en.proposer) || void 0 === t ? void 0 : t.depositor,
                  null == en ? void 0 : en.proposerTxUrl,
                  null == et ? void 0 : null === (s = et.proposer) || void 0 === s ? void 0 : s.address,
                  null == et ? void 0 : null === (l = et.proposer) || void 0 === l ? void 0 : l.url,
                  V,
                  W
                ]);
              return (0, r.jsxs)(r.Fragment, {
                children: [
                  (0, r.jsx)(P.Z, { onBack: D, title: "Proposal" }),
                  (0, r.jsxs)("div", {
                    className: "flex flex-col p-6 overflow-y-scroll",
                    children: [
                      (0, r.jsxs)("div", {
                        className: "text-muted-foreground text-sm mb-2 font-medium",
                        children: ["#", et.proposal_id, " \xb7", " ", (0, r.jsx)(T.M, { status: et.status })]
                      }),
                      (0, r.jsx)("div", {
                        className: "text-foreground font-bold text-lg break-words",
                        children: (null == et ? void 0 : et.title) ?? (null == et ? void 0 : null === (g = et.content) || void 0 === g ? void 0 : g.title)
                      }),
                      et.status === T.B.PROPOSAL_STATUS_VOTING_PERIOD && !K && (0, r.jsx)(C.GF, { forceChain: B, forceNetwork: Z }),
                      (0, r.jsx)(C.Og, {
                        proposal: et,
                        activeChain: B,
                        onVote: () => {
                          (null == z ? void 0 : z.watchWallet) ? N.o.setShowPopup(!0) : q(!0);
                        },
                        currVote: el ?? "",
                        isLoading: ea,
                        hasMinStaked: K
                      }),
                      (0, r.jsx)("div", { className: "my-5" }),
                      et.status !== T.B.PROPOSAL_STATUS_DEPOSIT_PERIOD &&
                        ex &&
                        (0, r.jsxs)(r.Fragment, {
                          children: [
                            (0, r.jsx)("div", {
                              className: "w-full h-full flex items-center justify-center mb-8",
                              children: (0, r.jsxs)("div", {
                                className: "w-[180px] h-[180px] flex items-center justify-center relative",
                                children: [
                                  "success" !== eo
                                    ? (0, r.jsx)(j.Z, { circle: !0, count: 1, width: "180px", height: "180px" })
                                    : (0, r.jsx)(S.PieChart, { data: em, lineWidth: 20 }),
                                  (0, r.jsx)("p", { className: "text-md dark:text-white-100 text-dark-gray font-bold absolute", children: "Current Status" })
                                ]
                              })
                            }),
                            (0, r.jsx)(C.HI, { dataMock: em, chain: $ }),
                            (0, r.jsx)(C.M, { tallying: eh })
                          ]
                        }),
                      k.includes(et.status) &&
                        (null == ef ? void 0 : ef.address) &&
                        (0, r.jsxs)("div", {
                          className: `rounded-2xl ${T.B.PROPOSAL_STATUS_DEPOSIT_PERIOD === et.status ? "" : "mt-7"} h-20 w-full p-5 flex items-center justify-between roundex-xxl bg-secondary-100`,
                          children: [
                            (0, r.jsxs)("div", {
                              className: "flex items-center",
                              children: [
                                (0, r.jsxs)("div", {
                                  style: { backgroundColor: "#FFECA8", lineHeight: 28 },
                                  className: "relative h-10 w-10 rounded-full flex items-center justify-center text-lg",
                                  children: [
                                    (0, r.jsx)("span", { className: "leading-none", children: "\uD83D\uDC64" }),
                                    (0, r.jsx)("img", {
                                      src: $.chainSymbolImageUrl ?? Q,
                                      onError: (0, _._)(Q),
                                      alt: "chain logo",
                                      width: "16",
                                      height: "16",
                                      className: "rounded-full absolute bottom-0 right-0"
                                    })
                                  ]
                                }),
                                (0, r.jsxs)("div", {
                                  className: "flex flex-col ml-3",
                                  children: [
                                    (0, r.jsx)(x.Z, { size: "sm", color: "text-foreground", className: "font-bold", children: "Proposer" }),
                                    ef
                                      ? (0, r.jsx)(x.Z, {
                                          size: "xs",
                                          color: "text-muted-foreground",
                                          children: `${ef.address.slice(0, 5)}...${ef.address.slice(-6)}`
                                        })
                                      : (0, r.jsx)(j.Z, { count: 1, height: "16px", width: "150px", className: "z-0" })
                                  ]
                                })
                              ]
                            }),
                            (null == ef ? void 0 : ef.url) &&
                              (0, r.jsx)("button", {
                                className: "flex items-center justify-center px-1",
                                onClick: () => window.open(null == ef ? void 0 : ef.url, "_blank"),
                                children: (0, r.jsx)(o.O, { size: 18, className: "text-muted-foreground" })
                              })
                          ]
                        }),
                      (0, r.jsx)("div", { className: "mt-7" }),
                      ((null == et ? void 0 : et.description) || (null == et ? void 0 : null === (O = et.content) || void 0 === O ? void 0 : O.description)) &&
                        (0, r.jsx)(u.r, {
                          description:
                            (null == et ? void 0 : et.description) ||
                            (null == et ? void 0 : null === (A = et.content) || void 0 === A ? void 0 : A.description),
                          title: "Description",
                          btnColor: ee,
                          forceChain: B
                        })
                    ]
                  }),
                  et.status === T.B.PROPOSAL_STATUS_VOTING_PERIOD &&
                    (0, r.jsx)("div", {
                      className: "w-full p-4 mt-auto sticky bottom-0 bg-secondary-100 ",
                      children: (0, r.jsx)(m.zx, {
                        className: (0, y.cn)("w-full"),
                        onClick: () => {
                          (null == z ? void 0 : z.watchWallet) ? N.o.setShowPopup(!0) : q(!0);
                        },
                        disabled: !K,
                        children: (0, r.jsxs)("div", {
                          className: "flex justify-center text-white-100 items-center",
                          children: [(0, r.jsx)(v.Z, { size: 20, className: "mr-2" }), (0, r.jsx)("span", { children: "Vote" })]
                        })
                      })
                    }),
                  (0, r.jsx)(C.SN, {
                    refetchVote: er,
                    proposalId: et.proposal_id,
                    isProposalInVotingPeriod: es,
                    showCastVoteSheet: J,
                    setShowCastVoteSheet: q,
                    forceChain: B,
                    forceNetwork: Z
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
    79968: function (e, t, s) {
      s.a(e, async function (e, l) {
        try {
          s.d(t, { t: () => R });
          var r = s(52322),
            a = s(41172),
            n = s(75377),
            o = s(26227),
            i = s(72779),
            c = s.n(i),
            d = s(78944),
            u = s(14281),
            x = s(27963),
            m = s(78454),
            h = s(19623),
            f = s(9274),
            p = s(84916),
            v = s(74229),
            g = s(72059),
            b = s(36400),
            j = s(71845),
            S = s(30464),
            N = s(75958),
            w = s(7345),
            y = s(2784),
            _ = s(10289),
            E = s(42799),
            P = s(48534),
            C = s(71198),
            T = s(78972),
            O = s(62227),
            k = e([b, g, m, d, T, w]);
          [b, g, m, d, T, w] = k.then ? (await k)() : k;
          let A = [
              { key: "all", label: "All Proposals" },
              { key: O.B.PROPOSAL_STATUS_VOTING_PERIOD, label: "Voting in Progress" },
              { key: O.B.PROPOSAL_STATUS_PASSED, label: "Passed" },
              { key: O.B.PROPOSAL_STATUS_REJECTED, label: "Rejected" }
            ],
            R = (0, N.Pi)(e => {
              let {
                  onClick: t,
                  governanceStore: s,
                  delegationsStore: l,
                  validatorsStore: i,
                  unDelegationsStore: N,
                  claimRewardsStore: O,
                  chainTagsStore: k
                } = e,
                { status: R, data: D, fetchMore: L } = s.chainProposals,
                I = (0, b.pb)(),
                [M, U] = (0, y.useState)(""),
                V = (0, _.s0)(),
                [G, B] = (0, y.useState)(!1),
                [F, Z] = (0, y.useState)("all"),
                [z, H] = (0, y.useState)(!1),
                $ = (0, g.a7)(),
                Y = I[$],
                W = "loading" === R,
                J = E.gb.allDenoms,
                q = l.delegationsForChain($),
                Q = i.validatorsForChain($),
                X = N.unDelegationsForChain($),
                K = O.claimRewardsForChain($),
                { totalDelegation: ee } = (0, a.nDu)(J, q, Q, X, K, $),
                et = (0, y.useMemo)(() => ("cosmos" !== $ && "atomone-1" !== Y.chainId) || (null == ee ? void 0 : ee.gte(1)), [$, Y.chainId, ee]),
                es = (0, y.useMemo)(
                  () =>
                    null == D
                      ? void 0
                      : D.filter(e => "PROPOSAL_STATUS_DEPOSIT_PERIOD" !== e.status).reduce((e, t) => {
                          var s, l, r, a, n, o, i, c;
                          return (
                            "all" === F
                              ? M
                                ? ((null === (l = t.content) || void 0 === l
                                    ? void 0
                                    : null === (s = l.title) || void 0 === s
                                      ? void 0
                                      : s.toLowerCase().includes(M)) ||
                                    (null === (r = t.title) || void 0 === r ? void 0 : r.toLowerCase().includes(M)) ||
                                    (null === (a = t.proposal_id) || void 0 === a ? void 0 : a.toLowerCase().includes(M))) &&
                                  e.push(t)
                                : e.push(t)
                              : M || t.status !== F
                                ? t.status === F &&
                                  ((null === (o = t.content) || void 0 === o
                                    ? void 0
                                    : null === (n = o.title) || void 0 === n
                                      ? void 0
                                      : n.toLowerCase().includes(M)) ||
                                    (null === (i = t.title) || void 0 === i ? void 0 : i.toLowerCase().includes(M)) ||
                                    (null === (c = t.proposal_id) || void 0 === c ? void 0 : c.toLowerCase().includes(M))) &&
                                  e.push(t)
                                : e.push(t),
                            e
                          );
                        }, []),
                  [F, M, D]
                ),
                el = (0, y.useCallback)(e => {
                  Z(e), B(!1);
                }, []);
              (0, y.useEffect)(() => {
                let e = document.querySelector("#bottom");
                if (!e || (null == es ? void 0 : es.length) === 0 || "success" !== R) return;
                let t = new IntersectionObserver(
                  e => {
                    e[0].isIntersecting && L();
                  },
                  { root: null, rootMargin: "0px", threshold: 1 }
                );
                return (
                  t.observe(e),
                  () => {
                    t.disconnect();
                  }
                );
              }, [L, null == es ? void 0 : es.length, R]);
              let { headerChainImgSrc: er } = (0, v.Cd)();
              return (0, r.jsxs)("div", {
                className: "relative w-full panel-height enclosing-panel overflow-clip",
                children: [
                  (0, r.jsx)(m.Z, {
                    header: (0, r.jsx)(n.Header, {
                      action: { onClick: () => V(-1), type: n.HeaderActionType.BACK },
                      imgSrc: er,
                      onImgClick: () => H(!0),
                      title: "Governance"
                    }),
                    children: (0, r.jsxs)(r.Fragment, {
                      children: [
                        (0, r.jsx)(d.hN, {}),
                        (0, r.jsxs)("div", {
                          className: "w-full flex flex-col pt-6 pb-2 px-7 ",
                          children: [
                            (0, r.jsx)("div", { className: "text-[28px] text-black-100 dark:text-white-100 font-bold", children: "Proposals" }),
                            (0, r.jsxs)("div", {
                              className: "text-sm text-gray-600 font-bold",
                              children: ["List of proposals in ", (null == Y ? void 0 : Y.chainName) ?? ""]
                            }),
                            !et && (0, r.jsx)(T.GF, {}),
                            (0, r.jsxs)("div", {
                              className: "flex items-center justify-between mt-6 mb-4",
                              children: [
                                (0, r.jsx)(p.M, {
                                  placeholder: "Search proposals...",
                                  onChange: e => {
                                    U(e.currentTarget.value.toLowerCase());
                                  },
                                  value: M,
                                  onClear: () => U("")
                                }),
                                (0, r.jsx)("button", {
                                  className: "flex items-center justify-center h-10 bg-white-100 dark:bg-gray-900 rounded-full w-10 m-w-10 ml-3",
                                  style: { minWidth: 40 },
                                  onClick: () => B(!0),
                                  children: (0, r.jsx)(j.Z, { size: 20, className: "dark:text-white-100 text-gray-800" })
                                })
                              ]
                            })
                          ]
                        }),
                        (0, r.jsxs)("div", {
                          id: "governance-list",
                          className: "pb-8 px-7",
                          children: [
                            (0, r.jsx)("div", {
                              className: "rounded-2xl flex flex-col items-center w-full m-auto justify-center dark:bg-gray-900 bg-white-100",
                              children: W
                                ? Array.from({ length: 5 }).map((e, t) => (0, r.jsx)(f.Z, { isLast: 4 === t }, t))
                                : ((null == es ? void 0 : es.length) ?? 0) === 0
                                  ? (0, r.jsx)(x.S, {
                                      isRounded: !0,
                                      subHeading: M ? "Please try again with something else" : "",
                                      heading: M ? "No results for “" + (0, C.jr)(M) + "”" : "No Proposals",
                                      src: S.r.Misc.Explore
                                    })
                                  : null == es
                                    ? void 0
                                    : es.map((e, s) => {
                                        var l;
                                        return (0, r.jsxs)(
                                          "div",
                                          {
                                            className: "w-full",
                                            children: [
                                              (0, r.jsx)("div", {
                                                className: "p-4 cursor-pointer",
                                                onClick: () => t(e.proposal_id),
                                                children: (0, r.jsxs)("div", {
                                                  className: "flex items-center justify-between",
                                                  children: [
                                                    (0, r.jsx)("div", {
                                                      className: c()("w-[272px]", { "!w-[calc(100%-40px)]": (0, P.oj)() }),
                                                      children: (0, r.jsxs)("div", {
                                                        className: "flex flex-col",
                                                        children: [
                                                          (0, r.jsx)("div", {
                                                            className: "text-black-100 dark:text-white-100 font-bold text-base break-words",
                                                            children:
                                                              (null == e ? void 0 : e.title) ??
                                                              (null == e ? void 0 : null === (l = e.content) || void 0 === l ? void 0 : l.title)
                                                          }),
                                                          (0, r.jsxs)("div", {
                                                            className: "text-gray-600 dark:text-gray-200 text-xs",
                                                            children: ["#", e.proposal_id, " \xb7", " ", (0, r.jsx)(T.MO, { status: e.status })]
                                                          })
                                                        ]
                                                      })
                                                    }),
                                                    (0, r.jsx)("img", { className: "ml-5", src: S.r.Misc.RightArrow })
                                                  ]
                                                })
                                              }),
                                              s < es.length - 1 ? (0, r.jsx)(n.CardDivider, {}) : null
                                            ]
                                          },
                                          e.proposal_id
                                        );
                                      })
                            }),
                            (0, r.jsx)("div", { id: "bottom", className: "my-1" }),
                            "fetching-more" === R
                              ? (0, r.jsx)("div", { className: "px-7 flex items-center justify-center", children: (0, r.jsx)(h.T, { color: "white" }) })
                              : null
                          ]
                        })
                      ]
                    })
                  }),
                  (0, r.jsx)(w.Z, { isVisible: z, onClose: () => H(!1), chainTagsStore: k }),
                  (0, r.jsx)(u.Z, {
                    isOpen: G,
                    onClose: () => B(!1),
                    title: "Filter by",
                    children: (0, r.jsx)("div", {
                      className: "rounded-2xl flex flex-col items-center w-full justify-center dark:bg-gray-900 bg-white-100",
                      children: A.map((e, t) =>
                        (0, r.jsxs)(
                          y.Fragment,
                          {
                            children: [
                              (0, r.jsxs)(
                                "button",
                                {
                                  className: "flex items-center justify-between text-md font-bold p-4 w-full text-gray-800 dark:text-white-100",
                                  onClick: () => el(e.key),
                                  children: [
                                    (0, r.jsx)("span", { children: e.label }),
                                    F === e.key ? (0, r.jsx)(o.f, { weight: "fill", size: 24, className: "text-[#E18881]" }) : null
                                  ]
                                },
                                e.label
                              ),
                              t === A.length - 1 ? null : (0, r.jsx)(n.CardDivider, {})
                            ]
                          },
                          e.label
                        )
                      )
                    })
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
    62227: function (e, t, s) {
      s.d(t, { B: () => a, M: () => n });
      var l,
        r = s(52322);
      s(2784);
      var a =
        (((l = {}).PROPOSAL_STATUS_IN_PROGRESS = "PROPOSAL_STATUS_IN_PROGRESS"),
        (l.PROPOSAL_STATUS_DEPOSIT_PERIOD = "PROPOSAL_STATUS_DEPOSIT_PERIOD"),
        (l.PROPOSAL_STATUS_VOTING_PERIOD = "PROPOSAL_STATUS_VOTING_PERIOD"),
        (l.PROPOSAL_STATUS_PASSED = "PROPOSAL_STATUS_PASSED"),
        (l.PROPOSAL_STATUS_EXECUTED = "PROPOSAL_STATUS_EXECUTED"),
        (l.PROPOSAL_STATUS_FAILED = "PROPOSAL_STATUS_FAILED"),
        (l.PROPOSAL_STATUS_REJECTED = "PROPOSAL_STATUS_REJECTED"),
        (l.PROPOSAL_STATUS_UNSPECIFIED = "PROPOSAL_STATUS_UNSPECIFIED"),
        l);
      function n(e) {
        let { status: t } = e;
        switch (t) {
          case "PROPOSAL_STATUS_DEPOSIT_PERIOD":
            return (0, r.jsx)("span", { className: " font-semibold dark:text-orange-300 text-orange-600", children: "Deposit Period" });
          case "PROPOSAL_STATUS_VOTING_PERIOD":
            return (0, r.jsx)("span", { className: "font-semibold  dark:text-orange-300 text-orange-600", children: "Voting Period" });
          case "PROPOSAL_STATUS_PASSED":
            return (0, r.jsx)("span", { className: "font-semibold text-green-600 dark:text-green-300", children: "Passed" });
          case "PROPOSAL_STATUS_FAILED":
            return (0, r.jsx)("span", { className: "font-semibold text-red-300", children: "Failed" });
          case "PROPOSAL_STATUS_REJECTED":
            return (0, r.jsx)("span", { className: "font-semibold text-red-300", children: "Rejected" });
          case "PROPOSAL_STATUS_UNSPECIFIED":
            return (0, r.jsx)("span", { className: "font-semibold text-gray-400 ", children: "Unspecified" });
          default:
            return (0, r.jsx)("span", { className: "font-semibold text-gray-400", children: "Unspecified" });
        }
      }
    },
    67725: function (e, t, s) {
      s.d(t, { G: () => d });
      var l = s(52322),
        r = s(41172),
        a = s(75958),
        n = s(2784),
        o = s(10289),
        i = s(42799),
        c = s(48534);
      let d = (0, a.Pi)(e => {
        let { forceChain: t, forceNetwork: s } = e,
          a = (0, r.QSC)(t),
          d = i.gb.allDenoms,
          [u] = (0, r.JsT)(d, t, s),
          x = (0, o.s0)(),
          m = (0, n.useCallback)(() => {
            x("/stake");
          }, [x]);
        return (0, l.jsxs)("div", {
          className: "flex mt-4 p-4 w-full flex-row justify-between items-center gap-2 dark:bg-gray-900 bg-white-100 rounded-[20px]",
          children: [
            (0, l.jsxs)("div", {
              className: "text-xs font-medium !leading-[19.2px] dark:text-white-100",
              children: [
                a.chainName,
                " requires you to have ",
                !(0, c.oj)() && (0, l.jsx)("br", {}),
                "at least ",
                (0, l.jsxs)("span", { className: "font-bold", children: ["1 ", null == u ? void 0 : u.coinDenom, " staked"] }),
                " to start voting"
              ]
            }),
            (0, l.jsx)("button", {
              onClick: m,
              className:
                "rounded-full shrink-0 bg-gray-950 dark:bg-white-100 font-bold text-xs text-gray-100 py-[6px] px-[12px] dark:text-gray-950 !leading-[20px]",
              "aria-label": "stake button in require min staking flow",
              children: (0, l.jsxs)("span", {
                "aria-label": "stake button text in require min staking flow",
                children: ["Stake ", null == u ? void 0 : u.coinDenom]
              })
            })
          ]
        });
      });
    },
    20194: function (e, t, s) {
      s.d(t, { r: () => g });
      var l = s(52322),
        r = s(41172),
        a = s(75377),
        n = s(80229),
        o = s(72779),
        i = s.n(o),
        c = s(86200),
        d = s(42152),
        u = s(19623),
        x = s(96217),
        m = s(69816),
        h = s(91486),
        f = s(30942),
        p = s(2784),
        v = s(46103);
      function g(e) {
        let {
            isOpen: t,
            onCloseHandler: s,
            onSubmitVote: o,
            selectedVote: g,
            error: b,
            feeText: j,
            loading: S,
            memo: N,
            setMemo: w,
            proposalId: y,
            refetchCurrVote: _,
            showLedgerPopup: E,
            ledgerError: P,
            gasOption: C,
            forceChain: T
          } = e,
          O = (0, r.a74)();
        return ((0, p.useMemo)(() => T || O, [O, T]), (0, f.X)(b), E)
          ? (0, l.jsx)(d.Z, { showLedgerPopup: E })
          : (0, l.jsx)(x.Z, {
              isOpen: t,
              onClose: s,
              title: "Review Transaction",
              className: "p-6 !pt-8",
              children: (0, l.jsxs)("div", {
                className: "flex flex-col items-center gap-5",
                children: [
                  (0, l.jsxs)("div", {
                    className: i()("flex p-4 w-full bg-gray-50 dark:bg-gray-900 rounded-2xl"),
                    children: [
                      (0, l.jsx)("div", {
                        className: "h-10 w-10 bg-green-600 rounded-full flex items-center justify-center",
                        children: (0, l.jsx)(n.V, { size: 20, className: "text-foreground" })
                      }),
                      (0, l.jsxs)("div", {
                        className: "flex flex-col justify-center items-start px-3",
                        children: [
                          (0, l.jsx)("div", { className: "text-sm text-muted-foreground text-left", children: "Vote message" }),
                          (0, l.jsxs)("div", {
                            className: "text-[18px] text-foreground font-bold",
                            children: ["Vote ", (0, l.jsx)("b", { children: g }), " on ", (0, l.jsxs)("b", { children: ["Proposal #", y] })]
                          })
                        ]
                      })
                    ]
                  }),
                  (0, l.jsx)(a.Memo, {
                    value: N,
                    onChange: e => {
                      w(e.target.value);
                    }
                  }),
                  j && (0, l.jsx)(m.Z, { size: "sm", className: "text-gray-400 dark:text-gray-600 justify-center", children: j }),
                  (b ?? P) && (0, l.jsx)(c._, { text: (0, r.azN)(b ?? P ?? "", C, "vote"), disableSentryCapture: !0 }),
                  (0, l.jsx)(h.zx, {
                    className: "w-full mt-1",
                    disabled: E || S,
                    onClick: async () => {
                      void 0 !== g && (await o(g)) && s();
                    },
                    children: S ? (0, l.jsx)(u.T, { color: v.w.white100 }) : "Approve"
                  })
                ]
              })
            });
      }
    },
    81333: function (e, t, s) {
      s.a(e, async function (e, l) {
        try {
          s.d(t, { H: () => d });
          var r = s(52322),
            a = s(69816),
            n = s(72817);
          s(2784);
          var o = s(86874),
            i = s(87315),
            c = e([i]);
          function d(e) {
            var t, s, l;
            let { dataMock: c, chain: d } = e,
              { scrollRef: u, props: x } = (0, n.Z)(),
              m =
                (null === (s = Object.values(d.nativeDenoms)) || void 0 === s ? void 0 : null === (t = s[0]) || void 0 === t ? void 0 : t.coinDecimals) ??
                i.rw[null == d ? void 0 : null === (l = d.bip44) || void 0 === l ? void 0 : l.coinType];
            return (0, r.jsx)("div", {
              className: "h-[52px]",
              children: (0, r.jsx)("div", {
                className: "flex items-start no-scrollbar overflow-y-auto whitespace-nowrap",
                ref: u,
                ...x,
                children: c.map(e => {
                  let t = "loading" === e.title;
                  return (0, r.jsx)(
                    "div",
                    {
                      className: `px-3 py-2 dark:bg-gray-900 bg-white-100 rounded-[12px] mr-3${t ? " w-[150px]" : ""}`,
                      children: t
                        ? (0, r.jsx)(o.Z, { count: 2 })
                        : (0, r.jsxs)(r.Fragment, {
                            children: [
                              (0, r.jsxs)("div", {
                                className: "flex items-center",
                                children: [
                                  (0, r.jsx)("div", { className: "rounded-[2px] w-3 h-3 mr-1", style: { backgroundColor: e.color } }),
                                  (0, r.jsx)("p", {
                                    className: "dark:text-white-100 text-gray-400 whitespace-nowrap text-xs font-bold",
                                    children: `${e.title} - ${e.percent}`
                                  })
                                ]
                              }),
                              (0, r.jsx)(a.Z, {
                                size: "xs",
                                color: "text-gray-400 font-medium whitespace-nowrap",
                                style: { lineHeight: "20px" },
                                children: `${new Intl.NumberFormat("en-US").format(+Number(e.value / Math.pow(10, m)).toFixed(2))} ${d.denom}`
                              })
                            ]
                          })
                    },
                    e.color
                  );
                })
              })
            });
          }
          (i = (c.then ? (await c)() : c)[0]), l();
        } catch (e) {
          l(e);
        }
      });
    },
    5953: function (e, t, s) {
      s.d(t, { M: () => d });
      var l = s(52322),
        r = s(75377),
        a = s(36906),
        n = s(96217),
        o = s(69816),
        i = s(2784),
        c = s(86874);
      function d(e) {
        let { tallying: t } = e,
          [s, d] = (0, i.useState)("");
        return (0, l.jsxs)(l.Fragment, {
          children: [
            (0, l.jsx)("div", {
              className: "rounded-2xl bg-secondary-100 flex flex-col mt-7",
              children: t.map((e, t) =>
                (0, l.jsxs)(
                  i.Fragment,
                  {
                    children: [
                      (0, l.jsxs)(
                        "div",
                        {
                          className: "flex items-center justify-between gap-3 px-5 py-4",
                          children: [
                            (0, l.jsxs)("div", {
                              className: "flex flex-row items-center",
                              children: [
                                (0, l.jsx)("p", { className: "text-secondary-800 text-sm", children: e.label }),
                                (0, l.jsx)("button", {
                                  onClick: () => d(e.label),
                                  className: "h-[16px] w-[16px]",
                                  children: (0, l.jsx)(a.k, { size: 16, className: "text-secondary-600 ml-1" })
                                })
                              ]
                            }),
                            e.value
                              ? (0, l.jsx)("p", {
                                  className: "text-sm font-bold text-gray-800 dark:text-white-100",
                                  children: `${Number(e.value).toFixed(2)}%`
                                })
                              : (0, l.jsx)(c.Z, { count: 1, width: "50px" })
                          ]
                        },
                        e.label
                      ),
                      0 === t && (0, l.jsx)(r.CardDivider, {})
                    ]
                  },
                  e.label
                )
              )
            }),
            (0, l.jsx)(n.Z, {
              isOpen: !!s,
              onClose: () => d(""),
              title: s,
              className: "p-6",
              children: (0, l.jsx)(o.Z, {
                size: "sm",
                color: "text-gray-800 dark:text-white-100",
                children:
                  "Turnout" === s
                    ? "Defined as the percentage of voting power already casted on a proposal  as a percentage of total staked tokens."
                    : "Defined as the minimum percentage of voting power that needs to be cast on a proposal for the result to be valid."
              })
            })
          ]
        });
      }
    },
    3377: function (e, t, s) {
      s.a(e, async function (e, l) {
        try {
          s.d(t, { O: () => h });
          var r = s(52322),
            a = s(80229),
            n = s(72779),
            o = s.n(n),
            i = s(28879),
            c = s.n(i),
            d = s(2784),
            u = s(87315),
            x = s(62227),
            m = e([u]);
          function h(e) {
            let { currVote: t, proposal: s, isLoading: l, activeChain: n, hasMinStaked: i, onVote: m } = e,
              [h, f] = (0, d.useState)();
            switch (
              ((0, d.useEffect)(() => {
                let e = setInterval(() => {
                  let e = c()(),
                    t = c()(s.status === x.B.PROPOSAL_STATUS_DEPOSIT_PERIOD ? s.deposit_end_time : s.voting_end_time).diff(e, "seconds");
                  f((0, u.rJ)(t));
                }, 1e3);
                return () => clearInterval(e);
              }, [s, u.rJ]),
              s.status)
            ) {
              case x.B.PROPOSAL_STATUS_VOTING_PERIOD:
                return (0, r.jsxs)(r.Fragment, {
                  children: [
                    (0, r.jsxs)("div", {
                      className: "rounded-2xl bg-secondary-100 flex flex-col mt-7",
                      children: [
                        (0, r.jsxs)("div", {
                          className: "flex items-center justify-between gap-3 px-5 py-4",
                          children: [
                            (0, r.jsx)("div", { className: "text-secondary-800 text-sm", children: "Voting Starts" }),
                            (0, r.jsx)("div", { className: "text-foreground text-sm font-bold", children: c()(s.voting_start_time).format("MMM DD, YYYY") })
                          ]
                        }),
                        (0, r.jsx)("div", { className: "h-[1px] bg-secondary-300" }),
                        (0, r.jsxs)("div", {
                          className: "flex items-center justify-between gap-3 px-5 py-4",
                          children: [
                            (0, r.jsx)("div", { className: "text-secondary-800 text-sm", children: "Voting Ends" }),
                            (0, r.jsx)("div", { className: "text-foreground text-sm font-bold", children: c()(s.voting_end_time).format("MMM DD, YYYY") })
                          ]
                        }),
                        h &&
                          (0, r.jsxs)(r.Fragment, {
                            children: [
                              (0, r.jsx)("div", { className: "h-[1px] bg-secondary-300" }),
                              (0, r.jsxs)("div", {
                                className: "flex items-center justify-between gap-3 px-5 py-4",
                                children: [
                                  (0, r.jsx)("div", { className: "text-secondary-800 text-sm", children: "Ending in" }),
                                  (0, r.jsx)("div", { className: "text-foreground text-sm font-bold", children: h })
                                ]
                              })
                            ]
                          })
                      ]
                    }),
                    t &&
                      "NO_VOTE" !== t &&
                      (0, r.jsxs)("div", {
                        className: o()("flex p-4 w-[344px] mt-4 dark:bg-green-900 bg-green-300 border-2 dark:border-green-800 border-green-600 rounded-2xl"),
                        children: [
                          (0, r.jsx)("div", {
                            className: "h-10 w-10 bg-green-400 rounded-full flex items-center justify-center",
                            children: (0, r.jsx)(a.V, { size: 16, className: "text-green-700" })
                          }),
                          (0, r.jsxs)("div", {
                            className: "flex flex-col justify-center items-start px-3",
                            children: [
                              (0, r.jsx)("div", { className: "text-base text-white-100 text-left", children: "Vote submitted" }),
                              (0, r.jsxs)("div", { className: "text-sm text-gray-600 font-medium", children: ["Voted ", t] })
                            ]
                          })
                        ]
                      })
                  ]
                });
              case x.B.PROPOSAL_STATUS_DEPOSIT_PERIOD:
                return (0, r.jsx)(r.Fragment, {
                  children: (0, r.jsxs)("div", {
                    className: "rounded-2xl bg-secondary-100 flex flex-col mt-7",
                    children: [
                      (0, r.jsxs)("div", {
                        className: "flex items-center justify-between gap-3 px-5 py-4",
                        children: [
                          (0, r.jsx)("div", { className: "text-secondary-800 text-sm", children: "Deposit Period Ends" }),
                          (0, r.jsx)("div", { className: "text-foreground text-sm font-bold", children: c()(s.deposit_end_time).format("MMM DD, YYYY") })
                        ]
                      }),
                      h &&
                        (0, r.jsxs)(r.Fragment, {
                          children: [
                            (0, r.jsx)("div", { className: "h-[1px] bg-secondary-300" }),
                            (0, r.jsxs)("div", {
                              className: "flex items-center justify-between gap-3 px-5 py-4",
                              children: [
                                (0, r.jsx)("div", { className: "text-secondary-800 text-sm", children: "Ending in" }),
                                (0, r.jsx)("div", { className: "text-foreground text-sm font-bold", children: h })
                              ]
                            })
                          ]
                        })
                    ]
                  })
                });
              case x.B.PROPOSAL_STATUS_PASSED:
              case x.B.PROPOSAL_STATUS_FAILED:
              case x.B.PROPOSAL_STATUS_REJECTED:
                return (0, r.jsx)(r.Fragment, {
                  children: (0, r.jsxs)("div", {
                    className: "rounded-2xl bg-secondary-100 flex flex-col mt-7 p-5",
                    children: [
                      (0, r.jsx)("div", { className: "text-secondary-800 mb-5 text-sm font-bold", children: "Results" }),
                      (0, r.jsx)("div", {
                        className: "flex flex-col justify-center gap-3",
                        children: (0, u.sR)(s.tally || s.final_tally_result).map(e =>
                          (0, r.jsxs)(
                            "div",
                            {
                              className: o()("flex relative overflow-clip border rounded-lg", e.selectedBorderCSS),
                              children: [
                                (0, r.jsx)("div", {
                                  className: o()("text-foreground text-sm font-bold py-2 z-10 flex-1", e.selectedBorderCSS),
                                  children: (0, r.jsx)("span", { className: "ml-4 max-h-10", children: e.label })
                                }),
                                (0, r.jsx)("div", {
                                  className: o()("text-foreground text-sm py-[10px] shrink-0", e.selectedBorderCSS),
                                  children: (0, r.jsx)("span", { className: "absolute right-4 font-bold", children: e.percentage.toFixed(2) })
                                }),
                                (0, r.jsx)("div", {
                                  style: { width: (3.12 * e.percentage).toString() + "px" },
                                  className: o()("h-10 absolute l-0 rounded-xl", e.selectedBackgroundCSS)
                                })
                              ]
                            },
                            e.label
                          )
                        )
                      })
                    ]
                  })
                });
            }
            return (0, r.jsx)(r.Fragment, {});
          }
          (u = (m.then ? (await m)() : m)[0]), l();
        } catch (e) {
          l(e);
        }
      });
    },
    11613: function (e, t, s) {
      s.a(e, async function (e, l) {
        try {
          s.d(t, { u: () => v });
          var r = s(52322),
            a = s(56594),
            n = s(41172),
            o = s(89187),
            i = s(96217),
            c = s(91486),
            d = s(72059),
            u = s(30464),
            x = s(75958),
            m = s(90258),
            h = s(2784),
            f = s(62833),
            p = e([d]);
          d = (p.then ? (await p)() : p)[0];
          let v = (0, x.Pi)(e => {
            let { isOpen: t, onClose: s, forceChain: l, forceNetwork: x, refetchVote: p } = e,
              v = (0, d.a7)(),
              g = (0, n.obn)(),
              { pendingTx: b, setPendingTx: j } = (0, n.EEe)(),
              { explorerTxnUrl: S } = (0, n.xGX)({ forceChain: l ?? v, forceNetwork: x ?? g, forceTxHash: null == b ? void 0 : b.txHash });
            return (
              (0, h.useEffect)(() => {
                (null == b ? void 0 : b.promise) &&
                  b.promise
                    .then(
                      e => {
                        e && (0, a.isDeliverTxSuccess)(e) ? j({ ...b, txStatus: "success" }) : j({ ...b, txStatus: "failed" });
                      },
                      () => j({ ...b, txStatus: "failed" })
                    )
                    .catch(() => {
                      j({ ...b, txStatus: "failed" });
                    })
                    .finally(() => {
                      p();
                    });
              }, [null == b ? void 0 : b.promise]),
              (0, r.jsxs)(i.Z, {
                fullScreen: !0,
                isOpen: t,
                onClose: s,
                containerClassName: "bg-secondary-50",
                className: "h-full flex flex-col",
                children: [
                  (0, r.jsxs)("div", {
                    className: "flex flex-col gap-6 items-center my-auto",
                    children: [
                      (0, r.jsxs)("div", {
                        className: "flex flex-col gap-10 items-center",
                        children: [
                          (0, r.jsxs)("div", {
                            className: "flex items-center justify-center",
                            children: [
                              (null == b ? void 0 : b.txStatus) === "loading" &&
                                (0, r.jsx)("div", {
                                  className: "size-[100px] p-8 rounded-full bg-secondary-200 animate-spin",
                                  children: (0, r.jsx)("img", { className: "size-full", src: u.r.Swap.Rotate })
                                }),
                              (null == b ? void 0 : b.txStatus) === "success" &&
                                (0, r.jsx)("div", {
                                  className: "size-[100px] p-8 rounded-full bg-green-400",
                                  children: (0, r.jsx)("img", { className: "size-full", src: u.r.Swap.CheckGreen })
                                }),
                              (null == b ? void 0 : b.txStatus) === "failed" &&
                                (0, r.jsx)("div", {
                                  className: "size-[100px] p-8 rounded-full bg-red-600 dark:bg-red-400",
                                  children: (0, r.jsx)("img", { className: "size-full", src: u.r.Swap.FailedRed })
                                })
                            ]
                          }),
                          (0, r.jsxs)("div", {
                            className: "flex flex-col gap-3 items-center",
                            children: [
                              (0, r.jsxs)("span", {
                                className: "font-bold text-[1.5rem] text-center text-foreground",
                                children: ["Vote ", m.KT[(null == b ? void 0 : b.txStatus) || "loading"]]
                              }),
                              (null == b ? void 0 : b.subtitle1) && b.title1 && "success" === b.txStatus
                                ? (0, r.jsxs)("span", { className: "text-sm text-secondary-800 text-center mx-6", children: [b.title1, " ", b.subtitle1] })
                                : null
                            ]
                          })
                        ]
                      }),
                      S
                        ? (0, r.jsxs)("a", {
                            target: "_blank",
                            rel: "noreferrer",
                            href: S,
                            className: "flex font-medium items-center gap-1 text-sm text-accent-green hover:text-accent-green-200 transition-colors",
                            children: ["View transaction", (0, r.jsx)(o.T, { size: 12 })]
                          })
                        : null
                    ]
                  }),
                  (0, r.jsxs)("div", {
                    className: "flex gap-x-4 mt-auto [&>*]:flex-1",
                    children: [
                      (0, r.jsx)(c.zx, { variant: "mono", asChild: !0, children: (0, r.jsx)(f.rU, { to: "/home", children: "Home" }) }),
                      (0, r.jsx)(c.zx, {
                        onClick: s,
                        disabled: (null == b ? void 0 : b.txStatus) === "loading",
                        children: (null == b ? void 0 : b.txStatus) === "failed" ? "Retry" : "Done"
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
    78972: function (e, t, s) {
      s.a(e, async function (e, l) {
        try {
          s.d(t, {
            $J: () => o.$,
            BC: () => d.B,
            GF: () => u.G,
            HI: () => m.H,
            M: () => h.M,
            MO: () => d.M,
            Og: () => f.O,
            SN: () => a.S,
            at: () => n.a,
            kK: () => r.k,
            ro: () => x.r,
            t_: () => c.t,
            vu: () => i.v
          });
          var r = s(27573),
            a = s(97407),
            n = s(8292),
            o = s(68671),
            i = s(24623),
            c = s(79968),
            d = s(62227),
            u = s(67725),
            x = s(20194),
            m = s(81333),
            h = s(5953),
            f = s(3377),
            p = e([r, a, n, i, c, m, f]);
          ([r, a, n, i, c, m, f] = p.then ? (await p)() : p), l();
        } catch (e) {
          l(e);
        }
      });
    },
    5837: function (e, t, s) {
      s.a(e, async function (e, l) {
        try {
          s.d(t, { T: () => k });
          var r = s(52322),
            a = s(41172),
            n = s(80229),
            o = s(89145),
            i = s(16698),
            c = s(92642),
            d = s(72779),
            u = s.n(d),
            x = s(58885),
            m = s(51994),
            h = s(80588),
            f = s(96217),
            p = s(91486),
            v = s(30942),
            g = s(65027),
            b = s(75958),
            j = s(2784),
            S = s(42799),
            N = s(48346),
            w = s(70514),
            y = s(11613),
            _ = s(20365),
            E = s(95773),
            P = e([g, m, x, N, h, _, y]);
          [g, m, x, N, h, _, y] = P.then ? (await P)() : P;
          let T = g.w.useGetWallet,
            O = [
              { label: E.RW.YES, icon: (0, r.jsx)(n.V, { size: 20 }), selectedCSS: "text-white-100 bg-green-600" },
              { label: E.RW.NO, icon: (0, r.jsx)(o.L, { size: 20 }), selectedCSS: "text-white-100 bg-red-300" },
              { label: E.RW.ABSTAIN, icon: (0, r.jsx)(i.q, { size: 20 }), selectedCSS: "text-white-100 bg-yellow-600" }
            ];
          function C(e) {
            let {
                proposalId: t,
                isProposalInVotingPeriod: s,
                isOpen: l,
                setShowFeesSettingSheet: n,
                onCloseHandler: o,
                onSubmitVote: i,
                showFeesSettingSheet: d,
                gasError: x,
                forceChain: h,
                simulateNtrnVote: g
              } = e,
              [b, S] = (0, j.useState)(void 0),
              N = (0, a.a74)(),
              y = (0, j.useMemo)(() => h || N, [N, h]),
              _ = T(h),
              [E, P] = (0, j.useState)(""),
              [C, k] = (0, j.useState)(!1);
            return (
              (0, j.useEffect)(() => {
                t &&
                  b &&
                  s &&
                  (async () => {
                    try {
                      k(!0);
                      let e = await _();
                      await g(e, Number(t), b);
                    } catch (e) {
                      P(e.message),
                        (0, c.Tb)(e, {
                          tags: {
                            errorType: "simulate_vote_error",
                            source: "simulate_vote",
                            severity: "error",
                            errorName: e instanceof Error ? e.name : "SimulateVoteError"
                          },
                          fingerprint: ["simulate_vote", "simulate_vote_error"],
                          level: "error",
                          contexts: { transaction: { type: "simulate_vote", errorMessage: e instanceof Error ? e.message : String(e) } },
                          extra: { chain: y, proposalId: t, voteOption: b }
                        });
                    } finally {
                      k(!1);
                    }
                  })();
              }, [t, b, s]),
              (0, v.X)(E),
              (0, r.jsxs)(f.Z, {
                isOpen: l,
                onClose: o,
                title: "Call your Vote",
                className: "!pt-8 p-6",
                children: [
                  (0, r.jsx)("div", {
                    className: "flex flex-col items-center gap-4",
                    children: O.map(e =>
                      (0, r.jsxs)(
                        "button",
                        {
                          onClick: () => S(e.label),
                          className: u()("flex items-center w-full px-5 py-4 rounded-xl cursor-pointer border", {
                            "bg-secondary-100 text-foreground hover:bg-secondary-200 border-transparent": b !== e.label,
                            "text-green-600 bg-green-500/10 border-green-600": b === e.label
                          }),
                          children: [
                            (0, r.jsx)("span", { className: "mr-3", children: e.icon }),
                            (0, r.jsx)("span", {
                              className: (0, w.cn)("text-base font-bold", { "text-foreground": b !== e.label, "text-green-600": b === e.label }),
                              children: e.label
                            })
                          ]
                        },
                        e.label
                      )
                    )
                  }),
                  (0, r.jsx)(m.a, { className: "mt-4", setShowFeesSettingSheet: n }),
                  x && !d ? (0, r.jsx)("p", { className: "text-red-300 text-sm font-medium mt-2 text-center", children: x }) : null,
                  (0, r.jsx)(p.zx, {
                    className: "w-full mt-6",
                    disabled: !b || !!x || C,
                    onClick: () => i(b),
                    "aria-label": "submit button in ntrn cast vote flow",
                    children: (0, r.jsx)("span", { "aria-label": "submit button text in ntrn cast vote flow", children: "Submit" })
                  })
                ]
              })
            );
          }
          let k = (0, b.Pi)(e => {
            let {
                isProposalInVotingPeriod: t,
                proposalId: s,
                refetchVote: l,
                showCastVoteSheet: n,
                setShowCastVoteSheet: o,
                className: i,
                forceChain: d,
                forceNetwork: m
              } = e,
              [f, p] = (0, j.useState)(!1),
              v = T(d),
              g = S.gb.allDenoms,
              b = (0, x.e7)(g, { activeChain: d, selectedNetwork: m }),
              {
                setFeeDenom: w,
                userPreferredGasPrice: E,
                userPreferredGasLimit: P,
                setGasOption: O,
                gasOption: k,
                gasEstimate: A,
                setUserPreferredGasLimit: R,
                setUserPreferredGasPrice: D,
                clearTxError: L,
                txError: I,
                memo: M,
                setMemo: U,
                isVoting: V,
                handleVote: G,
                simulateNtrnVote: B
              } = (0, a.k5N)(g, d, m),
              [F, Z] = (0, j.useState)(void 0),
              [z, H] = (0, j.useState)(!1),
              [$, Y] = (0, j.useState)(null),
              [W, J] = (0, j.useState)({ option: a.j1p.LOW, gasPrice: E ?? b.gasPrice }),
              q = (0, j.useCallback)(
                (e, t) => {
                  J(e), w(t.denom);
                },
                [w]
              ),
              Q = (0, j.useCallback)(
                e => {
                  p(!0);
                },
                [p]
              );
            (0, j.useEffect)(() => {
              J({ option: k, gasPrice: b.gasPrice });
            }, [b.gasPrice]),
              (0, j.useEffect)(() => {
                O(W.option), D(W.gasPrice);
              }, [W, O, D]);
            let X = (0, j.useCallback)(() => {
                Z(void 0), o(!1), L();
              }, [L, o]),
              K = async () => {
                L();
                try {
                  let e = await v();
                  return await G({ wallet: e, callback: Q, voteOption: F, proposalId: Number(s) }), !0;
                } catch (e) {
                  return (
                    (0, c.Tb)(e, {
                      tags: {
                        errorType: "submit_vote_error",
                        source: "submit_vote",
                        severity: "error",
                        errorName: e instanceof Error ? e.name : "SubmitVoteError"
                      },
                      fingerprint: ["submit_vote", "submit_vote_error"],
                      level: "error",
                      extra: { chain: d, proposalId: s, voteOption: F },
                      contexts: { transaction: { type: "submit_vote", errorMessage: e instanceof Error ? e.message : String(e) } }
                    }),
                    !1
                  );
                }
              };
            return (0, r.jsx)("div", {
              className: u()("", i),
              children: (0, r.jsxs)(x.ZP, {
                recommendedGasLimit: A.toString(),
                gasLimit: (null == P ? void 0 : P.toString()) ?? A.toString(),
                setGasLimit: e => R(Number(e.toString())),
                gasPriceOption: W,
                onGasPriceOptionChange: q,
                error: $,
                setError: Y,
                chain: d,
                network: m,
                rootDenomsStore: S.gb,
                rootBalanceStore: N.jZ,
                children: [
                  (0, r.jsx)(C, {
                    proposalId: s,
                    isProposalInVotingPeriod: t,
                    isOpen: n,
                    setShowFeesSettingSheet: H,
                    onCloseHandler: () => o(!1),
                    onSubmitVote: Z,
                    showFeesSettingSheet: z,
                    gasError: $ ?? "",
                    simulateNtrnVote: B,
                    forceChain: d
                  }),
                  (0, r.jsx)(h.k, { showFeesSettingSheet: z, onClose: () => H(!1), gasError: $ }),
                  (0, r.jsx)(_.Gu, {
                    isOpen: void 0 !== F,
                    proposalId: s,
                    error: I,
                    loading: V,
                    memo: M,
                    setMemo: U,
                    selectedVote: F,
                    onSubmitVote: K,
                    refetchCurrVote: l,
                    onCloseHandler: X,
                    gasOption: W.option,
                    forceChain: d
                  }),
                  f && (0, r.jsx)(y.u, { isOpen: f, onClose: () => p(!1), forceChain: d, forceNetwork: m, refetchVote: l })
                ]
              })
            });
          });
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    47764: function (e, t, s) {
      s.a(e, async function (e, l) {
        try {
          s.d(t, { C: () => V });
          var r = s(52322),
            a = s(41172),
            n = s(15969),
            o = s(75377),
            i = s(80229),
            c = s(57849),
            d = s(26007),
            u = s(60431),
            x = s(55334),
            m = s(72779),
            h = s.n(m),
            f = s(79645),
            p = s(69816),
            v = s(91486),
            g = s(28879),
            b = s.n(g),
            j = s(10706),
            S = s(38313),
            N = s(57124),
            w = s(18203),
            y = s(2784),
            _ = s(86874),
            E = s(693),
            P = s(80502),
            C = s(46103),
            T = s(70514),
            O = s(49409),
            k = s(78972),
            A = s(60960),
            R = s(87315),
            D = s(20365),
            L = s(77096),
            I = s(95773),
            M = e([j, S, L, R, f, k, D]);
          function U(e) {
            let { proposal: t, onVote: s, currVote: l, isLoading: n, shouldUseFallback: c, forceChain: d } = e,
              [u, x] = (0, y.useState)(),
              m = (0, a.a74)(),
              f = (0, y.useMemo)(() => d || m, [m, d]);
            switch (
              ((0, y.useEffect)(() => {
                let e = setInterval(() => {
                  let e = b()(),
                    s = b()((0, I.NQ)(t, c)).diff(e, "seconds");
                  x((0, R.rJ)(s));
                }, 1e3);
                return () => clearInterval(e);
              }, [t, c]),
              (0, I.lR)(t, c))
            ) {
              case L.u.OPEN:
              case k.BC.PROPOSAL_STATUS_IN_PROGRESS:
              case k.BC.PROPOSAL_STATUS_VOTING_PERIOD:
                return (0, r.jsxs)(r.Fragment, {
                  children: [
                    (0, r.jsxs)("div", {
                      className: "rounded-2xl bg-white-100 dark:bg-gray-900 flex flex-col mt-4",
                      children: [
                        (0, r.jsxs)("div", {
                          className: "flex items-center justify-between gap-3 p-4",
                          children: [
                            (0, r.jsx)("div", { className: "text-black-100 dark:text-white-100 text-base font-bold", children: "Voting Ends" }),
                            (0, r.jsx)("div", {
                              className: "text-black-100 dark:text-white-100 text-sm font-bold",
                              children: b()((0, I.NQ)(t, c)).format("MMM DD, YYYY")
                            })
                          ]
                        }),
                        (0, r.jsx)("div", { className: "px-4 pb-4 text-xs text-gray-600 dark:text-gray-200 min-h-[32px]", children: u && `Ending in ${u}` })
                      ]
                    }),
                    n
                      ? (0, r.jsxs)("div", {
                          className: "rounded-2xl mt-4 h-18 w-full p-4 flex bg-white-100 dark:bg-gray-900",
                          children: [
                            (0, r.jsx)(_.Z, { count: 1, className: "rounded-full mt-4 h-10 w-10" }),
                            (0, r.jsxs)("div", {
                              className: "ml-3 w-full",
                              children: [(0, r.jsx)(_.Z, { count: 1, className: "h-6" }), (0, r.jsx)(_.Z, { count: 1, className: "h-5" })]
                            })
                          ]
                        })
                      : null,
                    l &&
                      "NO_VOTE" !== l &&
                      (0, r.jsxs)("div", {
                        className: h()("flex p-4 w-[344px] mt-4 dark:bg-green-900 bg-green-300 border-2 dark:border-green-800 border-green-600 rounded-2xl"),
                        children: [
                          (0, r.jsx)("div", {
                            className: "h-10 w-10 bg-green-400 rounded-full flex items-center justify-center",
                            children: (0, r.jsx)(i.V, { size: 16, className: "text-green-700" })
                          }),
                          (0, r.jsxs)("div", {
                            className: "flex flex-col justify-center items-start px-3",
                            children: [
                              (0, r.jsx)("div", { className: "text-base text-white-100 text-left", children: "Vote submitted" }),
                              (0, r.jsxs)("div", { className: "text-sm text-gray-600 font-medium", children: ["Voted ", l.toUpperCase()] })
                            ]
                          })
                        ]
                      }),
                    (0, r.jsx)(o.Buttons.Generic, {
                      color: C.w.getChainColor(f),
                      size: "normal",
                      className: "w-[344px] py-4 mt-4",
                      onClick: () => s(),
                      children: (0, r.jsxs)("div", {
                        className: "flex justify-center text-white-100 items-center",
                        children: [(0, r.jsx)(i.V, { size: 16, className: "mr-2" }), (0, r.jsx)("span", { children: "Vote" })]
                      })
                    })
                  ]
                });
              case L.u.EXECUTED:
              case L.u.PASSED:
              case L.u.REJECTED:
              case k.BC.PROPOSAL_STATUS_PASSED:
              case k.BC.PROPOSAL_STATUS_EXECUTED:
              case k.BC.PROPOSAL_STATUS_FAILED:
              case k.BC.PROPOSAL_STATUS_REJECTED:
                return (0, r.jsxs)("div", {
                  className: "rounded-2xl bg-white-100 dark:bg-gray-900 flex flex-col mt-4",
                  children: [
                    (0, r.jsxs)("div", {
                      className: "flex items-center gap-3 p-4",
                      children: [
                        (0, r.jsx)("div", { className: "text-gray-600 w-[200px] dark:text-gray-200 text-xs font-bold", children: "Results" }),
                        (0, r.jsx)("div", { className: "text-gray-600 dark:text-gray-200 text-xs font-bold" })
                      ]
                    }),
                    (0, r.jsx)("div", {
                      className: "flex flex-col justify-center gap-3 p-4",
                      children: (0, R.sR)((0, I.uM)(t, c))
                        .filter(e => e.label !== I.RW.NO_WITH_VETO)
                        .map(e =>
                          (0, r.jsxs)(
                            "div",
                            {
                              className: "flex rounded-2xl relative overflow-clip",
                              children: [
                                (0, r.jsx)("div", {
                                  className: h()(
                                    "text-black-100 dark:text-white-100 w-52 font-bold py-2 border-y-2 border-l-2 rounded-l-2xl z-10",
                                    e.selectedBorderCSS
                                  ),
                                  children: (0, r.jsx)("span", { className: "ml-4 max-h-10", children: e.label })
                                }),
                                (0, r.jsx)("div", {
                                  className: h()(
                                    "w-full text-black-100 py-[10px] dark:text-white-100 border-y-2 border-r-2 rounded-r-2xl",
                                    e.selectedBorderCSS
                                  ),
                                  children: (0, r.jsx)("span", { className: "absolute right-4 font-bold", children: e.percentage.toFixed(2) })
                                }),
                                (0, r.jsx)("div", {
                                  style: { width: (3.12 * e.percentage).toString() + "px" },
                                  className: h()("h-10 absolute l-0 m-[2px] rounded-2xl", e.selectedBackgroundCSS)
                                })
                              ]
                            },
                            e.label
                          )
                        )
                    })
                  ]
                });
            }
            return (0, r.jsx)(r.Fragment, {});
          }
          function V(e) {
            let { selectedProp: t, onBack: s, proposalList: l, shouldUseFallback: o, forceChain: i, forceNetwork: m } = e,
              { chains: h } = (0, a._IL)(),
              { activeWallet: g } = (0, j.ZP)(),
              b = (0, a.a74)(),
              _ = (0, y.useMemo)(() => i || b, [b, i]),
              M = (0, S.ob)(),
              V = (0, y.useMemo)(() => m || M, [M, m]),
              G = (0, a.SFn)(_),
              B = h[_],
              { rpcUrl: F, txUrl: Z } = (0, a.U9i)(_, V),
              z = (0, N.a)(),
              [H, $] = (0, y.useState)(!1),
              Y = (0, y.useMemo)(() => l.find(e => (o ? e.id : e.proposal_id) === t), [l, t, o]),
              { abstain: W, yes: J, no: q } = o ? Y.proposal.votes : Y.tally,
              Q = [J, q, W].reduce((e, t) => e + Number(t), 0),
              X = (0, y.useMemo)(() => [L.u.OPEN, k.BC.PROPOSAL_STATUS_IN_PROGRESS, k.BC.PROPOSAL_STATUS_VOTING_PERIOD].includes((0, I.lR)(Y, o)), [Y, o]),
              K = (0, y.useMemo)(
                () =>
                  Q
                    ? [
                        { title: "YES", value: +J, color: "#29A874", percent: (0, R.DU)(+J, Q) },
                        { title: "NO", value: +q, color: "#FF707E", percent: (0, R.DU)(+q, Q) },
                        { title: "Abstain", value: +W, color: "#D1A700", percent: (0, R.DU)(+W, Q) }
                      ]
                    : [{ title: "loading", value: 1, color: "#ccc", percent: "0%" }],
                [W, q, Q, J]
              ),
              ee = (0, y.useMemo)(
                () => [
                  { label: "Turnout", value: (0, I.C)(Y, Q, o) },
                  { label: "Quorum", value: (0, I.$6)(Y, o) }
                ],
                [Y, o, Q]
              ),
              {
                data: et,
                refetch: es,
                isLoading: el
              } = (0, u.useQuery)(
                ["neutron-currVote", _, G, t, F],
                async function () {
                  try {
                    let { data: e } = await x.Z.post(`https://api.leapwallet.io/gov/vote/${B.chainId}/${t}`, { userAddress: G });
                    return { vote: e };
                  } catch (e) {
                    return await (0, n.Jk_)(F ?? "", Number(t ?? ""), G);
                  }
                },
                { retry: e => e <= 2, enabled: X && !!F }
              );
            return (0, r.jsxs)(r.Fragment, {
              children: [
                (0, r.jsx)(A.Z, { onBack: s, title: "Proposal" }),
                (0, r.jsxs)("div", {
                  className: "flex flex-col p-6 overflow-y-scroll",
                  children: [
                    (0, r.jsxs)("div", {
                      className: "text-muted-foreground text-sm mb-2 font-medium",
                      children: ["#", (0, I.zv)(Y, o), " \xb7", " ", (0, r.jsx)(D.eg, { status: (0, I.lR)(Y, o) })]
                    }),
                    (0, r.jsx)("div", { className: "text-foreground font-bold text-lg break-words", children: (0, I.YQ)(Y, o) }),
                    (0, r.jsx)(U, {
                      proposal: Y,
                      onVote: () => $(!0),
                      currVote: null == et ? void 0 : et.vote,
                      isLoading: el,
                      shouldUseFallback: o,
                      forceChain: i
                    }),
                    (0, r.jsx)("div", { className: "my-5" }),
                    Q &&
                      (0, r.jsxs)(r.Fragment, {
                        children: [
                          (0, r.jsx)("div", {
                            className: "w-full h-full flex items-center justify-center mb-8",
                            children: (0, r.jsxs)("div", {
                              className: "w-[180px] h-[180px] flex items-center justify-center relative",
                              children: [
                                (0, r.jsx)(E.PieChart, { data: K, lineWidth: 20 }),
                                (0, r.jsx)("p", { className: "text-md dark:text-white-100 text-dark-gray font-bold absolute", children: "Current Status" })
                              ]
                            })
                          }),
                          (0, r.jsx)(k.HI, { dataMock: K, chain: B }),
                          (0, r.jsx)(k.M, { tallying: ee })
                        ]
                      }),
                    X &&
                      (0, r.jsxs)("div", {
                        className: "rounded-2xl mt-7 h-20 w-full p-5 flex items-center justify-between roundex-xxl bg-secondary-100",
                        children: [
                          (0, r.jsxs)("div", {
                            className: "flex items-center",
                            children: [
                              (0, r.jsxs)("div", {
                                style: { backgroundColor: "#FFECA8", lineHeight: 28 },
                                className: "relative h-10 w-10 rounded-full flex items-center justify-center text-lg",
                                children: [
                                  (0, r.jsx)(c.n, { size: 16, className: "leading-none" }),
                                  (0, r.jsx)("img", {
                                    src: B.chainSymbolImageUrl ?? z,
                                    onError: (0, O._)(z),
                                    alt: "chain logo",
                                    width: "16",
                                    height: "16",
                                    className: "rounded-full absolute bottom-0 right-0"
                                  })
                                ]
                              }),
                              (0, r.jsxs)("div", {
                                className: "flex flex-col ml-3",
                                children: [
                                  (0, r.jsx)(p.Z, { size: "sm", color: "text-foreground", className: "font-bold", children: "Proposer" }),
                                  (0, r.jsx)(p.Z, {
                                    size: "xs",
                                    color: "text-muted-foreground",
                                    children: `${(0, I.cR)(Y, o).slice(0, 5)}...${(0, I.cR)(Y, o).slice(-6)}`
                                  })
                                ]
                              })
                            ]
                          }),
                          (0, r.jsx)("button", {
                            className: "flex items-center justify-center px-1",
                            onClick: () => window.open(`${null == Z ? void 0 : Z.replace("txs", "account")}/${(0, I.cR)(Y, o)}`, "_blank"),
                            children: (0, r.jsx)(d.O, { size: 18, className: "text-gray-400" })
                          })
                        ]
                      }),
                    (0, r.jsx)("div", { className: "mt-7" }),
                    (0, I.Eb)(Y, o) && (0, r.jsx)(f.r, { description: (0, I.Eb)(Y, o), title: "Description", btnColor: C.w.getChainColor(_, B), forceChain: i })
                  ]
                }),
                Y.status === k.BC.PROPOSAL_STATUS_VOTING_PERIOD &&
                  (0, r.jsx)("div", {
                    className: "w-full p-4 mt-auto sticky bottom-0 bg-secondary-100 ",
                    children: (0, r.jsx)(v.zx, {
                      className: (0, T.cn)("w-full"),
                      onClick: () => {
                        (null == g ? void 0 : g.watchWallet) ? P.o.setShowPopup(!0) : $(!0);
                      },
                      children: (0, r.jsxs)("div", {
                        className: "flex justify-center text-white-100 items-center",
                        children: [(0, r.jsx)(w.Z, { size: 20, className: "mr-2" }), (0, r.jsx)("span", { children: "Vote" })]
                      })
                    })
                  }),
                (0, r.jsx)(D.Tp, {
                  refetchVote: es,
                  proposalId: (0, I.zv)(Y, o),
                  isProposalInVotingPeriod: X,
                  showCastVoteSheet: H,
                  setShowCastVoteSheet: $,
                  forceChain: i,
                  forceNetwork: m
                })
              ]
            });
          }
          ([j, S, L, R, f, k, D] = M.then ? (await M)() : M), l();
        } catch (e) {
          l(e);
        }
      });
    },
    30121: function (e, t, s) {
      s.a(e, async function (e, l) {
        try {
          s.d(t, { D: () => A });
          var r = s(52322),
            a = s(41172),
            n = s(75377),
            o = s(26227),
            i = s(72779),
            c = s.n(i),
            d = s(78944),
            u = s(14281),
            x = s(27963),
            m = s(78454),
            h = s(19623),
            f = s(9274),
            p = s(84916),
            v = s(36400),
            g = s(57124),
            b = s(71845),
            j = s(30464),
            S = s(75958),
            N = s(7345),
            w = s(2784),
            y = s(10289),
            _ = s(48534),
            E = s(71198),
            P = s(20365),
            C = s(77096),
            T = s(95773),
            O = e([C, v, m, d, P, N]);
          [C, v, m, d, P, N] = O.then ? (await O)() : O;
          let k = [
              { key: "all", label: "All Proposals" },
              { key: C.u.OPEN, label: "In Progress" },
              { key: C.u.EXECUTED, label: "Executed" },
              { key: C.u.REJECTED, label: "Rejected" }
            ],
            A = (0, S.Pi)(e => {
              let { proposalList: t, proposalListStatus: s, onClick: l, shouldPreferFallback: i, fetchMore: S, chainTagsStore: C } = e,
                [O, A] = (0, w.useState)(!1),
                [R, D] = (0, w.useState)(!1),
                [L, I] = (0, w.useState)(""),
                [M, U] = (0, w.useState)("all"),
                V = (0, v.pb)(),
                G = (0, a.a74)(),
                B = (0, g.a)(),
                F = (0, y.s0)(),
                Z = "loading" === s,
                z = V[G],
                H = (0, w.useMemo)(
                  () =>
                    null == t
                      ? void 0
                      : t.reduce(
                          (e, t) => (
                            "all" === M
                              ? L
                                ? ((0, T.YQ)(t, i ?? !1)
                                    .toLowerCase()
                                    .includes(L) ||
                                    String(t.id) === L) &&
                                  e.push(t)
                                : e.push(t)
                              : L || (0, T.lR)(t, i ?? !1) !== M
                                ? (0, T.lR)(t, i ?? !1) === M &&
                                  ((0, T.YQ)(t, i ?? !1)
                                    .toLowerCase()
                                    .includes(L) ||
                                    String(t.id) === L) &&
                                  e.push(t)
                                : e.push(t),
                            e
                          ),
                          []
                        ),
                  [t, M, L, i]
                );
              return (
                (0, w.useEffect)(() => {
                  let e = document.querySelector("#bottom");
                  if (!e || (null == H ? void 0 : H.length) === 0 || "success" !== s) return;
                  let t = new IntersectionObserver(
                    e => {
                      e[0].isIntersecting && S();
                    },
                    { root: null, rootMargin: "0px", threshold: 1 }
                  );
                  return (
                    t.observe(e),
                    () => {
                      t.disconnect();
                    }
                  );
                }, [S, null == H ? void 0 : H.length, s]),
                (0, r.jsxs)("div", {
                  className: "relative w-full overflow-clip panel-height enclosing-panel",
                  children: [
                    (0, r.jsxs)(m.Z, {
                      header: (0, r.jsx)(n.Header, {
                        action: { onClick: () => F(-1), type: n.HeaderActionType.BACK },
                        imgSrc: z.chainSymbolImageUrl ?? B,
                        onImgClick: () => A(!0),
                        title: "Governance"
                      }),
                      children: [
                        (0, r.jsx)(d.hN, {}),
                        (0, r.jsxs)("div", {
                          className: "w-full flex flex-col pt-6 pb-2 px-7 ",
                          children: [
                            (0, r.jsx)("div", { className: "text-[28px] text-black-100 dark:text-white-100 font-bold", children: "Proposals" }),
                            (0, r.jsxs)("div", { className: "text-sm text-gray-600 font-bold", children: ["List of proposals in ", G.toUpperCase()] }),
                            (0, r.jsxs)("div", {
                              className: "flex items-center justify-between mt-6 mb-4",
                              children: [
                                (0, r.jsx)(p.M, {
                                  placeholder: "Search proposals...",
                                  onChange: e => I(e.currentTarget.value.toLowerCase()),
                                  value: L,
                                  onClear: () => I("")
                                }),
                                (0, r.jsx)("button", {
                                  className: "flex items-center justify-center h-10 bg-white-100 dark:bg-gray-900 rounded-full w-10 m-w-10 ml-3",
                                  style: { minWidth: 40 },
                                  onClick: () => D(!0),
                                  children: (0, r.jsx)(b.Z, { size: 20, className: "dark:text-white-100 text-gray-800" })
                                })
                              ]
                            })
                          ]
                        }),
                        (0, r.jsxs)("div", {
                          id: "governance-list",
                          className: "pb-20 px-7",
                          children: [
                            (0, r.jsx)("div", {
                              className: "rounded-2xl flex flex-col items-center w-full m-auto justify-center dark:bg-gray-900 bg-white-100",
                              children: Z
                                ? Array.from({ length: 5 }).map((e, t) => (0, r.jsx)(f.Z, { isLast: 4 === t }, t))
                                : ((null == H ? void 0 : H.length) ?? 0) === 0
                                  ? (0, r.jsx)(x.S, {
                                      isRounded: !0,
                                      subHeading: L ? "Please try again with something else" : "",
                                      heading: L ? "No results for “" + (0, E.jr)(L) + "”" : "No Proposals",
                                      src: j.r.Misc.Explore
                                    })
                                  : null == H
                                    ? void 0
                                    : H.map((e, t) =>
                                        (0, r.jsxs)(
                                          "div",
                                          {
                                            className: "w-full",
                                            children: [
                                              (0, r.jsx)("div", {
                                                className: "p-4 cursor-pointer",
                                                onClick: () => l((0, T.zv)(e, i ?? !1)),
                                                "aria-label": "proposal item in ntrn proposal list flow",
                                                children: (0, r.jsxs)("div", {
                                                  className: "flex items-center justify-between",
                                                  children: [
                                                    (0, r.jsx)("div", {
                                                      className: c()("w-[272px]", { "!w-[calc(100%-40px)]": (0, _.oj)() }),
                                                      children: (0, r.jsxs)("div", {
                                                        className: "flex flex-col",
                                                        children: [
                                                          (0, r.jsx)("div", {
                                                            className: "text-black-100 dark:text-white-100 font-bold text-base break-words",
                                                            children: (0, T.YQ)(e, i ?? !1)
                                                          }),
                                                          (0, r.jsxs)("div", {
                                                            className: "text-gray-600 dark:text-gray-200 text-xs",
                                                            children: [
                                                              "#",
                                                              (0, T.zv)(e, i ?? !1),
                                                              " \xb7",
                                                              " ",
                                                              (0, r.jsx)(P.eg, { status: (0, T.lR)(e, i ?? !1) })
                                                            ]
                                                          })
                                                        ]
                                                      })
                                                    }),
                                                    (0, r.jsx)("img", { className: "ml-5", src: j.r.Misc.RightArrow })
                                                  ]
                                                })
                                              }),
                                              t < H.length - 1 ? (0, r.jsx)(n.CardDivider, {}) : null
                                            ]
                                          },
                                          (0, T.zv)(e, i ?? !1)
                                        )
                                      )
                            }),
                            (0, r.jsx)("div", { id: "bottom", className: "my-1" }),
                            "fetching-more" === s
                              ? (0, r.jsx)("div", { className: "px-7 flex items-center justify-center", children: (0, r.jsx)(h.T, { color: "white" }) })
                              : null
                          ]
                        })
                      ]
                    }),
                    (0, r.jsx)(N.Z, { isVisible: O, onClose: () => A(!1), chainTagsStore: C }),
                    (0, r.jsx)(u.Z, {
                      isOpen: R,
                      onClose: () => D(!1),
                      title: "Filter by",
                      children: (0, r.jsx)("div", {
                        className: "rounded-2xl flex flex-col items-center w-full justify-center dark:bg-gray-900 bg-white-100",
                        children: k.map((e, t) =>
                          (0, r.jsxs)(
                            w.Fragment,
                            {
                              children: [
                                (0, r.jsxs)("button", {
                                  className: "flex items-center justify-between text-md font-bold p-4 w-full text-gray-800 dark:text-white-100",
                                  onClick: () => {
                                    U(e.key), D(!1);
                                  },
                                  "aria-label": "filter button in ntrn proposal list flow",
                                  children: [
                                    (0, r.jsx)("span", { children: e.label }),
                                    M === e.key ? (0, r.jsx)(o.f, { size: 24, weight: "fill", className: "text-[#E18881]" }) : null
                                  ]
                                }),
                                t === k.length - 1 ? null : (0, r.jsx)(n.CardDivider, {})
                              ]
                            },
                            e.label
                          )
                        )
                      })
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
    29240: function (e, t, s) {
      s.a(e, async function (e, l) {
        try {
          s.d(t, { G: () => b });
          var r = s(52322),
            a = s(41172),
            n = s(75377),
            o = s(80229),
            i = s(72779),
            c = s.n(i),
            d = s(86200),
            u = s(51994),
            x = s(19623),
            m = s(96217),
            h = s(91486),
            f = s(30942),
            p = s(2784),
            v = s(46103),
            g = e([u]);
          function b(e) {
            let {
                isOpen: t,
                onCloseHandler: s,
                onSubmitVote: l,
                selectedVote: i,
                error: g,
                loading: b,
                memo: j,
                setMemo: S,
                proposalId: N,
                gasOption: w,
                forceChain: y
              } = e,
              _ = (0, a.a74)();
            return (
              (0, p.useMemo)(() => y || _, [_, y]),
              (0, f.X)(g),
              (0, r.jsx)(m.Z, {
                isOpen: t,
                onClose: s,
                title: "Review Transaction",
                className: "p-6 !pt-8",
                children: (0, r.jsxs)("div", {
                  className: "flex flex-col items-center gap-5",
                  children: [
                    (0, r.jsxs)("div", {
                      className: c()("flex p-4 w-full bg-gray-50 dark:bg-gray-900 rounded-2xl"),
                      children: [
                        (0, r.jsx)("div", {
                          className: "h-10 w-10 bg-green-600 rounded-full flex items-center justify-center",
                          children: (0, r.jsx)(o.V, { size: 20, className: "text-foreground" })
                        }),
                        (0, r.jsxs)("div", {
                          className: "flex flex-col justify-center items-start px-3",
                          children: [
                            (0, r.jsx)("div", { className: "text-sm text-muted-foreground text-left", children: "Vote message" }),
                            (0, r.jsxs)("div", {
                              className: "text-[18px] text-foreground font-bold",
                              children: ["Vote ", (0, r.jsx)("b", { children: i }), " on ", (0, r.jsxs)("b", { children: ["Proposal #", N] })]
                            })
                          ]
                        })
                      ]
                    }),
                    (0, r.jsx)(n.Memo, {
                      value: j,
                      onChange: e => {
                        S(e.target.value);
                      }
                    }),
                    (0, r.jsx)(u.a, { className: "mt-4" }),
                    g && (0, r.jsx)(d._, { text: (0, a.azN)(g, w, "vote"), disableSentryCapture: !0 }),
                    (0, r.jsx)(h.zx, {
                      className: "w-full mt-1",
                      onClick: async () => {
                        void 0 !== i && (await l(i));
                      },
                      disabled: b,
                      "aria-label": "approve button in ntrn review vote cast flow",
                      children: b
                        ? (0, r.jsx)(x.T, { color: v.w.white100 })
                        : (0, r.jsx)("span", { "aria-label": "approve button text in ntrn review vote cast flow", children: "Approve" })
                    })
                  ]
                })
              })
            );
          }
          (u = (g.then ? (await g)() : g)[0]), l();
        } catch (e) {
          l(e);
        }
      });
    },
    77096: function (e, t, s) {
      s.a(e, async function (e, l) {
        try {
          s.d(t, { e: () => c, u: () => i });
          var r,
            a = s(52322);
          s(2784);
          var n = s(78972),
            o = e([n]);
          n = (o.then ? (await o)() : o)[0];
          var i = (((r = {}).OPEN = "open"), (r.EXECUTED = "executed"), (r.PASSED = "passed"), (r.REJECTED = "rejected"), r);
          function c(e) {
            let { status: t } = e;
            switch (t) {
              case "open":
              case n.BC.PROPOSAL_STATUS_IN_PROGRESS:
              case n.BC.PROPOSAL_STATUS_VOTING_PERIOD:
                return (0, a.jsx)("span", { className: "font-semibold  dark:text-orange-300 text-orange-600", children: "In Progress" });
              case "passed":
              case "executed":
              case n.BC.PROPOSAL_STATUS_PASSED:
              case n.BC.PROPOSAL_STATUS_EXECUTED:
                return (0, a.jsx)("span", { className: "font-semibold text-green-600 dark:text-green-300", children: "Executed" });
              case n.BC.PROPOSAL_STATUS_FAILED:
              case n.BC.PROPOSAL_STATUS_REJECTED:
              case "rejected":
                return (0, a.jsx)("span", { className: "font-semibold text-red-300", children: "Rejected" });
              default:
                return (0, a.jsx)("span", { className: "font-semibold text-gray-400", children: "Unspecified" });
            }
          }
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    20365: function (e, t, s) {
      s.a(e, async function (e, l) {
        try {
          s.d(t, { CM: () => a.C, DJ: () => n.D, Gu: () => o.G, Tp: () => r.T, eg: () => i.e, uA: () => i.u });
          var r = s(5837),
            a = s(47764),
            n = s(30121),
            o = s(29240),
            i = s(77096),
            c = e([r, a, n, o, i]);
          ([r, a, n, o, i] = c.then ? (await c)() : c), l();
        } catch (e) {
          l(e);
        }
      });
    },
    95773: function (e, t, s) {
      s.d(t, { $6: () => c, C: () => i, Eb: () => d, NQ: () => u, RW: () => r, YQ: () => a, cR: () => m, lR: () => n, uM: () => x, zv: () => o });
      var l,
        r = (((l = {}).YES = "Yes"), (l.NO = "No"), (l.NO_WITH_VETO = "No with Veto"), (l.ABSTAIN = "Abstain"), l);
      let a = (e, t) => {
          if (!0 === t) {
            var s;
            return null == e ? void 0 : null === (s = e.proposal) || void 0 === s ? void 0 : s.title;
          }
          return null == e ? void 0 : e.title;
        },
        n = (e, t) => {
          if (!0 === t) {
            var s;
            return null == e ? void 0 : null === (s = e.proposal) || void 0 === s ? void 0 : s.status;
          }
          return null == e ? void 0 : e.status;
        },
        o = (e, t) => (!0 === t ? (null == e ? void 0 : e.id) : null == e ? void 0 : e.proposal_id),
        i = (e, t, s) => {
          var l;
          return !0 === s
            ? (t / ((null == e ? void 0 : null === (l = e.proposal) || void 0 === l ? void 0 : l.total_power) ?? 1)) * 100
            : null == e
              ? void 0
              : e.turnout;
        },
        c = (e, t) => {
          var s, l, r, a;
          return !0 === t
            ? (null == e
                ? void 0
                : null === (a = e.proposal) || void 0 === a
                  ? void 0
                  : null === (r = a.threshold) || void 0 === r
                    ? void 0
                    : null === (l = r.threshold_quorum) || void 0 === l
                      ? void 0
                      : null === (s = l.quorum) || void 0 === s
                        ? void 0
                        : s.percent) * 100
            : null == e
              ? void 0
              : e.quorum;
        },
        d = (e, t) => {
          if (!0 === t) {
            var s;
            return null == e ? void 0 : null === (s = e.proposal) || void 0 === s ? void 0 : s.description;
          }
          return null == e ? void 0 : e.description;
        },
        u = (e, t) => {
          if (!0 === t) {
            var s, l;
            return Math.ceil(
              (null == e ? void 0 : null === (l = e.proposal) || void 0 === l ? void 0 : null === (s = l.expiration) || void 0 === s ? void 0 : s.at_time) / 1e6
            );
          }
          return null == e ? void 0 : e.voting_end_time;
        },
        x = (e, t) => {
          if (!0 === t) {
            var s;
            return null == e ? void 0 : null === (s = e.proposal) || void 0 === s ? void 0 : s.votes;
          }
          return null == e ? void 0 : e.tally;
        },
        m = (e, t) => {
          var s, l;
          return !0 === t
            ? null == e
              ? void 0
              : null === (l = e.proposal) || void 0 === l
                ? void 0
                : l.proposer
            : null == e
              ? void 0
              : null === (s = e.proposer) || void 0 === s
                ? void 0
                : s.address;
        };
    },
    87579: function (e, t, s) {
      s.d(t, { r: () => l });
      let l = {
        60: 18,
        637: 8,
        118: 6,
        529: 6,
        750: 6,
        394: 8,
        234: 6,
        564: 6,
        852: 6,
        639: 6,
        459: 6,
        330: 6,
        990: 6,
        931: 6,
        4444: 6,
        505: 9,
        494: 6,
        0: 8,
        1: 8,
        501: 9,
        784: 9
      };
    },
    65373: function (e, t, s) {
      s.d(t, { r: () => l });
      function l(e) {
        let t = e,
          s = Math.floor(t / 3600);
        s >= 1 ? (t -= 3600 * s) : (s = "00");
        let l = Math.floor(t / 60);
        return (
          l >= 1 ? (t -= 60 * l) : (l = "00"),
          t < 1 && (t = "00"),
          1 == l.toString().length && (l = "0" + l),
          1 == t.toString().length && (t = "0" + t),
          s + ":" + l + ":" + t
        );
      }
    },
    17551: function (e, t, s) {
      s.d(t, { G: () => l });
      function l(e, t, s) {
        var l;
        if (!t) return !0;
        let r = t.trim().toLowerCase();
        return !!(
          (e.chain ? s[e.chain].chainName : "").toLowerCase().includes(r) ||
          ((null == e ? void 0 : e.title) ?? (null == e ? void 0 : null === (l = e.content) || void 0 === l ? void 0 : l.title) ?? "")
            .toLowerCase()
            .includes(r) ||
          e.proposal_id.toString().includes(r) ||
          e.status.toLowerCase().includes(r)
        );
      }
    },
    78990: function (e, t, s) {
      s.d(t, { D: () => l });
      function l(e, t) {
        return 0 === t ? "0%" : `${Number((e / t) * 100).toFixed(2)}%`;
      }
    },
    87315: function (e, t, s) {
      s.a(e, async function (e, l) {
        try {
          s.d(t, { DU: () => o.D, G0: () => n.G, P9: () => i.P, rJ: () => a.r, rw: () => r.r, sR: () => c.s });
          var r = s(87579),
            a = s(65373),
            n = s(17551),
            o = s(78990),
            i = s(90037),
            c = s(1864),
            d = e([c]);
          (c = (d.then ? (await d)() : d)[0]), l();
        } catch (e) {
          l(e);
        }
      });
    },
    90037: function (e, t, s) {
      s.d(t, { P: () => l });
      function l(e, t, s) {
        let l = e.chain ?? "cosmos",
          r = t.chain ?? "cosmos",
          a = s[l].chainName,
          n = s[r].chainName;
        return a.localeCompare(n);
      }
    },
    1864: function (e, t, s) {
      s.a(e, async function (e, l) {
        try {
          s.d(t, { s: () => n });
          var r = s(8292),
            a = e([r]);
          let o = {
              [(r = (a.then ? (await a)() : a)[0]).R.YES]: "border-green-600",
              [r.R.ABSTAIN]: "border-secondary-300",
              [r.R.NO]: "dark:border-red-800 border-red-300",
              [r.R.NO_WITH_VETO]: "dark:border-red-800 border-red-300",
              GENERAL: "border-secondary-300"
            },
            i = {
              [r.R.YES]: "bg-green-600/40",
              [r.R.ABSTAIN]: "bg-secondary-300",
              [r.R.NO]: "bg-red-600/20",
              [r.R.NO_WITH_VETO]: "bg-red-600/20",
              GENERAL: "bg-secondary-300"
            };
          function n(e) {
            let t = Number(e.yes),
              s = Number(e.no),
              l = Number(e.no_with_veto ?? 0),
              a = Number(e.abstain),
              n = Math.max(t + s + a + l, 1),
              c = (t / n) * 100,
              d = (s / n) * 100,
              u = (l / n) * 100,
              x = (a / n) * 100,
              m = Math.max(c, d, u, x, 1);
            return [
              {
                label: r.R.YES,
                percentage: c,
                selectedBorderCSS: c === m ? o[r.R.YES] : o.GENERAL,
                selectedBackgroundCSS: c === m ? i[r.R.YES] : i.GENERAL,
                isMajor: c === m
              },
              {
                label: r.R.NO,
                percentage: d,
                selectedBorderCSS: d === m ? o[r.R.NO] : o.GENERAL,
                selectedBackgroundCSS: d === m ? i[r.R.NO] : i.GENERAL,
                isMajor: d === m
              },
              {
                label: r.R.NO_WITH_VETO,
                percentage: u,
                selectedBorderCSS: u === m ? o[r.R.NO_WITH_VETO] : o.GENERAL,
                selectedBackgroundCSS: u === m ? i[r.R.NO_WITH_VETO] : i.GENERAL,
                isMajor: u === m
              },
              {
                label: r.R.ABSTAIN,
                percentage: x,
                selectedBorderCSS: x === m ? o[r.R.ABSTAIN] : o.GENERAL,
                selectedBackgroundCSS: x === m ? i[r.R.ABSTAIN] : i.GENERAL,
                isMajor: x === m
              }
            ];
          }
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    90258: function (e, t, s) {
      s.d(t, { KT: () => l, Nb: () => a, PV: () => n, d6: () => r });
      let l = { loading: "in progress", success: "successful", submitted: "submitted", failed: "failed" },
        r = {
          DELEGATE: "Stake",
          UNDELEGATE: "Unstake",
          REDELEGATE: "Switching",
          CLAIM_REWARDS: "Claim",
          CANCEL_UNDELEGATION: "Cancel unstake",
          CLAIM_AND_DELEGATE: "Claim"
        },
        a = {
          DELEGATE: "Enter amount to be staked",
          REDELEGATE: "Enter amount to be redelegated",
          UNDELEGATE: "Enter unstaking amount",
          CLAIM_REWARDS: "Enter amount to be claimed",
          CANCEL_UNDELEGATION: "Enter amount to be cancelled",
          CLAIM_AND_DELEGATE: "Enter amount to be claimed"
        },
        n = {
          CLAIM_REWARDS: "Review claim",
          CLAIM_AND_DELEGATE: "Review claim and stake",
          DELEGATE: "Review stake",
          UNDELEGATE: "Review unstake",
          REDELEGATE: "Review validator switching",
          CANCEL_UNDELEGATION: "Review cancel unstake"
        };
    },
    43477: function (e, t, s) {
      s.a(e, async function (e, l) {
        try {
          s.d(t, { P: () => x });
          var r = s(44658),
            a = s(78344),
            n = s(61100),
            o = s(26245),
            i = s(36321),
            c = s(30809),
            d = e([o]);
          o = (d.then ? (await d)() : d)[0];
          let u = new r.hs(),
            x = new r.BP(i.Ui, a.J, c.i, u, o.RZ, o.Gl, i.te, i.NF, n.M);
          l();
        } catch (e) {
          l(e);
        }
      });
    }
  }
]);
//# sourceMappingURL=2790.js.map
