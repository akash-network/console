!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "e815eefd-8437-4454-9f08-e85f9e2f651e"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-e815eefd-8437-4454-9f08-e85f9e2f651e"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.22.9" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["9139"],
  {
    78189: function (e, t, a) {
      a.d(t, { Z: () => o });
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
      function o() {
        return (0, n.jsxs)(n.Fragment, { children: [(0, n.jsx)(s, {}), (0, n.jsx)(s, {}), (0, n.jsx)(s, {}), (0, n.jsx)(s, {}), (0, n.jsx)(s, {})] });
      }
    },
    27558: function (e, t, a) {
      a.a(e, async function (e, n) {
        try {
          a.d(t, { q: () => d });
          var l = a(60431),
            s = a(36400),
            o = a(37761),
            r = a(2784),
            i = a(42799),
            c = e([s]);
          function d() {
            let e = (0, s.pb)(),
              t = i.gb.allDenoms,
              { data: a, isLoading: n } = (0, o.Dm)(),
              { cryptoAssets: c = [] } = a ?? {},
              [d, u] = (0, r.useState)(!1);
            return (
              (0, r.useEffect)(() => {
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
      a.d(t, { Dm: () => r, OJ: () => c, XH: () => u, vE: () => d, zS: () => i });
      var n = a(60431),
        l = a(55334),
        s = a(57072);
      let o = "https://api.onramper.com";
      function r() {
        return (0, n.useQuery)(
          ["onramper-asset-list"],
          async () => {
            var e, t, a, n;
            let r = await l.Z.get(`${o}/supported?type=buy`, { headers: { Authorization: "pk_prod_01JXWAN8M081D3E7AX1XA1MGYM" } });
            return {
              cryptoAssets: null == r ? void 0 : null === (t = r.data) || void 0 === t ? void 0 : null === (e = t.message) || void 0 === e ? void 0 : e.crypto,
              fiatAssets: Object.values(
                (null == r ? void 0 : null === (n = r.data) || void 0 === n ? void 0 : null === (a = n.message) || void 0 === a ? void 0 : a.fiat) ?? {}
              ).map(e => ({ code: e.code, name: e.name, logo: (null == e ? void 0 : e.icon) ?? (0, s.b)(e.code) }))
            };
          },
          { staleTime: 6e4, cacheTime: 3e5 }
        );
      }
      async function i(e) {
        let t = await l.Z.get(
          `${o}/quotes/${e.fiat_currency}/${e.crypto_currency}?type=buy&amount=${e.fiat_amount}&network=${e.network}&paymentMethod=${e.payment_method}`,
          { headers: { Authorization: "pk_prod_01JXWAN8M081D3E7AX1XA1MGYM" } }
        );
        return null == t ? void 0 : t.data;
      }
      async function c(e) {
        let t = await l.Z.get(`${o}/supported/payment-types/${e.fiat_currency}?type=buy&destination=${e.crypto_currency}`, {
          headers: { Authorization: "pk_prod_01JXWAN8M081D3E7AX1XA1MGYM" }
        });
        return null == t ? void 0 : t.data;
      }
      async function d() {
        let e = await l.Z.get(`${o}/supported/onramps/all`, { headers: { Authorization: "pk_prod_01JXWAN8M081D3E7AX1XA1MGYM" } });
        return null == e ? void 0 : e.data;
      }
      async function u() {
        let e = await l.Z.get(`${o}/supported/defaults`, { headers: { Authorization: "pk_prod_01JXWAN8M081D3E7AX1XA1MGYM" } });
        return null == e ? void 0 : e.data;
      }
    },
    72027: function (e, t, a) {
      a.d(t, { S3: () => l });
      var n = a(55334);
      async function l(e) {
        var t, a;
        let { from: l, to: s } = e,
          o = await n.Z.get(`https://api.kado.money/v1/ramp/currencyconvert?from=${l}&to=${s}`);
        return null == o ? void 0 : null === (a = o.data) || void 0 === a ? void 0 : null === (t = a.data) || void 0 === t ? void 0 : t.conversion;
      }
      a(57072);
    },
    59331: function (e, t, a) {
      a.d(t, { Z: () => u });
      var n = a(52322),
        l = a(41172),
        s = a(75377),
        o = a(69816),
        r = a(29750),
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
                  src: a ?? (f === s.ThemeName.DARK ? r.ImgNotAvailableDark : r.ImgNotAvailableLight),
                  onError: (0, d._)(f === s.ThemeName.DARK ? r.ImgNotAvailableDark : r.ImgNotAvailableLight),
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
                (0, n.jsx)(o.Z, { size: "md", color: "text-monochrome", className: "font-bold", children: (0, l.MDB)(t) }),
                (0, n.jsx)(o.Z, { size: "xs", color: "text-secondary-800", children: (0, l.MDB)(x) })
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
            o = a(62598),
            r = a(96217),
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
              A = (0, m.useMemo)(
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
              Z = (0, m.useMemo)(() => {
                let e = A.filter(e => e.symbol.toLowerCase().includes(y.toLowerCase()) || e.chainName.toLowerCase().includes(y.toLowerCase()));
                return e.length > 0 ? [{ title: "Popular tokens" }, ...e] : e;
              }, [A, y]),
              _ = (0, m.useMemo)(() => {
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
              I = (0, m.useMemo)(() => [...Z, ..._], [Z, _]),
              M = b && 0 === Z.length;
            return (
              (0, m.useEffect)(() => {
                t &&
                  (g(""),
                  setTimeout(() => {
                    var e;
                    null === (e = w.current) || void 0 === e || e.focus();
                  }, 200));
              }, [t]),
              (0, l.jsxs)(r.Z, {
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
                  M && (0, l.jsx)(i.Z, {}),
                  !M &&
                    (0, l.jsxs)("div", {
                      className: "h-[calc(100%-56px)] overflow-y-auto",
                      children: [
                        (null == I ? void 0 : I.length) === 0 &&
                          (0, l.jsxs)("div", {
                            className: "py-[80px] px-4 w-full flex-col flex  justify-center items-center gap-4",
                            children: [
                              (0, l.jsx)(o.Z, { size: 64, className: "dark:text-gray-50 text-gray-900 p-5 rounded-full bg-secondary-200" }),
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
                          data: I,
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
        o = a(78189),
        r = a(84916),
        i = a(37761),
        c = a(2784),
        d = a(41172),
        u = a(69816),
        m = a(70514);
      function x(e) {
        let { code: t, name: a, logo: l, onClick: s, isSelected: o } = e,
          r = (0, c.useCallback)(() => {
            o || s();
          }, [o, s]);
        return (0, n.jsxs)("div", {
          className: (0, m.cn)(
            "flex gap-x-3 items-center px-4 py-3 rounded-xl mt-3 cursor-pointer border border-transparent",
            o ? "bg-secondary-200 hover:bg-secondary-200 cursor-not-allowed border-secondary-600" : "cursor-pointer bg-secondary-100 hover:bg-secondary-200"
          ),
          onClick: r,
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
                children: (0, n.jsx)(r.M, {
                  ref: g,
                  value: m,
                  onChange: e => p(e.target.value),
                  "data-testing-id": "currency-input-search",
                  placeholder: "Search currency",
                  onClear: () => p("")
                })
              }),
              f && (0, n.jsx)(o.Z, {}),
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
        o = a(6401),
        r = a(75958);
      a(2784);
      var i = a(70514);
      let c = (0, r.Pi)(e => {
        let { isVisible: t, onClose: a, onPaymentSelect: r, paymentMethods: c, selectedPaymentMethod: d } = e,
          [u] = (0, o.nB)();
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
                  onClick: () => r(e),
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
        o = a(69816),
        r = a(6401),
        i = a(75958);
      a(2784);
      var c = a(70514);
      let d = (0, i.Pi)(e => {
        let { isVisible: t, onClose: a, onProviderSelect: i, providers: d, selectedProvider: u, asset: m } = e,
          [x] = (0, r.nB)();
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
                              (0, n.jsx)(o.Z, { className: "text-[18px] font-bold", color: "text-monochrome", children: e.provider.displayName }),
                              0 === t && (0, n.jsx)(o.Z, { size: "xs", className: "font-medium", color: "text-green-500", children: "Best Value" })
                            ]
                          })
                        ]
                      }),
                      e.quote.payout && e.quote.payout > 0 && m
                        ? (0, n.jsx)("div", {
                            className: "flex flex-col items-end gap-0.5",
                            children: (0, n.jsx)(o.Z, {
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
          a.r(t), a.d(t, { ServiceProviderBaseUrlEnum: () => G, ServiceProviderEnum: () => q, default: () => W });
          var l,
            s,
            o = a(52322),
            r = a(41172),
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
            A = a(57124),
            Z = a(25292),
            _ = a(35065),
            I = a(65432),
            M = a(2784),
            E = a(86874),
            D = a(10289),
            z = a(70514),
            L = a(57072),
            T = a(49409),
            $ = a(37906),
            X = a(71198),
            P = a(38723),
            O = a(49807),
            R = a(90802),
            U = a(66946),
            F = e([w, _, P]);
          [w, _, P] = F.then ? (await F)() : F;
          var q = (((l = {}).ONRAMPER = "onramper"), l),
            G = (((s = {}).ONRAMPER = "https://buy.onramper.com"), s);
          let W = () => {
            let { walletAvatar: e, walletName: t } = (0, C.v)(),
              [a, n] = (0, M.useState)(!1),
              [l, s] = (0, M.useState)(null),
              [m, v] = (0, M.useState)(null),
              [F, q] = (0, M.useState)(null),
              [G, W] = (0, M.useState)(null),
              [Y, B] = (0, M.useState)(null),
              [J, H] = (0, M.useState)(!1),
              [K, V] = (0, M.useState)(!1),
              Q = (0, S.Z)().get("pageSource") ?? void 0,
              ee = (0, M.useRef)(0);
            (0, M.useMemo)(() => ({ pageViewSource: Q }), [Q]);
            let et = (0, A.a)(),
              ea = (0, D.s0)(),
              en = (0, D.TH)().state,
              [el, es] = (0, M.useState)(!1),
              [eo, er] = (0, M.useState)(!1),
              [ei, ec] = (0, M.useState)(""),
              [ed, eu] = (0, M.useState)(void 0),
              em = (0, r.SFn)(null == ed ? void 0 : ed.chainKey),
              [ex, ep] = (0, M.useState)("0"),
              ef = (0, r.NrF)(ex, 500),
              [eh, ey] = (0, M.useState)("0"),
              [eg, eb] = (0, M.useState)("0"),
              [ev, ej] = (0, M.useState)(!1),
              [ew, eN] = (0, M.useState)(null),
              ek = (0, M.useRef)(null),
              eS = (0, w.pb)(),
              eC = (0, M.useCallback)(() => n(!0), []);
            (0, M.useEffect)(() => {
              (async function () {
                let e = await (0, N.OJ)({ fiat_currency: ei.toLowerCase(), crypto_currency: (null == ed ? void 0 : ed.id) ?? "atom_cosmos" });
                s(e.message), v(e.message.length > 0 ? e.message[0] : null);
              })();
            }, [ei, ed]),
              (0, M.useEffect)(() => {
                (async function () {
                  let e = await (0, N.vE)();
                  q(e.message);
                })();
              }, []),
              (0, M.useEffect)(() => {
                async function e() {
                  let e = ++ee.current;
                  try {
                    eN(null), ej(!0);
                    let t = (
                        await (0, N.zS)({
                          payment_method: (null == m ? void 0 : m.paymentTypeId) ?? "",
                          fiat_amount: new (x())(ef).toNumber(),
                          fiat_currency: ei.toLowerCase(),
                          crypto_currency: (null == ed ? void 0 : ed.id) ?? "atom_cosmos",
                          network: (null == ed ? void 0 : ed.origin) ?? "cosmos"
                        })
                      ).filter(e => (e.payout ?? 0) > 0),
                      a = t.reduce((e, t) => {
                        let a = null == F ? void 0 : F.find(e => e.id === t.ramp);
                        return a && e.push({ provider: a, quote: t }), e;
                      }, []);
                    if (e !== ee.current) return;
                    t.length > 0
                      ? (eb((t[0].payout ?? 0).toString()), W(a), B(a[0]))
                      : (eb("0"), eN("No onramp available for these details. Please select a different payment method, fiat or crypto"));
                  } catch (a) {
                    if (e !== ee.current) return;
                    (0, u.Tb)(a, { tags: $.rw });
                    let t = a instanceof Error ? a.message : "An error occurred";
                    t.toLowerCase().includes("timeout") ? eN("Request timed out. Unable to fetch quote.") : eN(t);
                  } finally {
                    e === ee.current && ej(!1);
                  }
                }
                ef && (null == m ? void 0 : m.paymentTypeId) && new (x())(ef).isGreaterThan("0") ? e() : eb("0");
              }, [ef, F, ed, ei, null == m ? void 0 : m.paymentTypeId]),
              (0, M.useEffect)(() => {
                if (ek.current) {
                  var e;
                  null === (e = ek.current) || void 0 === e || e.focus();
                }
              }, []),
              (0, M.useEffect)(() => {
                if (Q === b.q.AssetDetails) {
                  let e = eS[en.chain];
                  eu({
                    symbol: en.symbol,
                    chainName: e.chainName,
                    chainId: e.chainId,
                    chainSymbolImageUrl: e.chainSymbolImageUrl,
                    assetImg: en.img,
                    origin: e.chainName,
                    chainKey: e.key,
                    tags: null == en ? void 0 : en.tags
                  });
                }
              }, [en, eS, Q]),
              (0, M.useEffect)(() => {
                ed || er(!0);
              }, [ed]),
              (0, M.useEffect)(() => {
                (async function (e, t) {
                  if ("USD" !== t) {
                    let a = await (0, k.S3)({ from: t, to: "USD" }),
                      n = new (x())(e).multipliedBy(a);
                    ey(n.toString());
                  } else ey(e);
                })(ef, ei);
              }, [ef, ei]),
              (0, M.useEffect)(() => {
                (async function () {
                  if ((eN(null), parseFloat(eh) > 0)) {
                    let e = await (0, k.S3)({ from: "USD", to: ei });
                    10 > parseFloat(eh)
                      ? eN(`Amount should be at least ${(10 * e).toFixed(2)} ${ei}`)
                      : parseFloat(eh) > 1e4 && eN(`Amount exceeds your daily limit of ${(1e4 * e).toFixed(2)} ${ei}`);
                  }
                })();
              }, [eh, ei]),
              (0, M.useEffect)(() => {
                async function e() {
                  try {
                    let e = await (0, N.XH)();
                    ec(e.message.source.toUpperCase()), ep(e.message.amount.toString());
                  } catch (e) {
                    ec("USD"), ep("300");
                  }
                }
                ei || e();
              }, [ei]);
            let eA = (0, M.useCallback)(() => {
              var e, t;
              let a = {
                  apiKey: "pk_prod_01JXWAN8M081D3E7AX1XA1MGYM",
                  wallets: (null == ed ? void 0 : ed.id) + ":" + em,
                  skipTransactionScreen: !0,
                  txnType: "buy",
                  txnAmount: ex,
                  txnFiat: ei,
                  txnCrypto: (null == ed ? void 0 : ed.id) ?? "",
                  txnPaymentMethod: null == m ? void 0 : m.paymentTypeId,
                  txnOnramp: null == Y ? void 0 : Y.provider.id,
                  txnRedirect: !0
                },
                n = ((e = "01JXWAN8M1EEJKBTW2WGR9FMDY"), (t = `wallets=${a.wallets}`), j().HmacSHA256(t, e).toString(j().enc.Hex)),
                l = (0, I.l)(a),
                s = `https://buy.onramper.com?${l}&signature=${n}`;
              window.open(s, "_blank");
            }, [ex, em, null == ed ? void 0 : ed.id, ei, null == m ? void 0 : m.paymentTypeId, null == Y ? void 0 : Y.provider.id]);
            return (0, o.jsxs)(o.Fragment, {
              children: [
                ed
                  ? (0, o.jsxs)(o.Fragment, {
                      children: [
                        (0, o.jsxs)(f.m, {
                          children: [
                            (0, o.jsx)(i.X, { size: 36, className: "text-monochrome cursor-pointer p-2", onClick: () => ea(-1) }),
                            (0, o.jsx)(p.G, {
                              className: "absolute top-1/2 right-1/2 translate-x-1/2 -translate-y-1/2",
                              walletName: t,
                              showWalletAvatar: !0,
                              walletAvatar: e,
                              showDropdown: !0,
                              handleDropdownClick: eC
                            })
                          ]
                        }),
                        (0, o.jsxs)("div", {
                          className: "flex flex-col gap-3 p-6",
                          children: [
                            (0, o.jsxs)("div", {
                              className: "w-full bg-secondary-100 rounded-2xl p-5 flex flex-col gap-3",
                              children: [
                                (0, o.jsx)("div", {
                                  className: "flex justify-between items-center",
                                  children: (0, o.jsx)("p", { className: "text-muted-foreground text-sm font-medium !leading-[22.4px]", children: "You pay" })
                                }),
                                (0, o.jsxs)("div", {
                                  className: "flex rounded-2xl justify-between w-full items-center gap-2 h-[34px] p-[2px]",
                                  children: [
                                    (0, o.jsx)("input", {
                                      value: ex,
                                      onChange: e => {
                                        eN(null);
                                        let t = e.target.value,
                                          a = (0, X.Rv)(t);
                                        0 > parseFloat(a) ? eN("Please enter a valid positive number.") : ep(a);
                                      },
                                      type: "number",
                                      placeholder: "0",
                                      ref: ek,
                                      className: (0, z.cn)(
                                        "bg-transparent outline-none w-full text-left placeholder:font-bold placeholder:text-[24px] placeholder:text-monochrome font-bold !leading-[32.4px] caret-accent-blue",
                                        {
                                          "text-destructive-100": !!ew,
                                          "text-monochrome": !ew,
                                          "text-[24px]": ex.length < 12,
                                          "text-[22px]": ex.length >= 12 && ex.length < 15,
                                          "text-[20px]": ex.length >= 15 && ex.length < 18,
                                          "text-[18px]": ex.length >= 18
                                        }
                                      ),
                                      "aria-label": "buy pay amount input"
                                    }),
                                    (0, o.jsxs)("button", {
                                      className: (0, z.cn)(
                                        "flex justify-end items-center gap-2 shrink-0 py-1 px-1.5 rounded-[40px] bg-secondary-300 hover:bg-secondary-400"
                                      ),
                                      onClick: () => es(!0),
                                      "aria-label": "buy pay amount currency button",
                                      children: [
                                        (0, o.jsx)("img", {
                                          src: (0, L.b)(ei),
                                          className: "w-[24px] h-[24px] rounded-full",
                                          "aria-label": "buy pay amount currency image"
                                        }),
                                        (0, o.jsx)("p", {
                                          className: (0, z.cn)("dark:text-white-100 text-sm font-medium"),
                                          "aria-label": "buy pay amount currency text",
                                          children: ei
                                        }),
                                        (0, o.jsx)(c.p, { size: 14, className: "dark:text-white-100", "aria-label": "buy pay amount currency caret down" })
                                      ]
                                    })
                                  ]
                                }),
                                ew && (0, o.jsx)(y.Z, { size: "xs", className: "text-red-600 dark:text-red-300 pt-1.5", children: ew }),
                                (0, o.jsx)("div", {
                                  className: "flex gap-1.5 mt-1",
                                  children: [100, 500, 1e3].map(e =>
                                    (0, o.jsx)(
                                      "button",
                                      {
                                        onClick: () => ep(e.toString()),
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
                            (0, o.jsxs)("div", {
                              className: "w-full bg-secondary-100 rounded-2xl p-5 flex flex-col gap-3",
                              children: [
                                (0, o.jsx)("div", {
                                  className: "flex justify-between items-center",
                                  children: (0, o.jsx)("p", { className: "text-muted-foreground text-sm font-medium !leading-[22.4px]", children: "You get" })
                                }),
                                (0, o.jsxs)("div", {
                                  className: "flex rounded-2xl justify-between w-full items-center gap-2 h-[34px] p-[2px]",
                                  children: [
                                    ev
                                      ? (0, o.jsx)("div", {
                                          className: "w-[50px] h-full z-0",
                                          children: (0, o.jsx)(E.Z, { className: "rounded-full bg-gray-50 dark:bg-gray-800" })
                                        })
                                      : (0, o.jsx)("input", {
                                          value: 1e6 * parseFloat(eg) > 0 ? (0, r.LHZ)(eg, void 0, 6) : eg,
                                          placeholder: "0",
                                          className: (0, z.cn)(
                                            "bg-transparent outline-none w-full text-left placeholder:font-bold placeholder:text-[24px] placeholder:text-monochrome font-bold !leading-[32.4px] caret-accent-blue text-[24px] text-monochrome"
                                          ),
                                          readOnly: !0
                                        }),
                                    (0, o.jsxs)("button", {
                                      className: (0, z.cn)(
                                        "flex justify-end items-center gap-2 shrink-0 py-1 px-1.5 rounded-[40px] bg-secondary-300 hover:bg-secondary-400"
                                      ),
                                      onClick: () => er(!0),
                                      "aria-label": "buy get amount token button",
                                      children: [
                                        (0, o.jsx)("img", {
                                          src: null == ed ? void 0 : ed.assetImg,
                                          onError: (0, T._)(et),
                                          className: "w-[24px] h-[24px] rounded-full",
                                          "aria-label": "buy get amount token image"
                                        }),
                                        (0, o.jsx)("p", {
                                          className: (0, z.cn)("dark:text-white-100 text-sm font-medium"),
                                          "aria-label": "buy get amount token text",
                                          children: null == ed ? void 0 : ed.symbol
                                        }),
                                        (0, o.jsx)(c.p, { size: 14, className: "dark:text-white-100", "aria-label": "buy get amount token caret down" })
                                      ]
                                    })
                                  ]
                                })
                              ]
                            }),
                            m &&
                              (0, o.jsxs)("div", {
                                className: "w-full flex justify-between mt-2",
                                children: [
                                  (0, o.jsx)(y.Z, { size: "sm", color: "text-muted-foreground", className: "font-medium", children: "Pay using" }),
                                  (0, o.jsxs)("div", {
                                    className: (0, z.cn)("flex items-center gap-1", { "cursor-pointer": l && l.length > 1 }),
                                    onClick: () => {
                                      l && l.length > 1 && H(!0);
                                    },
                                    children: [
                                      (0, o.jsx)("img", { src: m.icon, className: "w-5 h-5" }),
                                      (0, o.jsx)(y.Z, { size: "sm", color: "text-monochrome", className: "font-medium", children: (0, X.MD)(m.name, 15, 3) }),
                                      l && l.length > 1 && (0, o.jsx)(c.p, { size: 14, className: "text-secondary-600" })
                                    ]
                                  })
                                ]
                              }),
                            Y &&
                              !ew &&
                              (0, o.jsxs)("div", {
                                className: "w-full flex justify-between mt-1",
                                children: [
                                  (0, o.jsx)(y.Z, { size: "sm", color: "text-muted-foreground", className: "font-medium", children: "Provider" }),
                                  ev
                                    ? (0, o.jsxs)("div", {
                                        className: "flex items-center gap-0.5",
                                        children: [
                                          (0, o.jsx)(h.T, { color: "text-green-600", className: "h-7 w-7" }),
                                          (0, o.jsx)(y.Z, {
                                            size: "sm",
                                            color: "text-monochrome",
                                            className: "font-medium",
                                            children: "Fetching best quote..."
                                          })
                                        ]
                                      })
                                    : (0, o.jsxs)("div", {
                                        className: (0, z.cn)("flex items-center gap-1", { "cursor-pointer": G && G.length > 1 }),
                                        onClick: () => {
                                          G && G.length > 1 && V(!0);
                                        },
                                        children: [
                                          (0, o.jsx)("img", { src: Y.provider.icon, className: "w-5 h-5" }),
                                          (0, o.jsx)(y.Z, { size: "sm", color: "text-monochrome", className: "font-medium", children: Y.provider.displayName }),
                                          G && G.length > 1 && (0, o.jsx)(c.p, { size: 14, className: "text-secondary-600" })
                                        ]
                                      })
                                ]
                              })
                          ]
                        }),
                        (0, o.jsx)("div", {
                          className: "w-full p-4 mt-auto sticky bottom-0 bg-secondary-100 ",
                          children: (0, o.jsx)(g.zx, {
                            className: (0, z.cn)("w-full", { "!bg-red-300 text-white-100": ew }),
                            onClick: eA,
                            disabled: !new (x())(eg).isGreaterThan(0) || ev || (0, Z.isString)(ew),
                            "aria-label": "buy button in buy flow",
                            children: new (x())(eg).isGreaterThan(0)
                              ? (0, o.jsxs)("div", {
                                  className: "flex items-center gap-1.5",
                                  children: [
                                    (0, o.jsx)(d.O, { size: 20, weight: "bold" }),
                                    (0, o.jsx)("span", { "aria-label": "buy button text in buy flow", children: "Buy" })
                                  ]
                                })
                              : (0, o.jsx)("span", { "aria-label": "buy button text in buy flow", children: "Enter amount" })
                          })
                        })
                      ]
                    })
                  : null,
                (0, o.jsx)(O.Z, {
                  isVisible: el,
                  selectedCurrency: ei,
                  onClose: () => es(!1),
                  onCurrencySelect: e => {
                    ec(e), es(!1), ek.current && ek.current.focus();
                  }
                }),
                (0, o.jsx)(_.Z, {
                  isVisible: a,
                  onClose: () => {
                    n(!1), ea("/home");
                  },
                  title: "Your Wallets"
                }),
                (0, o.jsx)(P.Z, {
                  isVisible: eo,
                  selectedAsset: ed,
                  onClose: () => {
                    ed ? er(!1) : ea(-1);
                  },
                  onAssetSelect: e => {
                    eu(e), v(null), er(!1), ek.current && ek.current.focus();
                  }
                }),
                l &&
                  m &&
                  (0, o.jsx)(R.Z, {
                    isVisible: J,
                    onClose: () => H(!1),
                    onPaymentSelect: e => {
                      v(e), H(!1);
                    },
                    paymentMethods: l,
                    selectedPaymentMethod: m
                  }),
                G &&
                  Y &&
                  (0, o.jsx)(U.Z, {
                    isVisible: K,
                    onClose: () => V(!1),
                    onProviderSelect: e => {
                      var t;
                      B(e), eb((null === (t = e.quote.payout) || void 0 === t ? void 0 : t.toString()) ?? "0"), V(!1);
                    },
                    providers: G,
                    selectedProvider: Y,
                    asset: ed
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
