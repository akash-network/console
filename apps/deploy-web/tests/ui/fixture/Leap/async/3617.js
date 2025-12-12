!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "13185e90-f3b3-461f-8fac-4cef1a67aec1"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-13185e90-f3b3-461f-8fac-4cef1a67aec1"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.23.1" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["3617"],
  {
    64690: function (e, t, s) {
      s.d(t, { Z: () => _ });
      var a = s(52322),
        r = s(92642),
        n = s(91486),
        i = s(94562),
        l = s(28144),
        o = s(29195),
        c = s(14981),
        d = s(4370),
        u = s(2784);
      let h = e =>
        (0, a.jsxs)("svg", {
          width: "24",
          height: "24",
          viewBox: "0 0 24 24",
          fill: "none",
          xmlns: "http://www.w3.org/2000/svg",
          ...e,
          children: [
            (0, a.jsx)("g", {
              clipPath: "url(#clip0_4108_4137)",
              children: (0, a.jsx)("path", {
                fillRule: "evenodd",
                clipRule: "evenodd",
                d: "M0 1C0 0.447715 0.447715 0 1 0H23C23.5523 0 24 0.447715 24 1V10.6822C22.9251 9.06551 21.087 8 19 8C16.3876 8 14.1651 9.66962 13.3414 12H1C0.447715 12 0 11.5523 0 11V1ZM6 8C7.10457 8 8 7.10457 8 6C8 4.89543 7.10457 4 6 4C4.89543 4 4 4.89543 4 6C4 7.10457 4.89543 8 6 8ZM14 6C14 7.10457 13.1046 8 12 8C10.8954 8 10 7.10457 10 6C10 4.89543 10.8954 4 12 4C13.1046 4 14 4.89543 14 6ZM18 8C19.1046 8 20 7.10457 20 6C20 4.89543 19.1046 4 18 4C16.8954 4 16 4.89543 16 6C16 7.10457 16.8954 8 18 8ZM19 12C17.8523 12 17 12.8523 17 14V16H21V14C21 12.8523 20.1477 12 19 12ZM24 17C24 16.4 23.6 16 23 16V14C23 11.7477 21.2523 10 19 10C16.7477 10 15 11.7477 15 14V16C14.4 16 14 16.4 14 17V23C14 23.6 14.4 24 15 24H23C23.6 24 24 23.6 24 23V17Z",
                fill: "currentColor"
              })
            }),
            (0, a.jsx)("defs", {
              children: (0, a.jsx)("clipPath", { id: "clip0_4108_4137", children: (0, a.jsx)("rect", { width: "24", height: "24", fill: "white" }) })
            })
          ]
        });
      var f = s(91729),
        x = s(46338),
        p = s(64366),
        m = s(27783),
        g = s(28058),
        w = s(51343);
      let v = {
        dictionary: { ...m.Z.dictionary, ...w.Z.dictionary, ...g.Z.dictionary },
        graphs: m.Z.adjacencyGraphs,
        useLevenshteinDistance: !0,
        translations: w.Z.translations
      };
      p.Mu.setOptions(v);
      let j = e => (0, p.tu)(e).score;
      var y = s(10588);
      let b = { duration: 0.2 },
        C = { hidden: { opacity: 0, transition: b }, animate: { opacity: 1, transition: b } },
        N = e => {
          let { score: t } = e;
          return (0, a.jsx)(c.M, {
            children: (0, a.jsxs)(d.E.div, {
              className: "flex justify-center items-center font-bold text-sm",
              variants: C,
              initial: "hidden",
              animate: "animate",
              exit: "hidden",
              children: [
                4 === t &&
                  (0, a.jsx)(
                    d.E.span,
                    { className: "text-accent-success", variants: C, initial: "hidden", animate: "animate", exit: "hidden", children: "Strong" },
                    t
                  ),
                3 === t &&
                  (0, a.jsx)(
                    d.E.span,
                    { className: "text-accent-warning", variants: C, initial: "hidden", animate: "animate", exit: "hidden", children: "Medium" },
                    t
                  ),
                null !== t &&
                  t < 3 &&
                  (0, a.jsx)(
                    d.E.span,
                    { className: "text-destructive-100", variants: C, initial: "hidden", animate: "animate", exit: "hidden", children: "Weak" },
                    t < 3 ? "weak" : null
                  )
              ]
            })
          });
        },
        S = { hidden: { height: 0 }, visible: { height: "2rem" } };
      function _(e) {
        let { onProceed: t, entry: s } = e,
          [p, m] = (0, u.useState)(!1),
          [g, w] = (0, u.useState)(null),
          [v, b] = (0, u.useState)(!0),
          [C, _] = (0, u.useState)(""),
          [k, M] = (0, u.useState)({ pass1: "", pass2: "" }),
          [Z, E] = (0, u.useState)({ pass1: "", pass2: "" }),
          P = (0, u.useCallback)(
            () => (E({ pass1: "", pass2: "" }), !(k.pass1.length < 8) || (E(e => ({ ...e, pass1: "Password must be at least 8 characters" })), !1)),
            [k.pass1.length]
          ),
          L = (0, u.useCallback)(
            () => (k.pass1 != k.pass2 ? (E(e => ({ ...e, pass2: "Passwords do not match" })), !1) : !Z.pass1 && !Z.pass2 && !!P()),
            [Z.pass1, Z.pass2, k.pass1, k.pass2, P]
          ),
          z = async e => {
            e ? w(j(e)) : w(null);
          },
          H = () => {
            try {
              m(!0);
              let e = new TextEncoder().encode(k.pass1);
              t(e);
            } catch (e) {
              (0, r.Tb)(e, {
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
                _(null == e ? void 0 : e.message);
            } finally {
              m(!1);
            }
          },
          T = e => {
            let { name: t, value: s } = e.target;
            C && _(""), Z[t] && (delete Z[t], E(Z)), M({ ...k, [t]: s });
          },
          D = e => {
            if ("enter" === e.key.toLowerCase()) {
              let t = e.target;
              "pass2" === t.name && L() && H();
              let s = t.form,
                a = [...s].indexOf(t);
              s.elements[a + 1].focus(), e.preventDefault();
            }
          },
          I = !!Z.pass1 || !!Z.pass2 || !k.pass1 || !k.pass2;
        return ((0, u.useEffect)(() => {
          let e = setTimeout(() => {
            z(k.pass1);
          }, 500);
          return () => {
            clearTimeout(e);
          };
        }, [k.pass1]),
        p)
          ? (0, a.jsx)(y.T_, {})
          : (0, a.jsx)("form", {
              onSubmit: e => {
                e.preventDefault(), L() && H();
              },
              className: "flex flex-col h-full",
              children: (0, a.jsxs)(f.n, {
                headerIcon: (0, a.jsx)(h, { className: "size-6" }),
                entry: s,
                heading: "Create your password",
                subHeading: "Choose a password to secure & lock your wallet",
                className: "gap-0",
                children: [
                  (0, a.jsxs)("div", {
                    className: "flex flex-col gap-y-5 w-full mt-10",
                    children: [
                      (0, a.jsxs)("div", {
                        className: "relative flex flex-col w-full",
                        children: [
                          (0, a.jsx)(l.I, {
                            autoFocus: !0,
                            placeholder: "Enter password",
                            type: "password",
                            name: "pass1",
                            onKeyDown: D,
                            onBlur: P,
                            status: Z.pass1 || Z.pass2 ? "error" : void 0,
                            value: k.pass1,
                            onChange: T,
                            "data-testing-id": "input-password",
                            className: "h-[3.625rem]",
                            trailingElement: (0, a.jsx)(N, { score: g })
                          }),
                          (0, a.jsx)(c.M, {
                            children:
                              Z.pass1 &&
                              (0, a.jsx)(d.E.span, {
                                className: "flex items-end justify-center text-destructive-100 text-xs text-center font-medium overflow-hidden",
                                variants: S,
                                initial: "hidden",
                                animate: "visible",
                                exit: "hidden",
                                children: Z.pass1
                              })
                          })
                        ]
                      }),
                      (0, a.jsxs)("div", {
                        className: "relative flex flex-col gap-y-5 w-full",
                        children: [
                          (0, a.jsx)(o.W, {
                            name: "pass2",
                            value: k.pass2,
                            placeholder: "Confirm password",
                            onKeyDown: D,
                            className: "h-[3.625rem]",
                            onChange: T,
                            status: Z.pass2 ? "error" : void 0,
                            "data-testing-id": "input-confirm-password"
                          }),
                          (0, a.jsx)(c.M, {
                            children:
                              (Z.pass2 || C) &&
                              (0, a.jsx)(d.E.span, {
                                className: "text-destructive-100 text-xs text-center font-medium",
                                "data-testing-id": "password-error-ele",
                                variants: x.HJ,
                                initial: "hidden",
                                animate: "visible",
                                exit: "hidden",
                                children: Z.pass2 || C
                              })
                          })
                        ]
                      })
                    ]
                  }),
                  (0, a.jsxs)("label", {
                    htmlFor: "terms",
                    className: "flex flex-row justify-center items-center mt-auto",
                    children: [
                      (0, a.jsx)(i.X, {
                        id: "terms",
                        name: "terms",
                        value: "terms",
                        className: "cursor-pointer mr-2 h-4 w-4 accent-accent-foreground",
                        checked: v,
                        onCheckedChange: e => {
                          b(!!e);
                        }
                      }),
                      (0, a.jsxs)("p", {
                        className: "text-xs text-muted-foreground text-center",
                        children: [
                          "I agree to the",
                          " ",
                          (0, a.jsx)("a", {
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
                  (0, a.jsx)(n.zx, { className: "w-full mt-5", "data-testing-id": "btn-password-proceed", disabled: I || p || !v, children: "Set Password" })
                ]
              })
            });
      }
    },
    94562: function (e, t, s) {
      s.d(t, { X: () => o });
      var a = s(52322),
        r = s(62695),
        n = s(15256),
        i = s(2784),
        l = s(70514);
      let o = i.forwardRef((e, t) => {
        let { className: s, ...i } = e;
        return (0, a.jsx)(n.fC, {
          ref: t,
          className: (0, l.cn)(
            "peer h-4 w-4 shrink-0 rounded-sm data-[state=checked]:border border-accent-green shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:!bg-accent-green data-[state=checked]:text-accent-green !bg-secondary-300",
            s
          ),
          ...i,
          children: (0, a.jsx)(n.z$, {
            className: "flex items-center justify-center text-current",
            children: (0, a.jsx)(r.J, { className: "h-4 w-4 text-secondary-300" })
          })
        });
      });
      o.displayName = n.fC.displayName;
    },
    19003: function (e, t, s) {
      s.d(t, { Z: () => i });
      var a = s(52322),
        r = s(2784),
        n = s(70514);
      let i = e => {
        let { currentStep: t, totalSteps: s, className: i, moveToStep: l } = e,
          o = (0, r.useMemo)(() => Array.from({ length: s }, (e, t) => t + 1), [s]);
        return (0, a.jsx)("div", {
          className: (0, n.cn)("flex flex-row items-center justify-center align-center gap-3", i),
          children: o.map(e =>
            (0, a.jsx)(
              "div",
              {
                onClick: () => (null == l ? void 0 : l(e)),
                className: (0, n.cn)("h-1 w-[1.125rem] rounded-full transition-colors duration-500", e === t ? "bg-accent-green" : "bg-secondary-300")
              },
              e
            )
          )
        });
      };
    },
    39775: function (e, t, s) {
      s.d(t, { u: () => r });
      var a = s(52322);
      s(2784);
      let r = e =>
        (0, a.jsxs)("svg", {
          width: "24",
          height: "24",
          viewBox: "0 0 24 24",
          fill: "none",
          xmlns: "http://www.w3.org/2000/svg",
          ...e,
          children: [
            (0, a.jsx)("g", {
              clipPath: "url(#clip0_4108_4122)",
              children: (0, a.jsx)("path", {
                fillRule: "evenodd",
                clipRule: "evenodd",
                d: "M20.818 4.55021L23.0982 2.27L20.9769 0.148682L9.4296 11.696C8.54928 11.2507 7.55393 10.9999 6.5 10.9999C2.91015 10.9999 0 13.91 0 17.4999C0 21.0898 2.91015 23.9999 6.5 23.9999C10.0899 23.9999 13 21.0898 13 17.4999C13 16.054 12.5279 14.7184 11.7294 13.6388L15.161 10.2072L16.9283 11.9746L19.0496 9.85326L17.2823 8.08593L18.6967 6.67153L21.8784 9.85324L23.9997 7.73192L20.818 4.55021ZM3 17.4999C3 15.5669 4.567 13.9999 6.5 13.9999C8.433 13.9999 10 15.5669 10 17.4999C10 19.4329 8.433 20.9999 6.5 20.9999C4.567 20.9999 3 19.4329 3 17.4999Z",
                fill: "currentColor"
              })
            }),
            (0, a.jsx)("defs", {
              children: (0, a.jsx)("clipPath", { id: "clip0_4108_4122", children: (0, a.jsx)("rect", { width: "24", height: "24", fill: "white" }) })
            })
          ]
        });
    },
    65339: function (e, t, s) {
      s.a(e, async function (e, a) {
        try {
          s.d(t, { H: () => m, Z: () => g });
          var r = s(52322),
            n = s(15969),
            i = s(51416),
            l = s(47013),
            o = s(2784),
            c = s(10289),
            d = s(22014),
            u = s(72565),
            h = s.n(u),
            f = s(48834).Buffer,
            x = e([i]);
          i = (x.then ? (await x)() : x)[0];
          let p = o.createContext(null),
            m = e => {
              let { children: t } = e,
                { mnemonic: s, onOnboardingComplete: a } = (0, i.k)(),
                [u, x] = (0, o.useState)(1),
                [m, g] = (0, o.useState)(!1),
                w = (0, l.D)(u) || 1,
                v = (0, c.s0)(),
                j = async e => {
                  g(!0), await a(s, e, { 0: !0 }, "create");
                  let t = f.from(e).toString("base64");
                  h().runtime.sendMessage({ type: "unlock", data: { password: t } }),
                    d.M8.setPassword(e),
                    await (0, n._vH)(2e3),
                    v("/onboardingSuccess"),
                    g(!1);
                },
                y = e => {
                  if (3 === e && d.M8.password) {
                    j(d.M8.password);
                    return;
                  }
                  if (e < 1) {
                    v(-1);
                    return;
                  }
                  x(e);
                };
              return (0, r.jsx)(p.Provider, {
                value: {
                  mnemonic: s,
                  onOnboardingCompleted: j,
                  moveToNextStep: () => {
                    y(u + 1);
                  },
                  backToPreviousStep: () => {
                    y(u - 1);
                  },
                  currentStep: u,
                  prevStep: w,
                  totalSteps: 3,
                  loading: m
                },
                children: t
              });
            },
            g = () => {
              let e = o.useContext(p);
              if (!e) throw Error("useCreateWalletContext must be used within a CreateWalletProvider");
              return e;
            };
          a();
        } catch (e) {
          a(e);
        }
      });
    },
    50363: function (e, t, s) {
      s.a(e, async function (e, a) {
        try {
          s.r(t), s.d(t, { default: () => m });
          var r = s(52322),
            n = s(64690),
            i = s(14981),
            l = s(75958);
          s(2784);
          var o = s(22014),
            c = s(65339),
            d = s(10588),
            u = s(16703),
            h = s(52285),
            f = s(59245),
            x = e([f, h, c, u]);
          [f, h, c, u] = x.then ? (await x)() : x;
          let p = (0, l.Pi)(function () {
              let { onOnboardingCompleted: e, currentStep: t, loading: s, prevStep: a } = (0, c.Z)();
              return (0, r.jsxs)(i.M, {
                mode: "wait",
                presenceAffectsLayout: !0,
                children: [
                  s && (0, r.jsx)(d.T_, {}, "creating-wallet-loader"),
                  1 === t && !s && (0, r.jsx)(f.W, {}, "seed-phrase-view"),
                  2 === t && !s && (0, r.jsx)(h.V, {}, "confirm-secret-phrase-view"),
                  3 === t && !s && !o.M8.password && (0, r.jsx)(n.Z, { entry: a <= t ? "right" : "left", onProceed: e }, "choose-password-view")
                ]
              });
            }),
            m = (0, l.Pi)(() => (0, r.jsx)(c.H, { children: (0, r.jsx)(u.s, { children: (0, r.jsx)(p, {}) }) }));
          a();
        } catch (e) {
          a(e);
        }
      });
    },
    16703: function (e, t, s) {
      s.a(e, async function (e, a) {
        try {
          s.d(t, { s: () => f });
          var r = s(52322),
            n = s(43166),
            i = s(91486),
            l = s(19003);
          s(2784);
          var o = s(70514),
            c = s(98622),
            d = s(65339),
            u = e([d]);
          d = (u.then ? (await u)() : u)[0];
          let h = () => {
              let { backToPreviousStep: e, currentStep: t, totalSteps: s } = (0, d.Z)();
              return (0, r.jsxs)("div", {
                className: "flex flex-row items-center justify-between align-center w-full relative -m-1",
                children: [
                  (0, r.jsx)(i.zx, { variant: "secondary", size: "icon", onClick: e, children: (0, r.jsx)(n.X, { className: "size-4" }) }),
                  t > 0 && (0, r.jsx)(l.Z, { currentStep: t, totalSteps: s, className: "mx-auto h-9" }),
                  (0, r.jsx)("div", { className: "size-9 shrink-0" })
                ]
              });
            },
            f = e =>
              (0, r.jsxs)(c.z, {
                className: (0, o.cn)("flex flex-col items-stretch gap-7 p-7 overflow-auto border-secondary-300", e.className),
                children: [(0, r.jsx)(h, {}, "nav-header"), e.children]
              });
          a();
        } catch (e) {
          a(e);
        }
      });
    },
    52285: function (e, t, s) {
      s.a(e, async function (e, a) {
        try {
          s.d(t, { V: () => j });
          var r = s(52322),
            n = s(48085),
            i = s(91486),
            l = s(14981),
            o = s(4370),
            c = s(39775),
            d = s(2784),
            u = s(70514),
            h = s(9183),
            f = s(46338),
            x = s(91729),
            p = s(65339),
            m = e([p]);
          p = (m.then ? (await m)() : m)[0];
          let w = { error: "outline-destructive-100", success: "outline-accent-success", default: "focus-within:outline-foreground" },
            v = e => {
              let { value: t, onChange: s, onBlur: a, name: n, prefixNumber: i, className: l, status: o, ...c } = e;
              return (0, r.jsxs)("div", {
                className: (0, u.cn)(
                  "w-[100px] h-7 rounded-lg bg-secondary text-center flex items-center justify-center outline outline-transparent outline-1 px-2 gap-4 transition-[outline-color]",
                  w[o] ?? w.default,
                  l
                ),
                children: [
                  (0, r.jsx)("span", { className: "text-muted-foreground", children: i }),
                  (0, r.jsx)("input", {
                    className: "bg-inherit border-none outline-none w-full h-full",
                    type: "text",
                    value: t ?? "",
                    name: n ?? "",
                    onChange: s,
                    onBlur: a,
                    autoComplete: "off",
                    autoCorrect: "off",
                    autoCapitalize: "off",
                    ...c
                  })
                ]
              });
            };
          function g(e) {
            let { mnemonic: t, onProceed: s } = e,
              [a, c] = (0, d.useState)({ four: "", eight: "", tweleve: "" }),
              [u, x] = (0, d.useState)({ four: "", eight: "", tweleve: "" }),
              p = "error" === a.four || "error" === a.eight || "error" === a.tweleve,
              m = (0, d.useMemo)(() => {
                let e = t.trim().split(" ");
                return (e[3] = ""), (e[7] = ""), (e[11] = ""), e.join(" ");
              }, [t]);
            function g(e) {
              c({ ...a, [e.target.name]: "" }), x(t => ({ ...t, [e.target.name]: e.target.value }));
            }
            let w = (e, s) => {
              let r = (0, h.S)(t, e),
                n = u[s].trim();
              c({ ...a, [s]: n && r !== n ? "error" : n ? "success" : "" });
            };
            return (0, r.jsxs)(r.Fragment, {
              children: [
                (0, r.jsxs)("div", {
                  className: "space-y-6",
                  children: [
                    (0, r.jsxs)("div", {
                      className: "relative rounded-2xl bg-secondary-200 text-xs font-medium box-border h-[184px] w-[376px] p-5",
                      children: [
                        (0, r.jsx)(n.Q, { height: 144, width: 346, text: m, noSpace: !1 }),
                        (0, r.jsx)(v, {
                          name: "four",
                          prefixNumber: 4,
                          value: u.four,
                          onChange: g,
                          className: "absolute top-[56px] left-[28px]",
                          "data-testing-id": "input-fourth-word",
                          onBlur: () => w(4, "four"),
                          status: a.four
                        }),
                        (0, r.jsx)(v, {
                          name: "eight",
                          prefixNumber: 8,
                          value: u.eight,
                          onChange: g,
                          className: "absolute top-[91px] left-[144px]",
                          "data-testing-id": "input-eighth-word",
                          onBlur: () => w(8, "eight"),
                          status: a.eight
                        }),
                        (0, r.jsx)(v, {
                          name: "tweleve",
                          prefixNumber: 12,
                          value: u.tweleve,
                          onChange: g,
                          className: "absolute top-[127] left-[259px]",
                          "data-testing-id": "input-tweleveth-word",
                          onBlur: () => w(12, "tweleve"),
                          status: a.tweleve
                        })
                      ]
                    }),
                    (0, r.jsx)(l.M, {
                      children:
                        p &&
                        (0, r.jsx)(o.E.span, {
                          className: "text-xs text-destructive-100 font-medium text-center mt-4 block",
                          "data-testing-id": "error-text-ele",
                          variants: f.HJ,
                          initial: "hidden",
                          animate: "visible",
                          exit: "hidden",
                          children: "Seed phrase does not match. Please try again."
                        })
                    })
                  ]
                }),
                (0, r.jsx)(i.zx, {
                  className: "w-full mt-auto",
                  onClick: function () {
                    if ((0, h.S)(t, 4) !== u.four.trim()) {
                      c({ ...a, four: "error" });
                      return;
                    }
                    if ((0, h.S)(t, 8) !== u.eight.trim()) {
                      c({ ...a, eight: "error" });
                      return;
                    }
                    if ((0, h.S)(t, 12) !== u.tweleve.trim()) {
                      c({ ...a, tweleve: "error" });
                      return;
                    }
                    s();
                  },
                  disabled: !!(p || Object.values(u).includes("")),
                  "data-testing-id": "confirm-phrase-btn",
                  "aria-label": "confirm and continue button in confirm secret phrase flow",
                  children: (0, r.jsx)("span", {
                    "aria-label": "confirm and continue button text in confirm secret phrase flow",
                    children: "Confirm and continue"
                  })
                })
              ]
            });
          }
          let j = () => {
            let { prevStep: e, currentStep: t, mnemonic: s, moveToNextStep: a } = (0, p.Z)();
            return (0, r.jsx)("form", {
              onSubmit: e => e.preventDefault(),
              className: "flex flex-col h-full",
              children: (0, r.jsx)(x.n, {
                headerIcon: (0, r.jsx)(c.u, { className: "size-6" }),
                entry: e <= t ? "right" : "left",
                heading: "Verify your recovery phrase",
                subHeading: (0, r.jsxs)(r.Fragment, {
                  children: ["Select the 4th, 6th and 8th words of your recovery ", (0, r.jsx)("br", {}), "phrase in that same order."]
                }),
                children: (0, r.jsx)(g, { mnemonic: s, onProceed: a })
              })
            });
          };
          a();
        } catch (e) {
          a(e);
        }
      });
    },
    59245: function (e, t, s) {
      s.a(e, async function (e, a) {
        try {
          s.d(t, { W: () => f });
          var r = s(52322),
            n = s(48085),
            i = s(91486),
            l = s(92930),
            o = s(39775);
          s(2784);
          var c = s(53221),
            d = s(91729),
            u = s(65339),
            h = e([u]);
          u = (h.then ? (await h)() : h)[0];
          let f = () => {
            let { prevStep: e, currentStep: t, mnemonic: s, moveToNextStep: a } = (0, u.Z)();
            return (0, r.jsxs)(d.n, {
              headerIcon: (0, r.jsx)(o.u, { className: "size-6" }),
              entry: e <= t ? "right" : "left",
              heading: "Your secret recovery phrase",
              subHeading: (0, r.jsxs)(r.Fragment, {
                children: [
                  "Write down these words, your secret recovery phrase ",
                  (0, r.jsx)("br", {}),
                  " is the",
                  " ",
                  (0, r.jsx)("span", { className: "text-warning", children: " only way to recover " }),
                  " your wallet and funds!"
                ]
              }),
              children: [
                (0, r.jsxs)("div", {
                  className: "flex flex-col gap-3 justify-center",
                  children: [
                    (0, r.jsx)(n.Z, { text: s, noSpace: !1 }),
                    (0, r.jsx)(l.q, {
                      className: "mx-auto",
                      "data-testing-id": "mnemonic-copy-to-clipboard",
                      onClick: () => {
                        c.i.copyText(s);
                      },
                      children: "Copy to Clipboard"
                    })
                  ]
                }),
                (0, r.jsx)(i.zx, {
                  disabled: 0 === s.length,
                  className: "w-full mt-auto",
                  onClick: a,
                  "data-testing-id": "saved-mnemonic-btn",
                  "aria-label": "i have saved my recovery phrase button in seed phrase flow",
                  children: (0, r.jsx)("span", {
                    "aria-label": "i have saved my recovery phrase button text in seed phrase flow",
                    children: "I have saved my recovery phrase"
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
    9183: function (e, t, s) {
      s.d(t, { S: () => a });
      function a(e, t) {
        return e
          .trim()
          .split(" ")
          .slice(t - 1, t)[0];
      }
    }
  }
]);
//# sourceMappingURL=3617.js.map
