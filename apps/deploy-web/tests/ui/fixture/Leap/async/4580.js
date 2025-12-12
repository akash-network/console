!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      n = new e.Error().stack;
    n &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[n] = "5fe428a3-d19e-4266-b958-5205ebd4bd06"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-5fe428a3-d19e-4266-b958-5205ebd4bd06"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.23.1" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["4580"],
  {
    42311: function (e, n, i) {
      i.d(n, { j: () => c });
      var t = i(52322),
        o = i(75377),
        l = i(57124),
        a = i(30464);
      i(2784);
      var s = i(70514),
        r = i(49409);
      function c(e) {
        let {
            title: n,
            subtitle: i,
            isRounded: c,
            imgSrc: d,
            TokenType: m,
            onToggleChange: u,
            isToggleChecked: x,
            onDeleteClick: g,
            className: h,
            imageClassName: f
          } = e,
          v = (0, l.a)();
        return (0, t.jsx)(o.GenericCard, {
          title: n,
          subtitle: (0, t.jsxs)("p", { children: [i, " ", m ?? null] }),
          isRounded: c,
          size: "md",
          img: (0, t.jsx)("img", { src: d ?? v, className: (0, s.cn)("h-8 w-8 mr-3", f), onError: (0, r._)(v) }),
          icon: (0, t.jsxs)("div", {
            className: "flex items-center gap-[8px]",
            children: [
              (0, t.jsx)(o.Toggle, { checked: x, onChange: u }),
              (0, t.jsx)("div", { className: "h-[36px] w-[0.25px] bg-gray-200 dark:bg-gray-600" }),
              (0, t.jsx)("button", {
                className: "cursor-pointer",
                onClick: g,
                "aria-label": "delete token button in manage tokens flow",
                children: (0, t.jsx)("img", { className: "invert dark:invert-0", src: a.r.Misc.DeleteRed, alt: "remove" })
              })
            ]
          }),
          className: h
        });
      }
    },
    53299: function (e, n, i) {
      i.d(n, { Z: () => r });
      var t = i(52322),
        o = i(43166),
        l = i(85027),
        a = i(69816);
      i(2784);
      var s = i(10289);
      let r = e => {
        let { title: n, onBack: i } = e,
          r = (0, s.s0)();
        return (0, t.jsxs)(l.m, {
          className: "bg-secondary-50 border-b border-secondary-300",
          children: [
            (0, t.jsx)(o.X, {
              className: "size-9 p-2 cursor-pointer text-muted-foreground hover:text-foreground",
              onClick: () => {
                i ? i() : r(-1);
              }
            }),
            (0, t.jsx)(a.Z, { className: "text-[18px] font-bold !leading-6", color: "text-monochrome", children: n ?? "Manage tokens" }),
            (0, t.jsx)("div", { className: "w-9 h-9" })
          ]
        });
      };
    },
    43922: function (e, n, i) {
      i.d(n, { X: () => N });
      var t = i(52322),
        o = i(4370),
        l = i(2784),
        a = i(19623),
        s = i(7474),
        r = i(42799),
        c = i(25167),
        d = i(41172),
        m = i(75958),
        u = i(70514),
        x = i(71198),
        g = i(42311),
        h = i(19326),
        f = i(50600);
      let v = (0, m.Pi)(e => {
          let {
              index: n,
              token: i,
              tokensLength: o,
              handleToggleChange: a,
              fetchedTokens: s,
              onDeleteClick: r,
              betaCW20DenomsStore: c,
              disabledCW20DenomsStore: m,
              enabledCW20DenomsStore: v,
              betaERC20DenomsStore: b
            } = e,
            { betaCW20Denoms: p } = c,
            { betaERC20Denoms: j } = b,
            D = m.disabledCW20Denoms,
            k = v.enabledCW20Denoms,
            { getExplorerAccountUrl: C } = (0, d.JVF)({}),
            y = n === o - 1,
            w = (0, x.MD)((null == i ? void 0 : i.name) ?? (0, x.kC)(i.coinDenom.toLowerCase()) ?? "", 7, 4),
            M = (0, x.MD)(i.coinDenom, 4, 4),
            N = C(i.coinMinimalDenom),
            T = (0, l.useMemo)(() => {
              let e = (0, t.jsx)(f.i, { type: "native", className: "bg-[#ff9f0a1a] text-orange-500" });
              return (
                p[i.coinMinimalDenom]
                  ? (e = (0, t.jsx)(f.i, { type: "cw20", className: "bg-[#29A8741A] text-green-600" }))
                  : j[i.coinMinimalDenom]
                    ? (e = (0, t.jsx)(f.i, { type: "erc20", className: "bg-[#A52A2A1A] text-[#a52a2a]" }))
                    : i.coinMinimalDenom.trim().toLowerCase().startsWith("factory") &&
                      (e = (0, t.jsx)(f.i, { type: "factory", className: "bg-[#0AB8FF1A] text-teal-500" })),
                e
              );
            }, [p, j, i.coinMinimalDenom]),
            S = (0, l.useCallback)(
              e => {
                e.stopPropagation(), window.open(N, "_blank");
              },
              [N]
            );
          return (0, t.jsxs)(t.Fragment, {
            children: [
              (0, t.jsx)(g.j, {
                title: (0, t.jsx)(h.t, { title: w, showRedirection: !!p[i.coinMinimalDenom] && !!N, handleRedirectionClick: S }),
                subtitle: M,
                isRounded: y,
                imgSrc: i.icon,
                TokenType: T,
                isToggleChecked: !D.includes(i.coinMinimalDenom) && !s.includes(i.coinMinimalDenom) && k.includes(i.coinMinimalDenom),
                onToggleChange: e => a(e, i.coinMinimalDenom),
                onDeleteClick: () => r(i),
                className: (0, u.cn)("!bg-secondary-100 hover:!bg-secondary-200 rounded-xl mb-4 w-full", 0 === n ? "mt-6" : ""),
                imageClassName: "!h-10 !w-10 !rounded-full"
              }),
              y ? (0, t.jsx)("div", { className: "h-[1px] bg-transparent mt-6" }) : null
            ]
          });
        }),
        b = e => {
          let {
            filteredManuallyAddedTokens: n,
            handleToggleChange: i,
            fetchedTokens: o,
            onDeleteClick: l,
            fetchingContract: d,
            handleAddNewTokenClick: m,
            searchedText: u
          } = e;
          return !0 === d
            ? (0, t.jsx)("div", { className: "flex items-center justify-center flex-1", children: (0, t.jsx)(a.T, { color: "#29a874" }) })
            : !1 === d && 0 === n.length
              ? (0, t.jsx)(c.Pi, { onAddTokenClick: m, searchedText: u })
              : (0, t.jsx)("div", {
                  className: "w-full px-6 flex-1",
                  children: (0, t.jsx)(s.OO, {
                    style: { flexGrow: "1", width: "100%" },
                    data: n,
                    itemContent: (e, a) =>
                      (0, t.jsx)(
                        v,
                        {
                          index: e,
                          token: a,
                          tokensLength: n.length,
                          handleToggleChange: i,
                          fetchedTokens: o,
                          onDeleteClick: l,
                          betaCW20DenomsStore: r.Xy,
                          disabledCW20DenomsStore: r.eV,
                          enabledCW20DenomsStore: r.bI,
                          betaERC20DenomsStore: r.EM
                        },
                        `${(null == a ? void 0 : a.coinMinimalDenom) ?? e}`
                      )
                  })
                });
        };
      var p = i(78344),
        j = i(75377),
        D = i(74229),
        k = i(30464),
        C = i(49409);
      let y = (0, m.Pi)(e => {
          let { token: n, tokensLength: i, index: o, handleToggleChange: a, cw20DenomsStore: s, autoFetchedCW20DenomsStore: r } = e,
            { cw20Denoms: c } = s,
            { autoFetchedCW20Denoms: m } = r,
            g = (0, D.a1)(),
            { theme: f } = (0, j.useTheme)(),
            { getExplorerAccountUrl: v } = (0, d.JVF)({}),
            b = (0, l.useMemo)(() => ({ ...c, ...m }), [c, m]),
            p = o === i - 1,
            y = (0, x.MD)((null == n ? void 0 : n.name) ?? (0, x.kC)(n.coinDenom.toLowerCase()) ?? "", 7, 4),
            w = (0, x.MD)(n.coinDenom, 4, 4),
            M = v(n.coinMinimalDenom),
            N = (0, l.useCallback)(
              e => {
                e.stopPropagation(), window.open(M, "_blank");
              },
              [M]
            );
          return (0, t.jsxs)(t.Fragment, {
            children: [
              (0, t.jsx)(j.GenericCard, {
                title: (0, t.jsx)(h.t, {
                  title: y,
                  showRedirection: !!(null == b ? void 0 : b[null == n ? void 0 : n.coinMinimalDenom]) && !!M,
                  handleRedirectionClick: N
                }),
                subtitle: w,
                isRounded: p,
                size: "md",
                img: (0, t.jsxs)("div", {
                  className: "relative mr-3 !h-10 !w-10 !shrink-0 flex items-center justify-center",
                  children: [
                    (0, t.jsx)("img", { src: n.icon ?? g, className: "h-8 rounded-full w-8", onError: (0, C._)(g) }),
                    n.verified &&
                      (0, t.jsxs)("div", {
                        className: "absolute group -bottom-[2px] -right-[2px]",
                        children: [
                          (0, t.jsx)("img", {
                            src: f === j.ThemeName.DARK ? k.r.Misc.VerifiedWithBgStarDark : k.r.Misc.VerifiedWithBgStar,
                            alt: "verified-token",
                            className: "h-4 w-4"
                          }),
                          (0, t.jsx)("div", {
                            className:
                              "group-hover:!block hidden absolute bottom-0 right-0 translate-x-full bg-gray-200 dark:bg-gray-800 px-3 py-2 rounded-lg text-xs dark:text-white-100",
                            children: "Whitelisted"
                          })
                        ]
                      })
                  ]
                }),
                icon: (0, t.jsx)("div", {
                  className: "flex items-center gap-[8px]",
                  children: (0, t.jsx)(j.Toggle, { checked: n.enabled, onChange: e => a(e, n.coinMinimalDenom) })
                }),
                className: (0, u.cn)("!bg-secondary-100 hover:!bg-secondary-200 rounded-xl mb-4 w-full !h-[66px]", 0 === o ? "mt-6" : "")
              }),
              p ? (0, t.jsx)("div", { className: "h-[1px] bg-transparent mt-6" }) : null
            ]
          });
        }),
        w = e => {
          let { filteredSupportedTokens: n, handleToggleChange: i, fetchingContract: o, handleAddNewTokenClick: l, searchedText: d } = e;
          return !0 === o
            ? (0, t.jsx)("div", { className: "flex items-center justify-center flex-1", children: (0, t.jsx)(a.T, { color: "#29a874" }) })
            : !1 === o && 0 === n.length
              ? (0, t.jsx)(c.Pi, { onAddTokenClick: l, searchedText: d })
              : (0, t.jsx)("div", {
                  className: "w-full px-6 flex-1",
                  children: (0, t.jsx)(s.OO, {
                    style: { flexGrow: "1", width: "100%" },
                    data: n,
                    itemContent: (e, o) =>
                      (0, t.jsx)(
                        y,
                        {
                          activeChainStore: p.J,
                          cw20DenomsStore: r.Sg,
                          autoFetchedCW20DenomsStore: r.PZ,
                          token: o,
                          tokensLength: n.length,
                          index: e,
                          handleToggleChange: i
                        },
                        `${o.coinMinimalDenom}`
                      )
                  })
                });
        },
        M = [
          { label: "Supported", value: "supported" },
          { label: "Manually added", value: "manually-added" }
        ],
        N = e => {
          let {
            activeTab: n,
            setActiveTab: i,
            filteredSupportedTokens: l,
            filteredManuallyAddedTokens: a,
            fetchedTokens: s,
            handleToggleChange: r,
            onDeleteClick: c,
            handleAddNewTokenClick: d,
            searchedText: m,
            fetchingContract: u
          } = e;
          return (0, t.jsxs)(t.Fragment, {
            children: [
              (0, t.jsx)("div", {
                className: "h-[33px] border-b shrink-0 px-6 border-secondary-300 flex flex-row justify-start items-center gap-5",
                children: M.map(e =>
                  (0, t.jsx)(
                    "button",
                    {
                      className: `font-medium text-center text-sm !leading-[22px] h-full transition-colors duration-200 flex justify-center items-center ${e.value === n ? "text-accent-green" : "text-muted-foreground"}`,
                      onClick: () => {
                        i(e.value);
                      },
                      children: (0, t.jsxs)("div", {
                        className: "relative w-fit px-2 pb-3",
                        children: [
                          e.label,
                          e.value === n &&
                            (0, t.jsx)(o.E.div, { className: "absolute bottom-0 left-0 right-0 h-0.5 bg-primary z-10", layoutId: "active-tab-indicator" })
                        ]
                      })
                    },
                    e.value
                  )
                )
              }),
              "supported" === n
                ? (0, t.jsx)(w, { filteredSupportedTokens: l, handleToggleChange: r, fetchingContract: u, handleAddNewTokenClick: d, searchedText: m })
                : (0, t.jsx)(b, {
                    filteredManuallyAddedTokens: a,
                    handleToggleChange: r,
                    fetchedTokens: s,
                    onDeleteClick: c,
                    fetchingContract: u,
                    handleAddNewTokenClick: d,
                    searchedText: m
                  })
            ]
          });
        };
    },
    19326: function (e, n, i) {
      i.d(n, { t: () => l });
      var t = i(52322),
        o = i(26007);
      function l(e) {
        let { title: n, showRedirection: i, handleRedirectionClick: l } = e;
        return (0, t.jsxs)("div", {
          className: "flex gap-1 items-center font-bold dark:text-white-100",
          children: [
            (0, t.jsx)("span", { className: "shrink-0", children: n }),
            i &&
              (0, t.jsx)("button", {
                onClick: l,
                className: "!text-md dark:text-gray-400 !leading-4 flex items-center",
                children: (0, t.jsx)(o.O, { size: 16 })
              })
          ]
        });
      }
      i(2784);
    },
    50600: function (e, n, i) {
      i.d(n, { i: () => a });
      var t = i(52322),
        o = i(72779),
        l = i.n(o);
      function a(e) {
        let { className: n, type: i } = e;
        return (0, t.jsx)("span", { className: l()("px-[6px] py-[1px] text-[10px] text-center ml-[2px] rounded-xl", n), children: i });
      }
      i(2784);
    },
    25167: function (e, n, i) {
      i.d(n, { Pi: () => x, ub: () => d, iv: () => b.i, jz: () => t.j });
      var t = i(42311),
        o = i(52322),
        l = i(96217),
        a = i(91486),
        s = i(30464),
        r = i(75958),
        c = i(2784);
      let d = (0, r.Pi)(e => {
        let {
            isOpen: n,
            onClose: i,
            tokenToDelete: t,
            activeChainStore: r,
            chainInfosStore: d,
            betaNativeDenomsStore: m,
            betaERC20DenomsStore: u,
            betaCW20DenomsStore: x
          } = e,
          { activeChain: g } = r,
          { chainInfos: h } = d,
          f = null == h ? void 0 : h[g],
          { betaNativeDenoms: v } = m,
          { betaCW20Denoms: b } = x,
          { betaERC20Denoms: p } = u,
          j = (0, c.useMemo)(() => {
            let e = (null == t ? void 0 : t.coinDenom) ?? "";
            return e.slice(0, 1).toUpperCase() + e.slice(1).toLowerCase();
          }, [null == t ? void 0 : t.coinDenom]),
          D = (0, c.useCallback)(() => {
            t && v[(null == t ? void 0 : t.coinMinimalDenom) ?? ""]
              ? m.removeBetaNativeDenoms(null == t ? void 0 : t.coinMinimalDenom, g)
              : t && b[(null == t ? void 0 : t.coinMinimalDenom) ?? ""]
                ? x.removeBetaCW20Denoms(null == t ? void 0 : t.coinMinimalDenom, g)
                : t && p[(null == t ? void 0 : t.coinMinimalDenom) ?? ""] && u.removeBetaERC20Denoms(null == t ? void 0 : t.coinMinimalDenom, g),
              i();
          }, [t, v, b, p, i, m, g, x, u]);
        return (0, o.jsxs)(l.Z, {
          title: "Delete Token",
          onClose: i,
          className: "p-6",
          isOpen: n,
          children: [
            (0, o.jsxs)("div", {
              className: "rounded-2xl bg-secondary-100 p-6 flex flex-col items-center text-center",
              children: [
                (0, o.jsx)("div", {
                  className: "rounded-full bg-destructive-100 p-[18px] w-fit flex",
                  children: (0, o.jsx)("img", { src: s.r.Misc.DeleteTokenSheetBin })
                }),
                (0, o.jsx)("div", { className: "font-bold text-gray-800 dark:text-white-100 text-base mt-4", children: "Confirm Delete?" }),
                (0, o.jsxs)("div", {
                  className: "text-gray-400 font-medium text-sm mt-5",
                  children: ["Are you sure you want to delete your manually added “", j, "” token on", " ", f.chainName, "?"]
                })
              ]
            }),
            (0, o.jsxs)("div", {
              className: "flex flex-row justify-between mt-6 gap-3",
              children: [
                (0, o.jsx)(a.zx, {
                  type: "button",
                  className: "h-[48px] flex-1 !bg-secondary-100 hover:!bg-secondary-200",
                  onClick: i,
                  "aria-label": "cancel delete token button in manage tokens flow",
                  children: (0, o.jsx)("span", { "aria-label": "cancel delete token button text in manage tokens flow", children: "Cancel" })
                }),
                (0, o.jsx)(a.zx, {
                  type: "button",
                  className: "h-[48px] flex-1 cursor-pointer !bg-destructive-100 hover:!bg-destructive-400",
                  onClick: D,
                  "aria-label": "confirm delete token button in manage tokens flow",
                  children: (0, o.jsx)("span", { "aria-label": "confirm delete token button text in manage tokens flow", children: "Confirm" })
                })
              ]
            })
          ]
        });
      });
      var m = i(75377),
        u = i(27963);
      function x(e) {
        let { onAddTokenClick: n, searchedText: i } = e,
          t = (0, o.jsxs)("p", {
            className: "text-[13px]",
            children: [
              "Or manually add token data",
              " ",
              (0, o.jsx)("button", {
                className: "border-none bg-transparent hover:underline cursor-pointer font-bold text-sm",
                style: { color: "#ad4aff" },
                onClick: () => n(!1),
                children: "here"
              })
            ]
          });
        return (
          i &&
            (t = (0, o.jsxs)("p", {
              className: "text-[13px]",
              children: [
                "Try manually adding tokens instead",
                (0, o.jsx)(m.Buttons.Generic, {
                  onClick: () => n(!0),
                  className: "max-w-[200px] text-gray-900 mt-[16px]",
                  style: { boxShadow: "none" },
                  children: "Add Tokens Manually"
                })
              ]
            })),
          (0, o.jsx)(u.S, {
            isRounded: !0,
            subHeading: t,
            heading: (0, o.jsx)("p", { className: "text-[15px]", children: i ? "No results found" : "Search for any token" }),
            classname: "flex-1 justify-center pt-0",
            src: s.r.Misc.Explore
          })
        );
      }
      var g = i(41172),
        h = i(19326);
      (0, r.Pi)(e => {
        let {
            tokens: n,
            handleToggleChange: i,
            fetchedTokens: l,
            onDeleteClick: a,
            betaCW20DenomsStore: s,
            disabledCW20DenomsStore: r,
            enabledCW20DenomsStore: d,
            betaERC20DenomsStore: u
          } = e,
          { betaCW20Denoms: x } = s,
          { betaERC20Denoms: f } = u,
          { disabledCW20Denoms: v } = r,
          { enabledCW20Denoms: p } = d,
          { getExplorerAccountUrl: j } = (0, g.JVF)({});
        return (0, o.jsxs)("div", {
          children: [
            (0, o.jsx)("div", { className: "font-bold text-sm text-gray-600 dark:text-gray-200 mb-2", children: "Manually added tokens" }),
            (0, o.jsx)("div", {
              className: "rounded-2xl flex flex-col items-center justify-center dark:bg-gray-900 bg-white-100 overflow-hidden",
              children: n.map((e, n, s) => {
                let r = n === s.length - 1,
                  d = (0, o.jsx)(b.i, { type: "native", className: "bg-[#ff9f0a1a] text-orange-500" }),
                  u = (0, g.MDB)((null == e ? void 0 : e.name) ?? (0, g.kC2)(e.coinDenom.toLowerCase()), 7, 4),
                  D = (0, g.MDB)(e.coinDenom, 4, 4);
                x[e.coinMinimalDenom]
                  ? (d = (0, o.jsx)(b.i, { type: "cw20", className: "bg-[#29A8741A] text-green-600" }))
                  : f[e.coinMinimalDenom]
                    ? (d = (0, o.jsx)(b.i, { type: "erc20", className: "bg-[#A52A2A1A] text-[#a52a2a]" }))
                    : e.coinMinimalDenom.trim().toLowerCase().startsWith("factory") &&
                      (d = (0, o.jsx)(b.i, { type: "factory", className: "bg-[#0AB8FF1A] text-teal-500" }));
                let k = j(e.coinMinimalDenom);
                return (0, o.jsxs)(
                  c.Fragment,
                  {
                    children: [
                      (0, o.jsx)(t.j, {
                        title: (0, o.jsx)(h.t, {
                          title: u,
                          showRedirection: !!x[e.coinMinimalDenom] && !!k,
                          handleRedirectionClick: e => {
                            e.stopPropagation(), window.open(k, "_blank");
                          }
                        }),
                        subtitle: D,
                        isRounded: r,
                        imgSrc: e.icon,
                        TokenType: d,
                        isToggleChecked: !v.includes(e.coinMinimalDenom) && !l.includes(e.coinMinimalDenom) && p.includes(e.coinMinimalDenom),
                        onToggleChange: n => i(n, e.coinMinimalDenom),
                        onDeleteClick: () => a(e)
                      }),
                      r ? null : (0, o.jsx)(m.CardDivider, {})
                    ]
                  },
                  `${e.coinMinimalDenom}-${n}`
                );
              })
            })
          ]
        });
      });
      var f = i(57124),
        v = i(49409);
      (0, r.Pi)(e => {
        let { tokens: n, handleToggleChange: i, activeChainStore: t, cw20DenomsStore: l, autoFetchedCW20DenomsStore: a } = e,
          { activeChain: r } = t,
          { denoms: d } = l,
          u = null == d ? void 0 : d[r],
          { autoFetchedCW20Denoms: x } = a,
          b = (0, f.a)(),
          { theme: p } = (0, m.useTheme)(),
          { getExplorerAccountUrl: j } = (0, g.JVF)({}),
          D = (0, c.useMemo)(() => ({ ...u, ...x }), [u, x]);
        return (0, o.jsxs)("div", {
          children: [
            (0, o.jsx)("div", { className: "font-bold text-sm text-gray-600 dark:text-gray-200 mb-2", children: "Supported tokens" }),
            (0, o.jsx)("div", {
              className: "rounded-2xl flex flex-col items-center justify-center dark:bg-gray-900 bg-white-100 overflow-hidden",
              children: n.map((e, n, t) => {
                let l = n === t.length - 1,
                  a = (0, g.MDB)((null == e ? void 0 : e.name) ?? (0, g.kC2)(e.coinDenom.toLowerCase()), 7, 4),
                  r = (0, g.MDB)(e.coinDenom, 4, 4),
                  d = j(e.coinMinimalDenom);
                return (0, o.jsxs)(
                  c.Fragment,
                  {
                    children: [
                      (0, o.jsx)(m.GenericCard, {
                        title: (0, o.jsx)(h.t, {
                          title: a,
                          showRedirection: !!(null == D ? void 0 : D[null == e ? void 0 : e.coinMinimalDenom]) && !!d,
                          handleRedirectionClick: e => {
                            e.stopPropagation(), window.open(d, "_blank");
                          }
                        }),
                        subtitle: r,
                        isRounded: l,
                        size: "md",
                        img: (0, o.jsxs)("div", {
                          className: "relative mr-3",
                          children: [
                            (0, o.jsx)("img", { src: e.icon ?? b, className: "h-7 w-7", onError: (0, v._)(b) }),
                            e.verified &&
                              (0, o.jsxs)("div", {
                                className: "absolute group -bottom-[5px] -right-[5px]",
                                children: [
                                  (0, o.jsx)("img", {
                                    src: p === m.ThemeName.DARK ? s.r.Misc.VerifiedWithBgStarDark : s.r.Misc.VerifiedWithBgStar,
                                    alt: "verified-token",
                                    className: "h-4 w-4"
                                  }),
                                  (0, o.jsx)("div", {
                                    className:
                                      "group-hover:!block hidden absolute bottom-0 right-0 translate-x-full bg-gray-200 dark:bg-gray-800 px-3 py-2 rounded-lg text-xs dark:text-white-100",
                                    children: "Whitelisted"
                                  })
                                ]
                              })
                          ]
                        }),
                        icon: (0, o.jsx)("div", {
                          className: "flex items-center gap-[8px]",
                          children: (0, o.jsx)(m.Toggle, { checked: e.enabled, onChange: n => i(n, e.coinMinimalDenom) })
                        })
                      }),
                      l ? null : (0, o.jsx)(m.CardDivider, {})
                    ]
                  },
                  `${e.coinMinimalDenom}-${n}`
                );
              })
            })
          ]
        });
      });
      var b = i(50600);
    },
    7381: function (e, n, i) {
      i.a(e, async function (e, t) {
        try {
          i.r(n), i.d(n, { default: () => N });
          var o = i(52322),
            l = i(41172),
            a = i(29049),
            s = i(92642),
            r = i(84916),
            c = i(80075),
            d = i(75958),
            m = i(2784),
            u = i(10289),
            x = i(78344),
            g = i(26245),
            h = i(36321),
            f = i(42799),
            v = i(30809),
            b = i(53345),
            p = i(72565),
            j = i.n(p),
            D = i(25167),
            k = i(53299),
            C = i(43922),
            y = i(8789),
            w = e([g]);
          g = (w.then ? (await w)() : w)[0];
          let M = (0, d.Pi)(() => {
              let { activeChain: e } = x.J,
                { selectedNetwork: n } = v.i,
                { disabledCW20Denoms: i } = f.eV,
                { enabledCW20Denoms: t } = f.bI,
                d = f.Xy.betaCW20Denoms,
                { cw20Denoms: p } = f.Sg,
                { interactedDenoms: w } = f.GC,
                M = f.vk.betaNativeDenoms,
                N = f.EM.betaERC20Denoms,
                { erc20Denoms: T } = f.QH,
                { autoFetchedCW20Denoms: S } = f.PZ,
                { cw20Tokens: A } = g.Sz,
                { erc20Tokens: _ } = g.g5,
                E = (0, u.s0)(),
                { lcdUrl: R } = (0, l.U9i)(),
                [W, L] = (0, m.useState)(!1),
                [B, I] = (0, m.useState)(),
                [P, F] = (0, m.useState)(""),
                [O, z] = (0, m.useState)([]),
                [V, G] = (0, m.useState)(!1),
                $ = (0, m.useRef)(),
                [U, J] = (0, m.useState)([]),
                X = (0, m.useRef)(null),
                [Z, H] = (0, m.useState)("supported"),
                K = (0, m.useMemo)(() => {
                  var e, n, o;
                  let l = [],
                    a =
                      (null === (e = Object.values(p)) || void 0 === e
                        ? void 0
                        : e.map(e => {
                            let n = null == A ? void 0 : A.find(n => n.coinMinimalDenom === e.coinMinimalDenom);
                            return {
                              ...e,
                              enabled:
                                n && "0" !== String(null == n ? void 0 : n.amount)
                                  ? !(null == i ? void 0 : i.includes(e.coinMinimalDenom))
                                  : null == t
                                    ? void 0
                                    : t.includes(e.coinMinimalDenom),
                              verified: !0
                            };
                          })) ?? [],
                    s =
                      (null === (n = Object.values(S)) || void 0 === n
                        ? void 0
                        : n.map(e => ({ ...e, enabled: null == t ? void 0 : t.includes(e.coinMinimalDenom), verified: !1 }))) ?? [],
                    r =
                      (null === (o = Object.values(T)) || void 0 === o
                        ? void 0
                        : o.map(e => {
                            let n = null == _ ? void 0 : _.find(n => n.coinMinimalDenom === e.coinMinimalDenom);
                            return {
                              ...e,
                              enabled:
                                n && "0" !== String(null == n ? void 0 : n.amount)
                                  ? !(null == i ? void 0 : i.includes(e.coinMinimalDenom))
                                  : null == t
                                    ? void 0
                                    : t.includes(e.coinMinimalDenom),
                              verified: !0
                            };
                          })) ?? [];
                  return (l = [...l, ...a, ...s, ...r]);
                }, [S, p, A, i, t, T, _]);
              (0, m.useEffect)(
                () =>
                  (0, c.EH)(() => {
                    let e = [];
                    M && (e = [...e, ...(Object.values(M) ?? [])]),
                      d && (e = [...e, ...(Object.values(d) ?? [])]),
                      N && (e = [...e, ...(Object.values(N) ?? [])]),
                      J(e);
                  }),
                [d, N, M]
              ),
                (0, m.useEffect)(() => {
                  z(e => (e ?? []).filter(e => !i.includes(e)));
                }, [i.length]);
              let Q = (0, m.useMemo)(() => {
                  var e;
                  return (
                    (null == U
                      ? void 0
                      : null ===
                            (e = U.filter(e => {
                              let n = P.trim().toLowerCase();
                              return !!(
                                (e.name ?? "").toLowerCase().includes(n) ||
                                e.coinDenom.toLowerCase().includes(n) ||
                                e.coinMinimalDenom.toLowerCase().includes(n)
                              );
                            })) || void 0 === e
                        ? void 0
                        : e.sort((e, n) => {
                            let i = e.coinDenom.toUpperCase(),
                              t = n.coinDenom.toUpperCase();
                            return i < t ? -1 : +(i < t);
                          })) ?? []
                  );
                }, [U, P]),
                Y = (0, m.useMemo)(() => {
                  var e;
                  return (
                    (null == K
                      ? void 0
                      : null ===
                            (e = K.filter(e => {
                              let n = P.trim().toLowerCase();
                              return !!(
                                (e.name ?? "").toLowerCase().includes(n) ||
                                e.coinDenom.toLowerCase().includes(n) ||
                                e.coinMinimalDenom.toLowerCase().includes(n)
                              );
                            })) || void 0 === e
                        ? void 0
                        : e.sort((e, n) => {
                            let i = e.enabled,
                              t = n.enabled;
                            if (i && !t) return -1;
                            if (!i && t) return 1;
                            let o = !!((null == p ? void 0 : p[e.coinMinimalDenom]) || (null == T ? void 0 : T[e.coinMinimalDenom])),
                              l = !!((null == p ? void 0 : p[n.coinMinimalDenom]) || (null == T ? void 0 : T[n.coinMinimalDenom]));
                            return o && !l ? -1 : !o && l ? 1 : (0, y.j)(e, n);
                          })) ?? []
                  );
                }, [K, P, p, T]);
              (0, m.useEffect)(() => {
                0 !== P.length &&
                  0 === Y.length &&
                  0 === Q.length &&
                  (clearTimeout($.current),
                  ($.current = setTimeout(async () => {
                    try {
                      G(!0);
                      let n = await (0, b.s)(R ?? "", P);
                      "string" != typeof n &&
                        n.symbol &&
                        (z(e => [...e, P]),
                        J(i => [
                          ...i,
                          { name: n.name, coinDecimals: n.decimals, coinMinimalDenom: P, coinDenom: n.symbol, icon: "", coinGeckoId: "", chain: e }
                        ]));
                    } catch (e) {
                      (0, s.Tb)(e, {
                        tags: {
                          errorType: "fetch_contract_info_error",
                          source: "manage_tokens",
                          severity: "error",
                          errorName: e instanceof Error ? e.name : "FetchContractInfoError"
                        },
                        fingerprint: ["manage_tokens", "fetch_contract_info_error"],
                        level: "error",
                        contexts: { transaction: { type: "manage_tokens", errorMessage: e instanceof Error ? e.message : String(e) } },
                        extra: { searchedText: P, lcdUrl: R }
                      });
                    } finally {
                      G(!1);
                    }
                  }, 100)));
              }, [P, Q.length, R, e, Y.length]);
              let q = (0, m.useCallback)(
                  function () {
                    let e = arguments.length > 0 && void 0 !== arguments[0] && arguments[0],
                      n = j().extension.getViews({ type: "popup" });
                    if (0 === n.length) {
                      let n = { replace: !0 };
                      e && (n.state = { coinMinimalDenom: P }), E("/add-token", n);
                    } else window.open(j().runtime.getURL("index.html#/add-token"));
                  },
                  [E, P]
                ),
                ee = (0, m.useCallback)(
                  async (o, l) => {
                    w.some(e => e === l) || (await f.GC.setInteractedDenoms([...w, l]));
                    let a = [],
                      s = [],
                      r = !1;
                    if (o) {
                      (a = i.filter(e => e !== l)), (s = [...t, l]);
                      let o = U.find(e => e.coinMinimalDenom === l);
                      O.includes(l) && o && (r = !0), "aggregated" !== e && g.Sz.fetchCW20TokenBalances(e, n, [l]);
                    } else (a = [...i, l]), (s = t.filter(e => e !== l));
                    if ((await f.eV.setDisabledCW20Denoms(a), await f.bI.setEnabledCW20Denoms(s), r)) {
                      let n = U.find(e => e.coinMinimalDenom === l),
                        i = O.filter(e => e !== l);
                      z(i),
                        await f.Xy.setBetaCW20Denoms(
                          l,
                          {
                            chain: e,
                            name: n.name,
                            coinDenom: n.coinDenom,
                            coinMinimalDenom: n.coinMinimalDenom,
                            coinDecimals: n.coinDecimals,
                            icon: null == n ? void 0 : n.icon,
                            coinGeckoId: null == n ? void 0 : n.coinGeckoId
                          },
                          e
                        );
                    }
                  },
                  [e, n, i, t, O, w, U]
                ),
                en = (0, m.useCallback)(() => {
                  L(!1), I(void 0);
                }, []),
                ei = (0, m.useCallback)(e => {
                  L(!0), I(e);
                }, []);
              return (
                (0, m.useEffect)(() => {
                  var e;
                  null === (e = X.current) || void 0 === e || e.focus();
                }, []),
                (0, o.jsxs)("div", {
                  className: "flex flex-col h-full bg-secondary-50",
                  children: [
                    (0, o.jsx)(k.Z, {}),
                    (0, o.jsxs)("div", {
                      className: "flex items-center gap-2 m-6",
                      children: [
                        (0, o.jsx)(r.M, {
                          ref: X,
                          value: P,
                          onChange: e => {
                            var n;
                            return F((null == e ? void 0 : null === (n = e.target) || void 0 === n ? void 0 : n.value) ?? "");
                          },
                          placeholder: "Search by chain name",
                          onClear: () => F("")
                        }),
                        q &&
                          (0, o.jsx)("div", {
                            className: "bg-secondary-100 hover:bg-secondary-200 px-4 py-3 text-muted-foreground rounded-xl cursor-pointer",
                            onClick: () => q(),
                            "aria-label": "add new token button in manage tokens flow",
                            children: (0, o.jsx)(a.v, { size: 20, "aria-label": "add new token button text in manage tokens flow" })
                          })
                      ]
                    }),
                    (0, o.jsx)(C.X, {
                      activeTab: Z,
                      setActiveTab: H,
                      fetchingContract: V,
                      filteredSupportedTokens: Y,
                      filteredManuallyAddedTokens: Q,
                      fetchedTokens: O,
                      handleToggleChange: ee,
                      onDeleteClick: ei,
                      handleAddNewTokenClick: q,
                      searchedText: P
                    }),
                    (0, o.jsx)(D.ub, {
                      activeChainStore: x.J,
                      chainInfosStore: h.Ui,
                      betaNativeDenomsStore: f.vk,
                      betaERC20DenomsStore: f.EM,
                      betaCW20DenomsStore: f.Xy,
                      isOpen: W,
                      onClose: en,
                      tokenToDelete: B
                    })
                  ]
                })
              );
            }),
            N = (0, d.Pi)(() => (0, o.jsx)(M, {}));
          t();
        } catch (e) {
          t(e);
        }
      });
    },
    8789: function (e, n, i) {
      i.d(n, { j: () => t });
      function t(e, n) {
        let i = e.coinDenom.toUpperCase(),
          t = n.coinDenom.toUpperCase();
        return i < t ? -1 : +(i < t);
      }
    },
    53345: function (e, n, i) {
      i.d(n, { s: () => l });
      var t = i(55334),
        o = i(48834).Buffer;
      async function l(e, n) {
        let i = `${e}/cosmwasm/wasm/v1/contract/${n}/smart/${o.from('{"token_info":{}}').toString("base64")}`,
          { data: l } = await t.Z.get(i);
        return l.error && l.error.toLowerCase().includes("decoding bech32 failed") ? "Invalid Contract Address" : l.data;
      }
    }
  }
]);
//# sourceMappingURL=4580.js.map
