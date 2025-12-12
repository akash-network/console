!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      n = new e.Error().stack;
    n &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[n] = "5b21b99a-52f6-4e87-91e2-5fe4a6c7233b"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-5b21b99a-52f6-4e87-91e2-5fe4a6c7233b"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.23.1" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["1108"],
  {
    63400: function (e, n, t) {
      t.d(n, { u: () => i });
      var l = t(52322),
        s = t(71769);
      t(2784);
      var a = t(70514);
      function i(e) {
        let { className: n } = e;
        return (0, l.jsxs)("div", {
          className: (0, a.cn)("w-full flex flex-row items-start px-4 py-3 justify-start dark:bg-red-900 bg-red-100 rounded-2xl", n),
          children: [
            (0, l.jsx)(s.v, { weight: "fill", size: 20, className: "mr-2 text-destructive-100 p-[2px]" }),
            (0, l.jsxs)("div", {
              children: [
                (0, l.jsx)("p", { className: "text-sm text-foreground font-bold !leading-[20px]", children: "Unable to connect to ledger device" }),
                (0, l.jsx)("p", {
                  className: "text-xs text-secondary-800 font-medium !leading-[19px] mt-1",
                  children: "Please check if your ledger is connected and try again."
                })
              ]
            })
          ]
        });
      }
    },
    69332: function (e, n, t) {
      t.d(n, { Z: () => o });
      var l = t(52322),
        s = t(72779),
        a = t.n(s),
        i = t(2784);
      let o = e => {
        let { children: n, content: t, className: s } = e,
          [o, r] = (0, i.useState)(!1),
          d = (0, i.useRef)(null),
          c = (0, i.useRef)(null),
          u = () => {
            d.current && clearTimeout(d.current), r(!0);
          },
          m = () => {
            d.current = setTimeout(() => {
              r(!1);
            }, 250);
          };
        return (0, l.jsx)(l.Fragment, {
          children: i.cloneElement(
            n,
            { onMouseEnter: u, onMouseLeave: m, onTouchStart: u, onTouchEnd: m, onFocus: u, onBlur: m },
            (0, l.jsxs)(l.Fragment, {
              children: [
                n.props.children,
                o
                  ? (0, l.jsx)("div", {
                      ref: c,
                      tabIndex: 0,
                      className: a()(
                        "absolute top-6 left-0 max-h-[40vh] overflow-y-auto rounded-lg shadow p-2 min-w-[200px] z-50 bg-opacity-90 bg-white-100 dark:bg-black-100 border dark-gray-300 dark:border-gray-500 cursor-default",
                        s
                      ),
                      children: t
                    })
                  : null
              ]
            })
          )
        });
      };
    },
    54682: function (e, n, t) {
      t.d(n, { a: () => d });
      var l = t(52322),
        s = t(22764),
        a = t(72779),
        i = t.n(a),
        o = t(69816),
        r = t(2784);
      function d(e) {
        let {
            value: n,
            onChange: t,
            onClear: a,
            autoFocus: d = !1,
            placeholder: c,
            divClassName: u,
            inputClassName: m,
            inputDisabled: h,
            action: v,
            actionHandler: x,
            type: f = "text",
            ...g
          } = e,
          p = (0, r.useRef)(null);
        return (
          (0, r.useEffect)(() => {
            p.current &&
              d &&
              setTimeout(() => {
                var e;
                null === (e = p.current) || void 0 === e || e.focus();
              }, 100);
          }, [d]),
          (0, l.jsxs)("div", {
            className: i()({ "mx-auto w-[344px] mb-[16px] flex h-10 bg-white-100 dark:bg-gray-950 rounded-[30px] py-2 pl-5 pr-[10px]": !u, [u]: u }),
            ...g,
            children: [
              (0, l.jsx)("input", {
                placeholder: c,
                className: i()({ "flex flex-grow text-base text-gray-400 outline-none bg-white-0": !m, [m]: m }),
                value: n,
                onChange: t,
                ref: p,
                disabled: h,
                type: f
              }),
              0 === n.length
                ? v
                  ? (0, l.jsx)("div", {
                      onClick: x,
                      className: "capitalize text-xs dark:bg-gray-850 bg-gray-100 rounded-lg text-monochrome px-2.5 py-1 outline-none font-bold cursor-pointer",
                      children: v
                    })
                  : (0, l.jsx)(s.Y, { size: 18, className: "text-muted-foreground" })
                : v
                  ? (0, l.jsx)("div", {
                      onClick: a,
                      className: "capitalize text-xs dark:bg-gray-850 bg-gray-100 rounded-lg text-monochrome px-2.5 py-1 outline-none font-bold cursor-pointer",
                      children: "Clear"
                    })
                  : (0, l.jsx)("div", {
                      onClick: a,
                      children: (0, l.jsx)(o.Z, { size: "xs", color: "text-muted-foreground", className: " font-bold cursor-pointer", children: "Clear" })
                    })
            ]
          })
        );
      }
    },
    71517: function (e, n, t) {
      t.d(n, { X: () => i });
      var l = t(52322),
        s = t(30464);
      t(2784);
      var a = t(70514);
      function i(e) {
        let { checked: n, onClick: t, isWhite: i } = e;
        return (0, l.jsx)("div", {
          className: "w-[20px] h-[20px] rounded cursor-pointer flex justify-center items-center",
          onClick: t,
          children: n
            ? (0, l.jsx)("div", {
                className: "w-[15px] h-[15px] relative",
                children: (0, l.jsx)("img", {
                  src: i ? s.r.Misc.FilledRoundedSquareWhite : s.r.Misc.FilledRoundedSquareCheckMark,
                  className: "absolute inset-0"
                })
              })
            : (0, l.jsx)("div", { className: (0, a.cn)("w-[15px] h-[15px] rounded-[2px] border-[2px]", { "border-green-600": !i, "border-white-100": i }) })
        });
      }
    },
    46836: function (e, n, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(n, { A: () => u, L: () => m });
          var s = t(59145),
            a = t(92642),
            i = t(14506),
            o = t(76147),
            r = t(2784),
            d = e([o]);
          o = (d.then ? (await d)() : d)[0];
          let c = e => {
              if (e) {
                if ("bitcoin" === e.chain || "bitcoinSignet" === e.chain) return "btc";
                if (e.isEvm) return "evm";
                if (e.isAptos) return "aptos";
                if (e.isSolana) return "sol";
                if (e.isSui) return "sui";
              }
            },
            u = (e, n) => {
              let [t, l] = (0, r.useState)({}),
                [d, u] = (0, r.useState)(!0),
                { debounce: m } = (0, i.S)(),
                h = (0, r.useRef)(""),
                { selectedToken: v } = (0, o.GE)(),
                x = (0, r.useCallback)(
                  async e => {
                    h.current = e;
                    try {
                      u(!0), s.i_.setNetwork(n);
                      let t = await s.i_.resolveAll(e, { allowedTopLevelDomains: s.L, paymentIdEcosystem: e.includes("@") ? c(v) : void 0 });
                      h.current === e && l(t);
                    } catch (t) {
                      (0, a.Tb)(t, {
                        tags: {
                          errorType: "name_service_resolver_error",
                          source: "name_service_resolver",
                          severity: "error",
                          errorName: t instanceof Error ? t.name : "NameServiceResolverError"
                        },
                        fingerprint: ["name_service_resolver", "name_service_resolver_error"],
                        level: "error",
                        contexts: { transaction: { type: "name_service_resolver", errorMessage: t instanceof Error ? t.message : String(t) } },
                        extra: { queryAddress: e, network: n }
                      });
                    } finally {
                      h.current === e && u(!1);
                    }
                  },
                  [n, v]
                ),
                f = m(x, 200);
              return (
                (0, r.useEffect)(() => {
                  e && f(e);
                }, [e]),
                [d, t]
              );
            },
            m = {
              ibcDomains: "IBC Domains",
              icns: "Interchain Name Service",
              stargazeNames: "Stargaze Names",
              archIds: "Arch ID",
              spaceIds: "Space ID",
              sns: "SNS",
              nibId: "Nib ID",
              degeNS: "DegeNS",
              bdd: "BDD",
              celestialsId: "Celestials ID"
            };
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    11081: function (e, n, t) {
      t.d(n, { Z: () => o, g: () => i });
      var l = t(71659),
        s = t(2784),
        a = t(54525);
      let i = () => {
          let [e, n] = (0, s.useState)({}),
            [t, l] = (0, s.useState)(!0);
          return (
            (0, s.useEffect)(() => {
              let e = !1;
              return (
                a.o.subscribe(n),
                (async () => {
                  let t = await a.o.getAllEntries();
                  !e &&
                    (n(
                      Object.entries(t)
                        .filter(e => {
                          let [, n] = e;
                          return "injective" !== n.blockchain || ("injective" === n.blockchain && "" === n.ethAddress);
                        })
                        .reduce((e, n) => {
                          let [t, l] = n;
                          return (e[t] = l), e;
                        }, {})
                    ),
                    l(!1));
                })(),
                () => {
                  a.o.unsubscribe(n), (e = !0);
                }
              );
            }, []),
            { contacts: e, loading: t }
          );
        },
        o = e => {
          let { contacts: n, loading: t } = i();
          return (0, s.useMemo)(() => {
            if (t) return [];
            let s = Object.values(n),
              a = (null == e ? void 0 : e.trim().toLowerCase()) ?? "";
            return 0 === a.length ? s : new l.default(s, { threshold: 0.3, keys: ["name", "address", "ethAddress"] }).search(a).map(e => e.item);
          }, [n, t, e]);
        };
    },
    42560: function (e, n, t) {
      t.d(n, { Q: () => s });
      var l = t(2784);
      let s = e =>
        (0, l.useMemo)(() => {
          var n;
          if ((null == e ? void 0 : null === (n = e.trim()) || void 0 === n ? void 0 : n.length) === 0) return "";
          let t = parseFloat(e);
          return isNaN(t) ? "" : t.toString();
        }, [e]);
    },
    49728: function (e, n, t) {
      t.d(n, { U: () => d });
      var l = t(2784),
        s = t(10289),
        a = t(55736),
        i = t(48534),
        o = t(72565),
        r = t.n(o);
      let d = () => {
        let e = (0, s.s0)();
        return (0, l.useCallback)(async () => {
          let n = r().extension.getViews({ type: "popup" }),
            t = 0 === n.length && 600 === window.outerHeight && 400 === window.outerWidth,
            l = -1 !== n.findIndex(e => e === window);
          if (t || l || (0, i.oj)()) {
            if (!(0, i.oj)()) {
              let e = (await r().windows.getAll()).find(e => "popup" !== e.type);
              e && r().tabs.create({ url: r().runtime.getURL("index.html#/reconnect-ledger"), windowId: e.id }), window.close();
              return;
            }
            window.open("index.html#/reconnect-ledger", "_blank"), (0, a.I)();
          } else e("/reconnect-ledger");
        }, [e]);
      };
    },
    71693: function (e, n, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(n, { p: () => m });
          var s = t(20302),
            a = t(41172),
            i = t(79533),
            o = t(10706),
            r = t(65027),
            d = t(2784),
            c = t(48834).Buffer,
            u = e([o, r]);
          [o, r] = u.then ? (await u)() : u;
          let m = e => {
            let { activeWallet: n } = (0, o.ZP)(),
              t = r.w.useGetWallet(),
              { chains: l } = (0, a._IL)(),
              u = (0, a.a74)(),
              m = (0, d.useMemo)(() => e || u, [u, e]),
              h = (null == n ? void 0 : n.walletType) === a._KQ.LEDGER,
              v = (0, d.useCallback)(
                async (e, n) => {
                  var s;
                  let a = await t((null === (s = l[m]) || void 0 === s ? void 0 : s.key) ?? "");
                  if ("signDirect" in a) {
                    let t = await a.signDirect(e, n);
                    return { signature: new Uint8Array(c.from(t.signature.signature, "base64")), signed: t.signed };
                  }
                  throw Error("signDirect not supported");
                },
                [m, l, t]
              ),
              x = (0, d.useCallback)(
                async (e, n) => {
                  var s;
                  let a = await t((null === (s = l[m]) || void 0 === s ? void 0 : s.key) ?? "");
                  if ("signAmino" in a) {
                    let t = await a.signAmino(e, n);
                    return { signature: new Uint8Array(c.from(t.signature.signature, "base64")), signed: t.signed };
                  }
                  throw Error("signAmino not supported");
                },
                [m, l, t]
              ),
              f = (0, d.useMemo)(() => ({ signDirect: v, signAmino: x }), [x, v]);
            return {
              walletClient: (0, d.useMemo)(
                () => ({
                  enable: async () => {},
                  getAccount: async e => {
                    var t;
                    if (!n) throw Error("No active wallet");
                    let l = (await (0, i._d)())[e] ?? m,
                      a = n.addresses[l],
                      o = null === (t = n.pubKeys) || void 0 === t ? void 0 : t[l];
                    if (!a || !o) throw Error("No address or pubKey");
                    return { bech32Address: a, pubKey: (0, s.fromBase64)(o), isNanoLedger: h };
                  },
                  getSigner: async () => f
                }),
                [m, n, h, f]
              )
            };
          };
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    30942: function (e, n, t) {
      t.d(n, { X: () => o });
      var l = t(41172),
        s = t(92642),
        a = t(2784),
        i = t(37906);
      function o(e) {
        let { rpcUrl: n } = (0, l.U9i)();
        (0, a.useEffect)(() => {
          e &&
            !(
              e.includes("was submitted but was not yet found on the chain. You might want to check later. There was a wait of 60 seconds.") ||
              e.includes("Reward is too low")
            ) &&
            (e.includes("You don't have enough") || s.Tb(`${e} - node: ${n}`, { tags: i.rw }));
        }, [e, n]);
      }
    },
    58551: function (e, n, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(n, { E: () => r });
          var s = t(2784),
            a = t(22014),
            i = t(65027),
            o = e([i]);
          function r() {
            let e = i.w.useGetWallet();
            return (0, s.useCallback)(async () => {
              if (!a.M8.password) throw Error("Password not set");
              return await e();
            }, [e]);
          }
          (i = (o.then ? (await o)() : o)[0]), l();
        } catch (e) {
          l(e);
        }
      });
    },
    40853: function (e, n, t) {
      t.d(n, { N: () => s });
      var l = t(52322);
      t(2784);
      let s = e =>
        (0, l.jsxs)("svg", {
          width: "20",
          height: "20",
          viewBox: "0 0 20 20",
          fill: "none",
          xmlns: "http://www.w3.org/2000/svg",
          ...e,
          children: [
            (0, l.jsxs)("g", {
              clipPath: "url(#clip0_5714_14019)",
              children: [
                (0, l.jsx)("mask", {
                  id: "mask0_5714_14019",
                  style: { maskType: "alpha" },
                  maskUnits: "userSpaceOnUse",
                  x: "0",
                  y: "0",
                  width: "24",
                  height: "24",
                  children: (0, l.jsx)("rect", { width: "24", height: "24", fill: "currentColor" })
                }),
                (0, l.jsx)("g", {
                  mask: "url(#mask0_5714_14019)",
                  children: (0, l.jsx)("path", {
                    d: "M4.16667 15.7082C4.91667 14.9721 5.78819 14.3922 6.78125 13.9686C7.77431 13.545 8.84722 13.3332 10 13.3332C11.1528 13.3332 12.2257 13.545 13.2188 13.9686C14.2118 14.3922 15.0833 14.9721 15.8333 15.7082V4.99984H4.16667V15.7082ZM10 11.6665C9.19444 11.6665 8.50694 11.3818 7.9375 10.8123C7.36806 10.2429 7.08333 9.55539 7.08333 8.74984C7.08333 7.94428 7.36806 7.25678 7.9375 6.68734C8.50694 6.11789 9.19444 5.83317 10 5.83317C10.8056 5.83317 11.4931 6.11789 12.0625 6.68734C12.6319 7.25678 12.9167 7.94428 12.9167 8.74984C12.9167 9.55539 12.6319 10.2429 12.0625 10.8123C11.4931 11.3818 10.8056 11.6665 10 11.6665ZM4.16667 18.3332C3.70833 18.3332 3.31597 18.17 2.98958 17.8436C2.66319 17.5172 2.5 17.1248 2.5 16.6665V4.99984C2.5 4.5415 2.66319 4.14914 2.98958 3.82275C3.31597 3.49637 3.70833 3.33317 4.16667 3.33317H5V2.49984C5 2.26373 5.07986 2.06581 5.23958 1.90609C5.39931 1.74637 5.59722 1.6665 5.83333 1.6665C6.06944 1.6665 6.26736 1.74637 6.42708 1.90609C6.58681 2.06581 6.66667 2.26373 6.66667 2.49984V3.33317H13.3333V2.49984C13.3333 2.26373 13.4132 2.06581 13.5729 1.90609C13.7326 1.74637 13.9306 1.6665 14.1667 1.6665C14.4028 1.6665 14.6007 1.74637 14.7604 1.90609C14.9201 2.06581 15 2.26373 15 2.49984V3.33317H15.8333C16.2917 3.33317 16.684 3.49637 17.0104 3.82275C17.3368 4.14914 17.5 4.5415 17.5 4.99984V16.6665C17.5 17.1248 17.3368 17.5172 17.0104 17.8436C16.684 18.17 16.2917 18.3332 15.8333 18.3332H4.16667Z",
                    fill: "currentColor"
                  })
                })
              ]
            }),
            (0, l.jsx)("defs", {
              children: (0, l.jsx)("clipPath", { id: "clip0_5714_14019", children: (0, l.jsx)("rect", { width: "20", height: "20", fill: "currentColor" }) })
            })
          ]
        });
    },
    17844: function (e, n, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(n, { U: () => C, Z: () => k });
          var s,
            a = t(52322),
            i = t(56594),
            o = t(41172),
            r = t(89187),
            d = t(6391),
            c = t.n(d),
            u = t(72779),
            m = t.n(u),
            h = t(96217),
            v = t(69816),
            x = t(91486),
            f = t(30464),
            g = t(75958),
            p = t(2784),
            b = t(10289),
            y = t(85019),
            w = t(48346),
            j = t(71198),
            N = e([w, y]);
          [w, y] = N.then ? (await N)() : N;
          var C = (((s = {}).SEND = "Send"), (s.NFTSEND = "NFTSend"), s);
          let k = (0, g.Pi)(e => {
            let { isOpen: n, onClose: t, txType: l } = e,
              s = (0, b.s0)(),
              [d, u] = (0, p.useState)(""),
              { pendingTx: g, setPendingTx: N } = (0, o.EEe)(),
              C = o.rNU.useOperateCosmosTx(),
              { txStatus: k, txHash: S, sourceChain: I, sourceNetwork: D, toAddress: M, toChain: A, sentAmount: T, sentTokenInfo: E } = g ?? {},
              O = (0, o.a74)(),
              B = (0, p.useMemo)(() => I || O, [O, I]),
              _ = (0, o.obn)(),
              L = (0, p.useMemo)(() => D || _, [_, D]),
              z = (0, o.xxU)(B, L),
              Z = (0, o.SFn)(B),
              F = (0, p.useCallback)(() => {
                w.jZ.refetchBalances(B, L), M && w.jZ.refetchBalances(A ?? B, L, { [A ?? B]: M });
              }, [B, L, M, A]),
              P = (0, p.useMemo)(() => {
                switch (l) {
                  case "Send":
                    return {
                      title: "loading" === k ? "Transaction in progress" : "success" === k || "submitted" === k ? "Transfer successful!" : "Transfer failed",
                      subtite:
                        "loading" === k
                          ? "Tokens will be deposited in recipient’s account once the transaction is complete"
                          : "success" === k || "submitted" === k
                            ? `You sent ${(0, j.LH)(T ?? "", null == E ? void 0 : E.coinDenom)} to ${(0, j.MD)(M ?? "", 7, 3)}`
                            : ""
                    };
                  case "NFTSend":
                    return {
                      title: "loading" === k ? "Transfer in progress" : "success" === k || "submitted" === k ? "Transfer successful!" : "Transfer failed",
                      subtite:
                        "loading" === k
                          ? "NFT will be deposited in recipient’s account once the transaction is complete"
                          : "success" === k || "submitted" === k
                            ? "NFT has been deposited in recipient’s account"
                            : ""
                    };
                }
              }, [T, M, k, l]);
            (0, p.useEffect)(() => {
              let e = () => {
                F(), y.s.invalidateActivity(B);
              };
              g &&
                g.promise &&
                g.promise
                  .then(async n => {
                    var t, l, s, a, r, d, m, h, v, x;
                    if ("code" in n) n && (0, i.isDeliverTxSuccess)(n) ? N({ ...g, txStatus: "success" }) : N({ ...g, txStatus: "failed" });
                    else if ("cw20TokenTransfer" === g.txType) N({ ...g, txStatus: "success" });
                    else if ("status" in n) N({ ...g, txStatus: "submitted" });
                    else if ("result" in n) {
                      if (null == n ? void 0 : null === (l = n.result) || void 0 === l ? void 0 : null === (t = l.value) || void 0 === t ? void 0 : t.err)
                        N({ ...g, txStatus: "failed" });
                      else {
                        N({ ...g, txHash: null == n ? void 0 : n.signature, txStatus: "success" });
                        let e = (0, o.dSc)((null == g ? void 0 : g.toAddress) ?? "", {
                          amount: new (c())(g.sentAmount ?? "")
                            .times(10 ** ((null === (s = g.sentTokenInfo) || void 0 === s ? void 0 : s.coinDecimals) ?? 9))
                            .toString(),
                          denom: (null === (a = g.sentTokenInfo) || void 0 === a ? void 0 : a.coinMinimalDenom) ?? ""
                        });
                        C({
                          txHash: null == n ? void 0 : n.signature,
                          txType: o.pb0.Send,
                          metadata: e,
                          feeQuantity: g.feeQuantity,
                          feeDenomination: g.feeDenomination,
                          amount: g.txnLogAmount,
                          forceChain: B,
                          forceNetwork: L,
                          forceWalletAddress: Z,
                          chainId: z,
                          isSolana: !0
                        });
                      }
                    } else
                      "suiResult" in n
                        ? (null == n ? void 0 : null === (r = n.suiResult) || void 0 === r ? void 0 : r.status) === "success"
                          ? N({ ...g, txHash: null == n ? void 0 : null === (d = n.suiResult) || void 0 === d ? void 0 : d.txHash, txStatus: "success" })
                          : N({ ...g, txStatus: "failed" })
                        : "aptosResult" in n &&
                          ((null == n ? void 0 : null === (m = n.aptosResult) || void 0 === m ? void 0 : m.success) === !0
                            ? N({ ...g, txHash: null == n ? void 0 : null === (h = n.aptosResult) || void 0 === h ? void 0 : h.hash, txStatus: "success" })
                            : N({ ...g, txStatus: "failed" }));
                    "cw20TokenTransfer" === g.txType &&
                      (u(n.transactionHash),
                      C({
                        txHash: n.transactionHash,
                        txType: o.pb0.Send,
                        metadata: (0, o.dSc)((null == g ? void 0 : g.toAddress) ?? "", {
                          amount: new (c())(g.sentAmount ?? "")
                            .times(10 ** ((null === (v = g.sentTokenInfo) || void 0 === v ? void 0 : v.coinDecimals) ?? 6))
                            .toString(),
                          denom: (null === (x = g.sentTokenInfo) || void 0 === x ? void 0 : x.coinMinimalDenom) ?? ""
                        }),
                        feeQuantity: g.feeQuantity,
                        feeDenomination: g.feeDenomination,
                        amount: g.txnLogAmount,
                        forceChain: B,
                        forceNetwork: L,
                        forceWalletAddress: Z,
                        chainId: z
                      })),
                      e();
                  })
                  .catch(() => {
                    "cw20TokenTransfer" === g.txType ? N({ ...g, txStatus: "failed" }) : "send" === g.txType && N({ ...g, txStatus: "failed" }), e();
                  });
            }, [B, Z, L, z]),
              (0, p.useEffect)(() => {
                S && u(S);
              }, [S]);
            let { explorerTxnUrl: U } = (0, o.xGX)({ forceTxHash: d, forceChain: B, forceNetwork: L }),
              W = (0, p.useMemo)(() => {
                if (d) return U;
              }, [U, d]);
            return (0, a.jsxs)(h.Z, {
              title: "",
              fullScreen: !0,
              onClose: t,
              isOpen: n,
              containerClassName: "h-full",
              headerClassName: "dark:bg-gray-950 bg-white-100",
              className: "dark:bg-gray-950 bg-white-100 !p-0 min-h-[calc(100%-65px)]",
              children: [
                (0, a.jsxs)("div", {
                  className: "flex flex-col gap-y-8 justify-center items-center px-10 mt-[75px]",
                  children: [
                    (0, a.jsxs)("div", {
                      className: "h-[100px] w-[100px]",
                      children: [
                        "loading" === k &&
                          (0, a.jsx)("div", {
                            className: "h-[100px] w-[100px] p-8 rounded-full bg-secondary-200 animate-spin",
                            children: (0, a.jsx)("img", { src: f.r.Swap.Rotate })
                          }),
                        ("success" === k || "submitted" === k) &&
                          (0, a.jsx)("div", {
                            className: "h-[100px] w-[100px] p-8 rounded-full bg-green-400",
                            children: (0, a.jsx)("img", { src: f.r.Swap.CheckGreen })
                          }),
                        "failed" === k &&
                          (0, a.jsx)("div", {
                            className: "h-[100px] w-[100px] p-8 rounded-full bg-red-600 dark:bg-red-400",
                            children: (0, a.jsx)("img", { src: f.r.Swap.FailedRed })
                          })
                      ]
                    }),
                    (0, a.jsxs)("div", {
                      className: "flex flex-col items-center gap-y-6",
                      children: [
                        (0, a.jsxs)("div", {
                          className: "flex flex-col items-center gap-y-3",
                          children: [
                            (0, a.jsx)(v.Z, { size: "xl", color: "text-monochrome", className: "font-bold", children: P.title }),
                            P.subtite
                              ? (0, a.jsx)(v.Z, { size: "sm", color: "text-secondary-800", className: "font-normal text-center", children: P.subtite })
                              : null
                          ]
                        }),
                        W
                          ? (0, a.jsxs)("a", {
                              target: "_blank",
                              rel: "noreferrer",
                              href: W,
                              className: "flex font-medium items-center gap-1 text-sm text-accent-green hover:text-accent-green-200 transition-colors",
                              children: ["View transaction", (0, a.jsx)(r.T, { size: 12 })]
                            })
                          : null
                      ]
                    })
                  ]
                }),
                (0, a.jsxs)("div", {
                  className: " flex flex-row items-center justify-between gap-4 absolute bottom-0 left-0 right-0 p-6 max-[350px]:!px-4 !z-[1000]",
                  children: [
                    (0, a.jsx)(x.zx, {
                      className: "flex-1",
                      variant: "mono",
                      style: { boxShadow: "none" },
                      onClick: () => {
                        s("/home");
                      },
                      children: "Home"
                    }),
                    (0, a.jsx)(x.zx, {
                      className: m()("flex-1", { "cursor-no-drop": "success" !== k && "submitted" !== k }),
                      style: { boxShadow: "none" },
                      onClick: () => {
                        t("failed" !== k);
                      },
                      "aria-label": "send review transfer button text in send nft flow",
                      disabled: "success" !== k && "submitted" !== k,
                      children:
                        "failed" === k
                          ? "Try Again"
                          : (0, a.jsx)("span", { "aria-label": "send review transfer button text in send nft flow", children: "Transfer Again" })
                    })
                  ]
                })
              ]
            });
          });
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    60914: function (e, n, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(n, { j: () => E, v: () => O });
          var s = t(52322),
            a = t(41172),
            i = t(44658),
            o = t(75377),
            r = t(89187),
            d = t(62598),
            c = t(91859),
            u = t(72779),
            m = t.n(u),
            h = t(96217),
            v = t(69816),
            x = t(84916),
            f = t(74229),
            g = t(10706),
            p = t(38313),
            b = t(36400),
            y = t(11081),
            w = t(65027),
            j = t(30464),
            N = t(75958),
            C = t(76147),
            k = t(2784),
            S = t(26245),
            I = t(36321),
            D = t(70514),
            M = e([g, b, p, C, w, S]);
          [g, b, p, C, w, S] = M.then ? (await M)() : M;
          let E = (0, N.Pi)(e => {
            let { isOpen: n, onClose: t, chainList: l, wallet: c, address: u, forceName: v, setSelectedAddress: f } = e,
              [g, b] = (0, k.useState)(""),
              y = (0, p.ob)(),
              w = I.Ui.chainInfos,
              N = (0, k.useMemo)(() => {
                let e = [];
                e = l || Object.keys((null == c ? void 0 : c.addresses) ?? {});
                let n = "testnet" === y;
                return (e = e.filter(e => {
                  let t = w[e];
                  return !!t && !!t.enabled && (n ? !!t.testnetChainId : !t.testnetChainId || t.chainId !== t.testnetChainId);
                })).filter(e => w[e].chainName.toLowerCase().includes(g.toLowerCase()));
              }, [l, y, null == c ? void 0 : c.addresses, w, g]);
            return (0, s.jsx)(h.Z, {
              isOpen: n,
              onClose: t,
              fullScreen: !0,
              title: "Select chain",
              className: "!pb-0",
              direction: "right",
              hideActionButton: !0,
              secondaryActionButton: (0, s.jsx)(o.Buttons.Back, { onClick: t }),
              children: (0, s.jsxs)("div", {
                className: "flex flex-col items-start gap-7 p-2 h-full w-full",
                children: [
                  (0, s.jsx)("div", {
                    className: "flex flex-col items-center w-full",
                    children: (0, s.jsx)(x.M, { value: g, onChange: e => b(e.target.value), placeholder: "Search by chain name", onClear: () => b("") })
                  }),
                  (0, s.jsx)("div", {
                    className: "w-full h-full overflow-y-auto",
                    children:
                      N.length > 0
                        ? N.map((e, n) => {
                            var t;
                            N.length;
                            let l = w[e],
                              o =
                                u ||
                                ((null == l ? void 0 : l.evmOnlyChain)
                                  ? i.SZ.getEvmAddress(
                                      null == c ? void 0 : null === (t = c.pubKeys) || void 0 === t ? void 0 : t[null == l ? void 0 : l.key],
                                      !0
                                    )
                                  : null == c
                                    ? void 0
                                    : c.addresses[null == l ? void 0 : l.key]);
                            return (0, s.jsx)(
                              k.Fragment,
                              {
                                children: (0, s.jsx)("button", {
                                  className: m()(
                                    "w-full flex items-center gap-3 cursor-pointer px-4 py-3 mb-3 rounded-xl bg-secondary-100 hover:bg-secondary-200"
                                  ),
                                  onClick: () => {
                                    f({
                                      address: o,
                                      ethAddress: o,
                                      avatarIcon: (null == c ? void 0 : c.avatar) || j.r.Misc.getWalletIconAtIndex((null == c ? void 0 : c.colorIndex) ?? 0),
                                      chainIcon: "",
                                      chainName: e,
                                      emoji: void 0,
                                      name: `${c ? (c.name.length > 12 ? `${c.name.slice(0, 12)}...` : c.name) : v || (0, a.Hnh)(u)}`,
                                      selectionType: "currentWallet"
                                    });
                                  },
                                  children: (0, s.jsxs)("div", {
                                    className: "flex gap-4 items-center w-full",
                                    children: [
                                      (0, s.jsx)("img", { className: "h-10 w-10 rounded-full", src: l.chainSymbolImageUrl }),
                                      (0, s.jsxs)("div", {
                                        className: "flex flex-col grow",
                                        children: [
                                          (0, s.jsx)("p", { className: "font-bold text-left text-monochrome text-sm capitalize", children: l.chainName }),
                                          (0, s.jsx)("p", { className: "text-sm text-muted-foreground text-left", children: (0, a.Hnh)(o) })
                                        ]
                                      }),
                                      (0, s.jsx)(r.T, { className: "text-muted-foreground", size: 16 })
                                    ]
                                  })
                                })
                              },
                              e
                            );
                          })
                        : (0, s.jsxs)("div", {
                            className: "py-[80px] px-4 w-full flex-col flex  justify-center items-center gap-4",
                            children: [
                              (0, s.jsx)(d.Z, { size: 64, className: "dark:text-gray-50 text-gray-900 p-5 rounded-full bg-secondary-200" }),
                              (0, s.jsx)("div", {
                                className: "flex flex-col justify-start items-center w-full gap-3",
                                children: (0, s.jsx)("div", {
                                  className: "text-lg text-center font-bold !leading-[21.5px] dark:text-white-100",
                                  children: "No chains found"
                                })
                              })
                            ]
                          })
                  })
                ]
              })
            });
          });
          function A(e) {
            let { setSelectedAddress: n } = e,
              t = w.w.useWallets(),
              [l, i] = (0, k.useState)(null),
              { activeWallet: o } = (0, g.ZP)(),
              [r, c] = (0, k.useState)(!1),
              u = (0, k.useMemo)(
                () =>
                  t
                    ? Object.values(t)
                        .map(e => e)
                        .sort((e, n) => e.name.localeCompare(n.name))
                    : [],
                [t]
              ),
              m = (0, k.useCallback)(
                e => {
                  n(e), c(!1);
                },
                [n, c]
              ),
              h = (0, k.useCallback)(() => {
                i(null), c(!1);
              }, [i, c]);
            return (0, s.jsxs)(s.Fragment, {
              children: [
                (0, s.jsx)("div", {
                  className: "relative w-full h-[calc(100%-235px)]] overflow-auto",
                  children:
                    u.length > 0
                      ? u.map((e, n) => {
                          let t = n === u.length - 1,
                            l = "";
                          if (e.walletType === a._KQ.LEDGER) {
                            var r;
                            l = `Imported \xb7 ${null === (r = e.path) || void 0 === r ? void 0 : r.replace("m/44'/118'/", "")}`;
                          }
                          return (0, s.jsxs)(
                            k.Fragment,
                            {
                              children: [
                                (0, s.jsx)("button", {
                                  className: "w-full flex items-center gap-3 cursor-pointer mb-3 bg-secondary-100 hover:bg-secondary-200 px-4 py-3 rounded-xl",
                                  onClick: () => {
                                    i(e), c(!0);
                                  },
                                  "aria-label": "send wallet card button in send flow",
                                  children: (0, s.jsxs)("div", {
                                    className: "flex items-center",
                                    children: [
                                      (0, s.jsx)("div", {
                                        className: "flex items-center justify-center h-10 w-10 mr-3 shrink-0",
                                        children: (0, s.jsx)("img", {
                                          className: "h-9 w-9 rounded-full",
                                          src: e.avatar || j.r.Misc.getWalletIconAtIndex(e.colorIndex ?? 0)
                                        })
                                      }),
                                      (0, s.jsxs)("div", {
                                        className: "flex flex-col",
                                        children: [
                                          (0, s.jsxs)("div", {
                                            className: "flex items-center gap-2",
                                            children: [
                                              (0, s.jsx)("p", { className: "font-bold text-left text-monochrome text-sm capitalize", children: e.name }),
                                              o &&
                                                o.id === e.id &&
                                                (0, s.jsx)("p", {
                                                  className:
                                                    "font-bold text-left text-accent-green rounded-[4px] bg-accent-green/10 border border-accent-green/40 px-1.5 py-0.5 text-xs",
                                                  children: "Active"
                                                })
                                            ]
                                          }),
                                          (0, s.jsx)("p", { className: "text-sm text-muted-foreground text-left", children: l || "" })
                                        ]
                                      })
                                    ]
                                  })
                                }),
                                t && (0, s.jsx)("div", { className: "bg-transparent h-1" })
                              ]
                            },
                            e.id
                          );
                        })
                      : (0, s.jsxs)("div", {
                          className: "py-[80px] px-4 w-full flex-col flex  justify-center items-center gap-4",
                          children: [
                            (0, s.jsx)(d.Z, { size: 64, className: "dark:text-gray-50 text-gray-900 p-5 rounded-full bg-secondary-200" }),
                            (0, s.jsxs)("div", {
                              className: "flex flex-col justify-start items-center w-full gap-3",
                              children: [
                                (0, s.jsx)("div", {
                                  className: "text-lg text-center font-bold !leading-[21.5px] dark:text-white-100",
                                  children: "No wallets found"
                                }),
                                (0, s.jsx)("div", {
                                  className: "text-sm font-normal !leading-[22.4px] text-gray-400 dark:text-gray-400 text-center",
                                  children: "Use Leap’s in-wallet options to get started."
                                })
                              ]
                            })
                          ]
                        })
                }),
                (0, s.jsx)(E, { isOpen: r, onClose: h, setSelectedAddress: m, wallet: l ?? void 0 })
              ]
            });
          }
          function T(e) {
            let { handleContactSelect: n, editContact: t, minitiaChains: l } = e,
              [i, o] = (0, k.useState)(!1),
              r = (0, y.Z)(),
              u = (0, b.pb)(),
              { setMemo: m } = (0, C.GE)(),
              h = (0, f.a1)(),
              [v, x] = (0, k.useState)(null),
              g = (e, t) => {
                e.address.startsWith("init")
                  ? (x(e), o(!0))
                  : n({
                      avatarIcon: "",
                      chainIcon: t ?? "",
                      chainName: "",
                      name: e.name,
                      address: e.address,
                      ethAddress: e.ethAddress,
                      emoji: e.emoji,
                      selectionType: "saved"
                    }),
                  m(e.memo ?? "");
              },
              p = (0, k.useCallback)(() => {
                x(null), o(!1);
              }, [x, o]),
              w = (0, k.useCallback)(
                e => {
                  n({ ...e, selectionType: "saved" }), o(!1);
                },
                [n, o]
              );
            return (0, s.jsxs)(s.Fragment, {
              children: [
                (0, s.jsx)("div", {
                  className: "relative w-full h-full flex flex-col",
                  children:
                    r.length > 0
                      ? (0, s.jsxs)(s.Fragment, {
                          children: [
                            (0, s.jsx)("div", {
                              className: "w-full h-[calc(100%-84px)] overflow-auto flex flex-col pb-6",
                              children: r.map((e, n) => {
                                var l;
                                let i = (null === (l = u[e.blockchain]) || void 0 === l ? void 0 : l.chainSymbolImageUrl) ?? h,
                                  o = n === r.length - 1;
                                return (0, s.jsxs)(
                                  k.Fragment,
                                  {
                                    children: [
                                      (0, s.jsx)("button", {
                                        className: "w-full flex items-center gap-3 mb-3 bg-secondary-100 hover:bg-secondary-200 px-4 py-3 rounded-xl",
                                        onClick: () => g(e, i),
                                        "aria-label": "send contact card button in send flow",
                                        children: (0, s.jsxs)("div", {
                                          className: "flex justify-between items-center w-full",
                                          children: [
                                            (0, s.jsxs)("div", {
                                              className: "flex items-center",
                                              children: [
                                                (0, s.jsx)("div", {
                                                  className: "flex items-center justify-center h-10 w-10 mr-3 shrink-0",
                                                  children: (0, s.jsx)("img", { className: "h-9 w-9 rounded-full", src: j.r.Misc.getWalletIconAtIndex(0) })
                                                }),
                                                (0, s.jsxs)("div", {
                                                  className: "flex flex-col",
                                                  children: [
                                                    (0, s.jsx)("p", { className: "font-bold text-left text-monochrome text-sm capitalize", children: e.name }),
                                                    (0, s.jsx)("p", {
                                                      className: "text-sm text-muted-foreground",
                                                      children: (0, a.Hnh)(e.ethAddress ? e.ethAddress : e.address)
                                                    })
                                                  ]
                                                })
                                              ]
                                            }),
                                            (0, s.jsx)(c.R, {
                                              size: 34,
                                              weight: "fill",
                                              className:
                                                "bg-secondary-200 hover:bg-secondary-300 border rounded-full p-2.5 border-secondary-300 text-muted-foreground cursor-pointer",
                                              onClick: n => {
                                                n.stopPropagation(), t(e);
                                              },
                                              "aria-label": "send edit contact button in send flow"
                                            })
                                          ]
                                        })
                                      }),
                                      o && (0, s.jsx)("div", { className: "bg-transparent h-1" })
                                    ]
                                  },
                                  e.address
                                );
                              })
                            }),
                            (0, s.jsx)("div", {
                              className:
                                "text-sm font-bold py-3.5 !leading-[22.4px] text-muted-foreground border border-secondary-300 rounded-full text-center cursor-pointer",
                              onClick: e => {
                                e.stopPropagation(), t();
                              },
                              "aria-label": "send add new contact button in send flow",
                              children: (0, s.jsx)("span", { "aria-label": "send add new contact button text in send flow", children: "Add new contact" })
                            })
                          ]
                        })
                      : (0, s.jsxs)("div", {
                          className: "py-[80px] px-4 w-full flex-col flex  justify-center items-center gap-4",
                          children: [
                            (0, s.jsx)(d.Z, { size: 64, className: "dark:text-gray-50 text-gray-900 p-5 rounded-full bg-secondary-200" }),
                            (0, s.jsxs)("div", {
                              className: "flex flex-col justify-start items-center w-full gap-3",
                              children: [
                                (0, s.jsx)("div", {
                                  className: "text-lg text-center font-bold !leading-[21.5px] dark:text-white-100",
                                  children: "No contacts found"
                                }),
                                (0, s.jsx)("div", {
                                  className: "mt-2 text-sm font-medium !leading-[22.4px] text-accent-foreground text-center cursor-pointer",
                                  onClick: e => {
                                    e.stopPropagation(), t();
                                  },
                                  "aria-label": "send add new contact button in send flow",
                                  children: (0, s.jsx)("span", { "aria-label": "send add new contact button text in send flow", children: "+ Add new contact" })
                                })
                              ]
                            })
                          ]
                        })
                }),
                (0, s.jsx)(E, { isOpen: i, onClose: p, chainList: l, address: null == v ? void 0 : v.address, setSelectedAddress: w })
              ]
            });
          }
          let O = (0, N.Pi)(e => {
            let { isOpen: n, onClose: t, editContact: l, postSelectRecipient: a } = e,
              [i, o] = (0, k.useState)("contacts"),
              { contacts: r, loading: d } = (0, y.g)(),
              c = (0, p.ob)(),
              { setEthAddress: u, selectedAddress: m, setSelectedAddress: x, setAddressError: f, setMemo: g, setCustomIbcChannelId: b } = (0, C.GE)(),
              j = w.w.useWallets(),
              N = (0, k.useMemo)(
                () =>
                  j
                    ? Object.values(j)
                        .map(e => e)
                        .sort((e, n) =>
                          e.createdAt && n.createdAt ? new Date(e.createdAt).getTime() - new Date(n.createdAt).getTime() : e.name.localeCompare(n.name)
                        )
                    : [],
                [j]
              ),
              M = I.Ui.chainInfos,
              E = S.VH.chainFeatureFlagsData,
              O = (0, k.useMemo)(() => {
                let e = [];
                return (
                  Object.keys(E)
                    .filter(e => "minitia" === E[e].chainType)
                    .forEach(n => {
                      M[n] && e.push(M[n]);
                      let t = Object.values(I.Ui.chainInfos).find(e =>
                        "testnet" === c ? (null == e ? void 0 : e.testnetChainId) === n : (null == e ? void 0 : e.chainId) === n
                      );
                      t && e.push(t);
                    }),
                  e
                );
              }, [E, M, c]),
              B = (0, k.useCallback)(
                e => {
                  f(void 0), x(e), u(e.ethAddress ?? ""), a(), t();
                },
                [f, u, x, t, a]
              ),
              _ = (0, k.useCallback)(
                e => {
                  f(void 0), x(e), u(e.ethAddress ?? ""), g(""), a(), t();
                },
                [f, u, g, x, t, a]
              );
            return (
              (0, k.useEffect)(() => {
                (null == m ? void 0 : m.chainName) && b(void 0);
              }, [null == m ? void 0 : m.chainName, b]),
              (0, k.useEffect)(() => {
                d || 0 !== Object.keys(r).length || o("wallets");
              }, [r, d]),
              (0, s.jsx)(s.Fragment, {
                children: (0, s.jsx)(h.Z, {
                  isOpen: n,
                  onClose: t,
                  fullScreen: !0,
                  title: "Address Book",
                  className: "h-full",
                  children: (0, s.jsx)("div", {
                    className: "flex flex-col items-start gap-6 w-full h-full",
                    children: (0, s.jsxs)(s.Fragment, {
                      children: [
                        0 === Object.values(r).length && 0 === N.length
                          ? null
                          : 0 === N.length
                            ? (0, s.jsx)(v.Z, { className: "font-bold mt-2", color: "text-muted-foreground", size: "xs", children: "Contacts" })
                            : (0, s.jsxs)("div", {
                                className: "flex gap-2.5 mt-2",
                                children: [
                                  (0, s.jsx)("div", {
                                    className: (0, D.cn)("font-medium text-xs border bg-secondary py-2 px-4 hover:border-secondary-400 cursor-pointer", {
                                      "text-monochrome !border-monochrome rounded-full": "contacts" === i,
                                      "text-muted-foreground border-transparent rounded-full": "contacts" !== i
                                    }),
                                    onClick: () => o("contacts"),
                                    "aria-label": "send select recipient contacts button in send flow",
                                    children: (0, s.jsx)("span", {
                                      "aria-label": "send select recipient contacts button text in send flow",
                                      children: "Your contacts"
                                    })
                                  }),
                                  (0, s.jsx)("div", {
                                    className: (0, D.cn)("font-medium text-xs border bg-secondary py-2 px-4 hover:border-secondary-400 cursor-pointer", {
                                      "text-monochrome !border-monochrome rounded-full": "wallets" === i,
                                      "text-muted-foreground border-transparent rounded-full": "wallets" !== i
                                    }),
                                    onClick: () => o("wallets"),
                                    "aria-label": "send select recipient wallets button in send flow",
                                    children: (0, s.jsx)("span", {
                                      "aria-label": "send select recipient wallets button text in send flow",
                                      children: "Your wallets"
                                    })
                                  })
                                ]
                              }),
                        "wallets" === i
                          ? (0, s.jsx)(A, { setSelectedAddress: _ })
                          : (0, s.jsx)(T, { handleContactSelect: B, editContact: l, minitiaChains: O.map(e => e.key) })
                      ]
                    })
                  })
                })
              })
            );
          });
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    41325: function (e, n, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(n, { Z: () => h });
          var s = t(52322),
            a = t(41172),
            i = t(72779),
            o = t.n(i),
            r = t(54682),
            d = t(76147),
            c = t(2784),
            u = t(74713),
            m = e([d]);
          d = (m.then ? (await m)() : m)[0];
          let h = e => {
            let { options: n, selectedOption: t, onChange: l, className: i, isAddChannel: m, hasChannelId: h, targetChain: v, themeColor: x } = e,
              [f, g] = (0, c.useState)(""),
              [p, b] = (0, c.useState)("idle"),
              [y, w] = (0, c.useState)(""),
              j = "" !== f && "success" === p,
              { sendActiveChain: N } = (0, d.GE)(),
              { chains: C } = (0, a._IL)(),
              k = C[N],
              S = (0, c.useCallback)(
                async e => {
                  b("loading");
                  try {
                    let n = await u.MQ.addCustomChannel(N, v, e);
                    n.success ? (l(n.channel), b("success")) : b("error"), w(n.message);
                  } catch (e) {
                    b("error"), w("Something went wrong");
                  }
                },
                [l, N, v]
              );
            return (
              (0, c.useEffect)(() => {
                f ? S(f) : (b("idle"), w(""));
              }, [f]),
              (0, s.jsxs)("fieldset", {
                className: o()("flex flex-col", i),
                children: [
                  n.map(e => {
                    let n = t === e.value;
                    return (0, s.jsxs)(
                      "label",
                      {
                        className: `inline-flex items-center  ${e.subTitle ? "py-2 last-of-type:pb-0" : "py-3 last-of-type:pb-0"}`,
                        children: [
                          (0, s.jsx)("input", { type: "radio", value: e.value, checked: n, readOnly: !0, className: "hidden" }),
                          (0, s.jsx)("div", {
                            "aria-label": "radio-button",
                            className: o()("w-5 h-5 rounded-full border-[2px] flex items-center justify-center cursor-pointer border-gray-300 transition-all", {
                              "shadow-sm": n
                            }),
                            style: { borderColor: n ? x : void 0 },
                            tabIndex: 0,
                            onClick: () => {
                              l(e.value), g("");
                            },
                            onKeyDown: t => {
                              ("Enter" !== t.key && " " !== t.key) || n || l(e.value);
                            },
                            children: (0, s.jsx)("div", {
                              className: "w-[10px] h-[10px] rounded-full bg-gray-300 transition-all",
                              style: { backgroundColor: n ? x : void 0, opacity: +!!n }
                            })
                          }),
                          (0, s.jsxs)("div", {
                            className: "flex flex-col ml-3",
                            children: [
                              (0, s.jsx)("p", { className: "text-foreground font-medium text-sm", children: e.title }),
                              e.subTitle ? (0, s.jsx)("p", { className: "text-muted-foreground text-xs", children: e.subTitle }) : null
                            ]
                          })
                        ]
                      },
                      e.value
                    );
                  }),
                  (m || !h) &&
                    (0, s.jsx)("label", {
                      className: "inline-flex items-center py-1",
                      children: (0, s.jsxs)("div", {
                        className: "flex flex-col w-full",
                        children: [
                          (0, s.jsxs)("div", {
                            className: "flex w-full items-center gap-3",
                            children: [
                              (0, s.jsx)("input", { type: "radio", value: f, checked: j, readOnly: !0, className: "hidden" }),
                              (0, s.jsx)("div", {
                                "aria-label": "radio-button",
                                className: o()(
                                  "w-5 h-5 rounded-full border-[2px] flex items-center justify-center cursor-pointer border-gray-300 transition-all",
                                  { "shadow-sm": j }
                                ),
                                style: { borderColor: j ? x : void 0 },
                                tabIndex: 0,
                                onKeyDown: e => {
                                  ("Enter" !== e.key && " " !== e.key) || f || g(f);
                                },
                                children: (0, s.jsx)("div", {
                                  className: "w-[10px] h-[10px] rounded-full bg-gray-300 transition-all",
                                  style: { backgroundColor: j ? x : void 0, opacity: +!!j }
                                })
                              }),
                              (0, s.jsx)(r.a, {
                                value: f,
                                onChange: e => {
                                  g(e.target.value), "error" === p && (b("idle"), w(""));
                                },
                                type: "number",
                                onClear: () => g(""),
                                placeholder: "Enter source channel ID",
                                divClassName:
                                  "rounded-2xl flex-grow flex items-center gap-[10px] bg-gray-50 dark:bg-gray-900 py-3 pr-3 pl-4 dark:focus-within:border-white-100 hover:border-secondary-400 focus-within:border-black-100 border border-transparent",
                                inputClassName:
                                  "flex flex-grow text-base text-gray-400 outline-none bg-white-0 font-bold dark:text-white-100 text-md placeholder:font-medium dark:placeholder:text-gray-400  !leading-[21px]"
                              })
                            ]
                          }),
                          (0, s.jsxs)("p", {
                            className: "text-xs mt-2 dark:text-gray-400 text-gray-600",
                            children: [
                              "You can enter ",
                              (0, s.jsx)("span", { className: "font-medium dark:text-gray-200 text-gray-800", children: "24" }),
                              " ",
                              "for ",
                              (0, s.jsx)("span", { className: "font-medium dark:text-gray-200 text-gray-800", children: "channel-24" }),
                              " ",
                              "on ",
                              k.chainName
                            ]
                          }),
                          "error" === p ? (0, s.jsx)("p", { className: "text-xs mt-2 text-red-300 font-medium", children: y }) : null,
                          "success" === p ? (0, s.jsx)("p", { className: "text-xs mt-2 text-green-300 font-medium", children: y }) : null
                        ]
                      })
                    })
                ]
              })
            );
          };
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    75478: function (e, n, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(n, { Z: () => k });
          var s = t(52322),
            a = t(41172),
            i = t(6809),
            o = t(75377),
            r = t(36906),
            d = t(71769),
            c = t(29049),
            u = t(93958),
            m = t(72779),
            h = t.n(m),
            v = t(69332),
            x = t(71517),
            f = t(19623),
            g = t(96217),
            p = t(69816),
            b = t(76147),
            y = t(2784),
            w = t(74713),
            j = t(46103),
            N = t(41325),
            C = e([b, N]);
          [b, N] = C.then ? (await C)() : C;
          let k = e => {
            var n;
            let { targetChain: t, sourceChain: l } = e,
              [m, C] = (0, y.useState)(!1),
              [k, S] = (0, y.useState)(null),
              [I, D] = (0, y.useState)(!1),
              [M, A] = (0, y.useState)(!1),
              [T, E] = (0, y.useState)(),
              { theme: O } = (0, o.useTheme)(),
              { chains: B } = (0, a._IL)(),
              _ = B[l],
              L = B[t],
              z = w.MQ.getCustomChannels(l),
              Z = w.MQ.getSourceChainChannelId(l, t),
              { transferData: F, setIsIbcUnwindingDisabled: P, customIbcChannelId: U, setCustomIbcChannelId: W } = (0, b.GE)(),
              G = (0, y.useMemo)(
                () =>
                  (null == F ? void 0 : F.isSkipTransfer) && (null == F ? void 0 : F.routeResponse)
                    ? { ...(null == F ? void 0 : F.routeResponse), messages: null == F ? void 0 : F.messages }
                    : { operations: [], messages: [], sourceAsset: { denom: null } },
                [null == F ? void 0 : F.isSkipTransfer, null == F ? void 0 : F.messages, null == F ? void 0 : F.routeResponse]
              ),
              { groupedTransactions: R } = (0, i.nC)(G),
              H = [];
            null === (n = Object.values(R)) ||
              void 0 === n ||
              n.forEach((e, n) => {
                e.forEach((e, t) => {
                  0 == n && 0 == t && H.push(e.sourceChain), H.push(e.destinationChain);
                });
              }),
              (0, y.useEffect)(() => {
                Z ? S(Z) : S(void 0);
              }, [Z]);
            let $ = (0, y.useCallback)(() => {
                C(e => !e);
              }, [C]),
              V = (0, y.useCallback)(
                e => {
                  e === T && void 0 !== T ? E(void 0) : E(e);
                },
                [T, E]
              ),
              K = (0, y.useMemo)(
                () =>
                  z
                    .filter(e => {
                      let { counterPartyChain: n } = e;
                      return n === t;
                    })
                    .map(e => {
                      let { channelId: n } = e;
                      return { title: n, subTitle: "Custom channel", value: n };
                    })
                    .sort((e, n) => e.title.localeCompare(n.title)),
                [z, t]
              ),
              J = (0, y.useMemo)(() => (k ? [{ title: k, subTitle: "Prefetched from Cosmos directory registry", value: k }, ...K] : K), [K, k]),
              Q = J.length > 0,
              q = (0, y.useCallback)(() => {
                Q && (A(e => !e), E(void 0));
              }, [Q, A]);
            return (0, s.jsxs)(s.Fragment, {
              children: [
                (0, s.jsxs)("div", {
                  className: h()("p-4 rounded-2xl bg-red-100 dark:bg-red-900 items-center flex gap-2", { "bg-orange-200 dark:bg-orange-900": U }),
                  children: [
                    U
                      ? (0, s.jsx)(r.k, { size: 16, className: h()("text-[#FFB33D] dark:text-orange-300 self-start") })
                      : (0, s.jsx)(d.v, { size: 16, className: h()("text-red-400 dark:text-red-300 self-start") }),
                    (0, s.jsxs)("div", {
                      className: "flex-1",
                      children: [
                        (0, s.jsx)(p.Z, { size: "xs", className: "font-bold mb-2", children: U ? "Unverified Channel" : "No verified routes available." }),
                        (0, s.jsx)(p.Z, {
                          size: "xs",
                          color: "text-gray-800 dark:text-gray-200",
                          className: "font-medium",
                          children: U || (Q ? "You can select channels from an unverified list to transfer." : "You can add a custom channel to transfer.")
                        })
                      ]
                    }),
                    (0, s.jsx)("button", {
                      title: `${Q ? "Select" : "Add"} channel`,
                      onClick: $,
                      className: "text-xs font-bold text-black-100 bg-white-100 py-2 px-4 rounded-3xl",
                      "aria-label": "send ibc settings edit selection button in send flow",
                      children: U ? "Edit selection" : Q ? "Select channel" : "Add channel"
                    })
                  ]
                }),
                (0, s.jsxs)(g.Z, {
                  isOpen: m,
                  onClose: () => C(!1),
                  title: "Advanced IBC Settings",
                  containerClassName: "!max-panel-height",
                  contentClassName: "!bg-white-100 dark:!bg-gray-950",
                  className: "p-6",
                  children: [
                    (0, s.jsxs)("div", {
                      className: "rounded-2xl justify-center items-center",
                      children: [
                        (0, s.jsxs)("div", {
                          className: "flex items-center mb-4 justify-between",
                          children: [
                            (0, s.jsxs)("div", {
                              className: "flex gap-2 items-center",
                              children: [
                                (0, s.jsx)(p.Z, { className: "font-bold", children: "Select channels" }),
                                (0, s.jsx)(v.Z, {
                                  content: (0, s.jsxs)("p", {
                                    className: "text-gray-500 dark:text-gray-100 text-sm",
                                    children: [
                                      "ID of the channel that will relay your tokens from ",
                                      _.chainName,
                                      " ",
                                      "to ",
                                      null == L ? void 0 : L.chainName,
                                      "."
                                    ]
                                  }),
                                  children: (0, s.jsx)("div", {
                                    className: "relative flex",
                                    children: (0, s.jsx)(r.k, { size: 20, className: "text-gray-600 dark:text-gray-400" })
                                  })
                                })
                              ]
                            }),
                            (0, s.jsxs)("div", {
                              className: "flex gap-1 items-center cursor-pointer",
                              onClick: q,
                              "aria-label": "send ibc settings add channel button in send flow",
                              children: [
                                !M && Q
                                  ? (0, s.jsx)(c.v, { size: 14, weight: "bold", className: "text-green-600" })
                                  : (0, s.jsx)(u.W, { size: 14, weight: "bold", className: "text-green-600" }),
                                (0, s.jsx)(p.Z, {
                                  size: "xs",
                                  className: "font-medium",
                                  color: "text-green-600",
                                  children: (0, s.jsx)("span", {
                                    "aria-label": "send ibc settings add channel button text in send flow",
                                    children: "Add Channel"
                                  })
                                })
                              ]
                            })
                          ]
                        }),
                        (0, s.jsx)("div", {
                          className: "bg-secondary-100 rounded-2xl p-5 gap-4",
                          children: (0, s.jsxs)(s.Fragment, {
                            children: [
                              (0, s.jsxs)(p.Z, {
                                size: "xs",
                                color: "text-secondary-800",
                                className: "font-bold capitalize",
                                children: [_.chainName, " to ", null == L ? void 0 : L.chainName, " channels"]
                              }),
                              null === k
                                ? (0, s.jsx)("div", { className: "flex justify-center items-center my-3", children: (0, s.jsx)(f.T, { color: "white" }) })
                                : (0, s.jsx)(N.Z, {
                                    themeColor: O === o.ThemeName.DARK ? j.w.white100 : j.w.black100,
                                    options: J,
                                    onChange: V,
                                    selectedOption: T,
                                    targetChain: t,
                                    isAddChannel: M,
                                    hasChannelId: Q
                                  })
                            ]
                          })
                        })
                      ]
                    }),
                    (0, s.jsxs)("div", {
                      className: "p-4 rounded-2xl bg-red-100 dark:bg-red-900 my-4",
                      children: [
                        (0, s.jsxs)("div", {
                          className: "items-center flex gap-2",
                          children: [
                            (0, s.jsx)(d.v, { size: 20, weight: "bold", className: "text-red-400 dark:text-red-300 self-start" }),
                            (0, s.jsx)(p.Z, { size: "sm", className: "font-bold mb-2", children: "Sending via unverified channel." })
                          ]
                        }),
                        (0, s.jsxs)("div", {
                          className: "items-start flex gap-2",
                          children: [
                            (0, s.jsx)("div", { className: "ml-[1px]", children: (0, s.jsx)(x.X, { checked: I, isWhite: !0, onClick: () => D(e => !e) }) }),
                            (0, s.jsx)(p.Z, {
                              size: "xs",
                              color: "text-gray-800 dark:text-gray-200",
                              className: "font-medium",
                              children: "Usability of tokens sent via unverified channels is not guaranteed. I understand and wish to proceed."
                            })
                          ]
                        })
                      ]
                    }),
                    (0, s.jsx)(o.Buttons.Generic, {
                      color: j.w.green600,
                      size: "normal",
                      className: "w-full",
                      title: "Proceed",
                      disabled: !I || !T,
                      onClick: () => {
                        P(!0), C(!1), W(T);
                      },
                      "aria-label": "send ibc settings proceed button in send flow",
                      children: (0, s.jsx)("span", { "aria-label": "send ibc settings proceed button text in send flow", children: "Proceed" })
                    })
                  ]
                })
              ]
            });
          };
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    98766: function (e, n, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(n, { H: () => E });
          var s = t(52322),
            a = t(20302),
            i = t(41172),
            o = t(6809),
            r = t(75377),
            d = t(26007),
            c = t(3493),
            u = t(6391),
            m = t.n(u),
            h = t(72779),
            v = t.n(h),
            x = t(69816),
            f = t(23259),
            g = t(74229),
            p = t(6401),
            b = t(57124),
            y = t(30464),
            w = t(75958),
            j = t(2784),
            N = t(84994),
            C = t(53221),
            k = t(70514),
            S = t(49409),
            I = t(48534),
            D = t(71198),
            M = t(76147),
            A = t(24074),
            T = e([M]);
          M = (T.then ? (await T)() : T)[0];
          let E = (0, w.Pi)(function (e) {
            let {
                onTokenSelect: n,
                token: t,
                isSelected: l,
                verified: u = !1,
                hideAmount: h = !1,
                showRedirection: w = !1,
                selectedChain: T,
                isChainAbstractionView: E,
                marketDataStore: O,
                isFirst: B = !1,
                isLast: _ = !1
              } = e,
              L = (0, i.a74)(),
              [z] = (0, p.nB)(),
              [Z] = (0, p.X$)(),
              F = (0, b.a)(),
              { theme: P } = (0, r.useTheme)(),
              { sendSelectedNetwork: U } = (0, M.GE)(),
              W = (0, g.os)(),
              G = (0, i.DI5)(),
              { data: R } = (0, o.C$)(),
              H = (0, j.useMemo)(() => {
                if (t.ibcChainInfo)
                  return (
                    Object.values(G).find(e => {
                      var n, l;
                      return (
                        e.chainId === (null === (n = t.ibcChainInfo) || void 0 === n ? void 0 : n.name) ||
                        e.testnetChainId === (null === (l = t.ibcChainInfo) || void 0 === l ? void 0 : l.name)
                      );
                    }) ??
                    Object.values(W).find(e => {
                      var n, l;
                      return (
                        e.chainId === (null === (n = t.ibcChainInfo) || void 0 === n ? void 0 : n.name) ||
                        e.testnetChainId === (null === (l = t.ibcChainInfo) || void 0 === l ? void 0 : l.name)
                      );
                    }) ??
                    (null == R
                      ? void 0
                      : R.find(e => {
                          var n;
                          return e.chainId === (null === (n = t.ibcChainInfo) || void 0 === n ? void 0 : n.name);
                        }))
                  );
              }, [G, W, R, t.ibcChainInfo]),
              $ = N.J.formatHideBalance(t.usdValue ? z(new (m())(t.usdValue)) : "-"),
              { getExplorerAccountUrl: V, explorerAccountUrl: K } = (0, i.JVF)({ forceChain: null == T ? void 0 : T.key }),
              [J, Q] = (0, j.useState)(!1),
              [q, Y] = (0, j.useMemo)(() => {
                let e = w && T;
                return e && t.coinMinimalDenom.toLowerCase().startsWith("factory/") && !(null == K ? void 0 : K.toLowerCase().includes("mintscan"))
                  ? [!1, !0]
                  : [e, !1];
              }, [K, T, w, t.coinMinimalDenom]),
              X = (0, j.useMemo)(() => {
                var e;
                return t.ibcChainInfo
                  ? `${t.ibcChainInfo.pretty_name} / ${(0, D.MD)((null === (e = t.ibcChainInfo) || void 0 === e ? void 0 : e.channelId) ?? "", 7, 5)}`
                  : "";
              }, [H]),
              ee = (0, j.useCallback)(
                e => {
                  if ((e.stopPropagation(), t.coinMinimalDenom.toLowerCase().startsWith("factory/"))) {
                    let e = (0, a.toBase64)((0, a.toUtf8)(t.coinMinimalDenom)),
                      n = V(e, !0);
                    window.open(n, "_blank");
                  } else {
                    let e = V(t.coinMinimalDenom);
                    window.open(e, "_blank");
                  }
                },
                [V, t.coinMinimalDenom]
              ),
              en = (0, j.useCallback)(
                async e => {
                  e.stopPropagation(), Q(!0), await C.i.copyText(t.coinMinimalDenom), setTimeout(() => Q(!1), 2e3);
                },
                [t.coinMinimalDenom]
              ),
              et = (0, j.useCallback)(() => {
                l || n(t);
              }, [l, n, t]),
              el = t.symbol ?? (null == t ? void 0 : t.name),
              es = (0, j.useMemo)(() => {
                var e;
                if (
                  (null == t ? void 0 : t.tokenBalanceOnChain) &&
                  (null == G ? void 0 : null === (e = G[t.tokenBalanceOnChain]) || void 0 === e ? void 0 : e.chainName)
                )
                  return (0, A.x)(G[t.tokenBalanceOnChain].chainName, U);
              }, [t.tokenBalanceOnChain, G, U]);
            return (0, s.jsxs)(s.Fragment, {
              children: [
                (0, s.jsx)("div", {
                  onClick: et,
                  className: v()("flex flex-1 items-center w-full", _ ? "mb-4" : "mb-3"),
                  children: (0, s.jsxs)("div", {
                    className: (0, k.cn)(
                      "flex items-center flex-1 flex-row justify-between w-full gap-2 rounded-xl pl-3 py-3 pr-4 border border-transparent",
                      l
                        ? "bg-secondary-200 hover:bg-secondary-200 cursor-not-allowed border-secondary-600"
                        : "cursor-pointer bg-secondary-100 hover:bg-secondary-200"
                    ),
                    "aria-label": "token card",
                    children: [
                      (0, s.jsxs)("div", {
                        className: "flex items-center flex-1",
                        "aria-label": "token card content in send flow",
                        children: [
                          (0, s.jsxs)("div", {
                            className: "relative mr-3",
                            children: [
                              (0, s.jsx)("img", { src: t.img ?? F, className: "h-9 w-9 rounded-full", onError: (0, S._)(F), "aria-label": "token logo" }),
                              u &&
                                (0, s.jsxs)("div", {
                                  className: "absolute group -bottom-[3px] -right-[6px]",
                                  children: [
                                    (0, s.jsx)("img", {
                                      src: P === r.ThemeName.DARK ? y.r.Misc.VerifiedWithBgStarDark : y.r.Misc.VerifiedWithBgStar,
                                      alt: "verified-token",
                                      className: "h-5 w-5",
                                      "aria-label": "verified token"
                                    }),
                                    (0, s.jsx)("div", {
                                      className: v()(
                                        "group-hover:!block hidden absolute bottom-0 right-0 translate-x-full bg-gray-200 dark:bg-gray-800 px-3 py-2 rounded-lg text-xs dark:text-white-100",
                                        { "!max-w-max": (0, I.oj)() }
                                      ),
                                      "aria-label": "whitelisted token",
                                      children: "Whitelisted"
                                    })
                                  ]
                                })
                            ]
                          }),
                          (0, s.jsx)("div", {
                            className: "flex flex-col justify-center items-start gap-[2px]",
                            children: (0, s.jsxs)("div", {
                              className: "flex items-center gap-[4px]",
                              children: [
                                (0, s.jsxs)("div", {
                                  className: "flex flex-col",
                                  children: [
                                    (0, s.jsxs)("div", {
                                      className: "flex space-x-1 items-center",
                                      children: [
                                        (0, s.jsx)(x.Z, {
                                          size: "md",
                                          className: v()("font-bold !leading-[21.6px]", {
                                            "items-center justify-center gap-1": (L === f.HW || E) && (null == t ? void 0 : t.ibcChainInfo)
                                          }),
                                          "data-testing-id": `switch-token-${el.toLowerCase()}-ele`,
                                          "aria-label": "token name",
                                          children: (null == el ? void 0 : el.length) > 20 ? (0, D.MD)(el, 6, 6) : el
                                        }),
                                        t.ibcChainInfo &&
                                          (0, s.jsx)("span", {
                                            className:
                                              "py-[2px] px-[6px] rounded-[4px] font-medium text-[10px] !leading-[16px] text-foreground bg-secondary-200",
                                            title: X,
                                            "aria-label": "ibc token",
                                            children: "IBC"
                                          })
                                      ]
                                    }),
                                    es && (0, s.jsx)(x.Z, { size: "xs", color: "text-muted-foreground", className: "font-medium", children: es })
                                  ]
                                }),
                                q
                                  ? (0, s.jsx)("button", {
                                      onClick: ee,
                                      className: "text-gray-400",
                                      "aria-label": "redirection button in send flow",
                                      children: (0, s.jsx)(d.O, { size: 16, className: "!text-md !leading-[20px]", "aria-label": "redirection" })
                                    })
                                  : null,
                                Y
                                  ? (0, s.jsx)(s.Fragment, {
                                      children: J
                                        ? (0, s.jsx)("button", { className: "text-gray-400 text-xs font-bold ml-[0.5px]", children: "copied" })
                                        : (0, s.jsx)("button", {
                                            onClick: en,
                                            className: "text-gray-400",
                                            "aria-label": "copy token address button in send flow",
                                            children: (0, s.jsx)(c.K, { size: 16 })
                                          })
                                    })
                                  : null
                              ]
                            })
                          })
                        ]
                      }),
                      !1 === h &&
                        (0, s.jsxs)("div", {
                          className: "flex flex-col items-end gap-y-0.5",
                          children: [
                            "-" !== $ && (0, s.jsx)(x.Z, { size: "sm", className: "font-bold !leading-[19.6px]", "aria-label": "fiat value", children: $ }),
                            parseFloat(t.amount) > 0 &&
                              (0, s.jsx)(x.Z, {
                                size: "xs",
                                className: "font-medium !leading-[19.2px]",
                                "aria-label": "token amount",
                                color: "text-gray-600 dark:text-gray-400",
                                children: (0, i.LHZ)(t.amount, (0, D.MD)(t.symbol, 4, 4), 3, i.r95[Z].locale)
                              })
                          ]
                        })
                    ]
                  })
                }),
                _ && (0, s.jsx)("div", { className: "h-1 bg-transparent" })
              ]
            });
          });
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    25664: function (e, n, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(n, { r: () => C });
          var s = t(52322),
            a = t(41172),
            i = t(15969),
            o = t(44658),
            r = t(48272),
            d = t(2543),
            c = t(6391),
            u = t.n(c),
            m = t(72779),
            h = t.n(m),
            v = t(6401),
            x = t(57124),
            f = t(75958),
            g = t(76147),
            p = t(2784),
            b = t(86874),
            y = t(81354),
            w = t(84994),
            j = t(49409),
            N = e([g]);
          g = (N.then ? (await N)() : N)[0];
          let C = (0, f.Pi)(function (e) {
            let {
                isInputInUSDC: n,
                setIsInputInUSDC: t,
                value: l,
                token: c,
                loadingAssets: m,
                balanceStatus: f,
                onChange: N,
                onTokenSelectSheet: C,
                amountError: k,
                sendActiveChain: S,
                selectedChain: I,
                resetForm: D
              } = e,
              [M] = (0, v.nB)(),
              A = (0, a.DI5)(),
              T = (0, x.a)(),
              [E, O] = (0, p.useState)(null == l ? void 0 : l.toString()),
              { selectedAddress: B, addressError: _, fee: L, l2DataBufferFee: z } = (0, g.GE)(),
              Z = (0, p.useMemo)(() => {
                if (c && c.usdPrice && "0" !== c.usdPrice) return c.usdPrice;
              }, [c]);
            (0, p.useEffect)(() => {
              !Z && n && t(!1);
            }, [Z, n]);
            let { formattedDollarAmount: F } = (0, p.useMemo)(() => {
                let e = "0";
                return "" === l || (l && isNaN(parseFloat(l)))
                  ? { formattedDollarAmount: "" }
                  : (c && c.usdPrice && l && (e = String(parseFloat(c.usdPrice) * parseFloat(l))),
                    { formattedDollarAmount: w.J.formatHideBalance(M(new (u())(e))) });
              }, [M, c, l]),
              P = (0, p.useMemo)(
                () => w.J.formatHideBalance((0, a.LHZ)(l ?? "0", (0, a.MDB)((null == c ? void 0 : c.symbol) ?? "", 4, 4), 3, "en-US")),
                [l, null == c ? void 0 : c.symbol]
              ),
              U = (0, p.useMemo)(
                () =>
                  w.J.formatHideBalance(
                    (0, a.LHZ)((null == c ? void 0 : c.amount) ?? "0", (0, a.MDB)((null == c ? void 0 : c.symbol) ?? "", 4, 4), 3, "en-US")
                  ),
                [null == c ? void 0 : c.amount, null == c ? void 0 : c.symbol]
              ),
              W = (0, p.useMemo)(() => (null == c ? void 0 : c.amount) === l, [null == c ? void 0 : c.amount, l]);
            (0, p.useMemo)(() => (null == c ? void 0 : c.amount) && (null == c ? void 0 : c.amount) !== "0" && !W, [W, null == c ? void 0 : c.amount]);
            let G = (0, p.useMemo)(() => !Z || new (u())(Z ?? 0).isLessThan(1e-6), [Z]);
            (0, p.useEffect)(() => {
              if (N) {
                if (n && Z) {
                  if (!E.trim()) {
                    N("");
                    return;
                  }
                  let e = new (u())(E).dividedBy(Z);
                  N(isNaN(parseFloat(e.toString())) ? "" : null == e ? void 0 : e.toFixed(6));
                } else N(isNaN(parseFloat(E)) ? "" : E);
              }
            }, [E, n, Z]),
              (0, p.useEffect)(() => {
                D && O("");
              }, [D]);
            let R = (0, p.useCallback)(() => {
              if (n) {
                if (!Z) throw "USD price is not available";
                let e = new (u())((null == c ? void 0 : c.amount) ?? "0").multipliedBy(Z);
                O(e.toString());
              } else {
                let e = (null == c ? void 0 : c.coinDecimals) || 6;
                O(new (u())((null == c ? void 0 : c.amount) ?? 0).toFixed(e, u().ROUND_DOWN));
              }
              y.K5.allowUpdateInput();
            }, [n, Z, null == c ? void 0 : c.amount, null == c ? void 0 : c.coinDecimals]);
            (0, p.useEffect)(() => {
              var e, t, s, a;
              if (
                !y.K5.updateAllowed() ||
                !L ||
                !(null == c ? void 0 : c.amount) ||
                !l ||
                ((null == c ? void 0 : c.coinMinimalDenom) === "mist" && "sui" === S)
              )
                return;
              let o = new (u())(l ?? 0),
                r = new (u())((null == c ? void 0 : c.amount) ?? 0);
              if (o.lte(0)) return;
              let d = null == L ? void 0 : null === (t = L.amount) || void 0 === t ? void 0 : null === (e = t[0]) || void 0 === e ? void 0 : e.denom,
                m =
                  (null == c ? void 0 : c.ibcDenom) || (null == d ? void 0 : d.startsWith("ibc/"))
                    ? (null == c ? void 0 : c.ibcDenom) === d
                    : (null == c ? void 0 : c.coinMinimalDenom) === d,
                h = y.K5.shouldTerminate(),
                v = (null == c ? void 0 : c.coinDecimals) || 6,
                x = new (u())(
                  (0, i.TGo)(
                    (null == L ? void 0 : null === (a = L.amount) || void 0 === a ? void 0 : null === (s = a[0]) || void 0 === s ? void 0 : s.amount) ?? "0",
                    v
                  )
                );
              if (("lamports" === d && (x = x.plus(5e-6)), i.ZjV.includes(S) && z && (x = x.plus(z / 1e18)), h && ((!m && o.lte(r)) || o.plus(x).lte(r))))
                return;
              let f = r.minus(m ? x : 0),
                g = f.toFixed(v, u().ROUND_DOWN),
                p = o.toFixed(v, u().ROUND_DOWN);
              if (!f.lte(0) && g != p && (!h || !(g > p))) {
                if (n) {
                  if (!Z) return;
                  let e = f.multipliedBy(Z);
                  O(e.toString());
                } else O(g);
                y.K5.incrementUpdateCount();
              }
            }, [
              L,
              l,
              n,
              null == c ? void 0 : c.amount,
              null == c ? void 0 : c.coinDecimals,
              null == c ? void 0 : c.coinMinimalDenom,
              null == c ? void 0 : c.ibcDenom,
              Z
            ]);
            let H = (0, p.useCallback)(() => {
                if (n) {
                  if (!Z) throw "USD price is not available";
                  let e = new (u())((null == c ? void 0 : c.amount) ?? "0").dividedBy(2).multipliedBy(Z);
                  O(e.toString());
                } else {
                  let e = new (u())((null == c ? void 0 : c.amount) ?? "0").dividedBy(2).toFixed(6, 1);
                  O(e);
                }
                y.K5.disableUpdateInput();
              }, [n, Z, null == c ? void 0 : c.amount, O]),
              $ = (0, p.useCallback)(() => {
                if (!Z) throw "USD price is not available";
                if (n) {
                  t(!1);
                  let e = new (u())(E).dividedBy(Z);
                  O(e.toString());
                } else {
                  t(!0);
                  let e = new (u())(E).multipliedBy(Z);
                  O(e.toString());
                }
              }, [n, Z, E]),
              V = (0, p.useMemo)(
                () => ((null == c ? void 0 : c.tokenBalanceOnChain) ? (null == A ? void 0 : A[c.tokenBalanceOnChain]) : null),
                [null == c ? void 0 : c.tokenBalanceOnChain, A]
              ),
              K = (_ || "").includes("IBC transfers are not supported"),
              J = (0, p.useMemo)(() => {
                var e, n;
                return (0, i.KPM)(S) ||
                  (0, i.bj0)(S) ||
                  (null == A ? void 0 : null === (e = A[S]) || void 0 === e ? void 0 : e.evmOnlyChain) ||
                  (0, o.mq)(S) ||
                  (0, i.Jhy)(S)
                  ? (null == A ? void 0 : null === (n = A[S]) || void 0 === n ? void 0 : n.chainName) ?? S
                  : "Cosmos";
              }, [S, A]);
            return (0, s.jsx)(s.Fragment, {
              children: (0, s.jsx)(
                "div",
                {
                  className: "w-full bg-secondary-100 rounded-xl flex flex-col",
                  children: (0, s.jsxs)("div", {
                    className: "flex flex-col p-5 gap-3",
                    children: [
                      (0, s.jsx)("p", { className: "text-muted-foreground text-sm font-medium !leading-[22.4px]", children: "Send" }),
                      (0, s.jsx)("div", {
                        className: "flex rounded-2xl justify-between w-full items-center gap-2 h-[34px] p-[2px]",
                        children: m
                          ? (0, s.jsx)(b.Z, { width: 75, height: 32, containerClassName: "block !leading-none overflow-hidden rounded-full ml-auto" })
                          : (0, s.jsxs)(s.Fragment, {
                              children: [
                                (0, s.jsxs)("div", {
                                  className: "flex gap-1 w-full",
                                  children: [
                                    n && (0, s.jsx)("span", { className: "text-monochrome font-bold text-[24px]", children: "$" }),
                                    (0, s.jsx)("input", {
                                      type: "number",
                                      className: h()(
                                        "bg-transparent outline-none w-full text-left placeholder:font-bold placeholder:text-[24px] placeholder:text-monochrome font-bold !leading-[32.4px] caret-accent-green",
                                        {
                                          "text-destructive-100": k,
                                          "text-monochrome": !k,
                                          "text-[24px]": E.length < 12,
                                          "text-[22px]": E.length >= 12 && E.length < 15,
                                          "text-[20px]": E.length >= 15 && E.length < 18,
                                          "text-[18px]": E.length >= 18
                                        }
                                      ),
                                      placeholder: "0",
                                      value: n ? E : l,
                                      onChange: e => {
                                        O(e.target.value), y.K5.disableUpdateInput();
                                      },
                                      "aria-label": "token input"
                                    })
                                  ]
                                }),
                                (0, s.jsxs)("button", {
                                  className: h()(
                                    "flex justify-end items-center gap-2 shrink-0 py-1 px-1.5 rounded-[40px] bg-secondary-300 hover:bg-secondary-400"
                                  ),
                                  onClick: C,
                                  "aria-label": "sendtoken select",
                                  children: [
                                    (0, s.jsxs)("div", {
                                      className: "relative w-[24px] h-[24px] shrink-0 flex flex-row items-center justify-center",
                                      children: [
                                        (0, s.jsx)("img", {
                                          src: (null == c ? void 0 : c.img) ?? T,
                                          className: "w-[19.2px] h-[19.2px] rounded-full",
                                          onError: (0, j._)(T),
                                          "aria-label": "send token logo"
                                        }),
                                        V &&
                                          (0, s.jsx)("img", {
                                            src: V.chainSymbolImageUrl,
                                            className: "w-[8.4px] h-[8.4px] bg-secondary-200 rounded-full absolute bottom-0 right-0",
                                            onError: (0, j._)(T),
                                            "aria-label": "send token holder chain logo"
                                          })
                                      ]
                                    }),
                                    (0, s.jsxs)("div", {
                                      className: "flex items-center gap-1",
                                      children: [
                                        (0, s.jsx)("p", {
                                          className: h()("dark:text-white-100 text-[16px] font-medium", { "flex flex-col justify-between items-start": !!I }),
                                          "aria-label": "send token name",
                                          children: (null == c ? void 0 : c.symbol) ? (0, a.MDB)((null == c ? void 0 : c.symbol) ?? "", 4, 4) : "Select Token"
                                        }),
                                        (0, s.jsx)(r.p, { size: 20, className: "dark:text-white-100 p-1", "aria-label": "send token select caret down" })
                                      ]
                                    })
                                  ]
                                })
                              ]
                            })
                      }),
                      (0, s.jsxs)("div", {
                        className:
                          "flex flex-row items-center justify-between max-[399px]:!items-start text-gray-400 text-sm font-normal w-full min-h-[22px] mt-1",
                        children: [
                          (0, s.jsxs)("div", {
                            className: "flex items-center gap-1",
                            children: [
                              (0, s.jsx)("span", {
                                className: "text-muted-foreground font-normal text-sm !leading-[22.4px]",
                                children: "" === l ? (n ? "0.00" : "$0.00") : n ? P : F
                              }),
                              (0, s.jsx)("button", {
                                disabled: G,
                                onClick: $,
                                className: h()(
                                  "rounded-full h-[22px] bg-secondary-200 hover:bg-secondary-300 items-center flex gap-1 justify-center shrink-0 text-gray-600 dark:text-gray-400 dark:hover:text-white-100 hover:text-black-100",
                                  { "opacity-50 pointer-events-none": G }
                                ),
                                "aria-label": "send token input type switch",
                                children: (0, s.jsx)(d.m, {
                                  size: 20,
                                  className: "!leading-[12px] rotate-90 p-1",
                                  "aria-label": "send token input type switch icon"
                                })
                              })
                            ]
                          }),
                          (0, s.jsxs)("div", {
                            className: "flex justify-end items-center gap-2",
                            children: [
                              (0, s.jsx)("span", {
                                className: "text-sm font-medium !leading-[18.9px] text-muted-foreground",
                                children: f && "success" !== f ? (0, s.jsx)(b.Z, { width: 50 }) : U
                              }),
                              f && "success" !== f
                                ? null
                                : (0, s.jsxs)(s.Fragment, {
                                    children: [
                                      (0, s.jsx)("button", {
                                        onClick: H,
                                        className:
                                          "rounded-full bg-secondary-200 px-[6px] font-medium text-xs hover:bg-secondary-300 dark:hover:text-white-100 hover:text-black-100 !leading-[19.2px] text-muted-foreground",
                                        "aria-label": "send 50% button in send flow",
                                        children: (0, s.jsx)("span", { "aria-label": "send 50% button text in send flow", children: "50%" })
                                      }),
                                      (0, s.jsx)("button", {
                                        onClick: R,
                                        className:
                                          "rounded-full bg-secondary-200 px-[6px] font-medium text-xs hover:bg-secondary-300 dark:hover:text-white-100 hover:text-black-100 !leading-[19.2px] text-muted-foreground",
                                        "aria-label": "send max button in send flow",
                                        children: (0, s.jsx)("span", { "aria-label": "send max button text in send flow", children: "Max" })
                                      })
                                    ]
                                  })
                            ]
                          })
                        ]
                      }),
                      !K && _ && B
                        ? (0, s.jsxs)("div", {
                            className: "text-left text-xs text-destructive-100 font-medium !leading-[16px]",
                            children: ["You can only send ", null == c ? void 0 : c.symbol, " on ", J, "."]
                          })
                        : null
                    ]
                  })
                },
                U
              )
            });
          });
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    96281: function (e, n, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(n, { e: () => y });
          var s = t(52322),
            a = t(15969),
            i = t(6391),
            o = t(72779),
            r = t.n(o),
            d = t(58885),
            c = t(4370),
            u = t(38313),
            m = t(75958),
            h = t(76147),
            v = t(2784),
            x = t(81354),
            f = t(36321),
            g = t(39713),
            p = t(25664),
            b = e([u, h, g, d, p]);
          [u, h, g, d, p] = b.then ? (await b)() : b;
          let y = (0, m.Pi)(e => {
            let {
                isAllAssetsLoading: n,
                rootBalanceStore: t,
                rootDenomsStore: l,
                rootCW20DenomsStore: o,
                rootERC20DenomsStore: m,
                resetForm: b,
                setShowTokenSelectSheet: y,
                isTokenStatusSuccess: w,
                amount: j,
                setAmount: N
              } = e,
              C = f.Ui.chainInfos,
              k = (0, u.ob)(),
              [S, I] = (0, v.useState)(!1),
              D = o.allCW20Denoms,
              M = m.allERC20Denoms,
              { getAggregatedSpendableBalances: A } = t,
              T = A(k, void 0),
              E = (0, v.useMemo)(() => T.sort((e, n) => Number(n.usdValue) - Number(e.usdValue)), [T]),
              O = (0, v.useCallback)(e => !!e && Object.keys(D).includes(e.coinMinimalDenom), [D]),
              {
                inputAmount: B,
                setInputAmount: _,
                selectedToken: L,
                setSelectedToken: z,
                sendActiveChain: Z,
                selectedChain: F,
                setSelectedChain: P,
                setAmountError: U,
                amountError: W,
                userPreferredGasPrice: G,
                userPreferredGasLimit: R,
                gasEstimate: H,
                selectedAddress: $,
                fee: V,
                feeDenom: K,
                sameChain: J,
                setFeeDenom: Q,
                hasToUsePointerLogic: q,
                computedGas: Y,
                l2DataBufferFee: X
              } = (0, h.GE)(),
              ee = g.xv.getGasAdjustments(Z);
            return (
              (0, v.useEffect)(() => {
                var e, n, t;
                let l = null === (n = j.split(".")) || void 0 === n ? void 0 : null === (e = n[1]) || void 0 === e ? void 0 : e.length,
                  s = (null == L ? void 0 : L.coinDecimals) ?? 6;
                l > s ? _(((t = Number(j)), (Math.floor(t * Math.pow(10, s)) / Math.pow(10, s)).toFixed(s))) : _(j);
              }, [j, null == L ? void 0 : L.coinDecimals]),
              (0, v.useEffect)(() => {
                U(
                  (() => {
                    var e, n, t;
                    if ((null == $ ? void 0 : $.address) && !J && L && O(L)) return "IBC transfers are not supported for cw20 tokens.";
                    if ("" === B) return "";
                    if (isNaN(Number(B))) return "Please enter a valid amount";
                    if (new i.BigNumber(B).lt(0)) return "Please enter a positive amount";
                    if (new i.BigNumber(B).gt(new i.BigNumber((null == L ? void 0 : L.amount) ?? ""))) return "Insufficient balance";
                    if (
                      (0, a.bj0)(Z) &&
                      (0, a.bj0)((null == L ? void 0 : L.chain) ?? "") &&
                      (null == L ? void 0 : L.coinMinimalDenom) === "mist" &&
                      new i.BigNumber(
                        (null == V ? void 0 : null === (n = V.amount) || void 0 === n ? void 0 : null === (e = n[0]) || void 0 === e ? void 0 : e.amount) ?? 0
                      ).eq(0)
                    )
                      return "Insufficient balance for fees";
                    let l = E.find(e =>
                      (null == L ? void 0 : L.isEvm) && (null == e ? void 0 : e.isEvm)
                        ? e.coinMinimalDenom === (null == K ? void 0 : K.coinMinimalDenom)
                        : e.ibcDenom === K.coinMinimalDenom || e.coinMinimalDenom === K.coinMinimalDenom
                    );
                    if (!V || !G || !l) return "";
                    let { amount: s } = (0, d.X$)({
                      gasPrice: G.amount.toFloatApproximation(),
                      gasLimit: R ?? H,
                      feeDenom: K,
                      gasAdjustment: ee,
                      isSeiEvmTransaction: null == C ? void 0 : null === (t = C[Z]) || void 0 === t ? void 0 : t.evmOnlyChain,
                      isSolana: (0, a.Jhy)(Z),
                      isSui: (0, a.bj0)(Z),
                      computedGas: Y,
                      l2DataBufferFee: X
                    });
                    if (s.gt(l.amount)) return "Insufficient funds for fees.";
                  })()
                );
              }, [E, null == V ? void 0 : V.amount, null == K ? void 0 : K.coinMinimalDenom, B, L, $, ee, Z, C, M, q, Y, X]),
              (0, v.useEffect)(() => {
                b &&
                  (N(""),
                  z(e => {
                    let n = E.find(n =>
                      n.ibcDenom
                        ? n.ibcDenom === (null == e ? void 0 : e.ibcDenom) && n.tokenBalanceOnChain === (null == e ? void 0 : e.tokenBalanceOnChain)
                        : n.coinMinimalDenom === (null == e ? void 0 : e.coinMinimalDenom) &&
                          n.tokenBalanceOnChain === (null == e ? void 0 : e.tokenBalanceOnChain)
                    );
                    return n || (x.K5.updateAllowed() ? E.sort((e, n) => Number(n.usdValue ?? 0) - Number(e.usdValue ?? 0))[0] : e);
                  }));
              }, [E, b, z]),
              (0, s.jsx)(c.E.div, {
                className: r()("px-6"),
                children: (0, s.jsx)(p.r, {
                  isInputInUSDC: S,
                  setIsInputInUSDC: I,
                  value: j,
                  token: L,
                  loadingAssets: !w,
                  balanceStatus: n,
                  onChange: e => N(e),
                  onTokenSelectSheet: () => y(!0),
                  amountError: W,
                  sendActiveChain: Z,
                  selectedChain: F,
                  resetForm: b
                })
              })
            );
          });
          (y.displayName = "AmountCard"), l();
        } catch (e) {
          l(e);
        }
      });
    },
    28588: function (e, n, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(n, { n: () => g });
          var s = t(52322),
            a = t(41172),
            i = t(15969),
            o = t(62598),
            r = t(6391),
            d = t(96217),
            c = t(84916),
            u = t(75958),
            m = t(98766),
            h = t(76147),
            v = t(2784),
            x = t(7474),
            f = e([h, m]);
          ([h, m] = f.then ? (await f)() : f), i.oCA.ethereum.key, i.oCA.cosmos.key, i.oCA.movement.key, i.oCA.base.key;
          let g = (0, u.Pi)(e => {
            let { assets: n, selectedToken: t, isOpen: l, onClose: u, onTokenSelect: f, denoms: g } = e,
              p = (0, v.useRef)(null),
              [b, y] = (0, v.useState)(""),
              { sendActiveChain: w } = (0, h.GE)(),
              j = (0, a.QSC)(w),
              N = (0, v.useMemo)(
                () =>
                  n.filter(e => {
                    var n;
                    return (
                      !new r.BigNumber(null == e ? void 0 : e.amount).isNaN() &&
                      new r.BigNumber(null == e ? void 0 : e.amount).gt(0) &&
                      ((0, i.bj0)(e.tokenBalanceOnChain ?? "") ||
                        (g[e.coinMinimalDenom] ?? Object.values(j.nativeDenoms).find(n => n.coinMinimalDenom === e.coinMinimalDenom))) &&
                      (null == e ? void 0 : null === (n = e.symbol) || void 0 === n ? void 0 : n.toLowerCase().includes(b.trim().toLowerCase()))
                    );
                  }),
                [null == j ? void 0 : j.nativeDenoms, b, n, g]
              ),
              C = e => {
                f(e), u(!0);
              };
            return (
              (0, v.useEffect)(() => {
                l &&
                  (y(""),
                  setTimeout(() => {
                    var e;
                    null === (e = p.current) || void 0 === e || e.focus();
                  }, 400));
              }, [l]),
              (0, s.jsx)(s.Fragment, {
                children: (0, s.jsx)(d.Z, {
                  title: "Select Token",
                  isOpen: l,
                  onClose: u,
                  contentClassName: "!bg-white-100 dark:!bg-gray-950",
                  className: "!p-6 !pb-0 h-full",
                  fullScreen: !0,
                  children: (0, s.jsxs)("div", {
                    className: "flex flex-col items-center h-full w-full gap-7",
                    children: [
                      (0, s.jsx)(c.M, {
                        ref: p,
                        value: b,
                        onChange: e => y(e.target.value),
                        onClear: () => y(""),
                        placeholder: "Select Token",
                        "aria-label": "select token search input"
                      }),
                      (0, s.jsx)("div", {
                        className: "bg-white-100 dark:bg-gray-950 w-full h-[calc(100%-76px)]",
                        children:
                          N.length > 0
                            ? (0, s.jsx)("div", {
                                style: { overflowY: "scroll" },
                                className: "h-full",
                                children: (0, s.jsx)(x.OO, {
                                  data: N,
                                  itemContent: (e, n) => {
                                    let l = e === N.length - 1,
                                      a = (null == t ? void 0 : t.coinMinimalDenom) === n.coinMinimalDenom;
                                    return (
                                      ((null == t ? void 0 : t.ibcDenom) || n.ibcDenom) &&
                                        (a =
                                          (null == t ? void 0 : t.ibcDenom) === n.ibcDenom &&
                                          n.tokenBalanceOnChain === (null == t ? void 0 : t.tokenBalanceOnChain)),
                                      ((null == t ? void 0 : t.isEvm) || (null == n ? void 0 : n.isEvm)) &&
                                        (a = a && (null == t ? void 0 : t.isEvm) === (null == n ? void 0 : n.isEvm)),
                                      (0, s.jsx)(
                                        v.Fragment,
                                        {
                                          children: (0, s.jsx)(m.H, {
                                            onTokenSelect: C,
                                            token: n,
                                            hideAmount: "0" === n.amount,
                                            isSelected: a,
                                            selectedChain: void 0,
                                            showRedirection: !1,
                                            isFirst: 0 === e,
                                            isLast: l
                                          })
                                        },
                                        `${n.coinMinimalDenom}-${e}`
                                      )
                                    );
                                  }
                                })
                              })
                            : (0, s.jsxs)("div", {
                                className: "py-[80px] px-4 w-full flex-col flex  justify-center items-center gap-4",
                                children: [
                                  (0, s.jsx)(o.Z, { size: 64, className: "dark:text-gray-50 text-gray-900 p-5 rounded-full bg-secondary-200" }),
                                  (0, s.jsxs)("div", {
                                    className: "flex flex-col justify-start items-center w-full gap-4",
                                    children: [
                                      (0, s.jsx)("div", {
                                        className: "text-lg text-center font-bold !leading-[21.5px] dark:text-white-100",
                                        children: "No tokens found"
                                      }),
                                      (0, s.jsx)("div", {
                                        className: "text-sm font-normal !leading-[22.4px] text-gray-400 dark:text-gray-400 text-center",
                                        children: "We couldn’t find a match. Try searching again or use a different keyword."
                                      })
                                    ]
                                  })
                                ]
                              })
                      })
                    ]
                  })
                })
              })
            );
          });
          (g.displayName = "SelectTokenSheet"), l();
        } catch (e) {
          l(e);
        }
      });
    },
    54827: function (e, n, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(n, { i6: () => p, ug: () => b });
          var s = t(52322),
            a = t(41172),
            i = t(15969),
            o = t(6809),
            r = t(71769),
            d = t(36906);
          t(6391);
          var c = t(69816),
            u = t(91486),
            m = t(10706),
            h = t(36400),
            v = t(76147),
            x = t(2784),
            f = t(75478),
            g = e([h, m, f, v]);
          function p() {
            var e, n, t;
            let [l, g] = (0, x.useState)(null),
              {
                amountError: p,
                addressError: b,
                pfmEnabled: y,
                setPfmEnabled: w,
                transferData: j,
                isIbcUnwindingDisabled: N,
                setSelectedAddress: C,
                selectedAddress: k,
                customIbcChannelId: S,
                sendActiveChain: I
              } = (0, v.GE)(),
              { chains: D } = (0, a._IL)(),
              M = (0, a.tIw)(),
              A = (0, h.pb)(),
              T = (0, m.ZP)().activeWallet,
              E = null === (e = Object.values(A).find(e => e.chainId === (null == l ? void 0 : l.chainId))) || void 0 === e ? void 0 : e.key,
              O = null == T ? void 0 : null === (n = T.addresses) || void 0 === n ? void 0 : n[E],
              { data: B } = (0, o.Uj)();
            (0, x.useEffect)(() => {
              if ((null == j ? void 0 : j.isSkipTransfer) && (null == j ? void 0 : j.routeResponse)) {
                var e;
                let n = null == j ? void 0 : null === (e = j.messages) || void 0 === e ? void 0 : e[1],
                  t =
                    null == B
                      ? void 0
                      : B.find(e => {
                          var t;
                          return e.chainId === (null == n ? void 0 : null === (t = n.multi_chain_msg) || void 0 === t ? void 0 : t.chain_id);
                        });
                g((null == t ? void 0 : t.addressPrefix) === "sei" ? { ...t, addressPrefix: "seiTestnet2" } : t), w((null == t ? void 0 : t.pfmEnabled) !== !1);
              } else g(null), w(!0);
              return () => {
                w(!0);
              };
            }, [B, null == j ? void 0 : j.isSkipTransfer, null == j ? void 0 : j.routeResponse, null == j ? void 0 : j.messages]);
            let _ = (p || "").includes("IBC transfers are not supported"),
              L = (p || "").includes("You can only send this token to a SEI address");
            return _ || L
              ? (0, s.jsxs)("div", {
                  className: "p-4 rounded-2xl bg-red-100 dark:bg-red-900 items-center flex gap-2",
                  children: [
                    (0, s.jsx)(r.v, { size: 24, className: "text-red-400 dark:text-red-300" }),
                    (0, s.jsx)(c.Z, { size: "xs", className: "font-medium", children: p })
                  ]
                })
              : (b || "").includes("IBC transfers are not supported") || S
                ? (0, s.jsx)(f.Z, {
                    targetChain:
                      null ===
                        (t = (() => {
                          if (!(null == k ? void 0 : k.address)) return null;
                          let e = (0, i.z_q)(k.address);
                          if (!e) return null;
                          let n = M[e];
                          return n ? D[n] : null;
                        })()) || void 0 === t
                        ? void 0
                        : t.key,
                    sourceChain: I
                  })
                : y || N
                  ? null
                  : (0, s.jsxs)("div", {
                      className: "px-3 py-2.5 rounded-2xl items-center flex bg-accent-warning-800 gap-1.5",
                      children: [
                        (0, s.jsx)(d.k, { size: 16, className: "text-accent-warning self-start min-w-4" }),
                        (0, s.jsxs)(c.Z, {
                          size: "xs",
                          className: "font-medium",
                          color: "text-accent-warning",
                          children: ["You will have to send this token to ", null == l ? void 0 : l.chainName, " first to able to use it."]
                        }),
                        (0, s.jsx)(u.zx, {
                          variant: "mono",
                          size: "sm",
                          className: "py-2 px-4",
                          onClick: () => {
                            C({
                              address: O,
                              name: (null == O ? void 0 : O.slice(0, 5)) + "..." + (null == O ? void 0 : O.slice(-5)),
                              avatarIcon: null == l ? void 0 : l.icon,
                              emoji: void 0,
                              chainIcon: null == l ? void 0 : l.icon,
                              chainName: null == l ? void 0 : l.addressPrefix,
                              selectionType: "notSaved",
                              information: { autofill: !0 }
                            });
                          },
                          children: "Autofill address"
                        })
                      ]
                    });
          }
          function b() {
            let {
              isCexIbcTransferWarningNeeded: e,
              selectedAddress: n,
              sendActiveChain: t,
              isSolanaTxnSimulationError: l,
              isSolanaBalanceInsufficientForFee: i
            } = (0, v.GE)();
            return (0, a.SFn)(t) === (null == n ? void 0 : n.address)
              ? (0, s.jsxs)("div", {
                  className: "px-3 py-2.5 rounded-b-xl bg-accent-warning-800 items-center flex gap-1.5",
                  children: [
                    (0, s.jsx)(d.k, { size: 16, className: "text-accent-warning self-start min-w-4" }),
                    (0, s.jsx)(c.Z, {
                      size: "xs",
                      className: "font-medium",
                      color: "text-accent-warning",
                      children: "You're transferring funds to the same address within your own wallet"
                    })
                  ]
                })
              : e
                ? (0, s.jsxs)("div", {
                    className: "px-3 py-2.5 rounded-b-xl bg-accent-warning-800 items-center flex gap-1.5",
                    children: [
                      (0, s.jsx)(d.k, { size: 16, className: "text-accent-warning self-start min-w-4" }),
                      (0, s.jsx)(c.Z, {
                        size: "xs",
                        className: "font-medium",
                        color: "text-accent-warning",
                        children: "Avoid transferring IBC tokens to centralised exchanges."
                      })
                    ]
                  })
                : l || i
                  ? (0, s.jsxs)("div", {
                      className: "px-3 py-2.5 rounded-b-xl bg-accent-warning-800 items-center flex gap-1.5",
                      children: [
                        (0, s.jsx)(d.k, { size: 16, className: "text-accent-warning self-start min-w-4" }),
                        (0, s.jsx)(c.Z, {
                          size: "xs",
                          className: "font-medium",
                          color: "text-accent-warning",
                          children: "This transaction will likely fail if submitted."
                        })
                      ]
                    })
                  : null;
          }
          ([h, m, f, v] = g.then ? (await g)() : g), l();
        } catch (e) {
          l(e);
        }
      });
    },
    5120: function (e, n, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(n, { v: () => u });
          var s = t(52322),
            a = t(41172),
            i = t(6391),
            o = t.n(i),
            r = t(76147),
            d = t(2784),
            c = e([r]);
          function u() {
            let [e, n] = (0, d.useState)(new (o())(1)),
              [t] = (0, a.fOz)(),
              { feeDenom: l, feeTokenFiatValue: i, sendActiveChain: c, sendSelectedNetwork: u, inputAmount: m } = (0, r.GE)(),
              { lcdUrl: h } = (0, a.U9i)(c, u);
            return (
              (0, d.useEffect)(() => {
                !(async function () {
                  switch (c) {
                    case "mayachain": {
                      let e = await (0, a.Tti)(h ?? "");
                      n(new (o())(e).div(10 ** l.coinDecimals));
                      break;
                    }
                    case "thorchain": {
                      let e = await (0, a.d5w)(h ?? "");
                      n(new (o())(e).div(10 ** l.coinDecimals));
                    }
                  }
                })();
              }, [l.coinDecimals, h, c]),
              (0, s.jsxs)("div", {
                className: "flex items-center justify-center text-gray-600 dark:text-gray-400",
                children: [
                  (0, s.jsx)("p", { className: "font-semibold text-center text-sm", children: "Transaction fee: " }),
                  (0, s.jsxs)("p", {
                    className: "font-semibold text-center text-sm ml-1",
                    children: [(0, s.jsxs)("strong", { className: "mr-1", children: [e.toString(), " ", l.coinDenom] }), i ? `(${t(e.multipliedBy(i))})` : null]
                  })
                ]
              })
            );
          }
          (r = (c.then ? (await c)() : c)[0]), l();
        } catch (e) {
          l(e);
        }
      });
    },
    56186: function (e, n, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(n, { N: () => x });
          var s = t(52322),
            a = t(15969),
            i = t(58885),
            o = t(51994),
            r = t(80588),
            d = t(23259),
            c = t(75958),
            u = t(76147),
            m = t(2784),
            h = t(26245),
            v = e([u, h, i, o, r]);
          [u, h, i, o, r] = v.then ? (await v)() : v;
          let x = (0, c.Pi)(e => {
            var n;
            let { rootDenomsStore: t, rootBalanceStore: l } = e,
              [c, v] = (0, m.useState)(!1),
              [x, f] = (0, m.useState)({ value: 0, formattedAmount: "0", fiatValue: "0" }),
              {
                inputAmount: g,
                userPreferredGasPrice: p,
                userPreferredGasLimit: b,
                setUserPreferredGasLimit: y,
                setUserPreferredGasPrice: w,
                gasEstimate: j,
                gasOption: N,
                setGasOption: C,
                setFeeDenom: k,
                selectedToken: S,
                gasError: I,
                setGasError: D,
                addressWarning: M,
                sendActiveChain: A,
                sendSelectedNetwork: T,
                isSeiEvmTransaction: E,
                setIsSolanaBalanceInsufficientForFee: O,
                computedGas: B,
                l2DataBufferFee: _
              } = (0, u.GE)(),
              L = h.KB.getSolanaBalances(A, T, void 0),
              z = null === (n = L.filter(e => "lamports" === e.coinMinimalDenom)[0]) || void 0 === n ? void 0 : n.amount,
              Z = t.allDenoms,
              F = (0, i.e7)(Z, { activeChain: A, selectedNetwork: T, isSeiEvmTransaction: E }),
              [P, U] = (0, m.useState)({ option: N, gasPrice: p ?? F.gasPrice }),
              W = (0, m.useRef)(!1),
              G = (0, m.useCallback)(() => {
                v(!1);
              }, []),
              R = (0, m.useCallback)(
                (e, n) => {
                  (W.current = !0), U(e), k({ ...n.denom, ibcDenom: n.ibcDenom });
                },
                [k]
              );
            return (
              (0, m.useEffect)(() => {
                !W.current && U({ option: N, gasPrice: F.gasPrice });
              }, [F.gasPrice.amount.toString(), F.gasPrice.denom]),
              (0, m.useEffect)(() => {
                C(P.option), w(P.gasPrice);
              }, [P, C, w]),
              (0, m.useEffect)(() => {
                if (0 === x.value) return;
                O(!1);
                let e = x.value,
                  n = Number(g),
                  t = Number.parseFloat((e + n).toFixed(9)),
                  l = "";
                if ((0, a.Jhy)(A)) {
                  let n = 0;
                  if (((n = (null == S ? void 0 : S.coinMinimalDenom) === "lamports" ? Number(S.amount) - t : Number(z) - e), 0 === n)) return;
                  n < 0
                    ? (l = "Insufficient balance for transaction")
                    : n < d.yE / 1e9 && (l = "Balance after transaction would be below minimum required balance"),
                    l.length > 0 && O(!0);
                }
              }, [x.value, z, O, g, S, A]),
              (0, s.jsx)(i.ZP, {
                recommendedGasLimit: j.toString(),
                gasLimit: (null == b ? void 0 : b.toString()) ?? j.toString(),
                setGasLimit: e => y(Number(e.toString())),
                gasPriceOption: P,
                onGasPriceOptionChange: R,
                error: I,
                setError: D,
                isSelectedTokenEvm: null == S ? void 0 : S.isEvm,
                chain: A,
                network: T,
                isSeiEvmTransaction: E,
                rootDenomsStore: t,
                rootBalanceStore: l,
                computedGas: B,
                l2DataBufferFee: _,
                className: g ? "" : "hidden",
                children: g
                  ? (0, s.jsxs)(s.Fragment, {
                      children: [
                        "link" === M.type ? null : (0, s.jsx)(o.a, { setShowFeesSettingSheet: v, setDisplayFeeValue: f }),
                        I && !c ? (0, s.jsx)("p", { className: "text-red-300 text-sm font-medium mt-2 text-center", children: I }) : null,
                        (0, s.jsx)(r.k, { showFeesSettingSheet: c, onClose: G, gasError: I, hideAdditionalSettings: "bitcoin" === A || "bitcoinSignet" === A })
                      ]
                    })
                  : null
              })
            );
          });
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    5228: function (e, n, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(n, { _: () => h });
          var s = t(52322),
            a = t(41172),
            i = t(15969),
            o = t(29049),
            r = t(72779),
            d = t.n(r),
            c = t(69816),
            u = t(76147);
          t(2784);
          var m = e([u]);
          u = (m.then ? (await m)() : m)[0];
          let h = e => {
            var n;
            let { containerClassname: t } = e,
              { memo: l, setMemo: r, addressWarning: m, sendActiveChain: h } = (0, u.GE)(),
              v = (0, a.DI5)();
            return (0, i.KPM)(h) ||
              (null == v ? void 0 : null === (n = v[h]) || void 0 === n ? void 0 : n.evmOnlyChain) ||
              i.Dr3.includes(h) ||
              (0, i.Jhy)(h) ||
              (0, i.bj0)(h)
              ? null
              : (0, s.jsxs)("div", {
                  className: d()(
                    "mx-6 p-5 rounded-xl border border-secondary-100 flex justify-between items-center focus-within:border-secondary-400 hover:border-secondary-400",
                    t
                  ),
                  children: [
                    (0, s.jsx)("input", {
                      type: "text",
                      value: l,
                      placeholder: "Add memo",
                      className: "!leading-[22.4px] bg-transparent font-medium text-sm text-monochrome placeholder:text-muted-foreground outline-none w-full",
                      onChange: e => {
                        var n;
                        return r(null === (n = e.target) || void 0 === n ? void 0 : n.value);
                      }
                    }),
                    0 === l.length
                      ? (0, s.jsx)(o.v, { className: "w-5 h-5 p-[2px] shrink-0 text-muted-foreground" })
                      : (0, s.jsx)("div", {
                          onClick: () => r(""),
                          children: (0, s.jsx)(c.Z, {
                            size: "xs",
                            color: "text-muted-foreground",
                            className: " font-bold cursor-pointer ml-2",
                            children: "Clear"
                          })
                        })
                  ]
                });
          };
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    25282: function (e, n, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(n, { Z: () => g });
          var s = t(52322),
            a = t(69816),
            i = t(65027),
            o = t(30464),
            r = t(75958),
            d = t(76147),
            c = t(2784),
            u = t(54827),
            m = t(69787),
            h = t(14212),
            v = t(43380),
            x = e([d, i, m, h, u]);
          [d, i, m, h, u] = x.then ? (await x)() : x;
          let f = (0, c.forwardRef)((e, n) => {
            let {
                isIBCTransfer: t,
                sendSelectedNetwork: l,
                destChainInfo: r,
                selectedAddress: x,
                setSelectedContact: f,
                setIsAddContactSheetVisible: g,
                setShowSelectRecipient: p,
                activeChain: b,
                setInputInProgress: y,
                inputInProgress: w,
                chainInfoStore: j,
                chainFeatureFlagsStore: N
              } = e,
              [C, k] = (0, c.useState)(""),
              { setSelectedAddress: S } = (0, d.GE)(),
              I = i.w.useWallets(),
              D = (0, c.useMemo)(() => (I ? Object.values(I) : []), [I]);
            return (0, s.jsxs)("div", {
              className: " bg-secondary-100 rounded-xl mx-6",
              children: [
                (0, s.jsxs)("div", {
                  className: "w-full p-5 flex flex-col gap-4",
                  children: [
                    (0, s.jsxs)("div", {
                      className: "flex justify-between items-center w-full",
                      children: [
                        (0, s.jsx)("p", { className: "text-muted-foreground text-sm font-medium !leading-[22.4px]", children: "Recipient" }),
                        t && "mainnet" === l && r
                          ? (0, s.jsxs)("div", {
                              className: "flex w-fit gap-0.5 py-0.5 px-[10px] bg-[#0A84FF] rounded-3xl items-center",
                              children: [
                                (0, s.jsx)(o.r.Misc.IbcProtocol, { color: "#fff" }),
                                (0, s.jsx)(a.Z, { size: "xs", color: "text-white-100", className: "whitespace-nowrap font-medium", children: "IBC Transfer" })
                              ]
                            })
                          : null
                      ]
                    }),
                    x && !w
                      ? (0, s.jsx)(v.Z, {
                          selectedAddress: x,
                          setSelectedContact: f,
                          setIsAddContactSheetVisible: g,
                          activeChain: b,
                          wallets: D,
                          onEdit: () => {
                            y(!0),
                              k((null == x ? void 0 : x.ethAddress) || (null == x ? void 0 : x.address) || ""),
                              S(null),
                              setTimeout(() => {
                                if (n && "current" in n) {
                                  var e;
                                  null === (e = n.current) || void 0 === e || e.focus();
                                }
                              }, 200);
                          }
                        })
                      : (0, s.jsx)(m.Z, {
                          ref: n,
                          setInputInProgress: y,
                          setShowSelectRecipient: p,
                          setRecipientInputValue: k,
                          recipientInputValue: C,
                          chainInfoStore: j,
                          chainFeatureFlagsStore: N,
                          selectedNetwork: l
                        })
                  ]
                }),
                x && !w ? (0, s.jsx)(h.V, {}) : null,
                (0, s.jsx)(u.ug, {})
              ]
            });
          });
          f.displayName = "RecipientCard";
          let g = (0, r.Pi)(f);
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    69787: function (e, n, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(n, { Z: () => A });
          var s = t(52322),
            a = t(41172),
            i = t(15969),
            o = t(44658),
            r = t(59145),
            d = t(89187),
            c = t(66534),
            u = t(42941),
            m = t(65027),
            h = t(40853),
            v = t(30464),
            x = t(75958),
            f = t(76147),
            g = t(59079),
            p = t(60914),
            b = t(2784),
            y = t(81354),
            w = t(54525),
            j = t(53221),
            N = t(70514),
            C = t(48534),
            k = t(68975),
            S = e([f, m, k, p]);
          [f, m, k, p] = S.then ? (await S)() : S;
          let I = /^[a-zA-Z0-9_-]+\.[a-z]+$/,
            D = /^[a-zA-Z0-9_-]+@[a-z]+$/,
            M = (0, b.forwardRef)((e, n) => {
              let {
                  setShowSelectRecipient: t,
                  setRecipientInputValue: l,
                  recipientInputValue: x,
                  setInputInProgress: S,
                  chainInfoStore: M,
                  chainFeatureFlagsStore: A,
                  selectedNetwork: T
                } = e,
                E = (0, u.Z)().get("recipient") ?? void 0,
                {
                  setEthAddress: O,
                  setSelectedAddress: B,
                  addressError: _,
                  setMemo: L,
                  sendActiveChain: z,
                  setAddressError: Z,
                  setAddressWarning: F
                } = (0, f.GE)(),
                P = (0, a.tIw)(),
                [U, W] = (0, b.useState)(!1),
                G = (0, a.NrF)(x, 100),
                R = w.o.useGetContact(x),
                H = m.w.useWallets(),
                $ = (0, b.useMemo)(
                  () =>
                    H
                      ? Object.values(H)
                          .map(e => e)
                          .sort((e, n) =>
                            e.createdAt && n.createdAt ? new Date(e.createdAt).getTime() - new Date(n.createdAt).getTime() : e.name.localeCompare(n.name)
                          )
                      : [],
                  [H]
                ),
                V = (0, b.useMemo)(() => {
                  let e = $.find(e => {
                    var n;
                    let t = Object.values(e.addresses) || [],
                      l = null == e ? void 0 : null === (n = e.pubKeys) || void 0 === n ? void 0 : n.ethereum,
                      s = l ? o.SZ.getEvmAddress(l, !0) : void 0;
                    return s && t.push(s), t.some(e => x.toLowerCase() === e.toLowerCase());
                  });
                  if (e) return e;
                }, [x, $]),
                K = R ?? V,
                J = (0, b.useMemo)(() => {
                  let e = [...Object.keys(P), "arch", "sol", "sei", "pp", "core", "i"];
                  r.L.spaceIds && e.push(...r.L.spaceIds);
                  let [, n] = x.split("."),
                    t = -1 !== e.indexOf(n);
                  return (I.test(x) && t) || D.test(x);
                }, [x, P]),
                Q = M.chainInfos,
                q = null == A ? void 0 : A.chainFeatureFlagsData,
                Y = (0, b.useMemo)(() => {
                  let e = [];
                  return (
                    Object.keys(q)
                      .filter(e => {
                        var n;
                        return (null == q ? void 0 : null === (n = q[e]) || void 0 === n ? void 0 : n.chainType) === "minitia";
                      })
                      .forEach(n => {
                        Q[n] && e.push(Q[n]);
                        let t = Object.values(M.chainInfos).find(e =>
                          "testnet" === T ? (null == e ? void 0 : e.testnetChainId) === n : (null == e ? void 0 : e.chainId) === n
                        );
                        t && e.push(t);
                      }),
                    e
                  );
                }, [q, Q, T, null == M ? void 0 : M.chainInfos]);
              (0, g.d)({ setAddressError: Z, setAddressWarning: F, recipientInputValue: x, showNameServiceResults: J, sendActiveChain: z }),
                (0, b.useEffect)(() => {
                  E &&
                    (l(E),
                    ((0, i.AtH)(x) || (0, i.Ohs)(x) || (0, i.$v)(x) || (0, i.BVJ)(x)) &&
                      B({
                        address: E,
                        ethAddress: E,
                        name: (0, a.Hnh)(E),
                        avatarIcon: (null == V ? void 0 : V.avatar) || "",
                        selectionType: "notSaved",
                        chainIcon: "",
                        chainName: "",
                        emoji: void 0
                      }));
                }, [E]);
              let X = (0, b.useCallback)(
                  e => {
                    if (e) {
                      L("");
                      try {
                        if (0 === e.length) {
                          Z(void 0);
                          return;
                        }
                        let n = "cosmos";
                        try {
                          if ((0, i.$v)(e)) n = "movement";
                          else if ((0, i.Ohs)(e)) n = "ethereum";
                          else if (e.startsWith("tb1q")) n = "bitcoinSignet";
                          else if (e.startsWith("bc1q")) n = "bitcoin";
                          else {
                            let { prefix: t } = c.bech32.decode(e);
                            if (((n = P[t]), "init" === t)) {
                              W(!0);
                              return;
                            }
                          }
                        } catch {
                          if ((0, i.BVJ)(e)) n = "solana";
                          else throw Error("Invalid Address");
                        }
                        B({
                          address: e,
                          ethAddress: e,
                          name: K ? K.name : "",
                          avatarIcon: (null == V ? void 0 : V.avatar) || "",
                          selectionType: K ? "saved" : "notSaved",
                          chainIcon: "",
                          chainName: n,
                          emoji: void 0
                        }),
                          S(!1),
                          y.K5.resetUpdateCount();
                      } catch (e) {}
                    }
                  },
                  [P, K, null == V ? void 0 : V.avatar, Z, L, B, S]
                ),
                ee = (0, b.useCallback)(() => {
                  let e = null == x ? void 0 : x.trim();
                  X(e);
                }, [x, X]),
                en = (0, b.useCallback)(() => {
                  if (
                    (j.i
                      .pasteText()
                      .then(e => {
                        e && (l(e.trim()), X(e.trim()));
                      })
                      .catch(() => {}),
                    n && "current" in n)
                  ) {
                    var e;
                    null === (e = n.current) || void 0 === e || e.focus();
                  }
                }, [n, l, X]),
                et = (0, b.useCallback)(
                  e => {
                    Z(void 0), B(e), O(e.ethAddress ?? ""), l(e.address ?? ""), S(!1), y.K5.resetUpdateCount();
                  },
                  [Z, O, B, l, S]
                ),
                el = (0, b.useCallback)(
                  e => {
                    S(!0), l(e.target.value), X(e.target.value);
                  },
                  [S, l, X]
                ),
                es = !J && _,
                ea = (null == x ? void 0 : x.length) > 0 && (null == G ? void 0 : G.length) > 0 && !_ && !J;
              return (0, s.jsxs)("div", {
                className: "flex flex-col justify-start items-start",
                children: [
                  (0, s.jsxs)("div", {
                    className: "flex justify-between items-center w-full gap-2",
                    children: [
                      (0, s.jsx)("input", {
                        ref: n,
                        className: (0, N.cn)(
                          "flex-1 h-8 bg-transparent text-[18px] text-monochrome placeholder:text-muted-foreground placeholder:text-[18px] placeholder:font-bold font-bold text-foreground ring-0 outline-none caret-accent-green",
                          (0, C.oj)() ? "!min-w-0" : ""
                        ),
                        placeholder: "Enter address",
                        value: x,
                        onChange: el,
                        "aria-label": "recipient input"
                      }),
                      (0, s.jsxs)("div", {
                        className: "flex flex-row justify-end items-center shrink-0 gap-2",
                        children: [
                          !x &&
                            (0, s.jsx)(
                              "button",
                              {
                                className:
                                  "rounded-lg font-bold text-sm py-2 tracking-normal px-[10px] !leading-[16px] bg-secondary-200 hover:bg-secondary-300 transition-colors duration-200 cursor-pointer",
                                onClick: en,
                                "aria-label": "send recipient paste button in send flow",
                                children: (0, s.jsx)("span", { "aria-label": "send recipient paste button text in send flow", children: "Paste" })
                              },
                              "paste"
                            ),
                          !x &&
                            (0, s.jsx)("button", {
                              className: "p-1.5 rounded-lg bg-secondary-200 hover:bg-secondary-300 transition-colors duration-200 cursor-pointer",
                              onClick: () => {
                                t(!0);
                              },
                              "aria-label": "send recipient contact select button in send flow",
                              children: (0, s.jsx)(h.N, {
                                className: "text-foreground p-[2px]",
                                size: 20,
                                "aria-label": "send recipient contact select button icon"
                              })
                            })
                        ]
                      })
                    ]
                  }),
                  es || ea || J ? (0, s.jsx)("div", { className: "w-full h-[1px] mt-5 bg-secondary-300" }) : null,
                  es ? (0, s.jsx)("div", { className: "text-sm text-destructive-100 font-medium leading-[19px] mt-5", children: _ }) : null,
                  ea
                    ? (0, s.jsx)("button", {
                        className: "w-full flex items-center gap-3 cursor-pointer mt-5",
                        onClick: ee,
                        "aria-label": "send recipient select in send flow",
                        children: (0, s.jsxs)("div", {
                          className: "flex justify-between items-center w-full",
                          children: [
                            (0, s.jsxs)("div", {
                              className: "flex items-center gap-4",
                              children: [
                                (0, s.jsx)("img", {
                                  className: "h-11 w-11 rounded-full",
                                  src: (null == V ? void 0 : V.avatar) || v.r.Misc.getWalletIconAtIndex(0),
                                  "aria-label": "send recipient avatar"
                                }),
                                (0, s.jsxs)("div", {
                                  className: "flex flex-col",
                                  children: [
                                    K &&
                                      (0, s.jsx)("p", {
                                        className: "font-bold text-left text-monochrome text-sm capitalize",
                                        "aria-label": "send recipient name",
                                        children: K.name
                                      }),
                                    K
                                      ? (0, s.jsx)("p", { className: "text-sm text-muted-foreground text-left", children: (0, a.Hnh)(x) })
                                      : (0, s.jsx)("p", {
                                          className: "font-bold text-left text-monochrome text-sm",
                                          "aria-label": "send recipient address",
                                          children: (0, a.Hnh)(x)
                                        })
                                  ]
                                })
                              ]
                            }),
                            (0, s.jsx)(d.T, { className: "text-muted-foreground", size: 16, "aria-label": "send recipient select caret right" })
                          ]
                        })
                      })
                    : null,
                  J ? (0, s.jsx)(k.Z, { address: x, handleContactSelect: et }) : null,
                  (0, s.jsx)(p.j, {
                    isOpen: U,
                    onClose: () => W(!1),
                    setSelectedAddress: e => {
                      B(e), W(!1), S(!1), y.K5.resetUpdateCount();
                    },
                    address: x,
                    forceName: K ? K.name : void 0,
                    wallet: V,
                    chainList: Y.map(e => e.key)
                  })
                ]
              });
            });
          M.displayName = "InputCard";
          let A = (0, x.Pi)(M);
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    68975: function (e, n, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(n, { Z: () => y });
          var s = t(52322),
            a = t(41172),
            i = t(89187),
            o = t(46836),
            r = t(38313),
            d = t(36400),
            c = t(30464),
            u = t(29750),
            m = t(76147),
            h = t(2784),
            v = t(86874),
            x = t(85763),
            f = t(70514),
            g = e([r, d, m, o]);
          [r, d, m, o] = g.then ? (await g)() : g;
          let p = () =>
              (0, s.jsxs)("div", {
                className: "flex w-full z-0",
                children: [
                  (0, s.jsx)(v.Z, { circle: !0, className: "w-11 h-11", containerClassName: "block !leading-none shrink-0 w-11 h-11" }),
                  (0, s.jsxs)("div", {
                    className: "w-full z-0 ml-4 flex flex-col gap-1.5 justify-center items-start",
                    children: [
                      (0, s.jsx)(v.Z, { count: 1, width: 100, height: 16, className: "z-0", containerClassName: "block !leading-none" }),
                      (0, s.jsx)(v.Z, { count: 1, width: 80, height: 16, className: "z-0", containerClassName: "block !leading-none" })
                    ]
                  })
                ]
              }),
            b = e => {
              let { address: n, title: t, nameServiceImg: l, handleClick: o } = e;
              return (0, s.jsx)("button", {
                className: (0, f.cn)("w-full flex items-center gap-3 cursor-pointer pb-4"),
                onClick: o,
                "aria-label": "match list item button in send flow",
                children: (0, s.jsxs)("div", {
                  className: "flex justify-between items-center w-full",
                  children: [
                    (0, s.jsxs)("div", {
                      className: "flex items-center gap-4",
                      children: [
                        (0, s.jsx)("img", { className: "h-11 w-11", src: l ?? c.r.Misc.getWalletIconAtIndex(0) }),
                        (0, s.jsxs)("div", {
                          className: "flex flex-col",
                          children: [
                            (0, s.jsx)("p", { className: "font-bold text-left text-monochrome text-sm capitalize", children: t }),
                            (0, s.jsx)("p", { className: "text-sm text-muted-foreground text-left", children: (0, a.Hnh)(n) })
                          ]
                        })
                      ]
                    }),
                    (0, s.jsx)(i.T, { className: "text-muted-foreground", size: 16 })
                  ]
                })
              });
            },
            y = e => {
              let { address: n, handleContactSelect: t } = e,
                l = (0, r.ob)(),
                i = (0, d.pb)();
              (0, a.DI5)();
              let { selectedToken: v, sendActiveChain: f } = (0, m.GE)(),
                [g, y] = (0, o.A)(n, l),
                w = (0, h.useMemo)(
                  () =>
                    Object.entries(y).filter(e => {
                      let [, n] = e;
                      return null !== n;
                    }),
                  [y]
                );
              return (0, s.jsx)("div", {
                className: "w-full",
                children: g
                  ? (0, s.jsx)("div", { className: "mt-5", children: (0, s.jsx)(p, {}) })
                  : (0, s.jsx)(s.Fragment, {
                      children:
                        w && w.length > 0
                          ? (0, s.jsx)(s.Fragment, {
                              children: (0, s.jsx)("ul", {
                                className: "list-none space-y-2 mt-5 max-h-[180px] overflow-y-auto",
                                children: w.map(e => {
                                  let [l, a] = e,
                                    r = c.r.Logos.getNameServiceLogo(l);
                                  if (a && "string" == typeof a) {
                                    let e = x.$.getChainKey(a);
                                    return (
                                      e || (e = null == v ? void 0 : v.tokenBalanceOnChain),
                                      (0, s.jsx)(
                                        b,
                                        {
                                          title: l,
                                          address: a,
                                          nameServiceImg: r,
                                          handleClick: () => {
                                            t({
                                              avatarIcon: r,
                                              chainIcon: e ? i[e].chainSymbolImageUrl ?? u.GenericLight : u.GenericLight,
                                              chainName: "",
                                              name: n,
                                              address: a,
                                              ethAddress: (null == v ? void 0 : v.isEvm) ? a : void 0,
                                              emoji: void 0,
                                              selectionType: "nameService",
                                              information: { nameService: o.L[l], chain_id: e ? i[e].chainName : null }
                                            });
                                          }
                                        },
                                        `${l}-${a}`
                                      )
                                    );
                                  }
                                  if (a && Array.isArray(a)) {
                                    let e = a
                                      .map(e => {
                                        let { chain_id: a, address: d } = e,
                                          c = Object.values(i).find(e => e.chainId === a),
                                          m = (null == c ? void 0 : c.chainSymbolImageUrl) ?? u.GenericLight;
                                        return (0, s.jsx)(
                                          b,
                                          {
                                            title: o.L[l] ?? l ?? (null == c ? void 0 : c.chainName),
                                            address: d,
                                            nameServiceImg: r,
                                            chainIcon: m,
                                            handleClick: () => {
                                              t({
                                                avatarIcon: r,
                                                chainIcon: m,
                                                chainName: "",
                                                name: n,
                                                address: d,
                                                emoji: void 0,
                                                selectionType: "nameService",
                                                information: { nameService: o.L[l], chain_id: a }
                                              });
                                            }
                                          },
                                          `${l}-${a}-${d}`
                                        );
                                      })
                                      .filter(Boolean);
                                    return e.length > 0 ? (0, s.jsx)(s.Fragment, { children: e }) : null;
                                  }
                                  return null;
                                })
                              })
                            })
                          : (0, s.jsx)("p", { className: "text-sm font-bold text-red-300 mt-5", children: "No results found in any name service" })
                    })
              });
            };
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    14212: function (e, n, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(n, { V: () => h });
          var s = t(52322),
            a = t(41172),
            i = t(15969),
            o = t(36906),
            r = t(23259),
            d = t(76147),
            c = t(24074),
            u = t(2784),
            m = e([d]);
          function h() {
            let { sendActiveChain: e, addressError: n, selectedAddress: t, sendSelectedNetwork: l } = (0, d.GE)(),
              m = (0, a.DI5)(),
              h = (0, u.useMemo)(() => {
                var n, s, a, o, d, u, h;
                return (0, i.KPM)(e) || (0, i.bj0)(e) || (null == m ? void 0 : null === (n = m[e]) || void 0 === n ? void 0 : n.evmOnlyChain) || (0, i.Jhy)(e)
                  ? (0, c.x)((null == m ? void 0 : null === (d = m[e]) || void 0 === d ? void 0 : d.chainName) ?? e, l)
                  : r.ci.includes(e) &&
                      ((null == t ? void 0 : null === (s = t.ethAddress) || void 0 === s ? void 0 : s.startsWith("0x")) ||
                        (null == t ? void 0 : null === (a = t.address) || void 0 === a ? void 0 : a.startsWith("0x")))
                    ? (0, c.x)((null == m ? void 0 : null === (u = m[e]) || void 0 === u ? void 0 : u.chainName) ?? e, l)
                    : (null == t ? void 0 : null === (o = t.address) || void 0 === o ? void 0 : o.startsWith("init")) && (null == t ? void 0 : t.chainName)
                      ? (0, c.x)((null == m ? void 0 : null === (h = m[null == t ? void 0 : t.chainName]) || void 0 === h ? void 0 : h.chainName) ?? e, l)
                      : void 0;
              }, [l, e, m, null == t ? void 0 : t.ethAddress, null == t ? void 0 : t.address, null == t ? void 0 : t.chainName]);
            return !h || n
              ? null
              : (0, s.jsxs)("div", {
                  className: "flex flex-col gap-3 mb-3",
                  children: [
                    (0, s.jsx)("div", { className: "bg-secondary-300 h-[1px] w-full" }),
                    (0, s.jsxs)("div", {
                      className: "flex flex-row gap-2 items-center justify-start px-4",
                      children: [
                        (0, s.jsx)(o.k, { height: 16, width: 16, className: "text-accent-blue min-w-4 shrink-0" }),
                        (0, s.jsxs)("div", {
                          className: "text-xs text-accent-blue font-medium !leading-[19px]",
                          children: ["This token will be sent to “", h, "”"]
                        })
                      ]
                    })
                  ]
                });
          }
          (d = (m.then ? (await m)() : m)[0]), l();
        } catch (e) {
          l(e);
        }
      });
    },
    43380: function (e, n, t) {
      t.d(n, { Z: () => d });
      var l = t(52322),
        s = t(41172),
        a = t(44658),
        i = t(2784);
      let o = e =>
        (0, l.jsx)("svg", {
          width: "16",
          height: "16",
          viewBox: "0 0 16 16",
          fill: "none",
          xmlns: "http://www.w3.org/2000/svg",
          ...e,
          children: (0, l.jsx)("path", {
            d: "M9.3726 6.01333L9.98593 6.62667L3.94593 12.6667H3.3326V12.0533L9.3726 6.01333ZM11.7726 2C11.6059 2 11.4326 2.06667 11.3059 2.19333L10.0859 3.41333L12.5859 5.91333L13.8059 4.69333C14.0659 4.43333 14.0659 4.01333 13.8059 3.75333L12.2459 2.19333C12.1126 2.06 11.9459 2 11.7726 2ZM9.3726 4.12667L1.99927 11.5V14H4.49927L11.8726 6.62667L9.3726 4.12667Z",
            fill: "currentColor"
          })
        });
      var r = t(30464);
      let d = e => {
        let { selectedAddress: n, setSelectedContact: t, setIsAddContactSheetVisible: d, activeChain: c, onEdit: u, wallets: m } = e,
          h = (0, i.useMemo)(
            () =>
              m.find(e => {
                var t;
                let l = Object.values(e.addresses) || [],
                  s = null == e ? void 0 : null === (t = e.pubKeys) || void 0 === t ? void 0 : t.ethereum,
                  i = s ? a.SZ.getEvmAddress(s, !0) : void 0;
                return (
                  i && l.push(i),
                  l.some(e => {
                    var t, l;
                    return (
                      e &&
                      ((null == n ? void 0 : null === (t = n.ethAddress) || void 0 === t ? void 0 : t.toLowerCase()) === e.toLowerCase() ||
                        (null == n ? void 0 : null === (l = n.address) || void 0 === l ? void 0 : l.toLowerCase()) === e.toLowerCase())
                    );
                  })
                );
              }),
            [null == n ? void 0 : n.address, null == n ? void 0 : n.ethAddress, m]
          );
        return (0, l.jsx)(l.Fragment, {
          children: (0, l.jsxs)("div", {
            className: "flex justify-between items-center w-full",
            children: [
              (0, l.jsxs)("div", {
                className: "flex gap-4 items-center",
                children: [
                  (0, l.jsx)("img", { className: "h-11 w-11 rounded-full", src: (null == n ? void 0 : n.avatarIcon) || r.r.Misc.getWalletIconAtIndex(0) }),
                  (0, l.jsxs)("div", {
                    className: "flex flex-col gap-1",
                    children: [
                      (0, l.jsx)("p", {
                        className: "font-bold text-left text-monochrome text-sm",
                        children: h
                          ? h.name
                          : (null == n ? void 0 : n.name)
                            ? (0, s.kC2)(null == n ? void 0 : n.name)
                            : (0, s.Hnh)((null == n ? void 0 : n.ethAddress) ? (null == n ? void 0 : n.ethAddress) : null == n ? void 0 : n.address)
                      }),
                      (null == n ? void 0 : n.name)
                        ? (0, l.jsx)("p", {
                            className: "text-sm text-muted-foreground",
                            children: (0, s.Hnh)((null == n ? void 0 : n.ethAddress) ? (null == n ? void 0 : n.ethAddress) : null == n ? void 0 : n.address)
                          })
                        : (0, l.jsx)("div", {
                            className:
                              "bg-secondary-200 hover:bg-secondary-300 text-xs text-muted-foreground hover:text-monochrome rounded-full py-0.5 pl-1.5 pr-2 cursor-pointer",
                            onClick: () => {
                              t({
                                address: (null == n ? void 0 : n.ethAddress) || (null == n ? void 0 : n.address) || "",
                                name: "",
                                emoji: 0,
                                blockchain: c,
                                ethAddress: (null == n ? void 0 : n.ethAddress) || ""
                              }),
                                d(!0);
                            },
                            "aria-label": "add to contacts button in recipient display card in send flow",
                            children: (0, l.jsx)("span", {
                              "aria-label": "add to contacts button text in recipient display card in send flow",
                              children: "+ Add to contacts"
                            })
                          })
                    ]
                  })
                ]
              }),
              (0, l.jsx)(o, {
                height: 32,
                width: 32,
                weight: "fill",
                className: "bg-secondary-300 rounded-full p-2 text-monochrome cursor-pointer",
                onClick: e => {
                  e.stopPropagation(), u();
                },
                "aria-label": "edit contact button in recipient display card in send flow"
              })
            ]
          })
        });
      };
    },
    72112: function (e, n, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(n, { Z: () => C });
          var s = t(52322),
            a = t(41172),
            i = t(15969),
            o = t(26552),
            r = t(29049),
            d = t(66534),
            c = t(71517),
            u = t(19623),
            m = t(96217),
            h = t(69816),
            v = t(91486),
            x = t(72059),
            f = t(11081),
            g = t(57124),
            p = t(30464),
            b = t(2784),
            y = t(46103),
            w = t(54525),
            j = t(76147),
            N = e([j, x]);
          function C(e) {
            let { isOpen: n, onClose: t, address: l, ethAddress: N, onSave: C, sendActiveChain: k, showDeleteBtn: S } = e,
              [I, D] = (0, b.useState)(""),
              [M, A] = (0, b.useState)(""),
              [T, E] = (0, b.useState)(1),
              [O, B] = (0, b.useState)(!1),
              [_, L] = (0, b.useState)(""),
              [z, Z] = (0, b.useState)(""),
              [F, P] = (0, b.useState)(""),
              [U, W] = (0, b.useState)(!1),
              { setMemo: G, setSelectedAddress: R } = (0, j.GE)(),
              H = w.o.useGetContact(l),
              { contacts: $, loading: V } = (0, f.g)(),
              K = (0, a.tIw)(),
              J = (0, g.a)(),
              Q = (0, b.useRef)(null),
              q = (0, a.DI5)(),
              Y = (0, x.a7)();
            (0, b.useMemo)(() => k ?? Y, [k, Y]);
            let X = (0, b.useMemo)(() => {
              try {
                let e = "cosmos";
                if ((0, i.$v)(l)) e = "movement";
                else if ((0, i.Ohs)(l)) e = "ethereum";
                else if (l.startsWith("tb1q")) e = "bitcoinSignet";
                else if (l.startsWith("bc1q")) e = "bitcoin";
                else {
                  let { prefix: n } = d.bech32.decode(l);
                  e = K[n];
                }
                return e;
              } catch (e) {
                if ((0, i.BVJ)(l)) return "solana";
                return "cosmos";
              }
            }, [l, K]);
            (0, b.useEffect)(() => {
              H && (A(H.name), E(H.emoji), D(H.memo ?? ""), B((null == H ? void 0 : H.saveAsCEX) ?? !1), P(H.ethAddress || H.address));
            }, [H]),
              (0, b.useEffect)(() => {
                ((0, i.AtH)(l) || (0, i.Ohs)(l) || (0, i.$v)(l) || (0, i.BVJ)(l)) && P(l);
              }, [l]),
              (0, b.useEffect)(() => {
                n && Q.current && Q.current.focus();
              }, [n]);
            let ee = async () => {
                if (!_ && !z && M && F && !U) {
                  var e, n;
                  W(!0),
                    await w.o.save({ address: F, blockchain: X, emoji: T, name: M, memo: I, ethAddress: N, saveAsCEX: O }),
                    G(I),
                    null == C ||
                      C({
                        ethAddress: N,
                        address: F,
                        chainIcon: (null === (e = q[X]) || void 0 === e ? void 0 : e.chainSymbolImageUrl) ?? J ?? "",
                        emoji: T,
                        name: M,
                        avatarIcon: "",
                        chainName: null === (n = q[X]) || void 0 === n ? void 0 : n.chainName,
                        selectionType: "saved"
                      }),
                    t(),
                    W(!1),
                    L(""),
                    Z(""),
                    P(""),
                    A(""),
                    D(""),
                    B(!1);
                }
              },
              en = async () => {
                ((null == H ? void 0 : H.ethAddress) || (null == H ? void 0 : H.address)) &&
                  (W(!0),
                  await w.o.removeEntry((null == H ? void 0 : H.ethAddress) || (null == H ? void 0 : H.address)),
                  R(null),
                  A(""),
                  D(""),
                  B(!1),
                  P(""),
                  W(!1),
                  t());
              };
            return (0, s.jsx)(m.Z, {
              containerClassName: "bg-secondary-50",
              title: H ? "Edit Contact" : "Add Contact",
              onClose: t,
              isOpen: n,
              className: "!p-6",
              fullScreen: !0,
              secondaryActionButton: S
                ? (0, s.jsx)(o.S, { size: 48, className: "text-muted-foreground hover:text-foreground p-3.5 cursor-pointer", weight: "fill", onClick: en })
                : null,
              children: (0, s.jsx)("form", {
                className: "flex flex-col items-center w-full gap-y-4",
                onSubmit: e => {
                  e.preventDefault(), ee();
                },
                children: (0, s.jsxs)("div", {
                  className: "flex flex-col gap-y-5 w-full items-center",
                  children: [
                    (0, s.jsx)("img", { src: p.r.Misc.getWalletIconAtIndex(0), width: 80, height: 80, className: "mb-3" }),
                    (0, s.jsx)("textarea", {
                      placeholder: "enter address",
                      value: F,
                      onChange: e => {
                        _ && L("");
                        let n = e.target.value;
                        if ((P(n), n.length > 0 && !(0, i.AtH)(n) && !(0, i.Ohs)(n) && !(0, i.$v)(n) && !(0, i.BVJ)(n))) {
                          L("Invalid address");
                          return;
                        }
                        if (
                          Object.values($).some(e => {
                            let { address: t } = e;
                            return t === n;
                          }) &&
                          n !== ((null == H ? void 0 : H.ethAddress) || (null == H ? void 0 : H.address))
                        ) {
                          L("Contact with same address already exists");
                          return;
                        }
                      },
                      className:
                        "h-[90px] rounded-lg placeholder:text-muted-foreground text-monochrome font-medium outline-none border border-secondary-300 hover:border-secondary-400 focus-within:!border-monochrome  bg-secondary w-full resize-none py-3 px-4 text-base"
                    }),
                    (0, s.jsx)("input", {
                      placeholder: "enter recipient’s name",
                      value: M,
                      onChange: e => {
                        z && Z("");
                        let n = e.target.value;
                        n.length < 24 &&
                          (n.length &&
                          !V &&
                          Object.values($).some(e => {
                            let { name: t, address: s } = e;
                            return s !== l && t.trim().toLowerCase() === n.trim().toLowerCase();
                          })
                            ? Z("Contact with same name already exists")
                            : "Contact with same name already exists" === z && Z(""),
                          A(n));
                      },
                      ref: Q,
                      className:
                        "rounded-lg placeholder:text-muted-foreground text-monochrome font-medium outline-none border border-secondary-300 hover:border-secondary-400 focus-within:!border-monochrome  bg-secondary w-full resize-none py-3 px-4 text-base"
                    }),
                    O &&
                      (0, s.jsxs)("div", {
                        className:
                          "p-5 rounded-xl bg-secondary-100 border border-secondary flex justify-between items-center dark:focus-within:border-white-100 hover:border-secondary-400 focus-within:border-black-100 w-full px-4 py-3",
                        children: [
                          (0, s.jsx)("input", {
                            type: "text",
                            value: I,
                            placeholder: "Add memo",
                            className:
                              "!leading-[22.4px] bg-transparent font-medium text-sm text-monochrome placeholder:text-muted-foreground outline-none w-full",
                            onChange: e => {
                              var n;
                              return D(null === (n = e.target) || void 0 === n ? void 0 : n.value);
                            }
                          }),
                          0 === I.length
                            ? (0, s.jsx)(r.v, { size: 20, className: "text-muted-foreground p-0.5" })
                            : (0, s.jsx)("div", {
                                onClick: () => D(""),
                                children: (0, s.jsx)(h.Z, {
                                  size: "xs",
                                  color: "text-muted-foreground",
                                  className: " font-bold cursor-pointer ml-2",
                                  children: "Clear"
                                })
                              })
                        ]
                      }),
                    (_ || z) && (0, s.jsx)(h.Z, { size: "xs", color: "text-red-300", className: "font-bold", children: _ || z }),
                    U
                      ? (0, s.jsx)(u.T, { color: y.w.white100 })
                      : (0, s.jsx)(v.zx, {
                          className: "w-full mt-3",
                          disabled: !M || !F || !!_ || !!z || (O && 0 === I.length),
                          title: "Save contact",
                          children: "Save contact"
                        }),
                    (0, s.jsxs)("div", {
                      className: "flex gap-1 w-full justify-center",
                      children: [
                        (0, s.jsx)(c.X, { checked: O, onClick: () => B(e => !e) }),
                        (0, s.jsx)("p", { className: "text-sm font-medium text-accent-green", children: "Save as centralized exchange" })
                      ]
                    })
                  ]
                })
              })
            });
          }
          ([j, x] = N.then ? (await N)() : N), l();
        } catch (e) {
          l(e);
        }
      });
    },
    76516: function (e, n, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(n, { y: () => b });
          var s = t(41172),
            a = t(15969),
            i = t(86134),
            o = t(66815),
            r = t(6809),
            d = t(6391),
            c = t.n(d),
            u = t(10706),
            m = t(71693),
            h = t(65027),
            v = t(76147),
            x = t(43460),
            f = t(2784),
            g = t(1252),
            p = e([v, m, h, u]);
          [v, m, h, u] = p.then ? (await p)() : p;
          let b = () => {
            let [e, n] = (0, f.useState)(!1),
              [t, l] = (0, f.useState)(),
              {
                selectedToken: d,
                selectedAddress: p,
                fee: b,
                inputAmount: y,
                isIBCTransfer: w,
                transferData: j,
                memo: N,
                sendActiveChain: C,
                sendSelectedNetwork: k
              } = (0, v.GE)(),
              S = (0, s.X82)(),
              { chains: I } = (0, s._IL)(),
              { data: D } = (0, r.C$)(),
              { setPendingTx: M } = (0, s.EEe)(),
              { walletClient: A } = (0, m.p)(C),
              T = (0, s.FmJ)(),
              E = s.rNU.useOperateCosmosTx(),
              [O, B] = (0, f.useState)(!1),
              _ = h.w.useGetWallet(),
              L = (0, s.xxU)(C, k),
              { activeWallet: z } = (0, u.ZP)(),
              Z = null == z ? void 0 : z.addresses[C],
              F = (0, f.useMemo)(() => (0, g.nY)(Object.values(I)), [I]),
              P = (0, s.giH)();
            return {
              confirmSkipTx: async e => {
                if (!b || !j || !("messages" in j) || !(null == j ? void 0 : j.messages) || !I) {
                  b
                    ? j && "messages" in j && (null == j ? void 0 : j.messages)
                      ? I
                        ? l("Invalid transfer data")
                        : l("Invalid transfer chains")
                      : l("Invalid transfer message")
                    : l("Invalid transfer fee");
                  return;
                }
                l(void 0), n(!0);
                let { messages: t } = j;
                for (let j = 0; j < t.length; j++) {
                  var r, u, m, h, v, f, g;
                  let O, U, W;
                  let G = t[j],
                    R = null == G ? void 0 : G.multi_chain_msg,
                    H = JSON.parse(R.msg),
                    $ = new Date().getTime();
                  if (Number(H.timeout_timestamp / 1e6) < $) {
                    l("Transaction timed out"), n(!1);
                    return;
                  }
                  let { senderAddress: V, encodedMessage: K } = (0, o.u0)(R.msg_type_url, H),
                    J = null == D ? void 0 : D.find(e => e.chainId === R.chain_id);
                  if (!J) {
                    l("Chain info is not found");
                    return;
                  }
                  try {
                    (O = await A.getAccount("")), (U = await A.getSigner("")), (null == O ? void 0 : O.isNanoLedger) && B(!0);
                  } catch (e) {
                    l(null == e ? void 0 : e.message), n(!1);
                    return;
                  }
                  let Q = P(k, J.key, J.chainId),
                    q = new o.gO(String(J.chainId), J.restUrl, J.coinType, U, O, Q ? "/initia.crypto.v1beta1.ethsecp256k1.PubKey" : void 0),
                    Y = await _(J.key);
                  try {
                    if ((null == z ? void 0 : z.walletType) === s._KQ.LEDGER) {
                      if (F.includes(J.key)) {
                        if ("injective" === J.key) {
                          let e = new a.QQ$(!1, Y, J.restUrl),
                            n = (await (0, a.WdH)(J.restUrl, K.value.sourceChannel, "transfer")).data.identified_client_state.client_state.latest_height,
                            t = { revisionHeight: new (c())(n.revision_height).plus(150), revisionNumber: n.revision_number },
                            l = {
                              ...K,
                              value: {
                                memo: K.value.memo,
                                receiver: K.value.receiver,
                                sender: K.value.sender,
                                amount: K.value.token,
                                height: t,
                                timeout: K.value.timeoutTimestamp,
                                port: K.value.sourcePort,
                                channelId: K.value.sourceChannel
                              }
                            },
                            s = await e.signTx(V, [l], b, N);
                          W = i.gO.encode(s);
                        } else if ("dymension" === J.key || "evmos" === J.key || "humans" === J.key || "xrpl" === J.key) {
                          let e = new a.c6u(J.restUrl, Y, a.oCA[J.key].chainId, a.oCA[J.key].evmChainId),
                            n = K.value;
                          if (!n.token) throw Error("Invalid token");
                          W = await e.signIbcTx({
                            fromAddress: n.sender,
                            toAddress: n.receiver,
                            transferAmount: n.token,
                            sourcePort: n.sourcePort,
                            sourceChannel: n.sourceChannel,
                            timeoutTimestamp: void 0,
                            timeoutHeight: void 0,
                            fee: b,
                            memo: N || "",
                            txMemo: n.memo
                          });
                        }
                      } else W = (await (0, x.U)(K, b, J, Y, V, N)).txBytesString;
                    } else W = await q.sign(V, [K], b, N);
                  } catch (e) {
                    (null == e ? void 0 : null === (r = e.message) || void 0 === r ? void 0 : r.includes("rejected")) ||
                    (null == e ? void 0 : null === (u = e.message) || void 0 === u ? void 0 : u.includes("declined"))
                      ? (n(!1), l(null == e ? void 0 : e.message))
                      : (l(null == e ? void 0 : e.message), n(!1)),
                      B(!1);
                    return;
                  } finally {
                    B(!1);
                  }
                  try {
                    let n = "",
                      t = !1;
                    try {
                      let e = await q.submitTx(String(J.chainId), W);
                      if (!(t = e.success)) throw Error("SubmitTx Failed");
                      n = e.response.tx_hash;
                    } catch (e) {
                      if ("SubmitTx Failed" === e.message) {
                        let { transactionHash: e, code: l, codespace: s } = await q.broadcastTx(W);
                        if (((n = e), 0 !== l)) throw Error(`BroadcastTx Failed ${(0, a.f4W)(l, s)}`);
                        t = !0;
                      } else throw Error(`BroadcastTx Failed ${(0, a.f4W)(e.code, e.codespace)}`);
                    }
                    let l = async () => {
                        let e = 0;
                        for (; e <= 100; ) {
                          let t = await o.xJ.getTxnStatus({ chain_id: R.chain_id, tx_hash: n });
                          if (t.success) {
                            let { state: e, error: n } = t.response;
                            if (e === o._T.STATE_COMPLETED_SUCCESS || e === o._T.STATE_ABANDONED) return { code: 0 };
                            if (null == n ? void 0 : n.code) return n;
                          }
                          (e += 1), await (0, a._vH)(2e3);
                        }
                      },
                      i = (null == p ? void 0 : p.address) || "",
                      r = (null == d ? void 0 : d.coinMinimalDenom) || (null == d ? void 0 : d.ibcDenom) || "",
                      c = {
                        img: J.icon,
                        sentAmount: y,
                        sentTokenInfo: { ...d, coinDenom: (null == d ? void 0 : d.symbol) || (null == d ? void 0 : d.name) },
                        sentUsdValue: "",
                        subtitle1: (0, s.Hnh)(i),
                        title1: `${y} ${(null == d ? void 0 : d.symbol) || (null == d ? void 0 : d.name)}`,
                        txStatus: "loading",
                        txType: w ? "ibc/transfer" : "send",
                        txHash: n,
                        promise: l(),
                        sourceChain: C,
                        sourceNetwork: k,
                        toAddress: i,
                        toChain: null == p ? void 0 : p.chainName
                      },
                      u = I[(null === (m = S[(null == d ? void 0 : d.coinMinimalDenom) ?? ""]) || void 0 === m ? void 0 : m.chain) ?? ""],
                      x = await (0, s.IGx)(y, {
                        coinGeckoId: null === (h = S[(null == d ? void 0 : d.coinMinimalDenom) ?? ""]) || void 0 === h ? void 0 : h.coinGeckoId,
                        coinMinimalDenom: (null == d ? void 0 : d.coinMinimalDenom) ?? "",
                        chainId: (0, s.LQk)(u, k),
                        chain: (null == d ? void 0 : d.chain) ?? ""
                      }),
                      g = (0, a.hI1)(y.toString(), (null == d ? void 0 : d.coinDecimals) ?? 6),
                      j = w ? await (0, s.V51)(null == H ? void 0 : H.source_channel, i, { denom: r, amount: g }) : (0, s.dSc)(i, { denom: r, amount: g });
                    (j = { ...j, ...T }),
                      await E({
                        txHash: n,
                        txType: w ? s.pb0.IbcSend : s.pb0.Send,
                        amount: x,
                        metadata: j,
                        feeDenomination: null == b ? void 0 : null === (v = b.amount[0]) || void 0 === v ? void 0 : v.denom,
                        feeQuantity: null == b ? void 0 : null === (f = b.amount[0]) || void 0 === f ? void 0 : f.amount,
                        forceChain: C,
                        forceNetwork: k,
                        forceWalletAddress: Z,
                        chainId: L
                      }),
                      M(c),
                      e(t ? "success" : "txDeclined");
                  } catch (e) {
                    n(!1),
                      (null == e ? void 0 : null === (g = e.message) || void 0 === g ? void 0 : g.includes("insufficient fees"))
                        ? l("Send failed due to low gas fees. Please try again with higher gas.")
                        : l(null == e ? void 0 : e.message);
                    return;
                  }
                }
                n(!1);
              },
              txnProcessing: e,
              error: t,
              showLedgerPopupSkipTx: O,
              setShowLedgerPopupSkipTx: B,
              setError: l
            };
          };
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    51563: function (e, n, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(n, { _: () => I });
          var s = t(52322),
            a = t(41172),
            i = t(15969),
            o = t(6809),
            r = t(60431),
            d = t(91486),
            c = t(23259),
            u = t(10706),
            m = t(36400),
            h = t(42560),
            v = t(71693),
            x = t(75958),
            f = t(76147),
            g = t(2784),
            p = t(42799),
            b = t(48346),
            y = t(30809),
            w = t(70514),
            j = t(56186),
            N = t(5120),
            C = t(48101),
            k = t(47383),
            S = e([u, f, v, m, k, N, j, b, C]);
          [u, f, v, m, k, N, j, b, C] = S.then ? (await S)() : S;
          let I = (0, x.Pi)(e => {
            var n, t;
            let { setShowTxPage: l } = e,
              { activeWallet: x } = (0, u.ZP)(),
              [S, I] = (0, g.useState)(!1),
              [D, M] = (0, g.useState)(!1),
              {
                sendDisabled: A,
                clearTxError: T,
                inputAmount: E,
                selectedToken: O,
                selectedAddress: B,
                setTransferData: _,
                pfmEnabled: L,
                isIbcUnwindingDisabled: z,
                isIBCTransfer: Z,
                fetchAccountDetailsStatus: F,
                amountError: P,
                addressError: U,
                sendActiveChain: W,
                sendSelectedNetwork: G,
                hasToUseCw20PointerLogic: R,
                gasError: H
              } = (0, f.GE)(),
              { status: $ } = (0, a.sXv)(W, G),
              V = (0, i.KPM)(W),
              { chains: K } = (0, a._IL)(),
              J = (0, a.SFn)(W),
              { walletClient: Q } = (0, v.p)(W),
              q = (0, m.pb)(),
              [Y, X] = (0, g.useState)(!1),
              ee = (0, h.Q)(E),
              en = (0, o.cF)(ee, 500),
              { data: et } = (0, o.Uj)({ chainTypes: ["cosmos"], onlyTestnets: "testnet" === G }),
              { data: el } = (0, a.S2A)(),
              { data: es, isLoading: ea } = (0, k.v)(),
              ei = (null == B ? void 0 : null === (n = B.address) || void 0 === n ? void 0 : n.startsWith("init")) ?? !1,
              { data: eo } = (0, o.N0)({ only_testnets: "testnet" === G }),
              er = (0, g.useMemo)(() => {
                var e;
                return null == eo ? void 0 : eo[null == K ? void 0 : null === (e = K[W]) || void 0 === e ? void 0 : e.chainId];
              }, [eo, K, W]),
              ed = (0, g.useMemo)(() => {
                var e, n, t, l;
                let s =
                  null == er
                    ? void 0
                    : er.find(e => {
                        var n;
                        let t = null === (n = e.denom) || void 0 === n ? void 0 : n.replace(/(cw20:|erc20\/)/g, "");
                        return (null == O ? void 0 : O.ibcDenom) ? t === O.ibcDenom : t === (null == O ? void 0 : O.coinMinimalDenom);
                      });
                return s
                  ? {
                      ...s,
                      trace: (null == O ? void 0 : O.ibcChainInfo)
                        ? `transfer/${null === (e = O.ibcChainInfo) || void 0 === e ? void 0 : e.channelId}`
                        : s.trace
                    }
                  : {
                      denom: ((null == O ? void 0 : O.ibcDenom) || (null == O ? void 0 : O.coinMinimalDenom)) ?? "",
                      symbol: (null == O ? void 0 : O.symbol) || "",
                      logoUri: (null == O ? void 0 : O.img) || "",
                      decimals: (null == O ? void 0 : O.coinDecimals) || 0,
                      originDenom: (null == O ? void 0 : O.coinMinimalDenom) || "",
                      trace: (null == O ? void 0 : O.ibcChainInfo) ? `transfer/${null === (n = O.ibcChainInfo) || void 0 === n ? void 0 : n.channelId}` : "",
                      name: (null == O ? void 0 : O.name) || "",
                      chainId: (null == O ? void 0 : null === (t = O.ibcChainInfo) || void 0 === t ? void 0 : t.name) || "",
                      originChainId: (null == O ? void 0 : null === (l = O.ibcChainInfo) || void 0 === l ? void 0 : l.name) || "",
                      isCw20: !1,
                      coingeckoId: (null == O ? void 0 : O.coinGeckoId) || ""
                    };
              }, [O, er]),
              ec = (0, g.useMemo)(() => {
                var e, n;
                if (B && (null === (e = B.address) || void 0 === e ? void 0 : e.startsWith("init")) && B.chainName !== W) {
                  let e = K[null == B ? void 0 : B.chainName];
                  return null == eo
                    ? void 0
                    : null === (n = eo[null == e ? void 0 : e.chainId]) || void 0 === n
                      ? void 0
                      : n.find(n => {
                          var t;
                          return (
                            n.denom === (null === (t = Object.values(null == e ? void 0 : e.nativeDenoms)[0]) || void 0 === t ? void 0 : t.coinMinimalDenom)
                          );
                        });
                }
              }, [eo, K, B, W]),
              eu = (0, o.DA)({
                amount: en,
                asset: ed,
                destinationChain:
                  null == et
                    ? void 0
                    : et.find(e => {
                        var n;
                        return e.chainId === (null === (n = K[null == B ? void 0 : B.chainName]) || void 0 === n ? void 0 : n.chainId);
                      }),
                destinationAsset: ec,
                destinationAddress: null == B ? void 0 : B.address,
                sourceChain: null == et ? void 0 : et.find(e => e.chainId === K[W].chainId),
                userAddress: J ?? "",
                walletClient: Q,
                enabled: (Z || ei) && (null == el ? void 0 : null === (t = el.ibc) || void 0 === t ? void 0 : t.extension) !== "disabled",
                isMainnet: "mainnet" === G
              }),
              { data: em } = (0, r.useQuery)(
                ["minimum-rent-amount", null == B ? void 0 : B.address, W, null == O ? void 0 : O.chain, y.i.selectedNetwork],
                async () => {
                  if ((0, i.Jhy)(W) && (0, i.Jhy)((null == O ? void 0 : O.chain) ?? "")) {
                    var e, n;
                    let t = await i.MPm.getSolanaClient(
                      (null == q ? void 0 : null === (n = q[W]) || void 0 === n ? void 0 : null === (e = n.apis) || void 0 === e ? void 0 : e.rpc) ?? "",
                      void 0,
                      y.i.selectedNetwork,
                      W
                    );
                    return await t.getMinimumRentAmount((null == B ? void 0 : B.address) ?? "");
                  }
                  return 0;
                }
              );
            (0, g.useEffect)(() => {
              (null == eu ? void 0 : eu.messages) ? _(eu) : _({ isSkipTransfer: !1, isGasFeesLoading: !1, gasFees: void 0, gasFeesError: void 0 });
            }, [null == O ? void 0 : O.coinMinimalDenom, null == B ? void 0 : B.chainName, null == eu ? void 0 : eu.messages]),
              (0, g.useEffect)(() => {
                if (ei) {
                  var e, n;
                  (null == eu ? void 0 : eu.isLoadingMessages) ||
                  (null == eu ? void 0 : eu.isLoadingRoute) ||
                  null == B ||
                  !B.chainName ||
                  (null === (e = K[null == B ? void 0 : B.chainName]) || void 0 === e ? void 0 : e.chainId) ===
                    (null === (n = K[W]) || void 0 === n ? void 0 : n.chainId) ||
                  (null == eu ? void 0 : eu.messages)
                    ? M(!1)
                    : M(!0);
                }
              }, [
                K,
                ei,
                null == B ? void 0 : B.chainName,
                W,
                null == eu ? void 0 : eu.isLoadingMessages,
                null == eu ? void 0 : eu.messages,
                null == eu ? void 0 : eu.isLoadingRoute
              ]);
            let eh = (0, g.useMemo)(() => {
                if (U && B) return "Select a different token or address";
                if (!E) return "Enter amount";
                if (D) return "No routes found";
                if (P)
                  return P.includes("IBC transfers are not supported")
                    ? "Select different chain or address"
                    : P.includes("You can only send this token to a SEI address")
                      ? "Address not supported"
                      : P;
                if (U)
                  return "The entered address is invalid" === U
                    ? "Invalid address"
                    : U.includes("IBC transfers are not supported")
                      ? "Select different chain or address"
                      : U;
                if ((null == O ? void 0 : O.chain) === "solana" && (null == O ? void 0 : O.coinMinimalDenom) === "lamports" && "solana" === W) {
                  if (em > Number(E)) return X(!0), `A minimum of ${em} SOL is required`;
                  X(!1);
                }
                return B ? es || "Review Transfer" : "Select address";
              }, [U, P, E, D, em, null == O ? void 0 : O.chain, W, null == O ? void 0 : O.coinMinimalDenom, B, es]),
              ev = (0, g.useCallback)(() => {
                (null == x ? void 0 : x.watchWallet) || I(!0);
              }, [null == x ? void 0 : x.watchWallet, I]),
              ex = (0, g.useMemo)(() => {
                var e, n;
                return (
                  (!!ei &&
                    ((null != eu && !!eu.isLoadingRoute) ||
                      (null != eu && !!eu.isLoadingMessages) ||
                      (null != B &&
                        !!B.chainName &&
                        (null === (e = K[null == B ? void 0 : B.chainName]) || void 0 === e ? void 0 : e.chainId) !==
                          (null === (n = K[W]) || void 0 === n ? void 0 : n.chainId) &&
                        !(null == eu ? void 0 : eu.messages)))) ||
                  (!!V && "loading" === $) ||
                  A ||
                  ea ||
                  !!H ||
                  !!es ||
                  (!L && !z) ||
                  (["error", "loading"].includes(F) && !R) ||
                  Y
                );
              }, [
                ei,
                null == eu ? void 0 : eu.isLoadingRoute,
                null == eu ? void 0 : eu.isLoadingMessages,
                null == eu ? void 0 : eu.messages,
                null == B ? void 0 : B.chainName,
                ea,
                H,
                K,
                W,
                A,
                L,
                z,
                F,
                R,
                $,
                V,
                Y,
                es
              ]);
            return V && "loading" === $
              ? (0, s.jsx)(s.Fragment, {})
              : (0, s.jsxs)(s.Fragment, {
                  children: [
                    (0, s.jsxs)("div", {
                      className: "flex flex-col gap-4 w-full p-4 mt-auto sticky bottom-0 bg-secondary-100 ",
                      children: [
                        c.Vv.includes(W) ? (0, s.jsx)(N.v, {}) : (0, s.jsx)(j.N, { rootBalanceStore: b.jZ, rootDenomsStore: p.gb }),
                        (0, s.jsx)(d.zx, {
                          onClick: ev,
                          disabled: ex,
                          "data-testing-id": "send-review-transfer-btn",
                          className: (0, w.cn)("w-full", { "!bg-red-300 text-white-100": U || P || D || H || Y || es }),
                          "aria-label": "send review transfer button",
                          children: (0, s.jsx)("span", { "aria-label": "send review transfer button text in send flow", children: eh })
                        })
                      ]
                    }),
                    (0, s.jsx)(C.A, {
                      isOpen: S,
                      onClose: () => {
                        I(!1), T();
                      },
                      setShowTxPage: l,
                      rootERC20DenomsStore: p.iE
                    })
                  ]
                });
          });
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    48101: function (e, n, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(n, { A: () => P });
          var s = t(52322),
            a = t(41172),
            i = t(15969),
            o = t(44658),
            r = t(73038),
            d = t(62695),
            c = t(92642),
            u = t(6391),
            m = t.n(u),
            h = t(72779),
            v = t.n(h),
            x = t(86200),
            f = t(63400),
            g = t(42152),
            p = t(96217),
            b = t(91486),
            y = t(14981),
            w = t(4370),
            j = t(49728),
            N = t(30942),
            C = t(57124),
            k = t(65027),
            S = t(64651),
            I = t(30464),
            D = t(63242),
            M = t(97680),
            A = t.n(M),
            T = t(75958),
            E = t(76516),
            O = t(76147),
            B = t(2784),
            _ = t(74713),
            L = t(53221),
            z = t(12499),
            Z = t(46338),
            F = e([k, O, E]);
          [k, O, E] = F.then ? (await F)() : F;
          let P = (0, T.Pi)(e => {
            var n, t;
            let { isOpen: l, onClose: u, setShowTxPage: h, rootERC20DenomsStore: M } = e,
              [T, F] = (0, B.useState)(!1),
              [P] = (0, a.fOz)(),
              U = (0, C.a)(),
              W = (0, a.DI5)(),
              G = k.w.useGetWallet(),
              R = M.allERC20Denoms,
              [H, $] = (0, B.useState)(!1),
              V = (0, j.U)(),
              {
                memo: K,
                selectedToken: J,
                selectedAddress: Q,
                fee: q,
                showLedgerPopup: Y,
                inputAmount: X,
                tokenFiatValue: ee,
                isSending: en,
                txError: et,
                isIBCTransfer: el,
                sendDisabled: es,
                confirmSend: ea,
                setTxError: ei,
                confirmSendEth: eo,
                clearTxError: er,
                setShowLedgerPopup: ed,
                userPreferredGasPrice: ec,
                userPreferredGasLimit: eu,
                gasEstimate: em,
                transferData: eh,
                isIbcUnwindingDisabled: ev,
                fetchAccountDetailsData: ex,
                sendActiveChain: ef,
                setIsSending: eg
              } = (0, O.GE)(),
              { confirmSkipTx: ep, txnProcessing: eb, error: ey, showLedgerPopupSkipTx: ew, setShowLedgerPopupSkipTx: ej, setError: eN } = (0, E.y)(),
              eC = (0, B.useMemo)(() => P(new (m())(X).multipliedBy(ee ?? 0)), [P, X, ee]);
            (0, B.useMemo)(() => {
              var e;
              return null == W ? void 0 : null === (e = W[null == Q ? void 0 : Q.chainName]) || void 0 === e ? void 0 : e.chainName;
            }, [W, null == Q ? void 0 : Q.chainName]);
            let ek = (0, B.useCallback)(() => {
                eN(""), u(), $(!1);
              }, []),
              eS = (0, B.useCallback)(
                e => {
                  h(!0), u();
                },
                [u, h]
              ),
              eI = (0, B.useCallback)(async () => {
                if (H) {
                  $(!1), V();
                  return;
                }
                if ((er(), q && (null == Q ? void 0 : Q.address) && J))
                  try {
                    var e, n, t, l, s, r;
                    let d = Q.address,
                      c = (0, a.kjy)(Object.keys(R), null == J ? void 0 : J.coinMinimalDenom);
                    if (
                      ((null === (e = W[ef]) || void 0 === e ? void 0 : e.evmOnlyChain) &&
                        c &&
                        d.toLowerCase().startsWith(W[ef].addressPrefix) &&
                        (null == ex ? void 0 : ex.pubKey.key) &&
                        (d = o.SZ.getEvmAddress(ex.pubKey.key)),
                      null === (n = W[ef]) || void 0 === n ? void 0 : n.evmOnlyChain)
                    ) {
                      let e = await G(ef, !0),
                        n = null === (l = Object.keys((null === (s = W[ef]) || void 0 === s ? void 0 : s.nativeDenoms) ?? {})) || void 0 === l ? void 0 : l[0];
                      await eo(
                        d,
                        X,
                        eu ?? em,
                        e,
                        eS,
                        parseInt((null == ec ? void 0 : null === (r = ec.amount) || void 0 === r ? void 0 : r.toString()) ?? ""),
                        { isERC20Token: c, contractAddress: J.coinMinimalDenom, decimals: J.coinDecimals, nativeTokenKey: n }
                      );
                    } else if (
                      (null == eh ? void 0 : eh.isSkipTransfer) &&
                      !ev &&
                      (el || (null == Q ? void 0 : null === (t = Q.address) || void 0 === t ? void 0 : t.startsWith("init")))
                    ) {
                      let e = await G(ef, !0);
                      "evmos" === ef && e instanceof i.Hlr
                        ? await ea({ selectedToken: J, toAddress: (null == Q ? void 0 : Q.address) || "", amount: new (m())(X), memo: K, fees: q }, eS)
                        : ep(eS);
                    } else {
                      let e = W[ef],
                        n = null == Q ? void 0 : Q.address;
                      60 === Number(e.bip44.coinType) && n.toLowerCase().startsWith("0x") && "injective" !== e.key && (n = (0, i.Jyw)(e.addressPrefix, n)),
                        await ea(
                          {
                            selectedToken: J,
                            toAddress: n,
                            amount: new (m())(X),
                            memo: K,
                            fees: q,
                            ibcChannelId: _.MQ.getSourceChainChannelId(ef, null == Q ? void 0 : Q.chainName)
                          },
                          eS
                        );
                    }
                  } catch (e) {
                    e instanceof i.KW8 && ((0, z.h)(null == e ? void 0 : e.message) && $(!0), ei(e.message), ed(!1), ej(!1)),
                      eg(!1),
                      (0, c.Tb)(e, {
                        tags: {
                          errorType: "send_transaction_error",
                          source: "send_transaction",
                          severity: "error",
                          errorName: e instanceof Error ? e.name : "SendTransactionError",
                          transactionType: "send_transaction"
                        },
                        fingerprint: ["send_transaction", "send_transaction_error"],
                        level: "error",
                        extra: {
                          chain: ef,
                          address: null == Q ? void 0 : Q.address,
                          amount: X,
                          token: null == J ? void 0 : J.symbol,
                          fee: q,
                          memo: K,
                          isIBCTransfer: el,
                          isIbcUnwindingDisabled: ev
                        },
                        contexts: {
                          transaction: { chain: ef, address: null == Q ? void 0 : Q.address, errorMessage: e instanceof Error ? e.message : String(e) }
                        }
                      });
                  }
              }, [
                er,
                q,
                null == Q ? void 0 : Q.address,
                J,
                R,
                W,
                ef,
                null == ex ? void 0 : null === (n = ex.pubKey) || void 0 === n ? void 0 : n.key,
                null == eh ? void 0 : eh.isSkipTransfer,
                ev,
                el,
                G,
                eo,
                X,
                eu,
                em,
                null == ec ? void 0 : ec.amount,
                ea,
                K,
                eS,
                ep,
                eg,
                ei,
                ed,
                ej,
                null == Q ? void 0 : Q.chainName,
                V,
                H
              ]);
            (0, N.X)(et);
            let eD = (0, B.useCallback)(() => {
              ed(!1), ej(!1);
            }, [ed, ej]);
            (0, B.useEffect)(() => {
              T &&
                setTimeout(() => {
                  F(!1);
                }, 2e3);
            }, [T]);
            let eM = (0, B.useMemo)(() => {
                if (null == J ? void 0 : J.tokenBalanceOnChain) {
                  var e;
                  return null == W ? void 0 : null === (e = W[null == J ? void 0 : J.tokenBalanceOnChain]) || void 0 === e ? void 0 : e.chainSymbolImageUrl;
                }
                return null;
              }, [W, null == J ? void 0 : J.tokenBalanceOnChain]),
              eA = (0, B.useMemo)(() => {
                var e, n, t;
                return (null == W ? void 0 : null === (e = W[ef]) || void 0 === e ? void 0 : e.evmOnlyChain) ||
                  (0, i.KPM)(ef) ||
                  (0, i.bj0)(ef) ||
                  (0, i.Jhy)(ef)
                  ? null == W
                    ? void 0
                    : null === (t = W[ef]) || void 0 === t
                      ? void 0
                      : t.chainSymbolImageUrl
                  : null == W
                    ? void 0
                    : null === (n = W[null == Q ? void 0 : Q.chainName]) || void 0 === n
                      ? void 0
                      : n.chainSymbolImageUrl;
              }, [W, ef, null == Q ? void 0 : Q.chainName]);
            return (0, s.jsxs)(s.Fragment, {
              children: [
                (0, s.jsx)(p.Z, {
                  isOpen: l,
                  onClose: ek,
                  title: "Review transfer",
                  className: "p-6 !pt-8",
                  children: (0, s.jsxs)("div", {
                    className: "flex flex-col items-center w-full gap-4 relative",
                    children: [
                      (0, s.jsxs)("div", {
                        className: "bg-secondary-100 p-6 rounded-xl flex w-full justify-between items-center",
                        children: [
                          (0, s.jsxs)("div", {
                            className: "flex flex-col gap-1",
                            children: [
                              (0, s.jsx)("p", {
                                className: "text-lg text-monochrome font-bold !leading-[27px]",
                                "data-testing-id": "send-review-sheet-inputAmount-ele",
                                children: (0, a.LHZ)(X, (null == J ? void 0 : J.symbol) ?? "")
                              }),
                              (0, s.jsx)("p", { className: "text-sm text-muted-foreground !leading-[18.9px]", children: eC })
                            ]
                          }),
                          (0, s.jsxs)("div", {
                            className: "relative flex flex-col items-center justify-center h-[48px] w-[48px] shrink-0",
                            children: [
                              (0, s.jsx)("img", { src: (null == J ? void 0 : J.img) ?? U, width: 42, height: 42 }),
                              eM
                                ? (0, s.jsx)("img", { src: eM, width: 18, height: 18, className: "absolute bottom-0 right-0 rounded-full bg-secondary-50" })
                                : null
                            ]
                          })
                        ]
                      }),
                      (0, s.jsx)(r.K, {
                        size: 40,
                        className: v()(
                          "absolute top-[108px] rounded-full bg-accent-green-200 flex items-center justify-center border-[5px] border-gray-50 dark:border-black-100 -mt-[18px] -mb-[18px] p-[5px]"
                        )
                      }),
                      (0, s.jsxs)("div", {
                        className: "bg-secondary-200 p-6 rounded-xl flex w-full justify-between items-center",
                        children: [
                          (0, s.jsxs)("div", {
                            className: "flex items-center gap-1.5 cursor-pointer",
                            onClick: e => {
                              e.stopPropagation(), L.i.copyText((null == Q ? void 0 : Q.ethAddress) || (null == Q ? void 0 : Q.address) || ""), F(!0);
                            },
                            children: [
                              (0, s.jsx)("p", {
                                className: "text-lg text-monochrome font-bold !leading-[27px]",
                                "data-testing-id": "send-review-sheet-to-ele",
                                children: (null == Q ? void 0 : Q.ethAddress)
                                  ? (0, a.Hnh)(Q.ethAddress)
                                  : (null == Q ? void 0 : Q.selectionType) === "currentWallet"
                                    ? null == Q
                                      ? void 0
                                      : null === (t = Q.name) || void 0 === t
                                        ? void 0
                                        : t.split("-")[0]
                                    : (0, a.Hnh)(null == Q ? void 0 : Q.address)
                              }),
                              (0, s.jsx)(y.M, {
                                mode: "wait",
                                children: T
                                  ? (0, s.jsx)(
                                      w.E.span,
                                      {
                                        transition: Z._M,
                                        variants: Z.K0,
                                        initial: "hidden",
                                        animate: "visible",
                                        exit: "hidden",
                                        className: "flex items-center gap-1 ",
                                        children: (0, s.jsx)(d.J, { className: "size-5 text-accent-green" })
                                      },
                                      "copied"
                                    )
                                  : (0, s.jsx)(
                                      w.E.span,
                                      {
                                        transition: Z._M,
                                        variants: Z.K0,
                                        initial: "hidden",
                                        animate: "visible",
                                        exit: "hidden",
                                        className: "flex items-center gap-1",
                                        children: (0, s.jsx)(S.T, { className: "size-5 text-muted-foreground" })
                                      },
                                      "address"
                                    )
                              })
                            ]
                          }),
                          (0, s.jsx)("img", {
                            src: eA || (null == Q ? void 0 : Q.avatarIcon) || I.r.Misc.getWalletIconAtIndex(0),
                            width: 48,
                            height: 48,
                            className: "rounded-full"
                          })
                        ]
                      }),
                      K
                        ? (0, s.jsxs)("div", {
                            className: "w-full flex items-baseline gap-2.5 p-5 rounded-xl bg-secondary-100 border border-secondary mt-0.5",
                            children: [
                              (0, s.jsx)("p", { className: "text-sm text-muted-foreground font-medium", children: "Memo:" }),
                              (0, s.jsx)("p", { className: "font-medium text-sm text-monochrome !leading-[22.4px] overflow-auto break-words", children: K })
                            ]
                          })
                        : null,
                      !H && (et || ey) ? (0, s.jsx)(x._, { text: et || ey, disableSentryCapture: !0 }) : null,
                      H ? (0, s.jsx)(f.u, {}) : null,
                      (0, s.jsx)(b.zx, {
                        className: "w-full mt-4",
                        onClick: eI,
                        disabled: Y || en || es || eb,
                        "data-testing-id": "send-review-sheet-send-btn",
                        "aria-label": "send review transfer button",
                        children: H
                          ? "Connect Ledger"
                          : en || eb
                            ? (0, s.jsx)(A(), {
                                loop: !0,
                                autoplay: !0,
                                animationData: D,
                                rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
                                className: "h-[24px] w-[24px]"
                              })
                            : (0, s.jsx)("span", { "aria-label": "send review transfer button text in send flow", children: "Confirm Send" })
                      })
                    ]
                  })
                }),
                (0, s.jsx)(g.Z, { showLedgerPopup: (Y || ew) && !et, onCloseLedgerPopup: eD })
              ]
            });
          });
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    47383: function (e, n, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(n, { v: () => r });
          var s = t(60431),
            a = t(76147),
            i = t(74713),
            o = e([a]);
          a = (o.then ? (await o)() : o)[0];
          let r = () => {
            let { customIbcChannelId: e, selectedAddress: n, sendActiveChain: t } = (0, a.GE)();
            return (0, s.useQuery)({
              queryKey: ["channel-error", e, null == n ? void 0 : n.chainName, t],
              queryFn: async () => {
                var l;
                let s = null === (l = i.MQ.getChannelIds(t, null == n ? void 0 : n.chainName)) || void 0 === l ? void 0 : l[0],
                  a = e ?? s ?? "";
                if (!a) return;
                let o = await i.MQ.validateIbcChannelId(a, t, null == n ? void 0 : n.chainName);
                if (!o.success) return o.message;
              },
              enabled: !!(null == n ? void 0 : n.address) && !!t && !!(null == n ? void 0 : n.chainName)
            });
          };
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    76147: function (e, n, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(n, { GE: () => y, TG: () => b });
          var s = t(52322),
            a = t(41172),
            i = t(15969),
            o = t(58551),
            r = t(65027),
            d = t(75958),
            c = t(2784),
            u = t(74713),
            m = t(44818),
            h = e([r, o]);
          [r, o] = h.then ? (await h)() : h;
          let v = r.w.useGetWallet,
            x = r.w.useAptosSigner,
            f = r.w.useSolanaSigner,
            g = r.w.useSuiSigner,
            p = (0, c.createContext)(null),
            b = (0, d.Pi)(e => {
              let { children: n, rootCW20DenomsStore: t, rootERC20DenomsStore: l, rootDenomsStore: r, denoms: d } = e,
                m = t.allCW20Denoms,
                h = l.allERC20Denoms,
                {
                  tokenFiatValue: b,
                  feeTokenFiatValue: y,
                  confirmSend: w,
                  confirmSendEth: j,
                  selectedToken: N,
                  setCustomIbcChannelId: C,
                  sendActiveChain: k,
                  displayAccounts: S,
                  selectedAddress: I,
                  setSelectedAddress: D,
                  memo: M,
                  setMemo: A,
                  inputAmount: T,
                  setInputAmount: E,
                  ibcSupportData: O,
                  setSelectedToken: B,
                  feeDenom: _,
                  setFeeDenom: L,
                  gasOption: z,
                  setGasOption: Z,
                  gasEstimate: F,
                  fee: P,
                  allGasOptions: U,
                  userPreferredGasPrice: W,
                  setUserPreferredGasPrice: G,
                  userPreferredGasLimit: R,
                  setUserPreferredGasLimit: H,
                  addressError: $,
                  amountError: V,
                  setAddressError: K,
                  addressWarning: J,
                  setAddressWarning: Q,
                  gasError: q,
                  setGasError: Y,
                  setAmountError: X,
                  isIBCTransfer: ee,
                  sendDisabled: en,
                  txError: et,
                  setTxError: el,
                  customIbcChannelId: es,
                  fetchAccountDetails: ea,
                  fetchAccountDetailsLoading: ei,
                  fetchAccountDetailsStatus: eo,
                  fetchAccountDetailsError: er,
                  fetchAccountDetailsData: ed,
                  setFetchAccountDetailsData: ec,
                  setSelectedChain: eu,
                  selectedChain: em,
                  isSending: eh,
                  isSeiEvmTransaction: ev,
                  associatedSeiAddress: ex,
                  setAssociatedSeiAddress: ef,
                  associated0xAddress: eg,
                  hasToUsePointerLogic: ep,
                  setHasToUsePointerLogic: eb,
                  pointerAddress: ey,
                  setPointerAddress: ew,
                  hasToUseCw20PointerLogic: ej,
                  setHasToUseCw20PointerLogic: eN,
                  computedGas: eC,
                  setComputedGas: ek,
                  showLedgerPopup: eS,
                  setShowLedgerPopup: eI,
                  isCexIbcTransferWarningNeeded: eD,
                  setIsSending: eM,
                  clearTxError: eA,
                  sendSelectedNetwork: eT,
                  setAssociated0xAddress: eE,
                  isSolanaTxnSimulationError: eO,
                  setIsSolanaTxnSimulationError: eB,
                  isSolanaBalanceInsufficientForFee: e_,
                  setIsSolanaBalanceInsufficientForFee: eL,
                  l2DataBufferFee: ez,
                  setL2DataBufferFee: eZ
                } = (0, a.TH7)({ denoms: d, cw20Denoms: m, erc20Denoms: h, ibcDataStore: u.MQ }),
                eF = v(k),
                eP = (0, a.SFn)(),
                eU = (0, o.E)(),
                eW = x(),
                eG = f(),
                eR = g(),
                [eH, e$] = (0, c.useState)(null),
                [eV, eK] = (0, c.useState)(!1),
                [eJ, eQ] = (0, c.useState)(!0),
                [eq, eY] = (0, c.useState)(""),
                eX = (0, c.useCallback)(
                  async (e, n) => {
                    await w(
                      {
                        ...e,
                        getWallet: () =>
                          (0, i.cSx)((null == N ? void 0 : N.coinMinimalDenom) ?? "", "secret")
                            ? eU()
                            : (0, i.KPM)(k)
                              ? eW(k).then(e => e.signer)
                              : (0, i.Jhy)(k)
                                ? eG(k).then(e => e)
                                : (0, i.bj0)(k)
                                  ? eR(k).then(e => e)
                                  : eF()
                      },
                      n
                    );
                  },
                  [w, eU, eF, null == N ? void 0 : N.coinMinimalDenom, eW, eG, k, eR]
                ),
                e0 = (0, c.useCallback)(
                  async (e, n, t, l, s, a, i) => {
                    await j(e, n, t, l, s, a, i);
                  },
                  [j]
                );
              (0, c.useEffect)(() => {
                eK(!1), C(void 0);
              }, [N, I]);
              let e1 = (0, c.useMemo)(() => {
                let e = (0, i.z_q)(eP),
                  n = (0, i.z_q)(I ? (null == I ? void 0 : I.address) ?? "" : "");
                return {
                  ethAddress: eq,
                  setEthAddress: eY,
                  tokenFiatValue: b ?? "",
                  feeTokenFiatValue: y ?? "",
                  selectedToken: N,
                  confirmSend: eX,
                  confirmSendEth: e0,
                  sameChain: e === n,
                  transferData: eH,
                  setTransferData: e$,
                  isIbcUnwindingDisabled: eV,
                  setIsIbcUnwindingDisabled: eK,
                  setCustomIbcChannelId: C,
                  pfmEnabled: eJ,
                  setPfmEnabled: eQ,
                  sendActiveChain: k,
                  rootDenomsStore: r,
                  displayAccounts: S,
                  selectedAddress: I,
                  setSelectedAddress: D,
                  memo: M,
                  setMemo: A,
                  inputAmount: T,
                  setInputAmount: E,
                  ibcSupportData: O,
                  setSelectedToken: B,
                  feeDenom: _,
                  setFeeDenom: L,
                  gasOption: z,
                  setGasOption: Z,
                  gasEstimate: F,
                  fee: P,
                  allGasOptions: U,
                  userPreferredGasPrice: W,
                  setUserPreferredGasPrice: G,
                  userPreferredGasLimit: R,
                  setUserPreferredGasLimit: H,
                  addressError: $,
                  amountError: V,
                  setAddressError: K,
                  addressWarning: J,
                  setAddressWarning: Q,
                  gasError: q,
                  setGasError: Y,
                  setAmountError: X,
                  isIBCTransfer: ee,
                  sendDisabled: en,
                  txError: et,
                  setTxError: el,
                  customIbcChannelId: es,
                  fetchAccountDetails: ea,
                  fetchAccountDetailsLoading: ei,
                  fetchAccountDetailsStatus: eo,
                  fetchAccountDetailsError: er,
                  fetchAccountDetailsData: ed,
                  setFetchAccountDetailsData: ec,
                  setSelectedChain: eu,
                  selectedChain: em,
                  isSending: eh,
                  isSeiEvmTransaction: ev,
                  associatedSeiAddress: ex,
                  setAssociatedSeiAddress: ef,
                  associated0xAddress: eg,
                  hasToUsePointerLogic: ep,
                  setHasToUsePointerLogic: eb,
                  pointerAddress: ey,
                  setPointerAddress: ew,
                  hasToUseCw20PointerLogic: ej,
                  setHasToUseCw20PointerLogic: eN,
                  computedGas: eC,
                  setComputedGas: ek,
                  showLedgerPopup: eS,
                  setShowLedgerPopup: eI,
                  isCexIbcTransferWarningNeeded: eD,
                  setIsSending: eM,
                  clearTxError: eA,
                  sendSelectedNetwork: eT,
                  setAssociated0xAddress: eE,
                  isSolanaTxnSimulationError: eO,
                  setIsSolanaTxnSimulationError: eB,
                  isSolanaBalanceInsufficientForFee: e_,
                  setIsSolanaBalanceInsufficientForFee: eL,
                  l2DataBufferFee: ez,
                  setL2DataBufferFee: eZ
                };
              }, [
                eP,
                eq,
                b,
                y,
                N,
                eX,
                e0,
                eH,
                eV,
                eK,
                C,
                eJ,
                eQ,
                r,
                k,
                S,
                I,
                D,
                M,
                A,
                T,
                E,
                O,
                B,
                _,
                L,
                z,
                Z,
                F,
                P,
                U,
                W,
                G,
                R,
                H,
                $,
                V,
                K,
                J,
                Q,
                q,
                Y,
                X,
                ee,
                en,
                et,
                el,
                es,
                ea,
                ei,
                eo,
                er,
                ed,
                ec,
                eu,
                em,
                eh,
                ev,
                ex,
                ef,
                eg,
                ep,
                eb,
                ey,
                ew,
                ej,
                eN,
                eC,
                ek,
                eS,
                eI,
                eD,
                eM,
                eA,
                eT,
                eE,
                eO,
                eB,
                e_,
                eL,
                ez,
                eZ
              ]);
              return (0, s.jsx)(p.Provider, { value: e1, children: n });
            }),
            y = () => {
              let e = (0, c.useContext)(p);
              return (0, m.h)(null !== e, "useSendContext must be used within SendContextProvider"), e;
            };
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    59079: function (e, n, t) {
      t.d(n, { d: () => o, o: () => i });
      var l = t(41172),
        s = t(15969),
        a = t(2784);
      function i(e) {
        return /^(0x|0X)?[a-fA-F0-9]+$/.test(e) && e.length % 2 == 0 && 32 == (/^(0x|0X)/.test(e) ? (e.length - 2) / 2 : e.length / 2);
      }
      function o(e) {
        let { setAddressError: n, setAddressWarning: t, recipientInputValue: i, showNameServiceResults: o, sendActiveChain: r } = e,
          d = (0, l.SFn)(r);
        (0, a.useEffect)(() => {
          !(async function () {
            i && d !== i
              ? (0, s.AtH)(i) || (0, s.Ohs)(i) || (0, s.$v)(i) || (0, s.BVJ)(i) || o
                ? (t(l.wL6), n(void 0))
                : n("The entered address is invalid")
              : (t(l.wL6), n(void 0));
          })();
        }, [d, i, o]);
      }
    },
    67066: function (e, n, t) {
      t.d(n, { P: () => c });
      var l = t(41172),
        s = t(15969),
        a = t(44658),
        i = t(23259),
        o = t(59079),
        r = t(2784),
        d = t(74713);
      function c(e) {
        let {
            sendActiveChain: n,
            selectedAddress: t,
            sendSelectedNetwork: c,
            isIbcUnwindingDisabled: u,
            skipSupportedDestinationChainsIDs: m,
            selectedToken: h,
            setAddressError: v,
            manageChainsStore: x
          } = e,
          { chains: f } = (0, l._IL)(),
          g = (0, l.tIw)(),
          p = s.Dr3.includes(n),
          b = f[n];
        (0, r.useEffect)(() => {
          !(async function () {
            var e, r, x, p, y, w;
            let j;
            if (!(null == t ? void 0 : t.address) || !n || !h) return;
            if ((0, a.mq)(n)) {
              (0, s.zri)(t.address, "mainnet" === c ? "mainnet" : "testnet") ? v(void 0) : v("The entered address is invalid");
              return;
            }
            if (null == b ? void 0 : b.evmOnlyChain) {
              (0, s.Ohs)((null == t ? void 0 : t.ethAddress) || t.address) ? v(void 0) : v("The entered address is invalid");
              return;
            }
            if ((0, s.KPM)(n)) {
              (0, s.$v)(t.address) ? v(void 0) : v("The entered address is invalid");
              return;
            }
            if ((0, s.bj0)(n)) {
              (0, o.o)(t.address) ? v(void 0) : v("The entered address is invalid");
              return;
            }
            if ((0, s.Jhy)(n)) {
              (0, s.BVJ)(t.address) ? v(void 0) : v("The entered address is invalid");
              return;
            }
            ((null === (e = t.address) || void 0 === e ? void 0 : e.startsWith("bc1q")) ||
              (null === (r = t.address) || void 0 === r ? void 0 : r.startsWith("tb1q")) ||
              (!(0, s.AtH)(t.address) && (!i.ci.includes(n) || !(0, s.Ohs)((null == t ? void 0 : t.ethAddress) || t.address)))) &&
              v("The entered address is invalid");
            let N = (0, s.z_q)(t.address);
            if (N) j = g[N];
            else {
              v("The entered address is invalid");
              return;
            }
            let C = N && N !== f[n].addressPrefix;
            if (!C) {
              v(void 0);
              return;
            }
            if (C && "testnet" === c) {
              v("IBC transfers are not supported on testnet.");
              return;
            }
            if (u || (null === (x = f[j]) || void 0 === x ? void 0 : x.apiStatus) !== !1) v(void 0);
            else {
              v(
                `IBC transfers are not supported between ${(null === (y = f[j]) || void 0 === y ? void 0 : y.chainName) || "this address"} and ${b.chainName}.`
              );
              return;
            }
            let k = (null == m ? void 0 : m.length) > 0 && m.includes(null === (p = f[j]) || void 0 === p ? void 0 : p.chainId),
              S = d.MQ.getSourceChainChannelId(n, j);
            u || k || S
              ? v(void 0)
              : v(
                  `IBC transfers are not supported between ${(null === (w = f[j]) || void 0 === w ? void 0 : w.chainName) || "this address"} and ${b.chainName} for ${(0, l.MDB)(null == h ? void 0 : h.symbol)} token.`
                );
          })();
        }, [b, t, f, g, m, x.chains, u, null == h ? void 0 : h.symbol, null == h ? void 0 : h.coinMinimalDenom, n, c, p]);
      }
    },
    30429: function (e, n, t) {
      t.a(e, async function (e, l) {
        try {
          t.r(n), t.d(n, { default: () => G });
          var s = t(52322),
            a = t(41172),
            i = t(15969),
            o = t(6809),
            r = t(11102),
            d = t(66534),
            c = t(6391),
            u = t(16283),
            m = t(85027),
            h = t(23259),
            v = t(74229),
            x = t(76131),
            f = t(38313),
            g = t(42941),
            p = t(75958),
            b = t(35065),
            y = t(17844),
            w = t(2784),
            j = t(10289),
            N = t(81354),
            C = t(26245),
            k = t(36321),
            S = t(74713),
            I = t(42799),
            D = t(83275),
            M = t(48346),
            A = t(86411),
            T = t(96281),
            E = t(28588),
            O = t(54827),
            B = t(5228),
            _ = t(25282),
            L = t(72112),
            z = t(51563),
            Z = t(76147),
            F = t(67066),
            P = t(60914),
            U = e([x, f, D, T, M, _, C, B, O, z, P, y, b, L, E, Z]);
          [x, f, D, T, M, _, C, B, O, z, P, y, b, L, E, Z] = U.then ? (await U)() : U;
          let W = (0, p.Pi)(e => {
              var n, t;
              let { denoms: l } = e,
                p = (0, j.s0)(),
                U = M.jZ.loading,
                [W, G] = (0, w.useState)(!1),
                [R, H] = (0, w.useState)(!1),
                { walletAvatar: $, walletName: V } = (0, v.vL)(),
                K = (0, j.TH)().state,
                J = (0, a.a74)(),
                [Q, q] = (0, w.useState)(""),
                {
                  selectedAddress: Y,
                  setSelectedAddress: X,
                  setAddressError: ee,
                  isIBCTransfer: en,
                  setCustomIbcChannelId: et,
                  selectedToken: el,
                  isIbcUnwindingDisabled: es,
                  sendActiveChain: ea,
                  setSelectedChain: ei,
                  sendSelectedNetwork: eo,
                  selectedChain: er,
                  setGasError: ed,
                  setInputAmount: ec,
                  setFeeDenom: eu,
                  setSelectedToken: em
                } = (0, Z.GE)(),
                eh = (0, g.Z)().get("assetCoinDenom") ?? void 0,
                ev = (0, g.Z)().get("chainId") ?? void 0,
                ex = (0, g.Z)().get("holderChain") ?? void 0,
                [ef, eg] = (0, w.useState)(!1),
                [ep, eb] = (0, w.useState)(!1),
                [ey, ew] = (0, w.useState)(!eh),
                [ej, eN] = (0, w.useState)(),
                [eC, ek] = (0, w.useState)(!1),
                [eS, eI] = (0, w.useState)(!1),
                eD = k.Ui.chainInfos;
              (0, x.$)({ page: "send", queryStatus: U ? "loading" : "success", op: "sendPageLoad", description: "loading state on send page" });
              let eM = (0, w.useCallback)(() => G(!0), []),
                eA = (0, w.useCallback)(() => {
                  H(!1);
                }, []),
                eT = (0, w.useCallback)(
                  e => {
                    el || e ? ew(!1) : p(-1);
                  },
                  [p, el]
                ),
                { chains: eE } = (0, a._IL)(),
                eO = (0, a.tIw)(),
                eB = (0, a.rTu)(),
                { data: e_ } = (0, o.Uj)({ chainTypes: ["cosmos"] }),
                { data: eL } = (0, a.S2A)(),
                ez = (0, f.ob)(),
                eZ = (0, w.useRef)(null),
                eF = eE[ea],
                eP = {
                  denom: (null == el ? void 0 : el.ibcDenom) || (null == el ? void 0 : el.coinMinimalDenom) || "",
                  symbol: (null == el ? void 0 : el.symbol) || "",
                  logoUri: (null == el ? void 0 : el.img) || "",
                  decimals: (null == el ? void 0 : el.coinDecimals) || 0,
                  originDenom: (null == el ? void 0 : el.coinMinimalDenom) || "",
                  denomTracePath: (null == el ? void 0 : el.ibcChainInfo)
                    ? `transfer/${null === (n = el.ibcChainInfo) || void 0 === n ? void 0 : n.channelId}`
                    : ""
                },
                eU = null == e_ ? void 0 : e_.find(e => (null == e ? void 0 : e.chainId) === (null == eF ? void 0 : eF.chainId)),
                { data: eW } =
                  (null == eL ? void 0 : null === (t = eL.ibc) || void 0 === t ? void 0 : t.extension) !== "disabled"
                    ? (0, o.Mf)(eP, eU, "mainnet" === eo)
                    : { data: null },
                eG = (0, w.useMemo)(
                  () =>
                    (null == eW
                      ? void 0
                      : eW
                          .filter(
                            e =>
                              "cosmos" === e.chainType &&
                              !!((null == eB ? void 0 : eB.walletType) !== a._KQ.LEDGER || (0, A.i)(e.key, e.coinType, Object.values(eE))) &&
                              null != eB &&
                              !!eB.addresses[e.key]
                          )
                          .map(e => e.chainId)) || [],
                  [eW, null == eB ? void 0 : eB.walletType, null == eB ? void 0 : eB.addresses, eE]
                ),
                eR = (0, w.useMemo)(() => {
                  if (!(null == Y ? void 0 : Y.address)) return null;
                  let e = (0, i.z_q)(Y.address);
                  if (!e) return null;
                  let n = eO[e];
                  return n ? eE[n] : null;
                }, [eO, eE, null == Y ? void 0 : Y.address]),
                eH = M.jZ.getAggregatedSpendableBalances(ez, void 0),
                e$ = C.g5.statusForChain(ea, ez, void 0),
                { enabled: eV, snip20Tokens: eK } = (0, a.r4i)(),
                eJ = (0, w.useMemo)(() => {
                  let e = eH;
                  return (
                    "secret" === J && eV && (null == eK ? void 0 : eK.length) > 0 && (e = [...e, ...eK]),
                    e.sort((e, n) => Number(n.usdValue) - Number(e.usdValue))
                  );
                }, [J, eH, eV, eK]);
              (0, F.P)({
                sendActiveChain: ea,
                selectedAddress: Y,
                sendSelectedNetwork: eo,
                isIbcUnwindingDisabled: es,
                skipSupportedDestinationChainsIDs: eG,
                selectedToken: el,
                setAddressError: ee,
                manageChainsStore: D.t
              }),
                (0, w.useEffect)(() => {
                  "testnet" === ez && M.jZ.loadBalances("aggregated");
                }, [ez]),
                (0, w.useEffect)(() => {
                  (null == Y ? void 0 : Y.chainName) && et(void 0);
                }, [null == Y ? void 0 : Y.chainName, et]),
                (0, w.useEffect)(() => {
                  let e = (null == Y ? void 0 : Y.address) || (null == Y ? void 0 : Y.ethAddress);
                  if (e && Object.keys(eO).length > 0) {
                    let n = "cosmos";
                    try {
                      if ((0, i.$v)(e)) n = "movement";
                      else if ((0, i.Ohs)(e)) n = "ethereum";
                      else if (e.startsWith("tb1q")) n = "bitcoinSignet";
                      else if (e.startsWith("bc1q")) n = "bitcoin";
                      else {
                        let { prefix: t } = d.bech32.decode(e);
                        (n = eO[t]), "init" === t && (n = null == Y ? void 0 : Y.chainName);
                      }
                    } catch (t) {
                      (0, i.BVJ)(e) && (n = "solana");
                    }
                    el || ei(n);
                  }
                }, [eO, null == Y ? void 0 : Y.address, null == Y ? void 0 : Y.chainName, null == Y ? void 0 : Y.ethAddress, el, ei]),
                (0, w.useEffect)(() => {
                  el && el.tokenBalanceOnChain && ea !== el.tokenBalanceOnChain && ei(el.tokenBalanceOnChain);
                }, [el, ea]),
                (0, w.useEffect)(() => {
                  N.K5.resetUpdateCount();
                }, [null == el ? void 0 : el.ibcDenom, null == el ? void 0 : el.coinMinimalDenom]),
                (0, w.useEffect)(() => {
                  var e;
                  !(
                    (0, i.KPM)(ea) ||
                    (null == eE ? void 0 : null === (e = eE[ea]) || void 0 === e ? void 0 : e.evmOnlyChain) ||
                    i.Dr3.includes(ea) ||
                    (0, i.Jhy)(ea) ||
                    (0, i.bj0)(ea)
                  ) &&
                    ea &&
                    S.MQ.loadIbcChains(ea);
                }, [eE, ea]),
                (0, w.useEffect)(() => {
                  var e, n;
                  !(
                    (0, i.KPM)(ea) ||
                    (null == eE ? void 0 : null === (e = eE[ea]) || void 0 === e ? void 0 : e.evmOnlyChain) ||
                    i.Dr3.includes(ea) ||
                    (0, i.Jhy)(ea) ||
                    (0, i.bj0)(ea) ||
                    !(null == eR ? void 0 : eR.key) ||
                    (0, i.KPM)(null == eR ? void 0 : eR.key) ||
                    (null == eE ? void 0 : null === (n = eE[null == eR ? void 0 : eR.key]) || void 0 === n ? void 0 : n.evmOnlyChain) ||
                    i.Dr3.includes(null == eR ? void 0 : eR.key) ||
                    (0, i.Jhy)(null == eR ? void 0 : eR.key) ||
                    (0, i.bj0)(null == eR ? void 0 : eR.key)
                  ) &&
                    ea &&
                    eR.key &&
                    S.MQ.loadIbcData(ea, eR.key);
                }, [ea, eE, null == eR ? void 0 : eR.key]);
              let eQ = (0, w.useCallback)(
                  e => {
                    if (
                      (em(e),
                      ei((null == e ? void 0 : e.tokenBalanceOnChain) || null),
                      e &&
                        (null == e ? void 0 : e.isEvm) &&
                        eu({
                          coinMinimalDenom: e.coinMinimalDenom,
                          coinDecimals: e.coinDecimals ?? 6,
                          coinDenom: e.symbol,
                          icon: e.img,
                          coinGeckoId: e.coinGeckoId ?? "",
                          chain: e.chain ?? ""
                        }),
                      e && J === h.HW)
                    ) {
                      var n, t;
                      let l =
                        (null === (n = Object.values(null === (t = eD[e.tokenBalanceOnChain]) || void 0 === t ? void 0 : t.nativeDenoms)) || void 0 === n
                          ? void 0
                          : n[0]) || e;
                      eu({
                        coinMinimalDenom: l.coinMinimalDenom,
                        coinDecimals: l.coinDecimals ?? 6,
                        coinDenom: l.coinDenom || e.symbol,
                        icon: l.icon || e.img,
                        coinGeckoId: l.coinGeckoId ?? "",
                        chain: l.chain ?? ""
                      });
                    }
                  },
                  [em, J, ei, eu, eD]
                ),
                eq = (0, w.useMemo)(() => {
                  var e;
                  let n = !1 === U;
                  return (null == eD ? void 0 : null === (e = eD[ea]) || void 0 === e ? void 0 : e.evmOnlyChain) && (n = n && "success" === e$), n;
                }, [eD, e$, U, ea]);
              return (
                (0, w.useEffect)(() => {
                  !el && !eh && eq && K && K.coinMinimalDenom && eQ(K);
                }, [eJ, K, eq, el, eQ, eh, er]),
                (0, w.useEffect)(() => {
                  if (eh) {
                    let e =
                      eJ.find(e =>
                        (null == eh ? void 0 : eh.startsWith("ibc/"))
                          ? e.ibcDenom === eh && (!ex || "aggregated" === ex || e.tokenBalanceOnChain === ex)
                          : (0, a.QBt)(e.ibcDenom || e.coinMinimalDenom, e.chain || "") === (0, a.QBt)(eh, ev || "")
                      ) || null;
                    eQ(e);
                  } else if (ev) {
                    let e = eJ.find(e => new c.BigNumber(e.amount).gt(0)) || null;
                    eQ(e);
                  }
                }, [ev, eh, J, eJ, eQ, ex]),
                (0, s.jsxs)(s.Fragment, {
                  children: [
                    el
                      ? (0, s.jsxs)(s.Fragment, {
                          children: [
                            (0, s.jsxs)(m.m, {
                              children: [
                                (0, s.jsx)(r.X, { size: 36, className: "text-monochrome cursor-pointer p-2", onClick: () => p(-1) }),
                                (0, s.jsx)(u.G2, {
                                  className: "absolute top-1/2 right-1/2 translate-x-1/2 -translate-y-1/2",
                                  walletName: V,
                                  showWalletAvatar: !0,
                                  walletAvatar: $,
                                  showDropdown: !0,
                                  handleDropdownClick: eM
                                })
                              ]
                            }),
                            (0, s.jsxs)("div", {
                              className: "flex flex-col w-full h-full gap-3 relative pt-6",
                              children: [
                                (0, s.jsx)(T.e, {
                                  rootBalanceStore: M.jZ,
                                  isAllAssetsLoading: U,
                                  rootDenomsStore: I.gb,
                                  rootCW20DenomsStore: I.UE,
                                  rootERC20DenomsStore: I.iE,
                                  resetForm: eS,
                                  setShowTokenSelectSheet: ew,
                                  isTokenStatusSuccess: eq,
                                  setAmount: q,
                                  amount: Q
                                }),
                                (0, s.jsx)(_.Z, {
                                  ref: eZ,
                                  isIBCTransfer: en,
                                  sendSelectedNetwork: eo,
                                  destChainInfo: eR,
                                  selectedAddress: Y,
                                  activeChain: J,
                                  setSelectedContact: eN,
                                  setShowSelectRecipient: H,
                                  setIsAddContactSheetVisible: eb,
                                  setInputInProgress: ek,
                                  inputInProgress: eC,
                                  chainInfoStore: k.Ui,
                                  chainFeatureFlagsStore: C.VH
                                }),
                                (0, s.jsx)(B._, {}),
                                (0, s.jsx)("div", { className: "mx-6", children: (0, s.jsx)(O.i6, {}) }),
                                (0, s.jsx)(z._, { setShowTxPage: eg })
                              ]
                            })
                          ]
                        })
                      : null,
                    (0, s.jsx)(P.v, {
                      isOpen: R && !ep,
                      onClose: eA,
                      postSelectRecipient: () => {
                        ek(!1), N.K5.resetUpdateCount();
                      },
                      editContact: e => {
                        e && eN(e), eb(!0);
                      }
                    }),
                    ef &&
                      (0, s.jsx)(y.Z, {
                        isOpen: ef,
                        onClose: e => {
                          eg(!1), e && (ec(""), eI(!0), setTimeout(() => eI(!1), 2e3));
                        },
                        txType: y.U.SEND
                      }),
                    (0, s.jsx)(b.Z, {
                      isVisible: W,
                      onClose: () => {
                        G(!1), p("/home");
                      },
                      title: "Your Wallets"
                    }),
                    (0, s.jsx)(L.Z, {
                      isOpen: ep,
                      onSave: X,
                      onClose: () => {
                        eb(!1), eN(void 0);
                      },
                      address: (null == ej ? void 0 : ej.address) ?? "",
                      ethAddress: (null == ej ? void 0 : ej.ethAddress) ?? "",
                      sendActiveChain: J,
                      title: ej ? "Edit Contact" : "Add Contact",
                      showDeleteBtn: !!ej
                    }),
                    (0, s.jsx)(E.n, {
                      denoms: l,
                      isOpen: ey,
                      assets: eJ,
                      selectedToken: el,
                      onClose: eT,
                      onTokenSelect: e => {
                        var n;
                        eQ(e), ed(""), q(""), null === (n = eZ.current) || void 0 === n || n.focus();
                      }
                    })
                  ]
                })
              );
            }),
            G = (0, p.Pi)(() => {
              let e = (0, a.a74)(),
                n = (0, a.hU2)(),
                t = (0, w.useMemo)(
                  () =>
                    n
                      ? {
                          ...I.gb.allDenoms,
                          ...Object.fromEntries(
                            Object.entries(n).map(e => {
                              let [n, t] = e;
                              return [n, { ...t, coinDenom: "", coinMinimalDenom: n, coinDecimals: t.decimals, coinGeckoId: t.coingeckoId ?? "" }];
                            })
                          )
                        }
                      : I.gb.allDenoms,
                  [n]
                );
              return (0, s.jsx)(Z.TG, {
                activeChain: e,
                rootDenomsStore: I.gb,
                rootCW20DenomsStore: I.UE,
                rootERC20DenomsStore: I.iE,
                denoms: t,
                children: (0, s.jsx)(W, { denoms: t })
              });
            });
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    24074: function (e, n, t) {
      t.d(n, { x: () => l });
      let l = (e, n) => (e && "mainnet" !== n ? (e.includes("Testnet") ? e : `${e} Testnet`) : e);
    },
    85019: function (e, n, t) {
      t.a(e, async function (e, l) {
        try {
          t.d(n, { s: () => m });
          var s = t(44658),
            a = t(78344),
            i = t(61100),
            o = t(26245),
            r = t(36321),
            d = t(74713),
            c = t(30809),
            u = e([o]);
          o = (u.then ? (await u)() : u)[0];
          let m = new s.WJ(r.Ui, i.M, c.i, a.J, o.JY, o.w3, d.NH);
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    54525: function (e, n, t) {
      t.d(n, { o: () => l });
      var l,
        s = t(15969),
        a = t(59079),
        i = t(2784),
        o = t(72565),
        r = t.n(o);
      let d = (e, n, t) => {};
      !(function (e) {
        let n = "all-saved-contacts";
        async function t(e) {
          if (!(0, s.AtH)(e.address) && !(0, s.Ohs)(e.address) && !(0, s.$v)(e.address) && !(0, s.BVJ)(e.address) && !(0, a.o)(e.address)) {
            d("Save contact", "Address not valid");
            return;
          }
          let { address: t, blockchain: i } = e,
            o = await l(t);
          i || (e.blockchain = (0, s.z_q)(t));
          let c = (await r().storage.local.get([n]))[n] ?? {},
            u = {};
          o ? (u[t] = { ...o, ...e }) : (u[t] = e);
          let m = { ...c, ...u };
          return await r().storage.local.set({ [n]: m }), e;
        }
        async function l(e) {
          return ((await r().storage.local.get([n]))[n] ?? {})[e];
        }
        async function o(e) {
          let t = (await r().storage.local.get([n]))[n] ?? {};
          (await l(e)) && delete t[e], delete t[e], await r().storage.local.set({ [n]: t });
        }
        (e.subscribe = function (e) {
          r().storage.onChanged.addListener((t, l) => {
            "local" === l && t[n] && e(t[n].newValue);
          });
        }),
          (e.unsubscribe = function (e) {
            r().storage.onChanged.removeListener((t, l) => {
              "local" === l && t[n] && e(t[n].newValue);
            });
          }),
          (e.save = t),
          (e.getEntry = l),
          (e.useGetContact = function (e) {
            let [t, s] = (0, i.useState)();
            return (
              (0, i.useEffect)(() => {
                let t = !1;
                if (e) {
                  if (t) return;
                  l(e)
                    .then(e => {
                      t || s(e);
                    })
                    .catch(() => {
                      t || s(void 0);
                    });
                } else s(void 0);
                let a = (t, l) => {
                  if ("local" === l && t[n]) {
                    let l = t[n].newValue;
                    l[e] && s(l[e]);
                  }
                };
                return (
                  r().storage.onChanged.addListener(a),
                  () => {
                    (t = !0), r().storage.onChanged.removeListener(a);
                  }
                );
              }, [e]),
              t
            );
          }),
          (e.getAllEntries = async () => (await r().storage.local.get([n]))[n] ?? {}),
          (e.removeEntry = o),
          (e.clear = function () {
            r().storage.local.set({ [n]: {} });
          });
      })(l || (l = {}));
    },
    85763: function (e, n, t) {
      t.d(n, { $: () => i });
      var l = t(93407),
        s = t(15969),
        a = t(66534);
      class i {
        static shortenAddress(e, n) {
          if (n >= e.length) return e;
          let t = e.indexOf("1"),
            l = e.slice(0, t),
            s = e.slice(t + 1);
          if (((n -= l.length), (n -= 3), (n -= 1) <= 0)) return "";
          let a = Math.floor(s.length / 2),
            i = s.slice(0, a),
            o = s.slice(a);
          for (; n < i.length + o.length; ) (i.length + o.length) % 2 == 1 && i.length > 0 ? (i = i.slice(0, i.length - 1)) : (o = o.slice(1));
          return l + "1" + i + "..." + o;
        }
        static fromBech32(e, n) {
          let t = a.bech32.decode(e);
          if (n && t.prefix !== n) throw Error("Unmatched prefix");
          return new i(new Uint8Array(a.bech32.fromWords(t.words)));
        }
        static validate(e, n) {
          let { prefix: t } = a.bech32.decode(e);
          if (n && n !== t) throw Error(`Unexpected prefix (expected: ${n}, actual: ${t})`);
        }
        static getChainKey(e) {
          try {
            let { prefix: n } = a.bech32.decode(e),
              t = s.BU_[n];
            if ("cosmoshub" === t) return "cosmos";
            return t;
          } catch (e) {
            return;
          }
        }
        toBech32(e) {
          let n = a.bech32.toWords(this.address);
          return a.bech32.encode(e, n);
        }
        constructor(e) {
          (0, l._)(this, "address", void 0), (this.address = e);
        }
      }
    },
    12499: function (e, n, t) {
      t.d(n, { h: () => l });
      let l = e => {
        var n;
        return (
          !!e &&
          (null == e
            ? void 0
            : null === (n = e.toLowerCase()) || void 0 === n
              ? void 0
              : n.includes("unable to connect to ledger device. please check if your ledger is connected and try again."))
        );
      };
    }
  }
]);
//# sourceMappingURL=1108.js.map
