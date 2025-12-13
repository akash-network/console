!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      l = new e.Error().stack;
    l &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[l] = "9a4559db-eba9-419b-b356-394672fc660f"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-9a4559db-eba9-419b-b356-394672fc660f"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.23.1" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["7475"],
  {
    23751: function (e, l, n) {
      n.d(l, { D: () => a, KE: () => s });
      var i = n(52322);
      n(2784);
      var t = n(86874);
      function a() {
        return (0, i.jsxs)("div", {
          className: "flex rounded-2xl bg-secondary gap-y-1.5 flex-col p-4 w-full",
          children: [(0, i.jsx)(t.Z, { className: "w-24 h-5" }), (0, i.jsx)(t.Z, { className: "w-80 h-10" }), (0, i.jsx)(t.Z, { className: "w-24 h-6" })]
        });
      }
      function s(e) {
        return (0, i.jsx)("div", {
          className: "flex flex-col gap-4 text-xs",
          children: Array.from({ length: e.count ?? 1 }).map((e, l) =>
            (0, i.jsxs)(
              "div",
              {
                className: "flex items-center px-4 py-3 bg-secondary-100 w-full rounded-xl gap-4",
                children: [
                  (0, i.jsx)(t.Z, { width: 36, height: 36, circle: !0 }),
                  (0, i.jsx)(t.Z, { width: 100, height: 12 }),
                  (0, i.jsxs)("div", {
                    className: "flex flex-col items-end ml-auto ",
                    children: [(0, i.jsx)(t.Z, { width: 40, height: 8 }), (0, i.jsx)(t.Z, { width: 48, height: 6 })]
                  })
                ]
              },
              l
            )
          )
        });
      }
    },
    69380: function (e, l, n) {
      n.d(l, { Z: () => r });
      var i = n(52322),
        t = n(2784),
        a = n(70514);
      let s = (0, t.forwardRef)((e, l) => {
        let { disabled: n, icon: t, label: s, className: r, ...o } = e;
        return (0, i.jsxs)("div", {
          className: (0, a.cn)("flex flex-col text-center justify-center", n && "opacity-40"),
          children: [
            (0, i.jsx)("button", {
              ref: l,
              ...o,
              disabled: n,
              className: (0, a.cn)(
                "mx-auto relative w-[3.25rem] h-[3.25rem] bg-secondary-100 hover:bg-secondary-200 transition-colors rounded-full text-center cursor-pointer disabled:cursor-not-allowed flex items-center justify-center",
                r
              ),
              children: (0, i.jsx)(t, { className: "size-6" })
            }),
            !!s && (0, i.jsx)("p", { className: "text-sm mt-2 tracking-wide font-bold", children: s })
          ]
        });
      });
      s.displayName = "ClickableIcon";
      let r = s;
    },
    41979: function (e, l, n) {
      n.d(l, { Z: () => s });
      var i = n(52322),
        t = n(2784),
        a = n(69816);
      function s(e) {
        let { children: l, textProps: n, readMoreColor: s } = e,
          [r, o] = (0, t.useState)(!0),
          c = l && l.length > 150;
        return (0, i.jsxs)("div", {
          children: [
            (0, i.jsx)(a.Z, {
              size: n.size,
              className: n.className,
              color: n.color,
              children: (0, i.jsx)("span", { children: r && c ? l.slice(0, 150).trim() + "..." : l })
            }),
            c &&
              (0, i.jsx)("span", {
                onClick: () => {
                  o(!r);
                },
                className: "hover:cursor-pointer font-bold",
                style: { color: s },
                children: r ? "Read more" : "Show less"
              })
          ]
        });
      }
    },
    13607: function (e, l, n) {
      n.d(l, { Z: () => a });
      var i = n(60431),
        t = n(55334);
      function a() {
        return (0, i.useQuery)(
          ["explore-tokens"],
          async () => {
            let e = await t.Z.get("https://api.leapwallet.io/market/changes?currency=USD&ecosystem=cosmos-ecosystem");
            return null == e ? void 0 : e.data;
          },
          { staleTime: 6e4, cacheTime: 3e5 }
        );
      }
    },
    39215: function (e, l, n) {
      n.d(l, { P: () => t });
      var i = n(52322);
      n(2784);
      let t = e =>
        (0, i.jsx)("svg", {
          width: "20",
          height: "20",
          viewBox: "0 0 20 20",
          fill: "none",
          xmlns: "http://www.w3.org/2000/svg",
          children: (0, i.jsx)("path", {
            d: "M9.99996 1.66666C5.39996 1.66666 1.66663 5.39999 1.66663 9.99999C1.66663 14.6 5.39996 18.3333 9.99996 18.3333C14.6 18.3333 18.3333 14.6 18.3333 9.99999C18.3333 5.39999 14.6 1.66666 9.99996 1.66666ZM11.175 15.075V15.5583C11.175 16.1667 10.675 16.6667 10.0666 16.6667H10.0583C9.44996 16.6667 8.94996 16.1667 8.94996 15.5583V15.0583C7.84163 14.825 6.85829 14.2167 6.44163 13.1917C6.24996 12.7333 6.60829 12.225 7.10829 12.225H7.30829C7.61663 12.225 7.86663 12.4333 7.98329 12.725C8.22496 13.35 8.85829 13.7833 10.075 13.7833C11.7083 13.7833 12.075 12.9667 12.075 12.4583C12.075 11.7667 11.7083 11.1167 9.84996 10.675C7.78329 10.175 6.36663 9.32499 6.36663 7.61666C6.36663 6.18332 7.52496 5.24999 8.95829 4.94166V4.44166C8.95829 3.83332 9.45829 3.33332 10.0666 3.33332H10.075C10.6833 3.33332 11.1833 3.83332 11.1833 4.44166V4.95832C12.3333 5.24166 13.0583 5.95832 13.375 6.84166C13.5416 7.29999 13.1916 7.78332 12.7 7.78332H12.4833C12.175 7.78332 11.925 7.56666 11.8416 7.26666C11.65 6.63332 11.125 6.22499 10.075 6.22499C8.82496 6.22499 8.07496 6.79166 8.07496 7.59166C8.07496 8.29166 8.61663 8.74999 10.3 9.18332C11.9833 9.61666 13.7833 10.3417 13.7833 12.4417C13.7666 13.9667 12.625 14.8 11.175 15.075Z",
            fill: "white"
          })
        });
    },
    40811: function (e, l, n) {
      n.d(l, { I: () => t });
      var i = n(52322);
      n(2784);
      let t = e =>
        (0, i.jsxs)("svg", {
          width: "20",
          height: "20",
          viewBox: "0 0 20 20",
          fill: "none",
          xmlns: "http://www.w3.org/2000/svg",
          children: [
            (0, i.jsxs)("g", {
              children: [
                (0, i.jsx)("mask", {
                  id: "mask0_2752_43897",
                  maskUnits: "userSpaceOnUse",
                  x: "0",
                  y: "0",
                  width: "24",
                  height: "24",
                  children: (0, i.jsx)("rect", { width: "24", height: "24", fill: "#D9D9D9" })
                }),
                (0, i.jsx)("g", {
                  mask: "url(#mask0_2752_43897)",
                  children: (0, i.jsx)("path", {
                    d: "M9.99998 17.9792C9.88887 17.9792 9.7847 17.9618 9.68748 17.9271C9.59026 17.8924 9.49998 17.8333 9.41665 17.75L4.74998 13.0833C4.5972 12.9305 4.52081 12.7361 4.52081 12.5C4.52081 12.2639 4.5972 12.0694 4.74998 11.9167C4.91665 11.75 5.11456 11.6701 5.34373 11.6771C5.5729 11.684 5.76387 11.7639 5.91665 11.9167L9.16665 15.1458V2.49999C9.16665 2.26388 9.24651 2.06596 9.40623 1.90624C9.56595 1.74652 9.76387 1.66666 9.99998 1.66666C10.2361 1.66666 10.434 1.74652 10.5937 1.90624C10.7535 2.06596 10.8333 2.26388 10.8333 2.49999V15.1458L14.0625 11.9167C14.2291 11.75 14.4271 11.6667 14.6562 11.6667C14.8854 11.6667 15.0833 11.75 15.25 11.9167C15.4028 12.0833 15.4791 12.2812 15.4791 12.5104C15.4791 12.7396 15.4028 12.9305 15.25 13.0833L10.5833 17.75C10.5 17.8333 10.4097 17.8924 10.3125 17.9271C10.2153 17.9618 10.1111 17.9792 9.99998 17.9792Z",
                    fill: "white"
                  })
                })
              ]
            }),
            (0, i.jsx)("defs", {
              children: (0, i.jsx)("clipPath", { id: "clip0_2752_43897", children: (0, i.jsx)("rect", { width: "20", height: "20", fill: "white" }) })
            })
          ]
        });
    },
    3890: function (e, l, n) {
      n.d(l, { d: () => t });
      var i = n(52322);
      n(2784);
      let t = e =>
        (0, i.jsxs)("svg", {
          width: "20",
          height: "20",
          viewBox: "0 0 20 20",
          fill: "none",
          xmlns: "http://www.w3.org/2000/svg",
          children: [
            (0, i.jsxs)("g", {
              children: [
                (0, i.jsx)("mask", {
                  id: "mask0_2752_43905",
                  maskUnits: "userSpaceOnUse",
                  x: "0",
                  y: "0",
                  width: "24",
                  height: "24",
                  children: (0, i.jsx)("rect", { width: "24", height: "24", fill: "#D9D9D9" })
                }),
                (0, i.jsx)("g", {
                  mask: "url(#mask0_2752_43905)",
                  children: (0, i.jsx)("path", {
                    d: "M4.85415 14.1667L6.43748 15.75C6.60415 15.9167 6.68401 16.1111 6.67706 16.3333C6.67012 16.5555 6.58331 16.75 6.41665 16.9167C6.24998 17.0694 6.05554 17.1493 5.83331 17.1562C5.61109 17.1632 5.41665 17.0833 5.24998 16.9167L2.24998 13.9167C2.16665 13.8333 2.10762 13.743 2.0729 13.6458C2.03817 13.5486 2.02081 13.4444 2.02081 13.3333C2.02081 13.2222 2.03817 13.118 2.0729 13.0208C2.10762 12.9236 2.16665 12.8333 2.24998 12.75L5.24998 9.74999C5.40276 9.59721 5.59373 9.52082 5.8229 9.52082C6.05206 9.52082 6.24998 9.59721 6.41665 9.74999C6.58331 9.91666 6.66665 10.1146 6.66665 10.3437C6.66665 10.5729 6.58331 10.7708 6.41665 10.9375L4.85415 12.5H16.6666C16.9028 12.5 17.1007 12.5799 17.2604 12.7396C17.4201 12.8993 17.5 13.0972 17.5 13.3333C17.5 13.5694 17.4201 13.7674 17.2604 13.9271C17.1007 14.0868 16.9028 14.1667 16.6666 14.1667H4.85415ZM15.1458 7.49999H3.33331C3.0972 7.49999 2.89929 7.42013 2.73956 7.26041C2.57984 7.10068 2.49998 6.90277 2.49998 6.66666C2.49998 6.43055 2.57984 6.23263 2.73956 6.07291C2.89929 5.91318 3.0972 5.83332 3.33331 5.83332H15.1458L13.5625 4.24999C13.3958 4.08332 13.316 3.88888 13.3229 3.66666C13.3298 3.44443 13.4166 3.24999 13.5833 3.08332C13.75 2.93054 13.9444 2.85068 14.1666 2.84374C14.3889 2.83679 14.5833 2.91666 14.75 3.08332L17.75 6.08332C17.8333 6.16666 17.8923 6.25693 17.9271 6.35416C17.9618 6.45138 17.9791 6.55555 17.9791 6.66666C17.9791 6.77777 17.9618 6.88193 17.9271 6.97916C17.8923 7.07638 17.8333 7.16666 17.75 7.24999L14.75 10.25C14.5972 10.4028 14.4062 10.4792 14.1771 10.4792C13.9479 10.4792 13.75 10.4028 13.5833 10.25C13.4166 10.0833 13.3333 9.88541 13.3333 9.65624C13.3333 9.42707 13.4166 9.22916 13.5833 9.06249L15.1458 7.49999Z",
                    fill: "white"
                  })
                })
              ]
            }),
            (0, i.jsx)("defs", {
              children: (0, i.jsx)("clipPath", { id: "clip0_2752_43905", children: (0, i.jsx)("rect", { width: "20", height: "20", fill: "white" }) })
            })
          ]
        });
    },
    66929: function (e, l, n) {
      n.d(l, { M: () => t });
      var i = n(52322);
      n(2784);
      let t = e =>
        (0, i.jsxs)("svg", {
          width: "20",
          height: "20",
          viewBox: "0 0 20 20",
          fill: "none",
          xmlns: "http://www.w3.org/2000/svg",
          children: [
            (0, i.jsxs)("g", {
              children: [
                (0, i.jsx)("mask", {
                  id: "mask0_2752_43893",
                  maskUnits: "userSpaceOnUse",
                  x: "0",
                  y: "0",
                  width: "24",
                  height: "24",
                  children: (0, i.jsx)("rect", { width: "24", height: "24", fill: "#D9D9D9" })
                }),
                (0, i.jsx)("g", {
                  mask: "url(#mask0_2752_43893)",
                  children: (0, i.jsx)("path", {
                    d: "M9.99998 18.3333C9.76387 18.3333 9.56595 18.2535 9.40623 18.0938C9.24651 17.934 9.16665 17.7361 9.16665 17.5V4.85418L5.91665 8.08334C5.76387 8.23612 5.5729 8.31598 5.34373 8.32293C5.11456 8.32987 4.91665 8.25001 4.74998 8.08334C4.5972 7.93057 4.52081 7.73612 4.52081 7.50001C4.52081 7.2639 4.5972 7.06945 4.74998 6.91668L9.41665 2.25001C9.49998 2.16668 9.59026 2.10765 9.68748 2.07293C9.7847 2.0382 9.88887 2.02084 9.99998 2.02084C10.1111 2.02084 10.2153 2.0382 10.3125 2.07293C10.4097 2.10765 10.5 2.16668 10.5833 2.25001L15.25 6.91668C15.4028 7.06945 15.4791 7.26043 15.4791 7.48959C15.4791 7.71876 15.4028 7.91668 15.25 8.08334C15.0833 8.25001 14.8854 8.33334 14.6562 8.33334C14.4271 8.33334 14.2291 8.25001 14.0625 8.08334L10.8333 4.85418V17.5C10.8333 17.7361 10.7535 17.934 10.5937 18.0938C10.434 18.2535 10.2361 18.3333 9.99998 18.3333Z",
                    fill: "white"
                  })
                })
              ]
            }),
            (0, i.jsx)("defs", {
              children: (0, i.jsx)("clipPath", { id: "clip0_2752_43893", children: (0, i.jsx)("rect", { width: "20", height: "20", fill: "white" }) })
            })
          ]
        });
    },
    25199: function (e, l, n) {
      n.d(l, { c: () => a });
      var i = n(52322);
      n(2784);
      let t = e =>
        (0, i.jsx)("svg", {
          width: "20",
          height: "20",
          viewBox: "0 0 20 20",
          fill: "none",
          xmlns: "http://www.w3.org/2000/svg",
          ...e,
          children: (0, i.jsx)("path", {
            fillRule: "evenodd",
            clipRule: "evenodd",
            d: "M7.83056 0.244078C7.50512 -0.0813592 6.97749 -0.0813592 6.65205 0.244078C5.13538 1.76074 4.28333 3.81778 4.28333 5.96268C4.28333 8.10757 5.13538 10.1646 6.65205 11.6812C6.66442 11.6937 6.67683 11.706 6.68927 11.7183L1.81705 18.6892C1.6391 18.9439 1.61752 19.2763 1.76107 19.5517C1.90462 19.8272 2.18947 20 2.50008 20H13.0627C13.3734 20 13.6582 19.8272 13.8017 19.5517C13.9453 19.2763 13.9237 18.9439 13.7458 18.6892L10.3182 13.7852C10.9827 13.9596 11.672 14.05 12.3707 14.05C14.5156 14.05 16.5726 13.1979 18.0893 11.6812C18.4147 11.3558 18.4147 10.8282 18.0893 10.5027L14.6613 7.07483L15.4585 3.88541C15.5295 3.60144 15.4462 3.30105 15.2393 3.09408C15.0323 2.88711 14.7319 2.8039 14.448 2.87488L11.2585 3.67206L7.83056 0.244078ZM7.27969 2.05022L10.4137 5.18418L13.1492 7.91972L16.2831 11.0537C15.1673 11.9112 13.7933 12.3833 12.3707 12.3833C10.6677 12.3833 9.03467 11.7068 7.83056 10.5027C6.62646 9.29867 5.95 7.66554 5.95 5.96268C5.95 4.54002 6.42215 3.16603 7.27969 2.05022ZM7.78143 13.0649L11.4637 18.3333H4.09922L7.78143 13.0649Z",
            fill: "currentColor"
          })
        });
      function a() {
        return (0, i.jsx)("div", {
          className: "flex flex-col items-center justify-center px-6 w-full h-[205px]",
          children: (0, i.jsxs)("div", {
            className: "flex flex-col gap-3 items-center justify-center border border-secondary-100 rounded-2xl h-full w-full",
            children: [
              (0, i.jsx)("div", {
                className: "bg-secondary-200 flex flex-row gap-2.5 items-center justify-start p-4 relative rounded-full",
                children: (0, i.jsx)("div", {
                  className: "relative size-5",
                  children: (0, i.jsx)(t, { height: 20, width: 20, className: "text-secondary-600" })
                })
              }),
              (0, i.jsxs)("div", {
                className: "flex flex-col gap-1 items-center justify-start text-center",
                children: [
                  (0, i.jsx)("div", { className: "text-secondary-800 text-sm font-medium", children: "No data available to display trends." }),
                  (0, i.jsx)("div", { className: "text-muted-foreground text-xs font-normal", children: "Please check back later." })
                ]
              })
            ]
          })
        });
      }
    },
    16850: function (e, l, n) {
      n.a(e, async function (e, i) {
        try {
          n.d(l, { Z: () => v });
          var t = n(52322),
            a = n(15969),
            s = n(75377),
            r = n(55803),
            o = n(96217),
            c = n(10706),
            d = n(57124),
            x = n(75958);
          n(2784);
          var m = n(10289),
            u = n(36321),
            h = n(46103),
            g = n(49409),
            f = e([c]);
          c = (f.then ? (await f)() : f)[0];
          let v = (0, x.Pi)(e => {
            var l;
            let { isVisible: n, onClose: i, ibcDenom: x, nativeDenom: f } = e,
              v = (0, d.a)(),
              p = u.Ui.chainInfos,
              b = p[f.chain],
              j = (0, m.s0)(),
              { activeWallet: w } = (0, c.ZP)();
            return b
              ? (0, t.jsx)(o.Z, {
                  isOpen: n,
                  onClose: i,
                  title: `Stake on ${b.chainName}`,
                  className: "p-6",
                  children: (0, t.jsxs)("div", {
                    className: "flex flex-col gap-y-4 px-1",
                    children: [
                      (0, t.jsxs)("div", {
                        className:
                          "flex rounded-xl dark:bg-gray-950 bg-gray-100 border dark:border-gray-850 border-gray-200 items-center justify-evenly px-5 py-6",
                        children: [
                          (0, t.jsxs)("div", {
                            className: "relative w-16 h-16 flex items-center justify-center",
                            children: [
                              (0, t.jsx)("img", { src: x.img, onError: (0, g._)(v), className: "w-12 h-12 rounded-full" }),
                              (0, t.jsx)("img", {
                                src: x.tokenBalanceOnChain
                                  ? null === (l = p[x.tokenBalanceOnChain] ?? a.oCA[x.tokenBalanceOnChain]) || void 0 === l
                                    ? void 0
                                    : l.chainSymbolImageUrl
                                  : v,
                                className: "w-6 h-6 absolute bottom-[3px] right-[3px] rounded-full bg-black-100 dark:bg-black-100"
                              })
                            ]
                          }),
                          (0, t.jsx)(r.U, { size: 16, color: h.w.green600 }),
                          (0, t.jsxs)("div", {
                            className: "relative w-16 h-16 flex items-center justify-center",
                            children: [
                              (0, t.jsx)("img", { src: x.img, onError: (0, g._)(v), className: "w-12 h-12 rounded-full" }),
                              (0, t.jsx)("img", {
                                src: b.chainSymbolImageUrl,
                                onError: (0, g._)(v),
                                className: "w-6 h-6 absolute bottom-[3px] right-[3px] rounded-full bg-black-100 dark:bg-black-100"
                              })
                            ]
                          })
                        ]
                      }),
                      (0, t.jsxs)("div", {
                        className: "font-medium text-md text-gray-800 dark:text-gray-200",
                        children: [
                          "Staking requires tokens to be on their native chains. Transfer your\xa0",
                          (0, t.jsx)("span", { className: "font-bold inline text-black-100 dark:text-white-100", children: x.symbol }),
                          "\xa0to\xa0",
                          (0, t.jsx)("span", { className: "font-bold inline text-black-100 dark:text-white-100", children: b.chainName }),
                          " ",
                          "to start staking."
                        ]
                      }),
                      (0, t.jsxs)(s.Buttons.Generic, {
                        className: "w-full",
                        size: "normal",
                        color: h.w.green600,
                        onClick: () => {
                          let e = null == w ? void 0 : w.addresses[f.chain],
                            l = `/send?assetCoinDenom=${x.ibcDenom}&recipient=${e}`;
                          j(l);
                        },
                        children: ["Send to\xa0", b.chainName]
                      })
                    ]
                  })
                })
              : null;
          });
          i();
        } catch (e) {
          i(e);
        }
      });
    },
    83324: function (e, l, n) {
      n.a(e, async function (e, i) {
        try {
          n.r(l), n.d(l, { default: () => eh });
          var t = n(52322),
            a = n(54655),
            s = n(77241),
            r = n(51906),
            o = n(41172),
            c = n(15969),
            d = n(43166),
            x = n(48039),
            m = n(12693),
            u = n(11448),
            h = n(92642),
            g = n(60431),
            f = n(6391),
            v = n(72779),
            p = n.n(v),
            b = n(69380),
            j = n(85027),
            w = n(41979),
            y = n(60889),
            k = n(83277),
            C = n(69816),
            N = n(26091),
            D = n(26571),
            S = n(23259),
            Z = n(25722),
            _ = n(74229),
            M = n(78646),
            L = n(13607),
            z = n(72059),
            E = n(10706),
            B = n(36400),
            T = n(50449),
            I = n(42941),
            P = n(57124),
            O = n(65027),
            F = n(39215),
            A = n(40811),
            $ = n(3890),
            G = n(66929),
            U = n(30464),
            H = n(75958),
            R = n(88259),
            V = n(82512),
            W = n(7345),
            Y = n(87604),
            Q = n(7473),
            q = n(90551),
            X = n(2784),
            K = n(86874),
            J = n(10289),
            ee = n(26245),
            el = n(36321),
            en = n(42799),
            ei = n(23490),
            et = n(319),
            ea = n(83275),
            es = n(84601),
            er = n(49409),
            eo = n(71198),
            ec = n(96818),
            ed = n(25199),
            ex = n(16850),
            em = n(79430),
            eu = e([B, z, E, O, k, ee, M, ea, V, y, es, W, ex, R]);
          [B, z, E, O, k, ee, M, ea, V, y, es, W, ex, R] = eu.then ? (await eu)() : eu;
          let eh = (0, H.Pi)(e => {
            var l, n, i, v, H, eu, eh;
            let { rootDenomsStore: eg, chainTagsStore: ef, percentageChangeDataStore: ev, priceStore: ep } = e,
              eb = void 0,
              ej = (0, I.K)(),
              ew = (0, B.pb)(),
              ey = (0, z.a7)(),
              { activeWallet: ek } = (0, E.ZP)(),
              eC = (0, I.Z)().get("assetName") ?? void 0,
              eN = (0, o.NrF)(eC, 100),
              eD = eC || eN,
              eS = (0, I.Z)().get("tokenChain") ?? void 0,
              eZ = (0, I.Z)().get("pageSource") ?? void 0,
              e_ = (0, J.s0)(),
              { data: eM = [] } = (0, L.Z)(),
              { data: eL } = (0, o.S2A)(),
              [ez, eE] = (0, X.useState)("true" === ei.S.show),
              [eB, eT] = (0, X.useState)(""),
              eI = O.w.useGetWallet(),
              [eP, eO] = (0, X.useState)(!1),
              [eF, eA] = (0, X.useState)(),
              e$ = (0, o.QSC)("noble"),
              eG = (0, J.TH)(),
              eU = (0, X.useMemo)(() => {
                let e = JSON.parse(sessionStorage.getItem("navigate-assetDetails-state") ?? "null");
                return (null == eG ? void 0 : eG.state) ?? e;
              }, [null == eG ? void 0 : eG.state]),
              eH = (0, X.useMemo)(() => (null == eU ? void 0 : eU.tokenBalanceOnChain) ?? ey, [ey, null == eU ? void 0 : eU.tokenBalanceOnChain]),
              { headerChainImgSrc: eR } = (0, _.Cd)(),
              { data: eV } = (0, Q.Z)(),
              eW = (0, X.useMemo)(() => {
                var e;
                return null == eV ? void 0 : eV[(null == ew ? void 0 : null === (e = ew[eH]) || void 0 === e ? void 0 : e.chainId) ?? ""];
              }, [eH, eV, ew]),
              eY = (0, X.useMemo)(() => {
                if ("cg" === eb) return null == eM ? void 0 : eM.find(e => e.id === eD);
              }, [eb, eD, eM]),
              eQ = (0, X.useMemo)(() => {
                let e = [];
                return (
                  eD && e.push(eD),
                  (null == eU ? void 0 : eU.coinMinimalDenom) && e.push(null == eU ? void 0 : eU.coinMinimalDenom),
                  (null == eU ? void 0 : eU.ibcDenom) && e.push(null == eU ? void 0 : eU.ibcDenom),
                  eW &&
                    (null == eW ? void 0 : eW.length) > 0 &&
                    !!(null == eW
                      ? void 0
                      : eW.find(l =>
                          "ethereum-native" === l.denom
                            ? e.includes("wei")
                            : l.denom === r.d
                              ? e.some(e => e.includes("-native"))
                              : l.denom === q.FG
                                ? e.includes(q.ue)
                                : e.some(e => Object.values(c.KDX).includes(e))
                                  ? (0, q.Fo)(l) && l.coinType === a.EfF
                                  : e.some(e => Object.values(c.f7g).includes(e))
                                    ? l.denom === a.KOY || ((0, q.Fo)(l) && l.coinType === a.EfF)
                                    : e.includes(l.denom.replace(/(cw20:|erc20\/)/g, "")) ||
                                      e.includes(l.denom.replace(/(cw20:|erc20\/)/g, "").toLowerCase()) ||
                                      (!!l.evmTokenContract &&
                                        (e.includes(l.evmTokenContract.replace(/(cw20:|erc20\/)/g, "")) ||
                                          e.includes(l.evmTokenContract.replace(/(cw20:|erc20\/)/g, "").toLowerCase()))) ||
                                      ((0, q.Fo)(l) && (e.includes(l.coinType) || e.includes(l.coinType.toLowerCase())))
                        ))
                );
              }, [eD, null == eU ? void 0 : eU.coinMinimalDenom, null == eU ? void 0 : eU.ibcDenom, eW]),
              [eq, eX] = (0, X.useState)(!1),
              [eK, eJ] = (0, X.useState)(!1),
              [e0, e1] = (0, X.useState)(!1),
              [e2] = (0, o.fOz)(),
              { handleSwapClick: e6 } = (0, k.a)(),
              e3 = (0, X.useMemo)(() => Object.assign({}, eg.allDenoms, en.N9.denoms), [eg.allDenoms, en.N9.denoms]),
              {
                info: e9,
                ChartDays: e5,
                chartData: e7,
                loadingCharts: e4,
                loadingPrice: e8,
                errorCharts: le,
                errorInfo: ll,
                setSelectedDays: ln,
                selectedDays: li,
                denomInfo: lt
              } = (0, o.$QZ)({
                denoms: e3,
                denom: eD,
                tokenChain: eS ?? "cosmos",
                compassParams: { isCompassWallet: !1 },
                coingeckoIdsStore: ee.ec,
                percentageChangeDataStore: ev,
                priceStore: ep
              }),
              la = lt ?? {
                chain: (null == eU ? void 0 : eU.chain) ?? "",
                coinDenom: (null == eU ? void 0 : eU.symbol) ?? (null == eU ? void 0 : eU.name) ?? (null == eU ? void 0 : eU.coinMinimalDenom) ?? "",
                coinMinimalDenom: (null == eU ? void 0 : eU.coinMinimalDenom) ?? "",
                coinDecimals: (null == eU ? void 0 : eU.coinDecimals) ?? 6,
                icon: (null == eU ? void 0 : eU.img) ?? "",
                coinGeckoId: (null == eU ? void 0 : eU.coinGeckoId) ?? ""
              },
              ls = (null == la ? void 0 : la.icon) ?? (null == eY ? void 0 : eY.image);
            (0, M.a)(D.q.AssetDetails, !0, { pageViewSource: eZ, tokenName: la.coinDenom });
            let [lr] = (0, o.X$P)(),
              { data: lo } = (0, o.ZbK)(null == la ? void 0 : la.coinGeckoId),
              [lc, ld] = (0, X.useMemo)(() => {
                var e, l;
                let n = null == lo ? void 0 : null === (e = lo.find(e => "website" === e.type)) || void 0 === e ? void 0 : e.url,
                  i = null == lo ? void 0 : null === (l = lo.find(e => "twitter" === e.type)) || void 0 === l ? void 0 : l.url;
                return [n, i];
              }, [lo]),
              lx = (0, X.useMemo)(() => {
                var e;
                return (
                  ("noble" === la.chain && "uusdn" === la.coinMinimalDenom) ||
                  !eQ ||
                  (null == eL ? void 0 : null === (e = eL.all_chains) || void 0 === e ? void 0 : e.swap) === "disabled"
                );
              }, [la.chain, la.coinMinimalDenom, eQ, null == eL ? void 0 : null === (l = eL.all_chains) || void 0 === l ? void 0 : l.swap]),
              {
                data: lm,
                isLoading: lu,
                error: lh
              } = (0, g.useQuery)(
                ["chartData", null == eY ? void 0 : eY.id, li],
                async () => {
                  if (li && (null == eY ? void 0 : eY.id))
                    try {
                      let e = new Date();
                      e.setDate(1), e.setMonth(1), e.setFullYear(e.getFullYear());
                      let l = (0, Z.Z)(new Date(), e),
                        n = await o.rNU.getMarketChart(
                          null == eY ? void 0 : eY.id,
                          (null == la ? void 0 : la.chain) ?? "cosmos",
                          "YTD" === li ? l : e5[li],
                          o.r95[lr].currencyPointer
                        );
                      if (n) {
                        let { data: e, minMax: l } = n;
                        return { chartData: e, minMax: l };
                      }
                    } catch (e) {
                      (0, h.Tb)(e, {
                        tags: {
                          errorType: "chart_data_error",
                          source: "chart_data",
                          severity: "error",
                          errorName: e instanceof Error ? e.name : "ChartDataError"
                        },
                        fingerprint: ["chart_data", "chart_data_error"],
                        level: "error",
                        contexts: { transaction: { type: "chart_data", errorMessage: e instanceof Error ? e.message : String(e) } },
                        extra: {
                          tokenId: null == eY ? void 0 : eY.id,
                          selectedDays: li,
                          chain: null == la ? void 0 : la.chain,
                          coinGeckoId: null == la ? void 0 : la.coinGeckoId,
                          coinMinimalDenom: null == la ? void 0 : la.coinMinimalDenom,
                          coinDecimals: null == la ? void 0 : la.coinDecimals,
                          currency: lr,
                          currencyPointer: o.r95[lr].currencyPointer
                        }
                      });
                    }
                },
                { enabled: !!(null == eY ? void 0 : eY.id), retry: 2, staleTime: 0, cacheTime: 3e5 }
              ),
              {
                chartsData: lg,
                chartsLoading: lf,
                chartsErrors: lv
              } = (0, X.useMemo)(
                () => ("cg" === eb ? { chartsData: lm, chartsLoading: lu, chartsErrors: lh } : { chartsData: e7, chartsLoading: e4, chartsErrors: le }),
                [eb, lm, e7, le, lh, e4, lu]
              ),
              {
                price: lp,
                details: lb,
                priceChange: lj
              } = {
                price: (null == e9 ? void 0 : e9.price) ?? (null == eY ? void 0 : eY.current_price) ?? (null == eU ? void 0 : eU.usdPrice),
                details: null == e9 ? void 0 : e9.details,
                priceChange: (null == e9 ? void 0 : e9.priceChange) ?? (null == eY ? void 0 : eY.price_change_percentage_24h)
              },
              { chartData: lw, minMax: ly } = lg ?? { chartData: void 0, minMax: void 0 },
              lk = null == eU ? void 0 : eU.usdValue,
              lC =
                (null === (n = ew[null == eU ? void 0 : eU.tokenBalanceOnChain]) || void 0 === n ? void 0 : n.chainName) ??
                (null == eU ? void 0 : eU.tokenBalanceOnChain) ??
                (null === (i = ew[eS]) || void 0 === i ? void 0 : i.chainName) ??
                eS,
              lN = (0, X.useMemo)(() => {
                var e, l, n, i;
                return (
                  (null === (e = ew[null == eU ? void 0 : eU.tokenBalanceOnChain]) || void 0 === e ? void 0 : e.chainSymbolImageUrl) ??
                  (null === (l = c.oCA[null == eU ? void 0 : eU.tokenBalanceOnChain]) || void 0 === l ? void 0 : l.chainSymbolImageUrl) ??
                  (null === (n = ew[null == la ? void 0 : la.chain]) || void 0 === n ? void 0 : n.chainSymbolImageUrl) ??
                  (null === (i = c.oCA[null == la ? void 0 : la.chain]) || void 0 === i ? void 0 : i.chainSymbolImageUrl)
                );
              }, [ew, null == la ? void 0 : la.chain, null == eU ? void 0 : eU.tokenBalanceOnChain]);
            (0, T._)(ea.t);
            let lD = (0, P.a)(),
              lS = (0, o.obn)(),
              lZ = (0, X.useMemo)(() => ("aggregated" === ey ? "mainnet" : lS), [lS, ey]),
              [l_] = (0, o.JsT)(eg.allDenoms, la.chain, lZ),
              lM = (0, o.Xmk)({
                checkForExistenceType: "comingSoon",
                feature: "stake",
                platform: "Extension",
                forceChain: (null == eU ? void 0 : eU.ibcDenom) ? (null == eU ? void 0 : eU.chain) : eH,
                forceNetwork: lZ
              }),
              lL = (0, o.Xmk)({
                checkForExistenceType: "notSupported",
                feature: "stake",
                platform: "Extension",
                forceChain: (null == eU ? void 0 : eU.ibcDenom) ? (null == eU ? void 0 : eU.chain) : eH,
                forceNetwork: lZ
              }),
              lz = (0, X.useMemo)(() => {
                var e;
                return (
                  lM ||
                  lL ||
                  !!(null === (e = ew[eH]) || void 0 === e ? void 0 : e.evmOnlyChain) ||
                  (null == l_ ? void 0 : l_.coinMinimalDenom) !== (null == eU ? void 0 : eU.coinMinimalDenom)
                );
              }, [eH, null == l_ ? void 0 : l_.coinMinimalDenom, ew, lM, lL, null == eU ? void 0 : eU.coinMinimalDenom]),
              { data: lE = {} } = (0, o.ViV)(),
              lB = lE[null == l_ ? void 0 : l_.coinDenom],
              lT = (0, X.useMemo)(() => {
                if ("1D" === li && lj) return Number(lj);
                if (lw && lw.length > 0) {
                  let e = lw[0].smoothedPrice;
                  return ((lp - e) / e) * 100;
                }
              }, [lw, lp, lj, li]),
              lI = (0, X.useMemo)(() => {
                let e = new f.BigNumber(lp ?? 0).dividedBy(1 + (lT ?? 0) / 100);
                return new f.BigNumber(lp ?? 0).minus(e).toNumber();
              }, [lp, lT]);
            (0, o.QSC)(eH);
            let lP = () => {
              var e;
              let l = { mode: "DELEGATE", forceChain: eH, forceNetwork: lZ };
              sessionStorage.setItem("navigate-stake-input-state", JSON.stringify(l)),
                0 === ((null === (e = es.fe.validatorsForChain(eH).validatorData) || void 0 === e ? void 0 : e.validators) ?? []).length &&
                  es.fe.loadValidators(eH, lZ),
                e_("/stake/input", { state: l });
            };
            return ((0, X.useEffect)(() => {
              async function e() {
                try {
                  let e = await eI("noble"),
                    l = (await e.getAccounts())[0].address,
                    n = await (0, c.Hpw)((null == e$ ? void 0 : e$.apis.rest) ?? "", l),
                    i = new f.BigNumber(null == n ? void 0 : n.claimable_amount);
                  i.gt(0) ? eT((0, c.TGo)(i.toFixed(0))) : eT("0");
                } catch (e) {
                  (0, h.Tb)(e, {
                    tags: {
                      errorType: "get_earn_yield_error",
                      source: "get_earn_yield",
                      severity: "error",
                      errorName: e instanceof Error ? e.name : "GetEarnYieldError"
                    },
                    fingerprint: ["get_earn_yield", "get_earn_yield_error"],
                    level: "error",
                    contexts: { transaction: { type: "get_earn_yield", errorMessage: e instanceof Error ? e.message : String(e) } },
                    extra: { chain: null == e$ ? void 0 : e$.chainName, chainId: null == e$ ? void 0 : e$.chainId }
                  });
                }
              }
              "noble" === la.chain && "uusdn" === la.coinMinimalDenom && e();
            }, [la.chain, la.coinMinimalDenom, eI, null == e$ ? void 0 : e$.apis.rest, eF]),
            eF && "noble" === la.chain && "uusdn" === la.coinMinimalDenom)
              ? (0, t.jsx)(V.Z, {
                  onClose: () => {
                    eA(void 0), eO(!1);
                  },
                  txHash: eF,
                  txType: "claim"
                })
              : (0, t.jsxs)(t.Fragment, {
                  children: [
                    (0, t.jsxs)(j.m, {
                      className: "absolute",
                      children: [
                        (0, t.jsx)(d.X, {
                          className: "size-9 p-2 cursor-pointer text-muted-foreground hover:text-foreground",
                          onClick: () => {
                            sessionStorage.removeItem("navigate-assetDetails-state"), e_(-1);
                          }
                        }),
                        (0, t.jsx)(C.Z, {
                          className: "text-[18px] font-bold !leading-6",
                          color: "text-monochrome",
                          children: (0, eo.kC)(
                            (null == eU ? void 0 : eU.symbol) ??
                              (null == la ? void 0 : la.coinDenom) ??
                              (null == la ? void 0 : la.name) ??
                              (null == eY ? void 0 : eY.symbol)
                          )
                        }),
                        (0, t.jsx)("div", { className: "w-9 h-9" })
                      ]
                    }),
                    (0, t.jsxs)("div", {
                      className: p()("relative bg-secondary-50 pt-16"),
                      children: [
                        "noble" === la.chain &&
                          "uusdc" === la.coinMinimalDenom &&
                          ez &&
                          (0, t.jsxs)("div", {
                            className: "bg-secondary-100 p-[14px] pl-5 mb-11 flex items-center cursor-pointer",
                            onClick: () => {
                              "false" !== et.I.show ? e_("/home?openEarnUSDN=true", { replace: !0 }) : e_("/earn-usdn");
                            },
                            children: [
                              (0, t.jsxs)("div", {
                                className: "flex items-center gap-3 w-full",
                                children: [
                                  (0, t.jsx)("img", { src: U.r.Logos.USDCLogo, className: "w-9 h-9" }),
                                  (0, t.jsxs)(C.Z, {
                                    className: "!inline font-bold",
                                    size: "md",
                                    color: "dark:text-white-100 text-black-100",
                                    children: [
                                      "Earn up to",
                                      " ",
                                      (0, t.jsxs)("span", {
                                        className: "text-green-600 font-bold",
                                        children: [
                                          parseFloat(
                                            null === (H = el.Wb.data) || void 0 === H ? void 0 : null === (v = H.noble) || void 0 === v ? void 0 : v.usdnEarnApy
                                          ) > 0
                                            ? new f.BigNumber(el.Wb.data.noble.usdnEarnApy).multipliedBy(100).toFixed(2) + "%"
                                            : "-",
                                          "\xa0APY"
                                        ]
                                      }),
                                      " ",
                                      "with USDC"
                                    ]
                                  })
                                ]
                              }),
                              (0, t.jsx)(x.X, {
                                size: 18,
                                className: "dark:text-gray-700 text-gray-400",
                                onClick: e => {
                                  e.stopPropagation(), eE(!1), ei.S.setShow("false");
                                }
                              })
                            ]
                          }),
                        (0, t.jsx)("div", {
                          className: "flex flex-col items-center px-6 pt-5 pb-3",
                          children:
                            ("cg" !== eb && !e8) || ("cg" === eb && eY)
                              ? (0, t.jsxs)(t.Fragment, {
                                  children: [
                                    (0, t.jsx)(C.Z, {
                                      size: "xxl",
                                      color: "text-black-100 dark:text-white-100",
                                      className: "font-bold",
                                      children: lp && new f.BigNumber(lp).gt(0) ? e2(new f.BigNumber(lp), 5) : "-"
                                    }),
                                    lf
                                      ? (0, t.jsx)(K.Z, { width: 80, containerClassName: "h-4" })
                                      : !!lT &&
                                        (0, t.jsx)("div", {
                                          className: p()("text-xs font-bold ", {
                                            "text-green-600 dark:text-green-600": !lT || lT >= 0,
                                            "text-red-600 dark:text-red-400": lT && lT < 0
                                          }),
                                          children: `${lI > 0 ? "+" : "-"}${e2(new f.BigNumber(lI).abs(), 2)} (${(0, o._6x)(new f.BigNumber(lT).toString(), 2)}%)`
                                        })
                                  ]
                                })
                              : (0, t.jsxs)(t.Fragment, { children: [(0, t.jsx)(K.Z, { width: 90, height: 36 }), (0, t.jsx)(K.Z, { width: 80 })] })
                        }),
                        (0, t.jsxs)("div", {
                          className: "flex flex-col gap-y-5 items-center",
                          children: [
                            lv || ll
                              ? (0, t.jsx)(ed.c, {})
                              : (0, t.jsx)(t.Fragment, {
                                  children: lf
                                    ? (0, t.jsx)(ec.Z, {})
                                    : lw && lw.length > 0
                                      ? (0, t.jsx)(
                                          em.R,
                                          { chainColor: "#70B7FF", chartData: lw, loadingCharts: lf, price: lp, minMax: ly, selectedDays: li },
                                          li
                                        )
                                      : (0, t.jsx)(ed.c, {})
                                }),
                            !lf &&
                              lw &&
                              lw.length > 0 &&
                              lp &&
                              (0, t.jsx)("div", {
                                className: "flex justify-between gap-x-2 overflow-scroll hide-scrollbar",
                                children: Object.keys(e5).map((e, l) =>
                                  (0, t.jsx)(
                                    "div",
                                    {
                                      className: p()("rounded-2xl py-1.5 px-4 text-xs hover:cursor-pointer ", {
                                        "bg-gray-100 text-black-100 dark:bg-gray-900 dark:text-white-100 font-bold": e === li,
                                        "text-gray-700 dark:text-gray-400 font-medium": e !== li
                                      }),
                                      onClick: () => {
                                        ln(e);
                                      },
                                      children: e
                                    },
                                    l
                                  )
                                )
                              })
                          ]
                        }),
                        (0, t.jsxs)("div", {
                          className: "flex flex-col gap-5 w-full p-6",
                          children: [
                            "noble" !== la.chain || "uusdn" !== la.coinMinimalDenom
                              ? (0, t.jsxs)(t.Fragment, {
                                  children: [
                                    (null == ek ? void 0 : ek.walletType) !== o._KQ.WATCH_WALLET
                                      ? (0, t.jsxs)("div", {
                                          className: "flex gap-9 justify-center w-full",
                                          children: [
                                            (0, t.jsx)(b.Z, {
                                              label: "Send",
                                              icon: G.M,
                                              onClick: () => {
                                                var e, l;
                                                let n = (0, o.QBt)(
                                                    (null == eU ? void 0 : eU.ibcDenom) || (null == la ? void 0 : la.coinMinimalDenom) || "",
                                                    (null === (e = ew[(null == la ? void 0 : la.chain) ?? ""]) || void 0 === e ? void 0 : e.chainId) ?? ""
                                                  ),
                                                  i = null === (l = ew[eH]) || void 0 === l ? void 0 : l.chainId,
                                                  t = `assetCoinDenom=${n}&holderChain=${eH}`;
                                                i && (t += `&chainId=${i}`), e_(`/send?${t}`, { state: eG.state });
                                              }
                                            }),
                                            (0, t.jsx)(b.Z, { label: "Receive", icon: A.I, onClick: () => ej.set("receive", "true") }),
                                            (0, t.jsx)(b.Z, {
                                              label: "Swap",
                                              icon: $.d,
                                              onClick: () => {
                                                var e;
                                                let l = (null == eU ? void 0 : eU.ibcDenom) || (null == la ? void 0 : la.coinMinimalDenom) || "";
                                                (null == l ? void 0 : l.startsWith("0x")) && (l = (0, s.getAddress)(l));
                                                let n = (0, o.QBt)(
                                                  l,
                                                  (null === (e = ew[(null == la ? void 0 : la.chain) ?? ""]) || void 0 === e ? void 0 : e.chainId) ?? ""
                                                );
                                                e6(
                                                  `${S.Wc}&destinationChainId=${ew[eH].chainId}&destinationAsset=${l}`,
                                                  `/swap?destinationChainId=${ew[eH].chainId}&destinationToken=${n}&pageSource=assetDetails`
                                                );
                                              },
                                              disabled: lx
                                            }),
                                            (0, t.jsx)(b.Z, {
                                              label: "Stake",
                                              icon: F.P,
                                              onClick: () => {
                                                (null == eU ? void 0 : eU.ibcDenom) ? eJ(!0) : (null == lB ? void 0 : lB.length) > 0 ? e1(!0) : lP();
                                              },
                                              disabled: lz
                                            })
                                          ]
                                        })
                                      : null,
                                    (0, t.jsxs)("div", {
                                      className: "flex flex-col gap-3",
                                      children: [
                                        (0, t.jsx)(C.Z, {
                                          size: "sm",
                                          color: "text-muted-foreground",
                                          className: "font-bold !leading-5",
                                          children: "Your Balance"
                                        }),
                                        (0, t.jsxs)("div", {
                                          className: "flex bg-secondary-100 border-secondary-200 border rounded-2xl p-4 gap-2",
                                          children: [
                                            (0, t.jsxs)("div", {
                                              className: "relative w-[40px] h-[40px] flex items-center justify-center",
                                              children: [
                                                (0, t.jsx)(N.m, {
                                                  assetImg: ls,
                                                  text: null == la ? void 0 : la.coinDenom,
                                                  altText: null == la ? void 0 : la.coinDenom,
                                                  imageClassName: "w-[30px] h-[30px] rounded-full shrink-0",
                                                  containerClassName: "w-[30px] h-[30px] rounded-full shrink-0 !bg-gray-200 dark:!bg-gray-800",
                                                  textClassName: "text-[8.34px] !leading-[11px]"
                                                }),
                                                (0, t.jsx)("img", {
                                                  src: lN,
                                                  onError: (0, er._)(lD),
                                                  className: "w-[15px] h-[15px] absolute bottom-[3px] right-[3px] rounded-full bg-white-100 dark:bg-black-100"
                                                })
                                              ]
                                            }),
                                            (0, t.jsxs)("div", {
                                              className: "flex flex-col grow ",
                                              children: [
                                                (0, t.jsx)(C.Z, {
                                                  size: "md",
                                                  color: "text-monochrome",
                                                  className: "font-bold !leading-6",
                                                  children: (null == la ? void 0 : la.name) ?? (null == la ? void 0 : la.coinDenom)
                                                }),
                                                (0, t.jsx)(C.Z, {
                                                  size: "xs",
                                                  color: "text-muted-foreground",
                                                  className: "font-medium !leading-4",
                                                  children: lC ?? (null == eY ? void 0 : eY.name)
                                                })
                                              ]
                                            }),
                                            (0, t.jsxs)("div", {
                                              className: "flex flex-col items-end justify-between py-[1px]",
                                              children: [
                                                (0, t.jsx)(C.Z, {
                                                  size: "sm",
                                                  color: "text-monochrome",
                                                  className: "font-bold !leading-5",
                                                  children: lk ? e2(new f.BigNumber(lk), 5) : "-"
                                                }),
                                                (0, t.jsx)(C.Z, {
                                                  size: "xs",
                                                  color: "text-gray-600 dark:text-gray-400 text-right",
                                                  className: "font-medium",
                                                  children: (0, o.LHZ)(
                                                    (null == eU ? void 0 : null === (eu = eU.amount) || void 0 === eu ? void 0 : eu.toString()) ?? "",
                                                    null == la ? void 0 : la.coinDenom,
                                                    5
                                                  )
                                                })
                                              ]
                                            })
                                          ]
                                        })
                                      ]
                                    })
                                  ]
                                })
                              : (0, t.jsxs)("div", {
                                  className: "flex flex-col gap-3",
                                  children: [
                                    (0, t.jsx)(C.Z, {
                                      size: "sm",
                                      color: "text-muted-foreground",
                                      className: "font-bold !leading-5 mt-3",
                                      children: "Your Balance"
                                    }),
                                    (0, t.jsxs)("div", {
                                      className: "flex flex-col bg-secondary-100 border-secondary-200 border rounded-lg p-4 gap-y-4",
                                      children: [
                                        (0, t.jsxs)("div", {
                                          className: "flex gap-x-2 items-center",
                                          children: [
                                            (0, t.jsxs)("div", {
                                              className: "relative w-[50px] h-[40px] flex items-center justify-center",
                                              children: [
                                                (0, t.jsx)(N.m, {
                                                  assetImg: ls,
                                                  text: null == la ? void 0 : la.coinDenom,
                                                  altText: null == la ? void 0 : la.coinDenom,
                                                  imageClassName: "w-[30px] h-[30px] rounded-full shrink-0",
                                                  containerClassName: "w-[30px] h-[30px] rounded-full shrink-0 !bg-gray-200 dark:!bg-gray-800",
                                                  textClassName: "text-[8.34px] !leading-[11px]"
                                                }),
                                                (0, t.jsx)("img", {
                                                  src: lN,
                                                  onError: (0, er._)(lD),
                                                  className: "w-[15px] h-[15px] absolute bottom-[3px] right-[3px] rounded-full bg-white-100 dark:bg-black-100"
                                                })
                                              ]
                                            }),
                                            (0, t.jsxs)("div", {
                                              className: "flex flex-row items-center justify-between w-full",
                                              children: [
                                                (0, t.jsxs)("div", {
                                                  className: "flex flex-col items-start",
                                                  children: [
                                                    (0, t.jsx)("div", {
                                                      className: "flex items-center gap-x-1.5",
                                                      children: (0, t.jsx)(C.Z, {
                                                        size: "md",
                                                        color: "text-black-100 dark:text-white-100",
                                                        className: "font-bold",
                                                        children: (null == la ? void 0 : la.name) ?? (null == la ? void 0 : la.coinDenom)
                                                      })
                                                    }),
                                                    (0, t.jsx)(C.Z, {
                                                      size: "xs",
                                                      color: "text-gray-600 dark:text-gray-400",
                                                      children: lC ?? (null == eY ? void 0 : eY.name)
                                                    })
                                                  ]
                                                }),
                                                (0, t.jsxs)("div", {
                                                  className: "flex flex-col items-end gap-y-1",
                                                  children: [
                                                    (0, t.jsx)(C.Z, {
                                                      size: "md",
                                                      color: "text-black-100 dark:text-white-100",
                                                      className: "font-bold",
                                                      children: lk ? e2(new f.BigNumber(lk), 5) : "-"
                                                    }),
                                                    (0, t.jsx)(C.Z, {
                                                      size: "xs",
                                                      color: "text-gray-600 dark:text-gray-400 text-right",
                                                      className: "font-medium",
                                                      children: (0, o.LHZ)(
                                                        (null == eU ? void 0 : null === (eh = eU.amount) || void 0 === eh ? void 0 : eh.toString()) ?? "",
                                                        null == la ? void 0 : la.coinDenom,
                                                        5
                                                      )
                                                    })
                                                  ]
                                                })
                                              ]
                                            })
                                          ]
                                        }),
                                        (0, t.jsx)("div", { className: "h-[1px] w-full dark:bg-gray-850 bg-gray-200" }),
                                        (0, t.jsxs)("div", {
                                          className: "flex flex-row h-[56px] p-1 gap-x-2",
                                          children: [
                                            (0, t.jsx)("button", {
                                              onClick: () => {
                                                e_("/earn-usdn");
                                              },
                                              className:
                                                "flex flex-row gap-x-2 items-center justify-center h-full w-full p-3 bg-secondary-300 hover:bg-secondary-400 rounded-full",
                                              "aria-label": "deposit button in chart details",
                                              children: (0, t.jsx)(C.Z, {
                                                size: "xs",
                                                color: "text-black-100 dark:text-white-100",
                                                className: "font-bold",
                                                children: (0, t.jsx)("span", { "aria-label": "deposit button text in chart details", children: "Deposit" })
                                              })
                                            }),
                                            (0, t.jsx)("button", {
                                              onClick: () => {
                                                e_("/earn-usdn?withdraw=true");
                                              },
                                              className:
                                                "flex flex-row gap-x-2 items-center justify-center h-full w-full p-3 bg-secondary-300 hover:bg-secondary-400 rounded-full",
                                              "aria-label": "withdraw button in chart details",
                                              children: (0, t.jsx)(C.Z, {
                                                size: "xs",
                                                color: "text-black-100 dark:text-white-100",
                                                className: "font-bold",
                                                children: (0, t.jsx)("span", { "aria-label": "withdraw button text in chart details", children: "Withdraw" })
                                              })
                                            }),
                                            (0, t.jsx)("button", {
                                              onClick: () => {
                                                e_(
                                                  `/send?assetCoinDenom=${(null == eU ? void 0 : eU.ibcDenom) || (null == la ? void 0 : la.coinMinimalDenom)}`,
                                                  { state: eG.state }
                                                );
                                              },
                                              className: p()(
                                                "flex flex-row gap-x-2 items-center justify-center h-full w-full p-3 bg-secondary-300 hover:bg-secondary-400 rounded-full"
                                              ),
                                              "aria-label": "send button in chart details",
                                              children: (0, t.jsx)(C.Z, {
                                                size: "xs",
                                                color: "text-black-100 dark:text-white-100",
                                                className: "font-bold",
                                                children: (0, t.jsx)("span", { "aria-label": "send button text in chart details", children: "Send" })
                                              })
                                            })
                                          ]
                                        })
                                      ]
                                    }),
                                    (0, t.jsxs)("div", {
                                      className: "flex flex-col gap-y-3 mt-4",
                                      children: [
                                        (0, t.jsx)(C.Z, {
                                          size: "sm",
                                          color: "text-gray-600 dark:text-gray-400",
                                          className: "font-bold",
                                          children: "Your rewards"
                                        }),
                                        (0, t.jsxs)("div", {
                                          className: "flex flex-col bg-secondary-100 border-secondary-200 border rounded-lg",
                                          children: [
                                            (0, t.jsx)("div", {
                                              className: "flex py-5 px-6 w-full",
                                              children: (0, t.jsxs)("div", {
                                                className: "flex flex-col w-1/2 gap-2",
                                                children: [
                                                  (0, t.jsx)(C.Z, { size: "xs", color: "dark:text-gray-400 text-gray-600", children: "Claimable rewards" }),
                                                  (0, t.jsx)(C.Z, {
                                                    size: "lg",
                                                    color: "text-green-500",
                                                    className: "font-bold",
                                                    children: e2(new f.BigNumber(eB))
                                                  })
                                                ]
                                              })
                                            }),
                                            (0, t.jsx)("div", { className: "h-[1px] w-full dark:bg-gray-850 bg-gray-200" }),
                                            (0, t.jsx)("div", {
                                              className: "px-6 py-5",
                                              children: (0, t.jsx)("button", {
                                                onClick: () => {
                                                  eO(!0);
                                                },
                                                className: p()(
                                                  "flex flex-row gap-x-2 items-center justify-center h-full w-full p-4 bg-secondary-300 hover:bg-secondary-400 rounded-full cursor-pointer",
                                                  { "!cursor-not-allowed opacity-75": !new f.BigNumber(eB).gt(1e-5) }
                                                ),
                                                disabled: !new f.BigNumber(eB).gt(1e-5),
                                                "aria-label": "claim rewards button in chart details",
                                                children: (0, t.jsx)(C.Z, {
                                                  size: "xs",
                                                  color: "text-black-100 dark:text-white-100",
                                                  className: "font-bold",
                                                  children: (0, t.jsx)("span", {
                                                    "aria-label": "claim rewards button text in chart details",
                                                    children: "Claim rewards"
                                                  })
                                                })
                                              })
                                            })
                                          ]
                                        })
                                      ]
                                    })
                                  ]
                                }),
                            !e8 &&
                              lb &&
                              ("uusdn" !== la.coinMinimalDenom || "noble" !== la.chain) &&
                              (0, t.jsxs)("div", {
                                className: "flex flex-col gap-y-2",
                                children: [
                                  (0, t.jsxs)(C.Z, {
                                    size: "sm",
                                    color: "text-muted-foreground",
                                    className: "font-bold",
                                    children: ["About ", (null == la ? void 0 : la.name) ?? (0, eo.kC)(null == la ? void 0 : la.chain)]
                                  }),
                                  (0, t.jsx)(w.Z, { textProps: { size: "sm", className: "flex flex-column" }, readMoreColor: "#696969", children: lb })
                                ]
                              }),
                            "uusdn" === la.coinMinimalDenom && "noble" === la.chain
                              ? null
                              : (0, t.jsxs)("div", {
                                  className: "flex flex-row items-center gap-x-2",
                                  children: [
                                    lc &&
                                      (0, t.jsx)("a", {
                                        href: lc,
                                        target: "_blank",
                                        rel: "noreferrer",
                                        className: "px-3 py-1.5 rounded-[28px] border border-secondary-300",
                                        children: (0, t.jsxs)("div", {
                                          className: "flex flex-row items-center gap-x-1",
                                          children: [
                                            (0, t.jsx)(m.T, { size: 20, className: "text-foreground" }),
                                            (0, t.jsx)(C.Z, { size: "xs", color: "text-foreground", className: "font-medium", children: "Website" })
                                          ]
                                        })
                                      }),
                                    ld &&
                                      (0, t.jsx)("a", {
                                        href: ld,
                                        target: "_blank",
                                        rel: "noreferrer",
                                        className: "px-3 py-1.5 rounded-[28px] border border-secondary-300",
                                        children: (0, t.jsx)(u.S, { size: 20, className: "text-black-100 dark:text-white-100" })
                                      })
                                  ]
                                })
                          ]
                        })
                      ]
                    }),
                    (0, t.jsx)(y.Z, { forceChain: null == eU ? void 0 : eU.tokenBalanceOnChain }),
                    (0, t.jsx)(Y.Z, {
                      isVisible: e0,
                      title: "Stake",
                      onClose: () => e1(!1),
                      tokenLSProviders: lB,
                      handleStakeClick: lP,
                      rootDenomsStore: eg,
                      delegationsStore: es.xO,
                      validatorsStore: es.fe,
                      unDelegationsStore: es.GO,
                      claimRewardsStore: es.eq,
                      forceChain: eH,
                      forceNetwork: lZ
                    }),
                    (0, t.jsx)(W.Z, { isVisible: eq, onClose: () => eX(!1), chainTagsStore: ef }),
                    eK && eU && (0, t.jsx)(ex.Z, { isVisible: eK, ibcDenom: eU, onClose: () => eJ(!1), nativeDenom: l_ }),
                    eP &&
                      "noble" === la.chain &&
                      "uusdn" === la.coinMinimalDenom &&
                      (0, t.jsx)(R.Z, { amount: eB, denom: la, isOpen: eP, onClose: () => eO(!1), setTxHash: e => eA(e) })
                  ]
                });
          });
          i();
        } catch (e) {
          i(e);
        }
      });
    },
    79430: function (e, l, n) {
      n.d(l, { R: () => d });
      var i = n(52322),
        t = n(41172),
        a = n(92642),
        s = n(6391),
        r = n(2784),
        o = n(22157),
        c = n(46103);
      function d(e) {
        let { chartData: l, loadingCharts: n, price: d, minMax: x, chainColor: m, selectedDays: u } = e,
          [h] = (0, t.fOz)(),
          [g, f] = (0, r.useState)();
        return (
          (0, r.useEffect)(() => f(null == l ? void 0 : l.map(e => ({ data: e.price, key: new Date(e.timestamp), metadata: e.date }))), [l]),
          l && !n && d
            ? (0, i.jsx)(o.THM, {
                height: 128,
                xAxis: (0, i.jsx)(o.c7Z, {
                  tickSeries: (0, i.jsx)(o.S3h, { tickSize: 0, interval: 5, label: null, line: null }),
                  axisLine: (0, i.jsx)(o.PGn, { strokeWidth: 0, strokeColor: c.w.gray900 }),
                  type: "time"
                }),
                yAxis: (0, i.jsx)(o.tmX, {
                  tickSeries: (0, i.jsx)(o.T$2, { tickSize: 0, width: 0, interval: 5, label: null, line: null }),
                  axisLine: (0, i.jsx)(o.PGn, { strokeWidth: 0 })
                }),
                series: (0, i.jsx)(o.f62, {
                  markLine: (0, i.jsx)(o.Ipb, { strokeColor: m, strokeWidth: 1 }),
                  tooltip: (0, i.jsx)(o.sGf, {
                    tooltip: (0, i.jsx)(o.h7M, {
                      followCursor: !0,
                      placement: "auto",
                      modifiers: { offset: "5px, 5px" },
                      content: e => {
                        let l,
                          n = e.value + x[0].price,
                          t = new Date(e.key);
                        l =
                          "1Y" === u || "YTD" === u || "All" === u
                            ? t.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric" })
                            : t.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
                        try {
                          n = h(new s.BigNumber(n));
                        } catch (e) {
                          (0, a.Tb)(e, {
                            tags: {
                              errorType: "format_currency_error",
                              source: "format_currency",
                              severity: "error",
                              errorName: e instanceof Error ? e.name : "FormatCurrencyError"
                            },
                            fingerprint: ["format_currency", "format_currency_error"],
                            level: "error",
                            contexts: { transaction: { type: "format_currency", errorMessage: e instanceof Error ? e.message : String(e) } },
                            extra: { price: n }
                          });
                        }
                        return (0, i.jsxs)("div", { className: "text-xs font-medium !text-black-100 dark:!text-white-100", children: [n, " | ", l] });
                      }
                    })
                  }),
                  colorScheme: m,
                  interpolation: "smooth",
                  line: (0, i.jsx)(o.x12, { strokeWidth: 2 }),
                  area: (0, i.jsx)(o.uN9, {
                    gradient: (0, i.jsx)(o.phe, {
                      stops: [
                        (0, i.jsx)(o.oIo, { offset: "0", stopOpacity: 0, color: m }, 0),
                        (0, i.jsx)(o.oIo, { offset: "1", stopOpacity: 0.55, color: m }, 2)
                      ]
                    })
                  })
                }),
                gridlines: (0, i.jsx)(o.ALS, { line: (0, i.jsx)(o.aBy, { direction: "all", strokeWidth: 0 }) }),
                data: g
              })
            : (0, i.jsx)(i.Fragment, { children: d && (0, i.jsx)("div", { className: "h-auto" }) })
        );
      }
    },
    96818: function (e, l, n) {
      n.d(l, { Z: () => r });
      var i = n(52322),
        t = n(72779),
        a = n.n(t);
      n(2784);
      var s = n(86874);
      function r(e) {
        let { className: l } = e;
        return (0, i.jsx)("div", {
          className: a()("w-full", l),
          children: (0, i.jsxs)("div", {
            className: "flex flex-col gap-y-5 overflow-clip items-center",
            children: [
              (0, i.jsx)(s.Z, { className: "h-[128px] rounded-sm", containerClassName: "w-full block !leading-none" }),
              (0, i.jsx)(s.Z, { className: "h-[28px] rounded-full", containerClassName: "w-full px-10 block !leading-none" })
            ]
          })
        });
      }
    },
    88259: function (e, l, n) {
      n.a(e, async function (e, i) {
        try {
          n.d(l, { Z: () => N });
          var t = n(52322),
            a = n(41172),
            s = n(49183),
            r = n(72779),
            o = n.n(r),
            c = n(58885),
            d = n(51994),
            x = n(80588),
            m = n(42152),
            u = n(96217),
            h = n(69816),
            g = n(38313),
            f = n(65027),
            v = n(63242),
            p = n(97680),
            b = n.n(p),
            j = n(75958),
            w = n(2784),
            y = n(42799),
            k = n(48346),
            C = e([g, f, c, k, d, x]);
          [g, f, c, k, d, x] = C.then ? (await C)() : C;
          let N = (0, j.Pi)(e => {
            let { isOpen: l, onClose: n, denom: i, amount: r, setTxHash: p } = e,
              j = (0, g.ob)(),
              {
                setAmount: C,
                userPreferredGasLimit: N,
                recommendedGasLimit: D,
                setUserPreferredGasLimit: S,
                userPreferredGasPrice: Z,
                gasOption: _,
                setGasOption: M,
                setUserPreferredGasPrice: L,
                setFeeDenom: z,
                onReviewTransaction: E,
                txHash: B,
                isLoading: T,
                setError: I,
                error: P,
                ledgerError: O,
                showLedgerPopup: F
              } = (0, a.LTX)(y.gb.allDenoms, "claim"),
              A = f.w.useGetWallet(),
              [$, G] = (0, w.useState)(!1),
              [U, H] = (0, w.useState)(!1),
              R = (0, c.e7)(y.gb.allDenoms, { activeChain: "noble" }),
              [V, W] = (0, w.useState)(null),
              [Y, Q] = (0, w.useState)({ option: _, gasPrice: Z ?? R.gasPrice }),
              [q, X] = (0, w.useState)(),
              K = T || !!P || !!V || !!O || $,
              J = (0, w.useCallback)(async () => {
                G(!0);
                try {
                  let e = await A("noble");
                  E(e, () => {}, !1);
                } catch (e) {
                  I(e),
                    setTimeout(() => {
                      I(void 0);
                    }, 5e3);
                } finally {
                  G(!1);
                }
              }, [A, E, I]);
            (0, w.useEffect)(() => {
              B && p(B);
            }, [p, B]),
              (0, w.useEffect)(() => {
                Q({ option: _, gasPrice: R.gasPrice });
              }, [R.gasPrice.amount.toString(), R.gasPrice.denom]),
              (0, w.useEffect)(() => {
                Y.option && M(Y.option), Y.gasPrice && L(Y.gasPrice);
              }, [Y, M, L]);
            let ee = (0, w.useCallback)(
              (e, l) => {
                Q(e), z(l.denom);
              },
              [z]
            );
            return (
              (0, w.useEffect)(() => {
                C(r);
              }, [r, C]),
              (0, t.jsxs)(c.ZP, {
                recommendedGasLimit: D.toString(),
                gasLimit: (null == N ? void 0 : N.toString()) ?? D.toString(),
                setGasLimit: e => S(Number(e.toString())),
                gasPriceOption: Y,
                onGasPriceOptionChange: ee,
                error: V,
                setError: W,
                chain: "noble",
                network: j,
                rootDenomsStore: y.gb,
                rootBalanceStore: k.jZ,
                children: [
                  (0, t.jsx)(u.Z, {
                    title: "Confirm Transaction",
                    isOpen: l,
                    onClose: n,
                    className: "p-6 z-10",
                    children: (0, t.jsxs)("div", {
                      className: "flex flex-col gap-4 w-full",
                      children: [
                        (0, t.jsx)("div", {
                          className: "w-full bg-gray-50 dark:bg-gray-900 flex items-center justify-between p-4 gap-2 rounded-2xl mb-4",
                          children: (0, t.jsxs)("div", {
                            className: "flex items-center w-full gap-5",
                            children: [
                              (0, t.jsx)("img", { src: i.icon, className: "w-11 h-11" }),
                              (0, t.jsx)(h.Z, {
                                color: "text-black-100 dark:text-white-100",
                                size: "sm",
                                className: "font-bold",
                                children: (0, s.LH)(r, i.coinDenom, 5)
                              })
                            ]
                          })
                        }),
                        (0, t.jsx)(d.a, { setShowFeesSettingSheet: H }),
                        (P || V || O) && (0, t.jsx)("p", { className: "text-sm font-bold text-red-600 px-2 mt-2", children: P || V || O }),
                        (0, t.jsx)("button", {
                          className: o()("w-full text-md font-bold text-white-100 h-12 rounded-full cursor-pointer bg-green-600", {
                            "hover:bg-green-500 ": !K,
                            "opacity-40": K
                          }),
                          disabled: K,
                          onClick: J,
                          "aria-label": "confirm claim button in earn usdn review claim tx sheet flow",
                          children: $
                            ? (0, t.jsx)(b(), {
                                loop: !0,
                                autoplay: !0,
                                animationData: v,
                                rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
                                className: "h-[24px] w-[24px]"
                              })
                            : (0, t.jsx)("span", {
                                "aria-label": "confirm claim button text in earn usdn review claim tx sheet flow",
                                children: "Confirm Claim"
                              })
                        })
                      ]
                    })
                  }),
                  F && (0, t.jsx)(m.Z, { showLedgerPopup: F }),
                  (0, t.jsx)(x.k, { showFeesSettingSheet: U, onClose: () => H(!1), gasError: V })
                ]
              })
            );
          });
          i();
        } catch (e) {
          i(e);
        }
      });
    },
    68708: function (e, l, n) {
      n.d(l, { F: () => v, Z: () => p });
      var i = n(52322),
        t = n(41172),
        a = n(75377),
        s = n(26007),
        r = n(14281),
        o = n(23751),
        c = n(69816),
        d = n(26571),
        x = n(96128),
        m = n.n(x),
        u = n(29750),
        h = n(24542),
        g = n.n(h);
      n(2784);
      var f = n(49409);
      function v(e) {
        let { provider: l, backgroundColor: n, rootDenomsStore: r, activeChain: o, activeNetwork: x } = e,
          [h] = (0, t.JsT)(r.allDenoms, o, x);
        return (0, i.jsx)(a.GenericCard, {
          onClick: () => {
            window.open(l.url, "_blank"),
              g().track(d.B_.ButtonClick, { buttonType: "stake", buttonName: "liquid staking redirection", redirectURL: l.url, stakeToken: h.coinDenom });
          },
          className: `${n} w-full`,
          img: (0, i.jsx)("img", { src: l.image ?? u.GenericLight, onError: (0, f._)(u.GenericLight), width: 30, height: 30, className: "rounded-full mr-4" }),
          isRounded: !0,
          size: "md",
          title: (0, i.jsx)(c.Z, { size: "sm", color: "text-black-100 dark:text-white-100", className: "font-bold overflow-hidden", children: l.name }),
          subtitle: (0, i.jsx)(c.Z, {
            size: "xs",
            color: "dark:text-gray-400 text-gray-600",
            className: "font-medium",
            children: l.apy ? `APY ${m()((100 * l.apy).toString(), { precision: 2, symbol: "" }).format()}%` : "N/A"
          }),
          icon: (0, i.jsx)(s.O, { size: 16, weight: "bold", className: "dark:text-white-100 text-black-100" })
        });
      }
      function p(e) {
        let { isVisible: l, onClose: n, providers: t, rootDenomsStore: a, forceChain: s, forceNetwork: c } = e;
        return (0, i.jsx)(r.Z, {
          isOpen: l,
          onClose: n,
          closeOnBackdropClick: !0,
          title: "Select Provider",
          className: "p-6",
          children: (0, i.jsxs)("div", {
            className: "flex flex-col gap-y-4",
            children: [
              0 === t.length && (0, i.jsx)(o.KE, {}),
              t.length > 0 &&
                t.map(e =>
                  (0, i.jsxs)(
                    "div",
                    {
                      className: "relative",
                      children: [
                        e.priority &&
                          (0, i.jsx)("div", {
                            className:
                              "text-white-100 dark:text-white-100 absolute top-0 right-4 px-1.5 py-0.5 bg-green-600 rounded-b-[4px] text-[10px] font-bold",
                            children: "Promoted"
                          }),
                        (0, i.jsx)(v, {
                          provider: e,
                          backgroundColor: `${e.priority ? "!bg-[#29A87426]" : "bg-white-100 dark:bg-gray-950"}`,
                          rootDenomsStore: a,
                          activeChain: s,
                          activeNetwork: c
                        })
                      ]
                    },
                    e.name
                  )
                )
            ]
          })
        });
      }
    },
    87604: function (e, l, n) {
      n.d(l, { Z: () => g });
      var i = n(52322),
        t = n(41172),
        a = n(75377),
        s = n(63161),
        r = n(48272),
        o = n(96217),
        c = n(69816),
        d = n(96128),
        x = n.n(d),
        m = n(75958),
        u = n(2784),
        h = n(68708);
      let g = (0, m.Pi)(e => {
        let {
            isVisible: l,
            title: n,
            onClose: d,
            tokenLSProviders: m,
            handleStakeClick: g,
            rootDenomsStore: f,
            delegationsStore: v,
            validatorsStore: p,
            unDelegationsStore: b,
            claimRewardsStore: j,
            forceChain: w
          } = e,
          y = (0, t.a74)(),
          k = (0, u.useMemo)(() => w || y, [y, w]),
          C = f.allDenoms,
          N = v.delegationsForChain(k),
          D = p.validatorsForChain(k),
          S = b.unDelegationsForChain(k),
          Z = j.claimRewardsForChain(k),
          [_, M] = (0, u.useState)(!1),
          { minMaxApr: L } = (0, t.nDu)(C, N, D, S, Z),
          z = (0, u.useMemo)(() => {
            if (L) {
              let e = (L[0] + L[1]) / 2;
              return x()((100 * e).toString(), { precision: 2, symbol: "" }).format();
            }
            return null;
          }, [L]),
          E = (0, u.useMemo)(() => {
            if (!((null == m ? void 0 : m.length) > 0)) return "N/A";
            {
              let e = Math.max(...m.map(e => e.apy));
              return `APY ${x()((100 * e).toString(), { precision: 2, symbol: "" }).format()}%`;
            }
          }, [m]);
        return (0, i.jsx)(o.Z, {
          isOpen: l,
          onClose: () => {
            M(!1), d();
          },
          title: n,
          className: "p-6",
          children: (0, i.jsxs)("div", {
            className: "flex flex-col gap-y-4",
            children: [
              (0, i.jsx)(a.GenericCard, {
                className: "bg-white-100 dark:bg-gray-950",
                title: (0, i.jsx)(c.Z, { size: "sm", color: "text-gray-800 dark:text-white-100", children: "Stake" }),
                subtitle: (0, i.jsxs)(c.Z, { size: "xs", color: "text-gray-700 dark:text-gray-400", children: ["APR ", z, "%"] }),
                size: "md",
                isRounded: !0,
                title2: (0, i.jsx)("button", {
                  onClick: g,
                  className: "rounded-full text-xs font-bold text-white-100 dark:text-gray-900 dark:bg-white-100 bg-gray-900 px-4 py-2",
                  children: "Stake"
                })
              }),
              (null == m ? void 0 : m.length) > 0 &&
                (0, i.jsxs)("div", {
                  className: "flex flex-col gap-y-3 p-4 bg-white-100 dark:bg-gray-950 rounded-2xl",
                  children: [
                    (0, i.jsxs)("div", {
                      className: "flex justify-between",
                      children: [
                        (0, i.jsxs)("div", {
                          className: "flex flex-col",
                          children: [
                            (0, i.jsx)(c.Z, {
                              size: "sm",
                              color: "text-gray-800 dark:text-white-100",
                              className: "font-bold",
                              "aria-label": "stake select sheet liquid stake title in stake v2 flow",
                              children: "Liquid Stake"
                            }),
                            (0, i.jsx)(c.Z, {
                              size: "xs",
                              color: "text-gray-700 dark:text-gray-400",
                              "aria-label": "stake select sheet liquid stake subtitle in stake v2 flow",
                              children: E
                            })
                          ]
                        }),
                        (0, i.jsx)("span", {
                          onClick: () => M(!_),
                          className:
                            "rounded-full text-xs font-bold bg-gray-50 dark:bg-gray-900 py-1 px-3 cursor-pointer flex items-center text-black-100 dark:text-white-100",
                          "aria-label": "stake select sheet liquid stake button in stake v2 flow",
                          children: _
                            ? (0, i.jsx)(s.U, { size: 16, className: "text-black-100 dark:text-white-100" })
                            : (0, i.jsx)(r.p, { size: 16, className: "text-black-100 dark:text-white-100" })
                        })
                      ]
                    }),
                    _ &&
                      (0, i.jsx)(i.Fragment, {
                        children: (0, i.jsx)("div", {
                          className: "flex flex-col gap-y-4",
                          children:
                            m &&
                            m.map(e =>
                              (0, i.jsxs)(
                                "div",
                                {
                                  className: "relative",
                                  children: [
                                    e.priority &&
                                      (0, i.jsx)("div", {
                                        className:
                                          "text-white-100 dark:text-white-100 absolute top-0 right-4 px-1.5 py-0.5 bg-green-600 rounded-b-[4px] text-[10px] font-bold",
                                        children: "Promoted"
                                      }),
                                    (0, i.jsx)(
                                      h.F,
                                      { provider: e, backgroundColor: `${e.priority ? "!bg-[#29A87426]" : "bg-gray-50 dark:bg-gray-900"}`, rootDenomsStore: f },
                                      e.name
                                    )
                                  ]
                                },
                                e.name
                              )
                            )
                        })
                      })
                  ]
                })
            ]
          })
        });
      });
    },
    23490: function (e, l, n) {
      n.d(l, { S: () => o });
      var i = n(93407),
        t = n(53108),
        a = n(80075),
        s = n(72565),
        r = n.n(s);
      let o = new (class {
        async initEarnBannerShow() {
          "false" !== (await r().storage.local.get(t.Q8))[t.Q8] && this.setShow("true");
        }
        setShow(e) {
          (this.show = e), r().storage.local.set({ [t.Q8]: e });
        }
        constructor() {
          (0, i._)(this, "show", "false"), (0, a.ky)(this), this.initEarnBannerShow();
        }
      })();
    }
  }
]);
//# sourceMappingURL=7475.js.map
