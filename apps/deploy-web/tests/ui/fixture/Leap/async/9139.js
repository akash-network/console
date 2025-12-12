!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "c4f95364-aaec-4ef5-bd33-cbe6d32255dc"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-c4f95364-aaec-4ef5-bd33-cbe6d32255dc"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.23.1" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["9139"],
  {
    78189: function (e, t, a) {
      a.d(t, { Z: () => r });
      var n = a(52322);
      a(2784);
      var l = a(86874);
      function s() {
        return (0, n.jsxs)("div", {
          className: "flex items-center py-3 px-4 bg-secondary-100 w-full mt-4 rounded-xl",
          children: [
            (0, n.jsx)(l.Z, { circle: !0, width: 36, height: 36, containerClassName: "!leading-none block" }),
            (0, n.jsxs)("div", {
              className: "ml-2 h-10 justify-between flex flex-col",
              children: [
                (0, n.jsx)(l.Z, { count: 1, height: 18, width: 56, containerClassName: "block !leading-none" }),
                (0, n.jsx)(l.Z, { count: 1, height: 14, width: 77, containerClassName: "block !leading-none" })
              ]
            })
          ]
        });
      }
      function r() {
        return (0, n.jsxs)(n.Fragment, { children: [(0, n.jsx)(s, {}), (0, n.jsx)(s, {}), (0, n.jsx)(s, {}), (0, n.jsx)(s, {}), (0, n.jsx)(s, {})] });
      }
    },
    27558: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { q: () => d });
          var l = a(60431),
            s = a(36400),
            r = a(37761),
            o = a(2784),
            i = a(42799),
            c = e([s]);
          function d() {
            let e = (0, s.pb)(),
              t = i.gb.allDenoms,
              { data: a, isLoading: n } = (0, r.Dm)(),
              { cryptoAssets: c = [] } = a ?? {},
              [d, u] = (0, o.useState)(!1);
            return (
              (0, o.useEffect)(() => {
                setTimeout(() => {
                  u(!0);
                }, 1e3);
              }, []),
              (0, l.useQuery)(
                ["filtered-swapped-assets"],
                function () {
                  let a = Object.values(t),
                    n = Object.values(e),
                    l = c.reduce((e, t) => {
                      let l = n.find(e => e.chainRegistryPath === t.network || e.key === t.network),
                        s = a.find(e => e.coinDenom.toLowerCase() === t.symbol.toLowerCase());
                      return (
                        l &&
                          e.push({
                            symbol: t.code,
                            chainName: l.chainName,
                            chainId: l.chainId,
                            assetImg: (null == s ? void 0 : s.icon) ?? t.icon,
                            chainSymbolImageUrl: l.chainSymbolImageUrl,
                            origin: t.network,
                            chainKey: l.key,
                            id: t.id
                          }),
                        e
                      );
                    }, []);
                  return (
                    l.sort((e, t) => {
                      let a = e.priority ?? 1 / 0,
                        n = t.priority ?? 1 / 0;
                      return a !== n ? a - n : e.symbol.localeCompare(t.symbol);
                    }),
                    l
                  );
                },
                { enabled: e && d && t && !n }
              )
            );
          }
          (s = (c.then ? (await c)() : c)[0]), n();
        } catch (e) {
          n(e);
        }
      });
    },
    37761: function (e, t, a) {
      a.d(t, { Dm: () => o, OJ: () => c, XH: () => u, vE: () => d, zS: () => i });
      var n = a(60431),
        l = a(55334),
        s = a(57072);
      let r = "https://api.onramper.com";
      function o() {
        return (0, n.useQuery)(
          ["onramper-asset-list"],
          async () => {
            var e, t, a, n;
            let o = await l.Z.get(`${r}/supported?type=buy`, { headers: { Authorization: "pk_prod_01JXWAN8M081D3E7AX1XA1MGYM" } });
            return {
              cryptoAssets: null == o ? void 0 : null === (t = o.data) || void 0 === t ? void 0 : null === (e = t.message) || void 0 === e ? void 0 : e.crypto,
              fiatAssets: Object.values(
                (null == o ? void 0 : null === (n = o.data) || void 0 === n ? void 0 : null === (a = n.message) || void 0 === a ? void 0 : a.fiat) ?? {}
              ).map(e => ({ code: e.code, name: e.name, logo: (null == e ? void 0 : e.icon) ?? (0, s.b)(e.code) }))
            };
          },
          { staleTime: 6e4, cacheTime: 3e5 }
        );
      }
      async function i(e) {
        let t = await l.Z.get(
          `${r}/quotes/${e.fiat_currency}/${e.crypto_currency}?type=buy&amount=${e.fiat_amount}&network=${e.network}&paymentMethod=${e.payment_method}`,
          { headers: { Authorization: "pk_prod_01JXWAN8M081D3E7AX1XA1MGYM" } }
        );
        return null == t ? void 0 : t.data;
      }
      async function c(e) {
        let t = await l.Z.get(`${r}/supported/payment-types/${e.fiat_currency}?type=buy&destination=${e.crypto_currency}`, {
          headers: { Authorization: "pk_prod_01JXWAN8M081D3E7AX1XA1MGYM" }
        });
        return null == t ? void 0 : t.data;
      }
      async function d() {
        let e = await l.Z.get(`${r}/supported/onramps/all`, { headers: { Authorization: "pk_prod_01JXWAN8M081D3E7AX1XA1MGYM" } });
        return null == e ? void 0 : e.data;
      }
      async function u() {
        let e = await l.Z.get(`${r}/supported/defaults`, { headers: { Authorization: "pk_prod_01JXWAN8M081D3E7AX1XA1MGYM" } });
        return null == e ? void 0 : e.data;
      }
    },
    72027: function (e, t, a) {
      a.d(t, { S3: () => l });
      var n = a(55334);
      async function l(e) {
        var t, a;
        let { from: l, to: s } = e;
        if (!l || !s) return "0";
        let r = await n.Z.get(`https://api.kado.money/v1/ramp/currencyconvert?from=${l}&to=${s}`);
        return null == r ? void 0 : null === (a = r.data) || void 0 === a ? void 0 : null === (t = a.data) || void 0 === t ? void 0 : t.conversion;
      }
      a(57072);
    },
    59331: function (e, t, a) {
      a.d(t, { Z: () => u });
      var n = a(52322),
        l = a(41172),
        s = a(75377),
        r = a(69816),
        o = a(29750),
        i = a(2784),
        c = a(70514),
        d = a(49409);
      function u(e) {
        let { symbol: t, assetImg: a, onClick: u, chainSymbolImageUrl: m, chainName: x, isSelected: p } = e,
          { theme: f } = (0, s.useTheme)(),
          h = (0, i.useCallback)(() => {
            p || u();
          }, [p, u]);
        return (0, n.jsxs)("div", {
          className: (0, c.cn)(
            "flex gap-x-3 items-center px-4 py-3 mt-3 rounded-xl cursor-pointer border border-transparent",
            p ? "bg-secondary-200 hover:bg-secondary-200 cursor-not-allowed border-secondary-600" : "cursor-pointer bg-secondary-100 hover:bg-secondary-200"
          ),
          onClick: h,
          children: [
            (0, n.jsxs)("div", {
              className: "relative",
              children: [
                (0, n.jsx)("img", {
                  src: a ?? (f === s.ThemeName.DARK ? o.ImgNotAvailableDark : o.ImgNotAvailableLight),
                  onError: (0, d._)(f === s.ThemeName.DARK ? o.ImgNotAvailableDark : o.ImgNotAvailableLight),
                  className: "rounded-full",
                  width: 36,
                  height: 36
                }),
                (0, n.jsx)("img", { src: m, className: "w-[15px] h-[15px] absolute -bottom-0.5 -right-0.5 rounded-full bg-background" })
              ]
            }),
            (0, n.jsxs)("div", {
              className: "flex flex-col",
              children: [
                (0, n.jsx)(r.Z, { size: "md", color: "text-monochrome", className: "font-bold", children: (0, l.MDB)(t) }),
                (0, n.jsx)(r.Z, { size: "xs", color: "text-secondary-800", children: (0, l.MDB)(x) })
              ]
            })
          ]
        });
      }
    },
    38723: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { Z: () => g });
          var l = a(52322),
            s = a(41172),
            r = a(62598),
            o = a(96217),
            i = a(78189),
            c = a(84916),
            d = a(27558),
            u = a(75958),
            m = a(2784),
            x = a(7474),
            p = a(36321),
            f = a(42799),
            h = a(59331),
            y = e([d]);
          d = (y.then ? (await y)() : y)[0];
          let g = (0, u.Pi)(e => {
            let { isVisible: t, onClose: a, onAssetSelect: n, selectedAsset: u } = e,
              [y, g] = (0, m.useState)(""),
              { isLoading: b, data: v = [] } = (0, d.q)(),
              { data: j = [] } = (0, s.AcC)(),
              w = (0, m.useRef)(null),
              N = p.Ui.chainInfos,
              k = f.gb.allDenoms,
              S = Object.values(k),
              C = Object.values(N),
              _ = (0, m.useMemo)(
                () =>
                  j.reduce((e, t) => {
                    let a = C.find(e => e.chainRegistryPath === t.origin || e.key === t.origin),
                      n = S.find(e => e.coinDenom.toLowerCase() === t.symbol.toLowerCase());
                    return (
                      a &&
                        e.push({
                          ...t,
                          chainName: a.chainName,
                          chainId: a.chainId,
                          assetImg: (null == n ? void 0 : n.icon) ?? "",
                          chainSymbolImageUrl: a.chainSymbolImageUrl,
                          chainKey: a.key
                        }),
                      e
                    );
                  }, []),
                [C, S, j]
              ),
              A = (0, m.useMemo)(() => {
                let e = _.filter(e => e.symbol.toLowerCase().includes(y.toLowerCase()) || e.chainName.toLowerCase().includes(y.toLowerCase()));
                return e.length > 0 ? [{ title: "Popular tokens" }, ...e] : e;
              }, [_, y]),
              Z = (0, m.useMemo)(() => {
                let e = v
                  .filter(
                    e =>
                      (e.symbol.toLowerCase().includes(y.toLowerCase()) || e.chainName.toLowerCase().includes(y.toLowerCase())) && !j.some(t => t.id === e.id)
                  )
                  .sort((e, t) => {
                    let a = +!e.symbol.toLowerCase().includes(y.toLowerCase()),
                      n = +!t.symbol.toLowerCase().includes(y.toLowerCase());
                    return a - n;
                  });
                return e.length > 0 ? [{ title: "Available tokens" }, ...e] : e;
              }, [v, y, j]),
              E = (0, m.useMemo)(() => [...A, ...Z], [A, Z]),
              I = b && 0 === A.length;
            return (
              (0, m.useEffect)(() => {
                t &&
                  (g(""),
                  setTimeout(() => {
                    var e;
                    null === (e = w.current) || void 0 === e || e.focus();
                  }, 200));
              }, [t]),
              (0, l.jsxs)(o.Z, {
                isOpen: t,
                onClose: a,
                fullScreen: !0,
                title: "Select token to buy",
                className: "!p-6 h-full",
                children: [
                  (0, l.jsx)("div", {
                    className: "flex flex-col items-center w-full pb-2",
                    "aria-label": "search input",
                    children: (0, l.jsx)(c.M, {
                      ref: w,
                      value: y,
                      onChange: e => g(e.target.value),
                      "data-testing-id": "buy-asset-input-search",
                      placeholder: "Search Token",
                      onClear: () => g("")
                    })
                  }),
                  I && (0, l.jsx)(i.Z, {}),
                  !I &&
                    (0, l.jsxs)("div", {
                      className: "h-[calc(100%-56px)] overflow-y-auto",
                      children: [
                        (null == E ? void 0 : E.length) === 0 &&
                          (0, l.jsxs)("div", {
                            className: "py-[80px] px-4 w-full flex-col flex  justify-center items-center gap-4",
                            children: [
                              (0, l.jsx)(r.Z, { size: 64, className: "dark:text-gray-50 text-gray-900 p-5 rounded-full bg-secondary-200" }),
                              (0, l.jsxs)("div", {
                                className: "flex flex-col justify-start items-center w-full gap-4",
                                children: [
                                  (0, l.jsx)("div", {
                                    className: "text-lg text-center font-bold !leading-[21.5px] dark:text-white-100",
                                    children: "No tokens found"
                                  }),
                                  (0, l.jsx)("div", {
                                    className: "text-sm font-normal !leading-[22.4px] text-gray-400 dark:text-gray-400 text-center",
                                    children: "We couldn’t find a match. Try searching again or use a different keyword."
                                  })
                                ]
                              })
                            ]
                          }),
                        (0, l.jsx)(x.OO, {
                          data: E,
                          style: { flexGrow: "1", width: "100%" },
                          itemContent: (e, t) =>
                            "title" in t
                              ? (0, l.jsx)("div", { className: "text-muted-foreground pt-5 pb-1 font-bold text-xs", children: t.title })
                              : (0, l.jsx)(
                                  h.Z,
                                  {
                                    symbol: t.symbol,
                                    chainName: t.chainName,
                                    assetImg: t.assetImg,
                                    chainSymbolImageUrl: t.chainSymbolImageUrl,
                                    onClick: () => n(t),
                                    isSelected: t.symbol === (null == u ? void 0 : u.symbol) && t.chainId === (null == u ? void 0 : u.chainId)
                                  },
                                  t.id
                                )
                        })
                      ]
                    })
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
    49807: function (e, t, a) {
      a.d(t, { Z: () => p });
      var n = a(52322),
        l = a(62598),
        s = a(96217),
        r = a(78189),
        o = a(84916),
        i = a(37761),
        c = a(2784),
        d = a(41172),
        u = a(69816),
        m = a(70514);
      function x(e) {
        let { code: t, name: a, logo: l, onClick: s, isSelected: r } = e,
          o = (0, c.useCallback)(() => {
            r || s();
          }, [r, s]);
        return (0, n.jsxs)("div", {
          className: (0, m.cn)(
            "flex gap-x-3 items-center px-4 py-3 rounded-xl mt-3 cursor-pointer border border-transparent",
            r ? "bg-secondary-200 hover:bg-secondary-200 cursor-not-allowed border-secondary-600" : "cursor-pointer bg-secondary-100 hover:bg-secondary-200"
          ),
          onClick: o,
          children: [
            (0, n.jsx)("img", { src: l, className: "rounded-full w-9 h-9" }),
            (0, n.jsxs)("div", {
              className: "flex flex-col",
              children: [
                (0, n.jsx)(u.Z, { size: "md", color: "text-monochrome", className: "font-bold", children: (0, d.MDB)(t) }),
                (0, n.jsx)(u.Z, { size: "sm", color: "text-muted-foreground", children: a })
              ]
            })
          ]
        });
      }
      function p(e) {
        let { isVisible: t, onClose: a, onCurrencySelect: d, selectedCurrency: u } = e,
          [m, p] = (0, c.useState)(""),
          { isLoading: f, data: h } = (0, i.Dm)(),
          { fiatAssets: y = [] } = h ?? {},
          g = (0, c.useRef)(null),
          b = (0, c.useMemo)(() => y.filter(e => e.code.toLowerCase().includes(m) || e.name.toLowerCase().includes(m)), [y, m]);
        return (
          (0, c.useEffect)(() => {
            t &&
              (p(""),
              setTimeout(() => {
                var e;
                null === (e = g.current) || void 0 === e || e.focus();
              }, 200));
          }, [t]),
          (0, n.jsxs)(s.Z, {
            isOpen: t,
            onClose: a,
            title: "Select currency",
            className: "!p-6",
            fullScreen: !0,
            children: [
              (0, n.jsx)("div", {
                className: "flex flex-col items-center w-full pb-2",
                children: (0, n.jsx)(o.M, {
                  ref: g,
                  value: m,
                  onChange: e => p(e.target.value),
                  "data-testing-id": "currency-input-search",
                  placeholder: "Search currency",
                  onClear: () => p("")
                })
              }),
              f && (0, n.jsx)(r.Z, {}),
              !f &&
                (0, n.jsxs)("div", {
                  children: [
                    (null == b ? void 0 : b.length) === 0 &&
                      (0, n.jsxs)("div", {
                        className: "py-[80px] px-4 w-full flex-col flex  justify-center items-center gap-4",
                        children: [
                          (0, n.jsx)(l.Z, { size: 64, className: "dark:text-gray-50 text-gray-900 p-5 rounded-full bg-secondary-200" }),
                          (0, n.jsxs)("div", {
                            className: "flex flex-col justify-start items-center w-full gap-4",
                            children: [
                              (0, n.jsx)("div", {
                                className: "text-lg text-center font-bold !leading-[21.5px] dark:text-white-100",
                                children: "No tokens found"
                              }),
                              (0, n.jsx)("div", {
                                className: "text-sm font-normal !leading-[22.4px] text-gray-400 dark:text-gray-400 text-center",
                                children: "We couldn’t find a match. Try searching again or use a different keyword."
                              })
                            ]
                          })
                        ]
                      }),
                    0 !== b.length &&
                      b.map((e, t) =>
                        (0, n.jsx)(n.Fragment, {
                          children: (0, n.jsx)(x, { code: e.code, name: e.name, logo: e.logo, onClick: () => d(e.code), isSelected: e.code === u }, e.code)
                        })
                      )
                  ]
                })
            ]
          })
        );
      }
    },
    90802: function (e, t, a) {
      a.d(t, { Z: () => c });
      var n = a(52322),
        l = a(96217),
        s = a(69816),
        r = a(6401),
        o = a(75958);
      a(2784);
      var i = a(70514);
      let c = (0, o.Pi)(e => {
        let { isVisible: t, onClose: a, onPaymentSelect: o, paymentMethods: c, selectedPaymentMethod: d } = e,
          [u] = (0, r.nB)();
        return (0, n.jsx)(l.Z, {
          isOpen: t,
          onClose: a,
          title: "Pay using",
          fullScreen: !0,
          className: "!px-6 !pb-7 !pt-8 bg-secondary-50",
          children: (0, n.jsx)("div", {
            className: "flex flex-col gap-5 w-full",
            children: c.map((e, t) =>
              (0, n.jsx)(
                "div",
                {
                  className: (0, i.cn)("flex justify-between items-center w-full bg-secondary rounded-xl p-5 cursor-pointer", {
                    "border border-monochrome": e.paymentTypeId === d.paymentTypeId
                  }),
                  onClick: () => o(e),
                  "aria-label": "payment method item in select payment sheet flow",
                  children: (0, n.jsxs)("div", {
                    className: "flex gap-4 items-center",
                    children: [
                      (0, n.jsx)("img", { src: e.icon, className: "w-10 h-10" }),
                      (0, n.jsxs)("div", {
                        className: "flex flex-col items-start gap-0.5",
                        children: [
                          (0, n.jsx)(s.Z, {
                            className: "text-[18px] font-bold",
                            color: "text-monochrome",
                            children: (0, n.jsx)("span", { "aria-label": "payment method item text in select payment sheet flow", children: e.name })
                          }),
                          0 === t && (0, n.jsx)(s.Z, { size: "xs", className: "font-medium", color: "text-green-500", children: "Recommended" })
                        ]
                      })
                    ]
                  })
                },
                e.paymentTypeId
              )
            )
          })
        });
      });
    },
    66946: function (e, t, a) {
      a.d(t, { Z: () => d });
      var n = a(52322),
        l = a(49183),
        s = a(96217),
        r = a(69816),
        o = a(6401),
        i = a(75958);
      a(2784);
      var c = a(70514);
      let d = (0, i.Pi)(e => {
        let { isVisible: t, onClose: a, onProviderSelect: i, providers: d, selectedProvider: u, asset: m } = e,
          [x] = (0, o.nB)();
        return (0, n.jsx)(s.Z, {
          isOpen: t,
          onClose: a,
          fullScreen: !0,
          title: "Select provider",
          className: "!px-6 !pb-7 !pt-8 bg-secondary-50",
          children: (0, n.jsx)("div", {
            className: "flex flex-col gap-5 w-full",
            children: d
              .sort((e, t) => (t.quote.payout ?? 0) - (e.quote.payout ?? 0))
              .map((e, t) =>
                (0, n.jsxs)(
                  "div",
                  {
                    className: (0, c.cn)("flex justify-between items-center w-full bg-secondary rounded-xl p-5 cursor-pointer", {
                      "border border-monochrome": e.provider.id === u.provider.id
                    }),
                    onClick: () => i(e),
                    children: [
                      (0, n.jsxs)("div", {
                        className: "flex gap-4 items-center",
                        children: [
                          (0, n.jsx)("img", { src: e.provider.icon, className: "w-10 h-10" }),
                          (0, n.jsxs)("div", {
                            className: "flex flex-col items-start gap-0.5",
                            children: [
                              (0, n.jsx)(r.Z, { className: "text-[18px] font-bold", color: "text-monochrome", children: e.provider.displayName }),
                              0 === t && (0, n.jsx)(r.Z, { size: "xs", className: "font-medium", color: "text-green-500", children: "Best Value" })
                            ]
                          })
                        ]
                      }),
                      e.quote.payout && e.quote.payout > 0 && m
                        ? (0, n.jsx)("div", {
                            className: "flex flex-col items-end gap-0.5",
                            children: (0, n.jsx)(r.Z, {
                              size: "sm",
                              className: "font-bold",
                              color: "text-monochrome",
                              children: (0, l.LH)(e.quote.payout.toString(), m.symbol, 6)
                            })
                          })
                        : null
                    ]
                  },
                  e.provider.id
                )
              )
          })
        });
      });
    },
    34712: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.r(t), a.d(t, { ServiceProviderBaseUrlEnum: () => F, ServiceProviderEnum: () => U, default: () => G });
          var l,
            s,
            r = a(52322),
            o = a(41172),
            i = a(43166),
            c = a(48272),
            d = a(26007),
            u = a(92642),
            m = a(6391),
            x = a.n(m),
            p = a(78023),
            f = a(85027),
            h = a(19623),
            y = a(69816),
            g = a(91486),
            b = a(26571),
            v = a(36023),
            j = a.n(v),
            w = a(36400),
            N = a(37761),
            k = a(72027),
            S = a(42941),
            C = a(86240),
            _ = a(57124),
            A = a(25292),
            Z = a(35065),
            E = a(65432),
            I = a(2784),
            M = a(86874),
            D = a(10289),
            T = a(70514),
            z = a(57072),
            L = a(49409),
            $ = a(71198),
            X = a(38723),
            P = a(49807),
            q = a(90802),
            O = a(66946),
            R = e([w, Z, X]);
          [w, Z, X] = R.then ? (await R)() : R;
          var U = (((l = {}).ONRAMPER = "onramper"), l),
            F = (((s = {}).ONRAMPER = "https://buy.onramper.com"), s);
          let G = () => {
            let { walletAvatar: e, walletName: t } = (0, C.v)(),
              [a, n] = (0, I.useState)(!1),
              [l, s] = (0, I.useState)(null),
              [m, v] = (0, I.useState)(null),
              [R, U] = (0, I.useState)(null),
              [F, G] = (0, I.useState)(null),
              [W, Y] = (0, I.useState)(null),
              [B, J] = (0, I.useState)(!1),
              [H, K] = (0, I.useState)(!1),
              V = (0, S.Z)().get("pageSource") ?? void 0,
              Q = (0, I.useRef)(0);
            (0, I.useMemo)(() => ({ pageViewSource: V }), [V]);
            let ee = (0, _.a)(),
              et = (0, D.s0)(),
              ea = (0, D.TH)().state,
              [en, el] = (0, I.useState)(!1),
              [es, er] = (0, I.useState)(!1),
              [eo, ei] = (0, I.useState)(""),
              [ec, ed] = (0, I.useState)(void 0),
              eu = (0, o.SFn)(null == ec ? void 0 : ec.chainKey),
              [em, ex] = (0, I.useState)("0"),
              ep = (0, o.NrF)(em, 500),
              [ef, eh] = (0, I.useState)("0"),
              [ey, eg] = (0, I.useState)("0"),
              [eb, ev] = (0, I.useState)(!1),
              [ej, ew] = (0, I.useState)(null),
              eN = (0, I.useRef)(null),
              ek = (0, w.pb)(),
              eS = (0, I.useCallback)(() => n(!0), []);
            (0, I.useEffect)(() => {
              (async function () {
                let e = await (0, N.OJ)({ fiat_currency: eo.toLowerCase(), crypto_currency: (null == ec ? void 0 : ec.id) ?? "atom_cosmos" });
                s(e.message), v(e.message.length > 0 ? e.message[0] : null);
              })();
            }, [eo, ec]),
              (0, I.useEffect)(() => {
                (async function () {
                  let e = await (0, N.vE)();
                  U(e.message);
                })();
              }, []),
              (0, I.useEffect)(() => {
                async function e() {
                  let e = ++Q.current;
                  try {
                    ew(null), ev(!0);
                    let t = (
                        await (0, N.zS)({
                          payment_method: (null == m ? void 0 : m.paymentTypeId) ?? "",
                          fiat_amount: new (x())(ep).toNumber(),
                          fiat_currency: eo.toLowerCase(),
                          crypto_currency: (null == ec ? void 0 : ec.id) ?? "atom_cosmos",
                          network: (null == ec ? void 0 : ec.origin) ?? "cosmos"
                        })
                      ).filter(e => (e.payout ?? 0) > 0),
                      a = t.reduce((e, t) => {
                        let a = null == R ? void 0 : R.find(e => e.id === t.ramp);
                        return a && e.push({ provider: a, quote: t }), e;
                      }, []);
                    if (e !== Q.current) return;
                    t.length > 0
                      ? (eg((t[0].payout ?? 0).toString()), G(a), Y(a[0]))
                      : (eg("0"), ew("No onramp available for these details. Please select a different payment method, fiat or crypto"));
                  } catch (a) {
                    if (e !== Q.current) return;
                    (0, u.Tb)(a, {
                      tags: { errorType: "get_quote_error", source: "get_quote", severity: "error", errorName: a instanceof Error ? a.name : "GetQuoteError" },
                      fingerprint: ["get_quote", "get_quote_error"],
                      level: "error",
                      contexts: { transaction: { type: "get_quote", errorMessage: a instanceof Error ? a.message : String(a) } },
                      extra: {
                        fiat_currency: eo.toLowerCase(),
                        crypto_currency: (null == ec ? void 0 : ec.id) ?? "atom_cosmos",
                        network: (null == ec ? void 0 : ec.origin) ?? "cosmos",
                        payment_method: (null == m ? void 0 : m.paymentTypeId) ?? "",
                        fiat_amount: new (x())(ep).toNumber()
                      }
                    });
                    let t = a instanceof Error ? a.message : "An error occurred";
                    t.toLowerCase().includes("timeout") ? ew("Request timed out. Unable to fetch quote.") : ew(t);
                  } finally {
                    e === Q.current && ev(!1);
                  }
                }
                ep && (null == m ? void 0 : m.paymentTypeId) && new (x())(ep).isGreaterThan("0") ? e() : eg("0");
              }, [ep, R, ec, eo, null == m ? void 0 : m.paymentTypeId]),
              (0, I.useEffect)(() => {
                if (eN.current) {
                  var e;
                  null === (e = eN.current) || void 0 === e || e.focus();
                }
              }, []),
              (0, I.useEffect)(() => {
                if (V === b.q.AssetDetails) {
                  let e = ek[ea.chain];
                  ed({
                    symbol: ea.symbol,
                    chainName: e.chainName,
                    chainId: e.chainId,
                    chainSymbolImageUrl: e.chainSymbolImageUrl,
                    assetImg: ea.img,
                    origin: e.chainName,
                    chainKey: e.key,
                    tags: null == ea ? void 0 : ea.tags
                  });
                }
              }, [ea, ek, V]),
              (0, I.useEffect)(() => {
                ec || er(!0);
              }, [ec]),
              (0, I.useEffect)(() => {
                (async function (e, t) {
                  if ("USD" !== t) {
                    let a = await (0, k.S3)({ from: t, to: "USD" }),
                      n = new (x())(e).multipliedBy(a);
                    eh(n.toString());
                  } else eh(e);
                })(ep, eo);
              }, [ep, eo]),
              (0, I.useEffect)(() => {
                (async function () {
                  if ((ew(null), parseFloat(ef) > 0)) {
                    let e = await (0, k.S3)({ from: "USD", to: eo });
                    10 > parseFloat(ef)
                      ? ew(`Amount should be at least ${(10 * e).toFixed(2)} ${eo}`)
                      : parseFloat(ef) > 1e4 && ew(`Amount exceeds your daily limit of ${(1e4 * e).toFixed(2)} ${eo}`);
                  }
                })();
              }, [ef, eo]),
              (0, I.useEffect)(() => {
                async function e() {
                  try {
                    let e = await (0, N.XH)();
                    ei(e.message.source.toUpperCase()), ex(e.message.amount.toString());
                  } catch (e) {
                    (0, u.Tb)(e, {
                      tags: {
                        errorType: "get_defaults_error",
                        source: "get_defaults",
                        severity: "error",
                        errorName: e instanceof Error ? e.name : "GetDefaultsError"
                      },
                      fingerprint: ["get_defaults", "get_defaults_error"],
                      level: "error",
                      contexts: { transaction: { type: "get_defaults", errorMessage: e instanceof Error ? e.message : String(e) } },
                      extra: { selectedCurrency: eo }
                    }),
                      ei("USD"),
                      ex("300");
                  }
                }
                eo || e();
              }, [eo]);
            let eC = (0, I.useCallback)(() => {
              var e, t;
              let a = {
                  apiKey: "pk_prod_01JXWAN8M081D3E7AX1XA1MGYM",
                  wallets: (null == ec ? void 0 : ec.id) + ":" + eu,
                  skipTransactionScreen: !0,
                  txnType: "buy",
                  txnAmount: em,
                  txnFiat: eo,
                  txnCrypto: (null == ec ? void 0 : ec.id) ?? "",
                  txnPaymentMethod: null == m ? void 0 : m.paymentTypeId,
                  txnOnramp: null == W ? void 0 : W.provider.id,
                  txnRedirect: !0
                },
                n = ((e = "01JXWAN8M1EEJKBTW2WGR9FMDY"), (t = `wallets=${a.wallets}`), j().HmacSHA256(t, e).toString(j().enc.Hex)),
                l = (0, E.l)(a),
                s = `https://buy.onramper.com?${l}&signature=${n}`;
              window.open(s, "_blank");
            }, [em, eu, null == ec ? void 0 : ec.id, eo, null == m ? void 0 : m.paymentTypeId, null == W ? void 0 : W.provider.id]);
            return (0, r.jsxs)(r.Fragment, {
              children: [
                ec
                  ? (0, r.jsxs)(r.Fragment, {
                      children: [
                        (0, r.jsxs)(f.m, {
                          children: [
                            (0, r.jsx)(i.X, { size: 36, className: "text-monochrome cursor-pointer p-2", onClick: () => et(-1) }),
                            (0, r.jsx)(p.G, {
                              className: "absolute top-1/2 right-1/2 translate-x-1/2 -translate-y-1/2",
                              walletName: t,
                              showWalletAvatar: !0,
                              walletAvatar: e,
                              showDropdown: !0,
                              handleDropdownClick: eS
                            })
                          ]
                        }),
                        (0, r.jsxs)("div", {
                          className: "flex flex-col gap-3 p-6",
                          children: [
                            (0, r.jsxs)("div", {
                              className: "w-full bg-secondary-100 rounded-2xl p-5 flex flex-col gap-3",
                              children: [
                                (0, r.jsx)("div", {
                                  className: "flex justify-between items-center",
                                  children: (0, r.jsx)("p", { className: "text-muted-foreground text-sm font-medium !leading-[22.4px]", children: "You pay" })
                                }),
                                (0, r.jsxs)("div", {
                                  className: "flex rounded-2xl justify-between w-full items-center gap-2 h-[34px] p-[2px]",
                                  children: [
                                    (0, r.jsx)("input", {
                                      value: em,
                                      onChange: e => {
                                        ew(null);
                                        let t = e.target.value,
                                          a = (0, $.Rv)(t);
                                        0 > parseFloat(a) ? ew("Please enter a valid positive number.") : ex(a);
                                      },
                                      type: "number",
                                      placeholder: "0",
                                      ref: eN,
                                      className: (0, T.cn)(
                                        "bg-transparent outline-none w-full text-left placeholder:font-bold placeholder:text-[24px] placeholder:text-monochrome font-bold !leading-[32.4px] caret-accent-blue",
                                        {
                                          "text-destructive-100": !!ej,
                                          "text-monochrome": !ej,
                                          "text-[24px]": em.length < 12,
                                          "text-[22px]": em.length >= 12 && em.length < 15,
                                          "text-[20px]": em.length >= 15 && em.length < 18,
                                          "text-[18px]": em.length >= 18
                                        }
                                      ),
                                      "aria-label": "buy pay amount input"
                                    }),
                                    (0, r.jsxs)("button", {
                                      className: (0, T.cn)(
                                        "flex justify-end items-center gap-2 shrink-0 py-1 px-1.5 rounded-[40px] bg-secondary-300 hover:bg-secondary-400"
                                      ),
                                      onClick: () => el(!0),
                                      "aria-label": "buy pay amount currency button",
                                      children: [
                                        (0, r.jsx)("img", {
                                          src: (0, z.b)(eo),
                                          className: "w-[24px] h-[24px] rounded-full",
                                          "aria-label": "buy pay amount currency image"
                                        }),
                                        (0, r.jsx)("p", {
                                          className: (0, T.cn)("dark:text-white-100 text-sm font-medium"),
                                          "aria-label": "buy pay amount currency text",
                                          children: eo
                                        }),
                                        (0, r.jsx)(c.p, { size: 14, className: "dark:text-white-100", "aria-label": "buy pay amount currency caret down" })
                                      ]
                                    })
                                  ]
                                }),
                                ej && (0, r.jsx)(y.Z, { size: "xs", className: "text-red-600 dark:text-red-300 pt-1.5", children: ej }),
                                (0, r.jsx)("div", {
                                  className: "flex gap-1.5 mt-1",
                                  children: [100, 500, 1e3].map(e =>
                                    (0, r.jsx)(
                                      "button",
                                      {
                                        onClick: () => ex(e.toString()),
                                        className:
                                          "rounded-full bg-secondary-200 px-[6px] py-0.5 font-medium text-xs hover:bg-secondary-300 dark:hover:text-white-100 hover:text-black-100 !leading-[19.2px] text-muted-foreground",
                                        "aria-label": `buy pay amount button ${e}`,
                                        children: e
                                      },
                                      e
                                    )
                                  )
                                })
                              ]
                            }),
                            (0, r.jsxs)("div", {
                              className: "w-full bg-secondary-100 rounded-2xl p-5 flex flex-col gap-3",
                              children: [
                                (0, r.jsx)("div", {
                                  className: "flex justify-between items-center",
                                  children: (0, r.jsx)("p", { className: "text-muted-foreground text-sm font-medium !leading-[22.4px]", children: "You get" })
                                }),
                                (0, r.jsxs)("div", {
                                  className: "flex rounded-2xl justify-between w-full items-center gap-2 h-[34px] p-[2px]",
                                  children: [
                                    eb
                                      ? (0, r.jsx)("div", {
                                          className: "w-[50px] h-full z-0",
                                          children: (0, r.jsx)(M.Z, { className: "rounded-full bg-gray-50 dark:bg-gray-800" })
                                        })
                                      : (0, r.jsx)("input", {
                                          value: 1e6 * parseFloat(ey) > 0 ? (0, o.LHZ)(ey, void 0, 6) : ey,
                                          placeholder: "0",
                                          className: (0, T.cn)(
                                            "bg-transparent outline-none w-full text-left placeholder:font-bold placeholder:text-[24px] placeholder:text-monochrome font-bold !leading-[32.4px] caret-accent-blue text-[24px] text-monochrome"
                                          ),
                                          readOnly: !0
                                        }),
                                    (0, r.jsxs)("button", {
                                      className: (0, T.cn)(
                                        "flex justify-end items-center gap-2 shrink-0 py-1 px-1.5 rounded-[40px] bg-secondary-300 hover:bg-secondary-400"
                                      ),
                                      onClick: () => er(!0),
                                      "aria-label": "buy get amount token button",
                                      children: [
                                        (0, r.jsx)("img", {
                                          src: null == ec ? void 0 : ec.assetImg,
                                          onError: (0, L._)(ee),
                                          className: "w-[24px] h-[24px] rounded-full",
                                          "aria-label": "buy get amount token image"
                                        }),
                                        (0, r.jsx)("p", {
                                          className: (0, T.cn)("dark:text-white-100 text-sm font-medium"),
                                          "aria-label": "buy get amount token text",
                                          children: null == ec ? void 0 : ec.symbol
                                        }),
                                        (0, r.jsx)(c.p, { size: 14, className: "dark:text-white-100", "aria-label": "buy get amount token caret down" })
                                      ]
                                    })
                                  ]
                                })
                              ]
                            }),
                            m &&
                              (0, r.jsxs)("div", {
                                className: "w-full flex justify-between mt-2",
                                children: [
                                  (0, r.jsx)(y.Z, { size: "sm", color: "text-muted-foreground", className: "font-medium", children: "Pay using" }),
                                  (0, r.jsxs)("div", {
                                    className: (0, T.cn)("flex items-center gap-1", { "cursor-pointer": l && l.length > 1 }),
                                    onClick: () => {
                                      l && l.length > 1 && J(!0);
                                    },
                                    children: [
                                      (0, r.jsx)("img", { src: m.icon, className: "w-5 h-5" }),
                                      (0, r.jsx)(y.Z, { size: "sm", color: "text-monochrome", className: "font-medium", children: (0, $.MD)(m.name, 15, 3) }),
                                      l && l.length > 1 && (0, r.jsx)(c.p, { size: 14, className: "text-secondary-600" })
                                    ]
                                  })
                                ]
                              }),
                            W &&
                              !ej &&
                              (0, r.jsxs)("div", {
                                className: "w-full flex justify-between mt-1",
                                children: [
                                  (0, r.jsx)(y.Z, { size: "sm", color: "text-muted-foreground", className: "font-medium", children: "Provider" }),
                                  eb
                                    ? (0, r.jsxs)("div", {
                                        className: "flex items-center gap-0.5",
                                        children: [
                                          (0, r.jsx)(h.T, { color: "text-green-600", className: "h-7 w-7" }),
                                          (0, r.jsx)(y.Z, {
                                            size: "sm",
                                            color: "text-monochrome",
                                            className: "font-medium",
                                            children: "Fetching best quote..."
                                          })
                                        ]
                                      })
                                    : (0, r.jsxs)("div", {
                                        className: (0, T.cn)("flex items-center gap-1", { "cursor-pointer": F && F.length > 1 }),
                                        onClick: () => {
                                          F && F.length > 1 && K(!0);
                                        },
                                        children: [
                                          (0, r.jsx)("img", { src: W.provider.icon, className: "w-5 h-5" }),
                                          (0, r.jsx)(y.Z, { size: "sm", color: "text-monochrome", className: "font-medium", children: W.provider.displayName }),
                                          F && F.length > 1 && (0, r.jsx)(c.p, { size: 14, className: "text-secondary-600" })
                                        ]
                                      })
                                ]
                              })
                          ]
                        }),
                        (0, r.jsx)("div", {
                          className: "w-full p-4 mt-auto sticky bottom-0 bg-secondary-100 ",
                          children: (0, r.jsx)(g.zx, {
                            className: (0, T.cn)("w-full", { "!bg-red-300 text-white-100": ej }),
                            onClick: eC,
                            disabled: !new (x())(ey).isGreaterThan(0) || eb || (0, A.isString)(ej),
                            "aria-label": "buy button in buy flow",
                            children: new (x())(ey).isGreaterThan(0)
                              ? (0, r.jsxs)("div", {
                                  className: "flex items-center gap-1.5",
                                  children: [
                                    (0, r.jsx)(d.O, { size: 20, weight: "bold" }),
                                    (0, r.jsx)("span", { "aria-label": "buy button text in buy flow", children: "Buy" })
                                  ]
                                })
                              : (0, r.jsx)("span", { "aria-label": "buy button text in buy flow", children: "Enter amount" })
                          })
                        })
                      ]
                    })
                  : null,
                (0, r.jsx)(P.Z, {
                  isVisible: en,
                  selectedCurrency: eo,
                  onClose: () => el(!1),
                  onCurrencySelect: e => {
                    ei(e), el(!1), eN.current && eN.current.focus();
                  }
                }),
                (0, r.jsx)(Z.Z, {
                  isVisible: a,
                  onClose: () => {
                    n(!1), et("/home");
                  },
                  title: "Your Wallets"
                }),
                (0, r.jsx)(X.Z, {
                  isVisible: es,
                  selectedAsset: ec,
                  onClose: () => {
                    ec ? er(!1) : et(-1);
                  },
                  onAssetSelect: e => {
                    ed(e), v(null), er(!1), eN.current && eN.current.focus();
                  }
                }),
                l &&
                  m &&
                  (0, r.jsx)(q.Z, {
                    isVisible: B,
                    onClose: () => J(!1),
                    onPaymentSelect: e => {
                      v(e), J(!1);
                    },
                    paymentMethods: l,
                    selectedPaymentMethod: m
                  }),
                F &&
                  W &&
                  (0, r.jsx)(O.Z, {
                    isVisible: H,
                    onClose: () => K(!1),
                    onProviderSelect: e => {
                      var t;
                      Y(e), eg((null === (t = e.quote.payout) || void 0 === t ? void 0 : t.toString()) ?? "0"), K(!1);
                    },
                    providers: F,
                    selectedProvider: W,
                    asset: ec
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
    65432: function (e, t, a) {
      a.d(t, { l: () => n });
      function n(e) {
        return Object.entries(e)
          .map(e => {
            let [t, a] = e;
            return `${t}=${a}`;
          })
          .join("&");
      }
    },
    57072: function (e, t, a) {
      a.d(t, { b: () => l });
      var n = a(30464);
      let l = e => {
        let t = null == e ? void 0 : e.toUpperCase();
        return n.r.Countries[t] ?? n.r.Logos.GenericDark;
      };
    }
  }
]);
//# sourceMappingURL=9139.js.map
