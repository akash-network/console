!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      o = new e.Error().stack;
    o &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[o] = "46aaa4c9-ed98-437c-bf44-9cffa3709faf"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-46aaa4c9-ed98-437c-bf44-9cffa3709faf"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.22.9" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["2929"],
  {
    63400: function (e, o, t) {
      t.d(o, { u: () => s });
      var n = t(52322),
        i = t(71769);
      t(2784);
      var r = t(70514);
      function s(e) {
        let { className: o } = e;
        return (0, n.jsxs)("div", {
          className: (0, r.cn)("w-full flex flex-row items-start px-4 py-3 justify-start dark:bg-red-900 bg-red-100 rounded-2xl", o),
          children: [
            (0, n.jsx)(i.v, { weight: "fill", size: 20, className: "mr-2 text-destructive-100 p-[2px]" }),
            (0, n.jsxs)("div", {
              children: [
                (0, n.jsx)("p", { className: "text-sm text-foreground font-bold !leading-[20px]", children: "Unable to connect to ledger device" }),
                (0, n.jsx)("p", {
                  className: "text-xs text-secondary-800 font-medium !leading-[19px] mt-1",
                  children: "Please check if your ledger is connected and try again."
                })
              ]
            })
          ]
        });
      }
    },
    79215: function (e, o, t) {
      t.d(o, { og: () => p });
      var n = t(52322),
        i = t(26793),
        r = t(89187),
        s = t(16283),
        a = t(85027),
        l = t(86240),
        d = t(65953);
      t(2784);
      var m = t(70514),
        u = t(49409);
      let c = e => {
          let { activeIndex: o, setActiveIndex: t, limit: d } = e,
            { walletAvatar: u, walletName: c } = (0, l.v)();
          return (0, n.jsxs)(a.m, {
            className: "bg-secondary-50 border-b border-secondary-100",
            children: [
              (0, n.jsx)("div", { className: "w-[72px]" }),
              (0, n.jsx)(s.G2, { className: "bg-secondary-200", showWalletAvatar: !0, walletName: c, walletAvatar: u, handleDropdownClick: () => void 0 }),
              (0, n.jsx)("div", {
                className: "min-w-[72px]",
                children:
                  void 0 !== o &&
                  void 0 !== d &&
                  d > 1 &&
                  (0, n.jsxs)("div", {
                    className: "flex items-center rounded-full bg-secondary-200 p-2 justify-between",
                    children: [
                      (0, n.jsx)(i.W, {
                        size: 14,
                        className: (0, m.cn)("", { "text-muted-foreground": 0 === o, "text-foreground cursor-pointer": 0 !== o }),
                        onClick: () => {
                          t && void 0 !== o && o > 0 && t(o - 1);
                        }
                      }),
                      (0, n.jsxs)("p", { className: "text-sm font-bold text-foreground", children: [o + 1, "/", d] }),
                      (0, n.jsx)(r.T, {
                        size: 14,
                        className: (0, m.cn)("", { "text-muted-foreground": o === d - 1, "text-foreground cursor-pointer": o !== d - 1 }),
                        onClick: () => {
                          t && void 0 !== o && d && o < d - 1 && t(o + 1);
                        }
                      })
                    ]
                  })
              })
            ]
          });
        },
        g = e =>
          (0, n.jsxs)("div", {
            className: "flex items-center gap-5",
            children: [
              (0, n.jsx)("img", { src: e.logo, onError: (0, u._)(d.Globe), className: "size-[54px] rounded-full" }),
              (0, n.jsxs)("div", {
                className: "flex flex-col gap-[3px]",
                children: [
                  (0, n.jsx)("span", { className: "text-lg font-bold", children: e.title }),
                  (0, n.jsx)("span", { className: "text-xs text-muted-foreground", children: e.subTitle })
                ]
              })
            ]
          }),
        p = e =>
          (0, n.jsxs)(n.Fragment, {
            children: [
              (0, n.jsx)(c, { activeIndex: e.activeIndex, setActiveIndex: e.setActiveIndex, limit: e.limit }),
              (0, n.jsxs)("div", {
                className: (0, m.cn)(
                  "flex flex-col gap-6 mx-auto h-[calc(100%-165px)] w-full max-w-2xl box-border overflow-y-scroll pt-6 px-6 bg-secondary-50",
                  e.className
                ),
                children: [(0, n.jsx)(g, { ...e }), e.children]
              })
            ]
          });
    },
    69682: function (e, o, t) {
      t.d(o, { Z: () => l });
      var n = t(52322),
        i = t(14981),
        r = t(4370),
        s = t(30464),
        a = t(2784);
      let l = e => {
        let { children: o, title: t, className: l, leftIcon: d, initialOpen: m = !1 } = e,
          [u, c] = (0, a.useState)(m),
          g = (0, a.useCallback)(() => {
            c(e => !e);
          }, []);
        return (0, n.jsxs)("div", {
          className: "rounded-2xl p-4 mt-4 dark:bg-gray-900 bg-white-100",
          children: [
            (0, n.jsxs)("button", {
              className: "flex items-center w-full",
              onClick: g,
              children: [
                d ? (0, n.jsx)("img", { src: d, className: "mr-2 h-5 w-5" }) : null,
                (0, n.jsx)("p", { className: "text-gray-500 dark:text-gray-100 text-sm font-medium tracking-wide", children: t }),
                (0, n.jsx)("div", {
                  className: "p-2 ml-auto cursor-pointer",
                  children: (0, n.jsx)("img", { src: s.r.Misc.DownArrow, alt: "Down Arrow", className: `transition-transform ${u ? "rotate-180" : ""}` })
                })
              ]
            }),
            (0, n.jsx)(i.M, {
              children: u
                ? (0, n.jsx)(
                    r.E.div,
                    {
                      style: { overflow: "hidden" },
                      initial: { height: 0 },
                      animate: { height: "auto" },
                      transition: { duration: 0.25 },
                      exit: { height: 0 },
                      className: l,
                      children: o
                    },
                    "container"
                  )
                : null
            })
          ]
        });
      };
    },
    57767: function (e, o, t) {
      t.d(o, { Z: () => a });
      var n = t(52322),
        i = t(14281);
      t(2784);
      var r = t(86376),
        s = t(69816);
      function a(e) {
        let { showLedgerPopup: o, onClose: t } = e;
        return (0, n.jsx)(i.Z, {
          isOpen: o,
          onClose: t,
          title: "Confirm on Ledger",
          children: (0, n.jsxs)("div", {
            className: "flex flex-col items-center",
            children: [
              (0, n.jsx)("div", { className: "my-10", children: (0, n.jsx)(r.Z, {}) }),
              (0, n.jsx)(s.Z, { size: "md", className: "font-bold mb-7", children: "Approve transaction on your hardware wallet" })
            ]
          })
        });
      }
    },
    74703: function (e, o, t) {
      t.d(o, { u: () => i });
      var n,
        i =
          (((n = {}).signResponse = "sign-response"),
          (n.signingPopupOpen = "signing-popup-open"),
          (n.signTransaction = "sign-transaction"),
          (n.signBitcoinResponse = "sign-bitcoin-response"),
          (n.signSeiEvmResponse = "sign-sei-evm-response"),
          n);
    },
    49728: function (e, o, t) {
      t.d(o, { U: () => d });
      var n = t(2784),
        i = t(10289),
        r = t(55736),
        s = t(48534),
        a = t(72565),
        l = t.n(a);
      let d = () => {
        let e = (0, i.s0)();
        return (0, n.useCallback)(async () => {
          let o = l().extension.getViews({ type: "popup" }),
            t = 0 === o.length && 600 === window.outerHeight && 400 === window.outerWidth,
            n = -1 !== o.findIndex(e => e === window);
          if (t || n || (0, s.oj)()) {
            if (!(0, s.oj)()) {
              let e = (await l().windows.getAll()).find(e => "popup" !== e.type);
              e && l().tabs.create({ url: l().runtime.getURL("index.html#/reconnect-ledger"), windowId: e.id }), window.close();
              return;
            }
            window.open("index.html#/reconnect-ledger", "_blank"), (0, r.I)();
          } else e("/reconnect-ledger");
        }, [e]);
      };
    },
    94648: function (e, o, t) {
      t.a(e, async function (e, n) {
        try {
          t.d(o, { Z: () => m });
          var i = t(52322),
            r = t(58885),
            s = t(96217);
          t(2784);
          var a = t(42799),
            l = t(48346),
            d = e([r, l]);
          [r, l] = d.then ? (await d)() : d;
          let m = e => {
            let { isOpen: o, onClose: t, gasPriceError: n } = e;
            return (0, i.jsxs)(s.Z, {
              isOpen: o,
              onClose: t,
              fullScreen: !0,
              title: "Edit gas fees",
              className: "p-6",
              children: [
                (0, i.jsx)("p", { className: "text-xs font-medium text-muted-foreground", children: "Select gas options" }),
                (0, i.jsx)(r.ZP.Selector, { isNoSetSelector: !0, className: "my-6" }),
                (0, i.jsxs)("div", {
                  className: "border border-secondary-100 rounded-lg ",
                  children: [
                    (0, i.jsx)(r.ZP.AdditionalSettingsToggle, {}),
                    (0, i.jsx)(r.ZP.AdditionalSettings, { showGasLimitWarning: !0, rootDenomsStore: a.gb, rootBalanceStore: l.jZ }),
                    !!n && (0, i.jsx)("p", { className: "text-destructive-100 text-sm font-medium mt-2 px-1", children: n })
                  ]
                })
              ]
            });
          };
          n();
        } catch (e) {
          n(e);
        }
      });
    },
    82680: function (e, o, t) {
      t.d(o, { r: () => a });
      var n = t(41172),
        i = t(15969),
        r = t(2784);
      async function s(e) {
        let { feeDenomData: o, feeAmount: t, feeDenomUsdValue: n, maxFeeUsdValue: r } = e;
        if (!n) return null;
        let s = !1;
        return n && (s = (0, i.t7o)(t, o.coinDecimals).multipliedBy(n).lt(r)), s;
      }
      function a(e, o, t, i) {
        let { data: a } = (0, n.Rz$)(),
          { lcdUrl: l } = (0, n.U9i)(o),
          d = (0, n.xxU)();
        return (0, r.useCallback)(
          async (o, i) => {
            let r;
            let m = (null == a ? void 0 : a.allChains.maxFeeValueUSD) ?? 10,
              u =
                null == t
                  ? void 0
                  : t.find(e => {
                      let { ibcDenom: t, denom: n } = e;
                      return t === o.feeDenom ? t === o.feeDenom : (null == n ? void 0 : n.coinMinimalDenom) === o.feeDenom;
                    }),
              c = null == u ? void 0 : u.denom;
            c || (c = e[o.feeDenom]),
              (null == c ? void 0 : c.chain) && (r = await (0, n.knL)("1", c.coinGeckoId, c.chain, n.r95.US.currencyPointer, `${d}-${c.coinMinimalDenom}`));
            let g = await s({ feeDenomData: c, maxFeeUsdValue: m, feeDenomUsdValue: r, lcdUrl: l ?? "", ...o });
            return g || i(c, g), g;
          },
          [t, a, i, l]
        );
      }
    },
    56004: function (e, o, t) {
      t.a(e, async function (e, n) {
        try {
          t.r(o), t.d(o, { default: () => ea });
          var i = t(52322),
            r = t(39995),
            s = t(41172),
            a = t(15969),
            l = t(62423),
            d = t(59458),
            m = t(7835),
            u = t(92642),
            c = t(72779),
            g = t.n(c),
            p = t(79215),
            f = t(86200),
            v = t(63400),
            A = t(58885),
            k = t(57767),
            y = t(19623),
            h = t(69816),
            b = t(91486),
            P = t(74703),
            I = t(53108),
            M = t(63184),
            w = t(79533),
            _ = t(74229),
            S = t(76131),
            x = t(49728),
            U = t(78935),
            T = t(65027),
            D = t(95238),
            C = t(75958),
            B = t(2784),
            N = t(10289),
            E = t(42799),
            O = t(39713),
            R = t(48346),
            L = t(46103),
            j = t(44818),
            q = t(12499),
            $ = t(48534),
            F = t(37906),
            V = t(7661),
            Z = t(72565),
            G = t.n(Z),
            H = t(41026),
            z = t(98421),
            W = t(68091),
            Y = t(5852),
            J = t(83134),
            K = t(82680),
            Q = t(44392),
            X = t(83064),
            ee = t(84592),
            eo = t(33615),
            et = t(48834).Buffer,
            en = e([T, O, S, eo, A, ee, X, Q, R]);
          [T, O, S, eo, A, ee, X, Q, R] = en.then ? (await en)() : en;
          let ei = T.w.useGetWallet,
            er = new l.tX(),
            es = (0, C.Pi)(e => {
              var o;
              let { data: t, chainId: n, isSignArbitrary: c, rootBalanceStore: y, rootStakeStore: w, rootDenomsStore: T, activeChain: C } = e,
                E = (0, B.useRef)(!1),
                R = (0, B.useRef)(!1),
                Z = (0, B.useRef)(!1),
                [en, es] = (0, B.useState)(!1),
                [ea, el] = (0, B.useState)(null),
                [ed, em] = (0, B.useState)(!1),
                [eu, ec] = (0, B.useState)(),
                [eg, ep] = (0, B.useState)(null),
                [ef, ev] = (0, B.useState)(null),
                [eA, ek] = (0, B.useState)(""),
                [ey, eh] = (0, B.useState)(""),
                [eb, eP] = (0, B.useState)(!1),
                eI = (0, s.QSC)(C),
                eM = (0, s.rTu)(),
                ew = ei(C),
                e_ = (0, N.s0)(),
                eS = (0, B.useMemo)(
                  () => ((null == eI ? void 0 : eI.testnetChainId) && (null == eI ? void 0 : eI.testnetChainId) === n ? "testnet" : "mainnet"),
                  [null == eI ? void 0 : eI.testnetChainId, n]
                ),
                ex = T.allDenoms,
                eU = (0, A.e7)(ex, { activeChain: C }),
                eT = s.rNU.useLogCosmosDappTx(),
                eD = (0, s.dco)(),
                eC = (0, B.useRef)(!1),
                [eB, eN] = (0, B.useState)(null),
                [eE, eO] = (0, B.useState)(!1),
                { setDefaultFee: eR } = (0, s.ezp)(),
                eL = (0, B.useRef)(null),
                ej = O.zT.getStore(C, eS, !1),
                eq = null == ej ? void 0 : ej.data,
                e$ = null == ej ? void 0 : ej.isLoading,
                eF = (0, K.r)(ex, C, eq, e$);
              (0, B.useEffect)(() => {
                !eB &&
                  eL.current &&
                  setTimeout(() => {
                    eL.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
                  }, 10);
              }, [eB]),
                (0, B.useEffect)(() => {
                  y.loadBalances(C, eS);
                }, [C, eS]);
              let [eV, eZ] = (0, B.useState)({ gasPrice: eU.gasPrice, option: s.j1p.LOW });
              (0, j.h)(null !== eM, "activeWallet is null");
              let {
                  isAmino: eG,
                  isAdr36: eH,
                  ethSignType: ez,
                  signOptions: eW,
                  eip712Types: eY
                } = (0, B.useMemo)(() => {
                  let e = !!(null == t ? void 0 : t.isAmino),
                    o = !!(null == t ? void 0 : t.isAdr36),
                    n = null == t ? void 0 : t.ethSignType,
                    i = null == t ? void 0 : t.eip712Types,
                    r = null == t ? void 0 : t.signOptions;
                  return { isAmino: e, isAdr36: o, ethSignType: n, signOptions: r, eip712Types: i };
                }, [t]),
                [eJ, eK, eQ, eX, e0, e1, e2] = (0, B.useMemo)(() => {
                  if (eG) {
                    let o;
                    let n = (0, W.k)({
                      signRequestData: { "sign-request": t },
                      gasPrice: eV.gasPrice,
                      gasLimit: eA,
                      isAdr36: !!eH,
                      memo: ey,
                      isGasOptionSelected: eC.current
                    });
                    if (c) {
                      var e;
                      o = (null == t ? void 0 : null === (e = t.signOptions) || void 0 === e ? void 0 : e.isADR36WithString)
                        ? et.from(n.signDoc.msgs[0].value.data, "base64").toString("utf-8")
                        : n.signDoc.msgs[0].value.data;
                    } else
                      o = ez
                        ? [{ raw: n.signDoc.msgs, parsed: { __type: "sign/MsgSignData", message: n.signDoc.msgs[0].value.data } }]
                        : n.signDoc.msgs.map(e => {
                            let o;
                            try {
                              if (!(o = r.uA.convertFromAminoToDirect(e.type, e))) throw Error("unable to convert amino message to direct");
                              return { raw: e, parsed: er.parse({ "@type": o.typeUrl, ...e.value }) };
                            } catch (o) {
                              return { raw: e, parsed: { __type: l.ax.Unimplemented, message: e } };
                            }
                          });
                    return [n.allowSetFee, o, n.signDoc, n.signDoc, n.fee, n.defaultFee, n.defaultMemo];
                  }
                  {
                    let e = (0, Y.T)({
                        signRequestData: { "sign-request": t },
                        gasPrice: eV.gasPrice,
                        gasLimit: eA,
                        memo: ey,
                        isGasOptionSelected: eC.current
                      }),
                      o = (0, Y.B)({ "sign-request": { signDoc: e.signDoc } }),
                      n = o.txMsgs.map(e => {
                        if (e instanceof r.dj) {
                          let o = e.toJSON();
                          return { raw: o, parsed: { __type: l.ax.Unimplemented, message: { "@type": o.type_url, body: o.value } } };
                        }
                        if (e.unpacked.msg instanceof Uint8Array) {
                          let o = (0, V.Sg)(e.unpacked.msg),
                            t = et.from(o, "base64").toString();
                          try {
                            let o = JSON.parse(t);
                            e.unpacked.msg = o;
                          } catch {
                            e.unpacked.msg = t;
                          }
                        }
                        let o = (0, r.$c)(e.unpacked);
                        return { raw: { "@type": e.typeUrl, ...o }, parsed: er.parse({ "@type": e.typeUrl, ...o }) };
                      });
                    return [e.allowSetFee, n, o.toJSON(), e.signDoc, e.fee, e.defaultFee, e.defaultMemo];
                  }
                }, [eG, t, eV.gasPrice, eA, eH, ey, c, ez]),
                e3 = null == t ? void 0 : t.origin,
                e4 = (0, U.G)(e3),
                e6 = (0, _.a1)(),
                e8 = (0, B.useMemo)(() => {
                  if (Array.isArray(eK)) return eK.map(e => e.raw["@type"] ?? e.raw.type).filter(Boolean);
                }, [eK]),
                e7 = (0, B.useCallback)(() => {
                  setTimeout(() => {
                    y.refetchBalances(C, eS), w.updateStake(C, eS, !0);
                  }, 3e3);
                }, [C, y, w, eS]),
                e5 = (0, B.useCallback)(async () => {
                  R.current ||
                    Z.current ||
                    ((R.current = !0),
                    G().runtime.sendMessage({ type: P.u.signResponse, payload: { status: "error", data: "Transaction cancelled by the user." } }),
                    (0, $.oj)()
                      ? e_("/home")
                      : (await (0, a._vH)(100),
                        setTimeout(async () => {
                          window.close();
                        }, 10)));
                }, [e_]),
                e9 = (0, B.useMemo)(() => (e1 ? ("gasLimit" in e1 ? e1.gasLimit.toString() : e1.gas.toString()) : eD[C].DEFAULT_GAS_IBC.toString()), [C, e1]),
                oe = (0, B.useMemo)(() => {
                  if (e1 && (null == e1 ? void 0 : e1.amount[0])) {
                    let { denom: e } = e1.amount[0];
                    return e;
                  }
                  return eU.gasPrice.denom;
                }, [e1, eU.gasPrice]),
                oo = (0, x.U)(),
                ot = (0, B.useMemo)(() => (0, q.h)(eu), [eu]),
                on = (0, B.useCallback)(async () => {
                  var e, o, t, n, i, l, d, m;
                  if (ot) {
                    try {
                      await G().runtime.sendMessage({ type: P.u.signResponse, payload: { status: "error", data: "Transaction cancelled by the user." } }),
                        await oo();
                    } catch (t) {
                      (0, u.Tb)(t, {
                        tags: {
                          errorType: "cosmos_transaction_error",
                          source: "sign_transaction",
                          severity: "error",
                          errorName: t instanceof Error ? t.name : "CosmosTransactionError",
                          transactionType: "cosmos_dapp_transaction"
                        },
                        fingerprint: ["cosmos_dapp_transaction", "cosmos_dapp_transaction_error"],
                        level: "error",
                        extra: {
                          feeQuantity: null == e0 ? void 0 : null === (e = e0.amount[0]) || void 0 === e ? void 0 : e.amount.toString(),
                          feeDenomination: (null == e0 ? void 0 : null === (o = e0.amount[0]) || void 0 === o ? void 0 : o.denom) ?? "uatom",
                          chain: C,
                          chainId: eI.chainId,
                          address: eM.addresses[C],
                          network: eS,
                          isCosmos: !0,
                          appUrl: e3 ?? origin
                        },
                        contexts: {
                          transaction: { type: "cosmos", chain: C, network: eS, appUrl: e3 ?? origin, errorMessage: t instanceof Error ? t.message : String(t) }
                        }
                      });
                    }
                    return;
                  }
                  let g = eM.addresses[C];
                  if (!C || !eX || !g) return;
                  let p = c || ez,
                    f = e => () => {};
                  if (eG) {
                    ep(null);
                    try {
                      if (!p) {
                        let e = null;
                        try {
                          let o = eX.fee;
                          e = await eF({ feeDenom: o.amount[0].denom, feeAmount: o.amount[0].amount, gaslimit: D.Z.fromString(o.gas), chain: C }, f(o));
                        } catch (e) {
                          (0, u.Tb)(e, {
                            tags: {
                              ...F.rw,
                              errorType: "cosmos_transaction_fee_error",
                              source: "sign_transaction",
                              severity: "error",
                              errorName: e instanceof Error ? e.name : "CosmosTransactionFeeError",
                              transactionType: "cosmos_dapp_transaction"
                            },
                            fingerprint: ["cosmos_dapp_transaction", "cosmos_dapp_transaction_error"],
                            level: "error",
                            extra: {
                              feeQuantity: null == e0 ? void 0 : null === (i = e0.amount[0]) || void 0 === i ? void 0 : i.amount.toString(),
                              feeDenomination: (null == e0 ? void 0 : null === (l = e0.amount[0]) || void 0 === l ? void 0 : l.denom) ?? "uatom",
                              chain: C,
                              chainId: null == eI ? void 0 : eI.chainId,
                              address: null == eM ? void 0 : eM.addresses[C],
                              network: eS,
                              isCosmos: !0,
                              appUrl: e3 ?? origin
                            },
                            contexts: {
                              transaction: {
                                type: "cosmos",
                                chain: C,
                                network: eS,
                                appUrl: e3 ?? origin,
                                errorMessage: e instanceof Error ? e.message : String(e)
                              }
                            }
                          });
                        }
                        if (!1 === e) throw Error("Unusually high fees detected, could not process transaction. Please try again.");
                      }
                      let e = await ew(C, !!(ez || eY));
                      eM.walletType === s._KQ.LEDGER && em(!0);
                      let o = (await e.getAccounts())[0].pubkey,
                        t = await (async () => {
                          try {
                            if (ez) return (0, a.Xei)(g, e, eX, ez);
                            if (eY) return (0, a.Da1)(g, e, eX, eY);
                            return e.signAmino(g, eX, { extraEntropy: null != eW && !!eW.enableExtraEntropy && (null == eW ? void 0 : eW.enableExtraEntropy) });
                          } catch (e) {
                            var o, t;
                            return (
                              (0, u.Tb)(e, {
                                tags: {
                                  errorType: "cosmos_transaction_error",
                                  source: "sign_transaction",
                                  severity: "error",
                                  errorName: e instanceof Error ? e.name : "CosmosTransactionError",
                                  transactionType: "cosmos_dapp_transaction"
                                },
                                fingerprint: ["cosmos_dapp_transaction", "cosmos_dapp_transaction_error"],
                                level: "error",
                                extra: {
                                  feeQuantity: null == e0 ? void 0 : null === (o = e0.amount[0]) || void 0 === o ? void 0 : o.amount.toString(),
                                  feeDenomination: (null == e0 ? void 0 : null === (t = e0.amount[0]) || void 0 === t ? void 0 : t.denom) ?? "uatom",
                                  chain: C,
                                  chainId: eI.chainId,
                                  address: eM.addresses[C],
                                  network: eS,
                                  isCosmos: !0,
                                  appUrl: e3 ?? origin
                                },
                                contexts: {
                                  transaction: {
                                    type: "cosmos",
                                    chain: C,
                                    network: eS,
                                    appUrl: e3 ?? origin,
                                    errorMessage: e instanceof Error ? e.message : String(e)
                                  }
                                }
                              }),
                              null
                            );
                          }
                        })();
                      if (!t) throw Error("Could not sign transaction");
                      if (!c)
                        try {
                          if ("60" === eI.bip44.coinType && "injective" === C) {
                            let e = eI.chainId === eX.chain_id ? eI.evmChainId : eI.evmChainIdTestnet;
                            await (0, J.KX)(t, o, eT, e ?? "1", C, g, e3 ?? origin, eS);
                          } else await (0, J.oM)(t, o, eT, C, g, e3 ?? origin, eS);
                        } catch (e) {
                          (0, u.Tb)(e, {
                            tags: {
                              errorType: "cosmos_transaction_error",
                              source: "sign_transaction",
                              severity: "error",
                              errorName: e instanceof Error ? e.name : "CosmosTransactionError",
                              transactionType: "cosmos_dapp_transaction"
                            },
                            fingerprint: ["cosmos_dapp_transaction", "cosmos_dapp_transaction_error"],
                            level: "error",
                            extra: {
                              feeQuantity: null == e0 ? void 0 : null === (d = e0.amount[0]) || void 0 === d ? void 0 : d.amount.toString(),
                              feeDenomination: (null == e0 ? void 0 : null === (m = e0.amount[0]) || void 0 === m ? void 0 : m.denom) ?? "uatom",
                              chain: C
                            },
                            contexts: {
                              transaction: {
                                type: "cosmos",
                                chain: C,
                                network: eS,
                                appUrl: e3 ?? origin,
                                errorMessage: e instanceof Error ? e.message : String(e)
                              }
                            }
                          });
                        }
                      try {
                        let e = {
                          dAppURL: e3,
                          transactionTypes: Array.isArray(eK) ? (null == eK ? void 0 : eK.map(e => e.raw.type).filter(Boolean)) : [],
                          signMode: "sign-amino",
                          walletType: (0, z.S)(eM.walletType),
                          chainId: eI.chainId,
                          chainName: eI.chainName,
                          productVersion: G().runtime.getManifest().version,
                          time: Date.now() / 1e3
                        };
                        try {
                          let n = (0, J.z9)(t, o);
                          e.txHash = n;
                        } catch (e) {}
                      } catch (e) {
                        (0, u.Tb)(e);
                      }
                      (Z.current = !0), await (0, a._vH)(100);
                      try {
                        G().runtime.sendMessage({ type: P.u.signResponse, payload: { status: "success", data: t } });
                      } catch {
                        throw Error("Could not send transaction to the dApp");
                      }
                      (0, $.oj)()
                        ? (e7(), e_("/home"))
                        : setTimeout(async () => {
                            window.close();
                          }, 10);
                    } catch (e) {
                      e instanceof Error && (e instanceof a.KW8 ? (ec(e.message), e.message === a.KHu && e5()) : e.message === a.KHu ? e5() : ep(e.message));
                    } finally {
                      em(!1);
                    }
                  } else
                    try {
                      if (!p) {
                        let e = null,
                          o = new r.Gl(eX).authInfo.fee;
                        if (!o) throw Error("Transaction does not have fee");
                        try {
                          e = await eF({ feeDenom: o.amount[0].denom, feeAmount: o.amount[0].amount, gaslimit: o.gasLimit, chain: C }, f(o));
                        } catch (e) {
                          (0, u.Tb)(e, {
                            tags: {
                              errorType: "cosmos_transaction_fee_error",
                              source: "sign_transaction",
                              severity: "error",
                              errorName: e instanceof Error ? e.name : "CosmosTransactionFeeError",
                              transactionType: "cosmos_dapp_transaction"
                            },
                            fingerprint: ["cosmos_dapp_transaction", "cosmos_dapp_transaction_error"],
                            level: "error",
                            extra: {
                              feeQuantity: null == o ? void 0 : null === (t = o.amount[0]) || void 0 === t ? void 0 : t.amount.toString(),
                              feeDenomination: (null == o ? void 0 : null === (n = o.amount[0]) || void 0 === n ? void 0 : n.denom) ?? "uatom",
                              chain: C,
                              chainId: eI.chainId,
                              address: eM.addresses[C],
                              network: eS,
                              isCosmos: !0,
                              appUrl: e3 ?? origin
                            },
                            contexts: {
                              transaction: {
                                type: "cosmos",
                                chain: C,
                                network: eS,
                                appUrl: e3 ?? origin,
                                errorMessage: e instanceof Error ? e.message : String(e)
                              }
                            }
                          });
                        }
                        if (!1 === e) throw Error("Unusually high fees detected, could not process transaction. Please try again.");
                      }
                      let e = await ew(C),
                        o = await (async () => {
                          try {
                            if ("function" == typeof e.signDirect) return e.signDirect(g, M.SignDoc.fromPartial(eX));
                            return null;
                          } catch (e) {
                            var o, t;
                            return (
                              (0, u.Tb)(e, {
                                tags: {
                                  ...F.rw,
                                  errorType: "cosmos_transaction_error",
                                  source: "sign_transaction",
                                  severity: "error",
                                  errorName: e instanceof Error ? e.name : "CosmosTransactionError",
                                  transactionType: "cosmos_dapp_transaction"
                                },
                                fingerprint: ["cosmos_dapp_transaction", "cosmos_dapp_transaction_error"],
                                level: "error",
                                extra: {
                                  feeQuantity: null == e0 ? void 0 : null === (o = e0.amount[0]) || void 0 === o ? void 0 : o.amount.toString(),
                                  feeDenomination: (null == e0 ? void 0 : null === (t = e0.amount[0]) || void 0 === t ? void 0 : t.denom) ?? "uatom",
                                  chain: C,
                                  chainId: null == eI ? void 0 : eI.chainId,
                                  address: null == eM ? void 0 : eM.addresses[C],
                                  network: eS,
                                  isCosmos: !0,
                                  appUrl: e3 ?? origin
                                },
                                contexts: {
                                  transaction: {
                                    type: "cosmos",
                                    chain: C,
                                    network: eS,
                                    appUrl: e3 ?? origin,
                                    errorMessage: e instanceof Error ? e.message : String(e)
                                  }
                                }
                              }),
                              null
                            );
                          }
                        })();
                      if (!o) throw Error("Could not sign transaction");
                      (Z.current = !0),
                        (0, J.D0)(o, eK ?? [], e3 ?? origin, e0, C, null == eM ? void 0 : eM.addresses[C], eT, eQ.chain_id, eS).catch(e => {
                          (0, u.Tb)(e);
                        }),
                        await (0, a._vH)(100);
                      try {
                        G().runtime.sendMessage({ type: P.u.signResponse, payload: { status: "success", data: o } });
                      } catch {
                        throw Error("Could not send transaction to the dApp");
                      }
                      (0, $.oj)()
                        ? (e7(), e_("/home"))
                        : setTimeout(async () => {
                            window.close();
                          }, 10);
                    } catch (e) {
                      e instanceof Error && (e.message === a.KHu ? e5() : ep(e.message));
                    }
                }, [eM.addresses, eS, C, e7, eX, eG, ew, e3, e0, eT, e5, ez, ot]);
              (0, B.useEffect)(() => {
                eR(e1), O.NR.setDefaultFee(e1);
              }, [e1]),
                (0, B.useEffect)(
                  () => (
                    window.addEventListener("beforeunload", e5),
                    G().storage.local.remove(I.u1),
                    () => {
                      window.removeEventListener("beforeunload", e5);
                    }
                  ),
                  [e5]
                ),
                (0, B.useEffect)(() => {
                  if (e3 && e8 && !E.current)
                    try {
                      E.current = !0;
                    } catch (e) {
                      (0, u.Tb)(e);
                    }
                }, [eM.walletType, eI.chainId, eI.chainName, eG, e3, e8]);
              let oi = (0, B.useMemo)(
                  () => (c ? "" : Array.isArray(eK) ? (0, H.p)(Array.isArray(eK) ? (null == eK ? void 0 : eK.map(e => e.parsed)) : null) : ""),
                  [c, eK]
                ),
                or = (0, B.useMemo)(
                  () => !!(null == e0 ? void 0 : e0.granter) || !!(null == e0 ? void 0 : e0.payer) || !!(null == eW ? void 0 : eW.disableBalanceCheck),
                  [null == e0 ? void 0 : e0.granter, null == e0 ? void 0 : e0.payer, null == eW ? void 0 : eW.disableBalanceCheck]
                ),
                os = !oe || !!eg || !!ef || (!!oi && !1 === eb) || (!1 === eB && !eE),
                oa = (0, B.useMemo)(
                  () => ({
                    page: "sign-transaction",
                    queryStatus: os ? "loading" : "success",
                    op: "signTransactionPageApproveBtnLoad",
                    description: "Load time for sign transaction page's approve button",
                    terminateProps: {
                      maxDuration: 5e3,
                      logData: {
                        tags: {
                          isApproveBtnDisabled: os,
                          dappFeeDenom: oe,
                          signingError: !!eg,
                          gasPriceError: !!ef,
                          hasToShowCheckbox: !!oi,
                          checkedGrantAuthBox: eb,
                          isFeesValid: !!eB,
                          highFeeAccepted: eE
                        },
                        context: { dappFeeDenom: oe, signingError: eg, gasPriceError: ef, hasToShowCheckbox: oi }
                      }
                    }
                  }),
                  [os, oe, eg, ef, oi, eb, eB, eE]
                );
              return (
                (0, S.$)(oa),
                (0, i.jsxs)("div", {
                  className: "h-full",
                  children: [
                    (0, i.jsxs)(p.og, {
                      className: "bg-secondary-50",
                      logo: e4 || e6,
                      subTitle: e3 || "Unknown site",
                      title: "Approve transaction",
                      children: [
                        !ez &&
                          !c &&
                          (0, i.jsx)(eo.Z, {
                            activeChain: C,
                            selectedNetwork: eS,
                            parsedMessages: Array.isArray(eK) ? (null == eK ? void 0 : eK.map(e => e.parsed)) : null
                          }),
                        ez || c
                          ? (0, i.jsx)("pre", {
                              className: g()(
                                "text-xs text-gray-900 dark:text-white-100 dark:bg-gray-900 bg-white-100 p-4 w-full overflow-x-auto rounded-2xl whitespace-pre-line break-words"
                              ),
                              children:
                                c && "string" == typeof eK
                                  ? eK
                                  : JSON.stringify(
                                      JSON.parse(
                                        Array.isArray(eK) ? (null == eK ? void 0 : null === (o = eK[0].parsed) || void 0 === o ? void 0 : o.message) : null
                                      ),
                                      null,
                                      2
                                    )
                            })
                          : (0, i.jsx)(A.ZP, {
                              className: "flex flex-col gap-6 relative",
                              initialFeeDenom: oe,
                              gasLimit: eA || String(e9),
                              setGasLimit: e => ek(e.toString()),
                              recommendedGasLimit: String(e9),
                              gasPriceOption: eC.current || eJ ? eV : { ...eV, option: "" },
                              onGasPriceOptionChange: e => {
                                (eC.current = !0), eZ(e);
                              },
                              error: ef,
                              setError: ev,
                              considerGasAdjustment: !1,
                              disableBalanceCheck: or,
                              fee: e0,
                              chain: C,
                              network: eS,
                              validateFee: !0,
                              onInvalidFees: (e, o) => {
                                try {
                                  !1 === o && eN(!1);
                                } catch (e) {
                                  var t, n;
                                  (0, u.Tb)(e, {
                                    tags: {
                                      errorType: "cosmos_transaction_fee_error",
                                      source: "sign_transaction",
                                      severity: "error",
                                      errorName: e instanceof Error ? e.name : "CosmosTransactionFeeError",
                                      transactionType: "cosmos_dapp_transaction"
                                    },
                                    extra: {
                                      feeQuantity: null == e0 ? void 0 : null === (t = e0.amount[0]) || void 0 === t ? void 0 : t.amount.toString(),
                                      feeDenomination: (null == e0 ? void 0 : null === (n = e0.amount[0]) || void 0 === n ? void 0 : n.denom) ?? "uatom",
                                      chain: C,
                                      chainId: null == eI ? void 0 : eI.chainId,
                                      address: null == eM ? void 0 : eM.addresses[C],
                                      network: eS,
                                      isCosmos: !0,
                                      appUrl: e3 ?? origin
                                    },
                                    contexts: {
                                      transaction: { type: "cosmos", chain: C, network: eS, errorMessage: e instanceof Error ? e.message : String(e) }
                                    }
                                  });
                                }
                              },
                              hasUserTouchedFees: !!(null == eC ? void 0 : eC.current),
                              notUpdateInitialGasPrice: !eJ,
                              rootDenomsStore: T,
                              rootBalanceStore: y,
                              children: (0, i.jsx)(ee.t, {
                                messages: eK,
                                setSelectedMessage: el,
                                setShowMessageDetailsSheet: es,
                                gasPriceError: ef,
                                txData: eQ,
                                allowSetFee: eJ,
                                defaultMemo: e2,
                                userMemo: ey,
                                setUserMemo: eh,
                                activeChain: C,
                                staticFee: (0, i.jsx)(X.Z, {
                                  fee: e0,
                                  error: ef,
                                  setError: ev,
                                  disableBalanceCheck: or,
                                  rootBalanceStore: y,
                                  activeChain: C,
                                  selectedNetwork: eS,
                                  feeTokensList: eq
                                })
                              })
                            }),
                        !ot && (eg || eu) ? (0, i.jsx)(f._, { text: eg ?? eu, disableSentryCapture: !0 }) : null,
                        ot && (0, i.jsx)(v.u, {}),
                        (0, i.jsx)(k.Z, {
                          showLedgerPopup: ed,
                          onClose: () => {
                            em(!1);
                          }
                        }),
                        (0, i.jsx)(Q.Z, { isOpen: en, setIsOpen: es, onClose: () => el(null), message: ea, activeChain: C, selectedNetwork: eS })
                      ]
                    }),
                    (0, i.jsxs)("div", {
                      className: "flex flex-col p-6 bg-secondary-50 justify-center w-full gap-2 mt-auto [&>*]:flex-1 sticky bottom-0",
                      children: [
                        oi &&
                          (0, i.jsxs)("div", {
                            className: "flex flex-row items-center rounded-lg p-[4px]",
                            children: [
                              (0, i.jsx)("div", {
                                className: "mr-2",
                                onClick: () => eP(!eb),
                                "aria-label": "sign transaction page grant auth checkbox in sign transaction flow",
                                children: eb
                                  ? (0, i.jsx)(m.l, { size: 20, className: "cursor-pointer", color: L.w.green600 })
                                  : (0, i.jsx)(d.b, { size: 20, className: "text-green-600" })
                              }),
                              (0, i.jsx)(h.Z, { size: "xs", color: "dark:text-gray-400 text-gray-600", children: oi })
                            ]
                          }),
                        !1 === eB &&
                          (0, i.jsxs)("div", {
                            className: "flex flex-row items-center rounded-lg p-[4px]",
                            ref: eL,
                            children: [
                              (0, i.jsx)("div", {
                                className: "mr-2",
                                onClick: () => eO(!eE),
                                "aria-label": "sign transaction page high fee checkbox in sign transaction flow",
                                children: eE
                                  ? (0, i.jsx)(m.l, { size: 20, className: "cursor-pointer", color: L.w.green600 })
                                  : (0, i.jsx)(d.b, { size: 20, className: "text-green-600" })
                              }),
                              (0, i.jsx)(h.Z, {
                                size: "xs",
                                color: "dark:text-gray-400 text-gray-600",
                                children: "The selected fee amount is unusually high. I confirm and agree to proceed"
                              })
                            ]
                          }),
                        (0, i.jsxs)("div", {
                          className: "flex items-center justify-center w-full gap-3 mt-auto [&>*]:flex-1",
                          children: [
                            (0, i.jsx)(b.zx, {
                              variant: "mono",
                              onClick: e5,
                              "aria-label": "sign transaction page reject button in sign transaction flow",
                              children: (0, i.jsx)("span", {
                                "aria-label": "sign transaction page reject button text in sign transaction flow",
                                children: "Reject"
                              })
                            }),
                            (0, i.jsx)(b.zx, {
                              onClick: on,
                              disabled: os,
                              className: `${os ? "cursor-not-allowed opacity-50" : ""}`,
                              "aria-label": "sign transaction page approve button in sign transaction flow",
                              children: ot
                                ? "Connect Ledger"
                                : (0, i.jsx)("span", {
                                    "aria-label": "sign transaction page approve button text in sign transaction flow",
                                    children: "Approve"
                                  })
                            })
                          ]
                        })
                      ]
                    })
                  ]
                })
              );
            }),
            ea = (e => {
              let o = () => {
                let [o, t] = (0, B.useState)(),
                  [n, r] = (0, B.useState)(a.NOo),
                  [s, l] = (0, B.useState)(!1),
                  [d, m] = (0, B.useState)(null),
                  [c, g] = (0, B.useState)(),
                  p = (0, N.s0)();
                (0, B.useEffect)(() => {
                  (0, w._d)().then(r).catch(u.Tb);
                }, []);
                let f = (0, B.useCallback)(
                  (e, o) => {
                    if (o.id === G().runtime.id && e.type === P.u.signTransaction) {
                      var i;
                      let o = e.payload,
                        r = o.chainId ? o.chainId : null === (i = o.signDoc) || void 0 === i ? void 0 : i.chainId,
                        s = r ? n[r] : void 0;
                      if (!s) {
                        G().runtime.sendMessage({ type: P.u.signResponse, payload: { status: "error", data: `Invalid chainId ${r}` } }),
                          (0, $.oj)()
                            ? p("/home")
                            : setTimeout(async () => {
                                window.close();
                              }, 10);
                        return;
                      }
                      o.signOptions.isSignArbitrary && l(!0), t(s), g(r), m(o);
                    }
                  },
                  [n, p]
                );
                return ((0, B.useEffect)(
                  () => (
                    G().runtime.sendMessage({ type: P.u.signingPopupOpen }),
                    G().runtime.onMessage.addListener(f),
                    () => {
                      G().runtime.onMessage.removeListener(f);
                    }
                  ),
                  []
                ),
                o && d && c)
                  ? (0, i.jsx)(e, {
                      data: d,
                      chainId: c,
                      activeChain: o,
                      isSignArbitrary: s,
                      rootDenomsStore: E.gb,
                      rootBalanceStore: R.jZ,
                      rootStakeStore: R.lc
                    })
                  : (0, i.jsx)("div", {
                      className: "panel-height enclosing-panel relative w-screen max-w-3xl h-full self-center p-5 pt-0",
                      children: (0, i.jsx)(y.Z, {})
                    });
              };
              return (o.displayName = `withTxnSigningRequest(${e.displayName})`), o;
            })(B.memo(es));
          n();
        } catch (e) {
          n(e);
        }
      });
    },
    44392: function (e, o, t) {
      t.a(e, async function (e, n) {
        try {
          t.d(o, { Z: () => c });
          var i = t(52322),
            r = t(41172),
            s = t(62423),
            a = t(69682),
            l = t(19623),
            d = t(96217);
          t(2784);
          var m = t(97161),
            u = e([m]);
          m = (u.then ? (await u)() : u)[0];
          let c = e => {
            let { isOpen: o, setIsOpen: t, message: n, onClose: u, activeChain: c, selectedNetwork: g } = e,
              { lcdUrl: p } = (0, r.U9i)(c, g),
              { isLoading: f, data: v } = (0, m.jv)(null == n ? void 0 : n.parsed, p ?? "", c);
            return n
              ? (0, i.jsx)(d.Z, {
                  isOpen: o,
                  onClose: () => {
                    t(!1), u();
                  },
                  title: `Message ${n.index + 1}`,
                  children:
                    !f && v
                      ? (0, i.jsxs)(i.Fragment, {
                          children: [
                            (0, i.jsxs)("div", {
                              className: "w-full text-left dark:bg-gray-900 bg-white-100 p-4 rounded-xl",
                              children: [
                                (0, i.jsx)("p", { className: "text-muted-foreground text-xs font-medium tracking-wide", children: "Message" }),
                                (0, i.jsx)("p", {
                                  className: "dark:text-white-100 text-gray-900 text-sm mt-3 font-medium",
                                  children:
                                    "unknown" === v
                                      ? n.parsed.__type === s.ax.Unimplemented
                                        ? (0, i.jsx)("span", {
                                            className: "text-red-500",
                                            children: (0, m.I9)(
                                              n.parsed.message["@type"] ?? n.parsed.message.type ?? n.parsed.message.type_url ?? n.parsed.message.typeUrl
                                            )
                                          })
                                        : "Unknown"
                                      : v
                                })
                              ]
                            }),
                            (0, i.jsx)(a.Z, {
                              title: "Message Data",
                              className: "overflow-x-auto mt-4 p-0",
                              initialOpen: !0,
                              children: (0, i.jsx)("pre", {
                                className: "text-xs text-gray-900 dark:text-white-100 w-full overflow-x-auto",
                                children: JSON.stringify(n.raw, (e, o) => ("bigint" == typeof o ? o.toString() : o), 2)
                              })
                            })
                          ]
                        })
                      : (0, i.jsxs)("div", {
                          className: "h-32 flex flex-col items-center justify-center",
                          children: [
                            (0, i.jsx)(l.T, { color: "white" }),
                            (0, i.jsx)("p", { className: "text-gray-900 dark:text-white-100 text-xs mt-2", children: "Loading message details" })
                          ]
                        })
                })
              : null;
          };
          n();
        } catch (e) {
          n(e);
        }
      });
    },
    97161: function (e, o, t) {
      t.a(e, async function (e, n) {
        try {
          t.d(o, { $V: () => v, I9: () => f, jv: () => y });
          var i = t(41172),
            r = t(62423),
            s = t(60431),
            a = t(6391),
            l = t.n(a),
            d = t(2784),
            m = t(26245),
            u = e([m]);
          m = (u.then ? (await u)() : u)[0];
          let g = async (e, o, t) => {
              try {
                let n = await m.w3.fetchIbcTrace(e.denomination, o, t);
                if (!n) throw Error("No");
                return `${(0, i.dpr)(new (l())(e.quantity).dividedBy(10 ** n.coinDecimals))} ${n.coinDenom}`;
              } catch {
                var n;
                if (null == e ? void 0 : null === (n = e.denomination) || void 0 === n ? void 0 : n.startsWith("u"))
                  return `${e.quantity} ${e.denomination.slice(1)}`;
                return `${(null == e ? void 0 : e.quantity) ?? ""} ${(0, i.Hnh)((null == e ? void 0 : e.denomination) ?? "")}`;
              }
            },
            p = async (e, o, t) => (await Promise.all(e.map(e => g(e, o, t)))).join(", ");
          function c(e) {
            let o = ((null == e ? void 0 : e.startsWith("/")) ? (null == e ? void 0 : e.split(".")) : null == e ? void 0 : e.split("/")) ?? [];
            return o[o.length - 1] ?? "";
          }
          let f = (e, o) => {
              if (!e) return "unknown";
              let t = c(e);
              if ("SendAuthorization" === t.trim()) return "Send";
              if ("StakeAuthorization" === t.trim())
                switch (o) {
                  case 0:
                    return "Unspecified";
                  case 1:
                    return "Delegate";
                  case 2:
                    return "Undelegate";
                  case 3:
                    return "Redelegate";
                  case 4:
                    return "Cancel Unbonding Delegation";
                  default:
                    return "unknown";
                }
              return "GenericAuthorization" === t.trim() ? c(o) : t;
            },
            v = e => {
              switch (e.__type) {
                case r.ax.AuthzExec:
                  return "Execute Authorized Message";
                case r.ax.AuthzGrant:
                  return "Grant Authorization";
                case r.ax.AuthzRevoke:
                  return "Revoke Execution Authorization";
                case r.ax.BankMultiSend:
                  return "Multi Send Tokens";
                case r.ax.BankSend:
                  return "Send Tokens";
                case r.ax.FeeGrantGrantAllowance:
                  return "Grant Fee Allowance";
                case r.ax.FeeGrantRevokeAllowance:
                  return "Revoke Fee Allowance";
                case r.ax.GammCreatePool:
                  return "Create Balancer Pool";
                case r.ax.GammJoinPool:
                  return "Join Pool";
                case r.ax.GammExitPool:
                  return "Exit Pool";
                case r.ax.GammSwapExact:
                case r.ax.GammSwapMax:
                case r.ax.PMSwapExactIn:
                case r.ax.PMSwapExactOut:
                case r.ax.PMSplitSwapExactIn:
                case r.ax.PMSplitSwapExactOut:
                  return "Swap Tokens";
                case r.ax.GammSwapExactAndExit:
                case r.ax.GammSwapMaxAndExit:
                  return "Swap Tokens and Exit Pool";
                case r.ax.PMSetDenomPairTakerFee:
                  return "Set Denom Pair Taker Fee";
                case r.ax.GammSwapExactAndJoin:
                case r.ax.GammSwapMaxAndJoin:
                  return "Swap Tokens and Join Pool";
                case r.ax.GovSubmitProposal:
                  return "Submit Governance Proposal";
                case r.ax.GovVote:
                  return "Vote on Governance Proposal";
                case r.ax.GovDeposit:
                  return "Deposit on Governance Proposal";
                case r.ax.IbcReceive:
                  return "Receive IBC Packet";
                case r.ax.IbcSend:
                  return "Send Tokens via IBC";
                case r.ax.LockupLock:
                  return "Lock Tokens";
                case r.ax.LockupUnlock:
                  return "Unlock Token";
                case r.ax.LockupUnlockAll:
                  return "Unlock All Tokens";
                case r.ax.SlashingUnjail:
                  return "Unjail Validator";
                case r.ax.StakingDelegate:
                  return "Delegate Tokens";
                case r.ax.StakingUndelegate:
                  return "Undelegate Tokens";
                case r.ax.StakingCreateValidator:
                  return "Create Validator";
                case r.ax.StakingEditValidator:
                  return "Edit Validator";
                case r.ax.StakingBeginRedelegate:
                  return "Redelegate Tokens";
                case r.ax.StakingCancelUnbondingDelegation:
                  return "Cancel Unbonding Delegation";
                case r.ax.SuperfluidDelegate:
                  return "Delegate Tokens (Superfluid)";
                case r.ax.SuperfluidLockAndDelegate:
                  return "Lock and Delegate Tokens (Superfluid)";
                case r.ax.SuperfluidUnlockAndUndelegate:
                  return "Unlock and Undelegate Tokens (Superfluid)";
                case r.ax.SuperfluidUndelegate:
                  return "Undelegate Tokens (Superfluid)";
                case r.ax.LiquidStakingDelegate:
                  return "Delegate Tokens (Liquid Staking)";
                case r.ax.PStakeLiquidStake:
                  return "Liquid Stake (P Stake)";
                case r.ax.StakeIBCAddValidators:
                  return "Add Validators (Liquid Staking)";
                case r.ax.StakeIBCChangeValidatorWeight:
                  return "Change Validator Weight (Liquid Staking)";
                case r.ax.StakeIBCDeleteValidator:
                  return "Delete Validator (Liquid Staking)";
                case r.ax.StakeIBCLiquidStake:
                  return "Liquid Stake (Liquid Staking)";
                case r.ax.StakeIBCClearBalance:
                  return "Clear Balance (Liquid Staking)";
                case r.ax.StakeIBCRedeemStake:
                  return "Redeem Staked Tokens (Liquid Staking)";
                case r.ax.StakeIBCClaimUndelegatedTokens:
                  return "Claim Undelegated Tokens (Liquid Staking)";
                case r.ax.StakeIBCRegisterHostZone:
                  return "Register Host Zone (Liquid Staking)";
                case r.ax.StakeIBCRebalanceValidators:
                  return "Rebalance Validators (Liquid Staking)";
                case r.ax.StakeIBCRestoreInterchainAccount:
                  return "Restore Interchain Account (Liquid Staking)";
                case r.ax.StakeIBCUpdateValidatorSharesExchRate:
                  return "Update Validator Shares Exchange Rate (Liquid Staking)";
                case r.ax.IbcPacketReceive:
                  return "Receive IBC Packet";
                case r.ax.ClaimReward:
                  return `Claim reward from ${(0, i.Hnh)(e.validatorAddress)}`;
                case r.ax.WasmxExecuteContractCompat:
                  return "Execute Contract";
                case r.ax.Unimplemented:
                  return f(e.message["@type"] ?? e.message.type ?? e.message.type_url ?? e.message.typeUrl);
              }
            },
            A = e => {
              switch (e) {
                case "basic":
                  return "Basic";
                case "periodic":
                  return "Periodic";
                case "allowedMsg":
                  return "Allowed Message";
              }
            },
            k = async (e, o, t) => {
              switch (e.__type) {
                case r.ax.AuthzExec:
                  return Promise.resolve(
                    `${(0, i.Hnh)(e.grantee)} shall execute the following authorized message ${e.messages.map(e => f("type" in e ? e.type : e["@type"])).join(", ")} on behalf of you`
                  );
                case r.ax.AuthzGrant:
                  return Promise.resolve(
                    `Grant authorization for ${(0, i.Hnh)(e.grantee)} to execute ${f(e.grant.authorization.$type_url ?? e.grant.authorization["@type"], e.grant.authorization.msg ?? e.grant.authorization.authorization_type)} on behalf of you`
                  );
                case r.ax.AuthzRevoke:
                  return Promise.resolve(`Revoke authorization for ${(0, i.Hnh)(e.grantee)} to execute ${f(e.permission)} on behalf of you`);
                case r.ax.BankMultiSend:
                  return Promise.resolve(`Send ${e.inputs.length} coins to ${e.outputs.length} recipients`);
                case r.ax.BankSend:
                  return `Send ${await p(e.tokens, o, t)} to ${(0, i.Hnh)(e.toAddress)}`;
                case r.ax.FeeGrantGrantAllowance:
                  return Promise.resolve(`Grant ${A(e.allowance)} allowance to ${(0, i.Hnh)(e.grantee)}`);
                case r.ax.IbcPacketReceive:
                  return Promise.resolve(`Receive IBC packet from ${(0, i.Hnh)(e.sourcePort)}/${(0, i.Hnh)(e.sourceChannel)}`);
                case r.ax.FeeGrantRevokeAllowance:
                  return Promise.resolve(`Revoke allowance from ${(0, i.Hnh)(e.grantee)}`);
                case r.ax.GammCreatePool:
                  return `Create a Balancer pool with ${await p(e.tokens, o, t)} assets`;
                case r.ax.GammJoinPool:
                  return `Join pool ${e.poolId} with ${await p(e.tokens, o, t)} assets in return for ${e.shares} shares`;
                case r.ax.GammExitPool:
                  return `Exit pool ${e.poolId} with ${e.shares} shares in return for ${await p(e.tokens, o, t)} assets`;
                case r.ax.GammSwapExact:
                case r.ax.PMSwapExactIn: {
                  let n = { quantity: e.tokenOutAmount, denomination: e.routes[e.routes.length - 1].tokenOutDenomination };
                  return `Swap ${await g(e.tokenIn, o, t)} for ${await g(n, o, t)}`;
                }
                case r.ax.PMSplitSwapExactIn: {
                  let n = e.routes[e.routes.length - 1].pools,
                    i = n[n.length - 1].tokenOutDenomination,
                    r = { quantity: e.tokenOutAmount, denomination: i };
                  return `Swap ${await g(e.tokenIn, o, t)} for ${await g(r, o, t)}`;
                }
                case r.ax.GammSwapMax:
                case r.ax.PMSwapExactOut: {
                  let n = { quantity: e.tokenInAmount, denomination: e.routes[0].tokenInDenomination };
                  return `Swap ${await g(n, o, t)} for ${await g(e.tokenOut, o, t)}`;
                }
                case r.ax.PMSplitSwapExactOut: {
                  let n = e.routes[e.routes.length - 1].pools[0].tokenInDenomination,
                    i = { quantity: e.tokenInAmount, denomination: n };
                  return `Swap ${await g(i, o, t)} for ${await g(e.tokenOut, o, t)}`;
                }
                case r.ax.GammSwapExactAndExit:
                case r.ax.GammSwapMaxAndExit:
                  return `Sell ${e.shares} shares for ${await g(e.tokenOut, o, t)} and exit pool ${e.poolId}`;
                case r.ax.GammSwapExactAndJoin:
                case r.ax.GammSwapMaxAndJoin:
                  return `Buy ${e.shares} shares for ${await g(e.tokenIn, o, t)} and join pool ${e.poolId}`;
                case r.ax.GovSubmitProposal:
                  return Promise.resolve(`Submit proposal with deposit of ${await p(e.initialDeposit, o, t)}`);
                case r.ax.GovVote: {
                  let o;
                  if (["number", "string"].includes(typeof e.proposalId)) o = e.proposalId;
                  else if ("bigint" == typeof e.proposalId) o = e.proposalId.toString();
                  else {
                    var n;
                    o = (null === (n = e.proposalId) || void 0 === n ? void 0 : n.low) ?? JSON.stringify(e.proposalId);
                  }
                  return Promise.resolve(`Vote ${e.option} on proposal ${o}`);
                }
                case r.ax.GovDeposit:
                  return Promise.resolve(`Deposit ${await p((null == e ? void 0 : e.amount) ?? [], o, t)} on proposal ${e.proposalId}`);
                case r.ax.IbcSend:
                  return `Send ${await g(e.token, o, t)} to ${(0, i.Hnh)(e.toAddress)} via IBC`;
                case r.ax.IbcReceive:
                  return `Receive ${await g(e.token, o, t)} from ${(0, i.Hnh)(e.fromAddress)} via IBC`;
                case r.ax.LockupLock:
                  return `Lock ${await p(e.tokens, o, t)} for ${e.duration} seconds`;
                case r.ax.LockupUnlock:
                  return Promise.resolve(`Unlock token from lock ${e.id}`);
                case r.ax.LockupUnlockAll:
                  return Promise.resolve("Unlock all tokens from all locks");
                case r.ax.SlashingUnjail:
                  return Promise.resolve(`Unjail validator ${(0, i.Hnh)(e.validatorAddress)}`);
                case r.ax.StakingCreateValidator:
                  return Promise.resolve(`Create ${e.moniker} validator with commission rate ${e.rate}`);
                case r.ax.StakingEditValidator:
                  return Promise.resolve(`Edit ${e.moniker} validator`);
                case r.ax.StakingDelegate:
                  return `Delegate ${await g({ quantity: e.quantity, denomination: e.denomination }, o, t)} to ${(0, i.Hnh)(e.validatorAddress)}`;
                case r.ax.StakingUndelegate:
                  return `Undelegate ${await g({ quantity: e.quantity, denomination: e.denomination }, o, t)} from ${(0, i.Hnh)(e.validatorAddress)}`;
                case r.ax.StakingBeginRedelegate:
                  return `Redelegate ${await g({ quantity: e.quantity, denomination: e.denomination }, o, t)} from ${(0, i.Hnh)(e.sourceValidatorAddress)} to ${(0, i.Hnh)(e.destinationValidatorAddress)}`;
                case r.ax.StakingCancelUnbondingDelegation:
                  return Promise.resolve(
                    `Cancel unbonding delegation for ${g({ quantity: e.quantity, denomination: e.denomination }, o, t)} from ${(0, i.Hnh)(e.validatorAddress)}`
                  );
                case r.ax.SuperfluidLockAndDelegate:
                  return `Lock ${await p(e.tokens, o, t)} and delegate to ${(0, i.Hnh)(e.validatorAddress)}`;
                case r.ax.SuperfluidUnlockAndUndelegate:
                  return Promise.resolve(`Remove lock ${e.lockId} and undelegate`);
                case r.ax.SuperfluidDelegate:
                  return Promise.resolve(`Delegate tokens with lock ${e.lockId}`);
                case r.ax.SuperfluidUndelegate:
                  return Promise.resolve(`Undelegate tokens with lock ${e.lockId}`);
                case r.ax.StakeIBCAddValidators:
                  return Promise.resolve(`Add liquid staking validators - ${e.validators.join(", ")}`);
                case r.ax.StakeIBCChangeValidatorWeight:
                  return Promise.resolve(`Change liquid staking validator ${e.validatorAddress}'s weight to ${e.weight}`);
                case r.ax.StakeIBCDeleteValidator:
                  return Promise.resolve(`Delete liquid staking validator ${e.validatorAddress}`);
                case r.ax.StakeIBCLiquidStake:
                  return `Liquid stake ${await g({ denomination: e.denomination, quantity: e.quantity }, o, t)}`;
                case r.ax.StakeIBCClearBalance:
                  return Promise.resolve(`Clear liquid staking balance of ${e.quantity}`);
                case r.ax.StakeIBCRedeemStake:
                  return Promise.resolve(`Redeem liquid stake of ${e.quantity} units to ${(0, i.Hnh)(e.receiver)}`);
                case r.ax.StakeIBCClaimUndelegatedTokens:
                  return Promise.resolve("Claim undelegated tokens");
                case r.ax.StakeIBCRegisterHostZone:
                  return Promise.resolve(`Register host zone via ${(0, i.Hnh)(e.account)} with host denomination ${e.hostDenom}`);
                case r.ax.StakeIBCRebalanceValidators:
                  return Promise.resolve(`Rebalance ${e.numRebalance} liquid staking validators in ${e.hostZone} host zone`);
                case r.ax.StakeIBCRestoreInterchainAccount:
                  return Promise.resolve(`Restore interchain account ${(0, i.Hnh)(e.creator)} of type ${e.accountType}`);
                case r.ax.StakeIBCUpdateValidatorSharesExchRate:
                  return Promise.resolve(`Update liquid staking validator shares exchange rate for ${(0, i.Hnh)(e.validatorOperatorAddress)}`);
                case r.ax.ClaimReward:
                  return Promise.resolve(`Claim staking reward from ${(0, i.Hnh)(e.validatorAddress)}`);
                case r.ax.Unimplemented:
                  return Promise.resolve(f(e.message["@type"] ?? e.message.type ?? e.message.type_url ?? e.message.typeUrl));
              }
            },
            y = (e, o, t) => {
              let { chains: n } = (0, i._IL)(),
                r = (0, d.useMemo)(() => {
                  let o = JSON.stringify(e, (e, o) => ("bigint" == typeof o ? o.toString() : o));
                  return ["message-details", o];
                }, [e]),
                { data: a, isLoading: l } = (0, s.useQuery)({ queryKey: r, queryFn: () => k(e, o, n[t].chainId), enabled: !!e });
              return { data: a, isLoading: l };
            };
          n();
        } catch (e) {
          n(e);
        }
      });
    },
    29530: function (e, o, t) {
      t.a(e, async function (e, n) {
        try {
          t.d(o, { Z: () => c });
          var i = t(52322),
            r = t(62423),
            s = t(72779),
            a = t.n(s),
            l = t(65953);
          t(2784);
          var d = t(97161),
            m = e([d]);
          d = (m.then ? (await m)() : m)[0];
          let u = e => {
              let { message: o, isLast: t, onClick: n } = e,
                s = (0, d.$V)(o),
                a = o.__type === r.ax.Unimplemented ? (0, d.I9)(o.message["@type"] ?? o.message.type ?? o.message.type_url ?? o.message.typeUrl) : s;
              return (0, i.jsxs)("button", {
                className: `flex items-center justify-between dark:bg-gray-900 mt-2 bg-white-100 w-full cursor-pointer p-4 rounded-2xl ${t ? "" : "border-b dark:border-gray-800 border-gray-100"}`,
                onClick: n,
                "aria-label": "sign message item button in sign transaction flow",
                children: [
                  (0, i.jsx)("div", {
                    className: "flex flex-col flex-1 max-w-[90%]",
                    children: (0, i.jsx)("p", { className: "font-bold dark:text-white-100 text-gray-900 text-sm text-left", children: a })
                  }),
                  (0, i.jsx)("img", { src: l.RightArrow, alt: "View Details", className: "block flex-shrink-0 mr-2" })
                ]
              });
            },
            c = e => {
              let { parsedMessages: o, onMessageSelect: t, className: n } = e;
              return (0, i.jsx)("div", {
                className: a()("", n),
                children: o.map((e, n) =>
                  (0, i.jsx)(
                    u,
                    {
                      isLast: n === o.length - 1,
                      message: e,
                      messageNumber: n + 1,
                      onClick: () => {
                        t(e, n);
                      }
                    },
                    n
                  )
                )
              });
            };
          n();
        } catch (e) {
          n(e);
        }
      });
    },
    83064: function (e, o, t) {
      t.a(e, async function (e, n) {
        try {
          t.d(o, { Z: () => k });
          var i = t(52322),
            r = t(41172),
            s = t(15969),
            a = t(91859),
            l = t(36906),
            d = t(60431),
            m = t(6391),
            u = t.n(m),
            c = t(6401),
            g = t(75958),
            p = t(2784),
            f = t(94648),
            v = e([f]);
          f = (v.then ? (await v)() : v)[0];
          let A = (e, o) => {
              var t;
              let { amount: n } = e,
                i = (null === (t = n[0]) || void 0 === t ? void 0 : t.amount) ?? "",
                r = (0, s.t7o)(new (u())(i).toString(), o),
                a = r.toFormat(5, u().ROUND_DOWN),
                l = r.isLessThan("0.00001");
              return { amount: r, formattedAmount: l && !r.isEqualTo(0) ? "< 0.00001" : a };
            },
            k = (0, g.Pi)(e => {
              var o, t, n;
              let { fee: s, error: m, setError: g, disableBalanceCheck: v, rootBalanceStore: k, activeChain: y, selectedNetwork: h, feeTokensList: b } = e,
                P = (0, r.dco)(),
                [I] = (0, r.X$P)(),
                [M, w] = (0, p.useState)(!1),
                _ = k.getSpendableBalancesForChain(y, h, void 0),
                S = k.getLoadingStatusForChain(y, h),
                x = (0, p.useMemo)(() => (S ? "loading" : "success"), [S]),
                U = (0, r.xxU)(),
                [T] = (0, c.nB)(),
                D = (0, p.useMemo)(() => {
                  var e, o;
                  let t = null == s ? void 0 : null === (e = s.amount[0]) || void 0 === e ? void 0 : e.denom,
                    n = null == b ? void 0 : b.find(e => (e.ibcDenom ? e.ibcDenom === t : e.denom.coinMinimalDenom === t)),
                    i =
                      null ===
                        (o = _.find(e => {
                          var o;
                          return (null == n ? void 0 : n.ibcDenom) || (null == e ? void 0 : e.ibcDenom)
                            ? (null == e ? void 0 : e.ibcDenom) === (null == n ? void 0 : n.ibcDenom)
                            : (null == e ? void 0 : e.coinMinimalDenom) ===
                                (null == n ? void 0 : null === (o = n.denom) || void 0 === o ? void 0 : o.coinMinimalDenom);
                        })) || void 0 === o
                        ? void 0
                        : o.amount;
                  return { ...n, amount: i };
                }, [_, null == s ? void 0 : s.amount, b]),
                { data: C } = (0, d.useQuery)(
                  ["fee-token-fiat-value", null == D ? void 0 : null === (o = D.denom) || void 0 === o ? void 0 : o.coinDenom],
                  async () => {
                    var e, o, t;
                    return (0, r.knL)(
                      "1",
                      (null == D ? void 0 : null === (e = D.denom) || void 0 === e ? void 0 : e.coinGeckoId) ?? "",
                      null == D ? void 0 : null === (o = D.denom) || void 0 === o ? void 0 : o.chain,
                      r.r95[I].currencyPointer,
                      `${U}-${null == D ? void 0 : null === (t = D.denom) || void 0 === t ? void 0 : t.coinMinimalDenom}`
                    );
                  }
                ),
                B = (0, p.useMemo)(() => {
                  var e;
                  return s ? A(s, (null == D ? void 0 : null === (e = D.denom) || void 0 === e ? void 0 : e.coinDecimals) ?? 0) : null;
                }, [y, P, s, null == D ? void 0 : null === (t = D.denom) || void 0 === t ? void 0 : t.coinDecimals]);
              return (
                (0, p.useEffect)(() => {
                  var e, o;
                  let t = null == B ? void 0 : null === (e = B.amount) || void 0 === e ? void 0 : e.toString();
                  !v &&
                    t &&
                    "loading" !== x &&
                    (new (u())(t).isGreaterThan((null == D ? void 0 : D.amount) ?? 0)
                      ? g(`You don't have enough ${null == D ? void 0 : null === (o = D.denom) || void 0 === o ? void 0 : o.coinDenom} to pay the gas fee`)
                      : g(null));
                }, [D, B, x, v]),
                (0, i.jsxs)("div", {
                  className: "mt-3",
                  children: [
                    B
                      ? (0, i.jsxs)("div", {
                          className: "rounded-lg bg-secondary-100 border border-secondary-200",
                          children: [
                            (0, i.jsxs)("div", {
                              className: "p-4",
                              children: [
                                (0, i.jsxs)("div", {
                                  className: "flex justify-between",
                                  children: [
                                    (0, i.jsx)("p", { className: "text-muted-foreground text-xs font-medium", children: "Gas Fees" }),
                                    (0, i.jsx)(a.R, {
                                      size: 14,
                                      className: "text-muted-foreground cursor-pointer",
                                      weight: "fill",
                                      onClick: () => w(!0),
                                      "aria-label": "sign dapp edit static fee button in sign transaction flow"
                                    })
                                  ]
                                }),
                                (0, i.jsxs)("p", {
                                  className: "font-medium text-foreground text-sm mt-3 list-none ml-0",
                                  children: [
                                    B.formattedAmount,
                                    " ",
                                    null == D ? void 0 : null === (n = D.denom) || void 0 === n ? void 0 : n.coinDenom,
                                    " ",
                                    C ? T(new (u())((null == B ? void 0 : B.amount) ?? 0).multipliedBy(C)) : null
                                  ]
                                }),
                                m ? (0, i.jsx)("p", { className: "font-medium text-destructive-400 text-sm mt-3 list-none ml-0", children: m }) : null
                              ]
                            }),
                            (0, i.jsxs)("div", {
                              className: "flex px-4 py-3 gap-2 items-center bg-secondary-200",
                              children: [
                                (0, i.jsx)(l.k, { size: 16, className: "text-muted-foreground" }),
                                (0, i.jsx)("p", {
                                  className: "text-muted-foreground text-xs font-medium",
                                  children: "dApp doesn't recommend changing the gas fees"
                                })
                              ]
                            })
                          ]
                        })
                      : null,
                    (0, i.jsx)(f.Z, { isOpen: M, onClose: () => w(!1), gasPriceError: m })
                  ]
                })
              );
            });
          n();
        } catch (e) {
          n(e);
        }
      });
    },
    84592: function (e, o, t) {
      t.a(e, async function (e, n) {
        try {
          t.d(o, { t: () => k });
          var i = t(52322),
            r = t(58885),
            s = t(14981),
            a = t(4370),
            l = t(25053),
            d = t(2784),
            m = t(42799),
            u = t(48346),
            c = t(46338),
            g = t(43963),
            p = t(29530),
            f = e([r, u, p]);
          [r, u, p] = f.then ? (await f)() : f;
          let v = [
              { id: "fees", label: "Fees" },
              { id: "messages", label: "Messages" },
              { id: "details", label: "Details" }
            ],
            A = { transform: "translateX(0px) scaleX(0.161044)" },
            k = e => {
              let [o, t] = (0, d.useState)(v[0]);
              return (0, i.jsxs)(i.Fragment, {
                children: [
                  (0, i.jsx)("div", {
                    className: "border-b border-secondary-300",
                    children: (0, i.jsx)(l.z, {
                      buttons: v,
                      setSelectedTab: t,
                      selectedIndex: v.findIndex(e => {
                        let { id: t } = e;
                        return t === o.id;
                      }),
                      className: "gap-0.5",
                      buttonClassName: "px-3.5",
                      indicatorDefaultScale: A
                    })
                  }),
                  (0, i.jsx)("div", {
                    className: "flex flex-col gap-6",
                    children: (0, i.jsxs)(s.M, {
                      mode: "wait",
                      initial: !1,
                      children: [
                        "fees" === o.id &&
                          (0, i.jsx)(
                            a.E.div,
                            {
                              className: "flex flex-col gap-7",
                              transition: c._M,
                              variants: g.dJ,
                              initial: "exit",
                              animate: "animate",
                              exit: "exit",
                              children: e.allowSetFee
                                ? (0, i.jsxs)(i.Fragment, {
                                    children: [
                                      (0, i.jsx)(r.ZP.Selector, {}),
                                      (0, i.jsxs)("div", {
                                        className: "border border-border-bottom rounded-xl ",
                                        children: [
                                          (0, i.jsx)(r.ZP.AdditionalSettingsToggle, {}),
                                          (0, i.jsx)(r.ZP.AdditionalSettings, { showGasLimitWarning: !0, rootBalanceStore: u.jZ, rootDenomsStore: m.gb })
                                        ]
                                      }),
                                      !!e.gasPriceError &&
                                        (0, i.jsx)("p", { className: "text-destructive-100 text-sm font-medium px-1", children: e.gasPriceError })
                                    ]
                                  })
                                : e.staticFee
                            },
                            "fees"
                          ),
                        "messages" === o.id &&
                          (0, i.jsx)(
                            a.E.div,
                            {
                              transition: c._M,
                              variants: g.dJ,
                              initial: "enter",
                              animate: "animate",
                              exit: "exit",
                              children: (0, i.jsx)("div", {
                                children: e.messages
                                  ? (0, i.jsx)(p.Z, {
                                      parsedMessages: e.messages.map(e => e.parsed),
                                      onMessageSelect: (o, t) => {
                                        e.messages &&
                                          (e.setSelectedMessage({ index: t, parsed: e.messages[t].parsed, raw: e.messages[t].raw }),
                                          e.setShowMessageDetailsSheet(!0));
                                      }
                                    })
                                  : (0, i.jsx)("div", {
                                      children: (0, i.jsx)("p", {
                                        className: "text-gray-500 dark:text-gray-100 text-sm",
                                        children: "No information available. The transaction can still be approved."
                                      })
                                    })
                              })
                            },
                            "messages"
                          ),
                        "details" === o.id &&
                          (0, i.jsxs)("div", {
                            className: "flex flex-col gap-3 p-4 rounded-xl border border-secondary-200 bg-secondary-50",
                            children: [
                              (0, i.jsx)("span", { className: "text-muted-foreground text-xs font-medium", children: "Data" }),
                              (0, i.jsx)(
                                a.E.pre,
                                {
                                  transition: c._M,
                                  variants: g.dJ,
                                  initial: "enter",
                                  animate: "animate",
                                  exit: "enter",
                                  className: "text-xs  w-full text-wrap break-words",
                                  children: JSON.stringify(e.txData, (e, o) => ("bigint" == typeof o ? o.toString() : o), 2)
                                },
                                "details"
                              )
                            ]
                          })
                      ]
                    })
                  })
                ]
              });
            };
          n();
        } catch (e) {
          n(e);
        }
      });
    },
    33615: function (e, o, t) {
      t.a(e, async function (e, n) {
        try {
          t.d(o, { Z: () => c });
          var i = t(52322),
            r = t(41172),
            s = t(62423),
            a = t(2784),
            l = t(86874),
            d = t(97161),
            m = e([d]);
          d = (m.then ? (await m)() : m)[0];
          let u = e => {
              let { message: o, activeChain: t, selectedNetwork: n } = e,
                { lcdUrl: a } = (0, r.U9i)(t, n),
                { data: m, isLoading: u } = (0, d.jv)(o, a ?? "", t);
              return u
                ? (0, i.jsx)(l.Z, {})
                : (0, i.jsx)("li", {
                    className: "font-medium dark:text-white-100 text-gray-900 text-sm mt-1 list-none ml-0",
                    children:
                      "unknown" === m
                        ? o.__type === s.ax.Unimplemented
                          ? (e => {
                              let o = e.split("."),
                                t = o[o.length - 1];
                              return (0, i.jsx)("span", { className: "text-red-500", children: t });
                            })(o.message["@type"])
                          : "Unknown"
                        : m
                  });
            },
            c = e => {
              let { parsedMessages: o, activeChain: t, selectedNetwork: n } = e,
                l = null === o || 0 === o.length || o.every(e => e.__type === s.ax.Unimplemented),
                d = (0, a.useMemo)(() => {
                  if (o) {
                    let e = "",
                      t = 0;
                    for (let n of o)
                      n.__type === s.ax.ClaimReward && (0 === t && (e = `Claim staking reward from ${(0, r.Hnh)(n.validatorAddress)}`), (t += 1));
                    return t > 1 && (e += ` and +${t - 1} more validator${t - 1 == 1 ? "" : "s"}`), e;
                  }
                  return "";
                }, [o]);
              return l
                ? null
                : (0, i.jsxs)("div", {
                    className: "rounded-lg p-4 bg-secondary-100 border border-secondary-200",
                    children: [
                      (0, i.jsx)("p", { className: "text-muted-foreground text-xs font-medium", children: "Transaction Summary" }),
                      (0, i.jsx)("ul", {
                        className: "mt-3",
                        children: d
                          ? (0, i.jsx)("li", { className: "font-medium text-foreground text-sm list-none ml-0", children: d })
                          : (null == o ? void 0 : o.map((e, o) => (0, i.jsx)(u, { message: e, activeChain: t, selectedNetwork: n }, o))) ??
                            "No information available"
                      })
                    ]
                  });
            };
          n();
        } catch (e) {
          n(e);
        }
      });
    },
    97130: function (e, o, t) {
      t.d(o, { J: () => s, R: () => r });
      var n = t(56594),
        i = t(63184);
      function r(e, o) {
        return (0, n.calculateFee)(parseInt(e), o);
      }
      function s(e, o, t) {
        let r = (0, n.calculateFee)(parseInt(t || ("gasLimit" in e ? e.gasLimit : e.gas).toString()), o);
        return i.Fee.fromPartial({
          gasLimit: r.gas,
          amount: (null == r ? void 0 : r.amount.map(e => ({ amount: e.amount, denom: e.denom }))) ?? [],
          granter: null == e ? void 0 : e.granter,
          payer: null == e ? void 0 : e.payer
        });
      }
    },
    92437: function (e, o, t) {
      t.d(o, { W: () => n });
      let n = (e, o, t) => {
        var n, i, r, s, a, l, d, m, u, c, g, p, f, v, A, k, y;
        let h = t;
        if (null == e ? void 0 : null === (n = e.origin) || void 0 === n ? void 0 : n.includes("milkyway.zone")) {
          let t = "Milk:79a7a0305165d00";
          (null == e ? void 0 : e.isAmino) &&
            ((null == o
              ? void 0
              : null === (a = o.msgs) || void 0 === a
                ? void 0
                : null === (s = a[0]) || void 0 === s
                  ? void 0
                  : null === (r = s.value) || void 0 === r
                    ? void 0
                    : null === (i = r.memo) || void 0 === i
                      ? void 0
                      : i.includes("liquid_stake")) ||
              (null == o
                ? void 0
                : null === (u = o.msgs) || void 0 === u
                  ? void 0
                  : null === (m = u[0]) || void 0 === m
                    ? void 0
                    : null === (d = m.value) || void 0 === d
                      ? void 0
                      : null === (l = d.msg) || void 0 === l
                        ? void 0
                        : l.liquid_unstake)) &&
            (h = t),
            !(null == e ? void 0 : e.isAmino) &&
              ((null == o
                ? void 0
                : null === (f = o.txBody) || void 0 === f
                  ? void 0
                  : null === (p = f.messages) || void 0 === p
                    ? void 0
                    : null === (g = p[0]) || void 0 === g
                      ? void 0
                      : null === (c = g.memo) || void 0 === c
                        ? void 0
                        : c.includes("liquid_stake")) ||
                (null == o
                  ? void 0
                  : null === (y = o.txBody) || void 0 === y
                    ? void 0
                    : null === (k = y.messages) || void 0 === k
                      ? void 0
                      : null === (A = k[0]) || void 0 === A
                        ? void 0
                        : null === (v = A.msg) || void 0 === v
                          ? void 0
                          : v.liquid_unstake)) &&
              (h = t);
        }
        return h;
      };
    },
    41026: function (e, o, t) {
      t.d(o, { p: () => i });
      var n = t(62423);
      function i(e) {
        if (null === e || 0 === e.length) return "";
        let o = "";
        for (let r of e)
          if (r.__type === n.ax.AuthzGrant) {
            let e = r.grant.authorization.$type_url ?? r.grant.authorization["@type"] ?? r.grant.authorization.type,
              n = !1,
              s = "/cosmos.bank.v1beta1.SendAuthorization" === e;
            if (((s || ["/cosmos.authz.v1beta1.GenericAuthorization", "cosmos-sdk/GenericAuthorization"].includes(e)) && (n = !0), n)) {
              var t, i;
              o =
                s ||
                (null === (i = r.grant.authorization) || void 0 === i ? void 0 : null === (t = i.value) || void 0 === t ? void 0 : t.msg) ===
                  "/cosmos.bank.v1beta1.MsgSend"
                  ? "You are allowing another account to transfer assets from your wallet for the specific time period. Be aware of scammers and approve with caution."
                  : "I've verified the wallet I'm giving permissions to";
            }
          }
        return o;
      }
    },
    98421: function (e, o, t) {
      t.d(o, { S: () => i });
      var n = t(41172);
      let i = e => {
        switch (e) {
          case n._KQ.LEDGER:
            return "ledger";
          case n._KQ.PRIVATE_KEY:
            return "private-key";
          default:
            return "seed-phrase";
        }
      };
    },
    68091: function (e, o, t) {
      t.d(o, { k: () => a });
      var n = t(6391),
        i = t.n(n),
        r = t(97130),
        s = t(92437);
      function a(e) {
        let { signRequestData: o, gasPrice: t, gasLimit: n, isAdr36: a, memo: l, isGasOptionSelected: d } = e,
          m = o["sign-request"].signDoc,
          u = o["sign-request"].signOptions,
          c = m.fee,
          g = (0, s.W)(o["sign-request"], m, m.memo),
          p = {
            chain_id: m.chain_id ?? m.chainId,
            account_number: m.account_number ?? m.accountNumber,
            sequence: m.sequence,
            fee: c,
            msgs: m.msgs,
            ...m,
            memo: g
          };
        if (!a) {
          let e = new (i())(n),
            o =
              (null == u ? void 0 : u.preferNoSetFee) && !d
                ? p.fee
                : (0, r.R)(!e.isNaN() && e.isGreaterThan(0) ? e.toString() : "gasLimit" in p.fee ? p.fee.gasLimit : p.fee.gas, t);
          (p.fee = o), c.granter && (p.fee.granter = c.granter), c.payer && (p.fee.payer = c.payer);
        }
        return g || (p.memo = l), { signDoc: { ...p }, fee: p.fee, allowSetFee: !(null == u ? void 0 : u.preferNoSetFee), defaultFee: c, defaultMemo: g };
      }
    },
    5852: function (e, o, t) {
      t.d(o, { B: () => d, T: () => m });
      var n = t(20302),
        i = t(39995),
        r = t(63184),
        s = t(95238),
        a = t(97130),
        l = t(92437);
      function d(e) {
        if ("string" == typeof e["sign-request"].signDoc.bodyBytes) {
          let o = (0, n.fromBase64)(e["sign-request"].signDoc.bodyBytes),
            t = (0, n.fromBase64)(e["sign-request"].signDoc.authInfoBytes),
            r = e["sign-request"].signDoc.chainId,
            s = e["sign-request"].signDoc.accountNumber;
          return new i.Gl({ bodyBytes: o, authInfoBytes: t, chainId: r, accountNumber: s });
        }
        {
          let o = {
            bodyBytes: new Uint8Array(Object.values(e["sign-request"].signDoc.bodyBytes)),
            authInfoBytes: new Uint8Array(Object.values(e["sign-request"].signDoc.authInfoBytes)),
            chainId: e["sign-request"].signDoc.chainId,
            accountNumber: e["sign-request"].signDoc.accountNumber
          };
          return new i.Gl(o);
        }
      }
      function m(e) {
        let o,
          { signRequestData: t, gasPrice: n, gasLimit: i, memo: m, isGasOptionSelected: u } = e,
          c = t["sign-request"].signOptions,
          g = d(t),
          p = g.authInfo.fee;
        p && (o = c && c.preferNoSetFee && !u ? p : (0, a.J)(p, n, i));
        let f = (0, l.W)(t["sign-request"], g.toJSON(), g.txBody.memo);
        return {
          signDoc: {
            ...g.signDoc,
            bodyBytes: r.TxBody.encode({ ...g.txBody, timeoutHeight: new s.Z(Number(g.txBody.timeoutHeight)), memo: f || m }).finish(),
            authInfoBytes: r.AuthInfo.encode({
              signerInfos: g.authInfo.signerInfos.map(e => ({ ...e, sequence: new s.Z(Number(e.sequence)) })),
              fee: o
            }).finish(),
            accountNumber: new s.Z(Number(g.signDoc.accountNumber))
          },
          fee: o,
          allowSetFee: !(null == c ? void 0 : c.preferNoSetFee),
          defaultFee: p,
          defaultMemo: f
        };
      }
    },
    83134: function (e, o, t) {
      t.d(o, { D0: () => n4, z9: () => n6, oM: () => n8, KX: () => n7 });
      var n,
        i,
        r,
        s,
        a,
        l,
        d = t(83321),
        m = t(81734),
        u = t(20302),
        c = t(31450),
        g = t(39649),
        p = t(56594),
        f = t(41172),
        v = t(15969),
        A = t(98074),
        k = t(86134),
        y = t(80059),
        h = t(52160);
      class b {
        static registerAminoProtoMapping(e, o) {
          b.aminoProtoMapping[e] = o;
        }
        static register(e, o) {
          b.registry[e] = o;
        }
        static getDecoder(e) {
          return b.registry[e];
        }
        static getDecoderByInstance(e) {
          if (null == e) return null;
          if (e.$typeUrl) return b.getDecoder(e.$typeUrl);
          for (let o in b.registry)
            if (Object.prototype.hasOwnProperty.call(b.registry, o)) {
              let t = b.registry[o];
              if (t.is(e) || (t.isSDK && t.isSDK(e)) || (t.isAmino && t.isAmino(e))) return t;
            }
          return null;
        }
        static getDecoderByAminoType(e) {
          if (null == e) return null;
          let o = b.aminoProtoMapping[e];
          return o ? b.getDecoder(o) : null;
        }
        static wrapAny(e) {
          if (h.I.is(e)) return e;
          let o = P(e);
          return { typeUrl: o.typeUrl, value: o.encode(e).finish() };
        }
        static unwrapAny(e) {
          let o;
          if (h.I.is(e)) o = e;
          else {
            let t = e instanceof y.oP ? e : new y.oP(e);
            o = h.I.decode(t, t.uint32());
          }
          let t = b.getDecoder(o.typeUrl);
          return t ? t.decode(o.value) : o;
        }
        static fromJSON(e) {
          return P(e).fromJSON(e);
        }
        static toJSON(e) {
          return P(e).toJSON(e);
        }
        static fromPartial(e) {
          let o = P(e);
          return o ? o.fromPartial(e) : e;
        }
        static fromSDK(e) {
          return P(e).fromSDK(e);
        }
        static fromSDKJSON(e) {
          return P(e).fromSDKJSON(e);
        }
        static toSDK(e) {
          return P(e).toSDK(e);
        }
        static fromAmino(e) {
          return P(e).fromAmino(e);
        }
        static fromAminoMsg(e) {
          let o = b.getDecoderByAminoType(e.type);
          if (!o) throw Error(`There's no decoder for the amino type ${e.type}`);
          return o.fromAminoMsg(e);
        }
        static toAmino(e) {
          let o, t;
          return h.I.is(e) ? ((o = b.unwrapAny(e)), (t = b.getDecoder(e.typeUrl)) || (t = h.I)) : ((o = e), (t = P(e))), t.toAmino(o);
        }
        static toAminoMsg(e) {
          let o, t;
          return h.I.is(e) ? ((o = b.unwrapAny(e)), (t = b.getDecoder(e.typeUrl)) || (t = h.I)) : ((o = e), (t = P(e))), t.toAminoMsg(o);
        }
      }
      function P(e) {
        let o = b.getDecoderByInstance(e);
        if (!o) throw Error(`There's no decoder for the instance ${JSON.stringify(e)}`);
        return o;
      }
      function I() {
        return { denom: "", amount: "" };
      }
      (b.registry = {}), (b.aminoProtoMapping = {}), b.register(h.I.typeUrl, h.I);
      let M = {
        typeUrl: "/cosmos.base.v1beta1.Coin",
        aminoType: "cosmos-sdk/Coin",
        is: e => e && (e.$typeUrl === M.typeUrl || ("string" == typeof e.denom && "string" == typeof e.amount)),
        isSDK: e => e && (e.$typeUrl === M.typeUrl || ("string" == typeof e.denom && "string" == typeof e.amount)),
        isAmino: e => e && (e.$typeUrl === M.typeUrl || ("string" == typeof e.denom && "string" == typeof e.amount)),
        encode: (e, o = y.Lt.create()) => ("" !== e.denom && o.uint32(10).string(e.denom), "" !== e.amount && o.uint32(18).string(e.amount), o),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = I();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.denom = t.string();
                break;
              case 2:
                i.amount = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t;
          let n = I();
          return (n.denom = null !== (o = e.denom) && void 0 !== o ? o : ""), (n.amount = null !== (t = e.amount) && void 0 !== t ? t : ""), n;
        },
        fromAmino(e) {
          let o = I();
          return void 0 !== e.denom && null !== e.denom && (o.denom = e.denom), void 0 !== e.amount && null !== e.amount && (o.amount = e.amount), o;
        },
        toAmino(e) {
          var o;
          let t = {};
          return (t.denom = "" === e.denom ? void 0 : e.denom), (t.amount = null !== (o = e.amount) && void 0 !== o ? o : ""), t;
        },
        fromAminoMsg: e => M.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/Coin", value: M.toAmino(e) }),
        fromProtoMsg: e => M.decode(e.value),
        toProto: e => M.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmos.base.v1beta1.Coin", value: M.encode(e).finish() })
      };
      function w() {
        return { denom: "", amount: "" };
      }
      b.register(M.typeUrl, M), b.registerAminoProtoMapping(M.aminoType, M.typeUrl);
      let _ = {
        typeUrl: "/cosmos.base.v1beta1.DecCoin",
        aminoType: "cosmos-sdk/DecCoin",
        is: e => e && (e.$typeUrl === _.typeUrl || ("string" == typeof e.denom && "string" == typeof e.amount)),
        isSDK: e => e && (e.$typeUrl === _.typeUrl || ("string" == typeof e.denom && "string" == typeof e.amount)),
        isAmino: e => e && (e.$typeUrl === _.typeUrl || ("string" == typeof e.denom && "string" == typeof e.amount)),
        encode: (e, o = y.Lt.create()) => ("" !== e.denom && o.uint32(10).string(e.denom), "" !== e.amount && o.uint32(18).string(e.amount), o),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = w();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.denom = t.string();
                break;
              case 2:
                i.amount = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t;
          let n = w();
          return (n.denom = null !== (o = e.denom) && void 0 !== o ? o : ""), (n.amount = null !== (t = e.amount) && void 0 !== t ? t : ""), n;
        },
        fromAmino(e) {
          let o = w();
          return void 0 !== e.denom && null !== e.denom && (o.denom = e.denom), void 0 !== e.amount && null !== e.amount && (o.amount = e.amount), o;
        },
        toAmino(e) {
          let o = {};
          return (o.denom = "" === e.denom ? void 0 : e.denom), (o.amount = "" === e.amount ? void 0 : e.amount), o;
        },
        fromAminoMsg: e => _.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/DecCoin", value: _.toAmino(e) }),
        fromProtoMsg: e => _.decode(e.value),
        toProto: e => _.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmos.base.v1beta1.DecCoin", value: _.encode(e).finish() })
      };
      function S() {
        return { int: "" };
      }
      b.register(_.typeUrl, _), b.registerAminoProtoMapping(_.aminoType, _.typeUrl);
      let x = {
        typeUrl: "/cosmos.base.v1beta1.IntProto",
        aminoType: "cosmos-sdk/IntProto",
        is: e => e && (e.$typeUrl === x.typeUrl || "string" == typeof e.int),
        isSDK: e => e && (e.$typeUrl === x.typeUrl || "string" == typeof e.int),
        isAmino: e => e && (e.$typeUrl === x.typeUrl || "string" == typeof e.int),
        encode: (e, o = y.Lt.create()) => ("" !== e.int && o.uint32(10).string(e.int), o),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = S();
          for (; t.pos < n; ) {
            let e = t.uint32();
            e >>> 3 == 1 ? (i.int = t.string()) : t.skipType(7 & e);
          }
          return i;
        },
        fromPartial(e) {
          var o;
          let t = S();
          return (t.int = null !== (o = e.int) && void 0 !== o ? o : ""), t;
        },
        fromAmino(e) {
          let o = S();
          return void 0 !== e.int && null !== e.int && (o.int = e.int), o;
        },
        toAmino(e) {
          let o = {};
          return (o.int = "" === e.int ? void 0 : e.int), o;
        },
        fromAminoMsg: e => x.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/IntProto", value: x.toAmino(e) }),
        fromProtoMsg: e => x.decode(e.value),
        toProto: e => x.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmos.base.v1beta1.IntProto", value: x.encode(e).finish() })
      };
      function U() {
        return { dec: "" };
      }
      b.register(x.typeUrl, x), b.registerAminoProtoMapping(x.aminoType, x.typeUrl);
      let T = {
        typeUrl: "/cosmos.base.v1beta1.DecProto",
        aminoType: "cosmos-sdk/DecProto",
        is: e => e && (e.$typeUrl === T.typeUrl || "string" == typeof e.dec),
        isSDK: e => e && (e.$typeUrl === T.typeUrl || "string" == typeof e.dec),
        isAmino: e => e && (e.$typeUrl === T.typeUrl || "string" == typeof e.dec),
        encode: (e, o = y.Lt.create()) => ("" !== e.dec && o.uint32(10).string(e.dec), o),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = U();
          for (; t.pos < n; ) {
            let e = t.uint32();
            e >>> 3 == 1 ? (i.dec = t.string()) : t.skipType(7 & e);
          }
          return i;
        },
        fromPartial(e) {
          var o;
          let t = U();
          return (t.dec = null !== (o = e.dec) && void 0 !== o ? o : ""), t;
        },
        fromAmino(e) {
          let o = U();
          return void 0 !== e.dec && null !== e.dec && (o.dec = e.dec), o;
        },
        toAmino(e) {
          let o = {};
          return (o.dec = "" === e.dec ? void 0 : e.dec), o;
        },
        fromAminoMsg: e => T.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/DecProto", value: T.toAmino(e) }),
        fromProtoMsg: e => T.decode(e.value),
        toProto: e => T.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmos.base.v1beta1.DecProto", value: T.encode(e).finish() })
      };
      function D() {
        return { sendEnabled: [], defaultSendEnabled: !1 };
      }
      b.register(T.typeUrl, T), b.registerAminoProtoMapping(T.aminoType, T.typeUrl);
      let C = {
        typeUrl: "/cosmos.bank.v1beta1.Params",
        aminoType: "cosmos-sdk/x/bank/Params",
        is: e =>
          e &&
          (e.$typeUrl === C.typeUrl ||
            (Array.isArray(e.sendEnabled) && (!e.sendEnabled.length || N.is(e.sendEnabled[0])) && "boolean" == typeof e.defaultSendEnabled)),
        isSDK: e =>
          e &&
          (e.$typeUrl === C.typeUrl ||
            (Array.isArray(e.send_enabled) && (!e.send_enabled.length || N.isSDK(e.send_enabled[0])) && "boolean" == typeof e.default_send_enabled)),
        isAmino: e =>
          e &&
          (e.$typeUrl === C.typeUrl ||
            (Array.isArray(e.send_enabled) && (!e.send_enabled.length || N.isAmino(e.send_enabled[0])) && "boolean" == typeof e.default_send_enabled)),
        encode(e, o = y.Lt.create()) {
          for (let t of e.sendEnabled) N.encode(t, o.uint32(10).fork()).ldelim();
          return !0 === e.defaultSendEnabled && o.uint32(16).bool(e.defaultSendEnabled), o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = D();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.sendEnabled.push(N.decode(t, t.uint32()));
                break;
              case 2:
                i.defaultSendEnabled = t.bool();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t;
          let n = D();
          return (
            (n.sendEnabled = (null === (o = e.sendEnabled) || void 0 === o ? void 0 : o.map(e => N.fromPartial(e))) || []),
            (n.defaultSendEnabled = null !== (t = e.defaultSendEnabled) && void 0 !== t && t),
            n
          );
        },
        fromAmino(e) {
          var o;
          let t = D();
          return (
            (t.sendEnabled = (null === (o = e.send_enabled) || void 0 === o ? void 0 : o.map(e => N.fromAmino(e))) || []),
            void 0 !== e.default_send_enabled && null !== e.default_send_enabled && (t.defaultSendEnabled = e.default_send_enabled),
            t
          );
        },
        toAmino(e) {
          let o = {};
          return (
            e.sendEnabled ? (o.send_enabled = e.sendEnabled.map(e => (e ? N.toAmino(e) : void 0))) : (o.send_enabled = e.sendEnabled),
            (o.default_send_enabled = !1 === e.defaultSendEnabled ? void 0 : e.defaultSendEnabled),
            o
          );
        },
        fromAminoMsg: e => C.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/x/bank/Params", value: C.toAmino(e) }),
        fromProtoMsg: e => C.decode(e.value),
        toProto: e => C.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmos.bank.v1beta1.Params", value: C.encode(e).finish() })
      };
      function B() {
        return { denom: "", enabled: !1 };
      }
      b.register(C.typeUrl, C), b.registerAminoProtoMapping(C.aminoType, C.typeUrl);
      let N = {
        typeUrl: "/cosmos.bank.v1beta1.SendEnabled",
        aminoType: "cosmos-sdk/SendEnabled",
        is: e => e && (e.$typeUrl === N.typeUrl || ("string" == typeof e.denom && "boolean" == typeof e.enabled)),
        isSDK: e => e && (e.$typeUrl === N.typeUrl || ("string" == typeof e.denom && "boolean" == typeof e.enabled)),
        isAmino: e => e && (e.$typeUrl === N.typeUrl || ("string" == typeof e.denom && "boolean" == typeof e.enabled)),
        encode: (e, o = y.Lt.create()) => ("" !== e.denom && o.uint32(10).string(e.denom), !0 === e.enabled && o.uint32(16).bool(e.enabled), o),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = B();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.denom = t.string();
                break;
              case 2:
                i.enabled = t.bool();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t;
          let n = B();
          return (n.denom = null !== (o = e.denom) && void 0 !== o ? o : ""), (n.enabled = null !== (t = e.enabled) && void 0 !== t && t), n;
        },
        fromAmino(e) {
          let o = B();
          return void 0 !== e.denom && null !== e.denom && (o.denom = e.denom), void 0 !== e.enabled && null !== e.enabled && (o.enabled = e.enabled), o;
        },
        toAmino(e) {
          let o = {};
          return (o.denom = "" === e.denom ? void 0 : e.denom), (o.enabled = !1 === e.enabled ? void 0 : e.enabled), o;
        },
        fromAminoMsg: e => N.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/SendEnabled", value: N.toAmino(e) }),
        fromProtoMsg: e => N.decode(e.value),
        toProto: e => N.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmos.bank.v1beta1.SendEnabled", value: N.encode(e).finish() })
      };
      function E() {
        return { address: "", coins: [] };
      }
      b.register(N.typeUrl, N), b.registerAminoProtoMapping(N.aminoType, N.typeUrl);
      let O = {
        typeUrl: "/cosmos.bank.v1beta1.Input",
        aminoType: "cosmos-sdk/Input",
        is: e => e && (e.$typeUrl === O.typeUrl || ("string" == typeof e.address && Array.isArray(e.coins) && (!e.coins.length || M.is(e.coins[0])))),
        isSDK: e => e && (e.$typeUrl === O.typeUrl || ("string" == typeof e.address && Array.isArray(e.coins) && (!e.coins.length || M.isSDK(e.coins[0])))),
        isAmino: e => e && (e.$typeUrl === O.typeUrl || ("string" == typeof e.address && Array.isArray(e.coins) && (!e.coins.length || M.isAmino(e.coins[0])))),
        encode(e, o = y.Lt.create()) {
          for (let t of ("" !== e.address && o.uint32(10).string(e.address), e.coins)) M.encode(t, o.uint32(18).fork()).ldelim();
          return o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = E();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.address = t.string();
                break;
              case 2:
                i.coins.push(M.decode(t, t.uint32()));
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t;
          let n = E();
          return (
            (n.address = null !== (o = e.address) && void 0 !== o ? o : ""),
            (n.coins = (null === (t = e.coins) || void 0 === t ? void 0 : t.map(e => M.fromPartial(e))) || []),
            n
          );
        },
        fromAmino(e) {
          var o;
          let t = E();
          return (
            void 0 !== e.address && null !== e.address && (t.address = e.address),
            (t.coins = (null === (o = e.coins) || void 0 === o ? void 0 : o.map(e => M.fromAmino(e))) || []),
            t
          );
        },
        toAmino(e) {
          let o = {};
          return (
            (o.address = "" === e.address ? void 0 : e.address), e.coins ? (o.coins = e.coins.map(e => (e ? M.toAmino(e) : void 0))) : (o.coins = e.coins), o
          );
        },
        fromAminoMsg: e => O.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/Input", value: O.toAmino(e) }),
        fromProtoMsg: e => O.decode(e.value),
        toProto: e => O.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmos.bank.v1beta1.Input", value: O.encode(e).finish() })
      };
      function R() {
        return { address: "", coins: [] };
      }
      b.register(O.typeUrl, O), b.registerAminoProtoMapping(O.aminoType, O.typeUrl);
      let L = {
        typeUrl: "/cosmos.bank.v1beta1.Output",
        aminoType: "cosmos-sdk/Output",
        is: e => e && (e.$typeUrl === L.typeUrl || ("string" == typeof e.address && Array.isArray(e.coins) && (!e.coins.length || M.is(e.coins[0])))),
        isSDK: e => e && (e.$typeUrl === L.typeUrl || ("string" == typeof e.address && Array.isArray(e.coins) && (!e.coins.length || M.isSDK(e.coins[0])))),
        isAmino: e => e && (e.$typeUrl === L.typeUrl || ("string" == typeof e.address && Array.isArray(e.coins) && (!e.coins.length || M.isAmino(e.coins[0])))),
        encode(e, o = y.Lt.create()) {
          for (let t of ("" !== e.address && o.uint32(10).string(e.address), e.coins)) M.encode(t, o.uint32(18).fork()).ldelim();
          return o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = R();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.address = t.string();
                break;
              case 2:
                i.coins.push(M.decode(t, t.uint32()));
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t;
          let n = R();
          return (
            (n.address = null !== (o = e.address) && void 0 !== o ? o : ""),
            (n.coins = (null === (t = e.coins) || void 0 === t ? void 0 : t.map(e => M.fromPartial(e))) || []),
            n
          );
        },
        fromAmino(e) {
          var o;
          let t = R();
          return (
            void 0 !== e.address && null !== e.address && (t.address = e.address),
            (t.coins = (null === (o = e.coins) || void 0 === o ? void 0 : o.map(e => M.fromAmino(e))) || []),
            t
          );
        },
        toAmino(e) {
          let o = {};
          return (
            (o.address = "" === e.address ? void 0 : e.address), e.coins ? (o.coins = e.coins.map(e => (e ? M.toAmino(e) : void 0))) : (o.coins = e.coins), o
          );
        },
        fromAminoMsg: e => L.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/Output", value: L.toAmino(e) }),
        fromProtoMsg: e => L.decode(e.value),
        toProto: e => L.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmos.bank.v1beta1.Output", value: L.encode(e).finish() })
      };
      function j() {
        return { $typeUrl: "/cosmos.bank.v1beta1.Supply", total: [] };
      }
      b.register(L.typeUrl, L), b.registerAminoProtoMapping(L.aminoType, L.typeUrl);
      let q = {
        typeUrl: "/cosmos.bank.v1beta1.Supply",
        aminoType: "cosmos-sdk/Supply",
        is: e => e && (e.$typeUrl === q.typeUrl || (Array.isArray(e.total) && (!e.total.length || M.is(e.total[0])))),
        isSDK: e => e && (e.$typeUrl === q.typeUrl || (Array.isArray(e.total) && (!e.total.length || M.isSDK(e.total[0])))),
        isAmino: e => e && (e.$typeUrl === q.typeUrl || (Array.isArray(e.total) && (!e.total.length || M.isAmino(e.total[0])))),
        encode(e, o = y.Lt.create()) {
          for (let t of e.total) M.encode(t, o.uint32(10).fork()).ldelim();
          return o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = j();
          for (; t.pos < n; ) {
            let e = t.uint32();
            e >>> 3 == 1 ? i.total.push(M.decode(t, t.uint32())) : t.skipType(7 & e);
          }
          return i;
        },
        fromPartial(e) {
          var o;
          let t = j();
          return (t.total = (null === (o = e.total) || void 0 === o ? void 0 : o.map(e => M.fromPartial(e))) || []), t;
        },
        fromAmino(e) {
          var o;
          let t = j();
          return (t.total = (null === (o = e.total) || void 0 === o ? void 0 : o.map(e => M.fromAmino(e))) || []), t;
        },
        toAmino(e) {
          let o = {};
          return e.total ? (o.total = e.total.map(e => (e ? M.toAmino(e) : void 0))) : (o.total = e.total), o;
        },
        fromAminoMsg: e => q.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/Supply", value: q.toAmino(e) }),
        fromProtoMsg: e => q.decode(e.value),
        toProto: e => q.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmos.bank.v1beta1.Supply", value: q.encode(e).finish() })
      };
      function $() {
        return { denom: "", exponent: 0, aliases: [] };
      }
      b.register(q.typeUrl, q), b.registerAminoProtoMapping(q.aminoType, q.typeUrl);
      let F = {
        typeUrl: "/cosmos.bank.v1beta1.DenomUnit",
        aminoType: "cosmos-sdk/DenomUnit",
        is: e =>
          e &&
          (e.$typeUrl === F.typeUrl ||
            ("string" == typeof e.denom &&
              "number" == typeof e.exponent &&
              Array.isArray(e.aliases) &&
              (!e.aliases.length || "string" == typeof e.aliases[0]))),
        isSDK: e =>
          e &&
          (e.$typeUrl === F.typeUrl ||
            ("string" == typeof e.denom &&
              "number" == typeof e.exponent &&
              Array.isArray(e.aliases) &&
              (!e.aliases.length || "string" == typeof e.aliases[0]))),
        isAmino: e =>
          e &&
          (e.$typeUrl === F.typeUrl ||
            ("string" == typeof e.denom &&
              "number" == typeof e.exponent &&
              Array.isArray(e.aliases) &&
              (!e.aliases.length || "string" == typeof e.aliases[0]))),
        encode(e, o = y.Lt.create()) {
          for (let t of ("" !== e.denom && o.uint32(10).string(e.denom), 0 !== e.exponent && o.uint32(16).uint32(e.exponent), e.aliases))
            o.uint32(26).string(t);
          return o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = $();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.denom = t.string();
                break;
              case 2:
                i.exponent = t.uint32();
                break;
              case 3:
                i.aliases.push(t.string());
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n;
          let i = $();
          return (
            (i.denom = null !== (o = e.denom) && void 0 !== o ? o : ""),
            (i.exponent = null !== (t = e.exponent) && void 0 !== t ? t : 0),
            (i.aliases = (null === (n = e.aliases) || void 0 === n ? void 0 : n.map(e => e)) || []),
            i
          );
        },
        fromAmino(e) {
          var o;
          let t = $();
          return (
            void 0 !== e.denom && null !== e.denom && (t.denom = e.denom),
            void 0 !== e.exponent && null !== e.exponent && (t.exponent = e.exponent),
            (t.aliases = (null === (o = e.aliases) || void 0 === o ? void 0 : o.map(e => e)) || []),
            t
          );
        },
        toAmino(e) {
          let o = {};
          return (
            (o.denom = "" === e.denom ? void 0 : e.denom),
            (o.exponent = 0 === e.exponent ? void 0 : e.exponent),
            e.aliases ? (o.aliases = e.aliases.map(e => e)) : (o.aliases = e.aliases),
            o
          );
        },
        fromAminoMsg: e => F.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/DenomUnit", value: F.toAmino(e) }),
        fromProtoMsg: e => F.decode(e.value),
        toProto: e => F.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmos.bank.v1beta1.DenomUnit", value: F.encode(e).finish() })
      };
      function V() {
        return { description: "", denomUnits: [], base: "", display: "", name: "", symbol: "", uri: "", uriHash: "" };
      }
      b.register(F.typeUrl, F), b.registerAminoProtoMapping(F.aminoType, F.typeUrl);
      let Z = {
        typeUrl: "/cosmos.bank.v1beta1.Metadata",
        aminoType: "cosmos-sdk/Metadata",
        is: e =>
          e &&
          (e.$typeUrl === Z.typeUrl ||
            ("string" == typeof e.description &&
              Array.isArray(e.denomUnits) &&
              (!e.denomUnits.length || F.is(e.denomUnits[0])) &&
              "string" == typeof e.base &&
              "string" == typeof e.display &&
              "string" == typeof e.name &&
              "string" == typeof e.symbol &&
              "string" == typeof e.uri &&
              "string" == typeof e.uriHash)),
        isSDK: e =>
          e &&
          (e.$typeUrl === Z.typeUrl ||
            ("string" == typeof e.description &&
              Array.isArray(e.denom_units) &&
              (!e.denom_units.length || F.isSDK(e.denom_units[0])) &&
              "string" == typeof e.base &&
              "string" == typeof e.display &&
              "string" == typeof e.name &&
              "string" == typeof e.symbol &&
              "string" == typeof e.uri &&
              "string" == typeof e.uri_hash)),
        isAmino: e =>
          e &&
          (e.$typeUrl === Z.typeUrl ||
            ("string" == typeof e.description &&
              Array.isArray(e.denom_units) &&
              (!e.denom_units.length || F.isAmino(e.denom_units[0])) &&
              "string" == typeof e.base &&
              "string" == typeof e.display &&
              "string" == typeof e.name &&
              "string" == typeof e.symbol &&
              "string" == typeof e.uri &&
              "string" == typeof e.uri_hash)),
        encode(e, o = y.Lt.create()) {
          for (let t of ("" !== e.description && o.uint32(10).string(e.description), e.denomUnits)) F.encode(t, o.uint32(18).fork()).ldelim();
          return (
            "" !== e.base && o.uint32(26).string(e.base),
            "" !== e.display && o.uint32(34).string(e.display),
            "" !== e.name && o.uint32(42).string(e.name),
            "" !== e.symbol && o.uint32(50).string(e.symbol),
            "" !== e.uri && o.uint32(58).string(e.uri),
            "" !== e.uriHash && o.uint32(66).string(e.uriHash),
            o
          );
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = V();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.description = t.string();
                break;
              case 2:
                i.denomUnits.push(F.decode(t, t.uint32()));
                break;
              case 3:
                i.base = t.string();
                break;
              case 4:
                i.display = t.string();
                break;
              case 5:
                i.name = t.string();
                break;
              case 6:
                i.symbol = t.string();
                break;
              case 7:
                i.uri = t.string();
                break;
              case 8:
                i.uriHash = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n, i, r, s, a, l;
          let d = V();
          return (
            (d.description = null !== (o = e.description) && void 0 !== o ? o : ""),
            (d.denomUnits = (null === (t = e.denomUnits) || void 0 === t ? void 0 : t.map(e => F.fromPartial(e))) || []),
            (d.base = null !== (n = e.base) && void 0 !== n ? n : ""),
            (d.display = null !== (i = e.display) && void 0 !== i ? i : ""),
            (d.name = null !== (r = e.name) && void 0 !== r ? r : ""),
            (d.symbol = null !== (s = e.symbol) && void 0 !== s ? s : ""),
            (d.uri = null !== (a = e.uri) && void 0 !== a ? a : ""),
            (d.uriHash = null !== (l = e.uriHash) && void 0 !== l ? l : ""),
            d
          );
        },
        fromAmino(e) {
          var o;
          let t = V();
          return (
            void 0 !== e.description && null !== e.description && (t.description = e.description),
            (t.denomUnits = (null === (o = e.denom_units) || void 0 === o ? void 0 : o.map(e => F.fromAmino(e))) || []),
            void 0 !== e.base && null !== e.base && (t.base = e.base),
            void 0 !== e.display && null !== e.display && (t.display = e.display),
            void 0 !== e.name && null !== e.name && (t.name = e.name),
            void 0 !== e.symbol && null !== e.symbol && (t.symbol = e.symbol),
            void 0 !== e.uri && null !== e.uri && (t.uri = e.uri),
            void 0 !== e.uri_hash && null !== e.uri_hash && (t.uriHash = e.uri_hash),
            t
          );
        },
        toAmino(e) {
          let o = {};
          return (
            (o.description = "" === e.description ? void 0 : e.description),
            e.denomUnits ? (o.denom_units = e.denomUnits.map(e => (e ? F.toAmino(e) : void 0))) : (o.denom_units = e.denomUnits),
            (o.base = "" === e.base ? void 0 : e.base),
            (o.display = "" === e.display ? void 0 : e.display),
            (o.name = "" === e.name ? void 0 : e.name),
            (o.symbol = "" === e.symbol ? void 0 : e.symbol),
            (o.uri = "" === e.uri ? void 0 : e.uri),
            (o.uri_hash = "" === e.uriHash ? void 0 : e.uriHash),
            o
          );
        },
        fromAminoMsg: e => Z.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/Metadata", value: Z.toAmino(e) }),
        fromProtoMsg: e => Z.decode(e.value),
        toProto: e => Z.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmos.bank.v1beta1.Metadata", value: Z.encode(e).finish() })
      };
      function G() {
        return { fromAddress: "", toAddress: "", amount: [] };
      }
      b.register(Z.typeUrl, Z), b.registerAminoProtoMapping(Z.aminoType, Z.typeUrl);
      let H = {
        typeUrl: "/cosmos.bank.v1beta1.MsgSend",
        aminoType: "cosmos-sdk/MsgSend",
        is: e =>
          e &&
          (e.$typeUrl === H.typeUrl ||
            ("string" == typeof e.fromAddress && "string" == typeof e.toAddress && Array.isArray(e.amount) && (!e.amount.length || M.is(e.amount[0])))),
        isSDK: e =>
          e &&
          (e.$typeUrl === H.typeUrl ||
            ("string" == typeof e.from_address && "string" == typeof e.to_address && Array.isArray(e.amount) && (!e.amount.length || M.isSDK(e.amount[0])))),
        isAmino: e =>
          e &&
          (e.$typeUrl === H.typeUrl ||
            ("string" == typeof e.from_address && "string" == typeof e.to_address && Array.isArray(e.amount) && (!e.amount.length || M.isAmino(e.amount[0])))),
        encode(e, o = y.Lt.create()) {
          for (let t of ("" !== e.fromAddress && o.uint32(10).string(e.fromAddress), "" !== e.toAddress && o.uint32(18).string(e.toAddress), e.amount))
            M.encode(t, o.uint32(26).fork()).ldelim();
          return o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = G();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.fromAddress = t.string();
                break;
              case 2:
                i.toAddress = t.string();
                break;
              case 3:
                i.amount.push(M.decode(t, t.uint32()));
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n;
          let i = G();
          return (
            (i.fromAddress = null !== (o = e.fromAddress) && void 0 !== o ? o : ""),
            (i.toAddress = null !== (t = e.toAddress) && void 0 !== t ? t : ""),
            (i.amount = (null === (n = e.amount) || void 0 === n ? void 0 : n.map(e => M.fromPartial(e))) || []),
            i
          );
        },
        fromAmino(e) {
          var o;
          let t = G();
          return (
            void 0 !== e.from_address && null !== e.from_address && (t.fromAddress = e.from_address),
            void 0 !== e.to_address && null !== e.to_address && (t.toAddress = e.to_address),
            (t.amount = (null === (o = e.amount) || void 0 === o ? void 0 : o.map(e => M.fromAmino(e))) || []),
            t
          );
        },
        toAmino(e) {
          let o = {};
          return (
            (o.from_address = "" === e.fromAddress ? void 0 : e.fromAddress),
            (o.to_address = "" === e.toAddress ? void 0 : e.toAddress),
            e.amount ? (o.amount = e.amount.map(e => (e ? M.toAmino(e) : void 0))) : (o.amount = e.amount),
            o
          );
        },
        fromAminoMsg: e => H.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/MsgSend", value: H.toAmino(e) }),
        fromProtoMsg: e => H.decode(e.value),
        toProto: e => H.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmos.bank.v1beta1.MsgSend", value: H.encode(e).finish() })
      };
      b.register(H.typeUrl, H), b.registerAminoProtoMapping(H.aminoType, H.typeUrl);
      let z = {
        typeUrl: "/cosmos.bank.v1beta1.MsgSendResponse",
        aminoType: "cosmos-sdk/MsgSendResponse",
        is: e => e && e.$typeUrl === z.typeUrl,
        isSDK: e => e && e.$typeUrl === z.typeUrl,
        isAmino: e => e && e.$typeUrl === z.typeUrl,
        encode: (e, o = y.Lt.create()) => o,
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o;
          for (; t.pos < n; ) {
            let e = t.uint32();
            t.skipType(7 & e);
          }
          return {};
        },
        fromPartial: e => ({}),
        fromAmino: e => ({}),
        toAmino: e => ({}),
        fromAminoMsg: e => z.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/MsgSendResponse", value: z.toAmino(e) }),
        fromProtoMsg: e => z.decode(e.value),
        toProto: e => z.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmos.bank.v1beta1.MsgSendResponse", value: z.encode(e).finish() })
      };
      function W() {
        return { inputs: [], outputs: [] };
      }
      b.register(z.typeUrl, z), b.registerAminoProtoMapping(z.aminoType, z.typeUrl);
      let Y = {
        typeUrl: "/cosmos.bank.v1beta1.MsgMultiSend",
        aminoType: "cosmos-sdk/MsgMultiSend",
        is: e =>
          e &&
          (e.$typeUrl === Y.typeUrl ||
            (Array.isArray(e.inputs) && (!e.inputs.length || O.is(e.inputs[0])) && Array.isArray(e.outputs) && (!e.outputs.length || L.is(e.outputs[0])))),
        isSDK: e =>
          e &&
          (e.$typeUrl === Y.typeUrl ||
            (Array.isArray(e.inputs) &&
              (!e.inputs.length || O.isSDK(e.inputs[0])) &&
              Array.isArray(e.outputs) &&
              (!e.outputs.length || L.isSDK(e.outputs[0])))),
        isAmino: e =>
          e &&
          (e.$typeUrl === Y.typeUrl ||
            (Array.isArray(e.inputs) &&
              (!e.inputs.length || O.isAmino(e.inputs[0])) &&
              Array.isArray(e.outputs) &&
              (!e.outputs.length || L.isAmino(e.outputs[0])))),
        encode(e, o = y.Lt.create()) {
          for (let t of e.inputs) O.encode(t, o.uint32(10).fork()).ldelim();
          for (let t of e.outputs) L.encode(t, o.uint32(18).fork()).ldelim();
          return o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = W();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.inputs.push(O.decode(t, t.uint32()));
                break;
              case 2:
                i.outputs.push(L.decode(t, t.uint32()));
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t;
          let n = W();
          return (
            (n.inputs = (null === (o = e.inputs) || void 0 === o ? void 0 : o.map(e => O.fromPartial(e))) || []),
            (n.outputs = (null === (t = e.outputs) || void 0 === t ? void 0 : t.map(e => L.fromPartial(e))) || []),
            n
          );
        },
        fromAmino(e) {
          var o, t;
          let n = W();
          return (
            (n.inputs = (null === (o = e.inputs) || void 0 === o ? void 0 : o.map(e => O.fromAmino(e))) || []),
            (n.outputs = (null === (t = e.outputs) || void 0 === t ? void 0 : t.map(e => L.fromAmino(e))) || []),
            n
          );
        },
        toAmino(e) {
          let o = {};
          return (
            e.inputs ? (o.inputs = e.inputs.map(e => (e ? O.toAmino(e) : void 0))) : (o.inputs = e.inputs),
            e.outputs ? (o.outputs = e.outputs.map(e => (e ? L.toAmino(e) : void 0))) : (o.outputs = e.outputs),
            o
          );
        },
        fromAminoMsg: e => Y.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/MsgMultiSend", value: Y.toAmino(e) }),
        fromProtoMsg: e => Y.decode(e.value),
        toProto: e => Y.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmos.bank.v1beta1.MsgMultiSend", value: Y.encode(e).finish() })
      };
      b.register(Y.typeUrl, Y), b.registerAminoProtoMapping(Y.aminoType, Y.typeUrl);
      let J = {
        typeUrl: "/cosmos.bank.v1beta1.MsgMultiSendResponse",
        aminoType: "cosmos-sdk/MsgMultiSendResponse",
        is: e => e && e.$typeUrl === J.typeUrl,
        isSDK: e => e && e.$typeUrl === J.typeUrl,
        isAmino: e => e && e.$typeUrl === J.typeUrl,
        encode: (e, o = y.Lt.create()) => o,
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o;
          for (; t.pos < n; ) {
            let e = t.uint32();
            t.skipType(7 & e);
          }
          return {};
        },
        fromPartial: e => ({}),
        fromAmino: e => ({}),
        toAmino: e => ({}),
        fromAminoMsg: e => J.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/MsgMultiSendResponse", value: J.toAmino(e) }),
        fromProtoMsg: e => J.decode(e.value),
        toProto: e => J.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmos.bank.v1beta1.MsgMultiSendResponse", value: J.encode(e).finish() })
      };
      function K() {
        return { authority: "", params: C.fromPartial({}) };
      }
      b.register(J.typeUrl, J), b.registerAminoProtoMapping(J.aminoType, J.typeUrl);
      let Q = {
        typeUrl: "/cosmos.bank.v1beta1.MsgUpdateParams",
        aminoType: "cosmos-sdk/x/bank/MsgUpdateParams",
        is: e => e && (e.$typeUrl === Q.typeUrl || ("string" == typeof e.authority && C.is(e.params))),
        isSDK: e => e && (e.$typeUrl === Q.typeUrl || ("string" == typeof e.authority && C.isSDK(e.params))),
        isAmino: e => e && (e.$typeUrl === Q.typeUrl || ("string" == typeof e.authority && C.isAmino(e.params))),
        encode: (e, o = y.Lt.create()) => (
          "" !== e.authority && o.uint32(10).string(e.authority), void 0 !== e.params && C.encode(e.params, o.uint32(18).fork()).ldelim(), o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = K();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.authority = t.string();
                break;
              case 2:
                i.params = C.decode(t, t.uint32());
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o;
          let t = K();
          return (
            (t.authority = null !== (o = e.authority) && void 0 !== o ? o : ""),
            (t.params = void 0 !== e.params && null !== e.params ? C.fromPartial(e.params) : void 0),
            t
          );
        },
        fromAmino(e) {
          let o = K();
          return (
            void 0 !== e.authority && null !== e.authority && (o.authority = e.authority),
            void 0 !== e.params && null !== e.params && (o.params = C.fromAmino(e.params)),
            o
          );
        },
        toAmino(e) {
          let o = {};
          return (o.authority = "" === e.authority ? void 0 : e.authority), (o.params = e.params ? C.toAmino(e.params) : C.toAmino(C.fromPartial({}))), o;
        },
        fromAminoMsg: e => Q.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/x/bank/MsgUpdateParams", value: Q.toAmino(e) }),
        fromProtoMsg: e => Q.decode(e.value),
        toProto: e => Q.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmos.bank.v1beta1.MsgUpdateParams", value: Q.encode(e).finish() })
      };
      b.register(Q.typeUrl, Q), b.registerAminoProtoMapping(Q.aminoType, Q.typeUrl);
      let X = {
        typeUrl: "/cosmos.bank.v1beta1.MsgUpdateParamsResponse",
        aminoType: "cosmos-sdk/MsgUpdateParamsResponse",
        is: e => e && e.$typeUrl === X.typeUrl,
        isSDK: e => e && e.$typeUrl === X.typeUrl,
        isAmino: e => e && e.$typeUrl === X.typeUrl,
        encode: (e, o = y.Lt.create()) => o,
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o;
          for (; t.pos < n; ) {
            let e = t.uint32();
            t.skipType(7 & e);
          }
          return {};
        },
        fromPartial: e => ({}),
        fromAmino: e => ({}),
        toAmino: e => ({}),
        fromAminoMsg: e => X.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/MsgUpdateParamsResponse", value: X.toAmino(e) }),
        fromProtoMsg: e => X.decode(e.value),
        toProto: e => X.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmos.bank.v1beta1.MsgUpdateParamsResponse", value: X.encode(e).finish() })
      };
      function ee() {
        return { authority: "", sendEnabled: [], useDefaultFor: [] };
      }
      b.register(X.typeUrl, X), b.registerAminoProtoMapping(X.aminoType, X.typeUrl);
      let eo = {
        typeUrl: "/cosmos.bank.v1beta1.MsgSetSendEnabled",
        aminoType: "cosmos-sdk/MsgSetSendEnabled",
        is: e =>
          e &&
          (e.$typeUrl === eo.typeUrl ||
            ("string" == typeof e.authority &&
              Array.isArray(e.sendEnabled) &&
              (!e.sendEnabled.length || N.is(e.sendEnabled[0])) &&
              Array.isArray(e.useDefaultFor) &&
              (!e.useDefaultFor.length || "string" == typeof e.useDefaultFor[0]))),
        isSDK: e =>
          e &&
          (e.$typeUrl === eo.typeUrl ||
            ("string" == typeof e.authority &&
              Array.isArray(e.send_enabled) &&
              (!e.send_enabled.length || N.isSDK(e.send_enabled[0])) &&
              Array.isArray(e.use_default_for) &&
              (!e.use_default_for.length || "string" == typeof e.use_default_for[0]))),
        isAmino: e =>
          e &&
          (e.$typeUrl === eo.typeUrl ||
            ("string" == typeof e.authority &&
              Array.isArray(e.send_enabled) &&
              (!e.send_enabled.length || N.isAmino(e.send_enabled[0])) &&
              Array.isArray(e.use_default_for) &&
              (!e.use_default_for.length || "string" == typeof e.use_default_for[0]))),
        encode(e, o = y.Lt.create()) {
          for (let t of ("" !== e.authority && o.uint32(10).string(e.authority), e.sendEnabled)) N.encode(t, o.uint32(18).fork()).ldelim();
          for (let t of e.useDefaultFor) o.uint32(26).string(t);
          return o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = ee();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.authority = t.string();
                break;
              case 2:
                i.sendEnabled.push(N.decode(t, t.uint32()));
                break;
              case 3:
                i.useDefaultFor.push(t.string());
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n;
          let i = ee();
          return (
            (i.authority = null !== (o = e.authority) && void 0 !== o ? o : ""),
            (i.sendEnabled = (null === (t = e.sendEnabled) || void 0 === t ? void 0 : t.map(e => N.fromPartial(e))) || []),
            (i.useDefaultFor = (null === (n = e.useDefaultFor) || void 0 === n ? void 0 : n.map(e => e)) || []),
            i
          );
        },
        fromAmino(e) {
          var o, t;
          let n = ee();
          return (
            void 0 !== e.authority && null !== e.authority && (n.authority = e.authority),
            (n.sendEnabled = (null === (o = e.send_enabled) || void 0 === o ? void 0 : o.map(e => N.fromAmino(e))) || []),
            (n.useDefaultFor = (null === (t = e.use_default_for) || void 0 === t ? void 0 : t.map(e => e)) || []),
            n
          );
        },
        toAmino(e) {
          let o = {};
          return (
            (o.authority = "" === e.authority ? void 0 : e.authority),
            e.sendEnabled ? (o.send_enabled = e.sendEnabled.map(e => (e ? N.toAmino(e) : void 0))) : (o.send_enabled = e.sendEnabled),
            e.useDefaultFor ? (o.use_default_for = e.useDefaultFor.map(e => e)) : (o.use_default_for = e.useDefaultFor),
            o
          );
        },
        fromAminoMsg: e => eo.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/MsgSetSendEnabled", value: eo.toAmino(e) }),
        fromProtoMsg: e => eo.decode(e.value),
        toProto: e => eo.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmos.bank.v1beta1.MsgSetSendEnabled", value: eo.encode(e).finish() })
      };
      b.register(eo.typeUrl, eo), b.registerAminoProtoMapping(eo.aminoType, eo.typeUrl);
      let et = {
        typeUrl: "/cosmos.bank.v1beta1.MsgSetSendEnabledResponse",
        aminoType: "cosmos-sdk/MsgSetSendEnabledResponse",
        is: e => e && e.$typeUrl === et.typeUrl,
        isSDK: e => e && e.$typeUrl === et.typeUrl,
        isAmino: e => e && e.$typeUrl === et.typeUrl,
        encode: (e, o = y.Lt.create()) => o,
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o;
          for (; t.pos < n; ) {
            let e = t.uint32();
            t.skipType(7 & e);
          }
          return {};
        },
        fromPartial: e => ({}),
        fromAmino: e => ({}),
        toAmino: e => ({}),
        fromAminoMsg: e => et.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/MsgSetSendEnabledResponse", value: et.toAmino(e) }),
        fromProtoMsg: e => et.decode(e.value),
        toProto: e => et.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmos.bank.v1beta1.MsgSetSendEnabledResponse", value: et.encode(e).finish() })
      };
      b.register(et.typeUrl, et), b.registerAminoProtoMapping(et.aminoType, et.typeUrl);
      let en = {
          "/cosmos.bank.v1beta1.MsgSend": { aminoType: "cosmos-sdk/MsgSend", toAmino: H.toAmino, fromAmino: H.fromAmino },
          "/cosmos.bank.v1beta1.MsgMultiSend": { aminoType: "cosmos-sdk/MsgMultiSend", toAmino: Y.toAmino, fromAmino: Y.fromAmino }
        },
        ei = [
          ["/cosmos.bank.v1beta1.MsgSend", H],
          ["/cosmos.bank.v1beta1.MsgMultiSend", Y]
        ];
      var er = t(36686),
        es = t(51960),
        ea = t(13779),
        el = t(25342);
      function ed() {
        return { rate: "", maxRate: "", maxChangeRate: "" };
      }
      let em = {
        typeUrl: "/cosmos.staking.v1beta1.CommissionRates",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.rate && o.uint32(10).string(c.Decimal.fromUserInput(e.rate, 18).atomics),
          "" !== e.maxRate && o.uint32(18).string(c.Decimal.fromUserInput(e.maxRate, 18).atomics),
          "" !== e.maxChangeRate && o.uint32(26).string(c.Decimal.fromUserInput(e.maxChangeRate, 18).atomics),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = ed();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.rate = c.Decimal.fromAtomics(t.string(), 18).toString();
                break;
              case 2:
                i.maxRate = c.Decimal.fromAtomics(t.string(), 18).toString();
                break;
              case 3:
                i.maxChangeRate = c.Decimal.fromAtomics(t.string(), 18).toString();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n;
          let i = ed();
          return (
            (i.rate = null !== (o = e.rate) && void 0 !== o ? o : ""),
            (i.maxRate = null !== (t = e.maxRate) && void 0 !== t ? t : ""),
            (i.maxChangeRate = null !== (n = e.maxChangeRate) && void 0 !== n ? n : ""),
            i
          );
        },
        fromAmino: e => ({ rate: e.rate, maxRate: e.max_rate, maxChangeRate: e.max_change_rate }),
        toAmino(e) {
          let o = {};
          return (o.rate = e.rate), (o.max_rate = e.maxRate), (o.max_change_rate = e.maxChangeRate), o;
        },
        fromAminoMsg: e => em.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/CommissionRates", value: em.toAmino(e) }),
        fromProtoMsg: e => em.decode(e.value),
        toProto: e => em.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmos.staking.v1beta1.CommissionRates", value: em.encode(e).finish() })
      };
      function eu() {
        return { moniker: "", identity: "", website: "", securityContact: "", details: "" };
      }
      let ec = {
        typeUrl: "/cosmos.staking.v1beta1.Description",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.moniker && o.uint32(10).string(e.moniker),
          "" !== e.identity && o.uint32(18).string(e.identity),
          "" !== e.website && o.uint32(26).string(e.website),
          "" !== e.securityContact && o.uint32(34).string(e.securityContact),
          "" !== e.details && o.uint32(42).string(e.details),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = eu();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.moniker = t.string();
                break;
              case 2:
                i.identity = t.string();
                break;
              case 3:
                i.website = t.string();
                break;
              case 4:
                i.securityContact = t.string();
                break;
              case 5:
                i.details = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n, i, r;
          let s = eu();
          return (
            (s.moniker = null !== (o = e.moniker) && void 0 !== o ? o : ""),
            (s.identity = null !== (t = e.identity) && void 0 !== t ? t : ""),
            (s.website = null !== (n = e.website) && void 0 !== n ? n : ""),
            (s.securityContact = null !== (i = e.securityContact) && void 0 !== i ? i : ""),
            (s.details = null !== (r = e.details) && void 0 !== r ? r : ""),
            s
          );
        },
        fromAmino: e => ({ moniker: e.moniker, identity: e.identity, website: e.website, securityContact: e.security_contact, details: e.details }),
        toAmino(e) {
          let o = {};
          return (
            (o.moniker = e.moniker), (o.identity = e.identity), (o.website = e.website), (o.security_contact = e.securityContact), (o.details = e.details), o
          );
        },
        fromAminoMsg: e => ec.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/Description", value: ec.toAmino(e) }),
        fromProtoMsg: e => ec.decode(e.value),
        toProto: e => ec.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmos.staking.v1beta1.Description", value: ec.encode(e).finish() })
      };
      function eg() {
        return {
          description: ec.fromPartial({}),
          commission: em.fromPartial({}),
          minSelfDelegation: "",
          delegatorAddress: "",
          validatorAddress: "",
          pubkey: void 0,
          value: void 0
        };
      }
      let ep = {
        typeUrl: "/cosmos.staking.v1beta1.MsgCreateValidator",
        encode: (e, o = y.Lt.create()) => (
          void 0 !== e.description && ec.encode(e.description, o.uint32(10).fork()).ldelim(),
          void 0 !== e.commission && em.encode(e.commission, o.uint32(18).fork()).ldelim(),
          "" !== e.minSelfDelegation && o.uint32(26).string(e.minSelfDelegation),
          "" !== e.delegatorAddress && o.uint32(34).string(e.delegatorAddress),
          "" !== e.validatorAddress && o.uint32(42).string(e.validatorAddress),
          void 0 !== e.pubkey && er.Any.encode(e.pubkey, o.uint32(50).fork()).ldelim(),
          void 0 !== e.value && ea.sN.encode(e.value, o.uint32(58).fork()).ldelim(),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = eg();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.description = ec.decode(t, t.uint32());
                break;
              case 2:
                i.commission = em.decode(t, t.uint32());
                break;
              case 3:
                i.minSelfDelegation = t.string();
                break;
              case 4:
                i.delegatorAddress = t.string();
                break;
              case 5:
                i.validatorAddress = t.string();
                break;
              case 6:
                i.pubkey = eI(t);
                break;
              case 7:
                i.value = ea.sN.decode(t, t.uint32());
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n;
          let i = eg();
          return (
            (i.description = void 0 !== e.description && null !== e.description ? ec.fromPartial(e.description) : void 0),
            (i.commission = void 0 !== e.commission && null !== e.commission ? em.fromPartial(e.commission) : void 0),
            (i.minSelfDelegation = null !== (o = e.minSelfDelegation) && void 0 !== o ? o : ""),
            (i.delegatorAddress = null !== (t = e.delegatorAddress) && void 0 !== t ? t : ""),
            (i.validatorAddress = null !== (n = e.validatorAddress) && void 0 !== n ? n : ""),
            (i.pubkey = void 0 !== e.pubkey && null !== e.pubkey ? er.Any.fromPartial(e.pubkey) : void 0),
            (i.value = void 0 !== e.value && null !== e.value ? ea.sN.fromPartial(e.value) : void 0),
            i
          );
        },
        fromAmino: e => ({
          description: (null == e ? void 0 : e.description) ? ec.fromAmino(e.description) : void 0,
          commission: (null == e ? void 0 : e.commission) ? em.fromAmino(e.commission) : void 0,
          minSelfDelegation: e.min_self_delegation,
          delegatorAddress: e.delegator_address,
          validatorAddress: e.validator_address,
          pubkey: (0, d.encodeBech32Pubkey)({ type: "tendermint/PubKeySecp256k1", value: (0, u.toBase64)(e.pubkey.value) }, "cosmos"),
          value: (null == e ? void 0 : e.value) ? ea.sN.fromAmino(e.value) : void 0
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.description = e.description ? ec.toAmino(e.description) : void 0),
            (o.commission = e.commission ? em.toAmino(e.commission) : void 0),
            (o.min_self_delegation = e.minSelfDelegation),
            (o.delegator_address = e.delegatorAddress),
            (o.validator_address = e.validatorAddress),
            (o.pubkey = e.pubkey
              ? { typeUrl: "/cosmos.crypto.secp256k1.PubKey", value: (0, u.fromBase64)((0, d.decodeBech32Pubkey)(e.pubkey).value) }
              : void 0),
            (o.value = e.value ? ea.sN.toAmino(e.value) : void 0),
            o
          );
        },
        fromAminoMsg: e => ep.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/MsgCreateValidator", value: ep.toAmino(e) }),
        fromProtoMsg: e => ep.decode(e.value),
        toProto: e => ep.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmos.staking.v1beta1.MsgCreateValidator", value: ep.encode(e).finish() })
      };
      function ef() {
        return { description: ec.fromPartial({}), validatorAddress: "", commissionRate: "", minSelfDelegation: "" };
      }
      let ev = {
        typeUrl: "/cosmos.staking.v1beta1.MsgEditValidator",
        encode: (e, o = y.Lt.create()) => (
          void 0 !== e.description && ec.encode(e.description, o.uint32(10).fork()).ldelim(),
          "" !== e.validatorAddress && o.uint32(18).string(e.validatorAddress),
          "" !== e.commissionRate && o.uint32(26).string(c.Decimal.fromUserInput(e.commissionRate, 18).atomics),
          "" !== e.minSelfDelegation && o.uint32(34).string(e.minSelfDelegation),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = ef();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.description = ec.decode(t, t.uint32());
                break;
              case 2:
                i.validatorAddress = t.string();
                break;
              case 3:
                i.commissionRate = c.Decimal.fromAtomics(t.string(), 18).toString();
                break;
              case 4:
                i.minSelfDelegation = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n;
          let i = ef();
          return (
            (i.description = void 0 !== e.description && null !== e.description ? ec.fromPartial(e.description) : void 0),
            (i.validatorAddress = null !== (o = e.validatorAddress) && void 0 !== o ? o : ""),
            (i.commissionRate = null !== (t = e.commissionRate) && void 0 !== t ? t : ""),
            (i.minSelfDelegation = null !== (n = e.minSelfDelegation) && void 0 !== n ? n : ""),
            i
          );
        },
        fromAmino: e => ({
          description: (null == e ? void 0 : e.description) ? ec.fromAmino(e.description) : void 0,
          validatorAddress: e.validator_address,
          commissionRate: e.commission_rate,
          minSelfDelegation: e.min_self_delegation
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.description = e.description ? ec.toAmino(e.description) : void 0),
            (o.validator_address = e.validatorAddress),
            (o.commission_rate = e.commissionRate),
            (o.min_self_delegation = e.minSelfDelegation),
            o
          );
        },
        fromAminoMsg: e => ev.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/MsgEditValidator", value: ev.toAmino(e) }),
        fromProtoMsg: e => ev.decode(e.value),
        toProto: e => ev.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmos.staking.v1beta1.MsgEditValidator", value: ev.encode(e).finish() })
      };
      function eA() {
        return { delegatorAddress: "", validatorAddress: "", amount: void 0 };
      }
      let ek = {
        typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.delegatorAddress && o.uint32(10).string(e.delegatorAddress),
          "" !== e.validatorAddress && o.uint32(18).string(e.validatorAddress),
          void 0 !== e.amount && ea.sN.encode(e.amount, o.uint32(26).fork()).ldelim(),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = eA();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.delegatorAddress = t.string();
                break;
              case 2:
                i.validatorAddress = t.string();
                break;
              case 3:
                i.amount = ea.sN.decode(t, t.uint32());
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t;
          let n = eA();
          return (
            (n.delegatorAddress = null !== (o = e.delegatorAddress) && void 0 !== o ? o : ""),
            (n.validatorAddress = null !== (t = e.validatorAddress) && void 0 !== t ? t : ""),
            (n.amount = void 0 !== e.amount && null !== e.amount ? ea.sN.fromPartial(e.amount) : void 0),
            n
          );
        },
        fromAmino: e => ({
          delegatorAddress: e.delegator_address,
          validatorAddress: e.validator_address,
          amount: (null == e ? void 0 : e.amount) ? ea.sN.fromAmino(e.amount) : void 0
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.delegator_address = e.delegatorAddress), (o.validator_address = e.validatorAddress), (o.amount = e.amount ? ea.sN.toAmino(e.amount) : void 0), o
          );
        },
        fromAminoMsg: e => ek.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/MsgDelegate", value: ek.toAmino(e) }),
        fromProtoMsg: e => ek.decode(e.value),
        toProto: e => ek.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmos.staking.v1beta1.MsgDelegate", value: ek.encode(e).finish() })
      };
      function ey() {
        return { delegatorAddress: "", validatorSrcAddress: "", validatorDstAddress: "", amount: void 0 };
      }
      let eh = {
        typeUrl: "/cosmos.staking.v1beta1.MsgBeginRedelegate",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.delegatorAddress && o.uint32(10).string(e.delegatorAddress),
          "" !== e.validatorSrcAddress && o.uint32(18).string(e.validatorSrcAddress),
          "" !== e.validatorDstAddress && o.uint32(26).string(e.validatorDstAddress),
          void 0 !== e.amount && ea.sN.encode(e.amount, o.uint32(34).fork()).ldelim(),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = ey();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.delegatorAddress = t.string();
                break;
              case 2:
                i.validatorSrcAddress = t.string();
                break;
              case 3:
                i.validatorDstAddress = t.string();
                break;
              case 4:
                i.amount = ea.sN.decode(t, t.uint32());
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n;
          let i = ey();
          return (
            (i.delegatorAddress = null !== (o = e.delegatorAddress) && void 0 !== o ? o : ""),
            (i.validatorSrcAddress = null !== (t = e.validatorSrcAddress) && void 0 !== t ? t : ""),
            (i.validatorDstAddress = null !== (n = e.validatorDstAddress) && void 0 !== n ? n : ""),
            (i.amount = void 0 !== e.amount && null !== e.amount ? ea.sN.fromPartial(e.amount) : void 0),
            i
          );
        },
        fromAmino: e => ({
          delegatorAddress: e.delegator_address,
          validatorSrcAddress: e.validator_src_address,
          validatorDstAddress: e.validator_dst_address,
          amount: (null == e ? void 0 : e.amount) ? ea.sN.fromAmino(e.amount) : void 0
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.delegator_address = e.delegatorAddress),
            (o.validator_src_address = e.validatorSrcAddress),
            (o.validator_dst_address = e.validatorDstAddress),
            (o.amount = e.amount ? ea.sN.toAmino(e.amount) : void 0),
            o
          );
        },
        fromAminoMsg: e => eh.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/MsgBeginRedelegate", value: eh.toAmino(e) }),
        fromProtoMsg: e => eh.decode(e.value),
        toProto: e => eh.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmos.staking.v1beta1.MsgBeginRedelegate", value: eh.encode(e).finish() })
      };
      function eb() {
        return { delegatorAddress: "", validatorAddress: "", amount: void 0 };
      }
      let eP = {
          typeUrl: "/cosmos.staking.v1beta1.MsgUndelegate",
          encode: (e, o = y.Lt.create()) => (
            "" !== e.delegatorAddress && o.uint32(10).string(e.delegatorAddress),
            "" !== e.validatorAddress && o.uint32(18).string(e.validatorAddress),
            void 0 !== e.amount && ea.sN.encode(e.amount, o.uint32(26).fork()).ldelim(),
            o
          ),
          decode(e, o) {
            let t = e instanceof y.oP ? e : new y.oP(e),
              n = void 0 === o ? t.len : t.pos + o,
              i = eb();
            for (; t.pos < n; ) {
              let e = t.uint32();
              switch (e >>> 3) {
                case 1:
                  i.delegatorAddress = t.string();
                  break;
                case 2:
                  i.validatorAddress = t.string();
                  break;
                case 3:
                  i.amount = ea.sN.decode(t, t.uint32());
                  break;
                default:
                  t.skipType(7 & e);
              }
            }
            return i;
          },
          fromPartial(e) {
            var o, t;
            let n = eb();
            return (
              (n.delegatorAddress = null !== (o = e.delegatorAddress) && void 0 !== o ? o : ""),
              (n.validatorAddress = null !== (t = e.validatorAddress) && void 0 !== t ? t : ""),
              (n.amount = void 0 !== e.amount && null !== e.amount ? ea.sN.fromPartial(e.amount) : void 0),
              n
            );
          },
          fromAmino: e => ({
            delegatorAddress: e.delegator_address,
            validatorAddress: e.validator_address,
            amount: (null == e ? void 0 : e.amount) ? ea.sN.fromAmino(e.amount) : void 0
          }),
          toAmino(e) {
            let o = {};
            return (
              (o.delegator_address = e.delegatorAddress),
              (o.validator_address = e.validatorAddress),
              (o.amount = e.amount ? ea.sN.toAmino(e.amount) : void 0),
              o
            );
          },
          fromAminoMsg: e => eP.fromAmino(e.value),
          toAminoMsg: e => ({ type: "cosmos-sdk/MsgUndelegate", value: eP.toAmino(e) }),
          fromProtoMsg: e => eP.decode(e.value),
          toProto: e => eP.encode(e).finish(),
          toProtoMsg: e => ({ typeUrl: "/cosmos.staking.v1beta1.MsgUndelegate", value: eP.encode(e).finish() })
        },
        eI = e => {
          let o = e instanceof y.oP ? e : new y.oP(e),
            t = er.Any.decode(o, o.uint32());
          return t.typeUrl, t;
        },
        eM = {
          "/cosmos.staking.v1beta1.MsgCreateValidator": { aminoType: "cosmos-sdk/MsgCreateValidator", toAmino: ep.toAmino, fromAmino: ep.fromAmino },
          "/cosmos.staking.v1beta1.MsgEditValidator": { aminoType: "cosmos-sdk/MsgEditValidator", toAmino: ev.toAmino, fromAmino: ev.fromAmino },
          "/cosmos.staking.v1beta1.MsgDelegate": { aminoType: "cosmos-sdk/MsgDelegate", toAmino: ek.toAmino, fromAmino: ek.fromAmino },
          "/cosmos.staking.v1beta1.MsgBeginRedelegate": { aminoType: "cosmos-sdk/MsgBeginRedelegate", toAmino: eh.toAmino, fromAmino: eh.fromAmino },
          "/cosmos.staking.v1beta1.MsgUndelegate": { aminoType: "cosmos-sdk/MsgUndelegate", toAmino: eP.toAmino, fromAmino: eP.fromAmino }
        },
        ew = [
          ["/cosmos.staking.v1beta1.MsgCreateValidator", ep],
          ["/cosmos.staking.v1beta1.MsgEditValidator", ev],
          ["/cosmos.staking.v1beta1.MsgDelegate", ek],
          ["/cosmos.staking.v1beta1.MsgBeginRedelegate", eh],
          ["/cosmos.staking.v1beta1.MsgUndelegate", eP]
        ];
      function e_() {
        return { name: "", time: void 0, height: BigInt(0), info: "", upgradedClientState: void 0 };
      }
      let eS = {
        typeUrl: "/cosmos.upgrade.v1beta1.Plan",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.name && o.uint32(10).string(e.name),
          void 0 !== e.time && es.Timestamp.encode((0, el.Uq)(e.time), o.uint32(18).fork()).ldelim(),
          e.height !== BigInt(0) && o.uint32(24).int64(e.height),
          "" !== e.info && o.uint32(34).string(e.info),
          void 0 !== e.upgradedClientState && er.Any.encode(e.upgradedClientState, o.uint32(42).fork()).ldelim(),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = e_();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.name = t.string();
                break;
              case 2:
                i.time = (0, el.Ol)(es.Timestamp.decode(t, t.uint32()));
                break;
              case 3:
                i.height = t.int64();
                break;
              case 4:
                i.info = t.string();
                break;
              case 5:
                i.upgradedClientState = er.Any.decode(t, t.uint32());
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n;
          let i = e_();
          return (
            (i.name = null !== (o = e.name) && void 0 !== o ? o : ""),
            (i.time = null !== (t = e.time) && void 0 !== t ? t : void 0),
            (i.height = void 0 !== e.height && null !== e.height ? BigInt(e.height.toString()) : BigInt(0)),
            (i.info = null !== (n = e.info) && void 0 !== n ? n : ""),
            (i.upgradedClientState = void 0 !== e.upgradedClientState && null !== e.upgradedClientState ? er.Any.fromPartial(e.upgradedClientState) : void 0),
            i
          );
        },
        fromAmino: e => ({
          name: e.name,
          time: e.time,
          height: BigInt(e.height),
          info: e.info,
          upgradedClientState: (null == e ? void 0 : e.upgraded_client_state) ? er.Any.fromAmino(e.upgraded_client_state) : void 0
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.name = e.name),
            (o.time = e.time),
            (o.height = e.height ? e.height.toString() : void 0),
            (o.info = e.info),
            (o.upgraded_client_state = e.upgradedClientState ? er.Any.toAmino(e.upgradedClientState) : void 0),
            o
          );
        },
        fromAminoMsg: e => eS.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/Plan", value: eS.toAmino(e) }),
        fromProtoMsg: e => eS.decode(e.value),
        toProto: e => eS.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmos.upgrade.v1beta1.Plan", value: eS.encode(e).finish() })
      };
      function ex() {
        return { authority: "", plan: eS.fromPartial({}) };
      }
      let eU = {
        typeUrl: "/cosmos.upgrade.v1beta1.MsgSoftwareUpgrade",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.authority && o.uint32(10).string(e.authority), void 0 !== e.plan && eS.encode(e.plan, o.uint32(18).fork()).ldelim(), o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = ex();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.authority = t.string();
                break;
              case 2:
                i.plan = eS.decode(t, t.uint32());
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o;
          let t = ex();
          return (
            (t.authority = null !== (o = e.authority) && void 0 !== o ? o : ""),
            (t.plan = void 0 !== e.plan && null !== e.plan ? eS.fromPartial(e.plan) : void 0),
            t
          );
        },
        fromAmino: e => ({ authority: e.authority, plan: (null == e ? void 0 : e.plan) ? eS.fromAmino(e.plan) : void 0 }),
        toAmino(e) {
          let o = {};
          return (o.authority = e.authority), (o.plan = e.plan ? eS.toAmino(e.plan) : void 0), o;
        },
        fromAminoMsg: e => eU.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/MsgSoftwareUpgrade", value: eU.toAmino(e) }),
        fromProtoMsg: e => eU.decode(e.value),
        toProto: e => eU.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmos.upgrade.v1beta1.MsgSoftwareUpgrade", value: eU.encode(e).finish() })
      };
      function eT() {
        return { authority: "" };
      }
      let eD = {
          typeUrl: "/cosmos.upgrade.v1beta1.MsgCancelUpgrade",
          encode: (e, o = y.Lt.create()) => ("" !== e.authority && o.uint32(10).string(e.authority), o),
          decode(e, o) {
            let t = e instanceof y.oP ? e : new y.oP(e),
              n = void 0 === o ? t.len : t.pos + o,
              i = eT();
            for (; t.pos < n; ) {
              let e = t.uint32();
              e >>> 3 == 1 ? (i.authority = t.string()) : t.skipType(7 & e);
            }
            return i;
          },
          fromPartial(e) {
            var o;
            let t = eT();
            return (t.authority = null !== (o = e.authority) && void 0 !== o ? o : ""), t;
          },
          fromAmino: e => ({ authority: e.authority }),
          toAmino(e) {
            let o = {};
            return (o.authority = e.authority), o;
          },
          fromAminoMsg: e => eD.fromAmino(e.value),
          toAminoMsg: e => ({ type: "cosmos-sdk/MsgCancelUpgrade", value: eD.toAmino(e) }),
          fromProtoMsg: e => eD.decode(e.value),
          toProto: e => eD.encode(e).finish(),
          toProtoMsg: e => ({ typeUrl: "/cosmos.upgrade.v1beta1.MsgCancelUpgrade", value: eD.encode(e).finish() })
        },
        eC = {
          "/cosmos.upgrade.v1beta1.MsgSoftwareUpgrade": { aminoType: "cosmos-sdk/MsgSoftwareUpgrade", toAmino: eU.toAmino, fromAmino: eU.fromAmino },
          "/cosmos.upgrade.v1beta1.MsgCancelUpgrade": { aminoType: "cosmos-sdk/MsgCancelUpgrade", toAmino: eD.toAmino, fromAmino: eD.fromAmino }
        },
        eB = [
          ["/cosmos.upgrade.v1beta1.MsgSoftwareUpgrade", eU],
          ["/cosmos.upgrade.v1beta1.MsgCancelUpgrade", eD]
        ],
        eN = Object.assign(Object.assign(Object.assign({}, en), eM), eC),
        eE = [...ei, ...ew, ...eB];
      function eO() {
        return { permission: 0, address: "", addresses: [] };
      }
      ((n = s || (s = {}))[(n.ACCESS_TYPE_UNSPECIFIED = 0)] = "ACCESS_TYPE_UNSPECIFIED"),
        (n[(n.ACCESS_TYPE_NOBODY = 1)] = "ACCESS_TYPE_NOBODY"),
        (n[(n.ACCESS_TYPE_ONLY_ADDRESS = 2)] = "ACCESS_TYPE_ONLY_ADDRESS"),
        (n[(n.ACCESS_TYPE_EVERYBODY = 3)] = "ACCESS_TYPE_EVERYBODY"),
        (n[(n.ACCESS_TYPE_ANY_OF_ADDRESSES = 4)] = "ACCESS_TYPE_ANY_OF_ADDRESSES"),
        (n[(n.UNRECOGNIZED = -1)] = "UNRECOGNIZED"),
        ((i = a || (a = {}))[(i.CONTRACT_CODE_HISTORY_OPERATION_TYPE_UNSPECIFIED = 0)] = "CONTRACT_CODE_HISTORY_OPERATION_TYPE_UNSPECIFIED"),
        (i[(i.CONTRACT_CODE_HISTORY_OPERATION_TYPE_INIT = 1)] = "CONTRACT_CODE_HISTORY_OPERATION_TYPE_INIT"),
        (i[(i.CONTRACT_CODE_HISTORY_OPERATION_TYPE_MIGRATE = 2)] = "CONTRACT_CODE_HISTORY_OPERATION_TYPE_MIGRATE"),
        (i[(i.CONTRACT_CODE_HISTORY_OPERATION_TYPE_GENESIS = 3)] = "CONTRACT_CODE_HISTORY_OPERATION_TYPE_GENESIS"),
        (i[(i.UNRECOGNIZED = -1)] = "UNRECOGNIZED");
      let eR = {
        typeUrl: "/cosmwasm.wasm.v1.AccessConfig",
        encode(e, o = y.Lt.create()) {
          for (let t of (0 !== e.permission && o.uint32(8).int32(e.permission), "" !== e.address && o.uint32(18).string(e.address), e.addresses))
            o.uint32(26).string(t);
          return o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = eO();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.permission = t.int32();
                break;
              case 2:
                i.address = t.string();
                break;
              case 3:
                i.addresses.push(t.string());
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n;
          let i = eO();
          return (
            (i.permission = null !== (o = e.permission) && void 0 !== o ? o : 0),
            (i.address = null !== (t = e.address) && void 0 !== t ? t : ""),
            (i.addresses = (null === (n = e.addresses) || void 0 === n ? void 0 : n.map(e => e)) || []),
            i
          );
        },
        fromAmino: e => ({
          permission: (0, el.DM)(e.permission)
            ? (function (e) {
                switch (e) {
                  case 0:
                  case "ACCESS_TYPE_UNSPECIFIED":
                    return s.ACCESS_TYPE_UNSPECIFIED;
                  case 1:
                  case "ACCESS_TYPE_NOBODY":
                    return s.ACCESS_TYPE_NOBODY;
                  case 2:
                  case "ACCESS_TYPE_ONLY_ADDRESS":
                    return s.ACCESS_TYPE_ONLY_ADDRESS;
                  case 3:
                  case "ACCESS_TYPE_EVERYBODY":
                    return s.ACCESS_TYPE_EVERYBODY;
                  case 4:
                  case "ACCESS_TYPE_ANY_OF_ADDRESSES":
                    return s.ACCESS_TYPE_ANY_OF_ADDRESSES;
                  default:
                    return s.UNRECOGNIZED;
                }
              })(e.permission)
            : -1,
          address: e.address,
          addresses: Array.isArray(null == e ? void 0 : e.addresses) ? e.addresses.map(e => e) : []
        }),
        toAmino(e) {
          let o = {};
          return (o.permission = e.permission), (o.address = e.address), e.addresses ? (o.addresses = e.addresses.map(e => e)) : (o.addresses = []), o;
        },
        fromAminoMsg: e => eR.fromAmino(e.value),
        toAminoMsg: e => ({ type: "wasm/AccessConfig", value: eR.toAmino(e) }),
        fromProtoMsg: e => eR.decode(e.value),
        toProto: e => eR.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmwasm.wasm.v1.AccessConfig", value: eR.encode(e).finish() })
      };
      function eL() {
        return { sender: "", wasmByteCode: new Uint8Array(), instantiatePermission: eR.fromPartial({}) };
      }
      let ej = {
        typeUrl: "/cosmwasm.wasm.v1.MsgStoreCode",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.sender && o.uint32(10).string(e.sender),
          0 !== e.wasmByteCode.length && o.uint32(18).bytes(e.wasmByteCode),
          void 0 !== e.instantiatePermission && eR.encode(e.instantiatePermission, o.uint32(42).fork()).ldelim(),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = eL();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.sender = t.string();
                break;
              case 2:
                i.wasmByteCode = t.bytes();
                break;
              case 5:
                i.instantiatePermission = eR.decode(t, t.uint32());
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t;
          let n = eL();
          return (
            (n.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (n.wasmByteCode = null !== (t = e.wasmByteCode) && void 0 !== t ? t : new Uint8Array()),
            (n.instantiatePermission =
              void 0 !== e.instantiatePermission && null !== e.instantiatePermission ? eR.fromPartial(e.instantiatePermission) : void 0),
            n
          );
        },
        fromAmino: e => ({
          sender: e.sender,
          wasmByteCode: (0, u.fromBase64)(e.wasm_byte_code),
          instantiatePermission: (null == e ? void 0 : e.instantiate_permission) ? eR.fromAmino(e.instantiate_permission) : void 0
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.sender = e.sender),
            (o.wasm_byte_code = e.wasmByteCode ? (0, u.toBase64)(e.wasmByteCode) : void 0),
            (o.instantiate_permission = e.instantiatePermission ? eR.toAmino(e.instantiatePermission) : void 0),
            o
          );
        },
        fromAminoMsg: e => ej.fromAmino(e.value),
        toAminoMsg: e => ({ type: "wasm/MsgStoreCode", value: ej.toAmino(e) }),
        fromProtoMsg: e => ej.decode(e.value),
        toProto: e => ej.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmwasm.wasm.v1.MsgStoreCode", value: ej.encode(e).finish() })
      };
      function eq() {
        return { sender: "", admin: "", codeId: BigInt(0), label: "", msg: new Uint8Array(), funds: [] };
      }
      let e$ = {
        typeUrl: "/cosmwasm.wasm.v1.MsgInstantiateContract",
        encode(e, o = y.Lt.create()) {
          for (let t of ("" !== e.sender && o.uint32(10).string(e.sender),
          "" !== e.admin && o.uint32(18).string(e.admin),
          e.codeId !== BigInt(0) && o.uint32(24).uint64(e.codeId),
          "" !== e.label && o.uint32(34).string(e.label),
          0 !== e.msg.length && o.uint32(42).bytes(e.msg),
          e.funds))
            ea.sN.encode(t, o.uint32(50).fork()).ldelim();
          return o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = eq();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.sender = t.string();
                break;
              case 2:
                i.admin = t.string();
                break;
              case 3:
                i.codeId = t.uint64();
                break;
              case 4:
                i.label = t.string();
                break;
              case 5:
                i.msg = t.bytes();
                break;
              case 6:
                i.funds.push(ea.sN.decode(t, t.uint32()));
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n, i, r;
          let s = eq();
          return (
            (s.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (s.admin = null !== (t = e.admin) && void 0 !== t ? t : ""),
            (s.codeId = void 0 !== e.codeId && null !== e.codeId ? BigInt(e.codeId.toString()) : BigInt(0)),
            (s.label = null !== (n = e.label) && void 0 !== n ? n : ""),
            (s.msg = null !== (i = e.msg) && void 0 !== i ? i : new Uint8Array()),
            (s.funds = (null === (r = e.funds) || void 0 === r ? void 0 : r.map(e => ea.sN.fromPartial(e))) || []),
            s
          );
        },
        fromAmino: e => ({
          sender: e.sender,
          admin: e.admin,
          codeId: BigInt(e.code_id),
          label: e.label,
          msg: (0, u.toUtf8)(JSON.stringify(e.msg)),
          funds: Array.isArray(null == e ? void 0 : e.funds) ? e.funds.map(e => ea.sN.fromAmino(e)) : []
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.sender = e.sender),
            (o.admin = e.admin),
            (o.code_id = e.codeId ? e.codeId.toString() : void 0),
            (o.label = e.label),
            (o.msg = e.msg ? JSON.parse((0, u.fromUtf8)(e.msg)) : void 0),
            e.funds ? (o.funds = e.funds.map(e => (e ? ea.sN.toAmino(e) : void 0))) : (o.funds = []),
            o
          );
        },
        fromAminoMsg: e => e$.fromAmino(e.value),
        toAminoMsg: e => ({ type: "wasm/MsgInstantiateContract", value: e$.toAmino(e) }),
        fromProtoMsg: e => e$.decode(e.value),
        toProto: e => e$.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmwasm.wasm.v1.MsgInstantiateContract", value: e$.encode(e).finish() })
      };
      function eF() {
        return { sender: "", admin: "", codeId: BigInt(0), label: "", msg: new Uint8Array(), funds: [], salt: new Uint8Array(), fixMsg: !1 };
      }
      let eV = {
        typeUrl: "/cosmwasm.wasm.v1.MsgInstantiateContract2",
        encode(e, o = y.Lt.create()) {
          for (let t of ("" !== e.sender && o.uint32(10).string(e.sender),
          "" !== e.admin && o.uint32(18).string(e.admin),
          e.codeId !== BigInt(0) && o.uint32(24).uint64(e.codeId),
          "" !== e.label && o.uint32(34).string(e.label),
          0 !== e.msg.length && o.uint32(42).bytes(e.msg),
          e.funds))
            ea.sN.encode(t, o.uint32(50).fork()).ldelim();
          return 0 !== e.salt.length && o.uint32(58).bytes(e.salt), !0 === e.fixMsg && o.uint32(64).bool(e.fixMsg), o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = eF();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.sender = t.string();
                break;
              case 2:
                i.admin = t.string();
                break;
              case 3:
                i.codeId = t.uint64();
                break;
              case 4:
                i.label = t.string();
                break;
              case 5:
                i.msg = t.bytes();
                break;
              case 6:
                i.funds.push(ea.sN.decode(t, t.uint32()));
                break;
              case 7:
                i.salt = t.bytes();
                break;
              case 8:
                i.fixMsg = t.bool();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n, i, r, s, a;
          let l = eF();
          return (
            (l.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (l.admin = null !== (t = e.admin) && void 0 !== t ? t : ""),
            (l.codeId = void 0 !== e.codeId && null !== e.codeId ? BigInt(e.codeId.toString()) : BigInt(0)),
            (l.label = null !== (n = e.label) && void 0 !== n ? n : ""),
            (l.msg = null !== (i = e.msg) && void 0 !== i ? i : new Uint8Array()),
            (l.funds = (null === (r = e.funds) || void 0 === r ? void 0 : r.map(e => ea.sN.fromPartial(e))) || []),
            (l.salt = null !== (s = e.salt) && void 0 !== s ? s : new Uint8Array()),
            (l.fixMsg = null !== (a = e.fixMsg) && void 0 !== a && a),
            l
          );
        },
        fromAmino: e => ({
          sender: e.sender,
          admin: e.admin,
          codeId: BigInt(e.code_id),
          label: e.label,
          msg: (0, u.toUtf8)(JSON.stringify(e.msg)),
          funds: Array.isArray(null == e ? void 0 : e.funds) ? e.funds.map(e => ea.sN.fromAmino(e)) : [],
          salt: e.salt,
          fixMsg: e.fix_msg
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.sender = e.sender),
            (o.admin = e.admin),
            (o.code_id = e.codeId ? e.codeId.toString() : void 0),
            (o.label = e.label),
            (o.msg = e.msg ? JSON.parse((0, u.fromUtf8)(e.msg)) : void 0),
            e.funds ? (o.funds = e.funds.map(e => (e ? ea.sN.toAmino(e) : void 0))) : (o.funds = []),
            (o.salt = e.salt),
            (o.fix_msg = e.fixMsg),
            o
          );
        },
        fromAminoMsg: e => eV.fromAmino(e.value),
        toAminoMsg: e => ({ type: "wasm/MsgInstantiateContract2", value: eV.toAmino(e) }),
        fromProtoMsg: e => eV.decode(e.value),
        toProto: e => eV.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmwasm.wasm.v1.MsgInstantiateContract2", value: eV.encode(e).finish() })
      };
      function eZ() {
        return { sender: "", contract: "", msg: new Uint8Array(), funds: [] };
      }
      let eG = {
        typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
        encode(e, o = y.Lt.create()) {
          for (let t of ("" !== e.sender && o.uint32(10).string(e.sender),
          "" !== e.contract && o.uint32(18).string(e.contract),
          0 !== e.msg.length && o.uint32(26).bytes(e.msg),
          e.funds))
            ea.sN.encode(t, o.uint32(42).fork()).ldelim();
          return o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = eZ();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.sender = t.string();
                break;
              case 2:
                i.contract = t.string();
                break;
              case 3:
                i.msg = t.bytes();
                break;
              case 5:
                i.funds.push(ea.sN.decode(t, t.uint32()));
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n, i;
          let r = eZ();
          return (
            (r.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (r.contract = null !== (t = e.contract) && void 0 !== t ? t : ""),
            (r.msg = null !== (n = e.msg) && void 0 !== n ? n : new Uint8Array()),
            (r.funds = (null === (i = e.funds) || void 0 === i ? void 0 : i.map(e => ea.sN.fromPartial(e))) || []),
            r
          );
        },
        fromAmino: e => ({
          sender: e.sender,
          contract: e.contract,
          msg: (0, u.toUtf8)(JSON.stringify(e.msg)),
          funds: Array.isArray(null == e ? void 0 : e.funds) ? e.funds.map(e => ea.sN.fromAmino(e)) : []
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.sender = e.sender),
            (o.contract = e.contract),
            (o.msg = e.msg ? JSON.parse((0, u.fromUtf8)(e.msg)) : void 0),
            e.funds ? (o.funds = e.funds.map(e => (e ? ea.sN.toAmino(e) : void 0))) : (o.funds = []),
            o
          );
        },
        fromAminoMsg: e => eG.fromAmino(e.value),
        toAminoMsg: e => ({ type: "wasm/MsgExecuteContract", value: eG.toAmino(e) }),
        fromProtoMsg: e => eG.decode(e.value),
        toProto: e => eG.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract", value: eG.encode(e).finish() })
      };
      function eH() {
        return { sender: "", contract: "", codeId: BigInt(0), msg: new Uint8Array() };
      }
      let ez = {
        typeUrl: "/cosmwasm.wasm.v1.MsgMigrateContract",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.sender && o.uint32(10).string(e.sender),
          "" !== e.contract && o.uint32(18).string(e.contract),
          e.codeId !== BigInt(0) && o.uint32(24).uint64(e.codeId),
          0 !== e.msg.length && o.uint32(34).bytes(e.msg),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = eH();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.sender = t.string();
                break;
              case 2:
                i.contract = t.string();
                break;
              case 3:
                i.codeId = t.uint64();
                break;
              case 4:
                i.msg = t.bytes();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n;
          let i = eH();
          return (
            (i.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (i.contract = null !== (t = e.contract) && void 0 !== t ? t : ""),
            (i.codeId = void 0 !== e.codeId && null !== e.codeId ? BigInt(e.codeId.toString()) : BigInt(0)),
            (i.msg = null !== (n = e.msg) && void 0 !== n ? n : new Uint8Array()),
            i
          );
        },
        fromAmino: e => ({ sender: e.sender, contract: e.contract, codeId: BigInt(e.code_id), msg: (0, u.toUtf8)(JSON.stringify(e.msg)) }),
        toAmino(e) {
          let o = {};
          return (
            (o.sender = e.sender),
            (o.contract = e.contract),
            (o.code_id = e.codeId ? e.codeId.toString() : void 0),
            (o.msg = e.msg ? JSON.parse((0, u.fromUtf8)(e.msg)) : void 0),
            o
          );
        },
        fromAminoMsg: e => ez.fromAmino(e.value),
        toAminoMsg: e => ({ type: "wasm/MsgMigrateContract", value: ez.toAmino(e) }),
        fromProtoMsg: e => ez.decode(e.value),
        toProto: e => ez.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmwasm.wasm.v1.MsgMigrateContract", value: ez.encode(e).finish() })
      };
      function eW() {
        return { sender: "", newAdmin: "", contract: "" };
      }
      let eY = {
        typeUrl: "/cosmwasm.wasm.v1.MsgUpdateAdmin",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.sender && o.uint32(10).string(e.sender),
          "" !== e.newAdmin && o.uint32(18).string(e.newAdmin),
          "" !== e.contract && o.uint32(26).string(e.contract),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = eW();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.sender = t.string();
                break;
              case 2:
                i.newAdmin = t.string();
                break;
              case 3:
                i.contract = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n;
          let i = eW();
          return (
            (i.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (i.newAdmin = null !== (t = e.newAdmin) && void 0 !== t ? t : ""),
            (i.contract = null !== (n = e.contract) && void 0 !== n ? n : ""),
            i
          );
        },
        fromAmino: e => ({ sender: e.sender, newAdmin: e.new_admin, contract: e.contract }),
        toAmino(e) {
          let o = {};
          return (o.sender = e.sender), (o.new_admin = e.newAdmin), (o.contract = e.contract), o;
        },
        fromAminoMsg: e => eY.fromAmino(e.value),
        toAminoMsg: e => ({ type: "wasm/MsgUpdateAdmin", value: eY.toAmino(e) }),
        fromProtoMsg: e => eY.decode(e.value),
        toProto: e => eY.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmwasm.wasm.v1.MsgUpdateAdmin", value: eY.encode(e).finish() })
      };
      function eJ() {
        return { sender: "", contract: "" };
      }
      let eK = {
        typeUrl: "/cosmwasm.wasm.v1.MsgClearAdmin",
        encode: (e, o = y.Lt.create()) => ("" !== e.sender && o.uint32(10).string(e.sender), "" !== e.contract && o.uint32(26).string(e.contract), o),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = eJ();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.sender = t.string();
                break;
              case 3:
                i.contract = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t;
          let n = eJ();
          return (n.sender = null !== (o = e.sender) && void 0 !== o ? o : ""), (n.contract = null !== (t = e.contract) && void 0 !== t ? t : ""), n;
        },
        fromAmino: e => ({ sender: e.sender, contract: e.contract }),
        toAmino(e) {
          let o = {};
          return (o.sender = e.sender), (o.contract = e.contract), o;
        },
        fromAminoMsg: e => eK.fromAmino(e.value),
        toAminoMsg: e => ({ type: "wasm/MsgClearAdmin", value: eK.toAmino(e) }),
        fromProtoMsg: e => eK.decode(e.value),
        toProto: e => eK.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/cosmwasm.wasm.v1.MsgClearAdmin", value: eK.encode(e).finish() })
      };
      function eQ() {
        return { sender: "", codeId: BigInt(0), newInstantiatePermission: eR.fromPartial({}) };
      }
      let eX = {
          typeUrl: "/cosmwasm.wasm.v1.MsgUpdateInstantiateConfig",
          encode: (e, o = y.Lt.create()) => (
            "" !== e.sender && o.uint32(10).string(e.sender),
            e.codeId !== BigInt(0) && o.uint32(16).uint64(e.codeId),
            void 0 !== e.newInstantiatePermission && eR.encode(e.newInstantiatePermission, o.uint32(26).fork()).ldelim(),
            o
          ),
          decode(e, o) {
            let t = e instanceof y.oP ? e : new y.oP(e),
              n = void 0 === o ? t.len : t.pos + o,
              i = eQ();
            for (; t.pos < n; ) {
              let e = t.uint32();
              switch (e >>> 3) {
                case 1:
                  i.sender = t.string();
                  break;
                case 2:
                  i.codeId = t.uint64();
                  break;
                case 3:
                  i.newInstantiatePermission = eR.decode(t, t.uint32());
                  break;
                default:
                  t.skipType(7 & e);
              }
            }
            return i;
          },
          fromPartial(e) {
            var o;
            let t = eQ();
            return (
              (t.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
              (t.codeId = void 0 !== e.codeId && null !== e.codeId ? BigInt(e.codeId.toString()) : BigInt(0)),
              (t.newInstantiatePermission =
                void 0 !== e.newInstantiatePermission && null !== e.newInstantiatePermission ? eR.fromPartial(e.newInstantiatePermission) : void 0),
              t
            );
          },
          fromAmino: e => ({
            sender: e.sender,
            codeId: BigInt(e.code_id),
            newInstantiatePermission: (null == e ? void 0 : e.new_instantiate_permission) ? eR.fromAmino(e.new_instantiate_permission) : void 0
          }),
          toAmino(e) {
            let o = {};
            return (
              (o.sender = e.sender),
              (o.code_id = e.codeId ? e.codeId.toString() : void 0),
              (o.new_instantiate_permission = e.newInstantiatePermission ? eR.toAmino(e.newInstantiatePermission) : void 0),
              o
            );
          },
          fromAminoMsg: e => eX.fromAmino(e.value),
          toAminoMsg: e => ({ type: "wasm/MsgUpdateInstantiateConfig", value: eX.toAmino(e) }),
          fromProtoMsg: e => eX.decode(e.value),
          toProto: e => eX.encode(e).finish(),
          toProtoMsg: e => ({ typeUrl: "/cosmwasm.wasm.v1.MsgUpdateInstantiateConfig", value: eX.encode(e).finish() })
        },
        e0 = {
          "/cosmwasm.wasm.v1.MsgStoreCode": { aminoType: "wasm/MsgStoreCode", toAmino: ej.toAmino, fromAmino: ej.fromAmino },
          "/cosmwasm.wasm.v1.MsgInstantiateContract": { aminoType: "wasm/MsgInstantiateContract", toAmino: e$.toAmino, fromAmino: e$.fromAmino },
          "/cosmwasm.wasm.v1.MsgInstantiateContract2": { aminoType: "wasm/MsgInstantiateContract2", toAmino: eV.toAmino, fromAmino: eV.fromAmino },
          "/cosmwasm.wasm.v1.MsgExecuteContract": { aminoType: "wasm/MsgExecuteContract", toAmino: eG.toAmino, fromAmino: eG.fromAmino },
          "/cosmwasm.wasm.v1.MsgMigrateContract": { aminoType: "wasm/MsgMigrateContract", toAmino: ez.toAmino, fromAmino: ez.fromAmino },
          "/cosmwasm.wasm.v1.MsgUpdateAdmin": { aminoType: "wasm/MsgUpdateAdmin", toAmino: eY.toAmino, fromAmino: eY.fromAmino },
          "/cosmwasm.wasm.v1.MsgClearAdmin": { aminoType: "wasm/MsgClearAdmin", toAmino: eK.toAmino, fromAmino: eK.fromAmino },
          "/cosmwasm.wasm.v1.MsgUpdateInstantiateConfig": { aminoType: "wasm/MsgUpdateInstantiateConfig", toAmino: eX.toAmino, fromAmino: eX.fromAmino }
        },
        e1 = [
          ["/cosmwasm.wasm.v1.MsgStoreCode", ej],
          ["/cosmwasm.wasm.v1.MsgInstantiateContract", e$],
          ["/cosmwasm.wasm.v1.MsgInstantiateContract2", eV],
          ["/cosmwasm.wasm.v1.MsgExecuteContract", eG],
          ["/cosmwasm.wasm.v1.MsgMigrateContract", ez],
          ["/cosmwasm.wasm.v1.MsgUpdateAdmin", eY],
          ["/cosmwasm.wasm.v1.MsgClearAdmin", eK],
          ["/cosmwasm.wasm.v1.MsgUpdateInstantiateConfig", eX]
        ],
        e2 = Object.assign({}, e0),
        e3 = [...e1];
      function e4() {
        return { revisionNumber: BigInt(0), revisionHeight: BigInt(0) };
      }
      let e6 = {
        typeUrl: "/ibc.core.client.v1.Height",
        encode: (e, o = y.Lt.create()) => (
          e.revisionNumber !== BigInt(0) && o.uint32(8).uint64(e.revisionNumber), e.revisionHeight !== BigInt(0) && o.uint32(16).uint64(e.revisionHeight), o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = e4();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.revisionNumber = t.uint64();
                break;
              case 2:
                i.revisionHeight = t.uint64();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          let o = e4();
          return (
            (o.revisionNumber = void 0 !== e.revisionNumber && null !== e.revisionNumber ? BigInt(e.revisionNumber.toString()) : BigInt(0)),
            (o.revisionHeight = void 0 !== e.revisionHeight && null !== e.revisionHeight ? BigInt(e.revisionHeight.toString()) : BigInt(0)),
            o
          );
        },
        fromAmino: e => ({ revisionNumber: BigInt(e.revision_number || "0"), revisionHeight: BigInt(e.revision_height || "0") }),
        toAmino(e) {
          let o = {};
          return (
            (o.revision_number = e.revisionNumber ? e.revisionNumber.toString() : void 0),
            (o.revision_height = e.revisionHeight ? e.revisionHeight.toString() : void 0),
            o
          );
        },
        fromAminoMsg: e => e6.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/Height", value: e6.toAmino(e) }),
        fromProtoMsg: e => e6.decode(e.value),
        toProto: e => e6.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/ibc.core.client.v1.Height", value: e6.encode(e).finish() })
      };
      function e8() {
        return {
          sourcePort: "",
          sourceChannel: "",
          token: void 0,
          sender: "",
          receiver: "",
          timeoutHeight: e6.fromPartial({}),
          timeoutTimestamp: BigInt(0),
          memo: ""
        };
      }
      let e7 = {
          typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
          encode: (e, o = y.Lt.create()) => (
            "" !== e.sourcePort && o.uint32(10).string(e.sourcePort),
            "" !== e.sourceChannel && o.uint32(18).string(e.sourceChannel),
            void 0 !== e.token && ea.sN.encode(e.token, o.uint32(26).fork()).ldelim(),
            "" !== e.sender && o.uint32(34).string(e.sender),
            "" !== e.receiver && o.uint32(42).string(e.receiver),
            void 0 !== e.timeoutHeight && e6.encode(e.timeoutHeight, o.uint32(50).fork()).ldelim(),
            e.timeoutTimestamp !== BigInt(0) && o.uint32(56).uint64(e.timeoutTimestamp),
            "" !== e.memo && o.uint32(66).string(e.memo),
            o
          ),
          decode(e, o) {
            let t = e instanceof y.oP ? e : new y.oP(e),
              n = void 0 === o ? t.len : t.pos + o,
              i = e8();
            for (; t.pos < n; ) {
              let e = t.uint32();
              switch (e >>> 3) {
                case 1:
                  i.sourcePort = t.string();
                  break;
                case 2:
                  i.sourceChannel = t.string();
                  break;
                case 3:
                  i.token = ea.sN.decode(t, t.uint32());
                  break;
                case 4:
                  i.sender = t.string();
                  break;
                case 5:
                  i.receiver = t.string();
                  break;
                case 6:
                  i.timeoutHeight = e6.decode(t, t.uint32());
                  break;
                case 7:
                  i.timeoutTimestamp = t.uint64();
                  break;
                case 8:
                  i.memo = t.string();
                  break;
                default:
                  t.skipType(7 & e);
              }
            }
            return i;
          },
          fromPartial(e) {
            var o, t, n, i, r;
            let s = e8();
            return (
              (s.sourcePort = null !== (o = e.sourcePort) && void 0 !== o ? o : ""),
              (s.sourceChannel = null !== (t = e.sourceChannel) && void 0 !== t ? t : ""),
              (s.token = void 0 !== e.token && null !== e.token ? ea.sN.fromPartial(e.token) : void 0),
              (s.sender = null !== (n = e.sender) && void 0 !== n ? n : ""),
              (s.receiver = null !== (i = e.receiver) && void 0 !== i ? i : ""),
              (s.timeoutHeight = void 0 !== e.timeoutHeight && null !== e.timeoutHeight ? e6.fromPartial(e.timeoutHeight) : void 0),
              (s.timeoutTimestamp = void 0 !== e.timeoutTimestamp && null !== e.timeoutTimestamp ? BigInt(e.timeoutTimestamp.toString()) : BigInt(0)),
              (s.memo = null !== (r = e.memo) && void 0 !== r ? r : ""),
              s
            );
          },
          fromAmino: e => ({
            sourcePort: e.source_port,
            sourceChannel: e.source_channel,
            token: (null == e ? void 0 : e.token) ? ea.sN.fromAmino(e.token) : void 0,
            sender: e.sender,
            receiver: e.receiver,
            timeoutHeight: (null == e ? void 0 : e.timeout_height) ? e6.fromAmino(e.timeout_height) : void 0,
            timeoutTimestamp: BigInt(e.timeout_timestamp),
            memo: e.memo
          }),
          toAmino(e) {
            let o = {};
            return (
              (o.source_port = e.sourcePort),
              (o.source_channel = e.sourceChannel),
              (o.token = e.token ? ea.sN.toAmino(e.token) : void 0),
              (o.sender = e.sender),
              (o.receiver = e.receiver),
              (o.timeout_height = e.timeoutHeight ? e6.toAmino(e.timeoutHeight) : {}),
              (o.timeout_timestamp = e.timeoutTimestamp ? e.timeoutTimestamp.toString() : void 0),
              (o.memo = e.memo),
              o
            );
          },
          fromAminoMsg: e => e7.fromAmino(e.value),
          toAminoMsg: e => ({ type: "cosmos-sdk/MsgTransfer", value: e7.toAmino(e) }),
          fromProtoMsg: e => e7.decode(e.value),
          toProto: e => e7.encode(e).finish(),
          toProtoMsg: e => ({ typeUrl: "/ibc.applications.transfer.v1.MsgTransfer", value: e7.encode(e).finish() })
        },
        e5 = { "/ibc.applications.transfer.v1.MsgTransfer": { aminoType: "cosmos-sdk/MsgTransfer", toAmino: e7.toAmino, fromAmino: e7.fromAmino } },
        e9 = [["/ibc.applications.transfer.v1.MsgTransfer", e7]];
      function oe() {
        return { clientState: void 0, consensusState: void 0, signer: "" };
      }
      let oo = {
        typeUrl: "/ibc.core.client.v1.MsgCreateClient",
        encode: (e, o = y.Lt.create()) => (
          void 0 !== e.clientState && er.Any.encode(e.clientState, o.uint32(10).fork()).ldelim(),
          void 0 !== e.consensusState && er.Any.encode(e.consensusState, o.uint32(18).fork()).ldelim(),
          "" !== e.signer && o.uint32(26).string(e.signer),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = oe();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.clientState = er.Any.decode(t, t.uint32());
                break;
              case 2:
                i.consensusState = er.Any.decode(t, t.uint32());
                break;
              case 3:
                i.signer = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o;
          let t = oe();
          return (
            (t.clientState = void 0 !== e.clientState && null !== e.clientState ? er.Any.fromPartial(e.clientState) : void 0),
            (t.consensusState = void 0 !== e.consensusState && null !== e.consensusState ? er.Any.fromPartial(e.consensusState) : void 0),
            (t.signer = null !== (o = e.signer) && void 0 !== o ? o : ""),
            t
          );
        },
        fromAmino: e => ({
          clientState: (null == e ? void 0 : e.client_state) ? er.Any.fromAmino(e.client_state) : void 0,
          consensusState: (null == e ? void 0 : e.consensus_state) ? er.Any.fromAmino(e.consensus_state) : void 0,
          signer: e.signer
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.client_state = e.clientState ? er.Any.toAmino(e.clientState) : void 0),
            (o.consensus_state = e.consensusState ? er.Any.toAmino(e.consensusState) : void 0),
            (o.signer = e.signer),
            o
          );
        },
        fromAminoMsg: e => oo.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/MsgCreateClient", value: oo.toAmino(e) }),
        fromProtoMsg: e => oo.decode(e.value),
        toProto: e => oo.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/ibc.core.client.v1.MsgCreateClient", value: oo.encode(e).finish() })
      };
      function ot() {
        return { clientId: "", header: void 0, signer: "" };
      }
      let on = {
        typeUrl: "/ibc.core.client.v1.MsgUpdateClient",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.clientId && o.uint32(10).string(e.clientId),
          void 0 !== e.header && er.Any.encode(e.header, o.uint32(18).fork()).ldelim(),
          "" !== e.signer && o.uint32(26).string(e.signer),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = ot();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.clientId = t.string();
                break;
              case 2:
                i.header = er.Any.decode(t, t.uint32());
                break;
              case 3:
                i.signer = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t;
          let n = ot();
          return (
            (n.clientId = null !== (o = e.clientId) && void 0 !== o ? o : ""),
            (n.header = void 0 !== e.header && null !== e.header ? er.Any.fromPartial(e.header) : void 0),
            (n.signer = null !== (t = e.signer) && void 0 !== t ? t : ""),
            n
          );
        },
        fromAmino: e => ({ clientId: e.client_id, header: (null == e ? void 0 : e.header) ? er.Any.fromAmino(e.header) : void 0, signer: e.signer }),
        toAmino(e) {
          let o = {};
          return (o.client_id = e.clientId), (o.header = e.header ? er.Any.toAmino(e.header) : void 0), (o.signer = e.signer), o;
        },
        fromAminoMsg: e => on.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/MsgUpdateClient", value: on.toAmino(e) }),
        fromProtoMsg: e => on.decode(e.value),
        toProto: e => on.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/ibc.core.client.v1.MsgUpdateClient", value: on.encode(e).finish() })
      };
      function oi() {
        return {
          clientId: "",
          clientState: void 0,
          consensusState: void 0,
          proofUpgradeClient: new Uint8Array(),
          proofUpgradeConsensusState: new Uint8Array(),
          signer: ""
        };
      }
      let or = {
        typeUrl: "/ibc.core.client.v1.MsgUpgradeClient",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.clientId && o.uint32(10).string(e.clientId),
          void 0 !== e.clientState && er.Any.encode(e.clientState, o.uint32(18).fork()).ldelim(),
          void 0 !== e.consensusState && er.Any.encode(e.consensusState, o.uint32(26).fork()).ldelim(),
          0 !== e.proofUpgradeClient.length && o.uint32(34).bytes(e.proofUpgradeClient),
          0 !== e.proofUpgradeConsensusState.length && o.uint32(42).bytes(e.proofUpgradeConsensusState),
          "" !== e.signer && o.uint32(50).string(e.signer),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = oi();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.clientId = t.string();
                break;
              case 2:
                i.clientState = er.Any.decode(t, t.uint32());
                break;
              case 3:
                i.consensusState = er.Any.decode(t, t.uint32());
                break;
              case 4:
                i.proofUpgradeClient = t.bytes();
                break;
              case 5:
                i.proofUpgradeConsensusState = t.bytes();
                break;
              case 6:
                i.signer = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n, i;
          let r = oi();
          return (
            (r.clientId = null !== (o = e.clientId) && void 0 !== o ? o : ""),
            (r.clientState = void 0 !== e.clientState && null !== e.clientState ? er.Any.fromPartial(e.clientState) : void 0),
            (r.consensusState = void 0 !== e.consensusState && null !== e.consensusState ? er.Any.fromPartial(e.consensusState) : void 0),
            (r.proofUpgradeClient = null !== (t = e.proofUpgradeClient) && void 0 !== t ? t : new Uint8Array()),
            (r.proofUpgradeConsensusState = null !== (n = e.proofUpgradeConsensusState) && void 0 !== n ? n : new Uint8Array()),
            (r.signer = null !== (i = e.signer) && void 0 !== i ? i : ""),
            r
          );
        },
        fromAmino: e => ({
          clientId: e.client_id,
          clientState: (null == e ? void 0 : e.client_state) ? er.Any.fromAmino(e.client_state) : void 0,
          consensusState: (null == e ? void 0 : e.consensus_state) ? er.Any.fromAmino(e.consensus_state) : void 0,
          proofUpgradeClient: e.proof_upgrade_client,
          proofUpgradeConsensusState: e.proof_upgrade_consensus_state,
          signer: e.signer
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.client_id = e.clientId),
            (o.client_state = e.clientState ? er.Any.toAmino(e.clientState) : void 0),
            (o.consensus_state = e.consensusState ? er.Any.toAmino(e.consensusState) : void 0),
            (o.proof_upgrade_client = e.proofUpgradeClient),
            (o.proof_upgrade_consensus_state = e.proofUpgradeConsensusState),
            (o.signer = e.signer),
            o
          );
        },
        fromAminoMsg: e => or.fromAmino(e.value),
        toAminoMsg: e => ({ type: "cosmos-sdk/MsgUpgradeClient", value: or.toAmino(e) }),
        fromProtoMsg: e => or.decode(e.value),
        toProto: e => or.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/ibc.core.client.v1.MsgUpgradeClient", value: or.encode(e).finish() })
      };
      function os() {
        return { clientId: "", misbehaviour: void 0, signer: "" };
      }
      let oa = {
          typeUrl: "/ibc.core.client.v1.MsgSubmitMisbehaviour",
          encode: (e, o = y.Lt.create()) => (
            "" !== e.clientId && o.uint32(10).string(e.clientId),
            void 0 !== e.misbehaviour && er.Any.encode(e.misbehaviour, o.uint32(18).fork()).ldelim(),
            "" !== e.signer && o.uint32(26).string(e.signer),
            o
          ),
          decode(e, o) {
            let t = e instanceof y.oP ? e : new y.oP(e),
              n = void 0 === o ? t.len : t.pos + o,
              i = os();
            for (; t.pos < n; ) {
              let e = t.uint32();
              switch (e >>> 3) {
                case 1:
                  i.clientId = t.string();
                  break;
                case 2:
                  i.misbehaviour = er.Any.decode(t, t.uint32());
                  break;
                case 3:
                  i.signer = t.string();
                  break;
                default:
                  t.skipType(7 & e);
              }
            }
            return i;
          },
          fromPartial(e) {
            var o, t;
            let n = os();
            return (
              (n.clientId = null !== (o = e.clientId) && void 0 !== o ? o : ""),
              (n.misbehaviour = void 0 !== e.misbehaviour && null !== e.misbehaviour ? er.Any.fromPartial(e.misbehaviour) : void 0),
              (n.signer = null !== (t = e.signer) && void 0 !== t ? t : ""),
              n
            );
          },
          fromAmino: e => ({
            clientId: e.client_id,
            misbehaviour: (null == e ? void 0 : e.misbehaviour) ? er.Any.fromAmino(e.misbehaviour) : void 0,
            signer: e.signer
          }),
          toAmino(e) {
            let o = {};
            return (o.client_id = e.clientId), (o.misbehaviour = e.misbehaviour ? er.Any.toAmino(e.misbehaviour) : void 0), (o.signer = e.signer), o;
          },
          fromAminoMsg: e => oa.fromAmino(e.value),
          toAminoMsg: e => ({ type: "cosmos-sdk/MsgSubmitMisbehaviour", value: oa.toAmino(e) }),
          fromProtoMsg: e => oa.decode(e.value),
          toProto: e => oa.encode(e).finish(),
          toProtoMsg: e => ({ typeUrl: "/ibc.core.client.v1.MsgSubmitMisbehaviour", value: oa.encode(e).finish() })
        },
        ol = {
          "/ibc.core.client.v1.MsgCreateClient": { aminoType: "cosmos-sdk/MsgCreateClient", toAmino: oo.toAmino, fromAmino: oo.fromAmino },
          "/ibc.core.client.v1.MsgUpdateClient": { aminoType: "cosmos-sdk/MsgUpdateClient", toAmino: on.toAmino, fromAmino: on.fromAmino },
          "/ibc.core.client.v1.MsgUpgradeClient": { aminoType: "cosmos-sdk/MsgUpgradeClient", toAmino: or.toAmino, fromAmino: or.fromAmino },
          "/ibc.core.client.v1.MsgSubmitMisbehaviour": { aminoType: "cosmos-sdk/MsgSubmitMisbehaviour", toAmino: oa.toAmino, fromAmino: oa.fromAmino }
        },
        od = [
          ["/ibc.core.client.v1.MsgCreateClient", oo],
          ["/ibc.core.client.v1.MsgUpdateClient", on],
          ["/ibc.core.client.v1.MsgUpgradeClient", or],
          ["/ibc.core.client.v1.MsgSubmitMisbehaviour", oa]
        ],
        om = Object.assign(Object.assign({}, e5), ol),
        ou = [...e9, ...od];
      function oc() {
        return { sender: "", denom0: "", denom1: "", tickSpacing: BigInt(0), spreadFactor: "" };
      }
      let og = {
          typeUrl: "/osmosis.concentratedliquidity.poolmodel.concentrated.v1beta1.MsgCreateConcentratedPool",
          encode: (e, o = y.Lt.create()) => (
            "" !== e.sender && o.uint32(10).string(e.sender),
            "" !== e.denom0 && o.uint32(18).string(e.denom0),
            "" !== e.denom1 && o.uint32(26).string(e.denom1),
            e.tickSpacing !== BigInt(0) && o.uint32(32).uint64(e.tickSpacing),
            "" !== e.spreadFactor && o.uint32(42).string(c.Decimal.fromUserInput(e.spreadFactor, 18).atomics),
            o
          ),
          decode(e, o) {
            let t = e instanceof y.oP ? e : new y.oP(e),
              n = void 0 === o ? t.len : t.pos + o,
              i = oc();
            for (; t.pos < n; ) {
              let e = t.uint32();
              switch (e >>> 3) {
                case 1:
                  i.sender = t.string();
                  break;
                case 2:
                  i.denom0 = t.string();
                  break;
                case 3:
                  i.denom1 = t.string();
                  break;
                case 4:
                  i.tickSpacing = t.uint64();
                  break;
                case 5:
                  i.spreadFactor = c.Decimal.fromAtomics(t.string(), 18).toString();
                  break;
                default:
                  t.skipType(7 & e);
              }
            }
            return i;
          },
          fromPartial(e) {
            var o, t, n, i;
            let r = oc();
            return (
              (r.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
              (r.denom0 = null !== (t = e.denom0) && void 0 !== t ? t : ""),
              (r.denom1 = null !== (n = e.denom1) && void 0 !== n ? n : ""),
              (r.tickSpacing = void 0 !== e.tickSpacing && null !== e.tickSpacing ? BigInt(e.tickSpacing.toString()) : BigInt(0)),
              (r.spreadFactor = null !== (i = e.spreadFactor) && void 0 !== i ? i : ""),
              r
            );
          },
          fromAmino: e => ({ sender: e.sender, denom0: e.denom0, denom1: e.denom1, tickSpacing: BigInt(e.tick_spacing), spreadFactor: e.spread_factor }),
          toAmino(e) {
            let o = {};
            return (
              (o.sender = e.sender),
              (o.denom0 = e.denom0),
              (o.denom1 = e.denom1),
              (o.tick_spacing = e.tickSpacing ? e.tickSpacing.toString() : void 0),
              (o.spread_factor = e.spreadFactor),
              o
            );
          },
          fromAminoMsg: e => og.fromAmino(e.value),
          toAminoMsg: e => ({ type: "osmosis/concentratedliquidity/poolmodel/concentrated/create-concentrated-pool", value: og.toAmino(e) }),
          fromProtoMsg: e => og.decode(e.value),
          toProto: e => og.encode(e).finish(),
          toProtoMsg: e => ({
            typeUrl: "/osmosis.concentratedliquidity.poolmodel.concentrated.v1beta1.MsgCreateConcentratedPool",
            value: og.encode(e).finish()
          })
        },
        op = {
          "/osmosis.concentratedliquidity.poolmodel.concentrated.v1beta1.MsgCreateConcentratedPool": {
            aminoType: "osmosis/concentratedliquidity/poolmodel/concentrated/create-concentrated-pool",
            toAmino: og.toAmino,
            fromAmino: og.fromAmino
          }
        },
        of = [["/osmosis.concentratedliquidity.poolmodel.concentrated.v1beta1.MsgCreateConcentratedPool", og]];
      function ov() {
        return { poolId: BigInt(0), sender: "", lowerTick: BigInt(0), upperTick: BigInt(0), tokensProvided: [], tokenMinAmount0: "", tokenMinAmount1: "" };
      }
      let oA = {
        typeUrl: "/osmosis.concentratedliquidity.v1beta1.MsgCreatePosition",
        encode(e, o = y.Lt.create()) {
          for (let t of (e.poolId !== BigInt(0) && o.uint32(8).uint64(e.poolId),
          "" !== e.sender && o.uint32(18).string(e.sender),
          e.lowerTick !== BigInt(0) && o.uint32(24).int64(e.lowerTick),
          e.upperTick !== BigInt(0) && o.uint32(32).int64(e.upperTick),
          e.tokensProvided))
            ea.sN.encode(t, o.uint32(42).fork()).ldelim();
          return "" !== e.tokenMinAmount0 && o.uint32(50).string(e.tokenMinAmount0), "" !== e.tokenMinAmount1 && o.uint32(58).string(e.tokenMinAmount1), o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = ov();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.poolId = t.uint64();
                break;
              case 2:
                i.sender = t.string();
                break;
              case 3:
                i.lowerTick = t.int64();
                break;
              case 4:
                i.upperTick = t.int64();
                break;
              case 5:
                i.tokensProvided.push(ea.sN.decode(t, t.uint32()));
                break;
              case 6:
                i.tokenMinAmount0 = t.string();
                break;
              case 7:
                i.tokenMinAmount1 = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n, i;
          let r = ov();
          return (
            (r.poolId = void 0 !== e.poolId && null !== e.poolId ? BigInt(e.poolId.toString()) : BigInt(0)),
            (r.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (r.lowerTick = void 0 !== e.lowerTick && null !== e.lowerTick ? BigInt(e.lowerTick.toString()) : BigInt(0)),
            (r.upperTick = void 0 !== e.upperTick && null !== e.upperTick ? BigInt(e.upperTick.toString()) : BigInt(0)),
            (r.tokensProvided = (null === (t = e.tokensProvided) || void 0 === t ? void 0 : t.map(e => ea.sN.fromPartial(e))) || []),
            (r.tokenMinAmount0 = null !== (n = e.tokenMinAmount0) && void 0 !== n ? n : ""),
            (r.tokenMinAmount1 = null !== (i = e.tokenMinAmount1) && void 0 !== i ? i : ""),
            r
          );
        },
        fromAmino: e => ({
          poolId: BigInt(e.pool_id),
          sender: e.sender,
          lowerTick: BigInt(e.lower_tick),
          upperTick: BigInt(e.upper_tick),
          tokensProvided: Array.isArray(null == e ? void 0 : e.tokens_provided) ? e.tokens_provided.map(e => ea.sN.fromAmino(e)) : [],
          tokenMinAmount0: e.token_min_amount0,
          tokenMinAmount1: e.token_min_amount1
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.pool_id = e.poolId ? e.poolId.toString() : void 0),
            (o.sender = e.sender),
            (o.lower_tick = e.lowerTick ? e.lowerTick.toString() : void 0),
            (o.upper_tick = e.upperTick ? e.upperTick.toString() : void 0),
            e.tokensProvided ? (o.tokens_provided = e.tokensProvided.map(e => (e ? ea.sN.toAmino(e) : void 0))) : (o.tokens_provided = []),
            (o.token_min_amount0 = e.tokenMinAmount0),
            (o.token_min_amount1 = e.tokenMinAmount1),
            o
          );
        },
        fromAminoMsg: e => oA.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/cl-create-position", value: oA.toAmino(e) }),
        fromProtoMsg: e => oA.decode(e.value),
        toProto: e => oA.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.concentratedliquidity.v1beta1.MsgCreatePosition", value: oA.encode(e).finish() })
      };
      function ok() {
        return { positionId: BigInt(0), sender: "", amount0: "", amount1: "", tokenMinAmount0: "", tokenMinAmount1: "" };
      }
      let oy = {
        typeUrl: "/osmosis.concentratedliquidity.v1beta1.MsgAddToPosition",
        encode: (e, o = y.Lt.create()) => (
          e.positionId !== BigInt(0) && o.uint32(8).uint64(e.positionId),
          "" !== e.sender && o.uint32(18).string(e.sender),
          "" !== e.amount0 && o.uint32(26).string(e.amount0),
          "" !== e.amount1 && o.uint32(34).string(e.amount1),
          "" !== e.tokenMinAmount0 && o.uint32(42).string(e.tokenMinAmount0),
          "" !== e.tokenMinAmount1 && o.uint32(50).string(e.tokenMinAmount1),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = ok();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.positionId = t.uint64();
                break;
              case 2:
                i.sender = t.string();
                break;
              case 3:
                i.amount0 = t.string();
                break;
              case 4:
                i.amount1 = t.string();
                break;
              case 5:
                i.tokenMinAmount0 = t.string();
                break;
              case 6:
                i.tokenMinAmount1 = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n, i, r;
          let s = ok();
          return (
            (s.positionId = void 0 !== e.positionId && null !== e.positionId ? BigInt(e.positionId.toString()) : BigInt(0)),
            (s.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (s.amount0 = null !== (t = e.amount0) && void 0 !== t ? t : ""),
            (s.amount1 = null !== (n = e.amount1) && void 0 !== n ? n : ""),
            (s.tokenMinAmount0 = null !== (i = e.tokenMinAmount0) && void 0 !== i ? i : ""),
            (s.tokenMinAmount1 = null !== (r = e.tokenMinAmount1) && void 0 !== r ? r : ""),
            s
          );
        },
        fromAmino: e => ({
          positionId: BigInt(e.position_id),
          sender: e.sender,
          amount0: e.amount0,
          amount1: e.amount1,
          tokenMinAmount0: e.token_min_amount0,
          tokenMinAmount1: e.token_min_amount1
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.position_id = e.positionId ? e.positionId.toString() : void 0),
            (o.sender = e.sender),
            (o.amount0 = e.amount0),
            (o.amount1 = e.amount1),
            (o.token_min_amount0 = e.tokenMinAmount0),
            (o.token_min_amount1 = e.tokenMinAmount1),
            o
          );
        },
        fromAminoMsg: e => oy.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/cl-add-to-position", value: oy.toAmino(e) }),
        fromProtoMsg: e => oy.decode(e.value),
        toProto: e => oy.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.concentratedliquidity.v1beta1.MsgAddToPosition", value: oy.encode(e).finish() })
      };
      function oh() {
        return { positionId: BigInt(0), sender: "", liquidityAmount: "" };
      }
      let ob = {
        typeUrl: "/osmosis.concentratedliquidity.v1beta1.MsgWithdrawPosition",
        encode: (e, o = y.Lt.create()) => (
          e.positionId !== BigInt(0) && o.uint32(8).uint64(e.positionId),
          "" !== e.sender && o.uint32(18).string(e.sender),
          "" !== e.liquidityAmount && o.uint32(26).string(c.Decimal.fromUserInput(e.liquidityAmount, 18).atomics),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = oh();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.positionId = t.uint64();
                break;
              case 2:
                i.sender = t.string();
                break;
              case 3:
                i.liquidityAmount = c.Decimal.fromAtomics(t.string(), 18).toString();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t;
          let n = oh();
          return (
            (n.positionId = void 0 !== e.positionId && null !== e.positionId ? BigInt(e.positionId.toString()) : BigInt(0)),
            (n.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (n.liquidityAmount = null !== (t = e.liquidityAmount) && void 0 !== t ? t : ""),
            n
          );
        },
        fromAmino: e => ({ positionId: BigInt(e.position_id), sender: e.sender, liquidityAmount: e.liquidity_amount }),
        toAmino(e) {
          let o = {};
          return (o.position_id = e.positionId ? e.positionId.toString() : void 0), (o.sender = e.sender), (o.liquidity_amount = e.liquidityAmount), o;
        },
        fromAminoMsg: e => ob.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/cl-withdraw-position", value: ob.toAmino(e) }),
        fromProtoMsg: e => ob.decode(e.value),
        toProto: e => ob.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.concentratedliquidity.v1beta1.MsgWithdrawPosition", value: ob.encode(e).finish() })
      };
      function oP() {
        return { positionIds: [], sender: "" };
      }
      let oI = {
        typeUrl: "/osmosis.concentratedliquidity.v1beta1.MsgCollectSpreadRewards",
        encode(e, o = y.Lt.create()) {
          for (let t of (o.uint32(10).fork(), e.positionIds)) o.uint64(t);
          return o.ldelim(), "" !== e.sender && o.uint32(18).string(e.sender), o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = oP();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                if ((7 & e) == 2) {
                  let e = t.uint32() + t.pos;
                  for (; t.pos < e; ) i.positionIds.push(t.uint64());
                } else i.positionIds.push(t.uint64());
                break;
              case 2:
                i.sender = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t;
          let n = oP();
          return (
            (n.positionIds = (null === (o = e.positionIds) || void 0 === o ? void 0 : o.map(e => BigInt(e.toString()))) || []),
            (n.sender = null !== (t = e.sender) && void 0 !== t ? t : ""),
            n
          );
        },
        fromAmino: e => ({ positionIds: Array.isArray(null == e ? void 0 : e.position_ids) ? e.position_ids.map(e => BigInt(e)) : [], sender: e.sender }),
        toAmino(e) {
          let o = {};
          return e.positionIds ? (o.position_ids = e.positionIds.map(e => e.toString())) : (o.position_ids = []), (o.sender = e.sender), o;
        },
        fromAminoMsg: e => oI.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/cl-col-sp-rewards", value: oI.toAmino(e) }),
        fromProtoMsg: e => oI.decode(e.value),
        toProto: e => oI.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.concentratedliquidity.v1beta1.MsgCollectSpreadRewards", value: oI.encode(e).finish() })
      };
      function oM() {
        return { positionIds: [], sender: "" };
      }
      let ow = {
          typeUrl: "/osmosis.concentratedliquidity.v1beta1.MsgCollectIncentives",
          encode(e, o = y.Lt.create()) {
            for (let t of (o.uint32(10).fork(), e.positionIds)) o.uint64(t);
            return o.ldelim(), "" !== e.sender && o.uint32(18).string(e.sender), o;
          },
          decode(e, o) {
            let t = e instanceof y.oP ? e : new y.oP(e),
              n = void 0 === o ? t.len : t.pos + o,
              i = oM();
            for (; t.pos < n; ) {
              let e = t.uint32();
              switch (e >>> 3) {
                case 1:
                  if ((7 & e) == 2) {
                    let e = t.uint32() + t.pos;
                    for (; t.pos < e; ) i.positionIds.push(t.uint64());
                  } else i.positionIds.push(t.uint64());
                  break;
                case 2:
                  i.sender = t.string();
                  break;
                default:
                  t.skipType(7 & e);
              }
            }
            return i;
          },
          fromPartial(e) {
            var o, t;
            let n = oM();
            return (
              (n.positionIds = (null === (o = e.positionIds) || void 0 === o ? void 0 : o.map(e => BigInt(e.toString()))) || []),
              (n.sender = null !== (t = e.sender) && void 0 !== t ? t : ""),
              n
            );
          },
          fromAmino: e => ({ positionIds: Array.isArray(null == e ? void 0 : e.position_ids) ? e.position_ids.map(e => BigInt(e)) : [], sender: e.sender }),
          toAmino(e) {
            let o = {};
            return e.positionIds ? (o.position_ids = e.positionIds.map(e => e.toString())) : (o.position_ids = []), (o.sender = e.sender), o;
          },
          fromAminoMsg: e => ow.fromAmino(e.value),
          toAminoMsg: e => ({ type: "osmosis/cl-collect-incentives", value: ow.toAmino(e) }),
          fromProtoMsg: e => ow.decode(e.value),
          toProto: e => ow.encode(e).finish(),
          toProtoMsg: e => ({ typeUrl: "/osmosis.concentratedliquidity.v1beta1.MsgCollectIncentives", value: ow.encode(e).finish() })
        },
        o_ = {
          "/osmosis.concentratedliquidity.v1beta1.MsgCreatePosition": { aminoType: "osmosis/cl-create-position", toAmino: oA.toAmino, fromAmino: oA.fromAmino },
          "/osmosis.concentratedliquidity.v1beta1.MsgWithdrawPosition": {
            aminoType: "osmosis/cl-withdraw-position",
            toAmino: ob.toAmino,
            fromAmino: ob.fromAmino
          },
          "/osmosis.concentratedliquidity.v1beta1.MsgAddToPosition": { aminoType: "osmosis/cl-add-to-position", toAmino: oy.toAmino, fromAmino: oy.fromAmino },
          "/osmosis.concentratedliquidity.v1beta1.MsgCollectSpreadRewards": {
            aminoType: "osmosis/cl-col-sp-rewards",
            toAmino: oI.toAmino,
            fromAmino: oI.fromAmino
          },
          "/osmosis.concentratedliquidity.v1beta1.MsgCollectIncentives": {
            aminoType: "osmosis/cl-collect-incentives",
            toAmino: ow.toAmino,
            fromAmino: ow.fromAmino
          }
        },
        oS = [
          ["/osmosis.concentratedliquidity.v1beta1.MsgCreatePosition", oA],
          ["/osmosis.concentratedliquidity.v1beta1.MsgWithdrawPosition", ob],
          ["/osmosis.concentratedliquidity.v1beta1.MsgAddToPosition", oy],
          ["/osmosis.concentratedliquidity.v1beta1.MsgCollectSpreadRewards", oI],
          ["/osmosis.concentratedliquidity.v1beta1.MsgCollectIncentives", ow]
        ];
      var ox = t(43475);
      function oU() {
        return { startTime: void 0, duration: void 0, initialPoolWeights: [], targetPoolWeights: [] };
      }
      let oT = {
        typeUrl: "/osmosis.gamm.v1beta1.SmoothWeightChangeParams",
        encode(e, o = y.Lt.create()) {
          for (let t of (void 0 !== e.startTime && es.Timestamp.encode((0, el.Uq)(e.startTime), o.uint32(10).fork()).ldelim(),
          void 0 !== e.duration && ox.Duration.encode(e.duration, o.uint32(18).fork()).ldelim(),
          e.initialPoolWeights))
            oN.encode(t, o.uint32(26).fork()).ldelim();
          for (let t of e.targetPoolWeights) oN.encode(t, o.uint32(34).fork()).ldelim();
          return o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = oU();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.startTime = (0, el.Ol)(es.Timestamp.decode(t, t.uint32()));
                break;
              case 2:
                i.duration = ox.Duration.decode(t, t.uint32());
                break;
              case 3:
                i.initialPoolWeights.push(oN.decode(t, t.uint32()));
                break;
              case 4:
                i.targetPoolWeights.push(oN.decode(t, t.uint32()));
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n;
          let i = oU();
          return (
            (i.startTime = null !== (o = e.startTime) && void 0 !== o ? o : void 0),
            (i.duration = void 0 !== e.duration && null !== e.duration ? ox.Duration.fromPartial(e.duration) : void 0),
            (i.initialPoolWeights = (null === (t = e.initialPoolWeights) || void 0 === t ? void 0 : t.map(e => oN.fromPartial(e))) || []),
            (i.targetPoolWeights = (null === (n = e.targetPoolWeights) || void 0 === n ? void 0 : n.map(e => oN.fromPartial(e))) || []),
            i
          );
        },
        fromAmino: e => ({
          startTime: e.start_time,
          duration: (null == e ? void 0 : e.duration) ? ox.Duration.fromAmino(e.duration) : void 0,
          initialPoolWeights: Array.isArray(null == e ? void 0 : e.initial_pool_weights) ? e.initial_pool_weights.map(e => oN.fromAmino(e)) : [],
          targetPoolWeights: Array.isArray(null == e ? void 0 : e.target_pool_weights) ? e.target_pool_weights.map(e => oN.fromAmino(e)) : []
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.start_time = e.startTime),
            (o.duration = e.duration ? ox.Duration.toAmino(e.duration) : void 0),
            e.initialPoolWeights ? (o.initial_pool_weights = e.initialPoolWeights.map(e => (e ? oN.toAmino(e) : void 0))) : (o.initial_pool_weights = []),
            e.targetPoolWeights ? (o.target_pool_weights = e.targetPoolWeights.map(e => (e ? oN.toAmino(e) : void 0))) : (o.target_pool_weights = []),
            o
          );
        },
        fromAminoMsg: e => oT.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/gamm/smooth-weight-change-params", value: oT.toAmino(e) }),
        fromProtoMsg: e => oT.decode(e.value),
        toProto: e => oT.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.gamm.v1beta1.SmoothWeightChangeParams", value: oT.encode(e).finish() })
      };
      function oD() {
        return { swapFee: "", exitFee: "", smoothWeightChangeParams: void 0 };
      }
      let oC = {
        typeUrl: "/osmosis.gamm.v1beta1.PoolParams",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.swapFee && o.uint32(10).string(c.Decimal.fromUserInput(e.swapFee, 18).atomics),
          "" !== e.exitFee && o.uint32(18).string(c.Decimal.fromUserInput(e.exitFee, 18).atomics),
          void 0 !== e.smoothWeightChangeParams && oT.encode(e.smoothWeightChangeParams, o.uint32(26).fork()).ldelim(),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = oD();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.swapFee = c.Decimal.fromAtomics(t.string(), 18).toString();
                break;
              case 2:
                i.exitFee = c.Decimal.fromAtomics(t.string(), 18).toString();
                break;
              case 3:
                i.smoothWeightChangeParams = oT.decode(t, t.uint32());
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t;
          let n = oD();
          return (
            (n.swapFee = null !== (o = e.swapFee) && void 0 !== o ? o : ""),
            (n.exitFee = null !== (t = e.exitFee) && void 0 !== t ? t : ""),
            (n.smoothWeightChangeParams =
              void 0 !== e.smoothWeightChangeParams && null !== e.smoothWeightChangeParams ? oT.fromPartial(e.smoothWeightChangeParams) : void 0),
            n
          );
        },
        fromAmino: e => ({
          swapFee: e.swap_fee,
          exitFee: e.exit_fee,
          smoothWeightChangeParams: (null == e ? void 0 : e.smooth_weight_change_params) ? oT.fromAmino(e.smooth_weight_change_params) : void 0
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.swap_fee = e.swapFee),
            (o.exit_fee = e.exitFee),
            (o.smooth_weight_change_params = e.smoothWeightChangeParams ? oT.toAmino(e.smoothWeightChangeParams) : void 0),
            o
          );
        },
        fromAminoMsg: e => oC.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/gamm/BalancerPoolParams", value: oC.toAmino(e) }),
        fromProtoMsg: e => oC.decode(e.value),
        toProto: e => oC.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.gamm.v1beta1.PoolParams", value: oC.encode(e).finish() })
      };
      function oB() {
        return { token: void 0, weight: "" };
      }
      let oN = {
        typeUrl: "/osmosis.gamm.v1beta1.PoolAsset",
        encode: (e, o = y.Lt.create()) => (
          void 0 !== e.token && ea.sN.encode(e.token, o.uint32(10).fork()).ldelim(), "" !== e.weight && o.uint32(18).string(e.weight), o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = oB();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.token = ea.sN.decode(t, t.uint32());
                break;
              case 2:
                i.weight = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o;
          let t = oB();
          return (
            (t.token = void 0 !== e.token && null !== e.token ? ea.sN.fromPartial(e.token) : void 0),
            (t.weight = null !== (o = e.weight) && void 0 !== o ? o : ""),
            t
          );
        },
        fromAmino: e => ({ token: (null == e ? void 0 : e.token) ? ea.sN.fromAmino(e.token) : void 0, weight: e.weight }),
        toAmino(e) {
          let o = {};
          return (o.token = e.token ? ea.sN.toAmino(e.token) : void 0), (o.weight = e.weight), o;
        },
        fromAminoMsg: e => oN.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/gamm/pool-asset", value: oN.toAmino(e) }),
        fromProtoMsg: e => oN.decode(e.value),
        toProto: e => oN.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.gamm.v1beta1.PoolAsset", value: oN.encode(e).finish() })
      };
      function oE() {
        return { sender: "", poolParams: oC.fromPartial({}), poolAssets: [], futurePoolGovernor: "" };
      }
      let oO = {
          typeUrl: "/osmosis.gamm.poolmodels.balancer.v1beta1.MsgCreateBalancerPool",
          encode(e, o = y.Lt.create()) {
            for (let t of ("" !== e.sender && o.uint32(10).string(e.sender),
            void 0 !== e.poolParams && oC.encode(e.poolParams, o.uint32(18).fork()).ldelim(),
            e.poolAssets))
              oN.encode(t, o.uint32(26).fork()).ldelim();
            return "" !== e.futurePoolGovernor && o.uint32(34).string(e.futurePoolGovernor), o;
          },
          decode(e, o) {
            let t = e instanceof y.oP ? e : new y.oP(e),
              n = void 0 === o ? t.len : t.pos + o,
              i = oE();
            for (; t.pos < n; ) {
              let e = t.uint32();
              switch (e >>> 3) {
                case 1:
                  i.sender = t.string();
                  break;
                case 2:
                  i.poolParams = oC.decode(t, t.uint32());
                  break;
                case 3:
                  i.poolAssets.push(oN.decode(t, t.uint32()));
                  break;
                case 4:
                  i.futurePoolGovernor = t.string();
                  break;
                default:
                  t.skipType(7 & e);
              }
            }
            return i;
          },
          fromPartial(e) {
            var o, t, n;
            let i = oE();
            return (
              (i.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
              (i.poolParams = void 0 !== e.poolParams && null !== e.poolParams ? oC.fromPartial(e.poolParams) : void 0),
              (i.poolAssets = (null === (t = e.poolAssets) || void 0 === t ? void 0 : t.map(e => oN.fromPartial(e))) || []),
              (i.futurePoolGovernor = null !== (n = e.futurePoolGovernor) && void 0 !== n ? n : ""),
              i
            );
          },
          fromAmino: e => ({
            sender: e.sender,
            poolParams: (null == e ? void 0 : e.pool_params) ? oC.fromAmino(e.pool_params) : void 0,
            poolAssets: Array.isArray(null == e ? void 0 : e.pool_assets) ? e.pool_assets.map(e => oN.fromAmino(e)) : [],
            futurePoolGovernor: e.future_pool_governor
          }),
          toAmino(e) {
            let o = {};
            return (
              (o.sender = e.sender),
              (o.pool_params = e.poolParams ? oC.toAmino(e.poolParams) : void 0),
              e.poolAssets ? (o.pool_assets = e.poolAssets.map(e => (e ? oN.toAmino(e) : void 0))) : (o.pool_assets = []),
              (o.future_pool_governor = e.futurePoolGovernor),
              o
            );
          },
          fromAminoMsg: e => oO.fromAmino(e.value),
          toAminoMsg: e => ({ type: "osmosis/gamm/create-balancer-pool", value: oO.toAmino(e) }),
          fromProtoMsg: e => oO.decode(e.value),
          toProto: e => oO.encode(e).finish(),
          toProtoMsg: e => ({ typeUrl: "/osmosis.gamm.poolmodels.balancer.v1beta1.MsgCreateBalancerPool", value: oO.encode(e).finish() })
        },
        oR = {
          "/osmosis.gamm.poolmodels.balancer.v1beta1.MsgCreateBalancerPool": {
            aminoType: "osmosis/gamm/create-balancer-pool",
            toAmino: oO.toAmino,
            fromAmino: oO.fromAmino
          }
        },
        oL = [["/osmosis.gamm.poolmodels.balancer.v1beta1.MsgCreateBalancerPool", oO]];
      function oj() {
        return { swapFee: "", exitFee: "" };
      }
      let oq = {
        typeUrl: "/osmosis.gamm.poolmodels.stableswap.v1beta1.PoolParams",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.swapFee && o.uint32(10).string(c.Decimal.fromUserInput(e.swapFee, 18).atomics),
          "" !== e.exitFee && o.uint32(18).string(c.Decimal.fromUserInput(e.exitFee, 18).atomics),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = oj();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.swapFee = c.Decimal.fromAtomics(t.string(), 18).toString();
                break;
              case 2:
                i.exitFee = c.Decimal.fromAtomics(t.string(), 18).toString();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t;
          let n = oj();
          return (n.swapFee = null !== (o = e.swapFee) && void 0 !== o ? o : ""), (n.exitFee = null !== (t = e.exitFee) && void 0 !== t ? t : ""), n;
        },
        fromAmino: e => ({ swapFee: e.swap_fee, exitFee: e.exit_fee }),
        toAmino(e) {
          let o = {};
          return (o.swap_fee = e.swapFee), (o.exit_fee = e.exitFee), o;
        },
        fromAminoMsg: e => oq.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/gamm/StableswapPoolParams", value: oq.toAmino(e) }),
        fromProtoMsg: e => oq.decode(e.value),
        toProto: e => oq.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.gamm.poolmodels.stableswap.v1beta1.PoolParams", value: oq.encode(e).finish() })
      };
      function o$() {
        return {
          sender: "",
          poolParams: oq.fromPartial({}),
          initialPoolLiquidity: [],
          scalingFactors: [],
          futurePoolGovernor: "",
          scalingFactorController: ""
        };
      }
      let oF = {
        typeUrl: "/osmosis.gamm.poolmodels.stableswap.v1beta1.MsgCreateStableswapPool",
        encode(e, o = y.Lt.create()) {
          for (let t of ("" !== e.sender && o.uint32(10).string(e.sender),
          void 0 !== e.poolParams && oq.encode(e.poolParams, o.uint32(18).fork()).ldelim(),
          e.initialPoolLiquidity))
            ea.sN.encode(t, o.uint32(26).fork()).ldelim();
          for (let t of (o.uint32(34).fork(), e.scalingFactors)) o.uint64(t);
          return (
            o.ldelim(),
            "" !== e.futurePoolGovernor && o.uint32(42).string(e.futurePoolGovernor),
            "" !== e.scalingFactorController && o.uint32(50).string(e.scalingFactorController),
            o
          );
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = o$();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.sender = t.string();
                break;
              case 2:
                i.poolParams = oq.decode(t, t.uint32());
                break;
              case 3:
                i.initialPoolLiquidity.push(ea.sN.decode(t, t.uint32()));
                break;
              case 4:
                if ((7 & e) == 2) {
                  let e = t.uint32() + t.pos;
                  for (; t.pos < e; ) i.scalingFactors.push(t.uint64());
                } else i.scalingFactors.push(t.uint64());
                break;
              case 5:
                i.futurePoolGovernor = t.string();
                break;
              case 6:
                i.scalingFactorController = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n, i, r;
          let s = o$();
          return (
            (s.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (s.poolParams = void 0 !== e.poolParams && null !== e.poolParams ? oq.fromPartial(e.poolParams) : void 0),
            (s.initialPoolLiquidity = (null === (t = e.initialPoolLiquidity) || void 0 === t ? void 0 : t.map(e => ea.sN.fromPartial(e))) || []),
            (s.scalingFactors = (null === (n = e.scalingFactors) || void 0 === n ? void 0 : n.map(e => BigInt(e.toString()))) || []),
            (s.futurePoolGovernor = null !== (i = e.futurePoolGovernor) && void 0 !== i ? i : ""),
            (s.scalingFactorController = null !== (r = e.scalingFactorController) && void 0 !== r ? r : ""),
            s
          );
        },
        fromAmino: e => ({
          sender: e.sender,
          poolParams: (null == e ? void 0 : e.pool_params) ? oq.fromAmino(e.pool_params) : void 0,
          initialPoolLiquidity: Array.isArray(null == e ? void 0 : e.initial_pool_liquidity) ? e.initial_pool_liquidity.map(e => ea.sN.fromAmino(e)) : [],
          scalingFactors: Array.isArray(null == e ? void 0 : e.scaling_factors) ? e.scaling_factors.map(e => BigInt(e)) : [],
          futurePoolGovernor: e.future_pool_governor,
          scalingFactorController: e.scaling_factor_controller
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.sender = e.sender),
            (o.pool_params = e.poolParams ? oq.toAmino(e.poolParams) : void 0),
            e.initialPoolLiquidity
              ? (o.initial_pool_liquidity = e.initialPoolLiquidity.map(e => (e ? ea.sN.toAmino(e) : void 0)))
              : (o.initial_pool_liquidity = []),
            e.scalingFactors ? (o.scaling_factors = e.scalingFactors.map(e => e.toString())) : (o.scaling_factors = []),
            (o.future_pool_governor = e.futurePoolGovernor),
            (o.scaling_factor_controller = e.scalingFactorController),
            o
          );
        },
        fromAminoMsg: e => oF.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/gamm/create-stableswap-pool", value: oF.toAmino(e) }),
        fromProtoMsg: e => oF.decode(e.value),
        toProto: e => oF.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.gamm.poolmodels.stableswap.v1beta1.MsgCreateStableswapPool", value: oF.encode(e).finish() })
      };
      function oV() {
        return { sender: "", poolId: BigInt(0), scalingFactors: [] };
      }
      let oZ = {
          typeUrl: "/osmosis.gamm.poolmodels.stableswap.v1beta1.MsgStableSwapAdjustScalingFactors",
          encode(e, o = y.Lt.create()) {
            for (let t of ("" !== e.sender && o.uint32(10).string(e.sender),
            e.poolId !== BigInt(0) && o.uint32(16).uint64(e.poolId),
            o.uint32(26).fork(),
            e.scalingFactors))
              o.uint64(t);
            return o.ldelim(), o;
          },
          decode(e, o) {
            let t = e instanceof y.oP ? e : new y.oP(e),
              n = void 0 === o ? t.len : t.pos + o,
              i = oV();
            for (; t.pos < n; ) {
              let e = t.uint32();
              switch (e >>> 3) {
                case 1:
                  i.sender = t.string();
                  break;
                case 2:
                  i.poolId = t.uint64();
                  break;
                case 3:
                  if ((7 & e) == 2) {
                    let e = t.uint32() + t.pos;
                    for (; t.pos < e; ) i.scalingFactors.push(t.uint64());
                  } else i.scalingFactors.push(t.uint64());
                  break;
                default:
                  t.skipType(7 & e);
              }
            }
            return i;
          },
          fromPartial(e) {
            var o, t;
            let n = oV();
            return (
              (n.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
              (n.poolId = void 0 !== e.poolId && null !== e.poolId ? BigInt(e.poolId.toString()) : BigInt(0)),
              (n.scalingFactors = (null === (t = e.scalingFactors) || void 0 === t ? void 0 : t.map(e => BigInt(e.toString()))) || []),
              n
            );
          },
          fromAmino: e => ({
            sender: e.sender,
            poolId: BigInt(e.pool_id),
            scalingFactors: Array.isArray(null == e ? void 0 : e.scaling_factors) ? e.scaling_factors.map(e => BigInt(e)) : []
          }),
          toAmino(e) {
            let o = {};
            return (
              (o.sender = e.sender),
              (o.pool_id = e.poolId ? e.poolId.toString() : void 0),
              e.scalingFactors ? (o.scaling_factors = e.scalingFactors.map(e => e.toString())) : (o.scaling_factors = []),
              o
            );
          },
          fromAminoMsg: e => oZ.fromAmino(e.value),
          toAminoMsg: e => ({ type: "osmosis/gamm/stableswap-adjust-scaling-factors", value: oZ.toAmino(e) }),
          fromProtoMsg: e => oZ.decode(e.value),
          toProto: e => oZ.encode(e).finish(),
          toProtoMsg: e => ({ typeUrl: "/osmosis.gamm.poolmodels.stableswap.v1beta1.MsgStableSwapAdjustScalingFactors", value: oZ.encode(e).finish() })
        },
        oG = {
          "/osmosis.gamm.poolmodels.stableswap.v1beta1.MsgCreateStableswapPool": {
            aminoType: "osmosis/gamm/create-stableswap-pool",
            toAmino: oF.toAmino,
            fromAmino: oF.fromAmino
          },
          "/osmosis.gamm.poolmodels.stableswap.v1beta1.MsgStableSwapAdjustScalingFactors": {
            aminoType: "osmosis/gamm/stableswap-adjust-scaling-factors",
            toAmino: oZ.toAmino,
            fromAmino: oZ.fromAmino
          }
        },
        oH = [
          ["/osmosis.gamm.poolmodels.stableswap.v1beta1.MsgCreateStableswapPool", oF],
          ["/osmosis.gamm.poolmodels.stableswap.v1beta1.MsgStableSwapAdjustScalingFactors", oZ]
        ];
      function oz() {
        return { poolId: BigInt(0), tokenOutDenom: "" };
      }
      let oW = {
        typeUrl: "/osmosis.poolmanager.v1beta1.SwapAmountInRoute",
        encode: (e, o = y.Lt.create()) => (
          e.poolId !== BigInt(0) && o.uint32(8).uint64(e.poolId), "" !== e.tokenOutDenom && o.uint32(18).string(e.tokenOutDenom), o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = oz();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.poolId = t.uint64();
                break;
              case 2:
                i.tokenOutDenom = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o;
          let t = oz();
          return (
            (t.poolId = void 0 !== e.poolId && null !== e.poolId ? BigInt(e.poolId.toString()) : BigInt(0)),
            (t.tokenOutDenom = null !== (o = e.tokenOutDenom) && void 0 !== o ? o : ""),
            t
          );
        },
        fromAmino: e => ({ poolId: BigInt(e.pool_id), tokenOutDenom: e.token_out_denom }),
        toAmino(e) {
          let o = {};
          return (o.pool_id = e.poolId ? e.poolId.toString() : void 0), (o.token_out_denom = e.tokenOutDenom), o;
        },
        fromAminoMsg: e => oW.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/poolmanager/swap-amount-in-route", value: oW.toAmino(e) }),
        fromProtoMsg: e => oW.decode(e.value),
        toProto: e => oW.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.poolmanager.v1beta1.SwapAmountInRoute", value: oW.encode(e).finish() })
      };
      function oY() {
        return { poolId: BigInt(0), tokenInDenom: "" };
      }
      let oJ = {
        typeUrl: "/osmosis.poolmanager.v1beta1.SwapAmountOutRoute",
        encode: (e, o = y.Lt.create()) => (
          e.poolId !== BigInt(0) && o.uint32(8).uint64(e.poolId), "" !== e.tokenInDenom && o.uint32(18).string(e.tokenInDenom), o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = oY();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.poolId = t.uint64();
                break;
              case 2:
                i.tokenInDenom = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o;
          let t = oY();
          return (
            (t.poolId = void 0 !== e.poolId && null !== e.poolId ? BigInt(e.poolId.toString()) : BigInt(0)),
            (t.tokenInDenom = null !== (o = e.tokenInDenom) && void 0 !== o ? o : ""),
            t
          );
        },
        fromAmino: e => ({ poolId: BigInt(e.pool_id), tokenInDenom: e.token_in_denom }),
        toAmino(e) {
          let o = {};
          return (o.pool_id = e.poolId ? e.poolId.toString() : void 0), (o.token_in_denom = e.tokenInDenom), o;
        },
        fromAminoMsg: e => oJ.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/poolmanager/swap-amount-out-route", value: oJ.toAmino(e) }),
        fromProtoMsg: e => oJ.decode(e.value),
        toProto: e => oJ.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.poolmanager.v1beta1.SwapAmountOutRoute", value: oJ.encode(e).finish() })
      };
      function oK() {
        return { pools: [], tokenInAmount: "" };
      }
      let oQ = {
        typeUrl: "/osmosis.poolmanager.v1beta1.SwapAmountInSplitRoute",
        encode(e, o = y.Lt.create()) {
          for (let t of e.pools) oW.encode(t, o.uint32(10).fork()).ldelim();
          return "" !== e.tokenInAmount && o.uint32(18).string(e.tokenInAmount), o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = oK();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.pools.push(oW.decode(t, t.uint32()));
                break;
              case 2:
                i.tokenInAmount = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t;
          let n = oK();
          return (
            (n.pools = (null === (o = e.pools) || void 0 === o ? void 0 : o.map(e => oW.fromPartial(e))) || []),
            (n.tokenInAmount = null !== (t = e.tokenInAmount) && void 0 !== t ? t : ""),
            n
          );
        },
        fromAmino: e => ({ pools: Array.isArray(null == e ? void 0 : e.pools) ? e.pools.map(e => oW.fromAmino(e)) : [], tokenInAmount: e.token_in_amount }),
        toAmino(e) {
          let o = {};
          return e.pools ? (o.pools = e.pools.map(e => (e ? oW.toAmino(e) : void 0))) : (o.pools = []), (o.token_in_amount = e.tokenInAmount), o;
        },
        fromAminoMsg: e => oQ.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/poolmanager/swap-amount-in-split-route", value: oQ.toAmino(e) }),
        fromProtoMsg: e => oQ.decode(e.value),
        toProto: e => oQ.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.poolmanager.v1beta1.SwapAmountInSplitRoute", value: oQ.encode(e).finish() })
      };
      function oX() {
        return { pools: [], tokenOutAmount: "" };
      }
      let o0 = {
        typeUrl: "/osmosis.poolmanager.v1beta1.SwapAmountOutSplitRoute",
        encode(e, o = y.Lt.create()) {
          for (let t of e.pools) oJ.encode(t, o.uint32(10).fork()).ldelim();
          return "" !== e.tokenOutAmount && o.uint32(18).string(e.tokenOutAmount), o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = oX();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.pools.push(oJ.decode(t, t.uint32()));
                break;
              case 2:
                i.tokenOutAmount = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t;
          let n = oX();
          return (
            (n.pools = (null === (o = e.pools) || void 0 === o ? void 0 : o.map(e => oJ.fromPartial(e))) || []),
            (n.tokenOutAmount = null !== (t = e.tokenOutAmount) && void 0 !== t ? t : ""),
            n
          );
        },
        fromAmino: e => ({ pools: Array.isArray(null == e ? void 0 : e.pools) ? e.pools.map(e => oJ.fromAmino(e)) : [], tokenOutAmount: e.token_out_amount }),
        toAmino(e) {
          let o = {};
          return e.pools ? (o.pools = e.pools.map(e => (e ? oJ.toAmino(e) : void 0))) : (o.pools = []), (o.token_out_amount = e.tokenOutAmount), o;
        },
        fromAminoMsg: e => o0.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/poolmanager/swap-amount-out-split-route", value: o0.toAmino(e) }),
        fromProtoMsg: e => o0.decode(e.value),
        toProto: e => o0.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.poolmanager.v1beta1.SwapAmountOutSplitRoute", value: o0.encode(e).finish() })
      };
      function o1() {
        return { sender: "", poolId: BigInt(0), shareOutAmount: "", tokenInMaxs: [] };
      }
      let o2 = {
        typeUrl: "/osmosis.gamm.v1beta1.MsgJoinPool",
        encode(e, o = y.Lt.create()) {
          for (let t of ("" !== e.sender && o.uint32(10).string(e.sender),
          e.poolId !== BigInt(0) && o.uint32(16).uint64(e.poolId),
          "" !== e.shareOutAmount && o.uint32(26).string(e.shareOutAmount),
          e.tokenInMaxs))
            ea.sN.encode(t, o.uint32(34).fork()).ldelim();
          return o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = o1();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.sender = t.string();
                break;
              case 2:
                i.poolId = t.uint64();
                break;
              case 3:
                i.shareOutAmount = t.string();
                break;
              case 4:
                i.tokenInMaxs.push(ea.sN.decode(t, t.uint32()));
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n;
          let i = o1();
          return (
            (i.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (i.poolId = void 0 !== e.poolId && null !== e.poolId ? BigInt(e.poolId.toString()) : BigInt(0)),
            (i.shareOutAmount = null !== (t = e.shareOutAmount) && void 0 !== t ? t : ""),
            (i.tokenInMaxs = (null === (n = e.tokenInMaxs) || void 0 === n ? void 0 : n.map(e => ea.sN.fromPartial(e))) || []),
            i
          );
        },
        fromAmino: e => ({
          sender: e.sender,
          poolId: BigInt(e.pool_id),
          shareOutAmount: e.share_out_amount,
          tokenInMaxs: Array.isArray(null == e ? void 0 : e.token_in_maxs) ? e.token_in_maxs.map(e => ea.sN.fromAmino(e)) : []
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.sender = e.sender),
            (o.pool_id = e.poolId ? e.poolId.toString() : void 0),
            (o.share_out_amount = e.shareOutAmount),
            e.tokenInMaxs ? (o.token_in_maxs = e.tokenInMaxs.map(e => (e ? ea.sN.toAmino(e) : void 0))) : (o.token_in_maxs = []),
            o
          );
        },
        fromAminoMsg: e => o2.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/gamm/join-pool", value: o2.toAmino(e) }),
        fromProtoMsg: e => o2.decode(e.value),
        toProto: e => o2.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.gamm.v1beta1.MsgJoinPool", value: o2.encode(e).finish() })
      };
      function o3() {
        return { sender: "", poolId: BigInt(0), shareInAmount: "", tokenOutMins: [] };
      }
      let o4 = {
        typeUrl: "/osmosis.gamm.v1beta1.MsgExitPool",
        encode(e, o = y.Lt.create()) {
          for (let t of ("" !== e.sender && o.uint32(10).string(e.sender),
          e.poolId !== BigInt(0) && o.uint32(16).uint64(e.poolId),
          "" !== e.shareInAmount && o.uint32(26).string(e.shareInAmount),
          e.tokenOutMins))
            ea.sN.encode(t, o.uint32(34).fork()).ldelim();
          return o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = o3();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.sender = t.string();
                break;
              case 2:
                i.poolId = t.uint64();
                break;
              case 3:
                i.shareInAmount = t.string();
                break;
              case 4:
                i.tokenOutMins.push(ea.sN.decode(t, t.uint32()));
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n;
          let i = o3();
          return (
            (i.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (i.poolId = void 0 !== e.poolId && null !== e.poolId ? BigInt(e.poolId.toString()) : BigInt(0)),
            (i.shareInAmount = null !== (t = e.shareInAmount) && void 0 !== t ? t : ""),
            (i.tokenOutMins = (null === (n = e.tokenOutMins) || void 0 === n ? void 0 : n.map(e => ea.sN.fromPartial(e))) || []),
            i
          );
        },
        fromAmino: e => ({
          sender: e.sender,
          poolId: BigInt(e.pool_id),
          shareInAmount: e.share_in_amount,
          tokenOutMins: Array.isArray(null == e ? void 0 : e.token_out_mins) ? e.token_out_mins.map(e => ea.sN.fromAmino(e)) : []
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.sender = e.sender),
            (o.pool_id = e.poolId ? e.poolId.toString() : void 0),
            (o.share_in_amount = e.shareInAmount),
            e.tokenOutMins ? (o.token_out_mins = e.tokenOutMins.map(e => (e ? ea.sN.toAmino(e) : void 0))) : (o.token_out_mins = []),
            o
          );
        },
        fromAminoMsg: e => o4.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/gamm/exit-pool", value: o4.toAmino(e) }),
        fromProtoMsg: e => o4.decode(e.value),
        toProto: e => o4.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.gamm.v1beta1.MsgExitPool", value: o4.encode(e).finish() })
      };
      function o6() {
        return { sender: "", routes: [], tokenIn: void 0, tokenOutMinAmount: "" };
      }
      let o8 = {
        typeUrl: "/osmosis.gamm.v1beta1.MsgSwapExactAmountIn",
        encode(e, o = y.Lt.create()) {
          for (let t of ("" !== e.sender && o.uint32(10).string(e.sender), e.routes)) oW.encode(t, o.uint32(18).fork()).ldelim();
          return (
            void 0 !== e.tokenIn && ea.sN.encode(e.tokenIn, o.uint32(26).fork()).ldelim(),
            "" !== e.tokenOutMinAmount && o.uint32(34).string(e.tokenOutMinAmount),
            o
          );
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = o6();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.sender = t.string();
                break;
              case 2:
                i.routes.push(oW.decode(t, t.uint32()));
                break;
              case 3:
                i.tokenIn = ea.sN.decode(t, t.uint32());
                break;
              case 4:
                i.tokenOutMinAmount = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n;
          let i = o6();
          return (
            (i.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (i.routes = (null === (t = e.routes) || void 0 === t ? void 0 : t.map(e => oW.fromPartial(e))) || []),
            (i.tokenIn = void 0 !== e.tokenIn && null !== e.tokenIn ? ea.sN.fromPartial(e.tokenIn) : void 0),
            (i.tokenOutMinAmount = null !== (n = e.tokenOutMinAmount) && void 0 !== n ? n : ""),
            i
          );
        },
        fromAmino: e => ({
          sender: e.sender,
          routes: Array.isArray(null == e ? void 0 : e.routes) ? e.routes.map(e => oW.fromAmino(e)) : [],
          tokenIn: (null == e ? void 0 : e.token_in) ? ea.sN.fromAmino(e.token_in) : void 0,
          tokenOutMinAmount: e.token_out_min_amount
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.sender = e.sender),
            e.routes ? (o.routes = e.routes.map(e => (e ? oW.toAmino(e) : void 0))) : (o.routes = []),
            (o.token_in = e.tokenIn ? ea.sN.toAmino(e.tokenIn) : void 0),
            (o.token_out_min_amount = e.tokenOutMinAmount),
            o
          );
        },
        fromAminoMsg: e => o8.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/gamm/swap-exact-amount-in", value: o8.toAmino(e) }),
        fromProtoMsg: e => o8.decode(e.value),
        toProto: e => o8.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.gamm.v1beta1.MsgSwapExactAmountIn", value: o8.encode(e).finish() })
      };
      function o7() {
        return { sender: "", routes: [], tokenInMaxAmount: "", tokenOut: void 0 };
      }
      let o5 = {
        typeUrl: "/osmosis.gamm.v1beta1.MsgSwapExactAmountOut",
        encode(e, o = y.Lt.create()) {
          for (let t of ("" !== e.sender && o.uint32(10).string(e.sender), e.routes)) oJ.encode(t, o.uint32(18).fork()).ldelim();
          return (
            "" !== e.tokenInMaxAmount && o.uint32(26).string(e.tokenInMaxAmount),
            void 0 !== e.tokenOut && ea.sN.encode(e.tokenOut, o.uint32(34).fork()).ldelim(),
            o
          );
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = o7();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.sender = t.string();
                break;
              case 2:
                i.routes.push(oJ.decode(t, t.uint32()));
                break;
              case 3:
                i.tokenInMaxAmount = t.string();
                break;
              case 4:
                i.tokenOut = ea.sN.decode(t, t.uint32());
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n;
          let i = o7();
          return (
            (i.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (i.routes = (null === (t = e.routes) || void 0 === t ? void 0 : t.map(e => oJ.fromPartial(e))) || []),
            (i.tokenInMaxAmount = null !== (n = e.tokenInMaxAmount) && void 0 !== n ? n : ""),
            (i.tokenOut = void 0 !== e.tokenOut && null !== e.tokenOut ? ea.sN.fromPartial(e.tokenOut) : void 0),
            i
          );
        },
        fromAmino: e => ({
          sender: e.sender,
          routes: Array.isArray(null == e ? void 0 : e.routes) ? e.routes.map(e => oJ.fromAmino(e)) : [],
          tokenInMaxAmount: e.token_in_max_amount,
          tokenOut: (null == e ? void 0 : e.token_out) ? ea.sN.fromAmino(e.token_out) : void 0
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.sender = e.sender),
            e.routes ? (o.routes = e.routes.map(e => (e ? oJ.toAmino(e) : void 0))) : (o.routes = []),
            (o.token_in_max_amount = e.tokenInMaxAmount),
            (o.token_out = e.tokenOut ? ea.sN.toAmino(e.tokenOut) : void 0),
            o
          );
        },
        fromAminoMsg: e => o5.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/gamm/swap-exact-amount-out", value: o5.toAmino(e) }),
        fromProtoMsg: e => o5.decode(e.value),
        toProto: e => o5.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.gamm.v1beta1.MsgSwapExactAmountOut", value: o5.encode(e).finish() })
      };
      function o9() {
        return { sender: "", poolId: BigInt(0), tokenIn: void 0, shareOutMinAmount: "" };
      }
      let te = {
        typeUrl: "/osmosis.gamm.v1beta1.MsgJoinSwapExternAmountIn",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.sender && o.uint32(10).string(e.sender),
          e.poolId !== BigInt(0) && o.uint32(16).uint64(e.poolId),
          void 0 !== e.tokenIn && ea.sN.encode(e.tokenIn, o.uint32(26).fork()).ldelim(),
          "" !== e.shareOutMinAmount && o.uint32(34).string(e.shareOutMinAmount),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = o9();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.sender = t.string();
                break;
              case 2:
                i.poolId = t.uint64();
                break;
              case 3:
                i.tokenIn = ea.sN.decode(t, t.uint32());
                break;
              case 4:
                i.shareOutMinAmount = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t;
          let n = o9();
          return (
            (n.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (n.poolId = void 0 !== e.poolId && null !== e.poolId ? BigInt(e.poolId.toString()) : BigInt(0)),
            (n.tokenIn = void 0 !== e.tokenIn && null !== e.tokenIn ? ea.sN.fromPartial(e.tokenIn) : void 0),
            (n.shareOutMinAmount = null !== (t = e.shareOutMinAmount) && void 0 !== t ? t : ""),
            n
          );
        },
        fromAmino: e => ({
          sender: e.sender,
          poolId: BigInt(e.pool_id),
          tokenIn: (null == e ? void 0 : e.token_in) ? ea.sN.fromAmino(e.token_in) : void 0,
          shareOutMinAmount: e.share_out_min_amount
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.sender = e.sender),
            (o.pool_id = e.poolId ? e.poolId.toString() : void 0),
            (o.token_in = e.tokenIn ? ea.sN.toAmino(e.tokenIn) : void 0),
            (o.share_out_min_amount = e.shareOutMinAmount),
            o
          );
        },
        fromAminoMsg: e => te.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/gamm/join-swap-extern-amount-in", value: te.toAmino(e) }),
        fromProtoMsg: e => te.decode(e.value),
        toProto: e => te.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.gamm.v1beta1.MsgJoinSwapExternAmountIn", value: te.encode(e).finish() })
      };
      function to() {
        return { sender: "", poolId: BigInt(0), tokenInDenom: "", shareOutAmount: "", tokenInMaxAmount: "" };
      }
      let tt = {
        typeUrl: "/osmosis.gamm.v1beta1.MsgJoinSwapShareAmountOut",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.sender && o.uint32(10).string(e.sender),
          e.poolId !== BigInt(0) && o.uint32(16).uint64(e.poolId),
          "" !== e.tokenInDenom && o.uint32(26).string(e.tokenInDenom),
          "" !== e.shareOutAmount && o.uint32(34).string(e.shareOutAmount),
          "" !== e.tokenInMaxAmount && o.uint32(42).string(e.tokenInMaxAmount),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = to();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.sender = t.string();
                break;
              case 2:
                i.poolId = t.uint64();
                break;
              case 3:
                i.tokenInDenom = t.string();
                break;
              case 4:
                i.shareOutAmount = t.string();
                break;
              case 5:
                i.tokenInMaxAmount = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n, i;
          let r = to();
          return (
            (r.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (r.poolId = void 0 !== e.poolId && null !== e.poolId ? BigInt(e.poolId.toString()) : BigInt(0)),
            (r.tokenInDenom = null !== (t = e.tokenInDenom) && void 0 !== t ? t : ""),
            (r.shareOutAmount = null !== (n = e.shareOutAmount) && void 0 !== n ? n : ""),
            (r.tokenInMaxAmount = null !== (i = e.tokenInMaxAmount) && void 0 !== i ? i : ""),
            r
          );
        },
        fromAmino: e => ({
          sender: e.sender,
          poolId: BigInt(e.pool_id),
          tokenInDenom: e.token_in_denom,
          shareOutAmount: e.share_out_amount,
          tokenInMaxAmount: e.token_in_max_amount
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.sender = e.sender),
            (o.pool_id = e.poolId ? e.poolId.toString() : void 0),
            (o.token_in_denom = e.tokenInDenom),
            (o.share_out_amount = e.shareOutAmount),
            (o.token_in_max_amount = e.tokenInMaxAmount),
            o
          );
        },
        fromAminoMsg: e => tt.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/gamm/join-swap-share-amount-out", value: tt.toAmino(e) }),
        fromProtoMsg: e => tt.decode(e.value),
        toProto: e => tt.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.gamm.v1beta1.MsgJoinSwapShareAmountOut", value: tt.encode(e).finish() })
      };
      function tn() {
        return { sender: "", poolId: BigInt(0), tokenOutDenom: "", shareInAmount: "", tokenOutMinAmount: "" };
      }
      let ti = {
        typeUrl: "/osmosis.gamm.v1beta1.MsgExitSwapShareAmountIn",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.sender && o.uint32(10).string(e.sender),
          e.poolId !== BigInt(0) && o.uint32(16).uint64(e.poolId),
          "" !== e.tokenOutDenom && o.uint32(26).string(e.tokenOutDenom),
          "" !== e.shareInAmount && o.uint32(34).string(e.shareInAmount),
          "" !== e.tokenOutMinAmount && o.uint32(42).string(e.tokenOutMinAmount),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = tn();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.sender = t.string();
                break;
              case 2:
                i.poolId = t.uint64();
                break;
              case 3:
                i.tokenOutDenom = t.string();
                break;
              case 4:
                i.shareInAmount = t.string();
                break;
              case 5:
                i.tokenOutMinAmount = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n, i;
          let r = tn();
          return (
            (r.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (r.poolId = void 0 !== e.poolId && null !== e.poolId ? BigInt(e.poolId.toString()) : BigInt(0)),
            (r.tokenOutDenom = null !== (t = e.tokenOutDenom) && void 0 !== t ? t : ""),
            (r.shareInAmount = null !== (n = e.shareInAmount) && void 0 !== n ? n : ""),
            (r.tokenOutMinAmount = null !== (i = e.tokenOutMinAmount) && void 0 !== i ? i : ""),
            r
          );
        },
        fromAmino: e => ({
          sender: e.sender,
          poolId: BigInt(e.pool_id),
          tokenOutDenom: e.token_out_denom,
          shareInAmount: e.share_in_amount,
          tokenOutMinAmount: e.token_out_min_amount
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.sender = e.sender),
            (o.pool_id = e.poolId ? e.poolId.toString() : void 0),
            (o.token_out_denom = e.tokenOutDenom),
            (o.share_in_amount = e.shareInAmount),
            (o.token_out_min_amount = e.tokenOutMinAmount),
            o
          );
        },
        fromAminoMsg: e => ti.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/gamm/exit-swap-share-amount-in", value: ti.toAmino(e) }),
        fromProtoMsg: e => ti.decode(e.value),
        toProto: e => ti.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.gamm.v1beta1.MsgExitSwapShareAmountIn", value: ti.encode(e).finish() })
      };
      function tr() {
        return { sender: "", poolId: BigInt(0), tokenOut: void 0, shareInMaxAmount: "" };
      }
      let ts = {
          typeUrl: "/osmosis.gamm.v1beta1.MsgExitSwapExternAmountOut",
          encode: (e, o = y.Lt.create()) => (
            "" !== e.sender && o.uint32(10).string(e.sender),
            e.poolId !== BigInt(0) && o.uint32(16).uint64(e.poolId),
            void 0 !== e.tokenOut && ea.sN.encode(e.tokenOut, o.uint32(26).fork()).ldelim(),
            "" !== e.shareInMaxAmount && o.uint32(34).string(e.shareInMaxAmount),
            o
          ),
          decode(e, o) {
            let t = e instanceof y.oP ? e : new y.oP(e),
              n = void 0 === o ? t.len : t.pos + o,
              i = tr();
            for (; t.pos < n; ) {
              let e = t.uint32();
              switch (e >>> 3) {
                case 1:
                  i.sender = t.string();
                  break;
                case 2:
                  i.poolId = t.uint64();
                  break;
                case 3:
                  i.tokenOut = ea.sN.decode(t, t.uint32());
                  break;
                case 4:
                  i.shareInMaxAmount = t.string();
                  break;
                default:
                  t.skipType(7 & e);
              }
            }
            return i;
          },
          fromPartial(e) {
            var o, t;
            let n = tr();
            return (
              (n.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
              (n.poolId = void 0 !== e.poolId && null !== e.poolId ? BigInt(e.poolId.toString()) : BigInt(0)),
              (n.tokenOut = void 0 !== e.tokenOut && null !== e.tokenOut ? ea.sN.fromPartial(e.tokenOut) : void 0),
              (n.shareInMaxAmount = null !== (t = e.shareInMaxAmount) && void 0 !== t ? t : ""),
              n
            );
          },
          fromAmino: e => ({
            sender: e.sender,
            poolId: BigInt(e.pool_id),
            tokenOut: (null == e ? void 0 : e.token_out) ? ea.sN.fromAmino(e.token_out) : void 0,
            shareInMaxAmount: e.share_in_max_amount
          }),
          toAmino(e) {
            let o = {};
            return (
              (o.sender = e.sender),
              (o.pool_id = e.poolId ? e.poolId.toString() : void 0),
              (o.token_out = e.tokenOut ? ea.sN.toAmino(e.tokenOut) : void 0),
              (o.share_in_max_amount = e.shareInMaxAmount),
              o
            );
          },
          fromAminoMsg: e => ts.fromAmino(e.value),
          toAminoMsg: e => ({ type: "osmosis/gamm/exit-swap-extern-amount-out", value: ts.toAmino(e) }),
          fromProtoMsg: e => ts.decode(e.value),
          toProto: e => ts.encode(e).finish(),
          toProtoMsg: e => ({ typeUrl: "/osmosis.gamm.v1beta1.MsgExitSwapExternAmountOut", value: ts.encode(e).finish() })
        },
        ta = {
          "/osmosis.gamm.v1beta1.MsgJoinPool": { aminoType: "osmosis/gamm/join-pool", toAmino: o2.toAmino, fromAmino: o2.fromAmino },
          "/osmosis.gamm.v1beta1.MsgExitPool": { aminoType: "osmosis/gamm/exit-pool", toAmino: o4.toAmino, fromAmino: o4.fromAmino },
          "/osmosis.gamm.v1beta1.MsgSwapExactAmountIn": { aminoType: "osmosis/gamm/swap-exact-amount-in", toAmino: o8.toAmino, fromAmino: o8.fromAmino },
          "/osmosis.gamm.v1beta1.MsgSwapExactAmountOut": { aminoType: "osmosis/gamm/swap-exact-amount-out", toAmino: o5.toAmino, fromAmino: o5.fromAmino },
          "/osmosis.gamm.v1beta1.MsgJoinSwapExternAmountIn": {
            aminoType: "osmosis/gamm/join-swap-extern-amount-in",
            toAmino: te.toAmino,
            fromAmino: te.fromAmino
          },
          "/osmosis.gamm.v1beta1.MsgJoinSwapShareAmountOut": {
            aminoType: "osmosis/gamm/join-swap-share-amount-out",
            toAmino: tt.toAmino,
            fromAmino: tt.fromAmino
          },
          "/osmosis.gamm.v1beta1.MsgExitSwapExternAmountOut": {
            aminoType: "osmosis/gamm/exit-swap-extern-amount-out",
            toAmino: ts.toAmino,
            fromAmino: ts.fromAmino
          },
          "/osmosis.gamm.v1beta1.MsgExitSwapShareAmountIn": {
            aminoType: "osmosis/gamm/exit-swap-share-amount-in",
            toAmino: ti.toAmino,
            fromAmino: ti.fromAmino
          }
        },
        tl = [
          ["/osmosis.gamm.v1beta1.MsgJoinPool", o2],
          ["/osmosis.gamm.v1beta1.MsgExitPool", o4],
          ["/osmosis.gamm.v1beta1.MsgSwapExactAmountIn", o8],
          ["/osmosis.gamm.v1beta1.MsgSwapExactAmountOut", o5],
          ["/osmosis.gamm.v1beta1.MsgJoinSwapExternAmountIn", te],
          ["/osmosis.gamm.v1beta1.MsgJoinSwapShareAmountOut", tt],
          ["/osmosis.gamm.v1beta1.MsgExitSwapExternAmountOut", ts],
          ["/osmosis.gamm.v1beta1.MsgExitSwapShareAmountIn", ti]
        ];
      function td() {
        return { owner: "", duration: void 0, coins: [] };
      }
      ((r = l || (l = {}))[(r.ByDuration = 0)] = "ByDuration"),
        (r[(r.ByTime = 1)] = "ByTime"),
        (r[(r.NoLock = 2)] = "NoLock"),
        (r[(r.ByGroup = 3)] = "ByGroup"),
        (r[(r.UNRECOGNIZED = -1)] = "UNRECOGNIZED");
      let tm = {
        typeUrl: "/osmosis.lockup.MsgLockTokens",
        encode(e, o = y.Lt.create()) {
          for (let t of ("" !== e.owner && o.uint32(10).string(e.owner),
          void 0 !== e.duration && ox.Duration.encode(e.duration, o.uint32(18).fork()).ldelim(),
          e.coins))
            ea.sN.encode(t, o.uint32(26).fork()).ldelim();
          return o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = td();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.owner = t.string();
                break;
              case 2:
                i.duration = ox.Duration.decode(t, t.uint32());
                break;
              case 3:
                i.coins.push(ea.sN.decode(t, t.uint32()));
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t;
          let n = td();
          return (
            (n.owner = null !== (o = e.owner) && void 0 !== o ? o : ""),
            (n.duration = void 0 !== e.duration && null !== e.duration ? ox.Duration.fromPartial(e.duration) : void 0),
            (n.coins = (null === (t = e.coins) || void 0 === t ? void 0 : t.map(e => ea.sN.fromPartial(e))) || []),
            n
          );
        },
        fromAmino: e => ({
          owner: e.owner,
          duration: (null == e ? void 0 : e.duration) ? ox.Duration.fromAmino(e.duration) : void 0,
          coins: Array.isArray(null == e ? void 0 : e.coins) ? e.coins.map(e => ea.sN.fromAmino(e)) : []
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.owner = e.owner),
            (o.duration = e.duration ? ox.Duration.toAmino(e.duration) : void 0),
            e.coins ? (o.coins = e.coins.map(e => (e ? ea.sN.toAmino(e) : void 0))) : (o.coins = []),
            o
          );
        },
        fromAminoMsg: e => tm.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/lockup/lock-tokens", value: tm.toAmino(e) }),
        fromProtoMsg: e => tm.decode(e.value),
        toProto: e => tm.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.lockup.MsgLockTokens", value: tm.encode(e).finish() })
      };
      function tu() {
        return { owner: "" };
      }
      let tc = {
        typeUrl: "/osmosis.lockup.MsgBeginUnlockingAll",
        encode: (e, o = y.Lt.create()) => ("" !== e.owner && o.uint32(10).string(e.owner), o),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = tu();
          for (; t.pos < n; ) {
            let e = t.uint32();
            e >>> 3 == 1 ? (i.owner = t.string()) : t.skipType(7 & e);
          }
          return i;
        },
        fromPartial(e) {
          var o;
          let t = tu();
          return (t.owner = null !== (o = e.owner) && void 0 !== o ? o : ""), t;
        },
        fromAmino: e => ({ owner: e.owner }),
        toAmino(e) {
          let o = {};
          return (o.owner = e.owner), o;
        },
        fromAminoMsg: e => tc.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/lockup/begin-unlock-tokens", value: tc.toAmino(e) }),
        fromProtoMsg: e => tc.decode(e.value),
        toProto: e => tc.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.lockup.MsgBeginUnlockingAll", value: tc.encode(e).finish() })
      };
      function tg() {
        return { owner: "", ID: BigInt(0), coins: [] };
      }
      let tp = {
        typeUrl: "/osmosis.lockup.MsgBeginUnlocking",
        encode(e, o = y.Lt.create()) {
          for (let t of ("" !== e.owner && o.uint32(10).string(e.owner), e.ID !== BigInt(0) && o.uint32(16).uint64(e.ID), e.coins))
            ea.sN.encode(t, o.uint32(26).fork()).ldelim();
          return o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = tg();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.owner = t.string();
                break;
              case 2:
                i.ID = t.uint64();
                break;
              case 3:
                i.coins.push(ea.sN.decode(t, t.uint32()));
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t;
          let n = tg();
          return (
            (n.owner = null !== (o = e.owner) && void 0 !== o ? o : ""),
            (n.ID = void 0 !== e.ID && null !== e.ID ? BigInt(e.ID.toString()) : BigInt(0)),
            (n.coins = (null === (t = e.coins) || void 0 === t ? void 0 : t.map(e => ea.sN.fromPartial(e))) || []),
            n
          );
        },
        fromAmino: e => ({ owner: e.owner, ID: BigInt(e.ID), coins: Array.isArray(null == e ? void 0 : e.coins) ? e.coins.map(e => ea.sN.fromAmino(e)) : [] }),
        toAmino(e) {
          let o = {};
          return (
            (o.owner = e.owner),
            (o.ID = e.ID ? e.ID.toString() : void 0),
            e.coins ? (o.coins = e.coins.map(e => (e ? ea.sN.toAmino(e) : void 0))) : (o.coins = []),
            o
          );
        },
        fromAminoMsg: e => tp.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/lockup/begin-unlock-period-lock", value: tp.toAmino(e) }),
        fromProtoMsg: e => tp.decode(e.value),
        toProto: e => tp.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.lockup.MsgBeginUnlocking", value: tp.encode(e).finish() })
      };
      function tf() {
        return { owner: "", ID: BigInt(0), duration: void 0 };
      }
      let tv = {
        typeUrl: "/osmosis.lockup.MsgExtendLockup",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.owner && o.uint32(10).string(e.owner),
          e.ID !== BigInt(0) && o.uint32(16).uint64(e.ID),
          void 0 !== e.duration && ox.Duration.encode(e.duration, o.uint32(26).fork()).ldelim(),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = tf();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.owner = t.string();
                break;
              case 2:
                i.ID = t.uint64();
                break;
              case 3:
                i.duration = ox.Duration.decode(t, t.uint32());
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o;
          let t = tf();
          return (
            (t.owner = null !== (o = e.owner) && void 0 !== o ? o : ""),
            (t.ID = void 0 !== e.ID && null !== e.ID ? BigInt(e.ID.toString()) : BigInt(0)),
            (t.duration = void 0 !== e.duration && null !== e.duration ? ox.Duration.fromPartial(e.duration) : void 0),
            t
          );
        },
        fromAmino: e => ({ owner: e.owner, ID: BigInt(e.ID), duration: (null == e ? void 0 : e.duration) ? ox.Duration.fromAmino(e.duration) : void 0 }),
        toAmino(e) {
          let o = {};
          return (o.owner = e.owner), (o.ID = e.ID ? e.ID.toString() : void 0), (o.duration = e.duration ? ox.Duration.toAmino(e.duration) : void 0), o;
        },
        fromAminoMsg: e => tv.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/lockup/extend-lockup", value: tv.toAmino(e) }),
        fromProtoMsg: e => tv.decode(e.value),
        toProto: e => tv.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.lockup.MsgExtendLockup", value: tv.encode(e).finish() })
      };
      function tA() {
        return { owner: "", ID: BigInt(0), coins: [] };
      }
      let tk = {
        typeUrl: "/osmosis.lockup.MsgForceUnlock",
        encode(e, o = y.Lt.create()) {
          for (let t of ("" !== e.owner && o.uint32(10).string(e.owner), e.ID !== BigInt(0) && o.uint32(16).uint64(e.ID), e.coins))
            ea.sN.encode(t, o.uint32(26).fork()).ldelim();
          return o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = tA();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.owner = t.string();
                break;
              case 2:
                i.ID = t.uint64();
                break;
              case 3:
                i.coins.push(ea.sN.decode(t, t.uint32()));
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t;
          let n = tA();
          return (
            (n.owner = null !== (o = e.owner) && void 0 !== o ? o : ""),
            (n.ID = void 0 !== e.ID && null !== e.ID ? BigInt(e.ID.toString()) : BigInt(0)),
            (n.coins = (null === (t = e.coins) || void 0 === t ? void 0 : t.map(e => ea.sN.fromPartial(e))) || []),
            n
          );
        },
        fromAmino: e => ({ owner: e.owner, ID: BigInt(e.ID), coins: Array.isArray(null == e ? void 0 : e.coins) ? e.coins.map(e => ea.sN.fromAmino(e)) : [] }),
        toAmino(e) {
          let o = {};
          return (
            (o.owner = e.owner),
            (o.ID = e.ID ? e.ID.toString() : void 0),
            e.coins ? (o.coins = e.coins.map(e => (e ? ea.sN.toAmino(e) : void 0))) : (o.coins = []),
            o
          );
        },
        fromAminoMsg: e => tk.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/lockup/force-unlock-tokens", value: tk.toAmino(e) }),
        fromProtoMsg: e => tk.decode(e.value),
        toProto: e => tk.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.lockup.MsgForceUnlock", value: tk.encode(e).finish() })
      };
      function ty() {
        return { owner: "", lockID: BigInt(0), rewardReceiver: "" };
      }
      let th = {
          typeUrl: "/osmosis.lockup.MsgSetRewardReceiverAddress",
          encode: (e, o = y.Lt.create()) => (
            "" !== e.owner && o.uint32(10).string(e.owner),
            e.lockID !== BigInt(0) && o.uint32(16).uint64(e.lockID),
            "" !== e.rewardReceiver && o.uint32(26).string(e.rewardReceiver),
            o
          ),
          decode(e, o) {
            let t = e instanceof y.oP ? e : new y.oP(e),
              n = void 0 === o ? t.len : t.pos + o,
              i = ty();
            for (; t.pos < n; ) {
              let e = t.uint32();
              switch (e >>> 3) {
                case 1:
                  i.owner = t.string();
                  break;
                case 2:
                  i.lockID = t.uint64();
                  break;
                case 3:
                  i.rewardReceiver = t.string();
                  break;
                default:
                  t.skipType(7 & e);
              }
            }
            return i;
          },
          fromPartial(e) {
            var o, t;
            let n = ty();
            return (
              (n.owner = null !== (o = e.owner) && void 0 !== o ? o : ""),
              (n.lockID = void 0 !== e.lockID && null !== e.lockID ? BigInt(e.lockID.toString()) : BigInt(0)),
              (n.rewardReceiver = null !== (t = e.rewardReceiver) && void 0 !== t ? t : ""),
              n
            );
          },
          fromAmino: e => ({ owner: e.owner, lockID: BigInt(e.lockID), rewardReceiver: e.reward_receiver }),
          toAmino(e) {
            let o = {};
            return (o.owner = e.owner), (o.lockID = e.lockID ? e.lockID.toString() : void 0), (o.reward_receiver = e.rewardReceiver), o;
          },
          fromAminoMsg: e => th.fromAmino(e.value),
          toAminoMsg: e => ({ type: "osmosis/lockup/set-reward-receiver-address", value: th.toAmino(e) }),
          fromProtoMsg: e => th.decode(e.value),
          toProto: e => th.encode(e).finish(),
          toProtoMsg: e => ({ typeUrl: "/osmosis.lockup.MsgSetRewardReceiverAddress", value: th.encode(e).finish() })
        },
        tb = {
          "/osmosis.lockup.MsgLockTokens": { aminoType: "osmosis/lockup/lock-tokens", toAmino: tm.toAmino, fromAmino: tm.fromAmino },
          "/osmosis.lockup.MsgBeginUnlockingAll": { aminoType: "osmosis/lockup/begin-unlock-tokens", toAmino: tc.toAmino, fromAmino: tc.fromAmino },
          "/osmosis.lockup.MsgBeginUnlocking": { aminoType: "osmosis/lockup/begin-unlock-period-lock", toAmino: tp.toAmino, fromAmino: tp.fromAmino },
          "/osmosis.lockup.MsgExtendLockup": { aminoType: "osmosis/lockup/extend-lockup", toAmino: tv.toAmino, fromAmino: tv.fromAmino },
          "/osmosis.lockup.MsgForceUnlock": { aminoType: "osmosis/lockup/force-unlock-tokens", toAmino: tk.toAmino, fromAmino: tk.fromAmino },
          "/osmosis.lockup.MsgSetRewardReceiverAddress": {
            aminoType: "osmosis/lockup/set-reward-receiver-address",
            toAmino: th.toAmino,
            fromAmino: th.fromAmino
          }
        },
        tP = [
          ["/osmosis.lockup.MsgLockTokens", tm],
          ["/osmosis.lockup.MsgBeginUnlockingAll", tc],
          ["/osmosis.lockup.MsgBeginUnlocking", tp],
          ["/osmosis.lockup.MsgExtendLockup", tv],
          ["/osmosis.lockup.MsgForceUnlock", tk],
          ["/osmosis.lockup.MsgSetRewardReceiverAddress", th]
        ];
      function tI() {
        return { sender: "", routes: [], tokenIn: void 0, tokenOutMinAmount: "" };
      }
      let tM = {
        typeUrl: "/osmosis.poolmanager.v1beta1.MsgSwapExactAmountIn",
        encode(e, o = y.Lt.create()) {
          for (let t of ("" !== e.sender && o.uint32(10).string(e.sender), e.routes)) oW.encode(t, o.uint32(18).fork()).ldelim();
          return (
            void 0 !== e.tokenIn && ea.sN.encode(e.tokenIn, o.uint32(26).fork()).ldelim(),
            "" !== e.tokenOutMinAmount && o.uint32(34).string(e.tokenOutMinAmount),
            o
          );
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = tI();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.sender = t.string();
                break;
              case 2:
                i.routes.push(oW.decode(t, t.uint32()));
                break;
              case 3:
                i.tokenIn = ea.sN.decode(t, t.uint32());
                break;
              case 4:
                i.tokenOutMinAmount = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n;
          let i = tI();
          return (
            (i.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (i.routes = (null === (t = e.routes) || void 0 === t ? void 0 : t.map(e => oW.fromPartial(e))) || []),
            (i.tokenIn = void 0 !== e.tokenIn && null !== e.tokenIn ? ea.sN.fromPartial(e.tokenIn) : void 0),
            (i.tokenOutMinAmount = null !== (n = e.tokenOutMinAmount) && void 0 !== n ? n : ""),
            i
          );
        },
        fromAmino: e => ({
          sender: e.sender,
          routes: Array.isArray(null == e ? void 0 : e.routes) ? e.routes.map(e => oW.fromAmino(e)) : [],
          tokenIn: (null == e ? void 0 : e.token_in) ? ea.sN.fromAmino(e.token_in) : void 0,
          tokenOutMinAmount: e.token_out_min_amount
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.sender = e.sender),
            e.routes ? (o.routes = e.routes.map(e => (e ? oW.toAmino(e) : void 0))) : (o.routes = []),
            (o.token_in = e.tokenIn ? ea.sN.toAmino(e.tokenIn) : void 0),
            (o.token_out_min_amount = e.tokenOutMinAmount),
            o
          );
        },
        fromAminoMsg: e => tM.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/poolmanager/swap-exact-amount-in", value: tM.toAmino(e) }),
        fromProtoMsg: e => tM.decode(e.value),
        toProto: e => tM.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.poolmanager.v1beta1.MsgSwapExactAmountIn", value: tM.encode(e).finish() })
      };
      function tw() {
        return { sender: "", routes: [], tokenInDenom: "", tokenOutMinAmount: "" };
      }
      let t_ = {
        typeUrl: "/osmosis.poolmanager.v1beta1.MsgSplitRouteSwapExactAmountIn",
        encode(e, o = y.Lt.create()) {
          for (let t of ("" !== e.sender && o.uint32(10).string(e.sender), e.routes)) oQ.encode(t, o.uint32(18).fork()).ldelim();
          return "" !== e.tokenInDenom && o.uint32(26).string(e.tokenInDenom), "" !== e.tokenOutMinAmount && o.uint32(34).string(e.tokenOutMinAmount), o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = tw();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.sender = t.string();
                break;
              case 2:
                i.routes.push(oQ.decode(t, t.uint32()));
                break;
              case 3:
                i.tokenInDenom = t.string();
                break;
              case 4:
                i.tokenOutMinAmount = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n, i;
          let r = tw();
          return (
            (r.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (r.routes = (null === (t = e.routes) || void 0 === t ? void 0 : t.map(e => oQ.fromPartial(e))) || []),
            (r.tokenInDenom = null !== (n = e.tokenInDenom) && void 0 !== n ? n : ""),
            (r.tokenOutMinAmount = null !== (i = e.tokenOutMinAmount) && void 0 !== i ? i : ""),
            r
          );
        },
        fromAmino: e => ({
          sender: e.sender,
          routes: Array.isArray(null == e ? void 0 : e.routes) ? e.routes.map(e => oQ.fromAmino(e)) : [],
          tokenInDenom: e.token_in_denom,
          tokenOutMinAmount: e.token_out_min_amount
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.sender = e.sender),
            e.routes ? (o.routes = e.routes.map(e => (e ? oQ.toAmino(e) : void 0))) : (o.routes = []),
            (o.token_in_denom = e.tokenInDenom),
            (o.token_out_min_amount = e.tokenOutMinAmount),
            o
          );
        },
        fromAminoMsg: e => t_.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/poolmanager/split-amount-in", value: t_.toAmino(e) }),
        fromProtoMsg: e => t_.decode(e.value),
        toProto: e => t_.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.poolmanager.v1beta1.MsgSplitRouteSwapExactAmountIn", value: t_.encode(e).finish() })
      };
      function tS() {
        return { sender: "", routes: [], tokenInMaxAmount: "", tokenOut: void 0 };
      }
      let tx = {
        typeUrl: "/osmosis.poolmanager.v1beta1.MsgSwapExactAmountOut",
        encode(e, o = y.Lt.create()) {
          for (let t of ("" !== e.sender && o.uint32(10).string(e.sender), e.routes)) oJ.encode(t, o.uint32(18).fork()).ldelim();
          return (
            "" !== e.tokenInMaxAmount && o.uint32(26).string(e.tokenInMaxAmount),
            void 0 !== e.tokenOut && ea.sN.encode(e.tokenOut, o.uint32(34).fork()).ldelim(),
            o
          );
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = tS();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.sender = t.string();
                break;
              case 2:
                i.routes.push(oJ.decode(t, t.uint32()));
                break;
              case 3:
                i.tokenInMaxAmount = t.string();
                break;
              case 4:
                i.tokenOut = ea.sN.decode(t, t.uint32());
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n;
          let i = tS();
          return (
            (i.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (i.routes = (null === (t = e.routes) || void 0 === t ? void 0 : t.map(e => oJ.fromPartial(e))) || []),
            (i.tokenInMaxAmount = null !== (n = e.tokenInMaxAmount) && void 0 !== n ? n : ""),
            (i.tokenOut = void 0 !== e.tokenOut && null !== e.tokenOut ? ea.sN.fromPartial(e.tokenOut) : void 0),
            i
          );
        },
        fromAmino: e => ({
          sender: e.sender,
          routes: Array.isArray(null == e ? void 0 : e.routes) ? e.routes.map(e => oJ.fromAmino(e)) : [],
          tokenInMaxAmount: e.token_in_max_amount,
          tokenOut: (null == e ? void 0 : e.token_out) ? ea.sN.fromAmino(e.token_out) : void 0
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.sender = e.sender),
            e.routes ? (o.routes = e.routes.map(e => (e ? oJ.toAmino(e) : void 0))) : (o.routes = []),
            (o.token_in_max_amount = e.tokenInMaxAmount),
            (o.token_out = e.tokenOut ? ea.sN.toAmino(e.tokenOut) : void 0),
            o
          );
        },
        fromAminoMsg: e => tx.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/poolmanager/swap-exact-amount-out", value: tx.toAmino(e) }),
        fromProtoMsg: e => tx.decode(e.value),
        toProto: e => tx.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.poolmanager.v1beta1.MsgSwapExactAmountOut", value: tx.encode(e).finish() })
      };
      function tU() {
        return { sender: "", routes: [], tokenOutDenom: "", tokenInMaxAmount: "" };
      }
      let tT = {
          typeUrl: "/osmosis.poolmanager.v1beta1.MsgSplitRouteSwapExactAmountOut",
          encode(e, o = y.Lt.create()) {
            for (let t of ("" !== e.sender && o.uint32(10).string(e.sender), e.routes)) o0.encode(t, o.uint32(18).fork()).ldelim();
            return "" !== e.tokenOutDenom && o.uint32(26).string(e.tokenOutDenom), "" !== e.tokenInMaxAmount && o.uint32(34).string(e.tokenInMaxAmount), o;
          },
          decode(e, o) {
            let t = e instanceof y.oP ? e : new y.oP(e),
              n = void 0 === o ? t.len : t.pos + o,
              i = tU();
            for (; t.pos < n; ) {
              let e = t.uint32();
              switch (e >>> 3) {
                case 1:
                  i.sender = t.string();
                  break;
                case 2:
                  i.routes.push(o0.decode(t, t.uint32()));
                  break;
                case 3:
                  i.tokenOutDenom = t.string();
                  break;
                case 4:
                  i.tokenInMaxAmount = t.string();
                  break;
                default:
                  t.skipType(7 & e);
              }
            }
            return i;
          },
          fromPartial(e) {
            var o, t, n, i;
            let r = tU();
            return (
              (r.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
              (r.routes = (null === (t = e.routes) || void 0 === t ? void 0 : t.map(e => o0.fromPartial(e))) || []),
              (r.tokenOutDenom = null !== (n = e.tokenOutDenom) && void 0 !== n ? n : ""),
              (r.tokenInMaxAmount = null !== (i = e.tokenInMaxAmount) && void 0 !== i ? i : ""),
              r
            );
          },
          fromAmino: e => ({
            sender: e.sender,
            routes: Array.isArray(null == e ? void 0 : e.routes) ? e.routes.map(e => o0.fromAmino(e)) : [],
            tokenOutDenom: e.token_out_denom,
            tokenInMaxAmount: e.token_in_max_amount
          }),
          toAmino(e) {
            let o = {};
            return (
              (o.sender = e.sender),
              e.routes ? (o.routes = e.routes.map(e => (e ? o0.toAmino(e) : void 0))) : (o.routes = []),
              (o.token_out_denom = e.tokenOutDenom),
              (o.token_in_max_amount = e.tokenInMaxAmount),
              o
            );
          },
          fromAminoMsg: e => tT.fromAmino(e.value),
          toAminoMsg: e => ({ type: "osmosis/poolmanager/split-amount-out", value: tT.toAmino(e) }),
          fromProtoMsg: e => tT.decode(e.value),
          toProto: e => tT.encode(e).finish(),
          toProtoMsg: e => ({ typeUrl: "/osmosis.poolmanager.v1beta1.MsgSplitRouteSwapExactAmountOut", value: tT.encode(e).finish() })
        },
        tD = {
          "/osmosis.poolmanager.v1beta1.MsgSwapExactAmountIn": {
            aminoType: "osmosis/poolmanager/swap-exact-amount-in",
            toAmino: tM.toAmino,
            fromAmino: tM.fromAmino
          },
          "/osmosis.poolmanager.v1beta1.MsgSwapExactAmountOut": {
            aminoType: "osmosis/poolmanager/swap-exact-amount-out",
            toAmino: tx.toAmino,
            fromAmino: tx.fromAmino
          },
          "/osmosis.poolmanager.v1beta1.MsgSplitRouteSwapExactAmountIn": {
            aminoType: "osmosis/poolmanager/split-amount-in",
            toAmino: t_.toAmino,
            fromAmino: t_.fromAmino
          },
          "/osmosis.poolmanager.v1beta1.MsgSplitRouteSwapExactAmountOut": {
            aminoType: "osmosis/poolmanager/split-amount-out",
            toAmino: tT.toAmino,
            fromAmino: tT.fromAmino
          }
        },
        tC = [
          ["/osmosis.poolmanager.v1beta1.MsgSwapExactAmountIn", tM],
          ["/osmosis.poolmanager.v1beta1.MsgSwapExactAmountOut", tx],
          ["/osmosis.poolmanager.v1beta1.MsgSplitRouteSwapExactAmountIn", t_],
          ["/osmosis.poolmanager.v1beta1.MsgSplitRouteSwapExactAmountOut", tT]
        ];
      function tB() {
        return { sender: "", lockId: BigInt(0), valAddr: "" };
      }
      let tN = {
        typeUrl: "/osmosis.superfluid.MsgSuperfluidDelegate",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.sender && o.uint32(10).string(e.sender),
          e.lockId !== BigInt(0) && o.uint32(16).uint64(e.lockId),
          "" !== e.valAddr && o.uint32(26).string(e.valAddr),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = tB();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.sender = t.string();
                break;
              case 2:
                i.lockId = t.uint64();
                break;
              case 3:
                i.valAddr = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t;
          let n = tB();
          return (
            (n.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (n.lockId = void 0 !== e.lockId && null !== e.lockId ? BigInt(e.lockId.toString()) : BigInt(0)),
            (n.valAddr = null !== (t = e.valAddr) && void 0 !== t ? t : ""),
            n
          );
        },
        fromAmino: e => ({ sender: e.sender, lockId: BigInt(e.lock_id), valAddr: e.val_addr }),
        toAmino(e) {
          let o = {};
          return (o.sender = e.sender), (o.lock_id = e.lockId ? e.lockId.toString() : void 0), (o.val_addr = e.valAddr), o;
        },
        fromAminoMsg: e => tN.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/superfluid-delegate", value: tN.toAmino(e) }),
        fromProtoMsg: e => tN.decode(e.value),
        toProto: e => tN.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.superfluid.MsgSuperfluidDelegate", value: tN.encode(e).finish() })
      };
      function tE() {
        return { sender: "", lockId: BigInt(0) };
      }
      let tO = {
        typeUrl: "/osmosis.superfluid.MsgSuperfluidUndelegate",
        encode: (e, o = y.Lt.create()) => ("" !== e.sender && o.uint32(10).string(e.sender), e.lockId !== BigInt(0) && o.uint32(16).uint64(e.lockId), o),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = tE();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.sender = t.string();
                break;
              case 2:
                i.lockId = t.uint64();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o;
          let t = tE();
          return (
            (t.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (t.lockId = void 0 !== e.lockId && null !== e.lockId ? BigInt(e.lockId.toString()) : BigInt(0)),
            t
          );
        },
        fromAmino: e => ({ sender: e.sender, lockId: BigInt(e.lock_id) }),
        toAmino(e) {
          let o = {};
          return (o.sender = e.sender), (o.lock_id = e.lockId ? e.lockId.toString() : void 0), o;
        },
        fromAminoMsg: e => tO.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/superfluid-undelegate", value: tO.toAmino(e) }),
        fromProtoMsg: e => tO.decode(e.value),
        toProto: e => tO.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.superfluid.MsgSuperfluidUndelegate", value: tO.encode(e).finish() })
      };
      function tR() {
        return { sender: "", lockId: BigInt(0) };
      }
      let tL = {
        typeUrl: "/osmosis.superfluid.MsgSuperfluidUnbondLock",
        encode: (e, o = y.Lt.create()) => ("" !== e.sender && o.uint32(10).string(e.sender), e.lockId !== BigInt(0) && o.uint32(16).uint64(e.lockId), o),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = tR();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.sender = t.string();
                break;
              case 2:
                i.lockId = t.uint64();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o;
          let t = tR();
          return (
            (t.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (t.lockId = void 0 !== e.lockId && null !== e.lockId ? BigInt(e.lockId.toString()) : BigInt(0)),
            t
          );
        },
        fromAmino: e => ({ sender: e.sender, lockId: BigInt(e.lock_id) }),
        toAmino(e) {
          let o = {};
          return (o.sender = e.sender), (o.lock_id = e.lockId ? e.lockId.toString() : void 0), o;
        },
        fromAminoMsg: e => tL.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/superfluid-unbond-lock", value: tL.toAmino(e) }),
        fromProtoMsg: e => tL.decode(e.value),
        toProto: e => tL.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.superfluid.MsgSuperfluidUnbondLock", value: tL.encode(e).finish() })
      };
      function tj() {
        return { sender: "", lockId: BigInt(0), coin: void 0 };
      }
      let tq = {
        typeUrl: "/osmosis.superfluid.MsgSuperfluidUndelegateAndUnbondLock",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.sender && o.uint32(10).string(e.sender),
          e.lockId !== BigInt(0) && o.uint32(16).uint64(e.lockId),
          void 0 !== e.coin && ea.sN.encode(e.coin, o.uint32(26).fork()).ldelim(),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = tj();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.sender = t.string();
                break;
              case 2:
                i.lockId = t.uint64();
                break;
              case 3:
                i.coin = ea.sN.decode(t, t.uint32());
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o;
          let t = tj();
          return (
            (t.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (t.lockId = void 0 !== e.lockId && null !== e.lockId ? BigInt(e.lockId.toString()) : BigInt(0)),
            (t.coin = void 0 !== e.coin && null !== e.coin ? ea.sN.fromPartial(e.coin) : void 0),
            t
          );
        },
        fromAmino: e => ({ sender: e.sender, lockId: BigInt(e.lock_id), coin: (null == e ? void 0 : e.coin) ? ea.sN.fromAmino(e.coin) : void 0 }),
        toAmino(e) {
          let o = {};
          return (o.sender = e.sender), (o.lock_id = e.lockId ? e.lockId.toString() : void 0), (o.coin = e.coin ? ea.sN.toAmino(e.coin) : void 0), o;
        },
        fromAminoMsg: e => tq.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/superfluid-undelegate-and-unbond-lock", value: tq.toAmino(e) }),
        fromProtoMsg: e => tq.decode(e.value),
        toProto: e => tq.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.superfluid.MsgSuperfluidUndelegateAndUnbondLock", value: tq.encode(e).finish() })
      };
      function t$() {
        return { sender: "", coins: [], valAddr: "" };
      }
      let tF = {
        typeUrl: "/osmosis.superfluid.MsgLockAndSuperfluidDelegate",
        encode(e, o = y.Lt.create()) {
          for (let t of ("" !== e.sender && o.uint32(10).string(e.sender), e.coins)) ea.sN.encode(t, o.uint32(18).fork()).ldelim();
          return "" !== e.valAddr && o.uint32(26).string(e.valAddr), o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = t$();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.sender = t.string();
                break;
              case 2:
                i.coins.push(ea.sN.decode(t, t.uint32()));
                break;
              case 3:
                i.valAddr = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n;
          let i = t$();
          return (
            (i.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (i.coins = (null === (t = e.coins) || void 0 === t ? void 0 : t.map(e => ea.sN.fromPartial(e))) || []),
            (i.valAddr = null !== (n = e.valAddr) && void 0 !== n ? n : ""),
            i
          );
        },
        fromAmino: e => ({
          sender: e.sender,
          coins: Array.isArray(null == e ? void 0 : e.coins) ? e.coins.map(e => ea.sN.fromAmino(e)) : [],
          valAddr: e.val_addr
        }),
        toAmino(e) {
          let o = {};
          return (o.sender = e.sender), e.coins ? (o.coins = e.coins.map(e => (e ? ea.sN.toAmino(e) : void 0))) : (o.coins = []), (o.val_addr = e.valAddr), o;
        },
        fromAminoMsg: e => tF.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/lock-and-superfluid-delegate", value: tF.toAmino(e) }),
        fromProtoMsg: e => tF.decode(e.value),
        toProto: e => tF.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.superfluid.MsgLockAndSuperfluidDelegate", value: tF.encode(e).finish() })
      };
      function tV() {
        return { sender: "", coins: [], valAddr: "", poolId: BigInt(0) };
      }
      let tZ = {
        typeUrl: "/osmosis.superfluid.MsgCreateFullRangePositionAndSuperfluidDelegate",
        encode(e, o = y.Lt.create()) {
          for (let t of ("" !== e.sender && o.uint32(10).string(e.sender), e.coins)) ea.sN.encode(t, o.uint32(18).fork()).ldelim();
          return "" !== e.valAddr && o.uint32(26).string(e.valAddr), e.poolId !== BigInt(0) && o.uint32(32).uint64(e.poolId), o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = tV();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.sender = t.string();
                break;
              case 2:
                i.coins.push(ea.sN.decode(t, t.uint32()));
                break;
              case 3:
                i.valAddr = t.string();
                break;
              case 4:
                i.poolId = t.uint64();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n;
          let i = tV();
          return (
            (i.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (i.coins = (null === (t = e.coins) || void 0 === t ? void 0 : t.map(e => ea.sN.fromPartial(e))) || []),
            (i.valAddr = null !== (n = e.valAddr) && void 0 !== n ? n : ""),
            (i.poolId = void 0 !== e.poolId && null !== e.poolId ? BigInt(e.poolId.toString()) : BigInt(0)),
            i
          );
        },
        fromAmino: e => ({
          sender: e.sender,
          coins: Array.isArray(null == e ? void 0 : e.coins) ? e.coins.map(e => ea.sN.fromAmino(e)) : [],
          valAddr: e.val_addr,
          poolId: BigInt(e.pool_id)
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.sender = e.sender),
            e.coins ? (o.coins = e.coins.map(e => (e ? ea.sN.toAmino(e) : void 0))) : (o.coins = []),
            (o.val_addr = e.valAddr),
            (o.pool_id = e.poolId ? e.poolId.toString() : void 0),
            o
          );
        },
        fromAminoMsg: e => tZ.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/full-range-and-sf-delegate", value: tZ.toAmino(e) }),
        fromProtoMsg: e => tZ.decode(e.value),
        toProto: e => tZ.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.superfluid.MsgCreateFullRangePositionAndSuperfluidDelegate", value: tZ.encode(e).finish() })
      };
      function tG() {
        return { sender: "", poolId: BigInt(0) };
      }
      let tH = {
        typeUrl: "/osmosis.superfluid.MsgUnPoolWhitelistedPool",
        encode: (e, o = y.Lt.create()) => ("" !== e.sender && o.uint32(10).string(e.sender), e.poolId !== BigInt(0) && o.uint32(16).uint64(e.poolId), o),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = tG();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.sender = t.string();
                break;
              case 2:
                i.poolId = t.uint64();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o;
          let t = tG();
          return (
            (t.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (t.poolId = void 0 !== e.poolId && null !== e.poolId ? BigInt(e.poolId.toString()) : BigInt(0)),
            t
          );
        },
        fromAmino: e => ({ sender: e.sender, poolId: BigInt(e.pool_id) }),
        toAmino(e) {
          let o = {};
          return (o.sender = e.sender), (o.pool_id = e.poolId ? e.poolId.toString() : void 0), o;
        },
        fromAminoMsg: e => tH.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/unpool-whitelisted-pool", value: tH.toAmino(e) }),
        fromProtoMsg: e => tH.decode(e.value),
        toProto: e => tH.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.superfluid.MsgUnPoolWhitelistedPool", value: tH.encode(e).finish() })
      };
      function tz() {
        return { sender: "", lockId: BigInt(0), sharesToMigrate: void 0, tokenOutMins: [] };
      }
      let tW = {
        typeUrl: "/osmosis.superfluid.MsgUnlockAndMigrateSharesToFullRangeConcentratedPosition",
        encode(e, o = y.Lt.create()) {
          for (let t of ("" !== e.sender && o.uint32(10).string(e.sender),
          e.lockId !== BigInt(0) && o.uint32(16).int64(e.lockId),
          void 0 !== e.sharesToMigrate && ea.sN.encode(e.sharesToMigrate, o.uint32(26).fork()).ldelim(),
          e.tokenOutMins))
            ea.sN.encode(t, o.uint32(34).fork()).ldelim();
          return o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = tz();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.sender = t.string();
                break;
              case 2:
                i.lockId = t.int64();
                break;
              case 3:
                i.sharesToMigrate = ea.sN.decode(t, t.uint32());
                break;
              case 4:
                i.tokenOutMins.push(ea.sN.decode(t, t.uint32()));
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t;
          let n = tz();
          return (
            (n.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (n.lockId = void 0 !== e.lockId && null !== e.lockId ? BigInt(e.lockId.toString()) : BigInt(0)),
            (n.sharesToMigrate = void 0 !== e.sharesToMigrate && null !== e.sharesToMigrate ? ea.sN.fromPartial(e.sharesToMigrate) : void 0),
            (n.tokenOutMins = (null === (t = e.tokenOutMins) || void 0 === t ? void 0 : t.map(e => ea.sN.fromPartial(e))) || []),
            n
          );
        },
        fromAmino: e => ({
          sender: e.sender,
          lockId: BigInt(e.lock_id),
          sharesToMigrate: (null == e ? void 0 : e.shares_to_migrate) ? ea.sN.fromAmino(e.shares_to_migrate) : void 0,
          tokenOutMins: Array.isArray(null == e ? void 0 : e.token_out_mins) ? e.token_out_mins.map(e => ea.sN.fromAmino(e)) : []
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.sender = e.sender),
            (o.lock_id = e.lockId ? e.lockId.toString() : void 0),
            (o.shares_to_migrate = e.sharesToMigrate ? ea.sN.toAmino(e.sharesToMigrate) : void 0),
            e.tokenOutMins ? (o.token_out_mins = e.tokenOutMins.map(e => (e ? ea.sN.toAmino(e) : void 0))) : (o.token_out_mins = []),
            o
          );
        },
        fromAminoMsg: e => tW.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/unlock-and-migrate", value: tW.toAmino(e) }),
        fromProtoMsg: e => tW.decode(e.value),
        toProto: e => tW.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.superfluid.MsgUnlockAndMigrateSharesToFullRangeConcentratedPosition", value: tW.encode(e).finish() })
      };
      function tY() {
        return { positionId: BigInt(0), sender: "", tokenDesired0: void 0, tokenDesired1: void 0 };
      }
      let tJ = {
        typeUrl: "/osmosis.superfluid.MsgAddToConcentratedLiquiditySuperfluidPosition",
        encode: (e, o = y.Lt.create()) => (
          e.positionId !== BigInt(0) && o.uint32(8).uint64(e.positionId),
          "" !== e.sender && o.uint32(18).string(e.sender),
          void 0 !== e.tokenDesired0 && ea.sN.encode(e.tokenDesired0, o.uint32(26).fork()).ldelim(),
          void 0 !== e.tokenDesired1 && ea.sN.encode(e.tokenDesired1, o.uint32(34).fork()).ldelim(),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = tY();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.positionId = t.uint64();
                break;
              case 2:
                i.sender = t.string();
                break;
              case 3:
                i.tokenDesired0 = ea.sN.decode(t, t.uint32());
                break;
              case 4:
                i.tokenDesired1 = ea.sN.decode(t, t.uint32());
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o;
          let t = tY();
          return (
            (t.positionId = void 0 !== e.positionId && null !== e.positionId ? BigInt(e.positionId.toString()) : BigInt(0)),
            (t.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
            (t.tokenDesired0 = void 0 !== e.tokenDesired0 && null !== e.tokenDesired0 ? ea.sN.fromPartial(e.tokenDesired0) : void 0),
            (t.tokenDesired1 = void 0 !== e.tokenDesired1 && null !== e.tokenDesired1 ? ea.sN.fromPartial(e.tokenDesired1) : void 0),
            t
          );
        },
        fromAmino: e => ({
          positionId: BigInt(e.position_id),
          sender: e.sender,
          tokenDesired0: (null == e ? void 0 : e.token_desired0) ? ea.sN.fromAmino(e.token_desired0) : void 0,
          tokenDesired1: (null == e ? void 0 : e.token_desired1) ? ea.sN.fromAmino(e.token_desired1) : void 0
        }),
        toAmino(e) {
          let o = {};
          return (
            (o.position_id = e.positionId ? e.positionId.toString() : void 0),
            (o.sender = e.sender),
            (o.token_desired0 = e.tokenDesired0 ? ea.sN.toAmino(e.tokenDesired0) : void 0),
            (o.token_desired1 = e.tokenDesired1 ? ea.sN.toAmino(e.tokenDesired1) : void 0),
            o
          );
        },
        fromAminoMsg: e => tJ.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/add-to-cl-superfluid-position", value: tJ.toAmino(e) }),
        fromProtoMsg: e => tJ.decode(e.value),
        toProto: e => tJ.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.superfluid.MsgAddToConcentratedLiquiditySuperfluidPosition", value: tJ.encode(e).finish() })
      };
      function tK() {
        return { lockId: BigInt(0), sender: "", valAddr: "", minAmtToStake: "", sharesToConvert: void 0 };
      }
      let tQ = {
          typeUrl: "/osmosis.superfluid.MsgUnbondConvertAndStake",
          encode: (e, o = y.Lt.create()) => (
            e.lockId !== BigInt(0) && o.uint32(8).uint64(e.lockId),
            "" !== e.sender && o.uint32(18).string(e.sender),
            "" !== e.valAddr && o.uint32(26).string(e.valAddr),
            "" !== e.minAmtToStake && o.uint32(34).string(e.minAmtToStake),
            void 0 !== e.sharesToConvert && ea.sN.encode(e.sharesToConvert, o.uint32(42).fork()).ldelim(),
            o
          ),
          decode(e, o) {
            let t = e instanceof y.oP ? e : new y.oP(e),
              n = void 0 === o ? t.len : t.pos + o,
              i = tK();
            for (; t.pos < n; ) {
              let e = t.uint32();
              switch (e >>> 3) {
                case 1:
                  i.lockId = t.uint64();
                  break;
                case 2:
                  i.sender = t.string();
                  break;
                case 3:
                  i.valAddr = t.string();
                  break;
                case 4:
                  i.minAmtToStake = t.string();
                  break;
                case 5:
                  i.sharesToConvert = ea.sN.decode(t, t.uint32());
                  break;
                default:
                  t.skipType(7 & e);
              }
            }
            return i;
          },
          fromPartial(e) {
            var o, t, n;
            let i = tK();
            return (
              (i.lockId = void 0 !== e.lockId && null !== e.lockId ? BigInt(e.lockId.toString()) : BigInt(0)),
              (i.sender = null !== (o = e.sender) && void 0 !== o ? o : ""),
              (i.valAddr = null !== (t = e.valAddr) && void 0 !== t ? t : ""),
              (i.minAmtToStake = null !== (n = e.minAmtToStake) && void 0 !== n ? n : ""),
              (i.sharesToConvert = void 0 !== e.sharesToConvert && null !== e.sharesToConvert ? ea.sN.fromPartial(e.sharesToConvert) : void 0),
              i
            );
          },
          fromAmino: e => ({
            lockId: BigInt(e.lock_id),
            sender: e.sender,
            valAddr: e.val_addr,
            minAmtToStake: e.min_amt_to_stake,
            sharesToConvert: (null == e ? void 0 : e.shares_to_convert) ? ea.sN.fromAmino(e.shares_to_convert) : void 0
          }),
          toAmino(e) {
            let o = {};
            return (
              (o.lock_id = e.lockId ? e.lockId.toString() : void 0),
              (o.sender = e.sender),
              (o.val_addr = e.valAddr),
              (o.min_amt_to_stake = e.minAmtToStake),
              (o.shares_to_convert = e.sharesToConvert ? ea.sN.toAmino(e.sharesToConvert) : void 0),
              o
            );
          },
          fromAminoMsg: e => tQ.fromAmino(e.value),
          toAminoMsg: e => ({ type: "osmosis/unbond-convert-and-stake", value: tQ.toAmino(e) }),
          fromProtoMsg: e => tQ.decode(e.value),
          toProto: e => tQ.encode(e).finish(),
          toProtoMsg: e => ({ typeUrl: "/osmosis.superfluid.MsgUnbondConvertAndStake", value: tQ.encode(e).finish() })
        },
        tX = {
          "/osmosis.superfluid.MsgSuperfluidDelegate": { aminoType: "osmosis/superfluid-delegate", toAmino: tN.toAmino, fromAmino: tN.fromAmino },
          "/osmosis.superfluid.MsgSuperfluidUndelegate": { aminoType: "osmosis/superfluid-undelegate", toAmino: tO.toAmino, fromAmino: tO.fromAmino },
          "/osmosis.superfluid.MsgSuperfluidUnbondLock": { aminoType: "osmosis/superfluid-unbond-lock", toAmino: tL.toAmino, fromAmino: tL.fromAmino },
          "/osmosis.superfluid.MsgSuperfluidUndelegateAndUnbondLock": {
            aminoType: "osmosis/superfluid-undelegate-and-unbond-lock",
            toAmino: tq.toAmino,
            fromAmino: tq.fromAmino
          },
          "/osmosis.superfluid.MsgLockAndSuperfluidDelegate": {
            aminoType: "osmosis/lock-and-superfluid-delegate",
            toAmino: tF.toAmino,
            fromAmino: tF.fromAmino
          },
          "/osmosis.superfluid.MsgCreateFullRangePositionAndSuperfluidDelegate": {
            aminoType: "osmosis/full-range-and-sf-delegate",
            toAmino: tZ.toAmino,
            fromAmino: tZ.fromAmino
          },
          "/osmosis.superfluid.MsgUnPoolWhitelistedPool": { aminoType: "osmosis/unpool-whitelisted-pool", toAmino: tH.toAmino, fromAmino: tH.fromAmino },
          "/osmosis.superfluid.MsgUnlockAndMigrateSharesToFullRangeConcentratedPosition": {
            aminoType: "osmosis/unlock-and-migrate",
            toAmino: tW.toAmino,
            fromAmino: tW.fromAmino
          },
          "/osmosis.superfluid.MsgAddToConcentratedLiquiditySuperfluidPosition": {
            aminoType: "osmosis/add-to-cl-superfluid-position",
            toAmino: tJ.toAmino,
            fromAmino: tJ.fromAmino
          },
          "/osmosis.superfluid.MsgUnbondConvertAndStake": { aminoType: "osmosis/unbond-convert-and-stake", toAmino: tQ.toAmino, fromAmino: tQ.fromAmino }
        },
        t0 = [
          ["/osmosis.superfluid.MsgSuperfluidDelegate", tN],
          ["/osmosis.superfluid.MsgSuperfluidUndelegate", tO],
          ["/osmosis.superfluid.MsgSuperfluidUnbondLock", tL],
          ["/osmosis.superfluid.MsgSuperfluidUndelegateAndUnbondLock", tq],
          ["/osmosis.superfluid.MsgLockAndSuperfluidDelegate", tF],
          ["/osmosis.superfluid.MsgCreateFullRangePositionAndSuperfluidDelegate", tZ],
          ["/osmosis.superfluid.MsgUnPoolWhitelistedPool", tH],
          ["/osmosis.superfluid.MsgUnlockAndMigrateSharesToFullRangeConcentratedPosition", tW],
          ["/osmosis.superfluid.MsgAddToConcentratedLiquiditySuperfluidPosition", tJ],
          ["/osmosis.superfluid.MsgUnbondConvertAndStake", tQ]
        ];
      function t1() {
        return { valOperAddress: "", weight: "" };
      }
      let t2 = {
        typeUrl: "/osmosis.valsetpref.v1beta1.ValidatorPreference",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.valOperAddress && o.uint32(10).string(e.valOperAddress),
          "" !== e.weight && o.uint32(18).string(c.Decimal.fromUserInput(e.weight, 18).atomics),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = t1();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.valOperAddress = t.string();
                break;
              case 2:
                i.weight = c.Decimal.fromAtomics(t.string(), 18).toString();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t;
          let n = t1();
          return (
            (n.valOperAddress = null !== (o = e.valOperAddress) && void 0 !== o ? o : ""), (n.weight = null !== (t = e.weight) && void 0 !== t ? t : ""), n
          );
        },
        fromAmino: e => ({ valOperAddress: e.val_oper_address, weight: e.weight }),
        toAmino(e) {
          let o = {};
          return (o.val_oper_address = e.valOperAddress), (o.weight = e.weight), o;
        },
        fromAminoMsg: e => t2.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/valsetpref/validator-preference", value: t2.toAmino(e) }),
        fromProtoMsg: e => t2.decode(e.value),
        toProto: e => t2.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.valsetpref.v1beta1.ValidatorPreference", value: t2.encode(e).finish() })
      };
      function t3() {
        return { delegator: "", preferences: [] };
      }
      let t4 = {
        typeUrl: "/osmosis.valsetpref.v1beta1.MsgSetValidatorSetPreference",
        encode(e, o = y.Lt.create()) {
          for (let t of ("" !== e.delegator && o.uint32(10).string(e.delegator), e.preferences)) t2.encode(t, o.uint32(18).fork()).ldelim();
          return o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = t3();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.delegator = t.string();
                break;
              case 2:
                i.preferences.push(t2.decode(t, t.uint32()));
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t;
          let n = t3();
          return (
            (n.delegator = null !== (o = e.delegator) && void 0 !== o ? o : ""),
            (n.preferences = (null === (t = e.preferences) || void 0 === t ? void 0 : t.map(e => t2.fromPartial(e))) || []),
            n
          );
        },
        fromAmino: e => ({
          delegator: e.delegator,
          preferences: Array.isArray(null == e ? void 0 : e.preferences) ? e.preferences.map(e => t2.fromAmino(e)) : []
        }),
        toAmino(e) {
          let o = {};
          return (o.delegator = e.delegator), e.preferences ? (o.preferences = e.preferences.map(e => (e ? t2.toAmino(e) : void 0))) : (o.preferences = []), o;
        },
        fromAminoMsg: e => t4.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/MsgSetValidatorSetPreference", value: t4.toAmino(e) }),
        fromProtoMsg: e => t4.decode(e.value),
        toProto: e => t4.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.valsetpref.v1beta1.MsgSetValidatorSetPreference", value: t4.encode(e).finish() })
      };
      function t6() {
        return { delegator: "", coin: void 0 };
      }
      let t8 = {
        typeUrl: "/osmosis.valsetpref.v1beta1.MsgDelegateToValidatorSet",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.delegator && o.uint32(10).string(e.delegator), void 0 !== e.coin && ea.sN.encode(e.coin, o.uint32(18).fork()).ldelim(), o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = t6();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.delegator = t.string();
                break;
              case 2:
                i.coin = ea.sN.decode(t, t.uint32());
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o;
          let t = t6();
          return (
            (t.delegator = null !== (o = e.delegator) && void 0 !== o ? o : ""),
            (t.coin = void 0 !== e.coin && null !== e.coin ? ea.sN.fromPartial(e.coin) : void 0),
            t
          );
        },
        fromAmino: e => ({ delegator: e.delegator, coin: (null == e ? void 0 : e.coin) ? ea.sN.fromAmino(e.coin) : void 0 }),
        toAmino(e) {
          let o = {};
          return (o.delegator = e.delegator), (o.coin = e.coin ? ea.sN.toAmino(e.coin) : void 0), o;
        },
        fromAminoMsg: e => t8.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/MsgDelegateToValidatorSet", value: t8.toAmino(e) }),
        fromProtoMsg: e => t8.decode(e.value),
        toProto: e => t8.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.valsetpref.v1beta1.MsgDelegateToValidatorSet", value: t8.encode(e).finish() })
      };
      function t7() {
        return { delegator: "", coin: void 0 };
      }
      let t5 = {
        typeUrl: "/osmosis.valsetpref.v1beta1.MsgUndelegateFromValidatorSet",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.delegator && o.uint32(10).string(e.delegator), void 0 !== e.coin && ea.sN.encode(e.coin, o.uint32(26).fork()).ldelim(), o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = t7();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.delegator = t.string();
                break;
              case 3:
                i.coin = ea.sN.decode(t, t.uint32());
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o;
          let t = t7();
          return (
            (t.delegator = null !== (o = e.delegator) && void 0 !== o ? o : ""),
            (t.coin = void 0 !== e.coin && null !== e.coin ? ea.sN.fromPartial(e.coin) : void 0),
            t
          );
        },
        fromAmino: e => ({ delegator: e.delegator, coin: (null == e ? void 0 : e.coin) ? ea.sN.fromAmino(e.coin) : void 0 }),
        toAmino(e) {
          let o = {};
          return (o.delegator = e.delegator), (o.coin = e.coin ? ea.sN.toAmino(e.coin) : void 0), o;
        },
        fromAminoMsg: e => t5.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/MsgUndelegateFromValidatorSet", value: t5.toAmino(e) }),
        fromProtoMsg: e => t5.decode(e.value),
        toProto: e => t5.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.valsetpref.v1beta1.MsgUndelegateFromValidatorSet", value: t5.encode(e).finish() })
      };
      function t9() {
        return { delegator: "", preferences: [] };
      }
      let ne = {
        typeUrl: "/osmosis.valsetpref.v1beta1.MsgRedelegateValidatorSet",
        encode(e, o = y.Lt.create()) {
          for (let t of ("" !== e.delegator && o.uint32(10).string(e.delegator), e.preferences)) t2.encode(t, o.uint32(18).fork()).ldelim();
          return o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = t9();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.delegator = t.string();
                break;
              case 2:
                i.preferences.push(t2.decode(t, t.uint32()));
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t;
          let n = t9();
          return (
            (n.delegator = null !== (o = e.delegator) && void 0 !== o ? o : ""),
            (n.preferences = (null === (t = e.preferences) || void 0 === t ? void 0 : t.map(e => t2.fromPartial(e))) || []),
            n
          );
        },
        fromAmino: e => ({
          delegator: e.delegator,
          preferences: Array.isArray(null == e ? void 0 : e.preferences) ? e.preferences.map(e => t2.fromAmino(e)) : []
        }),
        toAmino(e) {
          let o = {};
          return (o.delegator = e.delegator), e.preferences ? (o.preferences = e.preferences.map(e => (e ? t2.toAmino(e) : void 0))) : (o.preferences = []), o;
        },
        fromAminoMsg: e => ne.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/MsgRedelegateValidatorSet", value: ne.toAmino(e) }),
        fromProtoMsg: e => ne.decode(e.value),
        toProto: e => ne.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.valsetpref.v1beta1.MsgRedelegateValidatorSet", value: ne.encode(e).finish() })
      };
      function no() {
        return { delegator: "" };
      }
      let nt = {
        typeUrl: "/osmosis.valsetpref.v1beta1.MsgWithdrawDelegationRewards",
        encode: (e, o = y.Lt.create()) => ("" !== e.delegator && o.uint32(10).string(e.delegator), o),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = no();
          for (; t.pos < n; ) {
            let e = t.uint32();
            e >>> 3 == 1 ? (i.delegator = t.string()) : t.skipType(7 & e);
          }
          return i;
        },
        fromPartial(e) {
          var o;
          let t = no();
          return (t.delegator = null !== (o = e.delegator) && void 0 !== o ? o : ""), t;
        },
        fromAmino: e => ({ delegator: e.delegator }),
        toAmino(e) {
          let o = {};
          return (o.delegator = e.delegator), o;
        },
        fromAminoMsg: e => nt.fromAmino(e.value),
        toAminoMsg: e => ({ type: "osmosis/MsgWithdrawDelegationRewards", value: nt.toAmino(e) }),
        fromProtoMsg: e => nt.decode(e.value),
        toProto: e => nt.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/osmosis.valsetpref.v1beta1.MsgWithdrawDelegationRewards", value: nt.encode(e).finish() })
      };
      function nn() {
        return { delegator: "", lockID: BigInt(0) };
      }
      let ni = {
          typeUrl: "/osmosis.valsetpref.v1beta1.MsgDelegateBondedTokens",
          encode: (e, o = y.Lt.create()) => (
            "" !== e.delegator && o.uint32(10).string(e.delegator), e.lockID !== BigInt(0) && o.uint32(16).uint64(e.lockID), o
          ),
          decode(e, o) {
            let t = e instanceof y.oP ? e : new y.oP(e),
              n = void 0 === o ? t.len : t.pos + o,
              i = nn();
            for (; t.pos < n; ) {
              let e = t.uint32();
              switch (e >>> 3) {
                case 1:
                  i.delegator = t.string();
                  break;
                case 2:
                  i.lockID = t.uint64();
                  break;
                default:
                  t.skipType(7 & e);
              }
            }
            return i;
          },
          fromPartial(e) {
            var o;
            let t = nn();
            return (
              (t.delegator = null !== (o = e.delegator) && void 0 !== o ? o : ""),
              (t.lockID = void 0 !== e.lockID && null !== e.lockID ? BigInt(e.lockID.toString()) : BigInt(0)),
              t
            );
          },
          fromAmino: e => ({ delegator: e.delegator, lockID: BigInt(e.lockID) }),
          toAmino(e) {
            let o = {};
            return (o.delegator = e.delegator), (o.lockID = e.lockID ? e.lockID.toString() : void 0), o;
          },
          fromAminoMsg: e => ni.fromAmino(e.value),
          toAminoMsg: e => ({ type: "osmosis/valsetpref/delegate-bonded-tokens", value: ni.toAmino(e) }),
          fromProtoMsg: e => ni.decode(e.value),
          toProto: e => ni.encode(e).finish(),
          toProtoMsg: e => ({ typeUrl: "/osmosis.valsetpref.v1beta1.MsgDelegateBondedTokens", value: ni.encode(e).finish() })
        },
        nr = {
          "/osmosis.valsetpref.v1beta1.MsgSetValidatorSetPreference": {
            aminoType: "osmosis/MsgSetValidatorSetPreference",
            toAmino: t4.toAmino,
            fromAmino: t4.fromAmino
          },
          "/osmosis.valsetpref.v1beta1.MsgDelegateToValidatorSet": {
            aminoType: "osmosis/MsgDelegateToValidatorSet",
            toAmino: t8.toAmino,
            fromAmino: t8.fromAmino
          },
          "/osmosis.valsetpref.v1beta1.MsgUndelegateFromValidatorSet": {
            aminoType: "osmosis/MsgUndelegateFromValidatorSet",
            toAmino: t5.toAmino,
            fromAmino: t5.fromAmino
          },
          "/osmosis.valsetpref.v1beta1.MsgRedelegateValidatorSet": {
            aminoType: "osmosis/MsgRedelegateValidatorSet",
            toAmino: ne.toAmino,
            fromAmino: ne.fromAmino
          },
          "/osmosis.valsetpref.v1beta1.MsgWithdrawDelegationRewards": {
            aminoType: "osmosis/MsgWithdrawDelegationRewards",
            toAmino: nt.toAmino,
            fromAmino: nt.fromAmino
          },
          "/osmosis.valsetpref.v1beta1.MsgDelegateBondedTokens": {
            aminoType: "osmosis/valsetpref/delegate-bonded-tokens",
            toAmino: ni.toAmino,
            fromAmino: ni.fromAmino
          }
        },
        ns = [
          ["/osmosis.valsetpref.v1beta1.MsgSetValidatorSetPreference", t4],
          ["/osmosis.valsetpref.v1beta1.MsgDelegateToValidatorSet", t8],
          ["/osmosis.valsetpref.v1beta1.MsgUndelegateFromValidatorSet", t5],
          ["/osmosis.valsetpref.v1beta1.MsgRedelegateValidatorSet", ne],
          ["/osmosis.valsetpref.v1beta1.MsgWithdrawDelegationRewards", nt],
          ["/osmosis.valsetpref.v1beta1.MsgDelegateBondedTokens", ni]
        ],
        na = Object.assign(
          Object.assign(
            Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, op), o_), oR), oG), ta), tb), tD),
            tX
          ),
          nr
        ),
        nl = [...of, ...oS, ...oL, ...oH, ...tl, ...tP, ...tC, ...t0, ...ns];
      function nd() {
        return { user: "" };
      }
      let nm = {
        typeUrl: "/stride.claim.MsgClaimFreeAmount",
        encode: (e, o = y.Lt.create()) => ("" !== e.user && o.uint32(10).string(e.user), o),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = nd();
          for (; t.pos < n; ) {
            let e = t.uint32();
            e >>> 3 == 1 ? (i.user = t.string()) : t.skipType(7 & e);
          }
          return i;
        },
        fromPartial(e) {
          var o;
          let t = nd();
          return (t.user = null !== (o = e.user) && void 0 !== o ? o : ""), t;
        },
        fromAmino(e) {
          let o = nd();
          return void 0 !== e.user && null !== e.user && (o.user = e.user), o;
        },
        toAmino(e) {
          let o = {};
          return (o.user = "" === e.user ? void 0 : e.user), o;
        },
        fromAminoMsg: e => nm.fromAmino(e.value),
        toAminoMsg: e => ({ type: "claim/ClaimFreeAmount", value: nm.toAmino(e) }),
        fromProtoMsg: e => nm.decode(e.value),
        toProto: e => nm.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/stride.claim.MsgClaimFreeAmount", value: nm.encode(e).finish() })
      };
      function nu() {
        return { distributor: "", identifier: "", chainId: "", denom: "", startTime: BigInt(0), duration: BigInt(0), autopilotEnabled: !1 };
      }
      let nc = {
        typeUrl: "/stride.claim.MsgCreateAirdrop",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.distributor && o.uint32(10).string(e.distributor),
          "" !== e.identifier && o.uint32(18).string(e.identifier),
          "" !== e.chainId && o.uint32(50).string(e.chainId),
          "" !== e.denom && o.uint32(42).string(e.denom),
          e.startTime !== BigInt(0) && o.uint32(24).uint64(e.startTime),
          e.duration !== BigInt(0) && o.uint32(32).uint64(e.duration),
          !0 === e.autopilotEnabled && o.uint32(56).bool(e.autopilotEnabled),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = nu();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.distributor = t.string();
                break;
              case 2:
                i.identifier = t.string();
                break;
              case 6:
                i.chainId = t.string();
                break;
              case 5:
                i.denom = t.string();
                break;
              case 3:
                i.startTime = t.uint64();
                break;
              case 4:
                i.duration = t.uint64();
                break;
              case 7:
                i.autopilotEnabled = t.bool();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n, i, r;
          let s = nu();
          return (
            (s.distributor = null !== (o = e.distributor) && void 0 !== o ? o : ""),
            (s.identifier = null !== (t = e.identifier) && void 0 !== t ? t : ""),
            (s.chainId = null !== (n = e.chainId) && void 0 !== n ? n : ""),
            (s.denom = null !== (i = e.denom) && void 0 !== i ? i : ""),
            (s.startTime = void 0 !== e.startTime && null !== e.startTime ? BigInt(e.startTime.toString()) : BigInt(0)),
            (s.duration = void 0 !== e.duration && null !== e.duration ? BigInt(e.duration.toString()) : BigInt(0)),
            (s.autopilotEnabled = null !== (r = e.autopilotEnabled) && void 0 !== r && r),
            s
          );
        },
        fromAmino(e) {
          let o = nu();
          return (
            void 0 !== e.distributor && null !== e.distributor && (o.distributor = e.distributor),
            void 0 !== e.identifier && null !== e.identifier && (o.identifier = e.identifier),
            void 0 !== e.chain_id && null !== e.chain_id && (o.chainId = e.chain_id),
            void 0 !== e.denom && null !== e.denom && (o.denom = e.denom),
            void 0 !== e.start_time && null !== e.start_time && (o.startTime = BigInt(e.start_time)),
            void 0 !== e.duration && null !== e.duration && (o.duration = BigInt(e.duration)),
            void 0 !== e.autopilot_enabled && null !== e.autopilot_enabled && (o.autopilotEnabled = e.autopilot_enabled),
            o
          );
        },
        toAmino(e) {
          let o = {};
          return (
            (o.distributor = "" === e.distributor ? void 0 : e.distributor),
            (o.identifier = "" === e.identifier ? void 0 : e.identifier),
            (o.chain_id = "" === e.chainId ? void 0 : e.chainId),
            (o.denom = "" === e.denom ? void 0 : e.denom),
            (o.start_time = e.startTime !== BigInt(0) ? e.startTime.toString() : void 0),
            (o.duration = e.duration !== BigInt(0) ? e.duration.toString() : void 0),
            (o.autopilot_enabled = !1 === e.autopilotEnabled ? void 0 : e.autopilotEnabled),
            o
          );
        },
        fromAminoMsg: e => nc.fromAmino(e.value),
        fromProtoMsg: e => nc.decode(e.value),
        toProto: e => nc.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/stride.claim.MsgCreateAirdrop", value: nc.encode(e).finish() })
      };
      function ng() {
        return { distributor: "", identifier: "" };
      }
      let np = {
        typeUrl: "/stride.claim.MsgDeleteAirdrop",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.distributor && o.uint32(10).string(e.distributor), "" !== e.identifier && o.uint32(18).string(e.identifier), o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = ng();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.distributor = t.string();
                break;
              case 2:
                i.identifier = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t;
          let n = ng();
          return (
            (n.distributor = null !== (o = e.distributor) && void 0 !== o ? o : ""), (n.identifier = null !== (t = e.identifier) && void 0 !== t ? t : ""), n
          );
        },
        fromAmino(e) {
          let o = ng();
          return (
            void 0 !== e.distributor && null !== e.distributor && (o.distributor = e.distributor),
            void 0 !== e.identifier && null !== e.identifier && (o.identifier = e.identifier),
            o
          );
        },
        toAmino(e) {
          let o = {};
          return (o.distributor = "" === e.distributor ? void 0 : e.distributor), (o.identifier = "" === e.identifier ? void 0 : e.identifier), o;
        },
        fromAminoMsg: e => np.fromAmino(e.value),
        fromProtoMsg: e => np.decode(e.value),
        toProto: e => np.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/stride.claim.MsgDeleteAirdrop", value: np.encode(e).finish() })
      };
      function nf() {
        return { allocator: "", airdropIdentifier: "", users: [], weights: [] };
      }
      let nv = {
          typeUrl: "/stride.claim.MsgSetAirdropAllocations",
          encode(e, o = y.Lt.create()) {
            for (let t of ("" !== e.allocator && o.uint32(10).string(e.allocator),
            "" !== e.airdropIdentifier && o.uint32(18).string(e.airdropIdentifier),
            e.users))
              o.uint32(26).string(t);
            for (let t of e.weights) o.uint32(34).string(c.Decimal.fromUserInput(t, 18).atomics);
            return o;
          },
          decode(e, o) {
            let t = e instanceof y.oP ? e : new y.oP(e),
              n = void 0 === o ? t.len : t.pos + o,
              i = nf();
            for (; t.pos < n; ) {
              let e = t.uint32();
              switch (e >>> 3) {
                case 1:
                  i.allocator = t.string();
                  break;
                case 2:
                  i.airdropIdentifier = t.string();
                  break;
                case 3:
                  i.users.push(t.string());
                  break;
                case 4:
                  i.weights.push(c.Decimal.fromAtomics(t.string(), 18).toString());
                  break;
                default:
                  t.skipType(7 & e);
              }
            }
            return i;
          },
          fromPartial(e) {
            var o, t, n, i;
            let r = nf();
            return (
              (r.allocator = null !== (o = e.allocator) && void 0 !== o ? o : ""),
              (r.airdropIdentifier = null !== (t = e.airdropIdentifier) && void 0 !== t ? t : ""),
              (r.users = (null === (n = e.users) || void 0 === n ? void 0 : n.map(e => e)) || []),
              (r.weights = (null === (i = e.weights) || void 0 === i ? void 0 : i.map(e => e)) || []),
              r
            );
          },
          fromAmino(e) {
            var o, t;
            let n = nf();
            return (
              void 0 !== e.allocator && null !== e.allocator && (n.allocator = e.allocator),
              void 0 !== e.airdrop_identifier && null !== e.airdrop_identifier && (n.airdropIdentifier = e.airdrop_identifier),
              (n.users = (null === (o = e.users) || void 0 === o ? void 0 : o.map(e => e)) || []),
              (n.weights = (null === (t = e.weights) || void 0 === t ? void 0 : t.map(e => e)) || []),
              n
            );
          },
          toAmino(e) {
            let o = {};
            return (
              (o.allocator = "" === e.allocator ? void 0 : e.allocator),
              (o.airdrop_identifier = "" === e.airdropIdentifier ? void 0 : e.airdropIdentifier),
              e.users ? (o.users = e.users.map(e => e)) : (o.users = e.users),
              e.weights ? (o.weights = e.weights.map(e => e)) : (o.weights = e.weights),
              o
            );
          },
          fromAminoMsg: e => nv.fromAmino(e.value),
          fromProtoMsg: e => nv.decode(e.value),
          toProto: e => nv.encode(e).finish(),
          toProtoMsg: e => ({ typeUrl: "/stride.claim.MsgSetAirdropAllocations", value: nv.encode(e).finish() })
        },
        nA = {
          "/stride.claim.MsgSetAirdropAllocations": { aminoType: "/stride.claim.MsgSetAirdropAllocations", toAmino: nv.toAmino, fromAmino: nv.fromAmino },
          "/stride.claim.MsgClaimFreeAmount": { aminoType: "claim/ClaimFreeAmount", toAmino: nm.toAmino, fromAmino: nm.fromAmino },
          "/stride.claim.MsgCreateAirdrop": { aminoType: "/stride.claim.MsgCreateAirdrop", toAmino: nc.toAmino, fromAmino: nc.fromAmino },
          "/stride.claim.MsgDeleteAirdrop": { aminoType: "/stride.claim.MsgDeleteAirdrop", toAmino: np.toAmino, fromAmino: np.fromAmino }
        };
      function nk() {
        return { type: "", key: new Uint8Array(), data: new Uint8Array() };
      }
      let ny = {
        typeUrl: "/tendermint.crypto.ProofOp",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.type && o.uint32(10).string(e.type), 0 !== e.key.length && o.uint32(18).bytes(e.key), 0 !== e.data.length && o.uint32(26).bytes(e.data), o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = nk();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.type = t.string();
                break;
              case 2:
                i.key = t.bytes();
                break;
              case 3:
                i.data = t.bytes();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n;
          let i = nk();
          return (
            (i.type = null !== (o = e.type) && void 0 !== o ? o : ""),
            (i.key = null !== (t = e.key) && void 0 !== t ? t : new Uint8Array()),
            (i.data = null !== (n = e.data) && void 0 !== n ? n : new Uint8Array()),
            i
          );
        },
        fromAmino(e) {
          let o = nk();
          return (
            void 0 !== e.type && null !== e.type && (o.type = e.type),
            void 0 !== e.key && null !== e.key && (o.key = (0, el.jm)(e.key)),
            void 0 !== e.data && null !== e.data && (o.data = (0, el.jm)(e.data)),
            o
          );
        },
        toAmino(e) {
          let o = {};
          return (o.type = "" === e.type ? void 0 : e.type), (o.key = e.key ? (0, el.Uz)(e.key) : void 0), (o.data = e.data ? (0, el.Uz)(e.data) : void 0), o;
        },
        fromAminoMsg: e => ny.fromAmino(e.value),
        fromProtoMsg: e => ny.decode(e.value),
        toProto: e => ny.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/tendermint.crypto.ProofOp", value: ny.encode(e).finish() })
      };
      function nh() {
        return { ops: [] };
      }
      let nb = {
        typeUrl: "/tendermint.crypto.ProofOps",
        encode(e, o = y.Lt.create()) {
          for (let t of e.ops) ny.encode(t, o.uint32(10).fork()).ldelim();
          return o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = nh();
          for (; t.pos < n; ) {
            let e = t.uint32();
            e >>> 3 == 1 ? i.ops.push(ny.decode(t, t.uint32())) : t.skipType(7 & e);
          }
          return i;
        },
        fromPartial(e) {
          var o;
          let t = nh();
          return (t.ops = (null === (o = e.ops) || void 0 === o ? void 0 : o.map(e => ny.fromPartial(e))) || []), t;
        },
        fromAmino(e) {
          var o;
          let t = nh();
          return (t.ops = (null === (o = e.ops) || void 0 === o ? void 0 : o.map(e => ny.fromAmino(e))) || []), t;
        },
        toAmino(e) {
          let o = {};
          return e.ops ? (o.ops = e.ops.map(e => (e ? ny.toAmino(e) : void 0))) : (o.ops = e.ops), o;
        },
        fromAminoMsg: e => nb.fromAmino(e.value),
        fromProtoMsg: e => nb.decode(e.value),
        toProto: e => nb.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/tendermint.crypto.ProofOps", value: nb.encode(e).finish() })
      };
      function nP() {
        return { chainId: "", queryId: "", result: new Uint8Array(), proofOps: void 0, height: BigInt(0), fromAddress: "" };
      }
      let nI = {
          typeUrl: "/stride.interchainquery.v1.MsgSubmitQueryResponse",
          encode: (e, o = y.Lt.create()) => (
            "" !== e.chainId && o.uint32(10).string(e.chainId),
            "" !== e.queryId && o.uint32(18).string(e.queryId),
            0 !== e.result.length && o.uint32(26).bytes(e.result),
            void 0 !== e.proofOps && nb.encode(e.proofOps, o.uint32(34).fork()).ldelim(),
            e.height !== BigInt(0) && o.uint32(40).int64(e.height),
            "" !== e.fromAddress && o.uint32(50).string(e.fromAddress),
            o
          ),
          decode(e, o) {
            let t = e instanceof y.oP ? e : new y.oP(e),
              n = void 0 === o ? t.len : t.pos + o,
              i = nP();
            for (; t.pos < n; ) {
              let e = t.uint32();
              switch (e >>> 3) {
                case 1:
                  i.chainId = t.string();
                  break;
                case 2:
                  i.queryId = t.string();
                  break;
                case 3:
                  i.result = t.bytes();
                  break;
                case 4:
                  i.proofOps = nb.decode(t, t.uint32());
                  break;
                case 5:
                  i.height = t.int64();
                  break;
                case 6:
                  i.fromAddress = t.string();
                  break;
                default:
                  t.skipType(7 & e);
              }
            }
            return i;
          },
          fromPartial(e) {
            var o, t, n, i;
            let r = nP();
            return (
              (r.chainId = null !== (o = e.chainId) && void 0 !== o ? o : ""),
              (r.queryId = null !== (t = e.queryId) && void 0 !== t ? t : ""),
              (r.result = null !== (n = e.result) && void 0 !== n ? n : new Uint8Array()),
              (r.proofOps = void 0 !== e.proofOps && null !== e.proofOps ? nb.fromPartial(e.proofOps) : void 0),
              (r.height = void 0 !== e.height && null !== e.height ? BigInt(e.height.toString()) : BigInt(0)),
              (r.fromAddress = null !== (i = e.fromAddress) && void 0 !== i ? i : ""),
              r
            );
          },
          fromAmino(e) {
            let o = nP();
            return (
              void 0 !== e.chain_id && null !== e.chain_id && (o.chainId = e.chain_id),
              void 0 !== e.query_id && null !== e.query_id && (o.queryId = e.query_id),
              void 0 !== e.result && null !== e.result && (o.result = (0, el.jm)(e.result)),
              void 0 !== e.proof_ops && null !== e.proof_ops && (o.proofOps = nb.fromAmino(e.proof_ops)),
              void 0 !== e.height && null !== e.height && (o.height = BigInt(e.height)),
              void 0 !== e.from_address && null !== e.from_address && (o.fromAddress = e.from_address),
              o
            );
          },
          toAmino(e) {
            let o = {};
            return (
              (o.chain_id = "" === e.chainId ? void 0 : e.chainId),
              (o.query_id = "" === e.queryId ? void 0 : e.queryId),
              (o.result = e.result ? (0, el.Uz)(e.result) : void 0),
              (o.proof_ops = e.proofOps ? nb.toAmino(e.proofOps) : void 0),
              (o.height = e.height !== BigInt(0) ? e.height.toString() : void 0),
              (o.from_address = "" === e.fromAddress ? void 0 : e.fromAddress),
              o
            );
          },
          fromAminoMsg: e => nI.fromAmino(e.value),
          fromProtoMsg: e => nI.decode(e.value),
          toProto: e => nI.encode(e).finish(),
          toProtoMsg: e => ({ typeUrl: "/stride.interchainquery.v1.MsgSubmitQueryResponse", value: nI.encode(e).finish() })
        },
        nM = {
          "/stride.interchainquery.v1.MsgSubmitQueryResponse": {
            aminoType: "/stride.interchainquery.v1.MsgSubmitQueryResponse",
            toAmino: nI.toAmino,
            fromAmino: nI.fromAmino
          }
        };
      function nw() {
        return {
          name: "",
          address: "",
          weight: BigInt(0),
          delegation: "",
          slashQueryProgressTracker: "",
          slashQueryCheckpoint: "",
          sharesToTokensRate: "",
          delegationChangesInProgress: BigInt(0),
          slashQueryInProgress: !1
        };
      }
      let n_ = {
        typeUrl: "/stride.stakeibc.Validator",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.name && o.uint32(10).string(e.name),
          "" !== e.address && o.uint32(18).string(e.address),
          e.weight !== BigInt(0) && o.uint32(48).uint64(e.weight),
          "" !== e.delegation && o.uint32(42).string(e.delegation),
          "" !== e.slashQueryProgressTracker && o.uint32(74).string(e.slashQueryProgressTracker),
          "" !== e.slashQueryCheckpoint && o.uint32(98).string(e.slashQueryCheckpoint),
          "" !== e.sharesToTokensRate && o.uint32(82).string(c.Decimal.fromUserInput(e.sharesToTokensRate, 18).atomics),
          e.delegationChangesInProgress !== BigInt(0) && o.uint32(88).int64(e.delegationChangesInProgress),
          !0 === e.slashQueryInProgress && o.uint32(104).bool(e.slashQueryInProgress),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = nw();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.name = t.string();
                break;
              case 2:
                i.address = t.string();
                break;
              case 6:
                i.weight = t.uint64();
                break;
              case 5:
                i.delegation = t.string();
                break;
              case 9:
                i.slashQueryProgressTracker = t.string();
                break;
              case 12:
                i.slashQueryCheckpoint = t.string();
                break;
              case 10:
                i.sharesToTokensRate = c.Decimal.fromAtomics(t.string(), 18).toString();
                break;
              case 11:
                i.delegationChangesInProgress = t.int64();
                break;
              case 13:
                i.slashQueryInProgress = t.bool();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n, i, r, s, a;
          let l = nw();
          return (
            (l.name = null !== (o = e.name) && void 0 !== o ? o : ""),
            (l.address = null !== (t = e.address) && void 0 !== t ? t : ""),
            (l.weight = void 0 !== e.weight && null !== e.weight ? BigInt(e.weight.toString()) : BigInt(0)),
            (l.delegation = null !== (n = e.delegation) && void 0 !== n ? n : ""),
            (l.slashQueryProgressTracker = null !== (i = e.slashQueryProgressTracker) && void 0 !== i ? i : ""),
            (l.slashQueryCheckpoint = null !== (r = e.slashQueryCheckpoint) && void 0 !== r ? r : ""),
            (l.sharesToTokensRate = null !== (s = e.sharesToTokensRate) && void 0 !== s ? s : ""),
            (l.delegationChangesInProgress =
              void 0 !== e.delegationChangesInProgress && null !== e.delegationChangesInProgress
                ? BigInt(e.delegationChangesInProgress.toString())
                : BigInt(0)),
            (l.slashQueryInProgress = null !== (a = e.slashQueryInProgress) && void 0 !== a && a),
            l
          );
        },
        fromAmino(e) {
          let o = nw();
          return (
            void 0 !== e.name && null !== e.name && (o.name = e.name),
            void 0 !== e.address && null !== e.address && (o.address = e.address),
            void 0 !== e.weight && null !== e.weight && (o.weight = BigInt(e.weight)),
            void 0 !== e.delegation && null !== e.delegation && (o.delegation = e.delegation),
            void 0 !== e.slash_query_progress_tracker &&
              null !== e.slash_query_progress_tracker &&
              (o.slashQueryProgressTracker = e.slash_query_progress_tracker),
            void 0 !== e.slash_query_checkpoint && null !== e.slash_query_checkpoint && (o.slashQueryCheckpoint = e.slash_query_checkpoint),
            void 0 !== e.shares_to_tokens_rate && null !== e.shares_to_tokens_rate && (o.sharesToTokensRate = e.shares_to_tokens_rate),
            void 0 !== e.delegation_changes_in_progress &&
              null !== e.delegation_changes_in_progress &&
              (o.delegationChangesInProgress = BigInt(e.delegation_changes_in_progress)),
            void 0 !== e.slash_query_in_progress && null !== e.slash_query_in_progress && (o.slashQueryInProgress = e.slash_query_in_progress),
            o
          );
        },
        toAmino(e) {
          let o = {};
          return (
            (o.name = "" === e.name ? void 0 : e.name),
            (o.address = "" === e.address ? void 0 : e.address),
            (o.weight = e.weight !== BigInt(0) ? e.weight.toString() : void 0),
            (o.delegation = "" === e.delegation ? void 0 : e.delegation),
            (o.slash_query_progress_tracker = "" === e.slashQueryProgressTracker ? void 0 : e.slashQueryProgressTracker),
            (o.slash_query_checkpoint = "" === e.slashQueryCheckpoint ? void 0 : e.slashQueryCheckpoint),
            (o.shares_to_tokens_rate = "" === e.sharesToTokensRate ? void 0 : e.sharesToTokensRate),
            (o.delegation_changes_in_progress = e.delegationChangesInProgress !== BigInt(0) ? e.delegationChangesInProgress.toString() : void 0),
            (o.slash_query_in_progress = !1 === e.slashQueryInProgress ? void 0 : e.slashQueryInProgress),
            o
          );
        },
        fromAminoMsg: e => n_.fromAmino(e.value),
        fromProtoMsg: e => n_.decode(e.value),
        toProto: e => n_.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/stride.stakeibc.Validator", value: n_.encode(e).finish() })
      };
      function nS() {
        return { creator: "", amount: "", hostDenom: "" };
      }
      let nx = {
        typeUrl: "/stride.stakeibc.MsgLiquidStake",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.creator && o.uint32(10).string(e.creator),
          "" !== e.amount && o.uint32(18).string(e.amount),
          "" !== e.hostDenom && o.uint32(26).string(e.hostDenom),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = nS();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.creator = t.string();
                break;
              case 2:
                i.amount = t.string();
                break;
              case 3:
                i.hostDenom = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n;
          let i = nS();
          return (
            (i.creator = null !== (o = e.creator) && void 0 !== o ? o : ""),
            (i.amount = null !== (t = e.amount) && void 0 !== t ? t : ""),
            (i.hostDenom = null !== (n = e.hostDenom) && void 0 !== n ? n : ""),
            i
          );
        },
        fromAmino(e) {
          let o = nS();
          return (
            void 0 !== e.creator && null !== e.creator && (o.creator = e.creator),
            void 0 !== e.amount && null !== e.amount && (o.amount = e.amount),
            void 0 !== e.host_denom && null !== e.host_denom && (o.hostDenom = e.host_denom),
            o
          );
        },
        toAmino(e) {
          let o = {};
          return (
            (o.creator = "" === e.creator ? void 0 : e.creator),
            (o.amount = "" === e.amount ? void 0 : e.amount),
            (o.host_denom = "" === e.hostDenom ? void 0 : e.hostDenom),
            o
          );
        },
        fromAminoMsg: e => nx.fromAmino(e.value),
        toAminoMsg: e => ({ type: "stakeibc/LiquidStake", value: nx.toAmino(e) }),
        fromProtoMsg: e => nx.decode(e.value),
        toProto: e => nx.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/stride.stakeibc.MsgLiquidStake", value: nx.encode(e).finish() })
      };
      function nU() {
        return { creator: "", amount: "", hostZone: "", receiver: "" };
      }
      let nT = {
        typeUrl: "/stride.stakeibc.MsgRedeemStake",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.creator && o.uint32(10).string(e.creator),
          "" !== e.amount && o.uint32(18).string(e.amount),
          "" !== e.hostZone && o.uint32(26).string(e.hostZone),
          "" !== e.receiver && o.uint32(34).string(e.receiver),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = nU();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.creator = t.string();
                break;
              case 2:
                i.amount = t.string();
                break;
              case 3:
                i.hostZone = t.string();
                break;
              case 4:
                i.receiver = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n, i;
          let r = nU();
          return (
            (r.creator = null !== (o = e.creator) && void 0 !== o ? o : ""),
            (r.amount = null !== (t = e.amount) && void 0 !== t ? t : ""),
            (r.hostZone = null !== (n = e.hostZone) && void 0 !== n ? n : ""),
            (r.receiver = null !== (i = e.receiver) && void 0 !== i ? i : ""),
            r
          );
        },
        fromAmino(e) {
          let o = nU();
          return (
            void 0 !== e.creator && null !== e.creator && (o.creator = e.creator),
            void 0 !== e.amount && null !== e.amount && (o.amount = e.amount),
            void 0 !== e.host_zone && null !== e.host_zone && (o.hostZone = e.host_zone),
            void 0 !== e.receiver && null !== e.receiver && (o.receiver = e.receiver),
            o
          );
        },
        toAmino(e) {
          let o = {};
          return (
            (o.creator = "" === e.creator ? void 0 : e.creator),
            (o.amount = "" === e.amount ? void 0 : e.amount),
            (o.host_zone = "" === e.hostZone ? void 0 : e.hostZone),
            (o.receiver = "" === e.receiver ? void 0 : e.receiver),
            o
          );
        },
        fromAminoMsg: e => nT.fromAmino(e.value),
        toAminoMsg: e => ({ type: "stakeibc/RedeemStake", value: nT.toAmino(e) }),
        fromProtoMsg: e => nT.decode(e.value),
        toProto: e => nT.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/stride.stakeibc.MsgRedeemStake", value: nT.encode(e).finish() })
      };
      function nD() {
        return {
          connectionId: "",
          bech32prefix: "",
          hostDenom: "",
          ibcDenom: "",
          creator: "",
          transferChannelId: "",
          unbondingPeriod: BigInt(0),
          minRedemptionRate: "",
          maxRedemptionRate: "",
          lsmLiquidStakeEnabled: !1,
          communityPoolTreasuryAddress: "",
          maxMessagesPerIcaTx: BigInt(0)
        };
      }
      let nC = {
        typeUrl: "/stride.stakeibc.MsgRegisterHostZone",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.connectionId && o.uint32(18).string(e.connectionId),
          "" !== e.bech32prefix && o.uint32(98).string(e.bech32prefix),
          "" !== e.hostDenom && o.uint32(34).string(e.hostDenom),
          "" !== e.ibcDenom && o.uint32(42).string(e.ibcDenom),
          "" !== e.creator && o.uint32(50).string(e.creator),
          "" !== e.transferChannelId && o.uint32(82).string(e.transferChannelId),
          e.unbondingPeriod !== BigInt(0) && o.uint32(88).uint64(e.unbondingPeriod),
          "" !== e.minRedemptionRate && o.uint32(106).string(c.Decimal.fromUserInput(e.minRedemptionRate, 18).atomics),
          "" !== e.maxRedemptionRate && o.uint32(114).string(c.Decimal.fromUserInput(e.maxRedemptionRate, 18).atomics),
          !0 === e.lsmLiquidStakeEnabled && o.uint32(120).bool(e.lsmLiquidStakeEnabled),
          "" !== e.communityPoolTreasuryAddress && o.uint32(130).string(e.communityPoolTreasuryAddress),
          e.maxMessagesPerIcaTx !== BigInt(0) && o.uint32(136).uint64(e.maxMessagesPerIcaTx),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = nD();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 2:
                i.connectionId = t.string();
                break;
              case 12:
                i.bech32prefix = t.string();
                break;
              case 4:
                i.hostDenom = t.string();
                break;
              case 5:
                i.ibcDenom = t.string();
                break;
              case 6:
                i.creator = t.string();
                break;
              case 10:
                i.transferChannelId = t.string();
                break;
              case 11:
                i.unbondingPeriod = t.uint64();
                break;
              case 13:
                i.minRedemptionRate = c.Decimal.fromAtomics(t.string(), 18).toString();
                break;
              case 14:
                i.maxRedemptionRate = c.Decimal.fromAtomics(t.string(), 18).toString();
                break;
              case 15:
                i.lsmLiquidStakeEnabled = t.bool();
                break;
              case 16:
                i.communityPoolTreasuryAddress = t.string();
                break;
              case 17:
                i.maxMessagesPerIcaTx = t.uint64();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n, i, r, s, a, l, d, m;
          let u = nD();
          return (
            (u.connectionId = null !== (o = e.connectionId) && void 0 !== o ? o : ""),
            (u.bech32prefix = null !== (t = e.bech32prefix) && void 0 !== t ? t : ""),
            (u.hostDenom = null !== (n = e.hostDenom) && void 0 !== n ? n : ""),
            (u.ibcDenom = null !== (i = e.ibcDenom) && void 0 !== i ? i : ""),
            (u.creator = null !== (r = e.creator) && void 0 !== r ? r : ""),
            (u.transferChannelId = null !== (s = e.transferChannelId) && void 0 !== s ? s : ""),
            (u.unbondingPeriod = void 0 !== e.unbondingPeriod && null !== e.unbondingPeriod ? BigInt(e.unbondingPeriod.toString()) : BigInt(0)),
            (u.minRedemptionRate = null !== (a = e.minRedemptionRate) && void 0 !== a ? a : ""),
            (u.maxRedemptionRate = null !== (l = e.maxRedemptionRate) && void 0 !== l ? l : ""),
            (u.lsmLiquidStakeEnabled = null !== (d = e.lsmLiquidStakeEnabled) && void 0 !== d && d),
            (u.communityPoolTreasuryAddress = null !== (m = e.communityPoolTreasuryAddress) && void 0 !== m ? m : ""),
            (u.maxMessagesPerIcaTx = void 0 !== e.maxMessagesPerIcaTx && null !== e.maxMessagesPerIcaTx ? BigInt(e.maxMessagesPerIcaTx.toString()) : BigInt(0)),
            u
          );
        },
        fromAmino(e) {
          let o = nD();
          return (
            void 0 !== e.connection_id && null !== e.connection_id && (o.connectionId = e.connection_id),
            void 0 !== e.bech32prefix && null !== e.bech32prefix && (o.bech32prefix = e.bech32prefix),
            void 0 !== e.host_denom && null !== e.host_denom && (o.hostDenom = e.host_denom),
            void 0 !== e.ibc_denom && null !== e.ibc_denom && (o.ibcDenom = e.ibc_denom),
            void 0 !== e.creator && null !== e.creator && (o.creator = e.creator),
            void 0 !== e.transfer_channel_id && null !== e.transfer_channel_id && (o.transferChannelId = e.transfer_channel_id),
            void 0 !== e.unbonding_period && null !== e.unbonding_period && (o.unbondingPeriod = BigInt(e.unbonding_period)),
            void 0 !== e.min_redemption_rate && null !== e.min_redemption_rate && (o.minRedemptionRate = e.min_redemption_rate),
            void 0 !== e.max_redemption_rate && null !== e.max_redemption_rate && (o.maxRedemptionRate = e.max_redemption_rate),
            void 0 !== e.lsm_liquid_stake_enabled && null !== e.lsm_liquid_stake_enabled && (o.lsmLiquidStakeEnabled = e.lsm_liquid_stake_enabled),
            void 0 !== e.community_pool_treasury_address &&
              null !== e.community_pool_treasury_address &&
              (o.communityPoolTreasuryAddress = e.community_pool_treasury_address),
            void 0 !== e.max_messages_per_ica_tx && null !== e.max_messages_per_ica_tx && (o.maxMessagesPerIcaTx = BigInt(e.max_messages_per_ica_tx)),
            o
          );
        },
        toAmino(e) {
          let o = {};
          return (
            (o.connection_id = "" === e.connectionId ? void 0 : e.connectionId),
            (o.bech32prefix = "" === e.bech32prefix ? void 0 : e.bech32prefix),
            (o.host_denom = "" === e.hostDenom ? void 0 : e.hostDenom),
            (o.ibc_denom = "" === e.ibcDenom ? void 0 : e.ibcDenom),
            (o.creator = "" === e.creator ? void 0 : e.creator),
            (o.transfer_channel_id = "" === e.transferChannelId ? void 0 : e.transferChannelId),
            (o.unbonding_period = e.unbondingPeriod !== BigInt(0) ? e.unbondingPeriod.toString() : void 0),
            (o.min_redemption_rate = "" === e.minRedemptionRate ? void 0 : e.minRedemptionRate),
            (o.max_redemption_rate = "" === e.maxRedemptionRate ? void 0 : e.maxRedemptionRate),
            (o.lsm_liquid_stake_enabled = !1 === e.lsmLiquidStakeEnabled ? void 0 : e.lsmLiquidStakeEnabled),
            (o.community_pool_treasury_address = "" === e.communityPoolTreasuryAddress ? void 0 : e.communityPoolTreasuryAddress),
            (o.max_messages_per_ica_tx = e.maxMessagesPerIcaTx !== BigInt(0) ? e.maxMessagesPerIcaTx.toString() : void 0),
            o
          );
        },
        fromAminoMsg: e => nC.fromAmino(e.value),
        toAminoMsg: e => ({ type: "stakeibc/RegisterHostZone", value: nC.toAmino(e) }),
        fromProtoMsg: e => nC.decode(e.value),
        toProto: e => nC.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/stride.stakeibc.MsgRegisterHostZone", value: nC.encode(e).finish() })
      };
      function nB() {
        return { creator: "", hostZoneId: "", epoch: BigInt(0), receiver: "" };
      }
      let nN = {
        typeUrl: "/stride.stakeibc.MsgClaimUndelegatedTokens",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.creator && o.uint32(10).string(e.creator),
          "" !== e.hostZoneId && o.uint32(18).string(e.hostZoneId),
          e.epoch !== BigInt(0) && o.uint32(24).uint64(e.epoch),
          "" !== e.receiver && o.uint32(42).string(e.receiver),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = nB();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.creator = t.string();
                break;
              case 2:
                i.hostZoneId = t.string();
                break;
              case 3:
                i.epoch = t.uint64();
                break;
              case 5:
                i.receiver = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n;
          let i = nB();
          return (
            (i.creator = null !== (o = e.creator) && void 0 !== o ? o : ""),
            (i.hostZoneId = null !== (t = e.hostZoneId) && void 0 !== t ? t : ""),
            (i.epoch = void 0 !== e.epoch && null !== e.epoch ? BigInt(e.epoch.toString()) : BigInt(0)),
            (i.receiver = null !== (n = e.receiver) && void 0 !== n ? n : ""),
            i
          );
        },
        fromAmino(e) {
          let o = nB();
          return (
            void 0 !== e.creator && null !== e.creator && (o.creator = e.creator),
            void 0 !== e.host_zone_id && null !== e.host_zone_id && (o.hostZoneId = e.host_zone_id),
            void 0 !== e.epoch && null !== e.epoch && (o.epoch = BigInt(e.epoch)),
            void 0 !== e.receiver && null !== e.receiver && (o.receiver = e.receiver),
            o
          );
        },
        toAmino(e) {
          let o = {};
          return (
            (o.creator = "" === e.creator ? void 0 : e.creator),
            (o.host_zone_id = "" === e.hostZoneId ? void 0 : e.hostZoneId),
            (o.epoch = e.epoch !== BigInt(0) ? e.epoch.toString() : void 0),
            (o.receiver = "" === e.receiver ? void 0 : e.receiver),
            o
          );
        },
        fromAminoMsg: e => nN.fromAmino(e.value),
        toAminoMsg: e => ({ type: "stakeibc/ClaimUndelegatedTokens", value: nN.toAmino(e) }),
        fromProtoMsg: e => nN.decode(e.value),
        toProto: e => nN.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/stride.stakeibc.MsgClaimUndelegatedTokens", value: nN.encode(e).finish() })
      };
      function nE() {
        return { creator: "", hostZone: "", numRebalance: BigInt(0) };
      }
      let nO = {
        typeUrl: "/stride.stakeibc.MsgRebalanceValidators",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.creator && o.uint32(10).string(e.creator),
          "" !== e.hostZone && o.uint32(18).string(e.hostZone),
          e.numRebalance !== BigInt(0) && o.uint32(24).uint64(e.numRebalance),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = nE();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.creator = t.string();
                break;
              case 2:
                i.hostZone = t.string();
                break;
              case 3:
                i.numRebalance = t.uint64();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t;
          let n = nE();
          return (
            (n.creator = null !== (o = e.creator) && void 0 !== o ? o : ""),
            (n.hostZone = null !== (t = e.hostZone) && void 0 !== t ? t : ""),
            (n.numRebalance = void 0 !== e.numRebalance && null !== e.numRebalance ? BigInt(e.numRebalance.toString()) : BigInt(0)),
            n
          );
        },
        fromAmino(e) {
          let o = nE();
          return (
            void 0 !== e.creator && null !== e.creator && (o.creator = e.creator),
            void 0 !== e.host_zone && null !== e.host_zone && (o.hostZone = e.host_zone),
            void 0 !== e.num_rebalance && null !== e.num_rebalance && (o.numRebalance = BigInt(e.num_rebalance)),
            o
          );
        },
        toAmino(e) {
          let o = {};
          return (
            (o.creator = "" === e.creator ? void 0 : e.creator),
            (o.host_zone = "" === e.hostZone ? void 0 : e.hostZone),
            (o.num_rebalance = e.numRebalance !== BigInt(0) ? e.numRebalance.toString() : void 0),
            o
          );
        },
        fromAminoMsg: e => nO.fromAmino(e.value),
        toAminoMsg: e => ({ type: "stakeibc/RebalanceValidators", value: nO.toAmino(e) }),
        fromProtoMsg: e => nO.decode(e.value),
        toProto: e => nO.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/stride.stakeibc.MsgRebalanceValidators", value: nO.encode(e).finish() })
      };
      function nR() {
        return { creator: "", hostZone: "", validators: [] };
      }
      let nL = {
        typeUrl: "/stride.stakeibc.MsgAddValidators",
        encode(e, o = y.Lt.create()) {
          for (let t of ("" !== e.creator && o.uint32(10).string(e.creator), "" !== e.hostZone && o.uint32(18).string(e.hostZone), e.validators))
            n_.encode(t, o.uint32(26).fork()).ldelim();
          return o;
        },
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = nR();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.creator = t.string();
                break;
              case 2:
                i.hostZone = t.string();
                break;
              case 3:
                i.validators.push(n_.decode(t, t.uint32()));
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n;
          let i = nR();
          return (
            (i.creator = null !== (o = e.creator) && void 0 !== o ? o : ""),
            (i.hostZone = null !== (t = e.hostZone) && void 0 !== t ? t : ""),
            (i.validators = (null === (n = e.validators) || void 0 === n ? void 0 : n.map(e => n_.fromPartial(e))) || []),
            i
          );
        },
        fromAmino(e) {
          var o;
          let t = nR();
          return (
            void 0 !== e.creator && null !== e.creator && (t.creator = e.creator),
            void 0 !== e.host_zone && null !== e.host_zone && (t.hostZone = e.host_zone),
            (t.validators = (null === (o = e.validators) || void 0 === o ? void 0 : o.map(e => n_.fromAmino(e))) || []),
            t
          );
        },
        toAmino(e) {
          let o = {};
          return (
            (o.creator = "" === e.creator ? void 0 : e.creator),
            (o.host_zone = "" === e.hostZone ? void 0 : e.hostZone),
            e.validators ? (o.validators = e.validators.map(e => (e ? n_.toAmino(e) : void 0))) : (o.validators = e.validators),
            o
          );
        },
        fromAminoMsg: e => nL.fromAmino(e.value),
        fromProtoMsg: e => nL.decode(e.value),
        toProto: e => nL.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/stride.stakeibc.MsgAddValidators", value: nL.encode(e).finish() })
      };
      function nj() {
        return { creator: "", hostZone: "", valAddr: "" };
      }
      let nq = {
        typeUrl: "/stride.stakeibc.MsgDeleteValidator",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.creator && o.uint32(10).string(e.creator),
          "" !== e.hostZone && o.uint32(18).string(e.hostZone),
          "" !== e.valAddr && o.uint32(26).string(e.valAddr),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = nj();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.creator = t.string();
                break;
              case 2:
                i.hostZone = t.string();
                break;
              case 3:
                i.valAddr = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n;
          let i = nj();
          return (
            (i.creator = null !== (o = e.creator) && void 0 !== o ? o : ""),
            (i.hostZone = null !== (t = e.hostZone) && void 0 !== t ? t : ""),
            (i.valAddr = null !== (n = e.valAddr) && void 0 !== n ? n : ""),
            i
          );
        },
        fromAmino(e) {
          let o = nj();
          return (
            void 0 !== e.creator && null !== e.creator && (o.creator = e.creator),
            void 0 !== e.host_zone && null !== e.host_zone && (o.hostZone = e.host_zone),
            void 0 !== e.val_addr && null !== e.val_addr && (o.valAddr = e.val_addr),
            o
          );
        },
        toAmino(e) {
          let o = {};
          return (
            (o.creator = "" === e.creator ? void 0 : e.creator),
            (o.host_zone = "" === e.hostZone ? void 0 : e.hostZone),
            (o.val_addr = "" === e.valAddr ? void 0 : e.valAddr),
            o
          );
        },
        fromAminoMsg: e => nq.fromAmino(e.value),
        toAminoMsg: e => ({ type: "stakeibc/DeleteValidator", value: nq.toAmino(e) }),
        fromProtoMsg: e => nq.decode(e.value),
        toProto: e => nq.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/stride.stakeibc.MsgDeleteValidator", value: nq.encode(e).finish() })
      };
      function n$() {
        return { creator: "", chainId: "", connectionId: "", accountOwner: "" };
      }
      let nF = {
        typeUrl: "/stride.stakeibc.MsgRestoreInterchainAccount",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.creator && o.uint32(10).string(e.creator),
          "" !== e.chainId && o.uint32(18).string(e.chainId),
          "" !== e.connectionId && o.uint32(26).string(e.connectionId),
          "" !== e.accountOwner && o.uint32(34).string(e.accountOwner),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = n$();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.creator = t.string();
                break;
              case 2:
                i.chainId = t.string();
                break;
              case 3:
                i.connectionId = t.string();
                break;
              case 4:
                i.accountOwner = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n, i;
          let r = n$();
          return (
            (r.creator = null !== (o = e.creator) && void 0 !== o ? o : ""),
            (r.chainId = null !== (t = e.chainId) && void 0 !== t ? t : ""),
            (r.connectionId = null !== (n = e.connectionId) && void 0 !== n ? n : ""),
            (r.accountOwner = null !== (i = e.accountOwner) && void 0 !== i ? i : ""),
            r
          );
        },
        fromAmino(e) {
          let o = n$();
          return (
            void 0 !== e.creator && null !== e.creator && (o.creator = e.creator),
            void 0 !== e.chain_id && null !== e.chain_id && (o.chainId = e.chain_id),
            void 0 !== e.connection_id && null !== e.connection_id && (o.connectionId = e.connection_id),
            void 0 !== e.account_owner && null !== e.account_owner && (o.accountOwner = e.account_owner),
            o
          );
        },
        toAmino(e) {
          let o = {};
          return (
            (o.creator = "" === e.creator ? void 0 : e.creator),
            (o.chain_id = "" === e.chainId ? void 0 : e.chainId),
            (o.connection_id = "" === e.connectionId ? void 0 : e.connectionId),
            (o.account_owner = "" === e.accountOwner ? void 0 : e.accountOwner),
            o
          );
        },
        fromAminoMsg: e => nF.fromAmino(e.value),
        toAminoMsg: e => ({ type: "stakeibc/RestoreInterchainAccount", value: nF.toAmino(e) }),
        fromProtoMsg: e => nF.decode(e.value),
        toProto: e => nF.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/stride.stakeibc.MsgRestoreInterchainAccount", value: nF.encode(e).finish() })
      };
      function nV() {
        return { creator: "", chainId: "", valoper: "" };
      }
      let nZ = {
        typeUrl: "/stride.stakeibc.MsgUpdateValidatorSharesExchRate",
        encode: (e, o = y.Lt.create()) => (
          "" !== e.creator && o.uint32(10).string(e.creator),
          "" !== e.chainId && o.uint32(18).string(e.chainId),
          "" !== e.valoper && o.uint32(26).string(e.valoper),
          o
        ),
        decode(e, o) {
          let t = e instanceof y.oP ? e : new y.oP(e),
            n = void 0 === o ? t.len : t.pos + o,
            i = nV();
          for (; t.pos < n; ) {
            let e = t.uint32();
            switch (e >>> 3) {
              case 1:
                i.creator = t.string();
                break;
              case 2:
                i.chainId = t.string();
                break;
              case 3:
                i.valoper = t.string();
                break;
              default:
                t.skipType(7 & e);
            }
          }
          return i;
        },
        fromPartial(e) {
          var o, t, n;
          let i = nV();
          return (
            (i.creator = null !== (o = e.creator) && void 0 !== o ? o : ""),
            (i.chainId = null !== (t = e.chainId) && void 0 !== t ? t : ""),
            (i.valoper = null !== (n = e.valoper) && void 0 !== n ? n : ""),
            i
          );
        },
        fromAmino(e) {
          let o = nV();
          return (
            void 0 !== e.creator && null !== e.creator && (o.creator = e.creator),
            void 0 !== e.chain_id && null !== e.chain_id && (o.chainId = e.chain_id),
            void 0 !== e.valoper && null !== e.valoper && (o.valoper = e.valoper),
            o
          );
        },
        toAmino(e) {
          let o = {};
          return (
            (o.creator = "" === e.creator ? void 0 : e.creator),
            (o.chain_id = "" === e.chainId ? void 0 : e.chainId),
            (o.valoper = "" === e.valoper ? void 0 : e.valoper),
            o
          );
        },
        fromAminoMsg: e => nZ.fromAmino(e.value),
        toAminoMsg: e => ({ type: "stakeibc/UpdateValidatorSharesExchRate", value: nZ.toAmino(e) }),
        fromProtoMsg: e => nZ.decode(e.value),
        toProto: e => nZ.encode(e).finish(),
        toProtoMsg: e => ({ typeUrl: "/stride.stakeibc.MsgUpdateValidatorSharesExchRate", value: nZ.encode(e).finish() })
      };
      function nG() {
        return { creator: "", chainId: "", amount: "", channel: "" };
      }
      let nH = {
          typeUrl: "/stride.stakeibc.MsgClearBalance",
          encode: (e, o = y.Lt.create()) => (
            "" !== e.creator && o.uint32(10).string(e.creator),
            "" !== e.chainId && o.uint32(18).string(e.chainId),
            "" !== e.amount && o.uint32(26).string(e.amount),
            "" !== e.channel && o.uint32(34).string(e.channel),
            o
          ),
          decode(e, o) {
            let t = e instanceof y.oP ? e : new y.oP(e),
              n = void 0 === o ? t.len : t.pos + o,
              i = nG();
            for (; t.pos < n; ) {
              let e = t.uint32();
              switch (e >>> 3) {
                case 1:
                  i.creator = t.string();
                  break;
                case 2:
                  i.chainId = t.string();
                  break;
                case 3:
                  i.amount = t.string();
                  break;
                case 4:
                  i.channel = t.string();
                  break;
                default:
                  t.skipType(7 & e);
              }
            }
            return i;
          },
          fromPartial(e) {
            var o, t, n, i;
            let r = nG();
            return (
              (r.creator = null !== (o = e.creator) && void 0 !== o ? o : ""),
              (r.chainId = null !== (t = e.chainId) && void 0 !== t ? t : ""),
              (r.amount = null !== (n = e.amount) && void 0 !== n ? n : ""),
              (r.channel = null !== (i = e.channel) && void 0 !== i ? i : ""),
              r
            );
          },
          fromAmino(e) {
            let o = nG();
            return (
              void 0 !== e.creator && null !== e.creator && (o.creator = e.creator),
              void 0 !== e.chain_id && null !== e.chain_id && (o.chainId = e.chain_id),
              void 0 !== e.amount && null !== e.amount && (o.amount = e.amount),
              void 0 !== e.channel && null !== e.channel && (o.channel = e.channel),
              o
            );
          },
          toAmino(e) {
            let o = {};
            return (
              (o.creator = "" === e.creator ? void 0 : e.creator),
              (o.chain_id = "" === e.chainId ? void 0 : e.chainId),
              (o.amount = "" === e.amount ? void 0 : e.amount),
              (o.channel = "" === e.channel ? void 0 : e.channel),
              o
            );
          },
          fromAminoMsg: e => nH.fromAmino(e.value),
          toAminoMsg: e => ({ type: "still-no-defined", value: nH.toAmino(e) }),
          fromProtoMsg: e => nH.decode(e.value),
          toProto: e => nH.encode(e).finish(),
          toProtoMsg: e => ({ typeUrl: "/stride.stakeibc.MsgClearBalance", value: nH.encode(e).finish() })
        },
        nz = {
          "/stride.stakeibc.MsgLiquidStake": { aminoType: "stakeibc/LiquidStake", toAmino: nx.toAmino, fromAmino: nx.fromAmino },
          "/stride.stakeibc.MsgRedeemStake": { aminoType: "stakeibc/RedeemStake", toAmino: nT.toAmino, fromAmino: nT.fromAmino },
          "/stride.stakeibc.MsgRegisterHostZone": { aminoType: "stakeibc/RegisterHostZone", toAmino: nC.toAmino, fromAmino: nC.fromAmino },
          "/stride.stakeibc.MsgClaimUndelegatedTokens": { aminoType: "stakeibc/ClaimUndelegatedTokens", toAmino: nN.toAmino, fromAmino: nN.fromAmino },
          "/stride.stakeibc.MsgRebalanceValidators": { aminoType: "stakeibc/RebalanceValidators", toAmino: nO.toAmino, fromAmino: nO.fromAmino },
          "/stride.stakeibc.MsgAddValidators": { aminoType: "/stride.stakeibc.MsgAddValidators", toAmino: nL.toAmino, fromAmino: nL.fromAmino },
          "/stride.stakeibc.MsgDeleteValidator": { aminoType: "stakeibc/DeleteValidator", toAmino: nq.toAmino, fromAmino: nq.fromAmino },
          "/stride.stakeibc.MsgRestoreInterchainAccount": { aminoType: "stakeibc/RestoreInterchainAccount", toAmino: nF.toAmino, fromAmino: nF.fromAmino },
          "/stride.stakeibc.MsgUpdateValidatorSharesExchRate": {
            aminoType: "stakeibc/UpdateValidatorSharesExchRate",
            toAmino: nZ.toAmino,
            fromAmino: nZ.fromAmino
          },
          "/stride.stakeibc.MsgClearBalance": { aminoType: "still-no-defined", toAmino: nH.toAmino, fromAmino: nH.fromAmino }
        },
        nW = Object.assign(Object.assign(Object.assign({}, nA), nM), nz);
      var nY = t(23259),
        nJ = t(84317),
        nK = t(95238);
      let nQ = {
          ...na,
          "/osmosis.concentratedliquidity.poolmodel.concentrated.v1beta1.MsgCreateConcentratedPool": {
            ...na["/osmosis.concentratedliquidity.poolmodel.concentrated.v1beta1.MsgCreateConcentratedPool"],
            aminoType: "osmosis/cl-create-pool"
          },
          "/osmosis.valsetpref.v1beta1.MsgDelegateToValidatorSet": {
            ...na["/osmosis.valsetpref.v1beta1.MsgDelegateToValidatorSet"],
            aminoType: "osmosis/MsgDelegateToValidatorSet"
          },
          "/osmosis.valsetpref.v1beta1.MsgUndelegateFromValidatorSet": {
            ...na["/osmosis.valsetpref.v1beta1.MsgUndelegateFromValidatorSet"],
            aminoType: "osmosis/MsgUndelegateFromValidatorSet"
          }
        },
        nX = {
          ...om,
          "/ibc.applications.transfer.v1.MsgTransfer": {
            ...om["/ibc.applications.transfer.v1.MsgTransfer"],
            toAmino: e => {
              var o, t;
              let { sourcePort: n, sourceChannel: i, token: r, sender: s, receiver: a, timeoutHeight: l } = e;
              return {
                source_port: n,
                source_channel: i,
                token: { denom: null == r ? void 0 : r.denom, amount: (null == r ? void 0 : r.amount) ?? "0" },
                sender: s,
                receiver: a,
                timeout_height: l
                  ? {
                      revision_height: null === (o = l.revisionHeight) || void 0 === o ? void 0 : o.toString(),
                      revision_number: null === (t = l.revisionNumber) || void 0 === t ? void 0 : t.toString()
                    }
                  : {}
              };
            },
            fromAmino: e => {
              let { source_port: o, source_channel: t, token: n, sender: i, receiver: r, timeout_height: s, timeout_timestamp: a, memo: l = "" } = e;
              return {
                memo: l,
                sourcePort: o,
                sourceChannel: t,
                token: { denom: (null == n ? void 0 : n.denom) ?? "", amount: (null == n ? void 0 : n.amount) ?? "" },
                sender: i,
                receiver: r,
                timeoutHeight: s
                  ? { revisionHeight: nK.Z.fromString(s.revision_height || "0", !0), revisionNumber: nK.Z.fromString(s.revision_number || "0", !0) }
                  : void 0,
                timeoutTimestamp: nK.Z.fromString(a ?? "0")
              };
            }
          }
        },
        n0 = new p.AminoTypes({ ...eN, ...nX, ...nQ, ...e2, ...nW, ...A.r }),
        n1 = new g.Registry([...eE, ...nl, ...e3, ...ou, ...A.l]),
        n2 = [nY.x3, nY.s3, "swapfast.app"];
      function n3(e) {
        return n2.some(o => e.trim().toLowerCase().includes(o));
      }
      async function n4(e, o, t, n, i, r, s, a, l) {
        var d, m;
        if (n3(t)) return;
        let c = (0, v.Hum)({ authInfoBytes: e.signed.authInfoBytes, bodyBytes: e.signed.bodyBytes, signatures: [(0, u.fromBase64)(e.signature.signature)] });
        await s({
          txHash: c,
          txType: f.pb0.Dapp,
          metadata: { dapp_url: t, tx_message: o.map(e => (null == e ? void 0 : e.parsed) ?? e) },
          feeQuantity: null == n ? void 0 : null === (d = n.amount[0]) || void 0 === d ? void 0 : d.amount,
          feeDenomination: null == n ? void 0 : null === (m = n.amount[0]) || void 0 === m ? void 0 : m.denom,
          chain: i,
          chainId: a,
          address: r,
          network: l
        });
      }
      function n6(e, o) {
        let t = { messages: e.signed.msgs.map(e => n0.fromAmino(e)), memo: e.signed.memo, timeoutHeight: e.signed.timeout_height },
          n = n1.encode({ typeUrl: "/cosmos.tx.v1beta1.TxBody", value: t }),
          i = c.Int53.fromString(e.signed.fee.gas).toNumber(),
          r = c.Int53.fromString(e.signed.sequence).toNumber(),
          s = (0, g.encodePubkey)((0, d.encodeSecp256k1Pubkey)(o)),
          a = (0, g.makeAuthInfoBytes)(
            [{ pubkey: s, sequence: r }],
            e.signed.fee.amount,
            i,
            e.signed.fee.granter,
            e.signed.fee.payer,
            nJ.SignMode.SIGN_MODE_LEGACY_AMINO_JSON
          );
        return (0, v.Hum)({ authInfoBytes: a, bodyBytes: n, signatures: [(0, u.fromBase64)(e.signature.signature)] });
      }
      async function n8(e, o, t, n, i, r, s) {
        var a, l, d, m;
        if (n3(r) || e.signed.msgs.find(e => "query_permit" === e.type)) return;
        let u = n6(e, o);
        await t({
          txHash: u,
          txType: f.pb0.Dapp,
          metadata: { dapp_url: r, tx_message: e.signed.msgs },
          feeQuantity: null === (l = e.signed.fee) || void 0 === l ? void 0 : null === (a = l.amount[0]) || void 0 === a ? void 0 : a.amount,
          feeDenomination: null === (m = e.signed.fee) || void 0 === m ? void 0 : null === (d = m.amount[0]) || void 0 === d ? void 0 : d.denom,
          chain: n,
          chainId: e.signed.chain_id,
          address: i,
          network: s
        });
      }
      async function n7(e, o, t, n, i, r, s, a) {
        var l, d, c, g;
        if (n3(s)) return;
        let p = e.signed,
          A = (0, u.toBase64)(m.Secp256k1.compressPubkey(o)),
          y = {
            message: (0, v.dN$)(p.msgs),
            memo: p.memo,
            signMode: k.fk,
            pubKey: A,
            timeoutHeight: parseInt(p.timeout_height, 10),
            sequence: parseInt(p.sequence, 10),
            accountNumber: parseInt(p.account_number, 10),
            chainId: p.chain_id,
            fee: p.fee
          },
          { txRaw: h } = (0, k._X)(y),
          b = (0, v.N44)({ signature: e.signature.signature, ethereumChainId: parseInt(n ?? "1"), txRaw: h });
        await t({
          txHash: b,
          txType: f.pb0.Dapp,
          metadata: { dapp_url: s, tx_message: e.signed.msgs },
          feeQuantity: null === (d = e.signed.fee) || void 0 === d ? void 0 : null === (l = d.amount[0]) || void 0 === l ? void 0 : l.amount,
          feeDenomination: null === (g = e.signed.fee) || void 0 === g ? void 0 : null === (c = g.amount[0]) || void 0 === c ? void 0 : c.denom,
          chain: i,
          chainId: e.signed.chain_id,
          address: r,
          network: a
        });
      }
    },
    25053: function (e, o, t) {
      t.d(o, { z: () => m });
      var n = t(52322),
        i = t(91486),
        r = t(65903),
        s = t(2784),
        a = t(70514);
      let l = (0, s.forwardRef)((e, o) =>
        (0, n.jsx)("button", {
          ref: o,
          className: (0, a.cn)(
            "text-sm font-medium text-foreground transition-colors capitalize pb-3.5 rounded-full",
            i.YV,
            e.active ? "text-accent-green" : "text-secondary-700 hover:text-foreground",
            e.className
          ),
          onClick: e.onClick,
          "aria-label": `tab button in stake v2 flow ${e.children}`,
          children: (0, n.jsx)("span", { "aria-label": `tab button text in stake v2 flow ${e.children}`, children: e.children })
        })
      );
      l.displayName = "TabButton";
      let d = { transform: "translateX(0px) scaleX(0.441654)" },
        m = e => {
          var o;
          let { setSelectedTab: t, selectedIndex: i, buttons: s, buttonClassName: m, className: u, indicatorDefaultScale: c } = e,
            { containerRef: g, indicatorRef: p, childRefs: f } = (0, r.r)({ navItems: s, activeLabel: null === (o = s[i]) || void 0 === o ? void 0 : o.label });
          return (0, n.jsxs)("div", {
            ref: g,
            className: (0, a.cn)("relative flex items-center isolate gap-7", u),
            children: [
              s.map((e, o) =>
                (0, n.jsx)(
                  l,
                  {
                    ref: e => f.current.set(o, e),
                    active: o === i,
                    onClick: () => t(e),
                    className: m,
                    "aria-label": `tab button in stake v2 flow ${e.label}`,
                    children: (0, n.jsx)("span", { "aria-label": `tab button text in stake v2 flow ${e.label}`, children: e.label })
                  },
                  e.id ?? e.label
                )
              ),
              (0, n.jsx)("div", {
                className:
                  "absolute bottom-0 h-0.5 origin-left scale-0 translate-x-3 transition-transform duration-200 w-full rounded-[50vmin/10vmin] z-10 bg-accent-green",
                ref: p,
                style: c ?? d
              })
            ]
          });
        };
      m.displayName = "TabSelectors";
    },
    12499: function (e, o, t) {
      t.d(o, { h: () => n });
      let n = e => {
        var o;
        return (
          !!e &&
          (null == e
            ? void 0
            : null === (o = e.toLowerCase()) || void 0 === o
              ? void 0
              : o.includes("unable to connect to ledger device. please check if your ledger is connected and try again."))
        );
      };
    },
    7661: function (e, o, t) {
      t.d(o, { Sg: () => n });
      let n = e => btoa(String.fromCharCode.apply(null, e));
    }
  }
]);
//# sourceMappingURL=2929.js.map
