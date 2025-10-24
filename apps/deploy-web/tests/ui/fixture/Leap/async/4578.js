!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "a968b8ac-83a4-41fe-b71f-24649a68b042"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-a968b8ac-83a4-41fe-b71f-24649a68b042"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.22.9" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["4578"],
  {
    45982: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { N: () => x });
          var l = a(41172),
            r = a(90332),
            i = a(55159),
            s = a(58551),
            o = a(2784),
            c = a(22014),
            d = a(72565),
            u = a.n(d),
            m = a(53108),
            p = e([s]);
          function x() {
            let e = (0, s.E)(),
              { setQueryPermits: t } = (0, l.WdY)(),
              { lcdUrl: a = "" } = (0, l.U9i)(),
              n = (0, l.xxU)();
            return (0, o.useCallback)(
              async (l, s) => {
                if (!c.M8.password) throw Error("Password not set");
                let o = await e(),
                  d = r.K.create(a, n, o),
                  p = (await u().storage.local.get([m.J$]))[m.J$],
                  x = null == p ? void 0 : p[l],
                  h = x ? (0, i.pe)(x, c.M8.password) : null,
                  f = [...(h ? JSON.parse(h) : { contracts: [] }).contracts];
                f.includes(s) || f.push(s);
                let g = await d.createQueryPermit(l, "permit", f, ["balance", "history"]),
                  y = e => {
                    if (!c.M8.password) throw Error("Password not set");
                    return { [l]: e ? (0, i.HI)(JSON.stringify({ contracts: f, permit: g }), c.M8.password) : { contracts: f, permit: g } };
                  };
                return t(y(!1)), await u().storage.local.set({ [m.J$]: y(!0) }), g;
              },
              [n, e, a, t]
            );
          }
          (s = (p.then ? (await p)() : p)[0]), n();
        } catch (e) {
          n(e);
        }
      });
    },
    85406: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { a: () => h, u: () => x });
          var l = a(41172),
            r = a(15969),
            i = a(55159),
            s = a(2784),
            o = a(22014),
            c = a(72565),
            d = a.n(c),
            u = a(53108),
            m = a(58551),
            p = e([m]);
          async function x(e, t, a, n) {
            let l = r.tgY.create(e, r.oCA.secret.chainId, n);
            return !!(await l.getBalance(n, a, t)).balance;
          }
          function h() {
            let e = (0, m.E)(),
              t = (0, l.VMC)(),
              a = l.rNU.useOperateCosmosTx(),
              { setViewingKeys: n } = (0, l.WdY)();
            return (0, s.useCallback)(
              async (s, c, m, p, h, f) => {
                if (!o.M8.password) throw Error("Password not set");
                let g = await e(),
                  y = r.KQf.create(s ?? "", c, g),
                  b = null == f ? void 0 : f.key;
                if (h) {
                  if (!(await x(s ?? "", b ?? "", p, m))) return { validKey: !1, error: "Invalid viewing key", key: b };
                } else
                  try {
                    var v, w, j, k, H;
                    let { txStatus: e, viewingKey: n } = await y.createViewingKey(m, p, t, {
                      key: b,
                      gasLimit: null == f ? void 0 : f.gasLimit,
                      feeDenom: null == f ? void 0 : f.feeDenom
                    });
                    if (0 !== e.code) return { validKey: !1, error: e.rawLog };
                    a({
                      txHash: e.transactionHash,
                      txType: l.pb0.SecretTokenTransaction,
                      metadata: { contract: p },
                      feeDenomination: "uscrt",
                      feeQuantity:
                        (null === (H = e.tx) || void 0 === H
                          ? void 0
                          : null === (k = H.auth_info) || void 0 === k
                            ? void 0
                            : null === (j = k.fee) || void 0 === j
                              ? void 0
                              : null === (w = j.amount) || void 0 === w
                                ? void 0
                                : null === (v = w[0]) || void 0 === v
                                  ? void 0
                                  : v.amount) ?? "0.01",
                      chainId: c
                    }),
                      (b = n);
                  } catch (e) {
                    return { validKey: !1, error: "Unable to create viewing key" };
                  }
                let C = (0, i.HI)(b, o.M8.password),
                  Z = (await d().storage.local.get([u.rg]))[u.rg];
                if (Z) {
                  let e = e => ({ ...Z, [m]: { ...Z[m], [p]: e ? C : b } });
                  await d().storage.local.set({ [u.rg]: e(!0) }), n(e(!1));
                } else {
                  let e = e => ({ [m]: { [p]: e ? C : b } });
                  await d().storage.local.set({ [u.rg]: e(!0) }), n(e(!1));
                }
                return { validKey: !0, error: null, key: b };
              },
              [e, t, a, n]
            );
          }
          (m = (p.then ? (await p)() : p)[0]), n();
        } catch (e) {
          n(e);
        }
      });
    },
    58551: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { E: () => o });
          var l = a(2784),
            r = a(22014),
            i = a(65027),
            s = e([i]);
          function o() {
            let e = i.w.useGetWallet();
            return (0, l.useCallback)(async () => {
              if (!r.M8.password) throw Error("Password not set");
              return await e();
            }, [e]);
          }
          (i = (s.then ? (await s)() : s)[0]), n();
        } catch (e) {
          n(e);
        }
      });
    },
    31123: function (e, t, a) {
      a.d(t, { p: () => P });
      var n = a(52322),
        l = a(75377),
        r = a(11868),
        i = a(89187),
        s = a(2784),
        o = a(6806);
      let c = new Map([
        [
          "bold",
          s.createElement(
            s.Fragment,
            null,
            s.createElement("path", {
              d: "M230.14,70.54,185.46,25.85a20,20,0,0,0-28.29,0L33.86,149.17A19.85,19.85,0,0,0,28,163.31V208a20,20,0,0,0,20,20H92.69a19.86,19.86,0,0,0,14.14-5.86L230.14,98.82a20,20,0,0,0,0-28.28ZM91,204H52V165l84-84,39,39ZM192,103,153,64l18.34-18.34,39,39Z"
            })
          )
        ],
        [
          "duotone",
          s.createElement(
            s.Fragment,
            null,
            s.createElement("path", { d: "M221.66,90.34,192,120,136,64l29.66-29.66a8,8,0,0,1,11.31,0L221.66,79A8,8,0,0,1,221.66,90.34Z", opacity: "0.2" }),
            s.createElement("path", {
              d: "M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.31,64l24-24L216,84.68Z"
            })
          )
        ],
        [
          "fill",
          s.createElement(
            s.Fragment,
            null,
            s.createElement("path", {
              d: "M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM192,108.68,147.31,64l24-24L216,84.68Z"
            })
          )
        ],
        [
          "light",
          s.createElement(
            s.Fragment,
            null,
            s.createElement("path", {
              d: "M225.9,74.78,181.21,30.09a14,14,0,0,0-19.8,0L38.1,153.41a13.94,13.94,0,0,0-4.1,9.9V208a14,14,0,0,0,14,14H92.69a13.94,13.94,0,0,0,9.9-4.1L225.9,94.58a14,14,0,0,0,0-19.8ZM94.1,209.41a2,2,0,0,1-1.41.59H48a2,2,0,0,1-2-2V163.31a2,2,0,0,1,.59-1.41L136,72.48,183.51,120ZM217.41,86.1,192,111.51,144.49,64,169.9,38.58a2,2,0,0,1,2.83,0l44.68,44.69a2,2,0,0,1,0,2.83Z"
            })
          )
        ],
        [
          "regular",
          s.createElement(
            s.Fragment,
            null,
            s.createElement("path", {
              d: "M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.31,64l24-24L216,84.68Z"
            })
          )
        ],
        [
          "thin",
          s.createElement(
            s.Fragment,
            null,
            s.createElement("path", {
              d: "M224.49,76.2,179.8,31.51a12,12,0,0,0-17,0L133.17,61.17h0L39.52,154.83A11.9,11.9,0,0,0,36,163.31V208a12,12,0,0,0,12,12H92.69a12,12,0,0,0,8.48-3.51L224.48,93.17a12,12,0,0,0,0-17Zm-129,134.63A4,4,0,0,1,92.69,212H48a4,4,0,0,1-4-4V163.31a4,4,0,0,1,1.17-2.83L136,69.65,186.34,120ZM218.83,87.51,192,114.34,141.66,64l26.82-26.83a4,4,0,0,1,5.66,0l44.69,44.68a4,4,0,0,1,0,5.66Z"
            })
          )
        ]
      ]);
      var d = Object.defineProperty,
        u = Object.defineProperties,
        m = Object.getOwnPropertyDescriptors,
        p = Object.getOwnPropertySymbols,
        x = Object.prototype.hasOwnProperty,
        h = Object.prototype.propertyIsEnumerable,
        f = (e, t, a) => (t in e ? d(e, t, { enumerable: !0, configurable: !0, writable: !0, value: a }) : (e[t] = a)),
        g = (e, t) => {
          for (var a in t || (t = {})) x.call(t, a) && f(e, a, t[a]);
          if (p) for (var a of p(t)) h.call(t, a) && f(e, a, t[a]);
          return e;
        },
        y = (e, t) => u(e, m(t));
      let b = (0, s.forwardRef)((e, t) => s.createElement(o.Z, y(g({ ref: t }, e), { weights: c })));
      b.displayName = "PencilSimple";
      let v = new Map([
        [
          "bold",
          s.createElement(
            s.Fragment,
            null,
            s.createElement("path", {
              d: "M172,164a12,12,0,0,1-12,12H96a12,12,0,0,1,0-24h64A12,12,0,0,1,172,164Zm-12-52H96a12,12,0,0,0,0,24h64a12,12,0,0,0,0-24Zm60-64V216a20,20,0,0,1-20,20H56a20,20,0,0,1-20-20V48A20,20,0,0,1,56,28H90.53a51.88,51.88,0,0,1,74.94,0H200A20,20,0,0,1,220,48ZM100.29,60h55.42a28,28,0,0,0-55.42,0ZM196,52H178.59A52.13,52.13,0,0,1,180,64v8a12,12,0,0,1-12,12H88A12,12,0,0,1,76,72V64a52.13,52.13,0,0,1,1.41-12H60V212H196Z"
            })
          )
        ],
        [
          "duotone",
          s.createElement(
            s.Fragment,
            null,
            s.createElement("path", {
              d: "M208,48V216a8,8,0,0,1-8,8H56a8,8,0,0,1-8-8V48a8,8,0,0,1,8-8H96a39.83,39.83,0,0,0-8,24v8h80V64a39.83,39.83,0,0,0-8-24h40A8,8,0,0,1,208,48Z",
              opacity: "0.2"
            }),
            s.createElement("path", {
              d: "M168,152a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,152Zm-8-40H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16Zm56-64V216a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V48A16,16,0,0,1,56,32H92.26a47.92,47.92,0,0,1,71.48,0H200A16,16,0,0,1,216,48ZM96,64h64a32,32,0,0,0-64,0ZM200,48H173.25A47.93,47.93,0,0,1,176,64v8a8,8,0,0,1-8,8H88a8,8,0,0,1-8-8V64a47.93,47.93,0,0,1,2.75-16H56V216H200Z"
            })
          )
        ],
        [
          "fill",
          s.createElement(
            s.Fragment,
            null,
            s.createElement("path", {
              d: "M200,32H163.74a47.92,47.92,0,0,0-71.48,0H56A16,16,0,0,0,40,48V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V48A16,16,0,0,0,200,32Zm-72,0a32,32,0,0,1,32,32H96A32,32,0,0,1,128,32Zm32,128H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Zm0-32H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Z"
            })
          )
        ],
        [
          "light",
          s.createElement(
            s.Fragment,
            null,
            s.createElement("path", {
              d: "M166,152a6,6,0,0,1-6,6H96a6,6,0,0,1,0-12h64A6,6,0,0,1,166,152Zm-6-38H96a6,6,0,0,0,0,12h64a6,6,0,0,0,0-12Zm54-66V216a14,14,0,0,1-14,14H56a14,14,0,0,1-14-14V48A14,14,0,0,1,56,34H93.17a45.91,45.91,0,0,1,69.66,0H200A14,14,0,0,1,214,48ZM94,64v2h68V64a34,34,0,0,0-68,0ZM202,48a2,2,0,0,0-2-2H170.33A45.77,45.77,0,0,1,174,64v8a6,6,0,0,1-6,6H88a6,6,0,0,1-6-6V64a45.77,45.77,0,0,1,3.67-18H56a2,2,0,0,0-2,2V216a2,2,0,0,0,2,2H200a2,2,0,0,0,2-2Z"
            })
          )
        ],
        [
          "regular",
          s.createElement(
            s.Fragment,
            null,
            s.createElement("path", {
              d: "M168,152a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,152Zm-8-40H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16Zm56-64V216a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V48A16,16,0,0,1,56,32H92.26a47.92,47.92,0,0,1,71.48,0H200A16,16,0,0,1,216,48ZM96,64h64a32,32,0,0,0-64,0ZM200,48H173.25A47.93,47.93,0,0,1,176,64v8a8,8,0,0,1-8,8H88a8,8,0,0,1-8-8V64a47.93,47.93,0,0,1,2.75-16H56V216H200Z"
            })
          )
        ],
        [
          "thin",
          s.createElement(
            s.Fragment,
            null,
            s.createElement("path", {
              d: "M164,152a4,4,0,0,1-4,4H96a4,4,0,0,1,0-8h64A4,4,0,0,1,164,152Zm-4-36H96a4,4,0,0,0,0,8h64a4,4,0,0,0,0-8Zm52-68V216a12,12,0,0,1-12,12H56a12,12,0,0,1-12-12V48A12,12,0,0,1,56,36H94.08a44,44,0,0,1,67.84,0H200A12,12,0,0,1,212,48ZM92,64v4h72V64a36,36,0,0,0-72,0ZM204,48a4,4,0,0,0-4-4H167.17A43.71,43.71,0,0,1,172,64v8a4,4,0,0,1-4,4H88a4,4,0,0,1-4-4V64a43.71,43.71,0,0,1,4.83-20H56a4,4,0,0,0-4,4V216a4,4,0,0,0,4,4H200a4,4,0,0,0,4-4Z"
            })
          )
        ]
      ]);
      var w = Object.defineProperty,
        j = Object.defineProperties,
        k = Object.getOwnPropertyDescriptors,
        H = Object.getOwnPropertySymbols,
        C = Object.prototype.hasOwnProperty,
        Z = Object.prototype.propertyIsEnumerable,
        E = (e, t, a) => (t in e ? w(e, t, { enumerable: !0, configurable: !0, writable: !0, value: a }) : (e[t] = a)),
        N = (e, t) => {
          for (var a in t || (t = {})) C.call(t, a) && E(e, a, t[a]);
          if (H) for (var a of H(t)) Z.call(t, a) && E(e, a, t[a]);
          return e;
        },
        A = (e, t) => j(e, k(t));
      let V = (0, s.forwardRef)((e, t) => s.createElement(o.Z, A(N({ ref: t }, e), { weights: v })));
      V.displayName = "ClipboardText";
      var M = a(14281),
        S = a(69816),
        L = a(57124);
      function P(e) {
        let { isVisible: t, onClose: a, token: s, onCreateViewingKey: o, onUpdateViewingKey: c, onImportViewingKey: d } = e,
          u = (0, L.a)();
        return (0, n.jsx)(M.Z, {
          isOpen: t,
          onClose: a,
          title: "Add Token",
          children: (0, n.jsxs)("div", {
            children: [
              (0, n.jsxs)("div", {
                className: "mb-4 px-5",
                children: [
                  (0, n.jsxs)("div", {
                    className: "flex items-center",
                    children: [
                      (0, n.jsx)("img", { src: (null == s ? void 0 : s.icon) === "" ? u : null == s ? void 0 : s.icon, className: "h-[32px] w-[32px] mr-3" }),
                      (0, n.jsx)(S.Z, { size: "xxl", children: null == s ? void 0 : s.symbol })
                    ]
                  }),
                  (0, n.jsx)(S.Z, { size: "md", className: "font-bold text-gray-200", children: null == s ? void 0 : s.name })
                ]
              }),
              (0, n.jsxs)("div", {
                children: [
                  (0, n.jsx)(l.GenericCard, {
                    onClick: () => o(),
                    className: "rounded-t-2xl",
                    title: (null == s ? void 0 : s.snip24Enabled) ? "Create query permit" : "Create new key",
                    img: (0, n.jsx)(r.F, { size: 16, className: "text-gray-400 mr-3" }),
                    icon: (0, n.jsx)(i.T, { size: 16, className: "text-gray-400" })
                  }),
                  (0, n.jsx)(l.CardDivider, {}),
                  (0, n.jsx)(l.GenericCard, {
                    onClick: () => c(),
                    title: "Update key",
                    img: (0, n.jsx)(b, { size: 16, className: "text-gray-400 mr-3" }),
                    icon: (0, n.jsx)(i.T, { size: 16, className: "text-gray-400" })
                  }),
                  (0, n.jsx)(l.CardDivider, {}),
                  (0, n.jsx)(l.GenericCard, {
                    onClick: () => {
                      d();
                    },
                    className: "rounded-b-2xl",
                    title: (0, n.jsx)(S.Z, { size: "md", children: "Import key" }),
                    img: (0, n.jsx)(V, { size: 16, className: "text-gray-400 mr-3" }),
                    icon: (0, n.jsx)(i.T, { size: 16, className: "text-gray-400" })
                  })
                ]
              })
            ]
          })
        });
      }
    },
    61951: function (e, t, a) {
      a.d(t, { G: () => c });
      var n = a(52322),
        l = a(41172),
        r = a(75377),
        i = a(36906),
        s = a(69816);
      a(2784);
      var o = a(46103);
      function c(e) {
        let t = (0, l.a74)();
        return (0, n.jsxs)("div", {
          children: [
            (0, n.jsxs)("div", {
              className: "flex items-center justify-center bg-white-100 dark:bg-gray-900 p-3 rounded-2xl mb-4",
              children: [
                (0, n.jsx)(i.k, { size: 16, className: "text-indigo-300 mr-3" }),
                (0, n.jsx)(s.Z, { size: "md", className: "font-bold text-center", children: "Note down the viewing key" })
              ]
            }),
            (0, n.jsx)("div", {
              className: "flex items-center bg-white-100 dark:bg-gray-900 p-4 rounded-2xl justify-center",
              children: (0, n.jsx)(s.Z, { size: "md", className: "text-center font-bold", children: (0, l.MDB)(e.generatedViewingKey ?? "") })
            }),
            (0, n.jsx)(r.Buttons.CopyToClipboard, { color: o.w.getChainColor(t), onCopy: e.onCopy })
          ]
        });
      }
    },
    89369: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { L: () => j });
          var l = a(52322),
            r = a(41172),
            i = a(75377),
            s = a(14281),
            o = a(86200),
            c = a(19623),
            d = a(69816),
            u = a(45982),
            m = a(85406),
            p = a(57124),
            x = a(2784),
            h = a(42799),
            f = a(48346),
            g = a(46103),
            y = a(53221),
            b = a(69547),
            v = a(18403),
            w = e([m, u, b, f, v]);
          function j(e) {
            let { isVisible: t, onClose: a, token: n, onSuccess: w } = e,
              j = (0, p.a)(),
              [k, H] = (0, x.useState)(null),
              [C, Z] = (0, x.useState)(!1),
              E = (0, m.a)(),
              N = (0, u.N)(),
              [A, V] = (0, x.useState)(null),
              M = (0, r.SFn)(),
              { lcdUrl: S } = (0, r.U9i)("secret"),
              L = (0, r.xxU)(),
              P = (0, r.DI5)(),
              { setContractAddress: O, userPreferredGasLimit: D, userPreferredGasPrice: F } = (0, b.F)();
            (0, x.useEffect)(() => {
              (null == n ? void 0 : n.contractAddr) && O(n.contractAddr);
            }, [null == n ? void 0 : n.contractAddr]);
            let T = (0, x.useCallback)(() => {
                H(null), Z(!1), a();
              }, [a]),
              G = (0, x.useCallback)(async () => {
                if ((Z(!0), null == n ? void 0 : n.snip24Enabled)) N(M, n.contractAddr), T(), w();
                else if (k) T(), w();
                else {
                  let { error: e, key: t } = await E(S ?? P.secret.apis.rest ?? "", L ?? "secret-4", M, null == n ? void 0 : n.contractAddr, !1, {
                    gasLimit: D,
                    feeDenom: null == F ? void 0 : F.denom,
                    gasPriceStep: Number((null == F ? void 0 : F.amount) ?? 0)
                  });
                  e ? (V(e), Z(!1)) : (Z(!1), H(t));
                }
              }, [
                M,
                L,
                P.secret.apis.rest,
                T,
                N,
                E,
                k,
                S,
                w,
                null == n ? void 0 : n.contractAddr,
                null == n ? void 0 : n.snip24Enabled,
                D,
                null == F ? void 0 : F.amount,
                null == F ? void 0 : F.denom
              ]);
            return (0, l.jsx)(s.Z, {
              isOpen: t,
              onClose: T,
              title: (null == n ? void 0 : n.snip24Enabled) ? "Create query permit" : "Create Viewing Key",
              children: (0, l.jsxs)("div", {
                children: [
                  (0, l.jsxs)("div", {
                    className: "py-5 rounded-2xl bg-white-100 dark:bg-gray-900 mb-4",
                    children: [
                      (0, l.jsx)(d.Z, {
                        size: "xs",
                        className: "font-bold px-5",
                        color: "text-gray-200",
                        children: (null == n ? void 0 : n.snip24Enabled) ? "Create query permit" : "Create Viewing Key"
                      }),
                      (0, l.jsx)(i.GenericCard, {
                        className: "w-[300px] px-0",
                        title: null == n ? void 0 : n.symbol,
                        subtitle: null == n ? void 0 : n.name,
                        img: (0, l.jsx)("img", {
                          src: (null == n ? void 0 : n.icon) === "" ? j : null == n ? void 0 : n.icon,
                          className: "w-[40px] h-[40px] mr-3"
                        })
                      })
                    ]
                  }),
                  k || (null == n ? void 0 : n.snip24Enabled) ? null : (0, l.jsx)(v.at, { rootDenomsStore: h.gb, rootBalanceStore: f.jZ }),
                  k
                    ? (0, l.jsx)(v.GR, {
                        generatedViewingKey: k,
                        onCopy: async () => {
                          await y.i.copyText(k);
                        }
                      })
                    : null,
                  A ? (0, l.jsx)("div", { className: "mb-2", children: (0, l.jsx)(o._, { text: A }) }) : null,
                  C
                    ? (0, l.jsx)("div", { className: "flex justify-center w-[344px]", children: (0, l.jsx)(c.T, { color: g.w.white100 }) })
                    : (0, l.jsx)(i.Buttons.Generic, {
                        size: "normal",
                        color: "#E18881",
                        className: "w-[344px]",
                        onClick: G,
                        "aria-label": "create key sheet confirm button in snip20 manage tokens flow",
                        children: k
                          ? (0, l.jsx)("span", { "aria-label": "create key sheet confirm button text in snip20 manage tokens flow", children: "Done" })
                          : (0, l.jsx)("span", { "aria-label": "create key sheet confirm button text in snip20 manage tokens flow", children: "Confirm" })
                      })
                ]
              })
            });
          }
          ([m, u, b, f, v] = w.then ? (await w)() : w), n();
        } catch (e) {
          n(e);
        }
      });
    },
    91632: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { a: () => m });
          var l = a(52322),
            r = a(58885),
            i = a(51994),
            s = a(80588),
            o = a(75958),
            c = a(2784),
            d = a(69547),
            u = e([d, r, i, s]);
          [d, r, i, s] = u.then ? (await u)() : u;
          let m = (0, o.Pi)(e => {
            let { rootDenomsStore: t, rootBalanceStore: a } = e,
              {
                gasOption: n,
                userPreferredGasLimit: o,
                userPreferredGasPrice: u,
                setGasOption: m,
                setUserPreferredGasPrice: p,
                setUserPreferredGasLimit: x,
                setGasError: h,
                recommendedGasLimit: f,
                gasError: g
              } = (0, d.F)(),
              y = t.allDenoms,
              b = (0, r.e7)(y),
              [v, w] = (0, c.useState)(!1),
              [j, k] = (0, c.useState)({ option: n, gasPrice: u ?? b.gasPrice }),
              H = (0, c.useCallback)(() => {
                w(!1);
              }, []),
              C = (0, c.useCallback)(e => {
                k(e);
              }, []);
            return (
              (0, c.useEffect)(() => {
                k({ option: n, gasPrice: b.gasPrice });
              }, [b.gasPrice]),
              (0, c.useEffect)(() => {
                m(j.option), p(j.gasPrice);
              }, [j, m, p]),
              (0, l.jsx)("div", {
                className: "mb-4",
                children: (0, l.jsxs)(r.ZP, {
                  recommendedGasLimit: f.toString(),
                  gasLimit: (null == o ? void 0 : o.toString()) ?? f.toString(),
                  setGasLimit: e => x(Number(e.toString())),
                  gasPriceOption: j,
                  onGasPriceOptionChange: C,
                  error: g,
                  setError: h,
                  rootBalanceStore: a,
                  rootDenomsStore: t,
                  children: [
                    (0, l.jsx)(i.a, { setShowFeesSettingSheet: w }),
                    g && !v ? (0, l.jsx)("p", { className: "text-red-300 text-sm font-medium mt-2 text-center", children: g }) : null,
                    (0, l.jsx)(s.k, { showFeesSettingSheet: v, onClose: H, gasError: g })
                  ]
                })
              })
            );
          });
          n();
        } catch (e) {
          n(e);
        }
      });
    },
    8659: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { i: () => v });
          var l = a(52322),
            r = a(41172),
            i = a(75377),
            s = a(14281),
            o = a(86200),
            c = a(19623),
            d = a(85406),
            u = a(57124),
            m = a(2784),
            p = a(42799),
            x = a(48346),
            h = a(46103),
            f = a(53221),
            g = a(69547),
            y = a(18403),
            b = e([d, g, x, y]);
          function v(e) {
            let { isVisible: t, onClose: a, type: n, token: b, onSuccess: v } = e,
              w = (0, u.a)(),
              [j, k] = (0, m.useState)(!1),
              [H, C] = (0, m.useState)(""),
              [Z, E] = (0, m.useState)(null),
              N = (0, d.a)(),
              [A, V] = (0, m.useState)(!1),
              M = (0, r.SFn)(),
              { lcdUrl: S } = (0, r.U9i)("secret"),
              L = (0, r.xxU)(),
              P = (0, m.useRef)(null),
              { setContractAddress: O, userPreferredGasLimit: D, userPreferredGasPrice: F } = (0, g.F)();
            (0, m.useEffect)(() => {
              (null == b ? void 0 : b.contractAddr) && O(b.contractAddr);
            }, [null == b ? void 0 : b.contractAddr]),
              (0, m.useEffect)(() => {
                (null == P ? void 0 : P.current) && P.current.focus();
              }, [P]);
            let T = (0, m.useCallback)(() => {
                k(!1), E(null), C(""), V(!1), a();
              }, [a]),
              G = (0, m.useCallback)(async () => {
                if (A) v(), T();
                else {
                  k(!0);
                  let e = await N(S ?? "", L ?? "", M, null == b ? void 0 : b.contractAddr, "import" === n, {
                    key: H,
                    gasLimit: D,
                    feeDenom: null == F ? void 0 : F.denom,
                    gasPriceStep: Number((null == F ? void 0 : F.amount) ?? 0)
                  });
                  e.error ? E(e.error) : V(!0), k(!1);
                }
              }, [M, L, T, N, H, S, v, A, null == b ? void 0 : b.contractAddr, n, D, null == F ? void 0 : F.amount, null == F ? void 0 : F.denom]);
            return (0, l.jsx)(s.Z, {
              isOpen: t,
              onClose: T,
              title: "import" === n ? "Import viewing key" : "Update viewing key",
              children: (0, l.jsxs)("div", {
                children: [
                  (0, l.jsx)(i.GenericCard, {
                    className: "rounded-2xl mb-4 p-4",
                    title: null == b ? void 0 : b.symbol,
                    subtitle: null == b ? void 0 : b.name,
                    img: (0, l.jsx)("img", { src: (null == b ? void 0 : b.icon) === "" ? w : null == b ? void 0 : b.icon, className: "w-[40px] h-[40px] mr-4" })
                  }),
                  (0, l.jsx)(i.Input, {
                    onChange: e => {
                      C(e.target.value), E(null);
                    },
                    placeholder: "enter key",
                    className: "mb-4 w-[344px]",
                    ref: P
                  }),
                  "import" === n || A ? null : (0, l.jsx)(y.at, { rootDenomsStore: p.gb, rootBalanceStore: x.jZ }),
                  Z ? (0, l.jsx)("div", { className: "mb-2", children: (0, l.jsx)(o._, { text: Z, className: "mb-4" }) }) : null,
                  A
                    ? (0, l.jsx)(y.GR, {
                        generatedViewingKey: H,
                        onCopy: async () => {
                          f.i.copyText(H);
                        }
                      })
                    : null,
                  j
                    ? (0, l.jsx)("div", { className: "flex justify-center w-[344px]", children: (0, l.jsx)(c.T, { color: h.w.white100 }) })
                    : (0, l.jsx)(i.Buttons.Generic, {
                        size: "normal",
                        color: "#E18881",
                        disabled: !H || !!Z,
                        className: "w-[344px]",
                        onClick: G,
                        "aria-label": "import key sheet confirm button in snip20 manage tokens flow",
                        children: A
                          ? (0, l.jsx)("span", { "aria-label": "import key sheet confirm button text in snip20 manage tokens flow", children: "Done" })
                          : (0, l.jsx)("span", { "aria-label": "import key sheet confirm button text in snip20 manage tokens flow", children: "Confirm" })
                      })
                ]
              })
            });
          }
          ([d, g, x, y] = b.then ? (await b)() : b), n();
        } catch (e) {
          n(e);
        }
      });
    },
    18403: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { GR: () => r.G, LV: () => i.L, at: () => s.a, i3: () => o.i, pt: () => l.p });
          var l = a(31123),
            r = a(61951),
            i = a(89369),
            s = a(91632),
            o = a(8659),
            c = e([i, s, o]);
          ([i, s, o] = c.then ? (await c)() : c), n();
        } catch (e) {
          n(e);
        }
      });
    },
    69547: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { F: () => u, w: () => d });
          var l = a(52322),
            r = a(41172),
            i = a(58551),
            s = a(2784),
            o = a(44818),
            c = e([i]);
          i = (c.then ? (await c)() : c)[0];
          let m = (0, s.createContext)(null);
          function d(e) {
            let { children: t } = e,
              a = (0, i.E)(),
              n = (0, r.faj)({ getWallet: a }),
              o = (0, s.useMemo)(() => ({ ...n }), [n]);
            return (0, l.jsx)(m.Provider, { value: o, children: t });
          }
          function u() {
            let e = (0, s.useContext)(m);
            return (0, o.h)(null !== e, "useSnip20ManageTokens must be used within SendContextProvider"), e;
          }
          n();
        } catch (e) {
          n(e);
        }
      });
    },
    6754: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.r(t), a.d(t, { default: () => w });
          var l = a(52322),
            r = a(41172),
            i = a(75377),
            s = a(29049),
            o = a(72779),
            c = a.n(o),
            d = a(27963),
            u = a(78454),
            m = a(42941),
            p = a(57124),
            x = a(30464),
            h = a(2784),
            f = a(10289),
            g = a(71198),
            y = a(18403),
            b = a(69547),
            v = e([b, u, y]);
          function w() {
            let e = (0, p.a)(),
              t = (0, f.s0)(),
              [a, n] = (0, h.useState)(""),
              [o, v] = (0, h.useState)(!1),
              [w, j] = (0, h.useState)(null),
              [k, H] = (0, h.useState)(!1),
              [C, Z] = (0, h.useState)(!1),
              [E, N] = (0, h.useState)(!1),
              A = (0, m.Z)().get("contractAddress") ?? void 0,
              { secretTokens: V } = (0, r.X0D)(),
              M = e => {
                j(e), v(!0);
              };
            (0, h.useEffect)(() => {
              A && V[A] && (M({ ...V[A], contractAddr: A }), v(!0));
            }, [A, V]);
            let S = (0, h.useMemo)(
                () =>
                  Object.entries(V)
                    .filter(e => {
                      let [t, n] = e,
                        l = a.toUpperCase();
                      return t.toUpperCase().includes(l) || n.name.toUpperCase().includes(l) || n.symbol.toUpperCase().includes(l);
                    })
                    .map(e => {
                      let [t, a] = e;
                      return { ...a, contractAddr: t };
                    }),
                [a]
              ),
              L = (0, h.useCallback)(() => {
                H(!1), Z(!1), N(!1), v(!1), j(null);
              }, []),
              P = (0, h.useCallback)(() => {
                N(!1), Z(!1);
              }, []),
              O = (0, h.useCallback)(() => L(), [L]),
              D = (0, h.useCallback)(() => H(!1), []);
            return (0, l.jsx)(b.w, {
              children: (0, l.jsxs)("div", {
                className: "relative w-full overflow-clip panel-height",
                children: [
                  (0, l.jsx)(u.Z, {
                    header: (0, l.jsx)(i.Header, { action: { onClick: () => t(-1), type: i.HeaderActionType.BACK }, title: "Manage Tokens" }),
                    children: (0, l.jsxs)("div", {
                      className: "w-full flex flex-col pt-6 pb-2 px-7 sticky top-[72px] bg-gray-50 dark:bg-black-100",
                      children: [
                        (0, l.jsxs)("div", {
                          className: "w-[344px] flex h-10 bg-white-100 dark:bg-gray-900 rounded-[30px]  mb-4 py-2 pl-5 pr-[10px]",
                          children: [
                            (0, l.jsx)("input", {
                              placeholder: "search tokens",
                              className: "flex flex-grow text-base text-gray-600 dark:text-gray-200  outline-none bg-white-0",
                              onChange: e => {
                                n(e.target.value);
                              }
                            }),
                            (0, l.jsx)("img", { src: x.r.Misc.Search })
                          ]
                        }),
                        (0, l.jsxs)("div", {
                          className: "overflow-y-auto pb-20",
                          children: [
                            0 === S.length
                              ? (0, l.jsx)(d.S, {
                                  isRounded: !0,
                                  subHeading: a ? "Please try again with something else" : "",
                                  heading: a ? "No results for “" + (0, g.jr)(a) + "”" : "No Tokens",
                                  src: x.r.Misc.Explore
                                })
                              : null,
                            (0, l.jsx)("div", {
                              className: "rounded-2xl flex flex-col items-center mx-7 m-auto justify-center dark:bg-gray-900 bg-white-100",
                              children: S.map((t, a, n) => {
                                let r = a === n.length - 1;
                                return (0, l.jsxs)(
                                  h.Fragment,
                                  {
                                    children: [
                                      (0, l.jsx)(i.GenericCard, {
                                        onClick: () => M(t),
                                        className: c()({ "rounded-t-2xl": 0 === a, "rounded-b-2xl": r }),
                                        title: t.symbol,
                                        subtitle: t.name,
                                        icon: (0, l.jsx)(s.v, { size: 16, className: "text-gray-400" }),
                                        img: (0, l.jsx)("img", { src: "" === t.icon ? e : t.icon, className: "w-[28px] h-[28px] mr-2" })
                                      }),
                                      r ? null : (0, l.jsx)(i.CardDivider, {})
                                    ]
                                  },
                                  t.contractAddr
                                );
                              })
                            })
                          ]
                        })
                      ]
                    })
                  }),
                  (0, l.jsx)(y.pt, {
                    isVisible: o,
                    onClose: () => v(!1),
                    onCreateViewingKey: () => H(!0),
                    onUpdateViewingKey: () => Z(!0),
                    onImportViewingKey: () => N(!0),
                    token: w ?? void 0
                  }),
                  (0, l.jsx)(y.LV, { isVisible: k, onClose: D, token: w ?? void 0, onSuccess: O }),
                  (0, l.jsx)(y.i3, { isVisible: E || C, onClose: P, type: E ? "import" : "update", token: w ?? void 0, onSuccess: O })
                ]
              })
            });
          }
          ([b, u, y] = v.then ? (await v)() : v), n();
        } catch (e) {
          n(e);
        }
      });
    }
  }
]);
//# sourceMappingURL=4578.js.map
