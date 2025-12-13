!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "2c73527a-7065-4778-badd-6a8e7c88dfd3"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-2c73527a-7065-4778-badd-6a8e7c88dfd3"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.23.1" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["9744"],
  {
    68582: function (e, t, a) {
      a.a(e, async function (e, s) {
        try {
          a.r(t), a.d(t, { default: () => L });
          var l = a(52322),
            i = a(56594),
            n = a(41172),
            d = a(73873),
            c = a(15969),
            r = a(75377),
            o = a(3493),
            u = a(26007),
            x = a(6011),
            f = a(78454),
            g = a(19623),
            m = a(69816),
            h = a(26571),
            k = a(72059),
            b = a(30464),
            w = a(29750),
            v = a(75958),
            E = a(2784),
            p = a(10289),
            y = a(46103),
            N = a(53221),
            j = a(49409),
            A = a(48534),
            S = a(76124),
            D = e([k, f, S]);
          [k, f, S] = D.then ? (await D)() : D;
          let T = { loading: { title: "In Progress..." }, success: { title: "Complete" }, submitted: { title: "Submitted" }, failed: { title: "Failed" } },
            L = (0, v.Pi)(e => {
              var t;
              let { rootBalanceStore: a, rootStakeStore: s } = e,
                v = (0, p.TH)(),
                {
                  validator: D,
                  mode: L,
                  forceChain: _,
                  forceNetwork: G,
                  provider: C
                } = (0, E.useMemo)(() => {
                  let e = JSON.parse(sessionStorage.getItem("navigate-stake-pending-txn-state") ?? "null");
                  return (null == v ? void 0 : v.state) ?? e;
                }, [null == v ? void 0 : v.state]),
                M = (0, k.a7)(),
                R = (0, E.useMemo)(() => _ || M, [M, _]),
                I = (0, n.obn)(),
                U = (0, E.useMemo)(() => G || I, [I, G]),
                { pendingTx: z, setPendingTx: H } = (0, n.EEe)(),
                Z = (0, p.s0)(),
                [$, P] = (0, E.useState)(""),
                [V, W] = (0, E.useState)(""),
                [O, B] = (0, E.useState)(!1),
                K = null == D ? void 0 : D.image,
                { data: q } = (0, n.S2A)(),
                { refetchDelegations: F } = (0, n.fHb)(),
                J = (0, E.useCallback)(() => {
                  a.refetchBalances(R, U);
                }, [R, a, U]),
                X = (0, E.useCallback)(() => {
                  s.updateStake(R, U, !0);
                }, [R, s, U]),
                { theme: Y } = (0, r.useTheme)();
              (0, E.useEffect)(() => {
                P(null == z ? void 0 : z.txHash);
              }, [null == z ? void 0 : z.txHash]),
                (0, E.useEffect)(() => {
                  z &&
                    z.promise &&
                    z.promise
                      .then(
                        e => {
                          e && (0, i.isDeliverTxSuccess)(e) ? H({ ...z, txStatus: "success" }) : H({ ...z, txStatus: "failed" });
                        },
                        () => H({ ...z, txStatus: "failed" })
                      )
                      .catch(() => {
                        H({ ...z, txStatus: "failed" });
                      })
                      .finally(() => {
                        J(), X(), "lava" === R && (null == q ? void 0 : q.restaking.extension) === "active" && F();
                      });
                }, []);
              let Q = (0, E.useMemo)(
                  () => ({
                    CLAIM_REWARDS: { loading: "claiming rewards", success: "claimed successfully", failed: "failed claiming", submitted: "claim submitted" },
                    DELEGATE: { loading: "staking", success: "staked successfully", failed: "failed staking", submitted: "stake submitted" },
                    UNDELEGATE: { loading: "unstaking", success: "unstaked successfully", failed: "failed unstaking", submitted: "unstake submitted" },
                    CANCEL_UNDELEGATION: {
                      loading: "cancelling unstake",
                      success: "unstake cancelled successfully",
                      failed: "failed cancelling unstake",
                      submitted: "cancel undelegation submitted"
                    },
                    REDELEGATE: {
                      loading: `switching ${C ? "provider" : "validator"}`,
                      success: `${C ? "provider" : "validator"} switched successfully`,
                      failed: `failed switching ${C ? "provider" : "validator"}`,
                      submitted: "redelegation submitted"
                    },
                    CLAIM_AND_DELEGATE: {
                      loading: "claiming and staking rewards",
                      success: "claimed and staked successfully",
                      failed: "failed claiming and staking",
                      submitted: "claim and delegate submitted"
                    }
                  }),
                  [C]
                ),
                { explorerTxnUrl: ee } = (0, n.xGX)({ forceChain: R, forceNetwork: U, forceTxHash: $ });
              return (
                (0, E.useEffect)(() => {
                  let e = "CLAIM_REWARDS" === L || "UNDELEGATE" === L ? (null == z ? void 0 : z.receivedUsdValue) : null == z ? void 0 : z.sentUsdValue;
                  "-" === e && (e = "CLAIM_REWARDS" === L || "UNDELEGATE" === L ? (null == z ? void 0 : z.receivedAmount) : null == z ? void 0 : z.sentAmount),
                    W(e);
                }, [
                  L,
                  null == z ? void 0 : z.receivedAmount,
                  null == z ? void 0 : z.receivedUsdValue,
                  null == z ? void 0 : z.sentAmount,
                  null == z ? void 0 : z.sentUsdValue
                ]),
                (0, l.jsxs)(f.Z, {
                  children: [
                    (0, l.jsx)(r.Header, { title: `Transaction ${T[(null == z ? void 0 : z.txStatus) ?? "loading"].title}` }),
                    (0, l.jsxs)("div", {
                      className: "flex flex-col justify-between p-6",
                      style: { height: "calc(100% - 72px)" },
                      children: [
                        (0, l.jsxs)("div", {
                          className: "flex flex-col gap-y-4",
                          children: [
                            (0, l.jsxs)("div", {
                              className: "bg-white-100 dark:bg-gray-950 rounded-2xl w-full flex flex-col gap-y-2 items-center p-4",
                              children: [
                                (0, l.jsxs)("div", {
                                  className: "flex items-center justify-center h-[100px] w-[100px]",
                                  children: [
                                    (null == z ? void 0 : z.txStatus) === "loading" && (0, l.jsx)(g.T, { color: "#29a874", className: "w-full h-full" }),
                                    (null == z ? void 0 : z.txStatus) === "success" &&
                                      (0, l.jsx)("img", { src: b.r.Activity.TxSwapSuccess, width: 75, height: 75 }),
                                    (null == z ? void 0 : z.txStatus) === "failed" &&
                                      (0, l.jsx)("img", { src: b.r.Activity.TxSwapFailure, width: 75, height: 75 })
                                  ]
                                }),
                                (0, l.jsxs)("div", {
                                  className: "flex flex-col gap-y-1 items-center",
                                  children: [
                                    (0, l.jsx)(m.Z, { size: "lg", className: "font-bold", color: "text-black-100 dark:text-white-100", children: V }),
                                    (0, l.jsx)(m.Z, {
                                      size: "sm",
                                      color: "text-black-100 dark:text-white-100",
                                      className: "font-medium text-center",
                                      children: null === (t = Q[L]) || void 0 === t ? void 0 : t[(null == z ? void 0 : z.txStatus) ?? "loading"]
                                    })
                                  ]
                                }),
                                (0, l.jsxs)("div", {
                                  className: "flex gap-x-2",
                                  children: [
                                    D &&
                                      (0, l.jsxs)("div", {
                                        className: "flex items-center pr-3 pl-2 py-1.5 rounded-full bg-gray-50 dark:bg-gray-900 gap-x-1.5",
                                        children: [
                                          (0, l.jsx)("img", {
                                            className: "rounded-full",
                                            width: 20,
                                            height: 20,
                                            src: K ?? (null == D ? void 0 : D.image) ?? b.r.Misc.Validator,
                                            onError: (0, j._)(w.GenericLight)
                                          }),
                                          (0, l.jsx)("span", {
                                            className: "text-sm font-bold text-black-100 dark:text-white-100 text-center",
                                            children: (0, d.MD)(
                                              null == D ? void 0 : D.moniker,
                                              (0, A.oj)() ? 6 + Math.floor(((Math.min(window.innerWidth, 400) - 320) / 81) * 7) : 10,
                                              0
                                            )
                                          })
                                        ]
                                      }),
                                    C &&
                                      (0, l.jsxs)("div", {
                                        className: "flex items-center pr-3 pl-2 py-1.5 rounded-full bg-gray-50 dark:bg-gray-900 gap-x-1.5",
                                        children: [
                                          (0, l.jsx)("img", {
                                            className: "rounded-full",
                                            width: 20,
                                            height: 20,
                                            src: b.r.Misc.Validator,
                                            onError: (0, j._)(w.GenericLight)
                                          }),
                                          (0, l.jsx)("span", {
                                            className: "text-sm font-bold text-black-100 dark:text-white-100 text-center",
                                            children: (0, d.MD)(
                                              C.moniker,
                                              (0, A.oj)() ? 6 + Math.floor(((Math.min(window.innerWidth, 400) - 320) / 81) * 7) : 10,
                                              0
                                            )
                                          })
                                        ]
                                      })
                                  ]
                                })
                              ]
                            }),
                            $ &&
                              (0, l.jsx)(r.GenericCard, {
                                isRounded: !0,
                                title: (0, l.jsx)(m.Z, {
                                  size: "sm",
                                  color: "text-black-100 dark:text-white-100",
                                  className: "font-bold mb-1",
                                  children: "Transaction ID"
                                }),
                                subtitle: (0, l.jsx)(m.Z, {
                                  size: "md",
                                  color: "dark:text-gray-400 text-gray-600",
                                  className: "font-medium",
                                  children: (0, n.Hnh)($)
                                }),
                                className: "py-4 px-6 bg-white-100 dark:bg-gray-950",
                                size: "md",
                                icon: (0, l.jsxs)("div", {
                                  className: "flex gap-x-2 items-center shrink-0",
                                  children: [
                                    (0, l.jsx)("button", {
                                      onClick: () => {
                                        N.i.copyText($ ?? ""),
                                          B(!0),
                                          setTimeout(() => {
                                            B(!1);
                                          }, 2e3);
                                      },
                                      disabled: O,
                                      className: "bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center h-8 w-8 disabled:opacity-80",
                                      "aria-label": "stake txn page transaction id button in stake v2 flow",
                                      children: O
                                        ? (0, l.jsx)(x.f, { size: 18, weight: "fill", className: "text-green-500" })
                                        : (0, l.jsx)(o.K, { size: 16, className: "text-black-100 dark:text-white-100" })
                                    }),
                                    ee &&
                                      (0, l.jsx)("button", {
                                        className: "h-8 w-8 rounded-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center",
                                        onClick: e => {
                                          e.stopPropagation(), window.open(ee, "_blank");
                                        },
                                        "aria-label": "stake txn page transaction id button in stake v2 flow",
                                        children: (0, l.jsx)(u.O, { size: 16, className: "text-black-100 dark:text-white-100" })
                                      })
                                  ]
                                })
                              }),
                            (null == z ? void 0 : z.txStatus) === "success" && (0, c.sSP)(R) && (0, l.jsx)(S.H, { mode: L })
                          ]
                        }),
                        (0, l.jsxs)("div", {
                          className: "flex gap-x-4",
                          children: [
                            (0, l.jsx)(r.Buttons.Generic, {
                              onClick: () => Z("/home"),
                              size: "normal",
                              color: Y === r.ThemeName.DARK ? y.w.gray800 : y.w.gray200,
                              className: "mt-auto w-full",
                              children: (0, l.jsx)(m.Z, { color: "dark:text-white-100 text-black-100", children: "Home" })
                            }),
                            (0, l.jsx)(r.Buttons.Generic, {
                              onClick: () => {
                                "DELEGATE" === L ? Z(-1) : Z(`/stake?pageSource=${h.q.StakeTxnPage}`);
                              },
                              color:
                                (null == z ? void 0 : z.txStatus) === "failed" || "DELEGATE" === L
                                  ? y.w.green600
                                  : Y === r.ThemeName.DARK
                                    ? y.w.white100
                                    : y.w.black100,
                              size: "normal",
                              className: "mt-auto w-full",
                              disabled: (null == z ? void 0 : z.txStatus) === "loading",
                              "aria-label": "stake txn page retry button in stake v2 flow",
                              children: (0, l.jsx)(m.Z, {
                                color: `${(null == z ? void 0 : z.txStatus) === "failed" || "DELEGATE" === L ? "text-white-100 dark:text-white-100" : "text-white-100 dark:text-black-100"}`,
                                "aria-label": "stake txn page retry button text in stake v2 flow",
                                children: (null == z ? void 0 : z.txStatus) === "failed" ? "Retry" : "DELEGATE" === L ? "Stake Again" : "Done"
                              })
                            })
                          ]
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
    76124: function (e, t, a) {
      a.a(e, async function (e, s) {
        try {
          a.d(t, { H: () => u });
          var l = a(52322),
            i = a(36906),
            n = a(69816),
            d = a(75958);
          a(2784);
          var c = a(32692),
            r = e([c]);
          c = (r.then ? (await r)() : r)[0];
          let o = { DELEGATE: "staking", UNDELEGATE: "unstaking", CANCEL_UNDELEGATION: "cancel unstaking", REDELEGATE: "restaking", CLAIM_REWARDS: null },
            u = (0, d.Pi)(e => {
              let t = o[e.mode];
              if (!t) return null;
              let a = `Amount is queued for ${t} in next epoch (${c.t.timeLeft}).`;
              return (0, l.jsxs)("div", {
                className: "flex w-full bg-white-100 dark:bg-gray-950 p-4 rounded-2xl gap-2 items-center",
                children: [
                  (0, l.jsx)(i.k, { size: 20, className: "text-orange-500 dark:text-orange-300 shrink-0 items-center" }),
                  (0, l.jsx)(n.Z, { className: "text-xs", children: a })
                ]
              });
            });
          s();
        } catch (e) {
          s(e);
        }
      });
    },
    32692: function (e, t, a) {
      a.a(e, async function (e, s) {
        try {
          a.d(t, { t: () => r });
          var l = a(44658),
            i = a(36321),
            n = a(48346),
            d = a(30809),
            c = e([n]);
          n = (c.then ? (await c)() : c)[0];
          let r = new l.H9(n.lc, i.Ui, d.i);
          s();
        } catch (e) {
          s(e);
        }
      });
    }
  }
]);
//# sourceMappingURL=9744.js.map
