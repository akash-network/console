!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "e4515eda-c6c1-4504-96fe-3b7ab2e808e5"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-e4515eda-c6c1-4504-96fe-3b7ab2e808e5"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.22.9" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["8095"],
  {
    51416: function (e, t, s) {
      s.a(e, async function (e, a) {
        try {
          s.d(t, { k: () => m });
          var r = s(41172),
            n = s(15969),
            i = s(92541),
            l = s(55159),
            d = s(97486),
            o = s(65027),
            u = s(53542),
            c = s(2784),
            f = s(19288),
            v = s(10507),
            p = s(1252),
            h = e([o, d, u]);
          function m() {
            let [e, t] = (0, c.useState)(),
              [s, a] = (0, c.useState)(),
              [h, m] = (0, c.useState)(""),
              w = o.w.useImportMultipleWalletAccounts(),
              { chains: g } = (0, r._IL)(),
              y = o.w.useSaveLedgerWallet(),
              b = (0, c.useRef)();
            (0, c.useEffect)(() => {
              if (!h) {
                let e = d.W.CreateNewMnemonic();
                m(e);
              }
            }, [h]);
            let x = e => {
                b.current = e;
              },
              S = e => {
                let t = Object.assign(b.current ?? {}, {});
                Object.entries(e).forEach(e => {
                  let [s, a] = e;
                  t[s] = { ...t[s], ...a };
                }),
                  x(t);
              },
              k = async (e, t, s) => {
                if (e) {
                  let a = Object.entries(b.current ?? {})
                      .filter(e => {
                        let [s] = e;
                        return t.includes(s);
                      })
                      .reduce((e, t) => {
                        var a, r;
                        let [n, i] = t,
                          l = !!(null == i ? void 0 : null === (a = i.cosmos) || void 0 === a ? void 0 : a.address) && s.includes(i.cosmos.address),
                          d = !!(null == i ? void 0 : null === (r = i.ethereum) || void 0 === r ? void 0 : r.address) && s.includes(i.ethereum.address);
                        return (l && d) || (e[n] = { chainAddresses: i, isCosmosAddressPresent: l, isEvmAddressPresent: d }), e;
                      }, {}),
                    r = Object.keys(a).reduce((e, t) => {
                      var s, r, n, i, l, d, o, u;
                      let c = "cosmos",
                        v = "ethereum",
                        p = a[t],
                        h = (null == p ? void 0 : p.isCosmosAddressPresent)
                          ? null == p
                            ? void 0
                            : null === (r = p.chainAddresses) || void 0 === r
                              ? void 0
                              : null === (s = r[c]) || void 0 === s
                                ? void 0
                                : s.pubKey
                          : (null == p ? void 0 : p.isEvmAddressPresent)
                            ? null == p
                              ? void 0
                              : null === (i = p.chainAddresses) || void 0 === i
                                ? void 0
                                : null === (n = i[v]) || void 0 === n
                                  ? void 0
                                  : n.pubKey
                            : (null == p
                                ? void 0
                                : null === (d = p.chainAddresses) || void 0 === d
                                  ? void 0
                                  : null === (l = d[c]) || void 0 === l
                                    ? void 0
                                    : l.pubKey) ??
                              (null == p
                                ? void 0
                                : null === (u = p.chainAddresses) || void 0 === u
                                  ? void 0
                                  : null === (o = u[v]) || void 0 === o
                                    ? void 0
                                    : o.pubKey);
                      return { ...e, [t]: { pubkey: h, path: (0, f.X2)(t) } };
                    }, {});
                  await y({ addresses: a, password: e, pubKeys: r });
                }
              },
              E = async e => {
                let s = await l.Kn.getWalletsFromMnemonic(e, 5, "118", n.oCA.cosmos.addressPrefix),
                  a = await Promise.all(
                    s.map(async t => {
                      var s, a;
                      let r = (0, i.Z)("60", t.index.toString()),
                        d = (0, l.Rk)(e, { hdPath: r, addressPrefix: n.oCA.ethereum.addressPrefix, ethWallet: !1 }),
                        o = (0, l.h)("84", t.index.toString()),
                        u = l.ef.generateWalletFromMnemonic(e, {
                          addressPrefix: n.oCA.bitcoin.addressPrefix,
                          paths: [o],
                          network: n.oCA.bitcoin.btcNetwork || l.IB
                        }),
                        c = (0, i.Z)("637", t.index.toString()),
                        f = await (0, v.OE)(e, c, "seedPhrase"),
                        p = (0, i.Z)("501", t.index.toString()),
                        h = await (0, v.qV)(e, p, "seedPhrase"),
                        m = (0, i.Z)("784", t.index.toString()),
                        w = await (0, v.AP)(e, m, "seedPhrase"),
                        g = d instanceof l.Gl ? (null === (s = d.getAccountWithHexAddress()[0]) || void 0 === s ? void 0 : s.address) : void 0,
                        y = null === (a = u.getAccounts()[0]) || void 0 === a ? void 0 : a.address,
                        b = null == f ? void 0 : f.address,
                        x = null == h ? void 0 : h.address,
                        S = null == w ? void 0 : w.address;
                      return { ...t, evmAddress: g, bitcoinAddress: y, moveAddress: b, solanaAddress: x, suiAddress: S };
                    })
                  );
                t(a);
              },
              A = () => {
                let e = {};
                for (let t of Object.entries(g)) {
                  let [s, a] = t;
                  e[s] = { addressPrefix: a.addressPrefix, enabled: a.enabled, coinType: a.bip44.coinType };
                }
                return e;
              },
              j = async e => {
                let t = e === u.Yg.ETH ? "ethereum" : "cosmos",
                  s = (0, p.nY)(Object.values(g)),
                  a = e === u.Yg.ETH ? s : [],
                  r = A(),
                  { pathWiseAddresses: i } = await (0, n.tJg)(e, [0, 1, 2, 3, 4], void 0, { primaryChain: t, chainsToImport: a, chainInfos: r });
                S(i);
              },
              P = async (e, s) => {
                let a = e === u.Yg.ETH ? "ethereum" : "cosmos",
                  r = A(),
                  i = (0, p.nY)(Object.values(g)),
                  l = e === u.Yg.ETH ? i : [],
                  { primaryChainAccount: d, pathWiseAddresses: o } = await (0, n.tJg)(e, s, void 0, { primaryChain: a, chainsToImport: l, chainInfos: r });
                t(e => [...(e ?? []), ...d.map((t, s) => ({ address: t.address, pubkey: t.pubkey, index: (e ?? []).length + s, path: t.path }))]), S(o);
              },
              C = async (t, r, i, l) => {
                var d;
                let o = [...(e ?? []), ...(s ?? [])],
                  c = t === u.Yg.ETH ? "ethereum" : "cosmos",
                  f = A(),
                  { primaryChainAccount: v, pathWiseAddresses: p } = await (0, n.tJg)(t, [], [r], { primaryChain: c, chainsToImport: [], chainInfos: f }),
                  h = o.some(e => !!e.path && r.includes(e.path) && e.address === v[0].address),
                  m = !!(null == v ? void 0 : null === (d = v[0]) || void 0 === d ? void 0 : d.address) && (null == l ? void 0 : l.includes(v[0].address));
                if (h || m) throw Error("This account is already present. Kindly enter a different derivation path.");
                a(e => [...(e ?? []), ...v.map((t, s) => ({ address: t.address, pubkey: t.pubkey, index: (e ?? []).length + s, path: t.path, name: i }))]),
                  S(p);
              };
            return {
              addresses: b.current,
              mnemonic: h,
              walletAccounts: e,
              setWalletAccounts: t,
              customWalletAccounts: s,
              setAddresses: x,
              getAccountDetails: E,
              getLedgerAccountDetails: j,
              onOnboardingComplete: (e, t, s, a) => {
                if (e && t)
                  return w({
                    mnemonic: e,
                    password: t,
                    type: a,
                    selectedAddressIndexes: Object.entries(s)
                      .filter(e => {
                        let [, t] = e;
                        return t;
                      })
                      .map(e => {
                        let [t] = e;
                        return parseInt(t);
                      })
                  });
              },
              onBoardingCompleteLedger: k,
              getLedgerAccountDetailsForIdxs: P,
              getCustomLedgerAccountDetails: C
            };
          }
          ([o, d, u] = h.then ? (await h)() : h), a();
        } catch (e) {
          a(e);
        }
      });
    },
    53542: function (e, t, s) {
      s.a(e, async function (e, a) {
        try {
          s.d(t, { Xp: () => P, Yg: () => k, jr: () => j });
          var r,
            n = s(52322),
            i = s(15969),
            l = s(55159),
            d = s(20541),
            o = s(51416),
            u = s(42941),
            c = s(47013),
            f = s(65027),
            v = s(2784),
            p = s(10289),
            h = s(22014),
            m = s(50371),
            w = s(52757),
            g = s(72565),
            y = s.n(g),
            b = s(92186),
            x = s(48834).Buffer,
            S = e([d, o, f]);
          [d, o, f] = S.then ? (await S)() : S;
          var k = (((r = {}).COSMOS = "cosmos"), (r.ETH = "eth"), r);
          let E = (0, v.createContext)(null),
            A = e => {
              let { currentStep: t, walletName: s, loading: a } = e;
              if (a) return "loading";
              if (0 === t) return "select-import-type";
              if (1 === t && "seed-phrase" === s) return "seed-phrase";
              if (1 === t && "private-key" === s) return "private-key";
              if ("ledger" === s || "evm-ledger" === s)
                switch (t) {
                  case 1:
                    return "import-ledger";
                  case 2:
                    return "select-ledger-network";
                  case 3:
                    return "importing-ledger-accounts";
                  case 4:
                    return "select-ledger-wallet";
                  default:
                    return "choose-password";
                }
              return 1 === t && "watch-wallet" === s
                ? "import-watch-wallet"
                : 2 === t && ("watch-wallet" === s || "private-key" === s)
                  ? "choose-password"
                  : 2 === t
                    ? "select-wallet"
                    : 3 === t
                      ? "choose-password"
                      : "onboarding-success";
            },
            j = e => {
              let { children: t } = e,
                { noAccount: s } = (0, d.aC)(),
                a = (0, u.Z)(),
                [r, g] = (0, v.useState)(""),
                [S, k] = (0, v.useState)(""),
                [j, P] = (0, v.useState)(""),
                [C, T] = (0, v.useState)("seed-phrase"),
                [O, _] = (0, v.useState)({}),
                [W, I] = (0, v.useState)(!1),
                [M, R] = (0, v.useState)(b.T.step0),
                [N, Y] = (0, v.useState)(""),
                [H, K] = (0, v.useState)(void 0),
                [L, Z] = (0, v.useState)(0),
                D = (0, c.Z)(L) || 0,
                J = (0, p.s0)(),
                B = ["ledger", "evm-ledger"].includes(C || ""),
                F = null == C ? void 0 : C.toLowerCase().includes("metamask"),
                X = null == C ? void 0 : C.toLowerCase().includes("evm wallets"),
                q = (null == C ? void 0 : C.toLowerCase().includes("private")) || F || X,
                [z, G] = (0, v.useState)(new Set()),
                V = B ? 4 : 3,
                Q = A({ currentStep: L, walletName: C, loading: W }),
                {
                  walletAccounts: U,
                  addresses: $,
                  customWalletAccounts: ee,
                  setWalletAccounts: et,
                  getAccountDetails: es,
                  getLedgerAccountDetails: ea,
                  onOnboardingComplete: er,
                  onBoardingCompleteLedger: en,
                  getLedgerAccountDetailsForIdxs: ei,
                  getCustomLedgerAccountDetails: el,
                  setAddresses: ed
                } = (0, o.k)(),
                eo = f.w.useSaveWatchWallet(),
                eu = async function () {
                  let e = !(arguments.length > 0) || void 0 === arguments[0] || arguments[0];
                  return s ? (e ? void (await (0, i._vH)(2e3), J("/onboardingSuccess")) : J("/onboardingSuccess")) : J("/home", { state: { from: location } });
                },
                ec = async e => {
                  try {
                    if ((I(!0), B))
                      await en(
                        e,
                        Object.entries(O)
                          .filter(e => {
                            let [, t] = e;
                            return t;
                          })
                          .map(e => {
                            let [t] = e;
                            return t;
                          }),
                        H ?? []
                      );
                    else if ("watch-wallet" === C && S && j) await eo(S, j, e);
                    else {
                      let t = q ? { 0: !0 } : O;
                      await er(r, e, t, "import");
                    }
                    if ((h.M8.password || (await ef()), e)) {
                      let t = x.from(e).toString("base64");
                      y().runtime.sendMessage({ type: "unlock", data: { password: t } }), h.M8.setPassword(e), await eu();
                    }
                  } catch (e) {
                    if ("Wallet already present" === e.message.trim()) throw e;
                  } finally {
                    I(!1);
                  }
                },
                ef = async () => {
                  if (B) {
                    if (L === V + 1) return eu();
                    if (4 === L && h.M8.password) {
                      await ec(h.M8.password);
                      return;
                    }
                  } else if (L === V) return eu();
                  if (2 === L && !s && !B) {
                    try {
                      h.M8.password && (await ec(h.M8.password));
                    } catch (e) {}
                    return eu(!1);
                  }
                  Z(L + 1);
                },
                ev = async () => {
                  if ("ledger" === C && 1 === L) {
                    let e = await f.w.getAllWallets();
                    if ((0, w.d)(e)) {
                      J("/home", { state: { from: location } });
                      return;
                    }
                  }
                  3 === L && q ? Z(L - 2) : L > 0 ? Z(L - 1) : J(-1);
                },
                ep = async () => {
                  try {
                    q || (await es((0, m.Z)(r))), await ef();
                  } catch (e) {
                    e instanceof Error && Y(e.message.trim());
                  }
                },
                eh = async e => {
                  if (B)
                    try {
                      R(b.T.step2), await e("evm-ledger" === C), R(b.T.step3), await ef();
                    } catch {
                      R(b.T.step1);
                    }
                };
              return (
                (0, v.useEffect)(() => {
                  let e = a.get("walletName");
                  "ledger" === e && (T("ledger"), Z(1));
                }, [a]),
                (0, v.useEffect)(() => {
                  (async () => {
                    let e = await l.Kn.getAllWallets(),
                      t = [];
                    for (let n of Object.values(e ?? {})) {
                      var s, a, r;
                      t.push(null == n ? void 0 : null === (s = n.addresses) || void 0 === s ? void 0 : s.cosmos),
                        (null == n ? void 0 : null === (a = n.addresses) || void 0 === a ? void 0 : a.ethereum) &&
                          t.push(null == n ? void 0 : null === (r = n.addresses) || void 0 === r ? void 0 : r.ethereum);
                    }
                    K(t);
                  })();
                }, []),
                (0, v.useEffect)(() => {
                  if ((null == U ? void 0 : U.length) && 0 === Object.keys(O).length) {
                    let [e] = U;
                    _({ [e.index]: !!e.address && !(null == H ? void 0 : H.includes(e.address)) });
                  }
                }, [H, U, O]),
                (0, n.jsx)(E.Provider, {
                  value: {
                    prevStep: D,
                    currentStep: L,
                    setCurrentStep: Z,
                    totalSteps: V,
                    loading: W,
                    setLoading: I,
                    importWalletFromSeedPhrase: ep,
                    importLedger: eh,
                    backToPreviousStep: ev,
                    moveToNextStep: ef,
                    onOnboardingCompleted: ec,
                    privateKeyError: N,
                    currentStepName: Q,
                    walletAccounts: U,
                    customWalletAccounts: ee,
                    setWalletAccounts: et,
                    getLedgerAccountDetails: ea,
                    getLedgerAccountDetailsForIdxs: ei,
                    ledgerConnectionStatus: M,
                    setLedgerConnectionStatus: R,
                    secret: r,
                    setSecret: g,
                    watchWalletAddress: S,
                    setWatchWalletAddress: k,
                    watchWalletName: j,
                    setWatchWalletName: P,
                    selectedIds: O,
                    setSelectedIds: _,
                    walletName: C,
                    setPrivateKeyError: Y,
                    setWalletName: T,
                    getCustomLedgerAccountDetails: el,
                    ledgerNetworks: z,
                    setLedgerNetworks: G,
                    addresses: $,
                    setAddresses: ed
                  },
                  children: t
                })
              );
            },
            P = () => {
              let e = (0, v.useContext)(E);
              if (!e) throw Error("useImportWalletContext must be used within a ImportWalletProvider");
              return e;
            };
          a();
        } catch (e) {
          a(e);
        }
      });
    },
    92186: function (e, t, s) {
      s.d(t, { T: () => r });
      var a,
        r = (((a = {})[(a.step0 = 0)] = "step0"), (a[(a.step1 = 1)] = "step1"), (a[(a.step2 = 2)] = "step2"), (a[(a.step3 = 3)] = "step3"), a);
    },
    91729: function (e, t, s) {
      s.d(t, { S: () => l, n: () => d });
      var a = s(52322),
        r = s(4370);
      s(2784);
      var n = s(70514),
        i = s(46338);
      let l = {
          fromLeft: { opacity: 0, x: -25, transition: i.eR },
          fromRight: { opacity: 0, x: 25, transition: i.eR },
          animate: { opacity: 1, x: 0, transition: i.eR },
          exit: { opacity: 0, x: 0, transition: { ...i.eR, duration: 0.15 } }
        },
        d = e => {
          let { children: t, heading: s, subHeading: i, className: d, entry: o = "right", headerIcon: u } = e;
          return (0, a.jsxs)(r.E.div, {
            className: (0, n.cn)("flex flex-col items-stretch w-full h-full gap-7", d),
            variants: l,
            initial: "left" === o ? "fromLeft" : "fromRight",
            animate: "animate",
            exit: "exit",
            children: [
              (0, a.jsxs)("header", {
                className: "flex flex-col items-center gap-1",
                children: [
                  u && (0, a.jsx)("div", { className: "size-16 bg-secondary-200 rounded-full grid place-content-center", children: u }),
                  (0, a.jsx)("h1", { className: "font-bold text-[1.5rem] text-center", children: s }),
                  i && (0, a.jsx)("div", { className: "text-[0.875rem] font-medium text-muted-foreground leading-[1.4rem] text-center", children: i })
                ]
              }),
              t
            ]
          });
        };
    }
  }
]);
//# sourceMappingURL=8095.js.map
