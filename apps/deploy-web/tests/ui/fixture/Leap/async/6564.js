!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "3045ba21-5769-4944-a6f6-d8c1a9027d89"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-3045ba21-5769-4944-a6f6-d8c1a9027d89"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.23.1" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["6564"],
  {
    64690: function (e, t, a) {
      a.d(t, { Z: () => k });
      var r = a(52322),
        s = a(92642),
        n = a(91486),
        l = a(94562),
        i = a(28144),
        o = a(29195),
        d = a(14981),
        c = a(4370),
        u = a(2784);
      let m = e =>
        (0, r.jsxs)("svg", {
          width: "24",
          height: "24",
          viewBox: "0 0 24 24",
          fill: "none",
          xmlns: "http://www.w3.org/2000/svg",
          ...e,
          children: [
            (0, r.jsx)("g", {
              clipPath: "url(#clip0_4108_4137)",
              children: (0, r.jsx)("path", {
                fillRule: "evenodd",
                clipRule: "evenodd",
                d: "M0 1C0 0.447715 0.447715 0 1 0H23C23.5523 0 24 0.447715 24 1V10.6822C22.9251 9.06551 21.087 8 19 8C16.3876 8 14.1651 9.66962 13.3414 12H1C0.447715 12 0 11.5523 0 11V1ZM6 8C7.10457 8 8 7.10457 8 6C8 4.89543 7.10457 4 6 4C4.89543 4 4 4.89543 4 6C4 7.10457 4.89543 8 6 8ZM14 6C14 7.10457 13.1046 8 12 8C10.8954 8 10 7.10457 10 6C10 4.89543 10.8954 4 12 4C13.1046 4 14 4.89543 14 6ZM18 8C19.1046 8 20 7.10457 20 6C20 4.89543 19.1046 4 18 4C16.8954 4 16 4.89543 16 6C16 7.10457 16.8954 8 18 8ZM19 12C17.8523 12 17 12.8523 17 14V16H21V14C21 12.8523 20.1477 12 19 12ZM24 17C24 16.4 23.6 16 23 16V14C23 11.7477 21.2523 10 19 10C16.7477 10 15 11.7477 15 14V16C14.4 16 14 16.4 14 17V23C14 23.6 14.4 24 15 24H23C23.6 24 24 23.6 24 23V17Z",
                fill: "currentColor"
              })
            }),
            (0, r.jsx)("defs", {
              children: (0, r.jsx)("clipPath", { id: "clip0_4108_4137", children: (0, r.jsx)("rect", { width: "24", height: "24", fill: "white" }) })
            })
          ]
        });
      var h = a(91729),
        x = a(46338),
        f = a(64366),
        p = a(27783),
        g = a(28058),
        w = a(51343);
      let v = {
        dictionary: { ...p.Z.dictionary, ...w.Z.dictionary, ...g.Z.dictionary },
        graphs: p.Z.adjacencyGraphs,
        useLevenshteinDistance: !0,
        translations: w.Z.translations
      };
      f.Mu.setOptions(v);
      let b = e => (0, f.tu)(e).score;
      var y = a(10588);
      let j = { duration: 0.2 },
        C = { hidden: { opacity: 0, transition: j }, animate: { opacity: 1, transition: j } },
        N = e => {
          let { score: t } = e;
          return (0, r.jsx)(d.M, {
            children: (0, r.jsxs)(c.E.div, {
              className: "flex justify-center items-center font-bold text-sm",
              variants: C,
              initial: "hidden",
              animate: "animate",
              exit: "hidden",
              children: [
                4 === t &&
                  (0, r.jsx)(
                    c.E.span,
                    { className: "text-accent-success", variants: C, initial: "hidden", animate: "animate", exit: "hidden", children: "Strong" },
                    t
                  ),
                3 === t &&
                  (0, r.jsx)(
                    c.E.span,
                    { className: "text-accent-warning", variants: C, initial: "hidden", animate: "animate", exit: "hidden", children: "Medium" },
                    t
                  ),
                null !== t &&
                  t < 3 &&
                  (0, r.jsx)(
                    c.E.span,
                    { className: "text-destructive-100", variants: C, initial: "hidden", animate: "animate", exit: "hidden", children: "Weak" },
                    t < 3 ? "weak" : null
                  )
              ]
            })
          });
        },
        _ = { hidden: { height: 0 }, visible: { height: "2rem" } };
      function k(e) {
        let { onProceed: t, entry: a } = e,
          [f, p] = (0, u.useState)(!1),
          [g, w] = (0, u.useState)(null),
          [v, j] = (0, u.useState)(!0),
          [C, k] = (0, u.useState)(""),
          [E, S] = (0, u.useState)({ pass1: "", pass2: "" }),
          [M, B] = (0, u.useState)({ pass1: "", pass2: "" }),
          T = (0, u.useCallback)(
            () => (B({ pass1: "", pass2: "" }), !(E.pass1.length < 8) || (B(e => ({ ...e, pass1: "Password must be at least 8 characters" })), !1)),
            [E.pass1.length]
          ),
          A = (0, u.useCallback)(
            () => (E.pass1 != E.pass2 ? (B(e => ({ ...e, pass2: "Passwords do not match" })), !1) : !M.pass1 && !M.pass2 && !!T()),
            [M.pass1, M.pass2, E.pass1, E.pass2, T]
          ),
          z = async e => {
            e ? w(b(e)) : w(null);
          },
          L = () => {
            try {
              p(!0);
              let e = new TextEncoder().encode(E.pass1);
              t(e);
            } catch (e) {
              (0, s.Tb)(e, {
                tags: {
                  errorType: "choose_password_error",
                  source: "choose_password_view",
                  severity: "error",
                  errorName: e instanceof Error ? e.name : "ChoosePasswordError"
                },
                fingerprint: ["choose_password", "choose_password_error"],
                level: "error",
                contexts: { transaction: { type: "choose_password", errorMessage: e instanceof Error ? e.message : String(e) } }
              }),
                k(null == e ? void 0 : e.message);
            } finally {
              p(!1);
            }
          },
          Z = e => {
            let { name: t, value: a } = e.target;
            C && k(""), M[t] && (delete M[t], B(M)), S({ ...E, [t]: a });
          },
          H = e => {
            if ("enter" === e.key.toLowerCase()) {
              let t = e.target;
              "pass2" === t.name && A() && L();
              let a = t.form,
                r = [...a].indexOf(t);
              a.elements[r + 1].focus(), e.preventDefault();
            }
          },
          O = !!M.pass1 || !!M.pass2 || !E.pass1 || !E.pass2;
        return ((0, u.useEffect)(() => {
          let e = setTimeout(() => {
            z(E.pass1);
          }, 500);
          return () => {
            clearTimeout(e);
          };
        }, [E.pass1]),
        f)
          ? (0, r.jsx)(y.T_, {})
          : (0, r.jsx)("form", {
              onSubmit: e => {
                e.preventDefault(), A() && L();
              },
              className: "flex flex-col h-full",
              children: (0, r.jsxs)(h.n, {
                headerIcon: (0, r.jsx)(m, { className: "size-6" }),
                entry: a,
                heading: "Create your password",
                subHeading: "Choose a password to secure & lock your wallet",
                className: "gap-0",
                children: [
                  (0, r.jsxs)("div", {
                    className: "flex flex-col gap-y-5 w-full mt-10",
                    children: [
                      (0, r.jsxs)("div", {
                        className: "relative flex flex-col w-full",
                        children: [
                          (0, r.jsx)(i.I, {
                            autoFocus: !0,
                            placeholder: "Enter password",
                            type: "password",
                            name: "pass1",
                            onKeyDown: H,
                            onBlur: T,
                            status: M.pass1 || M.pass2 ? "error" : void 0,
                            value: E.pass1,
                            onChange: Z,
                            "data-testing-id": "input-password",
                            className: "h-[3.625rem]",
                            trailingElement: (0, r.jsx)(N, { score: g })
                          }),
                          (0, r.jsx)(d.M, {
                            children:
                              M.pass1 &&
                              (0, r.jsx)(c.E.span, {
                                className: "flex items-end justify-center text-destructive-100 text-xs text-center font-medium overflow-hidden",
                                variants: _,
                                initial: "hidden",
                                animate: "visible",
                                exit: "hidden",
                                children: M.pass1
                              })
                          })
                        ]
                      }),
                      (0, r.jsxs)("div", {
                        className: "relative flex flex-col gap-y-5 w-full",
                        children: [
                          (0, r.jsx)(o.W, {
                            name: "pass2",
                            value: E.pass2,
                            placeholder: "Confirm password",
                            onKeyDown: H,
                            className: "h-[3.625rem]",
                            onChange: Z,
                            status: M.pass2 ? "error" : void 0,
                            "data-testing-id": "input-confirm-password"
                          }),
                          (0, r.jsx)(d.M, {
                            children:
                              (M.pass2 || C) &&
                              (0, r.jsx)(c.E.span, {
                                className: "text-destructive-100 text-xs text-center font-medium",
                                "data-testing-id": "password-error-ele",
                                variants: x.HJ,
                                initial: "hidden",
                                animate: "visible",
                                exit: "hidden",
                                children: M.pass2 || C
                              })
                          })
                        ]
                      })
                    ]
                  }),
                  (0, r.jsxs)("label", {
                    htmlFor: "terms",
                    className: "flex flex-row justify-center items-center mt-auto",
                    children: [
                      (0, r.jsx)(l.X, {
                        id: "terms",
                        name: "terms",
                        value: "terms",
                        className: "cursor-pointer mr-2 h-4 w-4 accent-accent-foreground",
                        checked: v,
                        onCheckedChange: e => {
                          j(!!e);
                        }
                      }),
                      (0, r.jsxs)("p", {
                        className: "text-xs text-muted-foreground text-center",
                        children: [
                          "I agree to the",
                          " ",
                          (0, r.jsx)("a", {
                            href: "https://leapwallet.io/terms",
                            target: "_blank",
                            rel: "noreferrer",
                            className: "text-accent-foreground hover:text-accent-foreground/80 transition-colors",
                            children: "Terms & Conditions"
                          })
                        ]
                      })
                    ]
                  }),
                  (0, r.jsx)(n.zx, { className: "w-full mt-5", "data-testing-id": "btn-password-proceed", disabled: O || f || !v, children: "Set Password" })
                ]
              })
            });
      }
    },
    2810: function (e, t, a) {
      a.d(t, { W: () => f });
      var r = a(52322),
        s = a(72779),
        n = a.n(s),
        l = a(28144),
        i = a(83805),
        o = a(14981),
        d = a(4370),
        c = a(2784),
        u = a(70514);
      let m = e => {
          let { wordIndex: t, word: a, handlePaste: s, handleWordChange: i, isError: o, isFocused: d, handleWordFocused: c, handleWordBlur: u } = e;
          return (0, r.jsxs)("div", {
            className: n()(
              "flex items-center gap-2 rounded-lg bg-secondary-200 h-9 w-28 py-2 px-3 text-xs font-medium overflow-hidden",
              l.j[o ? "error" : "default"]
            ),
            onFocus: () => c(t),
            onBlur: () => u(),
            tabIndex: 0,
            onPaste: e => {
              e.preventDefault(), s(t, e.clipboardData.getData("text"));
            },
            children: [
              (0, r.jsx)("span", { className: "text-muted-foreground shrink-0", children: t }),
              (0, r.jsx)("input", {
                ref: e => e && d && e.focus(),
                type: d || o ? "text" : "password",
                value: a,
                onChange: e => i(t, e.target.value),
                className: "flex-1 outline-none bg-transparent w-0 text-foreground font-bold"
              })
            ]
          });
        },
        h = { duration: 0.2, ease: "easeInOut" },
        x = { left: { opacity: 0, x: 10, transition: h }, right: { opacity: 0, x: -10, transition: h }, visible: { opacity: 1, x: 0, transition: h } },
        f = e => {
          let { onChangeHandler: t, isError: a, className: s } = e,
            [n, l] = (0, c.useState)(1),
            [h, f] = (0, c.useState)(12),
            [p, g] = (0, c.useState)(Array(12).fill("")),
            w = e => {
              f(e), g(Array(e).fill(""));
            },
            v = (e, a) => {
              let r = a
                .trim()
                .split(" ")
                .map(e => e.trim())
                .filter(e => e.length);
              if (r.length) {
                if (12 === r.length || 24 === r.length) {
                  24 === r.length ? f(24) : 12 === r.length && f(12), g(r), t(r.join(" ").trim());
                  return;
                }
                for (let t = e; t < Math.min(h, r.length + e); t++) p[t - 1] = r[t - e];
                g(p), t(p.join(" ").trim());
              }
            },
            b = (e, a) => {
              (p[e - 1] = a), g(p), t(p.join(" ").trim());
            },
            y = e => {
              l(e);
            },
            j = () => {
              l(-1);
            };
          return (0, r.jsxs)("div", {
            className: (0, u.cn)("flex flex-col items-center w-full gap-7", a ? "h-[17.15rem]" : "h-[19.375rem]", s),
            children: [
              (0, r.jsx)(i.z, {
                selectedIndex: +(12 !== h),
                buttons: [
                  { label: "12 words", onClick: () => w(12) },
                  { label: "24 words", onClick: () => w(24) }
                ]
              }),
              (0, r.jsx)(o.M, {
                mode: "wait",
                children: (0, r.jsx)(
                  d.E.div,
                  {
                    className: (0, u.cn)("w-full grid grid-cols-3 gap-4 content-baseline overflow-auto p-1 flex-1"),
                    variants: x,
                    initial: 12 === p.length ? "left" : "right",
                    animate: "visible",
                    exit: 12 === p.length ? "right" : "left",
                    children: p.map((e, t) =>
                      (0, r.jsx)(
                        m,
                        {
                          wordIndex: t + 1,
                          word: e,
                          handlePaste: v,
                          handleWordChange: b,
                          isError: a,
                          isFocused: t + 1 === n,
                          handleWordFocused: y,
                          handleWordBlur: j
                        },
                        `${e}-${t}`
                      )
                    )
                  },
                  h
                )
              })
            ]
          });
        };
    },
    94562: function (e, t, a) {
      a.d(t, { X: () => o });
      var r = a(52322),
        s = a(62695),
        n = a(15256),
        l = a(2784),
        i = a(70514);
      let o = l.forwardRef((e, t) => {
        let { className: a, ...l } = e;
        return (0, r.jsx)(n.fC, {
          ref: t,
          className: (0, i.cn)(
            "peer h-4 w-4 shrink-0 rounded-sm data-[state=checked]:border border-accent-green shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:!bg-accent-green data-[state=checked]:text-accent-green !bg-secondary-300",
            a
          ),
          ...l,
          children: (0, r.jsx)(n.z$, {
            className: "flex items-center justify-center text-current",
            children: (0, r.jsx)(s.J, { className: "h-4 w-4 text-secondary-300" })
          })
        });
      });
      o.displayName = n.fC.displayName;
    },
    19003: function (e, t, a) {
      a.d(t, { Z: () => l });
      var r = a(52322),
        s = a(2784),
        n = a(70514);
      let l = e => {
        let { currentStep: t, totalSteps: a, className: l, moveToStep: i } = e,
          o = (0, s.useMemo)(() => Array.from({ length: a }, (e, t) => t + 1), [a]);
        return (0, r.jsx)("div", {
          className: (0, n.cn)("flex flex-row items-center justify-center align-center gap-3", l),
          children: o.map(e =>
            (0, r.jsx)(
              "div",
              {
                onClick: () => (null == i ? void 0 : i(e)),
                className: (0, n.cn)("h-1 w-[1.125rem] rounded-full transition-colors duration-500", e === t ? "bg-accent-green" : "bg-secondary-300")
              },
              e
            )
          )
        });
      };
    },
    64440: function (e, t, a) {
      a.d(t, { GA: () => m, LK: () => u, QT: () => x, RZ: () => c, YP: () => h, YX: () => d, dZ: () => p, fm: () => g });
      var r = a(54655),
        s = a(15969),
        n = a(44658),
        l = a(92642),
        i = a(55334),
        o = a(6391);
      let d = async e => {
          try {
            let t = (0, s.PqN)(s.oCA, "cosmos", !1),
              a = (await (0, s.F$d)({ method: "GET", baseURL: t, url: `/cosmos/bank/v1beta1/balances/${e}` })).data.balances.find(e => "uatom" === e.denom);
            if (!a || isNaN(+a.amount)) return new o.BigNumber(0);
            return new o.BigNumber(a.amount).div(1e6);
          } catch (t) {
            return (
              (0, l.Tb)(t, {
                tags: {
                  errorType: "get_cosmos_balance_error",
                  source: "wallet_info_card",
                  severity: "error",
                  errorName: t instanceof Error ? t.name : "GetCosmosBalanceError"
                },
                fingerprint: ["wallet_info_card", "get_cosmos_balance_error"],
                level: "error",
                extra: { address: e },
                contexts: { transaction: { type: "wallet_info_card", errorMessage: t instanceof Error ? t.message : String(t) } }
              }),
              new o.BigNumber(0)
            );
          }
        },
        c = async e => {
          try {
            let t = (0, s.PqN)(s.oCA, "celestia", !1),
              a = (await (0, s.F$d)({ method: "GET", baseURL: t, url: `/cosmos/bank/v1beta1/balances/${e}` })).data.balances.find(e => "ucel" === e.denom);
            if (!a || isNaN(+a.amount)) return new o.BigNumber(0);
            return new o.BigNumber(a.amount).div(1e6);
          } catch (t) {
            return (
              (0, l.Tb)(t, {
                tags: {
                  errorType: "get_celestia_balance_error",
                  source: "wallet_info_card",
                  severity: "error",
                  errorName: t instanceof Error ? t.name : "GetCelestiaBalanceError"
                },
                fingerprint: ["wallet_info_card", "get_celestia_balance_error"],
                level: "error",
                extra: { address: e },
                contexts: { transaction: { type: "wallet_info_card", errorMessage: t instanceof Error ? t.message : String(t) } }
              }),
              new o.BigNumber(0)
            );
          }
        },
        u = async e => {
          let t = s.oCA.bitcoin.apis.rpc;
          if (!t) return new o.BigNumber(0);
          try {
            var a, r;
            let s = new n.ti(t, e, "bitcoin"),
              l = await s.getData(),
              i = null == l ? void 0 : null === (r = l.balances) || void 0 === r ? void 0 : null === (a = r[0]) || void 0 === a ? void 0 : a.amount;
            if (isNaN(+i)) return new o.BigNumber(0);
            return new o.BigNumber(i).div(1e8);
          } catch (t) {
            return (
              (0, l.Tb)(t, {
                tags: {
                  errorType: "get_bitcoin_balance_error",
                  source: "wallet_info_card",
                  severity: "error",
                  errorName: t instanceof Error ? t.name : "GetBitcoinBalanceError"
                },
                fingerprint: ["wallet_info_card", "get_bitcoin_balance_error"],
                level: "error",
                extra: { address: e },
                contexts: { transaction: { type: "wallet_info_card", errorMessage: t instanceof Error ? t.message : String(t) } }
              }),
              new o.BigNumber(0)
            );
          }
        },
        m = async e => {
          try {
            let t = new r.ScN({ fullnode: s.oCA.aptos.apis.rest }),
              a = new r.gZG(t),
              n = await a.getAccountCoinAmount({ accountAddress: e, coinType: r.EfF });
            if (isNaN(+n)) return new o.BigNumber(0);
            return new o.BigNumber(n).div(1e8);
          } catch (t) {
            return (
              (0, l.Tb)(t, {
                tags: {
                  errorType: "get_aptos_balance_error",
                  source: "wallet_info_card",
                  severity: "error",
                  errorName: t instanceof Error ? t.name : "GetAptosBalanceError"
                },
                fingerprint: ["wallet_info_card", "get_aptos_balance_error"],
                level: "error",
                extra: { address: e },
                contexts: { transaction: { type: "wallet_info_card", errorMessage: t instanceof Error ? t.message : String(t) } }
              }),
              new o.BigNumber(0)
            );
          }
        },
        h = async e => {
          try {
            let t = new r.ScN({ fullnode: s.oCA.movement.apis.rest }),
              a = new r.gZG(t),
              n = await a.getAccountCoinAmount({ accountAddress: e, coinType: r.EfF });
            if (isNaN(+n)) return new o.BigNumber(0);
            return new o.BigNumber(n).div(1e8);
          } catch (t) {
            return (
              (0, l.Tb)(t, {
                tags: {
                  errorType: "get_movement_balance_error",
                  source: "wallet_info_card",
                  severity: "error",
                  errorName: t instanceof Error ? t.name : "GetMovementBalanceError"
                },
                fingerprint: ["wallet_info_card", "get_movement_balance_error"],
                level: "error",
                extra: { address: e },
                contexts: { transaction: { type: "wallet_info_card", errorMessage: t instanceof Error ? t.message : String(t) } }
              }),
              new o.BigNumber(0)
            );
          }
        },
        x = async e => {
          try {
            let t = await (0, s.Bl1)("https://ethereum-rpc.publicnode.com", e);
            if (isNaN(+t.amount)) return new o.BigNumber(0);
            return new o.BigNumber(t.amount);
          } catch (t) {
            return (
              (0, l.Tb)(t, {
                tags: {
                  errorType: "get_evm_balance_error",
                  source: "wallet_info_card",
                  severity: "error",
                  errorName: t instanceof Error ? t.name : "GetEvmBalanceError"
                },
                fingerprint: ["wallet_info_card", "get_evm_balance_error"],
                level: "error",
                extra: { address: e },
                contexts: { transaction: { type: "wallet_info_card", errorMessage: t instanceof Error ? t.message : String(t) } }
              }),
              new o.BigNumber(0)
            );
          }
        },
        f = async e => {
          try {
            let { data: t } = await (0, i.Z)({
                url: `${(0, s.BSD)()}/v1/balances/solana/native-balance`,
                method: "POST",
                data: { address: e, selectedNetwork: "mainnet", chain: "solana" },
                timeout: 5e3
              }),
              a = null == t ? void 0 : t["11111111111111111111111111111111"];
            if (!(null == a ? void 0 : a.amount) || isNaN(+a.amount)) return new o.BigNumber(0);
            return new o.BigNumber(a.amount);
          } catch (t) {
            return (
              (0, l.Tb)(t, {
                tags: {
                  errorType: "get_solana_balance_fallback_error",
                  source: "wallet_info_card",
                  severity: "error",
                  errorName: t instanceof Error ? t.name : "GetSolanaBalanceFallbackError"
                },
                fingerprint: ["wallet_info_card", "get_solana_balance_fallback_error"],
                level: "error",
                extra: { address: e },
                contexts: { transaction: { type: "wallet_info_card", errorMessage: t instanceof Error ? t.message : String(t) } }
              }),
              new o.BigNumber(0)
            );
          }
        },
        p = async e => {
          try {
            let { data: t, status: a } = await (0, i.Z)({
              url: "https://go.getblock.io/e8924dbdeef24817a1b024dc6fe4c18b",
              method: "POST",
              data: { jsonrpc: "2.0", id: 1, method: "getBalance", params: [e, null] },
              timeout: 5e3
            });
            if (200 !== a) throw Error("Failed to get solana balance, trying fallback");
            let r = t.result.value;
            if (!r || isNaN(+r)) return new o.BigNumber(0);
            return new o.BigNumber(r).div(1e9);
          } catch {
            return await f(e);
          }
        },
        g = async e => {
          try {
            let { data: t } = await (0, i.Z)({
                url: "https://fullnode.mainnet.sui.io:443",
                method: "POST",
                data: { jsonrpc: "2.0", id: 1, method: "suix_getBalance", params: [e] },
                timeout: 5e3
              }),
              a = t.result.totalBalance;
            if (isNaN(+a)) return new o.BigNumber(0);
            return new o.BigNumber(a).div(1e9);
          } catch (t) {
            return (
              (0, l.Tb)(t, {
                tags: {
                  errorType: "get_sui_balance_error",
                  source: "wallet_info_card",
                  severity: "error",
                  errorName: t instanceof Error ? t.name : "GetSuiBalanceError"
                },
                fingerprint: ["wallet_info_card", "get_sui_balance_error"],
                level: "error",
                extra: { address: e },
                contexts: { transaction: { type: "wallet_info_card", errorMessage: t instanceof Error ? t.message : String(t) } }
              }),
              new o.BigNumber(0)
            );
          }
        };
    },
    77807: function (e, t, a) {
      a.a(e, async function (e, r) {
        try {
          a.d(t, { JP: () => E, ZP: () => C });
          var s = a(52322),
            n = a(2784),
            l = a(41172),
            i = a(48272),
            o = a(26227),
            d = a(94562),
            c = a(18919),
            u = a(14981),
            m = a(4370),
            h = a(74229),
            x = a(31775),
            f = a(29750),
            p = a(19288),
            g = a(70514),
            w = a(49409),
            v = a(46338),
            b = a(90848),
            y = e([b]);
          b = (y.then ? (await y)() : y)[0];
          let j = { hidden: { opacity: 0, height: 0 }, visible: { opacity: 1, height: "auto" } },
            C = function (e) {
              let {
                  walletName: t,
                  index: a,
                  showDerivationPath: r = !1,
                  isExistingAddress: l,
                  isLedger: o,
                  isChosen: c,
                  onSelectChange: h,
                  path: x,
                  cosmosAddress: f,
                  evmAddress: w,
                  bitcoinAddress: y,
                  moveAddress: C,
                  solanaAddress: N,
                  suiAddress: E,
                  className: S,
                  ...M
                } = e,
                [B, T] = (0, n.useState)(!0),
                {
                  data: A,
                  nonZeroData: z,
                  zeroBalance: L,
                  isLoading: Z
                } = (0, b.l)({ cosmosAddress: f, bitcoinAddress: y, moveAddress: C, evmAddress: w, solanaAddress: N, suiAddress: E }),
                H = L ? A : z,
                O = (0, n.useMemo)(() => (0, p.X2)(x ?? ""), [x]);
              (0, n.useEffect)(() => {
                L && !Z && T(!1);
              }, [L, Z]),
                (0, n.useEffect)(() => {
                  if (!Z) {
                    if (o && l) {
                      h(x || a, !0);
                      return;
                    }
                    h(x || a, !L);
                  }
                }, [L, Z, a, o, l]);
              let P = (0, n.useMemo)(() => (o ? A : H), [o, A, H]);
              return (0, s.jsxs)("label", {
                className: (0, g.cn)("rounded-xl w-full bg-secondary-200 shrink-0 cursor-pointer", l && !o && "opacity-50", S),
                ...M,
                children: [
                  (0, s.jsxs)("div", {
                    className: "flex items-center gap-2 px-5 pt-5 pb-4",
                    children: [
                      (0, s.jsxs)("div", {
                        role: "button",
                        className: "flex items-center gap-2",
                        onClick: e => {
                          P && P.length && (e.preventDefault(), e.stopPropagation(), T(e => !e));
                        },
                        children: [
                          (0, s.jsx)("span", { className: "font-bold text-mdl select-none", children: t }),
                          r && (0, s.jsx)("span", { className: "text-xs font-medium py-px px-[6px] rounded bg-secondary-300", children: O }),
                          !Z &&
                            !!(null == P ? void 0 : P.length) &&
                            (0, s.jsx)(i.p, { size: 14, className: (0, g.cn)("text-muted-foreground transition-transform", B && "-rotate-180") }),
                          l &&
                            !o &&
                            (0, s.jsx)("span", { className: "text-xs font-medium py-px px-[6px] rounded bg-secondary-300", children: "Already exists" })
                        ]
                      }),
                      (0, s.jsx)(d.X, { disabled: l, checked: c, onCheckedChange: e => h(x || a, "indeterminate" !== e && !!e), className: "ml-auto" })
                    ]
                  }),
                  (0, s.jsx)(u.M, {
                    mode: "wait",
                    children: Z
                      ? (0, s.jsx)(
                          m.E.div,
                          {
                            className: "flex flex-col border-t border-secondary-600/50 overflow-hidden",
                            initial: "hidden",
                            animate: "visible",
                            exit: "hidden",
                            variants: v.K0,
                            transition: v.Wz,
                            children: (0, s.jsx)(k, {})
                          },
                          "skeleton"
                        )
                      : B &&
                        P &&
                        (0, s.jsx)(
                          m.E.div,
                          {
                            className: "flex flex-col border-t border-secondary-600/50 overflow-hidden",
                            initial: "hidden",
                            animate: "visible",
                            exit: "hidden",
                            variants: j,
                            transition: v.Wz,
                            children: P.map(e => (0, n.createElement)(_, { ...e, chainKey: e.key, name: e.name, key: e.key }))
                          },
                          "data"
                        )
                  })
                ]
              });
            },
            N = e => {
              let { address: t } = e,
                { copy: a, isCopied: r } = (0, x.F)();
              return (0, s.jsx)(u.M, {
                mode: "wait",
                children: r
                  ? (0, s.jsxs)(
                      m.E.span,
                      {
                        className: "text-sm font-bold text-accent-success ml-auto flex items-center gap-1",
                        initial: "hidden",
                        animate: "visible",
                        exit: "hidden",
                        variants: v.K0,
                        transition: v._M,
                        children: [(0, s.jsx)(o.f, { size: 16 }), " Copied"]
                      },
                      "copied"
                    )
                  : (0, s.jsx)(
                      m.E.span,
                      {
                        className: "text-sm font-bold text-muted-foreground ml-auto hover:text-foreground transition-colors",
                        initial: "hidden",
                        animate: "visible",
                        exit: "hidden",
                        variants: v.K0,
                        transition: v._M,
                        onClick: e => {
                          e.preventDefault(), e.stopPropagation(), a(t);
                        },
                        children: (0, l.Hnh)(t)
                      },
                      "address"
                    )
              });
            },
            _ = e => {
              let t = (0, h.a1)();
              return (0, s.jsxs)(m.E.div, {
                className: "px-5 py-4 flex items-center gap-2.5 w-full border-b border-secondary-600/25 last:border-b-0 overflow-hidden shrink-0",
                initial: "hidden",
                animate: "visible",
                exit: "hidden",
                variants: v.K0,
                transition: v.Wz,
                children: [
                  (0, s.jsx)("img", { src: (0, f.getChainImage)(e.chainKey), onError: (0, w._)(t), className: "rounded-full overflow-hidden size-9" }),
                  (0, s.jsxs)("div", {
                    className: "flex flex-col gap-0.5 capitalize",
                    children: [
                      (0, s.jsx)("span", { className: "text-md font-bold", children: e.name }),
                      (0, s.jsxs)("span", { className: "text-xs font-medium text-muted-foreground", children: [e.amount, " ", e.denom] })
                    ]
                  }),
                  e.address && (0, s.jsx)(N, { address: e.address })
                ]
              });
            },
            k = () =>
              (0, s.jsxs)("div", {
                className: "px-5 py-4 flex items-center gap-2.5 w-full border-b border-secondary-600/25 last:border-b-0",
                children: [
                  (0, s.jsx)(c.O, { className: "rounded-full size-9" }),
                  (0, s.jsxs)("div", {
                    className: "flex flex-col gap-2 capitalize h-[42px] justify-center",
                    children: [(0, s.jsx)(c.O, { className: "w-16 h-2.5" }), (0, s.jsx)(c.O, { className: "w-10 h-2" })]
                  }),
                  (0, s.jsx)(c.O, { className: "w-20 h-3 ml-auto" })
                ]
              }),
            E = e => {
              let { count: t, total: a, onSelectAllToggle: r } = e;
              return (0, s.jsxs)("label", {
                className: "bg-secondary-200 rounded-xl flex items-center justify-between p-5 select-none",
                children: [
                  (0, s.jsxs)("span", { className: "font-bold", children: [t, " ", 1 === t ? "wallet" : "wallets", " selected"] }),
                  (0, s.jsxs)("div", {
                    className: "flex items-center gap-1.5",
                    children: [
                      (0, s.jsx)("span", { className: "text-muted-foreground text-sm font-bold", children: "Select All" }),
                      (0, s.jsx)(d.X, { checked: t === a, onCheckedChange: r })
                    ]
                  })
                ]
              });
            };
          r();
        } catch (e) {
          r(e);
        }
      });
    },
    90848: function (e, t, a) {
      a.a(e, async function (e, r) {
        try {
          a.d(t, { l: () => x });
          var s = a(92642),
            n = a(60431),
            l = a(66534),
            i = a(6391),
            o = a(36400),
            d = a(2784),
            c = a(71198),
            u = a(64440),
            m = e([o]);
          o = (m.then ? (await m)() : m)[0];
          let h = (e, t) => {
              let { words: a } = l.bech32.decode(e);
              return l.bech32.encode(t, a);
            },
            x = e => {
              let { cosmosAddress: t, bitcoinAddress: a, moveAddress: r, evmAddress: l, solanaAddress: m, suiAddress: x } = e,
                f = (0, o.pb)(),
                p = (0, n.useQuery)({
                  queryKey: ["cosmos-balance", t],
                  queryFn: async () => (t ? (0, u.YX)(t) : new i.BigNumber(0)),
                  enabled: !!t,
                  retry: !1,
                  onError: e => {
                    (0, s.Tb)(e);
                  }
                }),
                g = (0, d.useMemo)(() => {
                  if (t) return h(t, f.celestia.addressPrefix);
                }, [t, f.celestia.addressPrefix]),
                w = (0, n.useQuery)({ queryKey: ["celestia-balance", g], queryFn: async () => (g ? (0, u.RZ)(g) : new i.BigNumber(0)) }),
                v = (0, n.useQuery)({
                  queryKey: ["bitcoin-balance", a],
                  queryFn: async () => (a ? (0, u.LK)(a) : new i.BigNumber(0)),
                  enabled: !!a,
                  retry: !1,
                  onError: e => {
                    (0, s.Tb)(e);
                  }
                }),
                b = (0, n.useQuery)({
                  queryKey: ["movement-balance", r],
                  queryFn: async () => (r ? (0, u.YP)(r) : new i.BigNumber(0)),
                  enabled: !!r,
                  retry: !1,
                  onError: e => {
                    (0, s.Tb)(e);
                  }
                }),
                y = (0, n.useQuery)({
                  queryKey: ["evm-balance", l],
                  queryFn: async () => (l ? (0, u.QT)(l) : new i.BigNumber(0)),
                  enabled: !!l,
                  retry: !1,
                  onError: e => {
                    (0, s.Tb)(e);
                  }
                }),
                j = (0, n.useQuery)({
                  queryKey: ["aptos-balance", r],
                  queryFn: async () => (r ? (0, u.GA)(r) : new i.BigNumber(0)),
                  enabled: !!r,
                  retry: !1,
                  onError: e => {
                    (0, s.Tb)(e);
                  }
                }),
                C = (0, n.useQuery)({
                  queryKey: ["solana-balance", m],
                  queryFn: async () => (m ? (0, u.dZ)(m) : new i.BigNumber(0)),
                  enabled: !!m,
                  retry: !1,
                  onError: e => {
                    (0, s.Tb)(e);
                  }
                }),
                N = (0, n.useQuery)({ queryKey: ["sui-balance", x], queryFn: async () => (x ? (0, u.fm)(x) : new i.BigNumber(0)) }),
                _ =
                  (t && p.isLoading) ||
                  (a && v.isLoading) ||
                  (r && b.isLoading) ||
                  (l && y.isLoading) ||
                  (g && w.isLoading) ||
                  (r && j.isLoading) ||
                  (m && C.isLoading) ||
                  (x && N.isLoading),
                k = (0, d.useMemo)(
                  () =>
                    [
                      { key: f.cosmos.key, name: "Cosmos Hub", denom: f.cosmos.denom, address: t, amount: p.data },
                      { key: f.ethereum.key, name: "Ethereum", denom: f.ethereum.denom, address: l, amount: y.data },
                      { key: f.celestia.key, name: "Celestia", denom: f.celestia.denom, address: g, amount: w.data },
                      { key: f.bitcoin.key, name: "Bitcoin", denom: f.bitcoin.denom, address: a, amount: v.data },
                      { key: f.solana.key, name: "Solana", denom: f.solana.denom, address: m, amount: C.data },
                      { key: f.sui.key, name: "Sui", denom: f.sui.denom, address: x, amount: N.data },
                      { key: f.aptos.key, name: "Aptos", denom: f.aptos.denom, address: r, amount: j.data },
                      { key: f.movement.key, name: "Movement", denom: f.movement.denom, address: r, amount: b.data }
                    ]
                      .filter(e => e.address)
                      .map(e => {
                        var t;
                        return { ...e, amount: (0, c.jX)((null === (t = e.amount) || void 0 === t ? void 0 : t.toString()) ?? "0.00") };
                      }),
                  [t, a, l, r, g, m, x, p.data, v.data, y.data, b.data, w.data, j.data, C.data, N.data, f]
                ),
                E = (0, d.useMemo)(() => k.every(e => "0" === e.amount), [k]),
                S = (0, d.useMemo)(() => k.filter(e => "0" !== e.amount), [k]);
              return { data: k, zeroBalance: E, nonZeroData: S, isLoading: _ };
            };
          r();
        } catch (e) {
          r(e);
        }
      });
    },
    31775: function (e, t, a) {
      a.d(t, { F: () => s });
      var r = a(2784);
      let s = () => {
        let [e, t] = (0, r.useState)(!1);
        return (
          (0, r.useEffect)(() => {
            e && setTimeout(() => t(!1), 1e3);
          }, [e]),
          {
            isCopied: e,
            copy: e => {
              "undefined" != typeof navigator && navigator.clipboard && (navigator.clipboard.writeText(e), t(!0));
            }
          }
        );
      };
    },
    39775: function (e, t, a) {
      a.d(t, { u: () => s });
      var r = a(52322);
      a(2784);
      let s = e =>
        (0, r.jsxs)("svg", {
          width: "24",
          height: "24",
          viewBox: "0 0 24 24",
          fill: "none",
          xmlns: "http://www.w3.org/2000/svg",
          ...e,
          children: [
            (0, r.jsx)("g", {
              clipPath: "url(#clip0_4108_4122)",
              children: (0, r.jsx)("path", {
                fillRule: "evenodd",
                clipRule: "evenodd",
                d: "M20.818 4.55021L23.0982 2.27L20.9769 0.148682L9.4296 11.696C8.54928 11.2507 7.55393 10.9999 6.5 10.9999C2.91015 10.9999 0 13.91 0 17.4999C0 21.0898 2.91015 23.9999 6.5 23.9999C10.0899 23.9999 13 21.0898 13 17.4999C13 16.054 12.5279 14.7184 11.7294 13.6388L15.161 10.2072L16.9283 11.9746L19.0496 9.85326L17.2823 8.08593L18.6967 6.67153L21.8784 9.85324L23.9997 7.73192L20.818 4.55021ZM3 17.4999C3 15.5669 4.567 13.9999 6.5 13.9999C8.433 13.9999 10 15.5669 10 17.4999C10 19.4329 8.433 20.9999 6.5 20.9999C4.567 20.9999 3 19.4329 3 17.4999Z",
                fill: "currentColor"
              })
            }),
            (0, r.jsx)("defs", {
              children: (0, r.jsx)("clipPath", { id: "clip0_4108_4122", children: (0, r.jsx)("rect", { width: "24", height: "24", fill: "white" }) })
            })
          ]
        });
    },
    30877: function (e, t, a) {
      a.d(t, { _: () => s });
      var r = a(52322);
      a(2784);
      let s = e =>
        (0, r.jsxs)("svg", {
          width: "24",
          height: "24",
          viewBox: "0 0 24 24",
          fill: "none",
          xmlns: "http://www.w3.org/2000/svg",
          ...e,
          children: [
            (0, r.jsxs)("g", {
              clipPath: "url(#clip0_403_263)",
              children: [
                (0, r.jsx)("mask", {
                  id: "mask0_403_263",
                  maskUnits: "userSpaceOnUse",
                  x: "0",
                  y: "0",
                  width: "24",
                  height: "24",
                  children: (0, r.jsx)("rect", { width: "24", height: "24", fill: "#D9D9D9" })
                }),
                (0, r.jsx)("g", {
                  mask: "url(#mask0_403_263)",
                  children: (0, r.jsx)("path", {
                    d: "M7 14C6.45 14 5.97917 13.8042 5.5875 13.4125C5.19583 13.0208 5 12.55 5 12C5 11.45 5.19583 10.9792 5.5875 10.5875C5.97917 10.1958 6.45 10 7 10C7.55 10 8.02083 10.1958 8.4125 10.5875C8.80417 10.9792 9 11.45 9 12C9 12.55 8.80417 13.0208 8.4125 13.4125C8.02083 13.8042 7.55 14 7 14ZM7 18C5.33333 18 3.91667 17.4167 2.75 16.25C1.58333 15.0833 1 13.6667 1 12C1 10.3333 1.58333 8.91667 2.75 7.75C3.91667 6.58333 5.33333 6 7 6C8.11667 6 9.12917 6.275 10.0375 6.825C10.9458 7.375 11.6667 8.1 12.2 9H20.575C20.7083 9 20.8375 9.025 20.9625 9.075C21.0875 9.125 21.2 9.2 21.3 9.3L23.3 11.3C23.4 11.4 23.4708 11.5083 23.5125 11.625C23.5542 11.7417 23.575 11.8667 23.575 12C23.575 12.1333 23.5542 12.2583 23.5125 12.375C23.4708 12.4917 23.4 12.6 23.3 12.7L20.125 15.875C20.0417 15.9583 19.9417 16.025 19.825 16.075C19.7083 16.125 19.5917 16.1583 19.475 16.175C19.3583 16.1917 19.2417 16.1833 19.125 16.15C19.0083 16.1167 18.9 16.0583 18.8 15.975L17.5 15L16.075 16.075C15.9917 16.1417 15.9 16.1917 15.8 16.225C15.7 16.2583 15.6 16.275 15.5 16.275C15.4 16.275 15.2958 16.2583 15.1875 16.225C15.0792 16.1917 14.9833 16.1417 14.9 16.075L13.375 15H12.2C11.6667 15.9 10.9458 16.625 10.0375 17.175C9.12917 17.725 8.11667 18 7 18ZM7 16C7.93333 16 8.75417 15.7167 9.4625 15.15C10.1708 14.5833 10.6417 13.8667 10.875 13H14L15.45 14.025L17.5 12.5L19.275 13.875L21.15 12L20.15 11H10.875C10.6417 10.1333 10.1708 9.41667 9.4625 8.85C8.75417 8.28333 7.93333 8 7 8C5.9 8 4.95833 8.39167 4.175 9.175C3.39167 9.95833 3 10.9 3 12C3 13.1 3.39167 14.0417 4.175 14.825C4.95833 15.6083 5.9 16 7 16Z",
                    fill: "currentColor"
                  })
                })
              ]
            }),
            (0, r.jsx)("defs", {
              children: (0, r.jsx)("clipPath", { id: "clip0_403_263", children: (0, r.jsx)("rect", { width: "24", height: "24", fill: "white" }) })
            })
          ]
        });
    },
    98771: function (e, t, a) {
      a.d(t, { a: () => s });
      var r = a(52322);
      a(2784);
      let s = e =>
        (0, r.jsxs)("svg", {
          width: "24",
          height: "24",
          viewBox: "0 0 24 24",
          fill: "none",
          xmlns: "http://www.w3.org/2000/svg",
          ...e,
          children: [
            (0, r.jsx)("mask", {
              id: "mask0_403_640",
              maskUnits: "userSpaceOnUse",
              x: "0",
              y: "0",
              width: "24",
              height: "24",
              children: (0, r.jsx)("rect", { width: "24", height: "24", fill: "#D9D9D9" })
            }),
            (0, r.jsx)("g", {
              mask: "url(#mask0_403_640)",
              children: (0, r.jsx)("path", {
                d: "M5 21C4.45 21 3.97917 20.8042 3.5875 20.4125C3.19583 20.0208 3 19.55 3 19V5C3 4.45 3.19583 3.97917 3.5875 3.5875C3.97917 3.19583 4.45 3 5 3H19C19.55 3 20.0208 3.19583 20.4125 3.5875C20.8042 3.97917 21 4.45 21 5V19C21 19.55 20.8042 20.0208 20.4125 20.4125C20.0208 20.8042 19.55 21 19 21H5ZM5 19H19V5H5V19ZM8 17H13C13.2833 17 13.5208 16.9042 13.7125 16.7125C13.9042 16.5208 14 16.2833 14 16C14 15.7167 13.9042 15.4792 13.7125 15.2875C13.5208 15.0958 13.2833 15 13 15H8C7.71667 15 7.47917 15.0958 7.2875 15.2875C7.09583 15.4792 7 15.7167 7 16C7 16.2833 7.09583 16.5208 7.2875 16.7125C7.47917 16.9042 7.71667 17 8 17ZM8 13H16C16.2833 13 16.5208 12.9042 16.7125 12.7125C16.9042 12.5208 17 12.2833 17 12C17 11.7167 16.9042 11.4792 16.7125 11.2875C16.5208 11.0958 16.2833 11 16 11H8C7.71667 11 7.47917 11.0958 7.2875 11.2875C7.09583 11.4792 7 11.7167 7 12C7 12.2833 7.09583 12.5208 7.2875 12.7125C7.47917 12.9042 7.71667 13 8 13ZM8 9H16C16.2833 9 16.5208 8.90417 16.7125 8.7125C16.9042 8.52083 17 8.28333 17 8C17 7.71667 16.9042 7.47917 16.7125 7.2875C16.5208 7.09583 16.2833 7 16 7H8C7.71667 7 7.47917 7.09583 7.2875 7.2875C7.09583 7.47917 7 7.71667 7 8C7 8.28333 7.09583 8.52083 7.2875 8.7125C7.47917 8.90417 7.71667 9 8 9Z",
                fill: "currentColor"
              })
            })
          ]
        });
    },
    98151: function (e, t, a) {
      a.a(e, async function (e, r) {
        try {
          a.r(t), a.d(t, { default: () => j });
          var s = a(52322),
            n = a(64690),
            l = a(14981),
            i = a(75958);
          a(2784);
          var o = a(10588),
            d = a(53542),
            c = a(41607),
            u = a(24693),
            m = a(98004),
            h = a(19737),
            x = a(6491),
            f = a(51409),
            p = a(77742),
            g = a(66144),
            w = a(69543),
            v = a(18818),
            b = e([f, x, h, u, p, v, w, m, g, d, c]);
          [f, x, h, u, p, v, w, m, g, d, c] = b.then ? (await b)() : b;
          let y = () => {
              let { currentStepName: e, onOnboardingCompleted: t, prevStep: a, currentStep: r } = (0, d.Xp)();
              return (0, s.jsxs)(l.M, {
                mode: "wait",
                presenceAffectsLayout: !0,
                children: [
                  "loading" === e && (0, s.jsx)(o.T_, {}, "creating-wallet-loader"),
                  "select-import-type" === e && (0, s.jsx)(f.x, {}, "select-import-type"),
                  "seed-phrase" === e && (0, s.jsx)(x.W, {}, "seed-phrase-view"),
                  "private-key" === e && (0, s.jsx)(h._, {}, "private-key-view"),
                  "import-ledger" === e && (0, s.jsx)(u.H4, {}, "import-ledger-view"),
                  "select-ledger-network" === e && (0, s.jsx)(p.Z, {}, "select-ledger-network-view"),
                  "import-watch-wallet" === e && (0, s.jsx)(v.x, {}, "import-watch-wallet-view"),
                  "select-wallet" === e && (0, s.jsx)(w.R, {}, "select-wallet-view"),
                  "importing-ledger-accounts" === e && (0, s.jsx)(m.g, {}, "importing-ledger-accounts-view"),
                  "select-ledger-wallet" === e && (0, s.jsx)(g.q, {}, "select-ledger-wallet-view"),
                  "choose-password" === e && (0, s.jsx)(n.Z, { onProceed: t, entry: a <= r ? "right" : "left" }, "choose-password-view")
                ]
              });
            },
            j = (0, i.Pi)(() => (0, s.jsx)(d.jr, { children: (0, s.jsx)(c.p, { children: (0, s.jsx)(y, {}) }) }));
          r();
        } catch (e) {
          r(e);
        }
      });
    },
    41607: function (e, t, a) {
      a.a(e, async function (e, r) {
        try {
          a.d(t, { p: () => h });
          var s = a(52322),
            n = a(43166),
            l = a(91486),
            i = a(19003);
          a(2784);
          var o = a(70514),
            d = a(98622),
            c = a(53542),
            u = e([c]);
          c = (u.then ? (await u)() : u)[0];
          let m = () => {
              let { backToPreviousStep: e, currentStep: t, totalSteps: a, walletName: r } = (0, c.Xp)();
              return (0, s.jsxs)("div", {
                className: "flex flex-row items-center justify-between align-center w-full relative -m-1",
                children: [
                  (0, s.jsx)(l.zx, { variant: "secondary", size: "icon", onClick: e, children: (0, s.jsx)(n.X, { className: "size-4" }) }),
                  t > 0 &&
                    (0, s.jsx)(i.Z, {
                      currentStep: t,
                      totalSteps: "private-key" === r || "watch-wallet" === r ? a - 1 : "ledger" === r || "evm-ledger" === r ? a + 1 : a
                    }),
                  (0, s.jsx)("div", { className: "size-9 shrink-0" })
                ]
              });
            },
            h = e =>
              (0, s.jsxs)(d.z, {
                className: (0, o.cn)("flex flex-col items-stretch gap-7 p-7 overflow-auto border-secondary-300 relative", e.className),
                children: [(0, s.jsx)(m, {}), e.children]
              });
          r();
        } catch (e) {
          r(e);
        }
      });
    },
    79263: function (e, t, a) {
      a.a(e, async function (e, r) {
        try {
          a.d(t, { n: () => m });
          var s = a(52322),
            n = a(15969),
            l = a(91486),
            i = a(4370),
            o = a(91729),
            d = a(2784),
            c = a(53542),
            u = e([c]);
          c = (u.then ? (await u)() : u)[0];
          let m = e => {
            let { Icon: t, title: a, cta: r, moveToNextApp: u, appType: m } = e,
              { getLedgerAccountDetails: h } = (0, c.Xp)();
            return (
              (0, d.useEffect)(() => {
                let e = setInterval(async () => {
                  try {
                    (await (0, n.qn$)(m === c.Yg.ETH ? "Ethereum" : "Cosmos")) && (await h(m), u(m), clearInterval(e));
                  } catch (e) {
                    console.error(e);
                  }
                }, 4e3);
                return () => {
                  clearInterval(e);
                };
              }, [m]),
              (0, s.jsxs)(i.E.div, {
                className: "flex flex-col w-full flex-1",
                variants: o.S,
                initial: "fromRight",
                animate: "animate",
                exit: "exit",
                children: [
                  (0, s.jsxs)("header", {
                    className: "flex flex-col items-center justify-center gap-6 flex-1",
                    children: [
                      (0, s.jsx)("div", {
                        className:
                          "rounded-full size-[134px] animate-scaleUpDown [--scale-up-down-start:1.05] bg-accent-foreground/20 grid place-content-center",
                        children: (0, s.jsx)("div", {
                          className:
                            "rounded-full size-[89px] animate-scaleUpDown [--scale-up-down-start:1.075] bg-accent-foreground/40 grid place-content-center",
                          children: (0, s.jsx)("div", {
                            className:
                              "rounded-full size-[44.5px] animate-scaleUpDown [--scale-up-down-start:1.1] bg-accent-foreground grid place-content-center",
                            children: (0, s.jsx)(t, { className: "size-6" })
                          })
                        })
                      }),
                      (0, s.jsx)("span", { className: "text-xl font-bold text-center", children: a })
                    ]
                  }),
                  !!(r && u) && (0, s.jsx)(l.zx, { className: "w-full", onClick: () => u(m), children: r })
                ]
              })
            );
          };
          r();
        } catch (e) {
          r(e);
        }
      });
    },
    24693: function (e, t, a) {
      a.a(e, async function (e, r) {
        try {
          a.d(t, { H4: () => v });
          var s = a(52322),
            n = a(6011),
            l = a(91486),
            i = a(14981),
            o = a(4370),
            d = a(56336),
            c = a(30464);
          a(2784);
          var u = a(91729),
            m = a(53542),
            h = a(92186),
            x = e([m]);
          m = (x.then ? (await x)() : x)[0];
          let f = [{ description: "Unlock Ledger & connect to your device via USB" }, { description: "Select networks & choose wallets to import" }],
            p = { duration: 0.75, ease: "easeInOut" },
            g = { hidden: { opacity: 0, x: -100 }, visible: { opacity: 1, x: 0 } },
            w = { hidden: { opacity: 0, x: 100 }, visible: { opacity: 1, x: 0 } },
            v = () => {
              let { prevStep: e, currentStep: t, ledgerConnectionStatus: a, moveToNextStep: r } = (0, m.Xp)(),
                x = e <= t ? "right" : "left";
              return (0, s.jsxs)(u.n, {
                headerIcon: (0, s.jsx)(d.zq, { className: "size-6" }),
                heading: "Connect your Ledger",
                entry: x,
                children: [
                  (0, s.jsxs)("div", {
                    className: "flex flex-col gap-4 w-full relative h-[301px]",
                    children: [
                      f.map((e, t) =>
                        (0, s.jsxs)(
                          "div",
                          {
                            className: "bg-secondary-200 py-4 px-5 w-full rounded-xl text-sm font-medium flex items-center gap-4",
                            children: [(0, s.jsx)(n.f, { weight: "bold", className: "size-5 shrink-0 text-muted-foreground" }), e.description]
                          },
                          t
                        )
                      ),
                      (0, s.jsx)("div", {
                        className: "-mx-7 mt-7 flex items-center justify-between",
                        children: (0, s.jsxs)(i.M, {
                          children: [
                            (0, s.jsx)(o.E.img, {
                              width: 446,
                              height: 77,
                              src: c.r.Misc.HardwareWalletConnectCable,
                              alt: "Hardware Wallet Connect Cable",
                              className: "w-2/5",
                              transition: p,
                              variants: "right" === x ? g : void 0,
                              initial: "hidden",
                              animate: "visible"
                            }),
                            (0, s.jsx)(o.E.img, {
                              width: 446,
                              height: 77,
                              src: c.r.Misc.HardwareWalletConnectUsb,
                              alt: "Hardware Wallet Connect USB",
                              className: "w-3/5",
                              transition: p,
                              variants: "right" === x ? w : void 0,
                              initial: "hidden",
                              animate: "visible"
                            })
                          ]
                        })
                      })
                    ]
                  }),
                  (0, s.jsx)(l.zx, {
                    className: "w-full mt-auto",
                    disabled: a === h.T.step2,
                    onClick: r,
                    "aria-label": "continue button in import ledger flow",
                    children:
                      a === h.T.step2
                        ? "Looking for device..."
                        : (0, s.jsx)("span", { "aria-label": "continue button text in import ledger flow", children: "Continue" })
                  })
                ]
              });
            };
          r();
        } catch (e) {
          r(e);
        }
      });
    },
    98004: function (e, t, a) {
      a.a(e, async function (e, r) {
        try {
          a.d(t, { g: () => x });
          var s = a(52322),
            n = a(4370),
            l = a(14981),
            i = a(19269),
            o = a(91729),
            d = a(2784),
            c = a(53542),
            u = a(79263),
            m = a(77742),
            h = e([m, u, c]);
          [m, u, c] = h.then ? (await h)() : h;
          let x = () => {
            let [e, t] = (0, d.useState)(),
              [a, r] = (0, d.useState)(new Set()),
              { moveToNextStep: h, ledgerNetworks: x, setCurrentStep: f, currentStep: p, prevStep: g } = (0, c.Xp)();
            (0, d.useEffect)(() => {
              let e = m.p.find(e => x.has(e.id));
              e ? (r(t => t.add(e.id)), t(e.id)) : f(e => e - 1);
            }, []);
            let w = (0, d.useCallback)(
              e => {
                let s = m.p.find(t => t.id !== e && !a.has(t.id) && x.has(t.id));
                s ? (r(e => e.add(s.id)), t(s.id)) : (t(void 0), h());
              },
              [a, x, h]
            );
            if (x.size > 0 && e)
              return (0, s.jsx)(n.E.div, {
                className: "flex flex-col items-stretch w-full h-full gap-7",
                variants: o.S,
                initial: g <= p ? "fromRight" : "fromLeft",
                animate: "animate",
                exit: "exit",
                children: (0, s.jsx)(l.M, {
                  mode: "wait",
                  initial: !1,
                  presenceAffectsLayout: !0,
                  children: (0, s.jsx)(
                    u.n,
                    { title: `Open ${e === c.Yg.ETH ? "Ethereum" : "Cosmos"} app on your ledger`, Icon: i.z, appType: e, moveToNextApp: w },
                    `hold-state-${e}`
                  )
                })
              });
          };
          r();
        } catch (e) {
          r(e);
        }
      });
    },
    19737: function (e, t, a) {
      a.a(e, async function (e, r) {
        try {
          a.d(t, { _: () => h });
          var s = a(52322),
            n = a(91486),
            l = a(23762),
            i = a(39775),
            o = a(2784),
            d = a(80793),
            c = a(91729),
            u = a(53542),
            m = e([u, d, l]);
          [u, d, l] = m.then ? (await m)() : m;
          let h = () => {
            let { secret: e, setSecret: t, privateKeyError: a, setPrivateKeyError: r, importWalletFromSeedPhrase: m } = (0, u.Xp)(),
              [h, x] = (0, o.useState)(a ?? ""),
              { prevStep: f, currentStep: p } = (0, u.Xp)();
            return (
              (0, o.useEffect)(() => {
                (null == a ? void 0 : a.length) && x(a);
              }, [a]),
              (0, s.jsxs)(c.n, {
                headerIcon: (0, s.jsx)(i.u, { className: "size-6" }),
                heading: "Import with private key",
                subHeading: "Type or paste your private key here",
                entry: f <= p ? "right" : "left",
                className: "gap-10",
                children: [
                  (0, s.jsx)(l.p, {
                    value: e,
                    onChange: e => {
                      x(""), r && r(""), t(e);
                    },
                    error: h
                  }),
                  (0, s.jsx)(n.zx, {
                    "data-testing-id": "btn-import-wallet",
                    className: "mt-auto w-full",
                    disabled: !!h || !e,
                    onClick: () => {
                      (0, d.b)({ phrase: e, isPrivateKey: !0, setError: x, setSecret: t }) && m();
                    },
                    "aria-label": "import private key button in private key flow",
                    children: (0, s.jsx)("span", { "aria-label": "import private key button text in private key flow", children: "Import private key" })
                  })
                ]
              })
            );
          };
          r();
        } catch (e) {
          r(e);
        }
      });
    },
    6491: function (e, t, a) {
      a.a(e, async function (e, r) {
        try {
          a.d(t, { W: () => m });
          var s = a(52322),
            n = a(2810),
            l = a(91486),
            i = a(2784),
            o = a(80793),
            d = a(91729),
            c = a(53542),
            u = e([c, o]);
          [c, o] = u.then ? (await u)() : u;
          let m = () => {
            let {
                walletName: e,
                privateKeyError: t,
                setPrivateKeyError: a,
                secret: r,
                setSecret: u,
                importWalletFromSeedPhrase: m,
                prevStep: h,
                currentStep: x
              } = (0, c.Xp)(),
              [f, p] = (0, i.useState)(t ?? ""),
              [g, w] = (0, i.useState)(!1),
              v = "private-key" === e;
            (0, i.useEffect)(() => {
              (null == t ? void 0 : t.length) && p(t);
            }, [t]);
            let b = async () => {
              (0, o.b)({ phrase: r, isPrivateKey: v, setError: p, setSecret: u }) && (w(!0), await new Promise(e => setTimeout(e, 100)), await m(), w(!1));
            };
            return (0, s.jsxs)(d.n, {
              heading: "Enter recovery phrase",
              subHeading: "Type or paste your 12 or 24-word recovery phrase",
              entry: h <= x ? "right" : "left",
              children: [
                (0, s.jsxs)("div", {
                  className: "w-full space-y-6 flex-1",
                  children: [
                    (0, s.jsx)(n.W, {
                      onChangeHandler: e => {
                        p(""), a && a(""), u(e);
                      },
                      isError: !!f
                    }),
                    f &&
                      (0, s.jsx)("span", {
                        className: "text-xs font-medium text-destructive-100 block text-center",
                        "data-testing-id": "error-text-ele",
                        children: f
                      })
                  ]
                }),
                (0, s.jsx)(l.zx, {
                  "data-testing-id": "btn-import-wallet",
                  className: "mt-4 w-full",
                  disabled: !!f || !r || g,
                  onClick: b,
                  "aria-label": "continue button in seed phrase flow",
                  children: (0, s.jsx)("span", { "aria-label": "continue button text in seed phrase flow", children: "Continue" })
                })
              ]
            });
          };
          r();
        } catch (e) {
          r(e);
        }
      });
    },
    51409: function (e, t, a) {
      a.a(e, async function (e, r) {
        try {
          a.d(t, { x: () => g });
          var s = a(52322),
            n = a(91486),
            l = a(66070),
            i = a(30877),
            o = a(19269),
            d = a(98771),
            c = a(18445),
            u = a(91729);
          a(2784);
          var m = a(70514),
            h = a(53542),
            x = e([h]);
          h = (x.then ? (await x)() : x)[0];
          let f = e =>
              (0, s.jsxs)("button", {
                onClick: e.onClick,
                className: (0, m.cn)(
                  "bg-secondary-200 hover:bg-secondary-400 transition-colors w-full p-5 text-start rounded-xl font-bold text-md flex items-center gap-4",
                  n.YV,
                  e.className
                ),
                children: [(0, s.jsx)(e.icon, { className: "size-6 text-muted-foreground" }), (0, s.jsx)("span", { children: e.title })]
              }),
            p = [
              { id: "seed-phrase", title: "Import recovery phrase", icon: d.a },
              { id: "private-key", title: "Import private key", icon: i._ },
              { id: "ledger", title: "Connect via Ledger", icon: o.z },
              { id: "watch-wallet", title: "Watch address", icon: l.t }
            ],
            g = () => {
              let { prevStep: e, currentStep: t, setCurrentStep: a, setWalletName: r } = (0, h.Xp)();
              return (0, s.jsx)(u.n, {
                headerIcon: (0, s.jsx)(c.o, { className: "size-6" }),
                heading: "Use an existing wallet",
                subHeading: "Select how you'd like to access your existing wallet",
                className: "gap-10",
                entry: e <= t ? "right" : "left",
                children: (0, s.jsx)("div", {
                  className: "flex flex-col gap-4 w-full",
                  children: p.map(e =>
                    (0, s.jsx)(
                      f,
                      {
                        onClick: () => {
                          r(e.id), a(t + 1);
                        },
                        icon: e.icon,
                        title: e.title
                      },
                      e.id
                    )
                  )
                })
              });
            };
          r();
        } catch (e) {
          r(e);
        }
      });
    },
    77742: function (e, t, a) {
      a.a(e, async function (e, r) {
        try {
          a.d(t, { Z: () => f, p: () => x });
          var s = a(52322),
            n = a(91486),
            l = a(94562),
            i = a(74229),
            o = a(30464),
            d = a(91729),
            c = a(2784),
            u = a(49409),
            m = a(53542),
            h = e([m]);
          let x = [
              { id: (m = (h.then ? (await h)() : h)[0]).Yg.COSMOS, img: o.r.Logos.Cosmos, title: "COSMOS", subText: "OSMO, ATOM & 4 more" },
              { id: m.Yg.ETH, img: o.r.Logos.Ethereum, title: "EVM", subText: "ETH, AVAX, BASE & 5 more" }
            ],
            f = () => {
              let {
                ledgerNetworks: e,
                addresses: t,
                setLedgerNetworks: a,
                moveToNextStep: r,
                setWalletAccounts: l,
                prevStep: i,
                currentStep: o,
                setAddresses: u
              } = (0, m.Xp)();
              return (
                (0, c.useEffect)(() => {
                  l(void 0), t && Object.keys(t).length > 0 && u({});
                }, []),
                (0, s.jsxs)(d.n, {
                  heading: "Select networks",
                  subHeading: "Select networks you want to connect with",
                  entry: i <= o ? "right" : "left",
                  children: [
                    (0, s.jsx)("div", {
                      className: "flex flex-col rounded-xl overflow-hidden py-1",
                      children: x.map(t =>
                        (0, s.jsx)(
                          p,
                          {
                            ...t,
                            checked: e.has(t.id),
                            onCheckedChange: e => {
                              a(a => {
                                let r = new Set(a);
                                return e ? r.add(t.id) : r.delete(t.id), r;
                              });
                            }
                          },
                          t.id
                        )
                      )
                    }),
                    (0, s.jsx)(n.zx, {
                      disabled: 0 === e.size,
                      className: "w-full mt-auto",
                      onClick: r,
                      "aria-label": "proceed button in select ledger network flow",
                      children: (0, s.jsx)("span", { "aria-label": "proceed button text in select ledger network flow", children: "Proceed" })
                    })
                  ]
                })
              );
            },
            p = e => {
              let t = (0, i.a1)();
              return (0, s.jsxs)("label", {
                className:
                  "flex flex-row gap-[14px] items-center p-5 border-b border-secondary-600/25 last:border-b-0 bg-secondary-200 hover:bg-secondary-300/75 transition-colors cursor-pointer text-start",
                children: [
                  (0, s.jsx)("img", { src: e.img || t, alt: e.title, onError: (0, u._)(t), className: "size-10 rounded-full" }),
                  (0, s.jsxs)("div", {
                    className: "flex flex-col",
                    children: [
                      (0, s.jsx)("h3", { className: "text-md font-bold", children: e.title }),
                      (0, s.jsx)("p", { className: "text-sm font-medium text-muted-foreground", children: e.subText })
                    ]
                  }),
                  (0, s.jsx)(l.X, { className: "ml-auto", checked: e.checked, onCheckedChange: e.onCheckedChange })
                ]
              });
            };
          r();
        } catch (e) {
          r(e);
        }
      });
    },
    66144: function (e, t, a) {
      a.a(e, async function (e, r) {
        try {
          a.d(t, { q: () => x });
          var s = a(52322),
            n = a(44658),
            l = a(55159),
            i = a(91486),
            o = a(77807),
            d = a(91729),
            c = a(2784),
            u = a(70514),
            m = a(53542),
            h = e([m, o]);
          [m, o] = h.then ? (await h)() : h;
          let x = () => {
            let { prevStep: e, currentStep: t, selectedIds: a, setSelectedIds: r, moveToNextStep: h, addresses: x, ledgerNetworks: f } = (0, m.Xp)(),
              [p, g] = (0, c.useState)([]);
            (0, c.useEffect)(() => {
              (async () => {
                let e = await l.Kn.getAllWallets(),
                  t = [];
                for (let s of Object.values(e ?? {})) {
                  var a, r;
                  let e = null == s ? void 0 : null === (a = s.addresses) || void 0 === a ? void 0 : a.cosmos;
                  e && t.push(e);
                  let l = null == s ? void 0 : null === (r = s.pubKeys) || void 0 === r ? void 0 : r.ethereum,
                    i = (l && n.SZ.getEvmAddress(l, !0)) || void 0;
                  i && t.push(i);
                }
                g(t);
              })();
            }, []);
            let w = (0, c.useCallback)(
                (e, t) => {
                  r(a => ({ ...(a ?? {}), [e]: t }));
                },
                [r]
              ),
              v = (0, c.useMemo)(() => {
                let e = f.has(m.Yg.COSMOS),
                  t = f.has(m.Yg.ETH);
                return Object.entries(a ?? {}).some(a => {
                  var r, s, l, i;
                  let [o, d] = a;
                  if (!d) return !1;
                  let c = null == x ? void 0 : null === (s = x[o]) || void 0 === s ? void 0 : null === (r = s.cosmos) || void 0 === r ? void 0 : r.address,
                    u = null == x ? void 0 : null === (i = x[o]) || void 0 === i ? void 0 : null === (l = i.ethereum) || void 0 === l ? void 0 : l.pubKey,
                    m = u ? n.SZ.getEvmAddress(u, !0) : void 0,
                    h = !!c && p.includes(c),
                    f = !!m && p.includes(m);
                  return e && t ? !h && !f : (!!e && !h) || (!!t && !f);
                });
              }, [f, a, x, p]),
              b = (0, c.useMemo)(
                () =>
                  2 === f.size &&
                  Object.entries(a ?? {}).some(e => {
                    var t, a, r, s;
                    let [l, i] = e;
                    if (!i) return !1;
                    let o = null == x ? void 0 : null === (a = x[l]) || void 0 === a ? void 0 : null === (t = a.cosmos) || void 0 === t ? void 0 : t.address,
                      d = null == x ? void 0 : null === (s = x[l]) || void 0 === s ? void 0 : null === (r = s.ethereum) || void 0 === r ? void 0 : r.pubKey,
                      c = d ? n.SZ.getEvmAddress(d, !0) : void 0,
                      u = !!o && p.includes(o),
                      m = !!c && p.includes(c);
                    return (!u && !!m) || (!!u && !m);
                  }),
                [f.size, a, x, p]
              );
            return (0, s.jsxs)(d.n, {
              heading: "Your wallets",
              subHeading: "Select the ones you want to import",
              entry: e <= t ? "right" : "left",
              children: [
                (0, s.jsx)("div", {
                  className: "gradient-overlay",
                  children: (0, s.jsx)("div", {
                    className: (0, u.cn)("flex flex-col w-full py-1 overflow-y-auto", b ? "max-h-[299px]" : "max-h-[330px]"),
                    children: (0, s.jsx)("div", {
                      className: "flex flex-col gap-4 pb-28",
                      children: Object.entries(x ?? {}).map((e, t) => {
                        var r, l;
                        let i,
                          d,
                          [c, u] = e,
                          h = !1;
                        f.has(m.Yg.COSMOS) &&
                          (i = null == u ? void 0 : null === (r = u.cosmos) || void 0 === r ? void 0 : r.address) &&
                          (h = p.indexOf(i) > -1);
                        let x = !1;
                        if (f.has(m.Yg.ETH)) {
                          let e = null == u ? void 0 : null === (l = u.ethereum) || void 0 === l ? void 0 : l.pubKey;
                          (d = n.SZ.getEvmAddress(e, !0) || void 0) && (x = p.indexOf(d) > -1);
                        }
                        let g = a[c];
                        return (0, s.jsx)(
                          o.ZP,
                          {
                            index: t,
                            path: c,
                            "data-testing-id": `wallet-${t + 1}`,
                            walletName: `Wallet ${t + 1}`,
                            cosmosAddress: i,
                            evmAddress: d,
                            isChosen: g || h || x,
                            isExistingAddress: h || x,
                            onSelectChange: w,
                            isLedger: !0,
                            showDerivationPath: !0
                          },
                          c
                        );
                      })
                    })
                  })
                }),
                (0, s.jsxs)("div", {
                  className: "flex flex-col items-center mt-auto w-full",
                  children: [
                    (0, s.jsx)(i.zx, {
                      className: "w-full",
                      disabled: !v,
                      "data-testing-id": "btn-select-wallet-proceed",
                      onClick: h,
                      "aria-label": "add selected wallets button in select ledger wallet flow",
                      children: (0, s.jsx)("span", {
                        "aria-label": "add selected wallets button text in select ledger wallet flow",
                        children: "Add selected wallets"
                      })
                    }),
                    b &&
                      (0, s.jsx)("div", {
                        className: "mt-3 text-muted-foreground text-xs !leading-[19px] text-center",
                        children: "All addresses for the EVM & Cosmos network will be imported."
                      })
                  ]
                })
              ]
            });
          };
          r();
        } catch (e) {
          r(e);
        }
      });
    },
    69543: function (e, t, a) {
      a.a(e, async function (e, r) {
        try {
          a.d(t, { R: () => m });
          var s = a(52322),
            n = a(55159),
            l = a(91486),
            i = a(77807),
            o = a(91729),
            d = a(2784),
            c = a(53542),
            u = e([c, i]);
          [c, i] = u.then ? (await u)() : u;
          let m = () => {
            let { selectedIds: e, setSelectedIds: t, moveToNextStep: a, walletAccounts: r = [], prevStep: u, currentStep: m } = (0, c.Xp)(),
              [h, x] = (0, d.useState)(!1),
              [f, p] = (0, d.useState)([]);
            (0, d.useEffect)(() => {
              (async () => {
                let e = await n.Kn.getAllWallets(),
                  t = [];
                for (let a of Object.values(e ?? {})) {
                  let e = a.addresses.cosmos;
                  (null != a && a.watchWallet) || t.push(e);
                }
                p(t);
              })();
            }, []);
            let g = (0, d.useMemo)(() => Object.values(e).filter(e => e).length, [e]),
              w = (0, d.useCallback)(
                (a, r) => {
                  t({ ...e, [a]: r });
                },
                [e, t]
              ),
              v = (0, d.useMemo)(
                () =>
                  r.filter(e => {
                    let { address: t } = e;
                    return !(t && f.indexOf(t) > -1);
                  }),
                [r, f]
              );
            return (0, s.jsxs)(o.n, {
              heading: "Your wallets",
              subHeading: "Select the ones you want to import",
              entry: u <= m ? "right" : "left",
              className: "gap-0",
              children: [
                (0, s.jsx)("div", {
                  className: "gradient-overlay mt-7 flex-1",
                  children: (0, s.jsxs)("div", {
                    className: "flex flex-col gap-3 h-[21rem] pb-28 overflow-auto",
                    children: [
                      (0, s.jsx)(i.JP, {
                        count: g,
                        total: v.length,
                        onSelectAllToggle: e => {
                          t(
                            e
                              ? Object.fromEntries(
                                  v.map(e => {
                                    let { index: t } = e;
                                    return [t, !0];
                                  })
                                )
                              : Object.fromEntries(
                                  v.map(e => {
                                    let { index: t } = e;
                                    return [t, !1];
                                  })
                                )
                          );
                        }
                      }),
                      r.map(t => {
                        let { address: a, index: r, evmAddress: n, bitcoinAddress: l, moveAddress: o, solanaAddress: d, suiAddress: c } = t,
                          u = !!a && f.indexOf(a) > -1,
                          m = e[r];
                        return (0, s.jsx)(
                          i.ZP,
                          {
                            index: r,
                            walletName: `Wallet ${r + 1}`,
                            "data-testing-id": `wallet-${r + 1}`,
                            cosmosAddress: a,
                            evmAddress: n,
                            bitcoinAddress: l,
                            moveAddress: o,
                            solanaAddress: d,
                            suiAddress: c,
                            isChosen: m,
                            isExistingAddress: u,
                            onSelectChange: w
                          },
                          r
                        );
                      })
                    ]
                  })
                }),
                (0, s.jsx)(l.zx, {
                  "data-testing-id": "btn-select-wallet-proceed",
                  className: "w-full",
                  disabled: h || 0 === Object.values(e).filter(e => e).length,
                  onClick: () => {
                    x(!0), a();
                  },
                  "aria-label": "proceed button in select wallet flow",
                  children: (0, s.jsx)("span", { "aria-label": "proceed button text in select wallet flow", children: "Proceed" })
                })
              ]
            });
          };
          r();
        } catch (e) {
          r(e);
        }
      });
    },
    18818: function (e, t, a) {
      a.a(e, async function (e, r) {
        try {
          a.d(t, { x: () => v });
          var s = a(52322),
            n = a(15969),
            l = a(91486),
            i = a(28144),
            o = a(4848),
            d = a(35226),
            c = a(14981),
            u = a(4370),
            m = a(66070),
            h = a(91729),
            x = a(2784),
            f = a(46338),
            p = a(53542),
            g = e([p]);
          p = (g.then ? (await g)() : g)[0];
          let w = { hidden: { opacity: 0, y: -10, height: 0 }, visible: { opacity: 1, y: 0, height: "auto" } },
            v = () => {
              let {
                  prevStep: e,
                  currentStep: t,
                  watchWalletAddress: a,
                  setWatchWalletAddress: r,
                  watchWalletName: g,
                  setWatchWalletName: v,
                  moveToNextStep: b
                } = (0, p.Xp)(),
                [y, j] = (0, x.useState)("");
              return (0, s.jsxs)(h.n, {
                headerIcon: (0, s.jsx)(m.t, { className: "size-6" }),
                heading: "Watch wallet",
                subHeading: "Add a wallet address you'd like to watch.",
                entry: e <= t ? "right" : "left",
                className: "gap-10",
                children: [
                  (0, s.jsxs)("div", {
                    className: "flex flex-col gap-4",
                    children: [
                      (0, s.jsxs)("div", {
                        className: "flex flex-col",
                        children: [
                          (0, s.jsx)(o.F, {
                            autoFocus: !0,
                            onChange: e => {
                              j(""), r(e);
                            },
                            value: a,
                            error: y,
                            placeholder: "Public address",
                            "data-testing-id": "enter-watch-address"
                          }),
                          (0, s.jsx)(c.M, {
                            children:
                              y &&
                              (0, s.jsx)(u.E.span, {
                                className: "text-xs font-medium text-destructive-100 block text-center",
                                "data-testing-id": "error-text-ele",
                                transition: f._M,
                                variants: w,
                                initial: "hidden",
                                animate: "visible",
                                exit: "hidden",
                                children: (0, s.jsx)("span", { className: "mt-2 block", children: y })
                              })
                          })
                        ]
                      }),
                      (0, s.jsx)(i.I, {
                        placeholder: "Name your wallet (optional)",
                        maxLength: 24,
                        value: null == g ? void 0 : g.replace(d.li, ""),
                        onChange: e => v(e.target.value),
                        trailingElement:
                          (null == g ? void 0 : g.length) > 0
                            ? (0, s.jsx)("span", { className: "text-muted-foreground text-sm font-medium", children: `${null == g ? void 0 : g.length}/24` })
                            : null
                      })
                    ]
                  }),
                  (0, s.jsx)(l.zx, {
                    "data-testing-id": "btn-import-wallet",
                    className: "mt-auto w-full",
                    disabled: !!y || !a || !g,
                    onClick: () => {
                      if (!a) {
                        j("");
                        return;
                      }
                      if (!(0, n.q3z)(a)) {
                        j("Invalid public address, please enter a valid address");
                        return;
                      }
                      j(""), b();
                    },
                    "aria-label": "start watching button in watch wallet flow",
                    children: (0, s.jsx)("span", { "aria-label": "start watching button text in watch wallet flow", children: "Start watching" })
                  })
                ]
              });
            };
          r();
        } catch (e) {
          r(e);
        }
      });
    }
  }
]);
//# sourceMappingURL=6564.js.map
