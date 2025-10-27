!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "939ba9ae-9536-47fd-af83-fe6b5d082ac6"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-939ba9ae-9536-47fd-af83-fe6b5d082ac6"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.22.9" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["8813"],
  {
    21886: function (e, t, a) {
      a.r(t), a.d(t, { default: () => Z });
      var l = a(52322),
        n = a(41172),
        r = a(99361),
        o = a(21984),
        s = a(2784),
        i = a(6806);
      let d = new Map([
        [
          "bold",
          s.createElement(
            s.Fragment,
            null,
            s.createElement("path", {
              d: "M208.49,120.49a12,12,0,0,1-17,0L140,69V216a12,12,0,0,1-24,0V69L64.49,120.49a12,12,0,0,1-17-17l72-72a12,12,0,0,1,17,0l72,72A12,12,0,0,1,208.49,120.49Z"
            })
          )
        ],
        [
          "duotone",
          s.createElement(
            s.Fragment,
            null,
            s.createElement("path", { d: "M200,112H56l72-72Z", opacity: "0.2" }),
            s.createElement("path", {
              d: "M205.66,106.34l-72-72a8,8,0,0,0-11.32,0l-72,72A8,8,0,0,0,56,120h64v96a8,8,0,0,0,16,0V120h64a8,8,0,0,0,5.66-13.66ZM75.31,104,128,51.31,180.69,104Z"
            })
          )
        ],
        [
          "fill",
          s.createElement(
            s.Fragment,
            null,
            s.createElement("path", {
              d: "M207.39,115.06A8,8,0,0,1,200,120H136v96a8,8,0,0,1-16,0V120H56a8,8,0,0,1-5.66-13.66l72-72a8,8,0,0,1,11.32,0l72,72A8,8,0,0,1,207.39,115.06Z"
            })
          )
        ],
        [
          "light",
          s.createElement(
            s.Fragment,
            null,
            s.createElement("path", {
              d: "M204.24,116.24a6,6,0,0,1-8.48,0L134,54.49V216a6,6,0,0,1-12,0V54.49L60.24,116.24a6,6,0,0,1-8.48-8.48l72-72a6,6,0,0,1,8.48,0l72,72A6,6,0,0,1,204.24,116.24Z"
            })
          )
        ],
        [
          "regular",
          s.createElement(
            s.Fragment,
            null,
            s.createElement("path", {
              d: "M205.66,117.66a8,8,0,0,1-11.32,0L136,59.31V216a8,8,0,0,1-16,0V59.31L61.66,117.66a8,8,0,0,1-11.32-11.32l72-72a8,8,0,0,1,11.32,0l72,72A8,8,0,0,1,205.66,117.66Z"
            })
          )
        ],
        [
          "thin",
          s.createElement(
            s.Fragment,
            null,
            s.createElement("path", {
              d: "M202.83,114.83a4,4,0,0,1-5.66,0L132,49.66V216a4,4,0,0,1-8,0V49.66L58.83,114.83a4,4,0,0,1-5.66-5.66l72-72a4,4,0,0,1,5.66,0l72,72A4,4,0,0,1,202.83,114.83Z"
            })
          )
        ]
      ]);
      var c = Object.defineProperty,
        m = Object.defineProperties,
        f = Object.getOwnPropertyDescriptors,
        u = Object.getOwnPropertySymbols,
        g = Object.prototype.hasOwnProperty,
        p = Object.prototype.propertyIsEnumerable,
        h = (e, t, a) => (t in e ? c(e, t, { enumerable: !0, configurable: !0, writable: !0, value: a }) : (e[t] = a)),
        b = (e, t) => {
          for (var a in t || (t = {})) g.call(t, a) && h(e, a, t[a]);
          if (u) for (var a of u(t)) p.call(t, a) && h(e, a, t[a]);
          return e;
        },
        x = (e, t) => m(e, f(t));
      let y = (0, s.forwardRef)((e, t) => s.createElement(i.Z, x(b({ ref: t }, e), { weights: d })));
      y.displayName = "ArrowUp";
      var w = a(92642),
        j = a(91486),
        v = a(26571),
        E = a(28879),
        S = a.n(E),
        N = a(14981),
        I = a(4370),
        M = a(30464),
        O = a(24542),
        _ = a.n(O),
        F = a(43579),
        L = a.n(F),
        k = a(28316),
        A = a(48534),
        V = a(98622);
      let C = "undefined" != typeof navigator && navigator.userAgent.includes("Mac") ? "Cmd" : "Ctrl";
      function Z() {
        let e = (0, n.SFn)("cosmos"),
          t = (0, n.SFn)("ethereum"),
          a = (0, n.SFn)("solana"),
          i = (0, n.SFn)("sui"),
          d = (0, s.useMemo)(() => e || t || a || i, [e, t, a, i]);
        return (
          (0, s.useEffect)(() => {
            let e = new Date().getTime(),
              t = Number(localStorage.getItem("timeStarted1")),
              a = Number(localStorage.getItem("timeStarted2")),
              l = localStorage.getItem("onboardingMethodChosen");
            if (t && a && d) {
              let n = o.P6.bytesToHex((0, r.J)(d));
              try {
                _().track(v.B_.OnboardingCompleted, {
                  methodChosen: l,
                  timeTaken1: S()(e).diff(t, "seconds"),
                  timeTaken2: S()(e).diff(a, "seconds"),
                  wallet: n,
                  time: Date.now() / 1e3
                });
              } catch (e) {
                (0, w.Tb)(e);
              }
              localStorage.removeItem("timeStarted1"), localStorage.removeItem("timeStarted2"), localStorage.removeItem("onboardingMethodChosen");
            }
          }, [d]),
          (0, l.jsxs)(l.Fragment, {
            children: [
              (0, k.createPortal)((0, l.jsxs)(l.Fragment, { children: [(0, l.jsx)(D, {}), (0, l.jsx)(z, {})] }), document.body),
              (0, l.jsxs)(V.z, {
                hideRightActions: !0,
                className: "flex flex-col items-center gap-7 p-7 overflow-auto z-20 bg-background",
                style: {
                  backgroundImage: "linear-gradient(180deg, hsl(var(--bg-linear-gradient-start) / 0.4) 19.35%, hsl(var(--bg-linear-gradient-end)/ 0.4) 80.65%)"
                },
                children: [
                  (0, l.jsxs)("div", {
                    className: "flex flex-col gap-y-8 my-auto",
                    children: [
                      (0, l.jsx)("div", {
                        className: "w-32 h-auto mx-auto",
                        children: (0, l.jsx)("img", { src: M.r.Misc.OnboardingFrog, className: "w-full h-full" })
                      }),
                      (0, l.jsxs)("header", {
                        className: "flex flex-col gap-y-5 items-center text-center",
                        children: [
                          (0, l.jsx)("h1", { className: "font-bold text-xxl", children: "You are all set!" }),
                          (0, l.jsxs)("span", {
                            className: "flex flex-col gap-y-1 text-muted-foreground text-md",
                            children: [
                              (0, l.jsx)("span", { children: "Discover Cosmos, Ethereum & more with Leap." }),
                              (0, l.jsxs)("span", {
                                children: [
                                  "Open Leap with",
                                  (0, l.jsxs)("span", { className: "text-accent-foreground font-bold", children: [" ", C] }),
                                  " +",
                                  (0, l.jsx)("span", { className: "text-accent-foreground font-bold", children: " Shift" }),
                                  " +",
                                  (0, l.jsx)("span", { className: "text-accent-foreground font-bold", children: " L" })
                                ]
                              })
                            ]
                          })
                        ]
                      })
                    ]
                  }),
                  (0, l.jsx)(j.zx, {
                    className: "w-full",
                    onClick: () => {
                      (0, A.mW)("https://app.leapwallet.io");
                    },
                    children: "Get started"
                  })
                ]
              })
            ]
          })
        );
      }
      let D = () =>
          (0, l.jsx)(L(), {
            className: "w-full h-full absolute opacity-50 top-0 left-0 right-0 z-10 isolate",
            onInit: e => {
              let { conductor: t } = e;
              t.run({ speed: 1 }),
                setTimeout(() => {
                  t.stop();
                }, 5e3);
            },
            globalOptions: { useWorker: !0, resize: !0 }
          }),
        P = { duration: 0.3, ease: "easeInOut" },
        T = { show: { opacity: 1, y: 0 }, hide: { opacity: 0, y: -10 } },
        z = () => {
          let [e, t] = (0, s.useState)(!0);
          return (
            (0, s.useEffect)(() => {
              let e = setInterval(async () => {
                let e = await chrome.action.getUserSettings();
                t(null == e ? void 0 : e.isOnToolbar);
              }, 2e3);
              return () => clearInterval(e);
            }, []),
            (0, l.jsx)(N.M, {
              children:
                !e &&
                (0, l.jsx)(I.E.div, {
                  transition: P,
                  variants: T,
                  initial: "hide",
                  animate: "show",
                  exit: "hide",
                  className: "absolute top-0 right-10 z-10 rounded-b-xl px-9 flex items-center gap-3 bg-[hsl(var(--gradient-radial-mono-end))]",
                  children: (0, l.jsxs)("div", {
                    className: "text-white-100 bg-primary rounded-b-xl px-4 py-2 flex items-center gap-3",
                    children: [
                      (0, l.jsx)("span", { className: "text-sm font-bold w-32", children: "Pin Leap to your toolbar" }),
                      (0, l.jsx)(y, { size: 24, weight: "bold" })
                    ]
                  })
                })
            })
          );
        };
    }
  }
]);
//# sourceMappingURL=8813.js.map
