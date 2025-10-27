!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "04be560c-81aa-4aad-8f61-931704de3b10"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-04be560c-81aa-4aad-8f61-931704de3b10"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.22.9" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["1880"],
  {
    14231: function (e, t, s) {
      s.a(e, async function (e, l) {
        try {
          s.r(t), s.d(t, { default: () => p });
          var n = s(52322),
            a = s(41172),
            i = s(19623),
            o = s(26091),
            r = s(53108),
            c = s(75958),
            d = s(2784),
            x = s(10289),
            m = s(42799),
            u = s(48346),
            f = s(46103),
            h = s(48534),
            b = s(72565),
            w = s.n(b),
            g = s(94685),
            j = e([u]);
          u = (j.then ? (await j)() : j)[0];
          let y = (0, c.Pi)(e => {
            let { handleRejectBtnClick: t } = e,
              [s, l] = (0, d.useState)(!1),
              c = (0, a.a74)(),
              [b, j] = (0, d.useState)(c),
              [p, y] = (0, d.useState)({ address: "", symbol: "", image: "", decimals: 0, coinGeckoId: "" }),
              v = m.bI.getEnabledCW20DenomsForChain(b),
              k = (0, x.s0)();
            (0, d.useEffect)(() => {
              w()
                .storage.local.get([r.RO])
                .then(async function (e) {
                  let t = e[r.RO];
                  y({ ...t.params.options }), (null == t ? void 0 : t.activeChain) && j(t.activeChain);
                });
            }, []);
            let C = async () => {
              l(!0);
              let e = {
                coinDenom: p.symbol,
                coinMinimalDenom: p.address,
                coinDecimals: p.decimals,
                coinGeckoId: p.coinGeckoId ?? "",
                icon: p.image ?? "",
                chain: b
              };
              await m.EM.setBetaERC20Denoms(p.address, e, b);
              let s = [...v, p.address];
              await m.bI.setEnabledCW20Denoms(s, b),
                u.jZ.refetchBalances(b),
                window.removeEventListener("beforeunload", t),
                await w().storage.local.set({ [r.u1]: { data: "Approved" } }),
                setTimeout(async () => {
                  await w().storage.local.remove([r.RO]), await w().storage.local.remove(r.u1), l(!1), (0, h.oj)() ? k("/home") : window.close();
                }, 50);
            };
            return (0, n.jsxs)(n.Fragment, {
              children: [
                (0, n.jsxs)("div", {
                  className: "flex flex-col items-center",
                  children: [
                    (0, n.jsx)(g.X6, { text: "Add Token" }),
                    (0, n.jsx)(g.GL, { text: "This will allow this token to be viewed within Leap Wallet" }),
                    (0, n.jsx)(g.QS, {
                      address: p.address,
                      img: (0, n.jsx)(o.m, {
                        assetImg: p.image,
                        text: p.symbol,
                        altText: p.symbol + " logo",
                        imageClassName: "w-[36px] h-[36px] rounded-full",
                        containerClassName: "w-[36px] h-[36px] rounded-full mr-2",
                        textClassName: "text-[10px] !leading-[14px]"
                      })
                    }),
                    (0, n.jsx)(g.P6, { name: p.symbol, symbol: p.symbol, decimals: p.decimals })
                  ]
                }),
                (0, n.jsx)(g.$_, {
                  children: (0, n.jsx)(g.No, {
                    rejectBtnClick: t,
                    rejectBtnText: "Reject",
                    confirmBtnText: s ? (0, n.jsx)(i.T, { color: f.w.white100 }) : "Approve",
                    confirmBtnClick: C,
                    isConfirmBtnDisabled: s
                  })
                })
              ]
            });
          });
          function p() {
            return (0, n.jsx)(g.zb, {
              suggestKey: r.RO,
              children: e => {
                let { handleRejectBtnClick: t } = e;
                return (0, n.jsx)(y, { handleRejectBtnClick: t });
              }
            });
          }
          l();
        } catch (e) {
          l(e);
        }
      });
    },
    94685: function (e, t, s) {
      s.d(t, { QS: () => k, GL: () => h, X6: () => f, zb: () => y, No: () => m, P6: () => N, $_: () => c });
      var l = s(52322),
        n = s(72779),
        a = s.n(n),
        i = s(86200),
        o = s(19623),
        r = s(2784);
      function c(e) {
        let { children: t, error: s, isFetching: n } = e;
        return (0, l.jsxs)("div", {
          className: a()("w-full flex flex-col flex-1 items-center box-border", n ? "h-full justify-center" : "justify-end"),
          children: [
            s ? (0, l.jsx)("div", { className: "my-2", children: (0, l.jsx)(i._, { text: s }) }) : null,
            n ? (0, l.jsx)(o.T, { color: "#E18881" }) : (0, l.jsx)(l.Fragment, { children: t })
          ]
        });
      }
      var d = s(75377),
        x = s(46103);
      function m(e) {
        let { error: t, rejectBtnClick: s, rejectBtnText: n, confirmBtnClick: i, confirmBtnText: o, isConfirmBtnDisabled: r } = e;
        return (0, l.jsxs)("div", {
          className: a()("flex flex-row justify-between w-full", { "mb-6": !!t }),
          children: [
            (0, l.jsx)(d.Buttons.Generic, {
              style: { height: "48px", background: x.w.gray900, color: x.w.white100 },
              onClick: s,
              "aria-label": "reject button in suggest flow",
              children: (0, l.jsx)("span", { "aria-label": "reject button text in suggest flow", children: n })
            }),
            (0, l.jsx)(d.Buttons.Generic, {
              style: { height: "48px", background: x.w.cosmosPrimary, color: x.w.white100, cursor: "pointer" },
              className: "ml-3 bg-gray-800",
              onClick: i,
              "aria-label": "confirm button in suggest flow",
              disabled: r,
              children: (0, l.jsx)("span", { "aria-label": "confirm button text in suggest flow", children: o })
            })
          ]
        });
      }
      var u = s(69816);
      function f(e) {
        let { text: t } = e;
        return (0, l.jsx)(u.Z, { size: "lg", className: "font-bold mt-5", children: t });
      }
      function h(e) {
        let { text: t } = e;
        return (0, l.jsx)(u.Z, {
          size: "xs",
          className: "font-bold text-center mt-[2px] max-w-[250px]",
          color: "text-gray-800 dark:text-gray-600 mb-2",
          children: t
        });
      }
      var b = s(53108),
        w = s(10289),
        g = s(48534),
        j = s(72565),
        p = s.n(j);
      function y(e) {
        let { children: t, suggestKey: s } = e,
          n = (0, w.s0)(),
          i = (0, r.useCallback)(async () => {
            await p().storage.local.set({ [b.u1]: { error: "Rejected by the user." } }),
              setTimeout(async () => {
                await p().storage.local.remove([s]), await p().storage.local.remove(b.u1), (0, g.oj)() ? n("/home") : window.close();
              }, 10);
          }, [n, s]);
        return (
          (0, r.useEffect)(
            () => (
              window.addEventListener("beforeunload", i),
              p().storage.local.remove(b.u1),
              function () {
                window.removeEventListener("beforeunload", i);
              }
            ),
            [i]
          ),
          (0, l.jsx)("div", {
            className: "flex justify-center items-center h-screen",
            children: (0, l.jsxs)("div", {
              className: "panel-width panel-height max-panel-height enclosing-panel",
              children: [
                (0, l.jsx)("div", { className: "w-full h-1 rounded-t-2xl", style: { backgroundColor: x.w.cosmosPrimary } }),
                (0, l.jsx)("div", {
                  className: a()("relative h-full flex flex-col justify-between items-center pt-4 pb-10", { "px-4": (0, g.oj)(), "px-7": !(0, g.oj)() }),
                  children: t({ handleRejectBtnClick: i })
                })
              ]
            })
          })
        );
      }
      var v = s(86874);
      function k(e) {
        let { address: t, img: s } = e;
        return t
          ? (0, l.jsx)(d.GenericCard, {
              title: (0, l.jsx)("span", { className: "text-[15px]", children: "Contract Address" }),
              subtitle: (0, l.jsx)("span", { className: "break-all", children: t }),
              className: "h-[80px] py-8 my-5",
              img: s ?? null,
              size: "sm",
              isRounded: !0
            })
          : (0, l.jsxs)("div", {
              className:
                "flex flex-col justify-end items-start w-full px-4 bg-white-100 dark:bg-gray-900 cursor-pointer min-w-[344px] h-[80px] rounded-[16px] pb-2 my-5",
              children: [
                (0, l.jsx)("div", {
                  className: "text-[15px] font-bold text-black-100 dark:text-white-100 text-left max-w-[170px] text-ellipsis overflow-hidden",
                  children: "Contract Address"
                }),
                (0, l.jsx)(v.Z, { height: 14, className: "w-full", containerClassName: "w-full mt-[2px] block !leading-none" }),
                (0, l.jsx)(v.Z, { height: 14, width: 90, containerClassName: "block mt-[2px] !leading-none" })
              ]
            });
      }
      var C = s(41477);
      function N(e) {
        let { name: t, symbol: s, decimals: n } = e;
        return (0, l.jsxs)("div", {
          className: "flex flex-col gap-y-[10px] bg-white-100 dark:bg-gray-900 rounded-2xl p-4 w-full",
          children: [
            (0, l.jsx)(C.sr, { children: "Coin Name" }),
            (0, l.jsx)(C.B4, { children: t }),
            C.iz,
            (0, l.jsx)(C.sr, { children: "Coin Symbol" }),
            (0, l.jsx)(C.B4, { children: s }),
            C.iz,
            (0, l.jsx)(C.sr, { children: "Coin Decimals" }),
            (0, l.jsx)(C.B4, { children: n })
          ]
        });
      }
    }
  }
]);
//# sourceMappingURL=1880.js.map
