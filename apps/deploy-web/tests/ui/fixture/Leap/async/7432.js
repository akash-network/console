!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "c6243ebd-e5dd-4fd8-8b94-29ef86a686bf"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-c6243ebd-e5dd-4fd8-8b94-29ef86a686bf"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.23.1" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["7432"],
  {
    36255: function (e, t, a) {
      a.a(e, async function (e, l) {
        try {
          a.d(t, { n: () => f });
          var n = a(52322),
            r = a(15969),
            s = a(4370),
            o = a(53542),
            d = a(91729),
            i = a(2784),
            c = e([o]);
          o = (c.then ? (await c)() : c)[0];
          let f = e => {
            let { Icon: t, title: a, moveToNextApp: l, appType: c, getLedgerAccountDetails: f } = e;
            return (
              (0, i.useEffect)(() => {
                let e = setInterval(async () => {
                  try {
                    if (await (0, r.qn$)(c === o.Yg.ETH ? "Ethereum" : "Cosmos")) {
                      let t = await f(c);
                      l(t), clearInterval(e);
                    }
                  } catch (e) {
                    console.error(e);
                  }
                }, 1e3);
                return () => {
                  clearInterval(e);
                };
              }, [c]),
              (0, n.jsx)(s.E.div, {
                className: "flex flex-col w-full flex-1",
                variants: d.S,
                initial: "fromRight",
                animate: "animate",
                exit: "exit",
                children: (0, n.jsxs)("header", {
                  className: "flex flex-col items-center justify-center gap-6 flex-1",
                  children: [
                    (0, n.jsx)("div", {
                      className: "rounded-full size-[134px] animate-scaleUpDown [--scale-up-down-start:1.05] bg-accent-foreground/20 grid place-content-center",
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
                })
              })
            );
          };
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    75292: function (e, t, a) {
      a.a(e, async function (e, l) {
        try {
          a.r(t), a.d(t, { ImportLedgerLayout: () => T, default: () => k });
          var n = a(52322),
            r = a(41172),
            s = a(15969),
            o = a(44658),
            d = a(53108),
            i = a(14981),
            c = a(10706),
            f = a(56336),
            u = a(75958),
            p = a(10588),
            g = a(53542),
            x = a(98622),
            b = a(2784),
            w = a(62833),
            y = a(10289),
            v = a(70514),
            h = a(1252),
            m = a(72565),
            E = a.n(m),
            j = a(36255),
            _ = a(48834).Buffer,
            I = e([c, j, g]);
          [c, j, g] = I.then ? (await I)() : I;
          let N = () => {
              var e;
              let [t] = (0, w.lr)(),
                { chains: a } = (0, r._IL)(),
                l = async e => {
                  let t = e === g.Yg.ETH ? "ethereum" : "cosmos",
                    l = (0, h.nY)(Object.values(a)),
                    n = e === g.Yg.ETH ? l : [],
                    r = {};
                  for (let e of Object.entries(a)) {
                    let [t, a] = e;
                    r[t] = { addressPrefix: a.addressPrefix, enabled: a.enabled, coinType: a.bip44.coinType };
                  }
                  let { pathWiseAddresses: o } = await (0, s.tJg)(e, [0, 1, 2, 3, 4], void 0, { primaryChain: t, chainsToImport: n, chainInfos: r });
                  return o;
                },
                [u, x] = (0, b.useState)(!1),
                v = (0, y.s0)(),
                m = t.get("app"),
                { activeWallet: I, setActiveWallet: N } = (0, c.ZP)(),
                T = (0, b.useCallback)(
                  async e => {
                    if ((x(!0), !I || !e)) throw Error("Unable to import ledger wallet");
                    let t = (await E().storage.local.get("keystore"))[d.QC];
                    if (!t) throw Error("Unable to import ledger wallet");
                    for (let r of Object.values(t).filter(e => e.walletType === o._K.LEDGER)) {
                      var a, l, n;
                      let s =
                          (null == r ? void 0 : r.path) ||
                          ((null === (l = r.addressIndex) || void 0 === l ? void 0 : null === (a = l.toString()) || void 0 === a ? void 0 : a.length) === 1
                            ? `0'/0/${r.addressIndex}`
                            : null === (n = r.addressIndex) || void 0 === n
                              ? void 0
                              : n.toString()),
                        o = (null == e ? void 0 : e[s]) ?? {},
                        d = {},
                        i = {};
                      Object.keys(o).forEach(e => {
                        let t = o[e];
                        (d[e] = t.address), (i[e] = _.from(t.pubKey).toString("base64"));
                      });
                      let c = { ...r, addresses: { ...r.addresses, ...d }, pubKeys: { ...r.pubKeys, ...i } };
                      t[r.id] = c;
                    }
                    let r = t[I.id];
                    await E().storage.local.set({ keystore: t, "active-wallet": r }), N(r), v("/onboardingSuccess");
                  },
                  [I, v, N]
                ),
                k = null === (e = "EVM" === m ? "eth" : m) || void 0 === e ? void 0 : e.toLowerCase();
              return (0, n.jsxs)(i.M, {
                mode: "wait",
                presenceAffectsLayout: !0,
                children: [
                  k &&
                    !u &&
                    (0, n.jsx)(
                      j.n,
                      {
                        title: `Open ${k === g.Yg.ETH ? "Ethereum" : "Cosmos"} app on your ledger`,
                        Icon: f.zq,
                        appType: k,
                        moveToNextApp: T,
                        getLedgerAccountDetails: l
                      },
                      `hold-state-${k}`
                    ),
                  u && (0, n.jsx)(p.T_, { title: `Importing ${m} wallets` }, "creating-wallet-loader")
                ]
              });
            },
            T = e =>
              (0, n.jsx)(x.z, {
                className: (0, v.cn)("flex flex-col items-stretch gap-7 p-7 overflow-auto border-secondary-300 relative", e.className),
                children: e.children
              }),
            k = (0, u.Pi)(() => (0, n.jsx)(T, { children: (0, n.jsx)(N, {}) }));
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    98622: function (e, t, a) {
      a.d(t, { z: () => s });
      var l = a(52322),
        n = a(4370);
      a(2784);
      var r = a(70514);
      let s = e => {
        let { className: t, children: a, ...s } = e;
        return (0, l.jsx)(n.E.div, {
          className: (0, r.cn)("overflow-auto bg-secondary overflow-x-hidden my-auto mx-auto rounded-3xl flex h-full w-full", t),
          ...s,
          children: a
        });
      };
    }
  }
]);
//# sourceMappingURL=7432.js.map
