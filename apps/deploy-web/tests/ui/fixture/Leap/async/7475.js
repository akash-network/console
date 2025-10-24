!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      l = new e.Error().stack;
    l &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[l] = "9fef3072-4a8a-4484-be83-e3d2ffbbe63e"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-9fef3072-4a8a-4484-be83-e3d2ffbbe63e"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.22.9" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["7475"],
  {
    23751: function (e, l, i) {
      i.d(l, { D: () => s, KE: () => a });
      var t = i(52322);
      i(2784);
      var n = i(86874);
      function s() {
        return (0, t.jsxs)("div", {
          className: "flex rounded-2xl bg-secondary gap-y-1.5 flex-col p-4 w-full",
          children: [(0, t.jsx)(n.Z, { className: "w-24 h-5" }), (0, t.jsx)(n.Z, { className: "w-80 h-10" }), (0, t.jsx)(n.Z, { className: "w-24 h-6" })]
        });
      }
      function a(e) {
        return (0, t.jsx)("div", {
          className: "flex flex-col gap-4 text-xs",
          children: Array.from({ length: e.count ?? 1 }).map((e, l) =>
            (0, t.jsxs)(
              "div",
              {
                className: "flex items-center px-4 py-3 bg-secondary-100 w-full rounded-xl gap-4",
                children: [
                  (0, t.jsx)(n.Z, { width: 36, height: 36, circle: !0 }),
                  (0, t.jsx)(n.Z, { width: 100, height: 12 }),
                  (0, t.jsxs)("div", {
                    className: "flex flex-col items-end ml-auto ",
                    children: [(0, t.jsx)(n.Z, { width: 40, height: 8 }), (0, t.jsx)(n.Z, { width: 48, height: 6 })]
                  })
                ]
              },
              l
            )
          )
        });
      }
    },
    69380: function (e, l, i) {
      i.d(l, { Z: () => o });
      var t = i(52322),
        n = i(2784),
        s = i(70514);
      let a = (0, n.forwardRef)((e, l) => {
        let { disabled: i, icon: n, label: a, className: o, ...r } = e;
        return (0, t.jsxs)("div", {
          className: (0, s.cn)("flex flex-col text-center justify-center", i && "opacity-40"),
          children: [
            (0, t.jsx)("button", {
              ref: l,
              ...r,
              disabled: i,
              className: (0, s.cn)(
                "mx-auto relative w-[3.25rem] h-[3.25rem] bg-secondary-100 hover:bg-secondary-200 transition-colors rounded-full text-center cursor-pointer disabled:cursor-not-allowed flex items-center justify-center",
                o
              ),
              children: (0, t.jsx)(n, { className: "size-6" })
            }),
            !!a && (0, t.jsx)("p", { className: "text-sm mt-2 tracking-wide font-bold", children: a })
          ]
        });
      });
      a.displayName = "ClickableIcon";
      let o = a;
    },
    41979: function (e, l, i) {
      i.d(l, { Z: () => a });
      var t = i(52322),
        n = i(2784),
        s = i(69816);
      function a(e) {
        let { children: l, textProps: i, readMoreColor: a } = e,
          [o, r] = (0, n.useState)(!0),
          c = l && l.length > 150;
        return (0, t.jsxs)("div", {
          children: [
            (0, t.jsx)(s.Z, {
              size: i.size,
              className: i.className,
              color: i.color,
              children: (0, t.jsx)("span", { children: o && c ? l.slice(0, 150).trim() + "..." : l })
            }),
            c &&
              (0, t.jsx)("span", {
                onClick: () => {
                  r(!o);
                },
                className: "hover:cursor-pointer font-bold",
                style: { color: a },
                children: o ? "Read more" : "Show less"
              })
          ]
        });
      }
    },
    13607: function (e, l, i) {
      i.d(l, { Z: () => s });
      var t = i(60431),
        n = i(55334);
      function s() {
        return (0, t.useQuery)(
          ["explore-tokens"],
          async () => {
            let e = await n.Z.get("https://api.leapwallet.io/market/changes?currency=USD&ecosystem=cosmos-ecosystem");
            return null == e ? void 0 : e.data;
          },
          { staleTime: 6e4, cacheTime: 3e5 }
        );
      }
    },
    39215: function (e, l, i) {
      i.d(l, { P: () => n });
      var t = i(52322);
      i(2784);
      let n = e =>
        (0, t.jsx)("svg", {
          width: "20",
          height: "20",
          viewBox: "0 0 20 20",
          fill: "none",
          xmlns: "http://www.w3.org/2000/svg",
          children: (0, t.jsx)("path", {
            d: "M9.99996 1.66666C5.39996 1.66666 1.66663 5.39999 1.66663 9.99999C1.66663 14.6 5.39996 18.3333 9.99996 18.3333C14.6 18.3333 18.3333 14.6 18.3333 9.99999C18.3333 5.39999 14.6 1.66666 9.99996 1.66666ZM11.175 15.075V15.5583C11.175 16.1667 10.675 16.6667 10.0666 16.6667H10.0583C9.44996 16.6667 8.94996 16.1667 8.94996 15.5583V15.0583C7.84163 14.825 6.85829 14.2167 6.44163 13.1917C6.24996 12.7333 6.60829 12.225 7.10829 12.225H7.30829C7.61663 12.225 7.86663 12.4333 7.98329 12.725C8.22496 13.35 8.85829 13.7833 10.075 13.7833C11.7083 13.7833 12.075 12.9667 12.075 12.4583C12.075 11.7667 11.7083 11.1167 9.84996 10.675C7.78329 10.175 6.36663 9.32499 6.36663 7.61666C6.36663 6.18332 7.52496 5.24999 8.95829 4.94166V4.44166C8.95829 3.83332 9.45829 3.33332 10.0666 3.33332H10.075C10.6833 3.33332 11.1833 3.83332 11.1833 4.44166V4.95832C12.3333 5.24166 13.0583 5.95832 13.375 6.84166C13.5416 7.29999 13.1916 7.78332 12.7 7.78332H12.4833C12.175 7.78332 11.925 7.56666 11.8416 7.26666C11.65 6.63332 11.125 6.22499 10.075 6.22499C8.82496 6.22499 8.07496 6.79166 8.07496 7.59166C8.07496 8.29166 8.61663 8.74999 10.3 9.18332C11.9833 9.61666 13.7833 10.3417 13.7833 12.4417C13.7666 13.9667 12.625 14.8 11.175 15.075Z",
            fill: "white"
          })
        });
    },
    40811: function (e, l, i) {
      i.d(l, { I: () => n });
      var t = i(52322);
      i(2784);
      let n = e =>
        (0, t.jsxs)("svg", {
          width: "20",
          height: "20",
          viewBox: "0 0 20 20",
          fill: "none",
          xmlns: "http://www.w3.org/2000/svg",
          children: [
            (0, t.jsxs)("g", {
              children: [
                (0, t.jsx)("mask", {
                  id: "mask0_2752_43897",
                  maskUnits: "userSpaceOnUse",
                  x: "0",
                  y: "0",
                  width: "24",
                  height: "24",
                  children: (0, t.jsx)("rect", { width: "24", height: "24", fill: "#D9D9D9" })
                }),
                (0, t.jsx)("g", {
                  mask: "url(#mask0_2752_43897)",
                  children: (0, t.jsx)("path", {
                    d: "M9.99998 17.9792C9.88887 17.9792 9.7847 17.9618 9.68748 17.9271C9.59026 17.8924 9.49998 17.8333 9.41665 17.75L4.74998 13.0833C4.5972 12.9305 4.52081 12.7361 4.52081 12.5C4.52081 12.2639 4.5972 12.0694 4.74998 11.9167C4.91665 11.75 5.11456 11.6701 5.34373 11.6771C5.5729 11.684 5.76387 11.7639 5.91665 11.9167L9.16665 15.1458V2.49999C9.16665 2.26388 9.24651 2.06596 9.40623 1.90624C9.56595 1.74652 9.76387 1.66666 9.99998 1.66666C10.2361 1.66666 10.434 1.74652 10.5937 1.90624C10.7535 2.06596 10.8333 2.26388 10.8333 2.49999V15.1458L14.0625 11.9167C14.2291 11.75 14.4271 11.6667 14.6562 11.6667C14.8854 11.6667 15.0833 11.75 15.25 11.9167C15.4028 12.0833 15.4791 12.2812 15.4791 12.5104C15.4791 12.7396 15.4028 12.9305 15.25 13.0833L10.5833 17.75C10.5 17.8333 10.4097 17.8924 10.3125 17.9271C10.2153 17.9618 10.1111 17.9792 9.99998 17.9792Z",
                    fill: "white"
                  })
                })
              ]
            }),
            (0, t.jsx)("defs", {
              children: (0, t.jsx)("clipPath", { id: "clip0_2752_43897", children: (0, t.jsx)("rect", { width: "20", height: "20", fill: "white" }) })
            })
          ]
        });
    },
    3890: function (e, l, i) {
      i.d(l, { d: () => n });
      var t = i(52322);
      i(2784);
      let n = e =>
        (0, t.jsxs)("svg", {
          width: "20",
          height: "20",
          viewBox: "0 0 20 20",
          fill: "none",
          xmlns: "http://www.w3.org/2000/svg",
          children: [
            (0, t.jsxs)("g", {
              children: [
                (0, t.jsx)("mask", {
                  id: "mask0_2752_43905",
                  maskUnits: "userSpaceOnUse",
                  x: "0",
                  y: "0",
                  width: "24",
                  height: "24",
                  children: (0, t.jsx)("rect", { width: "24", height: "24", fill: "#D9D9D9" })
                }),
                (0, t.jsx)("g", {
                  mask: "url(#mask0_2752_43905)",
                  children: (0, t.jsx)("path", {
                    d: "M4.85415 14.1667L6.43748 15.75C6.60415 15.9167 6.68401 16.1111 6.67706 16.3333C6.67012 16.5555 6.58331 16.75 6.41665 16.9167C6.24998 17.0694 6.05554 17.1493 5.83331 17.1562C5.61109 17.1632 5.41665 17.0833 5.24998 16.9167L2.24998 13.9167C2.16665 13.8333 2.10762 13.743 2.0729 13.6458C2.03817 13.5486 2.02081 13.4444 2.02081 13.3333C2.02081 13.2222 2.03817 13.118 2.0729 13.0208C2.10762 12.9236 2.16665 12.8333 2.24998 12.75L5.24998 9.74999C5.40276 9.59721 5.59373 9.52082 5.8229 9.52082C6.05206 9.52082 6.24998 9.59721 6.41665 9.74999C6.58331 9.91666 6.66665 10.1146 6.66665 10.3437C6.66665 10.5729 6.58331 10.7708 6.41665 10.9375L4.85415 12.5H16.6666C16.9028 12.5 17.1007 12.5799 17.2604 12.7396C17.4201 12.8993 17.5 13.0972 17.5 13.3333C17.5 13.5694 17.4201 13.7674 17.2604 13.9271C17.1007 14.0868 16.9028 14.1667 16.6666 14.1667H4.85415ZM15.1458 7.49999H3.33331C3.0972 7.49999 2.89929 7.42013 2.73956 7.26041C2.57984 7.10068 2.49998 6.90277 2.49998 6.66666C2.49998 6.43055 2.57984 6.23263 2.73956 6.07291C2.89929 5.91318 3.0972 5.83332 3.33331 5.83332H15.1458L13.5625 4.24999C13.3958 4.08332 13.316 3.88888 13.3229 3.66666C13.3298 3.44443 13.4166 3.24999 13.5833 3.08332C13.75 2.93054 13.9444 2.85068 14.1666 2.84374C14.3889 2.83679 14.5833 2.91666 14.75 3.08332L17.75 6.08332C17.8333 6.16666 17.8923 6.25693 17.9271 6.35416C17.9618 6.45138 17.9791 6.55555 17.9791 6.66666C17.9791 6.77777 17.9618 6.88193 17.9271 6.97916C17.8923 7.07638 17.8333 7.16666 17.75 7.24999L14.75 10.25C14.5972 10.4028 14.4062 10.4792 14.1771 10.4792C13.9479 10.4792 13.75 10.4028 13.5833 10.25C13.4166 10.0833 13.3333 9.88541 13.3333 9.65624C13.3333 9.42707 13.4166 9.22916 13.5833 9.06249L15.1458 7.49999Z",
                    fill: "white"
                  })
                })
              ]
            }),
            (0, t.jsx)("defs", {
              children: (0, t.jsx)("clipPath", { id: "clip0_2752_43905", children: (0, t.jsx)("rect", { width: "20", height: "20", fill: "white" }) })
            })
          ]
        });
    },
    66929: function (e, l, i) {
      i.d(l, { M: () => n });
      var t = i(52322);
      i(2784);
      let n = e =>
        (0, t.jsxs)("svg", {
          width: "20",
          height: "20",
          viewBox: "0 0 20 20",
          fill: "none",
          xmlns: "http://www.w3.org/2000/svg",
          children: [
            (0, t.jsxs)("g", {
              children: [
                (0, t.jsx)("mask", {
                  id: "mask0_2752_43893",
                  maskUnits: "userSpaceOnUse",
                  x: "0",
                  y: "0",
                  width: "24",
                  height: "24",
                  children: (0, t.jsx)("rect", { width: "24", height: "24", fill: "#D9D9D9" })
                }),
                (0, t.jsx)("g", {
                  mask: "url(#mask0_2752_43893)",
                  children: (0, t.jsx)("path", {
                    d: "M9.99998 18.3333C9.76387 18.3333 9.56595 18.2535 9.40623 18.0938C9.24651 17.934 9.16665 17.7361 9.16665 17.5V4.85418L5.91665 8.08334C5.76387 8.23612 5.5729 8.31598 5.34373 8.32293C5.11456 8.32987 4.91665 8.25001 4.74998 8.08334C4.5972 7.93057 4.52081 7.73612 4.52081 7.50001C4.52081 7.2639 4.5972 7.06945 4.74998 6.91668L9.41665 2.25001C9.49998 2.16668 9.59026 2.10765 9.68748 2.07293C9.7847 2.0382 9.88887 2.02084 9.99998 2.02084C10.1111 2.02084 10.2153 2.0382 10.3125 2.07293C10.4097 2.10765 10.5 2.16668 10.5833 2.25001L15.25 6.91668C15.4028 7.06945 15.4791 7.26043 15.4791 7.48959C15.4791 7.71876 15.4028 7.91668 15.25 8.08334C15.0833 8.25001 14.8854 8.33334 14.6562 8.33334C14.4271 8.33334 14.2291 8.25001 14.0625 8.08334L10.8333 4.85418V17.5C10.8333 17.7361 10.7535 17.934 10.5937 18.0938C10.434 18.2535 10.2361 18.3333 9.99998 18.3333Z",
                    fill: "white"
                  })
                })
              ]
            }),
            (0, t.jsx)("defs", {
              children: (0, t.jsx)("clipPath", { id: "clip0_2752_43893", children: (0, t.jsx)("rect", { width: "20", height: "20", fill: "white" }) })
            })
          ]
        });
    },
    25199: function (e, l, i) {
      i.d(l, { c: () => s });
      var t = i(52322);
      i(2784);
      let n = e =>
        (0, t.jsx)("svg", {
          width: "20",
          height: "20",
          viewBox: "0 0 20 20",
          fill: "none",
          xmlns: "http://www.w3.org/2000/svg",
          ...e,
          children: (0, t.jsx)("path", {
            fillRule: "evenodd",
            clipRule: "evenodd",
            d: "M7.83056 0.244078C7.50512 -0.0813592 6.97749 -0.0813592 6.65205 0.244078C5.13538 1.76074 4.28333 3.81778 4.28333 5.96268C4.28333 8.10757 5.13538 10.1646 6.65205 11.6812C6.66442 11.6937 6.67683 11.706 6.68927 11.7183L1.81705 18.6892C1.6391 18.9439 1.61752 19.2763 1.76107 19.5517C1.90462 19.8272 2.18947 20 2.50008 20H13.0627C13.3734 20 13.6582 19.8272 13.8017 19.5517C13.9453 19.2763 13.9237 18.9439 13.7458 18.6892L10.3182 13.7852C10.9827 13.9596 11.672 14.05 12.3707 14.05C14.5156 14.05 16.5726 13.1979 18.0893 11.6812C18.4147 11.3558 18.4147 10.8282 18.0893 10.5027L14.6613 7.07483L15.4585 3.88541C15.5295 3.60144 15.4462 3.30105 15.2393 3.09408C15.0323 2.88711 14.7319 2.8039 14.448 2.87488L11.2585 3.67206L7.83056 0.244078ZM7.27969 2.05022L10.4137 5.18418L13.1492 7.91972L16.2831 11.0537C15.1673 11.9112 13.7933 12.3833 12.3707 12.3833C10.6677 12.3833 9.03467 11.7068 7.83056 10.5027C6.62646 9.29867 5.95 7.66554 5.95 5.96268C5.95 4.54002 6.42215 3.16603 7.27969 2.05022ZM7.78143 13.0649L11.4637 18.3333H4.09922L7.78143 13.0649Z",
            fill: "currentColor"
          })
        });
      function s() {
        return (0, t.jsx)("div", {
          className: "flex flex-col items-center justify-center px-6 w-full h-[205px]",
          children: (0, t.jsxs)("div", {
            className: "flex flex-col gap-3 items-center justify-center border border-secondary-100 rounded-2xl h-full w-full",
            children: [
              (0, t.jsx)("div", {
                className: "bg-secondary-200 flex flex-row gap-2.5 items-center justify-start p-4 relative rounded-full",
                children: (0, t.jsx)("div", {
                  className: "relative size-5",
                  children: (0, t.jsx)(n, { height: 20, width: 20, className: "text-secondary-600" })
                })
              }),
              (0, t.jsxs)("div", {
                className: "flex flex-col gap-1 items-center justify-start text-center",
                children: [
                  (0, t.jsx)("div", { className: "text-secondary-800 text-sm font-medium", children: "No data available to display trends." }),
                  (0, t.jsx)("div", { className: "text-muted-foreground text-xs font-normal", children: "Please check back later." })
                ]
              })
            ]
          })
        });
      }
    },
    16850: function (e, l, i) {
      i.a(e, async function (e, t) {
        try {
          i.d(l, { Z: () => v });
          var n = i(52322),
            s = i(15969),
            a = i(75377),
            o = i(55803),
            r = i(96217),
            c = i(10706),
            d = i(57124),
            x = i(75958);
          i(2784);
          var m = i(10289),
            u = i(36321),
            h = i(46103),
            g = i(49409),
            f = e([c]);
          c = (f.then ? (await f)() : f)[0];
          let v = (0, x.Pi)(e => {
            var l;
            let { isVisible: i, onClose: t, ibcDenom: x, nativeDenom: f } = e,
              v = (0, d.a)(),
              b = u.Ui.chainInfos,
              p = b[f.chain],
              j = (0, m.s0)(),
              { activeWallet: w } = (0, c.ZP)();
            return p
              ? (0, n.jsx)(r.Z, {
                  isOpen: i,
                  onClose: t,
                  title: `Stake on ${p.chainName}`,
                  className: "p-6",
                  children: (0, n.jsxs)("div", {
                    className: "flex flex-col gap-y-4 px-1",
                    children: [
                      (0, n.jsxs)("div", {
                        className:
                          "flex rounded-xl dark:bg-gray-950 bg-gray-100 border dark:border-gray-850 border-gray-200 items-center justify-evenly px-5 py-6",
                        children: [
                          (0, n.jsxs)("div", {
                            className: "relative w-16 h-16 flex items-center justify-center",
                            children: [
                              (0, n.jsx)("img", { src: x.img, onError: (0, g._)(v), className: "w-12 h-12 rounded-full" }),
                              (0, n.jsx)("img", {
                                src: x.tokenBalanceOnChain
                                  ? null === (l = b[x.tokenBalanceOnChain] ?? s.oCA[x.tokenBalanceOnChain]) || void 0 === l
                                    ? void 0
                                    : l.chainSymbolImageUrl
                                  : v,
                                className: "w-6 h-6 absolute bottom-[3px] right-[3px] rounded-full bg-black-100 dark:bg-black-100"
                              })
                            ]
                          }),
                          (0, n.jsx)(o.U, { size: 16, color: h.w.green600 }),
                          (0, n.jsxs)("div", {
                            className: "relative w-16 h-16 flex items-center justify-center",
                            children: [
                              (0, n.jsx)("img", { src: x.img, onError: (0, g._)(v), className: "w-12 h-12 rounded-full" }),
                              (0, n.jsx)("img", {
                                src: p.chainSymbolImageUrl,
                                onError: (0, g._)(v),
                                className: "w-6 h-6 absolute bottom-[3px] right-[3px] rounded-full bg-black-100 dark:bg-black-100"
                              })
                            ]
                          })
                        ]
                      }),
                      (0, n.jsxs)("div", {
                        className: "font-medium text-md text-gray-800 dark:text-gray-200",
                        children: [
                          "Staking requires tokens to be on their native chains. Transfer your\xa0",
                          (0, n.jsx)("span", { className: "font-bold inline text-black-100 dark:text-white-100", children: x.symbol }),
                          "\xa0to\xa0",
                          (0, n.jsx)("span", { className: "font-bold inline text-black-100 dark:text-white-100", children: p.chainName }),
                          " ",
                          "to start staking."
                        ]
                      }),
                      (0, n.jsxs)(a.Buttons.Generic, {
                        className: "w-full",
                        size: "normal",
                        color: h.w.green600,
                        onClick: () => {
                          let e = null == w ? void 0 : w.addresses[f.chain],
                            l = `/send?assetCoinDenom=${x.ibcDenom}&recipient=${e}`;
                          j(l);
                        },
                        children: ["Send to\xa0", p.chainName]
                      })
                    ]
                  })
                })
              : null;
          });
          t();
        } catch (e) {
          t(e);
        }
      });
    },
    83324: function (e, l, i) {
      i.a(e, async function (e, t) {
        try {
          i.r(l), i.d(l, { default: () => em });
          var n = i(52322),
            s = i(54655),
            a = i(77241),
            o = i(41172),
            r = i(15969),
            c = i(43166),
            d = i(48039),
            x = i(12693),
            m = i(11448),
            u = i(60431),
            h = i(6391),
            g = i(72779),
            f = i.n(g),
            v = i(69380),
            b = i(85027),
            p = i(41979),
            j = i(60889),
            w = i(83277),
            k = i(69816),
            C = i(26091),
            y = i(26571),
            N = i(23259),
            D = i(25722),
            S = i(74229),
            Z = i(78646),
            M = i(13607),
            L = i(72059),
            _ = i(10706),
            z = i(36400),
            B = i(50449),
            P = i(42941),
            E = i(57124),
            T = i(65027),
            I = i(39215),
            O = i(40811),
            F = i(3890),
            A = i(66929),
            $ = i(30464),
            U = i(75958),
            G = i(88259),
            H = i(82512),
            R = i(7345),
            V = i(87604),
            W = i(90068),
            Y = i(30078),
            Q = i(2784),
            q = i(86874),
            X = i(10289),
            K = i(26245),
            J = i(36321),
            ee = i(42799),
            el = i(23490),
            ei = i(319),
            et = i(83275),
            en = i(84601),
            es = i(49409),
            ea = i(71198),
            eo = i(96818),
            er = i(25199),
            ec = i(16850),
            ed = i(79430),
            ex = e([z, L, _, T, w, K, Z, et, H, j, en, R, ec, G]);
          [z, L, _, T, w, K, Z, et, H, j, en, R, ec, G] = ex.then ? (await ex)() : ex;
          let em = (0, U.Pi)(e => {
            var l, i, t, g, U, ex, em;
            let { rootDenomsStore: eu, chainTagsStore: eh, percentageChangeDataStore: eg, priceStore: ef } = e,
              ev = void 0,
              eb = (0, P.K)(),
              ep = (0, z.pb)(),
              ej = (0, L.a7)(),
              { activeWallet: ew } = (0, _.ZP)(),
              ek = (0, P.Z)().get("assetName") ?? void 0,
              eC = (0, o.NrF)(ek, 100),
              ey = ek || eC,
              eN = (0, P.Z)().get("tokenChain") ?? void 0,
              eD = (0, P.Z)().get("pageSource") ?? void 0,
              eS = (0, X.s0)(),
              { data: eZ = [] } = (0, M.Z)(),
              { data: eM } = (0, o.S2A)(),
              [eL, e_] = (0, Q.useState)("true" === el.S.show),
              [ez, eB] = (0, Q.useState)(""),
              eP = T.w.useGetWallet(),
              [eE, eT] = (0, Q.useState)(!1),
              [eI, eO] = (0, Q.useState)(),
              eF = (0, o.QSC)("noble"),
              eA = (0, X.TH)(),
              e$ = (0, Q.useMemo)(() => {
                let e = JSON.parse(sessionStorage.getItem("navigate-assetDetails-state") ?? "null");
                return (null == eA ? void 0 : eA.state) ?? e;
              }, [null == eA ? void 0 : eA.state]),
              eU = (0, Q.useMemo)(() => (null == e$ ? void 0 : e$.tokenBalanceOnChain) ?? ej, [ej, null == e$ ? void 0 : e$.tokenBalanceOnChain]),
              { headerChainImgSrc: eG } = (0, S.Cd)(),
              { data: eH } = (0, W.Z)(),
              eR = (0, Q.useMemo)(() => {
                var e;
                return null == eH ? void 0 : eH[(null == ep ? void 0 : null === (e = ep[eU]) || void 0 === e ? void 0 : e.chainId) ?? ""];
              }, [eU, eH, ep]),
              eV = (0, Q.useMemo)(() => {
                if ("cg" === ev) return null == eZ ? void 0 : eZ.find(e => e.id === ey);
              }, [ev, ey, eZ]),
              eW = (0, Q.useMemo)(() => {
                let e = [];
                return (
                  ey && e.push(ey),
                  (null == e$ ? void 0 : e$.coinMinimalDenom) && e.push(null == e$ ? void 0 : e$.coinMinimalDenom),
                  (null == e$ ? void 0 : e$.ibcDenom) && e.push(null == e$ ? void 0 : e$.ibcDenom),
                  eR &&
                    (null == eR ? void 0 : eR.length) > 0 &&
                    !!(null == eR
                      ? void 0
                      : eR.find(l =>
                          "ethereum-native" === l.denom
                            ? e.includes("wei")
                            : e.some(e => Object.values(r.KDX).includes(e))
                              ? (0, Y.Fo)(l) && l.coinType === s.EfF
                              : e.some(e => Object.values(r.f7g).includes(e))
                                ? l.denom === s.KOY || ((0, Y.Fo)(l) && l.coinType === s.EfF)
                                : e.includes(l.denom.replace(/(cw20:|erc20\/)/g, "")) ||
                                  e.includes(l.denom.replace(/(cw20:|erc20\/)/g, "").toLowerCase()) ||
                                  (!!l.evmTokenContract &&
                                    (e.includes(l.evmTokenContract.replace(/(cw20:|erc20\/)/g, "")) ||
                                      e.includes(l.evmTokenContract.replace(/(cw20:|erc20\/)/g, "").toLowerCase()))) ||
                                  ((0, Y.Fo)(l) && (e.includes(l.coinType) || e.includes(l.coinType.toLowerCase())))
                        ))
                );
              }, [ey, null == e$ ? void 0 : e$.coinMinimalDenom, null == e$ ? void 0 : e$.ibcDenom, eR]),
              [eY, eQ] = (0, Q.useState)(!1),
              [eq, eX] = (0, Q.useState)(!1),
              [eK, eJ] = (0, Q.useState)(!1),
              [e0] = (0, o.fOz)(),
              { handleSwapClick: e1 } = (0, w.a)(),
              e2 = (0, Q.useMemo)(() => Object.assign({}, eu.allDenoms, ee.N9.denoms), [eu.allDenoms, ee.N9.denoms]),
              {
                info: e3,
                ChartDays: e6,
                chartData: e9,
                loadingCharts: e5,
                loadingPrice: e7,
                errorCharts: e4,
                errorInfo: e8,
                setSelectedDays: le,
                selectedDays: ll,
                denomInfo: li
              } = (0, o.$QZ)({
                denoms: e2,
                denom: ey,
                tokenChain: eN ?? "cosmos",
                compassParams: { isCompassWallet: !1 },
                coingeckoIdsStore: K.ec,
                percentageChangeDataStore: eg,
                priceStore: ef
              }),
              lt = li ?? {
                chain: (null == e$ ? void 0 : e$.chain) ?? "",
                coinDenom: (null == e$ ? void 0 : e$.symbol) ?? (null == e$ ? void 0 : e$.name) ?? (null == e$ ? void 0 : e$.coinMinimalDenom) ?? "",
                coinMinimalDenom: (null == e$ ? void 0 : e$.coinMinimalDenom) ?? "",
                coinDecimals: (null == e$ ? void 0 : e$.coinDecimals) ?? 6,
                icon: (null == e$ ? void 0 : e$.img) ?? "",
                coinGeckoId: (null == e$ ? void 0 : e$.coinGeckoId) ?? ""
              },
              ln = (null == lt ? void 0 : lt.icon) ?? (null == eV ? void 0 : eV.image);
            (0, Z.a)(y.q.AssetDetails, !0, { pageViewSource: eD, tokenName: lt.coinDenom });
            let [ls] = (0, o.X$P)(),
              { data: la } = (0, o.ZbK)(null == lt ? void 0 : lt.coinGeckoId),
              [lo, lr] = (0, Q.useMemo)(() => {
                var e, l;
                let i = null == la ? void 0 : null === (e = la.find(e => "website" === e.type)) || void 0 === e ? void 0 : e.url,
                  t = null == la ? void 0 : null === (l = la.find(e => "twitter" === e.type)) || void 0 === l ? void 0 : l.url;
                return [i, t];
              }, [la]),
              lc = (0, Q.useMemo)(() => {
                var e;
                return (
                  ("noble" === lt.chain && "uusdn" === lt.coinMinimalDenom) ||
                  !eW ||
                  (null == eM ? void 0 : null === (e = eM.all_chains) || void 0 === e ? void 0 : e.swap) === "disabled"
                );
              }, [lt.chain, lt.coinMinimalDenom, eW, null == eM ? void 0 : null === (l = eM.all_chains) || void 0 === l ? void 0 : l.swap]),
              {
                data: ld,
                isLoading: lx,
                error: lm
              } = (0, u.useQuery)(
                ["chartData", null == eV ? void 0 : eV.id, ll],
                async () => {
                  if (ll && (null == eV ? void 0 : eV.id))
                    try {
                      let e = new Date();
                      e.setDate(1), e.setMonth(1), e.setFullYear(e.getFullYear());
                      let l = (0, D.Z)(new Date(), e),
                        i = await o.rNU.getMarketChart(
                          null == eV ? void 0 : eV.id,
                          (null == lt ? void 0 : lt.chain) ?? "cosmos",
                          "YTD" === ll ? l : e6[ll],
                          o.r95[ls].currencyPointer
                        );
                      if (i) {
                        let { data: e, minMax: l } = i;
                        return { chartData: e, minMax: l };
                      }
                    } catch (e) {}
                },
                { enabled: !!(null == eV ? void 0 : eV.id), retry: 2, staleTime: 0, cacheTime: 3e5 }
              ),
              {
                chartsData: lu,
                chartsLoading: lh,
                chartsErrors: lg
              } = (0, Q.useMemo)(
                () => ("cg" === ev ? { chartsData: ld, chartsLoading: lx, chartsErrors: lm } : { chartsData: e9, chartsLoading: e5, chartsErrors: e4 }),
                [ev, ld, e9, e4, lm, e5, lx]
              ),
              {
                price: lf,
                details: lv,
                priceChange: lb
              } = {
                price: (null == e3 ? void 0 : e3.price) ?? (null == eV ? void 0 : eV.current_price) ?? (null == e$ ? void 0 : e$.usdPrice),
                details: null == e3 ? void 0 : e3.details,
                priceChange: (null == e3 ? void 0 : e3.priceChange) ?? (null == eV ? void 0 : eV.price_change_percentage_24h)
              },
              { chartData: lp, minMax: lj } = lu ?? { chartData: void 0, minMax: void 0 },
              lw = null == e$ ? void 0 : e$.usdValue,
              lk =
                (null === (i = ep[null == e$ ? void 0 : e$.tokenBalanceOnChain]) || void 0 === i ? void 0 : i.chainName) ??
                (null == e$ ? void 0 : e$.tokenBalanceOnChain) ??
                (null === (t = ep[eN]) || void 0 === t ? void 0 : t.chainName) ??
                eN,
              lC = (0, Q.useMemo)(() => {
                var e, l, i, t;
                return (
                  (null === (e = ep[null == e$ ? void 0 : e$.tokenBalanceOnChain]) || void 0 === e ? void 0 : e.chainSymbolImageUrl) ??
                  (null === (l = r.oCA[null == e$ ? void 0 : e$.tokenBalanceOnChain]) || void 0 === l ? void 0 : l.chainSymbolImageUrl) ??
                  (null === (i = ep[null == lt ? void 0 : lt.chain]) || void 0 === i ? void 0 : i.chainSymbolImageUrl) ??
                  (null === (t = r.oCA[null == lt ? void 0 : lt.chain]) || void 0 === t ? void 0 : t.chainSymbolImageUrl)
                );
              }, [ep, null == lt ? void 0 : lt.chain, null == e$ ? void 0 : e$.tokenBalanceOnChain]);
            (0, B._)(et.t);
            let ly = (0, E.a)(),
              lN = (0, o.obn)(),
              lD = (0, Q.useMemo)(() => ("aggregated" === ej ? "mainnet" : lN), [lN, ej]),
              [lS] = (0, o.JsT)(eu.allDenoms, lt.chain, lD),
              lZ = (0, o.Xmk)({
                checkForExistenceType: "comingSoon",
                feature: "stake",
                platform: "Extension",
                forceChain: (null == e$ ? void 0 : e$.ibcDenom) ? (null == e$ ? void 0 : e$.chain) : eU,
                forceNetwork: lD
              }),
              lM = (0, o.Xmk)({
                checkForExistenceType: "notSupported",
                feature: "stake",
                platform: "Extension",
                forceChain: (null == e$ ? void 0 : e$.ibcDenom) ? (null == e$ ? void 0 : e$.chain) : eU,
                forceNetwork: lD
              }),
              lL = (0, Q.useMemo)(() => {
                var e;
                return (
                  lZ ||
                  lM ||
                  !!(null === (e = ep[eU]) || void 0 === e ? void 0 : e.evmOnlyChain) ||
                  (null == lS ? void 0 : lS.coinMinimalDenom) !== (null == e$ ? void 0 : e$.coinMinimalDenom)
                );
              }, [eU, null == lS ? void 0 : lS.coinMinimalDenom, ep, lZ, lM, null == e$ ? void 0 : e$.coinMinimalDenom]),
              { data: l_ = {} } = (0, o.ViV)(),
              lz = l_[null == lS ? void 0 : lS.coinDenom],
              lB = (0, Q.useMemo)(() => {
                if ("1D" === ll && lb) return Number(lb);
                if (lp && lp.length > 0) {
                  let e = lp[0].smoothedPrice;
                  return ((lf - e) / e) * 100;
                }
              }, [lp, lf, lb, ll]),
              lP = (0, Q.useMemo)(() => {
                let e = new h.BigNumber(lf ?? 0).dividedBy(1 + (lB ?? 0) / 100);
                return new h.BigNumber(lf ?? 0).minus(e).toNumber();
              }, [lf, lB]);
            (0, o.QSC)(eU);
            let lE = () => {
              var e;
              let l = { mode: "DELEGATE", forceChain: eU, forceNetwork: lD };
              sessionStorage.setItem("navigate-stake-input-state", JSON.stringify(l)),
                0 === ((null === (e = en.fe.validatorsForChain(eU).validatorData) || void 0 === e ? void 0 : e.validators) ?? []).length &&
                  en.fe.loadValidators(eU, lD),
                eS("/stake/input", { state: l });
            };
            return ((0, Q.useEffect)(() => {
              async function e() {
                try {
                  let e = await eP("noble"),
                    l = (await e.getAccounts())[0].address,
                    i = await (0, r.Hpw)((null == eF ? void 0 : eF.apis.rest) ?? "", l),
                    t = new h.BigNumber(null == i ? void 0 : i.claimable_amount);
                  t.gt(0) ? eB((0, r.TGo)(t.toFixed(0))) : eB("0");
                } catch (e) {}
              }
              "noble" === lt.chain && "uusdn" === lt.coinMinimalDenom && e();
            }, [lt.chain, lt.coinMinimalDenom, eP, null == eF ? void 0 : eF.apis.rest, eI]),
            eI && "noble" === lt.chain && "uusdn" === lt.coinMinimalDenom)
              ? (0, n.jsx)(H.Z, {
                  onClose: () => {
                    eO(void 0), eT(!1);
                  },
                  txHash: eI,
                  txType: "claim"
                })
              : (0, n.jsxs)(n.Fragment, {
                  children: [
                    (0, n.jsxs)(b.m, {
                      className: "absolute",
                      children: [
                        (0, n.jsx)(c.X, {
                          className: "size-9 p-2 cursor-pointer text-muted-foreground hover:text-foreground",
                          onClick: () => {
                            sessionStorage.removeItem("navigate-assetDetails-state"), eS(-1);
                          }
                        }),
                        (0, n.jsx)(k.Z, {
                          className: "text-[18px] font-bold !leading-6",
                          color: "text-monochrome",
                          children: (0, ea.kC)(
                            (null == e$ ? void 0 : e$.symbol) ??
                              (null == lt ? void 0 : lt.coinDenom) ??
                              (null == lt ? void 0 : lt.name) ??
                              (null == eV ? void 0 : eV.symbol)
                          )
                        }),
                        (0, n.jsx)("div", { className: "w-9 h-9" })
                      ]
                    }),
                    (0, n.jsxs)("div", {
                      className: f()("relative bg-secondary-50 pt-16"),
                      children: [
                        "noble" === lt.chain &&
                          "uusdc" === lt.coinMinimalDenom &&
                          eL &&
                          (0, n.jsxs)("div", {
                            className: "bg-secondary-100 p-[14px] pl-5 mb-11 flex items-center cursor-pointer",
                            onClick: () => {
                              "false" !== ei.I.show ? eS("/home?openEarnUSDN=true", { replace: !0 }) : eS("/earn-usdn");
                            },
                            children: [
                              (0, n.jsxs)("div", {
                                className: "flex items-center gap-3 w-full",
                                children: [
                                  (0, n.jsx)("img", { src: $.r.Logos.USDCLogo, className: "w-9 h-9" }),
                                  (0, n.jsxs)(k.Z, {
                                    className: "!inline font-bold",
                                    size: "md",
                                    color: "dark:text-white-100 text-black-100",
                                    children: [
                                      "Earn up to",
                                      " ",
                                      (0, n.jsxs)("span", {
                                        className: "text-green-600 font-bold",
                                        children: [
                                          parseFloat(
                                            null === (U = J.Wb.data) || void 0 === U ? void 0 : null === (g = U.noble) || void 0 === g ? void 0 : g.usdnEarnApy
                                          ) > 0
                                            ? new h.BigNumber(J.Wb.data.noble.usdnEarnApy).multipliedBy(100).toFixed(2) + "%"
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
                              (0, n.jsx)(d.X, {
                                size: 18,
                                className: "dark:text-gray-700 text-gray-400",
                                onClick: e => {
                                  e.stopPropagation(), e_(!1), el.S.setShow("false");
                                }
                              })
                            ]
                          }),
                        (0, n.jsx)("div", {
                          className: "flex flex-col items-center px-6 pt-5 pb-3",
                          children:
                            ("cg" !== ev && !e7) || ("cg" === ev && eV)
                              ? (0, n.jsxs)(n.Fragment, {
                                  children: [
                                    (0, n.jsx)(k.Z, {
                                      size: "xxl",
                                      color: "text-black-100 dark:text-white-100",
                                      className: "font-bold",
                                      children: lf && new h.BigNumber(lf).gt(0) ? e0(new h.BigNumber(lf), 5) : "-"
                                    }),
                                    lh
                                      ? (0, n.jsx)(q.Z, { width: 80, containerClassName: "h-4" })
                                      : !!lB &&
                                        (0, n.jsx)("div", {
                                          className: f()("text-xs font-bold ", {
                                            "text-green-600 dark:text-green-600": !lB || lB >= 0,
                                            "text-red-600 dark:text-red-400": lB && lB < 0
                                          }),
                                          children: `${lP > 0 ? "+" : "-"}${e0(new h.BigNumber(lP).abs(), 2)} (${(0, o._6x)(new h.BigNumber(lB).toString(), 2)}%)`
                                        })
                                  ]
                                })
                              : (0, n.jsxs)(n.Fragment, { children: [(0, n.jsx)(q.Z, { width: 90, height: 36 }), (0, n.jsx)(q.Z, { width: 80 })] })
                        }),
                        (0, n.jsxs)("div", {
                          className: "flex flex-col gap-y-5 items-center",
                          children: [
                            lg || e8
                              ? (0, n.jsx)(er.c, {})
                              : (0, n.jsx)(n.Fragment, {
                                  children: lh
                                    ? (0, n.jsx)(eo.Z, {})
                                    : lp && lp.length > 0
                                      ? (0, n.jsx)(
                                          ed.R,
                                          { chainColor: "#70B7FF", chartData: lp, loadingCharts: lh, price: lf, minMax: lj, selectedDays: ll },
                                          ll
                                        )
                                      : (0, n.jsx)(er.c, {})
                                }),
                            !lh &&
                              lp &&
                              lp.length > 0 &&
                              lf &&
                              (0, n.jsx)("div", {
                                className: "flex justify-between gap-x-2 overflow-scroll hide-scrollbar",
                                children: Object.keys(e6).map((e, l) =>
                                  (0, n.jsx)(
                                    "div",
                                    {
                                      className: f()("rounded-2xl py-1.5 px-4 text-xs hover:cursor-pointer ", {
                                        "bg-gray-100 text-black-100 dark:bg-gray-900 dark:text-white-100 font-bold": e === ll,
                                        "text-gray-700 dark:text-gray-400 font-medium": e !== ll
                                      }),
                                      onClick: () => {
                                        le(e);
                                      },
                                      children: e
                                    },
                                    l
                                  )
                                )
                              })
                          ]
                        }),
                        (0, n.jsxs)("div", {
                          className: "flex flex-col gap-5 w-full p-6",
                          children: [
                            "noble" !== lt.chain || "uusdn" !== lt.coinMinimalDenom
                              ? (0, n.jsxs)(n.Fragment, {
                                  children: [
                                    (null == ew ? void 0 : ew.walletType) !== o._KQ.WATCH_WALLET
                                      ? (0, n.jsxs)("div", {
                                          className: "flex gap-9 justify-center w-full",
                                          children: [
                                            (0, n.jsx)(v.Z, {
                                              label: "Send",
                                              icon: A.M,
                                              onClick: () => {
                                                var e, l;
                                                let i = (0, o.QBt)(
                                                    (null == e$ ? void 0 : e$.ibcDenom) || (null == lt ? void 0 : lt.coinMinimalDenom) || "",
                                                    (null === (e = ep[(null == lt ? void 0 : lt.chain) ?? ""]) || void 0 === e ? void 0 : e.chainId) ?? ""
                                                  ),
                                                  t = null === (l = ep[eU]) || void 0 === l ? void 0 : l.chainId,
                                                  n = `assetCoinDenom=${i}&holderChain=${eU}`;
                                                t && (n += `&chainId=${t}`), eS(`/send?${n}`, { state: eA.state });
                                              }
                                            }),
                                            (0, n.jsx)(v.Z, { label: "Receive", icon: O.I, onClick: () => eb.set("receive", "true") }),
                                            (0, n.jsx)(v.Z, {
                                              label: "Swap",
                                              icon: F.d,
                                              onClick: () => {
                                                var e;
                                                let l = (null == e$ ? void 0 : e$.ibcDenom) || (null == lt ? void 0 : lt.coinMinimalDenom) || "";
                                                (null == l ? void 0 : l.startsWith("0x")) && (l = (0, a.getAddress)(l));
                                                let i = (0, o.QBt)(
                                                  l,
                                                  (null === (e = ep[(null == lt ? void 0 : lt.chain) ?? ""]) || void 0 === e ? void 0 : e.chainId) ?? ""
                                                );
                                                e1(
                                                  `${N.Wc}&destinationChainId=${ep[eU].chainId}&destinationAsset=${l}`,
                                                  `/swap?destinationChainId=${ep[eU].chainId}&destinationToken=${i}&pageSource=assetDetails`
                                                );
                                              },
                                              disabled: lc
                                            }),
                                            (0, n.jsx)(v.Z, {
                                              label: "Stake",
                                              icon: I.P,
                                              onClick: () => {
                                                (null == e$ ? void 0 : e$.ibcDenom) ? eX(!0) : (null == lz ? void 0 : lz.length) > 0 ? eJ(!0) : lE();
                                              },
                                              disabled: lL
                                            })
                                          ]
                                        })
                                      : null,
                                    (0, n.jsxs)("div", {
                                      className: "flex flex-col gap-3",
                                      children: [
                                        (0, n.jsx)(k.Z, {
                                          size: "sm",
                                          color: "text-muted-foreground",
                                          className: "font-bold !leading-5",
                                          children: "Your Balance"
                                        }),
                                        (0, n.jsxs)("div", {
                                          className: "flex bg-secondary-100 border-secondary-200 border rounded-2xl p-4 gap-2",
                                          children: [
                                            (0, n.jsxs)("div", {
                                              className: "relative w-[40px] h-[40px] flex items-center justify-center",
                                              children: [
                                                (0, n.jsx)(C.m, {
                                                  assetImg: ln,
                                                  text: null == lt ? void 0 : lt.coinDenom,
                                                  altText: null == lt ? void 0 : lt.coinDenom,
                                                  imageClassName: "w-[30px] h-[30px] rounded-full shrink-0",
                                                  containerClassName: "w-[30px] h-[30px] rounded-full shrink-0 !bg-gray-200 dark:!bg-gray-800",
                                                  textClassName: "text-[8.34px] !leading-[11px]"
                                                }),
                                                (0, n.jsx)("img", {
                                                  src: lC,
                                                  onError: (0, es._)(ly),
                                                  className: "w-[15px] h-[15px] absolute bottom-[3px] right-[3px] rounded-full bg-white-100 dark:bg-black-100"
                                                })
                                              ]
                                            }),
                                            (0, n.jsxs)("div", {
                                              className: "flex flex-col grow ",
                                              children: [
                                                (0, n.jsx)(k.Z, {
                                                  size: "md",
                                                  color: "text-monochrome",
                                                  className: "font-bold !leading-6",
                                                  children: (null == lt ? void 0 : lt.name) ?? (null == lt ? void 0 : lt.coinDenom)
                                                }),
                                                (0, n.jsx)(k.Z, {
                                                  size: "xs",
                                                  color: "text-muted-foreground",
                                                  className: "font-medium !leading-4",
                                                  children: lk ?? (null == eV ? void 0 : eV.name)
                                                })
                                              ]
                                            }),
                                            (0, n.jsxs)("div", {
                                              className: "flex flex-col items-end justify-between py-[1px]",
                                              children: [
                                                (0, n.jsx)(k.Z, {
                                                  size: "sm",
                                                  color: "text-monochrome",
                                                  className: "font-bold !leading-5",
                                                  children: lw ? e0(new h.BigNumber(lw), 5) : "-"
                                                }),
                                                (0, n.jsx)(k.Z, {
                                                  size: "xs",
                                                  color: "text-gray-600 dark:text-gray-400 text-right",
                                                  className: "font-medium",
                                                  children: (0, o.LHZ)(
                                                    (null == e$ ? void 0 : null === (ex = e$.amount) || void 0 === ex ? void 0 : ex.toString()) ?? "",
                                                    null == lt ? void 0 : lt.coinDenom,
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
                              : (0, n.jsxs)("div", {
                                  className: "flex flex-col gap-3",
                                  children: [
                                    (0, n.jsx)(k.Z, {
                                      size: "sm",
                                      color: "text-muted-foreground",
                                      className: "font-bold !leading-5 mt-3",
                                      children: "Your Balance"
                                    }),
                                    (0, n.jsxs)("div", {
                                      className: "flex flex-col bg-secondary-100 border-secondary-200 border rounded-lg p-4 gap-y-4",
                                      children: [
                                        (0, n.jsxs)("div", {
                                          className: "flex gap-x-2 items-center",
                                          children: [
                                            (0, n.jsxs)("div", {
                                              className: "relative w-[50px] h-[40px] flex items-center justify-center",
                                              children: [
                                                (0, n.jsx)(C.m, {
                                                  assetImg: ln,
                                                  text: null == lt ? void 0 : lt.coinDenom,
                                                  altText: null == lt ? void 0 : lt.coinDenom,
                                                  imageClassName: "w-[30px] h-[30px] rounded-full shrink-0",
                                                  containerClassName: "w-[30px] h-[30px] rounded-full shrink-0 !bg-gray-200 dark:!bg-gray-800",
                                                  textClassName: "text-[8.34px] !leading-[11px]"
                                                }),
                                                (0, n.jsx)("img", {
                                                  src: lC,
                                                  onError: (0, es._)(ly),
                                                  className: "w-[15px] h-[15px] absolute bottom-[3px] right-[3px] rounded-full bg-white-100 dark:bg-black-100"
                                                })
                                              ]
                                            }),
                                            (0, n.jsxs)("div", {
                                              className: "flex flex-row items-center justify-between w-full",
                                              children: [
                                                (0, n.jsxs)("div", {
                                                  className: "flex flex-col items-start",
                                                  children: [
                                                    (0, n.jsx)("div", {
                                                      className: "flex items-center gap-x-1.5",
                                                      children: (0, n.jsx)(k.Z, {
                                                        size: "md",
                                                        color: "text-black-100 dark:text-white-100",
                                                        className: "font-bold",
                                                        children: (null == lt ? void 0 : lt.name) ?? (null == lt ? void 0 : lt.coinDenom)
                                                      })
                                                    }),
                                                    (0, n.jsx)(k.Z, {
                                                      size: "xs",
                                                      color: "text-gray-600 dark:text-gray-400",
                                                      children: lk ?? (null == eV ? void 0 : eV.name)
                                                    })
                                                  ]
                                                }),
                                                (0, n.jsxs)("div", {
                                                  className: "flex flex-col items-end gap-y-1",
                                                  children: [
                                                    (0, n.jsx)(k.Z, {
                                                      size: "md",
                                                      color: "text-black-100 dark:text-white-100",
                                                      className: "font-bold",
                                                      children: lw ? e0(new h.BigNumber(lw), 5) : "-"
                                                    }),
                                                    (0, n.jsx)(k.Z, {
                                                      size: "xs",
                                                      color: "text-gray-600 dark:text-gray-400 text-right",
                                                      className: "font-medium",
                                                      children: (0, o.LHZ)(
                                                        (null == e$ ? void 0 : null === (em = e$.amount) || void 0 === em ? void 0 : em.toString()) ?? "",
                                                        null == lt ? void 0 : lt.coinDenom,
                                                        5
                                                      )
                                                    })
                                                  ]
                                                })
                                              ]
                                            })
                                          ]
                                        }),
                                        (0, n.jsx)("div", { className: "h-[1px] w-full dark:bg-gray-850 bg-gray-200" }),
                                        (0, n.jsxs)("div", {
                                          className: "flex flex-row h-[56px] p-1 gap-x-2",
                                          children: [
                                            (0, n.jsx)("button", {
                                              onClick: () => {
                                                eS("/earn-usdn");
                                              },
                                              className:
                                                "flex flex-row gap-x-2 items-center justify-center h-full w-full p-3 bg-secondary-300 hover:bg-secondary-400 rounded-full",
                                              "aria-label": "deposit button in chart details",
                                              children: (0, n.jsx)(k.Z, {
                                                size: "xs",
                                                color: "text-black-100 dark:text-white-100",
                                                className: "font-bold",
                                                children: (0, n.jsx)("span", { "aria-label": "deposit button text in chart details", children: "Deposit" })
                                              })
                                            }),
                                            (0, n.jsx)("button", {
                                              onClick: () => {
                                                eS("/earn-usdn?withdraw=true");
                                              },
                                              className:
                                                "flex flex-row gap-x-2 items-center justify-center h-full w-full p-3 bg-secondary-300 hover:bg-secondary-400 rounded-full",
                                              "aria-label": "withdraw button in chart details",
                                              children: (0, n.jsx)(k.Z, {
                                                size: "xs",
                                                color: "text-black-100 dark:text-white-100",
                                                className: "font-bold",
                                                children: (0, n.jsx)("span", { "aria-label": "withdraw button text in chart details", children: "Withdraw" })
                                              })
                                            }),
                                            (0, n.jsx)("button", {
                                              onClick: () => {
                                                eS(
                                                  `/send?assetCoinDenom=${(null == e$ ? void 0 : e$.ibcDenom) || (null == lt ? void 0 : lt.coinMinimalDenom)}`,
                                                  { state: eA.state }
                                                );
                                              },
                                              className: f()(
                                                "flex flex-row gap-x-2 items-center justify-center h-full w-full p-3 bg-secondary-300 hover:bg-secondary-400 rounded-full"
                                              ),
                                              "aria-label": "send button in chart details",
                                              children: (0, n.jsx)(k.Z, {
                                                size: "xs",
                                                color: "text-black-100 dark:text-white-100",
                                                className: "font-bold",
                                                children: (0, n.jsx)("span", { "aria-label": "send button text in chart details", children: "Send" })
                                              })
                                            })
                                          ]
                                        })
                                      ]
                                    }),
                                    (0, n.jsxs)("div", {
                                      className: "flex flex-col gap-y-3 mt-4",
                                      children: [
                                        (0, n.jsx)(k.Z, {
                                          size: "sm",
                                          color: "text-gray-600 dark:text-gray-400",
                                          className: "font-bold",
                                          children: "Your rewards"
                                        }),
                                        (0, n.jsxs)("div", {
                                          className: "flex flex-col bg-secondary-100 border-secondary-200 border rounded-lg",
                                          children: [
                                            (0, n.jsx)("div", {
                                              className: "flex py-5 px-6 w-full",
                                              children: (0, n.jsxs)("div", {
                                                className: "flex flex-col w-1/2 gap-2",
                                                children: [
                                                  (0, n.jsx)(k.Z, { size: "xs", color: "dark:text-gray-400 text-gray-600", children: "Claimable rewards" }),
                                                  (0, n.jsx)(k.Z, {
                                                    size: "lg",
                                                    color: "text-green-500",
                                                    className: "font-bold",
                                                    children: e0(new h.BigNumber(ez))
                                                  })
                                                ]
                                              })
                                            }),
                                            (0, n.jsx)("div", { className: "h-[1px] w-full dark:bg-gray-850 bg-gray-200" }),
                                            (0, n.jsx)("div", {
                                              className: "px-6 py-5",
                                              children: (0, n.jsx)("button", {
                                                onClick: () => {
                                                  eT(!0);
                                                },
                                                className: f()(
                                                  "flex flex-row gap-x-2 items-center justify-center h-full w-full p-4 bg-secondary-300 hover:bg-secondary-400 rounded-full cursor-pointer",
                                                  { "!cursor-not-allowed opacity-75": !new h.BigNumber(ez).gt(1e-5) }
                                                ),
                                                disabled: !new h.BigNumber(ez).gt(1e-5),
                                                "aria-label": "claim rewards button in chart details",
                                                children: (0, n.jsx)(k.Z, {
                                                  size: "xs",
                                                  color: "text-black-100 dark:text-white-100",
                                                  className: "font-bold",
                                                  children: (0, n.jsx)("span", {
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
                            !e7 &&
                              lv &&
                              ("uusdn" !== lt.coinMinimalDenom || "noble" !== lt.chain) &&
                              (0, n.jsxs)("div", {
                                className: "flex flex-col gap-y-2",
                                children: [
                                  (0, n.jsxs)(k.Z, {
                                    size: "sm",
                                    color: "text-muted-foreground",
                                    className: "font-bold",
                                    children: ["About ", (null == lt ? void 0 : lt.name) ?? (0, ea.kC)(null == lt ? void 0 : lt.chain)]
                                  }),
                                  (0, n.jsx)(p.Z, { textProps: { size: "sm", className: "flex flex-column" }, readMoreColor: "#696969", children: lv })
                                ]
                              }),
                            "uusdn" === lt.coinMinimalDenom && "noble" === lt.chain
                              ? null
                              : (0, n.jsxs)("div", {
                                  className: "flex flex-row items-center gap-x-2",
                                  children: [
                                    lo &&
                                      (0, n.jsx)("a", {
                                        href: lo,
                                        target: "_blank",
                                        rel: "noreferrer",
                                        className: "px-3 py-1.5 rounded-[28px] border border-secondary-300",
                                        children: (0, n.jsxs)("div", {
                                          className: "flex flex-row items-center gap-x-1",
                                          children: [
                                            (0, n.jsx)(x.T, { size: 20, className: "text-foreground" }),
                                            (0, n.jsx)(k.Z, { size: "xs", color: "text-foreground", className: "font-medium", children: "Website" })
                                          ]
                                        })
                                      }),
                                    lr &&
                                      (0, n.jsx)("a", {
                                        href: lr,
                                        target: "_blank",
                                        rel: "noreferrer",
                                        className: "px-3 py-1.5 rounded-[28px] border border-secondary-300",
                                        children: (0, n.jsx)(m.S, { size: 20, className: "text-black-100 dark:text-white-100" })
                                      })
                                  ]
                                })
                          ]
                        })
                      ]
                    }),
                    (0, n.jsx)(j.Z, { forceChain: null == e$ ? void 0 : e$.tokenBalanceOnChain }),
                    (0, n.jsx)(V.Z, {
                      isVisible: eK,
                      title: "Stake",
                      onClose: () => eJ(!1),
                      tokenLSProviders: lz,
                      handleStakeClick: lE,
                      rootDenomsStore: eu,
                      delegationsStore: en.xO,
                      validatorsStore: en.fe,
                      unDelegationsStore: en.GO,
                      claimRewardsStore: en.eq,
                      forceChain: eU,
                      forceNetwork: lD
                    }),
                    (0, n.jsx)(R.Z, { isVisible: eY, onClose: () => eQ(!1), chainTagsStore: eh }),
                    eq && e$ && (0, n.jsx)(ec.Z, { isVisible: eq, ibcDenom: e$, onClose: () => eX(!1), nativeDenom: lS }),
                    eE &&
                      "noble" === lt.chain &&
                      "uusdn" === lt.coinMinimalDenom &&
                      (0, n.jsx)(G.Z, { amount: ez, denom: lt, isOpen: eE, onClose: () => eT(!1), setTxHash: e => eO(e) })
                  ]
                });
          });
          t();
        } catch (e) {
          t(e);
        }
      });
    },
    79430: function (e, l, i) {
      i.d(l, { R: () => c });
      var t = i(52322),
        n = i(41172),
        s = i(6391),
        a = i(2784),
        o = i(22157),
        r = i(46103);
      function c(e) {
        let { chartData: l, loadingCharts: i, price: c, minMax: d, chainColor: x, selectedDays: m } = e,
          [u] = (0, n.fOz)(),
          [h, g] = (0, a.useState)();
        return (
          (0, a.useEffect)(() => g(null == l ? void 0 : l.map(e => ({ data: e.price, key: new Date(e.timestamp), metadata: e.date }))), [l]),
          l && !i && c
            ? (0, t.jsx)(o.THM, {
                height: 128,
                xAxis: (0, t.jsx)(o.c7Z, {
                  tickSeries: (0, t.jsx)(o.S3h, { tickSize: 0, interval: 5, label: null, line: null }),
                  axisLine: (0, t.jsx)(o.PGn, { strokeWidth: 0, strokeColor: r.w.gray900 }),
                  type: "time"
                }),
                yAxis: (0, t.jsx)(o.tmX, {
                  tickSeries: (0, t.jsx)(o.T$2, { tickSize: 0, width: 0, interval: 5, label: null, line: null }),
                  axisLine: (0, t.jsx)(o.PGn, { strokeWidth: 0 })
                }),
                series: (0, t.jsx)(o.f62, {
                  markLine: (0, t.jsx)(o.Ipb, { strokeColor: x, strokeWidth: 1 }),
                  tooltip: (0, t.jsx)(o.sGf, {
                    tooltip: (0, t.jsx)(o.h7M, {
                      followCursor: !0,
                      placement: "auto",
                      modifiers: { offset: "5px, 5px" },
                      content: e => {
                        let l,
                          i = e.value + d[0].price,
                          n = new Date(e.key);
                        l =
                          "1Y" === m || "YTD" === m || "All" === m
                            ? n.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric" })
                            : n.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
                        try {
                          i = u(new s.BigNumber(i));
                        } catch (e) {}
                        return (0, t.jsxs)("div", { className: "text-xs font-medium !text-black-100 dark:!text-white-100", children: [i, " | ", l] });
                      }
                    })
                  }),
                  colorScheme: x,
                  interpolation: "smooth",
                  line: (0, t.jsx)(o.x12, { strokeWidth: 2 }),
                  area: (0, t.jsx)(o.uN9, {
                    gradient: (0, t.jsx)(o.phe, {
                      stops: [
                        (0, t.jsx)(o.oIo, { offset: "0", stopOpacity: 0, color: x }, 0),
                        (0, t.jsx)(o.oIo, { offset: "1", stopOpacity: 0.55, color: x }, 2)
                      ]
                    })
                  })
                }),
                gridlines: (0, t.jsx)(o.ALS, { line: (0, t.jsx)(o.aBy, { direction: "all", strokeWidth: 0 }) }),
                data: h
              })
            : (0, t.jsx)(t.Fragment, { children: c && (0, t.jsx)("div", { className: "h-auto" }) })
        );
      }
    },
    96818: function (e, l, i) {
      i.d(l, { Z: () => o });
      var t = i(52322),
        n = i(72779),
        s = i.n(n);
      i(2784);
      var a = i(86874);
      function o(e) {
        let { className: l } = e;
        return (0, t.jsx)("div", {
          className: s()("w-full", l),
          children: (0, t.jsxs)("div", {
            className: "flex flex-col gap-y-5 overflow-clip items-center",
            children: [
              (0, t.jsx)(a.Z, { className: "h-[128px] rounded-sm", containerClassName: "w-full block !leading-none" }),
              (0, t.jsx)(a.Z, { className: "h-[28px] rounded-full", containerClassName: "w-full px-10 block !leading-none" })
            ]
          })
        });
      }
    },
    88259: function (e, l, i) {
      i.a(e, async function (e, t) {
        try {
          i.d(l, { Z: () => N });
          var n = i(52322),
            s = i(41172),
            a = i(49183),
            o = i(72779),
            r = i.n(o),
            c = i(58885),
            d = i(51994),
            x = i(80588),
            m = i(42152),
            u = i(96217),
            h = i(69816),
            g = i(38313),
            f = i(65027),
            v = i(63242),
            b = i(97680),
            p = i.n(b),
            j = i(75958),
            w = i(2784),
            k = i(42799),
            C = i(48346),
            y = e([g, f, c, C, d, x]);
          [g, f, c, C, d, x] = y.then ? (await y)() : y;
          let N = (0, j.Pi)(e => {
            let { isOpen: l, onClose: i, denom: t, amount: o, setTxHash: b } = e,
              j = (0, g.ob)(),
              {
                setAmount: y,
                userPreferredGasLimit: N,
                recommendedGasLimit: D,
                setUserPreferredGasLimit: S,
                userPreferredGasPrice: Z,
                gasOption: M,
                setGasOption: L,
                setUserPreferredGasPrice: _,
                setFeeDenom: z,
                onReviewTransaction: B,
                txHash: P,
                isLoading: E,
                setError: T,
                error: I,
                ledgerError: O,
                showLedgerPopup: F
              } = (0, s.LTX)(k.gb.allDenoms, "claim"),
              A = f.w.useGetWallet(),
              [$, U] = (0, w.useState)(!1),
              [G, H] = (0, w.useState)(!1),
              R = (0, c.e7)(k.gb.allDenoms, { activeChain: "noble" }),
              [V, W] = (0, w.useState)(null),
              [Y, Q] = (0, w.useState)({ option: M, gasPrice: Z ?? R.gasPrice }),
              [q, X] = (0, w.useState)(),
              K = E || !!I || !!V || !!O || $,
              J = (0, w.useCallback)(async () => {
                U(!0);
                try {
                  let e = await A("noble");
                  B(e, () => {}, !1);
                } catch (e) {
                  T(e),
                    setTimeout(() => {
                      T(void 0);
                    }, 5e3);
                } finally {
                  U(!1);
                }
              }, [A, B, T]);
            (0, w.useEffect)(() => {
              P && b(P);
            }, [b, P]),
              (0, w.useEffect)(() => {
                Q({ option: M, gasPrice: R.gasPrice });
              }, [R.gasPrice.amount.toString(), R.gasPrice.denom]),
              (0, w.useEffect)(() => {
                Y.option && L(Y.option), Y.gasPrice && _(Y.gasPrice);
              }, [Y, L, _]);
            let ee = (0, w.useCallback)(
              (e, l) => {
                Q(e), z(l.denom);
              },
              [z]
            );
            return (
              (0, w.useEffect)(() => {
                y(o);
              }, [o, y]),
              (0, n.jsxs)(c.ZP, {
                recommendedGasLimit: D.toString(),
                gasLimit: (null == N ? void 0 : N.toString()) ?? D.toString(),
                setGasLimit: e => S(Number(e.toString())),
                gasPriceOption: Y,
                onGasPriceOptionChange: ee,
                error: V,
                setError: W,
                chain: "noble",
                network: j,
                rootDenomsStore: k.gb,
                rootBalanceStore: C.jZ,
                children: [
                  (0, n.jsx)(u.Z, {
                    title: "Confirm Transaction",
                    isOpen: l,
                    onClose: i,
                    className: "p-6 z-10",
                    children: (0, n.jsxs)("div", {
                      className: "flex flex-col gap-4 w-full",
                      children: [
                        (0, n.jsx)("div", {
                          className: "w-full bg-gray-50 dark:bg-gray-900 flex items-center justify-between p-4 gap-2 rounded-2xl mb-4",
                          children: (0, n.jsxs)("div", {
                            className: "flex items-center w-full gap-5",
                            children: [
                              (0, n.jsx)("img", { src: t.icon, className: "w-11 h-11" }),
                              (0, n.jsx)(h.Z, {
                                color: "text-black-100 dark:text-white-100",
                                size: "sm",
                                className: "font-bold",
                                children: (0, a.LH)(o, t.coinDenom, 5)
                              })
                            ]
                          })
                        }),
                        (0, n.jsx)(d.a, { setShowFeesSettingSheet: H }),
                        (I || V || O) && (0, n.jsx)("p", { className: "text-sm font-bold text-red-600 px-2 mt-2", children: I || V || O }),
                        (0, n.jsx)("button", {
                          className: r()("w-full text-md font-bold text-white-100 h-12 rounded-full cursor-pointer bg-green-600", {
                            "hover:bg-green-500 ": !K,
                            "opacity-40": K
                          }),
                          disabled: K,
                          onClick: J,
                          "aria-label": "confirm claim button in earn usdn review claim tx sheet flow",
                          children: $
                            ? (0, n.jsx)(p(), {
                                loop: !0,
                                autoplay: !0,
                                animationData: v,
                                rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
                                className: "h-[24px] w-[24px]"
                              })
                            : (0, n.jsx)("span", {
                                "aria-label": "confirm claim button text in earn usdn review claim tx sheet flow",
                                children: "Confirm Claim"
                              })
                        })
                      ]
                    })
                  }),
                  F && (0, n.jsx)(m.Z, { showLedgerPopup: F }),
                  (0, n.jsx)(x.k, { showFeesSettingSheet: G, onClose: () => H(!1), gasError: V })
                ]
              })
            );
          });
          t();
        } catch (e) {
          t(e);
        }
      });
    },
    68708: function (e, l, i) {
      i.d(l, { F: () => v, Z: () => b });
      var t = i(52322),
        n = i(41172),
        s = i(75377),
        a = i(26007),
        o = i(14281),
        r = i(23751),
        c = i(69816),
        d = i(26571),
        x = i(96128),
        m = i.n(x),
        u = i(29750),
        h = i(24542),
        g = i.n(h);
      i(2784);
      var f = i(49409);
      function v(e) {
        let { provider: l, backgroundColor: i, rootDenomsStore: o, activeChain: r, activeNetwork: x } = e,
          [h] = (0, n.JsT)(o.allDenoms, r, x);
        return (0, t.jsx)(s.GenericCard, {
          onClick: () => {
            window.open(l.url, "_blank"),
              g().track(d.B_.ButtonClick, { buttonType: "stake", buttonName: "liquid staking redirection", redirectURL: l.url, stakeToken: h.coinDenom });
          },
          className: `${i} w-full`,
          img: (0, t.jsx)("img", { src: l.image ?? u.GenericLight, onError: (0, f._)(u.GenericLight), width: 30, height: 30, className: "rounded-full mr-4" }),
          isRounded: !0,
          size: "md",
          title: (0, t.jsx)(c.Z, { size: "sm", color: "text-black-100 dark:text-white-100", className: "font-bold overflow-hidden", children: l.name }),
          subtitle: (0, t.jsx)(c.Z, {
            size: "xs",
            color: "dark:text-gray-400 text-gray-600",
            className: "font-medium",
            children: l.apy ? `APY ${m()((100 * l.apy).toString(), { precision: 2, symbol: "" }).format()}%` : "N/A"
          }),
          icon: (0, t.jsx)(a.O, { size: 16, weight: "bold", className: "dark:text-white-100 text-black-100" })
        });
      }
      function b(e) {
        let { isVisible: l, onClose: i, providers: n, rootDenomsStore: s, forceChain: a, forceNetwork: c } = e;
        return (0, t.jsx)(o.Z, {
          isOpen: l,
          onClose: i,
          closeOnBackdropClick: !0,
          title: "Select Provider",
          className: "p-6",
          children: (0, t.jsxs)("div", {
            className: "flex flex-col gap-y-4",
            children: [
              0 === n.length && (0, t.jsx)(r.KE, {}),
              n.length > 0 &&
                n.map(e =>
                  (0, t.jsxs)(
                    "div",
                    {
                      className: "relative",
                      children: [
                        e.priority &&
                          (0, t.jsx)("div", {
                            className:
                              "text-white-100 dark:text-white-100 absolute top-0 right-4 px-1.5 py-0.5 bg-green-600 rounded-b-[4px] text-[10px] font-bold",
                            children: "Promoted"
                          }),
                        (0, t.jsx)(v, {
                          provider: e,
                          backgroundColor: `${e.priority ? "!bg-[#29A87426]" : "bg-white-100 dark:bg-gray-950"}`,
                          rootDenomsStore: s,
                          activeChain: a,
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
    87604: function (e, l, i) {
      i.d(l, { Z: () => g });
      var t = i(52322),
        n = i(41172),
        s = i(75377),
        a = i(63161),
        o = i(48272),
        r = i(96217),
        c = i(69816),
        d = i(96128),
        x = i.n(d),
        m = i(75958),
        u = i(2784),
        h = i(68708);
      let g = (0, m.Pi)(e => {
        let {
            isVisible: l,
            title: i,
            onClose: d,
            tokenLSProviders: m,
            handleStakeClick: g,
            rootDenomsStore: f,
            delegationsStore: v,
            validatorsStore: b,
            unDelegationsStore: p,
            claimRewardsStore: j,
            forceChain: w
          } = e,
          k = (0, n.a74)(),
          C = (0, u.useMemo)(() => w || k, [k, w]),
          y = f.allDenoms,
          N = v.delegationsForChain(C),
          D = b.validatorsForChain(C),
          S = p.unDelegationsForChain(C),
          Z = j.claimRewardsForChain(C),
          [M, L] = (0, u.useState)(!1),
          { minMaxApr: _ } = (0, n.nDu)(y, N, D, S, Z),
          z = (0, u.useMemo)(() => {
            if (_) {
              let e = (_[0] + _[1]) / 2;
              return x()((100 * e).toString(), { precision: 2, symbol: "" }).format();
            }
            return null;
          }, [_]),
          B = (0, u.useMemo)(() => {
            if (!((null == m ? void 0 : m.length) > 0)) return "N/A";
            {
              let e = Math.max(...m.map(e => e.apy));
              return `APY ${x()((100 * e).toString(), { precision: 2, symbol: "" }).format()}%`;
            }
          }, [m]);
        return (0, t.jsx)(r.Z, {
          isOpen: l,
          onClose: () => {
            L(!1), d();
          },
          title: i,
          className: "p-6",
          children: (0, t.jsxs)("div", {
            className: "flex flex-col gap-y-4",
            children: [
              (0, t.jsx)(s.GenericCard, {
                className: "bg-white-100 dark:bg-gray-950",
                title: (0, t.jsx)(c.Z, { size: "sm", color: "text-gray-800 dark:text-white-100", children: "Stake" }),
                subtitle: (0, t.jsxs)(c.Z, { size: "xs", color: "text-gray-700 dark:text-gray-400", children: ["APR ", z, "%"] }),
                size: "md",
                isRounded: !0,
                title2: (0, t.jsx)("button", {
                  onClick: g,
                  className: "rounded-full text-xs font-bold text-white-100 dark:text-gray-900 dark:bg-white-100 bg-gray-900 px-4 py-2",
                  children: "Stake"
                })
              }),
              (null == m ? void 0 : m.length) > 0 &&
                (0, t.jsxs)("div", {
                  className: "flex flex-col gap-y-3 p-4 bg-white-100 dark:bg-gray-950 rounded-2xl",
                  children: [
                    (0, t.jsxs)("div", {
                      className: "flex justify-between",
                      children: [
                        (0, t.jsxs)("div", {
                          className: "flex flex-col",
                          children: [
                            (0, t.jsx)(c.Z, {
                              size: "sm",
                              color: "text-gray-800 dark:text-white-100",
                              className: "font-bold",
                              "aria-label": "stake select sheet liquid stake title in stake v2 flow",
                              children: "Liquid Stake"
                            }),
                            (0, t.jsx)(c.Z, {
                              size: "xs",
                              color: "text-gray-700 dark:text-gray-400",
                              "aria-label": "stake select sheet liquid stake subtitle in stake v2 flow",
                              children: B
                            })
                          ]
                        }),
                        (0, t.jsx)("span", {
                          onClick: () => L(!M),
                          className:
                            "rounded-full text-xs font-bold bg-gray-50 dark:bg-gray-900 py-1 px-3 cursor-pointer flex items-center text-black-100 dark:text-white-100",
                          "aria-label": "stake select sheet liquid stake button in stake v2 flow",
                          children: M
                            ? (0, t.jsx)(a.U, { size: 16, className: "text-black-100 dark:text-white-100" })
                            : (0, t.jsx)(o.p, { size: 16, className: "text-black-100 dark:text-white-100" })
                        })
                      ]
                    }),
                    M &&
                      (0, t.jsx)(t.Fragment, {
                        children: (0, t.jsx)("div", {
                          className: "flex flex-col gap-y-4",
                          children:
                            m &&
                            m.map(e =>
                              (0, t.jsxs)(
                                "div",
                                {
                                  className: "relative",
                                  children: [
                                    e.priority &&
                                      (0, t.jsx)("div", {
                                        className:
                                          "text-white-100 dark:text-white-100 absolute top-0 right-4 px-1.5 py-0.5 bg-green-600 rounded-b-[4px] text-[10px] font-bold",
                                        children: "Promoted"
                                      }),
                                    (0, t.jsx)(
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
    23490: function (e, l, i) {
      i.d(l, { S: () => r });
      var t = i(93407),
        n = i(53108),
        s = i(80075),
        a = i(72565),
        o = i.n(a);
      let r = new (class {
        async initEarnBannerShow() {
          "false" !== (await o().storage.local.get(n.Q8))[n.Q8] && this.setShow("true");
        }
        setShow(e) {
          (this.show = e), o().storage.local.set({ [n.Q8]: e });
        }
        constructor() {
          (0, t._)(this, "show", "false"), (0, s.ky)(this), this.initEarnBannerShow();
        }
      })();
    }
  }
]);
//# sourceMappingURL=7475.js.map
