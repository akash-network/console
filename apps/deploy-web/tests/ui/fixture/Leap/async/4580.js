!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      n = new e.Error().stack;
    n &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[n] = "4107fdf9-e7b7-407c-9a82-2bc114708799"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-4107fdf9-e7b7-407c-9a82-2bc114708799"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.22.9" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["4580"],
  {
    42311: function (e, n, i) {
      i.d(n, { j: () => c });
      var t = i(52322),
        l = i(75377),
        o = i(57124),
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
          v = (0, o.a)();
        return (0, t.jsx)(l.GenericCard, {
          title: n,
          subtitle: (0, t.jsxs)("p", { children: [i, " ", m ?? null] }),
          isRounded: c,
          size: "md",
          img: (0, t.jsx)("img", { src: d ?? v, className: (0, s.cn)("h-8 w-8 mr-3", f), onError: (0, r._)(v) }),
          icon: (0, t.jsxs)("div", {
            className: "flex items-center gap-[8px]",
            children: [
              (0, t.jsx)(l.Toggle, { checked: x, onChange: u }),
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
        l = i(43166),
        o = i(85027),
        a = i(69816);
      i(2784);
      var s = i(10289);
      let r = e => {
        let { title: n, onBack: i } = e,
          r = (0, s.s0)();
        return (0, t.jsxs)(o.m, {
          className: "bg-secondary-50 border-b border-secondary-300",
          children: [
            (0, t.jsx)(l.X, {
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
        l = i(4370),
        o = i(2784),
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
              tokensLength: l,
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
            y = n === l - 1,
            w = (0, x.MD)((null == i ? void 0 : i.name) ?? (0, x.kC)(i.coinDenom.toLowerCase()) ?? "", 7, 4),
            M = (0, x.MD)(i.coinDenom, 4, 4),
            N = C(i.coinMinimalDenom),
            T = (0, o.useMemo)(() => {
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
            S = (0, o.useCallback)(
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
            fetchedTokens: l,
            onDeleteClick: o,
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
                          fetchedTokens: l,
                          onDeleteClick: o,
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
          let { token: n, tokensLength: i, index: l, handleToggleChange: a, cw20DenomsStore: s, autoFetchedCW20DenomsStore: r } = e,
            { cw20Denoms: c } = s,
            { autoFetchedCW20Denoms: m } = r,
            g = (0, D.a1)(),
            { theme: f } = (0, j.useTheme)(),
            { getExplorerAccountUrl: v } = (0, d.JVF)({}),
            b = (0, o.useMemo)(() => ({ ...c, ...m }), [c, m]),
            p = l === i - 1,
            y = (0, x.MD)((null == n ? void 0 : n.name) ?? (0, x.kC)(n.coinDenom.toLowerCase()) ?? "", 7, 4),
            w = (0, x.MD)(n.coinDenom, 4, 4),
            M = v(n.coinMinimalDenom),
            N = (0, o.useCallback)(
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
                className: (0, u.cn)("!bg-secondary-100 hover:!bg-secondary-200 rounded-xl mb-4 w-full !h-[66px]", 0 === l ? "mt-6" : "")
              }),
              p ? (0, t.jsx)("div", { className: "h-[1px] bg-transparent mt-6" }) : null
            ]
          });
        }),
        w = e => {
          let { filteredSupportedTokens: n, handleToggleChange: i, fetchingContract: l, handleAddNewTokenClick: o, searchedText: d } = e;
          return !0 === l
            ? (0, t.jsx)("div", { className: "flex items-center justify-center flex-1", children: (0, t.jsx)(a.T, { color: "#29a874" }) })
            : !1 === l && 0 === n.length
              ? (0, t.jsx)(c.Pi, { onAddTokenClick: o, searchedText: d })
              : (0, t.jsx)("div", {
                  className: "w-full px-6 flex-1",
                  children: (0, t.jsx)(s.OO, {
                    style: { flexGrow: "1", width: "100%" },
                    data: n,
                    itemContent: (e, l) =>
                      (0, t.jsx)(
                        y,
                        {
                          activeChainStore: p.J,
                          cw20DenomsStore: r.Sg,
                          autoFetchedCW20DenomsStore: r.PZ,
                          token: l,
                          tokensLength: n.length,
                          index: e,
                          handleToggleChange: i
                        },
                        `${l.coinMinimalDenom}`
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
            filteredSupportedTokens: o,
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
                            (0, t.jsx)(l.E.div, { className: "absolute bottom-0 left-0 right-0 h-0.5 bg-primary z-10", layoutId: "active-tab-indicator" })
                        ]
                      })
                    },
                    e.value
                  )
                )
              }),
              "supported" === n
                ? (0, t.jsx)(w, { filteredSupportedTokens: o, handleToggleChange: r, fetchingContract: u, handleAddNewTokenClick: d, searchedText: m })
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
      i.d(n, { t: () => o });
      var t = i(52322),
        l = i(26007);
      function o(e) {
        let { title: n, showRedirection: i, handleRedirectionClick: o } = e;
        return (0, t.jsxs)("div", {
          className: "flex gap-1 items-center font-bold dark:text-white-100",
          children: [
            (0, t.jsx)("span", { className: "shrink-0", children: n }),
            i &&
              (0, t.jsx)("button", {
                onClick: o,
                className: "!text-md dark:text-gray-400 !leading-4 flex items-center",
                children: (0, t.jsx)(l.O, { size: 16 })
              })
          ]
        });
      }
      i(2784);
    },
    50600: function (e, n, i) {
      i.d(n, { i: () => a });
      var t = i(52322),
        l = i(72779),
        o = i.n(l);
      function a(e) {
        let { className: n, type: i } = e;
        return (0, t.jsx)("span", { className: o()("px-[6px] py-[1px] text-[10px] text-center ml-[2px] rounded-xl", n), children: i });
      }
      i(2784);
    },
    25167: function (e, n, i) {
      i.d(n, { Pi: () => x, ub: () => d, iv: () => b.i, jz: () => t.j });
      var t = i(42311),
        l = i(52322),
        o = i(96217),
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
        return (0, l.jsxs)(o.Z, {
          title: "Delete Token",
          onClose: i,
          className: "p-6",
          isOpen: n,
          children: [
            (0, l.jsxs)("div", {
              className: "rounded-2xl bg-secondary-100 p-6 flex flex-col items-center text-center",
              children: [
                (0, l.jsx)("div", {
                  className: "rounded-full bg-destructive-100 p-[18px] w-fit flex",
                  children: (0, l.jsx)("img", { src: s.r.Misc.DeleteTokenSheetBin })
                }),
                (0, l.jsx)("div", { className: "font-bold text-gray-800 dark:text-white-100 text-base mt-4", children: "Confirm Delete?" }),
                (0, l.jsxs)("div", {
                  className: "text-gray-400 font-medium text-sm mt-5",
                  children: ["Are you sure you want to delete your manually added “", j, "” token on", " ", f.chainName, "?"]
                })
              ]
            }),
            (0, l.jsxs)("div", {
              className: "flex flex-row justify-between mt-6 gap-3",
              children: [
                (0, l.jsx)(a.zx, {
                  type: "button",
                  className: "h-[48px] flex-1 !bg-secondary-100 hover:!bg-secondary-200",
                  onClick: i,
                  "aria-label": "cancel delete token button in manage tokens flow",
                  children: (0, l.jsx)("span", { "aria-label": "cancel delete token button text in manage tokens flow", children: "Cancel" })
                }),
                (0, l.jsx)(a.zx, {
                  type: "button",
                  className: "h-[48px] flex-1 cursor-pointer !bg-destructive-100 hover:!bg-destructive-400",
                  onClick: D,
                  "aria-label": "confirm delete token button in manage tokens flow",
                  children: (0, l.jsx)("span", { "aria-label": "confirm delete token button text in manage tokens flow", children: "Confirm" })
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
          t = (0, l.jsxs)("p", {
            className: "text-[13px]",
            children: [
              "Or manually add token data",
              " ",
              (0, l.jsx)("button", {
                className: "border-none bg-transparent hover:underline cursor-pointer font-bold text-sm",
                style: { color: "#ad4aff" },
                onClick: () => n(!1),
                children: "here"
              })
            ]
          });
        return (
          i &&
            (t = (0, l.jsxs)("p", {
              className: "text-[13px]",
              children: [
                "Try manually adding tokens instead",
                (0, l.jsx)(m.Buttons.Generic, {
                  onClick: () => n(!0),
                  className: "max-w-[200px] text-gray-900 mt-[16px]",
                  style: { boxShadow: "none" },
                  children: "Add Tokens Manually"
                })
              ]
            })),
          (0, l.jsx)(u.S, {
            isRounded: !0,
            subHeading: t,
            heading: (0, l.jsx)("p", { className: "text-[15px]", children: i ? "No results found" : "Search for any token" }),
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
            fetchedTokens: o,
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
        return (0, l.jsxs)("div", {
          children: [
            (0, l.jsx)("div", { className: "font-bold text-sm text-gray-600 dark:text-gray-200 mb-2", children: "Manually added tokens" }),
            (0, l.jsx)("div", {
              className: "rounded-2xl flex flex-col items-center justify-center dark:bg-gray-900 bg-white-100 overflow-hidden",
              children: n.map((e, n, s) => {
                let r = n === s.length - 1,
                  d = (0, l.jsx)(b.i, { type: "native", className: "bg-[#ff9f0a1a] text-orange-500" }),
                  u = (0, g.MDB)((null == e ? void 0 : e.name) ?? (0, g.kC2)(e.coinDenom.toLowerCase()), 7, 4),
                  D = (0, g.MDB)(e.coinDenom, 4, 4);
                x[e.coinMinimalDenom]
                  ? (d = (0, l.jsx)(b.i, { type: "cw20", className: "bg-[#29A8741A] text-green-600" }))
                  : f[e.coinMinimalDenom]
                    ? (d = (0, l.jsx)(b.i, { type: "erc20", className: "bg-[#A52A2A1A] text-[#a52a2a]" }))
                    : e.coinMinimalDenom.trim().toLowerCase().startsWith("factory") &&
                      (d = (0, l.jsx)(b.i, { type: "factory", className: "bg-[#0AB8FF1A] text-teal-500" }));
                let k = j(e.coinMinimalDenom);
                return (0, l.jsxs)(
                  c.Fragment,
                  {
                    children: [
                      (0, l.jsx)(t.j, {
                        title: (0, l.jsx)(h.t, {
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
                        isToggleChecked: !v.includes(e.coinMinimalDenom) && !o.includes(e.coinMinimalDenom) && p.includes(e.coinMinimalDenom),
                        onToggleChange: n => i(n, e.coinMinimalDenom),
                        onDeleteClick: () => a(e)
                      }),
                      r ? null : (0, l.jsx)(m.CardDivider, {})
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
        let { tokens: n, handleToggleChange: i, activeChainStore: t, cw20DenomsStore: o, autoFetchedCW20DenomsStore: a } = e,
          { activeChain: r } = t,
          { denoms: d } = o,
          u = null == d ? void 0 : d[r],
          { autoFetchedCW20Denoms: x } = a,
          b = (0, f.a)(),
          { theme: p } = (0, m.useTheme)(),
          { getExplorerAccountUrl: j } = (0, g.JVF)({}),
          D = (0, c.useMemo)(() => ({ ...u, ...x }), [u, x]);
        return (0, l.jsxs)("div", {
          children: [
            (0, l.jsx)("div", { className: "font-bold text-sm text-gray-600 dark:text-gray-200 mb-2", children: "Supported tokens" }),
            (0, l.jsx)("div", {
              className: "rounded-2xl flex flex-col items-center justify-center dark:bg-gray-900 bg-white-100 overflow-hidden",
              children: n.map((e, n, t) => {
                let o = n === t.length - 1,
                  a = (0, g.MDB)((null == e ? void 0 : e.name) ?? (0, g.kC2)(e.coinDenom.toLowerCase()), 7, 4),
                  r = (0, g.MDB)(e.coinDenom, 4, 4),
                  d = j(e.coinMinimalDenom);
                return (0, l.jsxs)(
                  c.Fragment,
                  {
                    children: [
                      (0, l.jsx)(m.GenericCard, {
                        title: (0, l.jsx)(h.t, {
                          title: a,
                          showRedirection: !!(null == D ? void 0 : D[null == e ? void 0 : e.coinMinimalDenom]) && !!d,
                          handleRedirectionClick: e => {
                            e.stopPropagation(), window.open(d, "_blank");
                          }
                        }),
                        subtitle: r,
                        isRounded: o,
                        size: "md",
                        img: (0, l.jsxs)("div", {
                          className: "relative mr-3",
                          children: [
                            (0, l.jsx)("img", { src: e.icon ?? b, className: "h-7 w-7", onError: (0, v._)(b) }),
                            e.verified &&
                              (0, l.jsxs)("div", {
                                className: "absolute group -bottom-[5px] -right-[5px]",
                                children: [
                                  (0, l.jsx)("img", {
                                    src: p === m.ThemeName.DARK ? s.r.Misc.VerifiedWithBgStarDark : s.r.Misc.VerifiedWithBgStar,
                                    alt: "verified-token",
                                    className: "h-4 w-4"
                                  }),
                                  (0, l.jsx)("div", {
                                    className:
                                      "group-hover:!block hidden absolute bottom-0 right-0 translate-x-full bg-gray-200 dark:bg-gray-800 px-3 py-2 rounded-lg text-xs dark:text-white-100",
                                    children: "Whitelisted"
                                  })
                                ]
                              })
                          ]
                        }),
                        icon: (0, l.jsx)("div", {
                          className: "flex items-center gap-[8px]",
                          children: (0, l.jsx)(m.Toggle, { checked: e.enabled, onChange: n => i(n, e.coinMinimalDenom) })
                        })
                      }),
                      o ? null : (0, l.jsx)(m.CardDivider, {})
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
          i.r(n), i.d(n, { default: () => M });
          var l = i(52322),
            o = i(41172),
            a = i(29049),
            s = i(84916),
            r = i(80075),
            c = i(75958),
            d = i(2784),
            m = i(10289),
            u = i(78344),
            x = i(26245),
            g = i(36321),
            h = i(42799),
            f = i(30809),
            v = i(53345),
            b = i(72565),
            p = i.n(b),
            j = i(25167),
            D = i(53299),
            k = i(43922),
            C = i(8789),
            y = e([x]);
          x = (y.then ? (await y)() : y)[0];
          let w = (0, c.Pi)(() => {
              let { activeChain: e } = u.J,
                { selectedNetwork: n } = f.i,
                { disabledCW20Denoms: i } = h.eV,
                { enabledCW20Denoms: t } = h.bI,
                c = h.Xy.betaCW20Denoms,
                { cw20Denoms: b } = h.Sg,
                { interactedDenoms: y } = h.GC,
                w = h.vk.betaNativeDenoms,
                M = h.EM.betaERC20Denoms,
                { erc20Denoms: N } = h.QH,
                { autoFetchedCW20Denoms: T } = h.PZ,
                { cw20Tokens: S } = x.Sz,
                { erc20Tokens: A } = x.g5,
                R = (0, m.s0)(),
                { lcdUrl: E } = (0, o.U9i)(),
                [W, _] = (0, d.useState)(!1),
                [L, B] = (0, d.useState)(),
                [P, I] = (0, d.useState)(""),
                [F, O] = (0, d.useState)([]),
                [z, V] = (0, d.useState)(!1),
                G = (0, d.useRef)(),
                [$, U] = (0, d.useState)([]),
                J = (0, d.useRef)(null),
                [X, Z] = (0, d.useState)("supported"),
                H = (0, d.useMemo)(() => {
                  var e, n, l;
                  let o = [],
                    a =
                      (null === (e = Object.values(b)) || void 0 === e
                        ? void 0
                        : e.map(e => {
                            let n = null == S ? void 0 : S.find(n => n.coinMinimalDenom === e.coinMinimalDenom);
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
                      (null === (n = Object.values(T)) || void 0 === n
                        ? void 0
                        : n.map(e => ({ ...e, enabled: null == t ? void 0 : t.includes(e.coinMinimalDenom), verified: !1 }))) ?? [],
                    r =
                      (null === (l = Object.values(N)) || void 0 === l
                        ? void 0
                        : l.map(e => {
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
                          })) ?? [];
                  return (o = [...o, ...a, ...s, ...r]);
                }, [T, b, S, i, t, N, A]);
              (0, d.useEffect)(
                () =>
                  (0, r.EH)(() => {
                    let e = [];
                    w && (e = [...e, ...(Object.values(w) ?? [])]),
                      c && (e = [...e, ...(Object.values(c) ?? [])]),
                      M && (e = [...e, ...(Object.values(M) ?? [])]),
                      U(e);
                  }),
                [c, M, w]
              ),
                (0, d.useEffect)(() => {
                  O(e => (e ?? []).filter(e => !i.includes(e)));
                }, [i.length]);
              let K = (0, d.useMemo)(() => {
                  var e;
                  return (
                    (null == $
                      ? void 0
                      : null ===
                            (e = $.filter(e => {
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
                }, [$, P]),
                Q = (0, d.useMemo)(() => {
                  var e;
                  return (
                    (null == H
                      ? void 0
                      : null ===
                            (e = H.filter(e => {
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
                            let l = !!((null == b ? void 0 : b[e.coinMinimalDenom]) || (null == N ? void 0 : N[e.coinMinimalDenom])),
                              o = !!((null == b ? void 0 : b[n.coinMinimalDenom]) || (null == N ? void 0 : N[n.coinMinimalDenom]));
                            return l && !o ? -1 : !l && o ? 1 : (0, C.j)(e, n);
                          })) ?? []
                  );
                }, [H, P, b, N]);
              (0, d.useEffect)(() => {
                0 !== P.length &&
                  0 === Q.length &&
                  0 === K.length &&
                  (clearTimeout(G.current),
                  (G.current = setTimeout(async () => {
                    try {
                      V(!0);
                      let n = await (0, v.s)(E ?? "", P);
                      "string" != typeof n &&
                        n.symbol &&
                        (O(e => [...e, P]),
                        U(i => [
                          ...i,
                          { name: n.name, coinDecimals: n.decimals, coinMinimalDenom: P, coinDenom: n.symbol, icon: "", coinGeckoId: "", chain: e }
                        ]));
                    } catch (e) {
                    } finally {
                      V(!1);
                    }
                  }, 100)));
              }, [P, K.length, E, e, Q.length]);
              let Y = (0, d.useCallback)(
                  function () {
                    let e = arguments.length > 0 && void 0 !== arguments[0] && arguments[0],
                      n = p().extension.getViews({ type: "popup" });
                    if (0 === n.length) {
                      let n = { replace: !0 };
                      e && (n.state = { coinMinimalDenom: P }), R("/add-token", n);
                    } else window.open(p().runtime.getURL("index.html#/add-token"));
                  },
                  [R, P]
                ),
                q = (0, d.useCallback)(
                  async (l, o) => {
                    y.some(e => e === o) || (await h.GC.setInteractedDenoms([...y, o]));
                    let a = [],
                      s = [],
                      r = !1;
                    if (l) {
                      (a = i.filter(e => e !== o)), (s = [...t, o]);
                      let l = $.find(e => e.coinMinimalDenom === o);
                      F.includes(o) && l && (r = !0), "aggregated" !== e && x.Sz.fetchCW20TokenBalances(e, n, [o]);
                    } else (a = [...i, o]), (s = t.filter(e => e !== o));
                    if ((await h.eV.setDisabledCW20Denoms(a), await h.bI.setEnabledCW20Denoms(s), r)) {
                      let n = $.find(e => e.coinMinimalDenom === o),
                        i = F.filter(e => e !== o);
                      O(i),
                        await h.Xy.setBetaCW20Denoms(
                          o,
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
                  [e, n, i, t, F, y, $]
                ),
                ee = (0, d.useCallback)(() => {
                  _(!1), B(void 0);
                }, []),
                en = (0, d.useCallback)(e => {
                  _(!0), B(e);
                }, []);
              return (
                (0, d.useEffect)(() => {
                  var e;
                  null === (e = J.current) || void 0 === e || e.focus();
                }, []),
                (0, l.jsxs)("div", {
                  className: "flex flex-col h-full bg-secondary-50",
                  children: [
                    (0, l.jsx)(D.Z, {}),
                    (0, l.jsxs)("div", {
                      className: "flex items-center gap-2 m-6",
                      children: [
                        (0, l.jsx)(s.M, {
                          ref: J,
                          value: P,
                          onChange: e => {
                            var n;
                            return I((null == e ? void 0 : null === (n = e.target) || void 0 === n ? void 0 : n.value) ?? "");
                          },
                          placeholder: "Search by chain name",
                          onClear: () => I("")
                        }),
                        Y &&
                          (0, l.jsx)("div", {
                            className: "bg-secondary-100 hover:bg-secondary-200 px-4 py-3 text-muted-foreground rounded-xl cursor-pointer",
                            onClick: () => Y(),
                            "aria-label": "add new token button in manage tokens flow",
                            children: (0, l.jsx)(a.v, { size: 20, "aria-label": "add new token button text in manage tokens flow" })
                          })
                      ]
                    }),
                    (0, l.jsx)(k.X, {
                      activeTab: X,
                      setActiveTab: Z,
                      fetchingContract: z,
                      filteredSupportedTokens: Q,
                      filteredManuallyAddedTokens: K,
                      fetchedTokens: F,
                      handleToggleChange: q,
                      onDeleteClick: en,
                      handleAddNewTokenClick: Y,
                      searchedText: P
                    }),
                    (0, l.jsx)(j.ub, {
                      activeChainStore: u.J,
                      chainInfosStore: g.Ui,
                      betaNativeDenomsStore: h.vk,
                      betaERC20DenomsStore: h.EM,
                      betaCW20DenomsStore: h.Xy,
                      isOpen: W,
                      onClose: ee,
                      tokenToDelete: L
                    })
                  ]
                })
              );
            }),
            M = (0, c.Pi)(() => (0, l.jsx)(w, {}));
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
      i.d(n, { s: () => o });
      var t = i(55334),
        l = i(48834).Buffer;
      async function o(e, n) {
        let i = `${e}/cosmwasm/wasm/v1/contract/${n}/smart/${l.from('{"token_info":{}}').toString("base64")}`,
          { data: o } = await t.Z.get(i);
        return o.error && o.error.toLowerCase().includes("decoding bech32 failed") ? "Invalid Contract Address" : o.data;
      }
    }
  }
]);
//# sourceMappingURL=4580.js.map
