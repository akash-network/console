!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "a9de40cf-71ca-416a-9589-d4b87bebf98f"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-a9de40cf-71ca-416a-9589-d4b87bebf98f"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.22.9" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["9384"],
  {
    52056: function (e, t, a) {
      var n, s;
      a.d(t, { y: () => n }),
        a(55968),
        a(95238),
        ((s = n || (n = {})).SEND_TX = "send-tx-to-background"),
        (s.REQUEST_SIGN_DIRECT = "request-sign-direct"),
        (s.REQUEST_SIGN_AMINO = "request-sign-amino"),
        (s.GET_KEY = "get-key"),
        (s.GET_KEYS = "get-keys"),
        (s.ENABLE_ACCESS = "enable-access"),
        (s.GET_CHAIN_INFOS_WITHOUT_ENDPOINTS = "get-chain-infos-without-endpoints"),
        (s.GET_SUPPORTED_CHAINS = "get-supported-chains"),
        (s.GET_CONNECTION_STATUS = "get-connection-status"),
        (s.ADD_SUGGESTED_CHAIN = "add-suggested-chain"),
        (s.DISCONNECT = "disconnect"),
        (s.GET_SECRET20_VIEWING_KEY = "get-secret20-viewing-key"),
        (s.SUGGEST_TOKEN = "suggest-token"),
        (s.SUGGEST_CW20_TOKEN = "suggest-cw20-token"),
        (s.UPDATE_SECRET20_VIEWING_KEY = "update-secret20-viewing-key"),
        (s.GET_PUBKEY_MSG = "get-pubkey-msg"),
        (s.GET_TX_ENCRYPTION_KEY_MSG = "get-tx-encryption-key-msg"),
        (s.REQUEST_ENCRYPT_MSG = "request-encrypt-msg"),
        (s.REQUEST_DECRYPT_MSG = "request-decrypt-msg"),
        (s.REQUEST_VERIFY_ADR36_AMINO_SIGN_DOC = "request-verify-adr36-amino-sign-doc"),
        (s.REQUEST_SIGN_EIP712 = "request-sign-eip712"),
        (s.OPEN_SIDE_PANEL = "open-side-panel");
    },
    85406: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { a: () => g, u: () => x });
          var s = a(41172),
            l = a(15969),
            r = a(55159),
            i = a(2784),
            o = a(22014),
            c = a(72565),
            d = a.n(c),
            u = a(53108),
            m = a(58551),
            f = e([m]);
          async function x(e, t, a, n) {
            let s = l.tgY.create(e, l.oCA.secret.chainId, n);
            return !!(await s.getBalance(n, a, t)).balance;
          }
          function g() {
            let e = (0, m.E)(),
              t = (0, s.VMC)(),
              a = s.rNU.useOperateCosmosTx(),
              { setViewingKeys: n } = (0, s.WdY)();
            return (0, i.useCallback)(
              async (i, c, m, f, g, h) => {
                if (!o.M8.password) throw Error("Password not set");
                let w = await e(),
                  y = l.KQf.create(i ?? "", c, w),
                  b = null == h ? void 0 : h.key;
                if (g) {
                  if (!(await x(i ?? "", b ?? "", f, m))) return { validKey: !1, error: "Invalid viewing key", key: b };
                } else
                  try {
                    var v, p, E, j, _;
                    let { txStatus: e, viewingKey: n } = await y.createViewingKey(m, f, t, {
                      key: b,
                      gasLimit: null == h ? void 0 : h.gasLimit,
                      feeDenom: null == h ? void 0 : h.feeDenom
                    });
                    if (0 !== e.code) return { validKey: !1, error: e.rawLog };
                    a({
                      txHash: e.transactionHash,
                      txType: s.pb0.SecretTokenTransaction,
                      metadata: { contract: f },
                      feeDenomination: "uscrt",
                      feeQuantity:
                        (null === (_ = e.tx) || void 0 === _
                          ? void 0
                          : null === (j = _.auth_info) || void 0 === j
                            ? void 0
                            : null === (E = j.fee) || void 0 === E
                              ? void 0
                              : null === (p = E.amount) || void 0 === p
                                ? void 0
                                : null === (v = p[0]) || void 0 === v
                                  ? void 0
                                  : v.amount) ?? "0.01",
                      chainId: c
                    }),
                      (b = n);
                  } catch (e) {
                    return { validKey: !1, error: "Unable to create viewing key" };
                  }
                let N = (0, r.HI)(b, o.M8.password),
                  k = (await d().storage.local.get([u.rg]))[u.rg];
                if (k) {
                  let e = e => ({ ...k, [m]: { ...k[m], [f]: e ? N : b } });
                  await d().storage.local.set({ [u.rg]: e(!0) }), n(e(!1));
                } else {
                  let e = e => ({ [m]: { [f]: e ? N : b } });
                  await d().storage.local.set({ [u.rg]: e(!0) }), n(e(!1));
                }
                return { validKey: !0, error: null, key: b };
              },
              [e, t, a, n]
            );
          }
          (m = (f.then ? (await f)() : f)[0]), n();
        } catch (e) {
          n(e);
        }
      });
    },
    58551: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { E: () => o });
          var s = a(2784),
            l = a(22014),
            r = a(65027),
            i = e([r]);
          function o() {
            let e = r.w.useGetWallet();
            return (0, s.useCallback)(async () => {
              if (!l.M8.password) throw Error("Password not set");
              return await e();
            }, [e]);
          }
          (r = (i.then ? (await i)() : i)[0]), n();
        } catch (e) {
          n(e);
        }
      });
    },
    50242: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.r(t), a.d(t, { default: () => T });
          var s = a(52322),
            l = a(41172),
            r = a(52056),
            i = a(15969),
            o = a(92642),
            c = a(89178),
            d = a(19623),
            u = a(69816),
            m = a(53108),
            f = a(79533),
            x = a(85406),
            g = a(75958),
            h = a(2784),
            w = a(10289),
            y = a(42799),
            b = a(48346),
            v = a(46103),
            p = a(53345),
            E = a(48534),
            j = a(37906),
            _ = a(72565),
            N = a.n(_),
            k = a(94685),
            C = a(71142),
            S = e([x, b]);
          [x, b] = S.then ? (await S)() : S;
          let I = (0, g.Pi)(e => {
            let { handleRejectBtnClick: t } = e,
              a = (0, l.DI5)(),
              n = (0, x.a)(),
              g = (0, l.hU2)(),
              _ = (0, w.s0)(),
              S = (0, l.yHI)("secret", "mainnet", a),
              T = (0, l.lSw)(),
              I = (0, l.qZl)(),
              [A, G] = (0, h.useState)(""),
              [D, R] = (0, h.useState)(!1),
              [K, O] = (0, h.useState)(!1),
              [P, U] = (0, h.useState)(!1),
              [B, Y] = (0, h.useState)(!0),
              [L, W] = (0, h.useState)(!1),
              [M, Z] = (0, h.useState)(""),
              [z, Q] = (0, h.useState)({ decimals: 0, name: "", symbol: "" }),
              [F, H] = (0, h.useState)({ contractAddress: "", address: "", viewingKey: "", type: "", chainId: "secret-4" }),
              q = F.type !== r.y.SUGGEST_CW20_TOKEN;
            (0, h.useEffect)(() => {
              N()
                .storage.local.get([m.RO])
                .then(async e => {
                  let t = e[m.RO],
                    a = (await (0, f._d)())[t.chainId],
                    { lcdUrl: n } = S(!1, a, "mainnet");
                  if (t && n)
                    try {
                      if ((Y(!0), H(t), Z(""), t.type !== r.y.SUGGEST_CW20_TOKEN)) {
                        if (null == g ? void 0 : g[t.contractAddress]) {
                          let e = g[t.contractAddress];
                          Q({ name: e.name, symbol: e.symbol, decimals: e.decimals });
                        } else {
                          let e = i.tgY.create(n, t.chainId, t.address),
                            a = await e.getTokenParams(t.contractAddress);
                          a.token_info && Q(a.token_info);
                        }
                      } else {
                        let e = await (0, p.s)(n, t.contractAddress);
                        if ("string" == typeof e && e.includes("Invalid")) {
                          Z("Invalid Contract Address");
                          return;
                        }
                        Q({ name: e.name, symbol: e.symbol, decimals: e.decimals });
                      }
                    } catch (e) {
                      if (e instanceof c.d7) {
                        var s, l;
                        Z((null === (l = e.response) || void 0 === l ? void 0 : null === (s = l.data) || void 0 === s ? void 0 : s.message) ?? e.message);
                      } else Z(e.message);
                      (0, o.Tb)(e, { tags: j.rw });
                    } finally {
                      Y(!1);
                    }
                  Y(!1);
                });
            }, [S, g]);
            let V = (0, h.useCallback)(async () => {
                O(!0);
                let e = (await (0, f._d)())[F.chainId],
                  { lcdUrl: t = "" } = S(!1, e, "mainnet"),
                  a = await (0, x.u)(t, A, F.contractAddress, F.address);
                return U(!a), O(!1), a;
              }, [A, S, F.address, F.chainId, F.contractAddress]),
              $ = (0, h.useCallback)(async () => {
                if (q) {
                  if (A && !(await V())) return;
                  W(!0);
                  let e = (await (0, f._d)())[F.chainId],
                    { lcdUrl: t = "" } = S(!1, e, "mainnet");
                  if (
                    (await n(t, F.chainId, F.address, F.contractAddress, F.type === r.y.UPDATE_SECRET20_VIEWING_KEY || (D && !!A), { key: F.viewingKey || A }),
                    !g[F.contractAddress])
                  ) {
                    let t = { name: z.symbol, symbol: F.contractAddress, decimals: z.decimals, coinGeckoId: "", icon: "" };
                    await I(F.contractAddress, t, e);
                  }
                } else {
                  W(!0);
                  let e = (await (0, f._d)())[F.chainId],
                    a = { coinDenom: z.symbol, coinMinimalDenom: F.contractAddress, coinDecimals: z.decimals, coinGeckoId: "", icon: "", chain: e };
                  window.removeEventListener("beforeunload", t), await y.Xy.setBetaCW20Denoms(F.contractAddress, a, e);
                  let n = [...y.bI.getEnabledCW20DenomsForChain(e), F.contractAddress];
                  await y.bI.setEnabledCW20Denoms(n, e), b.jZ.loadBalances();
                }
                window.removeEventListener("beforeunload", t),
                  await N().storage.local.set({ [m.u1]: { data: "Approved" } }),
                  setTimeout(async () => {
                    await N().storage.local.remove([m.RO]), await N().storage.local.remove(m.u1), W(!1), (0, E.oj)() ? _("/home") : window.close();
                  }, 50);
              }, [D, z.decimals, z.symbol, n, A, S, q, F.address, F.chainId, F.contractAddress, F.type, F.viewingKey, g, _, T, I, V]);
            return (0, s.jsxs)(s.Fragment, {
              children: [
                (0, s.jsxs)("div", {
                  className: "flex flex-col items-center",
                  children: [
                    (0, s.jsx)(k.X6, { text: "Adding token" }),
                    (0, s.jsx)(k.GL, { text: "This will allow this token to be viewed within Leap Wallet" }),
                    (0, s.jsx)(k.QS, { address: F.contractAddress ?? "" }),
                    B ? (0, s.jsx)(C.I, {}) : z && (0, s.jsx)(k.P6, { name: z.name ?? "", symbol: z.symbol ?? "", decimals: z.decimals ?? 0 })
                  ]
                }),
                z &&
                  !B &&
                  (0, s.jsxs)("div", {
                    className: "my-4 w-full",
                    children: [
                      D &&
                        (0, s.jsxs)("div", {
                          className: `relative w-full flex items-center border rounded-xl flex h-12 bg-white-100 dark:bg-gray-900 py-2 pl-5 pr-[10px] ${P && A ? "border-red-300" : "border-gray-500"}`,
                          children: [
                            (0, s.jsx)("input", {
                              placeholder: "viewing key",
                              className: "flex flex-grow text-base dark:text-white-100 text-gray-400 outline-none bg-white-0 placeholder-gray-400::placeholder",
                              value: A,
                              onChange: e => G(e.currentTarget.value),
                              autoComplete: "off"
                            }),
                            K ? (0, s.jsx)(d.T, { color: v.w.white100, className: "h-6 y-6" }) : null
                          ]
                        }),
                      P && A && (0, s.jsx)(u.Z, { size: "sm", className: "mt-1", color: "text-red-300", children: "Invalid Viewing key provided" })
                    ]
                  }),
                (0, s.jsxs)(k.$_, {
                  error: M,
                  isFetching: B,
                  children: [
                    q &&
                      (0, s.jsxs)("div", {
                        className: "flex mb-4 w-full items-center cursor-pointer ml-2",
                        children: [
                          (0, s.jsx)("input", {
                            className: "h-4 w-4 border border-gray-300 rounded-xl",
                            type: "checkbox",
                            value: "",
                            checked: D,
                            onChange: () => R(!D),
                            id: "advancedFeature"
                          }),
                          (0, s.jsx)("label", {
                            className: "form-check-label inline-block dark:text-white-100 text-gray-900 ml-2 text-md",
                            htmlFor: "advancedFeature",
                            children: "(Advanced) Import my own viewing key"
                          })
                        ]
                      }),
                    (0, s.jsx)(k.No, {
                      error: M,
                      rejectBtnClick: t,
                      rejectBtnText: "Reject",
                      confirmBtnClick: $,
                      confirmBtnText: L || K ? (0, s.jsx)(d.T, { color: v.w.white100 }) : "Approve",
                      isConfirmBtnDisabled: (null == M ? void 0 : M.length) !== 0 || (P && (null == A ? void 0 : A.length) > 0) || !z.name
                    })
                  ]
                })
              ]
            });
          });
          function T() {
            return (0, s.jsx)(k.zb, {
              suggestKey: m.RO,
              children: e => {
                let { handleRejectBtnClick: t } = e;
                return (0, s.jsx)(I, { handleRejectBtnClick: t });
              }
            });
          }
          n();
        } catch (e) {
          n(e);
        }
      });
    },
    71142: function (e, t, a) {
      a.d(t, { I: () => r });
      var n = a(52322),
        s = a(41477);
      a(2784);
      var l = a(86874);
      function r() {
        return (0, n.jsxs)("div", {
          className: "flex flex-col gap-y-[10px] bg-white-100 dark:bg-gray-900 rounded-2xl p-4 w-full",
          children: [
            (0, n.jsxs)("div", {
              className: "flex flex-col gap-[6px] w-full",
              children: [
                (0, n.jsx)(s.sr, { children: "Coin Name" }),
                (0, n.jsx)(l.Z, { className: "", width: 80, height: 16, containerClassName: "block !leading-none" })
              ]
            }),
            s.iz,
            (0, n.jsxs)("div", {
              className: "flex flex-col gap-[6px] w-full",
              children: [
                (0, n.jsx)(s.sr, { children: "Coin Symbol" }),
                (0, n.jsx)(l.Z, { className: "", width: 50, height: 16, containerClassName: "block !leading-none" })
              ]
            }),
            s.iz,
            (0, n.jsxs)("div", {
              className: "flex flex-col gap-[6px] w-full",
              children: [
                (0, n.jsx)(s.sr, { children: "Coin Decimals" }),
                (0, n.jsx)(l.Z, { className: "", width: 25, height: 16, containerClassName: "block !leading-none" })
              ]
            })
          ]
        });
      }
    },
    94685: function (e, t, a) {
      a.d(t, { QS: () => j, GL: () => g, X6: () => x, zb: () => p, No: () => m, P6: () => N, $_: () => c });
      var n = a(52322),
        s = a(72779),
        l = a.n(s),
        r = a(86200),
        i = a(19623),
        o = a(2784);
      function c(e) {
        let { children: t, error: a, isFetching: s } = e;
        return (0, n.jsxs)("div", {
          className: l()("w-full flex flex-col flex-1 items-center box-border", s ? "h-full justify-center" : "justify-end"),
          children: [
            a ? (0, n.jsx)("div", { className: "my-2", children: (0, n.jsx)(r._, { text: a }) }) : null,
            s ? (0, n.jsx)(i.T, { color: "#E18881" }) : (0, n.jsx)(n.Fragment, { children: t })
          ]
        });
      }
      var d = a(75377),
        u = a(46103);
      function m(e) {
        let { error: t, rejectBtnClick: a, rejectBtnText: s, confirmBtnClick: r, confirmBtnText: i, isConfirmBtnDisabled: o } = e;
        return (0, n.jsxs)("div", {
          className: l()("flex flex-row justify-between w-full", { "mb-6": !!t }),
          children: [
            (0, n.jsx)(d.Buttons.Generic, {
              style: { height: "48px", background: u.w.gray900, color: u.w.white100 },
              onClick: a,
              "aria-label": "reject button in suggest flow",
              children: (0, n.jsx)("span", { "aria-label": "reject button text in suggest flow", children: s })
            }),
            (0, n.jsx)(d.Buttons.Generic, {
              style: { height: "48px", background: u.w.cosmosPrimary, color: u.w.white100, cursor: "pointer" },
              className: "ml-3 bg-gray-800",
              onClick: r,
              "aria-label": "confirm button in suggest flow",
              disabled: o,
              children: (0, n.jsx)("span", { "aria-label": "confirm button text in suggest flow", children: i })
            })
          ]
        });
      }
      var f = a(69816);
      function x(e) {
        let { text: t } = e;
        return (0, n.jsx)(f.Z, { size: "lg", className: "font-bold mt-5", children: t });
      }
      function g(e) {
        let { text: t } = e;
        return (0, n.jsx)(f.Z, {
          size: "xs",
          className: "font-bold text-center mt-[2px] max-w-[250px]",
          color: "text-gray-800 dark:text-gray-600 mb-2",
          children: t
        });
      }
      var h = a(53108),
        w = a(10289),
        y = a(48534),
        b = a(72565),
        v = a.n(b);
      function p(e) {
        let { children: t, suggestKey: a } = e,
          s = (0, w.s0)(),
          r = (0, o.useCallback)(async () => {
            await v().storage.local.set({ [h.u1]: { error: "Rejected by the user." } }),
              setTimeout(async () => {
                await v().storage.local.remove([a]), await v().storage.local.remove(h.u1), (0, y.oj)() ? s("/home") : window.close();
              }, 10);
          }, [s, a]);
        return (
          (0, o.useEffect)(
            () => (
              window.addEventListener("beforeunload", r),
              v().storage.local.remove(h.u1),
              function () {
                window.removeEventListener("beforeunload", r);
              }
            ),
            [r]
          ),
          (0, n.jsx)("div", {
            className: "flex justify-center items-center h-screen",
            children: (0, n.jsxs)("div", {
              className: "panel-width panel-height max-panel-height enclosing-panel",
              children: [
                (0, n.jsx)("div", { className: "w-full h-1 rounded-t-2xl", style: { backgroundColor: u.w.cosmosPrimary } }),
                (0, n.jsx)("div", {
                  className: l()("relative h-full flex flex-col justify-between items-center pt-4 pb-10", { "px-4": (0, y.oj)(), "px-7": !(0, y.oj)() }),
                  children: t({ handleRejectBtnClick: r })
                })
              ]
            })
          })
        );
      }
      var E = a(86874);
      function j(e) {
        let { address: t, img: a } = e;
        return t
          ? (0, n.jsx)(d.GenericCard, {
              title: (0, n.jsx)("span", { className: "text-[15px]", children: "Contract Address" }),
              subtitle: (0, n.jsx)("span", { className: "break-all", children: t }),
              className: "h-[80px] py-8 my-5",
              img: a ?? null,
              size: "sm",
              isRounded: !0
            })
          : (0, n.jsxs)("div", {
              className:
                "flex flex-col justify-end items-start w-full px-4 bg-white-100 dark:bg-gray-900 cursor-pointer min-w-[344px] h-[80px] rounded-[16px] pb-2 my-5",
              children: [
                (0, n.jsx)("div", {
                  className: "text-[15px] font-bold text-black-100 dark:text-white-100 text-left max-w-[170px] text-ellipsis overflow-hidden",
                  children: "Contract Address"
                }),
                (0, n.jsx)(E.Z, { height: 14, className: "w-full", containerClassName: "w-full mt-[2px] block !leading-none" }),
                (0, n.jsx)(E.Z, { height: 14, width: 90, containerClassName: "block mt-[2px] !leading-none" })
              ]
            });
      }
      var _ = a(41477);
      function N(e) {
        let { name: t, symbol: a, decimals: s } = e;
        return (0, n.jsxs)("div", {
          className: "flex flex-col gap-y-[10px] bg-white-100 dark:bg-gray-900 rounded-2xl p-4 w-full",
          children: [
            (0, n.jsx)(_.sr, { children: "Coin Name" }),
            (0, n.jsx)(_.B4, { children: t }),
            _.iz,
            (0, n.jsx)(_.sr, { children: "Coin Symbol" }),
            (0, n.jsx)(_.B4, { children: a }),
            _.iz,
            (0, n.jsx)(_.sr, { children: "Coin Decimals" }),
            (0, n.jsx)(_.B4, { children: s })
          ]
        });
      }
    },
    53345: function (e, t, a) {
      a.d(t, { s: () => l });
      var n = a(55334),
        s = a(48834).Buffer;
      async function l(e, t) {
        let a = `${e}/cosmwasm/wasm/v1/contract/${t}/smart/${s.from('{"token_info":{}}').toString("base64")}`,
          { data: l } = await n.Z.get(a);
        return l.error && l.error.toLowerCase().includes("decoding bech32 failed") ? "Invalid Contract Address" : l.data;
      }
    },
    56052: function () {}
  }
]);
//# sourceMappingURL=9384.js.map
