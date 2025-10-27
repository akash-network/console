!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "ce8f0694-9913-4284-acf2-9ab1af33d50e"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-ce8f0694-9913-4284-acf2-9ab1af33d50e"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.22.9" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["1347"],
  {
    15256: function (e, t, n) {
      n.d(t, { fC: () => S, z$: () => T });
      var r = n(2784);
      function o(e, t) {
        if ("function" == typeof e) return e(t);
        null != e && (e.current = t);
      }
      function i(...e) {
        return t => {
          let n = !1,
            r = e.map(e => {
              let r = o(e, t);
              return n || "function" != typeof r || (n = !0), r;
            });
          if (n)
            return () => {
              for (let t = 0; t < r.length; t++) {
                let n = r[t];
                "function" == typeof n ? n() : o(e[t], null);
              }
            };
        };
      }
      var u = n(52322);
      function l(e, t, { checkForDefaultPrevented: n = !0 } = {}) {
        return function (r) {
          if ((e?.(r), !1 === n || !r.defaultPrevented)) return t?.(r);
        };
      }
      function a(e) {
        let t = r.useRef(e);
        return (
          r.useEffect(() => {
            t.current = e;
          }),
          r.useMemo(
            () =>
              (...e) =>
                t.current?.(...e),
            []
          )
        );
      }
      var s = globalThis?.document ? r.useLayoutEffect : () => {};
      function c(e, t) {
        if ("function" == typeof e) return e(t);
        null != e && (e.current = t);
      }
      var f = globalThis?.document ? r.useLayoutEffect : () => {},
        d = e => {
          var t;
          let n, o;
          let { present: i, children: u } = e,
            l = (function (e) {
              var t, n;
              let [o, i] = r.useState(),
                u = r.useRef({}),
                l = r.useRef(e),
                a = r.useRef("none"),
                [s, c] =
                  ((t = e ? "mounted" : "unmounted"),
                  (n = {
                    mounted: { UNMOUNT: "unmounted", ANIMATION_OUT: "unmountSuspended" },
                    unmountSuspended: { MOUNT: "mounted", ANIMATION_END: "unmounted" },
                    unmounted: { MOUNT: "mounted" }
                  }),
                  r.useReducer((e, t) => n[e][t] ?? e, t));
              return (
                r.useEffect(() => {
                  let e = p(u.current);
                  a.current = "mounted" === s ? e : "none";
                }, [s]),
                f(() => {
                  let t = u.current,
                    n = l.current;
                  if (n !== e) {
                    let r = a.current,
                      o = p(t);
                    e ? c("MOUNT") : "none" === o || t?.display === "none" ? c("UNMOUNT") : n && r !== o ? c("ANIMATION_OUT") : c("UNMOUNT"), (l.current = e);
                  }
                }, [e, c]),
                f(() => {
                  if (o) {
                    let e;
                    let t = o.ownerDocument.defaultView ?? window,
                      n = n => {
                        let r = p(u.current).includes(n.animationName);
                        if (n.target === o && r && (c("ANIMATION_END"), !l.current)) {
                          let n = o.style.animationFillMode;
                          (o.style.animationFillMode = "forwards"),
                            (e = t.setTimeout(() => {
                              "forwards" === o.style.animationFillMode && (o.style.animationFillMode = n);
                            }));
                        }
                      },
                      r = e => {
                        e.target === o && (a.current = p(u.current));
                      };
                    return (
                      o.addEventListener("animationstart", r),
                      o.addEventListener("animationcancel", n),
                      o.addEventListener("animationend", n),
                      () => {
                        t.clearTimeout(e),
                          o.removeEventListener("animationstart", r),
                          o.removeEventListener("animationcancel", n),
                          o.removeEventListener("animationend", n);
                      }
                    );
                  }
                  c("ANIMATION_END");
                }, [o, c]),
                {
                  isPresent: ["mounted", "unmountSuspended"].includes(s),
                  ref: r.useCallback(e => {
                    e && (u.current = getComputedStyle(e)), i(e);
                  }, [])
                }
              );
            })(i),
            a = "function" == typeof u ? u({ present: l.isPresent }) : r.Children.only(u),
            s = (function (...e) {
              return r.useCallback(
                (function (...e) {
                  return t => {
                    let n = !1,
                      r = e.map(e => {
                        let r = c(e, t);
                        return n || "function" != typeof r || (n = !0), r;
                      });
                    if (n)
                      return () => {
                        for (let t = 0; t < r.length; t++) {
                          let n = r[t];
                          "function" == typeof n ? n() : c(e[t], null);
                        }
                      };
                  };
                })(...e),
                e
              );
            })(
              l.ref,
              ((t = a),
              (o = (n = Object.getOwnPropertyDescriptor(t.props, "ref")?.get) && "isReactWarning" in n && n.isReactWarning)
                ? t.ref
                : (o = (n = Object.getOwnPropertyDescriptor(t, "ref")?.get) && "isReactWarning" in n && n.isReactWarning)
                  ? t.props.ref
                  : t.props.ref || t.ref)
            );
          return "function" == typeof u || l.isPresent ? r.cloneElement(a, { ref: s }) : null;
        };
      function p(e) {
        return e?.animationName || "none";
      }
      (d.displayName = "Presence"), n(28316);
      var m = r.forwardRef((e, t) => {
        let { children: n, ...o } = e,
          i = r.Children.toArray(n),
          l = i.find(b);
        if (l) {
          let e = l.props.children,
            n = i.map(t => (t !== l ? t : r.Children.count(e) > 1 ? r.Children.only(null) : r.isValidElement(e) ? e.props.children : null));
          return (0, u.jsx)(y, { ...o, ref: t, children: r.isValidElement(e) ? r.cloneElement(e, void 0, n) : null });
        }
        return (0, u.jsx)(y, { ...o, ref: t, children: n });
      });
      m.displayName = "Slot";
      var y = r.forwardRef((e, t) => {
        let { children: n, ...o } = e;
        if (r.isValidElement(n)) {
          var u;
          let e, l;
          let a =
            ((u = n),
            (l = (e = Object.getOwnPropertyDescriptor(u.props, "ref")?.get) && "isReactWarning" in e && e.isReactWarning)
              ? u.ref
              : (l = (e = Object.getOwnPropertyDescriptor(u, "ref")?.get) && "isReactWarning" in e && e.isReactWarning)
                ? u.props.ref
                : u.props.ref || u.ref);
          return r.cloneElement(n, {
            ...(function (e, t) {
              let n = { ...t };
              for (let r in t) {
                let o = e[r],
                  i = t[r];
                /^on[A-Z]/.test(r)
                  ? o && i
                    ? (n[r] = (...e) => {
                        i(...e), o(...e);
                      })
                    : o && (n[r] = o)
                  : "style" === r
                    ? (n[r] = { ...o, ...i })
                    : "className" === r && (n[r] = [o, i].filter(Boolean).join(" "));
              }
              return { ...e, ...n };
            })(o, n.props),
            ref: t ? i(t, a) : a
          });
        }
        return r.Children.count(n) > 1 ? r.Children.only(null) : null;
      });
      y.displayName = "SlotClone";
      var v = ({ children: e }) => (0, u.jsx)(u.Fragment, { children: e });
      function b(e) {
        return r.isValidElement(e) && e.type === v;
      }
      var g = ["a", "button", "div", "form", "h2", "h3", "img", "input", "label", "li", "nav", "ol", "p", "span", "svg", "ul"].reduce((e, t) => {
          let n = r.forwardRef((e, n) => {
            let { asChild: r, ...o } = e,
              i = r ? m : t;
            return "undefined" != typeof window && (window[Symbol.for("radix-ui")] = !0), (0, u.jsx)(i, { ...o, ref: n });
          });
          return (n.displayName = `Primitive.${t}`), { ...e, [t]: n };
        }, {}),
        h = "Checkbox",
        [w, N] = (function (e, t = []) {
          let n = [],
            o = () => {
              let t = n.map(e => r.createContext(e));
              return function (n) {
                let o = n?.[e] || t;
                return r.useMemo(() => ({ [`__scope${e}`]: { ...n, [e]: o } }), [n, o]);
              };
            };
          return (
            (o.scopeName = e),
            [
              function (t, o) {
                let i = r.createContext(o),
                  l = n.length;
                n = [...n, o];
                let a = t => {
                  let { scope: n, children: o, ...a } = t,
                    s = n?.[e]?.[l] || i,
                    c = r.useMemo(() => a, Object.values(a));
                  return (0, u.jsx)(s.Provider, { value: c, children: o });
                };
                return (
                  (a.displayName = t + "Provider"),
                  [
                    a,
                    function (n, u) {
                      let a = u?.[e]?.[l] || i,
                        s = r.useContext(a);
                      if (s) return s;
                      if (void 0 !== o) return o;
                      throw Error(`\`${n}\` must be used within \`${t}\``);
                    }
                  ]
                );
              },
              (function (...e) {
                let t = e[0];
                if (1 === e.length) return t;
                let n = () => {
                  let n = e.map(e => ({ useScope: e(), scopeName: e.scopeName }));
                  return function (e) {
                    let o = n.reduce((t, { useScope: n, scopeName: r }) => {
                      let o = n(e)[`__scope${r}`];
                      return { ...t, ...o };
                    }, {});
                    return r.useMemo(() => ({ [`__scope${t.scopeName}`]: o }), [o]);
                  };
                };
                return (n.scopeName = t.scopeName), n;
              })(o, ...t)
            ]
          );
        })(h),
        [E, x] = w(h),
        R = r.forwardRef((e, t) => {
          let { __scopeCheckbox: n, name: o, checked: s, defaultChecked: c, required: f, disabled: d, value: p = "on", onCheckedChange: m, form: y, ...v } = e,
            [b, h] = r.useState(null),
            w = (function (...e) {
              return r.useCallback(i(...e), e);
            })(t, e => h(e)),
            N = r.useRef(!1),
            x = !b || y || !!b.closest("form"),
            [R = !1, k] = (function ({ prop: e, defaultProp: t, onChange: n = () => {} }) {
              let [o, i] = (function ({ defaultProp: e, onChange: t }) {
                  let n = r.useState(e),
                    [o] = n,
                    i = r.useRef(o),
                    u = a(t);
                  return (
                    r.useEffect(() => {
                      i.current !== o && (u(o), (i.current = o));
                    }, [o, i, u]),
                    n
                  );
                })({ defaultProp: t, onChange: n }),
                u = void 0 !== e,
                l = u ? e : o,
                s = a(n);
              return [
                l,
                r.useCallback(
                  t => {
                    if (u) {
                      let n = "function" == typeof t ? t(e) : t;
                      n !== e && s(n);
                    } else i(t);
                  },
                  [u, e, i, s]
                )
              ];
            })({ prop: s, defaultProp: c, onChange: m }),
            C = r.useRef(R);
          return (
            r.useEffect(() => {
              let e = b?.form;
              if (e) {
                let t = () => k(C.current);
                return e.addEventListener("reset", t), () => e.removeEventListener("reset", t);
              }
            }, [b, k]),
            (0, u.jsxs)(E, {
              scope: n,
              state: R,
              disabled: d,
              children: [
                (0, u.jsx)(g.button, {
                  type: "button",
                  role: "checkbox",
                  "aria-checked": _(R) ? "mixed" : R,
                  "aria-required": f,
                  "data-state": M(R),
                  "data-disabled": d ? "" : void 0,
                  disabled: d,
                  value: p,
                  ...v,
                  ref: w,
                  onKeyDown: l(e.onKeyDown, e => {
                    "Enter" === e.key && e.preventDefault();
                  }),
                  onClick: l(e.onClick, e => {
                    k(e => !!_(e) || !e), x && ((N.current = e.isPropagationStopped()), N.current || e.stopPropagation());
                  })
                }),
                x &&
                  (0, u.jsx)(O, {
                    control: b,
                    bubbles: !N.current,
                    name: o,
                    value: p,
                    checked: R,
                    required: f,
                    disabled: d,
                    form: y,
                    style: { transform: "translateX(-100%)" },
                    defaultChecked: !_(c) && c
                  })
              ]
            })
          );
        });
      R.displayName = h;
      var k = "CheckboxIndicator",
        C = r.forwardRef((e, t) => {
          let { __scopeCheckbox: n, forceMount: r, ...o } = e,
            i = x(k, n);
          return (0, u.jsx)(d, {
            present: r || _(i.state) || !0 === i.state,
            children: (0, u.jsx)(g.span, {
              "data-state": M(i.state),
              "data-disabled": i.disabled ? "" : void 0,
              ...o,
              ref: t,
              style: { pointerEvents: "none", ...e.style }
            })
          });
        });
      C.displayName = k;
      var O = e => {
        let { control: t, checked: n, bubbles: o = !0, defaultChecked: i, ...l } = e,
          a = r.useRef(null),
          c = (function (e) {
            let t = r.useRef({ value: e, previous: e });
            return r.useMemo(() => (t.current.value !== e && ((t.current.previous = t.current.value), (t.current.value = e)), t.current.previous), [e]);
          })(n),
          f = (function (e) {
            let [t, n] = r.useState(void 0);
            return (
              s(() => {
                if (e) {
                  n({ width: e.offsetWidth, height: e.offsetHeight });
                  let t = new ResizeObserver(t => {
                    let r, o;
                    if (!Array.isArray(t) || !t.length) return;
                    let i = t[0];
                    if ("borderBoxSize" in i) {
                      let e = i.borderBoxSize,
                        t = Array.isArray(e) ? e[0] : e;
                      (r = t.inlineSize), (o = t.blockSize);
                    } else (r = e.offsetWidth), (o = e.offsetHeight);
                    n({ width: r, height: o });
                  });
                  return t.observe(e, { box: "border-box" }), () => t.unobserve(e);
                }
                n(void 0);
              }, [e]),
              t
            );
          })(t);
        r.useEffect(() => {
          let e = a.current,
            t = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked").set;
          if (c !== n && t) {
            let r = new Event("click", { bubbles: o });
            (e.indeterminate = _(n)), t.call(e, !_(n) && n), e.dispatchEvent(r);
          }
        }, [c, n, o]);
        let d = r.useRef(!_(n) && n);
        return (0, u.jsx)("input", {
          type: "checkbox",
          "aria-hidden": !0,
          defaultChecked: i ?? d.current,
          ...l,
          tabIndex: -1,
          ref: a,
          style: { ...e.style, ...f, position: "absolute", pointerEvents: "none", opacity: 0, margin: 0 }
        });
      };
      function _(e) {
        return "indeterminate" === e;
      }
      function M(e) {
        return _(e) ? "indeterminate" : e ? "checked" : "unchecked";
      }
      var S = R,
        T = C;
    }
  }
]);
//# sourceMappingURL=1347.js.map
