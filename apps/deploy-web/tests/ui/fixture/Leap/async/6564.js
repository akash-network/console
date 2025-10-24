!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "5f247005-ad82-42cb-96bf-0f2c68c51045"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-5f247005-ad82-42cb-96bf-0f2c68c51045"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.22.9" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["6564"],
  {
    64690: function (e, t, a) {
      a.d(t, { Z: () => k });
      var s = a(52322),
        n = a(91486),
        l = a(94562),
        i = a(28144),
        r = a(29195),
        d = a(14981),
        o = a(4370),
        c = a(2784);
      let u = e =>
        (0, s.jsxs)("svg", {
          width: "24",
          height: "24",
          viewBox: "0 0 24 24",
          fill: "none",
          xmlns: "http://www.w3.org/2000/svg",
          ...e,
          children: [
            (0, s.jsx)("g", {
              clipPath: "url(#clip0_4108_4137)",
              children: (0, s.jsx)("path", {
                fillRule: "evenodd",
                clipRule: "evenodd",
                d: "M0 1C0 0.447715 0.447715 0 1 0H23C23.5523 0 24 0.447715 24 1V10.6822C22.9251 9.06551 21.087 8 19 8C16.3876 8 14.1651 9.66962 13.3414 12H1C0.447715 12 0 11.5523 0 11V1ZM6 8C7.10457 8 8 7.10457 8 6C8 4.89543 7.10457 4 6 4C4.89543 4 4 4.89543 4 6C4 7.10457 4.89543 8 6 8ZM14 6C14 7.10457 13.1046 8 12 8C10.8954 8 10 7.10457 10 6C10 4.89543 10.8954 4 12 4C13.1046 4 14 4.89543 14 6ZM18 8C19.1046 8 20 7.10457 20 6C20 4.89543 19.1046 4 18 4C16.8954 4 16 4.89543 16 6C16 7.10457 16.8954 8 18 8ZM19 12C17.8523 12 17 12.8523 17 14V16H21V14C21 12.8523 20.1477 12 19 12ZM24 17C24 16.4 23.6 16 23 16V14C23 11.7477 21.2523 10 19 10C16.7477 10 15 11.7477 15 14V16C14.4 16 14 16.4 14 17V23C14 23.6 14.4 24 15 24H23C23.6 24 24 23.6 24 23V17Z",
                fill: "currentColor"
              })
            }),
            (0, s.jsx)("defs", {
              children: (0, s.jsx)("clipPath", { id: "clip0_4108_4137", children: (0, s.jsx)("rect", { width: "24", height: "24", fill: "white" }) })
            })
          ]
        });
      var m = a(91729),
        h = a(46338),
        x = a(64366),
        f = a(27783),
        p = a(28058),
        g = a(51343);
      let w = {
        dictionary: { ...f.Z.dictionary, ...g.Z.dictionary, ...p.Z.dictionary },
        graphs: f.Z.adjacencyGraphs,
        useLevenshteinDistance: !0,
        translations: g.Z.translations
      };
      x.Mu.setOptions(w);
      let v = e => (0, x.tu)(e).score;
      var b = a(10588);
      let y = { duration: 0.2 },
        j = { hidden: { opacity: 0, transition: y }, animate: { opacity: 1, transition: y } },
        C = e => {
          let { score: t } = e;
          return (0, s.jsx)(d.M, {
            children: (0, s.jsxs)(o.E.div, {
              className: "flex justify-center items-center font-bold text-sm",
              variants: j,
              initial: "hidden",
              animate: "animate",
              exit: "hidden",
              children: [
                4 === t &&
                  (0, s.jsx)(
                    o.E.span,
                    { className: "text-accent-success", variants: j, initial: "hidden", animate: "animate", exit: "hidden", children: "Strong" },
                    t
                  ),
                3 === t &&
                  (0, s.jsx)(
                    o.E.span,
                    { className: "text-accent-warning", variants: j, initial: "hidden", animate: "animate", exit: "hidden", children: "Medium" },
                    t
                  ),
                null !== t &&
                  t < 3 &&
                  (0, s.jsx)(
                    o.E.span,
                    { className: "text-destructive-100", variants: j, initial: "hidden", animate: "animate", exit: "hidden", children: "Weak" },
                    t < 3 ? "weak" : null
                  )
              ]
            })
          });
        },
        N = { hidden: { height: 0 }, visible: { height: "2rem" } };
      function k(e) {
        let { onProceed: t, entry: a } = e,
          [x, f] = (0, c.useState)(!1),
          [p, g] = (0, c.useState)(null),
          [w, y] = (0, c.useState)(!0),
          [j, k] = (0, c.useState)(""),
          [E, S] = (0, c.useState)({ pass1: "", pass2: "" }),
          [M, B] = (0, c.useState)({ pass1: "", pass2: "" }),
          A = (0, c.useCallback)(
            () => (B({ pass1: "", pass2: "" }), !(E.pass1.length < 8) || (B(e => ({ ...e, pass1: "Password must be at least 8 characters" })), !1)),
            [E.pass1.length]
          ),
          _ = (0, c.useCallback)(
            () => (E.pass1 != E.pass2 ? (B(e => ({ ...e, pass2: "Passwords do not match" })), !1) : !M.pass1 && !M.pass2 && !!A()),
            [M.pass1, M.pass2, E.pass1, E.pass2, A]
          ),
          z = async e => {
            e ? g(v(e)) : g(null);
          },
          L = () => {
            try {
              f(!0);
              let e = new TextEncoder().encode(E.pass1);
              t(e);
            } catch (e) {
              k(null == e ? void 0 : e.message);
            } finally {
              f(!1);
            }
          },
          Z = e => {
            let { name: t, value: a } = e.target;
            j && k(""), M[t] && (delete M[t], B(M)), S({ ...E, [t]: a });
          },
          H = e => {
            if ("enter" === e.key.toLowerCase()) {
              let t = e.target;
              "pass2" === t.name && _() && L();
              let a = t.form,
                s = [...a].indexOf(t);
              a.elements[s + 1].focus(), e.preventDefault();
            }
          },
          T = !!M.pass1 || !!M.pass2 || !E.pass1 || !E.pass2;
        return ((0, c.useEffect)(() => {
          let e = setTimeout(() => {
            z(E.pass1);
          }, 500);
          return () => {
            clearTimeout(e);
          };
        }, [E.pass1]),
        x)
          ? (0, s.jsx)(b.T_, {})
          : (0, s.jsx)("form", {
              onSubmit: e => {
                e.preventDefault(), _() && L();
              },
              className: "flex flex-col h-full",
              children: (0, s.jsxs)(m.n, {
                headerIcon: (0, s.jsx)(u, { className: "size-6" }),
                entry: a,
                heading: "Create your password",
                subHeading: "Choose a password to secure & lock your wallet",
                className: "gap-0",
                children: [
                  (0, s.jsxs)("div", {
                    className: "flex flex-col gap-y-5 w-full mt-10",
                    children: [
                      (0, s.jsxs)("div", {
                        className: "relative flex flex-col w-full",
                        children: [
                          (0, s.jsx)(i.I, {
                            autoFocus: !0,
                            placeholder: "Enter password",
                            type: "password",
                            name: "pass1",
                            onKeyDown: H,
                            onBlur: A,
                            status: M.pass1 || M.pass2 ? "error" : void 0,
                            value: E.pass1,
                            onChange: Z,
                            "data-testing-id": "input-password",
                            className: "h-[3.625rem]",
                            trailingElement: (0, s.jsx)(C, { score: p })
                          }),
                          (0, s.jsx)(d.M, {
                            children:
                              M.pass1 &&
                              (0, s.jsx)(o.E.span, {
                                className: "flex items-end justify-center text-destructive-100 text-xs text-center font-medium overflow-hidden",
                                variants: N,
                                initial: "hidden",
                                animate: "visible",
                                exit: "hidden",
                                children: M.pass1
                              })
                          })
                        ]
                      }),
                      (0, s.jsxs)("div", {
                        className: "relative flex flex-col gap-y-5 w-full",
                        children: [
                          (0, s.jsx)(r.W, {
                            name: "pass2",
                            value: E.pass2,
                            placeholder: "Confirm password",
                            onKeyDown: H,
                            className: "h-[3.625rem]",
                            onChange: Z,
                            status: M.pass2 ? "error" : void 0,
                            "data-testing-id": "input-confirm-password"
                          }),
                          (0, s.jsx)(d.M, {
                            children:
                              (M.pass2 || j) &&
                              (0, s.jsx)(o.E.span, {
                                className: "text-destructive-100 text-xs text-center font-medium",
                                "data-testing-id": "password-error-ele",
                                variants: h.HJ,
                                initial: "hidden",
                                animate: "visible",
                                exit: "hidden",
                                children: M.pass2 || j
                              })
                          })
                        ]
                      })
                    ]
                  }),
                  (0, s.jsxs)("label", {
                    htmlFor: "terms",
                    className: "flex flex-row justify-center items-center mt-auto",
                    children: [
                      (0, s.jsx)(l.X, {
                        id: "terms",
                        name: "terms",
                        value: "terms",
                        className: "cursor-pointer mr-2 h-4 w-4 accent-accent-foreground",
                        checked: w,
                        onCheckedChange: e => {
                          y(!!e);
                        }
                      }),
                      (0, s.jsxs)("p", {
                        className: "text-xs text-muted-foreground text-center",
                        children: [
                          "I agree to the",
                          " ",
                          (0, s.jsx)("a", {
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
                  (0, s.jsx)(n.zx, { className: "w-full mt-5", "data-testing-id": "btn-password-proceed", disabled: T || x || !w, children: "Set Password" })
                ]
              })
            });
      }
    },
    2810: function (e, t, a) {
      a.d(t, { W: () => f });
      var s = a(52322),
        n = a(72779),
        l = a.n(n),
        i = a(28144),
        r = a(83805),
        d = a(14981),
        o = a(4370),
        c = a(2784),
        u = a(70514);
      let m = e => {
          let { wordIndex: t, word: a, handlePaste: n, handleWordChange: r, isError: d, isFocused: o, handleWordFocused: c, handleWordBlur: u } = e;
          return (0, s.jsxs)("div", {
            className: l()(
              "flex items-center gap-2 rounded-lg bg-secondary-200 h-9 w-28 py-2 px-3 text-xs font-medium overflow-hidden",
              i.j[d ? "error" : "default"]
            ),
            onFocus: () => c(t),
            onBlur: () => u(),
            tabIndex: 0,
            onPaste: e => {
              e.preventDefault(), n(t, e.clipboardData.getData("text"));
            },
            children: [
              (0, s.jsx)("span", { className: "text-muted-foreground shrink-0", children: t }),
              (0, s.jsx)("input", {
                ref: e => e && o && e.focus(),
                type: o || d ? "text" : "password",
                value: a,
                onChange: e => r(t, e.target.value),
                className: "flex-1 outline-none bg-transparent w-0 text-foreground font-bold"
              })
            ]
          });
        },
        h = { duration: 0.2, ease: "easeInOut" },
        x = { left: { opacity: 0, x: 10, transition: h }, right: { opacity: 0, x: -10, transition: h }, visible: { opacity: 1, x: 0, transition: h } },
        f = e => {
          let { onChangeHandler: t, isError: a, className: n } = e,
            [l, i] = (0, c.useState)(1),
            [h, f] = (0, c.useState)(12),
            [p, g] = (0, c.useState)(Array(12).fill("")),
            w = e => {
              f(e), g(Array(e).fill(""));
            },
            v = (e, a) => {
              let s = a
                .trim()
                .split(" ")
                .map(e => e.trim())
                .filter(e => e.length);
              if (s.length) {
                if (12 === s.length || 24 === s.length) {
                  24 === s.length ? f(24) : 12 === s.length && f(12), g(s), t(s.join(" ").trim());
                  return;
                }
                for (let t = e; t < Math.min(h, s.length + e); t++) p[t - 1] = s[t - e];
                g(p), t(p.join(" ").trim());
              }
            },
            b = (e, a) => {
              (p[e - 1] = a), g(p), t(p.join(" ").trim());
            },
            y = e => {
              i(e);
            },
            j = () => {
              i(-1);
            };
          return (0, s.jsxs)("div", {
            className: (0, u.cn)("flex flex-col items-center w-full gap-7", a ? "h-[17.15rem]" : "h-[19.375rem]", n),
            children: [
              (0, s.jsx)(r.z, {
                selectedIndex: +(12 !== h),
                buttons: [
                  { label: "12 words", onClick: () => w(12) },
                  { label: "24 words", onClick: () => w(24) }
                ]
              }),
              (0, s.jsx)(d.M, {
                mode: "wait",
                children: (0, s.jsx)(
                  o.E.div,
                  {
                    className: (0, u.cn)("w-full grid grid-cols-3 gap-4 content-baseline overflow-auto p-1 flex-1"),
                    variants: x,
                    initial: 12 === p.length ? "left" : "right",
                    animate: "visible",
                    exit: 12 === p.length ? "right" : "left",
                    children: p.map((e, t) =>
                      (0, s.jsx)(
                        m,
                        {
                          wordIndex: t + 1,
                          word: e,
                          handlePaste: v,
                          handleWordChange: b,
                          isError: a,
                          isFocused: t + 1 === l,
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
      a.d(t, { X: () => d });
      var s = a(52322),
        n = a(62695),
        l = a(15256),
        i = a(2784),
        r = a(70514);
      let d = i.forwardRef((e, t) => {
        let { className: a, ...i } = e;
        return (0, s.jsx)(l.fC, {
          ref: t,
          className: (0, r.cn)(
            "peer h-4 w-4 shrink-0 rounded-sm data-[state=checked]:border border-accent-green shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:!bg-accent-green data-[state=checked]:text-accent-green !bg-secondary-300",
            a
          ),
          ...i,
          children: (0, s.jsx)(l.z$, {
            className: "flex items-center justify-center text-current",
            children: (0, s.jsx)(n.J, { className: "h-4 w-4 text-secondary-300" })
          })
        });
      });
      d.displayName = l.fC.displayName;
    },
    19003: function (e, t, a) {
      a.d(t, { Z: () => i });
      var s = a(52322),
        n = a(2784),
        l = a(70514);
      let i = e => {
        let { currentStep: t, totalSteps: a, className: i, moveToStep: r } = e,
          d = (0, n.useMemo)(() => Array.from({ length: a }, (e, t) => t + 1), [a]);
        return (0, s.jsx)("div", {
          className: (0, l.cn)("flex flex-row items-center justify-center align-center gap-3", i),
          children: d.map(e =>
            (0, s.jsx)(
              "div",
              {
                onClick: () => (null == r ? void 0 : r(e)),
                className: (0, l.cn)("h-1 w-[1.125rem] rounded-full transition-colors duration-500", e === t ? "bg-accent-green" : "bg-secondary-300")
              },
              e
            )
          )
        });
      };
    },
    64440: function (e, t, a) {
      a.d(t, { GA: () => u, LK: () => c, QT: () => h, RZ: () => o, YP: () => m, YX: () => d, dZ: () => f, fm: () => p });
      var s = a(54655),
        n = a(15969),
        l = a(44658),
        i = a(55334),
        r = a(6391);
      let d = async e => {
          try {
            let t = (0, n.PqN)(n.oCA, "cosmos", !1),
              a = (await (0, n.F$d)({ method: "GET", baseURL: t, url: `/cosmos/bank/v1beta1/balances/${e}` })).data.balances.find(e => "uatom" === e.denom);
            if (!a || isNaN(+a.amount)) return new r.BigNumber(0);
            return new r.BigNumber(a.amount).div(1e6);
          } catch {
            return new r.BigNumber(0);
          }
        },
        o = async e => {
          try {
            let t = (0, n.PqN)(n.oCA, "celestia", !1),
              a = (await (0, n.F$d)({ method: "GET", baseURL: t, url: `/cosmos/bank/v1beta1/balances/${e}` })).data.balances.find(e => "ucel" === e.denom);
            if (!a || isNaN(+a.amount)) return new r.BigNumber(0);
            return new r.BigNumber(a.amount).div(1e6);
          } catch {
            return new r.BigNumber(0);
          }
        },
        c = async e => {
          let t = n.oCA.bitcoin.apis.rpc;
          if (!t) return new r.BigNumber(0);
          try {
            var a, s;
            let n = new l.ti(t, e, "bitcoin"),
              i = await n.getData(),
              d = null == i ? void 0 : null === (s = i.balances) || void 0 === s ? void 0 : null === (a = s[0]) || void 0 === a ? void 0 : a.amount;
            if (isNaN(+d)) return new r.BigNumber(0);
            return new r.BigNumber(d).div(1e8);
          } catch {
            return new r.BigNumber(0);
          }
        },
        u = async e => {
          try {
            let t = new s.ScN({ fullnode: n.oCA.aptos.apis.rest }),
              a = new s.gZG(t),
              l = await a.getAccountCoinAmount({ accountAddress: e, coinType: s.EfF });
            if (isNaN(+l)) return new r.BigNumber(0);
            return new r.BigNumber(l).div(1e8);
          } catch {
            return new r.BigNumber(0);
          }
        },
        m = async e => {
          try {
            let t = new s.ScN({ fullnode: n.oCA.movement.apis.rest }),
              a = new s.gZG(t),
              l = await a.getAccountCoinAmount({ accountAddress: e, coinType: s.EfF });
            if (isNaN(+l)) return new r.BigNumber(0);
            return new r.BigNumber(l).div(1e8);
          } catch {
            return new r.BigNumber(0);
          }
        },
        h = async e => {
          try {
            let t = await (0, n.Bl1)("https://ethereum-rpc.publicnode.com", e);
            if (isNaN(+t.amount)) return new r.BigNumber(0);
            return new r.BigNumber(t.amount);
          } catch {
            return new r.BigNumber(0);
          }
        },
        x = async e => {
          try {
            let { data: t } = await (0, i.Z)({
                url: `${(0, n.BSD)()}/v1/balances/solana/native-balance`,
                method: "POST",
                data: { address: e, selectedNetwork: "mainnet", chain: "solana" },
                timeout: 5e3
              }),
              a = null == t ? void 0 : t["11111111111111111111111111111111"];
            if (!(null == a ? void 0 : a.amount) || isNaN(+a.amount)) return new r.BigNumber(0);
            return new r.BigNumber(a.amount);
          } catch {
            return new r.BigNumber(0);
          }
        },
        f = async e => {
          try {
            let { data: t, status: a } = await (0, i.Z)({
              url: "https://go.getblock.io/e8924dbdeef24817a1b024dc6fe4c18b",
              method: "POST",
              data: { jsonrpc: "2.0", id: 1, method: "getBalance", params: [e, null] },
              timeout: 5e3
            });
            if (200 !== a) throw Error("Failed to get solana balance, trying fallback");
            let s = t.result.value;
            if (!s || isNaN(+s)) return new r.BigNumber(0);
            return new r.BigNumber(s).div(1e9);
          } catch {
            return await x(e);
          }
        },
        p = async e => {
          try {
            let { data: t } = await (0, i.Z)({
                url: "https://fullnode.mainnet.sui.io:443",
                method: "POST",
                data: { jsonrpc: "2.0", id: 1, method: "suix_getBalance", params: [e] },
                timeout: 5e3
              }),
              a = t.result.totalBalance;
            if (isNaN(+a)) return new r.BigNumber(0);
            return new r.BigNumber(a).div(1e9);
          } catch {
            return new r.BigNumber(0);
          }
        };
    },
    77807: function (e, t, a) {
      a.a(e, async function (e, s) {
        try {
          a.d(t, { JP: () => S, ZP: () => C });
          var n = a(52322),
            l = a(2784),
            i = a(41172),
            r = a(48272),
            d = a(26227),
            o = a(94562),
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
                  showDerivationPath: s = !1,
                  isExistingAddress: i,
                  isLedger: d,
                  isChosen: c,
                  onSelectChange: h,
                  path: x,
                  cosmosAddress: f,
                  evmAddress: w,
                  bitcoinAddress: y,
                  moveAddress: C,
                  solanaAddress: N,
                  suiAddress: S,
                  className: M,
                  ...B
                } = e,
                [A, _] = (0, l.useState)(!0),
                {
                  data: z,
                  nonZeroData: L,
                  zeroBalance: Z,
                  isLoading: H
                } = (0, b.l)({ cosmosAddress: f, bitcoinAddress: y, moveAddress: C, evmAddress: w, solanaAddress: N, suiAddress: S }),
                T = Z ? z : L,
                O = (0, l.useMemo)(() => (0, p.X2)(x ?? ""), [x]);
              (0, l.useEffect)(() => {
                Z && !H && _(!1);
              }, [Z, H]),
                (0, l.useEffect)(() => {
                  if (!H) {
                    if (d && i) {
                      h(x || a, !0);
                      return;
                    }
                    h(x || a, !Z);
                  }
                }, [Z, H, a, d, i]);
              let P = (0, l.useMemo)(() => (d ? z : T), [d, z, T]);
              return (0, n.jsxs)("label", {
                className: (0, g.cn)("rounded-xl w-full bg-secondary-200 shrink-0 cursor-pointer", i && !d && "opacity-50", M),
                ...B,
                children: [
                  (0, n.jsxs)("div", {
                    className: "flex items-center gap-2 px-5 pt-5 pb-4",
                    children: [
                      (0, n.jsxs)("div", {
                        role: "button",
                        className: "flex items-center gap-2",
                        onClick: e => {
                          P && P.length && (e.preventDefault(), e.stopPropagation(), _(e => !e));
                        },
                        children: [
                          (0, n.jsx)("span", { className: "font-bold text-mdl select-none", children: t }),
                          s && (0, n.jsx)("span", { className: "text-xs font-medium py-px px-[6px] rounded bg-secondary-300", children: O }),
                          !H &&
                            !!(null == P ? void 0 : P.length) &&
                            (0, n.jsx)(r.p, { size: 14, className: (0, g.cn)("text-muted-foreground transition-transform", A && "-rotate-180") }),
                          i &&
                            !d &&
                            (0, n.jsx)("span", { className: "text-xs font-medium py-px px-[6px] rounded bg-secondary-300", children: "Already exists" })
                        ]
                      }),
                      (0, n.jsx)(o.X, { disabled: i, checked: c, onCheckedChange: e => h(x || a, "indeterminate" !== e && !!e), className: "ml-auto" })
                    ]
                  }),
                  (0, n.jsx)(u.M, {
                    mode: "wait",
                    children: H
                      ? (0, n.jsx)(
                          m.E.div,
                          {
                            className: "flex flex-col border-t border-secondary-600/50 overflow-hidden",
                            initial: "hidden",
                            animate: "visible",
                            exit: "hidden",
                            variants: v.K0,
                            transition: v.Wz,
                            children: (0, n.jsx)(E, {})
                          },
                          "skeleton"
                        )
                      : A &&
                        P &&
                        (0, n.jsx)(
                          m.E.div,
                          {
                            className: "flex flex-col border-t border-secondary-600/50 overflow-hidden",
                            initial: "hidden",
                            animate: "visible",
                            exit: "hidden",
                            variants: j,
                            transition: v.Wz,
                            children: P.map(e => (0, l.createElement)(k, { ...e, chainKey: e.key, name: e.name, key: e.key }))
                          },
                          "data"
                        )
                  })
                ]
              });
            },
            N = e => {
              let { address: t } = e,
                { copy: a, isCopied: s } = (0, x.F)();
              return (0, n.jsx)(u.M, {
                mode: "wait",
                children: s
                  ? (0, n.jsxs)(
                      m.E.span,
                      {
                        className: "text-sm font-bold text-accent-success ml-auto flex items-center gap-1",
                        initial: "hidden",
                        animate: "visible",
                        exit: "hidden",
                        variants: v.K0,
                        transition: v._M,
                        children: [(0, n.jsx)(d.f, { size: 16 }), " Copied"]
                      },
                      "copied"
                    )
                  : (0, n.jsx)(
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
                        children: (0, i.Hnh)(t)
                      },
                      "address"
                    )
              });
            },
            k = e => {
              let t = (0, h.a1)();
              return (0, n.jsxs)(m.E.div, {
                className: "px-5 py-4 flex items-center gap-2.5 w-full border-b border-secondary-600/25 last:border-b-0 overflow-hidden shrink-0",
                initial: "hidden",
                animate: "visible",
                exit: "hidden",
                variants: v.K0,
                transition: v.Wz,
                children: [
                  (0, n.jsx)("img", { src: (0, f.getChainImage)(e.chainKey), onError: (0, w._)(t), className: "rounded-full overflow-hidden size-9" }),
                  (0, n.jsxs)("div", {
                    className: "flex flex-col gap-0.5 capitalize",
                    children: [
                      (0, n.jsx)("span", { className: "text-md font-bold", children: e.name }),
                      (0, n.jsxs)("span", { className: "text-xs font-medium text-muted-foreground", children: [e.amount, " ", e.denom] })
                    ]
                  }),
                  e.address && (0, n.jsx)(N, { address: e.address })
                ]
              });
            },
            E = () =>
              (0, n.jsxs)("div", {
                className: "px-5 py-4 flex items-center gap-2.5 w-full border-b border-secondary-600/25 last:border-b-0",
                children: [
                  (0, n.jsx)(c.O, { className: "rounded-full size-9" }),
                  (0, n.jsxs)("div", {
                    className: "flex flex-col gap-2 capitalize h-[42px] justify-center",
                    children: [(0, n.jsx)(c.O, { className: "w-16 h-2.5" }), (0, n.jsx)(c.O, { className: "w-10 h-2" })]
                  }),
                  (0, n.jsx)(c.O, { className: "w-20 h-3 ml-auto" })
                ]
              }),
            S = e => {
              let { count: t, total: a, onSelectAllToggle: s } = e;
              return (0, n.jsxs)("label", {
                className: "bg-secondary-200 rounded-xl flex items-center justify-between p-5 select-none",
                children: [
                  (0, n.jsxs)("span", { className: "font-bold", children: [t, " ", 1 === t ? "wallet" : "wallets", " selected"] }),
                  (0, n.jsxs)("div", {
                    className: "flex items-center gap-1.5",
                    children: [
                      (0, n.jsx)("span", { className: "text-muted-foreground text-sm font-bold", children: "Select All" }),
                      (0, n.jsx)(o.X, { checked: t === a, onCheckedChange: s })
                    ]
                  })
                ]
              });
            };
          s();
        } catch (e) {
          s(e);
        }
      });
    },
    90848: function (e, t, a) {
      a.a(e, async function (e, s) {
        try {
          a.d(t, { l: () => x });
          var n = a(92642),
            l = a(60431),
            i = a(66534),
            r = a(6391),
            d = a(36400),
            o = a(2784),
            c = a(71198),
            u = a(64440),
            m = e([d]);
          d = (m.then ? (await m)() : m)[0];
          let h = (e, t) => {
              let { words: a } = i.bech32.decode(e);
              return i.bech32.encode(t, a);
            },
            x = e => {
              let { cosmosAddress: t, bitcoinAddress: a, moveAddress: s, evmAddress: i, solanaAddress: m, suiAddress: x } = e,
                f = (0, d.pb)(),
                p = (0, l.useQuery)({
                  queryKey: ["cosmos-balance", t],
                  queryFn: async () => (t ? (0, u.YX)(t) : new r.BigNumber(0)),
                  enabled: !!t,
                  retry: !1,
                  onError: e => {
                    (0, n.Tb)(e);
                  }
                }),
                g = (0, o.useMemo)(() => {
                  if (t) return h(t, f.celestia.addressPrefix);
                }, [t, f.celestia.addressPrefix]),
                w = (0, l.useQuery)({ queryKey: ["celestia-balance", g], queryFn: async () => (g ? (0, u.RZ)(g) : new r.BigNumber(0)) }),
                v = (0, l.useQuery)({
                  queryKey: ["bitcoin-balance", a],
                  queryFn: async () => (a ? (0, u.LK)(a) : new r.BigNumber(0)),
                  enabled: !!a,
                  retry: !1,
                  onError: e => {
                    (0, n.Tb)(e);
                  }
                }),
                b = (0, l.useQuery)({
                  queryKey: ["movement-balance", s],
                  queryFn: async () => (s ? (0, u.YP)(s) : new r.BigNumber(0)),
                  enabled: !!s,
                  retry: !1,
                  onError: e => {
                    (0, n.Tb)(e);
                  }
                }),
                y = (0, l.useQuery)({
                  queryKey: ["evm-balance", i],
                  queryFn: async () => (i ? (0, u.QT)(i) : new r.BigNumber(0)),
                  enabled: !!i,
                  retry: !1,
                  onError: e => {
                    (0, n.Tb)(e);
                  }
                }),
                j = (0, l.useQuery)({
                  queryKey: ["aptos-balance", s],
                  queryFn: async () => (s ? (0, u.GA)(s) : new r.BigNumber(0)),
                  enabled: !!s,
                  retry: !1,
                  onError: e => {
                    (0, n.Tb)(e);
                  }
                }),
                C = (0, l.useQuery)({
                  queryKey: ["solana-balance", m],
                  queryFn: async () => (m ? (0, u.dZ)(m) : new r.BigNumber(0)),
                  enabled: !!m,
                  retry: !1,
                  onError: e => {
                    (0, n.Tb)(e);
                  }
                }),
                N = (0, l.useQuery)({ queryKey: ["sui-balance", x], queryFn: async () => (x ? (0, u.fm)(x) : new r.BigNumber(0)) }),
                k =
                  (t && p.isLoading) ||
                  (a && v.isLoading) ||
                  (s && b.isLoading) ||
                  (i && y.isLoading) ||
                  (g && w.isLoading) ||
                  (s && j.isLoading) ||
                  (m && C.isLoading) ||
                  (x && N.isLoading),
                E = (0, o.useMemo)(
                  () =>
                    [
                      { key: f.cosmos.key, name: "Cosmos Hub", denom: f.cosmos.denom, address: t, amount: p.data },
                      { key: f.ethereum.key, name: "Ethereum", denom: f.ethereum.denom, address: i, amount: y.data },
                      { key: f.celestia.key, name: "Celestia", denom: f.celestia.denom, address: g, amount: w.data },
                      { key: f.bitcoin.key, name: "Bitcoin", denom: f.bitcoin.denom, address: a, amount: v.data },
                      { key: f.solana.key, name: "Solana", denom: f.solana.denom, address: m, amount: C.data },
                      { key: f.sui.key, name: "Sui", denom: f.sui.denom, address: x, amount: N.data },
                      { key: f.aptos.key, name: "Aptos", denom: f.aptos.denom, address: s, amount: j.data },
                      { key: f.movement.key, name: "Movement", denom: f.movement.denom, address: s, amount: b.data }
                    ]
                      .filter(e => e.address)
                      .map(e => {
                        var t;
                        return { ...e, amount: (0, c.jX)((null === (t = e.amount) || void 0 === t ? void 0 : t.toString()) ?? "0.00") };
                      }),
                  [t, a, i, s, g, m, x, p.data, v.data, y.data, b.data, w.data, j.data, C.data, N.data, f]
                ),
                S = (0, o.useMemo)(() => E.every(e => "0" === e.amount), [E]),
                M = (0, o.useMemo)(() => E.filter(e => "0" !== e.amount), [E]);
              return { data: E, zeroBalance: S, nonZeroData: M, isLoading: k };
            };
          s();
        } catch (e) {
          s(e);
        }
      });
    },
    31775: function (e, t, a) {
      a.d(t, { F: () => n });
      var s = a(2784);
      let n = () => {
        let [e, t] = (0, s.useState)(!1);
        return (
          (0, s.useEffect)(() => {
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
      a.d(t, { u: () => n });
      var s = a(52322);
      a(2784);
      let n = e =>
        (0, s.jsxs)("svg", {
          width: "24",
          height: "24",
          viewBox: "0 0 24 24",
          fill: "none",
          xmlns: "http://www.w3.org/2000/svg",
          ...e,
          children: [
            (0, s.jsx)("g", {
              clipPath: "url(#clip0_4108_4122)",
              children: (0, s.jsx)("path", {
                fillRule: "evenodd",
                clipRule: "evenodd",
                d: "M20.818 4.55021L23.0982 2.27L20.9769 0.148682L9.4296 11.696C8.54928 11.2507 7.55393 10.9999 6.5 10.9999C2.91015 10.9999 0 13.91 0 17.4999C0 21.0898 2.91015 23.9999 6.5 23.9999C10.0899 23.9999 13 21.0898 13 17.4999C13 16.054 12.5279 14.7184 11.7294 13.6388L15.161 10.2072L16.9283 11.9746L19.0496 9.85326L17.2823 8.08593L18.6967 6.67153L21.8784 9.85324L23.9997 7.73192L20.818 4.55021ZM3 17.4999C3 15.5669 4.567 13.9999 6.5 13.9999C8.433 13.9999 10 15.5669 10 17.4999C10 19.4329 8.433 20.9999 6.5 20.9999C4.567 20.9999 3 19.4329 3 17.4999Z",
                fill: "currentColor"
              })
            }),
            (0, s.jsx)("defs", {
              children: (0, s.jsx)("clipPath", { id: "clip0_4108_4122", children: (0, s.jsx)("rect", { width: "24", height: "24", fill: "white" }) })
            })
          ]
        });
    },
    30877: function (e, t, a) {
      a.d(t, { _: () => n });
      var s = a(52322);
      a(2784);
      let n = e =>
        (0, s.jsxs)("svg", {
          width: "24",
          height: "24",
          viewBox: "0 0 24 24",
          fill: "none",
          xmlns: "http://www.w3.org/2000/svg",
          ...e,
          children: [
            (0, s.jsxs)("g", {
              clipPath: "url(#clip0_403_263)",
              children: [
                (0, s.jsx)("mask", {
                  id: "mask0_403_263",
                  maskUnits: "userSpaceOnUse",
                  x: "0",
                  y: "0",
                  width: "24",
                  height: "24",
                  children: (0, s.jsx)("rect", { width: "24", height: "24", fill: "#D9D9D9" })
                }),
                (0, s.jsx)("g", {
                  mask: "url(#mask0_403_263)",
                  children: (0, s.jsx)("path", {
                    d: "M7 14C6.45 14 5.97917 13.8042 5.5875 13.4125C5.19583 13.0208 5 12.55 5 12C5 11.45 5.19583 10.9792 5.5875 10.5875C5.97917 10.1958 6.45 10 7 10C7.55 10 8.02083 10.1958 8.4125 10.5875C8.80417 10.9792 9 11.45 9 12C9 12.55 8.80417 13.0208 8.4125 13.4125C8.02083 13.8042 7.55 14 7 14ZM7 18C5.33333 18 3.91667 17.4167 2.75 16.25C1.58333 15.0833 1 13.6667 1 12C1 10.3333 1.58333 8.91667 2.75 7.75C3.91667 6.58333 5.33333 6 7 6C8.11667 6 9.12917 6.275 10.0375 6.825C10.9458 7.375 11.6667 8.1 12.2 9H20.575C20.7083 9 20.8375 9.025 20.9625 9.075C21.0875 9.125 21.2 9.2 21.3 9.3L23.3 11.3C23.4 11.4 23.4708 11.5083 23.5125 11.625C23.5542 11.7417 23.575 11.8667 23.575 12C23.575 12.1333 23.5542 12.2583 23.5125 12.375C23.4708 12.4917 23.4 12.6 23.3 12.7L20.125 15.875C20.0417 15.9583 19.9417 16.025 19.825 16.075C19.7083 16.125 19.5917 16.1583 19.475 16.175C19.3583 16.1917 19.2417 16.1833 19.125 16.15C19.0083 16.1167 18.9 16.0583 18.8 15.975L17.5 15L16.075 16.075C15.9917 16.1417 15.9 16.1917 15.8 16.225C15.7 16.2583 15.6 16.275 15.5 16.275C15.4 16.275 15.2958 16.2583 15.1875 16.225C15.0792 16.1917 14.9833 16.1417 14.9 16.075L13.375 15H12.2C11.6667 15.9 10.9458 16.625 10.0375 17.175C9.12917 17.725 8.11667 18 7 18ZM7 16C7.93333 16 8.75417 15.7167 9.4625 15.15C10.1708 14.5833 10.6417 13.8667 10.875 13H14L15.45 14.025L17.5 12.5L19.275 13.875L21.15 12L20.15 11H10.875C10.6417 10.1333 10.1708 9.41667 9.4625 8.85C8.75417 8.28333 7.93333 8 7 8C5.9 8 4.95833 8.39167 4.175 9.175C3.39167 9.95833 3 10.9 3 12C3 13.1 3.39167 14.0417 4.175 14.825C4.95833 15.6083 5.9 16 7 16Z",
                    fill: "currentColor"
                  })
                })
              ]
            }),
            (0, s.jsx)("defs", {
              children: (0, s.jsx)("clipPath", { id: "clip0_403_263", children: (0, s.jsx)("rect", { width: "24", height: "24", fill: "white" }) })
            })
          ]
        });
    },
    98771: function (e, t, a) {
      a.d(t, { a: () => n });
      var s = a(52322);
      a(2784);
      let n = e =>
        (0, s.jsxs)("svg", {
          width: "24",
          height: "24",
          viewBox: "0 0 24 24",
          fill: "none",
          xmlns: "http://www.w3.org/2000/svg",
          ...e,
          children: [
            (0, s.jsx)("mask", {
              id: "mask0_403_640",
              maskUnits: "userSpaceOnUse",
              x: "0",
              y: "0",
              width: "24",
              height: "24",
              children: (0, s.jsx)("rect", { width: "24", height: "24", fill: "#D9D9D9" })
            }),
            (0, s.jsx)("g", {
              mask: "url(#mask0_403_640)",
              children: (0, s.jsx)("path", {
                d: "M5 21C4.45 21 3.97917 20.8042 3.5875 20.4125C3.19583 20.0208 3 19.55 3 19V5C3 4.45 3.19583 3.97917 3.5875 3.5875C3.97917 3.19583 4.45 3 5 3H19C19.55 3 20.0208 3.19583 20.4125 3.5875C20.8042 3.97917 21 4.45 21 5V19C21 19.55 20.8042 20.0208 20.4125 20.4125C20.0208 20.8042 19.55 21 19 21H5ZM5 19H19V5H5V19ZM8 17H13C13.2833 17 13.5208 16.9042 13.7125 16.7125C13.9042 16.5208 14 16.2833 14 16C14 15.7167 13.9042 15.4792 13.7125 15.2875C13.5208 15.0958 13.2833 15 13 15H8C7.71667 15 7.47917 15.0958 7.2875 15.2875C7.09583 15.4792 7 15.7167 7 16C7 16.2833 7.09583 16.5208 7.2875 16.7125C7.47917 16.9042 7.71667 17 8 17ZM8 13H16C16.2833 13 16.5208 12.9042 16.7125 12.7125C16.9042 12.5208 17 12.2833 17 12C17 11.7167 16.9042 11.4792 16.7125 11.2875C16.5208 11.0958 16.2833 11 16 11H8C7.71667 11 7.47917 11.0958 7.2875 11.2875C7.09583 11.4792 7 11.7167 7 12C7 12.2833 7.09583 12.5208 7.2875 12.7125C7.47917 12.9042 7.71667 13 8 13ZM8 9H16C16.2833 9 16.5208 8.90417 16.7125 8.7125C16.9042 8.52083 17 8.28333 17 8C17 7.71667 16.9042 7.47917 16.7125 7.2875C16.5208 7.09583 16.2833 7 16 7H8C7.71667 7 7.47917 7.09583 7.2875 7.2875C7.09583 7.47917 7 7.71667 7 8C7 8.28333 7.09583 8.52083 7.2875 8.7125C7.47917 8.90417 7.71667 9 8 9Z",
                fill: "currentColor"
              })
            })
          ]
        });
    },
    98151: function (e, t, a) {
      a.a(e, async function (e, s) {
        try {
          a.r(t), a.d(t, { default: () => j });
          var n = a(52322),
            l = a(64690),
            i = a(14981),
            r = a(75958);
          a(2784);
          var d = a(10588),
            o = a(53542),
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
            b = e([f, x, h, u, p, v, w, m, g, o, c]);
          [f, x, h, u, p, v, w, m, g, o, c] = b.then ? (await b)() : b;
          let y = () => {
              let { currentStepName: e, onOnboardingCompleted: t, prevStep: a, currentStep: s } = (0, o.Xp)();
              return (0, n.jsxs)(i.M, {
                mode: "wait",
                presenceAffectsLayout: !0,
                children: [
                  "loading" === e && (0, n.jsx)(d.T_, {}, "creating-wallet-loader"),
                  "select-import-type" === e && (0, n.jsx)(f.x, {}, "select-import-type"),
                  "seed-phrase" === e && (0, n.jsx)(x.W, {}, "seed-phrase-view"),
                  "private-key" === e && (0, n.jsx)(h._, {}, "private-key-view"),
                  "import-ledger" === e && (0, n.jsx)(u.H4, {}, "import-ledger-view"),
                  "select-ledger-network" === e && (0, n.jsx)(p.Z, {}, "select-ledger-network-view"),
                  "import-watch-wallet" === e && (0, n.jsx)(v.x, {}, "import-watch-wallet-view"),
                  "select-wallet" === e && (0, n.jsx)(w.R, {}, "select-wallet-view"),
                  "importing-ledger-accounts" === e && (0, n.jsx)(m.g, {}, "importing-ledger-accounts-view"),
                  "select-ledger-wallet" === e && (0, n.jsx)(g.q, {}, "select-ledger-wallet-view"),
                  "choose-password" === e && (0, n.jsx)(l.Z, { onProceed: t, entry: a <= s ? "right" : "left" }, "choose-password-view")
                ]
              });
            },
            j = (0, r.Pi)(() => (0, n.jsx)(o.jr, { children: (0, n.jsx)(c.p, { children: (0, n.jsx)(y, {}) }) }));
          s();
        } catch (e) {
          s(e);
        }
      });
    },
    41607: function (e, t, a) {
      a.a(e, async function (e, s) {
        try {
          a.d(t, { p: () => h });
          var n = a(52322),
            l = a(43166),
            i = a(91486),
            r = a(19003);
          a(2784);
          var d = a(70514),
            o = a(98622),
            c = a(53542),
            u = e([c]);
          c = (u.then ? (await u)() : u)[0];
          let m = () => {
              let { backToPreviousStep: e, currentStep: t, totalSteps: a, walletName: s } = (0, c.Xp)();
              return (0, n.jsxs)("div", {
                className: "flex flex-row items-center justify-between align-center w-full relative -m-1",
                children: [
                  (0, n.jsx)(i.zx, { variant: "secondary", size: "icon", onClick: e, children: (0, n.jsx)(l.X, { className: "size-4" }) }),
                  t > 0 &&
                    (0, n.jsx)(r.Z, {
                      currentStep: t,
                      totalSteps: "private-key" === s || "watch-wallet" === s ? a - 1 : "ledger" === s || "evm-ledger" === s ? a + 1 : a
                    }),
                  (0, n.jsx)("div", { className: "size-9 shrink-0" })
                ]
              });
            },
            h = e =>
              (0, n.jsxs)(o.z, {
                className: (0, d.cn)("flex flex-col items-stretch gap-7 p-7 overflow-auto border-secondary-300 relative", e.className),
                children: [(0, n.jsx)(m, {}), e.children]
              });
          s();
        } catch (e) {
          s(e);
        }
      });
    },
    79263: function (e, t, a) {
      a.a(e, async function (e, s) {
        try {
          a.d(t, { n: () => m });
          var n = a(52322),
            l = a(15969),
            i = a(91486),
            r = a(4370),
            d = a(91729),
            o = a(2784),
            c = a(53542),
            u = e([c]);
          c = (u.then ? (await u)() : u)[0];
          let m = e => {
            let { Icon: t, title: a, cta: s, moveToNextApp: u, appType: m } = e,
              { getLedgerAccountDetails: h } = (0, c.Xp)();
            return (
              (0, o.useEffect)(() => {
                let e = setInterval(async () => {
                  try {
                    (await (0, l.qn$)(m === c.Yg.ETH ? "Ethereum" : "Cosmos")) && (await h(m), u(m), clearInterval(e));
                  } catch (e) {
                    console.error(e);
                  }
                }, 4e3);
                return () => {
                  clearInterval(e);
                };
              }, [m]),
              (0, n.jsxs)(r.E.div, {
                className: "flex flex-col w-full flex-1",
                variants: d.S,
                initial: "fromRight",
                animate: "animate",
                exit: "exit",
                children: [
                  (0, n.jsxs)("header", {
                    className: "flex flex-col items-center justify-center gap-6 flex-1",
                    children: [
                      (0, n.jsx)("div", {
                        className:
                          "rounded-full size-[134px] animate-scaleUpDown [--scale-up-down-start:1.05] bg-accent-foreground/20 grid place-content-center",
                        children: (0, n.jsx)("div", {
                          className:
                            "rounded-full size-[89px] animate-scaleUpDown [--scale-up-down-start:1.075] bg-accent-foreground/40 grid place-content-center",
                          children: (0, n.jsx)("div", {
                            className:
                              "rounded-full size-[44.5px] animate-scaleUpDown [--scale-up-down-start:1.1] bg-accent-foreground grid place-content-center",
                            children: (0, n.jsx)(t, { className: "size-6" })
                          })
                        })
                      }),
                      (0, n.jsx)("span", { className: "text-xl font-bold text-center", children: a })
                    ]
                  }),
                  !!(s && u) && (0, n.jsx)(i.zx, { className: "w-full", onClick: () => u(m), children: s })
                ]
              })
            );
          };
          s();
        } catch (e) {
          s(e);
        }
      });
    },
    24693: function (e, t, a) {
      a.a(e, async function (e, s) {
        try {
          a.d(t, { H4: () => v });
          var n = a(52322),
            l = a(6011),
            i = a(91486),
            r = a(14981),
            d = a(4370),
            o = a(56336),
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
              let { prevStep: e, currentStep: t, ledgerConnectionStatus: a, moveToNextStep: s } = (0, m.Xp)(),
                x = e <= t ? "right" : "left";
              return (0, n.jsxs)(u.n, {
                headerIcon: (0, n.jsx)(o.zq, { className: "size-6" }),
                heading: "Connect your Ledger",
                entry: x,
                children: [
                  (0, n.jsxs)("div", {
                    className: "flex flex-col gap-4 w-full relative h-[301px]",
                    children: [
                      f.map((e, t) =>
                        (0, n.jsxs)(
                          "div",
                          {
                            className: "bg-secondary-200 py-4 px-5 w-full rounded-xl text-sm font-medium flex items-center gap-4",
                            children: [(0, n.jsx)(l.f, { weight: "bold", className: "size-5 shrink-0 text-muted-foreground" }), e.description]
                          },
                          t
                        )
                      ),
                      (0, n.jsx)("div", {
                        className: "-mx-7 mt-7 flex items-center justify-between",
                        children: (0, n.jsxs)(r.M, {
                          children: [
                            (0, n.jsx)(d.E.img, {
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
                            (0, n.jsx)(d.E.img, {
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
                  (0, n.jsx)(i.zx, {
                    className: "w-full mt-auto",
                    disabled: a === h.T.step2,
                    onClick: s,
                    "aria-label": "continue button in import ledger flow",
                    children:
                      a === h.T.step2
                        ? "Looking for device..."
                        : (0, n.jsx)("span", { "aria-label": "continue button text in import ledger flow", children: "Continue" })
                  })
                ]
              });
            };
          s();
        } catch (e) {
          s(e);
        }
      });
    },
    98004: function (e, t, a) {
      a.a(e, async function (e, s) {
        try {
          a.d(t, { g: () => x });
          var n = a(52322),
            l = a(4370),
            i = a(14981),
            r = a(19269),
            d = a(91729),
            o = a(2784),
            c = a(53542),
            u = a(79263),
            m = a(77742),
            h = e([m, u, c]);
          [m, u, c] = h.then ? (await h)() : h;
          let x = () => {
            let [e, t] = (0, o.useState)(),
              [a, s] = (0, o.useState)(new Set()),
              { moveToNextStep: h, ledgerNetworks: x, setCurrentStep: f, currentStep: p, prevStep: g } = (0, c.Xp)();
            (0, o.useEffect)(() => {
              let e = m.p.find(e => x.has(e.id));
              e ? (s(t => t.add(e.id)), t(e.id)) : f(e => e - 1);
            }, []);
            let w = (0, o.useCallback)(
              e => {
                let n = m.p.find(t => t.id !== e && !a.has(t.id) && x.has(t.id));
                n ? (s(e => e.add(n.id)), t(n.id)) : (t(void 0), h());
              },
              [a, x, h]
            );
            if (x.size > 0 && e)
              return (0, n.jsx)(l.E.div, {
                className: "flex flex-col items-stretch w-full h-full gap-7",
                variants: d.S,
                initial: g <= p ? "fromRight" : "fromLeft",
                animate: "animate",
                exit: "exit",
                children: (0, n.jsx)(i.M, {
                  mode: "wait",
                  initial: !1,
                  presenceAffectsLayout: !0,
                  children: (0, n.jsx)(
                    u.n,
                    { title: `Open ${e === c.Yg.ETH ? "Ethereum" : "Cosmos"} app on your ledger`, Icon: r.z, appType: e, moveToNextApp: w },
                    `hold-state-${e}`
                  )
                })
              });
          };
          s();
        } catch (e) {
          s(e);
        }
      });
    },
    19737: function (e, t, a) {
      a.a(e, async function (e, s) {
        try {
          a.d(t, { _: () => h });
          var n = a(52322),
            l = a(91486),
            i = a(23762),
            r = a(39775),
            d = a(2784),
            o = a(80793),
            c = a(91729),
            u = a(53542),
            m = e([u, o, i]);
          [u, o, i] = m.then ? (await m)() : m;
          let h = () => {
            let { secret: e, setSecret: t, privateKeyError: a, setPrivateKeyError: s, importWalletFromSeedPhrase: m } = (0, u.Xp)(),
              [h, x] = (0, d.useState)(a ?? ""),
              { prevStep: f, currentStep: p } = (0, u.Xp)();
            return (
              (0, d.useEffect)(() => {
                (null == a ? void 0 : a.length) && x(a);
              }, [a]),
              (0, n.jsxs)(c.n, {
                headerIcon: (0, n.jsx)(r.u, { className: "size-6" }),
                heading: "Import with private key",
                subHeading: "Type or paste your private key here",
                entry: f <= p ? "right" : "left",
                className: "gap-10",
                children: [
                  (0, n.jsx)(i.p, {
                    value: e,
                    onChange: e => {
                      x(""), s && s(""), t(e);
                    },
                    error: h
                  }),
                  (0, n.jsx)(l.zx, {
                    "data-testing-id": "btn-import-wallet",
                    className: "mt-auto w-full",
                    disabled: !!h || !e,
                    onClick: () => {
                      (0, o.b)({ phrase: e, isPrivateKey: !0, setError: x, setSecret: t }) && m();
                    },
                    "aria-label": "import private key button in private key flow",
                    children: (0, n.jsx)("span", { "aria-label": "import private key button text in private key flow", children: "Import private key" })
                  })
                ]
              })
            );
          };
          s();
        } catch (e) {
          s(e);
        }
      });
    },
    6491: function (e, t, a) {
      a.a(e, async function (e, s) {
        try {
          a.d(t, { W: () => m });
          var n = a(52322),
            l = a(2810),
            i = a(91486),
            r = a(2784),
            d = a(80793),
            o = a(91729),
            c = a(53542),
            u = e([c, d]);
          [c, d] = u.then ? (await u)() : u;
          let m = () => {
            let {
                walletName: e,
                privateKeyError: t,
                setPrivateKeyError: a,
                secret: s,
                setSecret: u,
                importWalletFromSeedPhrase: m,
                prevStep: h,
                currentStep: x
              } = (0, c.Xp)(),
              [f, p] = (0, r.useState)(t ?? ""),
              [g, w] = (0, r.useState)(!1),
              v = "private-key" === e;
            (0, r.useEffect)(() => {
              (null == t ? void 0 : t.length) && p(t);
            }, [t]);
            let b = async () => {
              (0, d.b)({ phrase: s, isPrivateKey: v, setError: p, setSecret: u }) && (w(!0), await new Promise(e => setTimeout(e, 100)), await m(), w(!1));
            };
            return (0, n.jsxs)(o.n, {
              heading: "Enter recovery phrase",
              subHeading: "Type or paste your 12 or 24-word recovery phrase",
              entry: h <= x ? "right" : "left",
              children: [
                (0, n.jsxs)("div", {
                  className: "w-full space-y-6 flex-1",
                  children: [
                    (0, n.jsx)(l.W, {
                      onChangeHandler: e => {
                        p(""), a && a(""), u(e);
                      },
                      isError: !!f
                    }),
                    f &&
                      (0, n.jsx)("span", {
                        className: "text-xs font-medium text-destructive-100 block text-center",
                        "data-testing-id": "error-text-ele",
                        children: f
                      })
                  ]
                }),
                (0, n.jsx)(i.zx, {
                  "data-testing-id": "btn-import-wallet",
                  className: "mt-4 w-full",
                  disabled: !!f || !s || g,
                  onClick: b,
                  "aria-label": "continue button in seed phrase flow",
                  children: (0, n.jsx)("span", { "aria-label": "continue button text in seed phrase flow", children: "Continue" })
                })
              ]
            });
          };
          s();
        } catch (e) {
          s(e);
        }
      });
    },
    51409: function (e, t, a) {
      a.a(e, async function (e, s) {
        try {
          a.d(t, { x: () => g });
          var n = a(52322),
            l = a(91486),
            i = a(66070),
            r = a(30877),
            d = a(19269),
            o = a(98771),
            c = a(18445),
            u = a(91729);
          a(2784);
          var m = a(70514),
            h = a(53542),
            x = e([h]);
          h = (x.then ? (await x)() : x)[0];
          let f = e =>
              (0, n.jsxs)("button", {
                onClick: e.onClick,
                className: (0, m.cn)(
                  "bg-secondary-200 hover:bg-secondary-400 transition-colors w-full p-5 text-start rounded-xl font-bold text-md flex items-center gap-4",
                  l.YV,
                  e.className
                ),
                children: [(0, n.jsx)(e.icon, { className: "size-6 text-muted-foreground" }), (0, n.jsx)("span", { children: e.title })]
              }),
            p = [
              { id: "seed-phrase", title: "Import recovery phrase", icon: o.a },
              { id: "private-key", title: "Import private key", icon: r._ },
              { id: "ledger", title: "Connect via Ledger", icon: d.z },
              { id: "watch-wallet", title: "Watch address", icon: i.t }
            ],
            g = () => {
              let { prevStep: e, currentStep: t, setCurrentStep: a, setWalletName: s } = (0, h.Xp)();
              return (0, n.jsx)(u.n, {
                headerIcon: (0, n.jsx)(c.o, { className: "size-6" }),
                heading: "Use an existing wallet",
                subHeading: "Select how you'd like to access your existing wallet",
                className: "gap-10",
                entry: e <= t ? "right" : "left",
                children: (0, n.jsx)("div", {
                  className: "flex flex-col gap-4 w-full",
                  children: p.map(e =>
                    (0, n.jsx)(
                      f,
                      {
                        onClick: () => {
                          s(e.id), a(t + 1);
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
          s();
        } catch (e) {
          s(e);
        }
      });
    },
    77742: function (e, t, a) {
      a.a(e, async function (e, s) {
        try {
          a.d(t, { Z: () => f, p: () => x });
          var n = a(52322),
            l = a(91486),
            i = a(94562),
            r = a(74229),
            d = a(30464),
            o = a(91729),
            c = a(2784),
            u = a(49409),
            m = a(53542),
            h = e([m]);
          let x = [
              { id: (m = (h.then ? (await h)() : h)[0]).Yg.COSMOS, img: d.r.Logos.Cosmos, title: "COSMOS", subText: "OSMO, ATOM & 4 more" },
              { id: m.Yg.ETH, img: d.r.Logos.Ethereum, title: "EVM", subText: "ETH, AVAX, BASE & 5 more" }
            ],
            f = () => {
              let {
                ledgerNetworks: e,
                addresses: t,
                setLedgerNetworks: a,
                moveToNextStep: s,
                setWalletAccounts: i,
                prevStep: r,
                currentStep: d,
                setAddresses: u
              } = (0, m.Xp)();
              return (
                (0, c.useEffect)(() => {
                  i(void 0), t && Object.keys(t).length > 0 && u({});
                }, []),
                (0, n.jsxs)(o.n, {
                  heading: "Select networks",
                  subHeading: "Select networks you want to connect with",
                  entry: r <= d ? "right" : "left",
                  children: [
                    (0, n.jsx)("div", {
                      className: "flex flex-col rounded-xl overflow-hidden py-1",
                      children: x.map(t =>
                        (0, n.jsx)(
                          p,
                          {
                            ...t,
                            checked: e.has(t.id),
                            onCheckedChange: e => {
                              a(a => {
                                let s = new Set(a);
                                return e ? s.add(t.id) : s.delete(t.id), s;
                              });
                            }
                          },
                          t.id
                        )
                      )
                    }),
                    (0, n.jsx)(l.zx, {
                      disabled: 0 === e.size,
                      className: "w-full mt-auto",
                      onClick: s,
                      "aria-label": "proceed button in select ledger network flow",
                      children: (0, n.jsx)("span", { "aria-label": "proceed button text in select ledger network flow", children: "Proceed" })
                    })
                  ]
                })
              );
            },
            p = e => {
              let t = (0, r.a1)();
              return (0, n.jsxs)("label", {
                className:
                  "flex flex-row gap-[14px] items-center p-5 border-b border-secondary-600/25 last:border-b-0 bg-secondary-200 hover:bg-secondary-300/75 transition-colors cursor-pointer text-start",
                children: [
                  (0, n.jsx)("img", { src: e.img || t, alt: e.title, onError: (0, u._)(t), className: "size-10 rounded-full" }),
                  (0, n.jsxs)("div", {
                    className: "flex flex-col",
                    children: [
                      (0, n.jsx)("h3", { className: "text-md font-bold", children: e.title }),
                      (0, n.jsx)("p", { className: "text-sm font-medium text-muted-foreground", children: e.subText })
                    ]
                  }),
                  (0, n.jsx)(i.X, { className: "ml-auto", checked: e.checked, onCheckedChange: e.onCheckedChange })
                ]
              });
            };
          s();
        } catch (e) {
          s(e);
        }
      });
    },
    66144: function (e, t, a) {
      a.a(e, async function (e, s) {
        try {
          a.d(t, { q: () => x });
          var n = a(52322),
            l = a(44658),
            i = a(55159),
            r = a(91486),
            d = a(77807),
            o = a(91729),
            c = a(2784),
            u = a(70514),
            m = a(53542),
            h = e([m, d]);
          [m, d] = h.then ? (await h)() : h;
          let x = () => {
            let { prevStep: e, currentStep: t, selectedIds: a, setSelectedIds: s, moveToNextStep: h, addresses: x, ledgerNetworks: f } = (0, m.Xp)(),
              [p, g] = (0, c.useState)([]);
            (0, c.useEffect)(() => {
              (async () => {
                let e = await i.Kn.getAllWallets(),
                  t = [];
                for (let n of Object.values(e ?? {})) {
                  var a, s;
                  let e = null == n ? void 0 : null === (a = n.addresses) || void 0 === a ? void 0 : a.cosmos;
                  e && t.push(e);
                  let i = null == n ? void 0 : null === (s = n.pubKeys) || void 0 === s ? void 0 : s.ethereum,
                    r = (i && l.SZ.getEvmAddress(i, !0)) || void 0;
                  r && t.push(r);
                }
                g(t);
              })();
            }, []);
            let w = (0, c.useCallback)(
                (e, t) => {
                  s(a => ({ ...(a ?? {}), [e]: t }));
                },
                [s]
              ),
              v = (0, c.useMemo)(() => {
                let e = f.has(m.Yg.COSMOS),
                  t = f.has(m.Yg.ETH);
                return Object.entries(a ?? {}).some(a => {
                  var s, n, i, r;
                  let [d, o] = a;
                  if (!o) return !1;
                  let c = null == x ? void 0 : null === (n = x[d]) || void 0 === n ? void 0 : null === (s = n.cosmos) || void 0 === s ? void 0 : s.address,
                    u = null == x ? void 0 : null === (r = x[d]) || void 0 === r ? void 0 : null === (i = r.ethereum) || void 0 === i ? void 0 : i.pubKey,
                    m = u ? l.SZ.getEvmAddress(u, !0) : void 0,
                    h = !!c && p.includes(c),
                    f = !!m && p.includes(m);
                  return e && t ? !h && !f : (!!e && !h) || (!!t && !f);
                });
              }, [f, a, x, p]),
              b = (0, c.useMemo)(
                () =>
                  2 === f.size &&
                  Object.entries(a ?? {}).some(e => {
                    var t, a, s, n;
                    let [i, r] = e;
                    if (!r) return !1;
                    let d = null == x ? void 0 : null === (a = x[i]) || void 0 === a ? void 0 : null === (t = a.cosmos) || void 0 === t ? void 0 : t.address,
                      o = null == x ? void 0 : null === (n = x[i]) || void 0 === n ? void 0 : null === (s = n.ethereum) || void 0 === s ? void 0 : s.pubKey,
                      c = o ? l.SZ.getEvmAddress(o, !0) : void 0,
                      u = !!d && p.includes(d),
                      m = !!c && p.includes(c);
                    return (!u && !!m) || (!!u && !m);
                  }),
                [f.size, a, x, p]
              );
            return (0, n.jsxs)(o.n, {
              heading: "Your wallets",
              subHeading: "Select the ones you want to import",
              entry: e <= t ? "right" : "left",
              children: [
                (0, n.jsx)("div", {
                  className: "gradient-overlay",
                  children: (0, n.jsx)("div", {
                    className: (0, u.cn)("flex flex-col w-full py-1 overflow-y-auto", b ? "max-h-[299px]" : "max-h-[330px]"),
                    children: (0, n.jsx)("div", {
                      className: "flex flex-col gap-4 pb-28",
                      children: Object.entries(x ?? {}).map((e, t) => {
                        var s, i;
                        let r,
                          o,
                          [c, u] = e,
                          h = !1;
                        f.has(m.Yg.COSMOS) &&
                          (r = null == u ? void 0 : null === (s = u.cosmos) || void 0 === s ? void 0 : s.address) &&
                          (h = p.indexOf(r) > -1);
                        let x = !1;
                        if (f.has(m.Yg.ETH)) {
                          let e = null == u ? void 0 : null === (i = u.ethereum) || void 0 === i ? void 0 : i.pubKey;
                          (o = l.SZ.getEvmAddress(e, !0) || void 0) && (x = p.indexOf(o) > -1);
                        }
                        let g = a[c];
                        return (0, n.jsx)(
                          d.ZP,
                          {
                            index: t,
                            path: c,
                            "data-testing-id": `wallet-${t + 1}`,
                            walletName: `Wallet ${t + 1}`,
                            cosmosAddress: r,
                            evmAddress: o,
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
                (0, n.jsxs)("div", {
                  className: "flex flex-col items-center mt-auto w-full",
                  children: [
                    (0, n.jsx)(r.zx, {
                      className: "w-full",
                      disabled: !v,
                      "data-testing-id": "btn-select-wallet-proceed",
                      onClick: h,
                      "aria-label": "add selected wallets button in select ledger wallet flow",
                      children: (0, n.jsx)("span", {
                        "aria-label": "add selected wallets button text in select ledger wallet flow",
                        children: "Add selected wallets"
                      })
                    }),
                    b &&
                      (0, n.jsx)("div", {
                        className: "mt-3 text-muted-foreground text-xs !leading-[19px] text-center",
                        children: "All addresses for the EVM & Cosmos network will be imported."
                      })
                  ]
                })
              ]
            });
          };
          s();
        } catch (e) {
          s(e);
        }
      });
    },
    69543: function (e, t, a) {
      a.a(e, async function (e, s) {
        try {
          a.d(t, { R: () => m });
          var n = a(52322),
            l = a(55159),
            i = a(91486),
            r = a(77807),
            d = a(91729),
            o = a(2784),
            c = a(53542),
            u = e([c, r]);
          [c, r] = u.then ? (await u)() : u;
          let m = () => {
            let { selectedIds: e, setSelectedIds: t, moveToNextStep: a, walletAccounts: s = [], prevStep: u, currentStep: m } = (0, c.Xp)(),
              [h, x] = (0, o.useState)(!1),
              [f, p] = (0, o.useState)([]);
            (0, o.useEffect)(() => {
              (async () => {
                let e = await l.Kn.getAllWallets(),
                  t = [];
                for (let a of Object.values(e ?? {})) {
                  let e = a.addresses.cosmos;
                  (null != a && a.watchWallet) || t.push(e);
                }
                p(t);
              })();
            }, []);
            let g = (0, o.useMemo)(() => Object.values(e).filter(e => e).length, [e]),
              w = (0, o.useCallback)(
                (a, s) => {
                  t({ ...e, [a]: s });
                },
                [e, t]
              ),
              v = (0, o.useMemo)(
                () =>
                  s.filter(e => {
                    let { address: t } = e;
                    return !(t && f.indexOf(t) > -1);
                  }),
                [s, f]
              );
            return (0, n.jsxs)(d.n, {
              heading: "Your wallets",
              subHeading: "Select the ones you want to import",
              entry: u <= m ? "right" : "left",
              className: "gap-0",
              children: [
                (0, n.jsx)("div", {
                  className: "gradient-overlay mt-7 flex-1",
                  children: (0, n.jsxs)("div", {
                    className: "flex flex-col gap-3 h-[21rem] pb-28 overflow-auto",
                    children: [
                      (0, n.jsx)(r.JP, {
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
                      s.map(t => {
                        let { address: a, index: s, evmAddress: l, bitcoinAddress: i, moveAddress: d, solanaAddress: o, suiAddress: c } = t,
                          u = !!a && f.indexOf(a) > -1,
                          m = e[s];
                        return (0, n.jsx)(
                          r.ZP,
                          {
                            index: s,
                            walletName: `Wallet ${s + 1}`,
                            "data-testing-id": `wallet-${s + 1}`,
                            cosmosAddress: a,
                            evmAddress: l,
                            bitcoinAddress: i,
                            moveAddress: d,
                            solanaAddress: o,
                            suiAddress: c,
                            isChosen: m,
                            isExistingAddress: u,
                            onSelectChange: w
                          },
                          s
                        );
                      })
                    ]
                  })
                }),
                (0, n.jsx)(i.zx, {
                  "data-testing-id": "btn-select-wallet-proceed",
                  className: "w-full",
                  disabled: h || 0 === Object.values(e).filter(e => e).length,
                  onClick: () => {
                    x(!0), a();
                  },
                  "aria-label": "proceed button in select wallet flow",
                  children: (0, n.jsx)("span", { "aria-label": "proceed button text in select wallet flow", children: "Proceed" })
                })
              ]
            });
          };
          s();
        } catch (e) {
          s(e);
        }
      });
    },
    18818: function (e, t, a) {
      a.a(e, async function (e, s) {
        try {
          a.d(t, { x: () => v });
          var n = a(52322),
            l = a(15969),
            i = a(91486),
            r = a(28144),
            d = a(4848),
            o = a(35226),
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
                  setWatchWalletAddress: s,
                  watchWalletName: g,
                  setWatchWalletName: v,
                  moveToNextStep: b
                } = (0, p.Xp)(),
                [y, j] = (0, x.useState)("");
              return (0, n.jsxs)(h.n, {
                headerIcon: (0, n.jsx)(m.t, { className: "size-6" }),
                heading: "Watch wallet",
                subHeading: "Add a wallet address you'd like to watch.",
                entry: e <= t ? "right" : "left",
                className: "gap-10",
                children: [
                  (0, n.jsxs)("div", {
                    className: "flex flex-col gap-4",
                    children: [
                      (0, n.jsxs)("div", {
                        className: "flex flex-col",
                        children: [
                          (0, n.jsx)(d.F, {
                            autoFocus: !0,
                            onChange: e => {
                              j(""), s(e);
                            },
                            value: a,
                            error: y,
                            placeholder: "Public address",
                            "data-testing-id": "enter-watch-address"
                          }),
                          (0, n.jsx)(c.M, {
                            children:
                              y &&
                              (0, n.jsx)(u.E.span, {
                                className: "text-xs font-medium text-destructive-100 block text-center",
                                "data-testing-id": "error-text-ele",
                                transition: f._M,
                                variants: w,
                                initial: "hidden",
                                animate: "visible",
                                exit: "hidden",
                                children: (0, n.jsx)("span", { className: "mt-2 block", children: y })
                              })
                          })
                        ]
                      }),
                      (0, n.jsx)(r.I, {
                        placeholder: "Name your wallet (optional)",
                        maxLength: 24,
                        value: null == g ? void 0 : g.replace(o.li, ""),
                        onChange: e => v(e.target.value),
                        trailingElement:
                          (null == g ? void 0 : g.length) > 0
                            ? (0, n.jsx)("span", { className: "text-muted-foreground text-sm font-medium", children: `${null == g ? void 0 : g.length}/24` })
                            : null
                      })
                    ]
                  }),
                  (0, n.jsx)(i.zx, {
                    "data-testing-id": "btn-import-wallet",
                    className: "mt-auto w-full",
                    disabled: !!y || !a || !g,
                    onClick: () => {
                      if (!a) {
                        j("");
                        return;
                      }
                      if (!(0, l.q3z)(a)) {
                        j("Invalid public address, please enter a valid address");
                        return;
                      }
                      j(""), b();
                    },
                    "aria-label": "start watching button in watch wallet flow",
                    children: (0, n.jsx)("span", { "aria-label": "start watching button text in watch wallet flow", children: "Start watching" })
                  })
                ]
              });
            };
          s();
        } catch (e) {
          s(e);
        }
      });
    }
  }
]);
//# sourceMappingURL=6564.js.map
