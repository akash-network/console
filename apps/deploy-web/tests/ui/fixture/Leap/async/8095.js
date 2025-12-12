!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "9105b1c8-5065-4971-8c42-055995010b44"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-9105b1c8-5065-4971-8c42-055995010b44"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.23.1" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["8095"],
  {
    51416: function (e, t, s) {
      s.a(e, async function (e, r) {
        try {
          s.d(t, { k: () => h });
          var a = s(41172),
            n = s(15969),
            i = s(92541),
            l = s(55159),
            d = s(97486),
            o = s(65027),
            c = s(53542),
            u = s(2784),
            f = s(19288),
            p = s(10507),
            v = s(1252),
            m = e([o, d, c]);
          function h() {
            let [e, t] = (0, u.useState)(),
              [s, r] = (0, u.useState)(),
              [m, h] = (0, u.useState)(""),
              g = o.w.useImportMultipleWalletAccounts(),
              { chains: w } = (0, a._IL)(),
              y = o.w.useSaveLedgerWallet(),
              b = (0, u.useRef)();
            (0, u.useEffect)(() => {
              if (!m) {
                let e = d.W.CreateNewMnemonic();
                h(e);
              }
            }, [m]);
            let x = e => {
                b.current = e;
              },
              S = e => {
                let t = Object.assign(b.current ?? {}, {});
                Object.entries(e).forEach(e => {
                  let [s, r] = e;
                  t[s] = { ...t[s], ...r };
                }),
                  x(t);
              },
              E = async (e, t, s) => {
                if (e) {
                  let r = Object.entries(b.current ?? {})
                      .filter(e => {
                        let [s] = e;
                        return t.includes(s);
                      })
                      .reduce((e, t) => {
                        var r, a;
                        let [n, i] = t,
                          l = !!(null == i ? void 0 : null === (r = i.cosmos) || void 0 === r ? void 0 : r.address) && s.includes(i.cosmos.address),
                          d = !!(null == i ? void 0 : null === (a = i.ethereum) || void 0 === a ? void 0 : a.address) && s.includes(i.ethereum.address);
                        return (l && d) || (e[n] = { chainAddresses: i, isCosmosAddressPresent: l, isEvmAddressPresent: d }), e;
                      }, {}),
                    a = Object.keys(r).reduce((e, t) => {
                      var s, a, n, i, l, d, o, c;
                      let u = "cosmos",
                        p = "ethereum",
                        v = r[t],
                        m = (null == v ? void 0 : v.isCosmosAddressPresent)
                          ? null == v
                            ? void 0
                            : null === (a = v.chainAddresses) || void 0 === a
                              ? void 0
                              : null === (s = a[u]) || void 0 === s
                                ? void 0
                                : s.pubKey
                          : (null == v ? void 0 : v.isEvmAddressPresent)
                            ? null == v
                              ? void 0
                              : null === (i = v.chainAddresses) || void 0 === i
                                ? void 0
                                : null === (n = i[p]) || void 0 === n
                                  ? void 0
                                  : n.pubKey
                            : (null == v
                                ? void 0
                                : null === (d = v.chainAddresses) || void 0 === d
                                  ? void 0
                                  : null === (l = d[u]) || void 0 === l
                                    ? void 0
                                    : l.pubKey) ??
                              (null == v
                                ? void 0
                                : null === (c = v.chainAddresses) || void 0 === c
                                  ? void 0
                                  : null === (o = c[p]) || void 0 === o
                                    ? void 0
                                    : o.pubKey);
                      return { ...e, [t]: { pubkey: m, path: (0, f.X2)(t) } };
                    }, {});
                  await y({ addresses: r, password: e, pubKeys: a });
                }
              },
              k = async e => {
                let s = await l.Kn.getWalletsFromMnemonic(e, 5, "118", n.oCA.cosmos.addressPrefix),
                  r = await Promise.all(
                    s.map(async t => {
                      var s, r;
                      let a = (0, i.Z)("60", t.index.toString()),
                        d = (0, l.Rk)(e, { hdPath: a, addressPrefix: n.oCA.ethereum.addressPrefix, ethWallet: !1 }),
                        o = (0, l.h)("84", t.index.toString()),
                        c = l.ef.generateWalletFromMnemonic(e, {
                          addressPrefix: n.oCA.bitcoin.addressPrefix,
                          paths: [o],
                          network: n.oCA.bitcoin.btcNetwork || l.IB
                        }),
                        u = (0, i.Z)("637", t.index.toString()),
                        f = await (0, p.OE)(e, u, "seedPhrase"),
                        v = (0, i.Z)("501", t.index.toString()),
                        m = await (0, p.qV)(e, v, "seedPhrase"),
                        h = (0, i.Z)("784", t.index.toString()),
                        g = await (0, p.AP)(e, h, "seedPhrase"),
                        w = d instanceof l.Gl ? (null === (s = d.getAccountWithHexAddress()[0]) || void 0 === s ? void 0 : s.address) : void 0,
                        y = null === (r = c.getAccounts()[0]) || void 0 === r ? void 0 : r.address,
                        b = null == f ? void 0 : f.address,
                        x = null == m ? void 0 : m.address,
                        S = null == g ? void 0 : g.address;
                      return { ...t, evmAddress: w, bitcoinAddress: y, moveAddress: b, solanaAddress: x, suiAddress: S };
                    })
                  );
                t(r);
              },
              _ = () => {
                let e = {};
                for (let t of Object.entries(w)) {
                  let [s, r] = t;
                  e[s] = { addressPrefix: r.addressPrefix, enabled: r.enabled, coinType: r.bip44.coinType };
                }
                return e;
              },
              A = async e => {
                let t = e === c.Yg.ETH ? "ethereum" : "cosmos",
                  s = (0, v.nY)(Object.values(w)),
                  r = e === c.Yg.ETH ? s : [],
                  a = _(),
                  { pathWiseAddresses: i } = await (0, n.tJg)(e, [0, 1, 2, 3, 4], void 0, { primaryChain: t, chainsToImport: r, chainInfos: a });
                S(i);
              },
              P = async (e, s) => {
                let r = e === c.Yg.ETH ? "ethereum" : "cosmos",
                  a = _(),
                  i = (0, v.nY)(Object.values(w)),
                  l = e === c.Yg.ETH ? i : [],
                  { primaryChainAccount: d, pathWiseAddresses: o } = await (0, n.tJg)(e, s, void 0, { primaryChain: r, chainsToImport: l, chainInfos: a });
                t(e => [...(e ?? []), ...d.map((t, s) => ({ address: t.address, pubkey: t.pubkey, index: (e ?? []).length + s, path: t.path }))]), S(o);
              },
              j = async (t, a, i, l) => {
                var d;
                let o = [...(e ?? []), ...(s ?? [])],
                  u = t === c.Yg.ETH ? "ethereum" : "cosmos",
                  f = _(),
                  { primaryChainAccount: p, pathWiseAddresses: v } = await (0, n.tJg)(t, [], [a], { primaryChain: u, chainsToImport: [], chainInfos: f }),
                  m = o.some(e => !!e.path && a.includes(e.path) && e.address === p[0].address),
                  h = !!(null == p ? void 0 : null === (d = p[0]) || void 0 === d ? void 0 : d.address) && (null == l ? void 0 : l.includes(p[0].address));
                if (m || h) throw Error("This account is already present. Kindly enter a different derivation path.");
                r(e => [...(e ?? []), ...p.map((t, s) => ({ address: t.address, pubkey: t.pubkey, index: (e ?? []).length + s, path: t.path, name: i }))]),
                  S(v);
              };
            return {
              addresses: b.current,
              mnemonic: m,
              walletAccounts: e,
              setWalletAccounts: t,
              customWalletAccounts: s,
              setAddresses: x,
              getAccountDetails: k,
              getLedgerAccountDetails: A,
              onOnboardingComplete: (e, t, s, r) => {
                if (e && t)
                  return g({
                    mnemonic: e,
                    password: t,
                    type: r,
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
              onBoardingCompleteLedger: E,
              getLedgerAccountDetailsForIdxs: P,
              getCustomLedgerAccountDetails: j
            };
          }
          ([o, d, c] = m.then ? (await m)() : m), r();
        } catch (e) {
          r(e);
        }
      });
    },
    53542: function (e, t, s) {
      s.a(e, async function (e, r) {
        try {
          s.d(t, { Xp: () => j, Yg: () => k, jr: () => P });
          var a,
            n = s(52322),
            i = s(15969),
            l = s(55159),
            d = s(92642),
            o = s(20541),
            c = s(51416),
            u = s(42941),
            f = s(47013),
            p = s(65027),
            v = s(2784),
            m = s(10289),
            h = s(22014),
            g = s(50371),
            w = s(52757),
            y = s(72565),
            b = s.n(y),
            x = s(92186),
            S = s(48834).Buffer,
            E = e([o, c, p]);
          [o, c, p] = E.then ? (await E)() : E;
          var k = (((a = {}).COSMOS = "cosmos"), (a.ETH = "eth"), a);
          let _ = (0, v.createContext)(null),
            A = e => {
              let { currentStep: t, walletName: s, loading: r } = e;
              if (r) return "loading";
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
            P = e => {
              let { children: t } = e,
                { noAccount: s } = (0, o.aC)(),
                r = (0, u.Z)(),
                [a, y] = (0, v.useState)(""),
                [E, k] = (0, v.useState)(""),
                [P, j] = (0, v.useState)(""),
                [C, T] = (0, v.useState)("seed-phrase"),
                [O, W] = (0, v.useState)({}),
                [M, I] = (0, v.useState)(!1),
                [N, R] = (0, v.useState)(x.T.step0),
                [K, L] = (0, v.useState)(""),
                [Y, H] = (0, v.useState)(void 0),
                [Z, D] = (0, v.useState)(0),
                J = (0, f.Z)(Z) || 0,
                B = (0, m.s0)(),
                F = ["ledger", "evm-ledger"].includes(C || ""),
                X = null == C ? void 0 : C.toLowerCase().includes("metamask"),
                q = null == C ? void 0 : C.toLowerCase().includes("evm wallets"),
                z = (null == C ? void 0 : C.toLowerCase().includes("private")) || X || q,
                [G, V] = (0, v.useState)(new Set()),
                Q = F ? 4 : 3,
                U = A({ currentStep: Z, walletName: C, loading: M }),
                {
                  walletAccounts: $,
                  addresses: ee,
                  customWalletAccounts: et,
                  setWalletAccounts: es,
                  getAccountDetails: er,
                  getLedgerAccountDetails: ea,
                  onOnboardingComplete: en,
                  onBoardingCompleteLedger: ei,
                  getLedgerAccountDetailsForIdxs: el,
                  getCustomLedgerAccountDetails: ed,
                  setAddresses: eo
                } = (0, c.k)(),
                ec = p.w.useSaveWatchWallet(),
                eu = async function () {
                  let e = !(arguments.length > 0) || void 0 === arguments[0] || arguments[0];
                  return s ? (e ? void (await (0, i._vH)(2e3), B("/onboardingSuccess")) : B("/onboardingSuccess")) : B("/home", { state: { from: location } });
                },
                ef = async e => {
                  try {
                    if ((I(!0), F))
                      await ei(
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
                        Y ?? []
                      );
                    else if ("watch-wallet" === C && E && P) await ec(E, P, e);
                    else {
                      let t = z ? { 0: !0 } : O;
                      await en(a, e, t, "import");
                    }
                    if ((h.M8.password || (await ep()), e)) {
                      let t = S.from(e).toString("base64");
                      b().runtime.sendMessage({ type: "unlock", data: { password: t } }), h.M8.setPassword(e), await eu();
                    }
                  } catch (e) {
                    if ("Wallet already present" === e.message.trim()) throw e;
                    (0, d.Tb)(e, {
                      tags: {
                        errorType: "onboarding_completed_error",
                        source: "onboarding_completed",
                        severity: "error",
                        errorName: e instanceof Error ? e.name : "OnboardingCompletedError"
                      },
                      fingerprint: ["onboarding_completed", "onboarding_completed_error"],
                      level: "error",
                      contexts: { transaction: { type: "onboarding_completed", errorMessage: e instanceof Error ? e.message : String(e) } },
                      extra: { walletName: C, isLedger: F, isPrivateKey: z, isMetamask: X, isOtherEvmWallets: q }
                    });
                  } finally {
                    I(!1);
                  }
                },
                ep = async () => {
                  if (F) {
                    if (Z === Q + 1) return eu();
                    if (4 === Z && h.M8.password) {
                      await ef(h.M8.password);
                      return;
                    }
                  } else if (Z === Q) return eu();
                  if (2 === Z && !s && !F) {
                    try {
                      h.M8.password && (await ef(h.M8.password));
                    } catch (e) {}
                    return eu(!1);
                  }
                  D(Z + 1);
                },
                ev = async () => {
                  if ("ledger" === C && 1 === Z) {
                    let e = await p.w.getAllWallets();
                    if ((0, w.d)(e)) {
                      B("/home", { state: { from: location } });
                      return;
                    }
                  }
                  3 === Z && z ? D(Z - 2) : Z > 0 ? D(Z - 1) : B(-1);
                },
                em = async () => {
                  try {
                    z || (await er((0, g.Z)(a))), await ep();
                  } catch (e) {
                    e instanceof Error && L(e.message.trim());
                  }
                },
                eh = async e => {
                  if (F)
                    try {
                      R(x.T.step2), await e("evm-ledger" === C), R(x.T.step3), await ep();
                    } catch {
                      R(x.T.step1);
                    }
                };
              return (
                (0, v.useEffect)(() => {
                  let e = r.get("walletName");
                  "ledger" === e && (T("ledger"), D(1));
                }, [r]),
                (0, v.useEffect)(() => {
                  (async () => {
                    let e = await l.Kn.getAllWallets(),
                      t = [];
                    for (let n of Object.values(e ?? {})) {
                      var s, r, a;
                      t.push(null == n ? void 0 : null === (s = n.addresses) || void 0 === s ? void 0 : s.cosmos),
                        (null == n ? void 0 : null === (r = n.addresses) || void 0 === r ? void 0 : r.ethereum) &&
                          t.push(null == n ? void 0 : null === (a = n.addresses) || void 0 === a ? void 0 : a.ethereum);
                    }
                    H(t);
                  })();
                }, []),
                (0, v.useEffect)(() => {
                  if ((null == $ ? void 0 : $.length) && 0 === Object.keys(O).length) {
                    let [e] = $;
                    W({ [e.index]: !!e.address && !(null == Y ? void 0 : Y.includes(e.address)) });
                  }
                }, [Y, $, O]),
                (0, n.jsx)(_.Provider, {
                  value: {
                    prevStep: J,
                    currentStep: Z,
                    setCurrentStep: D,
                    totalSteps: Q,
                    loading: M,
                    setLoading: I,
                    importWalletFromSeedPhrase: em,
                    importLedger: eh,
                    backToPreviousStep: ev,
                    moveToNextStep: ep,
                    onOnboardingCompleted: ef,
                    privateKeyError: K,
                    currentStepName: U,
                    walletAccounts: $,
                    customWalletAccounts: et,
                    setWalletAccounts: es,
                    getLedgerAccountDetails: ea,
                    getLedgerAccountDetailsForIdxs: el,
                    ledgerConnectionStatus: N,
                    setLedgerConnectionStatus: R,
                    secret: a,
                    setSecret: y,
                    watchWalletAddress: E,
                    setWatchWalletAddress: k,
                    watchWalletName: P,
                    setWatchWalletName: j,
                    selectedIds: O,
                    setSelectedIds: W,
                    walletName: C,
                    setPrivateKeyError: L,
                    setWalletName: T,
                    getCustomLedgerAccountDetails: ed,
                    ledgerNetworks: G,
                    setLedgerNetworks: V,
                    addresses: ee,
                    setAddresses: eo
                  },
                  children: t
                })
              );
            },
            j = () => {
              let e = (0, v.useContext)(_);
              if (!e) throw Error("useImportWalletContext must be used within a ImportWalletProvider");
              return e;
            };
          r();
        } catch (e) {
          r(e);
        }
      });
    },
    92186: function (e, t, s) {
      s.d(t, { T: () => a });
      var r,
        a = (((r = {})[(r.step0 = 0)] = "step0"), (r[(r.step1 = 1)] = "step1"), (r[(r.step2 = 2)] = "step2"), (r[(r.step3 = 3)] = "step3"), r);
    },
    91729: function (e, t, s) {
      s.d(t, { S: () => l, n: () => d });
      var r = s(52322),
        a = s(4370);
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
          let { children: t, heading: s, subHeading: i, className: d, entry: o = "right", headerIcon: c } = e;
          return (0, r.jsxs)(a.E.div, {
            className: (0, n.cn)("flex flex-col items-stretch w-full h-full gap-7", d),
            variants: l,
            initial: "left" === o ? "fromLeft" : "fromRight",
            animate: "animate",
            exit: "exit",
            children: [
              (0, r.jsxs)("header", {
                className: "flex flex-col items-center gap-1",
                children: [
                  c && (0, r.jsx)("div", { className: "size-16 bg-secondary-200 rounded-full grid place-content-center", children: c }),
                  (0, r.jsx)("h1", { className: "font-bold text-[1.5rem] text-center", children: s }),
                  i && (0, r.jsx)("div", { className: "text-[0.875rem] font-medium text-muted-foreground leading-[1.4rem] text-center", children: i })
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
