!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "7ce6dd77-b835-4402-99d2-454e165cff62"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-7ce6dd77-b835-4402-99d2-454e165cff62"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.22.9" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["9642"],
  {
    28529: function (e, t, n) {
      n.a(e, async function (e, o) {
        try {
          n.r(t), n.d(t, { default: () => E });
          var a = n(52322),
            l = n(55159),
            s = n(91486),
            i = n(28144),
            r = n(20541),
            d = n(14981),
            c = n(4370),
            u = n(76131),
            g = n(41978),
            f = n(75958),
            p = n(2784),
            h = n(10289),
            w = n(22014),
            m = n(55736),
            x = n(70514),
            b = n(48534),
            v = n(46338),
            y = n(72565),
            j = n.n(y),
            k = n(53108),
            S = e([r, u]);
          [r, u] = S.then ? (await S)() : S;
          let N = { hidden: { opacity: 0, height: 0 }, visible: { opacity: 1, height: "2.25rem" } };
          function I(e) {
            return e.loading
              ? null
              : (0, a.jsxs)("div", {
                  className: "flex flex-col h-full z-50",
                  children: [
                    (0, a.jsx)("div", {
                      className: (0, x.cn)(
                        "border-b border-border-bottom/50 text-mdl py-[1.125rem] text-center font-bold",
                        e.exitAnimationState && "opacity-0 pointer-events-none"
                      ),
                      children: "Leap Wallet"
                    }),
                    (0, a.jsxs)("div", {
                      className: "flex flex-col flex-1 gap-5 p-6 justify-center items-center w-full relative",
                      children: [
                        (0, a.jsx)(g.P, {
                          className: (0, x.cn)(
                            "size-28 transition-all duration-500 scale-100 translate-y-0 opacity-100",
                            "scale" === e.exitAnimationState && "scale-150 translate-y-16",
                            "scale-fade" === e.exitAnimationState && "scale-[4] translate-y-16 opacity-0"
                          )
                        }),
                        (0, a.jsxs)("div", {
                          className: (0, x.cn)(
                            "flex items-center justify-center flex-col gap-5 w-full transition-opacity duration-300",
                            e.exitAnimationState ? "opacity-0 pointer-events-none" : "opacity-100"
                          ),
                          children: [
                            (0, a.jsx)("span", { className: "text-xl font-bold mt-3", children: "Enter your password" }),
                            (0, a.jsxs)("div", {
                              className: "w-full",
                              children: [
                                (0, a.jsx)(i.I, {
                                  autoFocus: !0,
                                  className: "w-full",
                                  type: "password",
                                  placeholder: "Password",
                                  status: e.errorHighlighted ? "error" : void 0,
                                  value: e.passwordInput,
                                  onChange: t => e.onChange(t),
                                  onKeyDown: t => {
                                    "Enter" === t.key && e.onSignIn();
                                  },
                                  "data-testing-id": "login-input-enter-password"
                                }),
                                (0, a.jsx)(d.M, {
                                  children:
                                    e.errorHighlighted &&
                                    (0, a.jsx)(c.E.span, {
                                      "data-testing-id": "login-error-text",
                                      className: "text-destructive-100 text-center text-sm h-9 flex items-center",
                                      transition: v._M,
                                      variants: N,
                                      initial: "hidden",
                                      animate: "visible",
                                      exit: "hidden",
                                      children: (0, a.jsx)("span", {
                                        className: "mt-auto text-center w-full",
                                        children: "Incorrect password. Please try again"
                                      })
                                    })
                                })
                              ]
                            }),
                            (0, a.jsx)("button", {
                              type: "button",
                              className: "text-secondary-800 text-sm hover:text-foreground transition-colors",
                              onClick: e.onForgotPassword,
                              "aria-label": "forgot password button in login flow",
                              children: (0, a.jsx)("span", { "aria-label": "forgot password button text in login flow", children: "Forgot Password?" })
                            })
                          ]
                        })
                      ]
                    }),
                    (0, a.jsx)(
                      "div",
                      {
                        className: (0, x.cn)(
                          "border-t border-border-bottom/50 text-mdl p-4 text-center font-bold mt-auto transition-opacity duration-300",
                          e.exitAnimationState ? "opacity-0 pointer-events-none" : "opacity-100"
                        ),
                        children: (0, a.jsx)(s.zx, {
                          size: "md",
                          className: "w-full",
                          onClick: e.onSignIn,
                          "data-testing-id": "btn-unlock-wallet",
                          "aria-label": "unlock wallet button in login flow",
                          children: (0, a.jsx)("span", { "aria-label": "unlock wallet button text in login flow", children: "Unlock wallet" })
                        })
                      },
                      "unlock-wallet"
                    )
                  ]
                });
          }
          let E = (0, f.Pi)(function (e) {
            var t, n, o, s;
            let { location: i } = e,
              [d, c] = (0, p.useState)(""),
              [g, f] = (0, p.useState)(null),
              x = (0, p.useRef)(!1),
              v = (0, p.useRef)(!1),
              y = (0, r.aC)(),
              S =
                null === (s = i.state) || void 0 === s
                  ? void 0
                  : null === (o = s.from) || void 0 === o
                    ? void 0
                    : null === (n = o.search) || void 0 === n
                      ? void 0
                      : null === (t = n.includes) || void 0 === t
                        ? void 0
                        : t.call(n, "unlock-to-approve"),
              [N, E] = (0, p.useState)(!1),
              [_, P] = (0, p.useState)(!1),
              A = (0, h.s0)(),
              L = (0, p.useCallback)(function (e) {
                let t = arguments.length > 1 && void 0 !== arguments[1] && arguments[1];
                if (e && !v.current) {
                  if (((v.current = !0), !t)) {
                    A(e, { state: { from: "/login" }, replace: !0 }), (v.current = !1);
                    return;
                  }
                  f("scale"),
                    setTimeout(() => {
                      f("scale-fade"),
                        setTimeout(() => {
                          A(e, { state: { from: "/login" }, replace: !0 });
                        }, 100);
                    }, 850);
                }
              }, []);
            (0, p.useEffect)(() => {
              j()
                .storage.local.get([k.pV, l.rU])
                .then(e => {
                  if (e[k.pV] || e[l.rU]) {
                    x.current = !0;
                    return;
                  }
                  let t = j().extension.getViews({ type: "tab" }),
                    n = j().extension.getViews({ type: "popup" });
                  -1 !== n.findIndex(e => e === window) || b.sN
                    ? (j().tabs.create({ url: j().runtime.getURL("index.html#/onboarding") }), (0, m.I)())
                    : (t.filter(e => e !== window).forEach(e => e.close()), L("/onboarding"));
                });
            }, []),
              (0, p.useEffect)(() => {
                let e = async () => {
                  new URLSearchParams(i.search).has("close-on-login") || S
                    ? j().runtime.sendMessage({ type: "user-logged-in", payload: { status: "failed" } })
                    : await j().storage.local.set({ [k.u1]: { error: "Request rejected" } }),
                    setTimeout(() => {
                      j().storage.local.remove(k.u1);
                    }, 50);
                };
                return (
                  j()
                    .storage.local.get(k.AI)
                    .then(async e => {
                      e[k.AI] && (await j().storage.local.remove(k.u1));
                    }),
                  window.addEventListener("beforeunload", e),
                  () => {
                    window.removeEventListener("beforeunload", e);
                  }
                );
              }, []);
            let C = (0, p.useCallback)(async () => {
                if (d) {
                  P(!0);
                  try {
                    let e = new TextEncoder();
                    await y.signin(e.encode(d), () => {
                      var e;
                      if ((w.RW.setLastActiveTime(), new URLSearchParams(i.search).has("close-on-login"))) {
                        j().runtime.sendMessage({ type: "user-logged-in", payload: { status: "success" } }), b.sN && L("/home"), window.close();
                        return;
                      }
                      let t = null === (e = i.state) || void 0 === e ? void 0 : e.from,
                        n = (null == t ? void 0 : t.pathname)
                          ? `${null == t ? void 0 : t.pathname}${(null == t ? void 0 : t.search) ? `${null == t ? void 0 : t.search}` : ""}`
                          : void 0,
                        o = "/home",
                        a = o;
                      ((null == n ? void 0 : n.includes("onboarding")) && y && (null == y || !y.noAccount)) || (a = ("/" === n ? o : n) || o), L(a, !0), P(!1);
                    });
                  } catch (e) {
                    E(!0), P(!1);
                  }
                }
              }, [y, i, d, L]),
              R = (0, p.useCallback)(() => {
                let e = j().extension.getViews({ type: "popup" });
                0 !== e.length || b.sN ? (window.open(j().runtime.getURL("index.html#/forgotPassword")), (0, m.I)()) : L("/forgotPassword");
              }, [L]);
            return (
              (0, p.useEffect)(() => {
                (null == y ? void 0 : y.locked) !== "unlocked" || d || S || new URLSearchParams(i.search).has("close-on-login") || L("/home");
              }, [y, S, i.search, d, L]),
              (0, u.$)({
                page: "login",
                queryStatus: (null == y ? void 0 : y.loading) ? "loading" : "success",
                op: "loginPageLoad",
                description: "loading state on login page"
              }),
              (0, a.jsx)(a.Fragment, {
                children: (0, a.jsx)(I, {
                  unlockLoader: _,
                  loading: y.loading || !!(null == y ? void 0 : y.noAccount),
                  errorHighlighted: N,
                  exitAnimationState: g,
                  passwordInput: d,
                  onChange: e => {
                    E(!1), c(e.target.value);
                  },
                  onSignIn: C,
                  onForgotPassword: R
                })
              })
            );
          });
          o();
        } catch (e) {
          o(e);
        }
      });
    }
  }
]);
//# sourceMappingURL=9642.js.map
