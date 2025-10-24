!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      a = new e.Error().stack;
    a &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[a] = "a57b21ed-7121-4a5d-9e56-f6037c883c95"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-a57b21ed-7121-4a5d-9e56-f6037c883c95"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.22.9" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["9862"],
  {
    83763: function (e, a, n) {
      n.d(a, { Z: () => l });
      var i = n(52322);
      n(2784);
      var t = n(8282);
      let l = e =>
        (0, i.jsx)(t.Z5, {
          onDragEnd: e.onDragEnd,
          children: (0, i.jsx)(t.bK, {
            droppableId: "droppable",
            children: a => (0, i.jsxs)("div", { ...a.droppableProps, ref: a.innerRef, children: [e.children, a.placeholder] })
          })
        });
    },
    17061: function (e, a, n) {
      n.a(e, async function (e, i) {
        try {
          n.d(a, { T: () => v, X: () => y });
          var t = n(52322),
            l = n(75377),
            s = n(69816),
            r = n(71659),
            c = n(72059),
            d = n(36400),
            o = n(29750),
            h = n(75958),
            x = n(2784),
            u = n(8282),
            m = n(22850),
            f = n(49409),
            g = n(71198),
            p = e([c, d]);
          [c, d] = p.then ? (await p)() : p;
          let b = (0, h.Pi)(e => {
              var a;
              let { chain: n } = e,
                i = (0, d.pb)(),
                l = null === (a = i[n.chainName]) || void 0 === a ? void 0 : a.chainSymbolImageUrl;
              return (0, t.jsx)(t.Fragment, {
                children: (0, t.jsx)("div", {
                  className: "flex justify-between items-center px-4 bg-white-100 dark:bg-gray-900 cursor-pointer w-[344px] h-[76px] rounded-[16px]",
                  children: (0, t.jsxs)("div", {
                    className: "flex items-center flex-grow",
                    children: [
                      (0, t.jsx)("img", {
                        src: l ?? o.GenericLight,
                        alt: "custom icon",
                        width: "28",
                        height: "28",
                        className: "h-7 w-7 mr-3",
                        onError: (0, f._)(o.GenericLight)
                      }),
                      (0, t.jsxs)("div", {
                        className: "flex flex-col justify-center items-start",
                        children: [
                          (0, t.jsx)("div", {
                            className: "text-base font-bold text-black-100 dark:text-white-100 text-left max-w-[160px] text-ellipsis overflow-hidden text-xl",
                            children: n.chainName
                          }),
                          (0, t.jsx)("div", { className: "text-xs font-medium text-gray-400", children: (0, g.kC)(n.denom) })
                        ]
                      }),
                      (0, t.jsx)("div", { className: "flex flex-grow" }),
                      (0, t.jsx)("div", {
                        className: "flex flex-col justify-center items-end",
                        children: (0, t.jsx)("button", {
                          className: "text-sm font-bold text-red-300 py-1 px-3 rounded-[14px]",
                          style: { backgroundColor: "rgba(255, 112, 126, 0.1)" },
                          onClick: () => m.d.setChainInfo(n),
                          children: "Remove"
                        })
                      })
                    ]
                  })
                })
              });
            }),
            v = e => {
              let { chains: a, searchQuery: n, updateChainFunction: i } = e,
                [s, o] = (0, x.useState)(!1),
                h = (0, c.a7)(),
                m = (0, d.pb)(),
                f = (0, x.useMemo)(() => new r.default(a, { threshold: 0.3, keys: ["chainName"] }), [a]),
                p = (0, x.useMemo)(() => {
                  let e = n.trim();
                  return n ? f.search(e).map(e => e.item) : a;
                }, [n, a, f]);
              return (0, t.jsx)("div", {
                className: "rounded-2xl dark:bg-gray-900 bg-white-100",
                children: a
                  ? p.map((e, n) => {
                      var r;
                      let c = 0 === n,
                        d = n === a.length - 1,
                        x = m[e.chainName].chainSymbolImageUrl;
                      return (0, t.jsx)(
                        u._l,
                        {
                          draggableId: (null == e ? void 0 : null === (r = e.id) || void 0 === r ? void 0 : r.toString()) ?? n.toString(),
                          index: n,
                          children: a =>
                            (0, t.jsxs)("div", {
                              ref: a.innerRef,
                              ...a.draggableProps,
                              ...a.dragHandleProps,
                              children: [
                                (0, t.jsx)(l.ToggleCard, {
                                  imgSrc: x,
                                  isRounded: d || c,
                                  size: "lg",
                                  subtitle:
                                    s && h === e.chainName
                                      ? (0, t.jsx)("span", { style: { color: "#FF707E" }, children: "Cannot disable a chain in use" })
                                      : (0, g.kC)(e.denom),
                                  title: (0, g.kC)(e.chainName),
                                  onClick: () => {
                                    h === e.chainName ? o(!0) : (o(!1), i(e.chainName));
                                  },
                                  isEnabled: e.active
                                }),
                                d ? null : (0, t.jsx)(l.CardDivider, {})
                              ]
                            })
                        },
                        e.id ?? n
                      );
                    })
                  : null
              });
            },
            y = e => {
              let { chains: a, searchQuery: n, updateChainFunction: i, title: o } = e,
                [h, u] = (0, x.useState)(!1),
                m = (0, c.a7)(),
                f = (0, d.pb)(),
                p = (0, x.useMemo)(() => new r.default(a, { threshold: 0.3, keys: ["chainName"] }), [a]),
                v = (0, x.useMemo)(() => {
                  let e = n.trim();
                  return n ? p.search(e).map(e => e.item) : a;
                }, [n, a, p]);
              return (0, t.jsxs)("div", {
                className: "rounded-2xl dark:bg-gray-900 bg-white-100",
                children: [
                  o && (0, t.jsx)(s.Z, { size: "xs", className: "pt-[20px] px-4 text", children: o }),
                  a
                    ? v.map((e, a) => {
                        if (e.beta) return (0, t.jsx)(b, { chain: e });
                        let n = f[e.chainName].chainSymbolImageUrl,
                          s = a === v.length - 1;
                        return (0, t.jsx)(
                          l.ToggleCard,
                          {
                            imgSrc: n,
                            isRounded: s || 0 === a,
                            size: "lg",
                            subtitle:
                              h && m === e.chainName
                                ? (0, t.jsx)("span", { style: { color: "#FF707E" }, children: "Cannot disable a chain in use" })
                                : (0, g.kC)(e.denom),
                            title: (0, g.kC)(e.chainName),
                            onClick: () => {
                              m === e.chainName ? u(!0) : (u(!1), i(e.chainName));
                            },
                            isEnabled: e.active
                          },
                          a
                        );
                      })
                    : null
                ]
              });
            };
          i();
        } catch (e) {
          i(e);
        }
      });
    },
    61153: function (e, a, n) {
      n.a(e, async function (e, i) {
        try {
          n.r(a), n.d(a, { default: () => _ });
          var t = n(52322),
            l = n(75377),
            s = n(72465),
            r = n(14281),
            c = n(83763),
            d = n(17061),
            o = n(78454),
            h = n(87884),
            x = n(69816),
            u = n(53108),
            m = n(72059),
            f = n(10706),
            g = n(36400),
            p = n(30464),
            b = n(75958),
            v = n(2784),
            y = n(10289),
            w = n(22850),
            j = n(83275),
            N = n(46103),
            C = n(72565),
            k = n.n(C),
            I = e([m, g, f, o, d, j]);
          [m, g, f, o, d, j] = I.then ? (await I)() : I;
          let S = (e, a, n) => {
              let i = Array.from(e),
                [t] = i.splice(a, 1);
              return i.splice(n, 0, t), i;
            },
            E = (0, b.Pi)(e => {
              var a;
              let { defaultChain: n } = e,
                i = (0, m.N8)(),
                c = (0, g.oS)(),
                d = (0, g.pb)(),
                { activeWallet: o, setActiveWallet: h } = (0, f.ZP)(),
                p = (0, f.Af)(),
                b = async () => {
                  await k()
                    .storage.local.get([u.Pw])
                    .then(async e => {
                      var a, t, l;
                      let s = JSON.parse(e["beta-chains"]);
                      delete s[null === (a = w.d.chainInfo) || void 0 === a ? void 0 : a.chainName], await k().storage.local.set({ [u.Pw]: JSON.stringify(s) });
                      let r = { ...d };
                      delete r[null === (t = w.d.chainInfo) || void 0 === t ? void 0 : t.chainName], c(r);
                      let x = await p(o, null === (l = w.d.chainInfo) || void 0 === l ? void 0 : l.chainName, "DELETE");
                      await h(x[null == o ? void 0 : o.id]), i(n), w.d.setChainInfo(null);
                    });
                };
              return (0, t.jsx)(r.Z, {
                isOpen: !!w.d.chainInfo,
                onClose: () => w.d.setChainInfo(null),
                title: "Remove Chain?",
                children: (0, t.jsxs)("div", {
                  className: "flex flex-col gap-y-1",
                  children: [
                    (0, t.jsxs)("div", {
                      className: "text-center px-5",
                      children: [
                        (0, t.jsx)("div", {
                          className: "rounded-2xl bg-white-100 dark:bg-gray-800 p-[12px] w-[48px] h-[48px] text-red-300 mb-4",
                          children: (0, t.jsx)(s.S, { size: 24, className: "text-red-300" })
                        }),
                        (0, t.jsxs)(x.Z, {
                          size: "md",
                          color: "text-gray-800 dark:text-gray-200 font-medium",
                          children: ["Are you sure you want to remove ", null === (a = w.d.chainInfo) || void 0 === a ? void 0 : a.chainName, "?"]
                        })
                      ]
                    }),
                    (0, t.jsxs)("div", {
                      className: "flex flex-col justify-between w-full mt-7",
                      children: [
                        (0, t.jsx)(l.Buttons.Generic, {
                          style: { height: "48px", background: N.w.gray900, color: N.w.white100 },
                          className: "w-full",
                          onClick: b,
                          "aria-label": "remove chain button in manage chain flow",
                          children: (0, t.jsx)("span", { "aria-label": "remove chain button text in manage chain flow", children: "Remove" })
                        }),
                        (0, t.jsx)(l.Buttons.Generic, {
                          style: { height: "48px", background: N.w.cosmosPrimary, color: N.w.white100 },
                          className: "mt-3 bg-gray-800 w-full",
                          onClick: () => w.d.setChainInfo(null),
                          "aria-label": "don’t remove chain button in manage chain flow",
                          children: (0, t.jsx)("span", { "aria-label": "don’t remove chain button text in manage chain flow", children: "Don’t Remove" })
                        })
                      ]
                    })
                  ]
                })
              });
            }),
            _ = (0, b.Pi)(function () {
              let [e, a] = v.useState(""),
                n = (0, y.s0)(),
                i = j.t.chains.filter(e => !e.beta),
                s = j.t.chains.filter(e => e.beta).filter(a => a.chainName.toLowerCase().includes(e.toLowerCase())),
                r = async e => {
                  if (!e.destination) return;
                  let a = S(i, e.source.index, e.destination.index);
                  j.t.updatePreferenceOrder(a);
                };
              return (0, t.jsxs)("div", {
                className: "relative",
                children: [
                  (0, t.jsx)(o.Z, {
                    header: (0, t.jsx)(l.Header, {
                      title: "Manage chains",
                      action: {
                        onClick: () => {
                          n(-1);
                        },
                        type: l.HeaderActionType.BACK
                      }
                    }),
                    children: (0, t.jsxs)("div", {
                      className: "pt-[28px]",
                      children: [
                        (0, t.jsxs)("div", {
                          className: "mx-auto w-[344px] flex h-10 bg-white-100 dark:bg-gray-900 rounded-[30px] py-2 pl-5 pr-[10px]",
                          children: [
                            (0, t.jsx)("input", {
                              placeholder: "search chains...",
                              className: "flex flex-grow text-base text-gray-400 outline-none bg-white-0",
                              value: e,
                              onChange: e => a(e.target.value)
                            }),
                            0 === e.length
                              ? (0, t.jsx)("img", { src: p.r.Misc.Search })
                              : (0, t.jsx)("img", { className: "cursor-pointer", src: p.r.Misc.CrossFilled, onClick: () => a("") })
                          ]
                        }),
                        (0, t.jsxs)("div", {
                          className: "align-middle flex flex-col items-center justify-center mt-[20px] mb-10",
                          children: [
                            (0, t.jsxs)(c.Z, {
                              onDragEnd: r,
                              children: [
                                0 === i.filter(a => a.chainName.toLowerCase().includes(e.toLowerCase())).length && (0, t.jsx)(h.Z, { searchQuery: e }),
                                0 === e.length
                                  ? (0, t.jsx)(d.T, { chains: i, searchQuery: e, updateChainFunction: e => j.t.toggleChain(e) })
                                  : (0, t.jsx)(d.X, { chains: i, searchQuery: e, updateChainFunction: e => j.t.toggleChain(e) })
                              ]
                            }),
                            s.length > 0
                              ? (0, t.jsx)("div", {
                                  className: "mt-[16px]",
                                  children: (0, t.jsx)(d.X, {
                                    chains: s,
                                    searchQuery: e,
                                    updateChainFunction: e => j.t.toggleChain(e),
                                    title: "Recently added (Beta)"
                                  })
                                })
                              : null
                          ]
                        })
                      ]
                    })
                  }),
                  (0, t.jsx)(E, { defaultChain: j.t.chains["0"].chainName })
                ]
              });
            });
          i();
        } catch (e) {
          i(e);
        }
      });
    },
    22850: function (e, a, n) {
      n.d(a, { d: () => l });
      var i = n(93407),
        t = n(80075);
      let l = new (class {
        setChainInfo(e) {
          this.chainInfo = e;
        }
        constructor() {
          (0, i._)(this, "chainInfo", null), (0, t.ky)(this);
        }
      })();
    }
  }
]);
//# sourceMappingURL=9862.js.map
