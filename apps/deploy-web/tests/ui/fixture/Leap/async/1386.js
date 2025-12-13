!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "4eb15253-87ef-4b8c-abc8-23678591a486"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-4eb15253-87ef-4b8c-abc8-23678591a486"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.23.1" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["1386"],
  {
    62306: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.r(t), a.d(t, { default: () => C });
          var l = a(52322),
            i = a(55159),
            s = a(92642),
            o = a(91486),
            r = a(26571),
            d = a(20541),
            c = a(33725),
            u = a(4370),
            f = a(41978),
            m = a(24542),
            g = a.n(m),
            y = a(75958),
            x = a(2784),
            b = a(10289),
            p = a(22014),
            w = a(52757),
            h = a(75727),
            v = a(72565),
            S = a.n(v),
            j = a(98622),
            E = e([d]);
          d = (E.then ? (await E)() : E)[0];
          let _ = { duration: 0.25, delay: 1.25, ease: "easeOut" },
            k = { hidden: { opacity: 0, y: "-25%" }, visible: { opacity: 1, y: 0 } },
            N = { hidden: { opacity: 0, y: "25%" }, visible: { opacity: 1, y: 0 } },
            I = e => {
              let { navigate: t, trackCTAEvent: a } = e,
                [n, i] = (0, c.H)(),
                s = (0, x.useCallback)(async () => {
                  let e = "#leap-logo",
                    t = "#background-gradient",
                    a = document.querySelector(e),
                    n = document.querySelector(t);
                  a &&
                    n &&
                    (await Promise.all([i(e, { y: 120 }, { duration: 0 }), i(t, { opacity: 0.4 }, { duration: 0 })]),
                    await Promise.all([i(e, { scale: 1.3334, y: 120 }, { duration: 0.25, ease: "easeOut" }), i(t, { opacity: 0.75 }, { duration: 0.25 })]),
                    await Promise.all([
                      i(e, { scale: 1, y: 120 }, { delay: 0.25, duration: 0.25, ease: "easeOut" }),
                      i(t, { opacity: 0.4 }, { delay: 0.25, duration: 0.25 })
                    ]),
                    await Promise.all([
                      i(e, { scale: 1.3334, y: 0 }, { delay: 0.25, duration: 0.2, ease: "easeOut" }),
                      i(t, { opacity: 1 }, { delay: 0.25, duration: 0.25 })
                    ]));
                }, [i]);
              return (
                (0, x.useEffect)(() => {
                  let e = setTimeout(() => {
                    s();
                  }, 100);
                  return () => clearTimeout(e);
                }, [s]),
                (0, l.jsxs)("div", {
                  ref: n,
                  className: "flex flex-col flex-1 w-full p-7 isolate",
                  children: [
                    (0, l.jsx)("div", {
                      id: "background-gradient",
                      style: {
                        backgroundImage:
                          "linear-gradient(180deg, hsl(var(--bg-linear-gradient-start) / 1) 19.35%, hsl(var(--bg-linear-gradient-end)/ 1) 80.65%)"
                      },
                      className: "absolute inset-0 -z-10"
                    }),
                    (0, l.jsxs)("div", {
                      className: "flex flex-col gap-6 items-center justify-center flex-1",
                      children: [
                        (0, l.jsx)(f.P, { id: "leap-logo", className: "size-[5.625rem]", style: { transform: "translateY(120px)" } }),
                        (0, l.jsxs)(
                          u.E.span,
                          {
                            initial: "hidden",
                            animate: "visible",
                            variants: k,
                            transition: _,
                            className: "flex flex-col gap-4",
                            children: [
                              (0, l.jsx)("span", { className: "text-center text-xxl font-bold text-secondary-foreground", children: "Leap everywhere" }),
                              (0, l.jsx)("span", {
                                className: "text-center text-xl text-secondary-800",
                                children: "Multi-chain wallet for Cosmos, Ethereum, Solana, Bitcoin & more"
                              })
                            ]
                          },
                          "main-text"
                        )
                      ]
                    }),
                    (0, l.jsxs)(u.E.div, {
                      className: "flex flex-col gap-y-4 w-full mt-auto",
                      initial: "hidden",
                      animate: "visible",
                      variants: N,
                      transition: _,
                      children: [
                        (0, l.jsx)(o.zx, {
                          className: "w-full",
                          "data-testing-id": "create-new-wallet",
                          onClick: () => {
                            t("/onboardingCreate"), a("new");
                          },
                          children: "Create a new wallet"
                        }),
                        (0, l.jsx)(o.zx, {
                          variant: "mono",
                          className: "w-full",
                          "data-testing-id": "import-existing-wallet",
                          onClick: () => {
                            t("/onboardingImport"), a("import-seed-phrase");
                          },
                          children: "Import an existing wallet"
                        })
                      ]
                    })
                  ]
                })
              );
            },
            C = (0, y.Pi)(function () {
              let e = (0, b.s0)(),
                { loading: t, noAccount: a } = (0, d.aC)();
              return ((0, x.useEffect)(() => {
                (async () => {
                  let n = await i.Kn.getAllWallets();
                  !1 === t && (0, w.d)(n) && (!a || p.M8.password) && e("/onboardingSuccess");
                })();
              }, [t, e, a, p.M8.password]),
              (0, x.useEffect)(() => {
                (0, h.c)(),
                  S().extension.getViews({ type: "popup" }),
                  localStorage.getItem("timeStarted1") || localStorage.setItem("timeStarted1", new Date().getTime().toString());
                try {
                  g().track(r.B_.OnboardingStarted, { firstWallet: !0, time: Date.now() / 1e3 });
                } catch (e) {
                  (0, s.Tb)(e);
                }
              }, []),
              t)
                ? null
                : (0, l.jsx)(j.z, {
                    className: "flex flex-col gap-y-5 justify-center items-center grow",
                    children: (0, l.jsx)(I, {
                      navigate: e,
                      trackCTAEvent: e => {
                        try {
                          g().track(r.B_.OnboardingMethod, { methodChosen: e, time: Date.now() / 1e3 });
                        } catch (e) {
                          (0, s.Tb)(e);
                        }
                        localStorage.setItem("onboardingMethodChosen", e), localStorage.setItem("timeStarted2", new Date().getTime().toString());
                      }
                    })
                  });
            });
          n();
        } catch (e) {
          n(e);
        }
      });
    },
    98622: function (e, t, a) {
      a.d(t, { z: () => s });
      var n = a(52322),
        l = a(4370);
      a(2784);
      var i = a(70514);
      let s = e => {
        let { className: t, children: a, ...s } = e;
        return (0, n.jsx)(l.E.div, {
          className: (0, i.cn)("overflow-auto bg-secondary overflow-x-hidden my-auto mx-auto rounded-3xl flex h-full w-full", t),
          ...s,
          children: a
        });
      };
    },
    75727: function (e, t, a) {
      a.d(t, { c: () => n });
      let n = () =>
        Promise.all([
          Promise.resolve().then(a.bind(a, 62306)),
          Promise.all([a.e("1347"), a.e("4772"), a.e("8095"), a.e("3617")]).then(a.bind(a, 50363)),
          Promise.all([a.e("1347"), a.e("4772"), a.e("8095"), a.e("6564")]).then(a.bind(a, 98151)),
          Promise.all([a.e("4379"), a.e("8813")]).then(a.bind(a, 21886))
        ]);
    },
    33725: function (e, t, a) {
      a.d(t, { H: () => s });
      var n = a(40368),
        l = a(2784),
        i = a(15406);
      function s() {
        var e;
        let t = (0, n.h)(() => ({ current: null, animations: [] })),
          a = (0, n.h)(() => (0, i.n)(t));
        return (
          (e = () => {
            t.animations.forEach(e => e.stop());
          }),
          (0, l.useEffect)(() => () => e(), []),
          [t, a]
        );
      }
    }
  }
]);
//# sourceMappingURL=1386.js.map
