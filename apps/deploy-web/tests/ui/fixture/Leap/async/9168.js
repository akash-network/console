/*! For license information please see 9168.js.LICENSE.txt */
!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      r = new e.Error().stack;
    r &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[r] = "97df651d-2cb1-44dd-81ec-15949d6566c2"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-97df651d-2cb1-44dd-81ec-15949d6566c2"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.22.9" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["9168"],
  {
    8282: function (e, r, t) {
      t.d(r, { Z5: () => iy, _l: () => i1, bK: () => i3 });
      var n,
        i,
        o,
        a,
        l,
        u,
        c,
        s,
        d,
        p,
        f,
        g,
        m,
        v,
        b,
        h,
        y,
        x,
        I,
        D = t(2784),
        E = t(12485),
        w = t(13714),
        C = t(95300);
      function P(e, r) {
        var t = Object.keys(e);
        if (Object.getOwnPropertySymbols) {
          var n = Object.getOwnPropertySymbols(e);
          r &&
            (n = n.filter(function (r) {
              return Object.getOwnPropertyDescriptor(e, r).enumerable;
            })),
            t.push.apply(t, n);
        }
        return t;
      }
      function S(e) {
        for (var r = 1; r < arguments.length; r++) {
          var t = null != arguments[r] ? arguments[r] : {};
          r % 2
            ? P(Object(t), !0).forEach(function (r) {
                !(function (e, r, t) {
                  var n;
                  ((n = (function (e, r) {
                    if ("object" != (0, C.Z)(e) || !e) return e;
                    var t = e[Symbol.toPrimitive];
                    if (void 0 !== t) {
                      var n = t.call(e, r || "default");
                      if ("object" != (0, C.Z)(n)) return n;
                      throw TypeError("@@toPrimitive must return a primitive value.");
                    }
                    return ("string" === r ? String : Number)(e);
                  })(r, "string")),
                  (r = "symbol" == (0, C.Z)(n) ? n : n + "") in e)
                    ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 })
                    : (e[r] = t);
                })(e, r, t[r]);
              })
            : Object.getOwnPropertyDescriptors
              ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t))
              : P(Object(t)).forEach(function (r) {
                  Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
                });
        }
        return e;
      }
      function A(e) {
        return (
          "Minified Redux error #" +
          e +
          "; visit https://redux.js.org/Errors?code=" +
          e +
          " for the full message or use the non-minified dev environment for full errors. "
        );
      }
      var N = ("function" == typeof Symbol && Symbol.observable) || "@@observable",
        O = function () {
          return Math.random().toString(36).substring(7).split("").join(".");
        },
        R = {
          INIT: "@@redux/INIT" + O(),
          REPLACE: "@@redux/REPLACE" + O(),
          PROBE_UNKNOWN_ACTION: function () {
            return "@@redux/PROBE_UNKNOWN_ACTION" + O();
          }
        };
      function B(e, r) {
        return function () {
          return r(e.apply(this, arguments));
        };
      }
      function T(e, r) {
        if ("function" == typeof e) return B(e, r);
        if ("object" != typeof e || null === e) throw Error(A(16));
        var t = {};
        for (var n in e) {
          var i = e[n];
          "function" == typeof i && (t[n] = B(i, r));
        }
        return t;
      }
      function L() {
        for (var e = arguments.length, r = Array(e), t = 0; t < e; t++) r[t] = arguments[t];
        return 0 === r.length
          ? function (e) {
              return e;
            }
          : 1 === r.length
            ? r[0]
            : r.reduce(function (e, r) {
                return function () {
                  return e(r.apply(void 0, arguments));
                };
              });
      }
      var G = D.createContext(null),
        M = function (e) {
          e();
        },
        _ = {
          notify: function () {},
          get: function () {
            return [];
          }
        };
      function F(e, r) {
        var t,
          n = _;
        function i() {
          a.onStateChange && a.onStateChange();
        }
        function o() {
          if (!t) {
            var o, a, l;
            (t = r ? r.addNestedSub(i) : e.subscribe(i)),
              (o = M),
              (a = null),
              (l = null),
              (n = {
                clear: function () {
                  (a = null), (l = null);
                },
                notify: function () {
                  o(function () {
                    for (var e = a; e; ) e.callback(), (e = e.next);
                  });
                },
                get: function () {
                  for (var e = [], r = a; r; ) e.push(r), (r = r.next);
                  return e;
                },
                subscribe: function (e) {
                  var r = !0,
                    t = (l = { callback: e, next: null, prev: l });
                  return (
                    t.prev ? (t.prev.next = t) : (a = t),
                    function () {
                      r && null !== a && ((r = !1), t.next ? (t.next.prev = t.prev) : (l = t.prev), t.prev ? (t.prev.next = t.next) : (a = t.next));
                    }
                  );
                }
              });
          }
        }
        var a = {
          addNestedSub: function (e) {
            return o(), n.subscribe(e);
          },
          notifyNestedSubs: function () {
            n.notify();
          },
          handleChangeWrapper: i,
          isSubscribed: function () {
            return !!t;
          },
          trySubscribe: o,
          tryUnsubscribe: function () {
            t && (t(), (t = void 0), n.clear(), (n = _));
          },
          getListeners: function () {
            return n;
          }
        };
        return a;
      }
      var k = "undefined" != typeof window && void 0 !== window.document && void 0 !== window.document.createElement ? D.useLayoutEffect : D.useEffect;
      let W = function (e) {
        var r = e.store,
          t = e.context,
          n = e.children,
          i = (0, D.useMemo)(
            function () {
              var e = F(r);
              return { store: r, subscription: e };
            },
            [r]
          ),
          o = (0, D.useMemo)(
            function () {
              return r.getState();
            },
            [r]
          );
        return (
          k(
            function () {
              var e = i.subscription;
              return (
                (e.onStateChange = e.notifyNestedSubs),
                e.trySubscribe(),
                o !== r.getState() && e.notifyNestedSubs(),
                function () {
                  e.tryUnsubscribe(), (e.onStateChange = null);
                }
              );
            },
            [i, o]
          ),
          D.createElement((t || G).Provider, { value: i }, n)
        );
      };
      var U = t(83660),
        j = t(73463),
        H = t.n(j),
        Z = t(63920),
        q = ["getDisplayName", "methodName", "renderCountProp", "shouldHandleStateChanges", "storeKey", "withRef", "forwardRef", "context"],
        V = ["reactReduxForwardedRef"],
        z = [],
        Y = [null, null];
      function J(e, r) {
        var t = e[1];
        return [r.payload, t + 1];
      }
      function X(e, r, t) {
        k(function () {
          return e.apply(void 0, r);
        }, t);
      }
      function K(e, r, t, n, i, o, a) {
        (e.current = n), (r.current = i), (t.current = !1), o.current && ((o.current = null), a());
      }
      function $(e, r, t, n, i, o, a, l, u, c) {
        if (e) {
          var s = !1,
            d = null,
            p = function () {
              if (!s) {
                var e,
                  t,
                  p = r.getState();
                try {
                  e = n(p, i.current);
                } catch (e) {
                  (t = e), (d = e);
                }
                t || (d = null),
                  e === o.current
                    ? a.current || u()
                    : ((o.current = e), (l.current = e), (a.current = !0), c({ type: "STORE_UPDATED", payload: { error: t } }));
              }
            };
          return (
            (t.onStateChange = p),
            t.trySubscribe(),
            p(),
            function () {
              if (((s = !0), t.tryUnsubscribe(), (t.onStateChange = null), d)) throw d;
            }
          );
        }
      }
      var Q = function () {
        return [null, 0];
      };
      function ee(e, r) {
        return e === r ? 0 !== e || 0 !== r || 1 / e == 1 / r : e != e && r != r;
      }
      function er(e, r) {
        if (ee(e, r)) return !0;
        if ("object" != typeof e || null === e || "object" != typeof r || null === r) return !1;
        var t = Object.keys(e),
          n = Object.keys(r);
        if (t.length !== n.length) return !1;
        for (var i = 0; i < t.length; i++) if (!Object.prototype.hasOwnProperty.call(r, t[i]) || !ee(e[t[i]], r[t[i]])) return !1;
        return !0;
      }
      function et(e) {
        return function (r, t) {
          var n = e(r, t);
          function i() {
            return n;
          }
          return (i.dependsOnOwnProps = !1), i;
        };
      }
      function en(e) {
        return null !== e.dependsOnOwnProps && void 0 !== e.dependsOnOwnProps ? !!e.dependsOnOwnProps : 1 !== e.length;
      }
      function ei(e, r) {
        return function (r, t) {
          t.displayName;
          var n = function (e, r) {
            return n.dependsOnOwnProps ? n.mapToProps(e, r) : n.mapToProps(e);
          };
          return (
            (n.dependsOnOwnProps = !0),
            (n.mapToProps = function (r, t) {
              (n.mapToProps = e), (n.dependsOnOwnProps = en(e));
              var i = n(r, t);
              return "function" == typeof i && ((n.mapToProps = i), (n.dependsOnOwnProps = en(i)), (i = n(r, t))), i;
            }),
            n
          );
        };
      }
      let eo = [
          function (e) {
            return "function" == typeof e ? ei(e, "mapDispatchToProps") : void 0;
          },
          function (e) {
            return e
              ? void 0
              : et(function (e) {
                  return { dispatch: e };
                });
          },
          function (e) {
            return e && "object" == typeof e
              ? et(function (r) {
                  return (function (e, r) {
                    var t = {};
                    for (var n in e)
                      !(function (n) {
                        var i = e[n];
                        "function" == typeof i &&
                          (t[n] = function () {
                            return r(i.apply(void 0, arguments));
                          });
                      })(n);
                    return t;
                  })(e, r);
                })
              : void 0;
          }
        ],
        ea = [
          function (e) {
            return "function" == typeof e ? ei(e, "mapStateToProps") : void 0;
          },
          function (e) {
            return e
              ? void 0
              : et(function () {
                  return {};
                });
          }
        ];
      function el(e, r, t) {
        return (0, w.Z)({}, t, e, r);
      }
      let eu = [
        function (e) {
          return "function" == typeof e
            ? function (r, t) {
                t.displayName;
                var n,
                  i = t.pure,
                  o = t.areMergedPropsEqual,
                  a = !1;
                return function (r, t, l) {
                  var u = e(r, t, l);
                  return a ? (i && o(u, n)) || (n = u) : ((a = !0), (n = u)), n;
                };
              }
            : void 0;
        },
        function (e) {
          return e
            ? void 0
            : function () {
                return el;
              };
        }
      ];
      var ec = ["initMapStateToProps", "initMapDispatchToProps", "initMergeProps"],
        es = ["pure", "areStatesEqual", "areOwnPropsEqual", "areStatePropsEqual", "areMergedPropsEqual"];
      function ed(e, r, t) {
        for (var n = r.length - 1; n >= 0; n--) {
          var i = r[n](e);
          if (i) return i;
        }
        return function (r, n) {
          throw Error("Invalid value of type " + typeof e + " for " + t + " argument when connecting component " + n.wrappedComponentName + ".");
        };
      }
      function ep(e, r) {
        return e === r;
      }
      let ef =
        ((o =
          void 0 === (i = (n = {}).connectHOC)
            ? function (e, r) {
                void 0 === r && (r = {});
                var t = r,
                  n = t.getDisplayName,
                  i =
                    void 0 === n
                      ? function (e) {
                          return "ConnectAdvanced(" + e + ")";
                        }
                      : n,
                  o = t.methodName,
                  a = void 0 === o ? "connectAdvanced" : o,
                  l = t.renderCountProp,
                  u = void 0 === l ? void 0 : l,
                  c = t.shouldHandleStateChanges,
                  s = void 0 === c || c,
                  d = t.storeKey,
                  p = void 0 === d ? "store" : d,
                  f = (t.withRef, t.forwardRef),
                  g = void 0 !== f && f,
                  m = t.context,
                  v = (0, U.Z)(t, q),
                  b = void 0 === m ? G : m;
                return function (r) {
                  var t = r.displayName || r.name || "Component",
                    n = i(t),
                    o = (0, w.Z)({}, v, {
                      getDisplayName: i,
                      methodName: a,
                      renderCountProp: u,
                      shouldHandleStateChanges: s,
                      storeKey: p,
                      displayName: n,
                      wrappedComponentName: t,
                      WrappedComponent: r
                    }),
                    l = v.pure,
                    c = l
                      ? D.useMemo
                      : function (e) {
                          return e();
                        };
                  function d(t) {
                    var n = (0, D.useMemo)(
                        function () {
                          var e = t.reactReduxForwardedRef,
                            r = (0, U.Z)(t, V);
                          return [t.context, e, r];
                        },
                        [t]
                      ),
                      i = n[0],
                      a = n[1],
                      l = n[2],
                      u = (0, D.useMemo)(
                        function () {
                          return i && i.Consumer && (0, Z.isContextConsumer)(D.createElement(i.Consumer, null)) ? i : b;
                        },
                        [i, b]
                      ),
                      d = (0, D.useContext)(u),
                      p = !!t.store && !!t.store.getState && !!t.store.dispatch;
                    d && d.store;
                    var f = p ? t.store : d.store,
                      g = (0, D.useMemo)(
                        function () {
                          return e(f.dispatch, o);
                        },
                        [f]
                      ),
                      m = (0, D.useMemo)(
                        function () {
                          if (!s) return Y;
                          var e = F(f, p ? null : d.subscription),
                            r = e.notifyNestedSubs.bind(e);
                          return [e, r];
                        },
                        [f, p, d]
                      ),
                      v = m[0],
                      h = m[1],
                      y = (0, D.useMemo)(
                        function () {
                          return p ? d : (0, w.Z)({}, d, { subscription: v });
                        },
                        [p, d, v]
                      ),
                      x = (0, D.useReducer)(J, z, Q),
                      I = x[0][0],
                      E = x[1];
                    if (I && I.error) throw I.error;
                    var C = (0, D.useRef)(),
                      P = (0, D.useRef)(l),
                      S = (0, D.useRef)(),
                      A = (0, D.useRef)(!1),
                      N = c(
                        function () {
                          return S.current && l === P.current ? S.current : g(f.getState(), l);
                        },
                        [f, I, l]
                      );
                    X(K, [P, C, A, l, N, S, h]), X($, [s, f, v, g, P, C, A, S, h, E], [f, v, g]);
                    var O = (0, D.useMemo)(
                      function () {
                        return D.createElement(r, (0, w.Z)({}, N, { ref: a }));
                      },
                      [a, r, N]
                    );
                    return (0, D.useMemo)(
                      function () {
                        return s ? D.createElement(u.Provider, { value: y }, O) : O;
                      },
                      [u, O, y]
                    );
                  }
                  var f = l ? D.memo(d) : d;
                  if (((f.WrappedComponent = r), (f.displayName = d.displayName = n), g)) {
                    var m = D.forwardRef(function (e, r) {
                      return D.createElement(f, (0, w.Z)({}, e, { reactReduxForwardedRef: r }));
                    });
                    return (m.displayName = n), (m.WrappedComponent = r), H()(m, r);
                  }
                  return H()(f, r);
                };
              }
            : i),
        (l = void 0 === (a = n.mapStateToPropsFactories) ? ea : a),
        (c = void 0 === (u = n.mapDispatchToPropsFactories) ? eo : u),
        (d = void 0 === (s = n.mergePropsFactories) ? eu : s),
        (f =
          void 0 === (p = n.selectorFactory)
            ? function (e, r) {
                var t = r.initMapStateToProps,
                  n = r.initMapDispatchToProps,
                  i = r.initMergeProps,
                  o = (0, U.Z)(r, ec),
                  a = t(e, o),
                  l = n(e, o),
                  u = i(e, o);
                return (
                  o.pure
                    ? function (e, r, t, n, i) {
                        var o,
                          a,
                          l,
                          u,
                          c,
                          s = i.areStatesEqual,
                          d = i.areOwnPropsEqual,
                          p = i.areStatePropsEqual,
                          f = !1;
                        return function (i, g) {
                          var m, v, b, h, y, x;
                          return f
                            ? ((m = i),
                              (y = !d((v = g), a)),
                              (x = !s(m, o, v, a)),
                              ((o = m), (a = v), y && x)
                                ? ((l = e(o, a)), r.dependsOnOwnProps && (u = r(n, a)), (c = t(l, u, a)))
                                : y
                                  ? (e.dependsOnOwnProps && (l = e(o, a)), r.dependsOnOwnProps && (u = r(n, a)), (c = t(l, u, a)))
                                  : x
                                    ? ((h = !p((b = e(o, a)), l)), (l = b), h && (c = t(l, u, a)), c)
                                    : c)
                            : ((l = e((o = i), (a = g))), (u = r(n, a)), (c = t(l, u, a)), (f = !0), c);
                        };
                      }
                    : function (e, r, t, n) {
                        return function (i, o) {
                          return t(e(i, o), r(n, o), o);
                        };
                      }
                )(a, l, u, e, o);
              }
            : p),
        function (e, r, t, n) {
          void 0 === n && (n = {});
          var i = n,
            a = i.pure,
            u = i.areStatesEqual,
            s = i.areOwnPropsEqual,
            p = void 0 === s ? er : s,
            g = i.areStatePropsEqual,
            m = void 0 === g ? er : g,
            v = i.areMergedPropsEqual,
            b = void 0 === v ? er : v,
            h = (0, U.Z)(i, es),
            y = ed(e, l, "mapStateToProps"),
            x = ed(r, c, "mapDispatchToProps"),
            I = ed(t, d, "mergeProps");
          return o(
            f,
            (0, w.Z)(
              {
                methodName: "connect",
                getDisplayName: function (e) {
                  return "Connect(" + e + ")";
                },
                shouldHandleStateChanges: !!e,
                initMapStateToProps: y,
                initMapDispatchToProps: x,
                initMergeProps: I,
                pure: void 0 === a || a,
                areStatesEqual: void 0 === u ? ep : u,
                areOwnPropsEqual: p,
                areStatePropsEqual: m,
                areMergedPropsEqual: b
              },
              h
            )
          );
        });
      var eg = t(28316);
      function em(e, r) {
        var t = (0, D.useState)(function () {
            return { inputs: r, result: e() };
          })[0],
          n = (0, D.useRef)(!0),
          i = (0, D.useRef)(t),
          o =
            n.current ||
            (r &&
              i.current.inputs &&
              (function (e, r) {
                if (e.length !== r.length) return !1;
                for (var t = 0; t < e.length; t++) if (e[t] !== r[t]) return !1;
                return !0;
              })(r, i.current.inputs))
              ? i.current
              : { inputs: r, result: e() };
        return (
          (0, D.useEffect)(
            function () {
              (n.current = !1), (i.current = o);
            },
            [o]
          ),
          o.result
        );
      }
      M = eg.unstable_batchedUpdates;
      var ev = function (e, r) {
          return em(function () {
            return e;
          }, r);
        },
        eb = function (e) {
          var r = e.top,
            t = e.right,
            n = e.bottom,
            i = e.left;
          return { top: r, right: t, bottom: n, left: i, width: t - i, height: n - r, x: i, y: r, center: { x: (t + i) / 2, y: (n + r) / 2 } };
        },
        eh = function (e, r) {
          return { top: e.top - r.top, left: e.left - r.left, bottom: e.bottom + r.bottom, right: e.right + r.right };
        },
        ey = function (e, r) {
          return { top: e.top + r.top, left: e.left + r.left, bottom: e.bottom - r.bottom, right: e.right - r.right };
        },
        ex = { top: 0, right: 0, bottom: 0, left: 0 },
        eI = function (e) {
          var r = e.borderBox,
            t = e.margin,
            n = void 0 === t ? ex : t,
            i = e.border,
            o = void 0 === i ? ex : i,
            a = e.padding,
            l = void 0 === a ? ex : a,
            u = eb(eh(r, n)),
            c = eb(ey(r, o)),
            s = eb(ey(c, l));
          return { marginBox: u, borderBox: eb(r), paddingBox: c, contentBox: s, margin: n, border: o, padding: l };
        },
        eD = function (e) {
          var r = e.slice(0, -2);
          if ("px" !== e.slice(-2)) return 0;
          var t = Number(r);
          return (
            isNaN(t) &&
              (function (e, r) {
                if (!e) throw Error("Invariant failed");
              })(!1),
            t
          );
        },
        eE = function (e, r) {
          var t = e.borderBox,
            n = e.border,
            i = e.margin,
            o = e.padding;
          return eI({ borderBox: { top: t.top + r.y, left: t.left + r.x, bottom: t.bottom + r.y, right: t.right + r.x }, border: n, margin: i, padding: o });
        },
        ew = function (e, r) {
          return void 0 === r && (r = { x: window.pageXOffset, y: window.pageYOffset }), eE(e, r);
        },
        eC = function (e, r) {
          return eI({
            borderBox: e,
            margin: { top: eD(r.marginTop), right: eD(r.marginRight), bottom: eD(r.marginBottom), left: eD(r.marginLeft) },
            padding: { top: eD(r.paddingTop), right: eD(r.paddingRight), bottom: eD(r.paddingBottom), left: eD(r.paddingLeft) },
            border: { top: eD(r.borderTopWidth), right: eD(r.borderRightWidth), bottom: eD(r.borderBottomWidth), left: eD(r.borderLeftWidth) }
          });
        },
        eP = function (e) {
          return eC(e.getBoundingClientRect(), window.getComputedStyle(e));
        },
        eS =
          Number.isNaN ||
          function (e) {
            return "number" == typeof e && e != e;
          };
      function eA(e, r) {
        if (e.length !== r.length) return !1;
        for (var t, n, i = 0; i < e.length; i++) if (!((t = e[i]) === (n = r[i]) || (eS(t) && eS(n)))) return !1;
        return !0;
      }
      let eN = function (e, r) {
          void 0 === r && (r = eA);
          var t,
            n,
            i = [],
            o = !1;
          return function () {
            for (var a = [], l = 0; l < arguments.length; l++) a[l] = arguments[l];
            return (o && t === this && r(a, i)) || ((n = e.apply(this, a)), (o = !0), (t = this), (i = a)), n;
          };
        },
        eO = function (e) {
          var r = [],
            t = null,
            n = function () {
              for (var n = arguments.length, i = Array(n), o = 0; o < n; o++) i[o] = arguments[o];
              (r = i),
                !t &&
                  (t = requestAnimationFrame(function () {
                    (t = null), e.apply(void 0, r);
                  }));
            };
          return (
            (n.cancel = function () {
              t && (cancelAnimationFrame(t), (t = null));
            }),
            n
          );
        };
      var eR = /[ \t]{2,}/g,
        eB = /^[ \t]*/gm,
        eT = function (e) {
          return e.replace(eR, " ").replace(eB, "").trim();
        };
      function eL(e, r) {}
      eL.bind(null, "warn");
      var eG = eL.bind(null, "error");
      function eM() {}
      function e_(e, r, t) {
        var n = r.map(function (r) {
          var n,
            i = ((n = r.options), (0, w.Z)({}, t, {}, n));
          return (
            e.addEventListener(r.eventName, r.fn, i),
            function () {
              e.removeEventListener(r.eventName, r.fn, i);
            }
          );
        });
        return function () {
          n.forEach(function (e) {
            e();
          });
        };
      }
      function eF(e) {
        this.message = e;
      }
      function ek(e, r) {
        if (!e) throw new eF("Invariant failed");
      }
      eF.prototype.toString = function () {
        return this.message;
      };
      var eW = (function (e) {
          function r() {
            for (var r, t = arguments.length, n = Array(t), i = 0; i < t; i++) n[i] = arguments[i];
            return (
              ((r = e.call.apply(e, [this].concat(n)) || this).callbacks = null),
              (r.unbind = eM),
              (r.onWindowError = function (e) {
                var t = r.getCallbacks();
                t.isDragging() && t.tryAbort(), e.error instanceof eF && e.preventDefault();
              }),
              (r.getCallbacks = function () {
                if (!r.callbacks) throw Error("Unable to find AppCallbacks in <ErrorBoundary/>");
                return r.callbacks;
              }),
              (r.setCallbacks = function (e) {
                r.callbacks = e;
              }),
              r
            );
          }
          (0, E.Z)(r, e);
          var t = r.prototype;
          return (
            (t.componentDidMount = function () {
              this.unbind = e_(window, [{ eventName: "error", fn: this.onWindowError }]);
            }),
            (t.componentDidCatch = function (e) {
              if (e instanceof eF) {
                this.setState({});
                return;
              }
              throw e;
            }),
            (t.componentWillUnmount = function () {
              this.unbind();
            }),
            (t.render = function () {
              return this.props.children(this.setCallbacks);
            }),
            r
          );
        })(D.Component),
        eU = function (e) {
          return e + 1;
        },
        ej = function (e, r) {
          var t = e.droppableId === r.droppableId,
            n = eU(e.index),
            i = eU(r.index);
          return t
            ? "\n      You have moved the item from position " + n + "\n      to position " + i + "\n    "
            : "\n    You have moved the item from position " +
                n +
                "\n    in list " +
                e.droppableId +
                "\n    to list " +
                r.droppableId +
                "\n    in position " +
                i +
                "\n  ";
        },
        eH = function (e, r, t) {
          return r.droppableId === t.droppableId
            ? "\n      The item " + e + "\n      has been combined with " + t.draggableId
            : "\n      The item " +
                e +
                "\n      in list " +
                r.droppableId +
                "\n      has been combined with " +
                t.draggableId +
                "\n      in list " +
                t.droppableId +
                "\n    ";
        },
        eZ = function (e) {
          return "\n  The item has returned to its starting position\n  of " + eU(e.index) + "\n";
        },
        eq = {
          dragHandleUsageInstructions:
            "\n  Press space bar to start a drag.\n  When dragging you can use the arrow keys to move the item around and escape to cancel.\n  Some screen readers may require you to be in focus mode or to use your pass through key\n",
          onDragStart: function (e) {
            return "\n  You have lifted an item in position " + eU(e.source.index) + "\n";
          },
          onDragUpdate: function (e) {
            var r = e.destination;
            if (r) return ej(e.source, r);
            var t = e.combine;
            return t ? eH(e.draggableId, e.source, t) : "You are over an area that cannot be dropped on";
          },
          onDragEnd: function (e) {
            if ("CANCEL" === e.reason) return "\n      Movement cancelled.\n      " + eZ(e.source) + "\n    ";
            var r = e.destination,
              t = e.combine;
            return r
              ? "\n      You have dropped the item.\n      " + ej(e.source, r) + "\n    "
              : t
                ? "\n      You have dropped the item.\n      " + eH(e.draggableId, e.source, t) + "\n    "
                : "\n    The item has been dropped while not over a drop area.\n    " + eZ(e.source) + "\n  ";
          }
        },
        eV = { x: 0, y: 0 },
        ez = function (e, r) {
          return { x: e.x + r.x, y: e.y + r.y };
        },
        eY = function (e, r) {
          return { x: e.x - r.x, y: e.y - r.y };
        },
        eJ = function (e, r) {
          return e.x === r.x && e.y === r.y;
        },
        eX = function (e) {
          return { x: 0 !== e.x ? -e.x : 0, y: 0 !== e.y ? -e.y : 0 };
        },
        eK = function (e, r, t) {
          var n;
          return void 0 === t && (t = 0), ((n = {})[e] = r), (n["x" === e ? "y" : "x"] = t), n;
        },
        e$ = function (e, r) {
          return Math.sqrt(Math.pow(r.x - e.x, 2) + Math.pow(r.y - e.y, 2));
        },
        eQ = function (e, r) {
          return Math.min.apply(
            Math,
            r.map(function (r) {
              return e$(e, r);
            })
          );
        },
        e0 = function (e) {
          return function (r) {
            return { x: e(r.x), y: e(r.y) };
          };
        },
        e1 = function (e, r) {
          var t = eb({ top: Math.max(r.top, e.top), right: Math.min(r.right, e.right), bottom: Math.min(r.bottom, e.bottom), left: Math.max(r.left, e.left) });
          return t.width <= 0 || t.height <= 0 ? null : t;
        },
        e2 = function (e, r) {
          return { top: e.top + r.y, left: e.left + r.x, bottom: e.bottom + r.y, right: e.right + r.x };
        },
        e6 = function (e) {
          return [
            { x: e.left, y: e.top },
            { x: e.right, y: e.top },
            { x: e.left, y: e.bottom },
            { x: e.right, y: e.bottom }
          ];
        },
        e3 = function (e, r, t) {
          if (t && t.increasedBy) {
            var n;
            return (0, w.Z)({}, e, (((n = {})[r.end] = e[r.end] + t.increasedBy[r.line]), n));
          }
          return e;
        },
        e5 = function (e) {
          var r,
            t,
            n = e.page,
            i = e.withPlaceholder,
            o = e.axis,
            a = e.frame,
            l = ((t = e3(((r = n.marginBox), a ? e2(r, a.scroll.diff.displacement) : r), o, i)), a && a.shouldClipSubject ? e1(a.pageMarginBox, t) : eb(t));
          return { page: n, withPlaceholder: i, active: l };
        },
        e9 = function (e, r) {
          e.frame || ek(!1);
          var t = e.frame,
            n = eY(r, t.scroll.initial),
            i = eX(n),
            o = (0, w.Z)({}, t, { scroll: { initial: t.scroll.initial, current: r, diff: { value: n, displacement: i }, max: t.scroll.max } }),
            a = e5({ page: e.subject.page, withPlaceholder: e.subject.withPlaceholder, axis: e.axis, frame: o });
          return (0, w.Z)({}, e, { frame: o, subject: a });
        };
      function e8(e) {
        return Object.values
          ? Object.values(e)
          : Object.keys(e).map(function (r) {
              return e[r];
            });
      }
      function e4(e, r) {
        if (e.findIndex) return e.findIndex(r);
        for (var t = 0; t < e.length; t++) if (r(e[t])) return t;
        return -1;
      }
      function e7(e, r) {
        if (e.find) return e.find(r);
        var t = e4(e, r);
        if (-1 !== t) return e[t];
      }
      function re(e) {
        return Array.prototype.slice.call(e);
      }
      var rr = eN(function (e) {
          return e.reduce(function (e, r) {
            return (e[r.descriptor.id] = r), e;
          }, {});
        }),
        rt = eN(function (e) {
          return e.reduce(function (e, r) {
            return (e[r.descriptor.id] = r), e;
          }, {});
        }),
        rn = eN(function (e) {
          return e8(e);
        }),
        ri = eN(function (e) {
          return e8(e);
        }),
        ro = eN(function (e, r) {
          return ri(r)
            .filter(function (r) {
              return e === r.descriptor.droppableId;
            })
            .sort(function (e, r) {
              return e.descriptor.index - r.descriptor.index;
            });
        });
      function ra(e) {
        return e.at && "REORDER" === e.at.type ? e.at.destination : null;
      }
      function rl(e) {
        return e.at && "COMBINE" === e.at.type ? e.at.combine : null;
      }
      var ru = eN(function (e, r) {
          return r.filter(function (r) {
            return r.descriptor.id !== e.descriptor.id;
          });
        }),
        rc = function (e) {
          var r = e.isMovingForward,
            t = e.draggable,
            n = e.destination,
            i = e.insideDestination,
            o = e.previousImpact;
          if (!n.isCombineEnabled || !ra(o)) return null;
          function a(e) {
            var r = { type: "COMBINE", combine: { draggableId: e, droppableId: n.descriptor.id } };
            return (0, w.Z)({}, o, { at: r });
          }
          var l = o.displaced.all,
            u = l.length ? l[0] : null;
          if (r) return u ? a(u) : null;
          var c = ru(t, i);
          if (!u) return c.length ? a(c[c.length - 1].descriptor.id) : null;
          var s = e4(c, function (e) {
            return e.descriptor.id === u;
          });
          -1 === s && ek(!1);
          var d = s - 1;
          return d < 0 ? null : a(c[d].descriptor.id);
        },
        rs = function (e, r) {
          return e.descriptor.droppableId === r.descriptor.id;
        },
        rd = { point: eV, value: 0 },
        rp = { invisible: {}, visible: {}, all: [] },
        rf = { displaced: rp, displacedBy: rd, at: null },
        rg = function (e, r) {
          return function (t) {
            return e <= t && t <= r;
          };
        },
        rm = function (e) {
          var r = rg(e.top, e.bottom),
            t = rg(e.left, e.right);
          return function (n) {
            if (r(n.top) && r(n.bottom) && t(n.left) && t(n.right)) return !0;
            var i = r(n.top) || r(n.bottom),
              o = t(n.left) || t(n.right);
            if (i && o) return !0;
            var a = n.top < e.top && n.bottom > e.bottom,
              l = n.left < e.left && n.right > e.right;
            return (!!a && !!l) || (a && o) || (l && i);
          };
        },
        rv = function (e) {
          var r = rg(e.top, e.bottom),
            t = rg(e.left, e.right);
          return function (e) {
            return r(e.top) && r(e.bottom) && t(e.left) && t(e.right);
          };
        },
        rb = {
          direction: "vertical",
          line: "y",
          crossAxisLine: "x",
          start: "top",
          end: "bottom",
          size: "height",
          crossAxisStart: "left",
          crossAxisEnd: "right",
          crossAxisSize: "width"
        },
        rh = {
          direction: "horizontal",
          line: "x",
          crossAxisLine: "y",
          start: "left",
          end: "right",
          size: "width",
          crossAxisStart: "top",
          crossAxisEnd: "bottom",
          crossAxisSize: "height"
        },
        ry = function (e) {
          var r = e.target,
            t = e.destination,
            n = e.viewport,
            i = e.withDroppableDisplacement,
            o = e.isVisibleThroughFrameFn,
            a = i ? e2(r, t.frame ? t.frame.scroll.diff.displacement : eV) : r;
          return !!t.subject.active && o(t.subject.active)(a) && o(n)(a);
        },
        rx = function (e) {
          return ry((0, w.Z)({}, e, { isVisibleThroughFrameFn: rv }));
        },
        rI = function (e) {
          var r;
          return ry(
            (0, w.Z)({}, e, {
              isVisibleThroughFrameFn:
                ((r = e.destination.axis),
                function (e) {
                  var t = rg(e.top, e.bottom),
                    n = rg(e.left, e.right);
                  return function (e) {
                    return r === rb ? t(e.top) && t(e.bottom) : n(e.left) && n(e.right);
                  };
                })
            })
          );
        },
        rD = function (e, r, t) {
          if ("boolean" == typeof t) return t;
          if (!r) return !0;
          var n = r.invisible,
            i = r.visible;
          if (n[e]) return !1;
          var o = i[e];
          return !o || o.shouldAnimate;
        };
      function rE(e) {
        var r = e.afterDragging,
          t = e.destination,
          n = e.displacedBy,
          i = e.viewport,
          o = e.forceShouldAnimate,
          a = e.last;
        return r.reduce(
          function (e, r) {
            var l,
              u = eb(eh(r.page.marginBox, { top: n.point.y, right: 0, bottom: 0, left: n.point.x })),
              c = r.descriptor.id;
            if (
              (e.all.push(c),
              (l = { target: u, destination: t, viewport: i, withDroppableDisplacement: !0 }),
              !ry((0, w.Z)({}, l, { isVisibleThroughFrameFn: rm })))
            )
              return (e.invisible[r.descriptor.id] = !0), e;
            var s = rD(c, a, o);
            return (e.visible[c] = { draggableId: c, shouldAnimate: s }), e;
          },
          { all: [], visible: {}, invisible: {} }
        );
      }
      function rw(e) {
        var r = e.insideDestination,
          t = e.inHomeList,
          n = e.displacedBy,
          i = e.destination,
          o = (function (e, r) {
            if (!e.length) return 0;
            var t = e[e.length - 1].descriptor.index;
            return r.inHomeList ? t : t + 1;
          })(r, { inHomeList: t });
        return { displaced: rp, displacedBy: n, at: { type: "REORDER", destination: { droppableId: i.descriptor.id, index: o } } };
      }
      function rC(e) {
        var r = e.draggable,
          t = e.insideDestination,
          n = e.destination,
          i = e.viewport,
          o = e.displacedBy,
          a = e.last,
          l = e.index,
          u = e.forceShouldAnimate,
          c = rs(r, n);
        if (null == l) return rw({ insideDestination: t, inHomeList: c, displacedBy: o, destination: n });
        var s = e7(t, function (e) {
          return e.descriptor.index === l;
        });
        if (!s) return rw({ insideDestination: t, inHomeList: c, displacedBy: o, destination: n });
        var d = ru(r, t),
          p = t.indexOf(s);
        return {
          displaced: rE({ afterDragging: d.slice(p), destination: n, displacedBy: o, last: a, viewport: i.frame, forceShouldAnimate: u }),
          displacedBy: o,
          at: { type: "REORDER", destination: { droppableId: n.descriptor.id, index: l } }
        };
      }
      function rP(e, r) {
        return !!r.effected[e];
      }
      var rS = function (e) {
          var r = e.isMovingForward,
            t = e.destination,
            n = e.draggables,
            i = e.combine,
            o = e.afterCritical;
          if (!t.isCombineEnabled) return null;
          var a = i.draggableId,
            l = n[a].descriptor.index;
          return rP(a, o) ? (r ? l : l - 1) : r ? l + 1 : l;
        },
        rA = function (e) {
          var r = e.isMovingForward,
            t = e.isInHomeList,
            n = e.insideDestination,
            i = e.location;
          if (!n.length) return null;
          var o = i.index,
            a = r ? o + 1 : o - 1,
            l = n[0].descriptor.index,
            u = n[n.length - 1].descriptor.index;
          return a < l || a > (t ? u : u + 1) ? null : a;
        },
        rN = function (e) {
          var r = e.isMovingForward,
            t = e.isInHomeList,
            n = e.draggable,
            i = e.draggables,
            o = e.destination,
            a = e.insideDestination,
            l = e.previousImpact,
            u = e.viewport,
            c = e.afterCritical,
            s = l.at;
          if ((s || ek(!1), "REORDER" === s.type)) {
            var d = rA({ isMovingForward: r, isInHomeList: t, location: s.destination, insideDestination: a });
            return null == d
              ? null
              : rC({ draggable: n, insideDestination: a, destination: o, viewport: u, last: l.displaced, displacedBy: l.displacedBy, index: d });
          }
          var p = rS({ isMovingForward: r, destination: o, displaced: l.displaced, draggables: i, combine: s.combine, afterCritical: c });
          return null == p
            ? null
            : rC({ draggable: n, insideDestination: a, destination: o, viewport: u, last: l.displaced, displacedBy: l.displacedBy, index: p });
        },
        rO = function (e) {
          var r = e.displaced,
            t = e.afterCritical,
            n = e.combineWith,
            i = e.displacedBy,
            o = !!(r.visible[n] || r.invisible[n]);
          return rP(n, t) ? (o ? eV : eX(i.point)) : o ? i.point : eV;
        },
        rR = function (e) {
          var r = e.afterCritical,
            t = e.impact,
            n = e.draggables,
            i = rl(t);
          i || ek(!1);
          var o = i.draggableId;
          return ez(n[o].page.borderBox.center, rO({ displaced: t.displaced, afterCritical: r, combineWith: o, displacedBy: t.displacedBy }));
        },
        rB = function (e, r) {
          return r.margin[e.start] + r.borderBox[e.size] / 2;
        },
        rT = function (e, r, t) {
          return r[e.crossAxisStart] + t.margin[e.crossAxisStart] + t.borderBox[e.crossAxisSize] / 2;
        },
        rL = function (e) {
          var r = e.axis,
            t = e.moveRelativeTo,
            n = e.isMoving;
          return eK(r.line, t.marginBox[r.end] + rB(r, n), rT(r, t.marginBox, n));
        },
        rG = function (e) {
          var r = e.axis,
            t = e.moveRelativeTo,
            n = e.isMoving;
          return eK(r.line, t.marginBox[r.start] - (n.margin[r.end] + n.borderBox[r.size] / 2), rT(r, t.marginBox, n));
        },
        rM = function (e) {
          var r = e.axis,
            t = e.moveInto,
            n = e.isMoving;
          return eK(r.line, t.contentBox[r.start] + rB(r, n), rT(r, t.contentBox, n));
        },
        r_ = function (e) {
          var r = e.impact,
            t = e.draggable,
            n = e.draggables,
            i = e.droppable,
            o = e.afterCritical,
            a = ro(i.descriptor.id, n),
            l = t.page,
            u = i.axis;
          if (!a.length) return rM({ axis: u, moveInto: i.page, isMoving: l });
          var c = r.displaced,
            s = r.displacedBy,
            d = c.all[0];
          if (d) {
            var p = n[d];
            return rP(d, o) ? rG({ axis: u, moveRelativeTo: p.page, isMoving: l }) : rG({ axis: u, moveRelativeTo: eE(p.page, s.point), isMoving: l });
          }
          var f = a[a.length - 1];
          return f.descriptor.id === t.descriptor.id
            ? l.borderBox.center
            : rP(f.descriptor.id, o)
              ? rL({ axis: u, moveRelativeTo: eE(f.page, eX(o.displacedBy.point)), isMoving: l })
              : rL({ axis: u, moveRelativeTo: f.page, isMoving: l });
        },
        rF = function (e, r) {
          var t = e.frame;
          return t ? ez(r, t.scroll.diff.displacement) : r;
        },
        rk = function (e) {
          var r = e.impact,
            t = e.draggable,
            n = e.droppable,
            i = e.draggables,
            o = e.afterCritical,
            a = t.page.borderBox.center,
            l = r.at;
          return n && l
            ? "REORDER" === l.type
              ? r_({ impact: r, draggable: t, draggables: i, droppable: n, afterCritical: o })
              : rR({ impact: r, draggables: i, afterCritical: o })
            : a;
        },
        rW = function (e) {
          var r = rk(e),
            t = e.droppable;
          return t ? rF(t, r) : r;
        },
        rU = function (e, r) {
          var t = eY(r, e.scroll.initial),
            n = eX(t);
          return {
            frame: eb({ top: r.y, bottom: r.y + e.frame.height, left: r.x, right: r.x + e.frame.width }),
            scroll: { initial: e.scroll.initial, max: e.scroll.max, current: r, diff: { value: t, displacement: n } }
          };
        };
      function rj(e, r) {
        return e.map(function (e) {
          return r[e];
        });
      }
      var rH = function (e) {
          var r = e.impact,
            t = e.viewport,
            n = e.destination,
            i = e.draggables,
            o = e.maxScrollChange,
            a = rU(t, ez(t.scroll.current, o)),
            l = n.frame ? e9(n, ez(n.frame.scroll.current, o)) : n,
            u = r.displaced,
            c = rE({ afterDragging: rj(u.all, i), destination: n, displacedBy: r.displacedBy, viewport: a.frame, last: u, forceShouldAnimate: !1 }),
            s = rE({ afterDragging: rj(u.all, i), destination: l, displacedBy: r.displacedBy, viewport: t.frame, last: u, forceShouldAnimate: !1 }),
            d = {},
            p = {},
            f = [u, c, s];
          return (
            u.all.forEach(function (e) {
              var r = (function (e, r) {
                for (var t = 0; t < r.length; t++) {
                  var n = r[t].visible[e];
                  if (n) return n;
                }
                return null;
              })(e, f);
              if (r) {
                p[e] = r;
                return;
              }
              d[e] = !0;
            }),
            (0, w.Z)({}, r, { displaced: { all: u.all, invisible: d, visible: p } })
          );
        },
        rZ = function (e) {
          var r = e.pageBorderBoxCenter,
            t = e.draggable,
            n = eY(ez(e.viewport.scroll.diff.displacement, r), t.page.borderBox.center);
          return ez(t.client.borderBox.center, n);
        },
        rq = function (e) {
          var r = e.draggable,
            t = e.destination,
            n = e.newPageBorderBoxCenter,
            i = e.viewport,
            o = e.withDroppableDisplacement,
            a = e.onlyOnMainAxis,
            l = eY(n, r.page.borderBox.center),
            u = { target: e2(r.page.borderBox, l), destination: t, withDroppableDisplacement: o, viewport: i };
          return void 0 !== a && a ? rI(u) : rx(u);
        },
        rV = function (e) {
          var r = e.isMovingForward,
            t = e.draggable,
            n = e.destination,
            i = e.draggables,
            o = e.previousImpact,
            a = e.viewport,
            l = e.previousPageBorderBoxCenter,
            u = e.previousClientSelection,
            c = e.afterCritical;
          if (!n.isEnabled) return null;
          var s = ro(n.descriptor.id, i),
            d = rs(t, n),
            p =
              rc({ isMovingForward: r, draggable: t, destination: n, insideDestination: s, previousImpact: o }) ||
              rN({
                isMovingForward: r,
                isInHomeList: d,
                draggable: t,
                draggables: i,
                destination: n,
                insideDestination: s,
                previousImpact: o,
                viewport: a,
                afterCritical: c
              });
          if (!p) return null;
          var f = rW({ impact: p, draggable: t, droppable: n, draggables: i, afterCritical: c });
          if (rq({ draggable: t, destination: n, newPageBorderBoxCenter: f, viewport: a.frame, withDroppableDisplacement: !1, onlyOnMainAxis: !0 }))
            return { clientSelection: rZ({ pageBorderBoxCenter: f, draggable: t, viewport: a }), impact: p, scrollJumpRequest: null };
          var g = eY(f, l);
          return { clientSelection: u, impact: rH({ impact: p, viewport: a, destination: n, draggables: i, maxScrollChange: g }), scrollJumpRequest: g };
        },
        rz = function (e) {
          var r = e.subject.active;
          return r || ek(!1), r;
        },
        rY = function (e) {
          var r = e.isMovingForward,
            t = e.pageBorderBoxCenter,
            n = e.source,
            i = e.droppables,
            o = e.viewport,
            a = n.subject.active;
          if (!a) return null;
          var l = n.axis,
            u = rg(a[l.start], a[l.end]),
            c = rn(i)
              .filter(function (e) {
                return e !== n;
              })
              .filter(function (e) {
                return e.isEnabled;
              })
              .filter(function (e) {
                return !!e.subject.active;
              })
              .filter(function (e) {
                return rm(o.frame)(rz(e));
              })
              .filter(function (e) {
                var t = rz(e);
                return r ? a[l.crossAxisEnd] < t[l.crossAxisEnd] : t[l.crossAxisStart] < a[l.crossAxisStart];
              })
              .filter(function (e) {
                var r = rz(e),
                  t = rg(r[l.start], r[l.end]);
                return u(r[l.start]) || u(r[l.end]) || t(a[l.start]) || t(a[l.end]);
              })
              .sort(function (e, t) {
                var n = rz(e)[l.crossAxisStart],
                  i = rz(t)[l.crossAxisStart];
                return r ? n - i : i - n;
              })
              .filter(function (e, r, t) {
                return rz(e)[l.crossAxisStart] === rz(t[0])[l.crossAxisStart];
              });
          if (!c.length) return null;
          if (1 === c.length) return c[0];
          var s = c.filter(function (e) {
            return rg(rz(e)[l.start], rz(e)[l.end])(t[l.line]);
          });
          return 1 === s.length
            ? s[0]
            : s.length > 1
              ? s.sort(function (e, r) {
                  return rz(e)[l.start] - rz(r)[l.start];
                })[0]
              : c.sort(function (e, r) {
                  var n = eQ(t, e6(rz(e))),
                    i = eQ(t, e6(rz(r)));
                  return n !== i ? n - i : rz(e)[l.start] - rz(r)[l.start];
                })[0];
        },
        rJ = function (e, r) {
          var t = e.page.borderBox.center;
          return rP(e.descriptor.id, r) ? eY(t, r.displacedBy.point) : t;
        },
        rX = function (e, r) {
          var t = e.page.borderBox;
          return rP(e.descriptor.id, r) ? e2(t, eX(r.displacedBy.point)) : t;
        },
        rK = function (e) {
          var r = e.pageBorderBoxCenter,
            t = e.viewport,
            n = e.destination,
            i = e.insideDestination,
            o = e.afterCritical;
          return (
            i
              .filter(function (e) {
                return rx({ target: rX(e, o), destination: n, viewport: t.frame, withDroppableDisplacement: !0 });
              })
              .sort(function (e, t) {
                var i = e$(r, rF(n, rJ(e, o))),
                  a = e$(r, rF(n, rJ(t, o)));
                return i < a ? -1 : a < i ? 1 : e.descriptor.index - t.descriptor.index;
              })[0] || null
          );
        },
        r$ = eN(function (e, r) {
          var t = r[e.line];
          return { value: t, point: eK(e.line, t) };
        }),
        rQ = function (e, r, t) {
          var n = e.axis;
          if ("virtual" === e.descriptor.mode) return eK(n.line, r[n.line]);
          var i = e.subject.page.contentBox[n.size],
            o =
              ro(e.descriptor.id, t).reduce(function (e, r) {
                return e + r.client.marginBox[n.size];
              }, 0) +
              r[n.line] -
              i;
          return o <= 0 ? null : eK(n.line, o);
        },
        r0 = function (e, r) {
          return (0, w.Z)({}, e, { scroll: (0, w.Z)({}, e.scroll, { max: r }) });
        },
        r1 = function (e, r, t) {
          var n = e.frame;
          rs(r, e) && ek(!1), e.subject.withPlaceholder && ek(!1);
          var i = r$(e.axis, r.displaceBy).point,
            o = rQ(e, i, t),
            a = { placeholderSize: i, increasedBy: o, oldFrameMaxScroll: e.frame ? e.frame.scroll.max : null };
          if (!n) {
            var l = e5({ page: e.subject.page, withPlaceholder: a, axis: e.axis, frame: e.frame });
            return (0, w.Z)({}, e, { subject: l });
          }
          var u = o ? ez(n.scroll.max, o) : n.scroll.max,
            c = r0(n, u),
            s = e5({ page: e.subject.page, withPlaceholder: a, axis: e.axis, frame: c });
          return (0, w.Z)({}, e, { subject: s, frame: c });
        },
        r2 = function (e) {
          var r = e.subject.withPlaceholder;
          r || ek(!1);
          var t = e.frame;
          if (!t) {
            var n = e5({ page: e.subject.page, axis: e.axis, frame: null, withPlaceholder: null });
            return (0, w.Z)({}, e, { subject: n });
          }
          var i = r.oldFrameMaxScroll;
          i || ek(!1);
          var o = r0(t, i),
            a = e5({ page: e.subject.page, axis: e.axis, frame: o, withPlaceholder: null });
          return (0, w.Z)({}, e, { subject: a, frame: o });
        },
        r6 = function (e) {
          var r,
            t = e.previousPageBorderBoxCenter,
            n = e.moveRelativeTo,
            i = e.insideDestination,
            o = e.draggable,
            a = e.draggables,
            l = e.destination,
            u = e.viewport,
            c = e.afterCritical;
          if (!n) {
            if (i.length) return null;
            var s = { displaced: rp, displacedBy: rd, at: { type: "REORDER", destination: { droppableId: l.descriptor.id, index: 0 } } },
              d = rW({ impact: s, draggable: o, droppable: l, draggables: a, afterCritical: c }),
              p = rs(o, l) ? l : r1(l, o, a);
            return rq({ draggable: o, destination: p, newPageBorderBoxCenter: d, viewport: u.frame, withDroppableDisplacement: !1, onlyOnMainAxis: !0 })
              ? s
              : null;
          }
          var f = t[l.axis.line] <= n.page.borderBox.center[l.axis.line],
            g = ((r = n.descriptor.index), n.descriptor.id === o.descriptor.id || f ? r : r + 1),
            m = r$(l.axis, o.displaceBy);
          return rC({ draggable: o, insideDestination: i, destination: l, viewport: u, displacedBy: m, last: rp, index: g });
        },
        r3 = function (e) {
          var r = e.isMovingForward,
            t = e.previousPageBorderBoxCenter,
            n = e.draggable,
            i = e.isOver,
            o = e.draggables,
            a = e.droppables,
            l = e.viewport,
            u = e.afterCritical,
            c = rY({ isMovingForward: r, pageBorderBoxCenter: t, source: i, droppables: a, viewport: l });
          if (!c) return null;
          var s = ro(c.descriptor.id, o),
            d = rK({ pageBorderBoxCenter: t, viewport: l, destination: c, insideDestination: s, afterCritical: u }),
            p = r6({
              previousPageBorderBoxCenter: t,
              destination: c,
              draggable: n,
              draggables: o,
              moveRelativeTo: d,
              insideDestination: s,
              viewport: l,
              afterCritical: u
            });
          return p
            ? {
                clientSelection: rZ({
                  pageBorderBoxCenter: rW({ impact: p, draggable: n, droppable: c, draggables: o, afterCritical: u }),
                  draggable: n,
                  viewport: l
                }),
                impact: p,
                scrollJumpRequest: null
              }
            : null;
        },
        r5 = function (e) {
          var r = e.at;
          return r ? ("REORDER" === r.type ? r.destination.droppableId : r.combine.droppableId) : null;
        },
        r9 = function (e, r) {
          var t = r5(e);
          return t ? r[t] : null;
        },
        r8 = function (e) {
          var r = e.state,
            t = e.type,
            n = r9(r.impact, r.dimensions.droppables),
            i = !!n,
            o = r.dimensions.droppables[r.critical.droppable.id],
            a = n || o,
            l = a.axis.direction,
            u = ("vertical" === l && ("MOVE_UP" === t || "MOVE_DOWN" === t)) || ("horizontal" === l && ("MOVE_LEFT" === t || "MOVE_RIGHT" === t));
          if (u && !i) return null;
          var c = "MOVE_DOWN" === t || "MOVE_RIGHT" === t,
            s = r.dimensions.draggables[r.critical.draggable.id],
            d = r.current.page.borderBoxCenter,
            p = r.dimensions,
            f = p.draggables,
            g = p.droppables;
          return u
            ? rV({
                isMovingForward: c,
                previousPageBorderBoxCenter: d,
                draggable: s,
                destination: a,
                draggables: f,
                viewport: r.viewport,
                previousClientSelection: r.current.client.selection,
                previousImpact: r.impact,
                afterCritical: r.afterCritical
              })
            : r3({
                isMovingForward: c,
                previousPageBorderBoxCenter: d,
                draggable: s,
                isOver: a,
                draggables: f,
                droppables: g,
                viewport: r.viewport,
                afterCritical: r.afterCritical
              });
        };
      function r4(e) {
        return "DRAGGING" === e.phase || "COLLECTING" === e.phase;
      }
      function r7(e) {
        var r = rg(e.top, e.bottom),
          t = rg(e.left, e.right);
        return function (e) {
          return r(e.y) && t(e.x);
        };
      }
      var te = function (e, r) {
          return eb(e2(e, r));
        },
        tr = function (e, r) {
          var t = e.frame;
          return t ? te(r, t.scroll.diff.value) : r;
        };
      function tt(e) {
        var r = e.displaced,
          t = e.id;
        return !!(r.visible[t] || r.invisible[t]);
      }
      var tn = function (e) {
          var r,
            t,
            n,
            i,
            o = e.pageBorderBoxWithDroppableScroll,
            a = e.draggable,
            l = e.destination,
            u = e.insideDestination,
            c = e.last,
            s = e.viewport,
            d = e.afterCritical,
            p = l.axis,
            f = r$(l.axis, a.displaceBy),
            g = f.value,
            m = o[p.start],
            v = o[p.end],
            b = e7(ru(a, u), function (e) {
              var r = e.descriptor.id,
                t = e.page.borderBox.center[p.line],
                n = rP(r, d),
                i = tt({ displaced: c, id: r });
              return n ? (i ? v <= t : m < t - g) : i ? v <= t + g : m < t;
            }),
            h =
              ((t = (r = { draggable: a, closest: b, inHomeList: rs(a, l) }).draggable),
              (n = r.closest),
              (i = r.inHomeList),
              n ? (i && n.descriptor.index > t.descriptor.index ? n.descriptor.index - 1 : n.descriptor.index) : null);
          return rC({ draggable: a, insideDestination: u, destination: l, viewport: s, last: c, displacedBy: f, index: h });
        },
        ti = function (e) {
          var r = e.draggable,
            t = e.pageBorderBoxWithDroppableScroll,
            n = e.previousImpact,
            i = e.destination,
            o = e.insideDestination,
            a = e.afterCritical;
          if (!i.isCombineEnabled) return null;
          var l = i.axis,
            u = r$(i.axis, r.displaceBy),
            c = u.value,
            s = t[l.start],
            d = t[l.end],
            p = e7(ru(r, o), function (e) {
              var r = e.descriptor.id,
                t = e.page.borderBox,
                i = t[l.size] / 4,
                o = rP(r, a),
                u = tt({ displaced: n.displaced, id: r });
              return o
                ? u
                  ? d > t[l.start] + i && d < t[l.end] - i
                  : s > t[l.start] - c + i && s < t[l.end] - c - i
                : u
                  ? d > t[l.start] + c + i && d < t[l.end] + c - i
                  : s > t[l.start] + i && s < t[l.end] - i;
            });
          return p
            ? { displacedBy: u, displaced: n.displaced, at: { type: "COMBINE", combine: { draggableId: p.descriptor.id, droppableId: i.descriptor.id } } }
            : null;
        },
        to = function (e) {
          var r,
            t,
            n,
            i,
            o,
            a,
            l,
            u,
            c,
            s,
            d = e.pageOffset,
            p = e.draggable,
            f = e.draggables,
            g = e.droppables,
            m = e.previousImpact,
            v = e.viewport,
            b = e.afterCritical,
            h = te(p.page.borderBox, d),
            y =
              ((u = (r = { pageBorderBox: h, draggable: p, droppables: g }).pageBorderBox),
              (c = r.draggable),
              (s = rn(r.droppables).filter(function (e) {
                if (!e.isEnabled) return !1;
                var r = e.subject.active;
                if (!r || !(u.left < r.right) || !(u.right > r.left) || !(u.top < r.bottom) || !(u.bottom > r.top)) return !1;
                if (r7(r)(u.center)) return !0;
                var t = e.axis,
                  n = r.center[t.crossAxisLine],
                  i = u[t.crossAxisStart],
                  o = u[t.crossAxisEnd],
                  a = rg(r[t.crossAxisStart], r[t.crossAxisEnd]),
                  l = a(i),
                  c = a(o);
                return (!l && !c) || (l ? i < n : o > n);
              })).length
                ? 1 === s.length
                  ? s[0].descriptor.id
                  : ((n = (t = { pageBorderBox: u, draggable: c, candidates: s }).pageBorderBox),
                    (i = t.draggable),
                    (o = t.candidates),
                    (a = i.page.borderBox.center),
                    (l = o
                      .map(function (e) {
                        var r = e.axis,
                          t = eK(e.axis.line, n.center[r.line], e.page.borderBox.center[r.crossAxisLine]);
                        return { id: e.descriptor.id, distance: e$(a, t) };
                      })
                      .sort(function (e, r) {
                        return r.distance - e.distance;
                      }))[0]
                      ? l[0].id
                      : null)
                : null);
          if (!y) return rf;
          var x = g[y],
            I = ro(x.descriptor.id, f),
            D = tr(x, h);
          return (
            ti({ pageBorderBoxWithDroppableScroll: D, draggable: p, previousImpact: m, destination: x, insideDestination: I, afterCritical: b }) ||
            tn({ pageBorderBoxWithDroppableScroll: D, draggable: p, destination: x, insideDestination: I, last: m.displaced, viewport: v, afterCritical: b })
          );
        },
        ta = function (e, r) {
          var t;
          return (0, w.Z)({}, e, (((t = {})[r.descriptor.id] = r), t));
        },
        tl = function (e) {
          var r = e.previousImpact,
            t = e.impact,
            n = e.droppables,
            i = r5(r),
            o = r5(t);
          if (!i || i === o) return n;
          var a = n[i];
          return a.subject.withPlaceholder ? ta(n, r2(a)) : n;
        },
        tu = function (e) {
          var r = e.draggable,
            t = e.draggables,
            n = e.droppables,
            i = e.previousImpact,
            o = e.impact,
            a = tl({ previousImpact: i, impact: o, droppables: n }),
            l = r5(o);
          if (!l) return a;
          var u = n[l];
          return rs(r, u) || u.subject.withPlaceholder ? a : ta(a, r1(u, r, t));
        },
        tc = function (e) {
          var r = e.state,
            t = e.clientSelection,
            n = e.dimensions,
            i = e.viewport,
            o = e.impact,
            a = e.scrollJumpRequest,
            l = i || r.viewport,
            u = n || r.dimensions,
            c = t || r.current.client.selection,
            s = eY(c, r.initial.client.selection),
            d = { offset: s, selection: c, borderBoxCenter: ez(r.initial.client.borderBoxCenter, s) },
            p = {
              selection: ez(d.selection, l.scroll.current),
              borderBoxCenter: ez(d.borderBoxCenter, l.scroll.current),
              offset: ez(d.offset, l.scroll.diff.value)
            },
            f = { client: d, page: p };
          if ("COLLECTING" === r.phase) return (0, w.Z)({ phase: "COLLECTING" }, r, { dimensions: u, viewport: l, current: f });
          var g = u.draggables[r.critical.draggable.id],
            m =
              o ||
              to({
                pageOffset: p.offset,
                draggable: g,
                draggables: u.draggables,
                droppables: u.droppables,
                previousImpact: r.impact,
                viewport: l,
                afterCritical: r.afterCritical
              }),
            v = tu({ draggable: g, impact: m, previousImpact: r.impact, draggables: u.draggables, droppables: u.droppables });
          return (0, w.Z)({}, r, {
            current: f,
            dimensions: { draggables: u.draggables, droppables: v },
            impact: m,
            viewport: l,
            scrollJumpRequest: a || null,
            forceShouldAnimate: !a && null
          });
        },
        ts = function (e) {
          var r = e.impact,
            t = e.viewport,
            n = e.draggables,
            i = e.destination,
            o = e.forceShouldAnimate,
            a = r.displaced,
            l = rE({
              afterDragging: a.all.map(function (e) {
                return n[e];
              }),
              destination: i,
              displacedBy: r.displacedBy,
              viewport: t.frame,
              forceShouldAnimate: o,
              last: a
            });
          return (0, w.Z)({}, r, { displaced: l });
        },
        td = function (e) {
          var r = e.impact,
            t = e.draggable,
            n = e.droppable,
            i = e.draggables,
            o = e.viewport;
          return rZ({
            pageBorderBoxCenter: rW({ impact: r, draggable: t, draggables: i, droppable: n, afterCritical: e.afterCritical }),
            draggable: t,
            viewport: o
          });
        },
        tp = function (e) {
          var r = e.state,
            t = e.dimensions,
            n = e.viewport;
          "SNAP" !== r.movementMode && ek(!1);
          var i = r.impact,
            o = n || r.viewport,
            a = t || r.dimensions,
            l = a.draggables,
            u = a.droppables,
            c = l[r.critical.draggable.id],
            s = r5(i);
          s || ek(!1);
          var d = u[s],
            p = ts({ impact: i, viewport: o, destination: d, draggables: l }),
            f = td({ impact: p, draggable: c, droppable: d, draggables: l, viewport: o, afterCritical: r.afterCritical });
          return tc({ impact: p, clientSelection: f, state: r, dimensions: a, viewport: o });
        },
        tf = function (e) {
          var r,
            t = e.draggable,
            n = e.home,
            i = e.draggables,
            o = e.viewport,
            a = r$(n.axis, t.displaceBy),
            l = ro(n.descriptor.id, i),
            u = l.indexOf(t);
          -1 === u && ek(!1);
          var c = l.slice(u + 1),
            s = c.reduce(function (e, r) {
              return (e[r.descriptor.id] = !0), e;
            }, {}),
            d = { inVirtualList: "virtual" === n.descriptor.mode, displacedBy: a, effected: s };
          return {
            impact: {
              displaced: rE({ afterDragging: c, destination: n, displacedBy: a, last: null, viewport: o.frame, forceShouldAnimate: !1 }),
              displacedBy: a,
              at: { type: "REORDER", destination: { index: (r = t.descriptor).index, droppableId: r.droppableId } }
            },
            afterCritical: d
          };
        },
        tg = function (e) {},
        tm = function (e) {},
        tv = function (e) {
          var r = e.draggable,
            t = e.offset,
            n = e.initialWindowScroll,
            i = eE(r.client, t),
            o = ew(i, n);
          return (0, w.Z)({}, r, { placeholder: (0, w.Z)({}, r.placeholder, { client: i }), client: i, page: o });
        },
        tb = function (e) {
          var r = e.frame;
          return r || ek(!1), r;
        },
        th = function (e) {
          var r = e.additions,
            t = e.updatedDroppables,
            n = e.viewport,
            i = n.scroll.diff.value;
          return r.map(function (e) {
            var r = ez(i, tb(t[e.descriptor.droppableId]).scroll.diff.value);
            return tv({ draggable: e, offset: r, initialWindowScroll: n.scroll.initial });
          });
        },
        ty = function (e) {
          var r = e.state,
            t = e.published;
          tg();
          var n = t.modified.map(function (e) {
              return e9(r.dimensions.droppables[e.droppableId], e.scroll);
            }),
            i = (0, w.Z)({}, r.dimensions.droppables, {}, rr(n)),
            o = rt(th({ additions: t.additions, updatedDroppables: i, viewport: r.viewport })),
            a = (0, w.Z)({}, r.dimensions.draggables, {}, o);
          t.removals.forEach(function (e) {
            delete a[e];
          });
          var l = { droppables: i, draggables: a },
            u = r5(r.impact),
            c = u ? l.droppables[u] : null,
            s = tf({ draggable: l.draggables[r.critical.draggable.id], home: l.droppables[r.critical.droppable.id], draggables: a, viewport: r.viewport }),
            d = s.impact,
            p = s.afterCritical,
            f = c && c.isCombineEnabled ? r.impact : d,
            g = to({
              pageOffset: r.current.page.offset,
              draggable: l.draggables[r.critical.draggable.id],
              draggables: l.draggables,
              droppables: l.droppables,
              previousImpact: f,
              viewport: r.viewport,
              afterCritical: p
            });
          tm();
          var m = (0, w.Z)({ phase: "DRAGGING" }, r, {
            phase: "DRAGGING",
            impact: g,
            onLiftImpact: d,
            dimensions: l,
            afterCritical: p,
            forceShouldAnimate: !1
          });
          return "COLLECTING" === r.phase ? m : (0, w.Z)({ phase: "DROP_PENDING" }, m, { phase: "DROP_PENDING", reason: r.reason, isWaiting: !1 });
        },
        tx = function (e) {
          return "SNAP" === e.movementMode;
        },
        tI = function (e, r, t) {
          var n,
            i = { draggables: (n = e.dimensions).draggables, droppables: ta(n.droppables, r) };
          return !tx(e) || t ? tc({ state: e, dimensions: i }) : tp({ state: e, dimensions: i });
        };
      function tD(e) {
        return e.isDragging && "SNAP" === e.movementMode ? (0, w.Z)({ phase: "DRAGGING" }, e, { scrollJumpRequest: null }) : e;
      }
      var tE = { phase: "IDLE", completed: null, shouldFlush: !1 },
        tw = function (e, r) {
          if ((void 0 === e && (e = tE), "FLUSH" === r.type)) return (0, w.Z)({}, tE, { shouldFlush: !0 });
          if ("INITIAL_PUBLISH" === r.type) {
            "IDLE" !== e.phase && ek(!1);
            var t = r.payload,
              n = t.critical,
              i = t.clientSelection,
              o = t.viewport,
              a = t.dimensions,
              l = t.movementMode,
              u = a.draggables[n.draggable.id],
              c = a.droppables[n.droppable.id],
              s = { selection: i, borderBoxCenter: u.client.borderBox.center, offset: eV },
              d = {
                client: s,
                page: {
                  selection: ez(s.selection, o.scroll.initial),
                  borderBoxCenter: ez(s.selection, o.scroll.initial),
                  offset: ez(s.selection, o.scroll.diff.value)
                }
              },
              p = rn(a.droppables).every(function (e) {
                return !e.isFixedOnPage;
              }),
              f = tf({ draggable: u, home: c, draggables: a.draggables, viewport: o }),
              g = f.impact;
            return {
              phase: "DRAGGING",
              isDragging: !0,
              critical: n,
              movementMode: l,
              dimensions: a,
              initial: d,
              current: d,
              isWindowScrollAllowed: p,
              impact: g,
              afterCritical: f.afterCritical,
              onLiftImpact: g,
              viewport: o,
              scrollJumpRequest: null,
              forceShouldAnimate: null
            };
          }
          if ("COLLECTION_STARTING" === r.type)
            return "COLLECTING" === e.phase || "DROP_PENDING" === e.phase
              ? e
              : ("DRAGGING" !== e.phase && ek(!1), (0, w.Z)({ phase: "COLLECTING" }, e, { phase: "COLLECTING" }));
          if ("PUBLISH_WHILE_DRAGGING" === r.type)
            return "COLLECTING" !== e.phase && "DROP_PENDING" !== e.phase && ek(!1), ty({ state: e, published: r.payload });
          if ("MOVE" === r.type) {
            if ("DROP_PENDING" === e.phase) return e;
            r4(e) || ek(!1);
            var m = r.payload.client;
            return eJ(m, e.current.client.selection) ? e : tc({ state: e, clientSelection: m, impact: tx(e) ? e.impact : null });
          }
          if ("UPDATE_DROPPABLE_SCROLL" === r.type) {
            if ("DROP_PENDING" === e.phase || "COLLECTING" === e.phase) return tD(e);
            r4(e) || ek(!1);
            var v = r.payload,
              b = v.id,
              h = v.newScroll,
              y = e.dimensions.droppables[b];
            return y ? tI(e, e9(y, h), !1) : e;
          }
          if ("UPDATE_DROPPABLE_IS_ENABLED" === r.type) {
            if ("DROP_PENDING" === e.phase) return e;
            r4(e) || ek(!1);
            var x = r.payload,
              I = x.id,
              D = x.isEnabled,
              E = e.dimensions.droppables[I];
            return E || ek(!1), E.isEnabled === D && ek(!1), tI(e, (0, w.Z)({}, E, { isEnabled: D }), !0);
          }
          if ("UPDATE_DROPPABLE_IS_COMBINE_ENABLED" === r.type) {
            if ("DROP_PENDING" === e.phase) return e;
            r4(e) || ek(!1);
            var C = r.payload,
              P = C.id,
              S = C.isCombineEnabled,
              A = e.dimensions.droppables[P];
            return A || ek(!1), A.isCombineEnabled === S && ek(!1), tI(e, (0, w.Z)({}, A, { isCombineEnabled: S }), !0);
          }
          if ("MOVE_BY_WINDOW_SCROLL" === r.type) {
            if ("DROP_PENDING" === e.phase || "DROP_ANIMATING" === e.phase) return e;
            r4(e) || ek(!1), e.isWindowScrollAllowed || ek(!1);
            var N = r.payload.newScroll;
            if (eJ(e.viewport.scroll.current, N)) return tD(e);
            var O = rU(e.viewport, N);
            return tx(e) ? tp({ state: e, viewport: O }) : tc({ state: e, viewport: O });
          }
          if ("UPDATE_VIEWPORT_MAX_SCROLL" === r.type) {
            if (!r4(e)) return e;
            var R = r.payload.maxScroll;
            if (eJ(R, e.viewport.scroll.max)) return e;
            var B = (0, w.Z)({}, e.viewport, { scroll: (0, w.Z)({}, e.viewport.scroll, { max: R }) });
            return (0, w.Z)({ phase: "DRAGGING" }, e, { viewport: B });
          }
          if ("MOVE_UP" === r.type || "MOVE_DOWN" === r.type || "MOVE_LEFT" === r.type || "MOVE_RIGHT" === r.type) {
            if ("COLLECTING" === e.phase || "DROP_PENDING" === e.phase) return e;
            "DRAGGING" !== e.phase && ek(!1);
            var T = r8({ state: e, type: r.type });
            return T ? tc({ state: e, impact: T.impact, clientSelection: T.clientSelection, scrollJumpRequest: T.scrollJumpRequest }) : e;
          }
          if ("DROP_PENDING" === r.type) {
            var L = r.payload.reason;
            return "COLLECTING" !== e.phase && ek(!1), (0, w.Z)({ phase: "DROP_PENDING" }, e, { phase: "DROP_PENDING", isWaiting: !0, reason: L });
          }
          if ("DROP_ANIMATE" === r.type) {
            var G = r.payload,
              M = G.completed,
              _ = G.dropDuration,
              F = G.newHomeClientOffset;
            return (
              "DRAGGING" !== e.phase && "DROP_PENDING" !== e.phase && ek(!1),
              { phase: "DROP_ANIMATING", completed: M, dropDuration: _, newHomeClientOffset: F, dimensions: e.dimensions }
            );
          }
          return "DROP_COMPLETE" === r.type ? { phase: "IDLE", completed: r.payload.completed, shouldFlush: !1 } : e;
        },
        tC = function (e) {
          return { type: "PUBLISH_WHILE_DRAGGING", payload: e };
        },
        tP = function () {
          return { type: "COLLECTION_STARTING", payload: null };
        },
        tS = function (e) {
          return { type: "UPDATE_DROPPABLE_SCROLL", payload: e };
        },
        tA = function (e) {
          return { type: "UPDATE_DROPPABLE_IS_ENABLED", payload: e };
        },
        tN = function (e) {
          return { type: "UPDATE_DROPPABLE_IS_COMBINE_ENABLED", payload: e };
        },
        tO = function (e) {
          return { type: "MOVE", payload: e };
        },
        tR = function () {
          return { type: "MOVE_UP", payload: null };
        },
        tB = function () {
          return { type: "MOVE_DOWN", payload: null };
        },
        tT = function () {
          return { type: "MOVE_RIGHT", payload: null };
        },
        tL = function () {
          return { type: "MOVE_LEFT", payload: null };
        },
        tG = function () {
          return { type: "FLUSH", payload: null };
        },
        tM = function (e) {
          return { type: "DROP_COMPLETE", payload: e };
        },
        t_ = function (e) {
          return { type: "DROP", payload: e };
        },
        tF = function () {
          return { type: "DROP_ANIMATION_FINISHED", payload: null };
        },
        tk = { outOfTheWay: "cubic-bezier(0.2, 0, 0, 1)", drop: "cubic-bezier(.2,1,.1,1)" },
        tW = { opacity: { drop: 0, combining: 0.7 }, scale: { drop: 0.75 } },
        tU = "0.2s " + tk.outOfTheWay,
        tj = {
          fluid: "opacity " + tU,
          snap: "transform " + tU + ", opacity " + tU,
          drop: function (e) {
            var r = e + "s " + tk.drop;
            return "transform " + r + ", opacity " + r;
          },
          outOfTheWay: "transform " + tU,
          placeholder: "height " + tU + ", width " + tU + ", margin " + tU
        },
        tH = function (e) {
          return eJ(e, eV) ? null : "translate(" + e.x + "px, " + e.y + "px)";
        },
        tZ = {
          moveTo: tH,
          drop: function (e, r) {
            var t = tH(e);
            return t ? (r ? t + " scale(" + tW.scale.drop + ")" : t) : null;
          }
        },
        tq = 0.22000000000000003,
        tV = function (e) {
          var r = e.current,
            t = e.destination,
            n = e.reason,
            i = e$(r, t);
          if (i <= 0) return 0.33;
          if (i >= 1500) return 0.55;
          var o = 0.33 + (i / 1500) * tq;
          return Number(("CANCEL" === n ? 0.6 * o : o).toFixed(2));
        },
        tz = function (e) {
          var r = e.impact,
            t = e.draggable,
            n = e.dimensions,
            i = e.viewport,
            o = e.afterCritical,
            a = n.draggables,
            l = n.droppables,
            u = r5(r),
            c = u ? l[u] : null,
            s = l[t.descriptor.droppableId];
          return eY(td({ impact: r, draggable: t, draggables: a, afterCritical: o, droppable: c || s, viewport: i }), t.client.borderBox.center);
        },
        tY = function (e) {
          var r = e.draggables,
            t = e.reason,
            n = e.lastImpact,
            i = e.home,
            o = e.viewport,
            a = e.onLiftImpact;
          return n.at && "DROP" === t
            ? "REORDER" === n.at.type
              ? { impact: n, didDropInsideDroppable: !0 }
              : { impact: (0, w.Z)({}, n, { displaced: rp }), didDropInsideDroppable: !0 }
            : { impact: ts({ draggables: r, impact: a, destination: i, viewport: o, forceShouldAnimate: !0 }), didDropInsideDroppable: !1 };
        },
        tJ = function (e) {
          var r = e.getState,
            t = e.dispatch;
          return function (e) {
            return function (n) {
              if ("DROP" !== n.type) {
                e(n);
                return;
              }
              var i = r(),
                o = n.payload.reason;
              if ("COLLECTING" === i.phase) {
                t({ type: "DROP_PENDING", payload: { reason: o } });
                return;
              }
              if ("IDLE" !== i.phase) {
                "DROP_PENDING" === i.phase && i.isWaiting && ek(!1), "DRAGGING" !== i.phase && "DROP_PENDING" !== i.phase && ek(!1);
                var a = i.critical,
                  l = i.dimensions,
                  u = l.draggables[i.critical.draggable.id],
                  c = tY({
                    reason: o,
                    lastImpact: i.impact,
                    afterCritical: i.afterCritical,
                    onLiftImpact: i.onLiftImpact,
                    home: i.dimensions.droppables[i.critical.droppable.id],
                    viewport: i.viewport,
                    draggables: i.dimensions.draggables
                  }),
                  s = c.impact,
                  d = c.didDropInsideDroppable,
                  p = d ? ra(s) : null,
                  f = d ? rl(s) : null,
                  g = { index: a.draggable.index, droppableId: a.droppable.id },
                  m = { draggableId: u.descriptor.id, type: u.descriptor.type, source: g, reason: o, mode: i.movementMode, destination: p, combine: f },
                  v = tz({ impact: s, draggable: u, dimensions: l, viewport: i.viewport, afterCritical: i.afterCritical }),
                  b = { critical: i.critical, afterCritical: i.afterCritical, result: m, impact: s };
                if (!(!eJ(i.current.client.offset, v) || m.combine)) {
                  t(tM({ completed: b }));
                  return;
                }
                var h = tV({ current: i.current.client.offset, destination: v, reason: o });
                t({ type: "DROP_ANIMATE", payload: { newHomeClientOffset: v, dropDuration: h, completed: b } });
              }
            };
          };
        },
        tX = function () {
          return { x: window.pageXOffset, y: window.pageYOffset };
        },
        tK = function (e) {
          var r = (function (e) {
            var r = e.onWindowScroll,
              t = eO(function () {
                r(tX());
              }),
              n = {
                eventName: "scroll",
                options: { passive: !0, capture: !1 },
                fn: function (e) {
                  (e.target === window || e.target === window.document) && t();
                }
              },
              i = eM;
            function o() {
              return i !== eM;
            }
            return {
              start: function () {
                o() && ek(!1), (i = e_(window, [n]));
              },
              stop: function () {
                o() || ek(!1), t.cancel(), i(), (i = eM);
              },
              isActive: o
            };
          })({
            onWindowScroll: function (r) {
              e.dispatch({ type: "MOVE_BY_WINDOW_SCROLL", payload: { newScroll: r } });
            }
          });
          return function (e) {
            return function (t) {
              r.isActive() || "INITIAL_PUBLISH" !== t.type || r.start(),
                r.isActive() && ("DROP_COMPLETE" === t.type || "DROP_ANIMATE" === t.type || "FLUSH" === t.type) && r.stop(),
                e(t);
            };
          };
        },
        t$ = function (e) {
          var r = !1,
            t = !1,
            n = setTimeout(function () {
              t = !0;
            }),
            i = function (i) {
              !r && !t && ((r = !0), e(i), clearTimeout(n));
            };
          return (
            (i.wasCalled = function () {
              return r;
            }),
            i
          );
        },
        tQ = function () {
          var e = [],
            r = function (r) {
              var t = e4(e, function (e) {
                return e.timerId === r;
              });
              -1 === t && ek(!1), e.splice(t, 1)[0].callback();
            };
          return {
            add: function (t) {
              var n = setTimeout(function () {
                return r(n);
              });
              e.push({ timerId: n, callback: t });
            },
            flush: function () {
              if (e.length) {
                var r = [].concat(e);
                (e.length = 0),
                  r.forEach(function (e) {
                    clearTimeout(e.timerId), e.callback();
                  });
              }
            }
          };
        },
        t0 = function (e, r) {
          if (e === r) return !0;
          var t =
              e.draggable.id === r.draggable.id &&
              e.draggable.droppableId === r.draggable.droppableId &&
              e.draggable.type === r.draggable.type &&
              e.draggable.index === r.draggable.index,
            n = e.droppable.id === r.droppable.id && e.droppable.type === r.droppable.type;
          return t && n;
        },
        t1 = function (e, r) {
          tg(), r(), tm();
        },
        t2 = function (e, r) {
          return { draggableId: e.draggable.id, type: e.droppable.type, source: { droppableId: e.droppable.id, index: e.draggable.index }, mode: r };
        },
        t6 = function (e, r, t, n) {
          if (!e) {
            t(n(r));
            return;
          }
          var i = t$(t);
          e(r, { announce: i }), i.wasCalled() || t(n(r));
        },
        t3 = function (e, r) {
          var t = tQ(),
            n = null,
            i = function (t) {
              n || ek(!1),
                (n = null),
                t1("onDragEnd", function () {
                  return t6(e().onDragEnd, t, r, eq.onDragEnd);
                });
            };
          return {
            beforeCapture: function (r, t) {
              n && ek(!1),
                t1("onBeforeCapture", function () {
                  var n = e().onBeforeCapture;
                  n && n({ draggableId: r, mode: t });
                });
            },
            beforeStart: function (r, t) {
              n && ek(!1),
                t1("onBeforeDragStart", function () {
                  var n = e().onBeforeDragStart;
                  n && n(t2(r, t));
                });
            },
            start: function (i, o) {
              n && ek(!1);
              var a = t2(i, o);
              (n = { mode: o, lastCritical: i, lastLocation: a.source, lastCombine: null }),
                t.add(function () {
                  t1("onDragStart", function () {
                    return t6(e().onDragStart, a, r, eq.onDragStart);
                  });
                });
            },
            update: function (i, o) {
              var a,
                l,
                u = ra(o),
                c = rl(o);
              n || ek(!1);
              var s = !t0(i, n.lastCritical);
              s && (n.lastCritical = i);
              var d = (null != (a = n.lastLocation) || null != u) && (null == a || null == u || a.droppableId !== u.droppableId || a.index !== u.index);
              d && (n.lastLocation = u);
              var p =
                (null != (l = n.lastCombine) || null != c) && (null == l || null == c || l.draggableId !== c.draggableId || l.droppableId !== c.droppableId);
              if ((p && (n.lastCombine = c), s || d || p)) {
                var f = (0, w.Z)({}, t2(i, n.mode), { combine: c, destination: u });
                t.add(function () {
                  t1("onDragUpdate", function () {
                    return t6(e().onDragUpdate, f, r, eq.onDragUpdate);
                  });
                });
              }
            },
            flush: function () {
              n || ek(!1), t.flush();
            },
            drop: i,
            abort: function () {
              n && i((0, w.Z)({}, t2(n.lastCritical, n.mode), { combine: null, destination: null, reason: "CANCEL" }));
            }
          };
        },
        t5 = function (e, r) {
          var t = t3(e, r);
          return function (e) {
            return function (r) {
              return function (n) {
                if ("BEFORE_INITIAL_CAPTURE" === n.type) {
                  t.beforeCapture(n.payload.draggableId, n.payload.movementMode);
                  return;
                }
                if ("INITIAL_PUBLISH" === n.type) {
                  var i = n.payload.critical;
                  t.beforeStart(i, n.payload.movementMode), r(n), t.start(i, n.payload.movementMode);
                  return;
                }
                if ("DROP_COMPLETE" === n.type) {
                  var o = n.payload.completed.result;
                  t.flush(), r(n), t.drop(o);
                  return;
                }
                if ((r(n), "FLUSH" === n.type)) {
                  t.abort();
                  return;
                }
                var a = e.getState();
                "DRAGGING" === a.phase && t.update(a.critical, a.impact);
              };
            };
          };
        },
        t9 = function (e) {
          return function (r) {
            return function (t) {
              if ("DROP_ANIMATION_FINISHED" !== t.type) {
                r(t);
                return;
              }
              var n = e.getState();
              "DROP_ANIMATING" !== n.phase && ek(!1), e.dispatch(tM({ completed: n.completed }));
            };
          };
        },
        t8 = function (e) {
          var r = null,
            t = null;
          return function (n) {
            return function (i) {
              if (
                (("FLUSH" === i.type || "DROP_COMPLETE" === i.type || "DROP_ANIMATION_FINISHED" === i.type) &&
                  (t && (cancelAnimationFrame(t), (t = null)), r && (r(), (r = null))),
                n(i),
                "DROP_ANIMATE" === i.type)
              ) {
                var o = {
                  eventName: "scroll",
                  options: { capture: !0, passive: !1, once: !0 },
                  fn: function () {
                    "DROP_ANIMATING" === e.getState().phase && e.dispatch(tF());
                  }
                };
                t = requestAnimationFrame(function () {
                  (t = null), (r = e_(window, [o]));
                });
              }
            };
          };
        },
        t4 = function (e) {
          var r = !1;
          return function () {
            return function (t) {
              return function (n) {
                if ("INITIAL_PUBLISH" === n.type) {
                  (r = !0), e.tryRecordFocus(n.payload.critical.draggable.id), t(n), e.tryRestoreFocusRecorded();
                  return;
                }
                if ((t(n), r)) {
                  if ("FLUSH" === n.type) {
                    (r = !1), e.tryRestoreFocusRecorded();
                    return;
                  }
                  if ("DROP_COMPLETE" === n.type) {
                    r = !1;
                    var i = n.payload.completed.result;
                    i.combine && e.tryShiftRecord(i.draggableId, i.combine.draggableId), e.tryRestoreFocusRecorded();
                  }
                }
              };
            };
          };
        },
        t7 = function (e) {
          return function (r) {
            return function (t) {
              if ((r(t), "PUBLISH_WHILE_DRAGGING" === t.type)) {
                var n = e.getState();
                "DROP_PENDING" === n.phase && !n.isWaiting && e.dispatch(t_({ reason: n.reason }));
              }
            };
          };
        },
        ne = function (e) {
          var r = e.dimensionMarshal,
            t = e.focusMarshal,
            n = e.styleMarshal,
            i = e.getResponders,
            o = e.announce,
            a = e.autoScroller;
          return (function e(r, t, n) {
            if (("function" == typeof t && "function" == typeof n) || ("function" == typeof n && "function" == typeof arguments[3])) throw Error(A(0));
            if (("function" == typeof t && void 0 === n && ((n = t), (t = void 0)), void 0 !== n)) {
              if ("function" != typeof n) throw Error(A(1));
              return n(e)(r, t);
            }
            if ("function" != typeof r) throw Error(A(2));
            var i,
              o = r,
              a = t,
              l = [],
              u = l,
              c = !1;
            function s() {
              u === l && (u = l.slice());
            }
            function d() {
              if (c) throw Error(A(3));
              return a;
            }
            function p(e) {
              if ("function" != typeof e) throw Error(A(4));
              if (c) throw Error(A(5));
              var r = !0;
              return (
                s(),
                u.push(e),
                function () {
                  if (r) {
                    if (c) throw Error(A(6));
                    (r = !1), s();
                    var t = u.indexOf(e);
                    u.splice(t, 1), (l = null);
                  }
                }
              );
            }
            function f(e) {
              if (
                !(function (e) {
                  if ("object" != typeof e || null === e) return !1;
                  for (var r = e; null !== Object.getPrototypeOf(r); ) r = Object.getPrototypeOf(r);
                  return Object.getPrototypeOf(e) === r;
                })(e)
              )
                throw Error(A(7));
              if (void 0 === e.type) throw Error(A(8));
              if (c) throw Error(A(9));
              try {
                (c = !0), (a = o(a, e));
              } finally {
                c = !1;
              }
              for (var r = (l = u), t = 0; t < r.length; t++) (0, r[t])();
              return e;
            }
            return (
              f({ type: R.INIT }),
              ((i = {
                dispatch: f,
                subscribe: p,
                getState: d,
                replaceReducer: function (e) {
                  if ("function" != typeof e) throw Error(A(10));
                  (o = e), f({ type: R.REPLACE });
                }
              })[N] = function () {
                var e;
                return (
                  ((e = {
                    subscribe: function (e) {
                      if ("object" != typeof e || null === e) throw Error(A(11));
                      function r() {
                        e.next && e.next(d());
                      }
                      return r(), { unsubscribe: p(r) };
                    }
                  })[N] = function () {
                    return this;
                  }),
                  e
                );
              }),
              i
            );
          })(
            tw,
            L(
              (function () {
                for (var e = arguments.length, r = Array(e), t = 0; t < e; t++) r[t] = arguments[t];
                return function (e) {
                  return function () {
                    var t = e.apply(void 0, arguments),
                      n = function () {
                        throw Error(A(15));
                      },
                      i = {
                        getState: t.getState,
                        dispatch: function () {
                          return n.apply(void 0, arguments);
                        }
                      },
                      o = r.map(function (e) {
                        return e(i);
                      });
                    return (n = L.apply(void 0, o)(t.dispatch)), S(S({}, t), {}, { dispatch: n });
                  };
                };
              })(
                function () {
                  return function (e) {
                    return function (r) {
                      "INITIAL_PUBLISH" === r.type && n.dragging(),
                        "DROP_ANIMATE" === r.type && n.dropping(r.payload.completed.result.reason),
                        ("FLUSH" === r.type || "DROP_COMPLETE" === r.type) && n.resting(),
                        e(r);
                    };
                  };
                },
                function () {
                  return function (e) {
                    return function (t) {
                      ("DROP_COMPLETE" === t.type || "FLUSH" === t.type || "DROP_ANIMATE" === t.type) && r.stopPublishing(), e(t);
                    };
                  };
                },
                function (e) {
                  var t = e.getState,
                    n = e.dispatch;
                  return function (e) {
                    return function (i) {
                      if ("LIFT" !== i.type) {
                        e(i);
                        return;
                      }
                      var o = i.payload,
                        a = o.id,
                        l = o.clientSelection,
                        u = o.movementMode,
                        c = t();
                      "DROP_ANIMATING" === c.phase && n(tM({ completed: c.completed })),
                        "IDLE" !== t().phase && ek(!1),
                        n(tG()),
                        n({ type: "BEFORE_INITIAL_CAPTURE", payload: { draggableId: a, movementMode: u } });
                      var s = r.startPublishing({ draggableId: a, scrollOptions: { shouldPublishImmediately: "SNAP" === u } });
                      n({
                        type: "INITIAL_PUBLISH",
                        payload: { critical: s.critical, dimensions: s.dimensions, clientSelection: l, movementMode: u, viewport: s.viewport }
                      });
                    };
                  };
                },
                tJ,
                t9,
                t8,
                t7,
                function (e) {
                  return function (r) {
                    return function (t) {
                      if ("DROP_COMPLETE" === t.type || "DROP_ANIMATE" === t.type || "FLUSH" === t.type) {
                        a.stop(), r(t);
                        return;
                      }
                      if ("INITIAL_PUBLISH" === t.type) {
                        r(t);
                        var n = e.getState();
                        "DRAGGING" !== n.phase && ek(!1), a.start(n);
                        return;
                      }
                      r(t), a.scroll(e.getState());
                    };
                  };
                },
                tK,
                t4(t),
                t5(i, o)
              )
            )
          );
        },
        nr = function () {
          return { additions: {}, removals: {}, modified: {} };
        },
        nt = function (e) {
          var r = e.scrollHeight,
            t = e.scrollWidth,
            n = e.height,
            i = eY({ x: t, y: r }, { x: e.width, y: n });
          return { x: Math.max(0, i.x), y: Math.max(0, i.y) };
        },
        nn = function () {
          var e = document.documentElement;
          return e || ek(!1), e;
        },
        ni = function () {
          var e = nn();
          return nt({ scrollHeight: e.scrollHeight, scrollWidth: e.scrollWidth, width: e.clientWidth, height: e.clientHeight });
        },
        no = function () {
          var e = tX(),
            r = ni(),
            t = e.y,
            n = e.x,
            i = nn();
          return {
            frame: eb({ top: t, left: n, right: n + i.clientWidth, bottom: t + i.clientHeight }),
            scroll: { initial: e, current: e, max: r, diff: { value: eV, displacement: eV } }
          };
        },
        na = function (e) {
          var r = e.critical,
            t = e.scrollOptions,
            n = e.registry;
          tg();
          var i = no(),
            o = i.scroll.current,
            a = r.droppable,
            l = n.droppable.getAllByType(a.type).map(function (e) {
              return e.callbacks.getDimensionAndWatchScroll(o, t);
            }),
            u = {
              draggables: rt(
                n.draggable.getAllByType(r.draggable.type).map(function (e) {
                  return e.getDimension(o);
                })
              ),
              droppables: rr(l)
            };
          return tm(), { dimensions: u, critical: r, viewport: i };
        };
      function nl(e, r, t) {
        return t.descriptor.id !== r.id && t.descriptor.type === r.type && "virtual" === e.droppable.getById(t.descriptor.droppableId).descriptor.mode;
      }
      var nu = function (e, r) {
          var t,
            n,
            i,
            o,
            a,
            l,
            u = null,
            c =
              ((n = (t = { callbacks: { publish: r.publishWhileDragging, collectionStarting: r.collectionStarting }, registry: e }).registry),
              (i = t.callbacks),
              (o = nr()),
              (a = null),
              (l = function () {
                !a &&
                  (i.collectionStarting(),
                  (a = requestAnimationFrame(function () {
                    (a = null), tg();
                    var e = o,
                      r = e.additions,
                      t = e.removals,
                      l = e.modified,
                      u = Object.keys(r)
                        .map(function (e) {
                          return n.draggable.getById(e).getDimension(eV);
                        })
                        .sort(function (e, r) {
                          return e.descriptor.index - r.descriptor.index;
                        }),
                      c = Object.keys(l).map(function (e) {
                        var r = n.droppable.getById(e).callbacks.getScrollWhileDragging();
                        return { droppableId: e, scroll: r };
                      }),
                      s = { additions: u, removals: Object.keys(t), modified: c };
                    (o = nr()), tm(), i.publish(s);
                  })));
              }),
              {
                add: function (e) {
                  var r = e.descriptor.id;
                  (o.additions[r] = e), (o.modified[e.descriptor.droppableId] = !0), o.removals[r] && delete o.removals[r], l();
                },
                remove: function (e) {
                  var r = e.descriptor;
                  (o.removals[r.id] = !0), (o.modified[r.droppableId] = !0), o.additions[r.id] && delete o.additions[r.id], l();
                },
                stop: function () {
                  a && (cancelAnimationFrame(a), (a = null), (o = nr()));
                }
              }),
            s = function (r) {
              u || ek(!1);
              var t = u.critical.draggable;
              "ADDITION" === r.type && nl(e, t, r.value) && c.add(r.value), "REMOVAL" === r.type && nl(e, t, r.value) && c.remove(r.value);
            };
          return {
            updateDroppableIsEnabled: function (t, n) {
              e.droppable.exists(t) || ek(!1), u && r.updateDroppableIsEnabled({ id: t, isEnabled: n });
            },
            updateDroppableIsCombineEnabled: function (t, n) {
              u && (e.droppable.exists(t) || ek(!1), r.updateDroppableIsCombineEnabled({ id: t, isCombineEnabled: n }));
            },
            scrollDroppable: function (r, t) {
              u && e.droppable.getById(r).callbacks.scroll(t);
            },
            updateDroppableScroll: function (t, n) {
              u && (e.droppable.exists(t) || ek(!1), r.updateDroppableScroll({ id: t, newScroll: n }));
            },
            startPublishing: function (r) {
              u && ek(!1);
              var t = e.draggable.getById(r.draggableId),
                n = e.droppable.getById(t.descriptor.droppableId),
                i = { draggable: t.descriptor, droppable: n.descriptor };
              return (u = { critical: i, unsubscribe: e.subscribe(s) }), na({ critical: i, registry: e, scrollOptions: r.scrollOptions });
            },
            stopPublishing: function () {
              if (u) {
                c.stop();
                var r = u.critical.droppable;
                e.droppable.getAllByType(r.type).forEach(function (e) {
                  return e.callbacks.dragStopped();
                }),
                  u.unsubscribe(),
                  (u = null);
              }
            }
          };
        },
        nc = function (e, r) {
          return "IDLE" === e.phase || ("DROP_ANIMATING" === e.phase && e.completed.result.draggableId !== r && "DROP" === e.completed.result.reason);
        },
        ns = function (e) {
          window.scrollBy(e.x, e.y);
        },
        nd = eN(function (e) {
          return rn(e).filter(function (e) {
            return !!e.isEnabled && !!e.frame;
          });
        }),
        np = function (e) {
          var r = e.center,
            t = e.destination,
            n = e.droppables;
          if (t) {
            var i = n[t];
            return i.frame ? i : null;
          }
          return e7(nd(n), function (e) {
            return e.frame || ek(!1), r7(e.frame.pageMarginBox)(r);
          });
        },
        nf = {
          startFromPercentage: 0.25,
          maxScrollAtPercentage: 0.05,
          maxPixelScroll: 28,
          ease: function (e) {
            return Math.pow(e, 2);
          },
          durationDampening: { stopDampeningAt: 1200, accelerateAt: 360 }
        },
        ng = function (e) {
          var r = e.startOfRange,
            t = e.endOfRange,
            n = e.current,
            i = t - r;
          return 0 === i ? 0 : (n - r) / i;
        },
        nm = function (e, r) {
          if (e > r.startScrollingFrom) return 0;
          if (e <= r.maxScrollValueAt) return nf.maxPixelScroll;
          if (e === r.startScrollingFrom) return 1;
          var t = ng({ startOfRange: r.maxScrollValueAt, endOfRange: r.startScrollingFrom, current: e });
          return Math.ceil(nf.maxPixelScroll * nf.ease(1 - t));
        },
        nv = nf.durationDampening.accelerateAt,
        nb = nf.durationDampening.stopDampeningAt,
        nh = function (e, r) {
          var t = Date.now() - r;
          if (t >= nb) return e;
          if (t < nv) return 1;
          var n = ng({ startOfRange: nv, endOfRange: nb, current: t });
          return Math.ceil(e * nf.ease(n));
        },
        ny = function (e) {
          var r = e.distanceToEdge,
            t = e.thresholds,
            n = e.dragStartTime,
            i = e.shouldUseTimeDampening,
            o = nm(r, t);
          return 0 === o ? 0 : i ? Math.max(nh(o, n), 1) : o;
        },
        nx = function (e) {
          var r,
            t,
            n = e.container,
            i = e.distanceToEdges,
            o = e.dragStartTime,
            a = e.axis,
            l = e.shouldUseTimeDampening,
            u = { startScrollingFrom: (r = n)[(t = a).size] * nf.startFromPercentage, maxScrollValueAt: r[t.size] * nf.maxScrollAtPercentage };
          return i[a.end] < i[a.start]
            ? ny({ distanceToEdge: i[a.end], thresholds: u, dragStartTime: o, shouldUseTimeDampening: l })
            : -1 * ny({ distanceToEdge: i[a.start], thresholds: u, dragStartTime: o, shouldUseTimeDampening: l });
        },
        nI = function (e) {
          var r = e.container,
            t = e.subject,
            n = e.proposedScroll,
            i = t.height > r.height,
            o = t.width > r.width;
          return o || i ? (o && i ? null : { x: o ? 0 : n.x, y: i ? 0 : n.y }) : n;
        },
        nD = e0(function (e) {
          return 0 === e ? 0 : e;
        }),
        nE = function (e) {
          var r = e.dragStartTime,
            t = e.container,
            n = e.subject,
            i = e.center,
            o = e.shouldUseTimeDampening,
            a = { top: i.y - t.top, right: t.right - i.x, bottom: t.bottom - i.y, left: i.x - t.left },
            l = nx({ container: t, distanceToEdges: a, dragStartTime: r, axis: rb, shouldUseTimeDampening: o }),
            u = nD({ x: nx({ container: t, distanceToEdges: a, dragStartTime: r, axis: rh, shouldUseTimeDampening: o }), y: l });
          if (eJ(u, eV)) return null;
          var c = nI({ container: t, subject: n, proposedScroll: u });
          return c ? (eJ(c, eV) ? null : c) : null;
        },
        nw = e0(function (e) {
          return 0 === e ? 0 : e > 0 ? 1 : -1;
        }),
        nC =
          ((g = function (e, r) {
            return e < 0 ? e : e > r ? e - r : 0;
          }),
          function (e) {
            var r = e.current,
              t = e.max,
              n = ez(r, e.change),
              i = { x: g(n.x, t.x), y: g(n.y, t.y) };
            return eJ(i, eV) ? null : i;
          }),
        nP = function (e) {
          var r = e.max,
            t = e.current,
            n = e.change,
            i = { x: Math.max(t.x, r.x), y: Math.max(t.y, r.y) },
            o = nw(n),
            a = nC({ max: i, current: t, change: o });
          return !a || (0 !== o.x && 0 === a.x) || (0 !== o.y && 0 === a.y);
        },
        nS = function (e, r) {
          return nP({ current: e.scroll.current, max: e.scroll.max, change: r });
        },
        nA = function (e, r) {
          if (!nS(e, r)) return null;
          var t = e.scroll.max;
          return nC({ current: e.scroll.current, max: t, change: r });
        },
        nN = function (e, r) {
          var t = e.frame;
          return !!t && nP({ current: t.scroll.current, max: t.scroll.max, change: r });
        },
        nO = function (e, r) {
          var t = e.frame;
          return t && nN(e, r) ? nC({ current: t.scroll.current, max: t.scroll.max, change: r }) : null;
        },
        nR = function (e) {
          var r = e.viewport,
            t = e.subject,
            n = e.center,
            i = e.dragStartTime,
            o = e.shouldUseTimeDampening,
            a = nE({ dragStartTime: i, container: r.frame, subject: t, center: n, shouldUseTimeDampening: o });
          return a && nS(r, a) ? a : null;
        },
        nB = function (e) {
          var r = e.droppable,
            t = e.subject,
            n = e.center,
            i = e.dragStartTime,
            o = e.shouldUseTimeDampening,
            a = r.frame;
          if (!a) return null;
          var l = nE({ dragStartTime: i, container: a.pageMarginBox, subject: t, center: n, shouldUseTimeDampening: o });
          return l && nN(r, l) ? l : null;
        },
        nT = function (e) {
          var r = e.state,
            t = e.dragStartTime,
            n = e.shouldUseTimeDampening,
            i = e.scrollWindow,
            o = e.scrollDroppable,
            a = r.current.page.borderBoxCenter,
            l = r.dimensions.draggables[r.critical.draggable.id].page.marginBox;
          if (r.isWindowScrollAllowed) {
            var u = nR({ dragStartTime: t, viewport: r.viewport, subject: l, center: a, shouldUseTimeDampening: n });
            if (u) {
              i(u);
              return;
            }
          }
          var c = np({ center: a, destination: r5(r.impact), droppables: r.dimensions.droppables });
          if (c) {
            var s = nB({ dragStartTime: t, droppable: c, subject: l, center: a, shouldUseTimeDampening: n });
            s && o(c.descriptor.id, s);
          }
        },
        nL = function (e) {
          var r = e.scrollWindow,
            t = e.scrollDroppable,
            n = eO(r),
            i = eO(t),
            o = null,
            a = function (e) {
              o || ek(!1);
              var r = o,
                t = r.shouldUseTimeDampening;
              nT({ state: e, scrollWindow: n, scrollDroppable: i, dragStartTime: r.dragStartTime, shouldUseTimeDampening: t });
            };
          return {
            start: function (e) {
              tg(), o && ek(!1);
              var r = Date.now(),
                t = !1,
                n = function () {
                  t = !0;
                };
              nT({ state: e, dragStartTime: 0, shouldUseTimeDampening: !1, scrollWindow: n, scrollDroppable: n }),
                (o = { dragStartTime: r, shouldUseTimeDampening: t }),
                tm(),
                t && a(e);
            },
            stop: function () {
              o && (n.cancel(), i.cancel(), (o = null));
            },
            scroll: a
          };
        },
        nG = function (e) {
          var r = e.move,
            t = e.scrollDroppable,
            n = e.scrollWindow,
            i = function (e, t) {
              r({ client: ez(e.current.client.selection, t) });
            },
            o = function (e, r) {
              if (!nN(e, r)) return r;
              var n = nO(e, r);
              if (!n) return t(e.descriptor.id, r), null;
              var i = eY(r, n);
              return t(e.descriptor.id, i), eY(r, i);
            },
            a = function (e, r, t) {
              if (!e || !nS(r, t)) return t;
              var i = nA(r, t);
              if (!i) return n(t), null;
              var o = eY(t, i);
              return n(o), eY(t, o);
            };
          return function (e) {
            var r = e.scrollJumpRequest;
            if (!!r) {
              var t = r5(e.impact);
              t || ek(!1);
              var n = o(e.dimensions.droppables[t], r);
              if (n) {
                var l = e.viewport,
                  u = a(e.isWindowScrollAllowed, l, n);
                u && i(e, u);
              }
            }
          };
        },
        nM = function (e) {
          var r = e.scrollDroppable,
            t = e.scrollWindow,
            n = e.move,
            i = nL({ scrollWindow: t, scrollDroppable: r }),
            o = nG({ move: n, scrollWindow: t, scrollDroppable: r });
          return {
            scroll: function (e) {
              if ("DRAGGING" === e.phase) {
                if ("FLUID" === e.movementMode) {
                  i.scroll(e);
                  return;
                }
                e.scrollJumpRequest && o(e);
              }
            },
            start: i.start,
            stop: i.stop
          };
        },
        n_ = "data-rbd",
        nF = { base: (m = n_ + "-drag-handle"), draggableId: m + "-draggable-id", contextId: m + "-context-id" },
        nk = { base: (v = n_ + "-draggable"), contextId: v + "-context-id", id: v + "-id" },
        nW = { base: (b = n_ + "-droppable"), contextId: b + "-context-id", id: b + "-id" },
        nU = { contextId: n_ + "-scroll-container-context-id" },
        nj = function (e, r) {
          return e
            .map(function (e) {
              var t = e.styles[r];
              return t ? e.selector + " { " + t + " }" : "";
            })
            .join(" ");
        },
        nH = function (e) {
          var r,
            t,
            n = function (r) {
              return "[" + r + '="' + e + '"]';
            },
            i =
              ((r = "\n      cursor: -webkit-grab;\n      cursor: grab;\n    "),
              {
                selector: n(nF.contextId),
                styles: {
                  always:
                    "\n          -webkit-touch-callout: none;\n          -webkit-tap-highlight-color: rgba(0,0,0,0);\n          touch-action: manipulation;\n        ",
                  resting: r,
                  dragging: "pointer-events: none;",
                  dropAnimating: r
                }
              }),
            o = [
              ((t = "\n      transition: " + tj.outOfTheWay + ";\n    "),
              { selector: n(nk.contextId), styles: { dragging: t, dropAnimating: t, userCancel: t } }),
              i,
              { selector: n(nW.contextId), styles: { always: "overflow-anchor: none;" } },
              {
                selector: "body",
                styles: {
                  dragging:
                    "\n        cursor: grabbing;\n        cursor: -webkit-grabbing;\n        user-select: none;\n        -webkit-user-select: none;\n        -moz-user-select: none;\n        -ms-user-select: none;\n        overflow-anchor: none;\n      "
                }
              }
            ];
          return {
            always: nj(o, "always"),
            resting: nj(o, "resting"),
            dragging: nj(o, "dragging"),
            dropAnimating: nj(o, "dropAnimating"),
            userCancel: nj(o, "userCancel")
          };
        },
        nZ = "undefined" != typeof window && void 0 !== window.document && void 0 !== window.document.createElement ? D.useLayoutEffect : D.useEffect,
        nq = function () {
          var e = document.querySelector("head");
          return e || ek(!1), e;
        },
        nV = function (e) {
          var r = document.createElement("style");
          return e && r.setAttribute("nonce", e), (r.type = "text/css"), r;
        },
        nz = function (e) {
          return e && e.ownerDocument ? e.ownerDocument.defaultView : window;
        };
      function nY(e) {
        return e instanceof nz(e).HTMLElement;
      }
      function nJ(e, r) {
        var t = "[" + nF.contextId + '="' + e + '"]',
          n = re(document.querySelectorAll(t));
        if (!n.length) return null;
        var i = e7(n, function (e) {
          return e.getAttribute(nF.draggableId) === r;
        });
        return i && nY(i) ? i : null;
      }
      function nX() {
        var e = { draggables: {}, droppables: {} },
          r = [];
        function t(e) {
          r.length &&
            r.forEach(function (r) {
              return r(e);
            });
        }
        function n(r) {
          return e.draggables[r] || null;
        }
        function i(r) {
          return e.droppables[r] || null;
        }
        return {
          draggable: {
            register: function (r) {
              (e.draggables[r.descriptor.id] = r), t({ type: "ADDITION", value: r });
            },
            update: function (r, t) {
              var n = e.draggables[t.descriptor.id];
              n && n.uniqueId === r.uniqueId && (delete e.draggables[t.descriptor.id], (e.draggables[r.descriptor.id] = r));
            },
            unregister: function (r) {
              var i = r.descriptor.id,
                o = n(i);
              o && r.uniqueId === o.uniqueId && (delete e.draggables[i], t({ type: "REMOVAL", value: r }));
            },
            getById: function (e) {
              var r = n(e);
              return r || ek(!1), r;
            },
            findById: n,
            exists: function (e) {
              return !!n(e);
            },
            getAllByType: function (r) {
              return e8(e.draggables).filter(function (e) {
                return e.descriptor.type === r;
              });
            }
          },
          droppable: {
            register: function (r) {
              e.droppables[r.descriptor.id] = r;
            },
            unregister: function (r) {
              var t = i(r.descriptor.id);
              t && r.uniqueId === t.uniqueId && delete e.droppables[r.descriptor.id];
            },
            getById: function (e) {
              var r = i(e);
              return r || ek(!1), r;
            },
            findById: i,
            exists: function (e) {
              return !!i(e);
            },
            getAllByType: function (r) {
              return e8(e.droppables).filter(function (e) {
                return e.descriptor.type === r;
              });
            }
          },
          subscribe: function (e) {
            return (
              r.push(e),
              function () {
                var t = r.indexOf(e);
                -1 !== t && r.splice(t, 1);
              }
            );
          },
          clean: function () {
            (e.draggables = {}), (e.droppables = {}), (r.length = 0);
          }
        };
      }
      var nK = D.createContext(null),
        n$ = function () {
          var e = document.body;
          return e || ek(!1), e;
        },
        nQ = {
          position: "absolute",
          width: "1px",
          height: "1px",
          margin: "-1px",
          border: "0",
          padding: "0",
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          "clip-path": "inset(100%)"
        },
        n0 = 0,
        n1 = { separator: "::" };
      function n2(e, r) {
        return (
          void 0 === r && (r = n1),
          em(
            function () {
              return "" + e + r.separator + n0++;
            },
            [r.separator, e]
          )
        );
      }
      var n6 = D.createContext(null),
        n3 = /(\d+)\.(\d+)\.(\d+)/,
        n5 = function (e) {
          var r = n3.exec(e);
          return null == r && ek(!1), { major: Number(r[1]), minor: Number(r[2]), patch: Number(r[3]), raw: e };
        },
        n9 = function (e, r) {
          var t = n5(e),
            n = n5(r);
          if (n.major > t.major || (!(n.major < t.major) && (n.minor > t.minor || (!(n.minor < t.minor) && n.patch >= t.patch)))) return;
        },
        n8 = function (e) {
          var r = e.doctype;
          r && (r.name.toLowerCase(), r.publicId);
        };
      function n4(e) {}
      function n7(e, r) {}
      function ie(e) {
        var r = (0, D.useRef)(e);
        return (
          (0, D.useEffect)(function () {
            r.current = e;
          }),
          r
        );
      }
      var ir = (((x = {})[13] = !0), (x[9] = !0), x),
        it = function (e) {
          ir[e.keyCode] && e.preventDefault();
        },
        ii =
          ((h = "visibilitychange"),
          "undefined" == typeof document
            ? h
            : e7([h, "ms" + h, "webkit" + h, "moz" + h, "o" + h], function (e) {
                return "on" + e in document;
              }) || h),
        io = { type: "IDLE" };
      function ia() {}
      var il = (((I = {})[34] = !0), (I[33] = !0), (I[36] = !0), (I[35] = !0), I),
        iu = { type: "IDLE" },
        ic = { input: !0, button: !0, textarea: !0, select: !0, option: !0, optgroup: !0, video: !0, audio: !0 },
        is =
          ((y = "matches"),
          "undefined" == typeof document
            ? y
            : e7([y, "msMatchesSelector", "webkitMatchesSelector"], function (e) {
                return e in Element.prototype;
              }) || y);
      function id(e) {
        e.preventDefault();
      }
      function ip(e) {
        var r = e.expected,
          t = e.phase,
          n = e.isLockActive;
        return e.shouldWarn, !!n() && r === t;
      }
      function ig(e) {
        var r = e.lockAPI,
          t = e.store,
          n = e.registry,
          i = e.draggableId;
        if (r.isClaimed()) return !1;
        var o = n.draggable.findById(i);
        return !!(o && o.options.isEnabled && nc(t.getState(), i));
      }
      var im = [
        function (e) {
          var r = (0, D.useRef)(io),
            t = (0, D.useRef)(eM),
            n = em(
              function () {
                return {
                  eventName: "mousedown",
                  fn: function (r) {
                    if (!r.defaultPrevented && 0 === r.button && !r.ctrlKey && !r.metaKey && !r.shiftKey && !r.altKey) {
                      var n = e.findClosestDraggableId(r);
                      if (n) {
                        var i = e.tryGetLock(n, a, { sourceEvent: r });
                        if (i) {
                          r.preventDefault();
                          var o = { x: r.clientX, y: r.clientY };
                          t.current(), c(i, o);
                        }
                      }
                    }
                  }
                };
              },
              [e]
            ),
            i = em(
              function () {
                return {
                  eventName: "webkitmouseforcewillbegin",
                  fn: function (r) {
                    if (!r.defaultPrevented) {
                      var t = e.findClosestDraggableId(r);
                      if (t) {
                        var n = e.findOptionsForDraggable(t);
                        n && !n.shouldRespectForcePress && e.canGetLock(t) && r.preventDefault();
                      }
                    }
                  }
                };
              },
              [e]
            ),
            o = ev(
              function () {
                t.current = e_(window, [i, n], { passive: !1, capture: !0 });
              },
              [i, n]
            ),
            a = ev(
              function () {
                "IDLE" !== r.current.type && ((r.current = io), t.current(), o());
              },
              [o]
            ),
            l = ev(
              function () {
                var e = r.current;
                a(), "DRAGGING" === e.type && e.actions.cancel({ shouldBlockNextClick: !0 }), "PENDING" === e.type && e.actions.abort();
              },
              [a]
            ),
            u = ev(
              function () {
                var e,
                  n,
                  i,
                  o,
                  u,
                  c =
                    ((n = (e = {
                      cancel: l,
                      completed: a,
                      getPhase: function () {
                        return r.current;
                      },
                      setPhase: function (e) {
                        r.current = e;
                      }
                    }).cancel),
                    (i = e.completed),
                    (o = e.getPhase),
                    (u = e.setPhase),
                    [
                      {
                        eventName: "mousemove",
                        fn: function (e) {
                          var r,
                            t = e.button,
                            n = e.clientX,
                            i = e.clientY;
                          if (0 === t) {
                            var a = { x: n, y: i },
                              l = o();
                            if ("DRAGGING" === l.type) {
                              e.preventDefault(), l.actions.move(a);
                              return;
                            }
                            "PENDING" !== l.type && ek(!1),
                              (r = l.point),
                              (Math.abs(a.x - r.x) >= 5 || Math.abs(a.y - r.y) >= 5) &&
                                (e.preventDefault(), u({ type: "DRAGGING", actions: l.actions.fluidLift(a) }));
                          }
                        }
                      },
                      {
                        eventName: "mouseup",
                        fn: function (e) {
                          var r = o();
                          if ("DRAGGING" !== r.type) {
                            n();
                            return;
                          }
                          e.preventDefault(), r.actions.drop({ shouldBlockNextClick: !0 }), i();
                        }
                      },
                      {
                        eventName: "mousedown",
                        fn: function (e) {
                          "DRAGGING" === o().type && e.preventDefault(), n();
                        }
                      },
                      {
                        eventName: "keydown",
                        fn: function (e) {
                          if ("PENDING" === o().type) {
                            n();
                            return;
                          }
                          if (27 === e.keyCode) {
                            e.preventDefault(), n();
                            return;
                          }
                          it(e);
                        }
                      },
                      { eventName: "resize", fn: n },
                      {
                        eventName: "scroll",
                        options: { passive: !0, capture: !1 },
                        fn: function () {
                          "PENDING" === o().type && n();
                        }
                      },
                      {
                        eventName: "webkitmouseforcedown",
                        fn: function (e) {
                          var r = o();
                          if (("IDLE" === r.type && ek(!1), r.actions.shouldRespectForcePress())) {
                            n();
                            return;
                          }
                          e.preventDefault();
                        }
                      },
                      { eventName: ii, fn: n }
                    ]);
                t.current = e_(window, c, { capture: !0, passive: !1 });
              },
              [l, a]
            ),
            c = ev(
              function (e, t) {
                "IDLE" !== r.current.type && ek(!1), (r.current = { type: "PENDING", point: t, actions: e }), u();
              },
              [u]
            );
          nZ(
            function () {
              return (
                o(),
                function () {
                  t.current();
                }
              );
            },
            [o]
          );
        },
        function (e) {
          var r = (0, D.useRef)(ia),
            t = em(
              function () {
                return {
                  eventName: "keydown",
                  fn: function (t) {
                    if (!t.defaultPrevented && 32 === t.keyCode) {
                      var i = e.findClosestDraggableId(t);
                      if (i) {
                        var o = e.tryGetLock(i, u, { sourceEvent: t });
                        if (o) {
                          t.preventDefault();
                          var a = !0,
                            l = o.snapLift();
                          r.current(),
                            (r.current = e_(
                              window,
                              (function (e, r) {
                                function t() {
                                  r(), e.cancel();
                                }
                                return [
                                  {
                                    eventName: "keydown",
                                    fn: function (n) {
                                      if (27 === n.keyCode) {
                                        n.preventDefault(), t();
                                        return;
                                      }
                                      if (32 === n.keyCode) {
                                        n.preventDefault(), r(), e.drop();
                                        return;
                                      }
                                      if (40 === n.keyCode) {
                                        n.preventDefault(), e.moveDown();
                                        return;
                                      }
                                      if (38 === n.keyCode) {
                                        n.preventDefault(), e.moveUp();
                                        return;
                                      }
                                      if (39 === n.keyCode) {
                                        n.preventDefault(), e.moveRight();
                                        return;
                                      }
                                      if (37 === n.keyCode) {
                                        n.preventDefault(), e.moveLeft();
                                        return;
                                      }
                                      if (il[n.keyCode]) {
                                        n.preventDefault();
                                        return;
                                      }
                                      it(n);
                                    }
                                  },
                                  { eventName: "mousedown", fn: t },
                                  { eventName: "mouseup", fn: t },
                                  { eventName: "click", fn: t },
                                  { eventName: "touchstart", fn: t },
                                  { eventName: "resize", fn: t },
                                  { eventName: "wheel", fn: t, options: { passive: !0 } },
                                  { eventName: ii, fn: t }
                                ];
                              })(l, u),
                              { capture: !0, passive: !1 }
                            ));
                        }
                      }
                    }
                    function u() {
                      a || ek(!1), (a = !1), r.current(), n();
                    }
                  }
                };
              },
              [e]
            ),
            n = ev(
              function () {
                r.current = e_(window, [t], { passive: !1, capture: !0 });
              },
              [t]
            );
          nZ(
            function () {
              return (
                n(),
                function () {
                  r.current();
                }
              );
            },
            [n]
          );
        },
        function (e) {
          var r = (0, D.useRef)(iu),
            t = (0, D.useRef)(eM),
            n = ev(function () {
              return r.current;
            }, []),
            i = ev(function (e) {
              r.current = e;
            }, []),
            o = em(
              function () {
                return {
                  eventName: "touchstart",
                  fn: function (r) {
                    if (!r.defaultPrevented) {
                      var n = e.findClosestDraggableId(r);
                      if (n) {
                        var i = e.tryGetLock(n, l, { sourceEvent: r });
                        if (i) {
                          var o = r.touches[0],
                            a = o.clientX,
                            u = o.clientY;
                          t.current(), d(i, { x: a, y: u });
                        }
                      }
                    }
                  }
                };
              },
              [e]
            ),
            a = ev(
              function () {
                t.current = e_(window, [o], { capture: !0, passive: !1 });
              },
              [o]
            ),
            l = ev(
              function () {
                var e = r.current;
                "IDLE" !== e.type && ("PENDING" === e.type && clearTimeout(e.longPressTimerId), i(iu), t.current(), a());
              },
              [a, i]
            ),
            u = ev(
              function () {
                var e = r.current;
                l(), "DRAGGING" === e.type && e.actions.cancel({ shouldBlockNextClick: !0 }), "PENDING" === e.type && e.actions.abort();
              },
              [l]
            ),
            c = ev(
              function () {
                var e,
                  r,
                  i,
                  o,
                  a,
                  c = { capture: !0, passive: !1 },
                  s = { cancel: u, completed: l, getPhase: n },
                  d = e_(
                    window,
                    ((e = s.cancel),
                    (r = s.completed),
                    (i = s.getPhase),
                    [
                      {
                        eventName: "touchmove",
                        options: { capture: !1 },
                        fn: function (r) {
                          var t = i();
                          if ("DRAGGING" !== t.type) {
                            e();
                            return;
                          }
                          t.hasMoved = !0;
                          var n = r.touches[0],
                            o = n.clientX,
                            a = n.clientY;
                          r.preventDefault(), t.actions.move({ x: o, y: a });
                        }
                      },
                      {
                        eventName: "touchend",
                        fn: function (t) {
                          var n = i();
                          if ("DRAGGING" !== n.type) {
                            e();
                            return;
                          }
                          t.preventDefault(), n.actions.drop({ shouldBlockNextClick: !0 }), r();
                        }
                      },
                      {
                        eventName: "touchcancel",
                        fn: function (r) {
                          if ("DRAGGING" !== i().type) {
                            e();
                            return;
                          }
                          r.preventDefault(), e();
                        }
                      },
                      {
                        eventName: "touchforcechange",
                        fn: function (r) {
                          var t = i();
                          "IDLE" === t.type && ek(!1);
                          var n = r.touches[0];
                          if (n && n.force >= 0.15) {
                            var o = t.actions.shouldRespectForcePress();
                            if ("PENDING" === t.type) {
                              o && e();
                              return;
                            }
                            if (o) {
                              if (t.hasMoved) {
                                r.preventDefault();
                                return;
                              }
                              e();
                              return;
                            }
                            r.preventDefault();
                          }
                        }
                      },
                      { eventName: ii, fn: e }
                    ]),
                    c
                  ),
                  p = e_(
                    window,
                    ((o = s.cancel),
                    (a = s.getPhase),
                    [
                      { eventName: "orientationchange", fn: o },
                      { eventName: "resize", fn: o },
                      {
                        eventName: "contextmenu",
                        fn: function (e) {
                          e.preventDefault();
                        }
                      },
                      {
                        eventName: "keydown",
                        fn: function (e) {
                          if ("DRAGGING" !== a().type) {
                            o();
                            return;
                          }
                          27 === e.keyCode && e.preventDefault(), o();
                        }
                      },
                      { eventName: ii, fn: o }
                    ]),
                    c
                  );
                t.current = function () {
                  d(), p();
                };
              },
              [u, n, l]
            ),
            s = ev(
              function () {
                var e = n();
                "PENDING" !== e.type && ek(!1), i({ type: "DRAGGING", actions: e.actions.fluidLift(e.point), hasMoved: !1 });
              },
              [n, i]
            ),
            d = ev(
              function (e, r) {
                "IDLE" !== n().type && ek(!1), i({ type: "PENDING", point: r, actions: e, longPressTimerId: setTimeout(s, 120) }), c();
              },
              [c, n, i, s]
            );
          nZ(
            function () {
              return (
                a(),
                function () {
                  t.current();
                  var e = n();
                  "PENDING" === e.type && (clearTimeout(e.longPressTimerId), i(iu));
                }
              );
            },
            [n, a, i]
          ),
            nZ(function () {
              return e_(window, [{ eventName: "touchmove", fn: function () {}, options: { capture: !1, passive: !1 } }]);
            }, []);
        }
      ];
      function iv(e) {
        return e.current || ek(!1), e.current;
      }
      function ib(e) {
        var r,
          t,
          n,
          i,
          o,
          a,
          l,
          u,
          c,
          s,
          d,
          p,
          f,
          g,
          m,
          v,
          b,
          h,
          y,
          x,
          I,
          E,
          C,
          P,
          S,
          A,
          N = e.contextId,
          O = e.setCallbacks,
          R = e.sensors,
          B = e.nonce,
          L = e.dragHandleUsageInstructions,
          G = (0, D.useRef)(null);
        n7(function () {
          n9("^16.8.5 || ^17.0.0", D.version), n8(document);
        }, []);
        var M = ie(e),
          _ = ev(
            function () {
              var e;
              return {
                onBeforeCapture: (e = M.current).onBeforeCapture,
                onBeforeDragStart: e.onBeforeDragStart,
                onDragStart: e.onDragStart,
                onDragEnd: e.onDragEnd,
                onDragUpdate: e.onDragUpdate
              };
            },
            [M]
          ),
          F =
            ((t = em(
              function () {
                return "rbd-announcement-" + r;
              },
              [(r = N)]
            )),
            (n = (0, D.useRef)(null)),
            (0, D.useEffect)(
              function () {
                var e = document.createElement("div");
                return (
                  (n.current = e),
                  (e.id = t),
                  e.setAttribute("aria-live", "assertive"),
                  e.setAttribute("aria-atomic", "true"),
                  (0, w.Z)(e.style, nQ),
                  n$().appendChild(e),
                  function () {
                    setTimeout(function () {
                      var r = n$();
                      r.contains(e) && r.removeChild(e), e === n.current && (n.current = null);
                    });
                  }
                );
              },
              [t]
            ),
            ev(function (e) {
              var r = n.current;
              if (r) {
                r.textContent = e;
                return;
              }
            }, [])),
          k =
            ((o = (i = { contextId: N, text: L }).contextId),
            (a = i.text),
            (u = em(
              function () {
                var e;
                return "rbd-hidden-text-" + (e = { contextId: o, uniqueId: l }).contextId + "-" + e.uniqueId;
              },
              [(l = n2("hidden-text", { separator: "-" })), o]
            )),
            (0, D.useEffect)(
              function () {
                var e = document.createElement("div");
                return (
                  (e.id = u),
                  (e.textContent = a),
                  (e.style.display = "none"),
                  n$().appendChild(e),
                  function () {
                    var r = n$();
                    r.contains(e) && r.removeChild(e);
                  }
                );
              },
              [u, a]
            ),
            u),
          U =
            ((c = em(
              function () {
                return nH(N);
              },
              [N]
            )),
            (s = (0, D.useRef)(null)),
            (d = (0, D.useRef)(null)),
            (p = ev(
              eN(function (e) {
                var r = d.current;
                r || ek(!1), (r.textContent = e);
              }),
              []
            )),
            nZ(
              function () {
                (s.current || d.current) && ek(!1);
                var e = nV(B),
                  r = nV(B);
                return (
                  (s.current = e),
                  (d.current = r),
                  e.setAttribute(n_ + "-always", N),
                  r.setAttribute(n_ + "-dynamic", N),
                  nq().appendChild(e),
                  nq().appendChild(r),
                  f(c.always),
                  p(c.resting),
                  function () {
                    var e = function (e) {
                      var r = e.current;
                      r || ek(!1), nq().removeChild(r), (e.current = null);
                    };
                    e(s), e(d);
                  }
                );
              },
              [
                B,
                (f = ev(function (e) {
                  var r = s.current;
                  r || ek(!1), (r.textContent = e);
                }, [])),
                p,
                c.always,
                c.resting,
                N
              ]
            ),
            (g = ev(
              function () {
                return p(c.dragging);
              },
              [p, c.dragging]
            )),
            em(
              function () {
                return { dragging: g, dropping: m, resting: v };
              },
              [
                g,
                (m = ev(
                  function (e) {
                    if ("DROP" === e) {
                      p(c.dropAnimating);
                      return;
                    }
                    p(c.userCancel);
                  },
                  [p, c.dropAnimating, c.userCancel]
                )),
                (v = ev(
                  function () {
                    d.current && p(c.resting);
                  },
                  [p, c.resting]
                ))
              ]
            )),
          j = ev(function (e) {
            iv(G).dispatch(e);
          }, []),
          H = em(
            function () {
              return T(
                {
                  publishWhileDragging: tC,
                  updateDroppableScroll: tS,
                  updateDroppableIsEnabled: tA,
                  updateDroppableIsCombineEnabled: tN,
                  collectionStarting: tP
                },
                j
              );
            },
            [j]
          ),
          Z =
            ((b = em(nX, [])),
            (0, D.useEffect)(
              function () {
                return function () {
                  requestAnimationFrame(b.clean);
                };
              },
              [b]
            ),
            b),
          q = em(
            function () {
              return nu(Z, H);
            },
            [Z, H]
          ),
          V = em(
            function () {
              return nM((0, w.Z)({ scrollWindow: ns, scrollDroppable: q.scrollDroppable }, T({ move: tO }, j)));
            },
            [q.scrollDroppable, j]
          ),
          z =
            ((h = (0, D.useRef)({})),
            (y = (0, D.useRef)(null)),
            (x = (0, D.useRef)(null)),
            (I = (0, D.useRef)(!1)),
            (E = ev(function (e, r) {
              var t = { id: e, focus: r };
              return (
                (h.current[e] = t),
                function () {
                  var r = h.current;
                  r[e] !== t && delete r[e];
                }
              );
            }, [])),
            (C = ev(
              function (e) {
                var r = nJ(N, e);
                r && r !== document.activeElement && r.focus();
              },
              [N]
            )),
            (P = ev(function (e, r) {
              y.current === e && (y.current = r);
            }, [])),
            (S = ev(
              function () {
                !x.current &&
                  I.current &&
                  (x.current = requestAnimationFrame(function () {
                    x.current = null;
                    var e = y.current;
                    e && C(e);
                  }));
              },
              [C]
            )),
            (A = ev(function (e) {
              y.current = null;
              var r = document.activeElement;
              r && r.getAttribute(nF.draggableId) === e && (y.current = e);
            }, [])),
            nZ(function () {
              return (
                (I.current = !0),
                function () {
                  I.current = !1;
                  var e = x.current;
                  e && cancelAnimationFrame(e);
                }
              );
            }, []),
            em(
              function () {
                return { register: E, tryRecordFocus: A, tryRestoreFocusRecorded: S, tryShiftRecord: P };
              },
              [E, A, S, P]
            )),
          Y = em(
            function () {
              return ne({ announce: F, autoScroller: V, dimensionMarshal: q, focusMarshal: z, getResponders: _, styleMarshal: U });
            },
            [F, V, q, z, _, U]
          );
        G.current = Y;
        var J = ev(function () {
            var e = iv(G);
            "IDLE" !== e.getState().phase && e.dispatch(tG());
          }, []),
          X = ev(function () {
            var e = iv(G).getState();
            return e.isDragging || "DROP_ANIMATING" === e.phase;
          }, []);
        O(
          em(
            function () {
              return { isDragging: X, tryAbort: J };
            },
            [X, J]
          )
        );
        var K = ev(function (e) {
            return nc(iv(G).getState(), e);
          }, []),
          $ = ev(function () {
            return r4(iv(G).getState());
          }, []),
          Q = em(
            function () {
              return { marshal: q, focus: z, contextId: N, canLift: K, isMovementAllowed: $, dragHandleUsageInstructionsId: k, registry: Z };
            },
            [N, q, k, z, K, $, Z]
          );
        return (
          !(function (e) {
            var r = e.contextId,
              t = e.store,
              n = e.registry,
              i = e.customSensors,
              o = [].concat(e.enableDefaultSensors ? im : [], i || []),
              a = (0, D.useState)(function () {
                return (function () {
                  var e = null;
                  function r() {
                    e || ek(!1), (e = null);
                  }
                  return {
                    isClaimed: function () {
                      return !!e;
                    },
                    isActive: function (r) {
                      return r === e;
                    },
                    claim: function (r) {
                      e && ek(!1);
                      var t = { abandon: r };
                      return (e = t), t;
                    },
                    release: r,
                    tryAbandon: function () {
                      e && (e.abandon(), r());
                    }
                  };
                })();
              })[0],
              l = ev(
                function (e, r) {
                  e.isDragging && !r.isDragging && a.tryAbandon();
                },
                [a]
              );
            nZ(
              function () {
                var e = t.getState();
                return t.subscribe(function () {
                  var r = t.getState();
                  l(e, r), (e = r);
                });
              },
              [a, t, l]
            ),
              nZ(
                function () {
                  return a.tryAbandon;
                },
                [a.tryAbandon]
              );
            for (
              var u = ev(
                  function (e) {
                    return ig({ lockAPI: a, registry: n, store: t, draggableId: e });
                  },
                  [a, n, t]
                ),
                c = ev(
                  function (e, i, o) {
                    return (function (e) {
                      var r,
                        t,
                        n,
                        i,
                        o = e.lockAPI,
                        a = e.contextId,
                        l = e.store,
                        u = e.registry,
                        c = e.draggableId,
                        s = e.forceSensorStop,
                        d = e.sourceEvent;
                      if (!ig({ lockAPI: o, store: l, registry: u, draggableId: c })) return null;
                      var p = u.draggable.getById(c),
                        f =
                          ((r = p.descriptor.id),
                          (t = "[" + nk.contextId + '="' + a + '"]'),
                          (n = e7(re(document.querySelectorAll(t)), function (e) {
                            return e.getAttribute(nk.id) === r;
                          })) && nY(n)
                            ? n
                            : null);
                      if (
                        !f ||
                        (d &&
                          !p.options.canDragInteractiveElements &&
                          nY((i = d.target)) &&
                          (function e(r, t) {
                            if (null == t) return !1;
                            if (ic[t.tagName.toLowerCase()]) return !0;
                            var n = t.getAttribute("contenteditable");
                            return "true" === n || "" === n || (t !== r && e(r, t.parentElement));
                          })(f, i))
                      )
                        return null;
                      var g = o.claim(s || eM),
                        m = "PRE_DRAG";
                      function v() {
                        return p.options.shouldRespectForcePress;
                      }
                      function b() {
                        return o.isActive(g);
                      }
                      var h = function (e, r) {
                        ip({ expected: e, phase: m, isLockActive: b, shouldWarn: !0 }) && l.dispatch(r());
                      }.bind(null, "DRAGGING");
                      function y(e) {
                        function r() {
                          o.release(), (m = "COMPLETED");
                        }
                        function t(t, n) {
                          void 0 === n && (n = { shouldBlockNextClick: !1 }),
                            e.cleanup(),
                            n.shouldBlockNextClick && setTimeout(e_(window, [{ eventName: "click", fn: id, options: { once: !0, passive: !1, capture: !0 } }])),
                            r(),
                            l.dispatch(t_({ reason: t }));
                        }
                        return (
                          "PRE_DRAG" !== m && (r(), "PRE_DRAG" !== m && ek(!1)),
                          l.dispatch({ type: "LIFT", payload: e.liftActionArgs }),
                          (m = "DRAGGING"),
                          (0, w.Z)(
                            {
                              isActive: function () {
                                return ip({ expected: "DRAGGING", phase: m, isLockActive: b, shouldWarn: !1 });
                              },
                              shouldRespectForcePress: v,
                              drop: function (e) {
                                return t("DROP", e);
                              },
                              cancel: function (e) {
                                return t("CANCEL", e);
                              }
                            },
                            e.actions
                          )
                        );
                      }
                      return {
                        isActive: function () {
                          return ip({ expected: "PRE_DRAG", phase: m, isLockActive: b, shouldWarn: !1 });
                        },
                        shouldRespectForcePress: v,
                        fluidLift: function (e) {
                          var r = eO(function (e) {
                              h(function () {
                                return tO({ client: e });
                              });
                            }),
                            t = y({
                              liftActionArgs: { id: c, clientSelection: e, movementMode: "FLUID" },
                              cleanup: function () {
                                return r.cancel();
                              },
                              actions: { move: r }
                            });
                          return (0, w.Z)({}, t, { move: r });
                        },
                        snapLift: function () {
                          return y({
                            liftActionArgs: { id: c, clientSelection: eb(f.getBoundingClientRect()).center, movementMode: "SNAP" },
                            cleanup: eM,
                            actions: {
                              moveUp: function () {
                                return h(tR);
                              },
                              moveRight: function () {
                                return h(tT);
                              },
                              moveDown: function () {
                                return h(tB);
                              },
                              moveLeft: function () {
                                return h(tL);
                              }
                            }
                          });
                        },
                        abort: function () {
                          ip({ expected: "PRE_DRAG", phase: m, isLockActive: b, shouldWarn: !0 }) && o.release();
                        }
                      };
                    })({
                      lockAPI: a,
                      registry: n,
                      contextId: r,
                      store: t,
                      draggableId: e,
                      forceSensorStop: i,
                      sourceEvent: o && o.sourceEvent ? o.sourceEvent : null
                    });
                  },
                  [r, a, n, t]
                ),
                s = ev(
                  function (e) {
                    var t;
                    return (t = (function (e, r) {
                      var t = r.target;
                      if (!(t instanceof nz(t).Element)) return null;
                      var n = "[" + nF.contextId + '="' + e + '"]',
                        i = t.closest
                          ? t.closest(n)
                          : (function e(r, t) {
                              return null == r ? null : r[is](t) ? r : e(r.parentElement, t);
                            })(t, n);
                      return i && nY(i) ? i : null;
                    })(r, e))
                      ? t.getAttribute(nF.draggableId)
                      : null;
                  },
                  [r]
                ),
                d = ev(
                  function (e) {
                    var r = n.draggable.findById(e);
                    return r ? r.options : null;
                  },
                  [n.draggable]
                ),
                p = ev(
                  function () {
                    a.isClaimed() && (a.tryAbandon(), "IDLE" !== t.getState().phase && t.dispatch(tG()));
                  },
                  [a, t]
                ),
                f = ev(a.isClaimed, [a]),
                g = em(
                  function () {
                    return { canGetLock: u, tryGetLock: c, findClosestDraggableId: s, findOptionsForDraggable: d, tryReleaseLock: p, isLockClaimed: f };
                  },
                  [u, c, s, d, p, f]
                ),
                m = 0;
              m < o.length;
              m++
            )
              o[m](g);
          })({ contextId: N, store: Y, registry: Z, customSensors: R, enableDefaultSensors: !1 !== e.enableDefaultSensors }),
          (0, D.useEffect)(
            function () {
              return J;
            },
            [J]
          ),
          D.createElement(n6.Provider, { value: Q }, D.createElement(W, { context: nK, store: Y }, e.children))
        );
      }
      var ih = 0;
      function iy(e) {
        var r = em(function () {
            return "" + ih++;
          }, []),
          t = e.dragHandleUsageInstructions || eq.dragHandleUsageInstructions;
        return D.createElement(eW, null, function (n) {
          return D.createElement(
            ib,
            {
              nonce: e.nonce,
              contextId: r,
              setCallbacks: n,
              dragHandleUsageInstructions: t,
              enableDefaultSensors: e.enableDefaultSensors,
              sensors: e.sensors,
              onBeforeCapture: e.onBeforeCapture,
              onBeforeDragStart: e.onBeforeDragStart,
              onDragStart: e.onDragStart,
              onDragUpdate: e.onDragUpdate,
              onDragEnd: e.onDragEnd
            },
            e.children
          );
        });
      }
      var ix = function (e) {
          return function (r) {
            return e === r;
          };
        },
        iI = ix("scroll"),
        iD = ix("auto");
      ix("visible");
      var iE = function (e, r) {
          return r(e.overflowX) || r(e.overflowY);
        },
        iw = function (e) {
          var r = window.getComputedStyle(e),
            t = { overflowX: r.overflowX, overflowY: r.overflowY };
          return iE(t, iI) || iE(t, iD);
        },
        iC = function (e) {
          return { x: e.scrollLeft, y: e.scrollTop };
        },
        iP = function (e) {
          var r = e.descriptor,
            t = e.isEnabled,
            n = e.isCombineEnabled,
            i = e.isFixedOnPage,
            o = e.direction,
            a = e.client,
            l = e.page,
            u = e.closest,
            c = (function () {
              if (!u) return null;
              var e = u.scrollSize,
                r = u.client,
                t = nt({ scrollHeight: e.scrollHeight, scrollWidth: e.scrollWidth, height: r.paddingBox.height, width: r.paddingBox.width });
              return {
                pageMarginBox: u.page.marginBox,
                frameClient: r,
                scrollSize: e,
                shouldClipSubject: u.shouldClipSubject,
                scroll: { initial: u.scroll, current: u.scroll, max: t, diff: { value: eV, displacement: eV } }
              };
            })(),
            s = "vertical" === o ? rb : rh,
            d = e5({ page: l, withPlaceholder: null, axis: s, frame: c });
          return { descriptor: r, isCombineEnabled: n, isFixedOnPage: i, axis: s, isEnabled: t, client: a, page: l, frame: c, subject: d };
        },
        iS = function (e, r) {
          var t = eP(e);
          if (!r || e !== r) return t;
          var n = t.paddingBox.top - r.scrollTop,
            i = t.paddingBox.left - r.scrollLeft,
            o = n + r.scrollHeight;
          return eI({
            borderBox: eh({ top: n, right: i + r.scrollWidth, bottom: o, left: i }, t.border),
            margin: t.margin,
            border: t.border,
            padding: t.padding
          });
        },
        iA = function (e) {
          var r = e.ref,
            t = e.descriptor,
            n = e.env,
            i = e.windowScroll,
            o = e.direction,
            a = e.isDropDisabled,
            l = e.isCombineEnabled,
            u = e.shouldClipSubject,
            c = n.closestScrollable,
            s = iS(r, c),
            d = ew(s, i),
            p = (function () {
              if (!c) return null;
              var e = eP(c),
                r = { scrollHeight: c.scrollHeight, scrollWidth: c.scrollWidth };
              return { client: e, page: ew(e, i), scroll: iC(c), scrollSize: r, shouldClipSubject: u };
            })();
          return iP({ descriptor: t, isEnabled: !a, isCombineEnabled: l, isFixedOnPage: n.isFixedOnPage, direction: o, client: s, page: d, closest: p });
        },
        iN = { passive: !1 },
        iO = { passive: !0 },
        iR = function (e) {
          return e.shouldPublishImmediately ? iN : iO;
        };
      function iB(e) {
        var r = (0, D.useContext)(e);
        return r || ek(!1), r;
      }
      var iT = function (e) {
        return (e && e.env.closestScrollable) || null;
      };
      function iL() {}
      var iG = { width: 0, height: 0, margin: { top: 0, right: 0, bottom: 0, left: 0 } },
        iM = function (e) {
          var r = e.isAnimatingOpenOnMount,
            t = e.placeholder,
            n = e.animate;
          return r || "close" === n ? iG : { height: t.client.borderBox.height, width: t.client.borderBox.width, margin: t.client.margin };
        },
        i_ = function (e) {
          var r = e.isAnimatingOpenOnMount,
            t = e.placeholder,
            n = e.animate,
            i = iM({ isAnimatingOpenOnMount: r, placeholder: t, animate: n });
          return {
            display: t.display,
            boxSizing: "border-box",
            width: i.width,
            height: i.height,
            marginTop: i.margin.top,
            marginRight: i.margin.right,
            marginBottom: i.margin.bottom,
            marginLeft: i.margin.left,
            flexShrink: "0",
            flexGrow: "0",
            pointerEvents: "none",
            transition: "none" !== n ? tj.placeholder : null
          };
        },
        iF = D.memo(function (e) {
          var r = (0, D.useRef)(null),
            t = ev(function () {
              r.current && (clearTimeout(r.current), (r.current = null));
            }, []),
            n = e.animate,
            i = e.onTransitionEnd,
            o = e.onClose,
            a = e.contextId,
            l = (0, D.useState)("open" === e.animate),
            u = l[0],
            c = l[1];
          (0, D.useEffect)(
            function () {
              return u
                ? "open" !== n
                  ? (t(), c(!1), iL)
                  : r.current
                    ? iL
                    : ((r.current = setTimeout(function () {
                        (r.current = null), c(!1);
                      })),
                      t)
                : iL;
            },
            [n, u, t]
          );
          var s = ev(
              function (e) {
                "height" === e.propertyName && (i(), "close" === n && o());
              },
              [n, o, i]
            ),
            d = i_({ isAnimatingOpenOnMount: u, animate: e.animate, placeholder: e.placeholder });
          return D.createElement(e.placeholder.tagName, { style: d, "data-rbd-placeholder-context-id": a, onTransitionEnd: s, ref: e.innerRef });
        }),
        ik = D.createContext(null);
      function iW(e) {
        (e && nY(e)) || ek(!1);
      }
      function iU(e) {
        return "boolean" == typeof e;
      }
      function ij(e, r) {
        r.forEach(function (r) {
          return r(e);
        });
      }
      var iH = [
          function (e) {
            var r = e.props;
            r.droppableId || ek(!1), "string" != typeof r.droppableId && ek(!1);
          },
          function (e) {
            var r = e.props;
            iU(r.isDropDisabled) || ek(!1), iU(r.isCombineEnabled) || ek(!1), iU(r.ignoreContainerClipping) || ek(!1);
          },
          function (e) {
            iW((0, e.getDroppableRef)());
          }
        ],
        iZ = [
          function (e) {
            var r = e.props,
              t = e.getPlaceholderRef;
            if (!r.placeholder || t()) return;
          }
        ],
        iq = [
          function (e) {
            e.props.renderClone || ek(!1);
          },
          function (e) {
            (0, e.getPlaceholderRef)() && ek(!1);
          }
        ],
        iV = (function (e) {
          function r() {
            for (var r, t = arguments.length, n = Array(t), i = 0; i < t; i++) n[i] = arguments[i];
            return (
              ((r = e.call.apply(e, [this].concat(n)) || this).state = {
                isVisible: !!r.props.on,
                data: r.props.on,
                animate: r.props.shouldAnimate && r.props.on ? "open" : "none"
              }),
              (r.onClose = function () {
                "close" === r.state.animate && r.setState({ isVisible: !1 });
              }),
              r
            );
          }
          return (
            (0, E.Z)(r, e),
            (r.getDerivedStateFromProps = function (e, r) {
              return e.shouldAnimate
                ? e.on
                  ? { isVisible: !0, data: e.on, animate: "open" }
                  : r.isVisible
                    ? { isVisible: !0, data: r.data, animate: "close" }
                    : { isVisible: !1, animate: "close", data: null }
                : { isVisible: !!e.on, data: e.on, animate: "none" };
            }),
            (r.prototype.render = function () {
              if (!this.state.isVisible) return null;
              var e = { onClose: this.onClose, data: this.state.data, animate: this.state.animate };
              return this.props.children(e);
            }),
            r
          );
        })(D.PureComponent),
        iz = { dragging: 5e3, dropAnimating: 4500 };
      function iY(e) {
        e.preventDefault();
      }
      var iJ = function (e, r) {
          return e === r;
        },
        iX = function (e) {
          var r = e.combine,
            t = e.destination;
          return t ? t.droppableId : r ? r.droppableId : null;
        };
      function iK(e) {
        return {
          isDragging: !1,
          isDropAnimating: !1,
          isClone: !1,
          dropAnimation: null,
          mode: null,
          draggingOver: null,
          combineTargetFor: e,
          combineWith: null
        };
      }
      var i$ = { mapped: { type: "SECONDARY", offset: eV, combineTargetFor: null, shouldAnimateDisplacement: !0, snapshot: iK(null) } },
        iQ = ef(
          function () {
            var e,
              r,
              t,
              n,
              i,
              o,
              a,
              l,
              u =
                ((e = eN(function (e, r) {
                  return { x: e, y: r };
                })),
                (r = eN(function (e, r, t, n, i) {
                  return {
                    isDragging: !0,
                    isClone: r,
                    isDropAnimating: !!i,
                    dropAnimation: i,
                    mode: e,
                    draggingOver: t,
                    combineWith: n,
                    combineTargetFor: null
                  };
                })),
                (t = eN(function (e, t, n, i, o, a, l) {
                  return {
                    mapped: {
                      type: "DRAGGING",
                      dropping: null,
                      draggingOver: o,
                      combineWith: a,
                      mode: t,
                      offset: e,
                      dimension: n,
                      forceShouldAnimate: l,
                      snapshot: r(t, i, o, a, null)
                    }
                  };
                })),
                function (n, i) {
                  if (n.isDragging) {
                    if (n.critical.draggable.id !== i.draggableId) return null;
                    var o,
                      a = n.current.client.offset,
                      l = n.dimensions.draggables[i.draggableId],
                      u = r5(n.impact),
                      c = (o = n.impact).at && "COMBINE" === o.at.type ? o.at.combine.draggableId : null,
                      s = n.forceShouldAnimate;
                    return t(e(a.x, a.y), n.movementMode, l, i.isClone, u, c, s);
                  }
                  if ("DROP_ANIMATING" === n.phase) {
                    var d = n.completed;
                    if (d.result.draggableId !== i.draggableId) return null;
                    var p = i.isClone,
                      f = n.dimensions.draggables[i.draggableId],
                      g = d.result,
                      m = g.mode,
                      v = iX(g),
                      b = g.combine ? g.combine.draggableId : null,
                      h = {
                        duration: n.dropDuration,
                        curve: tk.drop,
                        moveTo: n.newHomeClientOffset,
                        opacity: b ? tW.opacity.drop : null,
                        scale: b ? tW.scale.drop : null
                      };
                    return {
                      mapped: {
                        type: "DRAGGING",
                        offset: n.newHomeClientOffset,
                        dimension: f,
                        dropping: h,
                        draggingOver: v,
                        combineWith: b,
                        mode: m,
                        forceShouldAnimate: null,
                        snapshot: r(m, p, v, b, h)
                      }
                    };
                  }
                  return null;
                }),
              c =
                ((n = eN(function (e, r) {
                  return { x: e, y: r };
                })),
                (i = eN(iK)),
                (o = eN(function (e, r, t) {
                  return (
                    void 0 === r && (r = null), { mapped: { type: "SECONDARY", offset: e, combineTargetFor: r, shouldAnimateDisplacement: t, snapshot: i(r) } }
                  );
                })),
                (a = function (e) {
                  return e ? o(eV, e, !0) : null;
                }),
                (l = function (e, r, t, i) {
                  var l = t.displaced.visible[e],
                    u = !!(i.inVirtualList && i.effected[e]),
                    c = rl(t),
                    s = c && c.draggableId === e ? r : null;
                  if (!l) {
                    if (!u) return a(s);
                    if (t.displaced.invisible[e]) return null;
                    var d = eX(i.displacedBy.point);
                    return o(n(d.x, d.y), s, !0);
                  }
                  if (u) return a(s);
                  var p = t.displacedBy.point;
                  return o(n(p.x, p.y), s, l.shouldAnimate);
                }),
                function (e, r) {
                  if (e.isDragging)
                    return e.critical.draggable.id === r.draggableId ? null : l(r.draggableId, e.critical.draggable.id, e.impact, e.afterCritical);
                  if ("DROP_ANIMATING" === e.phase) {
                    var t = e.completed;
                    return t.result.draggableId === r.draggableId ? null : l(r.draggableId, t.result.draggableId, t.impact, t.afterCritical);
                  }
                  return null;
                });
            return function (e, r) {
              return u(e, r) || c(e, r) || i$;
            };
          },
          { dropAnimationFinished: tF },
          null,
          { context: nK, pure: !0, areStatePropsEqual: iJ }
        )(function (e) {
          var r,
            t,
            n,
            i,
            o,
            a,
            l,
            u,
            c,
            s,
            d,
            p,
            f,
            g = (0, D.useRef)(null),
            m = ev(function (e) {
              g.current = e;
            }, []),
            v = ev(function () {
              return g.current;
            }, []),
            b = iB(n6),
            h = b.contextId,
            y = b.dragHandleUsageInstructionsId,
            x = b.registry,
            I = iB(ik),
            E = I.type,
            w = I.droppableId,
            C = em(
              function () {
                return { id: e.draggableId, index: e.index, type: E, droppableId: w };
              },
              [e.draggableId, e.index, E, w]
            ),
            P = e.children,
            S = e.draggableId,
            A = e.isEnabled,
            N = e.shouldRespectForcePress,
            O = e.canDragInteractiveElements,
            R = e.isClone,
            B = e.mapped,
            T = e.dropAnimationFinished;
          n7(function () {
            var r,
              t = e.draggableId;
            t || ek(!1),
              "string" != typeof t && ek(!1),
              (r = e.index),
              (Number.isInteger ? Number.isInteger(r) : "number" == typeof r && isFinite(r) && Math.floor(r) === r) || ek(!1),
              "DRAGGING" !== e.mapped.type && (iW(v()), e.isEnabled && (nJ(h, t) || ek(!1)));
          }),
            !R &&
              ((r = em(
                function () {
                  return { descriptor: C, registry: x, getDraggableRef: v, canDragInteractiveElements: O, shouldRespectForcePress: N, isEnabled: A };
                },
                [C, x, v, O, N, A]
              )),
              (t = n2("draggable")),
              (n = r.descriptor),
              (i = r.registry),
              (o = r.getDraggableRef),
              (a = r.canDragInteractiveElements),
              (l = r.shouldRespectForcePress),
              (c = em(
                function () {
                  return { canDragInteractiveElements: a, shouldRespectForcePress: l, isEnabled: u };
                },
                [a, (u = r.isEnabled), l]
              )),
              (s = ev(
                function (e) {
                  var r,
                    t,
                    i,
                    a,
                    l = o();
                  return (
                    l || ek(!1),
                    void 0 === (r = e) && (r = eV),
                    (t = window.getComputedStyle(l)),
                    (a = ew((i = eC(l.getBoundingClientRect(), t)), r)),
                    {
                      descriptor: n,
                      placeholder: { client: i, tagName: l.tagName.toLowerCase(), display: t.display },
                      displaceBy: { x: i.marginBox.width, y: i.marginBox.height },
                      client: i,
                      page: a
                    }
                  );
                },
                [n, o]
              )),
              (d = em(
                function () {
                  return { uniqueId: t, descriptor: n, options: c, getDimension: s };
                },
                [n, s, c, t]
              )),
              (p = (0, D.useRef)(d)),
              (f = (0, D.useRef)(!0)),
              nZ(
                function () {
                  return (
                    i.draggable.register(p.current),
                    function () {
                      return i.draggable.unregister(p.current);
                    }
                  );
                },
                [i.draggable]
              ),
              nZ(
                function () {
                  if (f.current) {
                    f.current = !1;
                    return;
                  }
                  var e = p.current;
                  (p.current = d), i.draggable.update(d, e);
                },
                [d, i.draggable]
              ));
          var L = em(
              function () {
                return A
                  ? {
                      tabIndex: 0,
                      role: "button",
                      "aria-describedby": y,
                      "data-rbd-drag-handle-draggable-id": S,
                      "data-rbd-drag-handle-context-id": h,
                      draggable: !1,
                      onDragStart: iY
                    }
                  : null;
              },
              [h, y, S, A]
            ),
            G = ev(
              function (e) {
                "DRAGGING" === B.type && B.dropping && "transform" === e.propertyName && T();
              },
              [T, B]
            ),
            M = em(
              function () {
                var e, r, t, n, i, o, a, l;
                return {
                  innerRef: m,
                  draggableProps: {
                    "data-rbd-draggable-context-id": h,
                    "data-rbd-draggable-id": S,
                    style:
                      "DRAGGING" === B.type
                        ? ((e = B.dimension.client),
                          (r = B.offset),
                          (t = B.combineWith),
                          (n = B.dropping),
                          (i = !!t),
                          (o = null != B.forceShouldAnimate ? B.forceShouldAnimate : "SNAP" === B.mode),
                          (l = (a = !!n) ? tZ.drop(r, i) : tZ.moveTo(r)),
                          {
                            position: "fixed",
                            top: e.marginBox.top,
                            left: e.marginBox.left,
                            boxSizing: "border-box",
                            width: e.borderBox.width,
                            height: e.borderBox.height,
                            transition: n ? tj.drop(n.duration) : o ? tj.snap : tj.fluid,
                            transform: l,
                            opacity: i ? (a ? tW.opacity.drop : tW.opacity.combining) : null,
                            zIndex: a ? iz.dropAnimating : iz.dragging,
                            pointerEvents: "none"
                          })
                        : { transform: tZ.moveTo(B.offset), transition: B.shouldAnimateDisplacement ? null : "none" },
                    onTransitionEnd: "DRAGGING" === B.type && B.dropping ? G : null
                  },
                  dragHandleProps: L
                };
              },
              [h, L, S, B, G, m]
            ),
            _ = em(
              function () {
                return { draggableId: C.id, type: C.type, source: { index: C.index, droppableId: C.droppableId } };
              },
              [C.droppableId, C.id, C.index, C.type]
            );
          return P(M, B.snapshot, _);
        });
      function i0(e) {
        return iB(ik).isUsingCloneFor !== e.draggableId || e.isClone ? D.createElement(iQ, e) : null;
      }
      function i1(e) {
        var r = "boolean" != typeof e.isDragDisabled || !e.isDragDisabled,
          t = !!e.disableInteractiveElementBlocking,
          n = !!e.shouldRespectForcePress;
        return D.createElement(i0, (0, w.Z)({}, e, { isClone: !1, isEnabled: r, canDragInteractiveElements: t, shouldRespectForcePress: n }));
      }
      var i2 = function (e, r) {
          return e === r.droppable.type;
        },
        i6 = function (e, r) {
          return r.draggables[e.draggable.id];
        },
        i3 = ef(
          function () {
            var e = {
                placeholder: null,
                shouldAnimatePlaceholder: !0,
                snapshot: { isDraggingOver: !1, draggingOverWith: null, draggingFromThisWith: null, isUsingPlaceholder: !1 },
                useClone: null
              },
              r = (0, w.Z)({}, e, { shouldAnimatePlaceholder: !1 }),
              t = eN(function (e) {
                return { draggableId: e.id, type: e.type, source: { index: e.index, droppableId: e.droppableId } };
              }),
              n = eN(function (n, i, o, a, l, u) {
                var c = l.descriptor.id;
                if (l.descriptor.droppableId === n) {
                  var s = u ? { render: u, dragging: t(l.descriptor) } : null;
                  return {
                    placeholder: l.placeholder,
                    shouldAnimatePlaceholder: !1,
                    snapshot: { isDraggingOver: o, draggingOverWith: o ? c : null, draggingFromThisWith: c, isUsingPlaceholder: !0 },
                    useClone: s
                  };
                }
                return i
                  ? a
                    ? {
                        placeholder: l.placeholder,
                        shouldAnimatePlaceholder: !0,
                        snapshot: { isDraggingOver: o, draggingOverWith: c, draggingFromThisWith: null, isUsingPlaceholder: !0 },
                        useClone: null
                      }
                    : e
                  : r;
              });
            return function (t, i) {
              var o = i.droppableId,
                a = i.type,
                l = !i.isDropDisabled,
                u = i.renderClone;
              if (t.isDragging) {
                var c = t.critical;
                if (!i2(a, c)) return r;
                var s = i6(c, t.dimensions),
                  d = r5(t.impact) === o;
                return n(o, l, d, d, s, u);
              }
              if ("DROP_ANIMATING" === t.phase) {
                var p = t.completed;
                if (!i2(a, p.critical)) return r;
                var f = i6(p.critical, t.dimensions);
                return n(o, l, iX(p.result) === o, r5(p.impact) === o, f, u);
              }
              if ("IDLE" === t.phase && t.completed && !t.shouldFlush) {
                var g = t.completed;
                if (!i2(a, g.critical)) return r;
                var m = r5(g.impact) === o,
                  v = !!(g.impact.at && "COMBINE" === g.impact.at.type),
                  b = g.critical.droppable.id === o;
                if (m) return v ? e : r;
                if (b) return e;
              }
              return r;
            };
          },
          {
            updateViewportMaxScroll: function (e) {
              return { type: "UPDATE_VIEWPORT_MAX_SCROLL", payload: e };
            }
          },
          null,
          { context: nK, pure: !0, areStatePropsEqual: iJ }
        )(function (e) {
          var r,
            t,
            n,
            i,
            o,
            a,
            l,
            u,
            c,
            s,
            d,
            p,
            f,
            g,
            m,
            v,
            b,
            h,
            y,
            x,
            I,
            E = (0, D.useContext)(n6);
          E || ek(!1);
          var w = E.contextId,
            C = E.isMovementAllowed,
            P = (0, D.useRef)(null),
            S = (0, D.useRef)(null),
            A = e.children,
            N = e.droppableId,
            O = e.type,
            R = e.mode,
            B = e.direction,
            T = e.ignoreContainerClipping,
            L = e.isDropDisabled,
            G = e.isCombineEnabled,
            M = e.snapshot,
            _ = e.useClone,
            F = e.updateViewportMaxScroll,
            k = e.getContainerForClone,
            W = ev(function () {
              return P.current;
            }, []),
            U = ev(function (e) {
              P.current = e;
            }, []),
            j = ev(function () {
              return S.current;
            }, []),
            H = ev(function (e) {
              S.current = e;
            }, []);
          (r = { props: e, getDroppableRef: W, getPlaceholderRef: j }),
            n7(function () {
              ij(r, iH), "standard" === r.props.mode && ij(r, iZ), "virtual" === r.props.mode && ij(r, iq);
            });
          var Z = ev(
            function () {
              C() && F({ maxScroll: ni() });
            },
            [C, F]
          );
          (t = { droppableId: N, type: O, mode: R, direction: B, isDropDisabled: L, isCombineEnabled: G, ignoreContainerClipping: T, getDroppableRef: W }),
            (n = (0, D.useRef)(null)),
            (i = iB(n6)),
            (o = n2("droppable")),
            (a = i.registry),
            (l = i.marshal),
            (u = ie(t)),
            (c = em(
              function () {
                return { id: t.droppableId, type: t.type, mode: t.mode };
              },
              [t.droppableId, t.mode, t.type]
            )),
            (s = (0, D.useRef)(c)),
            (d = em(
              function () {
                return eN(function (e, r) {
                  n.current || ek(!1), l.updateDroppableScroll(c.id, { x: e, y: r });
                });
              },
              [c.id, l]
            )),
            (p = ev(function () {
              var e = n.current;
              return e && e.env.closestScrollable ? iC(e.env.closestScrollable) : eV;
            }, [])),
            (g = em(
              function () {
                return eO(f);
              },
              [
                (f = ev(
                  function () {
                    var e = p();
                    d(e.x, e.y);
                  },
                  [p, d]
                ))
              ]
            )),
            (m = ev(
              function () {
                var e = n.current,
                  r = iT(e);
                if (((e && r) || ek(!1), e.scrollOptions.shouldPublishImmediately)) {
                  f();
                  return;
                }
                g();
              },
              [g, f]
            )),
            (v = ev(
              function (e, r) {
                n.current && ek(!1);
                var t = u.current,
                  o = t.getDroppableRef();
                o || ek(!1);
                var a = {
                    closestScrollable: (function e(r) {
                      return null == r ? null : r === document.body ? null : r === document.documentElement ? null : iw(r) ? r : e(r.parentElement);
                    })(o),
                    isFixedOnPage: (function e(r) {
                      return !!r && ("fixed" === window.getComputedStyle(r).position || e(r.parentElement));
                    })(o)
                  },
                  l = { ref: o, descriptor: c, env: a, scrollOptions: r };
                n.current = l;
                var s = iA({
                    ref: o,
                    descriptor: c,
                    env: a,
                    windowScroll: e,
                    direction: t.direction,
                    isDropDisabled: t.isDropDisabled,
                    isCombineEnabled: t.isCombineEnabled,
                    shouldClipSubject: !t.ignoreContainerClipping
                  }),
                  d = a.closestScrollable;
                return d && (d.setAttribute(nU.contextId, i.contextId), d.addEventListener("scroll", m, iR(l.scrollOptions))), s;
              },
              [i.contextId, c, m, u]
            )),
            (b = ev(function () {
              var e = n.current,
                r = iT(e);
              return (e && r) || ek(!1), iC(r);
            }, [])),
            (x = em(
              function () {
                return { getDimensionAndWatchScroll: v, getScrollWhileDragging: b, dragStopped: h, scroll: y };
              },
              [
                (h = ev(
                  function () {
                    var e = n.current;
                    e || ek(!1);
                    var r = iT(e);
                    (n.current = null), r && (g.cancel(), r.removeAttribute(nU.contextId), r.removeEventListener("scroll", m, iR(e.scrollOptions)));
                  },
                  [m, g]
                )),
                v,
                b,
                (y = ev(function (e) {
                  var r = n.current;
                  r || ek(!1);
                  var t = iT(r);
                  t || ek(!1), (t.scrollTop += e.y), (t.scrollLeft += e.x);
                }, []))
              ]
            )),
            (I = em(
              function () {
                return { uniqueId: o, descriptor: c, callbacks: x };
              },
              [x, c, o]
            )),
            nZ(
              function () {
                return (
                  (s.current = I.descriptor),
                  a.droppable.register(I),
                  function () {
                    n.current && h(), a.droppable.unregister(I);
                  }
                );
              },
              [x, c, h, I, l, a.droppable]
            ),
            nZ(
              function () {
                n.current && l.updateDroppableIsEnabled(s.current.id, !t.isDropDisabled);
              },
              [t.isDropDisabled, l]
            ),
            nZ(
              function () {
                n.current && l.updateDroppableIsCombineEnabled(s.current.id, t.isCombineEnabled);
              },
              [t.isCombineEnabled, l]
            );
          var q = D.createElement(iV, { on: e.placeholder, shouldAnimate: e.shouldAnimatePlaceholder }, function (e) {
              var r = e.onClose,
                t = e.data,
                n = e.animate;
              return D.createElement(iF, { placeholder: t, onClose: r, innerRef: H, animate: n, contextId: w, onTransitionEnd: Z });
            }),
            V = em(
              function () {
                return { innerRef: U, placeholder: q, droppableProps: { "data-rbd-droppable-id": N, "data-rbd-droppable-context-id": w } };
              },
              [w, N, q, U]
            ),
            z = _ ? _.dragging.draggableId : null,
            Y = em(
              function () {
                return { droppableId: N, type: O, isUsingCloneFor: z };
              },
              [N, z, O]
            );
          return D.createElement(
            ik.Provider,
            { value: Y },
            A(V, M),
            (function () {
              if (!_) return null;
              var e = _.dragging,
                r = _.render,
                t = D.createElement(
                  i0,
                  {
                    draggableId: e.draggableId,
                    index: e.source.index,
                    isClone: !0,
                    isEnabled: !0,
                    shouldRespectForcePress: !1,
                    canDragInteractiveElements: !0
                  },
                  function (t, n) {
                    return r(t, n, e);
                  }
                );
              return eg.createPortal(t, k());
            })()
          );
        });
      i3.defaultProps = {
        mode: "standard",
        type: "DEFAULT",
        direction: "vertical",
        isDropDisabled: !1,
        isCombineEnabled: !1,
        ignoreContainerClipping: !1,
        renderClone: null,
        getContainerForClone: function () {
          return document.body || ek(!1), document.body;
        }
      };
    },
    98559: function (e, r) {
      var t = 60103,
        n = 60106,
        i = 60107,
        o = 60108,
        a = 60114,
        l = 60109,
        u = 60110,
        c = 60112,
        s = 60113,
        d = 60120,
        p = 60115,
        f = 60116,
        g = 60121,
        m = 60122,
        v = 60117,
        b = 60129,
        h = 60131;
      if ("function" == typeof Symbol && Symbol.for) {
        var y = Symbol.for;
        (t = y("react.element")),
          (n = y("react.portal")),
          (i = y("react.fragment")),
          (o = y("react.strict_mode")),
          (a = y("react.profiler")),
          (l = y("react.provider")),
          (u = y("react.context")),
          (c = y("react.forward_ref")),
          (s = y("react.suspense")),
          (d = y("react.suspense_list")),
          (p = y("react.memo")),
          (f = y("react.lazy")),
          y("react.block"),
          y("react.server.block"),
          y("react.fundamental"),
          y("react.debug_trace_mode"),
          y("react.legacy_hidden");
      }
      r.isContextConsumer = function (e) {
        return (
          (function (e) {
            if ("object" == typeof e && null !== e) {
              var r = e.$$typeof;
              switch (r) {
                case t:
                  switch ((e = e.type)) {
                    case i:
                    case a:
                    case o:
                    case s:
                    case d:
                      return e;
                    default:
                      switch ((e = e && e.$$typeof)) {
                        case u:
                        case c:
                        case f:
                        case p:
                        case l:
                          return e;
                        default:
                          return r;
                      }
                  }
                case n:
                  return r;
              }
            }
          })(e) === u
        );
      };
    },
    63920: function (e, r, t) {
      e.exports = t(98559);
    },
    83660: function (e, r, t) {
      t.d(r, { Z: () => n });
      function n(e, r) {
        if (null == e) return {};
        var t = {};
        for (var n in e)
          if ({}.hasOwnProperty.call(e, n)) {
            if (-1 !== r.indexOf(n)) continue;
            t[n] = e[n];
          }
        return t;
      }
    },
    95300: function (e, r, t) {
      t.d(r, { Z: () => n });
      function n(e) {
        return (n =
          "function" == typeof Symbol && "symbol" == typeof Symbol.iterator
            ? function (e) {
                return typeof e;
              }
            : function (e) {
                return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
              })(e);
      }
    }
  }
]);
//# sourceMappingURL=9168.js.map
