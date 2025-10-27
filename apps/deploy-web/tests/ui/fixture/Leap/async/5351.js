!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      s = new e.Error().stack;
    s &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[s] = "bd7caf3a-4c6b-4559-be61-fc7823a8d968"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-bd7caf3a-4c6b-4559-be61-fc7823a8d968"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.22.9" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["5351"],
  {
    94540: function (e, s, a) {
      a.d(s, { d: () => o });
      var t = a(52322),
        l = a(96217),
        r = a(69816);
      a(2784);
      let o = e => {
        let { isOpen: s, onClose: a } = e;
        return (0, t.jsx)(l.Z, {
          isOpen: s,
          onClose: a,
          title: "Claimable rewards",
          children: (0, t.jsxs)("div", {
            className: "flex flex-col gap-7",
            children: [
              (0, t.jsx)(r.Z, {
                color: "dark:text-gray-200 text-gray-800",
                size: "sm",
                className: "!leading-6",
                children:
                  "esINIT are non-transferable tokens you earn as rewards through the Initia VIP program. They come from the Balance Pool (based on your INIT holdings) and the Weight Pool (based on L1 gauge votes)."
              }),
              (0, t.jsx)(r.Z, {
                color: "dark:text-gray-200 text-gray-800",
                size: "sm",
                className: "!leading-6",
                children: "To unlock esINIT, you need to keep a high VIP Score or use locked liquidity positions."
              })
            ]
          })
        });
      };
    },
    7155: function (e, s, a) {
      a.d(s, { K: () => o });
      var t = a(52322),
        l = a(96217),
        r = a(69816);
      a(2784);
      let o = e => {
        let { isOpen: s, onClose: a } = e;
        return (0, t.jsx)(l.Z, {
          isOpen: s,
          onClose: a,
          title: "Last updated score",
          children: (0, t.jsx)(r.Z, {
            color: "dark:text-gray-200 text-gray-800",
            size: "sm",
            className: "!leading-6",
            children:
              "The Last Updated Score shows your most recent VIP Score. It measures how active and engaged you are in the Initia ecosystem up to the last epoch. Your score is key to figuring out how much of the earned esINIT you can unlock."
          })
        });
      };
    },
    10046: function (e, s, a) {
      a.d(s, { Z: () => r });
      var t = a(52322);
      a(2784);
      var l = a(86874);
      let r = () =>
        (0, t.jsxs)("div", {
          className: "flex flex-col p-5 gap-5 w-full h-[136px] rounded-xl bg-gray-50 dark:bg-gray-900",
          children: [
            (0, t.jsxs)("div", {
              className: "flex gap-3 items-center",
              children: [(0, t.jsx)(l.Z, { className: "rounded-full", width: 40, height: 40 }), (0, t.jsx)(l.Z, { width: 200, height: 20 })]
            }),
            (0, t.jsxs)("div", {
              className: "flex gap-3 w-full justify-between",
              children: [(0, t.jsx)(l.Z, { width: 150, height: 12 }), (0, t.jsx)(l.Z, { width: 150, height: 12 })]
            })
          ]
        });
    },
    62365: function (e, s, a) {
      a.d(s, { u: () => o });
      var t = a(52322),
        l = a(96217),
        r = a(69816);
      a(2784);
      let o = e => {
        let { isOpen: s, onClose: a } = e;
        return (0, t.jsx)(l.Z, {
          isOpen: s,
          onClose: a,
          title: "VIP Gauge",
          children: (0, t.jsxs)("div", {
            className: "flex flex-col gap-7",
            children: [
              (0, t.jsx)(r.Z, {
                color: "dark:text-gray-200 text-gray-800",
                size: "sm",
                className: "!leading-6",
                children:
                  "A VIP Gauge helps decide how rewards from the Weight Pool are distributed among different Layer 2 chains (rollups) in the Initia ecosystem."
              }),
              (0, t.jsxs)("p", {
                className: "!leading-6 dark:text-gray-200 text-gray-800 text-sm",
                children: [
                  "Each",
                  " ",
                  (0, t.jsx)("span", { className: "font-bold text-black-100 dark:text-white-100", children: "whitelisted rollup" }),
                  " ",
                  "has its own gauge, and the more votes it gets, the bigger the share of rewards it receives."
                ]
              }),
              (0, t.jsx)(r.Z, { className: "font-bold", size: "md", color: "text-black-100 dark:text-white-100", children: "How Does It Work?" }),
              (0, t.jsx)(r.Z, {
                color: "dark:text-gray-200 text-gray-800",
                size: "sm",
                className: "!leading-6",
                children: "You can use your voting power to vote for rollups. You can choose one or split your votes across multiple rollups."
              }),
              (0, t.jsx)(r.Z, {
                color: "dark:text-gray-200 text-gray-800",
                size: "sm",
                className: "!leading-6",
                children: "The more votes a rollup gets, the larger the share of rewards it and its users (including you) will receive."
              }),
              (0, t.jsxs)("p", {
                className: "!leading-6 dark:text-gray-200 text-gray-800 text-sm",
                children: [
                  "This system ensures that",
                  " ",
                  (0, t.jsx)("span", { className: "font-bold text-black-100 dark:text-white-100", children: "your votes" }),
                  " help shape the Initia ecosystem while maximizing your rewards."
                ]
              })
            ]
          })
        });
      };
    },
    19529: function (e, s, a) {
      a.d(s, { f: () => o });
      var t = a(52322),
        l = a(96217),
        r = a(69816);
      a(2784);
      let o = e => {
        let { isOpen: s, onClose: a } = e;
        return (0, t.jsx)(l.Z, {
          isOpen: s,
          onClose: a,
          title: "What are VIP rewards?",
          children: (0, t.jsxs)("div", {
            className: "flex flex-col gap-7",
            children: [
              (0, t.jsx)(r.Z, {
                color: "dark:text-gray-200 text-gray-800",
                size: "sm",
                className: "!leading-6",
                children:
                  "The Vested Interest Program (VIP) is Initia’s way to reward you for participating in their interwoven ecosystem. You get INIT rewards from two pools:"
              }),
              (0, t.jsxs)("div", {
                className: "flex flex-col gap-5",
                children: [
                  (0, t.jsxs)("p", {
                    className: "!leading-6 dark:text-gray-200 text-gray-800 text-sm",
                    children: [
                      (0, t.jsx)("span", { className: "font-bold !inline-block text-black-100 dark:text-white-100", children: "1. The Balance Pool:" }),
                      " ",
                      "It’s the amount of opINIT held on the rollup which determines the share of esINIT balance pool reward."
                    ]
                  }),
                  (0, t.jsxs)("p", {
                    className: "!leading-6 dark:text-gray-200 text-gray-800 text-sm",
                    children: [
                      (0, t.jsx)("span", { className: "font-bold !inline-block text-black-100 dark:text-white-100", children: "2. The Weight Pool:" }),
                      " ",
                      "If you hold INIT and Enshrined Liquidity Tokens, you can vote in the gauge system to send emissions to a specific rollup."
                    ]
                  })
                ]
              }),
              (0, t.jsx)(r.Z, {
                color: "dark:text-gray-200 text-gray-800",
                size: "sm",
                className: "!leading-6",
                children: "VIP rewards you for being active in liquidity and governance. The more you participate, the more you earn."
              })
            ]
          })
        });
      };
    },
    75201: function (e, s, a) {
      a.a(e, async function (e, t) {
        try {
          a.r(s), a.d(s, { default: () => k });
          var l = a(52322),
            r = a(36906),
            o = a(48039),
            i = a(26007),
            n = a(69816),
            d = a(26571),
            c = a(78646),
            x = a(75958),
            h = a(2784),
            g = a(86874),
            m = a(10289),
            f = a(71198),
            p = a(94540),
            u = a(7155),
            y = a(10046),
            j = a(62365),
            w = a(19529),
            b = a(34849),
            N = e([c, b]);
          [c, b] = N.then ? (await N)() : N;
          let k = (0, x.Pi)(() => {
            (0, c.a)(d.q.InitiaVip);
            let [e, s] = (0, h.useState)(!1),
              [a, t] = (0, h.useState)(!1),
              [x, N] = (0, h.useState)(!1),
              [k, v] = (0, h.useState)(!1),
              I = (0, m.s0)(),
              {
                isLoading: Z,
                data: { rollupList: z, totalClaimableReward: C, votingEndsIn: T }
              } = (0, b.j)();
            return (0, l.jsxs)(l.Fragment, {
              children: [
                (0, l.jsxs)("div", {
                  className: "py-4 px-6 flex justify-between items-center bg-secondary-100 border-b border-secondary-200",
                  children: [
                    (0, l.jsx)("div", { className: "w-5 h-5" }),
                    (0, l.jsxs)("div", {
                      className: "flex items-center gap-2",
                      children: [
                        (0, l.jsx)(n.Z, { className: "font-bold text-[18px]", color: "text-black-100 dark:text-white-100", children: "VIP Rewards" }),
                        (0, l.jsx)(r.k, {
                          className: "text-gray-400 dark:text-gray-600 w-5 h-5 cursor-pointer",
                          onClick: e => {
                            e.stopPropagation(), N(!0);
                          }
                        })
                      ]
                    }),
                    (0, l.jsx)(o.X, {
                      className: "text-muted-foreground hover:text-foreground w-5 h-5 cursor-pointer",
                      onClick: () => {
                        I("/home");
                      }
                    })
                  ]
                }),
                (0, l.jsxs)("div", {
                  className: "flex flex-col gap-8 pt-8 h-[calc(100%-61px)] overflow-y-scroll",
                  children: [
                    (0, l.jsxs)("div", {
                      className: "flex flex-col gap-3 px-6 items-center",
                      children: [
                        (0, l.jsx)(n.Z, { size: "md", color: "text-gray-600 dark:text-gray-400", children: "Current gauge vote ends in" }),
                        Z
                          ? (0, l.jsx)(g.Z, { width: 150, height: 20 })
                          : (0, l.jsx)(n.Z, { color: "text-black-100 dark:text-white-100", size: "xl", className: "font-bold", children: T })
                      ]
                    }),
                    (0, l.jsxs)("div", {
                      className: "flex flex-col p-5 mx-6 rounded-2xl gap-4 border border-secondary-200",
                      children: [
                        (0, l.jsxs)("div", {
                          className: "flex items-center gap-1",
                          children: [
                            (0, l.jsx)(n.Z, { className: "font-bold", size: "sm", color: "text-black-100 dark:text-white-100", children: "Claimable rewards" }),
                            (0, l.jsx)(r.k, {
                              className: "text-gray-400 dark:text-gray-600 w-4 h-4 cursor-pointer",
                              onClick: e => {
                                e.stopPropagation(), t(!0);
                              }
                            })
                          ]
                        }),
                        Z
                          ? (0, l.jsxs)("div", {
                              className: "flex flex-col gap-1",
                              children: [(0, l.jsx)(g.Z, { className: "h-4" }), (0, l.jsx)(g.Z, { className: "!w-1/2 h-4" })]
                            })
                          : C > 0
                            ? (0, l.jsxs)("div", {
                                className: "flex justify-between items-center",
                                children: [
                                  (0, l.jsxs)("div", {
                                    className: "flex flex-col gap-1.5",
                                    children: [
                                      (0, l.jsx)(n.Z, { size: "xs", color: "text-gray-600 dark:text-gray-400", children: "Total claimable" }),
                                      (0, l.jsxs)("div", {
                                        className: "flex gap-1 items-center",
                                        children: [
                                          (0, l.jsx)(n.Z, { color: "text-green-600", size: "lg", className: "font-bold", children: (0, f.jX)(C.toString()) }),
                                          (0, l.jsx)(n.Z, { color: "text-gray-600 dark:text-gray-400", size: "md", children: "INIT" })
                                        ]
                                      })
                                    ]
                                  }),
                                  (0, l.jsxs)("button", {
                                    className:
                                      "flex items-center py-2 px-4 text-sm font-bold text-white-100 rounded-full cursor-pointer bg-green-600 hover:bg-green-500",
                                    onClick: () => {
                                      window.open("https://app.initia.xyz/vip", "_blank");
                                    },
                                    "aria-label": "claim now button in initia vip flow",
                                    children: [
                                      (0, l.jsx)("span", { "aria-label": "claim now button text in initia vip flow", children: "Claim now" }),
                                      (0, l.jsx)(i.O, { size: 12, weight: "bold", className: "ml-1.5" })
                                    ]
                                  })
                                ]
                              })
                            : (0, l.jsx)(n.Z, {
                                size: "sm",
                                color: "text-gray-600 dark:text-gray-400",
                                children: "No rewards available to claim. Engage with the rollups below to earn rewards."
                              })
                      ]
                    }),
                    (0, l.jsxs)("div", {
                      className: "flex flex-col gap-4 p-6",
                      children: [
                        (0, l.jsxs)("div", {
                          className: "flex items-center gap-1",
                          children: [
                            (0, l.jsx)(n.Z, { className: "font-bold", size: "md", color: "text-black-100 dark:text-white-100", children: "Rollups" }),
                            (0, l.jsx)(r.k, {
                              className: "text-gray-400 dark:text-gray-600 w-4 h-4 cursor-pointer",
                              onClick: e => {
                                e.stopPropagation(), v(!0);
                              }
                            })
                          ]
                        }),
                        Z
                          ? (0, l.jsxs)(l.Fragment, { children: [(0, l.jsx)(y.Z, {}), (0, l.jsx)(y.Z, {})] })
                          : z.map(e =>
                              (0, l.jsxs)(
                                "div",
                                {
                                  className: "dark:bg-gray-900 bg-gray-50 hover:bg-gray-100 dark:hover:bg-gray-850 rounded-xl p-5 flex gap-10 cursor-pointer",
                                  onClick: () => window.open(e.website, "_blank"),
                                  children: [
                                    (0, l.jsxs)("div", {
                                      className: "flex flex-col gap-4 flex-grow",
                                      children: [
                                        (0, l.jsxs)("div", {
                                          className: "flex gap-3",
                                          children: [
                                            (0, l.jsx)("img", { src: e.logo, alt: e.name, className: "w-10 h-10 rounded-full" }),
                                            (0, l.jsxs)("div", {
                                              className: "flex flex-col",
                                              children: [
                                                (0, l.jsx)(n.Z, {
                                                  className: "font-bold",
                                                  size: "md",
                                                  color: "text-black-100 dark:text-white-100",
                                                  children: e.prettyName
                                                }),
                                                (0, l.jsxs)(n.Z, {
                                                  className: "font-medium",
                                                  size: "xs",
                                                  color: "text-gray-600 dark:text-gray-400",
                                                  children: ["Gauge vote: ", (100 * e.votePercent).toFixed(2), "%"]
                                                })
                                              ]
                                            })
                                          ]
                                        }),
                                        (0, l.jsxs)("div", {
                                          className: "flex justify-between",
                                          children: [
                                            (0, l.jsxs)("div", {
                                              className: "flex flex-col gap-1",
                                              children: [
                                                (0, l.jsxs)("div", {
                                                  className: "flex items-center gap-1",
                                                  children: [
                                                    (0, l.jsx)(n.Z, { size: "xs", color: "text-gray-600 dark:text-gray-400", children: "Last updated score" }),
                                                    (0, l.jsx)(r.k, {
                                                      className: "text-gray-400 dark:text-gray-600 w-3 h-3 cursor-pointer",
                                                      onClick: e => {
                                                        e.stopPropagation(), s(!0);
                                                      }
                                                    })
                                                  ]
                                                }),
                                                (0, l.jsx)(n.Z, {
                                                  className: "font-bold",
                                                  size: "sm",
                                                  color: "text-black-100 dark:text-white-100",
                                                  children: (0, f.jX)(e.lastUpdatedScore.toString())
                                                })
                                              ]
                                            }),
                                            (0, l.jsxs)("div", {
                                              className: "flex flex-col gap-1",
                                              children: [
                                                (0, l.jsx)(n.Z, { size: "xs", color: "text-gray-600 dark:text-gray-400", children: "Claimable rewards" }),
                                                (0, l.jsxs)(n.Z, {
                                                  size: "sm",
                                                  color: "text-green-600",
                                                  children: [
                                                    (0, l.jsx)("span", { className: "font-bold", children: (0, f.jX)(e.claimableReward.toString()) }),
                                                    "\xa0 INIT"
                                                  ]
                                                })
                                              ]
                                            })
                                          ]
                                        })
                                      ]
                                    }),
                                    (0, l.jsx)(i.O, { size: 20, className: "text-gray-400 dark:text-gray-600" })
                                  ]
                                },
                                e.name
                              )
                            )
                      ]
                    })
                  ]
                }),
                (0, l.jsx)(u.K, { isOpen: e, onClose: () => s(!1) }),
                (0, l.jsx)(p.d, { isOpen: a, onClose: () => t(!1) }),
                (0, l.jsx)(w.f, { isOpen: x, onClose: () => N(!1) }),
                (0, l.jsx)(j.u, { isOpen: k, onClose: () => v(!1) })
              ]
            });
          });
          t();
        } catch (e) {
          t(e);
        }
      });
    }
  }
]);
//# sourceMappingURL=5351.js.map
