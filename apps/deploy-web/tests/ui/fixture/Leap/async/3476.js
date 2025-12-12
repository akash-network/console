!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "bae048a7-5631-4e72-9251-0851f68b6d2d"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-bae048a7-5631-4e72-9251-0851f68b6d2d"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.23.1" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["3476"],
  {
    63400: function (e, t, a) {
      a.d(t, { u: () => l });
      var n = a(52322),
        s = a(71769);
      a(2784);
      var i = a(70514);
      function l(e) {
        let { className: t } = e;
        return (0, n.jsxs)("div", {
          className: (0, i.cn)("w-full flex flex-row items-start px-4 py-3 justify-start dark:bg-red-900 bg-red-100 rounded-2xl", t),
          children: [
            (0, n.jsx)(s.v, { weight: "fill", size: 20, className: "mr-2 text-destructive-100 p-[2px]" }),
            (0, n.jsxs)("div", {
              children: [
                (0, n.jsx)("p", { className: "text-sm text-foreground font-bold !leading-[20px]", children: "Unable to connect to ledger device" }),
                (0, n.jsx)("p", {
                  className: "text-xs text-secondary-800 font-medium !leading-[19px] mt-1",
                  children: "Please check if your ledger is connected and try again."
                })
              ]
            })
          ]
        });
      }
    },
    71517: function (e, t, a) {
      a.d(t, { X: () => l });
      var n = a(52322),
        s = a(30464);
      a(2784);
      var i = a(70514);
      function l(e) {
        let { checked: t, onClick: a, isWhite: l } = e;
        return (0, n.jsx)("div", {
          className: "w-[20px] h-[20px] rounded cursor-pointer flex justify-center items-center",
          onClick: a,
          children: t
            ? (0, n.jsx)("div", {
                className: "w-[15px] h-[15px] relative",
                children: (0, n.jsx)("img", {
                  src: l ? s.r.Misc.FilledRoundedSquareWhite : s.r.Misc.FilledRoundedSquareCheckMark,
                  className: "absolute inset-0"
                })
              })
            : (0, n.jsx)("div", { className: (0, i.cn)("w-[15px] h-[15px] rounded-[2px] border-[2px]", { "border-green-600": !l, "border-white-100": l }) })
        });
      }
    },
    49728: function (e, t, a) {
      a.d(t, { U: () => c });
      var n = a(2784),
        s = a(10289),
        i = a(55736),
        l = a(48534),
        o = a(72565),
        r = a.n(o);
      let c = () => {
        let e = (0, s.s0)();
        return (0, n.useCallback)(async () => {
          let t = r().extension.getViews({ type: "popup" }),
            a = 0 === t.length && 600 === window.outerHeight && 400 === window.outerWidth,
            n = -1 !== t.findIndex(e => e === window);
          if (a || n || (0, l.oj)()) {
            if (!(0, l.oj)()) {
              let e = (await r().windows.getAll()).find(e => "popup" !== e.type);
              e && r().tabs.create({ url: r().runtime.getURL("index.html#/reconnect-ledger"), windowId: e.id }), window.close();
              return;
            }
            window.open("index.html#/reconnect-ledger", "_blank"), (0, i.I)();
          } else e("/reconnect-ledger");
        }, [e]);
      };
    },
    52516: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { Z: () => f });
          var s = a(52322),
            i = a(41172),
            l = a(75377),
            o = a(26007),
            r = a(72779),
            c = a.n(r),
            d = a(49728),
            u = a(75958),
            h = a(2784),
            p = a(78344),
            m = a(80502),
            g = a(71491),
            x = e([g]);
          g = (x.then ? (await x)() : x)[0];
          let f = (0, u.Pi)(e => {
            let {
                invalidAmount: t,
                amountExceedsBalance: a,
                isMoreThanOneStepTransaction: n,
                redirectUrl: r,
                errorMsg: u,
                bridgeFeeError: x,
                inAmountEmpty: f,
                isRefreshing: b,
                checkNeeded: w,
                isPriceImpactChecked: v,
                reviewBtnDisabled: k,
                onReviewClick: S,
                isLedgerDisconnectedError: C,
                isNoRoutesAvailable: j
              } = e,
              y = (0, i.rTu)(),
              N = (0, d.U)(),
              I = (0, h.useMemo)(
                () =>
                  t
                    ? "Amount must be greater than 0"
                    : a
                      ? "Insufficient balance"
                      : (0, g.qo)(u)
                        ? "No transaction routes available"
                        : "evmos" === p.J.activeChain && (null == y ? void 0 : y.walletType) === i._KQ.LEDGER
                          ? "Not supported using Ledger wallet"
                          : x || (f ? "Enter amount" : C ? "Connect Ledger" : j ? "No routes available" : "Review Transfer"),
                [null == y ? void 0 : y.walletType, a, f, u, t, x, C, j]
              ),
              D = (0, h.useMemo)(
                () => ("evmos" === p.J.activeChain && (null == y ? void 0 : y.walletType) === i._KQ.LEDGER) || k || b || (w && !v),
                [null == y ? void 0 : y.walletType, w, v, b, k]
              );
            return (0, s.jsx)("div", {
              className: "sticky bottom-0 left-0 z-[2] right-0 bg-secondary-100 px-5 py-4",
              children: n
                ? (0, s.jsx)(l.Buttons.Generic, {
                    className: "w-full dark:!bg-white-100 !bg-black-100 text-white-100 dark:text-black-100 h-[52px]",
                    onClick: () => window.open(r, "_blank"),
                    style: { boxShadow: "none" },
                    "aria-label": "swap on leap web app button in swaps v2 flow",
                    children: (0, s.jsxs)("span", {
                      className: "flex items-center gap-1",
                      children: [
                        "Swap on Leap web app",
                        " ",
                        (0, s.jsx)(o.O, { size: 20, className: "!leading-[20px] !text-lg", "aria-label": "swap on leap web app icon in swaps v2 flow" })
                      ]
                    })
                  })
                : (0, s.jsx)(s.Fragment, {
                    children: (0, s.jsx)(l.Buttons.Generic, {
                      className: c()("w-full  h-[52px] text-white-100", {
                        "!bg-primary": !(t || a || (0, g.qo)(u) || x),
                        "!bg-destructive-100/40": t || a || (0, g.qo)(u) || !!x
                      }),
                      disabled: D,
                      style: { boxShadow: "none" },
                      onClick: () => {
                        if (C) {
                          N();
                          return;
                        }
                        (null == y ? void 0 : y.watchWallet) ? m.o.setShowPopup(!0) : S(!0);
                      },
                      "aria-label": "review button in swaps v2 flow",
                      children: I
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
    52173: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { Z: () => m });
          var s = a(52322),
            i = a(15969),
            l = a(58885),
            o = a(80588),
            r = a(2784),
            c = a(42799),
            d = a(48346),
            u = a(27321),
            h = a(61539),
            p = e([h, l, d, o]);
          [h, l, d, o] = p.then ? (await p)() : p;
          let m = e => {
            let { showFeesSettingSheet: t, setShowFeesSettingSheet: a } = e,
              {
                sourceChain: n,
                setFeeDenom: p,
                setGasOption: m,
                gasEstimate: g,
                userPreferredGasLimit: x,
                setUserPreferredGasLimit: f,
                setUserPreferredGasPrice: b,
                setGasError: w,
                gasError: v,
                gasPriceOption: k,
                setGasPriceOption: S
              } = (0, h.xY)();
            (0, r.useEffect)(() => {
              w("");
            }, [n]);
            let C = (0, r.useCallback)((e, t) => {
              null == S || S(e), p({ ...t.denom, ibcDenom: t.ibcDenom }), m(e.option), b(e.gasPrice);
            }, []);
            return (0, s.jsx)(l.ZP, {
              recommendedGasLimit: g.toString(),
              gasLimit: (null == x ? void 0 : x.toString()) ?? g.toString(),
              setGasLimit: e => f(Number(e.toString())),
              disableBalanceCheck: (0, i.KPM)((null == n ? void 0 : n.chainId) ?? ""),
              gasPriceOption: k,
              onGasPriceOptionChange: C,
              error: v,
              setError: w,
              chain: null == n ? void 0 : n.key,
              rootDenomsStore: c.gb,
              rootBalanceStore: d.jZ,
              network: u.a,
              children: (0, s.jsx)(o.k, {
                showFeesSettingSheet: t,
                onClose: () => {
                  a(!1);
                },
                gasError: v
              })
            });
          };
          n();
        } catch (e) {
          n(e);
        }
      });
    },
    82031: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { Z: () => h });
          var s = a(52322),
            i = a(75958),
            l = a(61539),
            o = a(99347),
            r = a(2784),
            c = a(1789),
            d = a(41720),
            u = e([l]);
          l = (u.then ? (await u)() : u)[0];
          let h = (0, i.Pi)(e => {
            let { isPriceImpactChecked: t, setIsPriceImpactChecked: a, rootDenomsStore: n } = e,
              { routingInfo: i, sourceToken: u, destinationToken: h } = (0, l.xY)(),
              p = Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }),
              {
                shouldCheckPriceImpact: m,
                priceImpactPercent: g,
                usdValueDecreasePercent: x,
                sourceAssetUSDValue: f,
                destinationAssetUSDValue: b
              } = (0, r.useMemo)(() => (0, o.i_)(null == i ? void 0 : i.route, u, h, n.allDenoms), [h, n.allDenoms, null == i ? void 0 : i.route, u]);
            return m
              ? g.isNaN()
                ? x.isNaN()
                  ? (0, s.jsx)(d.I, {
                      title: "Low information warning",
                      message: "I understand that I might get an unfavourable exchange rate for this transaction.",
                      isChecked: t,
                      setIsChecked: a
                    })
                  : x.lt(5)
                    ? null
                    : (0, s.jsx)(d.I, {
                        title: "Bad trade warning",
                        title2: `-${x.toFixed(2)}%`,
                        message: `Estimated output value ($${p.format(b.toNumber())}) is ${x.toFixed(2)}% lower than estimated input value ($${p.format(f.toNumber())}).
          I understand and wish to proceed.`,
                        isChecked: t,
                        setIsChecked: a
                      })
                : g.lt(5)
                  ? x.isNaN()
                    ? (0, s.jsx)(c.X, { type: "warning", message: "Price data unavailable for selected token(s)." })
                    : x.lt(5)
                      ? null
                      : (0, s.jsx)(d.I, {
                          title: "Bad trade warning",
                          title2: `-${x.toFixed(2)}%`,
                          message: `Estimated output value ($${p.format(b.toNumber())}) is ${x.toFixed(2)}% lower than estimated input value ($${p.format(f.toNumber())}). I understand and wish to proceed.`,
                          isChecked: t,
                          setIsChecked: a
                        })
                  : x.isNaN() || x.lt(5)
                    ? (0, s.jsx)(d.I, {
                        title: "Bad trade warning",
                        title2: `-${g.toFixed(2)}%`,
                        message: `Swap will execute at a ${g.toFixed(2)}% worse price than the estimated on-chain price, due to low liquidity. I understand and wish to proceed.`,
                        isChecked: t,
                        setIsChecked: a
                      })
                    : x.gt(g)
                      ? (0, s.jsx)(d.I, {
                          title: "Bad trade warning",
                          title2: `-${x.toFixed(2)}%`,
                          message: `Estimated output value ($${p.format(b.toNumber())}) is ${x.toFixed(2)}% lower than estimated input value ($${p.format(f.toNumber())}). I understand and wish to proceed.`,
                          isChecked: t,
                          setIsChecked: a
                        })
                      : (0, s.jsx)(d.I, {
                          title: "Bad trade warning",
                          title2: `-${g.toFixed(2)}%`,
                          message: `Swap will execute at a ${g.toFixed(2)}% worse price than the estimated on-chain price, due to low liquidity. I understand and wish to proceed.`,
                          isChecked: t,
                          setIsChecked: a
                        })
              : null;
          });
          n();
        } catch (e) {
          n(e);
        }
      });
    },
    1789: function (e, t, a) {
      a.d(t, { X: () => o });
      var n = a(52322),
        s = a(71769),
        i = a(72779),
        l = a.n(i);
      function o(e) {
        let { type: t = "warning", message: a } = e;
        return (0, n.jsxs)("div", {
          className: l()("flex flex-row justify-start items-start gap-2 px-4 py-3 rounded-2xl ", {
            "bg-orange-200 dark:bg-orange-900": "warning" === t,
            "bg-red-200 dark:bg-red-900": "error" === t
          }),
          children: [
            (0, n.jsx)(s.v, {
              size: 16,
              className: l()("!leading-[20px]", { "text-orange-500 dark:text-orange-300": "warning" === t, "text-red-400 dark:text-red-300": "error" === t })
            }),
            (0, n.jsx)("span", { className: "font-medium text-left text-xs !leading-[20px] text-black-100 dark:text-white-100", children: a })
          ]
        });
      }
      a(2784);
    },
    41720: function (e, t, a) {
      a.d(t, { I: () => l });
      var n = a(52322),
        s = a(71769),
        i = a(71517);
      function l(e) {
        let { isChecked: t, setIsChecked: a, title: l, message: o, title2: r } = e;
        return (0, n.jsxs)("div", {
          className: "flex flex-col w-full justify-start items-start gap-2 px-4 py-3 rounded-2xl bg-red-200 dark:bg-red-900",
          children: [
            (0, n.jsxs)("div", {
              className: "flex w-full flex-row justify-between items-start gap-2",
              children: [
                (0, n.jsxs)("div", {
                  className: "flex flex-row justify-start items-start gap-2",
                  children: [
                    (0, n.jsx)(s.v, { size: 16, className: "text-red-400 dark:text-red-300" }),
                    (0, n.jsx)("span", { className: "font-bold text-left text-sm !leading-[20px] text-black-100 dark:text-white-100", children: l })
                  ]
                }),
                (0, n.jsx)("span", { className: "font-medium text-left text-sm !leading-[20px] text-black-100 dark:text-white-100", children: r })
              ]
            }),
            (0, n.jsxs)("div", {
              className: "flex flex-row justify-start items-start gap-2",
              children: [
                (0, n.jsx)(i.X, { checked: t, onClick: () => a(!t), "aria-label": "warning checkbox" }),
                (0, n.jsx)("span", { className: "font-medium text-left text-xs !leading-[20px] text-gray-800 dark:text-gray-200", children: o })
              ]
            })
          ]
        });
      }
      a(2784);
    },
    37313: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { B: () => h });
          var s = a(52322),
            i = a(63400),
            l = a(61539),
            o = a(71491);
          a(2784);
          var r = a(42799),
            c = a(82031),
            d = a(1789),
            u = e([l, o, c]);
          function h(e) {
            var t;
            let { isPriceImpactChecked: a, setIsPriceImpactChecked: n, ledgerError: u, isLedgerDisconnectedError: h } = e,
              {
                routingInfo: p,
                isMoreThanOneStepTransaction: m,
                gasError: g,
                errorMsg: x,
                amountExceedsBalance: f,
                isSanctionedAddressPresent: b
              } = (0, l.xY)();
            if (b) return (0, s.jsx)(d.X, { message: "Unable to process this transaction", type: "error" });
            if ((0, o.qo)(x)) return null;
            if (m) return (0, s.jsx)(d.X, { message: "This is a multi-step route, please navigate to Leap web app to complete the swap" });
            if (!f) {
              if (x) return (0, s.jsx)(d.X, { message: x, type: "error" });
              if (g) return (0, s.jsx)(d.X, { message: g, type: "error" });
            }
            return h
              ? (0, s.jsx)(i.u, {})
              : u
                ? (0, s.jsx)(d.X, { message: u, type: "warning" })
                : (null === (t = p.route) || void 0 === t ? void 0 : t.response)
                  ? (0, s.jsx)(c.Z, { isPriceImpactChecked: a, setIsPriceImpactChecked: n, rootDenomsStore: r.gb })
                  : null;
          }
          ([l, o, c] = u.then ? (await u)() : u), n();
        } catch (e) {
          n(e);
        }
      });
    },
    31890: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { B: () => s.B });
          var s = a(37313),
            i = e([s]);
          (s = (i.then ? (await i)() : i)[0]), n();
        } catch (e) {
          n(e);
        }
      });
    },
    29673: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.r(t), a.d(t, { default: () => G });
          var s = a(52322),
            i = a(41172),
            l = a(15969),
            o = a(6391),
            r = a.n(o),
            c = a(72779),
            d = a.n(c),
            u = a(69816),
            h = a(26571),
            p = a(78646),
            m = a(76131),
            g = a(38313),
            x = a(55978),
            f = a(42941),
            b = a(57124),
            w = a(24542),
            v = a.n(w),
            k = a(75958),
            S = a(34301),
            C = a(19126),
            j = a.n(C),
            y = a(2784),
            N = a(10289),
            I = a(78344),
            D = a(81354),
            T = a(26245),
            E = a(42799),
            A = a(70514),
            P = a(12499),
            F = a(23222),
            B = a(52516),
            L = a(52173),
            $ = a(30802),
            q = a(31890),
            O = a(61539),
            M = a(71491),
            U = a(24170),
            _ = a(99347),
            R = e([g, M, m, $, q, B, L, S, F, p, O, T, U]);
          [g, M, m, $, q, B, L, S, F, p, O, T, U] = R.then ? (await R)() : R;
          let Z = (0, k.Pi)(() => {
              var e;
              let t = (0, N.s0)(),
                a = (0, b.a)(),
                n = (0, y.useRef)(0),
                o = (0, y.useRef)(),
                r = (0, i.rTu)(),
                [c, p] = (0, y.useState)(!1),
                [w, k] = (0, y.useState)("source"),
                [C, I] = (0, y.useState)(!1),
                [T, U] = (0, y.useState)(!1),
                [R, Z] = (0, y.useState)(!1),
                [V, G] = (0, y.useState)(!1),
                [X, z] = (0, y.useState)(!1),
                [W, H] = (0, y.useState)(!1),
                [Q, Y] = (0, y.useState)(!1),
                [K, J] = (0, y.useState)(!1),
                [ee, et] = (0, y.useState)(!1),
                [ea, en] = (0, y.useState)(),
                [es, ei] = (0, y.useState)(!1),
                [el, eo] = (0, y.useState)(!1),
                [er, ec] = (0, y.useState)(!1),
                [ed, eu] = (0, y.useState)(!1),
                [eh, ep] = (0, y.useState)(null),
                [em, eg] = (0, y.useState)(null),
                [ex, ef] = (0, y.useState)(null),
                eb = (0, x.o)();
              (0, f.Z)().get("pageSource");
              let ew = (0, g.ob)();
              (0, y.useEffect)(() => {
                if ("testnet" === ew) {
                  eo(!0);
                  let e = setTimeout(() => {
                    eo(!1);
                  }, 1e4);
                  return () => clearTimeout(e);
                }
              }, [ew]);
              let {
                  inAmount: ev,
                  sourceToken: ek,
                  loadingSourceAssets: eS,
                  sourceChain: eC,
                  sourceTokenBalanceStatus: ej,
                  handleInAmountChange: ey,
                  sourceAssets: eN,
                  loadingChains: eI,
                  chainsToShow: eD,
                  invalidAmount: eT,
                  amountExceedsBalance: eE,
                  amountOut: eA,
                  destinationToken: eP,
                  destinationChain: eF,
                  loadingDestinationAssets: eB,
                  destinationTokenBalancesStatus: eL,
                  destinationAssets: e$,
                  reviewBtnDisabled: eq,
                  setSourceToken: eO,
                  setDestinationToken: eM,
                  setSourceChain: eU,
                  setDestinationChain: e_,
                  redirectUrl: eR,
                  isMoreThanOneStepTransaction: eZ,
                  refresh: eV,
                  handleSwitchOrder: eG,
                  isSwitchOrderPossible: eX,
                  setInAmount: ez,
                  errorMsg: eW,
                  feeDenom: eH,
                  routingInfo: eQ,
                  isChainAbstractionView: eY,
                  loadingRoutes: eK,
                  slippagePercent: eJ,
                  userPreferredGasLimit: e0,
                  userPreferredGasPrice: e2,
                  gasEstimate: e1,
                  gasOption: e7,
                  bridgeFeeError: e5
                } = (0, O.xY)(),
                {
                  priceImpactPercent: e4,
                  usdValueDecreasePercent: e3,
                  destinationAssetUSDValue: e9,
                  sourceAssetUSDValue: e8
                } = (0, y.useMemo)(
                  () => (0, _.i_)(null == eQ ? void 0 : eQ.route, ek, eP, E.gb.allDenoms),
                  [null == eQ ? void 0 : eQ.route, ek, eP, E.gb.allDenoms]
                ),
                e6 = (0, y.useMemo)(() => "request-confirmation" === (0, _.Us)(eQ.route, ek, eP, E.gb.allDenoms), [eQ.route, ek, eP]);
              (0, y.useEffect)(() => {
                e6 ? Z(!1) : Z(!0);
              }, [e6]);
              let te = (0, y.useCallback)(() => {
                Z(!1);
              }, []);
              (0, y.useEffect)(
                () => (
                  Number(eA) && ![W, K, c, Q, T].includes(!0)
                    ? (o.current = setInterval(async () => {
                        if (10 === n.current) {
                          (n.current = 0), I(!0), te();
                          try {
                            await eV();
                          } catch (e) {}
                          I(!1);
                          return;
                        }
                        n.current += 1;
                      }, 1e3))
                    : (n.current = 0),
                  () => clearInterval(o.current)
                ),
                [eA, eV, W, K, c, Q, T, te]
              );
              let tt = (0, y.useMemo)(() => {
                var e;
                let t, a;
                return (
                  (null == ek ? void 0 : ek.usdPrice) &&
                    !isNaN(parseFloat(null == ek ? void 0 : ek.usdPrice)) &&
                    ev &&
                    !isNaN(parseFloat(ev)) &&
                    (t = parseFloat(null == ek ? void 0 : ek.usdPrice) * parseFloat(ev)),
                  (null == eP ? void 0 : eP.usdPrice) &&
                    !isNaN(parseFloat(null == eP ? void 0 : eP.usdPrice)) &&
                    eA &&
                    !isNaN(parseFloat(eA)) &&
                    (a = parseFloat(eP.usdPrice) * parseFloat(eA)),
                  {
                    pageName: h.q.SwapsQuoteReady,
                    priceImpactPercent: null == e4 ? void 0 : e4.toNumber(),
                    balanceSufficient: !eE,
                    routePresent: !!(null == eQ ? void 0 : eQ.route),
                    userApproval: e6 ? "High Price Impact" : e3.isNaN() ? "Token Price Unavailable" : "",
                    fromToken: null == ek ? void 0 : ek.symbol,
                    fromTokenAmount: t,
                    fromChain: (null == eC ? void 0 : eC.chainName) ?? "",
                    toToken: null == eP ? void 0 : eP.symbol,
                    toChain: null == eF ? void 0 : eF.chainName,
                    toTokenAmount: a,
                    transactionCount: null == eQ ? void 0 : null === (e = eQ.route) || void 0 === e ? void 0 : e.transactionCount
                  }
                );
              }, [
                eE,
                eA,
                e6,
                null == eF ? void 0 : eF.chainName,
                null == eP ? void 0 : eP.symbol,
                null == eP ? void 0 : eP.usdPrice,
                ev,
                e4,
                null == eQ ? void 0 : eQ.route,
                null == eC ? void 0 : eC.chainName,
                null == ek ? void 0 : ek.symbol,
                null == ek ? void 0 : ek.usdPrice,
                e3
              ]);
              (0, y.useEffect)(() => {
                if (er && !ed)
                  try {
                    v().track(h.B_.PageView, tt), eu(!0);
                  } catch (e) {}
              }, [tt, er, ed]),
                (0, y.useEffect)(() => {
                  eu(!1);
                }, [ev, ek, eP]),
                (0, y.useEffect)(() => {
                  parseFloat(ev) > 0 && !eK && ((0, M.qo)(eW) || ((null == eQ ? void 0 : eQ.route) && parseFloat(eA) > 0)) ? ec(!0) : ec(!1);
                }, [ev, eK, null == eQ ? void 0 : eQ.route, e4, e6, eE, eA, eW]),
                (0, y.useEffect)(() => {
                  D.K5.resetUpdateCount();
                }, [
                  null == ek ? void 0 : ek.ibcDenom,
                  null == ek ? void 0 : ek.coinMinimalDenom,
                  null == eP ? void 0 : eP.ibcDenom,
                  null == eP ? void 0 : eP.coinMinimalDenom
                ]);
              let ta = (0, y.useMemo)(
                  () =>
                    r && r.walletType === i._KQ.LEDGER
                      ? eD.filter(e => {
                          let t = Object.values(l.oCA).find(t => t.chainId === e.chainId);
                          return !!t && r.addresses[t.key];
                        })
                      : eD,
                  [r, eD]
                ),
                { _destinationChainsToShow: tn, _destinationAssets: ts } = (0, y.useMemo)(() => {
                  let e = e$.filter(e => e.skipAsset.symbol === (null == eP ? void 0 : eP.skipAsset.symbol)),
                    t = [];
                  return (
                    e.forEach(e => {
                      ta.forEach(a => {
                        a.chainId === e.skipAsset.chainId && t.push({ chain: a, asset: e });
                      });
                    }),
                    { _destinationAssets: e, _destinationChainsToShow: t }
                  );
                }, [ta, eP, e$]),
                ti = (0, y.useMemo)(() => (0, P.h)(ea), [ea]),
                tl = (0, y.useMemo)(() => eI || eS || (!!eY && (null == ek ? void 0 : ek.amount) === "0" && "loading" === ej), [eY, eI, eS, ek, ej]),
                to = (0, y.useCallback)(e => {
                  try {
                    v().track(h.B_.DropdownOpened, { dropdownType: e });
                  } catch (e) {}
                }, []),
                tr = (0, y.useCallback)(() => {
                  J(!0);
                }, [J]),
                tc = (0, y.useCallback)(
                  e => {
                    ey(e), te();
                  },
                  [ey, te]
                ),
                td = (0, y.useCallback)(() => {
                  p(!0), k("source"), te(), to("Source Token");
                }, [p, k, te, to]),
                tu = (0, y.useCallback)(() => {
                  H(!0), k("source"), te();
                }, [te, H, k]),
                th = (0, y.useCallback)(() => {
                  p(!0), k("destination"), te(), to("Destination Token");
                }, [p, k, te, to]),
                tp = (0, y.useCallback)(() => {
                  H(!0), k("destination"), te(), to("Destination Chain");
                }, [te, H, k, to]),
                tm = (0, y.useCallback)(() => {
                  H(!1), k("");
                }, [H, k]),
                tg = (0, y.useCallback)(
                  e => {
                    "source" === w && e.chainId !== (null == eC ? void 0 : eC.chainId)
                      ? (eU(e), eO(null))
                      : "destination" === w && e.chainId !== (null == eF ? void 0 : eF.chainId) && (e_(e), eM(null)),
                      H(!1),
                      k("");
                  },
                  [null == eF ? void 0 : eF.chainId, e_, eM, eU, eO, w, null == eC ? void 0 : eC.chainId]
                ),
                tx = (0, y.useCallback)(
                  e => {
                    let t = Object.values(eb).find(t => t.chainId === e.chain.chainId);
                    if (t) {
                      ef({ chain: e.chain, callbackToUse: "handleSetChain" }), ep(t);
                      return;
                    }
                    tg(e.chain);
                  },
                  [eb, tg]
                ),
                tf = (0, y.useCallback)(
                  e => {
                    e_(e.chain);
                    let t = ts.find(t => t.skipAsset.chainId === e.chain.chainId && (!e.asset || t.skipAsset.denom === e.asset.skipAsset.denom));
                    eM(t), H(!1), k("");
                  },
                  [ts, e_, eM, H, k]
                ),
                tb = (0, y.useCallback)(
                  e => {
                    let t = Object.values(eb).find(t => t.chainId === e.chain.chainId);
                    if (t) {
                      ef({ asset: e.asset, chain: e.chain, callbackToUse: "handleSetDestinationChain" }), ep(t);
                      return;
                    }
                    tf(e);
                  },
                  [eb, tf]
                ),
                tw = (0, y.useCallback)(() => {
                  p(!1), k("");
                }, [p, k]),
                tv = (0, y.useCallback)(
                  e => {
                    let t = ta.find(t => t.chainId === e.skipAsset.chainId);
                    "source" === w ? (eY && eU(t), eO(e)) : "destination" === w && (eY && e_(t), eM(e)), p(!1), k("");
                  },
                  [ta, w, eY, eO, eU, eM, e_]
                ),
                tk = (0, y.useCallback)(
                  e => {
                    let t = Object.values(eb).find(t => t.chainId === e.skipAsset.chainId);
                    if (t) {
                      eg(e), ep(t);
                      return;
                    }
                    tv(e);
                  },
                  [eb, tv]
                ),
                tS = (0, y.useCallback)(() => {
                  ep(null),
                    em
                      ? (tv(em), eg(null))
                      : ex &&
                        ("handleSetChain" === ex.callbackToUse
                          ? tx(ex)
                          : "handleSetDestinationChain" === ex.callbackToUse && tf({ asset: ex.asset, chain: ex.chain }),
                        ef(null));
                }, [em, ex, tv, tx, tf]),
                tC = (0, y.useCallback)(() => {
                  et(!0);
                }, [et]),
                tj = (0, y.useCallback)(() => {
                  et(!1);
                }, [et]),
                ty = (0, y.useCallback)(() => {
                  J(!1);
                }, [J]),
                tN = (0, y.useCallback)(() => {
                  z(!1);
                }, [z]),
                tI = (0, y.useCallback)(
                  e => {
                    U(e);
                  },
                  [U]
                ),
                tD = (0, y.useCallback)(() => {
                  U(!1);
                }, [U]),
                tT = (0, y.useCallback)(() => {
                  U(!1), Y(!0), ea && en(void 0);
                }, [U, Y, ea]),
                tE = (0, y.useCallback)(
                  (e, a, n, s) => {
                    if (e || a || n || s) {
                      let i = "";
                      (i = `?${j().stringify({ sourceChainId: e, sourceToken: a, destinationChainId: n, destinationToken: s, pageSource: "swapAgain" })}`),
                        t(`/swap${i}`);
                    } else ez("");
                    Y(!1),
                      setTimeout(() => {
                        eV();
                      }, 50);
                  },
                  [t, ez, Y, eV]
                ),
                tA = (0, y.useCallback)(
                  e => {
                    en(e), e && Y(!1);
                  },
                  [en, Y]
                );
              return (
                (0, m.$)({ page: "swaps", queryStatus: tl || eB ? "loading" : "success", op: "swapsPageLoad", description: "loading state on swaps page" }),
                (0, s.jsxs)("div", {
                  className: d()("panel-width panel-height enclosing-panel"),
                  children: [
                    (0, s.jsx)($.B, { onSettings: tr, currentSlippage: eJ }),
                    (0, s.jsxs)("div", {
                      className: "relative flex flex-1 flex-col justify-between w-full gap-3 relative h-[calc(100%-128px)] overflow-y-scroll",
                      children: [
                        !!el &&
                          (0, s.jsx)("div", {
                            className: "flex flex-col items-center justify-center px-4 py-2 bg-primary",
                            children: (0, s.jsx)(u.Z, {
                              size: "xs",
                              color: "text-foreground",
                              className: "font-bold",
                              children: "Switched to mainnet for swaps"
                            })
                          }),
                        (0, s.jsxs)("div", {
                          className: (0, A.cn)("flex flex-col w-full gap-3 relative px-6", el ? "pt-3" : "pt-6"),
                          children: [
                            (0, s.jsxs)("div", {
                              className: "w-full flex flex-col items-center gap-y-1",
                              children: [
                                (0, s.jsx)(F.r1, {
                                  value: ev,
                                  isInputInUSDC: es,
                                  setIsInputInUSDC: ei,
                                  token: ek,
                                  balanceStatus: ej,
                                  loadingAssets: tl,
                                  loadingChains: eI,
                                  chainName: null == eC ? void 0 : eC.chainName,
                                  chainLogo: (null == eC ? void 0 : eC.icon) ?? a,
                                  onChange: tc,
                                  selectTokenDisabled: 0 === eN.length || !eC,
                                  selectChainDisabled: 0 === ta.length,
                                  onTokenSelectSheet: td,
                                  onChainSelectSheet: tu,
                                  amountError: eE || eT,
                                  showFor: "source",
                                  selectedChain: eY ? eC : void 0,
                                  isChainAbstractionView: eY,
                                  feeDenom: eH,
                                  sourceChain: eC,
                                  userPreferredGasLimit: e0,
                                  userPreferredGasPrice: e2,
                                  gasEstimate: e1,
                                  gasOption: e7
                                }),
                                (0, s.jsx)(F.cO, { isSwitchOrderPossible: eX, handleSwitchOrder: eG }),
                                (0, s.jsx)(F.r1, {
                                  readOnly: !0,
                                  isInputInUSDC: es,
                                  setIsInputInUSDC: ei,
                                  value: eA ? Number(eA).toFixed(6) : eA,
                                  token: eP,
                                  balanceStatus: eL,
                                  loadingChains: eI,
                                  loadingAssets: eI || eB,
                                  chainName: null == eF ? void 0 : eF.chainName,
                                  chainLogo: (null == eF ? void 0 : eF.icon) ?? a,
                                  selectTokenDisabled: 0 === e$.length || !eF,
                                  selectChainDisabled: 0 === ta.length,
                                  onTokenSelectSheet: th,
                                  onChainSelectSheet: tp,
                                  isChainAbstractionView: eY,
                                  showFor: "destination",
                                  assetUsdValue: e9,
                                  feeDenom: eH,
                                  sourceChain: eF,
                                  userPreferredGasLimit: e0,
                                  userPreferredGasPrice: e2,
                                  gasEstimate: e1,
                                  gasOption: e7
                                })
                              ]
                            }),
                            (0, s.jsx)(q.B, { isPriceImpactChecked: R, setIsPriceImpactChecked: Z, ledgerError: ea, isLedgerDisconnectedError: ti }),
                            (0, s.jsx)(F.SS, { setShowMoreDetailsSheet: z, rootDenomsStore: E.gb })
                          ]
                        }),
                        (0, s.jsx)(B.Z, {
                          isMoreThanOneStepTransaction: eZ,
                          redirectUrl: eR,
                          errorMsg: eW,
                          bridgeFeeError: e5,
                          invalidAmount: eT,
                          amountExceedsBalance: eE,
                          isRefreshing: C,
                          checkNeeded: e6,
                          isPriceImpactChecked: R,
                          reviewBtnDisabled: eq,
                          inAmountEmpty: !ev || 0 === parseFloat(ev),
                          onReviewClick: tI,
                          isLedgerDisconnectedError: ti,
                          isNoRoutesAvailable: !(null == eQ ? void 0 : eQ.route) && !eK
                        })
                      ]
                    }),
                    (0, s.jsx)(F.nS, {
                      isOpen: c,
                      sourceAssets: eN,
                      destinationAssets: e$,
                      sourceToken: ek,
                      selectedChain: "source" === w ? eC : eF,
                      destinationToken: eP,
                      showFor: w,
                      onClose: tw,
                      onTokenSelect: tk,
                      rootDenomsStore: E.gb,
                      whitelistedFactorTokenStore: E.he,
                      isChainAbstractionView: eY,
                      loadingTokens: "source" === w ? eS : eB,
                      loadingChains: eI
                    }),
                    eY
                      ? (0, s.jsx)(F.Aq, {
                          title: "Select Destination Chain",
                          isOpen: W,
                          chainsToShow: tn,
                          loadingChains: eI,
                          onClose: () => {
                            H(!1), k("");
                          },
                          selectedChain: eF,
                          selectedToken: eP,
                          onChainSelect: tb,
                          destinationAssets: ts
                        })
                      : (0, s.jsx)(F.Aq, {
                          isOpen: W,
                          chainsToShow: ta.map(e => ({ chain: e })),
                          loadingChains: eI,
                          onClose: tm,
                          selectedChain: "source" === w ? eC : eF,
                          selectedToken: "source" === w ? ek : eP,
                          onChainSelect: tx
                        }),
                    (0, s.jsx)(F.p6, { isOpen: X, onClose: tN, onSlippageInfoClick: tC, setShowFeesSettingSheet: G }),
                    (0, s.jsx)(F.Yc, { isOpen: K, onClose: ty, onSlippageInfoClick: tC }),
                    (0, s.jsx)(F.qm, { isOpen: ee, onClose: tj }),
                    (0, s.jsx)(F.Bv, {
                      onSlippageInfoClick: tC,
                      isOpen: T,
                      onClose: tD,
                      onProceed: tT,
                      setShowFeesSettingSheet: G,
                      destinationAssetUSDValue: e9,
                      sourceAssetUSDValue: e8
                    }),
                    (null == eQ ? void 0 : null === (e = eQ.route) || void 0 === e ? void 0 : e.response) &&
                      eC &&
                      (0, s.jsx)(L.Z, { showFeesSettingSheet: V, setShowFeesSettingSheet: G }),
                    eh &&
                      (0, s.jsx)(S.Z, {
                        isVisible: !!eh,
                        onClose: () => {
                          ep(null), eg(null), ef(null);
                        },
                        newAddChain: eh,
                        skipUpdatingActiveChain: !0,
                        successCallback: tS
                      }),
                    Q ? (0, s.jsx)(F.J9, { onClose: tE, setLedgerError: tA, ledgerError: ea }) : null
                  ]
                })
              );
            }),
            V = (0, k.Pi)(e => {
              let { rootBalanceStore: t } = e,
                a = (0, f.Z)(),
                n = (0, N.TH)(),
                i = (0, y.useMemo)(() => {
                  var e;
                  return null ===
                    (e = t.getAggregatedBalances("mainnet", void 0).reduce((e, t) => (t.usdValue ? e.plus(new (r())(t.usdValue)) : e), new (r())(0))) ||
                    void 0 === e
                    ? void 0
                    : e.toNumber();
                }, [t]),
                l = (0, y.useMemo)(() => {
                  let e;
                  let t = a.get("pageSource") ?? void 0;
                  switch (t) {
                    case "bottomNav":
                      e = "Bottom Nav";
                      break;
                    case "assetDetails":
                      e = "Asset Details";
                      break;
                    case "banners":
                      e = "Banners";
                      break;
                    case "swapAgain":
                      e = "Swap Again CTA";
                      break;
                    case "quickSearch":
                      e = "Quick Search";
                      break;
                    case "stake":
                      e = h.q.Stake;
                      break;
                    case h.q.Home:
                      e = h.q.Home;
                      break;
                    case "search":
                      e = h.q.Search;
                      break;
                    case h.q.ZeroState:
                      e = h.q.ZeroState;
                  }
                  let n = { pageViewSource: e, userBalance: i };
                  return "banners" === t ? { ...n, pageViewSourceDetail: a.get("bannerId") ?? void 0 } : n;
                }, [a, null == n ? void 0 : n.key]);
              return (
                (0, p.a)(h.q.SwapsStart, !0, l),
                (0, s.jsx)(O.Ok, {
                  rootDenomsStore: E.gb,
                  rootBalanceStore: t,
                  activeChainStore: I.J,
                  autoFetchedCW20DenomsStore: E.PZ,
                  betaCW20DenomsStore: E.Xy,
                  cw20DenomsStore: E.Sg,
                  cw20DenomBalanceStore: T.Sz,
                  disabledCW20DenomsStore: E.eV,
                  enabledCW20DenomsStore: E.bI,
                  betaERC20DenomsStore: E.EM,
                  erc20DenomsStore: E.QH,
                  priceStore: T.lx,
                  children: (0, s.jsx)(Z, {})
                })
              );
            }),
            G = (0, k.Pi)(e => {
              let { rootBalanceStore: t } = e,
                [a, n] = (0, y.useState)(!0),
                [i, l] = (0, y.useState)(!1);
              return ((0, y.useEffect)(() => {
                setTimeout(() => {
                  n(!1);
                }, 150);
              }, []),
              (0, y.useEffect)(() => {
                t.allAggregatedTokensLoading || l(!0);
              }, [t.allAggregatedTokensLoading]),
              a)
                ? (0, s.jsx)("div", { className: "h-full", children: (0, s.jsx)(U.n, {}) })
                : (t.allAggregatedTokensLoading && !i) || a
                  ? (0, s.jsx)(U.n, {})
                  : (0, s.jsx)(V, { rootBalanceStore: t });
            });
          n();
        } catch (e) {
          n(e);
        }
      });
    },
    12499: function (e, t, a) {
      a.d(t, { h: () => n });
      let n = e => {
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
//# sourceMappingURL=3476.js.map
