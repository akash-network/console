!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      a = new e.Error().stack;
    a &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[a] = "4a459b0c-cc8d-44c8-8e95-36dd50898fc8"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-4a459b0c-cc8d-44c8-8e95-36dd50898fc8"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.22.9" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["1386"],
  {
    62306: function (e, a, t) {
      t.a(e, async function (e, n) {
        try {
          t.r(a), t.d(a, { default: () => C });
          var l = t(52322),
            i = t(55159),
            s = t(92642),
            o = t(91486),
            r = t(26571),
            d = t(20541),
            c = t(33725),
            u = t(4370),
            f = t(41978),
            m = t(24542),
            g = t.n(m),
            y = t(75958),
            x = t(2784),
            p = t(10289),
            w = t(22014),
            b = t(52757),
            h = t(75727),
            v = t(72565),
            j = t.n(v),
            E = t(98622),
            _ = e([d]);
          d = (_.then ? (await _)() : _)[0];
          let k = { duration: 0.25, delay: 1.05, ease: "easeOut" },
            S = { hidden: { opacity: 0, y: "-25%" }, visible: { opacity: 1, y: 0 } },
            N = { hidden: { opacity: 0, y: "25%" }, visible: { opacity: 1, y: 0 } },
            I = e => {
              let { navigate: a, trackCTAEvent: t } = e,
                [n, i] = (0, c.H)(),
                s = (0, x.useCallback)(async () => {
                  let e = "#leap-logo",
                    a = "#background-gradient";
                  await Promise.all([i(e, { y: 120 }, { duration: 0 }), i(a, { opacity: 0.4 }, { duration: 0 })]),
                    await Promise.all([i(e, { scale: 1.3334, y: 120 }, { duration: 0.25, ease: "easeOut" }), i(a, { opacity: 0.75 }, { duration: 0.25 })]),
                    await Promise.all([
                      i(e, { scale: 1, y: 120 }, { delay: 0.25, duration: 0.25, ease: "easeOut" }),
                      i(a, { opacity: 0.4 }, { delay: 0.25, duration: 0.25 })
                    ]),
                    await Promise.all([
                      i(e, { scale: 1.3334, y: 0 }, { delay: 0.25, duration: 0.2, ease: "easeOut" }),
                      i(a, { opacity: 1 }, { delay: 0.25, duration: 0.25 })
                    ]);
                }, [i]);
              return (
                (0, x.useEffect)(() => {
                  s();
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
                            variants: S,
                            transition: k,
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
                      transition: k,
                      children: [
                        (0, l.jsx)(o.zx, {
                          className: "w-full",
                          "data-testing-id": "create-new-wallet",
                          onClick: () => {
                            a("/onboardingCreate"), t("new");
                          },
                          children: "Create a new wallet"
                        }),
                        (0, l.jsx)(o.zx, {
                          variant: "mono",
                          className: "w-full",
                          "data-testing-id": "import-existing-wallet",
                          onClick: () => {
                            a("/onboardingImport"), t("import-seed-phrase");
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
              let e = (0, p.s0)(),
                { loading: a, noAccount: t } = (0, d.aC)();
              return ((0, x.useEffect)(() => {
                (async () => {
                  let n = await i.Kn.getAllWallets();
                  !1 === a && (0, b.d)(n) && (!t || w.M8.password) && e("/onboardingSuccess");
                })();
              }, [a, e, t, w.M8.password]),
              (0, x.useEffect)(() => {
                (0, h.c)(),
                  j().extension.getViews({ type: "popup" }),
                  localStorage.getItem("timeStarted1") || localStorage.setItem("timeStarted1", new Date().getTime().toString());
                try {
                  g().track(r.B_.OnboardingStarted, { firstWallet: !0, time: Date.now() / 1e3 });
                } catch (e) {
                  (0, s.Tb)(e);
                }
              }, []),
              a)
                ? null
                : (0, l.jsx)(E.z, {
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
    98622: function (e, a, t) {
      t.d(a, { z: () => s });
      var n = t(52322),
        l = t(4370);
      t(2784);
      var i = t(70514);
      let s = e => {
        let { className: a, children: t, ...s } = e;
        return (0, n.jsx)(l.E.div, {
          className: (0, i.cn)("overflow-auto bg-secondary overflow-x-hidden my-auto mx-auto rounded-3xl flex h-full w-full", a),
          ...s,
          children: t
        });
      };
    },
    75727: function (e, a, t) {
      t.d(a, { c: () => n });
      let n = () =>
        Promise.all([
          Promise.resolve().then(t.bind(t, 62306)),
          Promise.all([t.e("1347"), t.e("4772"), t.e("8095"), t.e("3617")]).then(t.bind(t, 50363)),
          Promise.all([t.e("1347"), t.e("4772"), t.e("8095"), t.e("6564")]).then(t.bind(t, 98151)),
          Promise.all([t.e("4379"), t.e("8813")]).then(t.bind(t, 21886))
        ]);
    },
    33725: function (e, a, t) {
      t.d(a, { H: () => s });
      var n = t(40368),
        l = t(2784),
        i = t(15406);
      function s() {
        var e;
        let a = (0, n.h)(() => ({ current: null, animations: [] })),
          t = (0, n.h)(() => (0, i.n)(a));
        return (
          (e = () => {
            a.animations.forEach(e => e.stop());
          }),
          (0, l.useEffect)(() => () => e(), []),
          [a, t]
        );
      }
    }
  }
]);
//# sourceMappingURL=1386.js.map
