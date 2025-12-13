!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "058c1b54-e013-4450-a549-7f346629b3af"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-058c1b54-e013-4450-a549-7f346629b3af"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.23.1" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["9384"],
  {
    52056: function (e, t, a) {
      var s, n;
      a.d(t, { y: () => s }),
        a(55968),
        a(95238),
        ((n = s || (s = {})).SEND_TX = "send-tx-to-background"),
        (n.REQUEST_SIGN_DIRECT = "request-sign-direct"),
        (n.REQUEST_SIGN_AMINO = "request-sign-amino"),
        (n.GET_KEY = "get-key"),
        (n.GET_KEYS = "get-keys"),
        (n.ENABLE_ACCESS = "enable-access"),
        (n.GET_CHAIN_INFOS_WITHOUT_ENDPOINTS = "get-chain-infos-without-endpoints"),
        (n.GET_SUPPORTED_CHAINS = "get-supported-chains"),
        (n.GET_CONNECTION_STATUS = "get-connection-status"),
        (n.ADD_SUGGESTED_CHAIN = "add-suggested-chain"),
        (n.DISCONNECT = "disconnect"),
        (n.GET_SECRET20_VIEWING_KEY = "get-secret20-viewing-key"),
        (n.SUGGEST_TOKEN = "suggest-token"),
        (n.SUGGEST_CW20_TOKEN = "suggest-cw20-token"),
        (n.UPDATE_SECRET20_VIEWING_KEY = "update-secret20-viewing-key"),
        (n.GET_PUBKEY_MSG = "get-pubkey-msg"),
        (n.GET_TX_ENCRYPTION_KEY_MSG = "get-tx-encryption-key-msg"),
        (n.REQUEST_ENCRYPT_MSG = "request-encrypt-msg"),
        (n.REQUEST_DECRYPT_MSG = "request-decrypt-msg"),
        (n.REQUEST_VERIFY_ADR36_AMINO_SIGN_DOC = "request-verify-adr36-amino-sign-doc"),
        (n.REQUEST_SIGN_EIP712 = "request-sign-eip712"),
        (n.OPEN_SIDE_PANEL = "open-side-panel");
    },
    85406: function (e, t, a) {
      a.a(e, async function (e, s) {
        try {
          a.d(t, { a: () => w, u: () => x });
          var n = a(41172),
            r = a(15969),
            i = a(55159),
            l = a(92642),
            o = a(2784),
            c = a(22014),
            d = a(72565),
            u = a.n(d),
            m = a(53108),
            g = a(58551),
            f = e([g]);
          async function x(e, t, a, s) {
            let n = r.tgY.create(e, r.oCA.secret.chainId, s);
            return !!(await n.getBalance(s, a, t)).balance;
          }
          function w() {
            let e = (0, g.E)(),
              t = (0, n.VMC)(),
              a = n.rNU.useOperateCosmosTx(),
              { setViewingKeys: s } = (0, n.WdY)();
            return (0, o.useCallback)(
              async (o, d, g, f, w, h) => {
                if (!c.M8.password) throw Error("Password not set");
                let y = await e(),
                  b = r.KQf.create(o ?? "", d, y),
                  v = null == h ? void 0 : h.key;
                if (w) {
                  if (!(await x(o ?? "", v ?? "", f, g))) return { validKey: !1, error: "Invalid viewing key", key: v };
                } else
                  try {
                    var p, _, E, j, N;
                    let { txStatus: e, viewingKey: s } = await b.createViewingKey(g, f, t, {
                      key: v,
                      gasLimit: null == h ? void 0 : h.gasLimit,
                      feeDenom: null == h ? void 0 : h.feeDenom
                    });
                    if (0 !== e.code) return { validKey: !1, error: e.rawLog };
                    a({
                      txHash: e.transactionHash,
                      txType: n.pb0.SecretTokenTransaction,
                      metadata: { contract: f },
                      feeDenomination: "uscrt",
                      feeQuantity:
                        (null === (N = e.tx) || void 0 === N
                          ? void 0
                          : null === (j = N.auth_info) || void 0 === j
                            ? void 0
                            : null === (E = j.fee) || void 0 === E
                              ? void 0
                              : null === (_ = E.amount) || void 0 === _
                                ? void 0
                                : null === (p = _[0]) || void 0 === p
                                  ? void 0
                                  : p.amount) ?? "0.01",
                      chainId: d
                    }),
                      (v = s);
                  } catch (e) {
                    return (
                      (0, l.Tb)(e, {
                        tags: {
                          errorType: "use_create_viewing_key_error",
                          source: "use_create_viewing_key",
                          severity: "error",
                          errorName: e instanceof Error ? e.name : "UseCreateViewingKeyError"
                        },
                        fingerprint: ["use_create_viewing_key", "use_create_viewing_key_error"],
                        level: "error",
                        contexts: { transaction: { type: "use_create_viewing_key", errorMessage: e instanceof Error ? e.message : String(e) } },
                        extra: { lcdUrl: o, chainId: d, signerAddress: g, contractAddress: f }
                      }),
                      { validKey: !1, error: "Unable to create viewing key" }
                    );
                  }
                let k = (0, i.HI)(v, c.M8.password),
                  C = (await u().storage.local.get([m.rg]))[m.rg];
                if (C) {
                  let e = e => ({ ...C, [g]: { ...C[g], [f]: e ? k : v } });
                  await u().storage.local.set({ [m.rg]: e(!0) }), s(e(!1));
                } else {
                  let e = e => ({ [g]: { [f]: e ? k : v } });
                  await u().storage.local.set({ [m.rg]: e(!0) }), s(e(!1));
                }
                return { validKey: !0, error: null, key: v };
              },
              [e, t, a, s]
            );
          }
          (g = (f.then ? (await f)() : f)[0]), s();
        } catch (e) {
          s(e);
        }
      });
    },
    58551: function (e, t, a) {
      a.a(e, async function (e, s) {
        try {
          a.d(t, { E: () => o });
          var n = a(2784),
            r = a(22014),
            i = a(65027),
            l = e([i]);
          function o() {
            let e = i.w.useGetWallet();
            return (0, n.useCallback)(async () => {
              if (!r.M8.password) throw Error("Password not set");
              return await e();
            }, [e]);
          }
          (i = (l.then ? (await l)() : l)[0]), s();
        } catch (e) {
          s(e);
        }
      });
    },
    50242: function (e, t, a) {
      a.a(e, async function (e, s) {
        try {
          a.r(t), a.d(t, { default: () => S });
          var n = a(52322),
            r = a(41172),
            i = a(52056),
            l = a(15969),
            o = a(92642),
            c = a(89178),
            d = a(19623),
            u = a(69816),
            m = a(53108),
            g = a(79533),
            f = a(85406),
            x = a(75958),
            w = a(2784),
            h = a(10289),
            y = a(42799),
            b = a(48346),
            v = a(46103),
            p = a(53345),
            _ = a(48534),
            E = a(72565),
            j = a.n(E),
            N = a(94685),
            k = a(71142),
            C = e([f, b]);
          [f, b] = C.then ? (await C)() : C;
          let T = (0, x.Pi)(e => {
            let { handleRejectBtnClick: t } = e,
              a = (0, r.DI5)(),
              s = (0, f.a)(),
              x = (0, r.hU2)(),
              E = (0, h.s0)(),
              C = (0, r.yHI)("secret", "mainnet", a),
              S = (0, r.lSw)(),
              T = (0, r.qZl)(),
              [I, A] = (0, w.useState)(""),
              [G, D] = (0, w.useState)(!1),
              [R, K] = (0, w.useState)(!1),
              [U, O] = (0, w.useState)(!1),
              [P, B] = (0, w.useState)(!0),
              [Y, L] = (0, w.useState)(!1),
              [M, W] = (0, w.useState)(""),
              [Z, z] = (0, w.useState)({ decimals: 0, name: "", symbol: "" }),
              [Q, F] = (0, w.useState)({ contractAddress: "", address: "", viewingKey: "", type: "", chainId: "secret-4" }),
              H = Q.type !== i.y.SUGGEST_CW20_TOKEN;
            (0, w.useEffect)(() => {
              j()
                .storage.local.get([m.RO])
                .then(async e => {
                  let t = e[m.RO],
                    a = (await (0, g._d)())[t.chainId],
                    { lcdUrl: s } = C(!1, a, "mainnet");
                  if (t && s)
                    try {
                      if ((B(!0), F(t), W(""), t.type !== i.y.SUGGEST_CW20_TOKEN)) {
                        if (null == x ? void 0 : x[t.contractAddress]) {
                          let e = x[t.contractAddress];
                          z({ name: e.name, symbol: e.symbol, decimals: e.decimals });
                        } else {
                          let e = l.tgY.create(s, t.chainId, t.address),
                            a = await e.getTokenParams(t.contractAddress);
                          a.token_info && z(a.token_info);
                        }
                      } else {
                        let e = await (0, p.s)(s, t.contractAddress);
                        if ("string" == typeof e && e.includes("Invalid")) {
                          W("Invalid Contract Address");
                          return;
                        }
                        z({ name: e.name, symbol: e.symbol, decimals: e.decimals });
                      }
                    } catch (e) {
                      if (e instanceof c.d7) {
                        var n, r;
                        W((null === (r = e.response) || void 0 === r ? void 0 : null === (n = r.data) || void 0 === n ? void 0 : n.message) ?? e.message);
                      } else W(e.message);
                      (0, o.Tb)(e, {
                        tags: {
                          errorType: "suggest_secret_error",
                          source: "suggest_secret",
                          severity: "error",
                          errorName: e instanceof Error ? e.name : "SuggestSecretError"
                        },
                        fingerprint: ["suggest_secret", "suggest_secret_error"],
                        level: "error",
                        contexts: { transaction: { type: "suggest_secret", errorMessage: e instanceof Error ? e.message : String(e) } }
                      });
                    } finally {
                      B(!1);
                    }
                  B(!1);
                });
            }, [C, x]);
            let V = (0, w.useCallback)(async () => {
                K(!0);
                let e = (await (0, g._d)())[Q.chainId],
                  { lcdUrl: t = "" } = C(!1, e, "mainnet"),
                  a = await (0, f.u)(t, I, Q.contractAddress, Q.address);
                return O(!a), K(!1), a;
              }, [I, C, Q.address, Q.chainId, Q.contractAddress]),
              q = (0, w.useCallback)(async () => {
                if (H) {
                  if (I && !(await V())) return;
                  L(!0);
                  let e = (await (0, g._d)())[Q.chainId],
                    { lcdUrl: t = "" } = C(!1, e, "mainnet");
                  if (
                    (await s(t, Q.chainId, Q.address, Q.contractAddress, Q.type === i.y.UPDATE_SECRET20_VIEWING_KEY || (G && !!I), { key: Q.viewingKey || I }),
                    !x[Q.contractAddress])
                  ) {
                    let t = { name: Z.symbol, symbol: Q.contractAddress, decimals: Z.decimals, coinGeckoId: "", icon: "" };
                    await T(Q.contractAddress, t, e);
                  }
                } else {
                  L(!0);
                  let e = (await (0, g._d)())[Q.chainId],
                    a = { coinDenom: Z.symbol, coinMinimalDenom: Q.contractAddress, coinDecimals: Z.decimals, coinGeckoId: "", icon: "", chain: e };
                  window.removeEventListener("beforeunload", t), await y.Xy.setBetaCW20Denoms(Q.contractAddress, a, e);
                  let s = [...y.bI.getEnabledCW20DenomsForChain(e), Q.contractAddress];
                  await y.bI.setEnabledCW20Denoms(s, e), b.jZ.loadBalances();
                }
                window.removeEventListener("beforeunload", t),
                  await j().storage.local.set({ [m.u1]: { data: "Approved" } }),
                  setTimeout(async () => {
                    await j().storage.local.remove([m.RO]), await j().storage.local.remove(m.u1), L(!1), (0, _.oj)() ? E("/home") : window.close();
                  }, 50);
              }, [G, Z.decimals, Z.symbol, s, I, C, H, Q.address, Q.chainId, Q.contractAddress, Q.type, Q.viewingKey, x, E, S, T, V]);
            return (0, n.jsxs)(n.Fragment, {
              children: [
                (0, n.jsxs)("div", {
                  className: "flex flex-col items-center",
                  children: [
                    (0, n.jsx)(N.X6, { text: "Adding token" }),
                    (0, n.jsx)(N.GL, { text: "This will allow this token to be viewed within Leap Wallet" }),
                    (0, n.jsx)(N.QS, { address: Q.contractAddress ?? "" }),
                    P ? (0, n.jsx)(k.I, {}) : Z && (0, n.jsx)(N.P6, { name: Z.name ?? "", symbol: Z.symbol ?? "", decimals: Z.decimals ?? 0 })
                  ]
                }),
                Z &&
                  !P &&
                  (0, n.jsxs)("div", {
                    className: "my-4 w-full",
                    children: [
                      G &&
                        (0, n.jsxs)("div", {
                          className: `relative w-full flex items-center border rounded-xl flex h-12 bg-white-100 dark:bg-gray-900 py-2 pl-5 pr-[10px] ${U && I ? "border-red-300" : "border-gray-500"}`,
                          children: [
                            (0, n.jsx)("input", {
                              placeholder: "viewing key",
                              className: "flex flex-grow text-base dark:text-white-100 text-gray-400 outline-none bg-white-0 placeholder-gray-400::placeholder",
                              value: I,
                              onChange: e => A(e.currentTarget.value),
                              autoComplete: "off"
                            }),
                            R ? (0, n.jsx)(d.T, { color: v.w.white100, className: "h-6 y-6" }) : null
                          ]
                        }),
                      U && I && (0, n.jsx)(u.Z, { size: "sm", className: "mt-1", color: "text-red-300", children: "Invalid Viewing key provided" })
                    ]
                  }),
                (0, n.jsxs)(N.$_, {
                  error: M,
                  isFetching: P,
                  children: [
                    H &&
                      (0, n.jsxs)("div", {
                        className: "flex mb-4 w-full items-center cursor-pointer ml-2",
                        children: [
                          (0, n.jsx)("input", {
                            className: "h-4 w-4 border border-gray-300 rounded-xl",
                            type: "checkbox",
                            value: "",
                            checked: G,
                            onChange: () => D(!G),
                            id: "advancedFeature"
                          }),
                          (0, n.jsx)("label", {
                            className: "form-check-label inline-block dark:text-white-100 text-gray-900 ml-2 text-md",
                            htmlFor: "advancedFeature",
                            children: "(Advanced) Import my own viewing key"
                          })
                        ]
                      }),
                    (0, n.jsx)(N.No, {
                      error: M,
                      rejectBtnClick: t,
                      rejectBtnText: "Reject",
                      confirmBtnClick: q,
                      confirmBtnText: Y || R ? (0, n.jsx)(d.T, { color: v.w.white100 }) : "Approve",
                      isConfirmBtnDisabled: (null == M ? void 0 : M.length) !== 0 || (U && (null == I ? void 0 : I.length) > 0) || !Z.name
                    })
                  ]
                })
              ]
            });
          });
          function S() {
            return (0, n.jsx)(N.zb, {
              suggestKey: m.RO,
              children: e => {
                let { handleRejectBtnClick: t } = e;
                return (0, n.jsx)(T, { handleRejectBtnClick: t });
              }
            });
          }
          s();
        } catch (e) {
          s(e);
        }
      });
    },
    71142: function (e, t, a) {
      a.d(t, { I: () => i });
      var s = a(52322),
        n = a(41477);
      a(2784);
      var r = a(86874);
      function i() {
        return (0, s.jsxs)("div", {
          className: "flex flex-col gap-y-[10px] bg-white-100 dark:bg-gray-900 rounded-2xl p-4 w-full",
          children: [
            (0, s.jsxs)("div", {
              className: "flex flex-col gap-[6px] w-full",
              children: [
                (0, s.jsx)(n.sr, { children: "Coin Name" }),
                (0, s.jsx)(r.Z, { className: "", width: 80, height: 16, containerClassName: "block !leading-none" })
              ]
            }),
            n.iz,
            (0, s.jsxs)("div", {
              className: "flex flex-col gap-[6px] w-full",
              children: [
                (0, s.jsx)(n.sr, { children: "Coin Symbol" }),
                (0, s.jsx)(r.Z, { className: "", width: 50, height: 16, containerClassName: "block !leading-none" })
              ]
            }),
            n.iz,
            (0, s.jsxs)("div", {
              className: "flex flex-col gap-[6px] w-full",
              children: [
                (0, s.jsx)(n.sr, { children: "Coin Decimals" }),
                (0, s.jsx)(r.Z, { className: "", width: 25, height: 16, containerClassName: "block !leading-none" })
              ]
            })
          ]
        });
      }
    },
    94685: function (e, t, a) {
      a.d(t, { QS: () => E, GL: () => x, X6: () => f, zb: () => p, No: () => m, P6: () => N, $_: () => c });
      var s = a(52322),
        n = a(72779),
        r = a.n(n),
        i = a(86200),
        l = a(19623),
        o = a(2784);
      function c(e) {
        let { children: t, error: a, isFetching: n } = e;
        return (0, s.jsxs)("div", {
          className: r()("w-full flex flex-col flex-1 items-center box-border", n ? "h-full justify-center" : "justify-end"),
          children: [
            a ? (0, s.jsx)("div", { className: "my-2", children: (0, s.jsx)(i._, { text: a, disableSentryCapture: !0 }) }) : null,
            n ? (0, s.jsx)(l.T, { color: "#E18881" }) : (0, s.jsx)(s.Fragment, { children: t })
          ]
        });
      }
      var d = a(75377),
        u = a(46103);
      function m(e) {
        let { error: t, rejectBtnClick: a, rejectBtnText: n, confirmBtnClick: i, confirmBtnText: l, isConfirmBtnDisabled: o } = e;
        return (0, s.jsxs)("div", {
          className: r()("flex flex-row justify-between w-full", { "mb-6": !!t }),
          children: [
            (0, s.jsx)(d.Buttons.Generic, {
              style: { height: "48px", background: u.w.gray900, color: u.w.white100 },
              onClick: a,
              "aria-label": "reject button in suggest flow",
              children: (0, s.jsx)("span", { "aria-label": "reject button text in suggest flow", children: n })
            }),
            (0, s.jsx)(d.Buttons.Generic, {
              style: { height: "48px", background: u.w.cosmosPrimary, color: u.w.white100, cursor: "pointer" },
              className: "ml-3 bg-gray-800",
              onClick: i,
              "aria-label": "confirm button in suggest flow",
              disabled: o,
              children: (0, s.jsx)("span", { "aria-label": "confirm button text in suggest flow", children: l })
            })
          ]
        });
      }
      var g = a(69816);
      function f(e) {
        let { text: t } = e;
        return (0, s.jsx)(g.Z, { size: "lg", className: "font-bold mt-5", children: t });
      }
      function x(e) {
        let { text: t } = e;
        return (0, s.jsx)(g.Z, {
          size: "xs",
          className: "font-bold text-center mt-[2px] max-w-[250px]",
          color: "text-gray-800 dark:text-gray-600 mb-2",
          children: t
        });
      }
      var w = a(53108),
        h = a(10289),
        y = a(48534),
        b = a(72565),
        v = a.n(b);
      function p(e) {
        let { children: t, suggestKey: a } = e,
          n = (0, h.s0)(),
          i = (0, o.useCallback)(async () => {
            await v().storage.local.set({ [w.u1]: { error: "Rejected by the user." } }),
              setTimeout(async () => {
                await v().storage.local.remove([a]), await v().storage.local.remove(w.u1), (0, y.oj)() ? n("/home") : window.close();
              }, 10);
          }, [n, a]);
        return (
          (0, o.useEffect)(
            () => (
              window.addEventListener("beforeunload", i),
              v().storage.local.remove(w.u1),
              function () {
                window.removeEventListener("beforeunload", i);
              }
            ),
            [i]
          ),
          (0, s.jsx)("div", {
            className: "flex justify-center items-center h-screen",
            children: (0, s.jsxs)("div", {
              className: "panel-width panel-height max-panel-height enclosing-panel",
              children: [
                (0, s.jsx)("div", { className: "w-full h-1 rounded-t-2xl", style: { backgroundColor: u.w.cosmosPrimary } }),
                (0, s.jsx)("div", {
                  className: r()("relative h-full flex flex-col justify-between items-center pt-4 pb-10", { "px-4": (0, y.oj)(), "px-7": !(0, y.oj)() }),
                  children: t({ handleRejectBtnClick: i })
                })
              ]
            })
          })
        );
      }
      var _ = a(86874);
      function E(e) {
        let { address: t, img: a } = e;
        return t
          ? (0, s.jsx)(d.GenericCard, {
              title: (0, s.jsx)("span", { className: "text-[15px]", children: "Contract Address" }),
              subtitle: (0, s.jsx)("span", { className: "break-all", children: t }),
              className: "h-[80px] py-8 my-5",
              img: a ?? null,
              size: "sm",
              isRounded: !0
            })
          : (0, s.jsxs)("div", {
              className:
                "flex flex-col justify-end items-start w-full px-4 bg-white-100 dark:bg-gray-900 cursor-pointer min-w-[344px] h-[80px] rounded-[16px] pb-2 my-5",
              children: [
                (0, s.jsx)("div", {
                  className: "text-[15px] font-bold text-black-100 dark:text-white-100 text-left max-w-[170px] text-ellipsis overflow-hidden",
                  children: "Contract Address"
                }),
                (0, s.jsx)(_.Z, { height: 14, className: "w-full", containerClassName: "w-full mt-[2px] block !leading-none" }),
                (0, s.jsx)(_.Z, { height: 14, width: 90, containerClassName: "block mt-[2px] !leading-none" })
              ]
            });
      }
      var j = a(41477);
      function N(e) {
        let { name: t, symbol: a, decimals: n } = e;
        return (0, s.jsxs)("div", {
          className: "flex flex-col gap-y-[10px] bg-white-100 dark:bg-gray-900 rounded-2xl p-4 w-full",
          children: [
            (0, s.jsx)(j.sr, { children: "Coin Name" }),
            (0, s.jsx)(j.B4, { children: t }),
            j.iz,
            (0, s.jsx)(j.sr, { children: "Coin Symbol" }),
            (0, s.jsx)(j.B4, { children: a }),
            j.iz,
            (0, s.jsx)(j.sr, { children: "Coin Decimals" }),
            (0, s.jsx)(j.B4, { children: n })
          ]
        });
      }
    },
    53345: function (e, t, a) {
      a.d(t, { s: () => r });
      var s = a(55334),
        n = a(48834).Buffer;
      async function r(e, t) {
        let a = `${e}/cosmwasm/wasm/v1/contract/${t}/smart/${n.from('{"token_info":{}}').toString("base64")}`,
          { data: r } = await s.Z.get(a);
        return r.error && r.error.toLowerCase().includes("decoding bech32 failed") ? "Invalid Contract Address" : r.data;
      }
    },
    56052: function () {}
  }
]);
//# sourceMappingURL=9384.js.map
