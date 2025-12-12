/*! For license information please see 4278.js.LICENSE.txt */
!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "110cdd09-49cc-405d-9706-3b80413646a2"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-110cdd09-49cc-405d-9706-3b80413646a2"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
(_global.SENTRY_RELEASE = { id: "0.23.1" }),
  (self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
    ["4278"],
    {
      57711: function (e, t, n) {
        "use strict";
        var r =
            (this && this.__assign) ||
            function () {
              return (r =
                Object.assign ||
                function (e) {
                  for (var t, n = 1, r = arguments.length; n < r; n++)
                    for (var o in (t = arguments[n])) Object.prototype.hasOwnProperty.call(t, o) && (e[o] = t[o]);
                  return e;
                }).apply(this, arguments);
            },
          o =
            (this && this.__importDefault) ||
            function (e) {
              return e && e.__esModule ? e : { default: e };
            };
        Object.defineProperty(t, "__esModule", { value: !0 }), (t.useSearch = t.useFuzzy = void 0);
        var i = o(n(71659)),
          a = n(2784);
        function s(e, t) {
          var n = (0, a.useState)(""),
            o = n[0],
            s = n[1],
            l = (0, a.useMemo)(
              function () {
                return new i.default(e, r(r({}, { tokenize: !0, threshold: 0.2 }), t));
              },
              [e, t]
            ),
            u = o
              ? (l.search(o) || []).map(function (e) {
                  return r(r({}, e.item), { matches: e.matches });
                })
              : e;
          return {
            keyword: o,
            resetSearch: function () {
              return s("");
            },
            result: u,
            search: s
          };
        }
        (t.useFuzzy = s), (t.useSearch = s);
      },
      91207: function (e) {
        "use strict";
        e.exports = function (e) {
          var t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {};
          if (
            ((t.char = t.char || "*"),
            (t.keepLeft = t.keepLeft || 0),
            (t.keepRight = t.keepRight || 0),
            (t.compactTo = t.compactTo || 0),
            (t.keepSymbols = t.keepSymbols || !1),
            !e)
          )
            return e;
          if (t.compactTo && t.keepSymbols) throw Error("you cannot define both compactTo and keepSymbols");
          (e = String(e)),
            (t.char = String(t.char)),
            (t.keepLeft = Math.floor(parseInt(t.keepLeft, 10))),
            (t.keepRight = Math.floor(parseInt(t.keepRight, 10))),
            (t.compactTo = Math.floor(parseInt(t.compactTo, 10))),
            (t.keepSymbols = !!t.keepSymbols);
          var n = t.keepSymbols ? /[a-zA-Z0-9]/g : /(.)/g,
            r = e.replace(n, t.char);
          return (
            t.keepLeft > 0 && (r = e.substring(0, t.keepLeft) + r.substring(t.keepLeft)),
            t.keepRight > 0 && (r = r.slice(0, -1 * t.keepRight) + e.substring(e.length - t.keepRight)),
            t.compactTo > 0 && (r = r.replace(RegExp("\\" + t.char + "+", "g"), Array(t.compactTo + 1).join(t.char))),
            r
          );
        };
      },
      85608: function (e, t, n) {
        let { useState: r, useCallback: o, useEffect: i } = n(2784);
        e.exports = function (e) {
          let t = [],
            n = () => t.forEach(e => e()),
            a = e instanceof Function ? e() : e;
          return function () {
            let e = r({})[1],
              s = o(() => e({}), [e]);
            i(
              () => (
                t.push(s),
                () => {
                  t.splice(t.findIndex(s), 1);
                }
              ),
              [s]
            );
            let l = o(
              e => {
                (a = e instanceof Function ? e(a) : e), n();
              },
              [s]
            );
            return [a, l];
          };
        };
      },
      47035: function (e) {
        "use strict";
        var t = { ellipse: "…", chars: [" ", "-"], max: 140, truncate: !0 };
        function n(e, t, n, r) {
          if (e <= t) return e;
          if (t < 2) return e.slice(0, t - n.length) + n;
          for (var o = Math.floor((t - n.length) / 2), i = o, a = e.length - o, s = 0; s < o; s++) {
            var l = e.charAt(s),
              u = e.length - s,
              c = e.charAt(u);
            -1 !== r.indexOf(l) && (i = s), -1 !== r.indexOf(c) && (a = u);
          }
          return e.slice(0, i) + n + e.slice(a);
        }
        function r(e, t, n, r, o) {
          if (e.length <= t) return e;
          for (var i = t - n.length, a = i, s = 0; s <= i; s++) {
            var l = e.charAt(s);
            -1 !== r.indexOf(l) && (a = s);
          }
          return o || a != i ? e.slice(0, a) + n : "";
        }
        (e.exports = function (e, o, i) {
          if ("string" != typeof e || 0 === e.length || 0 === o) return "";
          for (var a in ((i = i || {}), t)) (null === i[a] || void 0 === i[a]) && (i[a] = t[a]);
          return ((i.max = o || i.max), "middle" == i.truncate) ? n(e, i.max, i.ellipse, i.chars) : r(e, i.max, i.ellipse, i.chars, i.truncate);
        }),
          (e.exports.ellipsizeMiddle = n),
          (e.exports.ellipsize = r);
      },
      76521: function (e, t) {
        (function (e) {
          "use strict";
          function t(e) {
            for (var t = Array(e), n = 0; n < e; ++n) t[n] = 0;
            return t;
          }
          function n(e, t) {
            for (var n = 0, r = 0; r < e.length; ++r) n += e[r] * t[r];
            return n;
          }
          function r(e) {
            return Math.sqrt(n(e, e));
          }
          function o(e, t, n) {
            for (var r = 0; r < t.length; ++r) e[r] = t[r] * n;
          }
          function i(e, t, n, r, o) {
            for (var i = 0; i < e.length; ++i) e[i] = t * n[i] + r * o[i];
          }
          function a(e, t, r, o, a, s, l) {
            var u = r.fx,
              c = n(r.fxprime, t),
              d = u,
              f = u,
              h = c,
              p = 0;
            function _(f, p, _) {
              for (var g = 0; g < 16; ++g)
                if (((a = (f + p) / 2), i(o.x, 1, r.x, a, t), (d = o.fx = e(o.x, o.fxprime)), (h = n(o.fxprime, t)), d > u + s * a * c || d >= _)) p = a;
                else {
                  if (Math.abs(h) <= -l * c) return a;
                  h * (p - f) >= 0 && (p = f), (f = a), (_ = d);
                }
              return 0;
            }
            (a = a || 1), (s = s || 1e-6), (l = l || 0.1);
            for (var g = 0; g < 10; ++g) {
              if ((i(o.x, 1, r.x, a, t), (d = o.fx = e(o.x, o.fxprime)), (h = n(o.fxprime, t)), d > u + s * a * c || (g && d >= f))) return _(p, a, f);
              if (Math.abs(h) <= -l * c) break;
              if (h >= 0) return _(a, p, d);
              (f = d), (p = a), (a *= 2);
            }
            return a;
          }
          (e.bisect = function (e, t, n, r) {
            var o = (r = r || {}).maxIterations || 100,
              i = r.tolerance || 1e-10,
              a = e(t),
              s = e(n),
              l = n - t;
            if (a * s > 0) throw "Initial bisect points must have opposite signs";
            if (0 === a) return t;
            if (0 === s) return n;
            for (var u = 0; u < o; ++u) {
              var c = t + (l /= 2),
                d = e(c);
              if ((d * a >= 0 && (t = c), Math.abs(l) < i || 0 === d)) return c;
            }
            return t + l;
          }),
            (e.nelderMead = function (e, t, n) {
              var r,
                o = (n = n || {}).maxIterations || 200 * t.length,
                a = n.nonZeroDelta || 1.05,
                s = n.zeroDelta || 0.001,
                l = n.minErrorDelta || 1e-6,
                u = n.minErrorDelta || 1e-5,
                c = void 0 !== n.rho ? n.rho : 1,
                d = void 0 !== n.chi ? n.chi : 2,
                f = void 0 !== n.psi ? n.psi : -0.5,
                h = void 0 !== n.sigma ? n.sigma : 0.5,
                p = t.length,
                _ = Array(p + 1);
              (_[0] = t), (_[0].fx = e(t)), (_[0].id = 0);
              for (var g = 0; g < p; ++g) {
                var m = t.slice();
                (m[g] = m[g] ? m[g] * a : s), (_[g + 1] = m), (_[g + 1].fx = e(m)), (_[g + 1].id = g + 1);
              }
              function v(e) {
                for (var t = 0; t < e.length; t++) _[p][t] = e[t];
                _[p].fx = e.fx;
              }
              for (
                var y = function (e, t) {
                    return e.fx - t.fx;
                  },
                  b = t.slice(),
                  x = t.slice(),
                  w = t.slice(),
                  k = t.slice(),
                  M = 0;
                M < o;
                ++M
              ) {
                if ((_.sort(y), n.history)) {
                  var j = _.map(function (e) {
                    var t = e.slice();
                    return (t.fx = e.fx), (t.id = e.id), t;
                  });
                  j.sort(function (e, t) {
                    return e.id - t.id;
                  }),
                    n.history.push({ x: _[0].slice(), fx: _[0].fx, simplex: j });
                }
                for (g = 0, r = 0; g < p; ++g) r = Math.max(r, Math.abs(_[0][g] - _[1][g]));
                if (Math.abs(_[0].fx - _[p].fx) < l && r < u) break;
                for (g = 0; g < p; ++g) {
                  b[g] = 0;
                  for (var E = 0; E < p; ++E) b[g] += _[E][g];
                  b[g] /= p;
                }
                var S = _[p];
                if ((i(x, 1 + c, b, -c, S), (x.fx = e(x)), x.fx < _[0].fx)) i(k, 1 + d, b, -d, S), (k.fx = e(k)), v(k.fx < x.fx ? k : x);
                else if (x.fx >= _[p - 1].fx) {
                  var T = !1;
                  if (
                    (x.fx > S.fx
                      ? (i(w, 1 + f, b, -f, S), (w.fx = e(w)), w.fx < S.fx ? v(w) : (T = !0))
                      : (i(w, 1 - f * c, b, f * c, S), (w.fx = e(w)), w.fx < x.fx ? v(w) : (T = !0)),
                    T)
                  ) {
                    if (h >= 1) break;
                    for (g = 1; g < _.length; ++g) i(_[g], 1 - h, _[0], h, _[g]), (_[g].fx = e(_[g]));
                  }
                } else v(x);
              }
              return _.sort(y), { fx: _[0].fx, x: _[0] };
            }),
            (e.conjugateGradient = function (e, t, s) {
              var l,
                u,
                c,
                d = { x: t.slice(), fx: 0, fxprime: t.slice() },
                f = { x: t.slice(), fx: 0, fxprime: t.slice() },
                h = t.slice(),
                p = 1;
              (c = (s = s || {}).maxIterations || 20 * t.length), (d.fx = e(d.x, d.fxprime)), o((l = d.fxprime.slice()), d.fxprime, -1);
              for (var _ = 0; _ < c; ++_) {
                if (((p = a(e, l, d, f, p)), s.history && s.history.push({ x: d.x.slice(), fx: d.fx, fxprime: d.fxprime.slice(), alpha: p }), p)) {
                  i(h, 1, f.fxprime, -1, d.fxprime);
                  var g = n(d.fxprime, d.fxprime);
                  i(l, Math.max(0, n(h, f.fxprime) / g), l, -1, f.fxprime), (u = d), (d = f), (f = u);
                } else o(l, d.fxprime, -1);
                if (1e-5 >= r(d.fxprime)) break;
              }
              return s.history && s.history.push({ x: d.x.slice(), fx: d.fx, fxprime: d.fxprime.slice(), alpha: p }), d;
            }),
            (e.gradientDescent = function (e, t, n) {
              for (
                var o = (n = n || {}).maxIterations || 100 * t.length, a = n.learnRate || 0.001, s = { x: t.slice(), fx: 0, fxprime: t.slice() }, l = 0;
                l < o &&
                ((s.fx = e(s.x, s.fxprime)),
                n.history && n.history.push({ x: s.x.slice(), fx: s.fx, fxprime: s.fxprime.slice() }),
                i(s.x, 1, s.x, -a, s.fxprime),
                !(1e-5 >= r(s.fxprime)));
                ++l
              );
              return s;
            }),
            (e.gradientDescentLineSearch = function (e, t, n) {
              n = n || {};
              var i,
                s = { x: t.slice(), fx: 0, fxprime: t.slice() },
                l = { x: t.slice(), fx: 0, fxprime: t.slice() },
                u = n.maxIterations || 100 * t.length,
                c = n.learnRate || 1,
                d = t.slice(),
                f = n.c1 || 0.001,
                h = n.c2 || 0.1,
                p = [];
              if (n.history) {
                var _ = e;
                e = function (e, t) {
                  return p.push(e.slice()), _(e, t);
                };
              }
              s.fx = e(s.x, s.fxprime);
              for (
                var g = 0;
                g < u &&
                (o(d, s.fxprime, -1),
                (c = a(e, d, s, l, c, f, h)),
                n.history && (n.history.push({ x: s.x.slice(), fx: s.fx, fxprime: s.fxprime.slice(), functionCalls: p, learnRate: c, alpha: c }), (p = [])),
                (i = s),
                (s = l),
                (l = i),
                !(0 === c || 1e-5 > r(s.fxprime)));
                ++g
              );
              return s;
            }),
            (e.zeros = t),
            (e.zerosM = function (e, n) {
              return t(e).map(function () {
                return t(n);
              });
            }),
            (e.norm2 = r),
            (e.weightedSum = i),
            (e.scale = o);
        })(t);
      },
      79553: function (e, t, n) {
        "use strict";
        function r(e) {
          return (r =
            "function" == typeof Symbol && "symbol" == typeof Symbol.iterator
              ? function (e) {
                  return typeof e;
                }
              : function (e) {
                  return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
                })(e);
        }
        function o(e, t) {
          return (o = Object.setPrototypeOf
            ? Object.setPrototypeOf.bind()
            : function (e, t) {
                return (e.__proto__ = t), e;
              })(e, t);
        }
        function i(e) {
          if (void 0 === e) throw ReferenceError("this hasn't been initialised - super() hasn't been called");
          return e;
        }
        function a(e) {
          return (a = Object.setPrototypeOf
            ? Object.getPrototypeOf.bind()
            : function (e) {
                return e.__proto__ || Object.getPrototypeOf(e);
              })(e);
        }
        var s = n(2784),
          l = n(28316),
          u = n(13980),
          c = n(60156).createFocusTrap,
          d = n(65712).isFocusable,
          f = (function (e) {
            !(function (e, t) {
              if ("function" != typeof t && null !== t) throw TypeError("Super expression must either be null or a function");
              (e.prototype = Object.create(t && t.prototype, { constructor: { value: e, writable: !0, configurable: !0 } })),
                Object.defineProperty(e, "prototype", { writable: !1 }),
                t && o(e, t);
            })(c, e);
            var t,
              n,
              u =
                ((t = (function () {
                  if ("undefined" == typeof Reflect || !Reflect.construct || Reflect.construct.sham) return !1;
                  if ("function" == typeof Proxy) return !0;
                  try {
                    return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})), !0;
                  } catch (e) {
                    return !1;
                  }
                })()),
                function () {
                  var e,
                    n = a(c);
                  return (
                    (e = t ? Reflect.construct(n, arguments, a(this).constructor) : n.apply(this, arguments)),
                    (function (e, t) {
                      if (t && ("object" === r(t) || "function" == typeof t)) return t;
                      if (void 0 !== t) throw TypeError("Derived constructors may only return object or undefined");
                      return i(e);
                    })(this, e)
                  );
                });
            function c(e) {
              (function (e, t) {
                if (!(e instanceof t)) throw TypeError("Cannot call a class as a function");
              })(this, c),
                (t = i((o = u.call(this, e)))),
                (n = "getNodeForOption"),
                (r = function (e) {
                  var t,
                    n,
                    r = null !== (t = this.internalOptions[e]) && void 0 !== t ? t : this.originalOptions[e];
                  if ("function" == typeof r) {
                    for (var o = arguments.length, i = Array(o > 1 ? o - 1 : 0), a = 1; a < o; a++) i[a - 1] = arguments[a];
                    r = r.apply(void 0, i);
                  }
                  if ((!0 === r && (r = void 0), !r)) {
                    if (void 0 === r || !1 === r) return r;
                    throw Error("`".concat(e, "` was specified but was not a node, or did not return a node"));
                  }
                  var s = r;
                  if ("string" == typeof r && !(s = null === (n = this.getDocument()) || void 0 === n ? void 0 : n.querySelector(r)))
                    throw Error("`".concat(e, "` as selector refers to no known node"));
                  return s;
                }),
                n in t ? Object.defineProperty(t, n, { value: r, enumerable: !0, configurable: !0, writable: !0 }) : (t[n] = r),
                (o.handleDeactivate = o.handleDeactivate.bind(i(o))),
                (o.handlePostDeactivate = o.handlePostDeactivate.bind(i(o))),
                (o.handleClickOutsideDeactivates = o.handleClickOutsideDeactivates.bind(i(o))),
                (o.internalOptions = {
                  returnFocusOnDeactivate: !1,
                  checkCanReturnFocus: null,
                  onDeactivate: o.handleDeactivate,
                  onPostDeactivate: o.handlePostDeactivate,
                  clickOutsideDeactivates: o.handleClickOutsideDeactivates
                }),
                (o.originalOptions = {
                  returnFocusOnDeactivate: !0,
                  onDeactivate: null,
                  onPostDeactivate: null,
                  checkCanReturnFocus: null,
                  clickOutsideDeactivates: !1
                });
              var t,
                n,
                r,
                o,
                a = e.focusTrapOptions;
              for (var s in a)
                if (Object.prototype.hasOwnProperty.call(a, s)) {
                  if (
                    "returnFocusOnDeactivate" === s ||
                    "onDeactivate" === s ||
                    "onPostDeactivate" === s ||
                    "checkCanReturnFocus" === s ||
                    "clickOutsideDeactivates" === s
                  ) {
                    o.originalOptions[s] = a[s];
                    continue;
                  }
                  o.internalOptions[s] = a[s];
                }
              return (o.outsideClick = null), (o.focusTrapElements = e.containerElements || []), o.updatePreviousElement(), o;
            }
            return (
              (n = [
                {
                  key: "getDocument",
                  value: function () {
                    return this.props.focusTrapOptions.document || ("undefined" != typeof document ? document : void 0);
                  }
                },
                {
                  key: "getReturnFocusNode",
                  value: function () {
                    var e = this.getNodeForOption("setReturnFocus", this.previouslyFocusedElement);
                    return e || (!1 !== e && this.previouslyFocusedElement);
                  }
                },
                {
                  key: "updatePreviousElement",
                  value: function () {
                    var e = this.getDocument();
                    e && (this.previouslyFocusedElement = e.activeElement);
                  }
                },
                {
                  key: "deactivateTrap",
                  value: function () {
                    this.focusTrap &&
                      this.focusTrap.active &&
                      this.focusTrap.deactivate({ returnFocus: !1, checkCanReturnFocus: null, onDeactivate: this.originalOptions.onDeactivate });
                  }
                },
                {
                  key: "handleClickOutsideDeactivates",
                  value: function (e) {
                    var t =
                      "function" == typeof this.originalOptions.clickOutsideDeactivates
                        ? this.originalOptions.clickOutsideDeactivates.call(null, e)
                        : this.originalOptions.clickOutsideDeactivates;
                    return t && (this.outsideClick = { target: e.target, allowDeactivation: t }), t;
                  }
                },
                {
                  key: "handleDeactivate",
                  value: function () {
                    this.originalOptions.onDeactivate && this.originalOptions.onDeactivate.call(null), this.deactivateTrap();
                  }
                },
                {
                  key: "handlePostDeactivate",
                  value: function () {
                    var e = this,
                      t = function () {
                        var t = e.getReturnFocusNode(),
                          n = !!(
                            e.originalOptions.returnFocusOnDeactivate &&
                            null != t &&
                            t.focus &&
                            (!e.outsideClick || (e.outsideClick.allowDeactivation && !d(e.outsideClick.target, e.internalOptions.tabbableOptions)))
                          ),
                          r = e.internalOptions.preventScroll;
                        n && t.focus({ preventScroll: void 0 !== r && r }),
                          e.originalOptions.onPostDeactivate && e.originalOptions.onPostDeactivate.call(null),
                          (e.outsideClick = null);
                      };
                    this.originalOptions.checkCanReturnFocus ? this.originalOptions.checkCanReturnFocus.call(null, this.getReturnFocusNode()).then(t, t) : t();
                  }
                },
                {
                  key: "setupFocusTrap",
                  value: function () {
                    if (!this.focusTrap) {
                      var e = this.focusTrapElements.map(l.findDOMNode);
                      e.some(Boolean) &&
                        ((this.focusTrap = this.props._createFocusTrap(e, this.internalOptions)),
                        this.props.active && this.focusTrap.activate(),
                        this.props.paused && this.focusTrap.pause());
                    }
                  }
                },
                {
                  key: "componentDidMount",
                  value: function () {
                    this.props.active && this.setupFocusTrap();
                  }
                },
                {
                  key: "componentDidUpdate",
                  value: function (e) {
                    if (this.focusTrap) {
                      e.containerElements !== this.props.containerElements && this.focusTrap.updateContainerElements(this.props.containerElements);
                      var t = !e.active && this.props.active,
                        n = e.active && !this.props.active,
                        r = !e.paused && this.props.paused,
                        o = e.paused && !this.props.paused;
                      if ((t && (this.updatePreviousElement(), this.focusTrap.activate()), n)) {
                        this.deactivateTrap();
                        return;
                      }
                      r && this.focusTrap.pause(), o && this.focusTrap.unpause();
                    } else
                      e.containerElements !== this.props.containerElements && (this.focusTrapElements = this.props.containerElements),
                        this.props.active && (this.updatePreviousElement(), this.setupFocusTrap());
                  }
                },
                {
                  key: "componentWillUnmount",
                  value: function () {
                    this.deactivateTrap();
                  }
                },
                {
                  key: "render",
                  value: function () {
                    var e = this,
                      t = this.props.children ? s.Children.only(this.props.children) : void 0;
                    if (t) {
                      if (t.type && t.type === s.Fragment)
                        throw Error("A focus-trap cannot use a Fragment as its child container. Try replacing it with a <div> element.");
                      return s.cloneElement(t, {
                        ref: function (n) {
                          var r = e.props.containerElements;
                          t && ("function" == typeof t.ref ? t.ref(n) : t.ref && (t.ref.current = n)), (e.focusTrapElements = r || [n]);
                        }
                      });
                    }
                    return null;
                  }
                }
              ]),
              (function (e, t) {
                for (var n = 0; n < t.length; n++) {
                  var r = t[n];
                  (r.enumerable = r.enumerable || !1), (r.configurable = !0), "value" in r && (r.writable = !0), Object.defineProperty(e, r.key, r);
                }
              })(c.prototype, n),
              Object.defineProperty(c, "prototype", { writable: !1 }),
              c
            );
          })(s.Component),
          h = "undefined" == typeof Element ? Function : Element;
        (f.propTypes = {
          active: u.bool,
          paused: u.bool,
          focusTrapOptions: u.shape({
            document: u.object,
            onActivate: u.func,
            onPostActivate: u.func,
            checkCanFocusTrap: u.func,
            onDeactivate: u.func,
            onPostDeactivate: u.func,
            checkCanReturnFocus: u.func,
            initialFocus: u.oneOfType([u.instanceOf(h), u.string, u.bool, u.func]),
            fallbackFocus: u.oneOfType([u.instanceOf(h), u.string, u.func]),
            escapeDeactivates: u.oneOfType([u.bool, u.func]),
            clickOutsideDeactivates: u.oneOfType([u.bool, u.func]),
            returnFocusOnDeactivate: u.bool,
            setReturnFocus: u.oneOfType([u.instanceOf(h), u.string, u.bool, u.func]),
            allowOutsideClick: u.oneOfType([u.bool, u.func]),
            preventScroll: u.bool,
            tabbableOptions: u.shape({ displayCheck: u.oneOf(["full", "non-zero-area", "none"]), getShadowRoot: u.oneOfType([u.bool, u.func]) })
          }),
          containerElements: u.arrayOf(u.instanceOf(h)),
          children: u.oneOfType([u.element, u.instanceOf(h)])
        }),
          (f.defaultProps = { active: !0, paused: !1, focusTrapOptions: {}, _createFocusTrap: c }),
          (e.exports = f);
      },
      60156: function (e, t, n) {
        "use strict";
        n.r(t), n.d(t, { createFocusTrap: () => f });
        var r,
          o = n(65712);
        function i(e, t) {
          var n = Object.keys(e);
          if (Object.getOwnPropertySymbols) {
            var r = Object.getOwnPropertySymbols(e);
            t &&
              (r = r.filter(function (t) {
                return Object.getOwnPropertyDescriptor(e, t).enumerable;
              })),
              n.push.apply(n, r);
          }
          return n;
        }
        function a(e) {
          for (var t = 1; t < arguments.length; t++) {
            var n = null != arguments[t] ? arguments[t] : {};
            t % 2
              ? i(Object(n), !0).forEach(function (t) {
                  var r, o, i;
                  (r = e), (o = t), (i = n[t]), o in r ? Object.defineProperty(r, o, { value: i, enumerable: !0, configurable: !0, writable: !0 }) : (r[o] = i);
                })
              : Object.getOwnPropertyDescriptors
                ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n))
                : i(Object(n)).forEach(function (t) {
                    Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
                  });
          }
          return e;
        }
        var s =
            ((r = []),
            {
              activateTrap: function (e) {
                if (r.length > 0) {
                  var t = r[r.length - 1];
                  t !== e && t.pause();
                }
                var n = r.indexOf(e);
                -1 === n || r.splice(n, 1), r.push(e);
              },
              deactivateTrap: function (e) {
                var t = r.indexOf(e);
                -1 !== t && r.splice(t, 1), r.length > 0 && r[r.length - 1].unpause();
              }
            }),
          l = function (e) {
            return setTimeout(e, 0);
          },
          u = function (e, t) {
            var n = -1;
            return (
              e.every(function (e, r) {
                return !t(e) || ((n = r), !1);
              }),
              n
            );
          },
          c = function (e) {
            for (var t = arguments.length, n = Array(t > 1 ? t - 1 : 0), r = 1; r < t; r++) n[r - 1] = arguments[r];
            return "function" == typeof e ? e.apply(void 0, n) : e;
          },
          d = function (e) {
            return e.target.shadowRoot && "function" == typeof e.composedPath ? e.composedPath()[0] : e.target;
          },
          f = function (e, t) {
            var n,
              r = (null == t ? void 0 : t.document) || document,
              i = a({ returnFocusOnDeactivate: !0, escapeDeactivates: !0, delayInitialFocus: !0 }, t),
              f = {
                containers: [],
                containerGroups: [],
                tabbableGroups: [],
                nodeFocusedBeforeActivation: null,
                mostRecentlyFocusedNode: null,
                active: !1,
                paused: !1,
                delayInitialFocusTimer: void 0
              },
              h = function (e, t, n) {
                return e && void 0 !== e[t] ? e[t] : i[n || t];
              },
              p = function (e) {
                return f.containerGroups.findIndex(function (t) {
                  var n = t.container,
                    r = t.tabbableNodes;
                  return (
                    n.contains(e) ||
                    r.find(function (t) {
                      return t === e;
                    })
                  );
                });
              },
              _ = function (e) {
                var t = i[e];
                if ("function" == typeof t) {
                  for (var n = arguments.length, o = Array(n > 1 ? n - 1 : 0), a = 1; a < n; a++) o[a - 1] = arguments[a];
                  t = t.apply(void 0, o);
                }
                if ((!0 === t && (t = void 0), !t)) {
                  if (void 0 === t || !1 === t) return t;
                  throw Error("`".concat(e, "` was specified but was not a node, or did not return a node"));
                }
                var s = t;
                if ("string" == typeof t && !(s = r.querySelector(t))) throw Error("`".concat(e, "` as selector refers to no known node"));
                return s;
              },
              g = function () {
                var e = _("initialFocus");
                if (!1 === e) return !1;
                if (void 0 === e) {
                  if (p(r.activeElement) >= 0) e = r.activeElement;
                  else {
                    var t = f.tabbableGroups[0];
                    e = (t && t.firstTabbableNode) || _("fallbackFocus");
                  }
                }
                if (!e) throw Error("Your focus-trap needs to have at least one focusable element");
                return e;
              },
              m = function () {
                if (
                  ((f.containerGroups = f.containers.map(function (e) {
                    var t = (0, o.tabbable)(e, i.tabbableOptions),
                      n = (0, o.focusable)(e, i.tabbableOptions);
                    return {
                      container: e,
                      tabbableNodes: t,
                      focusableNodes: n,
                      firstTabbableNode: t.length > 0 ? t[0] : null,
                      lastTabbableNode: t.length > 0 ? t[t.length - 1] : null,
                      nextTabbableNode: function (e) {
                        var t = !(arguments.length > 1) || void 0 === arguments[1] || arguments[1],
                          r = n.findIndex(function (t) {
                            return t === e;
                          });
                        return r < 0
                          ? void 0
                          : t
                            ? n.slice(r + 1).find(function (e) {
                                return (0, o.isTabbable)(e, i.tabbableOptions);
                              })
                            : n
                                .slice(0, r)
                                .reverse()
                                .find(function (e) {
                                  return (0, o.isTabbable)(e, i.tabbableOptions);
                                });
                      }
                    };
                  })),
                  (f.tabbableGroups = f.containerGroups.filter(function (e) {
                    return e.tabbableNodes.length > 0;
                  })),
                  f.tabbableGroups.length <= 0 && !_("fallbackFocus"))
                )
                  throw Error("Your focus-trap must have at least one container with at least one tabbable node in it at all times");
              },
              v = function e(t) {
                if (!1 !== t && t !== r.activeElement) {
                  if (!t || !t.focus) {
                    e(g());
                    return;
                  }
                  t.focus({ preventScroll: !!i.preventScroll }),
                    (f.mostRecentlyFocusedNode = t),
                    t.tagName && "input" === t.tagName.toLowerCase() && "function" == typeof t.select && t.select();
                }
              },
              y = function (e) {
                var t = _("setReturnFocus", e);
                return t || (!1 !== t && e);
              },
              b = function (e) {
                var t = d(e);
                if (!(p(t) >= 0)) {
                  if (c(i.clickOutsideDeactivates, e)) {
                    n.deactivate({ returnFocus: i.returnFocusOnDeactivate && !(0, o.isFocusable)(t, i.tabbableOptions) });
                    return;
                  }
                  !c(i.allowOutsideClick, e) && e.preventDefault();
                }
              },
              x = function (e) {
                var t = d(e),
                  n = p(t) >= 0;
                n || t instanceof Document ? n && (f.mostRecentlyFocusedNode = t) : (e.stopImmediatePropagation(), v(f.mostRecentlyFocusedNode || g()));
              },
              w = function (e) {
                var t = d(e);
                m();
                var n = null;
                if (f.tabbableGroups.length > 0) {
                  var r = p(t),
                    a = r >= 0 ? f.containerGroups[r] : void 0;
                  if (r < 0) n = e.shiftKey ? f.tabbableGroups[f.tabbableGroups.length - 1].lastTabbableNode : f.tabbableGroups[0].firstTabbableNode;
                  else if (e.shiftKey) {
                    var s = u(f.tabbableGroups, function (e) {
                      return t === e.firstTabbableNode;
                    });
                    if (
                      (s < 0 &&
                        (a.container === t ||
                          ((0, o.isFocusable)(t, i.tabbableOptions) && !(0, o.isTabbable)(t, i.tabbableOptions) && !a.nextTabbableNode(t, !1))) &&
                        (s = r),
                      s >= 0)
                    ) {
                      var l = 0 === s ? f.tabbableGroups.length - 1 : s - 1;
                      n = f.tabbableGroups[l].lastTabbableNode;
                    }
                  } else {
                    var c = u(f.tabbableGroups, function (e) {
                      return t === e.lastTabbableNode;
                    });
                    if (
                      (c < 0 &&
                        (a.container === t ||
                          ((0, o.isFocusable)(t, i.tabbableOptions) && !(0, o.isTabbable)(t, i.tabbableOptions) && !a.nextTabbableNode(t))) &&
                        (c = r),
                      c >= 0)
                    ) {
                      var h = c === f.tabbableGroups.length - 1 ? 0 : c + 1;
                      n = f.tabbableGroups[h].firstTabbableNode;
                    }
                  }
                } else n = _("fallbackFocus");
                n && (e.preventDefault(), v(n));
              },
              k = function (e) {
                if (("Escape" === e.key || "Esc" === e.key || 27 === e.keyCode) && !1 !== c(i.escapeDeactivates, e)) {
                  e.preventDefault(), n.deactivate();
                  return;
                }
                if ("Tab" === e.key || 9 === e.keyCode) {
                  w(e);
                  return;
                }
              },
              M = function (e) {
                !(p(d(e)) >= 0 || c(i.clickOutsideDeactivates, e) || c(i.allowOutsideClick, e)) && (e.preventDefault(), e.stopImmediatePropagation());
              },
              j = function () {
                if (f.active)
                  return (
                    s.activateTrap(n),
                    (f.delayInitialFocusTimer = i.delayInitialFocus
                      ? l(function () {
                          v(g());
                        })
                      : v(g())),
                    r.addEventListener("focusin", x, !0),
                    r.addEventListener("mousedown", b, { capture: !0, passive: !1 }),
                    r.addEventListener("touchstart", b, { capture: !0, passive: !1 }),
                    r.addEventListener("click", M, { capture: !0, passive: !1 }),
                    r.addEventListener("keydown", k, { capture: !0, passive: !1 }),
                    n
                  );
              },
              E = function () {
                if (f.active)
                  return (
                    r.removeEventListener("focusin", x, !0),
                    r.removeEventListener("mousedown", b, !0),
                    r.removeEventListener("touchstart", b, !0),
                    r.removeEventListener("click", M, !0),
                    r.removeEventListener("keydown", k, !0),
                    n
                  );
              };
            return (
              (n = {
                get active() {
                  return f.active;
                },
                get paused() {
                  return f.paused;
                },
                activate: function (e) {
                  if (f.active) return this;
                  var t = h(e, "onActivate"),
                    n = h(e, "onPostActivate"),
                    o = h(e, "checkCanFocusTrap");
                  o || m(), (f.active = !0), (f.paused = !1), (f.nodeFocusedBeforeActivation = r.activeElement), t && t();
                  var i = function () {
                    o && m(), j(), n && n();
                  };
                  return o ? o(f.containers.concat()).then(i, i) : i(), this;
                },
                deactivate: function (e) {
                  if (!f.active) return this;
                  var t = a({ onDeactivate: i.onDeactivate, onPostDeactivate: i.onPostDeactivate, checkCanReturnFocus: i.checkCanReturnFocus }, e);
                  clearTimeout(f.delayInitialFocusTimer), (f.delayInitialFocusTimer = void 0), E(), (f.active = !1), (f.paused = !1), s.deactivateTrap(n);
                  var r = h(t, "onDeactivate"),
                    o = h(t, "onPostDeactivate"),
                    u = h(t, "checkCanReturnFocus"),
                    c = h(t, "returnFocus", "returnFocusOnDeactivate");
                  r && r();
                  var d = function () {
                    l(function () {
                      c && v(y(f.nodeFocusedBeforeActivation)), o && o();
                    });
                  };
                  return c && u ? u(y(f.nodeFocusedBeforeActivation)).then(d, d) : d(), this;
                },
                pause: function () {
                  return f.paused || !f.active || ((f.paused = !0), E()), this;
                },
                unpause: function () {
                  return f.paused && f.active && ((f.paused = !1), m(), j()), this;
                },
                updateContainerElements: function (e) {
                  var t = [].concat(e).filter(Boolean);
                  return (
                    (f.containers = t.map(function (e) {
                      return "string" == typeof e ? r.querySelector(e) : e;
                    })),
                    f.active && m(),
                    this
                  );
                }
              }).updateContainerElements(e),
              n
            );
          };
      },
      25779: function (e) {
        var t;
        (t = function () {
          "use strict";
          function e(e, t) {
            var n, r, o;
            for (n = 1, r = arguments.length; n < r; ++n) if (((t = arguments[n]), null != t)) for (o in t) i(t, o) && (e[o] = t[o]);
            return e;
          }
          function t(e, t) {
            return t.length - e.length;
          }
          function n(e, t) {
            return e.factor - t.factor;
          }
          function r(e, t) {
            var n;
            for (n in e) i(e, n) && t(e[n], n);
          }
          var o,
            i =
              ((o = Object.prototype.hasOwnProperty),
              function (e, t) {
                return null != e && o.call(e, t);
              });
          function a(e, t) {
            for (; "string" == typeof t; ) t = e[t];
            return t;
          }
          function s(e) {
            this._prefixes = e;
            var o = [],
              a = [];
            r(e, function (e, t) {
              o.push(t.replace(/([.*+?=^!:${}()|[\]/\\])/g, "\\$1")), a.push({ factor: e, prefix: t });
            });
            var s = (this._lcPrefixes = {});
            r(e, function (t, n) {
              var r = n.toLowerCase();
              i(e, r) || (s[r] = n);
            }),
              a.sort(n),
              (this._list = a),
              o.sort(t),
              (this._regexp = RegExp("^\\s*(-)?\\s*(\\d+(?:\\.\\d+)?)\\s*(" + o.join("|") + ")\\s*(.*)\\s*?$", "i"));
          }
          (s.create = function (e, t, n) {
            var r = {};
            return (
              void 0 === n && (n = 0),
              (function (e, t) {
                var n, r;
                for (n = 0, r = e.length; n < r; ++n) t(e[n], n);
              })(e, function (e, o) {
                r[e] = Math.pow(t, o + n);
              }),
              new s(r)
            );
          }),
            (s.prototype.findPrefix = function (e) {
              for (var t, n = this._list, r = 0, o = n.length - 1; r !== o; ) n[(t = (r + o + 1) >> 1)].factor > e ? (o = t - 1) : (r = t);
              return n[r];
            }),
            (s.prototype.parse = function (e, t) {
              var n,
                r = e.match(this._regexp);
              if (null !== r) {
                var o = r[3];
                if (i(this._prefixes, o)) n = this._prefixes[o];
                else {
                  if (!(!t && ((o = o.toLowerCase()), i(this._lcPrefixes, o)))) return;
                  (o = this._lcPrefixes[o]), (n = this._prefixes[o]);
                }
                var a = +r[2];
                return void 0 !== r[1] && (a = -a), { factor: n, prefix: o, unit: r[4], value: a };
              }
            });
          var l = { binary: s.create(",Ki,Mi,Gi,Ti,Pi,Ei,Zi,Yi".split(","), 1024), SI: s.create("y,z,a,f,p,n,\xb5,m,,k,M,G,T,P,E,Z,Y".split(","), 1e3, -8) },
            u = { maxDecimals: 2, separator: " ", unit: "" },
            c = { scale: "SI", strict: !1 };
          function d(t, n) {
            var r = (n = e({}, u, n)).decimals;
            void 0 !== r && delete n.maxDecimals;
            var o = _(t, n);
            t = void 0 !== r ? o.value.toFixed(r) : String(o.value);
            var i = o.prefix + n.unit;
            return "" === i ? t : t + n.separator + i;
          }
          var f = { scale: "binary", unit: "B" };
          function h(e, t) {
            var n = p(e, t);
            return n.value * n.factor;
          }
          function p(t, n) {
            if ("string" != typeof t) throw TypeError("str must be a string");
            var r = a(l, (n = e({}, c, n)).scale);
            if (void 0 === r) throw Error("missing scale");
            var o = r.parse(t, n.strict);
            if (void 0 === o) throw Error("cannot parse str");
            return o;
          }
          function _(t, n) {
            if (0 === t) return { value: 0, prefix: "" };
            if (t < 0) {
              var r,
                o,
                s = _(-t, n);
              return (s.value = -s.value), s;
            }
            if ("number" != typeof t || Number.isNaN(t)) throw TypeError("value must be a number");
            var u = a(l, (n = e({}, c, n)).scale);
            if (void 0 === u) throw Error("missing scale");
            var d = n.maxDecimals,
              f = "auto" === d;
            f ? (r = 10) : void 0 !== d && (r = Math.pow(10, d));
            var h = n.prefix;
            if (void 0 !== h) {
              if (!i(u._prefixes, h)) throw Error("invalid prefix");
              o = u._prefixes[h];
            } else {
              var p = u.findPrefix(t);
              if (void 0 !== r)
                do {
                  var g = (o = p.factor) / r;
                  t = Math.round(t / g) * g;
                } while ((p = u.findPrefix(t)).factor !== o);
              else o = p.factor;
              h = p.prefix;
            }
            return (t = void 0 === r ? t / o : Math.round((t * r) / o) / r), f && Math.abs(t) >= 10 && (t = Math.round(t)), { prefix: h, value: t };
          }
          return (
            (d.bytes = function (t, n) {
              return d(t, void 0 === n ? f : e({}, f, n));
            }),
            (d.parse = h),
            (h.raw = p),
            (d.raw = _),
            (d.Scale = s),
            d
          );
        }),
          "function" == typeof define && define.amd ? define([], t) : (e.exports = t());
      },
      99450: function (e) {
        var t;
        (t = function () {
          "use strict";
          var e = Math.sqrt(1.05 * 0.05) - 0.05,
            t = /^(?:[0-9a-f]{3}){1,2}$/i,
            n = { black: "#000000", white: "#ffffff", threshold: e };
          function r(e) {
            if (("#" === e.slice(0, 1) && (e = e.slice(1)), !t.test(e))) throw Error('Invalid HEX color: "' + e + '"');
            return (
              3 === e.length && (e = e[0] + e[0] + e[1] + e[1] + e[2] + e[2]),
              [parseInt(e.slice(0, 2), 16), parseInt(e.slice(2, 4), 16), parseInt(e.slice(4, 6), 16)]
            );
          }
          function o(e) {
            if (!e) throw Error("Invalid color value");
            return Array.isArray(e) ? e : "string" == typeof e ? r(e) : [e.r, e.g, e.b];
          }
          function i(e, t, o) {
            var i = !0 === t ? n : Object.assign({}, n, t);
            return (function (e) {
              var t,
                n,
                r = [];
              for (t = 0; t < e.length; t++) (n = e[t] / 255), (r[t] = n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4));
              return 0.2126 * r[0] + 0.7152 * r[1] + 0.0722 * r[2];
            })(e) > i.threshold
              ? o
                ? r(i.black)
                : i.black
              : o
                ? r(i.white)
                : i.white;
          }
          function a(e, t) {
            return (
              void 0 === t && (t = !1),
              (e = o(e)),
              t
                ? i(e, t)
                : "#" +
                  e
                    .map(function (e) {
                      var t, n;
                      return (t = (255 - e).toString(16)), void 0 === n && (n = 2), (Array(n).join("0") + t).slice(-n);
                    })
                    .join("")
            );
          }
          return (
            (function (t) {
              function n(e, t) {
                e = o(e);
                var n = t
                  ? i(e, t, !0)
                  : e.map(function (e) {
                      return 255 - e;
                    });
                return { r: n[0], g: n[1], b: n[2] };
              }
              (t.asRGB = n),
                (t.asRgbArray = function (e, t) {
                  return (
                    (e = o(e)),
                    t
                      ? i(e, t, !0)
                      : e.map(function (e) {
                          return 255 - e;
                        })
                  );
                }),
                (t.defaultThreshold = e),
                (t.asRgbObject = n);
            })(a || (a = {})),
            a
          );
        }),
          (e.exports = t());
      },
      14969: function (e, t, n) {
        e.exports = n(26531);
      },
      26531: function (e, t, n) {
        var r = n(5817);
        e.exports = r(function (e, t) {
          var n = Array.prototype.slice.call(arguments, 2);
          return Function.prototype.bind.apply(e, [t].concat(n));
        });
      },
      5817: function (e, t, n) {
        e.exports = n(68186);
      },
      68186: function (e) {
        function t(e) {
          return ("object" != typeof e && "function" != typeof e) || null === e;
        }
        function n() {
          (this.childBranches = new WeakMap()), (this.primitiveKeys = new Map()), (this.hasValue = !1), (this.value = void 0);
        }
        (n.prototype.has = function (e) {
          var n = t(e) ? this.primitiveKeys.get(e) : e;
          return !!n && this.childBranches.has(n);
        }),
          (n.prototype.get = function (e) {
            var n = t(e) ? this.primitiveKeys.get(e) : e;
            return n ? this.childBranches.get(n) : void 0;
          }),
          (n.prototype.resolveBranch = function (e) {
            if (this.has(e)) return this.get(e);
            var t = new n(),
              r = this.createKey(e);
            return this.childBranches.set(r, t), t;
          }),
          (n.prototype.setValue = function (e) {
            return (this.hasValue = !0), (this.value = e);
          }),
          (n.prototype.createKey = function (e) {
            if (t(e)) {
              var n = {};
              return this.primitiveKeys.set(e, n), n;
            }
            return e;
          }),
          (n.prototype.clear = function () {
            if (0 == arguments.length) (this.childBranches = new WeakMap()), this.primitiveKeys.clear(), (this.hasValue = !1), (this.value = void 0);
            else if (1 == arguments.length) {
              var e = arguments[0];
              if (t(e)) {
                var n = this.primitiveKeys.get(e);
                n && (this.childBranches.delete(n), this.primitiveKeys.delete(e));
              } else this.childBranches.delete(e);
            } else {
              var r = arguments[0];
              if (this.has(r)) {
                var o = this.get(r);
                o.clear.apply(o, Array.prototype.slice.call(arguments, 1));
              }
            }
          }),
          (e.exports = function (e) {
            var t = new n();
            function r() {
              var n = Array.prototype.slice.call(arguments),
                r = n.reduce(function (e, t) {
                  return e.resolveBranch(t);
                }, t);
              if (r.hasValue) return r.value;
              var o = e.apply(null, n);
              return r.setValue(o);
            }
            return (r.clear = t.clear.bind(t)), r;
          });
      },
      27495: function (e) {
        !(function (t, n, r) {
          if (t) {
            for (
              var o,
                i = {
                  8: "backspace",
                  9: "tab",
                  13: "enter",
                  16: "shift",
                  17: "ctrl",
                  18: "alt",
                  20: "capslock",
                  27: "esc",
                  32: "space",
                  33: "pageup",
                  34: "pagedown",
                  35: "end",
                  36: "home",
                  37: "left",
                  38: "up",
                  39: "right",
                  40: "down",
                  45: "ins",
                  46: "del",
                  91: "meta",
                  93: "meta",
                  224: "meta"
                },
                a = {
                  106: "*",
                  107: "+",
                  109: "-",
                  110: ".",
                  111: "/",
                  186: ";",
                  187: "=",
                  188: ",",
                  189: "-",
                  190: ".",
                  191: "/",
                  192: "`",
                  219: "[",
                  220: "\\",
                  221: "]",
                  222: "'"
                },
                s = {
                  "~": "`",
                  "!": "1",
                  "@": "2",
                  "#": "3",
                  $: "4",
                  "%": "5",
                  "^": "6",
                  "&": "7",
                  "*": "8",
                  "(": "9",
                  ")": "0",
                  _: "-",
                  "+": "=",
                  ":": ";",
                  '"': "'",
                  "<": ",",
                  ">": ".",
                  "?": "/",
                  "|": "\\"
                },
                l = {
                  option: "alt",
                  command: "meta",
                  return: "enter",
                  escape: "esc",
                  plus: "+",
                  mod: /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? "meta" : "ctrl"
                },
                u = 1;
              u < 20;
              ++u
            )
              i[111 + u] = "f" + u;
            for (u = 0; u <= 9; ++u) i[u + 96] = u.toString();
            (p.prototype.bind = function (e, t, n) {
              return (e = e instanceof Array ? e : [e]), this._bindMultiple.call(this, e, t, n), this;
            }),
              (p.prototype.unbind = function (e, t) {
                return this.bind.call(this, e, function () {}, t);
              }),
              (p.prototype.trigger = function (e, t) {
                return this._directMap[e + ":" + t] && this._directMap[e + ":" + t]({}, e), this;
              }),
              (p.prototype.reset = function () {
                return (this._callbacks = {}), (this._directMap = {}), this;
              }),
              (p.prototype.stopCallback = function (e, t) {
                if (
                  (" " + t.className + " ").indexOf(" mousetrap ") > -1 ||
                  (function e(t, r) {
                    return null !== t && t !== n && (t === r || e(t.parentNode, r));
                  })(t, this.target)
                )
                  return !1;
                if ("composedPath" in e && "function" == typeof e.composedPath) {
                  var r = e.composedPath()[0];
                  r !== e.target && (t = r);
                }
                return "INPUT" == t.tagName || "SELECT" == t.tagName || "TEXTAREA" == t.tagName || t.isContentEditable;
              }),
              (p.prototype.handleKey = function () {
                return this._handleKey.apply(this, arguments);
              }),
              (p.addKeycodes = function (e) {
                for (var t in e) e.hasOwnProperty(t) && (i[t] = e[t]);
                o = null;
              }),
              (p.init = function () {
                var e = p(n);
                for (var t in e)
                  "_" !== t.charAt(0) &&
                    (p[t] = (function (t) {
                      return function () {
                        return e[t].apply(e, arguments);
                      };
                    })(t));
              }),
              p.init(),
              (t.Mousetrap = p),
              e.exports && (e.exports = p),
              "function" == typeof define &&
                define.amd &&
                define(function () {
                  return p;
                });
          }
          function c(e, t, n) {
            if (e.addEventListener) {
              e.addEventListener(t, n, !1);
              return;
            }
            e.attachEvent("on" + t, n);
          }
          function d(e) {
            if ("keypress" == e.type) {
              var t = String.fromCharCode(e.which);
              return e.shiftKey || (t = t.toLowerCase()), t;
            }
            return i[e.which] ? i[e.which] : a[e.which] ? a[e.which] : String.fromCharCode(e.which).toLowerCase();
          }
          function f(e) {
            return "shift" == e || "ctrl" == e || "alt" == e || "meta" == e;
          }
          function h(e, t) {
            var n,
              r,
              a,
              u,
              c,
              d,
              h = [];
            for (d = 0, u = "+" === (n = e) ? ["+"] : (n = n.replace(/\+{2}/g, "+plus")).split("+"); d < u.length; ++d)
              l[(c = u[d])] && (c = l[c]), t && "keypress" != t && s[c] && ((c = s[c]), h.push("shift")), f(c) && h.push(c);
            return (
              (r = c),
              (a = t) ||
                (a = (function () {
                  if (!o) for (var e in ((o = {}), i)) (!(e > 95) || !(e < 112)) && i.hasOwnProperty(e) && (o[i[e]] = e);
                  return o;
                })()[r]
                  ? "keydown"
                  : "keypress"),
              "keypress" == a && h.length && (a = "keydown"),
              { key: c, modifiers: h, action: (t = a) }
            );
          }
          function p(e) {
            var t,
              r = this;
            if (((e = e || n), !(r instanceof p))) return new p(e);
            (r.target = e), (r._callbacks = {}), (r._directMap = {});
            var o = {},
              i = !1,
              a = !1,
              s = !1;
            function l(e) {
              e = e || {};
              var t,
                n = !1;
              for (t in o) {
                if (e[t]) {
                  n = !0;
                  continue;
                }
                o[t] = 0;
              }
              n || (s = !1);
            }
            function u(e, t, n, i, a, s) {
              var l,
                u,
                c = [],
                d = n.type;
              if (!r._callbacks[e]) return [];
              for ("keyup" == d && f(e) && (t = [e]), l = 0; l < r._callbacks[e].length; ++l)
                if (
                  ((u = r._callbacks[e][l]),
                  (i || !u.seq || o[u.seq] == u.level) &&
                    d == u.action &&
                    (("keypress" == d && !n.metaKey && !n.ctrlKey) || ((h = t), (p = u.modifiers), h.sort().join(",") === p.sort().join(","))))
                ) {
                  var h,
                    p,
                    _ = !i && u.combo == a,
                    g = i && u.seq == i && u.level == s;
                  (_ || g) && r._callbacks[e].splice(l, 1), c.push(u);
                }
              return c;
            }
            function _(e, t, n, o) {
              !r.stopCallback(t, t.target || t.srcElement, n, o) &&
                !1 === e(t, n) &&
                ((function (e) {
                  if (e.preventDefault) {
                    e.preventDefault();
                    return;
                  }
                  e.returnValue = !1;
                })(t),
                (function (e) {
                  if (e.stopPropagation) {
                    e.stopPropagation();
                    return;
                  }
                  e.cancelBubble = !0;
                })(t));
            }
            function g(e) {
              "number" != typeof e.which && (e.which = e.keyCode);
              var t,
                n = d(e);
              if (n) {
                if ("keyup" == e.type && i === n) {
                  i = !1;
                  return;
                }
                r.handleKey(
                  n,
                  ((t = []), e.shiftKey && t.push("shift"), e.altKey && t.push("alt"), e.ctrlKey && t.push("ctrl"), e.metaKey && t.push("meta"), t),
                  e
                );
              }
            }
            r._handleKey = function (e, t, n) {
              var r,
                o = u(e, t, n),
                i = {},
                c = 0,
                d = !1;
              for (r = 0; r < o.length; ++r) o[r].seq && (c = Math.max(c, o[r].level));
              for (r = 0; r < o.length; ++r) {
                if (o[r].seq) {
                  if (o[r].level != c) continue;
                  (d = !0), (i[o[r].seq] = 1), _(o[r].callback, n, o[r].combo, o[r].seq);
                  continue;
                }
                d || _(o[r].callback, n, o[r].combo);
              }
              var h = "keypress" == n.type && a;
              n.type != s || f(e) || h || l(i), (a = d && "keydown" == n.type);
            };
            (r._bindMultiple = function (e, n, a) {
              for (var c = 0; c < e.length; ++c)
                (function e(n, a, c, f, p) {
                  r._directMap[n + ":" + c] = a;
                  var g,
                    m = (n = n.replace(/\s+/g, " ")).split(" ");
                  if (m.length > 1) {
                    !(function (n, r, a, u) {
                      function c(e) {
                        _(a, e, n), "keyup" !== u && (i = d(e)), setTimeout(l, 10);
                      }
                      o[n] = 0;
                      for (var f = 0; f < r.length; ++f) {
                        var p =
                          f + 1 === r.length
                            ? c
                            : (function (e) {
                                return function () {
                                  (s = e), ++o[n], clearTimeout(t), (t = setTimeout(l, 1e3));
                                };
                              })(u || h(r[f + 1]).action);
                        e(r[f], p, u, n, f);
                      }
                    })(n, m, a, c);
                    return;
                  }
                  (g = h(n, c)),
                    (r._callbacks[g.key] = r._callbacks[g.key] || []),
                    u(g.key, g.modifiers, { type: g.action }, f, n, p),
                    r._callbacks[g.key][f ? "unshift" : "push"]({ callback: a, modifiers: g.modifiers, action: g.action, seq: f, level: p, combo: n });
                })(e[c], n, a);
            }),
              c(e, "keypress", g),
              c(e, "keydown", g),
              c(e, "keyup", g);
          }
        })("undefined" != typeof window ? window : null, "undefined" != typeof window ? document : null);
      },
      74721: function (e, t) {
        "use strict";
        Object.defineProperty(t, "__esModule", { value: !0 }),
          (t.default = function (e) {
            for (var t = e.toUpperCase().split(/[\s+-]/), r = [], o = "", i = 0; i < t.length && n.test(t[i]); i++) r.push(t[i]);
            if ((r.length >= 1 && (o += r[0].substr(0, 1)), r.length >= 2)) {
              for (var a = !1, s = 1; s < r.length; s++)
                if (!r[s].match(/.\./)) {
                  (a = !0), (o += r[s].substr(0, 1));
                  break;
                }
              a || (o += r[1].substr(0, 1));
            }
            return o;
          });
        var n = /^[a-z\u00C0-\u017F]/i;
        e.exports = t.default;
      },
      19928: function (e) {
        var t;
        (t = function () {
          var e = [],
            t = [],
            n = {},
            r = {},
            o = {};
          function i(e) {
            return "string" == typeof e ? RegExp("^" + e + "$", "i") : e;
          }
          function a(e, t) {
            return e === t
              ? t
              : e === e.toLowerCase()
                ? t.toLowerCase()
                : e === e.toUpperCase()
                  ? t.toUpperCase()
                  : e[0] === e[0].toUpperCase()
                    ? t.charAt(0).toUpperCase() + t.substr(1).toLowerCase()
                    : t.toLowerCase();
          }
          function s(e, t, r) {
            if (!e.length || n.hasOwnProperty(e)) return t;
            for (var o = r.length; o--; ) {
              var i = r[o];
              if (i[0].test(t))
                return (function (e, t) {
                  return e.replace(t[0], function (n, r) {
                    var o,
                      i,
                      s =
                        ((o = t[1]),
                        (i = arguments),
                        o.replace(/\$(\d{1,2})/g, function (e, t) {
                          return i[t] || "";
                        }));
                    return "" === n ? a(e[r - 1], s) : a(n, s);
                  });
                })(t, i);
            }
            return t;
          }
          function l(e, t, n) {
            return function (r) {
              var o = r.toLowerCase();
              return t.hasOwnProperty(o) ? a(r, o) : e.hasOwnProperty(o) ? a(r, e[o]) : s(o, r, n);
            };
          }
          function u(e, t, n, r) {
            return function (r) {
              var o = r.toLowerCase();
              return !!t.hasOwnProperty(o) || (!e.hasOwnProperty(o) && s(o, o, n) === o);
            };
          }
          function c(e, t, n) {
            var r = 1 === t ? c.singular(e) : c.plural(e);
            return (n ? t + " " : "") + r;
          }
          return (
            (c.plural = l(o, r, e)),
            (c.isPlural = u(o, r, e)),
            (c.singular = l(r, o, t)),
            (c.isSingular = u(r, o, t)),
            (c.addPluralRule = function (t, n) {
              e.push([i(t), n]);
            }),
            (c.addSingularRule = function (e, n) {
              t.push([i(e), n]);
            }),
            (c.addUncountableRule = function (e) {
              if ("string" == typeof e) {
                n[e.toLowerCase()] = !0;
                return;
              }
              c.addPluralRule(e, "$0"), c.addSingularRule(e, "$0");
            }),
            (c.addIrregularRule = function (e, t) {
              (t = t.toLowerCase()), (o[(e = e.toLowerCase())] = t), (r[t] = e);
            }),
            [
              ["I", "we"],
              ["me", "us"],
              ["he", "they"],
              ["she", "they"],
              ["them", "them"],
              ["myself", "ourselves"],
              ["yourself", "yourselves"],
              ["itself", "themselves"],
              ["herself", "themselves"],
              ["himself", "themselves"],
              ["themself", "themselves"],
              ["is", "are"],
              ["was", "were"],
              ["has", "have"],
              ["this", "these"],
              ["that", "those"],
              ["echo", "echoes"],
              ["dingo", "dingoes"],
              ["volcano", "volcanoes"],
              ["tornado", "tornadoes"],
              ["torpedo", "torpedoes"],
              ["genus", "genera"],
              ["viscus", "viscera"],
              ["stigma", "stigmata"],
              ["stoma", "stomata"],
              ["dogma", "dogmata"],
              ["lemma", "lemmata"],
              ["schema", "schemata"],
              ["anathema", "anathemata"],
              ["ox", "oxen"],
              ["axe", "axes"],
              ["die", "dice"],
              ["yes", "yeses"],
              ["foot", "feet"],
              ["eave", "eaves"],
              ["goose", "geese"],
              ["tooth", "teeth"],
              ["quiz", "quizzes"],
              ["human", "humans"],
              ["proof", "proofs"],
              ["carve", "carves"],
              ["valve", "valves"],
              ["looey", "looies"],
              ["thief", "thieves"],
              ["groove", "grooves"],
              ["pickaxe", "pickaxes"],
              ["passerby", "passersby"]
            ].forEach(function (e) {
              return c.addIrregularRule(e[0], e[1]);
            }),
            [
              [/s?$/i, "s"],
              [/[^\u0000-\u007F]$/i, "$0"],
              [/([^aeiou]ese)$/i, "$1"],
              [/(ax|test)is$/i, "$1es"],
              [/(alias|[^aou]us|t[lm]as|gas|ris)$/i, "$1es"],
              [/(e[mn]u)s?$/i, "$1s"],
              [/([^l]ias|[aeiou]las|[ejzr]as|[iu]am)$/i, "$1"],
              [/(alumn|syllab|vir|radi|nucle|fung|cact|stimul|termin|bacill|foc|uter|loc|strat)(?:us|i)$/i, "$1i"],
              [/(alumn|alg|vertebr)(?:a|ae)$/i, "$1ae"],
              [/(seraph|cherub)(?:im)?$/i, "$1im"],
              [/(her|at|gr)o$/i, "$1oes"],
              [/(agend|addend|millenni|dat|extrem|bacteri|desiderat|strat|candelabr|errat|ov|symposi|curricul|automat|quor)(?:a|um)$/i, "$1a"],
              [/(apheli|hyperbat|periheli|asyndet|noumen|phenomen|criteri|organ|prolegomen|hedr|automat)(?:a|on)$/i, "$1a"],
              [/sis$/i, "ses"],
              [/(?:(kni|wi|li)fe|(ar|l|ea|eo|oa|hoo)f)$/i, "$1$2ves"],
              [/([^aeiouy]|qu)y$/i, "$1ies"],
              [/([^ch][ieo][ln])ey$/i, "$1ies"],
              [/(x|ch|ss|sh|zz)$/i, "$1es"],
              [/(matr|cod|mur|sil|vert|ind|append)(?:ix|ex)$/i, "$1ices"],
              [/\b((?:tit)?m|l)(?:ice|ouse)$/i, "$1ice"],
              [/(pe)(?:rson|ople)$/i, "$1ople"],
              [/(child)(?:ren)?$/i, "$1ren"],
              [/eaux$/i, "$0"],
              [/m[ae]n$/i, "men"],
              ["thou", "you"]
            ].forEach(function (e) {
              return c.addPluralRule(e[0], e[1]);
            }),
            [
              [/s$/i, ""],
              [/(ss)$/i, "$1"],
              [/(wi|kni|(?:after|half|high|low|mid|non|night|[^\w]|^)li)ves$/i, "$1fe"],
              [/(ar|(?:wo|[ae])l|[eo][ao])ves$/i, "$1f"],
              [/ies$/i, "y"],
              [/\b([pl]|zomb|(?:neck|cross)?t|coll|faer|food|gen|goon|group|lass|talk|goal|cut)ies$/i, "$1ie"],
              [/\b(mon|smil)ies$/i, "$1ey"],
              [/\b((?:tit)?m|l)ice$/i, "$1ouse"],
              [/(seraph|cherub)im$/i, "$1"],
              [/(x|ch|ss|sh|zz|tto|go|cho|alias|[^aou]us|t[lm]as|gas|(?:her|at|gr)o|[aeiou]ris)(?:es)?$/i, "$1"],
              [/(analy|diagno|parenthe|progno|synop|the|empha|cri|ne)(?:sis|ses)$/i, "$1sis"],
              [/(movie|twelve|abuse|e[mn]u)s$/i, "$1"],
              [/(test)(?:is|es)$/i, "$1is"],
              [/(alumn|syllab|vir|radi|nucle|fung|cact|stimul|termin|bacill|foc|uter|loc|strat)(?:us|i)$/i, "$1us"],
              [/(agend|addend|millenni|dat|extrem|bacteri|desiderat|strat|candelabr|errat|ov|symposi|curricul|quor)a$/i, "$1um"],
              [/(apheli|hyperbat|periheli|asyndet|noumen|phenomen|criteri|organ|prolegomen|hedr|automat)a$/i, "$1on"],
              [/(alumn|alg|vertebr)ae$/i, "$1a"],
              [/(cod|mur|sil|vert|ind)ices$/i, "$1ex"],
              [/(matr|append)ices$/i, "$1ix"],
              [/(pe)(rson|ople)$/i, "$1rson"],
              [/(child)ren$/i, "$1"],
              [/(eau)x?$/i, "$1"],
              [/men$/i, "man"]
            ].forEach(function (e) {
              return c.addSingularRule(e[0], e[1]);
            }),
            [
              "adulthood",
              "advice",
              "agenda",
              "aid",
              "aircraft",
              "alcohol",
              "ammo",
              "analytics",
              "anime",
              "athletics",
              "audio",
              "bison",
              "blood",
              "bream",
              "buffalo",
              "butter",
              "carp",
              "cash",
              "chassis",
              "chess",
              "clothing",
              "cod",
              "commerce",
              "cooperation",
              "corps",
              "debris",
              "diabetes",
              "digestion",
              "elk",
              "energy",
              "equipment",
              "excretion",
              "expertise",
              "firmware",
              "flounder",
              "fun",
              "gallows",
              "garbage",
              "graffiti",
              "hardware",
              "headquarters",
              "health",
              "herpes",
              "highjinks",
              "homework",
              "housework",
              "information",
              "jeans",
              "justice",
              "kudos",
              "labour",
              "literature",
              "machinery",
              "mackerel",
              "mail",
              "media",
              "mews",
              "moose",
              "music",
              "mud",
              "manga",
              "news",
              "only",
              "personnel",
              "pike",
              "plankton",
              "pliers",
              "police",
              "pollution",
              "premises",
              "rain",
              "research",
              "rice",
              "salmon",
              "scissors",
              "series",
              "sewage",
              "shambles",
              "shrimp",
              "software",
              "species",
              "staff",
              "swine",
              "tennis",
              "traffic",
              "transportation",
              "trout",
              "tuna",
              "wealth",
              "welfare",
              "whiting",
              "wildebeest",
              "wildlife",
              "you",
              /pok[eé]mon$/i,
              /[^aeiou]ese$/i,
              /deer$/i,
              /fish$/i,
              /measles$/i,
              /o[iu]s$/i,
              /pox$/i,
              /sheep$/i
            ].forEach(c.addUncountableRule),
            c
          );
        }),
          (e.exports = t());
      },
      63608: function (e, t, n) {
        "use strict";
        Object.defineProperty(t, "__esModule", { value: !0 });
        var r =
            Object.assign ||
            function (e) {
              for (var t = 1; t < arguments.length; t++) {
                var n = arguments[t];
                for (var r in n) Object.prototype.hasOwnProperty.call(n, r) && (e[r] = n[r]);
              }
              return e;
            },
          o = (function () {
            function e(e, t) {
              for (var n = 0; n < t.length; n++) {
                var r = t[n];
                (r.enumerable = r.enumerable || !1), (r.configurable = !0), "value" in r && (r.writable = !0), Object.defineProperty(e, r.key, r);
              }
            }
            return function (t, n, r) {
              return n && e(t.prototype, n), r && e(t, r), t;
            };
          })(),
          i = n(2784),
          a = l(i),
          s = l(n(13980));
        function l(e) {
          return e && e.__esModule ? e : { default: e };
        }
        var u = { position: "absolute", top: 0, left: 0, visibility: "hidden", height: 0, overflow: "scroll", whiteSpace: "pre" },
          c = ["extraWidth", "injectStyles", "inputClassName", "inputRef", "inputStyle", "minWidth", "onAutosize", "placeholderIsMinWidth"],
          d = function (e, t) {
            (t.style.fontSize = e.fontSize),
              (t.style.fontFamily = e.fontFamily),
              (t.style.fontWeight = e.fontWeight),
              (t.style.fontStyle = e.fontStyle),
              (t.style.letterSpacing = e.letterSpacing),
              (t.style.textTransform = e.textTransform);
          },
          f = "undefined" != typeof window && !!window.navigator && /MSIE |Trident\/|Edge\//.test(window.navigator.userAgent),
          h = function () {
            return f ? "_" + Math.random().toString(36).substr(2, 12) : void 0;
          },
          p = (function (e) {
            function t(e) {
              !(function (e, t) {
                if (!(e instanceof t)) throw TypeError("Cannot call a class as a function");
              })(this, t);
              var n = (function (e, t) {
                if (!e) throw ReferenceError("this hasn't been initialised - super() hasn't been called");
                return t && ("object" == typeof t || "function" == typeof t) ? t : e;
              })(this, (t.__proto__ || Object.getPrototypeOf(t)).call(this, e));
              return (
                (n.inputRef = function (e) {
                  (n.input = e), "function" == typeof n.props.inputRef && n.props.inputRef(e);
                }),
                (n.placeHolderSizerRef = function (e) {
                  n.placeHolderSizer = e;
                }),
                (n.sizerRef = function (e) {
                  n.sizer = e;
                }),
                (n.state = { inputWidth: e.minWidth, inputId: e.id || h(), prevId: e.id }),
                n
              );
            }
            return (
              (function (e, t) {
                if ("function" != typeof t && null !== t) throw TypeError("Super expression must either be null or a function, not " + typeof t);
                (e.prototype = Object.create(t && t.prototype, { constructor: { value: e, enumerable: !1, writable: !0, configurable: !0 } })),
                  t && (Object.setPrototypeOf ? Object.setPrototypeOf(e, t) : (e.__proto__ = t));
              })(t, e),
              o(t, null, [
                {
                  key: "getDerivedStateFromProps",
                  value: function (e, t) {
                    var n = e.id;
                    return n !== t.prevId ? { inputId: n || h(), prevId: n } : null;
                  }
                }
              ]),
              o(t, [
                {
                  key: "componentDidMount",
                  value: function () {
                    (this.mounted = !0), this.copyInputStyles(), this.updateInputWidth();
                  }
                },
                {
                  key: "componentDidUpdate",
                  value: function (e, t) {
                    t.inputWidth !== this.state.inputWidth && "function" == typeof this.props.onAutosize && this.props.onAutosize(this.state.inputWidth),
                      this.updateInputWidth();
                  }
                },
                {
                  key: "componentWillUnmount",
                  value: function () {
                    this.mounted = !1;
                  }
                },
                {
                  key: "copyInputStyles",
                  value: function () {
                    if (this.mounted && window.getComputedStyle) {
                      var e = this.input && window.getComputedStyle(this.input);
                      e && (d(e, this.sizer), this.placeHolderSizer && d(e, this.placeHolderSizer));
                    }
                  }
                },
                {
                  key: "updateInputWidth",
                  value: function () {
                    if (this.mounted && this.sizer && void 0 !== this.sizer.scrollWidth) {
                      var e = void 0;
                      (e =
                        (this.props.placeholder && (!this.props.value || (this.props.value && this.props.placeholderIsMinWidth))
                          ? Math.max(this.sizer.scrollWidth, this.placeHolderSizer.scrollWidth) + 2
                          : this.sizer.scrollWidth + 2) +
                        ("number" === this.props.type && void 0 === this.props.extraWidth ? 16 : parseInt(this.props.extraWidth) || 0)) < this.props.minWidth &&
                        (e = this.props.minWidth),
                        e !== this.state.inputWidth && this.setState({ inputWidth: e });
                    }
                  }
                },
                {
                  key: "getInput",
                  value: function () {
                    return this.input;
                  }
                },
                {
                  key: "focus",
                  value: function () {
                    this.input.focus();
                  }
                },
                {
                  key: "blur",
                  value: function () {
                    this.input.blur();
                  }
                },
                {
                  key: "select",
                  value: function () {
                    this.input.select();
                  }
                },
                {
                  key: "renderStyles",
                  value: function () {
                    var e = this.props.injectStyles;
                    return f && e
                      ? a.default.createElement("style", {
                          dangerouslySetInnerHTML: { __html: "input#" + this.state.inputId + "::-ms-clear {display: none;}" }
                        })
                      : null;
                  }
                },
                {
                  key: "render",
                  value: function () {
                    var e = [this.props.defaultValue, this.props.value, ""].reduce(function (e, t) {
                        return null != e ? e : t;
                      }),
                      t = r({}, this.props.style);
                    t.display || (t.display = "inline-block");
                    var n = r({ boxSizing: "content-box", width: this.state.inputWidth + "px" }, this.props.inputStyle),
                      o = (function (e, t) {
                        var n = {};
                        for (var r in e) !(t.indexOf(r) >= 0) && Object.prototype.hasOwnProperty.call(e, r) && (n[r] = e[r]);
                        return n;
                      })(this.props, []);
                    return (
                      c.forEach(function (e) {
                        return delete o[e];
                      }),
                      (o.className = this.props.inputClassName),
                      (o.id = this.state.inputId),
                      (o.style = n),
                      a.default.createElement(
                        "div",
                        { className: this.props.className, style: t },
                        this.renderStyles(),
                        a.default.createElement("input", r({}, o, { ref: this.inputRef })),
                        a.default.createElement("div", { ref: this.sizerRef, style: u }, e),
                        this.props.placeholder ? a.default.createElement("div", { ref: this.placeHolderSizerRef, style: u }, this.props.placeholder) : null
                      )
                    );
                  }
                }
              ]),
              t
            );
          })(i.Component);
        (p.propTypes = {
          className: s.default.string,
          defaultValue: s.default.any,
          extraWidth: s.default.oneOfType([s.default.number, s.default.string]),
          id: s.default.string,
          injectStyles: s.default.bool,
          inputClassName: s.default.string,
          inputRef: s.default.func,
          inputStyle: s.default.object,
          minWidth: s.default.oneOfType([s.default.number, s.default.string]),
          onAutosize: s.default.func,
          onChange: s.default.func,
          placeholder: s.default.string,
          placeholderIsMinWidth: s.default.bool,
          style: s.default.object,
          value: s.default.any
        }),
          (p.defaultProps = { minWidth: 1, injectStyles: !0 }),
          (t.default = p);
      },
      78435: function (e) {
        var t = "undefined" != typeof Element,
          n = "function" == typeof Map,
          r = "function" == typeof Set,
          o = "function" == typeof ArrayBuffer && !!ArrayBuffer.isView;
        e.exports = function (e, i) {
          try {
            return (function e(i, a) {
              if (i === a) return !0;
              if (i && a && "object" == typeof i && "object" == typeof a) {
                var s, l, u, c;
                if (i.constructor !== a.constructor) return !1;
                if (Array.isArray(i)) {
                  if ((s = i.length) != a.length) return !1;
                  for (l = s; 0 != l--; ) if (!e(i[l], a[l])) return !1;
                  return !0;
                }
                if (n && i instanceof Map && a instanceof Map) {
                  if (i.size !== a.size) return !1;
                  for (c = i.entries(); !(l = c.next()).done; ) if (!a.has(l.value[0])) return !1;
                  for (c = i.entries(); !(l = c.next()).done; ) if (!e(l.value[1], a.get(l.value[0]))) return !1;
                  return !0;
                }
                if (r && i instanceof Set && a instanceof Set) {
                  if (i.size !== a.size) return !1;
                  for (c = i.entries(); !(l = c.next()).done; ) if (!a.has(l.value[0])) return !1;
                  return !0;
                }
                if (o && ArrayBuffer.isView(i) && ArrayBuffer.isView(a)) {
                  if ((s = i.length) != a.length) return !1;
                  for (l = s; 0 != l--; ) if (i[l] !== a[l]) return !1;
                  return !0;
                }
                if (i.constructor === RegExp) return i.source === a.source && i.flags === a.flags;
                if (i.valueOf !== Object.prototype.valueOf && "function" == typeof i.valueOf && "function" == typeof a.valueOf)
                  return i.valueOf() === a.valueOf();
                if (i.toString !== Object.prototype.toString && "function" == typeof i.toString && "function" == typeof a.toString)
                  return i.toString() === a.toString();
                if ((s = (u = Object.keys(i)).length) !== Object.keys(a).length) return !1;
                for (l = s; 0 != l--; ) if (!Object.prototype.hasOwnProperty.call(a, u[l])) return !1;
                if (t && i instanceof Element) return !1;
                for (l = s; 0 != l--; ) if ((("_owner" !== u[l] && "__v" !== u[l] && "__o" !== u[l]) || !i.$$typeof) && !e(i[u[l]], a[u[l]])) return !1;
                return !0;
              }
              return i != i && a != a;
            })(e, i);
          } catch (e) {
            if ((e.message || "").match(/stack|recursion/i)) return console.warn("react-fast-compare cannot handle circular refs"), !1;
            throw e;
          }
        };
      },
      78141: function (e, t, n) {
        e.exports = (function (e) {
          var t = {};
          function n(r) {
            if (t[r]) return t[r].exports;
            var o = (t[r] = { exports: {}, id: r, loaded: !1 });
            return e[r].call(o.exports, o, o.exports, n), (o.loaded = !0), o.exports;
          }
          return (n.m = e), (n.c = t), (n.p = ""), n(0);
        })([
          function (e, t, n) {
            e.exports = n(1);
          },
          function (e, t, n) {
            "use strict";
            Object.defineProperty(t, "__esModule", { value: !0 });
            var r,
              o = (r = n(2)) && r.__esModule ? r : { default: r };
            (t.default = o.default), (e.exports = t.default);
          },
          function (e, t, n) {
            "use strict";
            Object.defineProperty(t, "__esModule", { value: !0 });
            var r =
              Object.assign ||
              function (e) {
                for (var t = 1; t < arguments.length; t++) {
                  var n = arguments[t];
                  for (var r in n) Object.prototype.hasOwnProperty.call(n, r) && (e[r] = n[r]);
                }
                return e;
              };
            function o(e) {
              return e && e.__esModule ? e : { default: e };
            }
            t.default = u;
            var i = n(3),
              a = o(n(4)),
              s = n(14),
              l = o(n(15));
            function u(e) {
              var t = e.activeClassName,
                n = void 0 === t ? "" : t,
                o = e.activeIndex,
                a = void 0 === o ? -1 : o,
                u = e.activeStyle,
                c = e.autoEscape,
                d = e.caseSensitive,
                f = void 0 !== d && d,
                h = e.className,
                p = e.findChunks,
                _ = e.highlightClassName,
                g = void 0 === _ ? "" : _,
                m = e.highlightStyle,
                v = void 0 === m ? {} : m,
                y = e.highlightTag,
                b = e.sanitize,
                x = e.searchWords,
                w = e.textToHighlight,
                k = e.unhighlightTag,
                M = void 0 === k ? "span" : k,
                j = e.unhighlightClassName,
                E = void 0 === j ? "" : j,
                S = e.unhighlightStyle,
                T = (function (e, t) {
                  var n = {};
                  for (var r in e) !(t.indexOf(r) >= 0) && Object.prototype.hasOwnProperty.call(e, r) && (n[r] = e[r]);
                  return n;
                })(e, [
                  "activeClassName",
                  "activeIndex",
                  "activeStyle",
                  "autoEscape",
                  "caseSensitive",
                  "className",
                  "findChunks",
                  "highlightClassName",
                  "highlightStyle",
                  "highlightTag",
                  "sanitize",
                  "searchWords",
                  "textToHighlight",
                  "unhighlightTag",
                  "unhighlightClassName",
                  "unhighlightStyle"
                ]),
                C = (0, i.findAll)({ autoEscape: c, caseSensitive: f, findChunks: p, sanitize: b, searchWords: x, textToHighlight: w }),
                P = void 0 === y ? "mark" : y,
                N = -1,
                A = "",
                O = void 0,
                $ = (0, l.default)(function (e) {
                  var t = {};
                  for (var n in e) t[n.toLowerCase()] = e[n];
                  return t;
                });
              return (0, s.createElement)(
                "span",
                r({ className: h }, T, {
                  children: C.map(function (e, t) {
                    var r = w.substr(e.start, e.end - e.start);
                    if (!e.highlight) return (0, s.createElement)(M, { children: r, className: E, key: t, style: S });
                    N++;
                    var o = void 0;
                    o = "object" == typeof g ? (f ? g[r] : (g = $(g))[r.toLowerCase()]) : g;
                    var i = N === +a;
                    (A = o + " " + (i ? n : "")), (O = !0 === i && null != u ? Object.assign({}, v, u) : v);
                    var l = { children: r, className: A, key: t, style: O };
                    return "string" != typeof P && (l.highlightIndex = N), (0, s.createElement)(P, l);
                  })
                })
              );
            }
            (u.propTypes = {
              activeClassName: a.default.string,
              activeIndex: a.default.number,
              activeStyle: a.default.object,
              autoEscape: a.default.bool,
              className: a.default.string,
              findChunks: a.default.func,
              highlightClassName: a.default.oneOfType([a.default.object, a.default.string]),
              highlightStyle: a.default.object,
              highlightTag: a.default.oneOfType([a.default.node, a.default.func, a.default.string]),
              sanitize: a.default.func,
              searchWords: a.default.arrayOf(a.default.oneOfType([a.default.string, a.default.instanceOf(RegExp)])).isRequired,
              textToHighlight: a.default.string.isRequired,
              unhighlightTag: a.default.oneOfType([a.default.node, a.default.func, a.default.string]),
              unhighlightClassName: a.default.string,
              unhighlightStyle: a.default.object
            }),
              (e.exports = t.default);
          },
          function (e, t) {
            e.exports = (function (e) {
              var t = {};
              function n(r) {
                if (t[r]) return t[r].exports;
                var o = (t[r] = { exports: {}, id: r, loaded: !1 });
                return e[r].call(o.exports, o, o.exports, n), (o.loaded = !0), o.exports;
              }
              return (n.m = e), (n.c = t), (n.p = ""), n(0);
            })([
              function (e, t, n) {
                e.exports = n(1);
              },
              function (e, t, n) {
                "use strict";
                Object.defineProperty(t, "__esModule", { value: !0 });
                var r = n(2);
                Object.defineProperty(t, "combineChunks", {
                  enumerable: !0,
                  get: function () {
                    return r.combineChunks;
                  }
                }),
                  Object.defineProperty(t, "fillInChunks", {
                    enumerable: !0,
                    get: function () {
                      return r.fillInChunks;
                    }
                  }),
                  Object.defineProperty(t, "findAll", {
                    enumerable: !0,
                    get: function () {
                      return r.findAll;
                    }
                  }),
                  Object.defineProperty(t, "findChunks", {
                    enumerable: !0,
                    get: function () {
                      return r.findChunks;
                    }
                  });
              },
              function (e, t) {
                "use strict";
                Object.defineProperty(t, "__esModule", { value: !0 }),
                  (t.findAll = function (e) {
                    var t = e.autoEscape,
                      i = e.caseSensitive,
                      a = e.findChunks,
                      s = void 0 === a ? r : a,
                      l = e.sanitize,
                      u = e.searchWords,
                      c = e.textToHighlight;
                    return o({
                      chunksToHighlight: n({ chunks: s({ autoEscape: t, caseSensitive: void 0 !== i && i, sanitize: l, searchWords: u, textToHighlight: c }) }),
                      totalLength: c ? c.length : 0
                    });
                  });
                var n = (t.combineChunks = function (e) {
                    var t = e.chunks;
                    return t
                      .sort(function (e, t) {
                        return e.start - t.start;
                      })
                      .reduce(function (e, t) {
                        if (0 === e.length) return [t];
                        var n = e.pop();
                        if (t.start <= n.end) {
                          var r = Math.max(n.end, t.end);
                          e.push({ start: n.start, end: r });
                        } else e.push(n, t);
                        return e;
                      }, []);
                  }),
                  r = function (e) {
                    var t = e.autoEscape,
                      n = e.caseSensitive,
                      r = e.sanitize,
                      o = void 0 === r ? i : r,
                      a = e.searchWords,
                      s = e.textToHighlight;
                    return (
                      (s = o(s)),
                      a
                        .filter(function (e) {
                          return e;
                        })
                        .reduce(function (e, r) {
                          (r = o(r)), t && (r = r.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"));
                          for (var i = new RegExp(r, n ? "g" : "gi"), a = void 0; (a = i.exec(s)); ) {
                            var l = a.index,
                              u = i.lastIndex;
                            u > l && e.push({ start: l, end: u }), a.index == i.lastIndex && i.lastIndex++;
                          }
                          return e;
                        }, [])
                    );
                  };
                t.findChunks = r;
                var o = (t.fillInChunks = function (e) {
                  var t = e.chunksToHighlight,
                    n = e.totalLength,
                    r = [],
                    o = function (e, t, n) {
                      t - e > 0 && r.push({ start: e, end: t, highlight: n });
                    };
                  if (0 === t.length) o(0, n, !1);
                  else {
                    var i = 0;
                    t.forEach(function (e) {
                      o(i, e.start, !1), o(e.start, e.end, !0), (i = e.end);
                    }),
                      o(i, n, !1);
                  }
                  return r;
                });
                function i(e) {
                  return e;
                }
              }
            ]);
          },
          function (e, t, n) {
            (function (t) {
              if ("production" !== t.env.NODE_ENV) {
                var r = ("function" == typeof Symbol && Symbol.for && Symbol.for("react.element")) || 60103;
                e.exports = n(6)(function (e) {
                  return "object" == typeof e && null !== e && e.$$typeof === r;
                }, !0);
              } else e.exports = n(13)();
            }).call(t, n(5));
          },
          function (e, t) {
            var n,
              r,
              o,
              i = (e.exports = {});
            function a() {
              throw Error("setTimeout has not been defined");
            }
            function s() {
              throw Error("clearTimeout has not been defined");
            }
            function l(e) {
              if (n === setTimeout) return setTimeout(e, 0);
              if ((n === a || !n) && setTimeout) return (n = setTimeout), setTimeout(e, 0);
              try {
                return n(e, 0);
              } catch (t) {
                try {
                  return n.call(null, e, 0);
                } catch (t) {
                  return n.call(this, e, 0);
                }
              }
            }
            !(function () {
              try {
                n = "function" == typeof setTimeout ? setTimeout : a;
              } catch (e) {
                n = a;
              }
              try {
                r = "function" == typeof clearTimeout ? clearTimeout : s;
              } catch (e) {
                r = s;
              }
            })();
            var u = [],
              c = !1,
              d = -1;
            function f() {
              c && o && ((c = !1), o.length ? (u = o.concat(u)) : (d = -1), u.length && h());
            }
            function h() {
              if (!c) {
                var e = l(f);
                c = !0;
                for (var t = u.length; t; ) {
                  for (o = u, u = []; ++d < t; ) o && o[d].run();
                  (d = -1), (t = u.length);
                }
                (o = null),
                  (c = !1),
                  (function (e) {
                    if (r === clearTimeout) return clearTimeout(e);
                    if ((r === s || !r) && clearTimeout) return (r = clearTimeout), clearTimeout(e);
                    try {
                      r(e);
                    } catch (t) {
                      try {
                        return r.call(null, e);
                      } catch (t) {
                        return r.call(this, e);
                      }
                    }
                  })(e);
              }
            }
            function p(e, t) {
              (this.fun = e), (this.array = t);
            }
            function _() {}
            (i.nextTick = function (e) {
              var t = Array(arguments.length - 1);
              if (arguments.length > 1) for (var n = 1; n < arguments.length; n++) t[n - 1] = arguments[n];
              u.push(new p(e, t)), 1 !== u.length || c || l(h);
            }),
              (p.prototype.run = function () {
                this.fun.apply(null, this.array);
              }),
              (i.title = "browser"),
              (i.browser = !0),
              (i.env = {}),
              (i.argv = []),
              (i.version = ""),
              (i.versions = {}),
              (i.on = _),
              (i.addListener = _),
              (i.once = _),
              (i.off = _),
              (i.removeListener = _),
              (i.removeAllListeners = _),
              (i.emit = _),
              (i.prependListener = _),
              (i.prependOnceListener = _),
              (i.listeners = function (e) {
                return [];
              }),
              (i.binding = function (e) {
                throw Error("process.binding is not supported");
              }),
              (i.cwd = function () {
                return "/";
              }),
              (i.chdir = function (e) {
                throw Error("process.chdir is not supported");
              }),
              (i.umask = function () {
                return 0;
              });
          },
          function (e, t, n) {
            (function (t) {
              "use strict";
              var r = n(7),
                o = n(8),
                i = n(9),
                a = n(10),
                s = n(11),
                l = n(12);
              e.exports = function (e, n) {
                var u = "function" == typeof Symbol && Symbol.iterator,
                  c = "<<anonymous>>",
                  d = {
                    array: p("array"),
                    bool: p("boolean"),
                    func: p("function"),
                    number: p("number"),
                    object: p("object"),
                    string: p("string"),
                    symbol: p("symbol"),
                    any: h(r.thatReturnsNull),
                    arrayOf: function (e) {
                      return h(function (t, n, r, o, i) {
                        if ("function" != typeof e) return new f("Property `" + i + "` of component `" + r + "` has invalid PropType notation inside arrayOf.");
                        var a = t[n];
                        if (!Array.isArray(a))
                          return new f("Invalid " + o + " `" + i + "` of type " + ("`" + _(a) + "` supplied to `") + r + "`, expected an array.");
                        for (var l = 0; l < a.length; l++) {
                          var u = e(a, l, r, o, i + "[" + l + "]", s);
                          if (u instanceof Error) return u;
                        }
                        return null;
                      });
                    },
                    element: h(function (t, n, r, o, i) {
                      var a = t[n];
                      return e(a)
                        ? null
                        : new f("Invalid " + o + " `" + i + "` of type " + ("`" + _(a) + "` supplied to `") + r + "`, expected a single ReactElement.");
                    }),
                    instanceOf: function (e) {
                      return h(function (t, n, r, o, i) {
                        if (!(t[n] instanceof e)) {
                          var a,
                            s = e.name || c;
                          return new f(
                            "Invalid " +
                              o +
                              " `" +
                              i +
                              "` of type " +
                              ("`" + ((a = t[n]).constructor && a.constructor.name ? a.constructor.name : c) + "` supplied to `") +
                              r +
                              "`, expected instance of `" +
                              s +
                              "`."
                          );
                        }
                        return null;
                      });
                    },
                    node: h(function (t, n, r, o, i) {
                      return !(function t(n) {
                        switch (typeof n) {
                          case "number":
                          case "string":
                          case "undefined":
                            return !0;
                          case "boolean":
                            return !n;
                          case "object":
                            if (Array.isArray(n)) return n.every(t);
                            if (null === n || e(n)) return !0;
                            var r = (function (e) {
                              var t = e && ((u && e[u]) || e["@@iterator"]);
                              if ("function" == typeof t) return t;
                            })(n);
                            if (!r) return !1;
                            var o,
                              i = r.call(n);
                            if (r !== n.entries) {
                              for (; !(o = i.next()).done; ) if (!t(o.value)) return !1;
                            } else
                              for (; !(o = i.next()).done; ) {
                                var a = o.value;
                                if (a && !t(a[1])) return !1;
                              }
                            return !0;
                          default:
                            return !1;
                        }
                      })(t[n])
                        ? new f("Invalid " + o + " `" + i + "` supplied to `" + r + "`, expected a ReactNode.")
                        : null;
                    }),
                    objectOf: function (e) {
                      return h(function (t, n, r, o, i) {
                        if ("function" != typeof e)
                          return new f("Property `" + i + "` of component `" + r + "` has invalid PropType notation inside objectOf.");
                        var a = t[n],
                          l = _(a);
                        if ("object" !== l)
                          return new f("Invalid " + o + " `" + i + "` of type " + ("`" + l + "` supplied to `") + r + "`, expected an object.");
                        for (var u in a)
                          if (a.hasOwnProperty(u)) {
                            var c = e(a, u, r, o, i + "." + u, s);
                            if (c instanceof Error) return c;
                          }
                        return null;
                      });
                    },
                    oneOf: function (e) {
                      return Array.isArray(e)
                        ? h(function (t, n, r, o, i) {
                            for (var a, s = t[n], l = 0; l < e.length; l++) if (s === (a = e[l]) ? 0 !== s || 1 / s == 1 / a : s != s && a != a) return null;
                            return new f(
                              "Invalid " + o + " `" + i + "` of value `" + s + "` " + ("supplied to `" + r + "`, expected one of ") + JSON.stringify(e) + "."
                            );
                          })
                        : ("production" !== t.env.NODE_ENV && i(!1, "Invalid argument supplied to oneOf, expected an instance of array."), r.thatReturnsNull);
                    },
                    oneOfType: function (e) {
                      if (!Array.isArray(e))
                        return (
                          "production" !== t.env.NODE_ENV && i(!1, "Invalid argument supplied to oneOfType, expected an instance of array."), r.thatReturnsNull
                        );
                      for (var n = 0; n < e.length; n++) {
                        var o = e[n];
                        if ("function" != typeof o)
                          return (
                            i(
                              !1,
                              "Invalid argument supplied to oneOfType. Expected an array of check functions, but received %s at index %s.",
                              (function (e) {
                                var t = g(e);
                                switch (t) {
                                  case "array":
                                  case "object":
                                    return "an " + t;
                                  case "boolean":
                                  case "date":
                                  case "regexp":
                                    return "a " + t;
                                  default:
                                    return t;
                                }
                              })(o),
                              n
                            ),
                            r.thatReturnsNull
                          );
                      }
                      return h(function (t, n, r, o, i) {
                        for (var a = 0; a < e.length; a++) if (null == (0, e[a])(t, n, r, o, i, s)) return null;
                        return new f("Invalid " + o + " `" + i + "` supplied to `" + r + "`.");
                      });
                    },
                    shape: function (e) {
                      return h(function (t, n, r, o, i) {
                        var a = t[n],
                          l = _(a);
                        if ("object" !== l) return new f("Invalid " + o + " `" + i + "` of type `" + l + "` supplied to `" + r + "`, expected `object`.");
                        for (var u in e) {
                          var c = e[u];
                          if (c) {
                            var d = c(a, u, r, o, i + "." + u, s);
                            if (d) return d;
                          }
                        }
                        return null;
                      });
                    },
                    exact: function (e) {
                      return h(function (t, n, r, o, i) {
                        var l = t[n],
                          u = _(l);
                        if ("object" !== u) return new f("Invalid " + o + " `" + i + "` of type `" + u + "` supplied to `" + r + "`, expected `object`.");
                        var c = a({}, t[n], e);
                        for (var d in c) {
                          var h = e[d];
                          if (!h)
                            return new f(
                              "Invalid " +
                                o +
                                " `" +
                                i +
                                "` key `" +
                                d +
                                "` supplied to `" +
                                r +
                                "`.\nBad object: " +
                                JSON.stringify(t[n], null, "  ") +
                                "\nValid keys: " +
                                JSON.stringify(Object.keys(e), null, "  ")
                            );
                          var p = h(l, d, r, o, i + "." + d, s);
                          if (p) return p;
                        }
                        return null;
                      });
                    }
                  };
                function f(e) {
                  (this.message = e), (this.stack = "");
                }
                function h(e) {
                  if ("production" !== t.env.NODE_ENV)
                    var r = {},
                      a = 0;
                  function l(l, u, d, h, p, _, g) {
                    if (((h = h || c), (_ = _ || d), g !== s)) {
                      if (n)
                        o(
                          !1,
                          "Calling PropTypes validators directly is not supported by the `prop-types` package. Use `PropTypes.checkPropTypes()` to call them. Read more at http://fb.me/use-check-prop-types"
                        );
                      else if ("production" !== t.env.NODE_ENV && "undefined" != typeof console) {
                        var m = h + ":" + d;
                        !r[m] &&
                          a < 3 &&
                          (i(
                            !1,
                            "You are manually calling a React.PropTypes validation function for the `%s` prop on `%s`. This is deprecated and will throw in the standalone `prop-types` package. You may be seeing this warning due to a third-party PropTypes library. See https://fb.me/react-warning-dont-call-proptypes for details.",
                            _,
                            h
                          ),
                          (r[m] = !0),
                          a++);
                      }
                    }
                    return null != u[d]
                      ? e(u, d, h, p, _)
                      : l
                        ? new f(
                            null === u[d]
                              ? "The " + p + " `" + _ + "` is marked as required in `" + h + "`, but its value is `null`."
                              : "The " + p + " `" + _ + "` is marked as required in `" + h + "`, but its value is `undefined`."
                          )
                        : null;
                  }
                  var u = l.bind(null, !1);
                  return (u.isRequired = l.bind(null, !0)), u;
                }
                function p(e) {
                  return h(function (t, n, r, o, i, a) {
                    var s = t[n];
                    return _(s) !== e
                      ? new f("Invalid " + o + " `" + i + "` of type " + ("`" + g(s) + "` supplied to `") + r + "`, expected `" + e + "`.")
                      : null;
                  });
                }
                function _(e) {
                  var t = typeof e;
                  return Array.isArray(e)
                    ? "array"
                    : e instanceof RegExp
                      ? "object"
                      : "symbol" === t || "Symbol" === e["@@toStringTag"] || ("function" == typeof Symbol && e instanceof Symbol)
                        ? "symbol"
                        : t;
                }
                function g(e) {
                  if (null == e) return "" + e;
                  var t = _(e);
                  if ("object" === t) {
                    if (e instanceof Date) return "date";
                    if (e instanceof RegExp) return "regexp";
                  }
                  return t;
                }
                return (f.prototype = Error.prototype), (d.checkPropTypes = l), (d.PropTypes = d), d;
              };
            }).call(t, n(5));
          },
          function (e, t) {
            "use strict";
            function n(e) {
              return function () {
                return e;
              };
            }
            var r = function () {};
            (r.thatReturns = n),
              (r.thatReturnsFalse = n(!1)),
              (r.thatReturnsTrue = n(!0)),
              (r.thatReturnsNull = n(null)),
              (r.thatReturnsThis = function () {
                return this;
              }),
              (r.thatReturnsArgument = function (e) {
                return e;
              }),
              (e.exports = r);
          },
          function (e, t, n) {
            (function (t) {
              "use strict";
              var n = function (e) {};
              "production" !== t.env.NODE_ENV &&
                (n = function (e) {
                  if (void 0 === e) throw Error("invariant requires an error message argument");
                }),
                (e.exports = function (e, t, r, o, i, a, s, l) {
                  if ((n(t), !e)) {
                    var u;
                    if (void 0 === t)
                      u = Error(
                        "Minified exception occurred; use the non-minified dev environment for the full error message and additional helpful warnings."
                      );
                    else {
                      var c = [r, o, i, a, s, l],
                        d = 0;
                      (u = Error(
                        t.replace(/%s/g, function () {
                          return c[d++];
                        })
                      )).name = "Invariant Violation";
                    }
                    throw ((u.framesToPop = 1), u);
                  }
                });
            }).call(t, n(5));
          },
          function (e, t, n) {
            (function (t) {
              "use strict";
              var r = n(7);
              if ("production" !== t.env.NODE_ENV) {
                var o = function (e) {
                  for (var t = arguments.length, n = Array(t > 1 ? t - 1 : 0), r = 1; r < t; r++) n[r - 1] = arguments[r];
                  var o = 0,
                    i =
                      "Warning: " +
                      e.replace(/%s/g, function () {
                        return n[o++];
                      });
                  "undefined" != typeof console && console.error(i);
                  try {
                    throw Error(i);
                  } catch (e) {}
                };
                r = function (e, t) {
                  if (void 0 === t) throw Error("`warning(condition, format, ...args)` requires a warning message argument");
                  if (0 !== t.indexOf("Failed Composite propType: ") && !e) {
                    for (var n = arguments.length, r = Array(n > 2 ? n - 2 : 0), i = 2; i < n; i++) r[i - 2] = arguments[i];
                    o.apply(void 0, [t].concat(r));
                  }
                };
              }
              e.exports = r;
            }).call(t, n(5));
          },
          function (e, t) {
            "use strict";
            var n = Object.getOwnPropertySymbols,
              r = Object.prototype.hasOwnProperty,
              o = Object.prototype.propertyIsEnumerable;
            e.exports = !(function () {
              try {
                if (!Object.assign) return !1;
                var e = new String("abc");
                if (((e[5] = "de"), "5" === Object.getOwnPropertyNames(e)[0])) return !1;
                for (var t = {}, n = 0; n < 10; n++) t["_" + String.fromCharCode(n)] = n;
                var r = Object.getOwnPropertyNames(t).map(function (e) {
                  return t[e];
                });
                if ("0123456789" !== r.join("")) return !1;
                var o = {};
                if (
                  ("abcdefghijklmnopqrst".split("").forEach(function (e) {
                    o[e] = e;
                  }),
                  "abcdefghijklmnopqrst" !== Object.keys(Object.assign({}, o)).join(""))
                )
                  return !1;
                return !0;
              } catch (e) {
                return !1;
              }
            })()
              ? function (e, t) {
                  for (
                    var i,
                      a,
                      s = (function (e) {
                        if (null == e) throw TypeError("Object.assign cannot be called with null or undefined");
                        return Object(e);
                      })(e),
                      l = 1;
                    l < arguments.length;
                    l++
                  ) {
                    for (var u in (i = Object(arguments[l]))) r.call(i, u) && (s[u] = i[u]);
                    if (n) {
                      a = n(i);
                      for (var c = 0; c < a.length; c++) o.call(i, a[c]) && (s[a[c]] = i[a[c]]);
                    }
                  }
                  return s;
                }
              : Object.assign;
          },
          function (e, t) {
            "use strict";
            e.exports = "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED";
          },
          function (e, t, n) {
            (function (t) {
              "use strict";
              if ("production" !== t.env.NODE_ENV)
                var r = n(8),
                  o = n(9),
                  i = n(11),
                  a = {};
              e.exports = function (e, n, s, l, u) {
                if ("production" !== t.env.NODE_ENV) {
                  for (var c in e)
                    if (e.hasOwnProperty(c)) {
                      var d;
                      try {
                        r(
                          "function" == typeof e[c],
                          "%s: %s type `%s` is invalid; it must be a function, usually from the `prop-types` package, but received `%s`.",
                          l || "React class",
                          s,
                          c,
                          typeof e[c]
                        ),
                          (d = e[c](n, c, l, s, null, i));
                      } catch (e) {
                        d = e;
                      }
                      if (
                        (o(
                          !d || d instanceof Error,
                          "%s: type specification of %s `%s` is invalid; the type checker function must return `null` or an `Error` but returned a %s. You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument).",
                          l || "React class",
                          s,
                          c,
                          typeof d
                        ),
                        d instanceof Error && !(d.message in a))
                      ) {
                        a[d.message] = !0;
                        var f = u ? u() : "";
                        o(!1, "Failed %s type: %s%s", s, d.message, null != f ? f : "");
                      }
                    }
                }
              };
            }).call(t, n(5));
          },
          function (e, t, n) {
            "use strict";
            var r = n(7),
              o = n(8),
              i = n(11);
            e.exports = function () {
              function e(e, t, n, r, a, s) {
                s !== i &&
                  o(
                    !1,
                    "Calling PropTypes validators directly is not supported by the `prop-types` package. Use PropTypes.checkPropTypes() to call them. Read more at http://fb.me/use-check-prop-types"
                  );
              }
              function t() {
                return e;
              }
              e.isRequired = e;
              var n = {
                array: e,
                bool: e,
                func: e,
                number: e,
                object: e,
                string: e,
                symbol: e,
                any: e,
                arrayOf: t,
                element: e,
                instanceOf: t,
                node: e,
                objectOf: t,
                oneOf: t,
                oneOfType: t,
                shape: t,
                exact: t
              };
              return (n.checkPropTypes = r), (n.PropTypes = n), n;
            };
          },
          function (e, t) {
            e.exports = n(2784);
          },
          function (e, t) {
            "use strict";
            var n = function (e, t) {
              return e === t;
            };
            e.exports = function (e) {
              var t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : n,
                r = void 0,
                o = [],
                i = void 0,
                a = !1,
                s = function (e, n) {
                  return t(e, o[n]);
                };
              return function () {
                for (var t = arguments.length, n = Array(t), l = 0; l < t; l++) n[l] = arguments[l];
                return a && r === this && n.length === o.length && n.every(s) ? i : ((a = !0), (r = this), (o = n), (i = e.apply(this, n)));
              };
            };
          }
        ]);
      },
      17147: function (e, t, n) {
        e = n.nmd(e);
        var r = (function (e) {
          "use strict";
          var t = c(0x20000000000000),
            n = "0123456789abcdefghijklmnopqrstuvwxyz",
            o = "function" == typeof BigInt;
          function i(e, t, n, r) {
            return void 0 === e ? i[0] : void 0 !== t && (10 != +t || n) ? F(e, t, n, r) : H(e);
          }
          function a(e, t) {
            (this.value = e), (this.sign = t), (this.isSmall = !1);
          }
          function s(e) {
            (this.value = e), (this.sign = e < 0), (this.isSmall = !0);
          }
          function l(e) {
            this.value = e;
          }
          function u(e) {
            return -0x20000000000000 < e && e < 0x20000000000000;
          }
          function c(e) {
            return e < 1e7 ? [e] : e < 1e14 ? [e % 1e7, Math.floor(e / 1e7)] : [e % 1e7, Math.floor(e / 1e7) % 1e7, Math.floor(e / 1e14)];
          }
          function d(e) {
            f(e);
            var n = e.length;
            if (n < 4 && 0 > S(e, t))
              switch (n) {
                case 0:
                  return 0;
                case 1:
                  return e[0];
                case 2:
                  return e[0] + 1e7 * e[1];
                default:
                  return e[0] + (e[1] + 1e7 * e[2]) * 1e7;
              }
            return e;
          }
          function f(e) {
            for (var t = e.length; 0 === e[--t]; );
            e.length = t + 1;
          }
          function h(e) {
            for (var t = Array(e), n = -1; ++n < e; ) t[n] = 0;
            return t;
          }
          function p(e) {
            return e > 0 ? Math.floor(e) : Math.ceil(e);
          }
          function _(e, t) {
            var n,
              r,
              o = e.length,
              i = t.length,
              a = Array(o),
              s = 0;
            for (r = 0; r < i; r++) (s = +((n = e[r] + t[r] + s) >= 1e7)), (a[r] = n - 1e7 * s);
            for (; r < o; ) (s = +(1e7 === (n = e[r] + s))), (a[r++] = n - 1e7 * s);
            return s > 0 && a.push(s), a;
          }
          function g(e, t) {
            return e.length >= t.length ? _(e, t) : _(t, e);
          }
          function m(e, t) {
            var n,
              r,
              o = e.length,
              i = Array(o);
            for (r = 0; r < o; r++) (t = Math.floor((n = e[r] - 1e7 + t) / 1e7)), (i[r] = n - 1e7 * t), (t += 1);
            for (; t > 0; ) (i[r++] = t % 1e7), (t = Math.floor(t / 1e7));
            return i;
          }
          function v(e, t) {
            var n,
              r,
              o = e.length,
              i = t.length,
              a = Array(o),
              s = 0;
            for (n = 0; n < i; n++) (r = e[n] - s - t[n]) < 0 ? ((r += 1e7), (s = 1)) : (s = 0), (a[n] = r);
            for (n = i; n < o; n++) {
              if ((r = e[n] - s) < 0) r += 1e7;
              else {
                a[n++] = r;
                break;
              }
              a[n] = r;
            }
            for (; n < o; n++) a[n] = e[n];
            return f(a), a;
          }
          function y(e, t, n) {
            var r,
              o,
              i = e.length,
              l = Array(i),
              u = -t;
            for (r = 0; r < i; r++) (u = Math.floor((o = e[r] + u) / 1e7)), (o %= 1e7), (l[r] = o < 0 ? o + 1e7 : o);
            return "number" == typeof (l = d(l)) ? (n && (l = -l), new s(l)) : new a(l, n);
          }
          function b(e, t) {
            var n,
              r,
              o,
              i,
              a = e.length,
              s = t.length,
              l = h(a + s);
            for (o = 0; o < a; ++o) {
              i = e[o];
              for (var u = 0; u < s; ++u) (r = Math.floor((n = i * t[u] + l[o + u]) / 1e7)), (l[o + u] = n - 1e7 * r), (l[o + u + 1] += r);
            }
            return f(l), l;
          }
          function x(e, t) {
            var n,
              r,
              o = e.length,
              i = Array(o),
              a = 0;
            for (r = 0; r < o; r++) (a = Math.floor((n = e[r] * t + a) / 1e7)), (i[r] = n - 1e7 * a);
            for (; a > 0; ) (i[r++] = a % 1e7), (a = Math.floor(a / 1e7));
            return i;
          }
          function w(e, t) {
            for (var n = []; t-- > 0; ) n.push(0);
            return n.concat(e);
          }
          function k(e, t, n) {
            return e < 1e7 ? new a(x(t, e), n) : new a(b(t, c(e)), n);
          }
          function M(e) {
            var t,
              n,
              r,
              o,
              i = e.length,
              a = h(i + i);
            for (r = 0; r < i; r++) {
              n = 0 - (o = e[r]) * o;
              for (var s = r; s < i; s++) (n = Math.floor((t = o * e[s] * 2 + a[r + s] + n) / 1e7)), (a[r + s] = t - 1e7 * n);
              a[r + i] = n;
            }
            return f(a), a;
          }
          function j(e, t) {
            var n,
              r,
              o,
              i,
              a = e.length,
              s = h(a);
            for (o = 0, n = a - 1; n >= 0; --n) (r = p((i = 1e7 * o + e[n]) / t)), (o = i - r * t), (s[n] = 0 | r);
            return [s, 0 | o];
          }
          function E(e, t) {
            var n,
              r,
              u = H(t);
            if (o) return [new l(e.value / u.value), new l(e.value % u.value)];
            var _ = e.value,
              g = u.value;
            if (0 === g) throw Error("Cannot divide by zero");
            if (e.isSmall) return u.isSmall ? [new s(p(_ / g)), new s(_ % g)] : [i[0], e];
            if (u.isSmall) {
              if (1 === g) return [e, i[0]];
              if (-1 == g) return [e.negate(), i[0]];
              var m = Math.abs(g);
              if (m < 1e7) {
                n = d((r = j(_, m))[0]);
                var y = r[1];
                return (e.sign && (y = -y), "number" == typeof n)
                  ? (e.sign !== u.sign && (n = -n), [new s(n), new s(y)])
                  : [new a(n, e.sign !== u.sign), new s(y)];
              }
              g = c(m);
            }
            var b = S(_, g);
            if (-1 === b) return [i[0], e];
            if (0 === b) return [i[e.sign === u.sign ? 1 : -1], i[0]];
            n = (r =
              _.length + g.length <= 200
                ? (function (e, t) {
                    var n,
                      r,
                      o,
                      i,
                      a,
                      s,
                      l,
                      u = e.length,
                      c = t.length,
                      f = h(t.length),
                      p = t[c - 1],
                      _ = Math.ceil(1e7 / (2 * p)),
                      g = x(e, _),
                      m = x(t, _);
                    for (g.length <= u && g.push(0), m.push(0), p = m[c - 1], r = u - c; r >= 0; r--) {
                      for (n = 1e7 - 1, g[r + c] !== p && (n = Math.floor((1e7 * g[r + c] + g[r + c - 1]) / p)), o = 0, i = 0, s = m.length, a = 0; a < s; a++)
                        (o += n * m[a]),
                          (l = Math.floor(o / 1e7)),
                          (i += g[r + a] - (o - 1e7 * l)),
                          (o = l),
                          i < 0 ? ((g[r + a] = i + 1e7), (i = -1)) : ((g[r + a] = i), (i = 0));
                      for (; 0 !== i; ) {
                        for (n -= 1, o = 0, a = 0; a < s; a++) (o += g[r + a] - 1e7 + m[a]) < 0 ? ((g[r + a] = o + 1e7), (o = 0)) : ((g[r + a] = o), (o = 1));
                        i += o;
                      }
                      f[r] = n;
                    }
                    return (g = j(g, _)[0]), [d(f), d(g)];
                  })(_, g)
                : (function (e, t) {
                    for (var n, r, o, i, a, s = e.length, l = t.length, u = [], c = []; s; ) {
                      if ((c.unshift(e[--s]), f(c), 0 > S(c, t))) {
                        u.push(0);
                        continue;
                      }
                      (r = c.length), (o = 1e7 * c[r - 1] + c[r - 2]), (i = 1e7 * t[l - 1] + t[l - 2]), r > l && (o = (o + 1) * 1e7), (n = Math.ceil(o / i));
                      do {
                        if (0 >= S((a = x(t, n)), c)) break;
                        n--;
                      } while (n);
                      u.push(n), (c = v(c, a));
                    }
                    return u.reverse(), [d(u), d(c)];
                  })(_, g))[0];
            var w = e.sign !== u.sign,
              k = r[1],
              M = e.sign;
            return (
              "number" == typeof n ? (w && (n = -n), (n = new s(n))) : (n = new a(n, w)),
              "number" == typeof k ? (M && (k = -k), (k = new s(k))) : (k = new a(k, M)),
              [n, k]
            );
          }
          function S(e, t) {
            if (e.length !== t.length) return e.length > t.length ? 1 : -1;
            for (var n = e.length - 1; n >= 0; n--) if (e[n] !== t[n]) return e[n] > t[n] ? 1 : -1;
            return 0;
          }
          function T(e) {
            var t = e.abs();
            return (
              !t.isUnit() &&
              (!!(t.equals(2) || t.equals(3) || t.equals(5)) || (!(t.isEven() || t.isDivisibleBy(3) || t.isDivisibleBy(5)) && (!!t.lesser(49) || void 0)))
            );
          }
          function C(e, t) {
            for (var n, o, i, a = e.prev(), s = a, l = 0; s.isEven(); ) (s = s.divide(2)), l++;
            e: for (o = 0; o < t.length; o++)
              if (!e.lesser(t[o]) && !((i = r(t[o]).modPow(s, e)).isUnit() || i.equals(a))) {
                for (n = l - 1; 0 != n && !(i = i.square().mod(e)).isUnit(); n--) if (i.equals(a)) continue e;
                return !1;
              }
            return !0;
          }
          (a.prototype = Object.create(i.prototype)),
            (s.prototype = Object.create(i.prototype)),
            (l.prototype = Object.create(i.prototype)),
            (a.prototype.add = function (e) {
              var t = H(e);
              if (this.sign !== t.sign) return this.subtract(t.negate());
              var n = this.value,
                r = t.value;
              return t.isSmall ? new a(m(n, Math.abs(r)), this.sign) : new a(g(n, r), this.sign);
            }),
            (a.prototype.plus = a.prototype.add),
            (s.prototype.add = function (e) {
              var t = H(e),
                n = this.value;
              if (n < 0 !== t.sign) return this.subtract(t.negate());
              var r = t.value;
              if (t.isSmall) {
                if (u(n + r)) return new s(n + r);
                r = c(Math.abs(r));
              }
              return new a(m(r, Math.abs(n)), n < 0);
            }),
            (s.prototype.plus = s.prototype.add),
            (l.prototype.add = function (e) {
              return new l(this.value + H(e).value);
            }),
            (l.prototype.plus = l.prototype.add),
            (a.prototype.subtract = function (e) {
              var t,
                n,
                r = H(e);
              if (this.sign !== r.sign) return this.add(r.negate());
              var o = this.value,
                i = r.value;
              return r.isSmall
                ? y(o, Math.abs(i), this.sign)
                : ((t = this.sign),
                  (S(o, i) >= 0 ? (n = v(o, i)) : ((n = v(i, o)), (t = !t)), "number" == typeof (n = d(n))) ? (t && (n = -n), new s(n)) : new a(n, t));
            }),
            (a.prototype.minus = a.prototype.subtract),
            (s.prototype.subtract = function (e) {
              var t = H(e),
                n = this.value;
              if (n < 0 !== t.sign) return this.add(t.negate());
              var r = t.value;
              return t.isSmall ? new s(n - r) : y(r, Math.abs(n), n >= 0);
            }),
            (s.prototype.minus = s.prototype.subtract),
            (l.prototype.subtract = function (e) {
              return new l(this.value - H(e).value);
            }),
            (l.prototype.minus = l.prototype.subtract),
            (a.prototype.negate = function () {
              return new a(this.value, !this.sign);
            }),
            (s.prototype.negate = function () {
              var e = this.sign,
                t = new s(-this.value);
              return (t.sign = !e), t;
            }),
            (l.prototype.negate = function () {
              return new l(-this.value);
            }),
            (a.prototype.abs = function () {
              return new a(this.value, !1);
            }),
            (s.prototype.abs = function () {
              return new s(Math.abs(this.value));
            }),
            (l.prototype.abs = function () {
              return new l(this.value >= 0 ? this.value : -this.value);
            }),
            (a.prototype.multiply = function (e) {
              var t,
                n,
                r,
                o = H(e),
                s = this.value,
                l = o.value,
                u = this.sign !== o.sign;
              if (o.isSmall) {
                if (0 === l) return i[0];
                if (1 === l) return this;
                if (-1 === l) return this.negate();
                if ((r = Math.abs(l)) < 1e7) return new a(x(s, r), u);
                l = c(r);
              }
              return -0.012 * (t = s.length) - 0.012 * (n = l.length) + 15e-6 * t * n > 0
                ? new a(
                    (function e(t, n) {
                      var r = Math.max(t.length, n.length);
                      if (r <= 30) return b(t, n);
                      r = Math.ceil(r / 2);
                      var o = t.slice(r),
                        i = t.slice(0, r),
                        a = n.slice(r),
                        s = n.slice(0, r),
                        l = e(i, s),
                        u = e(o, a),
                        c = e(g(i, o), g(s, a)),
                        d = g(g(l, w(v(v(c, l), u), r)), w(u, 2 * r));
                      return f(d), d;
                    })(s, l),
                    u
                  )
                : new a(b(s, l), u);
            }),
            (a.prototype.times = a.prototype.multiply),
            (s.prototype._multiplyBySmall = function (e) {
              return u(e.value * this.value) ? new s(e.value * this.value) : k(Math.abs(e.value), c(Math.abs(this.value)), this.sign !== e.sign);
            }),
            (a.prototype._multiplyBySmall = function (e) {
              return 0 === e.value ? i[0] : 1 === e.value ? this : -1 === e.value ? this.negate() : k(Math.abs(e.value), this.value, this.sign !== e.sign);
            }),
            (s.prototype.multiply = function (e) {
              return H(e)._multiplyBySmall(this);
            }),
            (s.prototype.times = s.prototype.multiply),
            (l.prototype.multiply = function (e) {
              return new l(this.value * H(e).value);
            }),
            (l.prototype.times = l.prototype.multiply),
            (a.prototype.square = function () {
              return new a(M(this.value), !1);
            }),
            (s.prototype.square = function () {
              var e = this.value * this.value;
              return u(e) ? new s(e) : new a(M(c(Math.abs(this.value))), !1);
            }),
            (l.prototype.square = function (e) {
              return new l(this.value * this.value);
            }),
            (a.prototype.divmod = function (e) {
              var t = E(this, e);
              return { quotient: t[0], remainder: t[1] };
            }),
            (l.prototype.divmod = s.prototype.divmod = a.prototype.divmod),
            (a.prototype.divide = function (e) {
              return E(this, e)[0];
            }),
            (l.prototype.over = l.prototype.divide =
              function (e) {
                return new l(this.value / H(e).value);
              }),
            (s.prototype.over = s.prototype.divide = a.prototype.over = a.prototype.divide),
            (a.prototype.mod = function (e) {
              return E(this, e)[1];
            }),
            (l.prototype.mod = l.prototype.remainder =
              function (e) {
                return new l(this.value % H(e).value);
              }),
            (s.prototype.remainder = s.prototype.mod = a.prototype.remainder = a.prototype.mod),
            (a.prototype.pow = function (e) {
              var t,
                n,
                r,
                o = H(e),
                a = this.value,
                l = o.value;
              if (0 === l) return i[1];
              if (0 === a) return i[0];
              if (1 === a) return i[1];
              if (-1 === a) return o.isEven() ? i[1] : i[-1];
              if (o.sign) return i[0];
              if (!o.isSmall) throw Error("The exponent " + o.toString() + " is too large.");
              if (this.isSmall && u((t = Math.pow(a, l)))) return new s(p(t));
              for (n = this, r = i[1]; !0 & l && ((r = r.times(n)), --l), 0 !== l; ) (l /= 2), (n = n.square());
              return r;
            }),
            (s.prototype.pow = a.prototype.pow),
            (l.prototype.pow = function (e) {
              var t = H(e),
                n = this.value,
                r = t.value,
                o = BigInt(0),
                a = BigInt(1),
                s = BigInt(2);
              if (r === o) return i[1];
              if (n === o) return i[0];
              if (n === a) return i[1];
              if (n === BigInt(-1)) return t.isEven() ? i[1] : i[-1];
              if (t.isNegative()) return new l(o);
              for (var u = this, c = i[1]; (r & a) === a && ((c = c.times(u)), --r), r !== o; ) (r /= s), (u = u.square());
              return c;
            }),
            (a.prototype.modPow = function (e, t) {
              if (((e = H(e)), (t = H(t)).isZero())) throw Error("Cannot take modPow with modulus 0");
              var n = i[1],
                r = this.mod(t);
              for (e.isNegative() && ((e = e.multiply(i[-1])), (r = r.modInv(t))); e.isPositive(); ) {
                if (r.isZero()) return i[0];
                e.isOdd() && (n = n.multiply(r).mod(t)), (e = e.divide(2)), (r = r.square().mod(t));
              }
              return n;
            }),
            (l.prototype.modPow = s.prototype.modPow = a.prototype.modPow),
            (a.prototype.compareAbs = function (e) {
              var t = H(e),
                n = this.value,
                r = t.value;
              return t.isSmall ? 1 : S(n, r);
            }),
            (s.prototype.compareAbs = function (e) {
              var t = H(e),
                n = Math.abs(this.value),
                r = t.value;
              return t.isSmall ? (n === (r = Math.abs(r)) ? 0 : n > r ? 1 : -1) : -1;
            }),
            (l.prototype.compareAbs = function (e) {
              var t = this.value,
                n = H(e).value;
              return (t = t >= 0 ? t : -t) === (n = n >= 0 ? n : -n) ? 0 : t > n ? 1 : -1;
            }),
            (a.prototype.compare = function (e) {
              if (e === 1 / 0) return -1;
              if (e === -1 / 0) return 1;
              var t = H(e),
                n = this.value,
                r = t.value;
              return this.sign !== t.sign ? (t.sign ? 1 : -1) : t.isSmall ? (this.sign ? -1 : 1) : S(n, r) * (this.sign ? -1 : 1);
            }),
            (a.prototype.compareTo = a.prototype.compare),
            (s.prototype.compare = function (e) {
              if (e === 1 / 0) return -1;
              if (e === -1 / 0) return 1;
              var t = H(e),
                n = this.value,
                r = t.value;
              return t.isSmall ? (n == r ? 0 : n > r ? 1 : -1) : n < 0 !== t.sign ? (n < 0 ? -1 : 1) : n < 0 ? 1 : -1;
            }),
            (s.prototype.compareTo = s.prototype.compare),
            (l.prototype.compare = function (e) {
              if (e === 1 / 0) return -1;
              if (e === -1 / 0) return 1;
              var t = this.value,
                n = H(e).value;
              return t === n ? 0 : t > n ? 1 : -1;
            }),
            (l.prototype.compareTo = l.prototype.compare),
            (a.prototype.equals = function (e) {
              return 0 === this.compare(e);
            }),
            (l.prototype.eq = l.prototype.equals = s.prototype.eq = s.prototype.equals = a.prototype.eq = a.prototype.equals),
            (a.prototype.notEquals = function (e) {
              return 0 !== this.compare(e);
            }),
            (l.prototype.neq = l.prototype.notEquals = s.prototype.neq = s.prototype.notEquals = a.prototype.neq = a.prototype.notEquals),
            (a.prototype.greater = function (e) {
              return this.compare(e) > 0;
            }),
            (l.prototype.gt = l.prototype.greater = s.prototype.gt = s.prototype.greater = a.prototype.gt = a.prototype.greater),
            (a.prototype.lesser = function (e) {
              return 0 > this.compare(e);
            }),
            (l.prototype.lt = l.prototype.lesser = s.prototype.lt = s.prototype.lesser = a.prototype.lt = a.prototype.lesser),
            (a.prototype.greaterOrEquals = function (e) {
              return this.compare(e) >= 0;
            }),
            (l.prototype.geq = l.prototype.greaterOrEquals = s.prototype.geq = s.prototype.greaterOrEquals = a.prototype.geq = a.prototype.greaterOrEquals),
            (a.prototype.lesserOrEquals = function (e) {
              return 0 >= this.compare(e);
            }),
            (l.prototype.leq = l.prototype.lesserOrEquals = s.prototype.leq = s.prototype.lesserOrEquals = a.prototype.leq = a.prototype.lesserOrEquals),
            (a.prototype.isEven = function () {
              return (1 & this.value[0]) == 0;
            }),
            (s.prototype.isEven = function () {
              return (1 & this.value) == 0;
            }),
            (l.prototype.isEven = function () {
              return (this.value & BigInt(1)) === BigInt(0);
            }),
            (a.prototype.isOdd = function () {
              return (1 & this.value[0]) == 1;
            }),
            (s.prototype.isOdd = function () {
              return (1 & this.value) == 1;
            }),
            (l.prototype.isOdd = function () {
              return (this.value & BigInt(1)) === BigInt(1);
            }),
            (a.prototype.isPositive = function () {
              return !this.sign;
            }),
            (s.prototype.isPositive = function () {
              return this.value > 0;
            }),
            (l.prototype.isPositive = s.prototype.isPositive),
            (a.prototype.isNegative = function () {
              return this.sign;
            }),
            (s.prototype.isNegative = function () {
              return this.value < 0;
            }),
            (l.prototype.isNegative = s.prototype.isNegative),
            (a.prototype.isUnit = function () {
              return !1;
            }),
            (s.prototype.isUnit = function () {
              return 1 === Math.abs(this.value);
            }),
            (l.prototype.isUnit = function () {
              return this.abs().value === BigInt(1);
            }),
            (a.prototype.isZero = function () {
              return !1;
            }),
            (s.prototype.isZero = function () {
              return 0 === this.value;
            }),
            (l.prototype.isZero = function () {
              return this.value === BigInt(0);
            }),
            (a.prototype.isDivisibleBy = function (e) {
              var t = H(e);
              return !t.isZero() && (!!t.isUnit() || (0 === t.compareAbs(2) ? this.isEven() : this.mod(t).isZero()));
            }),
            (l.prototype.isDivisibleBy = s.prototype.isDivisibleBy = a.prototype.isDivisibleBy),
            (a.prototype.isPrime = function (e) {
              var t = T(this);
              if (void 0 !== t) return t;
              var n = this.abs(),
                o = n.bitLength();
              if (o <= 64) return C(n, [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37]);
              for (var i = Math.log(2) * o.toJSNumber(), a = Math.ceil(!0 === e ? 2 * Math.pow(i, 2) : i), s = [], l = 0; l < a; l++) s.push(r(l + 2));
              return C(n, s);
            }),
            (l.prototype.isPrime = s.prototype.isPrime = a.prototype.isPrime),
            (a.prototype.isProbablePrime = function (t, n) {
              var o = T(this);
              if (void 0 !== o) return o;
              for (var i = this.abs(), a = e === t ? 5 : t, s = [], l = 0; l < a; l++) s.push(r.randBetween(2, i.minus(2), n));
              return C(i, s);
            }),
            (l.prototype.isProbablePrime = s.prototype.isProbablePrime = a.prototype.isProbablePrime),
            (a.prototype.modInv = function (e) {
              for (var t, n, o, i = r.zero, a = r.one, s = H(e), l = this.abs(); !l.isZero(); )
                (t = s.divide(l)), (n = i), (o = s), (i = a), (s = l), (a = n.subtract(t.multiply(a))), (l = o.subtract(t.multiply(l)));
              if (!s.isUnit()) throw Error(this.toString() + " and " + e.toString() + " are not co-prime");
              return (-1 === i.compare(0) && (i = i.add(e)), this.isNegative()) ? i.negate() : i;
            }),
            (l.prototype.modInv = s.prototype.modInv = a.prototype.modInv),
            (a.prototype.next = function () {
              var e = this.value;
              return this.sign ? y(e, 1, this.sign) : new a(m(e, 1), this.sign);
            }),
            (s.prototype.next = function () {
              var e = this.value;
              return e + 1 < 0x20000000000000 ? new s(e + 1) : new a(t, !1);
            }),
            (l.prototype.next = function () {
              return new l(this.value + BigInt(1));
            }),
            (a.prototype.prev = function () {
              var e = this.value;
              return this.sign ? new a(m(e, 1), !0) : y(e, 1, this.sign);
            }),
            (s.prototype.prev = function () {
              var e = this.value;
              return e - 1 > -0x20000000000000 ? new s(e - 1) : new a(t, !0);
            }),
            (l.prototype.prev = function () {
              return new l(this.value - BigInt(1));
            });
          for (var P = [1]; 2 * P[P.length - 1] <= 1e7; ) P.push(2 * P[P.length - 1]);
          var N = P.length,
            A = P[N - 1];
          function O(e) {
            return 1e7 >= Math.abs(e);
          }
          function $(e, t, n) {
            t = H(t);
            for (
              var o = e.isNegative(), i = t.isNegative(), a = o ? e.not() : e, s = i ? t.not() : t, l = 0, u = 0, c = null, d = null, f = [];
              !a.isZero() || !s.isZero();

            )
              (l = (c = E(a, A))[1].toJSNumber()),
                o && (l = A - 1 - l),
                (u = (d = E(s, A))[1].toJSNumber()),
                i && (u = A - 1 - u),
                (a = c[0]),
                (s = d[0]),
                f.push(n(l, u));
            for (var h = 0 !== n(+!!o, +!!i) ? r(-1) : r(0), p = f.length - 1; p >= 0; p -= 1) h = h.multiply(A).add(r(f[p]));
            return h;
          }
          (a.prototype.shiftLeft = function (e) {
            var t = H(e).toJSNumber();
            if (!O(t)) throw Error(String(t) + " is too large for shifting.");
            if (t < 0) return this.shiftRight(-t);
            var n = this;
            if (n.isZero()) return n;
            for (; t >= N; ) (n = n.multiply(A)), (t -= N - 1);
            return n.multiply(P[t]);
          }),
            (l.prototype.shiftLeft = s.prototype.shiftLeft = a.prototype.shiftLeft),
            (a.prototype.shiftRight = function (e) {
              var t,
                n = H(e).toJSNumber();
              if (!O(n)) throw Error(String(n) + " is too large for shifting.");
              if (n < 0) return this.shiftLeft(-n);
              for (var r = this; n >= N; ) {
                if (r.isZero() || (r.isNegative() && r.isUnit())) return r;
                (r = (t = E(r, A))[1].isNegative() ? t[0].prev() : t[0]), (n -= N - 1);
              }
              return (t = E(r, P[n]))[1].isNegative() ? t[0].prev() : t[0];
            }),
            (l.prototype.shiftRight = s.prototype.shiftRight = a.prototype.shiftRight),
            (a.prototype.not = function () {
              return this.negate().prev();
            }),
            (l.prototype.not = s.prototype.not = a.prototype.not),
            (a.prototype.and = function (e) {
              return $(this, e, function (e, t) {
                return e & t;
              });
            }),
            (l.prototype.and = s.prototype.and = a.prototype.and),
            (a.prototype.or = function (e) {
              return $(this, e, function (e, t) {
                return e | t;
              });
            }),
            (l.prototype.or = s.prototype.or = a.prototype.or),
            (a.prototype.xor = function (e) {
              return $(this, e, function (e, t) {
                return e ^ t;
              });
            }),
            (l.prototype.xor = s.prototype.xor = a.prototype.xor);
          function D(e) {
            var t = e.value,
              n = "number" == typeof t ? 0x40000000 | t : "bigint" == typeof t ? t | BigInt(0x40000000) : (t[0] + 1e7 * t[1]) | 0x40004000;
            return n & -n;
          }
          function z(e, t) {
            return (e = H(e)), (t = H(t)), e.greater(t) ? e : t;
          }
          function R(e, t) {
            return (e = H(e)), (t = H(t)), e.lesser(t) ? e : t;
          }
          function L(e, t) {
            if (((e = H(e).abs()), (t = H(t).abs()), e.equals(t))) return e;
            if (e.isZero()) return t;
            if (t.isZero()) return e;
            for (var n, r, o = i[1]; e.isEven() && t.isEven(); ) (n = R(D(e), D(t))), (e = e.divide(n)), (t = t.divide(n)), (o = o.multiply(n));
            for (; e.isEven(); ) e = e.divide(D(e));
            do {
              for (; t.isEven(); ) t = t.divide(D(t));
              e.greater(t) && ((r = t), (t = e), (e = r)), (t = t.subtract(e));
            } while (!t.isZero());
            return o.isUnit() ? e : e.multiply(o);
          }
          (a.prototype.bitLength = function () {
            var e = this;
            return (0 > e.compareTo(r(0)) && (e = e.negate().subtract(r(1))), 0 === e.compareTo(r(0)))
              ? r(0)
              : r(
                  (function e(t, n) {
                    if (0 >= n.compareTo(t)) {
                      var o = e(t, n.square(n)),
                        i = o.p,
                        a = o.e,
                        s = i.multiply(n);
                      return 0 >= s.compareTo(t) ? { p: s, e: 2 * a + 1 } : { p: i, e: 2 * a };
                    }
                    return { p: r(1), e: 0 };
                  })(e, r(2)).e
                ).add(r(1));
          }),
            (l.prototype.bitLength = s.prototype.bitLength = a.prototype.bitLength);
          var F = function (e, t, r, o) {
            (r = r || n), (e = String(e)), o || ((e = e.toLowerCase()), (r = r.toLowerCase()));
            var i,
              a = e.length,
              s = Math.abs(t),
              l = {};
            for (i = 0; i < r.length; i++) l[r[i]] = i;
            for (i = 0; i < a; i++) {
              var u = e[i];
              if ("-" !== u && u in l && l[u] >= s) {
                if ("1" === u && 1 === s) continue;
                throw Error(u + " is not a valid digit in base " + t + ".");
              }
            }
            t = H(t);
            var c = [],
              d = "-" === e[0];
            for (i = +!!d; i < e.length; i++) {
              var u = e[i];
              if (u in l) c.push(H(l[u]));
              else if ("<" === u) {
                var f = i;
                do i++;
                while (">" !== e[i] && i < e.length);
                c.push(H(e.slice(f + 1, i)));
              } else throw Error(u + " is not a valid character");
            }
            return I(c, t, d);
          };
          function I(e, t, n) {
            var r,
              o = i[0],
              a = i[1];
            for (r = e.length - 1; r >= 0; r--) (o = o.add(e[r].times(a))), (a = a.times(t));
            return n ? o.negate() : o;
          }
          function B(e, t) {
            if ((t = r(t)).isZero()) {
              if (e.isZero()) return { value: [0], isNegative: !1 };
              throw Error("Cannot convert nonzero numbers to base 0.");
            }
            if (t.equals(-1)) {
              if (e.isZero()) return { value: [0], isNegative: !1 };
              if (e.isNegative())
                return { value: [].concat.apply([], Array.apply(null, Array(-e.toJSNumber())).map(Array.prototype.valueOf, [1, 0])), isNegative: !1 };
              var n = Array.apply(null, Array(e.toJSNumber() - 1)).map(Array.prototype.valueOf, [0, 1]);
              return n.unshift([1]), { value: [].concat.apply([], n), isNegative: !1 };
            }
            var o = !1;
            if ((e.isNegative() && t.isPositive() && ((o = !0), (e = e.abs())), t.isUnit()))
              return e.isZero()
                ? { value: [0], isNegative: !1 }
                : { value: Array.apply(null, Array(e.toJSNumber())).map(Number.prototype.valueOf, 1), isNegative: o };
            for (var i, a = [], s = e; s.isNegative() || s.compareAbs(t) >= 0; ) {
              s = (i = s.divmod(t)).quotient;
              var l = i.remainder;
              l.isNegative() && ((l = t.minus(l).abs()), (s = s.next())), a.push(l.toJSNumber());
            }
            return a.push(s.toJSNumber()), { value: a.reverse(), isNegative: o };
          }
          function U(e, t, r) {
            var o = B(e, t);
            return (
              (o.isNegative ? "-" : "") +
              o.value
                .map(function (e) {
                  var t;
                  return e < (t = (t = r) || n).length ? t[e] : "<" + e + ">";
                })
                .join("")
            );
          }
          function q(e) {
            if (u(+e)) {
              var t = +e;
              if (t === p(t)) return o ? new l(BigInt(t)) : new s(t);
              throw Error("Invalid integer: " + e);
            }
            var n = "-" === e[0];
            n && (e = e.slice(1));
            var r = e.split(/e/i);
            if (r.length > 2) throw Error("Invalid integer: " + r.join("e"));
            if (2 === r.length) {
              var i = r[1];
              if (("+" === i[0] && (i = i.slice(1)), (i *= 1) !== p(i) || !u(i))) throw Error("Invalid integer: " + i + " is not a valid exponent.");
              var c = r[0],
                d = c.indexOf(".");
              if ((d >= 0 && ((i -= c.length - d - 1), (c = c.slice(0, d) + c.slice(d + 1))), i < 0))
                throw Error("Cannot include negative exponent part for integers");
              (c += Array(i + 1).join("0")), (e = c);
            }
            if (!/^([0-9][0-9]*)$/.test(e)) throw Error("Invalid integer: " + e);
            if (o) return new l(BigInt(n ? "-" + e : e));
            for (var h = [], _ = e.length, g = _ - 7; _ > 0; ) h.push(+e.slice(g, _)), (g -= 7) < 0 && (g = 0), (_ -= 7);
            return f(h), new a(h, n);
          }
          function H(e) {
            return "number" == typeof e
              ? (function (e) {
                  if (o) return new l(BigInt(e));
                  if (u(e)) {
                    if (e !== p(e)) throw Error(e + " is not an integer.");
                    return new s(e);
                  }
                  return q(e.toString());
                })(e)
              : "string" == typeof e
                ? q(e)
                : "bigint" == typeof e
                  ? new l(e)
                  : e;
          }
          (a.prototype.toArray = function (e) {
            return B(this, e);
          }),
            (s.prototype.toArray = function (e) {
              return B(this, e);
            }),
            (l.prototype.toArray = function (e) {
              return B(this, e);
            }),
            (a.prototype.toString = function (t, n) {
              if ((e === t && (t = 10), 10 !== t)) return U(this, t, n);
              for (var r, o = this.value, i = o.length, a = String(o[--i]); --i >= 0; ) (r = String(o[i])), (a += "0000000".slice(r.length) + r);
              return (this.sign ? "-" : "") + a;
            }),
            (s.prototype.toString = function (t, n) {
              return (e === t && (t = 10), 10 != t) ? U(this, t, n) : String(this.value);
            }),
            (l.prototype.toString = s.prototype.toString),
            (l.prototype.toJSON =
              a.prototype.toJSON =
              s.prototype.toJSON =
                function () {
                  return this.toString();
                }),
            (a.prototype.valueOf = function () {
              return parseInt(this.toString(), 10);
            }),
            (a.prototype.toJSNumber = a.prototype.valueOf),
            (s.prototype.valueOf = function () {
              return this.value;
            }),
            (s.prototype.toJSNumber = s.prototype.valueOf),
            (l.prototype.valueOf = l.prototype.toJSNumber =
              function () {
                return parseInt(this.toString(), 10);
              });
          for (var Y = 0; Y < 1e3; Y++) (i[Y] = H(Y)), Y > 0 && (i[-Y] = H(-Y));
          return (
            (i.one = i[1]),
            (i.zero = i[0]),
            (i.minusOne = i[-1]),
            (i.max = z),
            (i.min = R),
            (i.gcd = L),
            (i.lcm = function (e, t) {
              return (e = H(e).abs()), (t = H(t).abs()), e.divide(L(e, t)).multiply(t);
            }),
            (i.isInstance = function (e) {
              return e instanceof a || e instanceof s || e instanceof l;
            }),
            (i.randBetween = function (e, t, n) {
              e = H(e);
              var r = n || Math.random,
                o = R(e, (t = H(t))),
                a = z(e, t).subtract(o).add(1);
              if (a.isSmall) return o.add(Math.floor(r() * a));
              for (var s = B(a, 1e7).value, l = [], u = !0, c = 0; c < s.length; c++) {
                var d = u ? s[c] + (c + 1 < s.length ? s[c + 1] / 1e7 : 0) : 1e7,
                  f = p(r() * d);
                l.push(f), f < s[c] && (u = !1);
              }
              return o.add(i.fromArray(l, 1e7, !1));
            }),
            (i.fromArray = function (e, t, n) {
              return I(e.map(H), H(t || 10), n);
            }),
            i
          );
        })();
        e.hasOwnProperty("exports") && (e.exports = r),
          "function" == typeof define &&
            define.amd &&
            define(function () {
              return r;
            });
      },
      65712: function (e, t, n) {
        "use strict";
        n.r(t), n.d(t, { focusable: () => M, isFocusable: () => S, isTabbable: () => j, tabbable: () => k });
        var r = [
            "input",
            "select",
            "textarea",
            "a[href]",
            "button",
            "[tabindex]:not(slot)",
            "audio[controls]",
            "video[controls]",
            '[contenteditable]:not([contenteditable="false"])',
            "details>summary:first-of-type",
            "details"
          ],
          o = r.join(","),
          i = "undefined" == typeof Element,
          a = i ? function () {} : Element.prototype.matches || Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector,
          s =
            !i && Element.prototype.getRootNode
              ? function (e) {
                  return e.getRootNode();
                }
              : function (e) {
                  return e.ownerDocument;
                },
          l = function (e, t, n) {
            var r = Array.prototype.slice.apply(e.querySelectorAll(o));
            return t && a.call(e, o) && r.unshift(e), (r = r.filter(n));
          },
          u = function e(t, n, r) {
            for (var i = [], s = Array.from(t); s.length; ) {
              var l = s.shift();
              if ("SLOT" === l.tagName) {
                var u = l.assignedElements(),
                  c = e(u.length ? u : l.children, !0, r);
                r.flatten ? i.push.apply(i, c) : i.push({ scope: l, candidates: c });
              } else {
                a.call(l, o) && r.filter(l) && (n || !t.includes(l)) && i.push(l);
                var d = l.shadowRoot || ("function" == typeof r.getShadowRoot && r.getShadowRoot(l)),
                  f = !r.shadowRootFilter || r.shadowRootFilter(l);
                if (d && f) {
                  var h = e(!0 === d ? l.children : d.children, !0, r);
                  r.flatten ? i.push.apply(i, h) : i.push({ scope: l, candidates: h });
                } else s.unshift.apply(s, l.children);
              }
            }
            return i;
          },
          c = function (e, t) {
            return e.tabIndex < 0 && (t || /^(AUDIO|VIDEO|DETAILS)$/.test(e.tagName) || e.isContentEditable) && isNaN(parseInt(e.getAttribute("tabindex"), 10))
              ? 0
              : e.tabIndex;
          },
          d = function (e, t) {
            return e.tabIndex === t.tabIndex ? e.documentOrder - t.documentOrder : e.tabIndex - t.tabIndex;
          },
          f = function (e) {
            return "INPUT" === e.tagName;
          },
          h = function (e, t) {
            for (var n = 0; n < e.length; n++) if (e[n].checked && e[n].form === t) return e[n];
          },
          p = function (e) {
            if (!e.name) return !0;
            var t,
              n = e.form || s(e),
              r = function (e) {
                return n.querySelectorAll('input[type="radio"][name="' + e + '"]');
              };
            if ("undefined" != typeof window && void 0 !== window.CSS && "function" == typeof window.CSS.escape) t = r(window.CSS.escape(e.name));
            else
              try {
                t = r(e.name);
              } catch (e) {
                return (
                  console.error(
                    "Looks like you have a radio button with a name attribute containing invalid CSS selector characters and need the CSS.escape polyfill: %s",
                    e.message
                  ),
                  !1
                );
              }
            var o = h(t, e.form);
            return !o || o === e;
          },
          _ = function (e) {
            return f(e) && "radio" === e.type && !p(e);
          },
          g = function (e) {
            var t = e.getBoundingClientRect(),
              n = t.width,
              r = t.height;
            return 0 === n && 0 === r;
          },
          m = function (e, t) {
            var n = t.displayCheck,
              r = t.getShadowRoot;
            if ("hidden" === getComputedStyle(e).visibility) return !0;
            var o = a.call(e, "details>summary:first-of-type") ? e.parentElement : e;
            if (a.call(o, "details:not([open]) *")) return !0;
            var i = s(e).host,
              l = (null == i ? void 0 : i.ownerDocument.contains(i)) || e.ownerDocument.contains(e);
            if (n && "full" !== n) {
              if ("non-zero-area" === n) return g(e);
            } else {
              if ("function" == typeof r) {
                for (var u = e; e; ) {
                  var c = e.parentElement,
                    d = s(e);
                  if (c && !c.shadowRoot && !0 === r(c)) return g(e);
                  e = e.assignedSlot ? e.assignedSlot : c || d === e.ownerDocument ? c : d.host;
                }
                e = u;
              }
              if (l) return !e.getClientRects().length;
            }
            return !1;
          },
          v = function (e) {
            if (/^(INPUT|BUTTON|SELECT|TEXTAREA)$/.test(e.tagName))
              for (var t = e.parentElement; t; ) {
                if ("FIELDSET" === t.tagName && t.disabled) {
                  for (var n = 0; n < t.children.length; n++) {
                    var r = t.children.item(n);
                    if ("LEGEND" === r.tagName) return !!a.call(t, "fieldset[disabled] *") || !r.contains(e);
                  }
                  return !0;
                }
                t = t.parentElement;
              }
            return !1;
          },
          y = function (e, t) {
            return !(
              t.disabled ||
              (f(t) && "hidden" === t.type) ||
              m(t, e) ||
              ("DETAILS" === t.tagName &&
                Array.prototype.slice.apply(t.children).some(function (e) {
                  return "SUMMARY" === e.tagName;
                })) ||
              v(t)
            );
          },
          b = function (e, t) {
            return !(_(t) || 0 > c(t)) && !!y(e, t);
          },
          x = function (e) {
            var t = parseInt(e.getAttribute("tabindex"), 10);
            return !!isNaN(t) || !!(t >= 0);
          },
          w = function e(t) {
            var n = [],
              r = [];
            return (
              t.forEach(function (t, o) {
                var i = !!t.scope,
                  a = i ? t.scope : t,
                  s = c(a, i),
                  l = i ? e(t.candidates) : a;
                0 === s ? (i ? n.push.apply(n, l) : n.push(a)) : r.push({ documentOrder: o, tabIndex: s, item: t, isScope: i, content: l });
              }),
              r
                .sort(d)
                .reduce(function (e, t) {
                  return t.isScope ? e.push.apply(e, t.content) : e.push(t.content), e;
                }, [])
                .concat(n)
            );
          },
          k = function (e, t) {
            var n;
            return w(
              (t = t || {}).getShadowRoot
                ? u([e], t.includeContainer, { filter: b.bind(null, t), flatten: !1, getShadowRoot: t.getShadowRoot, shadowRootFilter: x })
                : l(e, t.includeContainer, b.bind(null, t))
            );
          },
          M = function (e, t) {
            var n;
            return (t = t || {}).getShadowRoot
              ? u([e], t.includeContainer, { filter: y.bind(null, t), flatten: !0, getShadowRoot: t.getShadowRoot })
              : l(e, t.includeContainer, y.bind(null, t));
          },
          j = function (e, t) {
            if (((t = t || {}), !e)) throw Error("No node provided");
            return !1 !== a.call(e, o) && b(t, e);
          },
          E = r.concat("iframe").join(","),
          S = function (e, t) {
            if (((t = t || {}), !e)) throw Error("No node provided");
            return !1 !== a.call(e, E) && y(t, e);
          };
      },
      36614: function (e) {
        !(function () {
          "use strict";
          var t = {}.hasOwnProperty;
          function n() {
            for (var e = "", o = 0; o < arguments.length; o++) {
              var i = arguments[o];
              i &&
                (e = r(
                  e,
                  (function (e) {
                    if ("string" == typeof e || "number" == typeof e) return e;
                    if ("object" != typeof e) return "";
                    if (Array.isArray(e)) return n.apply(null, e);
                    if (e.toString !== Object.prototype.toString && !e.toString.toString().includes("[native code]")) return e.toString();
                    var o = "";
                    for (var i in e) t.call(e, i) && e[i] && (o = r(o, i));
                    return o;
                  })(i)
                ));
            }
            return e;
          }
          function r(e, t) {
            return t ? (e ? e + " " + t : e + t) : e;
          }
          e.exports
            ? ((n.default = n), (e.exports = n))
            : "function" == typeof define && "object" == typeof define.amd && define.amd
              ? define("classnames", [], function () {
                  return n;
                })
              : (window.classNames = n);
        })();
      },
      74616: function (e) {
        !(function () {
          "use strict";
          var t = {}.hasOwnProperty;
          function n() {
            for (var e = "", o = 0; o < arguments.length; o++) {
              var i = arguments[o];
              i &&
                (e = r(
                  e,
                  (function (e) {
                    if ("string" == typeof e || "number" == typeof e) return e;
                    if ("object" != typeof e) return "";
                    if (Array.isArray(e)) return n.apply(null, e);
                    if (e.toString !== Object.prototype.toString && !e.toString.toString().includes("[native code]")) return e.toString();
                    var o = "";
                    for (var i in e) t.call(e, i) && e[i] && (o = r(o, i));
                    return o;
                  })(i)
                ));
            }
            return e;
          }
          function r(e, t) {
            return t ? (e ? e + " " + t : e + t) : e;
          }
          e.exports
            ? ((n.default = n), (e.exports = n))
            : "function" == typeof define && "object" == typeof define.amd && define.amd
              ? define("classnames", [], function () {
                  return n;
                })
              : (window.classNames = n);
        })();
      },
      36735: function (e) {
        !(function () {
          "use strict";
          var t = {}.hasOwnProperty;
          function n() {
            for (var e = "", o = 0; o < arguments.length; o++) {
              var i = arguments[o];
              i &&
                (e = r(
                  e,
                  (function (e) {
                    if ("string" == typeof e || "number" == typeof e) return e;
                    if ("object" != typeof e) return "";
                    if (Array.isArray(e)) return n.apply(null, e);
                    if (e.toString !== Object.prototype.toString && !e.toString.toString().includes("[native code]")) return e.toString();
                    var o = "";
                    for (var i in e) t.call(e, i) && e[i] && (o = r(o, i));
                    return o;
                  })(i)
                ));
            }
            return e;
          }
          function r(e, t) {
            return t ? (e ? e + " " + t : e + t) : e;
          }
          e.exports
            ? ((n.default = n), (e.exports = n))
            : "function" == typeof define && "object" == typeof define.amd && define.amd
              ? define("classnames", [], function () {
                  return n;
                })
              : (window.classNames = n);
        })();
      },
      96845: function (e) {
        e.exports = {
          ES3: {
            break: !0,
            continue: !0,
            delete: !0,
            else: !0,
            for: !0,
            function: !0,
            if: !0,
            in: !0,
            new: !0,
            return: !0,
            this: !0,
            typeof: !0,
            var: !0,
            void: !0,
            while: !0,
            with: !0,
            case: !0,
            catch: !0,
            default: !0,
            do: !0,
            finally: !0,
            instanceof: !0,
            switch: !0,
            throw: !0,
            try: !0
          },
          ESnext: {
            await: !0,
            debugger: !0,
            class: !0,
            enum: !0,
            extends: !0,
            super: !0,
            const: !0,
            export: !0,
            import: !0,
            null: !0,
            true: !0,
            false: !0,
            implements: !0,
            let: !0,
            private: !0,
            public: !0,
            yield: !0,
            interface: !0,
            package: !0,
            protected: !0,
            static: !0
          }
        };
      },
      83660: function (e, t, n) {
        "use strict";
        function r(e, t) {
          if (null == e) return {};
          var n = {};
          for (var r in e)
            if ({}.hasOwnProperty.call(e, r)) {
              if (-1 !== t.indexOf(r)) continue;
              n[r] = e[r];
            }
          return n;
        }
        n.d(t, { Z: () => r });
      },
      95300: function (e, t, n) {
        "use strict";
        function r(e) {
          return (r =
            "function" == typeof Symbol && "symbol" == typeof Symbol.iterator
              ? function (e) {
                  return typeof e;
                }
              : function (e) {
                  return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
                })(e);
        }
        n.d(t, { Z: () => r });
      },
      55803: function (e, t, n) {
        "use strict";
        n.d(t, { U: () => _ });
        var r = n(2784),
          o = n(6806);
        let i = new Map([
          [
            "bold",
            r.createElement(
              r.Fragment,
              null,
              r.createElement("path", {
                d: "M144.49,136.49l-80,80a12,12,0,0,1-17-17L119,128,47.51,56.49a12,12,0,0,1,17-17l80,80A12,12,0,0,1,144.49,136.49Zm80-17-80-80a12,12,0,1,0-17,17L199,128l-71.52,71.51a12,12,0,0,0,17,17l80-80A12,12,0,0,0,224.49,119.51Z"
              })
            )
          ],
          [
            "duotone",
            r.createElement(
              r.Fragment,
              null,
              r.createElement("path", { d: "M136,128,56,208V48Z", opacity: "0.2" }),
              r.createElement("path", {
                d: "M141.66,122.34l-80-80A8,8,0,0,0,48,48V208a8,8,0,0,0,13.66,5.66l80-80A8,8,0,0,0,141.66,122.34ZM64,188.69V67.31L124.69,128Zm157.66-55-80,80a8,8,0,0,1-11.32-11.32L204.69,128,130.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,221.66,133.66Z"
              })
            )
          ],
          [
            "fill",
            r.createElement(
              r.Fragment,
              null,
              r.createElement("path", {
                d: "M221.66,133.66l-80,80A8,8,0,0,1,128,208V147.31L61.66,213.66A8,8,0,0,1,48,208V48a8,8,0,0,1,13.66-5.66L128,108.69V48a8,8,0,0,1,13.66-5.66l80,80A8,8,0,0,1,221.66,133.66Z"
              })
            )
          ],
          [
            "light",
            r.createElement(
              r.Fragment,
              null,
              r.createElement("path", {
                d: "M140.24,132.24l-80,80a6,6,0,0,1-8.48-8.48L127.51,128,51.76,52.24a6,6,0,0,1,8.48-8.48l80,80A6,6,0,0,1,140.24,132.24Zm80-8.48-80-80a6,6,0,0,0-8.48,8.48L207.51,128l-75.75,75.76a6,6,0,1,0,8.48,8.48l80-80A6,6,0,0,0,220.24,123.76Z"
              })
            )
          ],
          [
            "regular",
            r.createElement(
              r.Fragment,
              null,
              r.createElement("path", {
                d: "M141.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L124.69,128,50.34,53.66A8,8,0,0,1,61.66,42.34l80,80A8,8,0,0,1,141.66,133.66Zm80-11.32-80-80a8,8,0,0,0-11.32,11.32L204.69,128l-74.35,74.34a8,8,0,0,0,11.32,11.32l80-80A8,8,0,0,0,221.66,122.34Z"
              })
            )
          ],
          [
            "thin",
            r.createElement(
              r.Fragment,
              null,
              r.createElement("path", {
                d: "M138.83,130.83l-80,80a4,4,0,0,1-5.66-5.66L130.34,128,53.17,50.83a4,4,0,0,1,5.66-5.66l80,80A4,4,0,0,1,138.83,130.83Zm80-5.66-80-80a4,4,0,0,0-5.66,5.66L210.34,128l-77.17,77.17a4,4,0,0,0,5.66,5.66l80-80A4,4,0,0,0,218.83,125.17Z"
              })
            )
          ]
        ]);
        var a = Object.defineProperty,
          s = Object.defineProperties,
          l = Object.getOwnPropertyDescriptors,
          u = Object.getOwnPropertySymbols,
          c = Object.prototype.hasOwnProperty,
          d = Object.prototype.propertyIsEnumerable,
          f = (e, t, n) => (t in e ? a(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : (e[t] = n)),
          h = (e, t) => {
            for (var n in t || (t = {})) c.call(t, n) && f(e, n, t[n]);
            if (u) for (var n of u(t)) d.call(t, n) && f(e, n, t[n]);
            return e;
          },
          p = (e, t) => s(e, l(t));
        let _ = (0, r.forwardRef)((e, t) => r.createElement(o.Z, p(h({ ref: t }, e), { weights: i })));
        _.displayName = "CaretDoubleRight";
      },
      12693: function (e, t, n) {
        "use strict";
        n.d(t, { T: () => _ });
        var r = n(2784),
          o = n(6806);
        let i = new Map([
          [
            "bold",
            r.createElement(
              r.Fragment,
              null,
              r.createElement("path", {
                d: "M128,20A108,108,0,1,0,236,128,108.12,108.12,0,0,0,128,20Zm0,187a113.4,113.4,0,0,1-20.39-35h40.82a116.94,116.94,0,0,1-10,20.77A108.61,108.61,0,0,1,128,207Zm-26.49-59a135.42,135.42,0,0,1,0-40h53a135.42,135.42,0,0,1,0,40ZM44,128a83.49,83.49,0,0,1,2.43-20H77.25a160.63,160.63,0,0,0,0,40H46.43A83.49,83.49,0,0,1,44,128Zm84-79a113.4,113.4,0,0,1,20.39,35H107.59a116.94,116.94,0,0,1,10-20.77A108.61,108.61,0,0,1,128,49Zm50.73,59h30.82a83.52,83.52,0,0,1,0,40H178.75a160.63,160.63,0,0,0,0-40Zm20.77-24H173.71a140.82,140.82,0,0,0-15.5-34.36A84.51,84.51,0,0,1,199.52,84ZM97.79,49.64A140.82,140.82,0,0,0,82.29,84H56.48A84.51,84.51,0,0,1,97.79,49.64ZM56.48,172H82.29a140.82,140.82,0,0,0,15.5,34.36A84.51,84.51,0,0,1,56.48,172Zm101.73,34.36A140.82,140.82,0,0,0,173.71,172h25.81A84.51,84.51,0,0,1,158.21,206.36Z"
              })
            )
          ],
          [
            "duotone",
            r.createElement(
              r.Fragment,
              null,
              r.createElement("path", { d: "M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z", opacity: "0.2" }),
              r.createElement("path", {
                d: "M128,24h0A104,104,0,1,0,232,128,104.12,104.12,0,0,0,128,24Zm88,104a87.61,87.61,0,0,1-3.33,24H174.16a157.44,157.44,0,0,0,0-48h38.51A87.61,87.61,0,0,1,216,128ZM102,168H154a115.11,115.11,0,0,1-26,45A115.27,115.27,0,0,1,102,168Zm-3.9-16a140.84,140.84,0,0,1,0-48h59.88a140.84,140.84,0,0,1,0,48ZM40,128a87.61,87.61,0,0,1,3.33-24H81.84a157.44,157.44,0,0,0,0,48H43.33A87.61,87.61,0,0,1,40,128ZM154,88H102a115.11,115.11,0,0,1,26-45A115.27,115.27,0,0,1,154,88Zm52.33,0H170.71a135.28,135.28,0,0,0-22.3-45.6A88.29,88.29,0,0,1,206.37,88ZM107.59,42.4A135.28,135.28,0,0,0,85.29,88H49.63A88.29,88.29,0,0,1,107.59,42.4ZM49.63,168H85.29a135.28,135.28,0,0,0,22.3,45.6A88.29,88.29,0,0,1,49.63,168Zm98.78,45.6a135.28,135.28,0,0,0,22.3-45.6h35.66A88.29,88.29,0,0,1,148.41,213.6Z"
              })
            )
          ],
          [
            "fill",
            r.createElement(
              r.Fragment,
              null,
              r.createElement("path", {
                d: "M128,24h0A104,104,0,1,0,232,128,104.12,104.12,0,0,0,128,24Zm78.36,64H170.71a135.28,135.28,0,0,0-22.3-45.6A88.29,88.29,0,0,1,206.37,88ZM216,128a87.61,87.61,0,0,1-3.33,24H174.16a157.44,157.44,0,0,0,0-48h38.51A87.61,87.61,0,0,1,216,128ZM128,43a115.27,115.27,0,0,1,26,45H102A115.11,115.11,0,0,1,128,43ZM102,168H154a115.11,115.11,0,0,1-26,45A115.27,115.27,0,0,1,102,168Zm-3.9-16a140.84,140.84,0,0,1,0-48h59.88a140.84,140.84,0,0,1,0,48Zm50.35,61.6a135.28,135.28,0,0,0,22.3-45.6h35.66A88.29,88.29,0,0,1,148.41,213.6Z"
              })
            )
          ],
          [
            "light",
            r.createElement(
              r.Fragment,
              null,
              r.createElement("path", {
                d: "M128,26A102,102,0,1,0,230,128,102.12,102.12,0,0,0,128,26Zm81.57,64H169.19a132.58,132.58,0,0,0-25.73-50.67A90.29,90.29,0,0,1,209.57,90ZM218,128a89.7,89.7,0,0,1-3.83,26H171.81a155.43,155.43,0,0,0,0-52h42.36A89.7,89.7,0,0,1,218,128Zm-90,87.83a110,110,0,0,1-15.19-19.45A124.24,124.24,0,0,1,99.35,166h57.3a124.24,124.24,0,0,1-13.46,30.38A110,110,0,0,1,128,215.83ZM96.45,154a139.18,139.18,0,0,1,0-52h63.1a139.18,139.18,0,0,1,0,52ZM38,128a89.7,89.7,0,0,1,3.83-26H84.19a155.43,155.43,0,0,0,0,52H41.83A89.7,89.7,0,0,1,38,128Zm90-87.83a110,110,0,0,1,15.19,19.45A124.24,124.24,0,0,1,156.65,90H99.35a124.24,124.24,0,0,1,13.46-30.38A110,110,0,0,1,128,40.17Zm-15.46-.84A132.58,132.58,0,0,0,86.81,90H46.43A90.29,90.29,0,0,1,112.54,39.33ZM46.43,166H86.81a132.58,132.58,0,0,0,25.73,50.67A90.29,90.29,0,0,1,46.43,166Zm97,50.67A132.58,132.58,0,0,0,169.19,166h40.38A90.29,90.29,0,0,1,143.46,216.67Z"
              })
            )
          ],
          [
            "regular",
            r.createElement(
              r.Fragment,
              null,
              r.createElement("path", {
                d: "M128,24h0A104,104,0,1,0,232,128,104.12,104.12,0,0,0,128,24Zm88,104a87.61,87.61,0,0,1-3.33,24H174.16a157.44,157.44,0,0,0,0-48h38.51A87.61,87.61,0,0,1,216,128ZM102,168H154a115.11,115.11,0,0,1-26,45A115.27,115.27,0,0,1,102,168Zm-3.9-16a140.84,140.84,0,0,1,0-48h59.88a140.84,140.84,0,0,1,0,48ZM40,128a87.61,87.61,0,0,1,3.33-24H81.84a157.44,157.44,0,0,0,0,48H43.33A87.61,87.61,0,0,1,40,128ZM154,88H102a115.11,115.11,0,0,1,26-45A115.27,115.27,0,0,1,154,88Zm52.33,0H170.71a135.28,135.28,0,0,0-22.3-45.6A88.29,88.29,0,0,1,206.37,88ZM107.59,42.4A135.28,135.28,0,0,0,85.29,88H49.63A88.29,88.29,0,0,1,107.59,42.4ZM49.63,168H85.29a135.28,135.28,0,0,0,22.3,45.6A88.29,88.29,0,0,1,49.63,168Zm98.78,45.6a135.28,135.28,0,0,0,22.3-45.6h35.66A88.29,88.29,0,0,1,148.41,213.6Z"
              })
            )
          ],
          [
            "thin",
            r.createElement(
              r.Fragment,
              null,
              r.createElement("path", {
                d: "M128,28h0A100,100,0,1,0,228,128,100.11,100.11,0,0,0,128,28Zm0,190.61c-6.33-6.09-23-24.41-31.27-54.61h62.54C151,194.2,134.33,212.52,128,218.61ZM94.82,156a140.42,140.42,0,0,1,0-56h66.36a140.42,140.42,0,0,1,0,56ZM128,37.39c6.33,6.09,23,24.41,31.27,54.61H96.73C105,61.8,121.67,43.48,128,37.39ZM169.41,100h46.23a92.09,92.09,0,0,1,0,56H169.41a152.65,152.65,0,0,0,0-56Zm43.25-8h-45a129.39,129.39,0,0,0-29.19-55.4A92.25,92.25,0,0,1,212.66,92ZM117.54,36.6A129.39,129.39,0,0,0,88.35,92h-45A92.25,92.25,0,0,1,117.54,36.6ZM40.36,100H86.59a152.65,152.65,0,0,0,0,56H40.36a92.09,92.09,0,0,1,0-56Zm3,64h45a129.39,129.39,0,0,0,29.19,55.4A92.25,92.25,0,0,1,43.34,164Zm95.12,55.4A129.39,129.39,0,0,0,167.65,164h45A92.25,92.25,0,0,1,138.46,219.4Z"
              })
            )
          ]
        ]);
        var a = Object.defineProperty,
          s = Object.defineProperties,
          l = Object.getOwnPropertyDescriptors,
          u = Object.getOwnPropertySymbols,
          c = Object.prototype.hasOwnProperty,
          d = Object.prototype.propertyIsEnumerable,
          f = (e, t, n) => (t in e ? a(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : (e[t] = n)),
          h = (e, t) => {
            for (var n in t || (t = {})) c.call(t, n) && f(e, n, t[n]);
            if (u) for (var n of u(t)) d.call(t, n) && f(e, n, t[n]);
            return e;
          },
          p = (e, t) => s(e, l(t));
        let _ = (0, r.forwardRef)((e, t) => r.createElement(o.Z, p(h({ ref: t }, e), { weights: i })));
        _.displayName = "Globe";
      },
      11448: function (e, t, n) {
        "use strict";
        n.d(t, { S: () => _ });
        var r = n(2784),
          o = n(6806);
        let i = new Map([
          [
            "bold",
            r.createElement(
              r.Fragment,
              null,
              r.createElement("path", {
                d: "M218.12,209.56l-61-95.8,59.72-65.69a12,12,0,0,0-17.76-16.14L143.81,92.77,106.12,33.56A12,12,0,0,0,96,28H48A12,12,0,0,0,37.88,46.44l61,95.8L39.12,207.93a12,12,0,1,0,17.76,16.14l55.31-60.84,37.69,59.21A12,12,0,0,0,160,228h48a12,12,0,0,0,10.12-18.44ZM166.59,204,69.86,52H89.41l96.73,152Z"
              })
            )
          ],
          [
            "duotone",
            r.createElement(
              r.Fragment,
              null,
              r.createElement("path", { d: "M208,216H160L48,40H96Z", opacity: "0.2" }),
              r.createElement("path", {
                d: "M214.75,211.71l-62.6-98.38,61.77-67.95a8,8,0,0,0-11.84-10.76L143.24,99.34,102.75,35.71A8,8,0,0,0,96,32H48a8,8,0,0,0-6.75,12.3l62.6,98.37-61.77,68a8,8,0,1,0,11.84,10.76l58.84-64.72,40.49,63.63A8,8,0,0,0,160,224h48a8,8,0,0,0,6.75-12.29ZM164.39,208,62.57,48h29L193.43,208Z"
              })
            )
          ],
          [
            "fill",
            r.createElement(
              r.Fragment,
              null,
              r.createElement("path", {
                d: "M215,219.85a8,8,0,0,1-7,4.15H160a8,8,0,0,1-6.75-3.71l-40.49-63.63L53.92,221.38a8,8,0,0,1-11.84-10.76l61.77-68L41.25,44.3A8,8,0,0,1,48,32H96a8,8,0,0,1,6.75,3.71l40.49,63.63,58.84-64.72a8,8,0,0,1,11.84,10.76l-61.77,67.95,62.6,98.38A8,8,0,0,1,215,219.85Z"
              })
            )
          ],
          [
            "light",
            r.createElement(
              r.Fragment,
              null,
              r.createElement("path", {
                d: "M213.06,212.78l-63.42-99.66L212.44,44A6,6,0,1,0,203.56,36L143,102.62l-41.9-65.84A6,6,0,0,0,96,34H48a6,6,0,0,0-5.06,9.22l63.42,99.66L43.56,212A6,6,0,0,0,52.44,220L113,153.38l41.9,65.84A6,6,0,0,0,160,222h48a6,6,0,0,0,5.06-9.22ZM163.29,210,58.93,46H92.71L197.07,210Z"
              })
            )
          ],
          [
            "regular",
            r.createElement(
              r.Fragment,
              null,
              r.createElement("path", {
                d: "M214.75,211.71l-62.6-98.38,61.77-67.95a8,8,0,0,0-11.84-10.76L143.24,99.34,102.75,35.71A8,8,0,0,0,96,32H48a8,8,0,0,0-6.75,12.3l62.6,98.37-61.77,68a8,8,0,1,0,11.84,10.76l58.84-64.72,40.49,63.63A8,8,0,0,0,160,224h48a8,8,0,0,0,6.75-12.29ZM164.39,208,62.57,48h29L193.43,208Z"
              })
            )
          ],
          [
            "thin",
            r.createElement(
              r.Fragment,
              null,
              r.createElement("path", {
                d: "M211.37,213.85,147.13,112.9,211,42.69A4,4,0,0,0,205,37.31L142.68,105.9,99.38,37.85A4,4,0,0,0,96,36H48a4,4,0,0,0-3.37,6.15L108.87,143.1,45,213.31A4,4,0,1,0,51,218.69l62.36-68.59,43.3,68.05A4,4,0,0,0,160,220h48a4,4,0,0,0,3.37-6.15ZM162.2,212,55.29,44H93.8L200.71,212Z"
              })
            )
          ]
        ]);
        var a = Object.defineProperty,
          s = Object.defineProperties,
          l = Object.getOwnPropertyDescriptors,
          u = Object.getOwnPropertySymbols,
          c = Object.prototype.hasOwnProperty,
          d = Object.prototype.propertyIsEnumerable,
          f = (e, t, n) => (t in e ? a(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : (e[t] = n)),
          h = (e, t) => {
            for (var n in t || (t = {})) c.call(t, n) && f(e, n, t[n]);
            if (u) for (var n of u(t)) d.call(t, n) && f(e, n, t[n]);
            return e;
          },
          p = (e, t) => s(e, l(t));
        let _ = (0, r.forwardRef)((e, t) => r.createElement(o.Z, p(h({ ref: t }, e), { weights: i })));
        _.displayName = "XLogo";
      },
      22157: function (e, t, n) {
        "use strict";
        let r, o, i, a, s, l, u, c;
        n.d(t, {
          THM: () => h4,
          oIo: () => hD,
          tmX: () => fU,
          x12: () => h8,
          phe: () => hz,
          f62: () => h6,
          PGn: () => fO,
          T$2: () => fB,
          h7M: () => hF,
          Ipb: () => h$,
          uN9: () => h5,
          c7Z: () => fL,
          S3h: () => fR,
          ALS: () => hO,
          aBy: () => hA,
          sGf: () => hI
        });
        var d = n(52322),
          f = n(2784);
        let h = !1;
        if ("undefined" != typeof window) {
          let e = {
            get passive() {
              h = !0;
              return;
            }
          };
          window.addEventListener("testPassive", null, e), window.removeEventListener("testPassive", null, e);
        }
        let p =
            "undefined" != typeof window &&
            window.navigator &&
            window.navigator.platform &&
            (/iP(ad|hone|od)/.test(window.navigator.platform) || ("MacIntel" === window.navigator.platform && window.navigator.maxTouchPoints > 1)),
          _ = [],
          g = new Map(),
          m = !1,
          v = -1,
          y = e => _.some(t => !!(t.options.allowTouchMove && t.options.allowTouchMove(e))),
          b = e => {
            let t = e || window.event;
            return !!y(t.target) || t.touches.length > 1 || (t.preventDefault && t.preventDefault(), !1);
          },
          x = e => {
            if (void 0 === a) {
              let t = !!e && !0 === e.reserveScrollBarGap,
                n = window.innerWidth - document.documentElement.getBoundingClientRect().width;
              if (t && n > 0) {
                let e = parseInt(window.getComputedStyle(document.body).getPropertyValue("padding-right"), 10);
                (a = document.body.style.paddingRight), (document.body.style.paddingRight = `${e + n}px`);
              }
            }
            void 0 === r && ((r = document.body.style.overflow), (document.body.style.overflow = "hidden"));
          },
          w = () => {
            void 0 !== a && ((document.body.style.paddingRight = a), (a = void 0)), void 0 !== r && ((document.body.style.overflow = r), (r = void 0));
          },
          k = () =>
            window.requestAnimationFrame(() => {
              let e = document.documentElement,
                t = document.body;
              if (void 0 === i) {
                (o = { ...e.style }), (i = { ...t.style });
                let { scrollY: n, scrollX: r, innerHeight: a } = window;
                (e.style.height = "100%"),
                  (e.style.overflow = "hidden"),
                  (t.style.position = "fixed"),
                  (t.style.top = `${-n}px`),
                  (t.style.left = `${-r}px`),
                  (t.style.width = "100%"),
                  (t.style.height = "auto"),
                  (t.style.overflow = "hidden"),
                  setTimeout(
                    () =>
                      window.requestAnimationFrame(() => {
                        let e = a - window.innerHeight;
                        e && n >= a && (t.style.top = -(n + e) + "px");
                      }),
                    300
                  );
              }
            }),
          M = () => {
            if (void 0 !== i) {
              let e = -parseInt(document.body.style.top, 10),
                t = -parseInt(document.body.style.left, 10),
                n = document.documentElement,
                r = document.body;
              (n.style.height = (null == o ? void 0 : o.height) || ""),
                (n.style.overflow = (null == o ? void 0 : o.overflow) || ""),
                (r.style.position = i.position || ""),
                (r.style.top = i.top || ""),
                (r.style.left = i.left || ""),
                (r.style.width = i.width || ""),
                (r.style.height = i.height || ""),
                (r.style.overflow = i.overflow || ""),
                window.scrollTo(t, e),
                (i = void 0);
            }
          },
          j = e => !!e && e.scrollHeight - e.scrollTop <= e.clientHeight,
          E = (e, t) => {
            let n = e.targetTouches[0].clientY - v;
            return !y(e.target) && ((t && 0 === t.scrollTop && n > 0) || (j(t) && n < 0) ? b(e) : (e.stopPropagation(), !0));
          },
          S = (e, t) => {
            if (!e) {
              console.error("disableBodyScroll unsuccessful - targetElement must be provided when calling disableBodyScroll on IOS devices.");
              return;
            }
            g.set(e, (null == g ? void 0 : g.get(e)) ? (null == g ? void 0 : g.get(e)) + 1 : 1),
              !_.some(t => t.targetElement === e) &&
                ((_ = [..._, { targetElement: e, options: t || {} }]),
                p ? k() : x(t),
                p &&
                  ((e.ontouchstart = e => {
                    1 === e.targetTouches.length && (v = e.targetTouches[0].clientY);
                  }),
                  (e.ontouchmove = t => {
                    1 === t.targetTouches.length && E(t, e);
                  }),
                  m || (document.addEventListener("touchmove", b, h ? { passive: !1 } : void 0), (m = !0))));
          },
          T = () => {
            p &&
              (_.forEach(e => {
                (e.targetElement.ontouchstart = null), (e.targetElement.ontouchmove = null);
              }),
              m && (document.removeEventListener("touchmove", b, h ? { passive: !1 } : void 0), (m = !1)),
              (v = -1)),
              p ? M() : w(),
              (_ = []),
              g.clear();
          };
        var C = n(4370),
          P = n(14981),
          N = n(28316),
          A = n(36614),
          O = "undefined" != typeof window && "undefined" != typeof document && "undefined" != typeof navigator,
          $ = (function () {
            for (var e = ["Edge", "Trident", "Firefox"], t = 0; t < e.length; t += 1) if (O && navigator.userAgent.indexOf(e[t]) >= 0) return 1;
            return 0;
          })(),
          D =
            O && window.Promise
              ? function (e) {
                  var t = !1;
                  return function () {
                    !t &&
                      ((t = !0),
                      window.Promise.resolve().then(function () {
                        (t = !1), e();
                      }));
                  };
                }
              : function (e) {
                  var t = !1;
                  return function () {
                    t ||
                      ((t = !0),
                      setTimeout(function () {
                        (t = !1), e();
                      }, $));
                  };
                };
        function z(e) {
          return e && "[object Function]" === {}.toString.call(e);
        }
        function R(e, t) {
          if (1 !== e.nodeType) return [];
          var n = e.ownerDocument.defaultView.getComputedStyle(e, null);
          return t ? n[t] : n;
        }
        function L(e) {
          return "HTML" === e.nodeName ? e : e.parentNode || e.host;
        }
        function F(e) {
          if (!e) return document.body;
          switch (e.nodeName) {
            case "HTML":
            case "BODY":
              return e.ownerDocument.body;
            case "#document":
              return e.body;
          }
          var t = R(e),
            n = t.overflow,
            r = t.overflowX,
            o = t.overflowY;
          return /(auto|scroll|overlay)/.test(n + o + r) ? e : F(L(e));
        }
        function I(e) {
          return e && e.referenceNode ? e.referenceNode : e;
        }
        var B = O && !!(window.MSInputMethodContext && document.documentMode),
          U = O && /MSIE 10/.test(navigator.userAgent);
        function q(e) {
          return 11 === e ? B : 10 === e ? U : B || U;
        }
        function H(e) {
          if (!e) return document.documentElement;
          for (var t = q(10) ? document.body : null, n = e.offsetParent || null; n === t && e.nextElementSibling; ) n = (e = e.nextElementSibling).offsetParent;
          var r = n && n.nodeName;
          return r && "BODY" !== r && "HTML" !== r
            ? -1 !== ["TH", "TD", "TABLE"].indexOf(n.nodeName) && "static" === R(n, "position")
              ? H(n)
              : n
            : e
              ? e.ownerDocument.documentElement
              : document.documentElement;
        }
        function Y(e) {
          return null !== e.parentNode ? Y(e.parentNode) : e;
        }
        function W(e, t) {
          if (!e || !e.nodeType || !t || !t.nodeType) return document.documentElement;
          var n,
            r = e.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING,
            o = r ? e : t,
            i = r ? t : e,
            a = document.createRange();
          a.setStart(o, 0), a.setEnd(i, 0);
          var s = a.commonAncestorContainer;
          if ((e !== s && t !== s) || o.contains(i)) return "BODY" !== (n = s.nodeName) && ("HTML" === n || H(s.firstElementChild) === s) ? s : H(s);
          var l = Y(e);
          return l.host ? W(l.host, t) : W(e, Y(t).host);
        }
        function Z(e) {
          var t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : "top",
            n = "top" === t ? "scrollTop" : "scrollLeft",
            r = e.nodeName;
          if ("BODY" === r || "HTML" === r) {
            var o = e.ownerDocument.documentElement;
            return (e.ownerDocument.scrollingElement || o)[n];
          }
          return e[n];
        }
        function X(e, t) {
          var n = "x" === t ? "Left" : "Top";
          return parseFloat(e["border" + n + "Width"]) + parseFloat(e["border" + ("Left" === n ? "Right" : "Bottom") + "Width"]);
        }
        function V(e, t, n, r) {
          return Math.max(
            t["offset" + e],
            t["scroll" + e],
            n["client" + e],
            n["offset" + e],
            n["scroll" + e],
            q(10)
              ? parseInt(n["offset" + e]) +
                  parseInt(r["margin" + ("Height" === e ? "Top" : "Left")]) +
                  parseInt(r["margin" + ("Height" === e ? "Bottom" : "Right")])
              : 0
          );
        }
        function G(e) {
          var t = e.body,
            n = e.documentElement,
            r = q(10) && getComputedStyle(n);
          return { height: V("Height", t, n, r), width: V("Width", t, n, r) };
        }
        var J = function (e, t) {
            if (!(e instanceof t)) throw TypeError("Cannot call a class as a function");
          },
          K = (function () {
            function e(e, t) {
              for (var n = 0; n < t.length; n++) {
                var r = t[n];
                (r.enumerable = r.enumerable || !1), (r.configurable = !0), "value" in r && (r.writable = !0), Object.defineProperty(e, r.key, r);
              }
            }
            return function (t, n, r) {
              return n && e(t.prototype, n), r && e(t, r), t;
            };
          })(),
          Q = function (e, t, n) {
            return t in e ? Object.defineProperty(e, t, { value: n, enumerable: !0, configurable: !0, writable: !0 }) : (e[t] = n), e;
          },
          ee =
            Object.assign ||
            function (e) {
              for (var t = 1; t < arguments.length; t++) {
                var n = arguments[t];
                for (var r in n) Object.prototype.hasOwnProperty.call(n, r) && (e[r] = n[r]);
              }
              return e;
            };
        function et(e) {
          return ee({}, e, { right: e.left + e.width, bottom: e.top + e.height });
        }
        function en(e) {
          var t = {};
          try {
            if (q(10)) {
              t = e.getBoundingClientRect();
              var n = Z(e, "top"),
                r = Z(e, "left");
              (t.top += n), (t.left += r), (t.bottom += n), (t.right += r);
            } else t = e.getBoundingClientRect();
          } catch (e) {}
          var o = { left: t.left, top: t.top, width: t.right - t.left, height: t.bottom - t.top },
            i = "HTML" === e.nodeName ? G(e.ownerDocument) : {},
            a = i.width || e.clientWidth || o.width,
            s = i.height || e.clientHeight || o.height,
            l = e.offsetWidth - a,
            u = e.offsetHeight - s;
          if (l || u) {
            var c = R(e);
            (l -= X(c, "x")), (u -= X(c, "y")), (o.width -= l), (o.height -= u);
          }
          return et(o);
        }
        function er(e, t) {
          var n = arguments.length > 2 && void 0 !== arguments[2] && arguments[2],
            r = q(10),
            o = "HTML" === t.nodeName,
            i = en(e),
            a = en(t),
            s = F(e),
            l = R(t),
            u = parseFloat(l.borderTopWidth),
            c = parseFloat(l.borderLeftWidth);
          n && o && ((a.top = Math.max(a.top, 0)), (a.left = Math.max(a.left, 0)));
          var d = et({ top: i.top - a.top - u, left: i.left - a.left - c, width: i.width, height: i.height });
          if (((d.marginTop = 0), (d.marginLeft = 0), !r && o)) {
            var f = parseFloat(l.marginTop),
              h = parseFloat(l.marginLeft);
            (d.top -= u - f), (d.bottom -= u - f), (d.left -= c - h), (d.right -= c - h), (d.marginTop = f), (d.marginLeft = h);
          }
          return (
            (r && !n ? t.contains(s) : t === s && "BODY" !== s.nodeName) &&
              (d = (function (e, t) {
                var n = arguments.length > 2 && void 0 !== arguments[2] && arguments[2],
                  r = Z(t, "top"),
                  o = Z(t, "left"),
                  i = n ? -1 : 1;
                return (e.top += r * i), (e.bottom += r * i), (e.left += o * i), (e.right += o * i), e;
              })(d, t)),
            d
          );
        }
        function eo(e) {
          if (!e || !e.parentElement || q()) return document.documentElement;
          for (var t = e.parentElement; t && "none" === R(t, "transform"); ) t = t.parentElement;
          return t || document.documentElement;
        }
        function ei(e, t, n, r) {
          var o = arguments.length > 4 && void 0 !== arguments[4] && arguments[4],
            i = { top: 0, left: 0 },
            a = o ? eo(e) : W(e, I(t));
          if ("viewport" === r)
            i = (function (e) {
              var t = arguments.length > 1 && void 0 !== arguments[1] && arguments[1],
                n = e.ownerDocument.documentElement,
                r = er(e, n),
                o = Math.max(n.clientWidth, window.innerWidth || 0),
                i = Math.max(n.clientHeight, window.innerHeight || 0),
                a = t ? 0 : Z(n),
                s = t ? 0 : Z(n, "left");
              return et({ top: a - r.top + r.marginTop, left: s - r.left + r.marginLeft, width: o, height: i });
            })(a, o);
          else {
            var s = void 0;
            "scrollParent" === r
              ? "BODY" === (s = F(L(t))).nodeName && (s = e.ownerDocument.documentElement)
              : (s = "window" === r ? e.ownerDocument.documentElement : r);
            var l = er(s, a, o);
            if (
              "HTML" === s.nodeName &&
              !(function e(t) {
                var n = t.nodeName;
                if ("BODY" === n || "HTML" === n) return !1;
                if ("fixed" === R(t, "position")) return !0;
                var r = L(t);
                return !!r && e(r);
              })(a)
            ) {
              var u = G(e.ownerDocument),
                c = u.height,
                d = u.width;
              (i.top += l.top - l.marginTop), (i.bottom = c + l.top), (i.left += l.left - l.marginLeft), (i.right = d + l.left);
            } else i = l;
          }
          var f = "number" == typeof (n = n || 0);
          return (i.left += f ? n : n.left || 0), (i.top += f ? n : n.top || 0), (i.right -= f ? n : n.right || 0), (i.bottom -= f ? n : n.bottom || 0), i;
        }
        function ea(e, t, n, r, o) {
          var i = arguments.length > 5 && void 0 !== arguments[5] ? arguments[5] : 0;
          if (-1 === e.indexOf("auto")) return e;
          var a = ei(n, r, i, o),
            s = {
              top: { width: a.width, height: t.top - a.top },
              right: { width: a.right - t.right, height: a.height },
              bottom: { width: a.width, height: a.bottom - t.bottom },
              left: { width: t.left - a.left, height: a.height }
            },
            l = Object.keys(s)
              .map(function (e) {
                var t;
                return ee({ key: e }, s[e], { area: (t = s[e]).width * t.height });
              })
              .sort(function (e, t) {
                return t.area - e.area;
              }),
            u = l.filter(function (e) {
              var t = e.width,
                r = e.height;
              return t >= n.clientWidth && r >= n.clientHeight;
            }),
            c = u.length > 0 ? u[0].key : l[0].key,
            d = e.split("-")[1];
          return c + (d ? "-" + d : "");
        }
        function es(e, t, n) {
          var r = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : null,
            o = r ? eo(t) : W(t, I(n));
          return er(n, o, r);
        }
        function el(e) {
          var t = e.ownerDocument.defaultView.getComputedStyle(e),
            n = parseFloat(t.marginTop || 0) + parseFloat(t.marginBottom || 0),
            r = parseFloat(t.marginLeft || 0) + parseFloat(t.marginRight || 0);
          return { width: e.offsetWidth + r, height: e.offsetHeight + n };
        }
        function eu(e) {
          var t = { left: "right", right: "left", bottom: "top", top: "bottom" };
          return e.replace(/left|right|bottom|top/g, function (e) {
            return t[e];
          });
        }
        function ec(e, t, n) {
          n = n.split("-")[0];
          var r = el(e),
            o = { width: r.width, height: r.height },
            i = -1 !== ["right", "left"].indexOf(n),
            a = i ? "top" : "left",
            s = i ? "left" : "top",
            l = i ? "height" : "width";
          return (o[a] = t[a] + t[l] / 2 - r[l] / 2), n === s ? (o[s] = t[s] - r[i ? "width" : "height"]) : (o[s] = t[eu(s)]), o;
        }
        function ed(e, t) {
          return Array.prototype.find ? e.find(t) : e.filter(t)[0];
        }
        function ef(e, t, n) {
          return (
            (void 0 === n
              ? e
              : e.slice(
                  0,
                  (function (e, t, n) {
                    if (Array.prototype.findIndex)
                      return e.findIndex(function (e) {
                        return e[t] === n;
                      });
                    var r = ed(e, function (e) {
                      return e[t] === n;
                    });
                    return e.indexOf(r);
                  })(e, "name", n)
                )
            ).forEach(function (e) {
              e.function && console.warn("`modifier.function` is deprecated, use `modifier.fn`!");
              var n = e.function || e.fn;
              e.enabled && z(n) && ((t.offsets.popper = et(t.offsets.popper)), (t.offsets.reference = et(t.offsets.reference)), (t = n(t, e)));
            }),
            t
          );
        }
        function eh() {
          if (!this.state.isDestroyed) {
            var e = { instance: this, styles: {}, arrowStyles: {}, attributes: {}, flipped: !1, offsets: {} };
            (e.offsets.reference = es(this.state, this.popper, this.reference, this.options.positionFixed)),
              (e.placement = ea(
                this.options.placement,
                e.offsets.reference,
                this.popper,
                this.reference,
                this.options.modifiers.flip.boundariesElement,
                this.options.modifiers.flip.padding
              )),
              (e.originalPlacement = e.placement),
              (e.positionFixed = this.options.positionFixed),
              (e.offsets.popper = ec(this.popper, e.offsets.reference, e.placement)),
              (e.offsets.popper.position = this.options.positionFixed ? "fixed" : "absolute"),
              (e = ef(this.modifiers, e)),
              this.state.isCreated ? this.options.onUpdate(e) : ((this.state.isCreated = !0), this.options.onCreate(e));
          }
        }
        function ep(e, t) {
          return e.some(function (e) {
            var n = e.name;
            return e.enabled && n === t;
          });
        }
        function e_(e) {
          for (var t = [!1, "ms", "Webkit", "Moz", "O"], n = e.charAt(0).toUpperCase() + e.slice(1), r = 0; r < t.length; r++) {
            var o = t[r],
              i = o ? "" + o + n : e;
            if (void 0 !== document.body.style[i]) return i;
          }
          return null;
        }
        function eg() {
          return (
            (this.state.isDestroyed = !0),
            ep(this.modifiers, "applyStyle") &&
              (this.popper.removeAttribute("x-placement"),
              (this.popper.style.position = ""),
              (this.popper.style.top = ""),
              (this.popper.style.left = ""),
              (this.popper.style.right = ""),
              (this.popper.style.bottom = ""),
              (this.popper.style.willChange = ""),
              (this.popper.style[e_("transform")] = "")),
            this.disableEventListeners(),
            this.options.removeOnDestroy && this.popper.parentNode.removeChild(this.popper),
            this
          );
        }
        function em(e) {
          var t = e.ownerDocument;
          return t ? t.defaultView : window;
        }
        function ev() {
          if (!this.state.eventsEnabled) {
            var e, t, n, r, o;
            this.state =
              ((e = this.reference),
              this.options,
              (n = this.state),
              (r = this.scheduleUpdate),
              (n.updateBound = r),
              em(e).addEventListener("resize", n.updateBound, { passive: !0 }),
              (function e(t, n, r, o) {
                var i = "BODY" === t.nodeName,
                  a = i ? t.ownerDocument.defaultView : t;
                a.addEventListener(n, r, { passive: !0 }), i || e(F(a.parentNode), n, r, o), o.push(a);
              })((o = F(e)), "scroll", n.updateBound, n.scrollParents),
              (n.scrollElement = o),
              (n.eventsEnabled = !0),
              n);
          }
        }
        function ey() {
          if (this.state.eventsEnabled) {
            var e, t;
            cancelAnimationFrame(this.scheduleUpdate),
              (this.state =
                ((e = this.reference),
                (t = this.state),
                em(e).removeEventListener("resize", t.updateBound),
                t.scrollParents.forEach(function (e) {
                  e.removeEventListener("scroll", t.updateBound);
                }),
                (t.updateBound = null),
                (t.scrollParents = []),
                (t.scrollElement = null),
                (t.eventsEnabled = !1),
                t));
          }
        }
        function eb(e) {
          return "" !== e && !isNaN(parseFloat(e)) && isFinite(e);
        }
        function ex(e, t) {
          Object.keys(t).forEach(function (n) {
            var r = "";
            -1 !== ["width", "height", "top", "right", "bottom", "left"].indexOf(n) && eb(t[n]) && (r = "px"), (e.style[n] = t[n] + r);
          });
        }
        var ew = O && /Firefox/i.test(navigator.userAgent);
        function ek(e, t, n) {
          var r = ed(e, function (e) {
              return e.name === t;
            }),
            o =
              !!r &&
              e.some(function (e) {
                return e.name === n && e.enabled && e.order < r.order;
              });
          if (!o) {
            var i = "`" + t + "`";
            console.warn("`" + n + "` modifier is required by " + i + " modifier in order to work, be sure to include it before " + i + "!");
          }
          return o;
        }
        var eM = [
            "auto-start",
            "auto",
            "auto-end",
            "top-start",
            "top",
            "top-end",
            "right-start",
            "right",
            "right-end",
            "bottom-end",
            "bottom",
            "bottom-start",
            "left-end",
            "left",
            "left-start"
          ],
          ej = eM.slice(3);
        function eE(e) {
          var t = arguments.length > 1 && void 0 !== arguments[1] && arguments[1],
            n = ej.indexOf(e),
            r = ej.slice(n + 1).concat(ej.slice(0, n));
          return t ? r.reverse() : r;
        }
        var eS = { FLIP: "flip", CLOCKWISE: "clockwise", COUNTERCLOCKWISE: "counterclockwise" },
          eT = (function () {
            function e(t, n) {
              var r = this,
                o = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {};
              J(this, e),
                (this.scheduleUpdate = function () {
                  return requestAnimationFrame(r.update);
                }),
                (this.update = D(this.update.bind(this))),
                (this.options = ee({}, e.Defaults, o)),
                (this.state = { isDestroyed: !1, isCreated: !1, scrollParents: [] }),
                (this.reference = t && t.jquery ? t[0] : t),
                (this.popper = n && n.jquery ? n[0] : n),
                (this.options.modifiers = {}),
                Object.keys(ee({}, e.Defaults.modifiers, o.modifiers)).forEach(function (t) {
                  r.options.modifiers[t] = ee({}, e.Defaults.modifiers[t] || {}, o.modifiers ? o.modifiers[t] : {});
                }),
                (this.modifiers = Object.keys(this.options.modifiers)
                  .map(function (e) {
                    return ee({ name: e }, r.options.modifiers[e]);
                  })
                  .sort(function (e, t) {
                    return e.order - t.order;
                  })),
                this.modifiers.forEach(function (e) {
                  e.enabled && z(e.onLoad) && e.onLoad(r.reference, r.popper, r.options, e, r.state);
                }),
                this.update();
              var i = this.options.eventsEnabled;
              i && this.enableEventListeners(), (this.state.eventsEnabled = i);
            }
            return (
              K(e, [
                {
                  key: "update",
                  value: function () {
                    return eh.call(this);
                  }
                },
                {
                  key: "destroy",
                  value: function () {
                    return eg.call(this);
                  }
                },
                {
                  key: "enableEventListeners",
                  value: function () {
                    return ev.call(this);
                  }
                },
                {
                  key: "disableEventListeners",
                  value: function () {
                    return ey.call(this);
                  }
                }
              ]),
              e
            );
          })();
        (eT.Utils = ("undefined" != typeof window ? window : n.g).PopperUtils),
          (eT.placements = eM),
          (eT.Defaults = {
            placement: "bottom",
            positionFixed: !1,
            eventsEnabled: !0,
            removeOnDestroy: !1,
            onCreate: function () {},
            onUpdate: function () {},
            modifiers: {
              shift: {
                order: 100,
                enabled: !0,
                fn: function (e) {
                  var t = e.placement,
                    n = t.split("-")[0],
                    r = t.split("-")[1];
                  if (r) {
                    var o = e.offsets,
                      i = o.reference,
                      a = o.popper,
                      s = -1 !== ["bottom", "top"].indexOf(n),
                      l = s ? "left" : "top",
                      u = s ? "width" : "height",
                      c = { start: Q({}, l, i[l]), end: Q({}, l, i[l] + i[u] - a[u]) };
                    e.offsets.popper = ee({}, a, c[r]);
                  }
                  return e;
                }
              },
              offset: {
                order: 200,
                enabled: !0,
                fn: function (e, t) {
                  var n,
                    r,
                    o,
                    i,
                    a,
                    s,
                    l = t.offset,
                    u = e.placement,
                    c = e.offsets,
                    d = c.popper,
                    f = c.reference,
                    h = u.split("-")[0],
                    p = void 0;
                  return (
                    eb(+l)
                      ? (p = [+l, 0])
                      : ((n = [0, 0]),
                        (r = -1 !== ["right", "left"].indexOf(h)),
                        (i = (o = l.split(/(\+|\-)/).map(function (e) {
                          return e.trim();
                        })).indexOf(
                          ed(o, function (e) {
                            return -1 !== e.search(/,|\s/);
                          })
                        )),
                        o[i] && -1 === o[i].indexOf(",") && console.warn("Offsets separated by white space(s) are deprecated, use a comma (,) instead."),
                        (a = /\s*,\s*|\s+/),
                        (-1 !== i ? [o.slice(0, i).concat([o[i].split(a)[0]]), [o[i].split(a)[1]].concat(o.slice(i + 1))] : [o])
                          .map(function (e, t) {
                            var n = (1 === t ? !r : r) ? "height" : "width",
                              o = !1;
                            return e
                              .reduce(function (e, t) {
                                return "" === e[e.length - 1] && -1 !== ["+", "-"].indexOf(t)
                                  ? ((e[e.length - 1] = t), (o = !0), e)
                                  : o
                                    ? ((e[e.length - 1] += t), (o = !1), e)
                                    : e.concat(t);
                              }, [])
                              .map(function (e) {
                                return (function (e, t, n, r) {
                                  var o = e.match(/((?:\-|\+)?\d*\.?\d*)(.*)/),
                                    i = +o[1],
                                    a = o[2];
                                  if (!i) return e;
                                  if (0 === a.indexOf("%")) {
                                    var s = void 0;
                                    return (et((s = "%p" === a ? n : r))[t] / 100) * i;
                                  }
                                  if ("vh" !== a && "vw" !== a) return i;
                                  var l = void 0;
                                  return (
                                    (("vh" === a
                                      ? Math.max(document.documentElement.clientHeight, window.innerHeight || 0)
                                      : Math.max(document.documentElement.clientWidth, window.innerWidth || 0)) /
                                      100) *
                                    i
                                  );
                                })(e, n, d, f);
                              });
                          })
                          .forEach(function (e, t) {
                            e.forEach(function (r, o) {
                              eb(r) && (n[t] += r * ("-" === e[o - 1] ? -1 : 1));
                            });
                          }),
                        (p = n)),
                    "left" === h
                      ? ((d.top += p[0]), (d.left -= p[1]))
                      : "right" === h
                        ? ((d.top += p[0]), (d.left += p[1]))
                        : "top" === h
                          ? ((d.left += p[0]), (d.top -= p[1]))
                          : "bottom" === h && ((d.left += p[0]), (d.top += p[1])),
                    (e.popper = d),
                    e
                  );
                },
                offset: 0
              },
              preventOverflow: {
                order: 300,
                enabled: !0,
                fn: function (e, t) {
                  var n = t.boundariesElement || H(e.instance.popper);
                  e.instance.reference === n && (n = H(n));
                  var r = e_("transform"),
                    o = e.instance.popper.style,
                    i = o.top,
                    a = o.left,
                    s = o[r];
                  (o.top = ""), (o.left = ""), (o[r] = "");
                  var l = ei(e.instance.popper, e.instance.reference, t.padding, n, e.positionFixed);
                  (o.top = i), (o.left = a), (o[r] = s), (t.boundaries = l);
                  var u = t.priority,
                    c = e.offsets.popper,
                    d = {
                      primary: function (e) {
                        var n = c[e];
                        return c[e] < l[e] && !t.escapeWithReference && (n = Math.max(c[e], l[e])), Q({}, e, n);
                      },
                      secondary: function (e) {
                        var n = "right" === e ? "left" : "top",
                          r = c[n];
                        return c[e] > l[e] && !t.escapeWithReference && (r = Math.min(c[n], l[e] - ("right" === e ? c.width : c.height))), Q({}, n, r);
                      }
                    };
                  return (
                    u.forEach(function (e) {
                      var t = -1 !== ["left", "top"].indexOf(e) ? "primary" : "secondary";
                      c = ee({}, c, d[t](e));
                    }),
                    (e.offsets.popper = c),
                    e
                  );
                },
                priority: ["left", "right", "top", "bottom"],
                padding: 5,
                boundariesElement: "scrollParent"
              },
              keepTogether: {
                order: 400,
                enabled: !0,
                fn: function (e) {
                  var t = e.offsets,
                    n = t.popper,
                    r = t.reference,
                    o = e.placement.split("-")[0],
                    i = Math.floor,
                    a = -1 !== ["top", "bottom"].indexOf(o),
                    s = a ? "right" : "bottom",
                    l = a ? "left" : "top";
                  return n[s] < i(r[l]) && (e.offsets.popper[l] = i(r[l]) - n[a ? "width" : "height"]), n[l] > i(r[s]) && (e.offsets.popper[l] = i(r[s])), e;
                }
              },
              arrow: {
                order: 500,
                enabled: !0,
                fn: function (e, t) {
                  if (!ek(e.instance.modifiers, "arrow", "keepTogether")) return e;
                  var n,
                    r = t.element;
                  if ("string" == typeof r) {
                    if (!(r = e.instance.popper.querySelector(r))) return e;
                  } else if (!e.instance.popper.contains(r)) return console.warn("WARNING: `arrow.element` must be child of its popper element!"), e;
                  var o = e.placement.split("-")[0],
                    i = e.offsets,
                    a = i.popper,
                    s = i.reference,
                    l = -1 !== ["left", "right"].indexOf(o),
                    u = l ? "height" : "width",
                    c = l ? "Top" : "Left",
                    d = c.toLowerCase(),
                    f = l ? "bottom" : "right",
                    h = el(r)[u];
                  s[f] - h < a[d] && (e.offsets.popper[d] -= a[d] - (s[f] - h)),
                    s[d] + h > a[f] && (e.offsets.popper[d] += s[d] + h - a[f]),
                    (e.offsets.popper = et(e.offsets.popper));
                  var p = s[d] + s[u] / 2 - h / 2,
                    _ = R(e.instance.popper),
                    g = parseFloat(_["margin" + c]),
                    m = parseFloat(_["border" + c + "Width"]),
                    v = p - e.offsets.popper[d] - g - m;
                  return (
                    (v = Math.max(Math.min(a[u] - h, v), 0)),
                    (e.arrowElement = r),
                    (e.offsets.arrow = (Q((n = {}), d, Math.round(v)), Q(n, l ? "left" : "top", ""), n)),
                    e
                  );
                },
                element: "[x-arrow]"
              },
              flip: {
                order: 600,
                enabled: !0,
                fn: function (e, t) {
                  if (ep(e.instance.modifiers, "inner") || (e.flipped && e.placement === e.originalPlacement)) return e;
                  var n = ei(e.instance.popper, e.instance.reference, t.padding, t.boundariesElement, e.positionFixed),
                    r = e.placement.split("-")[0],
                    o = eu(r),
                    i = e.placement.split("-")[1] || "",
                    a = [];
                  switch (t.behavior) {
                    case eS.FLIP:
                      a = [r, o];
                      break;
                    case eS.CLOCKWISE:
                      a = eE(r);
                      break;
                    case eS.COUNTERCLOCKWISE:
                      a = eE(r, !0);
                      break;
                    default:
                      a = t.behavior;
                  }
                  return (
                    a.forEach(function (s, l) {
                      if (r !== s || a.length === l + 1) return e;
                      o = eu((r = e.placement.split("-")[0]));
                      var u,
                        c = e.offsets.popper,
                        d = e.offsets.reference,
                        f = Math.floor,
                        h =
                          ("left" === r && f(c.right) > f(d.left)) ||
                          ("right" === r && f(c.left) < f(d.right)) ||
                          ("top" === r && f(c.bottom) > f(d.top)) ||
                          ("bottom" === r && f(c.top) < f(d.bottom)),
                        p = f(c.left) < f(n.left),
                        _ = f(c.right) > f(n.right),
                        g = f(c.top) < f(n.top),
                        m = f(c.bottom) > f(n.bottom),
                        v = ("left" === r && p) || ("right" === r && _) || ("top" === r && g) || ("bottom" === r && m),
                        y = -1 !== ["top", "bottom"].indexOf(r),
                        b =
                          !!t.flipVariations &&
                          ((y && "start" === i && p) || (y && "end" === i && _) || (!y && "start" === i && g) || (!y && "end" === i && m)),
                        x =
                          !!t.flipVariationsByContent &&
                          ((y && "start" === i && _) || (y && "end" === i && p) || (!y && "start" === i && m) || (!y && "end" === i && g)),
                        w = b || x;
                      (h || v || w) &&
                        ((e.flipped = !0),
                        (h || v) && (r = a[l + 1]),
                        w && (i = "end" === (u = i) ? "start" : "start" === u ? "end" : u),
                        (e.placement = r + (i ? "-" + i : "")),
                        (e.offsets.popper = ee({}, e.offsets.popper, ec(e.instance.popper, e.offsets.reference, e.placement))),
                        (e = ef(e.instance.modifiers, e, "flip")));
                    }),
                    e
                  );
                },
                behavior: "flip",
                padding: 5,
                boundariesElement: "viewport",
                flipVariations: !1,
                flipVariationsByContent: !1
              },
              inner: {
                order: 700,
                enabled: !1,
                fn: function (e) {
                  var t = e.placement,
                    n = t.split("-")[0],
                    r = e.offsets,
                    o = r.popper,
                    i = r.reference,
                    a = -1 !== ["left", "right"].indexOf(n),
                    s = -1 === ["top", "left"].indexOf(n);
                  return (o[a ? "left" : "top"] = i[n] - (s ? o[a ? "width" : "height"] : 0)), (e.placement = eu(t)), (e.offsets.popper = et(o)), e;
                }
              },
              hide: {
                order: 800,
                enabled: !0,
                fn: function (e) {
                  if (!ek(e.instance.modifiers, "hide", "preventOverflow")) return e;
                  var t = e.offsets.reference,
                    n = ed(e.instance.modifiers, function (e) {
                      return "preventOverflow" === e.name;
                    }).boundaries;
                  if (t.bottom < n.top || t.left > n.right || t.top > n.bottom || t.right < n.left) {
                    if (!0 === e.hide) return e;
                    (e.hide = !0), (e.attributes["x-out-of-boundaries"] = "");
                  } else {
                    if (!1 === e.hide) return e;
                    (e.hide = !1), (e.attributes["x-out-of-boundaries"] = !1);
                  }
                  return e;
                }
              },
              computeStyle: {
                order: 850,
                enabled: !0,
                fn: function (e, t) {
                  var n,
                    r,
                    o,
                    i,
                    a,
                    s,
                    l,
                    u,
                    c,
                    d,
                    f,
                    h,
                    p,
                    _ = t.x,
                    g = t.y,
                    m = e.offsets.popper,
                    v = ed(e.instance.modifiers, function (e) {
                      return "applyStyle" === e.name;
                    }).gpuAcceleration;
                  void 0 !== v &&
                    console.warn(
                      "WARNING: `gpuAcceleration` option moved to `computeStyle` modifier and will not be supported in future versions of Popper.js!"
                    );
                  var y = void 0 !== v ? v : t.gpuAcceleration,
                    b = H(e.instance.popper),
                    x = en(b),
                    w = { position: m.position },
                    k =
                      ((n = window.devicePixelRatio < 2 || !ew),
                      (o = (r = e.offsets).popper),
                      (i = r.reference),
                      (a = Math.round),
                      (s = Math.floor),
                      (l = function (e) {
                        return e;
                      }),
                      (u = a(i.width)),
                      (c = a(o.width)),
                      (d = -1 !== ["left", "right"].indexOf(e.placement)),
                      (f = -1 !== e.placement.indexOf("-")),
                      (h = n ? (d || f || u % 2 == c % 2 ? a : s) : l),
                      (p = n ? a : l),
                      { left: h(u % 2 == 1 && c % 2 == 1 && !f && n ? o.left - 1 : o.left), top: p(o.top), bottom: p(o.bottom), right: h(o.right) }),
                    M = "bottom" === _ ? "top" : "bottom",
                    j = "right" === g ? "left" : "right",
                    E = e_("transform"),
                    S = void 0,
                    T = void 0;
                  (T = "bottom" === M ? ("HTML" === b.nodeName ? -b.clientHeight + k.bottom : -x.height + k.bottom) : k.top),
                    (S = "right" === j ? ("HTML" === b.nodeName ? -b.clientWidth + k.right : -x.width + k.right) : k.left),
                    y && E
                      ? ((w[E] = "translate3d(" + S + "px, " + T + "px, 0)"), (w[M] = 0), (w[j] = 0), (w.willChange = "transform"))
                      : ((w[M] = T * ("bottom" === M ? -1 : 1)), (w[j] = S * ("right" === j ? -1 : 1)), (w.willChange = M + ", " + j));
                  var C = { "x-placement": e.placement };
                  return (
                    (e.attributes = ee({}, C, e.attributes)), (e.styles = ee({}, w, e.styles)), (e.arrowStyles = ee({}, e.offsets.arrow, e.arrowStyles)), e
                  );
                },
                gpuAcceleration: !0,
                x: "bottom",
                y: "right"
              },
              applyStyle: {
                order: 900,
                enabled: !0,
                fn: function (e) {
                  return (
                    ex(e.instance.popper, e.styles),
                    (function (e, t) {
                      Object.keys(t).forEach(function (n) {
                        !1 !== t[n] ? e.setAttribute(n, t[n]) : e.removeAttribute(n);
                      });
                    })(e.instance.popper, e.attributes),
                    e.arrowElement && Object.keys(e.arrowStyles).length && ex(e.arrowElement, e.arrowStyles),
                    e
                  );
                },
                onLoad: function (e, t, n, r, o) {
                  var i = es(o, t, e, n.positionFixed),
                    a = ea(n.placement, i, t, e, n.modifiers.flip.boundariesElement, n.modifiers.flip.padding);
                  return t.setAttribute("x-placement", a), ex(t, { position: n.positionFixed ? "fixed" : "absolute" }), n;
                },
                gpuAcceleration: void 0
              }
            }
          }),
          !(function () {
            try {
              if ("undefined" != typeof document) {
                var e = document.createElement("style");
                e.appendChild(
                  document.createTextNode(
                    "._backdrop_uxwv8_1 {\n  position: fixed;\n  background: var(--color-layer-transparent);\n  top: 0;\n  bottom: 0;\n  right: 0;\n  left: 0;\n  opacity: 0;\n  user-select: none;\n}"
                  )
                ),
                  document.head.appendChild(e);
              }
            } catch (e) {
              console.error("vite-plugin-css-injected-by-js", e);
            }
          })();
        let eC = ({ ref: e, open: t = !0, onClickOutside: n, onEscape: r }) => {
            (0, f.useEffect)(() => {
              if (!t) return;
              let o = t => {
                  e.current && !e.current.contains(t.target) && (null == n || n(t));
                },
                i = e => {
                  "Escape" === e.code && (null == r || r(e));
                };
              return (
                n && (document.addEventListener("mousedown", o), document.addEventListener("touchstart", o)),
                r && document.addEventListener("keydown", i),
                () => {
                  n && (document.removeEventListener("mousedown", o), document.removeEventListener("touchstart", o)),
                    r && document.removeEventListener("keydown", i);
                }
              );
            }, [e, n, r, t]);
          },
          eP = (0, f.createContext)({ close: () => void 0 }),
          eN = 0,
          eA = () => `ref-${++eN}`,
          eO = e => {
            let [t] = (0, f.useState)(e || eA());
            return `${t}`;
          },
          e$ = e => {
            let t = (0, f.useRef)(e);
            (t.current = e), (0, f.useLayoutEffect)(() => () => t.current(), []);
          },
          eD = (0, f.forwardRef)(({ children: e, className: t, element: n = "div", onMount: r, onUnmount: o }, i) => {
            let a = (0, f.useRef)(null),
              s = (0, f.useRef)(!1);
            return ((0, f.useEffect)(() => {
              t && a.current && a.current.setAttribute("class", `${t} rdk-portal`);
            }, [t, a.current]),
            (0, f.useLayoutEffect)(() => {
              (a.current = document.createElement(n)), null == r || r();
            }, []),
            e$(() => {
              null == o || o();
              let e = a.current;
              e && document.body.contains(e) && document.body.removeChild(e);
            }),
            (0, f.useImperativeHandle)(i, () => a.current),
            a.current)
              ? (s.current || ((s.current = !0), a.current.classList.add("rdk-portal"), document.body.appendChild(a.current)),
                (0, N.createPortal)(e, a.current))
              : null;
          }),
          ez = [],
          eR = (0, f.forwardRef)(({ className: e, children: t, onMount: n, onUnmount: r, appendToBody: o, id: i }, a) => {
            let s = eO(i),
              [l, u] = (0, f.useState)(null),
              [c, h] = (0, f.useState)(null),
              p = (0, f.useRef)(null);
            return (
              (0, f.useImperativeHandle)(a, () => p.current),
              (0, d.jsx)(eD, {
                className: e,
                ref: p,
                appendToBody: o,
                onMount: () => {
                  ez.push(s);
                  let e = ez.indexOf(s);
                  u(e);
                  let t = 990 + 2 * e + 1;
                  h(t), null == n || n({ portalId: s, overlayIndex: t, portalIndex: e, backdropIndex: t });
                },
                onUnmount: () => {
                  null == r || r(), ez.splice(ez.indexOf(s), 1), u(null), h(null);
                },
                children: t({ overlayIndex: c, portalIndex: l, backdropIndex: c, portalId: s })
              })
            );
          });
        eR.defaultProps = { appendToBody: !0 };
        let eL = ({ portalIndex: e, zIndex: t, className: n, onClick: r }) =>
          (0, d.jsx)(C.E.div, {
            className: A("_backdrop_uxwv8_1", n),
            initial: { opacity: 0 },
            animate: { opacity: 0.8 - e / 10 },
            exit: { opacity: 0 },
            style: { zIndex: t },
            onClick: r
          });
        eL.defaultProps = { zIndex: 998, portalIndex: 0 };
        let eF = (0, f.forwardRef)(
            ({ children: e, className: t, elementType: n = "span", trigger: r = ["click"], onOpen: o = () => void 0, onClose: i = () => void 0 }, a) => {
              let s = (0, f.useCallback)(e => (Array.isArray(r) ? r.includes(e) : e === r), [r]),
                l = (0, f.useCallback)(
                  e => {
                    s("focus") && o({ type: "focus", nativeEvent: e });
                  },
                  [o, s]
                ),
                u = (0, f.useCallback)(
                  e => {
                    s("focus") && i({ type: "focus", nativeEvent: e });
                  },
                  [i, s]
                ),
                c = (0, f.useCallback)(
                  e => {
                    s("hover") && o({ type: "hover", nativeEvent: e });
                  },
                  [o, s]
                ),
                h = (0, f.useCallback)(
                  e => {
                    s("hover") && i({ type: "hover", nativeEvent: e });
                  },
                  [i, s]
                ),
                p = (0, f.useCallback)(
                  e => {
                    s("click") && o({ type: "click", nativeEvent: e }), s("click") || i({ type: "hover", nativeEvent: e });
                  },
                  [o, i, s]
                ),
                _ = (0, f.useCallback)(
                  e => {
                    s("contextmenu") && (e.preventDefault(), o({ type: "contextmenu", nativeEvent: e }));
                  },
                  [o]
                ),
                g = s("focus") ? -1 : void 0;
              return (0, d.jsx)(n, {
                ref: a,
                tabIndex: g,
                onMouseEnter: c,
                onMouseLeave: h,
                onFocus: l,
                onBlur: u,
                onClick: p,
                onContextMenu: _,
                className: t,
                children: e
              });
            }
          ),
          eI = (e, { followCursor: t, placement: n, modifiers: r } = {}) => {
            let o = (0, f.useRef)(null),
              i = (0, f.useRef)(null),
              a = (0, f.useRef)({ pageX: 0, pageY: 0 }),
              s = e.current,
              l = (0, f.useMemo)(() => {
                if (void 0 !== e.current) return e.current;
                if (t)
                  return {
                    getBoundingClientRect: () => ({
                      top: a.current.pageY,
                      right: a.current.pageX,
                      bottom: a.current.pageY,
                      left: a.current.pageX,
                      width: 0,
                      height: 0
                    }),
                    clientWidth: 0,
                    clientHeight: 0
                  };
                if (e && !e.getBoundingClientRect) {
                  let { top: t, left: n, width: r, height: o } = e;
                  return {
                    getBoundingClientRect: () => ({ top: t, left: n, width: r, bottom: t - o, right: n - r, height: o }),
                    clientWidth: r,
                    clientHeight: o
                  };
                }
                return e;
              }, [t, e, s, a]);
            return (
              (0, f.useLayoutEffect)(() => {
                let e;
                let s = ({ pageX: e, pageY: t }) => {
                    var n;
                    (a.current = { pageX: e, pageY: t }), null == (n = i.current) || n.scheduleUpdate();
                  },
                  u = () => {
                    e = requestAnimationFrame(() => {
                      var e;
                      null == (e = i.current) || e.scheduleUpdate();
                    });
                  };
                return (
                  o.current &&
                    l &&
                    (i.current = new eT(l, o.current, {
                      placement: n || "top",
                      modifiers: r || {},
                      onCreate: () => {
                        window.addEventListener("scroll", u), t && window.addEventListener("mousemove", s);
                      }
                    })),
                  () => {
                    var n;
                    !o.current &&
                      (null == (n = i.current) || n.destroy(),
                      cancelAnimationFrame(e),
                      window.removeEventListener("scroll", u),
                      t && window.removeEventListener("mousemove", s));
                  }
                );
              }, [o.current]),
              (0, f.useLayoutEffect)(() => {
                i.current && ((i.current.reference = l), i.current.scheduleUpdate());
              }, [l]),
              [o, i]
            );
          };
        function eB({ children: e, element: t, childRef: n, ...r }) {
          let o = (0, f.useMemo)(
            () => e => {
              let n = t.props;
              return Object.keys(e).reduce((t, r) => {
                let o = e[r],
                  i = n[r];
                return (
                  "function" == typeof o && "function" == typeof i
                    ? (t[r] = (...e) => {
                        o(...e), i(...e);
                      })
                    : "className" === r
                      ? (t[r] = A(o, i))
                      : (t[r] = o),
                  t
                );
              }, {});
            },
            [r]
          );
          if (null === t) return e;
          let i = n
              ? e => {
                  "function" == typeof n ? n(e) : i && (n.current = e);
                }
              : void 0,
            a = o(r);
          return (0, f.cloneElement)(t, { ...t.props, ...a, children: e, ref: i });
        }
        let eU = (0, f.forwardRef)(
          (
            {
              triggerRef: e,
              children: t,
              portalClassName: n,
              closeOnBodyClick: r,
              closeOnEscape: o,
              elementType: i,
              appendToBody: a,
              followCursor: s,
              modifiers: l,
              placement: u,
              onClose: c
            },
            h
          ) => {
            let p = eO(),
              [_, g] = (0, f.useState)(null),
              [m, v] = eI(e, { followCursor: s, modifiers: l, placement: u });
            return (
              (0, f.useImperativeHandle)(h, () => ({
                updatePosition: () => {
                  var e;
                  null == (e = null == v ? void 0 : v.current) || e.scheduleUpdate();
                }
              })),
              eC({
                open: !0,
                ref: m,
                onClickOutside: (0, f.useCallback)(
                  t => {
                    if (r) {
                      let n = null;
                      e.current ? (n = e.current) : void 0 !== e.contains && (n = e);
                      let r = t.target.closest(".rdk-portal"),
                        o = ez.indexOf(p) === ez.length - 1;
                      (null == n ? void 0 : n.contains(t.target)) || (!o && r) || null == c || c(t);
                    }
                  },
                  [r, c]
                ),
                onEscape: (0, f.useCallback)(() => {
                  o && (null == c || c());
                }, [o, c])
              }),
              (0, f.useEffect)(() => {
                m && _ && (m.current.style.zIndex = _);
              }, [m.current, _]),
              (0, d.jsx)(eR, {
                id: p,
                ref: m,
                className: n,
                elementType: i,
                appendToBody: a,
                onMount: e => g(e.overlayIndex),
                onUnmount: () => g(null),
                children: t
              })
            );
          }
        );
        eU.defaultProps = { closeOnBodyClick: !0, closeOnEscape: !0, appendToBody: !0, placement: "bottom" };
        let eq = (0, f.forwardRef)(
          ({ reference: e, children: t, open: n, content: r, triggerElement: o, triggerClassName: i, trigger: a, onOpen: s, onClose: l, ...u }, c) => {
            let h = (0, f.useRef)(!1),
              p = (0, f.useRef)(null),
              _ = (0, f.useRef)(null),
              g = e || p;
            (0, f.useImperativeHandle)(c, () => ({
              updatePosition: () => {
                var e;
                null == (e = _.current) || e.updatePosition();
              }
            })),
              (0, f.useEffect)(() => {
                h.current && (n ? null == s || s() : null == l || l());
              }, [n]),
              (0, f.useEffect)(() => {
                h.current || (h.current = !0);
              });
            let m = (0, f.useMemo)(() => ({ close: () => (null == l ? void 0 : l()) }), [l]);
            return (0, d.jsxs)(eP.Provider, {
              value: m,
              children: [
                t &&
                  (0, d.jsx)(f.Fragment, {
                    children: a ? (0, d.jsx)(eF, { elementType: o, ref: p, className: i, trigger: a, onOpen: s, onClose: l, children: t }) : t
                  }),
                (0, d.jsx)(P.M, { children: n && (0, d.jsx)(eU, { ...u, ref: _, triggerRef: g, onClose: l, children: r }) })
              ]
            });
          }
        );
        eq.defaultProps = { trigger: "click" };
        var eH = n(47035);
        function eY(e, t) {
          let n;
          if (void 0 === t) for (let t of e) null != t && (n < t || (void 0 === n && t >= t)) && (n = t);
          else {
            let r = -1;
            for (let o of e) null != (o = t(o, ++r, e)) && (n < o || (void 0 === n && o >= o)) && (n = o);
          }
          return n;
        }
        function eW(e, t) {
          let n;
          if (void 0 === t) for (let t of e) null != t && (n > t || (void 0 === n && t >= t)) && (n = t);
          else {
            let r = -1;
            for (let o of e) null != (o = t(o, ++r, e)) && (n > o || (void 0 === n && o >= o)) && (n = o);
          }
          return n;
        }
        function eZ(e, t) {
          return null == e || null == t ? NaN : e < t ? -1 : e > t ? 1 : e >= t ? 0 : NaN;
        }
        function eX(e, t) {
          return null == e || null == t ? NaN : t < e ? -1 : t > e ? 1 : t >= e ? 0 : NaN;
        }
        function eV(e) {
          let t, n, r;
          function o(e, r, i = 0, a = e.length) {
            if (i < a) {
              if (0 !== t(r, r)) return a;
              do {
                let t = (i + a) >>> 1;
                0 > n(e[t], r) ? (i = t + 1) : (a = t);
              } while (i < a);
            }
            return i;
          }
          return (
            2 !== e.length ? ((t = eZ), (n = (t, n) => eZ(e(t), n)), (r = (t, n) => e(t) - n)) : ((t = e === eZ || e === eX ? e : eG), (n = e), (r = e)),
            {
              left: o,
              center: function (e, t, n = 0, i = e.length) {
                let a = o(e, t, n, i - 1);
                return a > n && r(e[a - 1], t) > -r(e[a], t) ? a - 1 : a;
              },
              right: function (e, r, o = 0, i = e.length) {
                if (o < i) {
                  if (0 !== t(r, r)) return i;
                  do {
                    let t = (o + i) >>> 1;
                    0 >= n(e[t], r) ? (o = t + 1) : (i = t);
                  } while (o < i);
                }
                return o;
              }
            }
          );
        }
        function eG() {
          return 0;
        }
        function eJ(e, t, n) {
          (e *= 1), (t *= 1), (n = (o = arguments.length) < 2 ? ((t = e), (e = 0), 1) : o < 3 ? 1 : +n);
          for (var r = -1, o = 0 | Math.max(0, Math.ceil((t - e) / n)), i = Array(o); ++r < o; ) i[r] = e + r * n;
          return i;
        }
        function eK(e, t) {
          return (null == e || !(e >= e)) - (null == t || !(t >= t)) || (e < t ? -1 : +(e > t));
        }
        function eQ(e, t, n) {
          let r = e[t];
          (e[t] = e[n]), (e[n] = r);
        }
        function e0(e) {
          return null === e ? NaN : +e;
        }
        function e1(e, t) {
          return (function (e, t, n) {
            if (
              !(
                !(r = (e = Float64Array.from(
                  (function* (e, t) {
                    if (void 0 === t) for (let t of e) null != t && (t *= 1) >= t && (yield t);
                    else {
                      let n = -1;
                      for (let r of e) null != (r = t(r, ++n, e)) && (r *= 1) >= r && (yield r);
                    }
                  })(e, n)
                )).length) || isNaN((t *= 1))
              )
            ) {
              if (t <= 0 || r < 2) return eW(e);
              if (t >= 1) return eY(e);
              var r,
                o = (r - 1) * t,
                i = Math.floor(o),
                a = eY(
                  (function e(t, n, r = 0, o = 1 / 0, i) {
                    if (((n = Math.floor(n)), (r = Math.floor(Math.max(0, r))), (o = Math.floor(Math.min(t.length - 1, o))), !(r <= n && n <= o))) return t;
                    for (
                      i =
                        void 0 === i
                          ? eK
                          : (function (e = eZ) {
                              if (e === eZ) return eK;
                              if ("function" != typeof e) throw TypeError("compare is not a function");
                              return (t, n) => {
                                let r = e(t, n);
                                return r || 0 === r ? r : (0 === e(n, n)) - (0 === e(t, t));
                              };
                            })(i);
                      o > r;

                    ) {
                      if (o - r > 600) {
                        let a = o - r + 1,
                          s = n - r + 1,
                          l = Math.log(a),
                          u = 0.5 * Math.exp((2 * l) / 3),
                          c = 0.5 * Math.sqrt((l * u * (a - u)) / a) * (s - a / 2 < 0 ? -1 : 1),
                          d = Math.max(r, Math.floor(n - (s * u) / a + c)),
                          f = Math.min(o, Math.floor(n + ((a - s) * u) / a + c));
                        e(t, n, d, f, i);
                      }
                      let a = t[n],
                        s = r,
                        l = o;
                      for (eQ(t, r, n), i(t[o], a) > 0 && eQ(t, r, o); s < l; ) {
                        for (eQ(t, s, l), ++s, --l; 0 > i(t[s], a); ) ++s;
                        for (; i(t[l], a) > 0; ) --l;
                      }
                      0 === i(t[r], a) ? eQ(t, r, l) : eQ(t, ++l, o), l <= n && (r = l + 1), n <= l && (o = l - 1);
                    }
                    return t;
                  })(e, i).subarray(0, i + 1)
                );
              return a + (eW(e.subarray(i + 1)) - a) * (o - i);
            }
          })(e, 0.5, t);
        }
        function e2(e, t) {
          let n, r;
          if (void 0 === t) for (let t of e) null != t && (void 0 === n ? t >= t && (n = r = t) : (n > t && (n = t), r < t && (r = t)));
          else {
            let o = -1;
            for (let i of e) null != (i = t(i, ++o, e)) && (void 0 === n ? i >= i && (n = r = i) : (n > i && (n = i), r < i && (r = i)));
          }
          return [n, r];
        }
        let e3 = Math.sqrt(50),
          e5 = Math.sqrt(10),
          e8 = Math.sqrt(2);
        function e6(e, t, n) {
          let r, o, i;
          let a = (t - e) / Math.max(0, n),
            s = Math.floor(Math.log10(a)),
            l = a / Math.pow(10, s),
            u = l >= e3 ? 10 : l >= e5 ? 5 : l >= e8 ? 2 : 1;
          return (s < 0
            ? ((r = Math.round(e * (i = Math.pow(10, -s) / u))), (o = Math.round(t * i)), r / i < e && ++r, o / i > t && --o, (i = -i))
            : ((r = Math.round(e / (i = Math.pow(10, s) * u))), (o = Math.round(t / i)), r * i < e && ++r, o * i > t && --o),
          o < r && 0.5 <= n && n < 2)
            ? e6(e, t, 2 * n)
            : [r, o, i];
        }
        function e4(e, t, n) {
          return e6((e *= 1), (t *= 1), (n *= 1))[2];
        }
        function e7(e, t, n) {
          (t *= 1), (e *= 1), (n *= 1);
          let r = t < e,
            o = r ? e4(t, e, n) : e4(e, t, n);
          return (r ? -1 : 1) * (o < 0 ? -(1 / o) : o);
        }
        let e9 = eV(eZ),
          te = e9.right;
        function tt(e, t, n) {
          (e.prototype = t.prototype = n), (n.constructor = e);
        }
        function tn(e, t) {
          var n = Object.create(e.prototype);
          for (var r in t) n[r] = t[r];
          return n;
        }
        function tr() {}
        e9.left, eV(e0).center;
        var to = "\\s*([+-]?\\d+)\\s*",
          ti = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*",
          ta = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*",
          ts = /^#([0-9a-f]{3,8})$/,
          tl = RegExp(`^rgb\\(${to},${to},${to}\\)$`),
          tu = RegExp(`^rgb\\(${ta},${ta},${ta}\\)$`),
          tc = RegExp(`^rgba\\(${to},${to},${to},${ti}\\)$`),
          td = RegExp(`^rgba\\(${ta},${ta},${ta},${ti}\\)$`),
          tf = RegExp(`^hsl\\(${ti},${ta},${ta}\\)$`),
          th = RegExp(`^hsla\\(${ti},${ta},${ta},${ti}\\)$`),
          tp = {
            aliceblue: 0xf0f8ff,
            antiquewhite: 0xfaebd7,
            aqua: 65535,
            aquamarine: 8388564,
            azure: 0xf0ffff,
            beige: 0xf5f5dc,
            bisque: 0xffe4c4,
            black: 0,
            blanchedalmond: 0xffebcd,
            blue: 255,
            blueviolet: 9055202,
            brown: 0xa52a2a,
            burlywood: 0xdeb887,
            cadetblue: 6266528,
            chartreuse: 8388352,
            chocolate: 0xd2691e,
            coral: 0xff7f50,
            cornflowerblue: 6591981,
            cornsilk: 0xfff8dc,
            crimson: 0xdc143c,
            cyan: 65535,
            darkblue: 139,
            darkcyan: 35723,
            darkgoldenrod: 0xb8860b,
            darkgray: 0xa9a9a9,
            darkgreen: 25600,
            darkgrey: 0xa9a9a9,
            darkkhaki: 0xbdb76b,
            darkmagenta: 9109643,
            darkolivegreen: 5597999,
            darkorange: 0xff8c00,
            darkorchid: 0x9932cc,
            darkred: 9109504,
            darksalmon: 0xe9967a,
            darkseagreen: 9419919,
            darkslateblue: 4734347,
            darkslategray: 3100495,
            darkslategrey: 3100495,
            darkturquoise: 52945,
            darkviolet: 9699539,
            deeppink: 0xff1493,
            deepskyblue: 49151,
            dimgray: 6908265,
            dimgrey: 6908265,
            dodgerblue: 2003199,
            firebrick: 0xb22222,
            floralwhite: 0xfffaf0,
            forestgreen: 2263842,
            fuchsia: 0xff00ff,
            gainsboro: 0xdcdcdc,
            ghostwhite: 0xf8f8ff,
            gold: 0xffd700,
            goldenrod: 0xdaa520,
            gray: 8421504,
            green: 32768,
            greenyellow: 0xadff2f,
            grey: 8421504,
            honeydew: 0xf0fff0,
            hotpink: 0xff69b4,
            indianred: 0xcd5c5c,
            indigo: 4915330,
            ivory: 0xfffff0,
            khaki: 0xf0e68c,
            lavender: 0xe6e6fa,
            lavenderblush: 0xfff0f5,
            lawngreen: 8190976,
            lemonchiffon: 0xfffacd,
            lightblue: 0xadd8e6,
            lightcoral: 0xf08080,
            lightcyan: 0xe0ffff,
            lightgoldenrodyellow: 0xfafad2,
            lightgray: 0xd3d3d3,
            lightgreen: 9498256,
            lightgrey: 0xd3d3d3,
            lightpink: 0xffb6c1,
            lightsalmon: 0xffa07a,
            lightseagreen: 2142890,
            lightskyblue: 8900346,
            lightslategray: 7833753,
            lightslategrey: 7833753,
            lightsteelblue: 0xb0c4de,
            lightyellow: 0xffffe0,
            lime: 65280,
            limegreen: 3329330,
            linen: 0xfaf0e6,
            magenta: 0xff00ff,
            maroon: 8388608,
            mediumaquamarine: 6737322,
            mediumblue: 205,
            mediumorchid: 0xba55d3,
            mediumpurple: 9662683,
            mediumseagreen: 3978097,
            mediumslateblue: 8087790,
            mediumspringgreen: 64154,
            mediumturquoise: 4772300,
            mediumvioletred: 0xc71585,
            midnightblue: 1644912,
            mintcream: 0xf5fffa,
            mistyrose: 0xffe4e1,
            moccasin: 0xffe4b5,
            navajowhite: 0xffdead,
            navy: 128,
            oldlace: 0xfdf5e6,
            olive: 8421376,
            olivedrab: 7048739,
            orange: 0xffa500,
            orangered: 0xff4500,
            orchid: 0xda70d6,
            palegoldenrod: 0xeee8aa,
            palegreen: 0x98fb98,
            paleturquoise: 0xafeeee,
            palevioletred: 0xdb7093,
            papayawhip: 0xffefd5,
            peachpuff: 0xffdab9,
            peru: 0xcd853f,
            pink: 0xffc0cb,
            plum: 0xdda0dd,
            powderblue: 0xb0e0e6,
            purple: 8388736,
            rebeccapurple: 6697881,
            red: 0xff0000,
            rosybrown: 0xbc8f8f,
            royalblue: 4286945,
            saddlebrown: 9127187,
            salmon: 0xfa8072,
            sandybrown: 0xf4a460,
            seagreen: 3050327,
            seashell: 0xfff5ee,
            sienna: 0xa0522d,
            silver: 0xc0c0c0,
            skyblue: 8900331,
            slateblue: 6970061,
            slategray: 7372944,
            slategrey: 7372944,
            snow: 0xfffafa,
            springgreen: 65407,
            steelblue: 4620980,
            tan: 0xd2b48c,
            teal: 32896,
            thistle: 0xd8bfd8,
            tomato: 0xff6347,
            turquoise: 4251856,
            violet: 0xee82ee,
            wheat: 0xf5deb3,
            white: 0xffffff,
            whitesmoke: 0xf5f5f5,
            yellow: 0xffff00,
            yellowgreen: 0x9acd32
          };
        function t_() {
          return this.rgb().formatHex();
        }
        function tg() {
          return this.rgb().formatRgb();
        }
        function tm(e) {
          var t, n;
          return (
            (e = (e + "").trim().toLowerCase()),
            (t = ts.exec(e))
              ? ((n = t[1].length),
                (t = parseInt(t[1], 16)),
                6 === n
                  ? tv(t)
                  : 3 === n
                    ? new tx(((t >> 8) & 15) | ((t >> 4) & 240), ((t >> 4) & 15) | (240 & t), ((15 & t) << 4) | (15 & t), 1)
                    : 8 === n
                      ? ty((t >> 24) & 255, (t >> 16) & 255, (t >> 8) & 255, (255 & t) / 255)
                      : 4 === n
                        ? ty(
                            ((t >> 12) & 15) | ((t >> 8) & 240),
                            ((t >> 8) & 15) | ((t >> 4) & 240),
                            ((t >> 4) & 15) | (240 & t),
                            (((15 & t) << 4) | (15 & t)) / 255
                          )
                        : null)
              : (t = tl.exec(e))
                ? new tx(t[1], t[2], t[3], 1)
                : (t = tu.exec(e))
                  ? new tx((255 * t[1]) / 100, (255 * t[2]) / 100, (255 * t[3]) / 100, 1)
                  : (t = tc.exec(e))
                    ? ty(t[1], t[2], t[3], t[4])
                    : (t = td.exec(e))
                      ? ty((255 * t[1]) / 100, (255 * t[2]) / 100, (255 * t[3]) / 100, t[4])
                      : (t = tf.exec(e))
                        ? tS(t[1], t[2] / 100, t[3] / 100, 1)
                        : (t = th.exec(e))
                          ? tS(t[1], t[2] / 100, t[3] / 100, t[4])
                          : tp.hasOwnProperty(e)
                            ? tv(tp[e])
                            : "transparent" === e
                              ? new tx(NaN, NaN, NaN, 0)
                              : null
          );
        }
        function tv(e) {
          return new tx((e >> 16) & 255, (e >> 8) & 255, 255 & e, 1);
        }
        function ty(e, t, n, r) {
          return r <= 0 && (e = t = n = NaN), new tx(e, t, n, r);
        }
        function tb(e, t, n, r) {
          var o;
          return 1 == arguments.length
            ? ((o = e) instanceof tr || (o = tm(o)), o)
              ? new tx((o = o.rgb()).r, o.g, o.b, o.opacity)
              : new tx()
            : new tx(e, t, n, null == r ? 1 : r);
        }
        function tx(e, t, n, r) {
          (this.r = +e), (this.g = +t), (this.b = +n), (this.opacity = +r);
        }
        function tw() {
          return `#${tE(this.r)}${tE(this.g)}${tE(this.b)}`;
        }
        function tk() {
          let e = tM(this.opacity);
          return `${1 === e ? "rgb(" : "rgba("}${tj(this.r)}, ${tj(this.g)}, ${tj(this.b)}${1 === e ? ")" : `, ${e})`}`;
        }
        function tM(e) {
          return isNaN(e) ? 1 : Math.max(0, Math.min(1, e));
        }
        function tj(e) {
          return Math.max(0, Math.min(255, Math.round(e) || 0));
        }
        function tE(e) {
          return ((e = tj(e)) < 16 ? "0" : "") + e.toString(16);
        }
        function tS(e, t, n, r) {
          return r <= 0 ? (e = t = n = NaN) : n <= 0 || n >= 1 ? (e = t = NaN) : t <= 0 && (e = NaN), new tC(e, t, n, r);
        }
        function tT(e) {
          if (e instanceof tC) return new tC(e.h, e.s, e.l, e.opacity);
          if ((e instanceof tr || (e = tm(e)), !e)) return new tC();
          if (e instanceof tC) return e;
          var t = (e = e.rgb()).r / 255,
            n = e.g / 255,
            r = e.b / 255,
            o = Math.min(t, n, r),
            i = Math.max(t, n, r),
            a = NaN,
            s = i - o,
            l = (i + o) / 2;
          return (
            s
              ? ((a = t === i ? (n - r) / s + (n < r) * 6 : n === i ? (r - t) / s + 2 : (t - n) / s + 4), (s /= l < 0.5 ? i + o : 2 - i - o), (a *= 60))
              : (s = l > 0 && l < 1 ? 0 : a),
            new tC(a, s, l, e.opacity)
          );
        }
        function tC(e, t, n, r) {
          (this.h = +e), (this.s = +t), (this.l = +n), (this.opacity = +r);
        }
        function tP(e) {
          return (e = (e || 0) % 360) < 0 ? e + 360 : e;
        }
        function tN(e) {
          return Math.max(0, Math.min(1, e || 0));
        }
        function tA(e, t, n) {
          return (e < 60 ? t + ((n - t) * e) / 60 : e < 180 ? n : e < 240 ? t + ((n - t) * (240 - e)) / 60 : t) * 255;
        }
        function tO(e, t, n, r, o) {
          var i = e * e,
            a = i * e;
          return ((1 - 3 * e + 3 * i - a) * t + (4 - 6 * i + 3 * a) * n + (1 + 3 * e + 3 * i - 3 * a) * r + a * o) / 6;
        }
        tt(tr, tm, {
          copy(e) {
            return Object.assign(new this.constructor(), this, e);
          },
          displayable() {
            return this.rgb().displayable();
          },
          hex: t_,
          formatHex: t_,
          formatHex8: function () {
            return this.rgb().formatHex8();
          },
          formatHsl: function () {
            return tT(this).formatHsl();
          },
          formatRgb: tg,
          toString: tg
        }),
          tt(
            tx,
            tb,
            tn(tr, {
              brighter(e) {
                return (e = null == e ? 1.4285714285714286 : Math.pow(1.4285714285714286, e)), new tx(this.r * e, this.g * e, this.b * e, this.opacity);
              },
              darker(e) {
                return (e = null == e ? 0.7 : Math.pow(0.7, e)), new tx(this.r * e, this.g * e, this.b * e, this.opacity);
              },
              rgb() {
                return this;
              },
              clamp() {
                return new tx(tj(this.r), tj(this.g), tj(this.b), tM(this.opacity));
              },
              displayable() {
                return (
                  -0.5 <= this.r &&
                  this.r < 255.5 &&
                  -0.5 <= this.g &&
                  this.g < 255.5 &&
                  -0.5 <= this.b &&
                  this.b < 255.5 &&
                  0 <= this.opacity &&
                  this.opacity <= 1
                );
              },
              hex: tw,
              formatHex: tw,
              formatHex8: function () {
                return `#${tE(this.r)}${tE(this.g)}${tE(this.b)}${tE((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
              },
              formatRgb: tk,
              toString: tk
            })
          ),
          tt(
            tC,
            function (e, t, n, r) {
              return 1 == arguments.length ? tT(e) : new tC(e, t, n, null == r ? 1 : r);
            },
            tn(tr, {
              brighter(e) {
                return (e = null == e ? 1.4285714285714286 : Math.pow(1.4285714285714286, e)), new tC(this.h, this.s, this.l * e, this.opacity);
              },
              darker(e) {
                return (e = null == e ? 0.7 : Math.pow(0.7, e)), new tC(this.h, this.s, this.l * e, this.opacity);
              },
              rgb() {
                var e = (this.h % 360) + (this.h < 0) * 360,
                  t = isNaN(e) || isNaN(this.s) ? 0 : this.s,
                  n = this.l,
                  r = n + (n < 0.5 ? n : 1 - n) * t,
                  o = 2 * n - r;
                return new tx(tA(e >= 240 ? e - 240 : e + 120, o, r), tA(e, o, r), tA(e < 120 ? e + 240 : e - 120, o, r), this.opacity);
              },
              clamp() {
                return new tC(tP(this.h), tN(this.s), tN(this.l), tM(this.opacity));
              },
              displayable() {
                return ((0 <= this.s && this.s <= 1) || isNaN(this.s)) && 0 <= this.l && this.l <= 1 && 0 <= this.opacity && this.opacity <= 1;
              },
              formatHsl() {
                let e = tM(this.opacity);
                return `${1 === e ? "hsl(" : "hsla("}${tP(this.h)}, ${100 * tN(this.s)}%, ${100 * tN(this.l)}%${1 === e ? ")" : `, ${e})`}`;
              }
            })
          );
        let t$ = e => () => e;
        function tD(e, t) {
          var n = t - e;
          return n
            ? function (t) {
                return e + t * n;
              }
            : t$(isNaN(e) ? t : e);
        }
        let tz = (function e(t) {
          var n,
            r =
              1 == (n = +t)
                ? tD
                : function (e, t) {
                    var r, o, i;
                    return t - e
                      ? ((r = e),
                        (o = t),
                        (r = Math.pow(r, (i = n))),
                        (o = Math.pow(o, i) - r),
                        (i = 1 / i),
                        function (e) {
                          return Math.pow(r + e * o, i);
                        })
                      : t$(isNaN(e) ? t : e);
                  };
          function o(e, t) {
            var n = r((e = tb(e)).r, (t = tb(t)).r),
              o = r(e.g, t.g),
              i = r(e.b, t.b),
              a = tD(e.opacity, t.opacity);
            return function (t) {
              return (e.r = n(t)), (e.g = o(t)), (e.b = i(t)), (e.opacity = a(t)), e + "";
            };
          }
          return (o.gamma = e), o;
        })(1);
        function tR(e) {
          return function (t) {
            var n,
              r,
              o = t.length,
              i = Array(o),
              a = Array(o),
              s = Array(o);
            for (n = 0; n < o; ++n) (r = tb(t[n])), (i[n] = r.r || 0), (a[n] = r.g || 0), (s[n] = r.b || 0);
            return (
              (i = e(i)),
              (a = e(a)),
              (s = e(s)),
              (r.opacity = 1),
              function (e) {
                return (r.r = i(e)), (r.g = a(e)), (r.b = s(e)), r + "";
              }
            );
          };
        }
        function tL(e, t) {
          return (
            (e *= 1),
            (t *= 1),
            function (n) {
              return e * (1 - n) + t * n;
            }
          );
        }
        tR(function (e) {
          var t = e.length - 1;
          return function (n) {
            var r = n <= 0 ? (n = 0) : n >= 1 ? ((n = 1), t - 1) : Math.floor(n * t),
              o = e[r],
              i = e[r + 1],
              a = r > 0 ? e[r - 1] : 2 * o - i,
              s = r < t - 1 ? e[r + 2] : 2 * i - o;
            return tO((n - r / t) * t, a, o, i, s);
          };
        }),
          tR(function (e) {
            var t = e.length;
            return function (n) {
              var r = Math.floor(((n %= 1) < 0 ? ++n : n) * t),
                o = e[(r + t - 1) % t],
                i = e[r % t],
                a = e[(r + 1) % t],
                s = e[(r + 2) % t];
              return tO((n - r / t) * t, o, i, a, s);
            };
          });
        var tF = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g,
          tI = RegExp(tF.source, "g");
        function tB(e, t) {
          var n,
            r,
            o = typeof t;
          return null == t || "boolean" === o
            ? t$(t)
            : ("number" === o
                ? tL
                : "string" === o
                  ? (r = tm(t))
                    ? ((t = r), tz)
                    : function (e, t) {
                        var n,
                          r,
                          o,
                          i,
                          a,
                          s = (tF.lastIndex = tI.lastIndex = 0),
                          l = -1,
                          u = [],
                          c = [];
                        for (e += "", t += ""; (o = tF.exec(e)) && (i = tI.exec(t)); )
                          (a = i.index) > s && ((a = t.slice(s, a)), u[l] ? (u[l] += a) : (u[++l] = a)),
                            (o = o[0]) === (i = i[0]) ? (u[l] ? (u[l] += i) : (u[++l] = i)) : ((u[++l] = null), c.push({ i: l, x: tL(o, i) })),
                            (s = tI.lastIndex);
                        return (
                          s < t.length && ((a = t.slice(s)), u[l] ? (u[l] += a) : (u[++l] = a)),
                          u.length < 2
                            ? c[0]
                              ? ((n = c[0].x),
                                function (e) {
                                  return n(e) + "";
                                })
                              : ((r = t),
                                function () {
                                  return r;
                                })
                            : ((t = c.length),
                              function (e) {
                                for (var n, r = 0; r < t; ++r) u[(n = c[r]).i] = n.x(e);
                                return u.join("");
                              })
                        );
                      }
                  : t instanceof tm
                    ? tz
                    : t instanceof Date
                      ? function (e, t) {
                          var n = new Date();
                          return (
                            (e *= 1),
                            (t *= 1),
                            function (r) {
                              return n.setTime(e * (1 - r) + t * r), n;
                            }
                          );
                        }
                      : !ArrayBuffer.isView((n = t)) || n instanceof DataView
                        ? Array.isArray(t)
                          ? function (e, t) {
                              var n,
                                r = t ? t.length : 0,
                                o = e ? Math.min(r, e.length) : 0,
                                i = Array(o),
                                a = Array(r);
                              for (n = 0; n < o; ++n) i[n] = tB(e[n], t[n]);
                              for (; n < r; ++n) a[n] = t[n];
                              return function (e) {
                                for (n = 0; n < o; ++n) a[n] = i[n](e);
                                return a;
                              };
                            }
                          : ("function" != typeof t.valueOf && "function" != typeof t.toString) || isNaN(t)
                            ? function (e, t) {
                                var n,
                                  r = {},
                                  o = {};
                                for (n in ((null === e || "object" != typeof e) && (e = {}), (null === t || "object" != typeof t) && (t = {}), t))
                                  n in e ? (r[n] = tB(e[n], t[n])) : (o[n] = t[n]);
                                return function (e) {
                                  for (n in r) o[n] = r[n](e);
                                  return o;
                                };
                              }
                            : tL
                        : function (e, t) {
                            t || (t = []);
                            var n,
                              r = e ? Math.min(t.length, e.length) : 0,
                              o = t.slice();
                            return function (i) {
                              for (n = 0; n < r; ++n) o[n] = e[n] * (1 - i) + t[n] * i;
                              return o;
                            };
                          })(e, t);
        }
        function tU(e, t) {
          return (
            (e *= 1),
            (t *= 1),
            function (n) {
              return Math.round(e * (1 - n) + t * n);
            }
          );
        }
        function tq(e) {
          return +e;
        }
        var tH = [0, 1];
        function tY(e) {
          return e;
        }
        function tW(e, t) {
          var n;
          return (t -= e *= 1)
            ? function (n) {
                return (n - e) / t;
              }
            : ((n = isNaN(t) ? NaN : 0.5),
              function () {
                return n;
              });
        }
        function tZ(e, t, n) {
          var r = e[0],
            o = e[1],
            i = t[0],
            a = t[1];
          return (
            o < r ? ((r = tW(o, r)), (i = n(a, i))) : ((r = tW(r, o)), (i = n(i, a))),
            function (e) {
              return i(r(e));
            }
          );
        }
        function tX(e, t, n) {
          var r = Math.min(e.length, t.length) - 1,
            o = Array(r),
            i = Array(r),
            a = -1;
          for (e[r] < e[0] && ((e = e.slice().reverse()), (t = t.slice().reverse())); ++a < r; ) (o[a] = tW(e[a], e[a + 1])), (i[a] = n(t[a], t[a + 1]));
          return function (t) {
            var n = te(e, t, 1, r) - 1;
            return i[n](o[n](t));
          };
        }
        function tV(e, t) {
          return t.domain(e.domain()).range(e.range()).interpolate(e.interpolate()).clamp(e.clamp()).unknown(e.unknown());
        }
        function tG() {
          return (function () {
            var e,
              t,
              n,
              r,
              o,
              i,
              a = tH,
              s = tH,
              l = tB,
              u = tY;
            function c() {
              var e,
                t,
                n,
                l = Math.min(a.length, s.length);
              return (
                u !== tY &&
                  ((e = a[0]),
                  (t = a[l - 1]),
                  e > t && ((n = e), (e = t), (t = n)),
                  (u = function (n) {
                    return Math.max(e, Math.min(t, n));
                  })),
                (r = l > 2 ? tX : tZ),
                (o = i = null),
                d
              );
            }
            function d(t) {
              return null == t || isNaN((t *= 1)) ? n : (o || (o = r(a.map(e), s, l)))(e(u(t)));
            }
            return (
              (d.invert = function (n) {
                return u(t((i || (i = r(s, a.map(e), tL)))(n)));
              }),
              (d.domain = function (e) {
                return arguments.length ? ((a = Array.from(e, tq)), c()) : a.slice();
              }),
              (d.range = function (e) {
                return arguments.length ? ((s = Array.from(e)), c()) : s.slice();
              }),
              (d.rangeRound = function (e) {
                return (s = Array.from(e)), (l = tU), c();
              }),
              (d.clamp = function (e) {
                return arguments.length ? ((u = !!e || tY), c()) : u !== tY;
              }),
              (d.interpolate = function (e) {
                return arguments.length ? ((l = e), c()) : l;
              }),
              (d.unknown = function (e) {
                return arguments.length ? ((n = e), d) : n;
              }),
              function (n, r) {
                return (e = n), (t = r), c();
              }
            );
          })()(tY, tY);
        }
        function tJ(e, t) {
          switch (arguments.length) {
            case 0:
              break;
            case 1:
              this.range(e);
              break;
            default:
              this.range(t).domain(e);
          }
          return this;
        }
        var tK = /^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?(~)?([a-z%])?$/i;
        function tQ(e) {
          var t;
          if (!(t = tK.exec(e))) throw Error("invalid format: " + e);
          return new t0({
            fill: t[1],
            align: t[2],
            sign: t[3],
            symbol: t[4],
            zero: t[5],
            width: t[6],
            comma: t[7],
            precision: t[8] && t[8].slice(1),
            trim: t[9],
            type: t[10]
          });
        }
        function t0(e) {
          (this.fill = void 0 === e.fill ? " " : e.fill + ""),
            (this.align = void 0 === e.align ? ">" : e.align + ""),
            (this.sign = void 0 === e.sign ? "-" : e.sign + ""),
            (this.symbol = void 0 === e.symbol ? "" : e.symbol + ""),
            (this.zero = !!e.zero),
            (this.width = void 0 === e.width ? void 0 : +e.width),
            (this.comma = !!e.comma),
            (this.precision = void 0 === e.precision ? void 0 : +e.precision),
            (this.trim = !!e.trim),
            (this.type = void 0 === e.type ? "" : e.type + "");
        }
        function t1(e, t) {
          if ((n = (e = t ? e.toExponential(t - 1) : e.toExponential()).indexOf("e")) < 0) return null;
          var n,
            r = e.slice(0, n);
          return [r.length > 1 ? r[0] + r.slice(2) : r, +e.slice(n + 1)];
        }
        function t2(e) {
          return (e = t1(Math.abs(e))) ? e[1] : NaN;
        }
        function t3(e, t) {
          var n = t1(e, t);
          if (!n) return e + "";
          var r = n[0],
            o = n[1];
          return o < 0 ? "0." + Array(-o).join("0") + r : r.length > o + 1 ? r.slice(0, o + 1) + "." + r.slice(o + 1) : r + Array(o - r.length + 2).join("0");
        }
        (tQ.prototype = t0.prototype),
          (t0.prototype.toString = function () {
            return (
              this.fill +
              this.align +
              this.sign +
              this.symbol +
              (this.zero ? "0" : "") +
              (void 0 === this.width ? "" : Math.max(1, 0 | this.width)) +
              (this.comma ? "," : "") +
              (void 0 === this.precision ? "" : "." + Math.max(0, 0 | this.precision)) +
              (this.trim ? "~" : "") +
              this.type
            );
          });
        let t5 = {
          "%": (e, t) => (100 * e).toFixed(t),
          b: e => Math.round(e).toString(2),
          c: e => e + "",
          d: function (e) {
            return Math.abs((e = Math.round(e))) >= 1e21 ? e.toLocaleString("en").replace(/,/g, "") : e.toString(10);
          },
          e: (e, t) => e.toExponential(t),
          f: (e, t) => e.toFixed(t),
          g: (e, t) => e.toPrecision(t),
          o: e => Math.round(e).toString(8),
          p: (e, t) => t3(100 * e, t),
          r: t3,
          s: function (e, t) {
            var n = t1(e, t);
            if (!n) return e + "";
            var r = n[0],
              o = n[1],
              i = o - (c2 = 3 * Math.max(-8, Math.min(8, Math.floor(o / 3)))) + 1,
              a = r.length;
            return i === a
              ? r
              : i > a
                ? r + Array(i - a + 1).join("0")
                : i > 0
                  ? r.slice(0, i) + "." + r.slice(i)
                  : "0." + Array(1 - i).join("0") + t1(e, Math.max(0, t + i - 1))[0];
          },
          X: e => Math.round(e).toString(16).toUpperCase(),
          x: e => Math.round(e).toString(16)
        };
        function t8(e) {
          return e;
        }
        var t6 = Array.prototype.map,
          t4 = ["y", "z", "a", "f", "p", "n", "\xb5", "m", "", "k", "M", "G", "T", "P", "E", "Z", "Y"];
        function t7() {
          var e,
            t = tG();
          return (
            (t.copy = function () {
              return tV(t, t7());
            }),
            tJ.apply(t, arguments),
            (e = t.domain),
            (t.ticks = function (t) {
              var n = e();
              return (function (e, t, n) {
                if (((t *= 1), (e *= 1), !((n *= 1) > 0))) return [];
                if (e === t) return [e];
                let r = t < e,
                  [o, i, a] = r ? e6(t, e, n) : e6(e, t, n);
                if (!(i >= o)) return [];
                let s = i - o + 1,
                  l = Array(s);
                if (r) {
                  if (a < 0) for (let e = 0; e < s; ++e) l[e] = -((i - e) / a);
                  else for (let e = 0; e < s; ++e) l[e] = (i - e) * a;
                } else if (a < 0) for (let e = 0; e < s; ++e) l[e] = -((o + e) / a);
                else for (let e = 0; e < s; ++e) l[e] = (o + e) * a;
                return l;
              })(n[0], n[n.length - 1], null == t ? 10 : t);
            }),
            (t.tickFormat = function (t, n) {
              var r = e();
              return (function (e, t, n, r) {
                var o,
                  i,
                  a,
                  s = e7(e, t, n);
                switch ((r = tQ(null == r ? ",f" : r)).type) {
                  case "s":
                    var l = Math.max(Math.abs(e), Math.abs(t));
                    return (
                      null == r.precision &&
                        !isNaN((a = Math.max(0, 3 * Math.max(-8, Math.min(8, Math.floor(t2(l) / 3))) - t2(Math.abs(s))))) &&
                        (r.precision = a),
                      c8(r, l)
                    );
                  case "":
                  case "e":
                  case "g":
                  case "p":
                  case "r":
                    null == r.precision &&
                      !isNaN((a = Math.max(0, t2(Math.abs(Math.max(Math.abs(e), Math.abs(t))) - (o = Math.abs((o = s)))) - t2(o)) + 1)) &&
                      (r.precision = a - ("e" === r.type));
                    break;
                  case "f":
                  case "%":
                    null == r.precision && !isNaN((a = Math.max(0, -t2(Math.abs(s))))) && (r.precision = a - ("%" === r.type) * 2);
                }
                return c5(r);
              })(r[0], r[r.length - 1], null == t ? 10 : t, n);
            }),
            (t.nice = function (n) {
              null == n && (n = 10);
              var r,
                o,
                i = e(),
                a = 0,
                s = i.length - 1,
                l = i[a],
                u = i[s],
                c = 10;
              for (u < l && ((o = l), (l = u), (u = o), (o = a), (a = s), (s = o)); c-- > 0; ) {
                if ((o = e4(l, u, n)) === r) return (i[a] = l), (i[s] = u), e(i);
                if (o > 0) (l = Math.floor(l / o) * o), (u = Math.ceil(u / o) * o);
                else if (o < 0) (l = Math.ceil(l * o) / o), (u = Math.floor(u * o) / o);
                else break;
                r = o;
              }
              return t;
            }),
            t
          );
        }
        (c5 = (c3 = (function (e) {
          var t,
            n,
            r,
            o =
              void 0 === e.grouping || void 0 === e.thousands
                ? t8
                : ((t = t6.call(e.grouping, Number)),
                  (n = e.thousands + ""),
                  function (e, r) {
                    for (
                      var o = e.length, i = [], a = 0, s = t[0], l = 0;
                      o > 0 && s > 0 && (l + s + 1 > r && (s = Math.max(1, r - l)), i.push(e.substring((o -= s), o + s)), !((l += s + 1) > r));

                    )
                      s = t[(a = (a + 1) % t.length)];
                    return i.reverse().join(n);
                  }),
            i = void 0 === e.currency ? "" : e.currency[0] + "",
            a = void 0 === e.currency ? "" : e.currency[1] + "",
            s = void 0 === e.decimal ? "." : e.decimal + "",
            l =
              void 0 === e.numerals
                ? t8
                : ((r = t6.call(e.numerals, String)),
                  function (e) {
                    return e.replace(/[0-9]/g, function (e) {
                      return r[+e];
                    });
                  }),
            u = void 0 === e.percent ? "%" : e.percent + "",
            c = void 0 === e.minus ? "−" : e.minus + "",
            d = void 0 === e.nan ? "NaN" : e.nan + "";
          function f(e) {
            var t = (e = tQ(e)).fill,
              n = e.align,
              r = e.sign,
              f = e.symbol,
              h = e.zero,
              p = e.width,
              _ = e.comma,
              g = e.precision,
              m = e.trim,
              v = e.type;
            "n" === v ? ((_ = !0), (v = "g")) : t5[v] || (void 0 === g && (g = 12), (m = !0), (v = "g")),
              (h || ("0" === t && "=" === n)) && ((h = !0), (t = "0"), (n = "="));
            var y = "$" === f ? i : "#" === f && /[boxX]/.test(v) ? "0" + v.toLowerCase() : "",
              b = "$" === f ? a : /[%p]/.test(v) ? u : "",
              x = t5[v],
              w = /[defgprs%]/.test(v);
            function k(e) {
              var i,
                a,
                u,
                f = y,
                k = b;
              if ("c" === v) (k = x(e) + k), (e = "");
              else {
                var M = (e *= 1) < 0 || 1 / e < 0;
                if (
                  ((e = isNaN(e) ? d : x(Math.abs(e), g)),
                  m &&
                    (e = (function (e) {
                      t: for (var t, n = e.length, r = 1, o = -1; r < n; ++r)
                        switch (e[r]) {
                          case ".":
                            o = t = r;
                            break;
                          case "0":
                            0 === o && (o = r), (t = r);
                            break;
                          default:
                            if (!+e[r]) break t;
                            o > 0 && (o = 0);
                        }
                      return o > 0 ? e.slice(0, o) + e.slice(t + 1) : e;
                    })(e)),
                  M && 0 == +e && "+" !== r && (M = !1),
                  (f = (M ? ("(" === r ? r : c) : "-" === r || "(" === r ? "" : r) + f),
                  (k = ("s" === v ? t4[8 + c2 / 3] : "") + k + (M && "(" === r ? ")" : "")),
                  w)
                ) {
                  for (i = -1, a = e.length; ++i < a; )
                    if (48 > (u = e.charCodeAt(i)) || u > 57) {
                      (k = (46 === u ? s + e.slice(i + 1) : e.slice(i)) + k), (e = e.slice(0, i));
                      break;
                    }
                }
              }
              _ && !h && (e = o(e, 1 / 0));
              var j = f.length + e.length + k.length,
                E = j < p ? Array(p - j + 1).join(t) : "";
              switch ((_ && h && ((e = o(E + e, E.length ? p - k.length : 1 / 0)), (E = "")), n)) {
                case "<":
                  e = f + e + k + E;
                  break;
                case "=":
                  e = f + E + e + k;
                  break;
                case "^":
                  e = E.slice(0, (j = E.length >> 1)) + f + e + k + E.slice(j);
                  break;
                default:
                  e = E + f + e + k;
              }
              return l(e);
            }
            return (
              (g = void 0 === g ? 6 : /[gprs]/.test(v) ? Math.max(1, Math.min(21, g)) : Math.max(0, Math.min(20, g))),
              (k.toString = function () {
                return e + "";
              }),
              k
            );
          }
          return {
            format: f,
            formatPrefix: function (e, t) {
              var n = f((((e = tQ(e)).type = "f"), e)),
                r = 3 * Math.max(-8, Math.min(8, Math.floor(t2(t) / 3))),
                o = Math.pow(10, -r),
                i = t4[8 + r / 3];
              return function (e) {
                return n(o * e) + i;
              };
            }
          };
        })({ thousands: ",", grouping: [3], currency: ["$", ""] })).format),
          (c8 = c3.formatPrefix);
        let t9 = new Date(),
          ne = new Date();
        function nt(e, t, n, r) {
          function o(t) {
            return e((t = 0 == arguments.length ? new Date() : new Date(+t))), t;
          }
          return (
            (o.floor = t => (e((t = new Date(+t))), t)),
            (o.ceil = n => (e((n = new Date(n - 1))), t(n, 1), e(n), n)),
            (o.round = e => {
              let t = o(e),
                n = o.ceil(e);
              return e - t < n - e ? t : n;
            }),
            (o.offset = (e, n) => (t((e = new Date(+e)), null == n ? 1 : Math.floor(n)), e)),
            (o.range = (n, r, i) => {
              let a;
              let s = [];
              if (((n = o.ceil(n)), (i = null == i ? 1 : Math.floor(i)), !(n < r) || !(i > 0))) return s;
              do s.push((a = new Date(+n))), t(n, i), e(n);
              while (a < n && n < r);
              return s;
            }),
            (o.filter = n =>
              nt(
                t => {
                  if (t >= t) for (; e(t), !n(t); ) t.setTime(t - 1);
                },
                (e, r) => {
                  if (e >= e) {
                    if (r < 0) for (; ++r <= 0; ) for (; t(e, -1), !n(e); );
                    else for (; --r >= 0; ) for (; t(e, 1), !n(e); );
                  }
                }
              )),
            n &&
              ((o.count = (t, r) => (t9.setTime(+t), ne.setTime(+r), e(t9), e(ne), Math.floor(n(t9, ne)))),
              (o.every = e => (isFinite((e = Math.floor(e))) && e > 0 ? (e > 1 ? o.filter(r ? t => r(t) % e == 0 : t => o.count(0, t) % e == 0) : o) : null))),
            o
          );
        }
        let nn = nt(
          () => {},
          (e, t) => {
            e.setTime(+e + t);
          },
          (e, t) => t - e
        );
        (nn.every = e =>
          isFinite((e = Math.floor(e))) && e > 0
            ? e > 1
              ? nt(
                  t => {
                    t.setTime(Math.floor(t / e) * e);
                  },
                  (t, n) => {
                    t.setTime(+t + n * e);
                  },
                  (t, n) => (n - t) / e
                )
              : nn
            : null),
          nn.range;
        let nr = nt(
          e => {
            e.setTime(e - e.getMilliseconds());
          },
          (e, t) => {
            e.setTime(+e + 1e3 * t);
          },
          (e, t) => (t - e) / 1e3,
          e => e.getUTCSeconds()
        );
        nr.range;
        let no = nt(
          e => {
            e.setTime(e - e.getMilliseconds() - 1e3 * e.getSeconds());
          },
          (e, t) => {
            e.setTime(+e + 6e4 * t);
          },
          (e, t) => (t - e) / 6e4,
          e => e.getMinutes()
        );
        no.range;
        let ni = nt(
          e => {
            e.setUTCSeconds(0, 0);
          },
          (e, t) => {
            e.setTime(+e + 6e4 * t);
          },
          (e, t) => (t - e) / 6e4,
          e => e.getUTCMinutes()
        );
        ni.range;
        let na = nt(
          e => {
            e.setTime(e - e.getMilliseconds() - 1e3 * e.getSeconds() - 6e4 * e.getMinutes());
          },
          (e, t) => {
            e.setTime(+e + 36e5 * t);
          },
          (e, t) => (t - e) / 36e5,
          e => e.getHours()
        );
        na.range;
        let ns = nt(
          e => {
            e.setUTCMinutes(0, 0, 0);
          },
          (e, t) => {
            e.setTime(+e + 36e5 * t);
          },
          (e, t) => (t - e) / 36e5,
          e => e.getUTCHours()
        );
        ns.range;
        let nl = nt(
          e => e.setHours(0, 0, 0, 0),
          (e, t) => e.setDate(e.getDate() + t),
          (e, t) => (t - e - (t.getTimezoneOffset() - e.getTimezoneOffset()) * 6e4) / 864e5,
          e => e.getDate() - 1
        );
        nl.range;
        let nu = nt(
          e => {
            e.setUTCHours(0, 0, 0, 0);
          },
          (e, t) => {
            e.setUTCDate(e.getUTCDate() + t);
          },
          (e, t) => (t - e) / 864e5,
          e => e.getUTCDate() - 1
        );
        nu.range;
        let nc = nt(
          e => {
            e.setUTCHours(0, 0, 0, 0);
          },
          (e, t) => {
            e.setUTCDate(e.getUTCDate() + t);
          },
          (e, t) => (t - e) / 864e5,
          e => Math.floor(e / 864e5)
        );
        function nd(e) {
          return nt(
            t => {
              t.setDate(t.getDate() - ((t.getDay() + 7 - e) % 7)), t.setHours(0, 0, 0, 0);
            },
            (e, t) => {
              e.setDate(e.getDate() + 7 * t);
            },
            (e, t) => (t - e - (t.getTimezoneOffset() - e.getTimezoneOffset()) * 6e4) / 6048e5
          );
        }
        nc.range;
        let nf = nd(0),
          nh = nd(1),
          np = nd(2),
          n_ = nd(3),
          ng = nd(4),
          nm = nd(5),
          nv = nd(6);
        function ny(e) {
          return nt(
            t => {
              t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 7 - e) % 7)), t.setUTCHours(0, 0, 0, 0);
            },
            (e, t) => {
              e.setUTCDate(e.getUTCDate() + 7 * t);
            },
            (e, t) => (t - e) / 6048e5
          );
        }
        nf.range, nh.range, np.range, n_.range, ng.range, nm.range, nv.range;
        let nb = ny(0),
          nx = ny(1),
          nw = ny(2),
          nk = ny(3),
          nM = ny(4),
          nj = ny(5),
          nE = ny(6);
        nb.range, nx.range, nw.range, nk.range, nM.range, nj.range, nE.range;
        let nS = nt(
          e => {
            e.setDate(1), e.setHours(0, 0, 0, 0);
          },
          (e, t) => {
            e.setMonth(e.getMonth() + t);
          },
          (e, t) => t.getMonth() - e.getMonth() + (t.getFullYear() - e.getFullYear()) * 12,
          e => e.getMonth()
        );
        nS.range;
        let nT = nt(
          e => {
            e.setUTCDate(1), e.setUTCHours(0, 0, 0, 0);
          },
          (e, t) => {
            e.setUTCMonth(e.getUTCMonth() + t);
          },
          (e, t) => t.getUTCMonth() - e.getUTCMonth() + (t.getUTCFullYear() - e.getUTCFullYear()) * 12,
          e => e.getUTCMonth()
        );
        nT.range;
        let nC = nt(
          e => {
            e.setMonth(0, 1), e.setHours(0, 0, 0, 0);
          },
          (e, t) => {
            e.setFullYear(e.getFullYear() + t);
          },
          (e, t) => t.getFullYear() - e.getFullYear(),
          e => e.getFullYear()
        );
        (nC.every = e =>
          isFinite((e = Math.floor(e))) && e > 0
            ? nt(
                t => {
                  t.setFullYear(Math.floor(t.getFullYear() / e) * e), t.setMonth(0, 1), t.setHours(0, 0, 0, 0);
                },
                (t, n) => {
                  t.setFullYear(t.getFullYear() + n * e);
                }
              )
            : null),
          nC.range;
        let nP = nt(
          e => {
            e.setUTCMonth(0, 1), e.setUTCHours(0, 0, 0, 0);
          },
          (e, t) => {
            e.setUTCFullYear(e.getUTCFullYear() + t);
          },
          (e, t) => t.getUTCFullYear() - e.getUTCFullYear(),
          e => e.getUTCFullYear()
        );
        function nN(e, t, n, r, o, i) {
          let a = [
            [nr, 1, 1e3],
            [nr, 5, 5e3],
            [nr, 15, 15e3],
            [nr, 30, 3e4],
            [i, 1, 6e4],
            [i, 5, 3e5],
            [i, 15, 9e5],
            [i, 30, 18e5],
            [o, 1, 36e5],
            [o, 3, 108e5],
            [o, 6, 216e5],
            [o, 12, 432e5],
            [r, 1, 864e5],
            [r, 2, 1728e5],
            [n, 1, 6048e5],
            [t, 1, 2592e6],
            [t, 3, 7776e6],
            [e, 1, 31536e6]
          ];
          function s(t, n, r) {
            let o = Math.abs(n - t) / r,
              i = eV(([, , e]) => e).right(a, o);
            if (i === a.length) return e.every(e7(t / 31536e6, n / 31536e6, r));
            if (0 === i) return nn.every(Math.max(e7(t, n, r), 1));
            let [s, l] = a[o / a[i - 1][2] < a[i][2] / o ? i - 1 : i];
            return s.every(l);
          }
          return [
            function (e, t, n) {
              let r = t < e;
              r && ([e, t] = [t, e]);
              let o = n && "function" == typeof n.range ? n : s(e, t, n),
                i = o ? o.range(e, +t + 1) : [];
              return r ? i.reverse() : i;
            },
            s
          ];
        }
        (nP.every = e =>
          isFinite((e = Math.floor(e))) && e > 0
            ? nt(
                t => {
                  t.setUTCFullYear(Math.floor(t.getUTCFullYear() / e) * e), t.setUTCMonth(0, 1), t.setUTCHours(0, 0, 0, 0);
                },
                (t, n) => {
                  t.setUTCFullYear(t.getUTCFullYear() + n * e);
                }
              )
            : null),
          nP.range;
        let [nA, nO] = nN(nP, nT, nb, nc, ns, ni),
          [n$, nD] = nN(nC, nS, nf, nl, na, no);
        function nz(e) {
          if (0 <= e.y && e.y < 100) {
            var t = new Date(-1, e.m, e.d, e.H, e.M, e.S, e.L);
            return t.setFullYear(e.y), t;
          }
          return new Date(e.y, e.m, e.d, e.H, e.M, e.S, e.L);
        }
        function nR(e) {
          if (0 <= e.y && e.y < 100) {
            var t = new Date(Date.UTC(-1, e.m, e.d, e.H, e.M, e.S, e.L));
            return t.setUTCFullYear(e.y), t;
          }
          return new Date(Date.UTC(e.y, e.m, e.d, e.H, e.M, e.S, e.L));
        }
        function nL(e, t, n) {
          return { y: e, m: t, d: n, H: 0, M: 0, S: 0, L: 0 };
        }
        var nF = { "-": "", _: " ", 0: "0" },
          nI = /^\s*\d+/,
          nB = /^%/,
          nU = /[\\^$*+?|[\]().{}]/g;
        function nq(e, t, n) {
          var r = e < 0 ? "-" : "",
            o = (r ? -e : e) + "",
            i = o.length;
          return r + (i < n ? Array(n - i + 1).join(t) + o : o);
        }
        function nH(e) {
          return e.replace(nU, "\\$&");
        }
        function nY(e) {
          return RegExp("^(?:" + e.map(nH).join("|") + ")", "i");
        }
        function nW(e) {
          return new Map(e.map((e, t) => [e.toLowerCase(), t]));
        }
        function nZ(e, t, n) {
          var r = nI.exec(t.slice(n, n + 1));
          return r ? ((e.w = +r[0]), n + r[0].length) : -1;
        }
        function nX(e, t, n) {
          var r = nI.exec(t.slice(n, n + 1));
          return r ? ((e.u = +r[0]), n + r[0].length) : -1;
        }
        function nV(e, t, n) {
          var r = nI.exec(t.slice(n, n + 2));
          return r ? ((e.U = +r[0]), n + r[0].length) : -1;
        }
        function nG(e, t, n) {
          var r = nI.exec(t.slice(n, n + 2));
          return r ? ((e.V = +r[0]), n + r[0].length) : -1;
        }
        function nJ(e, t, n) {
          var r = nI.exec(t.slice(n, n + 2));
          return r ? ((e.W = +r[0]), n + r[0].length) : -1;
        }
        function nK(e, t, n) {
          var r = nI.exec(t.slice(n, n + 4));
          return r ? ((e.y = +r[0]), n + r[0].length) : -1;
        }
        function nQ(e, t, n) {
          var r = nI.exec(t.slice(n, n + 2));
          return r ? ((e.y = +r[0] + (+r[0] > 68 ? 1900 : 2e3)), n + r[0].length) : -1;
        }
        function n0(e, t, n) {
          var r = /^(Z)|([+-]\d\d)(?::?(\d\d))?/.exec(t.slice(n, n + 6));
          return r ? ((e.Z = r[1] ? 0 : -(r[2] + (r[3] || "00"))), n + r[0].length) : -1;
        }
        function n1(e, t, n) {
          var r = nI.exec(t.slice(n, n + 1));
          return r ? ((e.q = 3 * r[0] - 3), n + r[0].length) : -1;
        }
        function n2(e, t, n) {
          var r = nI.exec(t.slice(n, n + 2));
          return r ? ((e.m = r[0] - 1), n + r[0].length) : -1;
        }
        function n3(e, t, n) {
          var r = nI.exec(t.slice(n, n + 2));
          return r ? ((e.d = +r[0]), n + r[0].length) : -1;
        }
        function n5(e, t, n) {
          var r = nI.exec(t.slice(n, n + 3));
          return r ? ((e.m = 0), (e.d = +r[0]), n + r[0].length) : -1;
        }
        function n8(e, t, n) {
          var r = nI.exec(t.slice(n, n + 2));
          return r ? ((e.H = +r[0]), n + r[0].length) : -1;
        }
        function n6(e, t, n) {
          var r = nI.exec(t.slice(n, n + 2));
          return r ? ((e.M = +r[0]), n + r[0].length) : -1;
        }
        function n4(e, t, n) {
          var r = nI.exec(t.slice(n, n + 2));
          return r ? ((e.S = +r[0]), n + r[0].length) : -1;
        }
        function n7(e, t, n) {
          var r = nI.exec(t.slice(n, n + 3));
          return r ? ((e.L = +r[0]), n + r[0].length) : -1;
        }
        function n9(e, t, n) {
          var r = nI.exec(t.slice(n, n + 6));
          return r ? ((e.L = Math.floor(r[0] / 1e3)), n + r[0].length) : -1;
        }
        function re(e, t, n) {
          var r = nB.exec(t.slice(n, n + 1));
          return r ? n + r[0].length : -1;
        }
        function rt(e, t, n) {
          var r = nI.exec(t.slice(n));
          return r ? ((e.Q = +r[0]), n + r[0].length) : -1;
        }
        function rn(e, t, n) {
          var r = nI.exec(t.slice(n));
          return r ? ((e.s = +r[0]), n + r[0].length) : -1;
        }
        function rr(e, t) {
          return nq(e.getDate(), t, 2);
        }
        function ro(e, t) {
          return nq(e.getHours(), t, 2);
        }
        function ri(e, t) {
          return nq(e.getHours() % 12 || 12, t, 2);
        }
        function ra(e, t) {
          return nq(1 + nl.count(nC(e), e), t, 3);
        }
        function rs(e, t) {
          return nq(e.getMilliseconds(), t, 3);
        }
        function rl(e, t) {
          return rs(e, t) + "000";
        }
        function ru(e, t) {
          return nq(e.getMonth() + 1, t, 2);
        }
        function rc(e, t) {
          return nq(e.getMinutes(), t, 2);
        }
        function rd(e, t) {
          return nq(e.getSeconds(), t, 2);
        }
        function rf(e) {
          var t = e.getDay();
          return 0 === t ? 7 : t;
        }
        function rh(e, t) {
          return nq(nf.count(nC(e) - 1, e), t, 2);
        }
        function rp(e) {
          var t = e.getDay();
          return t >= 4 || 0 === t ? ng(e) : ng.ceil(e);
        }
        function r_(e, t) {
          return (e = rp(e)), nq(ng.count(nC(e), e) + (4 === nC(e).getDay()), t, 2);
        }
        function rg(e) {
          return e.getDay();
        }
        function rm(e, t) {
          return nq(nh.count(nC(e) - 1, e), t, 2);
        }
        function rv(e, t) {
          return nq(e.getFullYear() % 100, t, 2);
        }
        function ry(e, t) {
          return nq((e = rp(e)).getFullYear() % 100, t, 2);
        }
        function rb(e, t) {
          return nq(e.getFullYear() % 1e4, t, 4);
        }
        function rx(e, t) {
          var n = e.getDay();
          return nq((e = n >= 4 || 0 === n ? ng(e) : ng.ceil(e)).getFullYear() % 1e4, t, 4);
        }
        function rw(e) {
          var t = e.getTimezoneOffset();
          return (t > 0 ? "-" : ((t *= -1), "+")) + nq((t / 60) | 0, "0", 2) + nq(t % 60, "0", 2);
        }
        function rk(e, t) {
          return nq(e.getUTCDate(), t, 2);
        }
        function rM(e, t) {
          return nq(e.getUTCHours(), t, 2);
        }
        function rj(e, t) {
          return nq(e.getUTCHours() % 12 || 12, t, 2);
        }
        function rE(e, t) {
          return nq(1 + nu.count(nP(e), e), t, 3);
        }
        function rS(e, t) {
          return nq(e.getUTCMilliseconds(), t, 3);
        }
        function rT(e, t) {
          return rS(e, t) + "000";
        }
        function rC(e, t) {
          return nq(e.getUTCMonth() + 1, t, 2);
        }
        function rP(e, t) {
          return nq(e.getUTCMinutes(), t, 2);
        }
        function rN(e, t) {
          return nq(e.getUTCSeconds(), t, 2);
        }
        function rA(e) {
          var t = e.getUTCDay();
          return 0 === t ? 7 : t;
        }
        function rO(e, t) {
          return nq(nb.count(nP(e) - 1, e), t, 2);
        }
        function r$(e) {
          var t = e.getUTCDay();
          return t >= 4 || 0 === t ? nM(e) : nM.ceil(e);
        }
        function rD(e, t) {
          return (e = r$(e)), nq(nM.count(nP(e), e) + (4 === nP(e).getUTCDay()), t, 2);
        }
        function rz(e) {
          return e.getUTCDay();
        }
        function rR(e, t) {
          return nq(nx.count(nP(e) - 1, e), t, 2);
        }
        function rL(e, t) {
          return nq(e.getUTCFullYear() % 100, t, 2);
        }
        function rF(e, t) {
          return nq((e = r$(e)).getUTCFullYear() % 100, t, 2);
        }
        function rI(e, t) {
          return nq(e.getUTCFullYear() % 1e4, t, 4);
        }
        function rB(e, t) {
          var n = e.getUTCDay();
          return nq((e = n >= 4 || 0 === n ? nM(e) : nM.ceil(e)).getUTCFullYear() % 1e4, t, 4);
        }
        function rU() {
          return "+0000";
        }
        function rq() {
          return "%";
        }
        function rH(e) {
          return +e;
        }
        function rY(e) {
          return Math.floor(+e / 1e3);
        }
        function rW(e) {
          return new Date(e);
        }
        function rZ(e) {
          return e instanceof Date ? +e : +new Date(+e);
        }
        function rX() {
          return tJ.apply(
            (function e(t, n, r, o, i, a, s, l, u, c) {
              var d = tG(),
                f = d.invert,
                h = d.domain,
                p = c(".%L"),
                _ = c(":%S"),
                g = c("%I:%M"),
                m = c("%I %p"),
                v = c("%a %d"),
                y = c("%b %d"),
                b = c("%B"),
                x = c("%Y");
              function w(e) {
                return (u(e) < e ? p : l(e) < e ? _ : s(e) < e ? g : a(e) < e ? m : o(e) < e ? (i(e) < e ? v : y) : r(e) < e ? b : x)(e);
              }
              return (
                (d.invert = function (e) {
                  return new Date(f(e));
                }),
                (d.domain = function (e) {
                  return arguments.length ? h(Array.from(e, rZ)) : h().map(rW);
                }),
                (d.ticks = function (e) {
                  var n = h();
                  return t(n[0], n[n.length - 1], null == e ? 10 : e);
                }),
                (d.tickFormat = function (e, t) {
                  return null == t ? w : c(t);
                }),
                (d.nice = function (e) {
                  var t,
                    r,
                    o,
                    i,
                    a,
                    s,
                    l,
                    u = h();
                  return (
                    (e && "function" == typeof e.range) || (e = n(u[0], u[u.length - 1], null == e ? 10 : e)),
                    e
                      ? h(
                          ((t = u),
                          (r = e),
                          (t = t.slice()),
                          (i = 0),
                          (a = t.length - 1),
                          (s = t[i]),
                          (l = t[a]) < s && ((o = i), (i = a), (a = o), (o = s), (s = l), (l = o)),
                          (t[i] = r.floor(s)),
                          (t[a] = r.ceil(l)),
                          t)
                        )
                      : d
                  );
                }),
                (d.copy = function () {
                  return tV(d, e(t, n, r, o, i, a, s, l, u, c));
                }),
                d
              );
            })(n$, nD, nC, nS, nf, nl, na, no, nr, c4).domain([new Date(2e3, 0, 1), new Date(2e3, 0, 2)]),
            arguments
          );
        }
        (c4 = (c6 = (function (e) {
          var t = e.dateTime,
            n = e.date,
            r = e.time,
            o = e.periods,
            i = e.days,
            a = e.shortDays,
            s = e.months,
            l = e.shortMonths,
            u = nY(o),
            c = nW(o),
            d = nY(i),
            f = nW(i),
            h = nY(a),
            p = nW(a),
            _ = nY(s),
            g = nW(s),
            m = nY(l),
            v = nW(l),
            y = {
              a: function (e) {
                return a[e.getDay()];
              },
              A: function (e) {
                return i[e.getDay()];
              },
              b: function (e) {
                return l[e.getMonth()];
              },
              B: function (e) {
                return s[e.getMonth()];
              },
              c: null,
              d: rr,
              e: rr,
              f: rl,
              g: ry,
              G: rx,
              H: ro,
              I: ri,
              j: ra,
              L: rs,
              m: ru,
              M: rc,
              p: function (e) {
                return o[+(e.getHours() >= 12)];
              },
              q: function (e) {
                return 1 + ~~(e.getMonth() / 3);
              },
              Q: rH,
              s: rY,
              S: rd,
              u: rf,
              U: rh,
              V: r_,
              w: rg,
              W: rm,
              x: null,
              X: null,
              y: rv,
              Y: rb,
              Z: rw,
              "%": rq
            },
            b = {
              a: function (e) {
                return a[e.getUTCDay()];
              },
              A: function (e) {
                return i[e.getUTCDay()];
              },
              b: function (e) {
                return l[e.getUTCMonth()];
              },
              B: function (e) {
                return s[e.getUTCMonth()];
              },
              c: null,
              d: rk,
              e: rk,
              f: rT,
              g: rF,
              G: rB,
              H: rM,
              I: rj,
              j: rE,
              L: rS,
              m: rC,
              M: rP,
              p: function (e) {
                return o[+(e.getUTCHours() >= 12)];
              },
              q: function (e) {
                return 1 + ~~(e.getUTCMonth() / 3);
              },
              Q: rH,
              s: rY,
              S: rN,
              u: rA,
              U: rO,
              V: rD,
              w: rz,
              W: rR,
              x: null,
              X: null,
              y: rL,
              Y: rI,
              Z: rU,
              "%": rq
            },
            x = {
              a: function (e, t, n) {
                var r = h.exec(t.slice(n));
                return r ? ((e.w = p.get(r[0].toLowerCase())), n + r[0].length) : -1;
              },
              A: function (e, t, n) {
                var r = d.exec(t.slice(n));
                return r ? ((e.w = f.get(r[0].toLowerCase())), n + r[0].length) : -1;
              },
              b: function (e, t, n) {
                var r = m.exec(t.slice(n));
                return r ? ((e.m = v.get(r[0].toLowerCase())), n + r[0].length) : -1;
              },
              B: function (e, t, n) {
                var r = _.exec(t.slice(n));
                return r ? ((e.m = g.get(r[0].toLowerCase())), n + r[0].length) : -1;
              },
              c: function (e, n, r) {
                return M(e, t, n, r);
              },
              d: n3,
              e: n3,
              f: n9,
              g: nQ,
              G: nK,
              H: n8,
              I: n8,
              j: n5,
              L: n7,
              m: n2,
              M: n6,
              p: function (e, t, n) {
                var r = u.exec(t.slice(n));
                return r ? ((e.p = c.get(r[0].toLowerCase())), n + r[0].length) : -1;
              },
              q: n1,
              Q: rt,
              s: rn,
              S: n4,
              u: nX,
              U: nV,
              V: nG,
              w: nZ,
              W: nJ,
              x: function (e, t, r) {
                return M(e, n, t, r);
              },
              X: function (e, t, n) {
                return M(e, r, t, n);
              },
              y: nQ,
              Y: nK,
              Z: n0,
              "%": re
            };
          function w(e, t) {
            return function (n) {
              var r,
                o,
                i,
                a = [],
                s = -1,
                l = 0,
                u = e.length;
              for (n instanceof Date || (n = new Date(+n)); ++s < u; )
                37 === e.charCodeAt(s) &&
                  (a.push(e.slice(l, s)),
                  null != (o = nF[(r = e.charAt(++s))]) ? (r = e.charAt(++s)) : (o = "e" === r ? " " : "0"),
                  (i = t[r]) && (r = i(n, o)),
                  a.push(r),
                  (l = s + 1));
              return a.push(e.slice(l, s)), a.join("");
            };
          }
          function k(e, t) {
            return function (n) {
              var r,
                o,
                i = nL(1900, void 0, 1);
              if (M(i, e, (n += ""), 0) != n.length) return null;
              if ("Q" in i) return new Date(i.Q);
              if ("s" in i) return new Date(1e3 * i.s + ("L" in i ? i.L : 0));
              if ((!t || "Z" in i || (i.Z = 0), "p" in i && (i.H = (i.H % 12) + 12 * i.p), void 0 === i.m && (i.m = "q" in i ? i.q : 0), "V" in i)) {
                if (i.V < 1 || i.V > 53) return null;
                "w" in i || (i.w = 1),
                  "Z" in i
                    ? ((r = (o = (r = nR(nL(i.y, 0, 1))).getUTCDay()) > 4 || 0 === o ? nx.ceil(r) : nx(r)),
                      (r = nu.offset(r, (i.V - 1) * 7)),
                      (i.y = r.getUTCFullYear()),
                      (i.m = r.getUTCMonth()),
                      (i.d = r.getUTCDate() + ((i.w + 6) % 7)))
                    : ((r = (o = (r = nz(nL(i.y, 0, 1))).getDay()) > 4 || 0 === o ? nh.ceil(r) : nh(r)),
                      (r = nl.offset(r, (i.V - 1) * 7)),
                      (i.y = r.getFullYear()),
                      (i.m = r.getMonth()),
                      (i.d = r.getDate() + ((i.w + 6) % 7)));
              } else
                ("W" in i || "U" in i) &&
                  ("w" in i || (i.w = "u" in i ? i.u % 7 : +("W" in i)),
                  (o = "Z" in i ? nR(nL(i.y, 0, 1)).getUTCDay() : nz(nL(i.y, 0, 1)).getDay()),
                  (i.m = 0),
                  (i.d = "W" in i ? ((i.w + 6) % 7) + 7 * i.W - ((o + 5) % 7) : i.w + 7 * i.U - ((o + 6) % 7)));
              return "Z" in i ? ((i.H += (i.Z / 100) | 0), (i.M += i.Z % 100), nR(i)) : nz(i);
            };
          }
          function M(e, t, n, r) {
            for (var o, i, a = 0, s = t.length, l = n.length; a < s; ) {
              if (r >= l) return -1;
              if (37 === (o = t.charCodeAt(a++))) {
                if (!(i = x[(o = t.charAt(a++)) in nF ? t.charAt(a++) : o]) || (r = i(e, n, r)) < 0) return -1;
              } else if (o != n.charCodeAt(r++)) return -1;
            }
            return r;
          }
          return (
            (y.x = w(n, y)),
            (y.X = w(r, y)),
            (y.c = w(t, y)),
            (b.x = w(n, b)),
            (b.X = w(r, b)),
            (b.c = w(t, b)),
            {
              format: function (e) {
                var t = w((e += ""), y);
                return (
                  (t.toString = function () {
                    return e;
                  }),
                  t
                );
              },
              parse: function (e) {
                var t = k((e += ""), !1);
                return (
                  (t.toString = function () {
                    return e;
                  }),
                  t
                );
              },
              utcFormat: function (e) {
                var t = w((e += ""), b);
                return (
                  (t.toString = function () {
                    return e;
                  }),
                  t
                );
              },
              utcParse: function (e) {
                var t = k((e += ""), !0);
                return (
                  (t.toString = function () {
                    return e;
                  }),
                  t
                );
              }
            }
          );
        })({
          dateTime: "%x, %X",
          date: "%-m/%-d/%Y",
          time: "%-I:%M:%S %p",
          periods: ["AM", "PM"],
          days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
          shortDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
          months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
          shortMonths: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        })).format),
          c6.parse,
          c6.utcFormat,
          c6.utcParse;
        class rV extends Map {
          constructor(e, t = rJ) {
            if ((super(), Object.defineProperties(this, { _intern: { value: new Map() }, _key: { value: t } }), null != e))
              for (let [t, n] of e) this.set(t, n);
          }
          get(e) {
            return super.get(rG(this, e));
          }
          has(e) {
            return super.has(rG(this, e));
          }
          set(e, t) {
            return super.set(
              (function ({ _intern: e, _key: t }, n) {
                let r = t(n);
                return e.has(r) ? e.get(r) : (e.set(r, n), n);
              })(this, e),
              t
            );
          }
          delete(e) {
            return super.delete(
              (function ({ _intern: e, _key: t }, n) {
                let r = t(n);
                return e.has(r) && ((n = e.get(r)), e.delete(r)), n;
              })(this, e)
            );
          }
        }
        function rG({ _intern: e, _key: t }, n) {
          let r = t(n);
          return e.has(r) ? e.get(r) : n;
        }
        function rJ(e) {
          return null !== e && "object" == typeof e ? e.valueOf() : e;
        }
        let rK = Symbol("implicit");
        function rQ() {
          var e = new rV(),
            t = [],
            n = [],
            r = rK;
          function o(o) {
            let i = e.get(o);
            if (void 0 === i) {
              if (r !== rK) return r;
              e.set(o, (i = t.push(o) - 1));
            }
            return n[i % n.length];
          }
          return (
            (o.domain = function (n) {
              if (!arguments.length) return t.slice();
              for (let r of ((t = []), (e = new rV()), n)) e.has(r) || e.set(r, t.push(r) - 1);
              return o;
            }),
            (o.range = function (e) {
              return arguments.length ? ((n = Array.from(e)), o) : n.slice();
            }),
            (o.unknown = function (e) {
              return arguments.length ? ((r = e), o) : r;
            }),
            (o.copy = function () {
              return rQ(t, n).unknown(r);
            }),
            tJ.apply(o, arguments),
            o
          );
        }
        function r0() {
          var e,
            t,
            n = rQ().unknown(void 0),
            r = n.domain,
            o = n.range,
            i = 0,
            a = 1,
            s = !1,
            l = 0,
            u = 0,
            c = 0.5;
          function d() {
            var n = r().length,
              d = a < i,
              f = d ? a : i,
              h = d ? i : a;
            (e = (h - f) / Math.max(1, n - l + 2 * u)),
              s && (e = Math.floor(e)),
              (f += (h - f - e * (n - l)) * c),
              (t = e * (1 - l)),
              s && ((f = Math.round(f)), (t = Math.round(t)));
            var p = eJ(n).map(function (t) {
              return f + e * t;
            });
            return o(d ? p.reverse() : p);
          }
          return (
            delete n.unknown,
            (n.domain = function (e) {
              return arguments.length ? (r(e), d()) : r();
            }),
            (n.range = function (e) {
              return arguments.length ? (([i, a] = e), (i *= 1), (a *= 1), d()) : [i, a];
            }),
            (n.rangeRound = function (e) {
              return ([i, a] = e), (i *= 1), (a *= 1), (s = !0), d();
            }),
            (n.bandwidth = function () {
              return t;
            }),
            (n.step = function () {
              return e;
            }),
            (n.round = function (e) {
              return arguments.length ? ((s = !!e), d()) : s;
            }),
            (n.padding = function (e) {
              return arguments.length ? ((l = Math.min(1, (u = +e))), d()) : l;
            }),
            (n.paddingInner = function (e) {
              return arguments.length ? ((l = Math.min(1, e)), d()) : l;
            }),
            (n.paddingOuter = function (e) {
              return arguments.length ? ((u = +e), d()) : u;
            }),
            (n.align = function (e) {
              return arguments.length ? ((c = Math.max(0, Math.min(1, e))), d()) : c;
            }),
            (n.copy = function () {
              return r0(r(), [i, a]).round(s).paddingInner(l).paddingOuter(u).align(c);
            }),
            tJ.apply(d(), arguments)
          );
        }
        function r1(e) {
          return "object" == typeof e && "length" in e ? e : Array.from(e);
        }
        function r2(e) {
          return function () {
            return e;
          };
        }
        function r3(e) {
          this._context = e;
        }
        function r5(e) {
          return new r3(e);
        }
        Array.prototype.slice,
          (r3.prototype = {
            areaStart: function () {
              this._line = 0;
            },
            areaEnd: function () {
              this._line = NaN;
            },
            lineStart: function () {
              this._point = 0;
            },
            lineEnd: function () {
              (this._line || (0 !== this._line && 1 === this._point)) && this._context.closePath(), (this._line = 1 - this._line);
            },
            point: function (e, t) {
              switch (((e *= 1), (t *= 1), this._point)) {
                case 0:
                  (this._point = 1), this._line ? this._context.lineTo(e, t) : this._context.moveTo(e, t);
                  break;
                case 1:
                  this._point = 2;
                default:
                  this._context.lineTo(e, t);
              }
            }
          });
        let r8 = Math.PI,
          r6 = 2 * r8,
          r4 = r6 - 1e-6;
        function r7(e) {
          this._ += e[0];
          for (let t = 1, n = e.length; t < n; ++t) this._ += arguments[t] + e[t];
        }
        class r9 {
          constructor(e) {
            (this._x0 = this._y0 = this._x1 = this._y1 = null),
              (this._ = ""),
              (this._append =
                null == e
                  ? r7
                  : (function (e) {
                      let t = Math.floor(e);
                      if (!(t >= 0)) throw Error(`invalid digits: ${e}`);
                      if (t > 15) return r7;
                      let n = 10 ** t;
                      return function (e) {
                        this._ += e[0];
                        for (let t = 1, r = e.length; t < r; ++t) this._ += Math.round(arguments[t] * n) / n + e[t];
                      };
                    })(e));
          }
          moveTo(e, t) {
            this._append`M${(this._x0 = this._x1 = +e)},${(this._y0 = this._y1 = +t)}`;
          }
          closePath() {
            null !== this._x1 && ((this._x1 = this._x0), (this._y1 = this._y0), this._append`Z`);
          }
          lineTo(e, t) {
            this._append`L${(this._x1 = +e)},${(this._y1 = +t)}`;
          }
          quadraticCurveTo(e, t, n, r) {
            this._append`Q${+e},${+t},${(this._x1 = +n)},${(this._y1 = +r)}`;
          }
          bezierCurveTo(e, t, n, r, o, i) {
            this._append`C${+e},${+t},${+n},${+r},${(this._x1 = +o)},${(this._y1 = +i)}`;
          }
          arcTo(e, t, n, r, o) {
            if (((e *= 1), (t *= 1), (n *= 1), (r *= 1), (o *= 1) < 0)) throw Error(`negative radius: ${o}`);
            let i = this._x1,
              a = this._y1,
              s = n - e,
              l = r - t,
              u = i - e,
              c = a - t,
              d = u * u + c * c;
            if (null === this._x1) this._append`M${(this._x1 = e)},${(this._y1 = t)}`;
            else if (d > 1e-6) {
              if (Math.abs(c * s - l * u) > 1e-6 && o) {
                let f = n - i,
                  h = r - a,
                  p = s * s + l * l,
                  _ = Math.sqrt(p),
                  g = Math.sqrt(d),
                  m = o * Math.tan((r8 - Math.acos((p + d - (f * f + h * h)) / (2 * _ * g))) / 2),
                  v = m / g,
                  y = m / _;
                Math.abs(v - 1) > 1e-6 && this._append`L${e + v * u},${t + v * c}`,
                  this._append`A${o},${o},0,0,${+(c * f > u * h)},${(this._x1 = e + y * s)},${(this._y1 = t + y * l)}`;
              } else this._append`L${(this._x1 = e)},${(this._y1 = t)}`;
            }
          }
          arc(e, t, n, r, o, i) {
            if (((e *= 1), (t *= 1), (n *= 1), (i = !!i), n < 0)) throw Error(`negative radius: ${n}`);
            let a = n * Math.cos(r),
              s = n * Math.sin(r),
              l = e + a,
              u = t + s,
              c = 1 ^ i,
              d = i ? r - o : o - r;
            null === this._x1 ? this._append`M${l},${u}` : (Math.abs(this._x1 - l) > 1e-6 || Math.abs(this._y1 - u) > 1e-6) && this._append`L${l},${u}`,
              n &&
                (d < 0 && (d = (d % r6) + r6),
                d > r4
                  ? this._append`A${n},${n},0,1,${c},${e - a},${t - s}A${n},${n},0,1,${c},${(this._x1 = l)},${(this._y1 = u)}`
                  : d > 1e-6 && this._append`A${n},${n},0,${+(d >= r8)},${c},${(this._x1 = e + n * Math.cos(o))},${(this._y1 = t + n * Math.sin(o))}`);
          }
          rect(e, t, n, r) {
            this._append`M${(this._x0 = this._x1 = +e)},${(this._y0 = this._y1 = +t)}h${(n *= 1)}v${+r}h${-n}Z`;
          }
          toString() {
            return this._;
          }
        }
        function oe(e) {
          let t = 3;
          return (
            (e.digits = function (n) {
              if (!arguments.length) return t;
              if (null == n) t = null;
              else {
                let e = Math.floor(n);
                if (!(e >= 0)) throw RangeError(`invalid digits: ${n}`);
                t = e;
              }
              return e;
            }),
            () => new r9(t)
          );
        }
        function ot(e) {
          return e[0];
        }
        function on(e) {
          return e[1];
        }
        function or(e, t) {
          var n = r2(!0),
            r = null,
            o = r5,
            i = null,
            a = oe(s);
          function s(s) {
            var l,
              u,
              c,
              d = (s = r1(s)).length,
              f = !1;
            for (null == r && (i = o((c = a()))), l = 0; l <= d; ++l)
              !(l < d && n((u = s[l]), l, s)) === f && ((f = !f) ? i.lineStart() : i.lineEnd()), f && i.point(+e(u, l, s), +t(u, l, s));
            if (c) return (i = null), c + "" || null;
          }
          return (
            (e = "function" == typeof e ? e : void 0 === e ? ot : r2(e)),
            (t = "function" == typeof t ? t : void 0 === t ? on : r2(t)),
            (s.x = function (t) {
              return arguments.length ? ((e = "function" == typeof t ? t : r2(+t)), s) : e;
            }),
            (s.y = function (e) {
              return arguments.length ? ((t = "function" == typeof e ? e : r2(+e)), s) : t;
            }),
            (s.defined = function (e) {
              return arguments.length ? ((n = "function" == typeof e ? e : r2(!!e)), s) : n;
            }),
            (s.curve = function (e) {
              return arguments.length ? ((o = e), null != r && (i = o(r)), s) : o;
            }),
            (s.context = function (e) {
              return arguments.length ? (null == e ? (r = i = null) : (i = o((r = e))), s) : r;
            }),
            s
          );
        }
        function oo(e, t, n) {
          var r = e._x1 - e._x0,
            o = t - e._x1,
            i = (e._y1 - e._y0) / (r || (o < 0 && -0)),
            a = (n - e._y1) / (o || (r < 0 && -0));
          return ((i < 0 ? -1 : 1) + (a < 0 ? -1 : 1)) * Math.min(Math.abs(i), Math.abs(a), 0.5 * Math.abs((i * o + a * r) / (r + o))) || 0;
        }
        function oi(e, t) {
          var n = e._x1 - e._x0;
          return n ? ((3 * (e._y1 - e._y0)) / n - t) / 2 : t;
        }
        function oa(e, t, n) {
          var r = e._x0,
            o = e._y0,
            i = e._x1,
            a = e._y1,
            s = (i - r) / 3;
          e._context.bezierCurveTo(r + s, o + s * t, i - s, a - s * n, i, a);
        }
        function os(e) {
          this._context = e;
        }
        function ol(e) {
          this._context = e;
        }
        function ou(e) {
          return new os(e);
        }
        function oc(e, t) {
          (this._context = e), (this._t = t);
        }
        function od(e) {
          return new oc(e, 0.5);
        }
        function of(e, t) {
          if ((o = e.length) > 1)
            for (var n, r, o, i = 1, a = e[t[0]], s = a.length; i < o; ++i)
              for (r = a, a = e[t[i]], n = 0; n < s; ++n) a[n][1] += a[n][0] = isNaN(r[n][1]) ? r[n][0] : r[n][1];
        }
        function oh(e) {
          for (var t = e.length, n = Array(t); --t >= 0; ) n[t] = t;
          return n;
        }
        function op(e, t) {
          return e[t];
        }
        function o_(e) {
          let t = [];
          return (t.key = e), t;
        }
        function og() {
          var e = r2([]),
            t = oh,
            n = of,
            r = op;
          function o(o) {
            var i,
              a,
              s = Array.from(e.apply(this, arguments), o_),
              l = s.length,
              u = -1;
            for (let e of o) for (i = 0, ++u; i < l; ++i) (s[i][u] = [0, +r(e, s[i].key, u, o)]).data = e;
            for (i = 0, a = r1(t(s)); i < l; ++i) s[a[i]].index = i;
            return n(s, a), s;
          }
          return (
            (o.keys = function (t) {
              return arguments.length ? ((e = "function" == typeof t ? t : r2(Array.from(t))), o) : e;
            }),
            (o.value = function (e) {
              return arguments.length ? ((r = "function" == typeof e ? e : r2(+e)), o) : r;
            }),
            (o.order = function (e) {
              return arguments.length ? ((t = null == e ? oh : "function" == typeof e ? e : r2(Array.from(e))), o) : t;
            }),
            (o.offset = function (e) {
              return arguments.length ? ((n = null == e ? of : e), o) : n;
            }),
            o
          );
        }
        function om(e, t) {
          if ((r = e.length) > 0) {
            for (var n, r, o, i = 0, a = e[0].length; i < a; ++i) {
              for (o = n = 0; n < r; ++n) o += e[n][i][1] || 0;
              if (o) for (n = 0; n < r; ++n) e[n][i][1] /= o;
            }
            of(e, t);
          }
        }
        function ov(e, t) {
          if ((s = e.length) > 0)
            for (var n, r, o, i, a, s, l = 0, u = e[t[0]].length; l < u; ++l)
              for (i = a = 0, n = 0; n < s; ++n)
                (o = (r = e[t[n]][l])[1] - r[0]) > 0 ? ((r[0] = i), (r[1] = i += o)) : o < 0 ? ((r[1] = a), (r[0] = a += o)) : ((r[0] = 0), (r[1] = o));
        }
        r9.prototype,
          (os.prototype = {
            areaStart: function () {
              this._line = 0;
            },
            areaEnd: function () {
              this._line = NaN;
            },
            lineStart: function () {
              (this._x0 = this._x1 = this._y0 = this._y1 = this._t0 = NaN), (this._point = 0);
            },
            lineEnd: function () {
              switch (this._point) {
                case 2:
                  this._context.lineTo(this._x1, this._y1);
                  break;
                case 3:
                  oa(this, this._t0, oi(this, this._t0));
              }
              (this._line || (0 !== this._line && 1 === this._point)) && this._context.closePath(), (this._line = 1 - this._line);
            },
            point: function (e, t) {
              var n = NaN;
              if (((t *= 1), (e *= 1) !== this._x1 || t !== this._y1)) {
                switch (this._point) {
                  case 0:
                    (this._point = 1), this._line ? this._context.lineTo(e, t) : this._context.moveTo(e, t);
                    break;
                  case 1:
                    this._point = 2;
                    break;
                  case 2:
                    (this._point = 3), oa(this, oi(this, (n = oo(this, e, t))), n);
                    break;
                  default:
                    oa(this, this._t0, (n = oo(this, e, t)));
                }
                (this._x0 = this._x1), (this._x1 = e), (this._y0 = this._y1), (this._y1 = t), (this._t0 = n);
              }
            }
          }),
          ((function (e) {
            this._context = new ol(e);
          }.prototype = Object.create(os.prototype)).point = function (e, t) {
            os.prototype.point.call(this, t, e);
          }),
          (ol.prototype = {
            moveTo: function (e, t) {
              this._context.moveTo(t, e);
            },
            closePath: function () {
              this._context.closePath();
            },
            lineTo: function (e, t) {
              this._context.lineTo(t, e);
            },
            bezierCurveTo: function (e, t, n, r, o, i) {
              this._context.bezierCurveTo(t, e, r, n, i, o);
            }
          }),
          (oc.prototype = {
            areaStart: function () {
              this._line = 0;
            },
            areaEnd: function () {
              this._line = NaN;
            },
            lineStart: function () {
              (this._x = this._y = NaN), (this._point = 0);
            },
            lineEnd: function () {
              0 < this._t && this._t < 1 && 2 === this._point && this._context.lineTo(this._x, this._y),
                (this._line || (0 !== this._line && 1 === this._point)) && this._context.closePath(),
                this._line >= 0 && ((this._t = 1 - this._t), (this._line = 1 - this._line));
            },
            point: function (e, t) {
              switch (((e *= 1), (t *= 1), this._point)) {
                case 0:
                  (this._point = 1), this._line ? this._context.lineTo(e, t) : this._context.moveTo(e, t);
                  break;
                case 1:
                  this._point = 2;
                default:
                  if (this._t <= 0) this._context.lineTo(this._x, t), this._context.lineTo(e, t);
                  else {
                    var n = this._x * (1 - this._t) + e * this._t;
                    this._context.lineTo(n, this._y), this._context.lineTo(n, t);
                  }
              }
              (this._x = e), (this._y = t);
            }
          });
        let oy = Math.abs,
          ob = Math.atan2,
          ox = Math.cos,
          ow = Math.max,
          ok = Math.min,
          oM = Math.sin,
          oj = Math.sqrt,
          oE = Math.PI,
          oS = oE / 2,
          oT = 2 * oE;
        function oC(e) {
          return e >= 1 ? oS : e <= -1 ? -oS : Math.asin(e);
        }
        function oP(e) {
          return e.innerRadius;
        }
        function oN(e) {
          return e.outerRadius;
        }
        function oA(e) {
          return e.startAngle;
        }
        function oO(e) {
          return e.endAngle;
        }
        function o$(e) {
          return e && e.padAngle;
        }
        function oD(e, t, n, r, o, i, a) {
          var s = e - n,
            l = t - r,
            u = (a ? i : -i) / oj(s * s + l * l),
            c = u * l,
            d = -u * s,
            f = e + c,
            h = t + d,
            p = n + c,
            _ = r + d,
            g = (f + p) / 2,
            m = (h + _) / 2,
            v = p - f,
            y = _ - h,
            b = v * v + y * y,
            x = o - i,
            w = f * _ - p * h,
            k = (y < 0 ? -1 : 1) * oj(ow(0, x * x * b - w * w)),
            M = (w * y - v * k) / b,
            j = (-w * v - y * k) / b,
            E = (w * y + v * k) / b,
            S = (-w * v + y * k) / b,
            T = M - g,
            C = j - m,
            P = E - g,
            N = S - m;
          return T * T + C * C > P * P + N * N && ((M = E), (j = S)), { cx: M, cy: j, x01: -c, y01: -d, x11: M * (o / x - 1), y11: j * (o / x - 1) };
        }
        function oz() {
          var e = oP,
            t = oN,
            n = r2(0),
            r = null,
            o = oA,
            i = oO,
            a = o$,
            s = null,
            l = oe(u);
          function u() {
            var u,
              c,
              d = +e.apply(this, arguments),
              f = +t.apply(this, arguments),
              h = o.apply(this, arguments) - oS,
              p = i.apply(this, arguments) - oS,
              _ = oy(p - h),
              g = p > h;
            if ((s || (s = u = l()), f < d && ((c = f), (f = d), (d = c)), f > 1e-12)) {
              if (_ > oT - 1e-12)
                s.moveTo(f * ox(h), f * oM(h)), s.arc(0, 0, f, h, p, !g), d > 1e-12 && (s.moveTo(d * ox(p), d * oM(p)), s.arc(0, 0, d, p, h, g));
              else {
                var m,
                  v,
                  y = h,
                  b = p,
                  x = h,
                  w = p,
                  k = _,
                  M = _,
                  j = a.apply(this, arguments) / 2,
                  E = j > 1e-12 && (r ? +r.apply(this, arguments) : oj(d * d + f * f)),
                  S = ok(oy(f - d) / 2, +n.apply(this, arguments)),
                  T = S,
                  C = S;
                if (E > 1e-12) {
                  var P = oC((E / d) * oM(j)),
                    N = oC((E / f) * oM(j));
                  (k -= 2 * P) > 1e-12 ? ((P *= g ? 1 : -1), (x += P), (w -= P)) : ((k = 0), (x = w = (h + p) / 2)),
                    (M -= 2 * N) > 1e-12 ? ((N *= g ? 1 : -1), (y += N), (b -= N)) : ((M = 0), (y = b = (h + p) / 2));
                }
                var A = f * ox(y),
                  O = f * oM(y),
                  $ = d * ox(w),
                  D = d * oM(w);
                if (S > 1e-12) {
                  var z,
                    R = f * ox(b),
                    L = f * oM(b),
                    F = d * ox(x),
                    I = d * oM(x);
                  if (_ < oE) {
                    if (
                      (z = (function (e, t, n, r, o, i, a, s) {
                        var l = n - e,
                          u = r - t,
                          c = a - o,
                          d = s - i,
                          f = d * l - c * u;
                        if (!(f * f < 1e-12)) return (f = (c * (t - i) - d * (e - o)) / f), [e + f * l, t + f * u];
                      })(A, O, F, I, R, L, $, D))
                    ) {
                      var B,
                        U = A - z[0],
                        q = O - z[1],
                        H = R - z[0],
                        Y = L - z[1],
                        W = 1 / oM(((B = (U * H + q * Y) / (oj(U * U + q * q) * oj(H * H + Y * Y))) > 1 ? 0 : B < -1 ? oE : Math.acos(B)) / 2),
                        Z = oj(z[0] * z[0] + z[1] * z[1]);
                      (T = ok(S, (d - Z) / (W - 1))), (C = ok(S, (f - Z) / (W + 1)));
                    } else T = C = 0;
                  }
                }
                M > 1e-12
                  ? C > 1e-12
                    ? ((m = oD(F, I, A, O, f, C, g)),
                      (v = oD(R, L, $, D, f, C, g)),
                      s.moveTo(m.cx + m.x01, m.cy + m.y01),
                      C < S
                        ? s.arc(m.cx, m.cy, C, ob(m.y01, m.x01), ob(v.y01, v.x01), !g)
                        : (s.arc(m.cx, m.cy, C, ob(m.y01, m.x01), ob(m.y11, m.x11), !g),
                          s.arc(0, 0, f, ob(m.cy + m.y11, m.cx + m.x11), ob(v.cy + v.y11, v.cx + v.x11), !g),
                          s.arc(v.cx, v.cy, C, ob(v.y11, v.x11), ob(v.y01, v.x01), !g)))
                    : (s.moveTo(A, O), s.arc(0, 0, f, y, b, !g))
                  : s.moveTo(A, O),
                  d > 1e-12 && k > 1e-12
                    ? T > 1e-12
                      ? ((m = oD($, D, R, L, d, -T, g)),
                        (v = oD(A, O, F, I, d, -T, g)),
                        s.lineTo(m.cx + m.x01, m.cy + m.y01),
                        T < S
                          ? s.arc(m.cx, m.cy, T, ob(m.y01, m.x01), ob(v.y01, v.x01), !g)
                          : (s.arc(m.cx, m.cy, T, ob(m.y01, m.x01), ob(m.y11, m.x11), !g),
                            s.arc(0, 0, d, ob(m.cy + m.y11, m.cx + m.x11), ob(v.cy + v.y11, v.cx + v.x11), g),
                            s.arc(v.cx, v.cy, T, ob(v.y11, v.x11), ob(v.y01, v.x01), !g)))
                      : s.arc(0, 0, d, w, x, g)
                    : s.lineTo($, D);
              }
            } else s.moveTo(0, 0);
            if ((s.closePath(), u)) return (s = null), u + "" || null;
          }
          return (
            (u.centroid = function () {
              var n = (+e.apply(this, arguments) + +t.apply(this, arguments)) / 2,
                r = (+o.apply(this, arguments) + +i.apply(this, arguments)) / 2 - oE / 2;
              return [ox(r) * n, oM(r) * n];
            }),
            (u.innerRadius = function (t) {
              return arguments.length ? ((e = "function" == typeof t ? t : r2(+t)), u) : e;
            }),
            (u.outerRadius = function (e) {
              return arguments.length ? ((t = "function" == typeof e ? e : r2(+e)), u) : t;
            }),
            (u.cornerRadius = function (e) {
              return arguments.length ? ((n = "function" == typeof e ? e : r2(+e)), u) : n;
            }),
            (u.padRadius = function (e) {
              return arguments.length ? ((r = null == e ? null : "function" == typeof e ? e : r2(+e)), u) : r;
            }),
            (u.startAngle = function (e) {
              return arguments.length ? ((o = "function" == typeof e ? e : r2(+e)), u) : o;
            }),
            (u.endAngle = function (e) {
              return arguments.length ? ((i = "function" == typeof e ? e : r2(+e)), u) : i;
            }),
            (u.padAngle = function (e) {
              return arguments.length ? ((a = "function" == typeof e ? e : r2(+e)), u) : a;
            }),
            (u.context = function (e) {
              return arguments.length ? ((s = null == e ? null : e), u) : s;
            }),
            u
          );
        }
        function oR(e, t, n) {
          var r = null,
            o = r2(!0),
            i = null,
            a = r5,
            s = null,
            l = oe(u);
          function u(u) {
            var c,
              d,
              f,
              h,
              p,
              _ = (u = r1(u)).length,
              g = !1,
              m = Array(_),
              v = Array(_);
            for (null == i && (s = a((p = l()))), c = 0; c <= _; ++c) {
              if (!(c < _ && o((h = u[c]), c, u)) === g) {
                if ((g = !g)) (d = c), s.areaStart(), s.lineStart();
                else {
                  for (s.lineEnd(), s.lineStart(), f = c - 1; f >= d; --f) s.point(m[f], v[f]);
                  s.lineEnd(), s.areaEnd();
                }
              }
              g && ((m[c] = +e(h, c, u)), (v[c] = +t(h, c, u)), s.point(r ? +r(h, c, u) : m[c], n ? +n(h, c, u) : v[c]));
            }
            if (p) return (s = null), p + "" || null;
          }
          function c() {
            return or().defined(o).curve(a).context(i);
          }
          return (
            (e = "function" == typeof e ? e : void 0 === e ? ot : r2(+e)),
            (t = "function" == typeof t ? t : void 0 === t ? r2(0) : r2(+t)),
            (n = "function" == typeof n ? n : void 0 === n ? on : r2(+n)),
            (u.x = function (t) {
              return arguments.length ? ((e = "function" == typeof t ? t : r2(+t)), (r = null), u) : e;
            }),
            (u.x0 = function (t) {
              return arguments.length ? ((e = "function" == typeof t ? t : r2(+t)), u) : e;
            }),
            (u.x1 = function (e) {
              return arguments.length ? ((r = null == e ? null : "function" == typeof e ? e : r2(+e)), u) : r;
            }),
            (u.y = function (e) {
              return arguments.length ? ((t = "function" == typeof e ? e : r2(+e)), (n = null), u) : t;
            }),
            (u.y0 = function (e) {
              return arguments.length ? ((t = "function" == typeof e ? e : r2(+e)), u) : t;
            }),
            (u.y1 = function (e) {
              return arguments.length ? ((n = null == e ? null : "function" == typeof e ? e : r2(+e)), u) : n;
            }),
            (u.lineX0 = u.lineY0 =
              function () {
                return c().x(e).y(t);
              }),
            (u.lineY1 = function () {
              return c().x(e).y(n);
            }),
            (u.lineX1 = function () {
              return c().x(r).y(t);
            }),
            (u.defined = function (e) {
              return arguments.length ? ((o = "function" == typeof e ? e : r2(!!e)), u) : o;
            }),
            (u.curve = function (e) {
              return arguments.length ? ((a = e), null != i && (s = a(i)), u) : a;
            }),
            (u.context = function (e) {
              return arguments.length ? (null == e ? (i = s = null) : (s = a((i = e))), u) : i;
            }),
            u
          );
        }
        function oL() {}
        function oF(e, t, n) {
          e._context.bezierCurveTo(
            e._x1 + e._k * (e._x2 - e._x0),
            e._y1 + e._k * (e._y2 - e._y0),
            e._x2 + e._k * (e._x1 - t),
            e._y2 + e._k * (e._y1 - n),
            e._x2,
            e._y2
          );
        }
        function oI(e, t) {
          (this._context = e), (this._k = (1 - t) / 6);
        }
        function oB(e, t) {
          (this._context = e), (this._k = (1 - t) / 6);
        }
        (oI.prototype = {
          areaStart: function () {
            this._line = 0;
          },
          areaEnd: function () {
            this._line = NaN;
          },
          lineStart: function () {
            (this._x0 = this._x1 = this._x2 = this._y0 = this._y1 = this._y2 = NaN), (this._point = 0);
          },
          lineEnd: function () {
            switch (this._point) {
              case 2:
                this._context.lineTo(this._x2, this._y2);
                break;
              case 3:
                oF(this, this._x1, this._y1);
            }
            (this._line || (0 !== this._line && 1 === this._point)) && this._context.closePath(), (this._line = 1 - this._line);
          },
          point: function (e, t) {
            switch (((e *= 1), (t *= 1), this._point)) {
              case 0:
                (this._point = 1), this._line ? this._context.lineTo(e, t) : this._context.moveTo(e, t);
                break;
              case 1:
                (this._point = 2), (this._x1 = e), (this._y1 = t);
                break;
              case 2:
                this._point = 3;
              default:
                oF(this, e, t);
            }
            (this._x0 = this._x1), (this._x1 = this._x2), (this._x2 = e), (this._y0 = this._y1), (this._y1 = this._y2), (this._y2 = t);
          }
        }),
          (function e(t) {
            function n(e) {
              return new oI(e, t);
            }
            return (
              (n.tension = function (t) {
                return e(+t);
              }),
              n
            );
          })(0),
          (oB.prototype = {
            areaStart: oL,
            areaEnd: oL,
            lineStart: function () {
              (this._x0 = this._x1 = this._x2 = this._x3 = this._x4 = this._x5 = this._y0 = this._y1 = this._y2 = this._y3 = this._y4 = this._y5 = NaN),
                (this._point = 0);
            },
            lineEnd: function () {
              switch (this._point) {
                case 1:
                  this._context.moveTo(this._x3, this._y3), this._context.closePath();
                  break;
                case 2:
                  this._context.lineTo(this._x3, this._y3), this._context.closePath();
                  break;
                case 3:
                  this.point(this._x3, this._y3), this.point(this._x4, this._y4), this.point(this._x5, this._y5);
              }
            },
            point: function (e, t) {
              switch (((e *= 1), (t *= 1), this._point)) {
                case 0:
                  (this._point = 1), (this._x3 = e), (this._y3 = t);
                  break;
                case 1:
                  (this._point = 2), this._context.moveTo((this._x4 = e), (this._y4 = t));
                  break;
                case 2:
                  (this._point = 3), (this._x5 = e), (this._y5 = t);
                  break;
                default:
                  oF(this, e, t);
              }
              (this._x0 = this._x1), (this._x1 = this._x2), (this._x2 = e), (this._y0 = this._y1), (this._y1 = this._y2), (this._y2 = t);
            }
          });
        let oU = (function e(t) {
          function n(e) {
            return new oB(e, t);
          }
          return (
            (n.tension = function (t) {
              return e(+t);
            }),
            n
          );
        })(0);
        function oq(e) {
          this._context = e;
        }
        function oH(e) {
          return new oq(e);
        }
        oq.prototype = {
          areaStart: oL,
          areaEnd: oL,
          lineStart: function () {
            this._point = 0;
          },
          lineEnd: function () {
            this._point && this._context.closePath();
          },
          point: function (e, t) {
            (e *= 1), (t *= 1), this._point ? this._context.lineTo(e, t) : ((this._point = 1), this._context.moveTo(e, t));
          }
        };
        var oY = oZ(r5);
        function oW(e) {
          this._curve = e;
        }
        function oZ(e) {
          function t(t) {
            return new oW(e(t));
          }
          return (t._curve = e), t;
        }
        function oX(e) {
          var t = e.curve;
          return (
            (e.angle = e.x),
            delete e.x,
            (e.radius = e.y),
            delete e.y,
            (e.curve = function (e) {
              return arguments.length ? t(oZ(e)) : t()._curve;
            }),
            e
          );
        }
        function oV() {
          return oX(or().curve(oY));
        }
        oW.prototype = {
          areaStart: function () {
            this._curve.areaStart();
          },
          areaEnd: function () {
            this._curve.areaEnd();
          },
          lineStart: function () {
            this._curve.lineStart();
          },
          lineEnd: function () {
            this._curve.lineEnd();
          },
          point: function (e, t) {
            this._curve.point(t * Math.sin(e), -(t * Math.cos(e)));
          }
        };
        var oG = n(25779);
        function oJ(e, t) {
          return Array.isArray(t)
            ? [e.a * t[0] + e.c * t[1] + e.e, e.b * t[0] + e.d * t[1] + e.f]
            : { x: e.a * t.x + e.c * t.y + e.e, y: e.b * t.x + e.d * t.y + e.f };
        }
        function oK(e) {
          return { a: parseFloat(e.a), b: parseFloat(e.b), c: parseFloat(e.c), d: parseFloat(e.d), e: parseFloat(e.e), f: parseFloat(e.f) };
        }
        function oQ(e) {
          let { a: t, b: n, c: r, d: o, e: i, f: a } = e,
            s = t * o - n * r;
          return { a: o / s, b: -(n / s), c: -(r / s), d: t / s, e: -((o * i - r * a) / s), f: (n * i - t * a) / s };
        }
        function o0(e) {
          return void 0 === e;
        }
        function o1(e, t = 0) {
          return { a: 1, c: 0, e: e, b: 0, d: 1, f: t };
        }
        function o2(...e) {
          e = Array.isArray(e[0]) ? e[0] : e;
          let t = (e, t) => ({
            a: e.a * t.a + e.c * t.b,
            c: e.a * t.c + e.c * t.d,
            e: e.a * t.e + e.c * t.f + e.e,
            b: e.b * t.a + e.d * t.b,
            d: e.b * t.c + e.d * t.d,
            f: e.b * t.e + e.d * t.f + e.f
          });
          switch (e.length) {
            case 0:
              throw Error("no matrices provided");
            case 1:
              return e[0];
            case 2:
              return t(e[0], e[1]);
            default: {
              let [n, r, ...o] = e;
              return o2(t(n, r), ...o);
            }
          }
        }
        function o3(e, t, n, r) {
          o0(t) && (t = e);
          let o = { a: e, c: 0, e: 0, b: 0, d: t, f: 0 };
          return o0(n) || o0(r) ? o : o2([o1(n, r), o, o1(-n, -r)]);
        }
        function o5(e, t = 1e10) {
          return {
            a: Math.round(e.a * t) / t,
            b: Math.round(e.b * t) / t,
            c: Math.round(e.c * t) / t,
            d: Math.round(e.d * t) / t,
            e: Math.round(e.e * t) / t,
            f: Math.round(e.f * t) / t
          };
        }
        let { cos: o8, sin: o6, PI: o4 } = Math;
        function o7(e, t, n) {
          return (function (e, t, n) {
            let r = o8(e),
              o = o6(e),
              i = { a: r, c: -o, e: 0, b: o, d: r, f: 0 };
            return o0(t) || o0(n) ? i : o2([o1(t, n), i, o1(-t, -n)]);
          })((e * o4) / 180, t, n);
        }
        let { tan: o9 } = Math;
        function ie(e, t) {
          var n, r;
          return (n = (e * Math.PI) / 180), (r = (t * Math.PI) / 180), { a: 1, c: o9(n), e: 0, b: o9(r), d: 1, f: 0 };
        }
        function it(e, t, n, r) {
          var o = Error.call(this, e);
          return (
            Object.setPrototypeOf && Object.setPrototypeOf(o, it.prototype), (o.expected = t), (o.found = n), (o.location = r), (o.name = "SyntaxError"), o
          );
        }
        function ir(e, t, n) {
          return ((n = n || " "), e.length > t) ? e : ((t -= e.length), e + (n += n.repeat(t)).slice(0, t));
        }
        (function (e, t) {
          function n() {
            this.constructor = e;
          }
          (n.prototype = t.prototype), (e.prototype = new n());
        })(it, Error),
          (it.prototype.format = function (e) {
            var t = "Error: " + this.message;
            if (this.location) {
              var n,
                r = null;
              for (n = 0; n < e.length; n++)
                if (e[n].source === this.location.source) {
                  r = e[n].text.split(/\r\n|\n|\r/g);
                  break;
                }
              var o = this.location.start,
                i = this.location.source && "function" == typeof this.location.source.offset ? this.location.source.offset(o) : o,
                a = this.location.source + ":" + i.line + ":" + i.column;
              if (r) {
                var s = this.location.end,
                  l = ir("", i.line.toString().length, " "),
                  u = r[o.line - 1],
                  c = (o.line === s.line ? s.column : u.length + 1) - o.column || 1;
                t += "\n --\x3e " + a + "\n" + l + " |\n" + i.line + " | " + u + "\n" + l + " | " + ir("", o.column - 1, " ") + ir("", c, "^");
              } else t += "\n at " + a;
            }
            return t;
          }),
          (it.buildMessage = function (e, t) {
            var n = {
              literal: function (e) {
                return '"' + o(e.text) + '"';
              },
              class: function (e) {
                var t = e.parts.map(function (e) {
                  return Array.isArray(e) ? i(e[0]) + "-" + i(e[1]) : i(e);
                });
                return "[" + (e.inverted ? "^" : "") + t.join("") + "]";
              },
              any: function () {
                return "any character";
              },
              end: function () {
                return "end of input";
              },
              other: function (e) {
                return e.description;
              }
            };
            function r(e) {
              return e.charCodeAt(0).toString(16).toUpperCase();
            }
            function o(e) {
              return e
                .replace(/\\/g, "\\\\")
                .replace(/"/g, '\\"')
                .replace(/\0/g, "\\0")
                .replace(/\t/g, "\\t")
                .replace(/\n/g, "\\n")
                .replace(/\r/g, "\\r")
                .replace(/[\x00-\x0F]/g, function (e) {
                  return "\\x0" + r(e);
                })
                .replace(/[\x10-\x1F\x7F-\x9F]/g, function (e) {
                  return "\\x" + r(e);
                });
            }
            function i(e) {
              return e
                .replace(/\\/g, "\\\\")
                .replace(/\]/g, "\\]")
                .replace(/\^/g, "\\^")
                .replace(/-/g, "\\-")
                .replace(/\0/g, "\\0")
                .replace(/\t/g, "\\t")
                .replace(/\n/g, "\\n")
                .replace(/\r/g, "\\r")
                .replace(/[\x00-\x0F]/g, function (e) {
                  return "\\x0" + r(e);
                })
                .replace(/[\x10-\x1F\x7F-\x9F]/g, function (e) {
                  return "\\x" + r(e);
                });
            }
            function a(e) {
              return n[e.type](e);
            }
            return (
              "Expected " +
              (function (e) {
                var t,
                  n,
                  r = e.map(a);
                if ((r.sort(), r.length > 0)) {
                  for (t = 1, n = 1; t < r.length; t++) r[t - 1] !== r[t] && ((r[n] = r[t]), n++);
                  r.length = n;
                }
                switch (r.length) {
                  case 1:
                    return r[0];
                  case 2:
                    return r[0] + " or " + r[1];
                  default:
                    return r.slice(0, -1).join(", ") + ", or " + r[r.length - 1];
                }
              })(e) +
              " but " +
              (t ? '"' + o(t) + '"' : "end of input") +
              " found."
            );
          });
        var io = n(36735),
          ii = n(14969);
        function ia() {
          return (ia = Object.assign
            ? Object.assign.bind()
            : function (e) {
                for (var t = 1; t < arguments.length; t++) {
                  var n = arguments[t];
                  for (var r in n) Object.prototype.hasOwnProperty.call(n, r) && (e[r] = n[r]);
                }
                return e;
              }).apply(this, arguments);
        }
        var is = function (e) {
            var t = (0, f.useRef)(e);
            return (t.current = e), t;
          },
          il = function (e, t) {
            var n = "",
              r = -1;
            return (
              Object.keys(e).forEach(function (o) {
                var i = e[o];
                t >= i && i > r && ((n = o), (r = i));
              }),
              n
            );
          },
          iu = function (e) {
            var t = void 0 === e ? {} : e,
              n = t.useBorderBoxSize,
              r = t.breakpoints,
              o = t.updateOnBreakpointChange,
              i = t.shouldUpdate,
              a = t.onResize,
              s = t.polyfill,
              l = (0, f.useState)({ currentBreakpoint: "", width: null, height: null }),
              u = l[0],
              c = l[1],
              d = (0, f.useRef)({}),
              h = (0, f.useRef)(),
              p = (0, f.useRef)(),
              _ = (0, f.useRef)(!1),
              g = (0, f.useRef)(),
              m = is(a),
              v = is(i),
              y = (0, f.useCallback)(function () {
                p.current && p.current.disconnect();
              }, []),
              b = (0, f.useCallback)(
                function (e) {
                  e && e !== g.current && (y(), (g.current = e), c({ currentBreakpoint: "", width: e.clientWidth, height: e.clientHeight })),
                    p.current && g.current && p.current.observe(g.current);
                },
                [y]
              );
            return (
              (0, f.useEffect)(
                function () {
                  if ((!("ResizeObserver" in window) || !("ResizeObserverEntry" in window)) && !s)
                    return (
                      console.error(
                        "\uD83D\uDCA1 react-cool-dimensions: the browser doesn't support Resize Observer, please use polyfill: https://github.com/wellyshen/react-cool-dimensions#resizeobserver-polyfill"
                      ),
                      function () {
                        return null;
                      }
                    );
                  var e = null;
                  return (
                    (p.current = new (s || ResizeObserver)(function (t) {
                      var i = t[0];
                      e = requestAnimationFrame(function () {
                        var e = i.contentBoxSize,
                          t = i.borderBoxSize,
                          a = i.contentRect,
                          s = e;
                        n &&
                          (t
                            ? (s = t)
                            : _.current ||
                              (console.warn(
                                "\uD83D\uDCA1 react-cool-dimensions: the browser doesn't support border-box size, fallback to content-box size. Please see: https://github.com/wellyshen/react-cool-dimensions#border-box-size-measurement"
                              ),
                              (_.current = !0)));
                        var l = (s = Array.isArray(s) ? s[0] : s) ? s.inlineSize : a.width,
                          u = s ? s.blockSize : a.height;
                        if (l !== d.current.width || u !== d.current.height) {
                          d.current = { width: l, height: u };
                          var f = { currentBreakpoint: "", width: l, height: u, entry: i, observe: b, unobserve: y };
                          r
                            ? ((f.currentBreakpoint = il(r, l)),
                              f.currentBreakpoint !== h.current && (m.current && m.current(f), (h.current = f.currentBreakpoint)))
                            : m.current && m.current(f);
                          var p = { currentBreakpoint: f.currentBreakpoint, width: l, height: u, entry: i };
                          if (!v.current || v.current(p)) {
                            if (!v.current && r && o) {
                              c(function (e) {
                                return e.currentBreakpoint !== p.currentBreakpoint ? p : e;
                              });
                              return;
                            }
                            c(p);
                          }
                        }
                      });
                    })),
                    b(),
                    function () {
                      y(), e && cancelAnimationFrame(e);
                    }
                  );
                },
                [JSON.stringify(r), n, b, y, o]
              ),
              ia({}, u, { observe: b, unobserve: y })
            );
          },
          ic = n(17147);
        let id = (e, t = 0, n = 1) => iy(ib(t, e), n),
          ih = e => {
            (e._clipped = !1), (e._unclipped = e.slice(0));
            for (let t = 0; t <= 3; t++)
              t < 3 ? ((e[t] < 0 || e[t] > 255) && (e._clipped = !0), (e[t] = id(e[t], 0, 255))) : 3 === t && (e[t] = id(e[t], 0, 1));
            return e;
          },
          ip = {};
        for (let e of ["Boolean", "Number", "String", "Function", "Array", "Date", "RegExp", "Undefined", "Null"]) ip[`[object ${e}]`] = e.toLowerCase();
        function i_(e) {
          return ip[Object.prototype.toString.call(e)] || "object";
        }
        let ig = (e, t = null) =>
            e.length >= 3
              ? Array.prototype.slice.call(e)
              : "object" == i_(e[0]) && t
                ? t
                    .split("")
                    .filter(t => void 0 !== e[0][t])
                    .map(t => e[0][t])
                : e[0],
          im = e => {
            if (e.length < 2) return null;
            let t = e.length - 1;
            return "string" == i_(e[t]) ? e[t].toLowerCase() : null;
          },
          { PI: iv, min: iy, max: ib } = Math,
          ix = 2 * iv,
          iw = iv / 3,
          ik = iv / 180,
          iM = 180 / iv,
          ij = { format: {}, autodetect: [] },
          iE = class {
            constructor(...e) {
              if ("object" === i_(e[0]) && e[0].constructor && e[0].constructor === this.constructor) return e[0];
              let t = im(e),
                n = !1;
              if (!t) {
                for (let r of ((n = !0), ij.sorted || ((ij.autodetect = ij.autodetect.sort((e, t) => t.p - e.p)), (ij.sorted = !0)), ij.autodetect))
                  if ((t = r.test(...e))) break;
              }
              if (ij.format[t]) {
                let r = ij.format[t].apply(null, n ? e : e.slice(0, -1));
                this._rgb = ih(r);
              } else throw Error("unknown format: " + e);
              3 === this._rgb.length && this._rgb.push(1);
            }
            toString() {
              return "function" == i_(this.hex) ? this.hex() : `[${this._rgb.join(",")}]`;
            }
          },
          iS = (...e) => new iS.Color(...e);
        (iS.Color = iE), (iS.version = "2.6.0");
        let { max: iT } = Math,
          iC = (...e) => {
            let [t, n, r] = ig(e, "rgb"),
              o = 1 - iT((t /= 255), iT((n /= 255), (r /= 255))),
              i = o < 1 ? 1 / (1 - o) : 0;
            return [(1 - t - o) * i, (1 - n - o) * i, (1 - r - o) * i, o];
          };
        (iE.prototype.cmyk = function () {
          return iC(this._rgb);
        }),
          (iS.cmyk = (...e) => new iE(...e, "cmyk")),
          (ij.format.cmyk = (...e) => {
            let [t, n, r, o] = (e = ig(e, "cmyk")),
              i = e.length > 4 ? e[4] : 1;
            return 1 === o
              ? [0, 0, 0, i]
              : [t >= 1 ? 0 : 255 * (1 - t) * (1 - o), n >= 1 ? 0 : 255 * (1 - n) * (1 - o), r >= 1 ? 0 : 255 * (1 - r) * (1 - o), i];
          }),
          ij.autodetect.push({
            p: 2,
            test: (...e) => {
              if ("array" === i_((e = ig(e, "cmyk"))) && 4 === e.length) return "cmyk";
            }
          });
        let iP = e => Math.round(100 * e) / 100,
          iN = (...e) => {
            let t = ig(e, "hsla"),
              n = im(e) || "lsa";
            return (
              (t[0] = iP(t[0] || 0)),
              (t[1] = iP(100 * t[1]) + "%"),
              (t[2] = iP(100 * t[2]) + "%"),
              "hsla" === n || (t.length > 3 && t[3] < 1) ? ((t[3] = t.length > 3 ? t[3] : 1), (n = "hsla")) : (t.length = 3),
              `${n}(${t.join(",")})`
            );
          },
          iA = (...e) => {
            let t, n;
            let [r, o, i] = (e = ig(e, "rgba")),
              a = iy((r /= 255), (o /= 255), (i /= 255)),
              s = ib(r, o, i),
              l = (s + a) / 2;
            return (s === a ? ((t = 0), (n = Number.NaN)) : (t = l < 0.5 ? (s - a) / (s + a) : (s - a) / (2 - s - a)),
            r == s ? (n = (o - i) / (s - a)) : o == s ? (n = 2 + (i - r) / (s - a)) : i == s && (n = 4 + (r - o) / (s - a)),
            (n *= 60) < 0 && (n += 360),
            e.length > 3 && void 0 !== e[3])
              ? [n, t, l, e[3]]
              : [n, t, l];
          },
          { round: iO } = Math,
          i$ = (...e) => {
            let t = ig(e, "rgba"),
              n = im(e) || "rgb";
            return "hsl" == n.substr(0, 3)
              ? iN(iA(t), n)
              : ((t[0] = iO(t[0])),
                (t[1] = iO(t[1])),
                (t[2] = iO(t[2])),
                ("rgba" === n || (t.length > 3 && t[3] < 1)) && ((t[3] = t.length > 3 ? t[3] : 1), (n = "rgba")),
                `${n}(${t.slice(0, "rgb" === n ? 3 : 4).join(",")})`);
          },
          { round: iD } = Math,
          iz = (...e) => {
            let t, n, r;
            let [o, i, a] = (e = ig(e, "hsl"));
            if (0 === i) t = n = r = 255 * a;
            else {
              let e = [0, 0, 0],
                s = [0, 0, 0],
                l = a < 0.5 ? a * (1 + i) : a + i - a * i,
                u = 2 * a - l,
                c = o / 360;
              (e[0] = c + 1 / 3), (e[1] = c), (e[2] = c - 1 / 3);
              for (let t = 0; t < 3; t++)
                e[t] < 0 && (e[t] += 1),
                  e[t] > 1 && (e[t] -= 1),
                  6 * e[t] < 1
                    ? (s[t] = u + (l - u) * 6 * e[t])
                    : 2 * e[t] < 1
                      ? (s[t] = l)
                      : 3 * e[t] < 2
                        ? (s[t] = u + (l - u) * (2 / 3 - e[t]) * 6)
                        : (s[t] = u);
              [t, n, r] = [iD(255 * s[0]), iD(255 * s[1]), iD(255 * s[2])];
            }
            return e.length > 3 ? [t, n, r, e[3]] : [t, n, r, 1];
          },
          iR = /^rgb\(\s*(-?\d+),\s*(-?\d+)\s*,\s*(-?\d+)\s*\)$/,
          iL = /^rgba\(\s*(-?\d+),\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*([01]|[01]?\.\d+)\)$/,
          iF = /^rgb\(\s*(-?\d+(?:\.\d+)?)%,\s*(-?\d+(?:\.\d+)?)%\s*,\s*(-?\d+(?:\.\d+)?)%\s*\)$/,
          iI = /^rgba\(\s*(-?\d+(?:\.\d+)?)%,\s*(-?\d+(?:\.\d+)?)%\s*,\s*(-?\d+(?:\.\d+)?)%\s*,\s*([01]|[01]?\.\d+)\)$/,
          iB = /^hsl\(\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)%\s*,\s*(-?\d+(?:\.\d+)?)%\s*\)$/,
          iU = /^hsla\(\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)%\s*,\s*(-?\d+(?:\.\d+)?)%\s*,\s*([01]|[01]?\.\d+)\)$/,
          { round: iq } = Math,
          iH = e => {
            let t;
            if (((e = e.toLowerCase().trim()), ij.format.named))
              try {
                return ij.format.named(e);
              } catch (e) {}
            if ((t = e.match(iR))) {
              let e = t.slice(1, 4);
              for (let t = 0; t < 3; t++) e[t] = +e[t];
              return (e[3] = 1), e;
            }
            if ((t = e.match(iL))) {
              let e = t.slice(1, 5);
              for (let t = 0; t < 4; t++) e[t] = +e[t];
              return e;
            }
            if ((t = e.match(iF))) {
              let e = t.slice(1, 4);
              for (let t = 0; t < 3; t++) e[t] = iq(2.55 * e[t]);
              return (e[3] = 1), e;
            }
            if ((t = e.match(iI))) {
              let e = t.slice(1, 5);
              for (let t = 0; t < 3; t++) e[t] = iq(2.55 * e[t]);
              return (e[3] = +e[3]), e;
            }
            if ((t = e.match(iB))) {
              let e = t.slice(1, 4);
              (e[1] *= 0.01), (e[2] *= 0.01);
              let n = iz(e);
              return (n[3] = 1), n;
            }
            if ((t = e.match(iU))) {
              let e = t.slice(1, 4);
              (e[1] *= 0.01), (e[2] *= 0.01);
              let n = iz(e);
              return (n[3] = +t[4]), n;
            }
          };
        (iH.test = e => iR.test(e) || iL.test(e) || iF.test(e) || iI.test(e) || iB.test(e) || iU.test(e)),
          (iE.prototype.css = function (e) {
            return i$(this._rgb, e);
          }),
          (iS.css = (...e) => new iE(...e, "css")),
          (ij.format.css = iH),
          ij.autodetect.push({
            p: 5,
            test: (e, ...t) => {
              if (!t.length && "string" === i_(e) && iH.test(e)) return "css";
            }
          }),
          (ij.format.gl = (...e) => {
            let t = ig(e, "rgba");
            return (t[0] *= 255), (t[1] *= 255), (t[2] *= 255), t;
          }),
          (iS.gl = (...e) => new iE(...e, "gl")),
          (iE.prototype.gl = function () {
            let e = this._rgb;
            return [e[0] / 255, e[1] / 255, e[2] / 255, e[3]];
          });
        let { floor: iY } = Math,
          iW = (...e) => {
            let t;
            let [n, r, o] = ig(e, "rgb"),
              i = iy(n, r, o),
              a = ib(n, r, o),
              s = a - i;
            return (
              0 === s
                ? (t = Number.NaN)
                : (n === a && (t = (r - o) / s), r === a && (t = 2 + (o - n) / s), o === a && (t = 4 + (n - r) / s), (t *= 60) < 0 && (t += 360)),
              [t, (100 * s) / 255, (i / (255 - s)) * 100]
            );
          };
        (iE.prototype.hcg = function () {
          return iW(this._rgb);
        }),
          (iS.hcg = (...e) => new iE(...e, "hcg")),
          (ij.format.hcg = (...e) => {
            let t, n, r;
            let [o, i, a] = (e = ig(e, "hcg"));
            a *= 255;
            let s = 255 * i;
            if (0 === i) t = n = r = a;
            else {
              360 === o && (o = 0), o > 360 && (o -= 360), o < 0 && (o += 360);
              let e = iY((o /= 60)),
                l = o - e,
                u = a * (1 - i),
                c = u + s * (1 - l),
                d = u + s * l,
                f = u + s;
              switch (e) {
                case 0:
                  [t, n, r] = [f, d, u];
                  break;
                case 1:
                  [t, n, r] = [c, f, u];
                  break;
                case 2:
                  [t, n, r] = [u, f, d];
                  break;
                case 3:
                  [t, n, r] = [u, c, f];
                  break;
                case 4:
                  [t, n, r] = [d, u, f];
                  break;
                case 5:
                  [t, n, r] = [f, u, c];
              }
            }
            return [t, n, r, e.length > 3 ? e[3] : 1];
          }),
          ij.autodetect.push({
            p: 1,
            test: (...e) => {
              if ("array" === i_((e = ig(e, "hcg"))) && 3 === e.length) return "hcg";
            }
          });
        let iZ = /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
          iX = /^#?([A-Fa-f0-9]{8}|[A-Fa-f0-9]{4})$/,
          iV = e => {
            if (e.match(iZ)) {
              (4 === e.length || 7 === e.length) && (e = e.substr(1)), 3 === e.length && (e = (e = e.split(""))[0] + e[0] + e[1] + e[1] + e[2] + e[2]);
              let t = parseInt(e, 16);
              return [t >> 16, (t >> 8) & 255, 255 & t, 1];
            }
            if (e.match(iX)) {
              (5 === e.length || 9 === e.length) && (e = e.substr(1)),
                4 === e.length && (e = (e = e.split(""))[0] + e[0] + e[1] + e[1] + e[2] + e[2] + e[3] + e[3]);
              let t = parseInt(e, 16),
                n = Math.round(((255 & t) / 255) * 100) / 100;
              return [(t >> 24) & 255, (t >> 16) & 255, (t >> 8) & 255, n];
            }
            throw Error(`unknown hex color: ${e}`);
          },
          { round: iG } = Math,
          iJ = (...e) => {
            let [t, n, r, o] = ig(e, "rgba"),
              i = im(e) || "auto";
            void 0 === o && (o = 1), "auto" === i && (i = o < 1 ? "rgba" : "rgb"), (t = iG(t));
            let a = "000000" + ((t << 16) | ((n = iG(n)) << 8) | (r = iG(r))).toString(16);
            a = a.substr(a.length - 6);
            let s = "0" + iG(255 * o).toString(16);
            switch (((s = s.substr(s.length - 2)), i.toLowerCase())) {
              case "rgba":
                return `#${a}${s}`;
              case "argb":
                return `#${s}${a}`;
              default:
                return `#${a}`;
            }
          };
        (iE.prototype.hex = function (e) {
          return iJ(this._rgb, e);
        }),
          (iS.hex = (...e) => new iE(...e, "hex")),
          (ij.format.hex = iV),
          ij.autodetect.push({
            p: 4,
            test: (e, ...t) => {
              if (!t.length && "string" === i_(e) && [3, 4, 5, 6, 7, 8, 9].indexOf(e.length) >= 0) return "hex";
            }
          });
        let { cos: iK } = Math,
          { min: iQ, sqrt: i0, acos: i1 } = Math,
          i2 = (...e) => {
            let t,
              [n, r, o] = ig(e, "rgb"),
              i = iQ((n /= 255), (r /= 255), (o /= 255)),
              a = (n + r + o) / 3,
              s = a > 0 ? 1 - i / a : 0;
            return (
              0 === s ? (t = NaN) : ((t = i1((t = (n - r + (n - o)) / 2 / i0((n - r) * (n - r) + (n - o) * (r - o))))), o > r && (t = ix - t), (t /= ix)),
              [360 * t, s, a]
            );
          };
        (iE.prototype.hsi = function () {
          return i2(this._rgb);
        }),
          (iS.hsi = (...e) => new iE(...e, "hsi")),
          (ij.format.hsi = (...e) => {
            let t, n, r;
            let [o, i, a] = (e = ig(e, "hsi"));
            return (
              isNaN(o) && (o = 0),
              isNaN(i) && (i = 0),
              o > 360 && (o -= 360),
              o < 0 && (o += 360),
              (o /= 360) < 1 / 3
                ? (n = 1 - ((r = (1 - i) / 3) + (t = (1 + (i * iK(ix * o)) / iK(iw - ix * o)) / 3)))
                : o < 2 / 3
                  ? ((o -= 1 / 3), (r = 1 - ((t = (1 - i) / 3) + (n = (1 + (i * iK(ix * o)) / iK(iw - ix * o)) / 3))))
                  : ((o -= 2 / 3), (t = 1 - ((n = (1 - i) / 3) + (r = (1 + (i * iK(ix * o)) / iK(iw - ix * o)) / 3)))),
              (t = id(a * t * 3)),
              [255 * t, 255 * (n = id(a * n * 3)), 255 * (r = id(a * r * 3)), e.length > 3 ? e[3] : 1]
            );
          }),
          ij.autodetect.push({
            p: 2,
            test: (...e) => {
              if ("array" === i_((e = ig(e, "hsi"))) && 3 === e.length) return "hsi";
            }
          }),
          (iE.prototype.hsl = function () {
            return iA(this._rgb);
          }),
          (iS.hsl = (...e) => new iE(...e, "hsl")),
          (ij.format.hsl = iz),
          ij.autodetect.push({
            p: 2,
            test: (...e) => {
              if ("array" === i_((e = ig(e, "hsl"))) && 3 === e.length) return "hsl";
            }
          });
        let { floor: i3 } = Math,
          { min: i5, max: i8 } = Math,
          i6 = (...e) => {
            let t, n, r;
            let [o, i, a] = (e = ig(e, "rgb")),
              s = i5(o, i, a),
              l = i8(o, i, a),
              u = l - s;
            return (
              (r = l / 255),
              0 === l
                ? ((t = Number.NaN), (n = 0))
                : ((n = u / l), o === l && (t = (i - a) / u), i === l && (t = 2 + (a - o) / u), a === l && (t = 4 + (o - i) / u), (t *= 60) < 0 && (t += 360)),
              [t, n, r]
            );
          };
        (iE.prototype.hsv = function () {
          return i6(this._rgb);
        }),
          (iS.hsv = (...e) => new iE(...e, "hsv")),
          (ij.format.hsv = (...e) => {
            let t, n, r;
            let [o, i, a] = (e = ig(e, "hsv"));
            if (((a *= 255), 0 === i)) t = n = r = a;
            else {
              360 === o && (o = 0), o > 360 && (o -= 360), o < 0 && (o += 360);
              let e = i3((o /= 60)),
                s = o - e,
                l = a * (1 - i),
                u = a * (1 - i * s),
                c = a * (1 - i * (1 - s));
              switch (e) {
                case 0:
                  [t, n, r] = [a, c, l];
                  break;
                case 1:
                  [t, n, r] = [u, a, l];
                  break;
                case 2:
                  [t, n, r] = [l, a, c];
                  break;
                case 3:
                  [t, n, r] = [l, u, a];
                  break;
                case 4:
                  [t, n, r] = [c, l, a];
                  break;
                case 5:
                  [t, n, r] = [a, l, u];
              }
            }
            return [t, n, r, e.length > 3 ? e[3] : 1];
          }),
          ij.autodetect.push({
            p: 2,
            test: (...e) => {
              if ("array" === i_((e = ig(e, "hsv"))) && 3 === e.length) return "hsv";
            }
          });
        let i4 = { Kn: 18, Xn: 0.95047, Yn: 1, Zn: 1.08883, t0: 0.137931034, t1: 0.206896552, t2: 0.12841855, t3: 0.008856452 },
          { pow: i7 } = Math,
          i9 = e => 255 * (e <= 0.00304 ? 12.92 * e : 1.055 * i7(e, 1 / 2.4) - 0.055),
          ae = e => (e > i4.t1 ? e * e * e : i4.t2 * (e - i4.t0)),
          at = (...e) => {
            let t, n, r, o;
            let [i, a, s] = (e = ig(e, "lab"));
            return (
              (n = (i + 16) / 116),
              (t = isNaN(a) ? n : n + a / 500),
              (r = isNaN(s) ? n : n - s / 200),
              (n = i4.Yn * ae(n)),
              (o = i9(3.2404542 * (t = i4.Xn * ae(t)) - 1.5371385 * n - 0.4985314 * (r = i4.Zn * ae(r)))),
              [o, i9(-0.969266 * t + 1.8760108 * n + 0.041556 * r), i9(0.0556434 * t - 0.2040259 * n + 1.0572252 * r), e.length > 3 ? e[3] : 1]
            );
          },
          { pow: an } = Math,
          ar = e => ((e /= 255) <= 0.04045 ? e / 12.92 : an((e + 0.055) / 1.055, 2.4)),
          ao = e => (e > i4.t3 ? an(e, 1 / 3) : e / i4.t2 + i4.t0),
          ai = (e, t, n) => {
            e = ar(e);
            let r = ao((0.4124564 * e + 0.3575761 * (t = ar(t)) + 0.1804375 * (n = ar(n))) / i4.Xn);
            return [r, ao((0.2126729 * e + 0.7151522 * t + 0.072175 * n) / i4.Yn), ao((0.0193339 * e + 0.119192 * t + 0.9503041 * n) / i4.Zn)];
          },
          aa = (...e) => {
            let [t, n, r] = ig(e, "rgb"),
              [o, i, a] = ai(t, n, r),
              s = 116 * i - 16;
            return [s < 0 ? 0 : s, 500 * (o - i), 200 * (i - a)];
          };
        (iE.prototype.lab = function () {
          return aa(this._rgb);
        }),
          (iS.lab = (...e) => new iE(...e, "lab")),
          (ij.format.lab = at),
          ij.autodetect.push({
            p: 2,
            test: (...e) => {
              if ("array" === i_((e = ig(e, "lab"))) && 3 === e.length) return "lab";
            }
          });
        let { sin: as, cos: al } = Math,
          au = (...e) => {
            let [t, n, r] = ig(e, "lch");
            return isNaN(r) && (r = 0), [t, al((r *= ik)) * n, as(r) * n];
          },
          ac = (...e) => {
            let [t, n, r] = (e = ig(e, "lch")),
              [o, i, a] = au(t, n, r),
              [s, l, u] = at(o, i, a);
            return [s, l, u, e.length > 3 ? e[3] : 1];
          },
          { sqrt: ad, atan2: af, round: ah } = Math,
          ap = (...e) => {
            let [t, n, r] = ig(e, "lab"),
              o = ad(n * n + r * r),
              i = (af(r, n) * iM + 360) % 360;
            return 0 === ah(1e4 * o) && (i = Number.NaN), [t, o, i];
          },
          a_ = (...e) => {
            let [t, n, r] = ig(e, "rgb"),
              [o, i, a] = aa(t, n, r);
            return ap(o, i, a);
          };
        (iE.prototype.lch = function () {
          return a_(this._rgb);
        }),
          (iE.prototype.hcl = function () {
            return a_(this._rgb).reverse();
          }),
          (iS.lch = (...e) => new iE(...e, "lch")),
          (iS.hcl = (...e) => new iE(...e, "hcl")),
          (ij.format.lch = ac),
          (ij.format.hcl = (...e) => ac(...ig(e, "hcl").reverse())),
          ["lch", "hcl"].forEach(e =>
            ij.autodetect.push({
              p: 2,
              test: (...t) => {
                if ("array" === i_((t = ig(t, e))) && 3 === t.length) return e;
              }
            })
          );
        let ag = {
          aliceblue: "#f0f8ff",
          antiquewhite: "#faebd7",
          aqua: "#00ffff",
          aquamarine: "#7fffd4",
          azure: "#f0ffff",
          beige: "#f5f5dc",
          bisque: "#ffe4c4",
          black: "#000000",
          blanchedalmond: "#ffebcd",
          blue: "#0000ff",
          blueviolet: "#8a2be2",
          brown: "#a52a2a",
          burlywood: "#deb887",
          cadetblue: "#5f9ea0",
          chartreuse: "#7fff00",
          chocolate: "#d2691e",
          coral: "#ff7f50",
          cornflowerblue: "#6495ed",
          cornsilk: "#fff8dc",
          crimson: "#dc143c",
          cyan: "#00ffff",
          darkblue: "#00008b",
          darkcyan: "#008b8b",
          darkgoldenrod: "#b8860b",
          darkgray: "#a9a9a9",
          darkgreen: "#006400",
          darkgrey: "#a9a9a9",
          darkkhaki: "#bdb76b",
          darkmagenta: "#8b008b",
          darkolivegreen: "#556b2f",
          darkorange: "#ff8c00",
          darkorchid: "#9932cc",
          darkred: "#8b0000",
          darksalmon: "#e9967a",
          darkseagreen: "#8fbc8f",
          darkslateblue: "#483d8b",
          darkslategray: "#2f4f4f",
          darkslategrey: "#2f4f4f",
          darkturquoise: "#00ced1",
          darkviolet: "#9400d3",
          deeppink: "#ff1493",
          deepskyblue: "#00bfff",
          dimgray: "#696969",
          dimgrey: "#696969",
          dodgerblue: "#1e90ff",
          firebrick: "#b22222",
          floralwhite: "#fffaf0",
          forestgreen: "#228b22",
          fuchsia: "#ff00ff",
          gainsboro: "#dcdcdc",
          ghostwhite: "#f8f8ff",
          gold: "#ffd700",
          goldenrod: "#daa520",
          gray: "#808080",
          green: "#008000",
          greenyellow: "#adff2f",
          grey: "#808080",
          honeydew: "#f0fff0",
          hotpink: "#ff69b4",
          indianred: "#cd5c5c",
          indigo: "#4b0082",
          ivory: "#fffff0",
          khaki: "#f0e68c",
          laserlemon: "#ffff54",
          lavender: "#e6e6fa",
          lavenderblush: "#fff0f5",
          lawngreen: "#7cfc00",
          lemonchiffon: "#fffacd",
          lightblue: "#add8e6",
          lightcoral: "#f08080",
          lightcyan: "#e0ffff",
          lightgoldenrod: "#fafad2",
          lightgoldenrodyellow: "#fafad2",
          lightgray: "#d3d3d3",
          lightgreen: "#90ee90",
          lightgrey: "#d3d3d3",
          lightpink: "#ffb6c1",
          lightsalmon: "#ffa07a",
          lightseagreen: "#20b2aa",
          lightskyblue: "#87cefa",
          lightslategray: "#778899",
          lightslategrey: "#778899",
          lightsteelblue: "#b0c4de",
          lightyellow: "#ffffe0",
          lime: "#00ff00",
          limegreen: "#32cd32",
          linen: "#faf0e6",
          magenta: "#ff00ff",
          maroon: "#800000",
          maroon2: "#7f0000",
          maroon3: "#b03060",
          mediumaquamarine: "#66cdaa",
          mediumblue: "#0000cd",
          mediumorchid: "#ba55d3",
          mediumpurple: "#9370db",
          mediumseagreen: "#3cb371",
          mediumslateblue: "#7b68ee",
          mediumspringgreen: "#00fa9a",
          mediumturquoise: "#48d1cc",
          mediumvioletred: "#c71585",
          midnightblue: "#191970",
          mintcream: "#f5fffa",
          mistyrose: "#ffe4e1",
          moccasin: "#ffe4b5",
          navajowhite: "#ffdead",
          navy: "#000080",
          oldlace: "#fdf5e6",
          olive: "#808000",
          olivedrab: "#6b8e23",
          orange: "#ffa500",
          orangered: "#ff4500",
          orchid: "#da70d6",
          palegoldenrod: "#eee8aa",
          palegreen: "#98fb98",
          paleturquoise: "#afeeee",
          palevioletred: "#db7093",
          papayawhip: "#ffefd5",
          peachpuff: "#ffdab9",
          peru: "#cd853f",
          pink: "#ffc0cb",
          plum: "#dda0dd",
          powderblue: "#b0e0e6",
          purple: "#800080",
          purple2: "#7f007f",
          purple3: "#a020f0",
          rebeccapurple: "#663399",
          red: "#ff0000",
          rosybrown: "#bc8f8f",
          royalblue: "#4169e1",
          saddlebrown: "#8b4513",
          salmon: "#fa8072",
          sandybrown: "#f4a460",
          seagreen: "#2e8b57",
          seashell: "#fff5ee",
          sienna: "#a0522d",
          silver: "#c0c0c0",
          skyblue: "#87ceeb",
          slateblue: "#6a5acd",
          slategray: "#708090",
          slategrey: "#708090",
          snow: "#fffafa",
          springgreen: "#00ff7f",
          steelblue: "#4682b4",
          tan: "#d2b48c",
          teal: "#008080",
          thistle: "#d8bfd8",
          tomato: "#ff6347",
          turquoise: "#40e0d0",
          violet: "#ee82ee",
          wheat: "#f5deb3",
          white: "#ffffff",
          whitesmoke: "#f5f5f5",
          yellow: "#ffff00",
          yellowgreen: "#9acd32"
        };
        (iE.prototype.name = function () {
          let e = iJ(this._rgb, "rgb");
          for (let t of Object.keys(ag)) if (ag[t] === e) return t.toLowerCase();
          return e;
        }),
          (ij.format.named = e => {
            if (ag[(e = e.toLowerCase())]) return iV(ag[e]);
            throw Error("unknown color name: " + e);
          }),
          ij.autodetect.push({
            p: 5,
            test: (e, ...t) => {
              if (!t.length && "string" === i_(e) && ag[e.toLowerCase()]) return "named";
            }
          });
        let am = (...e) => {
          let [t, n, r] = ig(e, "rgb");
          return (t << 16) + (n << 8) + r;
        };
        (iE.prototype.num = function () {
          return am(this._rgb);
        }),
          (iS.num = (...e) => new iE(...e, "num")),
          (ij.format.num = e => {
            if ("number" == i_(e) && e >= 0 && e <= 0xffffff) return [e >> 16, (e >> 8) & 255, 255 & e, 1];
            throw Error("unknown num color: " + e);
          }),
          ij.autodetect.push({
            p: 5,
            test: (...e) => {
              if (1 === e.length && "number" === i_(e[0]) && e[0] >= 0 && e[0] <= 0xffffff) return "num";
            }
          });
        let { round: av } = Math;
        (iE.prototype.rgb = function (e = !0) {
          return !1 === e ? this._rgb.slice(0, 3) : this._rgb.slice(0, 3).map(av);
        }),
          (iE.prototype.rgba = function (e = !0) {
            return this._rgb.slice(0, 4).map((t, n) => (n < 3 ? (!1 === e ? t : av(t)) : t));
          }),
          (iS.rgb = (...e) => new iE(...e, "rgb")),
          (ij.format.rgb = (...e) => {
            let t = ig(e, "rgba");
            return void 0 === t[3] && (t[3] = 1), t;
          }),
          ij.autodetect.push({
            p: 3,
            test: (...e) => {
              if ("array" === i_((e = ig(e, "rgba"))) && (3 === e.length || (4 === e.length && "number" == i_(e[3]) && e[3] >= 0 && e[3] <= 1))) return "rgb";
            }
          });
        let { log: ay } = Math,
          ab = e => {
            let t, n, r;
            let o = e / 100;
            return (
              o < 66
                ? ((t = 255),
                  (n = o < 6 ? 0 : -155.25485562709179 - 0.44596950469579133 * (n = o - 2) + 104.49216199393888 * ay(n)),
                  (r = o < 20 ? 0 : -254.76935184120902 + 0.8274096064007395 * (r = o - 10) + 115.67994401066147 * ay(r)))
                : ((t = 351.97690566805693 + 0.114206453784165 * (t = o - 55) - 40.25366309332127 * ay(t)),
                  (n = 325.4494125711974 + 0.07943456536662342 * (n = o - 50) - 28.0852963507957 * ay(n)),
                  (r = 255)),
              [t, n, r, 1]
            );
          },
          { round: ax } = Math,
          aw = (...e) => {
            let t;
            let n = ig(e, "rgb"),
              r = n[0],
              o = n[2],
              i = 1e3,
              a = 4e4;
            for (; a - i > 0.4; ) {
              let e = ab((t = (a + i) * 0.5));
              e[2] / e[0] >= o / r ? (a = t) : (i = t);
            }
            return ax(t);
          };
        (iE.prototype.temp =
          iE.prototype.kelvin =
          iE.prototype.temperature =
            function () {
              return aw(this._rgb);
            }),
          (iS.temp = iS.kelvin = iS.temperature = (...e) => new iE(...e, "temp")),
          (ij.format.temp = ij.format.kelvin = ij.format.temperature = ab);
        let { pow: ak, sign: aM } = Math,
          aj = (...e) => {
            let [t, n, r] = (e = ig(e, "lab")),
              o = ak(t + 0.3963377774 * n + 0.2158037573 * r, 3),
              i = ak(t - 0.1055613458 * n - 0.0638541728 * r, 3),
              a = ak(t - 0.0894841775 * n - 1.291485548 * r, 3);
            return [
              255 * aE(4.0767416621 * o - 3.3077115913 * i + 0.2309699292 * a),
              255 * aE(-1.2684380046 * o + 2.6097574011 * i - 0.3413193965 * a),
              255 * aE(-0.0041960863 * o - 0.7034186147 * i + 1.707614701 * a),
              e.length > 3 ? e[3] : 1
            ];
          };
        function aE(e) {
          let t = Math.abs(e);
          return t > 0.0031308 ? (aM(e) || 1) * (1.055 * ak(t, 1 / 2.4) - 0.055) : 12.92 * e;
        }
        let { cbrt: aS, pow: aT, sign: aC } = Math,
          aP = (...e) => {
            let [t, n, r] = ig(e, "rgb"),
              [o, i, a] = [aN(t / 255), aN(n / 255), aN(r / 255)],
              s = aS(0.4122214708 * o + 0.5363325363 * i + 0.0514459929 * a),
              l = aS(0.2119034982 * o + 0.6806995451 * i + 0.1073969566 * a),
              u = aS(0.0883024619 * o + 0.2817188376 * i + 0.6299787005 * a);
            return [
              0.2104542553 * s + 0.793617785 * l - 0.0040720468 * u,
              1.9779984951 * s - 2.428592205 * l + 0.4505937099 * u,
              0.0259040371 * s + 0.7827717662 * l - 0.808675766 * u
            ];
          };
        function aN(e) {
          let t = Math.abs(e);
          return t < 0.04045 ? e / 12.92 : (aC(e) || 1) * aT((t + 0.055) / 1.055, 2.4);
        }
        (iE.prototype.oklab = function () {
          return aP(this._rgb);
        }),
          (iS.oklab = (...e) => new iE(...e, "oklab")),
          (ij.format.oklab = aj),
          ij.autodetect.push({
            p: 3,
            test: (...e) => {
              if ("array" === i_((e = ig(e, "oklab"))) && 3 === e.length) return "oklab";
            }
          });
        let aA = (...e) => {
          let [t, n, r] = ig(e, "rgb"),
            [o, i, a] = aP(t, n, r);
          return ap(o, i, a);
        };
        (iE.prototype.oklch = function () {
          return aA(this._rgb);
        }),
          (iS.oklch = (...e) => new iE(...e, "oklch")),
          (ij.format.oklch = (...e) => {
            let [t, n, r] = (e = ig(e, "lch")),
              [o, i, a] = au(t, n, r),
              [s, l, u] = aj(o, i, a);
            return [s, l, u, e.length > 3 ? e[3] : 1];
          }),
          ij.autodetect.push({
            p: 3,
            test: (...e) => {
              if ("array" === i_((e = ig(e, "oklch"))) && 3 === e.length) return "oklch";
            }
          }),
          (iE.prototype.alpha = function (e, t = !1) {
            return void 0 !== e && "number" === i_(e)
              ? t
                ? ((this._rgb[3] = e), this)
                : new iE([this._rgb[0], this._rgb[1], this._rgb[2], e], "rgb")
              : this._rgb[3];
          }),
          (iE.prototype.clipped = function () {
            return this._rgb._clipped || !1;
          }),
          (iE.prototype.darken = function (e = 1) {
            let t = this.lab();
            return (t[0] -= i4.Kn * e), new iE(t, "lab").alpha(this.alpha(), !0);
          }),
          (iE.prototype.brighten = function (e = 1) {
            return this.darken(-e);
          }),
          (iE.prototype.darker = iE.prototype.darken),
          (iE.prototype.brighter = iE.prototype.brighten),
          (iE.prototype.get = function (e) {
            let [t, n] = e.split("."),
              r = this[t]();
            if (!n) return r;
            {
              let e = t.indexOf(n) - 2 * ("ok" === t.substr(0, 2));
              if (e > -1) return r[e];
              throw Error(`unknown channel ${n} in mode ${t}`);
            }
          });
        let { pow: aO } = Math;
        iE.prototype.luminance = function (e, t = "rgb") {
          if (void 0 !== e && "number" === i_(e)) {
            if (0 === e) return new iE([0, 0, 0, this._rgb[3]], "rgb");
            if (1 === e) return new iE([255, 255, 255, this._rgb[3]], "rgb");
            let n = this.luminance(),
              r = 20,
              o = (n, i) => {
                let a = n.interpolate(i, 0.5, t),
                  s = a.luminance();
                return !(1e-7 > Math.abs(e - s)) && r-- ? (s > e ? o(n, a) : o(a, i)) : a;
              },
              i = (n > e ? o(new iE([0, 0, 0]), this) : o(this, new iE([255, 255, 255]))).rgb();
            return new iE([...i, this._rgb[3]]);
          }
          return a$(...this._rgb.slice(0, 3));
        };
        let a$ = (e, t, n) => ((e = aD(e)), 0.2126 * e + 0.7152 * (t = aD(t)) + 0.0722 * (n = aD(n))),
          aD = e => ((e /= 255) <= 0.03928 ? e / 12.92 : aO((e + 0.055) / 1.055, 2.4)),
          az = {},
          aR = (e, t, n = 0.5, ...r) => {
            let o = r[0] || "lrgb";
            if ((az[o] || r.length || (o = Object.keys(az)[0]), !az[o])) throw Error(`interpolation mode ${o} is not defined`);
            return "object" !== i_(e) && (e = new iE(e)), "object" !== i_(t) && (t = new iE(t)), az[o](e, t, n).alpha(e.alpha() + n * (t.alpha() - e.alpha()));
          };
        (iE.prototype.mix = iE.prototype.interpolate =
          function (e, t = 0.5, ...n) {
            return aR(this, e, t, ...n);
          }),
          (iE.prototype.premultiply = function (e = !1) {
            let t = this._rgb,
              n = t[3];
            return e ? ((this._rgb = [t[0] * n, t[1] * n, t[2] * n, n]), this) : new iE([t[0] * n, t[1] * n, t[2] * n, n], "rgb");
          }),
          (iE.prototype.saturate = function (e = 1) {
            let t = this.lch();
            return (t[1] += i4.Kn * e), t[1] < 0 && (t[1] = 0), new iE(t, "lch").alpha(this.alpha(), !0);
          }),
          (iE.prototype.desaturate = function (e = 1) {
            return this.saturate(-e);
          }),
          (iE.prototype.set = function (e, t, n = !1) {
            let [r, o] = e.split("."),
              i = this[r]();
            if (!o) return i;
            {
              let e = r.indexOf(o) - 2 * ("ok" === r.substr(0, 2));
              if (e > -1) {
                if ("string" == i_(t))
                  switch (t.charAt(0)) {
                    case "+":
                    case "-":
                      i[e] += +t;
                      break;
                    case "*":
                      i[e] *= +t.substr(1);
                      break;
                    case "/":
                      i[e] /= +t.substr(1);
                      break;
                    default:
                      i[e] = +t;
                  }
                else if ("number" === i_(t)) i[e] = t;
                else throw Error("unsupported value for Color.set");
                let o = new iE(i, r);
                return n ? ((this._rgb = o._rgb), this) : o;
              }
              throw Error(`unknown channel ${o} in mode ${r}`);
            }
          }),
          (iE.prototype.tint = function (e = 0.5, ...t) {
            return aR(this, "white", e, ...t);
          }),
          (iE.prototype.shade = function (e = 0.5, ...t) {
            return aR(this, "black", e, ...t);
          }),
          (az.rgb = (e, t, n) => {
            let r = e._rgb,
              o = t._rgb;
            return new iE(r[0] + n * (o[0] - r[0]), r[1] + n * (o[1] - r[1]), r[2] + n * (o[2] - r[2]), "rgb");
          });
        let { sqrt: aL, pow: aF } = Math;
        (az.lrgb = (e, t, n) => {
          let [r, o, i] = e._rgb,
            [a, s, l] = t._rgb;
          return new iE(aL(aF(r, 2) * (1 - n) + aF(a, 2) * n), aL(aF(o, 2) * (1 - n) + aF(s, 2) * n), aL(aF(i, 2) * (1 - n) + aF(l, 2) * n), "rgb");
        }),
          (az.lab = (e, t, n) => {
            let r = e.lab(),
              o = t.lab();
            return new iE(r[0] + n * (o[0] - r[0]), r[1] + n * (o[1] - r[1]), r[2] + n * (o[2] - r[2]), "lab");
          });
        let aI = (e, t, n, r) => {
            let o, i, a, s, l, u, c, d, f, h, p, _;
            return (
              "hsl" === r
                ? ((o = e.hsl()), (i = t.hsl()))
                : "hsv" === r
                  ? ((o = e.hsv()), (i = t.hsv()))
                  : "hcg" === r
                    ? ((o = e.hcg()), (i = t.hcg()))
                    : "hsi" === r
                      ? ((o = e.hsi()), (i = t.hsi()))
                      : "lch" === r || "hcl" === r
                        ? ((r = "hcl"), (o = e.hcl()), (i = t.hcl()))
                        : "oklch" === r && ((o = e.oklch().reverse()), (i = t.oklch().reverse())),
              ("h" === r.substr(0, 1) || "oklch" === r) && (([a, l, c] = o), ([s, u, d] = i)),
              isNaN(a) || isNaN(s)
                ? isNaN(a)
                  ? isNaN(s)
                    ? (h = Number.NaN)
                    : ((h = s), (1 == c || 0 == c) && "hsv" != r && (f = u))
                  : ((h = a), (1 == d || 0 == d) && "hsv" != r && (f = l))
                : ((_ = s > a && s - a > 180 ? s - (a + 360) : s < a && a - s > 180 ? s + 360 - a : s - a), (h = a + n * _)),
              void 0 === f && (f = l + n * (u - l)),
              (p = c + n * (d - c)),
              "oklch" === r ? new iE([p, f, h], r) : new iE([h, f, p], r)
            );
          },
          aB = (e, t, n) => aI(e, t, n, "lch");
        (az.lch = aB),
          (az.hcl = aB),
          (az.num = (e, t, n) => {
            let r = e.num();
            return new iE(r + n * (t.num() - r), "num");
          }),
          (az.hcg = (e, t, n) => aI(e, t, n, "hcg")),
          (az.hsi = (e, t, n) => aI(e, t, n, "hsi")),
          (az.hsl = (e, t, n) => aI(e, t, n, "hsl")),
          (az.hsv = (e, t, n) => aI(e, t, n, "hsv")),
          (az.oklab = (e, t, n) => {
            let r = e.oklab(),
              o = t.oklab();
            return new iE(r[0] + n * (o[0] - r[0]), r[1] + n * (o[1] - r[1]), r[2] + n * (o[2] - r[2]), "oklab");
          }),
          (az.oklch = (e, t, n) => aI(e, t, n, "oklch"));
        let { pow: aU, sqrt: aq, PI: aH, cos: aY, sin: aW, atan2: aZ } = Math,
          aX = (e, t) => {
            let n = e.length,
              r = [0, 0, 0, 0];
            for (let o = 0; o < e.length; o++) {
              let i = e[o],
                a = t[o] / n,
                s = i._rgb;
              (r[0] += aU(s[0], 2) * a), (r[1] += aU(s[1], 2) * a), (r[2] += aU(s[2], 2) * a), (r[3] += s[3] * a);
            }
            return (r[0] = aq(r[0])), (r[1] = aq(r[1])), (r[2] = aq(r[2])), r[3] > 0.9999999 && (r[3] = 1), new iE(ih(r));
          },
          { pow: aV } = Math;
        function aG(e) {
          let t = "rgb",
            n = iS("#ccc"),
            r = 0,
            o = [0, 1],
            i = [],
            a = [0, 0],
            s = !1,
            l = [],
            u = !1,
            c = 0,
            d = 1,
            f = !1,
            h = {},
            p = !0,
            _ = 1,
            g = function (e) {
              if (
                ("string" === i_((e = e || ["#fff", "#000"])) && iS.brewer && iS.brewer[e.toLowerCase()] && (e = iS.brewer[e.toLowerCase()]), "array" === i_(e))
              ) {
                1 === e.length && (e = [e[0], e[0]]), (e = e.slice(0));
                for (let t = 0; t < e.length; t++) e[t] = iS(e[t]);
                i.length = 0;
                for (let t = 0; t < e.length; t++) i.push(t / (e.length - 1));
              }
              return x(), (l = e);
            },
            m = function (e) {
              if (null != s) {
                let t = s.length - 1,
                  n = 0;
                for (; n < t && e >= s[n]; ) n++;
                return n - 1;
              }
              return 0;
            },
            v = e => e,
            y = e => e,
            b = function (e, r) {
              let o, u;
              if ((null == r && (r = !1), isNaN(e) || null === e)) return n;
              (u = r ? e : s && s.length > 2 ? m(e) / (s.length - 2) : d !== c ? (e - c) / (d - c) : 1), (u = y(u)), r || (u = v(u)), 1 !== _ && (u = aV(u, _));
              let f = Math.floor(1e4 * (u = id((u = a[0] + u * (1 - a[0] - a[1])), 0, 1)));
              if (p && h[f]) o = h[f];
              else {
                if ("array" === i_(l))
                  for (let e = 0; e < i.length; e++) {
                    let n = i[e];
                    if (u <= n || (u >= n && e === i.length - 1)) {
                      o = l[e];
                      break;
                    }
                    if (u > n && u < i[e + 1]) {
                      (u = (u - n) / (i[e + 1] - n)), (o = iS.interpolate(l[e], l[e + 1], u, t));
                      break;
                    }
                  }
                else "function" === i_(l) && (o = l(u));
                p && (h[f] = o);
              }
              return o;
            };
          var x = () => (h = {});
          g(e);
          let w = function (e) {
            let t = iS(b(e));
            return u && t[u] ? t[u]() : t;
          };
          return (
            (w.classes = function (e) {
              if (null != e) {
                if ("array" === i_(e)) (s = e), (o = [e[0], e[e.length - 1]]);
                else {
                  let t = iS.analyze(o);
                  s = 0 === e ? [t.min, t.max] : iS.limits(t, "e", e);
                }
                return w;
              }
              return s;
            }),
            (w.domain = function (e) {
              if (!arguments.length) return o;
              (c = e[0]), (d = e[e.length - 1]), (i = []);
              let t = l.length;
              if (e.length === t && c !== d) for (let t of Array.from(e)) i.push((t - c) / (d - c));
              else {
                for (let e = 0; e < t; e++) i.push(e / (t - 1));
                if (e.length > 2) {
                  let t = e.map((t, n) => n / (e.length - 1)),
                    n = e.map(e => (e - c) / (d - c));
                  n.every((e, n) => t[n] === e) ||
                    (y = e => {
                      if (e <= 0 || e >= 1) return e;
                      let r = 0;
                      for (; e >= n[r + 1]; ) r++;
                      let o = (e - n[r]) / (n[r + 1] - n[r]);
                      return t[r] + o * (t[r + 1] - t[r]);
                    });
                }
              }
              return (o = [c, d]), w;
            }),
            (w.mode = function (e) {
              return arguments.length ? ((t = e), x(), w) : t;
            }),
            (w.range = function (e, t) {
              return g(e, t), w;
            }),
            (w.out = function (e) {
              return (u = e), w;
            }),
            (w.spread = function (e) {
              return arguments.length ? ((r = e), w) : r;
            }),
            (w.correctLightness = function (e) {
              return (
                null == e && (e = !0),
                (f = e),
                x(),
                (v = f
                  ? function (e) {
                      let t = b(0, !0).lab()[0],
                        n = b(1, !0).lab()[0],
                        r = t > n,
                        o = b(e, !0).lab()[0],
                        i = t + (n - t) * e,
                        a = o - i,
                        s = 0,
                        l = 1,
                        u = 20;
                      for (; Math.abs(a) > 0.01 && u-- > 0; )
                        r && (a *= -1), a < 0 ? ((s = e), (e += (l - e) * 0.5)) : ((l = e), (e += (s - e) * 0.5)), (a = (o = b(e, !0).lab()[0]) - i);
                      return e;
                    }
                  : e => e),
                w
              );
            }),
            (w.padding = function (e) {
              return null != e ? ("number" === i_(e) && (e = [e, e]), (a = e), w) : a;
            }),
            (w.colors = function (t, n) {
              arguments.length < 2 && (n = "hex");
              let r = [];
              if (0 == arguments.length) r = l.slice(0);
              else if (1 === t) r = [w(0.5)];
              else if (t > 1) {
                let e = o[0],
                  n = o[1] - e;
                r = (function (e, t, n) {
                  let r = [],
                    o = 0 < t,
                    i = n ? (o ? t + 1 : t - 1) : t;
                  for (let t = e; o ? t < i : t > i; o ? t++ : t--) r.push(t);
                  return r;
                })(0, t, !1).map(r => w(e + (r / (t - 1)) * n));
              } else {
                e = [];
                let t = [];
                if (s && s.length > 2) for (let e = 1, n = s.length, r = 1 <= n; r ? e < n : e > n; r ? e++ : e--) t.push((s[e - 1] + s[e]) * 0.5);
                else t = o;
                r = t.map(e => w(e));
              }
              return iS[n] && (r = r.map(e => e[n]())), r;
            }),
            (w.cache = function (e) {
              return null != e ? ((p = e), w) : p;
            }),
            (w.gamma = function (e) {
              return null != e ? ((_ = e), w) : _;
            }),
            (w.nodata = function (e) {
              return null != e ? ((n = iS(e)), w) : n;
            }),
            w
          );
        }
        let aJ = function (e) {
            let t = [1, 1];
            for (let n = 1; n < e; n++) {
              let e = [1];
              for (let n = 1; n <= t.length; n++) e[n] = (t[n] || 0) + t[n - 1];
              t = e;
            }
            return t;
          },
          aK = function (e) {
            let t, n, r, o;
            if (2 === (e = e.map(e => new iE(e))).length)
              ([n, r] = e.map(e => e.lab())),
                (t = function (e) {
                  return new iE(
                    [0, 1, 2].map(t => n[t] + e * (r[t] - n[t])),
                    "lab"
                  );
                });
            else if (3 === e.length)
              ([n, r, o] = e.map(e => e.lab())),
                (t = function (e) {
                  return new iE(
                    [0, 1, 2].map(t => (1 - e) * (1 - e) * n[t] + 2 * (1 - e) * e * r[t] + e * e * o[t]),
                    "lab"
                  );
                });
            else if (4 === e.length) {
              let i;
              ([n, r, o, i] = e.map(e => e.lab())),
                (t = function (e) {
                  return new iE(
                    [0, 1, 2].map(t => (1 - e) * (1 - e) * (1 - e) * n[t] + 3 * (1 - e) * (1 - e) * e * r[t] + 3 * (1 - e) * e * e * o[t] + e * e * e * i[t]),
                    "lab"
                  );
                });
            } else if (e.length >= 5) {
              let n, r, o;
              (n = e.map(e => e.lab())),
                (r = aJ((o = e.length - 1))),
                (t = function (e) {
                  let t = 1 - e;
                  return new iE(
                    [0, 1, 2].map(i => n.reduce((n, a, s) => n + r[s] * t ** (o - s) * e ** s * a[i], 0)),
                    "lab"
                  );
                });
            } else throw RangeError("No point in running bezier with only one color.");
            return t;
          },
          aQ = (e, t, n) => {
            if (!aQ[n]) throw Error("unknown blend mode " + n);
            return aQ[n](e, t);
          },
          a0 = e => (t, n) => {
            let r = iS(n).rgb(),
              o = iS(t).rgb();
            return iS.rgb(e(r, o));
          },
          a1 = e => (t, n) => {
            let r = [];
            return (r[0] = e(t[0], n[0])), (r[1] = e(t[1], n[1])), (r[2] = e(t[2], n[2])), r;
          };
        (aQ.normal = a0(a1(e => e))),
          (aQ.multiply = a0(a1((e, t) => (e * t) / 255))),
          (aQ.screen = a0(a1((e, t) => 255 * (1 - (1 - e / 255) * (1 - t / 255))))),
          (aQ.overlay = a0(a1((e, t) => (t < 128 ? (2 * e * t) / 255 : 255 * (1 - 2 * (1 - e / 255) * (1 - t / 255)))))),
          (aQ.darken = a0(a1((e, t) => (e > t ? t : e)))),
          (aQ.lighten = a0(a1((e, t) => (e > t ? e : t)))),
          (aQ.dodge = a0(a1((e, t) => (255 === e ? 255 : (e = ((t / 255) * 255) / (1 - e / 255)) > 255 ? 255 : e)))),
          (aQ.burn = a0(a1((e, t) => 255 * (1 - (1 - t / 255) / (e / 255)))));
        let { pow: a2, sin: a3, cos: a5 } = Math,
          { floor: a8, random: a6 } = Math,
          { log: a4, pow: a7, floor: a9, abs: se } = Math;
        function st(e, t = null) {
          let n = { min: Number.MAX_VALUE, max: -1 * Number.MAX_VALUE, sum: 0, values: [], count: 0 };
          return (
            "object" === i_(e) && (e = Object.values(e)),
            e.forEach(e => {
              t && "object" === i_(e) && (e = e[t]),
                null == e || isNaN(e) || (n.values.push(e), (n.sum += e), e < n.min && (n.min = e), e > n.max && (n.max = e), (n.count += 1));
            }),
            (n.domain = [n.min, n.max]),
            (n.limits = (e, t) => sn(n, e, t)),
            n
          );
        }
        function sn(e, t = "equal", n = 7) {
          "array" == i_(e) && (e = st(e));
          let { min: r, max: o } = e,
            i = e.values.sort((e, t) => e - t);
          if (1 === n) return [r, o];
          let a = [];
          if (("c" === t.substr(0, 1) && (a.push(r), a.push(o)), "e" === t.substr(0, 1))) {
            a.push(r);
            for (let e = 1; e < n; e++) a.push(r + (e / n) * (o - r));
            a.push(o);
          } else if ("l" === t.substr(0, 1)) {
            if (r <= 0) throw Error("Logarithmic scales are only possible for values > 0");
            let e = Math.LOG10E * a4(r),
              t = Math.LOG10E * a4(o);
            a.push(r);
            for (let r = 1; r < n; r++) a.push(a7(10, e + (r / n) * (t - e)));
            a.push(o);
          } else if ("q" === t.substr(0, 1)) {
            a.push(r);
            for (let e = 1; e < n; e++) {
              let t = ((i.length - 1) * e) / n,
                r = a9(t);
              if (r === t) a.push(i[r]);
              else {
                let e = t - r;
                a.push(i[r] * (1 - e) + i[r + 1] * e);
              }
            }
            a.push(o);
          } else if ("k" === t.substr(0, 1)) {
            let e;
            let t = i.length,
              s = Array(t),
              l = Array(n),
              u = !0,
              c = 0,
              d = null;
            (d = []).push(r);
            for (let e = 1; e < n; e++) d.push(r + (e / n) * (o - r));
            for (d.push(o); u; ) {
              for (let e = 0; e < n; e++) l[e] = 0;
              for (let e = 0; e < t; e++) {
                let t;
                let r = i[e],
                  o = Number.MAX_VALUE;
                for (let i = 0; i < n; i++) {
                  let n = se(d[i] - r);
                  n < o && ((o = n), (t = i)), l[t]++, (s[e] = t);
                }
              }
              let r = Array(n);
              for (let e = 0; e < n; e++) r[e] = null;
              for (let n = 0; n < t; n++) null === r[(e = s[n])] ? (r[e] = i[n]) : (r[e] += i[n]);
              for (let e = 0; e < n; e++) r[e] *= 1 / l[e];
              u = !1;
              for (let e = 0; e < n; e++)
                if (r[e] !== d[e]) {
                  u = !0;
                  break;
                }
              (d = r), ++c > 200 && (u = !1);
            }
            let f = {};
            for (let e = 0; e < n; e++) f[e] = [];
            for (let n = 0; n < t; n++) f[(e = s[n])].push(i[n]);
            let h = [];
            for (let e = 0; e < n; e++) h.push(f[e][0]), h.push(f[e][f[e].length - 1]);
            (h = h.sort((e, t) => e - t)), a.push(h[0]);
            for (let e = 1; e < h.length; e += 2) {
              let t = h[e];
              isNaN(t) || -1 !== a.indexOf(t) || a.push(t);
            }
          }
          return a;
        }
        let { sqrt: sr, pow: so, min: si, max: sa, atan2: ss, abs: sl, cos: su, sin: sc, exp: sd, PI: sf } = Math,
          sh = {
            OrRd: ["#fff7ec", "#fee8c8", "#fdd49e", "#fdbb84", "#fc8d59", "#ef6548", "#d7301f", "#b30000", "#7f0000"],
            PuBu: ["#fff7fb", "#ece7f2", "#d0d1e6", "#a6bddb", "#74a9cf", "#3690c0", "#0570b0", "#045a8d", "#023858"],
            BuPu: ["#f7fcfd", "#e0ecf4", "#bfd3e6", "#9ebcda", "#8c96c6", "#8c6bb1", "#88419d", "#810f7c", "#4d004b"],
            Oranges: ["#fff5eb", "#fee6ce", "#fdd0a2", "#fdae6b", "#fd8d3c", "#f16913", "#d94801", "#a63603", "#7f2704"],
            BuGn: ["#f7fcfd", "#e5f5f9", "#ccece6", "#99d8c9", "#66c2a4", "#41ae76", "#238b45", "#006d2c", "#00441b"],
            YlOrBr: ["#ffffe5", "#fff7bc", "#fee391", "#fec44f", "#fe9929", "#ec7014", "#cc4c02", "#993404", "#662506"],
            YlGn: ["#ffffe5", "#f7fcb9", "#d9f0a3", "#addd8e", "#78c679", "#41ab5d", "#238443", "#006837", "#004529"],
            Reds: ["#fff5f0", "#fee0d2", "#fcbba1", "#fc9272", "#fb6a4a", "#ef3b2c", "#cb181d", "#a50f15", "#67000d"],
            RdPu: ["#fff7f3", "#fde0dd", "#fcc5c0", "#fa9fb5", "#f768a1", "#dd3497", "#ae017e", "#7a0177", "#49006a"],
            Greens: ["#f7fcf5", "#e5f5e0", "#c7e9c0", "#a1d99b", "#74c476", "#41ab5d", "#238b45", "#006d2c", "#00441b"],
            YlGnBu: ["#ffffd9", "#edf8b1", "#c7e9b4", "#7fcdbb", "#41b6c4", "#1d91c0", "#225ea8", "#253494", "#081d58"],
            Purples: ["#fcfbfd", "#efedf5", "#dadaeb", "#bcbddc", "#9e9ac8", "#807dba", "#6a51a3", "#54278f", "#3f007d"],
            GnBu: ["#f7fcf0", "#e0f3db", "#ccebc5", "#a8ddb5", "#7bccc4", "#4eb3d3", "#2b8cbe", "#0868ac", "#084081"],
            Greys: ["#ffffff", "#f0f0f0", "#d9d9d9", "#bdbdbd", "#969696", "#737373", "#525252", "#252525", "#000000"],
            YlOrRd: ["#ffffcc", "#ffeda0", "#fed976", "#feb24c", "#fd8d3c", "#fc4e2a", "#e31a1c", "#bd0026", "#800026"],
            PuRd: ["#f7f4f9", "#e7e1ef", "#d4b9da", "#c994c7", "#df65b0", "#e7298a", "#ce1256", "#980043", "#67001f"],
            Blues: ["#f7fbff", "#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#08519c", "#08306b"],
            PuBuGn: ["#fff7fb", "#ece2f0", "#d0d1e6", "#a6bddb", "#67a9cf", "#3690c0", "#02818a", "#016c59", "#014636"],
            Viridis: ["#440154", "#482777", "#3f4a8a", "#31678e", "#26838f", "#1f9d8a", "#6cce5a", "#b6de2b", "#fee825"],
            Spectral: ["#9e0142", "#d53e4f", "#f46d43", "#fdae61", "#fee08b", "#ffffbf", "#e6f598", "#abdda4", "#66c2a5", "#3288bd", "#5e4fa2"],
            RdYlGn: ["#a50026", "#d73027", "#f46d43", "#fdae61", "#fee08b", "#ffffbf", "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850", "#006837"],
            RdBu: ["#67001f", "#b2182b", "#d6604d", "#f4a582", "#fddbc7", "#f7f7f7", "#d1e5f0", "#92c5de", "#4393c3", "#2166ac", "#053061"],
            PiYG: ["#8e0152", "#c51b7d", "#de77ae", "#f1b6da", "#fde0ef", "#f7f7f7", "#e6f5d0", "#b8e186", "#7fbc41", "#4d9221", "#276419"],
            PRGn: ["#40004b", "#762a83", "#9970ab", "#c2a5cf", "#e7d4e8", "#f7f7f7", "#d9f0d3", "#a6dba0", "#5aae61", "#1b7837", "#00441b"],
            RdYlBu: ["#a50026", "#d73027", "#f46d43", "#fdae61", "#fee090", "#ffffbf", "#e0f3f8", "#abd9e9", "#74add1", "#4575b4", "#313695"],
            BrBG: ["#543005", "#8c510a", "#bf812d", "#dfc27d", "#f6e8c3", "#f5f5f5", "#c7eae5", "#80cdc1", "#35978f", "#01665e", "#003c30"],
            RdGy: ["#67001f", "#b2182b", "#d6604d", "#f4a582", "#fddbc7", "#ffffff", "#e0e0e0", "#bababa", "#878787", "#4d4d4d", "#1a1a1a"],
            PuOr: ["#7f3b08", "#b35806", "#e08214", "#fdb863", "#fee0b6", "#f7f7f7", "#d8daeb", "#b2abd2", "#8073ac", "#542788", "#2d004b"],
            Set2: ["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3", "#a6d854", "#ffd92f", "#e5c494", "#b3b3b3"],
            Accent: ["#7fc97f", "#beaed4", "#fdc086", "#ffff99", "#386cb0", "#f0027f", "#bf5b17", "#666666"],
            Set1: ["#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00", "#ffff33", "#a65628", "#f781bf", "#999999"],
            Set3: ["#8dd3c7", "#ffffb3", "#bebada", "#fb8072", "#80b1d3", "#fdb462", "#b3de69", "#fccde5", "#d9d9d9", "#bc80bd", "#ccebc5", "#ffed6f"],
            Dark2: ["#1b9e77", "#d95f02", "#7570b3", "#e7298a", "#66a61e", "#e6ab02", "#a6761d", "#666666"],
            Paired: ["#a6cee3", "#1f78b4", "#b2df8a", "#33a02c", "#fb9a99", "#e31a1c", "#fdbf6f", "#ff7f00", "#cab2d6", "#6a3d9a", "#ffff99", "#b15928"],
            Pastel2: ["#b3e2cd", "#fdcdac", "#cbd5e8", "#f4cae4", "#e6f5c9", "#fff2ae", "#f1e2cc", "#cccccc"],
            Pastel1: ["#fbb4ae", "#b3cde3", "#ccebc5", "#decbe4", "#fed9a6", "#ffffcc", "#e5d8bd", "#fddaec", "#f2f2f2"]
          };
        for (let e of Object.keys(sh)) sh[e.toLowerCase()] = sh[e];
        Object.assign(iS, {
          average: (e, t = "lrgb", n = null) => {
            let r = e.length;
            n || (n = Array.from(Array(r)).map(() => 1));
            let o =
              r /
              n.reduce(function (e, t) {
                return e + t;
              });
            if (
              (n.forEach((e, t) => {
                n[t] *= o;
              }),
              (e = e.map(e => new iE(e))),
              "lrgb" === t)
            )
              return aX(e, n);
            let i = e.shift(),
              a = i.get(t),
              s = [],
              l = 0,
              u = 0;
            for (let e = 0; e < a.length; e++)
              if (((a[e] = (a[e] || 0) * n[0]), s.push(isNaN(a[e]) ? 0 : n[0]), "h" === t.charAt(e) && !isNaN(a[e]))) {
                let t = (a[e] / 180) * aH;
                (l += aY(t) * n[0]), (u += aW(t) * n[0]);
              }
            let c = i.alpha() * n[0];
            e.forEach((e, r) => {
              let o = e.get(t);
              c += e.alpha() * n[r + 1];
              for (let e = 0; e < a.length; e++)
                if (!isNaN(o[e])) {
                  if (((s[e] += n[r + 1]), "h" === t.charAt(e))) {
                    let t = (o[e] / 180) * aH;
                    (l += aY(t) * n[r + 1]), (u += aW(t) * n[r + 1]);
                  } else a[e] += o[e] * n[r + 1];
                }
            });
            for (let e = 0; e < a.length; e++)
              if ("h" === t.charAt(e)) {
                let t = (aZ(u / s[e], l / s[e]) / aH) * 180;
                for (; t < 0; ) t += 360;
                for (; t >= 360; ) t -= 360;
                a[e] = t;
              } else a[e] = a[e] / s[e];
            return (c /= r), new iE(a, t).alpha(c > 0.99999 ? 1 : c, !0);
          },
          bezier: e => {
            let t = aK(e);
            return (t.scale = () => aG(t)), t;
          },
          blend: aQ,
          cubehelix: function (e = 300, t = -1.5, n = 1, r = 1, o = [0, 1]) {
            let i = 0,
              a;
            "array" === i_(o) ? (a = o[1] - o[0]) : ((a = 0), (o = [o, o]));
            let s = function (s) {
              let l = ix * ((e + 120) / 360 + t * s),
                u = a2(o[0] + a * s, r),
                c = ((0 !== i ? n[0] + s * i : n) * u * (1 - u)) / 2,
                d = a5(l),
                f = a3(l);
              return iS(ih([255 * (u + c * (-0.14861 * d + 1.78277 * f)), 255 * (u + c * (-0.29227 * d - 0.90649 * f)), 255 * (u + 1.97294 * d * c), 1]));
            };
            return (
              (s.start = function (t) {
                return null == t ? e : ((e = t), s);
              }),
              (s.rotations = function (e) {
                return null == e ? t : ((t = e), s);
              }),
              (s.gamma = function (e) {
                return null == e ? r : ((r = e), s);
              }),
              (s.hue = function (e) {
                return null == e ? n : ("array" === i_((n = e)) ? 0 == (i = n[1] - n[0]) && (n = n[1]) : (i = 0), s);
              }),
              (s.lightness = function (e) {
                return null == e ? o : ("array" === i_(e) ? ((o = e), (a = e[1] - e[0])) : ((o = [e, e]), (a = 0)), s);
              }),
              (s.scale = () => iS.scale(s)),
              s.hue(n),
              s
            );
          },
          mix: aR,
          interpolate: aR,
          random: () => {
            let e = "#";
            for (let t = 0; t < 6; t++) e += "0123456789abcdef".charAt(a8(16 * a6()));
            return new iE(e, "hex");
          },
          scale: aG,
          analyze: st,
          contrast: (e, t) => {
            (e = new iE(e)), (t = new iE(t));
            let n = e.luminance(),
              r = t.luminance();
            return n > r ? (n + 0.05) / (r + 0.05) : (r + 0.05) / (n + 0.05);
          },
          deltaE: function (e, t, n = 1, r = 1, o = 1) {
            var i = function (e) {
                return (360 * e) / (2 * sf);
              },
              a = function (e) {
                return (2 * sf * e) / 360;
              };
            (e = new iE(e)), (t = new iE(t));
            let [s, l, u] = Array.from(e.lab()),
              [c, d, f] = Array.from(t.lab()),
              h = (s + c) / 2,
              p = (sr(so(l, 2) + so(u, 2)) + sr(so(d, 2) + so(f, 2))) / 2,
              _ = 0.5 * (1 - sr(so(p, 7) / (so(p, 7) + so(25, 7)))),
              g = l * (1 + _),
              m = d * (1 + _),
              v = sr(so(g, 2) + so(u, 2)),
              y = sr(so(m, 2) + so(f, 2)),
              b = (v + y) / 2,
              x = i(ss(u, g)),
              w = i(ss(f, m)),
              k = x >= 0 ? x : x + 360,
              M = w >= 0 ? w : w + 360,
              j = sl(k - M) > 180 ? (k + M + 360) / 2 : (k + M) / 2,
              E = 1 - 0.17 * su(a(j - 30)) + 0.24 * su(a(2 * j)) + 0.32 * su(a(3 * j + 6)) - 0.2 * su(a(4 * j - 63)),
              S = M - k;
            (S = 180 >= sl(S) ? S : M <= k ? S + 360 : S - 360), (S = 2 * sr(v * y) * sc(a(S) / 2));
            let T = y - v,
              C = 1 + (0.015 * so(h - 50, 2)) / sr(20 + so(h - 50, 2)),
              P = 1 + 0.045 * b,
              N = 1 + 0.015 * b * E,
              A = 30 * sd(-so((j - 275) / 25, 2)),
              O = -(2 * sr(so(b, 7) / (so(b, 7) + so(25, 7)))) * sc(2 * a(A));
            return sa(0, si(100, sr(so((c - s) / (n * C), 2) + so(T / (r * P), 2) + so(S / (o * N), 2) + (T / (r * P)) * O * (S / (o * N)))));
          },
          distance: function (e, t, n = "lab") {
            (e = new iE(e)), (t = new iE(t));
            let r = e.get(n),
              o = t.get(n),
              i = 0;
            for (let e in r) {
              let t = (r[e] || 0) - (o[e] || 0);
              i += t * t;
            }
            return Math.sqrt(i);
          },
          limits: sn,
          valid: (...e) => {
            try {
              return new iE(...e), !0;
            } catch (e) {
              return !1;
            }
          },
          scales: {
            cool: () => aG([iS.hsl(180, 1, 0.9), iS.hsl(250, 0.7, 0.4)]),
            hot: () => aG(["#000", "#f00", "#ff0", "#fff"], [0, 0.25, 0.75, 1]).mode("rgb")
          },
          input: ij,
          colors: ag,
          brewer: sh
        });
        var sp = n(19928),
          s_ = n(74616),
          sg = (n(91207), n(95300));
        function sm(e, t) {
          if (t.length < e) throw TypeError(e + " argument" + (e > 1 ? "s" : "") + " required, but only " + t.length + " present");
        }
        function sv(e) {
          sm(1, arguments);
          var t = Object.prototype.toString.call(e);
          return e instanceof Date || ("object" === (0, sg.Z)(e) && "[object Date]" === t)
            ? new Date(e.getTime())
            : "number" == typeof e || "[object Number]" === t
              ? new Date(e)
              : (("string" == typeof e || "[object String]" === t) &&
                  "undefined" != typeof console &&
                  (console.warn(
                    "Starting with v2.0.0-beta.1 date-fns doesn't accept strings as date arguments. Please use `parseISO` to parse strings. See: https://github.com/date-fns/date-fns/blob/master/docs/upgradeGuide.md#string-arguments"
                  ),
                  console.warn(Error().stack)),
                new Date(NaN));
        }
        var sy = {
          ceil: Math.ceil,
          round: Math.round,
          floor: Math.floor,
          trunc: function (e) {
            return e < 0 ? Math.ceil(e) : Math.floor(e);
          }
        };
        function sb(e, t, n) {
          sm(2, arguments);
          var r,
            o =
              (function (e, t) {
                return sm(2, arguments), sv(e).getTime() - sv(t).getTime();
              })(e, t) / 1e3;
          return ((r = null == n ? void 0 : n.roundingMethod) ? sy[r] : sy.trunc)(o);
        }
        var sx = {};
        function sw(e, t) {
          sm(2, arguments);
          var n = sv(e),
            r = sv(t),
            o = n.getTime() - r.getTime();
          return o < 0 ? -1 : o > 0 ? 1 : o;
        }
        var sk = {
          lessThanXSeconds: { one: "less than a second", other: "less than {{count}} seconds" },
          xSeconds: { one: "1 second", other: "{{count}} seconds" },
          halfAMinute: "half a minute",
          lessThanXMinutes: { one: "less than a minute", other: "less than {{count}} minutes" },
          xMinutes: { one: "1 minute", other: "{{count}} minutes" },
          aboutXHours: { one: "about 1 hour", other: "about {{count}} hours" },
          xHours: { one: "1 hour", other: "{{count}} hours" },
          xDays: { one: "1 day", other: "{{count}} days" },
          aboutXWeeks: { one: "about 1 week", other: "about {{count}} weeks" },
          xWeeks: { one: "1 week", other: "{{count}} weeks" },
          aboutXMonths: { one: "about 1 month", other: "about {{count}} months" },
          xMonths: { one: "1 month", other: "{{count}} months" },
          aboutXYears: { one: "about 1 year", other: "about {{count}} years" },
          xYears: { one: "1 year", other: "{{count}} years" },
          overXYears: { one: "over 1 year", other: "over {{count}} years" },
          almostXYears: { one: "almost 1 year", other: "almost {{count}} years" }
        };
        function sM(e) {
          return function () {
            var t = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {},
              n = t.width ? String(t.width) : e.defaultWidth;
            return e.formats[n] || e.formats[e.defaultWidth];
          };
        }
        var sj = {
            date: sM({ formats: { full: "EEEE, MMMM do, y", long: "MMMM do, y", medium: "MMM d, y", short: "MM/dd/yyyy" }, defaultWidth: "full" }),
            time: sM({ formats: { full: "h:mm:ss a zzzz", long: "h:mm:ss a z", medium: "h:mm:ss a", short: "h:mm a" }, defaultWidth: "full" }),
            dateTime: sM({
              formats: { full: "{{date}} 'at' {{time}}", long: "{{date}} 'at' {{time}}", medium: "{{date}}, {{time}}", short: "{{date}}, {{time}}" },
              defaultWidth: "full"
            })
          },
          sE = {
            lastWeek: "'last' eeee 'at' p",
            yesterday: "'yesterday at' p",
            today: "'today at' p",
            tomorrow: "'tomorrow at' p",
            nextWeek: "eeee 'at' p",
            other: "P"
          };
        function sS(e) {
          return function (t, n) {
            var r;
            if ("formatting" === (null != n && n.context ? String(n.context) : "standalone") && e.formattingValues) {
              var o = e.defaultFormattingWidth || e.defaultWidth,
                i = null != n && n.width ? String(n.width) : o;
              r = e.formattingValues[i] || e.formattingValues[o];
            } else {
              var a = e.defaultWidth,
                s = null != n && n.width ? String(n.width) : e.defaultWidth;
              r = e.values[s] || e.values[a];
            }
            return r[e.argumentCallback ? e.argumentCallback(t) : t];
          };
        }
        function sT(e) {
          return function (t) {
            var n,
              r = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {},
              o = r.width,
              i = (o && e.matchPatterns[o]) || e.matchPatterns[e.defaultMatchWidth],
              a = t.match(i);
            if (!a) return null;
            var s = a[0],
              l = (o && e.parsePatterns[o]) || e.parsePatterns[e.defaultParseWidth],
              u = Array.isArray(l)
                ? (function (e, t) {
                    for (var n = 0; n < e.length; n++) if (t(e[n])) return n;
                  })(l, function (e) {
                    return e.test(s);
                  })
                : (function (e, t) {
                    for (var n in e) if (e.hasOwnProperty(n) && t(e[n])) return n;
                  })(l, function (e) {
                    return e.test(s);
                  });
            return (n = e.valueCallback ? e.valueCallback(u) : u), { value: (n = r.valueCallback ? r.valueCallback(n) : n), rest: t.slice(s.length) };
          };
        }
        let sC = {
          code: "en-US",
          formatDistance: function (e, t, n) {
            var r,
              o = sk[e];
            return ((r = "string" == typeof o ? o : 1 === t ? o.one : o.other.replace("{{count}}", t.toString())), null != n && n.addSuffix)
              ? n.comparison && n.comparison > 0
                ? "in " + r
                : r + " ago"
              : r;
          },
          formatLong: sj,
          formatRelative: function (e, t, n, r) {
            return sE[e];
          },
          localize: {
            ordinalNumber: function (e, t) {
              var n = Number(e),
                r = n % 100;
              if (r > 20 || r < 10)
                switch (r % 10) {
                  case 1:
                    return n + "st";
                  case 2:
                    return n + "nd";
                  case 3:
                    return n + "rd";
                }
              return n + "th";
            },
            era: sS({ values: { narrow: ["B", "A"], abbreviated: ["BC", "AD"], wide: ["Before Christ", "Anno Domini"] }, defaultWidth: "wide" }),
            quarter: sS({
              values: {
                narrow: ["1", "2", "3", "4"],
                abbreviated: ["Q1", "Q2", "Q3", "Q4"],
                wide: ["1st quarter", "2nd quarter", "3rd quarter", "4th quarter"]
              },
              defaultWidth: "wide",
              argumentCallback: function (e) {
                return e - 1;
              }
            }),
            month: sS({
              values: {
                narrow: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"],
                abbreviated: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
                wide: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
              },
              defaultWidth: "wide"
            }),
            day: sS({
              values: {
                narrow: ["S", "M", "T", "W", "T", "F", "S"],
                short: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
                abbreviated: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
                wide: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
              },
              defaultWidth: "wide"
            }),
            dayPeriod: sS({
              values: {
                narrow: { am: "a", pm: "p", midnight: "mi", noon: "n", morning: "morning", afternoon: "afternoon", evening: "evening", night: "night" },
                abbreviated: {
                  am: "AM",
                  pm: "PM",
                  midnight: "midnight",
                  noon: "noon",
                  morning: "morning",
                  afternoon: "afternoon",
                  evening: "evening",
                  night: "night"
                },
                wide: {
                  am: "a.m.",
                  pm: "p.m.",
                  midnight: "midnight",
                  noon: "noon",
                  morning: "morning",
                  afternoon: "afternoon",
                  evening: "evening",
                  night: "night"
                }
              },
              defaultWidth: "wide",
              formattingValues: {
                narrow: {
                  am: "a",
                  pm: "p",
                  midnight: "mi",
                  noon: "n",
                  morning: "in the morning",
                  afternoon: "in the afternoon",
                  evening: "in the evening",
                  night: "at night"
                },
                abbreviated: {
                  am: "AM",
                  pm: "PM",
                  midnight: "midnight",
                  noon: "noon",
                  morning: "in the morning",
                  afternoon: "in the afternoon",
                  evening: "in the evening",
                  night: "at night"
                },
                wide: {
                  am: "a.m.",
                  pm: "p.m.",
                  midnight: "midnight",
                  noon: "noon",
                  morning: "in the morning",
                  afternoon: "in the afternoon",
                  evening: "in the evening",
                  night: "at night"
                }
              },
              defaultFormattingWidth: "wide"
            })
          },
          match: {
            ordinalNumber:
              ((c1 = {
                matchPattern: /^(\d+)(th|st|nd|rd)?/i,
                parsePattern: /\d+/i,
                valueCallback: function (e) {
                  return parseInt(e, 10);
                }
              }),
              function (e) {
                var t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {},
                  n = e.match(c1.matchPattern);
                if (!n) return null;
                var r = n[0],
                  o = e.match(c1.parsePattern);
                if (!o) return null;
                var i = c1.valueCallback ? c1.valueCallback(o[0]) : o[0];
                return { value: (i = t.valueCallback ? t.valueCallback(i) : i), rest: e.slice(r.length) };
              }),
            era: sT({
              matchPatterns: {
                narrow: /^(b|a)/i,
                abbreviated: /^(b\.?\s?c\.?|b\.?\s?c\.?\s?e\.?|a\.?\s?d\.?|c\.?\s?e\.?)/i,
                wide: /^(before christ|before common era|anno domini|common era)/i
              },
              defaultMatchWidth: "wide",
              parsePatterns: { any: [/^b/i, /^(a|c)/i] },
              defaultParseWidth: "any"
            }),
            quarter: sT({
              matchPatterns: { narrow: /^[1234]/i, abbreviated: /^q[1234]/i, wide: /^[1234](th|st|nd|rd)? quarter/i },
              defaultMatchWidth: "wide",
              parsePatterns: { any: [/1/i, /2/i, /3/i, /4/i] },
              defaultParseWidth: "any",
              valueCallback: function (e) {
                return e + 1;
              }
            }),
            month: sT({
              matchPatterns: {
                narrow: /^[jfmasond]/i,
                abbreviated: /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
                wide: /^(january|february|march|april|may|june|july|august|september|october|november|december)/i
              },
              defaultMatchWidth: "wide",
              parsePatterns: {
                narrow: [/^j/i, /^f/i, /^m/i, /^a/i, /^m/i, /^j/i, /^j/i, /^a/i, /^s/i, /^o/i, /^n/i, /^d/i],
                any: [/^ja/i, /^f/i, /^mar/i, /^ap/i, /^may/i, /^jun/i, /^jul/i, /^au/i, /^s/i, /^o/i, /^n/i, /^d/i]
              },
              defaultParseWidth: "any"
            }),
            day: sT({
              matchPatterns: {
                narrow: /^[smtwf]/i,
                short: /^(su|mo|tu|we|th|fr|sa)/i,
                abbreviated: /^(sun|mon|tue|wed|thu|fri|sat)/i,
                wide: /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i
              },
              defaultMatchWidth: "wide",
              parsePatterns: { narrow: [/^s/i, /^m/i, /^t/i, /^w/i, /^t/i, /^f/i, /^s/i], any: [/^su/i, /^m/i, /^tu/i, /^w/i, /^th/i, /^f/i, /^sa/i] },
              defaultParseWidth: "any"
            }),
            dayPeriod: sT({
              matchPatterns: {
                narrow: /^(a|p|mi|n|(in the|at) (morning|afternoon|evening|night))/i,
                any: /^([ap]\.?\s?m\.?|midnight|noon|(in the|at) (morning|afternoon|evening|night))/i
              },
              defaultMatchWidth: "any",
              parsePatterns: {
                any: {
                  am: /^a/i,
                  pm: /^p/i,
                  midnight: /^mi/i,
                  noon: /^no/i,
                  morning: /morning/i,
                  afternoon: /afternoon/i,
                  evening: /evening/i,
                  night: /night/i
                }
              },
              defaultParseWidth: "any"
            })
          },
          options: { weekStartsOn: 0, firstWeekContainsDate: 1 }
        };
        function sP(e, t) {
          if (null == e) throw TypeError("assign requires that input parameter not be null or undefined");
          for (var n in t) Object.prototype.hasOwnProperty.call(t, n) && (e[n] = t[n]);
          return e;
        }
        function sN(e) {
          var t = new Date(Date.UTC(e.getFullYear(), e.getMonth(), e.getDate(), e.getHours(), e.getMinutes(), e.getSeconds(), e.getMilliseconds()));
          return t.setUTCFullYear(e.getFullYear()), e.getTime() - t.getTime();
        }
        function sA(e) {
          return (
            sm(1, arguments),
            (!!(function (e) {
              return sm(1, arguments), e instanceof Date || ("object" === (0, sg.Z)(e) && "[object Date]" === Object.prototype.toString.call(e));
            })(e) ||
              "number" == typeof e) &&
              !isNaN(Number(sv(e)))
          );
        }
        function sO(e) {
          if (null === e || !0 === e || !1 === e) return NaN;
          var t = Number(e);
          return isNaN(t) ? t : t < 0 ? Math.ceil(t) : Math.floor(t);
        }
        function s$(e) {
          sm(1, arguments);
          var t = sv(e),
            n = t.getUTCDay();
          return t.setUTCDate(t.getUTCDate() - (7 * (n < 1) + n - 1)), t.setUTCHours(0, 0, 0, 0), t;
        }
        function sD(e) {
          sm(1, arguments);
          var t = sv(e),
            n = t.getUTCFullYear(),
            r = new Date(0);
          r.setUTCFullYear(n + 1, 0, 4), r.setUTCHours(0, 0, 0, 0);
          var o = s$(r),
            i = new Date(0);
          i.setUTCFullYear(n, 0, 4), i.setUTCHours(0, 0, 0, 0);
          var a = s$(i);
          return t.getTime() >= o.getTime() ? n + 1 : t.getTime() >= a.getTime() ? n : n - 1;
        }
        function sz(e, t) {
          sm(1, arguments);
          var n,
            r,
            o,
            i,
            a,
            s,
            l,
            u,
            c = sO(
              null !==
                (n =
                  null !==
                    (r =
                      null !==
                        (o =
                          null !== (i = null == t ? void 0 : t.weekStartsOn) && void 0 !== i
                            ? i
                            : null == t
                              ? void 0
                              : null === (a = t.locale) || void 0 === a
                                ? void 0
                                : null === (s = a.options) || void 0 === s
                                  ? void 0
                                  : s.weekStartsOn) && void 0 !== o
                        ? o
                        : sx.weekStartsOn) && void 0 !== r
                    ? r
                    : null === (l = sx.locale) || void 0 === l
                      ? void 0
                      : null === (u = l.options) || void 0 === u
                        ? void 0
                        : u.weekStartsOn) && void 0 !== n
                ? n
                : 0
            );
          if (!(c >= 0 && c <= 6)) throw RangeError("weekStartsOn must be between 0 and 6 inclusively");
          var d = sv(e),
            f = d.getUTCDay();
          return d.setUTCDate(d.getUTCDate() - (7 * (f < c) + f - c)), d.setUTCHours(0, 0, 0, 0), d;
        }
        function sR(e, t) {
          sm(1, arguments);
          var n,
            r,
            o,
            i,
            a,
            s,
            l,
            u,
            c = sv(e),
            d = c.getUTCFullYear(),
            f = sO(
              null !==
                (n =
                  null !==
                    (r =
                      null !==
                        (o =
                          null !== (i = null == t ? void 0 : t.firstWeekContainsDate) && void 0 !== i
                            ? i
                            : null == t
                              ? void 0
                              : null === (a = t.locale) || void 0 === a
                                ? void 0
                                : null === (s = a.options) || void 0 === s
                                  ? void 0
                                  : s.firstWeekContainsDate) && void 0 !== o
                        ? o
                        : sx.firstWeekContainsDate) && void 0 !== r
                    ? r
                    : null === (l = sx.locale) || void 0 === l
                      ? void 0
                      : null === (u = l.options) || void 0 === u
                        ? void 0
                        : u.firstWeekContainsDate) && void 0 !== n
                ? n
                : 1
            );
          if (!(f >= 1 && f <= 7)) throw RangeError("firstWeekContainsDate must be between 1 and 7 inclusively");
          var h = new Date(0);
          h.setUTCFullYear(d + 1, 0, f), h.setUTCHours(0, 0, 0, 0);
          var p = sz(h, t),
            _ = new Date(0);
          _.setUTCFullYear(d, 0, f), _.setUTCHours(0, 0, 0, 0);
          var g = sz(_, t);
          return c.getTime() >= p.getTime() ? d + 1 : c.getTime() >= g.getTime() ? d : d - 1;
        }
        function sL(e, t) {
          for (var n = Math.abs(e).toString(); n.length < t; ) n = "0" + n;
          return (e < 0 ? "-" : "") + n;
        }
        let sF = {
          y: function (e, t) {
            var n = e.getUTCFullYear(),
              r = n > 0 ? n : 1 - n;
            return sL("yy" === t ? r % 100 : r, t.length);
          },
          M: function (e, t) {
            var n = e.getUTCMonth();
            return "M" === t ? String(n + 1) : sL(n + 1, 2);
          },
          d: function (e, t) {
            return sL(e.getUTCDate(), t.length);
          },
          h: function (e, t) {
            return sL(e.getUTCHours() % 12 || 12, t.length);
          },
          H: function (e, t) {
            return sL(e.getUTCHours(), t.length);
          },
          m: function (e, t) {
            return sL(e.getUTCMinutes(), t.length);
          },
          s: function (e, t) {
            return sL(e.getUTCSeconds(), t.length);
          },
          S: function (e, t) {
            var n = t.length;
            return sL(Math.floor(e.getUTCMilliseconds() * Math.pow(10, n - 3)), t.length);
          }
        };
        var sI = { midnight: "midnight", noon: "noon", morning: "morning", afternoon: "afternoon", evening: "evening", night: "night" };
        function sB(e, t) {
          var n = e > 0 ? "-" : "+",
            r = Math.abs(e),
            o = Math.floor(r / 60),
            i = r % 60;
          return 0 === i ? n + String(o) : n + String(o) + (t || "") + sL(i, 2);
        }
        function sU(e, t) {
          return e % 60 == 0 ? (e > 0 ? "-" : "+") + sL(Math.abs(e) / 60, 2) : sq(e, t);
        }
        function sq(e, t) {
          var n = Math.abs(e);
          return (e > 0 ? "-" : "+") + sL(Math.floor(n / 60), 2) + (t || "") + sL(n % 60, 2);
        }
        let sH = {
          G: function (e, t, n) {
            var r = +(e.getUTCFullYear() > 0);
            switch (t) {
              case "G":
              case "GG":
              case "GGG":
                return n.era(r, { width: "abbreviated" });
              case "GGGGG":
                return n.era(r, { width: "narrow" });
              default:
                return n.era(r, { width: "wide" });
            }
          },
          y: function (e, t, n) {
            if ("yo" === t) {
              var r = e.getUTCFullYear();
              return n.ordinalNumber(r > 0 ? r : 1 - r, { unit: "year" });
            }
            return sF.y(e, t);
          },
          Y: function (e, t, n, r) {
            var o = sR(e, r),
              i = o > 0 ? o : 1 - o;
            return "YY" === t ? sL(i % 100, 2) : "Yo" === t ? n.ordinalNumber(i, { unit: "year" }) : sL(i, t.length);
          },
          R: function (e, t) {
            return sL(sD(e), t.length);
          },
          u: function (e, t) {
            return sL(e.getUTCFullYear(), t.length);
          },
          Q: function (e, t, n) {
            var r = Math.ceil((e.getUTCMonth() + 1) / 3);
            switch (t) {
              case "Q":
                return String(r);
              case "QQ":
                return sL(r, 2);
              case "Qo":
                return n.ordinalNumber(r, { unit: "quarter" });
              case "QQQ":
                return n.quarter(r, { width: "abbreviated", context: "formatting" });
              case "QQQQQ":
                return n.quarter(r, { width: "narrow", context: "formatting" });
              default:
                return n.quarter(r, { width: "wide", context: "formatting" });
            }
          },
          q: function (e, t, n) {
            var r = Math.ceil((e.getUTCMonth() + 1) / 3);
            switch (t) {
              case "q":
                return String(r);
              case "qq":
                return sL(r, 2);
              case "qo":
                return n.ordinalNumber(r, { unit: "quarter" });
              case "qqq":
                return n.quarter(r, { width: "abbreviated", context: "standalone" });
              case "qqqqq":
                return n.quarter(r, { width: "narrow", context: "standalone" });
              default:
                return n.quarter(r, { width: "wide", context: "standalone" });
            }
          },
          M: function (e, t, n) {
            var r = e.getUTCMonth();
            switch (t) {
              case "M":
              case "MM":
                return sF.M(e, t);
              case "Mo":
                return n.ordinalNumber(r + 1, { unit: "month" });
              case "MMM":
                return n.month(r, { width: "abbreviated", context: "formatting" });
              case "MMMMM":
                return n.month(r, { width: "narrow", context: "formatting" });
              default:
                return n.month(r, { width: "wide", context: "formatting" });
            }
          },
          L: function (e, t, n) {
            var r = e.getUTCMonth();
            switch (t) {
              case "L":
                return String(r + 1);
              case "LL":
                return sL(r + 1, 2);
              case "Lo":
                return n.ordinalNumber(r + 1, { unit: "month" });
              case "LLL":
                return n.month(r, { width: "abbreviated", context: "standalone" });
              case "LLLLL":
                return n.month(r, { width: "narrow", context: "standalone" });
              default:
                return n.month(r, { width: "wide", context: "standalone" });
            }
          },
          w: function (e, t, n, r) {
            var o = (function (e, t) {
              sm(1, arguments);
              var n = sv(e);
              return (
                Math.round(
                  (sz(n, t).getTime() -
                    (function (e, t) {
                      sm(1, arguments);
                      var n,
                        r,
                        o,
                        i,
                        a,
                        s,
                        l,
                        u,
                        c = sO(
                          null !==
                            (n =
                              null !==
                                (r =
                                  null !==
                                    (o =
                                      null !== (i = null == t ? void 0 : t.firstWeekContainsDate) && void 0 !== i
                                        ? i
                                        : null == t
                                          ? void 0
                                          : null === (a = t.locale) || void 0 === a
                                            ? void 0
                                            : null === (s = a.options) || void 0 === s
                                              ? void 0
                                              : s.firstWeekContainsDate) && void 0 !== o
                                    ? o
                                    : sx.firstWeekContainsDate) && void 0 !== r
                                ? r
                                : null === (l = sx.locale) || void 0 === l
                                  ? void 0
                                  : null === (u = l.options) || void 0 === u
                                    ? void 0
                                    : u.firstWeekContainsDate) && void 0 !== n
                            ? n
                            : 1
                        ),
                        d = sR(e, t),
                        f = new Date(0);
                      return f.setUTCFullYear(d, 0, c), f.setUTCHours(0, 0, 0, 0), sz(f, t);
                    })(n, t).getTime()) /
                    6048e5
                ) + 1
              );
            })(e, r);
            return "wo" === t ? n.ordinalNumber(o, { unit: "week" }) : sL(o, t.length);
          },
          I: function (e, t, n) {
            var r = (function (e) {
              sm(1, arguments);
              var t = sv(e);
              return (
                Math.round(
                  (s$(t).getTime() -
                    (function (e) {
                      sm(1, arguments);
                      var t = sD(e),
                        n = new Date(0);
                      return n.setUTCFullYear(t, 0, 4), n.setUTCHours(0, 0, 0, 0), s$(n);
                    })(t).getTime()) /
                    6048e5
                ) + 1
              );
            })(e);
            return "Io" === t ? n.ordinalNumber(r, { unit: "week" }) : sL(r, t.length);
          },
          d: function (e, t, n) {
            return "do" === t ? n.ordinalNumber(e.getUTCDate(), { unit: "date" }) : sF.d(e, t);
          },
          D: function (e, t, n) {
            var r = (function (e) {
              sm(1, arguments);
              var t = sv(e),
                n = t.getTime();
              return t.setUTCMonth(0, 1), t.setUTCHours(0, 0, 0, 0), Math.floor((n - t.getTime()) / 864e5) + 1;
            })(e);
            return "Do" === t ? n.ordinalNumber(r, { unit: "dayOfYear" }) : sL(r, t.length);
          },
          E: function (e, t, n) {
            var r = e.getUTCDay();
            switch (t) {
              case "E":
              case "EE":
              case "EEE":
                return n.day(r, { width: "abbreviated", context: "formatting" });
              case "EEEEE":
                return n.day(r, { width: "narrow", context: "formatting" });
              case "EEEEEE":
                return n.day(r, { width: "short", context: "formatting" });
              default:
                return n.day(r, { width: "wide", context: "formatting" });
            }
          },
          e: function (e, t, n, r) {
            var o = e.getUTCDay(),
              i = (o - r.weekStartsOn + 8) % 7 || 7;
            switch (t) {
              case "e":
                return String(i);
              case "ee":
                return sL(i, 2);
              case "eo":
                return n.ordinalNumber(i, { unit: "day" });
              case "eee":
                return n.day(o, { width: "abbreviated", context: "formatting" });
              case "eeeee":
                return n.day(o, { width: "narrow", context: "formatting" });
              case "eeeeee":
                return n.day(o, { width: "short", context: "formatting" });
              default:
                return n.day(o, { width: "wide", context: "formatting" });
            }
          },
          c: function (e, t, n, r) {
            var o = e.getUTCDay(),
              i = (o - r.weekStartsOn + 8) % 7 || 7;
            switch (t) {
              case "c":
                return String(i);
              case "cc":
                return sL(i, t.length);
              case "co":
                return n.ordinalNumber(i, { unit: "day" });
              case "ccc":
                return n.day(o, { width: "abbreviated", context: "standalone" });
              case "ccccc":
                return n.day(o, { width: "narrow", context: "standalone" });
              case "cccccc":
                return n.day(o, { width: "short", context: "standalone" });
              default:
                return n.day(o, { width: "wide", context: "standalone" });
            }
          },
          i: function (e, t, n) {
            var r = e.getUTCDay(),
              o = 0 === r ? 7 : r;
            switch (t) {
              case "i":
                return String(o);
              case "ii":
                return sL(o, t.length);
              case "io":
                return n.ordinalNumber(o, { unit: "day" });
              case "iii":
                return n.day(r, { width: "abbreviated", context: "formatting" });
              case "iiiii":
                return n.day(r, { width: "narrow", context: "formatting" });
              case "iiiiii":
                return n.day(r, { width: "short", context: "formatting" });
              default:
                return n.day(r, { width: "wide", context: "formatting" });
            }
          },
          a: function (e, t, n) {
            var r = e.getUTCHours() / 12 >= 1 ? "pm" : "am";
            switch (t) {
              case "a":
              case "aa":
                return n.dayPeriod(r, { width: "abbreviated", context: "formatting" });
              case "aaa":
                return n.dayPeriod(r, { width: "abbreviated", context: "formatting" }).toLowerCase();
              case "aaaaa":
                return n.dayPeriod(r, { width: "narrow", context: "formatting" });
              default:
                return n.dayPeriod(r, { width: "wide", context: "formatting" });
            }
          },
          b: function (e, t, n) {
            var r,
              o = e.getUTCHours();
            switch (((r = 12 === o ? sI.noon : 0 === o ? sI.midnight : o / 12 >= 1 ? "pm" : "am"), t)) {
              case "b":
              case "bb":
                return n.dayPeriod(r, { width: "abbreviated", context: "formatting" });
              case "bbb":
                return n.dayPeriod(r, { width: "abbreviated", context: "formatting" }).toLowerCase();
              case "bbbbb":
                return n.dayPeriod(r, { width: "narrow", context: "formatting" });
              default:
                return n.dayPeriod(r, { width: "wide", context: "formatting" });
            }
          },
          B: function (e, t, n) {
            var r,
              o = e.getUTCHours();
            switch (((r = o >= 17 ? sI.evening : o >= 12 ? sI.afternoon : o >= 4 ? sI.morning : sI.night), t)) {
              case "B":
              case "BB":
              case "BBB":
                return n.dayPeriod(r, { width: "abbreviated", context: "formatting" });
              case "BBBBB":
                return n.dayPeriod(r, { width: "narrow", context: "formatting" });
              default:
                return n.dayPeriod(r, { width: "wide", context: "formatting" });
            }
          },
          h: function (e, t, n) {
            if ("ho" === t) {
              var r = e.getUTCHours() % 12;
              return 0 === r && (r = 12), n.ordinalNumber(r, { unit: "hour" });
            }
            return sF.h(e, t);
          },
          H: function (e, t, n) {
            return "Ho" === t ? n.ordinalNumber(e.getUTCHours(), { unit: "hour" }) : sF.H(e, t);
          },
          K: function (e, t, n) {
            var r = e.getUTCHours() % 12;
            return "Ko" === t ? n.ordinalNumber(r, { unit: "hour" }) : sL(r, t.length);
          },
          k: function (e, t, n) {
            var r = e.getUTCHours();
            return (0 === r && (r = 24), "ko" === t) ? n.ordinalNumber(r, { unit: "hour" }) : sL(r, t.length);
          },
          m: function (e, t, n) {
            return "mo" === t ? n.ordinalNumber(e.getUTCMinutes(), { unit: "minute" }) : sF.m(e, t);
          },
          s: function (e, t, n) {
            return "so" === t ? n.ordinalNumber(e.getUTCSeconds(), { unit: "second" }) : sF.s(e, t);
          },
          S: function (e, t) {
            return sF.S(e, t);
          },
          X: function (e, t, n, r) {
            var o = (r._originalDate || e).getTimezoneOffset();
            if (0 === o) return "Z";
            switch (t) {
              case "X":
                return sU(o);
              case "XXXX":
              case "XX":
                return sq(o);
              default:
                return sq(o, ":");
            }
          },
          x: function (e, t, n, r) {
            var o = (r._originalDate || e).getTimezoneOffset();
            switch (t) {
              case "x":
                return sU(o);
              case "xxxx":
              case "xx":
                return sq(o);
              default:
                return sq(o, ":");
            }
          },
          O: function (e, t, n, r) {
            var o = (r._originalDate || e).getTimezoneOffset();
            switch (t) {
              case "O":
              case "OO":
              case "OOO":
                return "GMT" + sB(o, ":");
              default:
                return "GMT" + sq(o, ":");
            }
          },
          z: function (e, t, n, r) {
            var o = (r._originalDate || e).getTimezoneOffset();
            switch (t) {
              case "z":
              case "zz":
              case "zzz":
                return "GMT" + sB(o, ":");
              default:
                return "GMT" + sq(o, ":");
            }
          },
          t: function (e, t, n, r) {
            return sL(Math.floor((r._originalDate || e).getTime() / 1e3), t.length);
          },
          T: function (e, t, n, r) {
            return sL((r._originalDate || e).getTime(), t.length);
          }
        };
        var sY = function (e, t) {
            switch (e) {
              case "P":
                return t.date({ width: "short" });
              case "PP":
                return t.date({ width: "medium" });
              case "PPP":
                return t.date({ width: "long" });
              default:
                return t.date({ width: "full" });
            }
          },
          sW = function (e, t) {
            switch (e) {
              case "p":
                return t.time({ width: "short" });
              case "pp":
                return t.time({ width: "medium" });
              case "ppp":
                return t.time({ width: "long" });
              default:
                return t.time({ width: "full" });
            }
          };
        let sZ = {
          p: sW,
          P: function (e, t) {
            var n,
              r = e.match(/(P+)(p+)?/) || [],
              o = r[1],
              i = r[2];
            if (!i) return sY(e, t);
            switch (o) {
              case "P":
                n = t.dateTime({ width: "short" });
                break;
              case "PP":
                n = t.dateTime({ width: "medium" });
                break;
              case "PPP":
                n = t.dateTime({ width: "long" });
                break;
              default:
                n = t.dateTime({ width: "full" });
            }
            return n.replace("{{date}}", sY(o, t)).replace("{{time}}", sW(i, t));
          }
        };
        var sX = ["D", "DD"],
          sV = ["YY", "YYYY"];
        function sG(e, t, n) {
          if ("YYYY" === e)
            throw RangeError(
              "Use `yyyy` instead of `YYYY` (in `"
                .concat(t, "`) for formatting years to the input `")
                .concat(n, "`; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md")
            );
          if ("YY" === e)
            throw RangeError(
              "Use `yy` instead of `YY` (in `"
                .concat(t, "`) for formatting years to the input `")
                .concat(n, "`; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md")
            );
          if ("D" === e)
            throw RangeError(
              "Use `d` instead of `D` (in `"
                .concat(t, "`) for formatting days of the month to the input `")
                .concat(n, "`; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md")
            );
          if ("DD" === e)
            throw RangeError(
              "Use `dd` instead of `DD` (in `"
                .concat(t, "`) for formatting days of the month to the input `")
                .concat(n, "`; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md")
            );
        }
        var sJ = /[yYQqMLwIdDecihHKkms]o|(\w)\1*|''|'(''|[^'])+('|$)|./g,
          sK = /P+p+|P+|p+|''|'(''|[^'])+('|$)|./g,
          sQ = /^'([^]*?)'?$/,
          s0 = /''/g,
          s1 = /[a-zA-Z]/;
        function s2(e, t, n) {
          sm(2, arguments);
          var r,
            o,
            i,
            a,
            s,
            l,
            u,
            c,
            d,
            f,
            h,
            p,
            _,
            g,
            m,
            v,
            y,
            b,
            x = String(t),
            w = null !== (r = null !== (o = null == n ? void 0 : n.locale) && void 0 !== o ? o : sx.locale) && void 0 !== r ? r : sC,
            k = sO(
              null !==
                (i =
                  null !==
                    (a =
                      null !==
                        (s =
                          null !== (l = null == n ? void 0 : n.firstWeekContainsDate) && void 0 !== l
                            ? l
                            : null == n
                              ? void 0
                              : null === (u = n.locale) || void 0 === u
                                ? void 0
                                : null === (c = u.options) || void 0 === c
                                  ? void 0
                                  : c.firstWeekContainsDate) && void 0 !== s
                        ? s
                        : sx.firstWeekContainsDate) && void 0 !== a
                    ? a
                    : null === (d = sx.locale) || void 0 === d
                      ? void 0
                      : null === (f = d.options) || void 0 === f
                        ? void 0
                        : f.firstWeekContainsDate) && void 0 !== i
                ? i
                : 1
            );
          if (!(k >= 1 && k <= 7)) throw RangeError("firstWeekContainsDate must be between 1 and 7 inclusively");
          var M = sO(
            null !==
              (h =
                null !==
                  (p =
                    null !==
                      (_ =
                        null !== (g = null == n ? void 0 : n.weekStartsOn) && void 0 !== g
                          ? g
                          : null == n
                            ? void 0
                            : null === (m = n.locale) || void 0 === m
                              ? void 0
                              : null === (v = m.options) || void 0 === v
                                ? void 0
                                : v.weekStartsOn) && void 0 !== _
                      ? _
                      : sx.weekStartsOn) && void 0 !== p
                  ? p
                  : null === (y = sx.locale) || void 0 === y
                    ? void 0
                    : null === (b = y.options) || void 0 === b
                      ? void 0
                      : b.weekStartsOn) && void 0 !== h
              ? h
              : 0
          );
          if (!(M >= 0 && M <= 6)) throw RangeError("weekStartsOn must be between 0 and 6 inclusively");
          if (!w.localize) throw RangeError("locale must contain localize property");
          if (!w.formatLong) throw RangeError("locale must contain formatLong property");
          var j = sv(e);
          if (!sA(j)) throw RangeError("Invalid time value");
          var E = sN(j),
            S = (function (e, t) {
              return (
                sm(2, arguments),
                (function (e, t) {
                  return sm(2, arguments), new Date(sv(e).getTime() + sO(t));
                })(e, -sO(t))
              );
            })(j, E),
            T = { firstWeekContainsDate: k, weekStartsOn: M, locale: w, _originalDate: j };
          return x
            .match(sK)
            .map(function (e) {
              var t = e[0];
              return "p" === t || "P" === t ? (0, sZ[t])(e, w.formatLong) : e;
            })
            .join("")
            .match(sJ)
            .map(function (r) {
              if ("''" === r) return "'";
              var o,
                i,
                a = r[0];
              if ("'" === a) {
                return (i = (o = r).match(sQ)) ? i[1].replace(s0, "'") : o;
              }
              var s = sH[a];
              if (s)
                return (
                  !(null != n && n.useAdditionalWeekYearTokens) && -1 !== sV.indexOf(r) && sG(r, t, String(e)),
                  !(null != n && n.useAdditionalDayOfYearTokens) && -1 !== sX.indexOf(r) && sG(r, t, String(e)),
                  s(S, r, w.localize, T)
                );
              if (a.match(s1)) throw RangeError("Format string contains an unescaped latin alphabet character `" + a + "`");
              return r;
            })
            .join("");
        }
        function s3(e, t) {
          sm(2, arguments);
          var n = sv(e),
            r = sO(t);
          return isNaN(r) ? new Date(NaN) : (r && n.setDate(n.getDate() + r), n);
        }
        function s5(e, t) {
          return sm(2, arguments), s3(e, -sO(t));
        }
        function s8(e) {
          return sm(1, arguments), sv(e).getDate();
        }
        function s6(e) {
          sm(1, arguments);
          var t = sv(e).getDay();
          return 0 === t && (t = 7), t;
        }
        function s4(e) {
          sm(1, arguments);
          var t = sv(e);
          return t.setHours(0, 0, 0, 0), t;
        }
        function s7(e, t) {
          sm(2, arguments);
          var n = s4(e),
            r = s4(t);
          return n.getTime() === r.getTime();
        }
        function s9(e, t) {
          sm(2, arguments);
          var n = sv(e),
            r = sv(t);
          return n.getFullYear() === r.getFullYear() && n.getMonth() === r.getMonth();
        }
        function le(e) {
          var t, n;
          if ((sm(1, arguments), e && "function" == typeof e.forEach)) t = e;
          else {
            if ("object" !== (0, sg.Z)(e) || null === e) return new Date(NaN);
            t = Array.prototype.slice.call(e);
          }
          return (
            t.forEach(function (e) {
              var t = sv(e);
              (void 0 === n || n > t || isNaN(t.getDate())) && (n = t);
            }),
            n || new Date(NaN)
          );
        }
        function lt(e) {
          var t, n;
          if ((sm(1, arguments), e && "function" == typeof e.forEach)) t = e;
          else {
            if ("object" !== (0, sg.Z)(e) || null === e) return new Date(NaN);
            t = Array.prototype.slice.call(e);
          }
          return (
            t.forEach(function (e) {
              var t = sv(e);
              (void 0 === n || n < t || isNaN(Number(t))) && (n = t);
            }),
            n || new Date(NaN)
          );
        }
        function ln(e, t) {
          sm(2, arguments);
          var n = sv(e),
            r = sv(t);
          return n.getTime() > r.getTime();
        }
        function lr(e, t) {
          sm(2, arguments);
          var n = sv(e),
            r = sv(t);
          return n.getTime() < r.getTime();
        }
        function lo(e, t) {
          sm(2, arguments);
          var n = sv(e),
            r = sO(t);
          if (isNaN(r)) return new Date(NaN);
          if (!r) return n;
          var o = n.getDate(),
            i = new Date(n.getTime());
          return (i.setMonth(n.getMonth() + r + 1, 0), o >= i.getDate()) ? i : (n.setFullYear(i.getFullYear(), i.getMonth(), o), n);
        }
        var li = n(23187),
          la = n(57313),
          ls = n(27495),
          ll = n(63608),
          lu = n(78141),
          lc = (n(57711), n(78435)),
          ld = n(13714),
          lf = n(83660),
          lh = f.useLayoutEffect,
          lp = function (e) {
            var t = f.useRef(e);
            return (
              lh(function () {
                t.current = e;
              }),
              t
            );
          },
          l_ = function (e, t) {
            if ("function" == typeof e) {
              e(t);
              return;
            }
            e.current = t;
          },
          lg = function (e, t) {
            var n = f.useRef();
            return f.useCallback(
              function (r) {
                (e.current = r), n.current && l_(n.current, null), (n.current = t), t && l_(t, r);
              },
              [t]
            );
          },
          lm = {
            "min-height": "0",
            "max-height": "none",
            height: "0",
            visibility: "hidden",
            overflow: "hidden",
            position: "absolute",
            "z-index": "-1000",
            top: "0",
            right: "0",
            display: "block"
          },
          lv = function (e) {
            Object.keys(lm).forEach(function (t) {
              e.style.setProperty(t, lm[t], "important");
            });
          },
          ly = null,
          lb = function (e, t) {
            var n = e.scrollHeight;
            return "border-box" === t.sizingStyle.boxSizing ? n + t.borderSize : n - t.paddingSize;
          },
          lx = function () {},
          lw = [
            "borderBottomWidth",
            "borderLeftWidth",
            "borderRightWidth",
            "borderTopWidth",
            "boxSizing",
            "fontFamily",
            "fontSize",
            "fontStyle",
            "fontWeight",
            "letterSpacing",
            "lineHeight",
            "paddingBottom",
            "paddingLeft",
            "paddingRight",
            "paddingTop",
            "tabSize",
            "textIndent",
            "textRendering",
            "textTransform",
            "width",
            "wordBreak",
            "wordSpacing",
            "scrollbarGutter"
          ],
          lk = !!document.documentElement.currentStyle,
          lM = function (e) {
            var t = window.getComputedStyle(e);
            if (null === t) return null;
            var n = lw.reduce(function (e, n) {
                return (e[n] = t[n]), e;
              }, {}),
              r = n.boxSizing;
            if ("" === r) return null;
            lk &&
              "border-box" === r &&
              (n.width =
                parseFloat(n.width) +
                parseFloat(n.borderRightWidth) +
                parseFloat(n.borderLeftWidth) +
                parseFloat(n.paddingRight) +
                parseFloat(n.paddingLeft) +
                "px");
            var o = parseFloat(n.paddingBottom) + parseFloat(n.paddingTop),
              i = parseFloat(n.borderBottomWidth) + parseFloat(n.borderTopWidth);
            return { sizingStyle: n, paddingSize: o, borderSize: i };
          };
        function lj(e, t, n) {
          var r = lp(n);
          f.useLayoutEffect(function () {
            var n = function (e) {
              return r.current(e);
            };
            if (e)
              return (
                e.addEventListener(t, n),
                function () {
                  return e.removeEventListener(t, n);
                }
              );
          }, []);
        }
        var lE = function (e, t) {
            lj(document.body, "reset", function (n) {
              e.current.form === n.target && t(n);
            });
          },
          lS = function (e) {
            lj(window, "resize", e);
          },
          lT = function (e) {
            lj(document.fonts, "loadingdone", e);
          },
          lC = ["cacheMeasurements", "maxRows", "minRows", "onChange", "onHeightChange"],
          lP = f.forwardRef(function (e, t) {
            var n = e.cacheMeasurements,
              r = e.maxRows,
              o = e.minRows,
              i = e.onChange,
              a = void 0 === i ? lx : i,
              s = e.onHeightChange,
              l = void 0 === s ? lx : s,
              u = (0, lf.Z)(e, lC),
              c = void 0 !== u.value,
              d = f.useRef(null),
              h = lg(d, t),
              p = f.useRef(0),
              _ = f.useRef(),
              g = function () {
                var e,
                  t,
                  i,
                  a,
                  s,
                  u,
                  c,
                  f,
                  h,
                  g,
                  m,
                  v = d.current,
                  y = n && _.current ? _.current : lM(v);
                if (y) {
                  _.current = y;
                  var b =
                      ((e = v.value || v.placeholder || "x"),
                      void 0 === (t = o) && (t = 1),
                      void 0 === (i = r) && (i = 1 / 0),
                      ly || ((ly = document.createElement("textarea")).setAttribute("tabindex", "-1"), ly.setAttribute("aria-hidden", "true"), lv(ly)),
                      null === ly.parentNode && document.body.appendChild(ly),
                      (a = y.paddingSize),
                      (s = y.borderSize),
                      (c = (u = y.sizingStyle).boxSizing),
                      Object.keys(u).forEach(function (e) {
                        ly.style[e] = u[e];
                      }),
                      lv(ly),
                      (ly.value = e),
                      (f = lb(ly, y)),
                      (ly.value = e),
                      (f = lb(ly, y)),
                      (ly.value = "x"),
                      (g = (h = ly.scrollHeight - a) * t),
                      "border-box" === c && (g = g + a + s),
                      (f = Math.max(g, f)),
                      (m = h * i),
                      "border-box" === c && (m = m + a + s),
                      [(f = Math.min(m, f)), h]),
                    x = b[0],
                    w = b[1];
                  p.current !== x && ((p.current = x), v.style.setProperty("height", x + "px", "important"), l(x, { rowHeight: w }));
                }
              };
            return (
              f.useLayoutEffect(g),
              lE(d, function () {
                if (!c) {
                  var e = d.current.value;
                  requestAnimationFrame(function () {
                    var t = d.current;
                    t && e !== t.value && g();
                  });
                }
              }),
              lS(g),
              lT(g),
              f.createElement(
                "textarea",
                (0, ld.Z)({}, u, {
                  onChange: function (e) {
                    c || g(), a(e);
                  },
                  ref: h
                })
              )
            );
          }),
          lN = n(74721),
          lA = class {
            constructor(e) {
              null == e && (e = +new Date());
              let t = "";
              (this.x = 0), (this.y = 0), (this.z = 0), (this.w = 0), e === (0 | e) ? (this.x = e) : (t += e);
              for (let e = 0; e < t.length + 64; e++) (this.x ^= 0 | t.charCodeAt(e)), this.next();
            }
            next() {
              let { x: e, y: t, z: n, w: r } = this,
                o = e ^ (e << 11);
              return (this.x = t), (this.y = n), (this.z = r), (this.w = (r >>> 19) ^ o ^ (o >>> 8) ^ r);
            }
            copy(e, t) {
              return (t.x = e.x), (t.y = e.y), (t.z = e.z), (t.w = e.w), t;
            }
          },
          lO = e => {
            var t, n;
            let r, o;
            return ((t = new lA(e)),
            (n = void 0),
            ((r = () => (t.next() >>> 0) / 0x100000000).double = () => {
              let e;
              do e = ((t.next() >>> 11) + (t.next() >>> 0) / 0x100000000) / 2097152;
              while (0 === e);
              return e;
            }),
            (r.int32 = () => 0 | t.next()),
            (r.quick = r),
            (o = n && n.state) && ("object" == typeof o && t.copy(o, t), (r.state = () => t.copy(t, {}))),
            r)();
          },
          l$ = { saturation: 75, lightness: 50, alpha: 100 },
          lD = n(79553),
          lz = n(85608);
        !(function () {
          try {
            if ("undefined" != typeof document) {
              var e = document.createElement("style");
              e.appendChild(
                document.createTextNode(
                  "._dots_10uvw_1 {\n  cursor: pointer;\n  opacity: 0.5;\n  border: none;\n  background: none;\n  outline: none;\n  padding: 0;\n  font: inherit;\n  color: inherit;\n}\n._btn_1szmm_1 {\n  cursor: pointer;\n}\n\n  ._btn_1szmm_1:hover {\n    -webkit-text-decoration: underline;\n    text-decoration: underline;\n  }\n._btn_lab0n_1 {\n  cursor: pointer;\n  color: var(--color-primary);\n}\n\n  ._btn_lab0n_1:hover {\n    -webkit-text-decoration: underline;\n    text-decoration: underline;\n  }\n._button_fz3ld_1 {\n  cursor: pointer;\n  -webkit-user-select: none;\n     -moz-user-select: none;\n          user-select: none;\n  display: flex;\n  align-items: center;\n  position: relative;\n}\n\n._disabled_fz3ld_9 {\n  cursor: auto;\n  cursor: initial;\n}\n\n._disabled_fz3ld_9._hasValue_fz3ld_12 {\n    cursor: not-allowed;\n  }\n\n._icon_fz3ld_17 {\n  height: var(--sort-icon-size);\n  width: var(--sort-icon-size);\n  vertical-align: middle;\n  margin: 0 var(--spacing-sm);\n  fill: var(--sort-icon-color);\n}\n\n._icon_fz3ld_17._ascIcon_fz3ld_24 {\n    transform: rotate(180deg);\n  }\n._container_tjtgz_1 {\n  display: flex;\n  width: 100%;\n  align-items: center;\n  border-bottom: solid 2px var(--body-background);\n}\n\n._input_tjtgz_8 {\n  color: var(--input-color);\n  border: none;\n  flex: 1;\n  padding: var(--spacing-md);\n  box-sizing: border-box;\n  font-weight: normal;\n  background: none;\n  font-family: var(--font-family);\n  color: var(--input-color);\n}\n\n._input_tjtgz_8:focus-within,\n  ._input_tjtgz_8:focus-visible {\n    outline: none;\n  }\n\n._input_tjtgz_8::-moz-placeholder {\n    color: var(--input-color-placeholder);\n  }\n\n._input_tjtgz_8::placeholder {\n    color: var(--input-color-placeholder);\n  }\n\n._icon_tjtgz_29 {\n  width: 15px;\n  height: 15px;\n  margin-left: var(--spacing-md);\n}\n._list_jz30e_1 {\n  display: flex;\n  flex-direction: column;\n}\n._listItem_r6l8m_1 {\n  align-items: center;\n  display: flex;\n  padding: var(--list-item-spacing);\n  position: relative;\n  border-radius: var(--list-item-border-radius);\n  color: var(--list-item-color);\n  transition: color 0.3s ease;\n}\n\n  ._listItem_r6l8m_1 ._startAdornment_r6l8m_10 {\n    padding-right: calc(var(--spacing-md) / 2);\n  }\n\n  ._listItem_r6l8m_1 ._endAdornment_r6l8m_14 {\n    padding-left: calc(var(--spacing-md) / 2);\n  }\n\n  ._listItem_r6l8m_1 ._startAdornment_r6l8m_10,\n  ._listItem_r6l8m_1 ._endAdornment_r6l8m_14 {\n    align-items: center;\n    display: flex;\n  }\n\n  ._listItem_r6l8m_1 ._startAdornment_r6l8m_10 svg, ._listItem_r6l8m_1 ._endAdornment_r6l8m_14 svg {\n      fill: var(--list-item-adornment-fill);\n    }\n\n  ._listItem_r6l8m_1 ._content_r6l8m_28 {\n    font-size: 14px;\n    flex: 1;\n    white-space: break-spaces;\n    word-break: break-word;\n  }\n\n  ._listItem_r6l8m_1._active_r6l8m_35 {\n    -webkit-text-decoration: underline;\n    text-decoration: underline;\n  }\n\n  ._listItem_r6l8m_1._disabled_r6l8m_39 {\n    cursor: not-allowed;\n  }\n\n  ._listItem_r6l8m_1._clickable_r6l8m_43 {\n    cursor: pointer;\n    transition: color 0.3s ease, background-color 0.3s ease;\n  }\n\n  ._listItem_r6l8m_1._clickable_r6l8m_43:hover {\n      color: var(--list-item-color-active);\n      background-color: var(--list-item-background-active);\n    }\n\n  ._listItem_r6l8m_1._dense_r6l8m_53 {\n    padding: var(--list-item-dense-spacing);\n  }\n\n  ._listItem_r6l8m_1._dense_r6l8m_53 ._content_r6l8m_28 {\n      font-size: 95%;\n    }\n\n  ._listItem_r6l8m_1._dense_r6l8m_53 ._startAdornment_r6l8m_10 {\n      padding-right: calc(var(--spacing-sm) / 2);\n    }\n\n  ._listItem_r6l8m_1._dense_r6l8m_53 ._endAdornment_r6l8m_14 {\n      padding-left: calc(var(--spacing-sm) / 2);\n    }\n\n  ._listItem_r6l8m_1._disableGutters_r6l8m_69 {\n    padding-left: 0;\n    padding-right: 0;\n  }\n\n  ._listItem_r6l8m_1._disablePadding_r6l8m_74 {\n    padding: 0;\n  }\n._root_1u76g_1 {\n  font-family: var(--font-family);\n  font-size: var(--page-title-font-size);\n  font-weight: var(--page-title-font-weight);\n  color: var(--page-title-color);\n  margin: var(--page-title-margin);\n}\n\n  ._root_1u76g_1._disableMargins_1u76g_8 {\n    margin: 0;\n  }\n._primary_1h9pf_1 {\n  color: var(--primary-color);\n}\n\n._secondary_1h9pf_5 {\n  color: var(--secondary-color);\n}\n\n._error_1h9pf_9 {\n  color: var(--error-color);\n}\n\n._success_1h9pf_13 {\n  color: var(--success-color);\n}\n\n._warning_1h9pf_17 {\n  color: var(--warning-color);\n}\n\n._info_1h9pf_21 {\n  color: var(--info-color);\n}\n\n._mono_1h9pf_25 {\n  font-family: var(--mono-font-family);\n}\n._root_9g7kd_1 {\n  font-family: var(--font-family);\n  font-size: var(--primary-heading-font-size);\n  font-weight: var(--primary-heading-font-weight);\n  color: var(--primary-heading-color);\n  margin: var(--primary-heading-margin);\n}\n\n  ._root_9g7kd_1._disableMargins_9g7kd_8 {\n    margin: 0;\n  }\n._root_1o2ul_1 {\n  font-family: var(--font-family);\n  font-size: var(--secondary-heading-font-size);\n  font-weight: var(--secondary-heading-font-weight);\n  color: var(--secondary-heading-color);\n  margin: var(--secondary-heading-margin);\n}\n\n  ._root_1o2ul_1._disableMargins_1o2ul_8 {\n    margin: 0;\n  }\n._root_1dv3y_1 {\n  font-family: var(--font-family);\n  font-size: var(--small-heading-font-size);\n  font-weight: var(--small-heading-font-weight);\n  color: var(--small-heading-color);\n  margin: var(--small-heading-margin);\n}\n\n  ._root_1dv3y_1._disableMargins_1dv3y_8 {\n    margin: 0;\n  }\n._root_1dwi9_1 {\n  font-size: var(--sub-font-size);\n  font-weight: var(--sub-font-weight);\n  color: var(--sub-color);\n  margin: var(--sub-margin);\n}\n\n  ._root_1dwi9_1._disableMargins_1dwi9_7 {\n    margin: 0;\n  }\n._thin_1ls8i_1 {\n  font-weight: var(--font-weight-thin);\n}\n\n._bold_1ls8i_5 {\n  font-weight: var(--font-weight-bold);\n}\n\n._extraBold_1ls8i_9 {\n  font-weight: var(--font-weight-extraBold);\n}\n\n._italic_1ls8i_13 {\n  font-style: italic;\n}\n._header_1ffms_1 {\n  padding-left: var(--spacing-md);\n  padding-right: var(--spacing-md);\n}\n._card_o9yl3_1 {\n  padding: var(--card-spacing);\n  position: relative;\n  display: flex;\n  flex-direction: column;\n  background: var(--card-background);\n  color: var(--card-color);\n  border: var(--card-border);\n  border-radius: var(--card-border-radius);\n}\n\n  ._card_o9yl3_1._disablePadding_o9yl3_11 {\n    padding: 0;\n  }\n\n  ._card_o9yl3_1 ._header_o9yl3_15 {\n    display: flex;\n    align-items: center;\n  }\n\n  ._card_o9yl3_1 ._header_o9yl3_15 ._push_o9yl3_19 {\n      flex: 1;\n      margin: 0 0 var(--spacing-md) 0;\n    }\n\n  ._card_o9yl3_1 ._header_o9yl3_15 ._headerText_o9yl3_24 {\n      margin-top: 0;\n      font-size: 14px;\n      font-weight: 500;\n      margin-bottom: var(--spacing-sm);\n    }\n\n  ._card_o9yl3_1 ._content_o9yl3_32 {\n    flex: 1;\n  }\n._card_1e3yj_1 {\n  width: 100%;\n}\n\n._innerCard_1e3yj_5 {\n  max-height: 80vh;\n  overflow-y: auto;\n}\n._chip_df3yr_1 {\n  font-family: var(--chip-font-family);\n  display: inline-flex;\n  align-items: center;\n  border-radius: var(--chip-border-radius);\n  border: 1px solid transparent;\n  box-sizing: border-box;\n  line-height: 1;\n}\n\n  ._chip_df3yr_1 svg {\n    transition: fill 0.15s ease-in-out;\n    will-change: fill;\n  }\n\n  ._chip_df3yr_1 ._startAdornment_df3yr_15 {\n    padding-right: var(--spacing-xs);\n    display: flex;\n    align-items: center;\n  }\n\n  ._chip_df3yr_1 ._content_df3yr_21 {\n    display: flex;\n    align-items: center;\n  }\n\n  ._chip_df3yr_1 ._endAdornment_df3yr_26 {\n    padding-left: var(--spacing-xs);\n    justify-self: flex-end;\n    display: flex;\n    align-items: center;\n  }\n\n  ._chip_df3yr_1._small_df3yr_33 {\n    padding: var(--spacing-xs) var(--spacing-xs);\n    font-size: 10px;\n  }\n\n  ._chip_df3yr_1._small_df3yr_33 svg {\n      width: 10px;\n      height: 10px;\n    }\n\n  ._chip_df3yr_1._medium_df3yr_43 {\n    padding: var(--spacing-sm) var(--spacing-md);\n    font-size: 12px;\n  }\n\n  ._chip_df3yr_1._medium_df3yr_43 svg {\n      width: 12px;\n      height: 12px;\n    }\n\n  ._chip_df3yr_1._large_df3yr_53 {\n    padding: var(--spacing-md) var(--spacing-md);\n    font-size: 14px;\n  }\n\n  ._chip_df3yr_1._large_df3yr_53 svg {\n      width: 14px;\n      height: 14px;\n    }\n\n  ._chip_df3yr_1._filled_df3yr_63 {\n    background-color: var(--chip-background);\n    border-color: var(--chip-background);\n    color: var(--chip-color);\n  }\n\n  ._chip_df3yr_1._filled_df3yr_63 svg {\n      fill: var(--chip-color);\n    }\n\n  ._chip_df3yr_1._filled_df3yr_63._primary_df3yr_72 {\n      background-color: var(--primary-background);\n      border-color: var(--primary-background);\n    }\n\n  ._chip_df3yr_1._filled_df3yr_63._secondary_df3yr_77 {\n      background-color: var(--secondary-background);\n      border-color: var(--secondary-background);\n    }\n\n  ._chip_df3yr_1._filled_df3yr_63._error_df3yr_82 {\n      background-color: var(--error-background);\n      border-color: var(--error-background);\n    }\n\n  ._chip_df3yr_1._filled_df3yr_63._success_df3yr_87 {\n      background-color: var(--success-background);\n      border-color: var(--success-background);\n    }\n\n  ._chip_df3yr_1._filled_df3yr_63._warning_df3yr_92 {\n      background-color: var(--warning-background);\n      border-color: var(--warning-background);\n    }\n\n  ._chip_df3yr_1._filled_df3yr_63._info_df3yr_97 {\n      background-color: var(--info-background);\n      border-color: var(--info-background);\n    }\n\n  ._chip_df3yr_1._outline_df3yr_103 {\n    background: transparent;\n    border-color: var(--chip-background);\n    color: var(--chip-color);\n  }\n\n  ._chip_df3yr_1._outline_df3yr_103 svg {\n      fill: var(--chip-color);\n    }\n\n  ._chip_df3yr_1._outline_df3yr_103._primary_df3yr_72 {\n      border-color: var(--primary-background);\n      color: var(--primary-color);\n    }\n\n  ._chip_df3yr_1._outline_df3yr_103._primary_df3yr_72 svg {\n        fill: var(--primary-color);\n      }\n\n  ._chip_df3yr_1._outline_df3yr_103._secondary_df3yr_77 {\n      border-color: var(--secondary-background);\n      color: var(--secondary-color);\n    }\n\n  ._chip_df3yr_1._outline_df3yr_103._secondary_df3yr_77 svg {\n        fill: var(--secondary-color);\n      }\n\n  ._chip_df3yr_1._outline_df3yr_103._error_df3yr_82 {\n      border-color: var(--error-background);\n      color: var(--error-color);\n    }\n\n  ._chip_df3yr_1._outline_df3yr_103._error_df3yr_82 svg {\n        fill: var(--error-color);\n      }\n\n  ._chip_df3yr_1._outline_df3yr_103._success_df3yr_87 {\n      border-color: var(--success-background);\n      color: var(--success-color);\n    }\n\n  ._chip_df3yr_1._outline_df3yr_103._success_df3yr_87 svg {\n        fill: var(--success-color);\n      }\n\n  ._chip_df3yr_1._outline_df3yr_103._warning_df3yr_92 {\n      border-color: var(--warning-background);\n      color: var(--warning-color);\n    }\n\n  ._chip_df3yr_1._outline_df3yr_103._warning_df3yr_92 svg {\n        fill: var(--warning-color);\n      }\n\n  ._chip_df3yr_1._outline_df3yr_103._info_df3yr_97 {\n      border-color: var(--info-background);\n      color: var(--info-color);\n    }\n\n  ._chip_df3yr_1._outline_df3yr_103._info_df3yr_97 svg {\n        fill: var(--info-color);\n      }\n\n  ._chip_df3yr_1._selectable_df3yr_167:hover {\n      cursor: pointer;\n    }\n\n  ._chip_df3yr_1._selected_df3yr_173._filled_df3yr_63,\n    ._chip_df3yr_1._selected_df3yr_173._filled_df3yr_63:hover {\n      background-color: var(--chip-background-hover);\n      border-color: var(--chip-background-hover);\n    }\n\n  ._chip_df3yr_1._selected_df3yr_173._filled_df3yr_63._primary_df3yr_72,\n      ._chip_df3yr_1._selected_df3yr_173._filled_df3yr_63._primary_df3yr_72:hover,\n      ._chip_df3yr_1._selected_df3yr_173._filled_df3yr_63:hover._primary_df3yr_72,\n      ._chip_df3yr_1._selected_df3yr_173._filled_df3yr_63:hover._primary_df3yr_72:hover {\n        background-color: var(--primary-background-hover);\n        border-color: var(--primary-background-hover);\n      }\n\n  ._chip_df3yr_1._selected_df3yr_173._filled_df3yr_63._secondary_df3yr_77,\n      ._chip_df3yr_1._selected_df3yr_173._filled_df3yr_63._secondary_df3yr_77:hover,\n      ._chip_df3yr_1._selected_df3yr_173._filled_df3yr_63:hover._secondary_df3yr_77,\n      ._chip_df3yr_1._selected_df3yr_173._filled_df3yr_63:hover._secondary_df3yr_77:hover {\n        background-color: var(--secondary-background-hover);\n        border-color: var(--secondary-background-hover);\n      }\n\n  ._chip_df3yr_1._selected_df3yr_173._filled_df3yr_63._error_df3yr_82,\n      ._chip_df3yr_1._selected_df3yr_173._filled_df3yr_63._error_df3yr_82:hover,\n      ._chip_df3yr_1._selected_df3yr_173._filled_df3yr_63:hover._error_df3yr_82,\n      ._chip_df3yr_1._selected_df3yr_173._filled_df3yr_63:hover._error_df3yr_82:hover {\n        background-color: var(--error-background-hover);\n        border-color: var(--error-background-hover);\n      }\n\n  ._chip_df3yr_1._selected_df3yr_173._filled_df3yr_63._success_df3yr_87,\n      ._chip_df3yr_1._selected_df3yr_173._filled_df3yr_63._success_df3yr_87:hover,\n      ._chip_df3yr_1._selected_df3yr_173._filled_df3yr_63:hover._success_df3yr_87,\n      ._chip_df3yr_1._selected_df3yr_173._filled_df3yr_63:hover._success_df3yr_87:hover {\n        background-color: var(--success-background-hover);\n        border-color: var(--success-background-hover);\n      }\n\n  ._chip_df3yr_1._selected_df3yr_173._filled_df3yr_63._warning_df3yr_92,\n      ._chip_df3yr_1._selected_df3yr_173._filled_df3yr_63._warning_df3yr_92:hover,\n      ._chip_df3yr_1._selected_df3yr_173._filled_df3yr_63:hover._warning_df3yr_92,\n      ._chip_df3yr_1._selected_df3yr_173._filled_df3yr_63:hover._warning_df3yr_92:hover {\n        background-color: var(--warning-background-hover);\n        border-color: var(--warning-background-hover);\n      }\n\n  ._chip_df3yr_1._selected_df3yr_173._filled_df3yr_63._info_df3yr_97,\n      ._chip_df3yr_1._selected_df3yr_173._filled_df3yr_63._info_df3yr_97:hover,\n      ._chip_df3yr_1._selected_df3yr_173._filled_df3yr_63:hover._info_df3yr_97,\n      ._chip_df3yr_1._selected_df3yr_173._filled_df3yr_63:hover._info_df3yr_97:hover {\n        background-color: var(--info-background-hover);\n        border-color: var(--info-background-hover);\n      }\n\n  ._chip_df3yr_1._selected_df3yr_173._outline_df3yr_103,\n    ._chip_df3yr_1._selected_df3yr_173._outline_df3yr_103:hover {\n      border-color: var(--chip-background-hover);\n      color: var(--chip-color-hover);\n    }\n\n  ._chip_df3yr_1._selected_df3yr_173._outline_df3yr_103._primary_df3yr_72,\n      ._chip_df3yr_1._selected_df3yr_173._outline_df3yr_103._primary_df3yr_72:hover,\n      ._chip_df3yr_1._selected_df3yr_173._outline_df3yr_103:hover._primary_df3yr_72,\n      ._chip_df3yr_1._selected_df3yr_173._outline_df3yr_103:hover._primary_df3yr_72:hover {\n        border-color: var(--primary-background-hover);\n        color: var(--primary-color-hover);\n      }\n\n  ._chip_df3yr_1._selected_df3yr_173._outline_df3yr_103._secondary_df3yr_77,\n      ._chip_df3yr_1._selected_df3yr_173._outline_df3yr_103._secondary_df3yr_77:hover,\n      ._chip_df3yr_1._selected_df3yr_173._outline_df3yr_103:hover._secondary_df3yr_77,\n      ._chip_df3yr_1._selected_df3yr_173._outline_df3yr_103:hover._secondary_df3yr_77:hover {\n        border-color: var(--secondary-background-hover);\n        color: var(--secondary-color-hover);\n      }\n\n  ._chip_df3yr_1._selected_df3yr_173._outline_df3yr_103._error_df3yr_82,\n      ._chip_df3yr_1._selected_df3yr_173._outline_df3yr_103._error_df3yr_82:hover,\n      ._chip_df3yr_1._selected_df3yr_173._outline_df3yr_103:hover._error_df3yr_82,\n      ._chip_df3yr_1._selected_df3yr_173._outline_df3yr_103:hover._error_df3yr_82:hover {\n        border-color: var(--error-background-hover);\n        color: var(--error-color-hover);\n      }\n\n  ._chip_df3yr_1._selected_df3yr_173._outline_df3yr_103._success_df3yr_87,\n      ._chip_df3yr_1._selected_df3yr_173._outline_df3yr_103._success_df3yr_87:hover,\n      ._chip_df3yr_1._selected_df3yr_173._outline_df3yr_103:hover._success_df3yr_87,\n      ._chip_df3yr_1._selected_df3yr_173._outline_df3yr_103:hover._success_df3yr_87:hover {\n        border-color: var(--success-background-hover);\n        color: var(--success-color-hover);\n      }\n\n  ._chip_df3yr_1._selected_df3yr_173._outline_df3yr_103._warning_df3yr_92,\n      ._chip_df3yr_1._selected_df3yr_173._outline_df3yr_103._warning_df3yr_92:hover,\n      ._chip_df3yr_1._selected_df3yr_173._outline_df3yr_103:hover._warning_df3yr_92,\n      ._chip_df3yr_1._selected_df3yr_173._outline_df3yr_103:hover._warning_df3yr_92:hover {\n        border-color: var(--warning-background-hover);\n        color: var(--warning-color-hover);\n      }\n\n  ._chip_df3yr_1._selected_df3yr_173._outline_df3yr_103._info_df3yr_97,\n      ._chip_df3yr_1._selected_df3yr_173._outline_df3yr_103._info_df3yr_97:hover,\n      ._chip_df3yr_1._selected_df3yr_173._outline_df3yr_103:hover._info_df3yr_97,\n      ._chip_df3yr_1._selected_df3yr_173._outline_df3yr_103:hover._info_df3yr_97:hover {\n        border-color: var(--info-background-hover);\n        color: var(--info-color-hover);\n      }\n\n  ._chip_df3yr_1._disableMargins_df3yr_259 {\n    margin: 0 !important;\n  }\n\n  ._chip_df3yr_1:focus-visible {\n    outline: 1px dashed var(--button-focus);\n    outline-offset: var(--button-focus-offset);\n  }\n._btn_1sw82_1 {\n  border: var(--button-border);\n  border-radius: var(--button-border-radius);\n  display: inline-flex;\n  font-family: var(--button-font-family);\n  font-weight: var(--button-font-weight);\n  white-space: nowrap;\n  -webkit-user-select: none;\n     -moz-user-select: none;\n          user-select: none;\n  align-items: center;\n  justify-content: center;\n  will-change: scale, background-color, color, border-color;\n  transition:\n    background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;\n}\n\n  ._btn_1sw82_1._small_1sw82_17 {\n    font-size: var(--font-size-sm);\n    padding: var(--button-spacing-sm);\n  }\n\n  ._btn_1sw82_1._medium_1sw82_22 {\n    font-size: var(--font-size-md);\n    padding: var(--button-spacing-md);\n  }\n\n  ._btn_1sw82_1._large_1sw82_27 {\n    padding: var(--button-spacing-lg);\n    font-size: var(--font-size-lg);\n  }\n\n  ._btn_1sw82_1._filled_1sw82_32 {\n    color: var(--button-color-on-background);\n  }\n\n  ._btn_1sw82_1._filled_1sw82_32._default_1sw82_35 {\n      background: var(--button-background);\n      border-color: var(--button-background);\n    }\n\n  ._btn_1sw82_1._filled_1sw82_32._default_1sw82_35:hover {\n        background: var(--button-background-hover);\n        border-color: var(--button-background-hover);\n      }\n\n  ._btn_1sw82_1._filled_1sw82_32._primary_1sw82_45 {\n      background: var(--primary-background);\n      border-color: var(--primary-background);\n    }\n\n  ._btn_1sw82_1._filled_1sw82_32._primary_1sw82_45:hover {\n        background: var(--primary-background-hover);\n        border-color: var(--primary-background-hover);\n      }\n\n  ._btn_1sw82_1._filled_1sw82_32._secondary_1sw82_55 {\n      background: var(--secondary-background);\n      border-color: var(--secondary-background);\n    }\n\n  ._btn_1sw82_1._filled_1sw82_32._secondary_1sw82_55:hover {\n        background: var(--secondary-background-hover);\n        border-color: var(--secondary-background-hover);\n      }\n\n  ._btn_1sw82_1._filled_1sw82_32._error_1sw82_65 {\n      background: var(--error-background);\n      border-color: var(--error-background);\n    }\n\n  ._btn_1sw82_1._filled_1sw82_32._error_1sw82_65:hover {\n        background: var(--error-background-hover);\n        border-color: var(--error-background-hover);\n      }\n\n  ._btn_1sw82_1._filled_1sw82_32._success_1sw82_75 {\n      background: var(--success-background);\n      border-color: var(--success-background);\n    }\n\n  ._btn_1sw82_1._filled_1sw82_32._success_1sw82_75:hover {\n        background: var(--success-background-hover);\n        border-color: var(--success-background-hover);\n      }\n\n  ._btn_1sw82_1._filled_1sw82_32._warning_1sw82_85 {\n      background: var(--warning-background);\n      border-color: var(--warning-background);\n    }\n\n  ._btn_1sw82_1._filled_1sw82_32._warning_1sw82_85:hover {\n        background: var(--warning-background-hover);\n        border-color: var(--warning-background-hover);\n      }\n\n  ._btn_1sw82_1._outline_1sw82_96 {\n    background: transparent;\n  }\n\n  ._btn_1sw82_1._outline_1sw82_96._default_1sw82_35 {\n      border-color: var(--button-background);\n      color: var(--button-color);\n    }\n\n  ._btn_1sw82_1._outline_1sw82_96._default_1sw82_35:hover {\n        border-color: var(--button-background-hover);\n        color: var(--button-color-hover);\n      }\n\n  ._btn_1sw82_1._outline_1sw82_96._primary_1sw82_45 {\n      border-color: var(--primary-background);\n      color: var(--primary-color);\n    }\n\n  ._btn_1sw82_1._outline_1sw82_96._primary_1sw82_45:hover {\n        border-color: var(--primary-background-hover);\n        color: var(--primary-color-hover);\n      }\n\n  ._btn_1sw82_1._outline_1sw82_96._secondary_1sw82_55 {\n      border-color: var(--secondary-background);\n      color: var(--secondary-color);\n    }\n\n  ._btn_1sw82_1._outline_1sw82_96._secondary_1sw82_55:hover {\n        border-color: var(--secondary-background-hover);\n        color: var(--secondary-color-hover);\n      }\n\n  ._btn_1sw82_1._outline_1sw82_96._error_1sw82_65 {\n      border-color: var(--error-background);\n      color: var(--error-color);\n    }\n\n  ._btn_1sw82_1._outline_1sw82_96._error_1sw82_65:hover {\n        border-color: var(--error-background-hover);\n        color: var(--error-color-hover);\n      }\n\n  ._btn_1sw82_1._outline_1sw82_96._success_1sw82_75 {\n      border-color: var(--success-background);\n      color: var(--success-color);\n    }\n\n  ._btn_1sw82_1._outline_1sw82_96._success_1sw82_75:hover {\n        border-color: var(--success-background-hover);\n        color: var(--success-color-hover);\n      }\n\n  ._btn_1sw82_1._outline_1sw82_96._warning_1sw82_85 {\n      border-color: var(--warning-background);\n      color: var(--warning-color);\n    }\n\n  ._btn_1sw82_1._outline_1sw82_96._warning_1sw82_85:hover {\n        border-color: var(--warning-background-hover);\n        color: var(--warning-color-hover);\n      }\n\n  ._btn_1sw82_1._text_1sw82_160 {\n    background: transparent;\n    border: solid 1px transparent;\n  }\n\n  ._btn_1sw82_1._text_1sw82_160._default_1sw82_35 {\n      color: var(--button-color);\n    }\n\n  ._btn_1sw82_1._text_1sw82_160._default_1sw82_35:hover {\n        color: var(--button-color-hover);\n      }\n\n  ._btn_1sw82_1._text_1sw82_160._primary_1sw82_45 {\n      color: var(--primary-color);\n    }\n\n  ._btn_1sw82_1._text_1sw82_160._primary_1sw82_45:hover {\n        color: var(--primary-color-hover);\n      }\n\n  ._btn_1sw82_1._text_1sw82_160._secondary_1sw82_55 {\n      color: var(--secondary-color);\n    }\n\n  ._btn_1sw82_1._text_1sw82_160._secondary_1sw82_55:hover {\n        color: var(--secondary-color-hover);\n      }\n\n  ._btn_1sw82_1._text_1sw82_160._error_1sw82_65 {\n      color: var(--error-color);\n    }\n\n  ._btn_1sw82_1._text_1sw82_160._error_1sw82_65:hover {\n        color: var(--error-color-hover);\n      }\n\n  ._btn_1sw82_1._text_1sw82_160._success_1sw82_75 {\n      color: var(--success-color);\n    }\n\n  ._btn_1sw82_1._text_1sw82_160._success_1sw82_75:hover {\n        color: var(--success-color-hover);\n      }\n\n  ._btn_1sw82_1._text_1sw82_160._warning_1sw82_85 {\n      color: var(--warning-color);\n    }\n\n  ._btn_1sw82_1._text_1sw82_160._warning_1sw82_85:hover {\n        color: var(--warning-color-hover);\n      }\n\n  ._btn_1sw82_1._fullWidth_1sw82_213 {\n    display: block;\n    width: 100%;\n  }\n\n  ._btn_1sw82_1._disableMargins_1sw82_218 {\n    margin: 0;\n  }\n\n  ._btn_1sw82_1._disablePadding_1sw82_222 {\n    padding: 0;\n  }\n\n  ._btn_1sw82_1:not([disabled]) {\n    cursor: pointer;\n  }\n\n  ._btn_1sw82_1[disabled] {\n    cursor: not-allowed;\n  }\n\n  ._btn_1sw82_1[disabled]._filled_1sw82_32,\n    ._btn_1sw82_1[disabled]._filled_1sw82_32:hover {\n      background-color: var(--disabled-background);\n      border-color: var(--disabled-background);\n      color: var(--button-disabled-color-on-background);\n    }\n\n  ._btn_1sw82_1[disabled]._outline_1sw82_96,\n    ._btn_1sw82_1[disabled]._outline_1sw82_96:hover {\n      border-color: var(--disabled-background);\n      color: var(--disabled-color);\n    }\n\n  ._btn_1sw82_1[disabled]._text_1sw82_160,\n    ._btn_1sw82_1[disabled]._text_1sw82_160:hover {\n      color: var(--disabled-color);\n    }\n\n  ._btn_1sw82_1:focus-visible {\n    outline: 1px dashed var(--button-focus);\n    outline-offset: var(--button-focus-offset);\n  }\n\n  ._btn_1sw82_1 ._startAdornment_1sw82_257,\n  ._btn_1sw82_1 ._endAdornment_1sw82_258 {\n    display: flex;\n  }\n\n  ._btn_1sw82_1 ._startAdornment_1sw82_257._small_1sw82_17 svg, ._btn_1sw82_1 ._endAdornment_1sw82_258._small_1sw82_17 svg {\n        width: var(--button-adornment-size-sm);\n        height: var(--button-adornment-size-sm);\n      }\n\n  ._btn_1sw82_1 ._startAdornment_1sw82_257._medium_1sw82_22 svg, ._btn_1sw82_1 ._endAdornment_1sw82_258._medium_1sw82_22 svg {\n        width: var(--button-adornment-size-md);\n        height: var(--button-adornment-size-md);\n      }\n\n  ._btn_1sw82_1 ._startAdornment_1sw82_257._large_1sw82_27 svg, ._btn_1sw82_1 ._endAdornment_1sw82_258._large_1sw82_27 svg {\n        width: var(--button-adornment-size-lg);\n        height: var(--button-adornment-size-lg);\n      }\n\n  ._btn_1sw82_1 ._startAdornment_1sw82_257 {\n    padding-right: calc(var(--list-item-spacing) / 2);\n  }\n\n  ._btn_1sw82_1 ._endAdornment_1sw82_258 {\n    padding-left: calc(var(--list-item-spacing) / 2);\n  }\n\n  ._btn_1sw82_1._group_1sw82_291:not(:first-child):not(:last-child) {\n      border-radius: 0;\n      border-right: 0;\n    }\n\n  ._btn_1sw82_1._group_1sw82_291:not(:first-child):not(:last-child)._outline_1sw82_96 {\n        border-left: var(--button-border);\n      }\n\n  ._btn_1sw82_1._group_1sw82_291:not(:first-child):not(:last-child)._text_1sw82_160 {\n        border-right: var(--button-border);\n        border-left-color: transparent;\n      }\n\n  ._btn_1sw82_1._group_1sw82_291:first-child:not(:only-child) {\n      border-radius: var(--button-border-radius) 0 0 var(--button-border-radius);\n      border-right: 0;\n    }\n\n  ._btn_1sw82_1._group_1sw82_291:first-child:not(:only-child)._text_1sw82_160 {\n        border-right: var(--button-border);\n      }\n\n  ._btn_1sw82_1._group_1sw82_291:last-child:not(:only-child) {\n      border-radius: 0 var(--button-border-radius) var(--button-border-radius) 0;\n    }\n._deleteButton_101ah_1._small_101ah_2 {\n    line-height: 10px;\n    max-height: 10px;\n  }\n  ._deleteButton_101ah_1._medium_101ah_7 {\n    line-height: 12px;\n    max-height: 12px;\n  }\n  ._deleteButton_101ah_1._large_101ah_12 {\n    line-height: 14px;\n    max-height: 14px;\n  }\n._chip_a0oed_1 {\n  white-space: nowrap;\n  border-radius: var(--border-radius-sm);\n}\n\n  ._chip_a0oed_1 kbd {\n    font-family: var(--mono-font-family);\n  }\n\n._container_a0oed_10 {\n  display: inline-flex;\n  gap: var(--spacing-sm);\n  align-items: center;\n}\n._item_1a75l_1 {\n  transition:\n    color 0.2s ease-in-out, background 0.2s ease-in-out;\n}\n  ._item_1a75l_1._clickable_1a75l_5 {\n    cursor: pointer;\n  }\n  ._item_1a75l_1._clickable_1a75l_5:hover,\n  ._item_1a75l_1._active_1a75l_10 {\n    background: var(--primary-background);\n    color: var(--primary-color-hover);\n  }\n._section_1bd8v_1._first_1bd8v_2 {\n    padding-top: var(--spacing-md);\n  }\n._container_tbkyo_1 {\n  will-change: height, opacity;\n  overflow: hidden;\n}\n._divider_6jom2_1 {\n  background: var(--divider-background);\n  border: none;\n}\n\n  ._divider_6jom2_1._horizontal_6jom2_5 {\n    height: 1px;\n    width: 100%;\n    margin: var(--divider-spacing) 0;\n  }\n\n  ._divider_6jom2_1._vertical_6jom2_11 {\n    width: 1px;\n    height: 100%;\n    margin: 0 var(--divider-spacing);\n  }\n\n  ._divider_6jom2_1._horizontal_6jom2_5._disableMargins_6jom2_19, ._divider_6jom2_1._vertical_6jom2_11._disableMargins_6jom2_19 {\n      margin: 0;\n    }\n._container_1j3il_1 {\n  margin-bottom: var(--block-spacing);\n}\n\n  ._container_1j3il_1._disableMargin_1j3il_4 {\n    margin-bottom: 0;\n  }\n\n  ._container_1j3il_1 ._label_1j3il_8 {\n    font-size: var(--block-label-size);\n    font-size: var(--block-label-weight);\n    display: block;\n  }\n\n  ._container_1j3il_1 ._content_1j3il_14 {\n    word-break: break-all;\n  }\n\n  ._container_1j3il_1._horizontal_1j3il_18 {\n    display: flex;\n    flex-direction: row;\n    align-items: baseline;\n  }\n\n  ._container_1j3il_1._horizontal_1j3il_18 ._label_1j3il_8 {\n      margin-right: var(--block-label-spacing);\n      white-space: nowrap;\n    }\n\n  ._container_1j3il_1._horizontal_1j3il_18._centerAlign_1j3il_28 {\n      align-items: center;\n    }\n\n  ._container_1j3il_1._horizontal_1j3il_18._endAlign_1j3il_32 {\n      align-items: flex-end;\n    }\n\n  ._container_1j3il_1._horizontal_1j3il_18._centerAlign_1j3il_28 ._content_1j3il_14, ._container_1j3il_1._horizontal_1j3il_18._startAlign_1j3il_37 ._content_1j3il_14 {\n        flex: 1;\n        justify-content: flex-start;\n        display: flex;\n      }\n\n  ._container_1j3il_1._vertical_1j3il_46 ._label_1j3il_8 {\n      margin-bottom: var(--block-label-spacing);\n    }\n\n  ._container_1j3il_1._vertical_1j3il_46 ._label_1j3il_8._disablePadding_1j3il_50 {\n        padding: 0;\n      }\n._container_14mbr_1 {\n  display: flex;\n  align-items: center;\n  gap: var(--stack-gap);\n}\n\n  ._container_14mbr_1._inline_14mbr_6 {\n    display: inline-flex;\n  }\n\n  ._container_14mbr_1._dense_14mbr_10 {\n    gap: var(--stack-dense-gap);\n  }\n\n  ._container_14mbr_1._column_14mbr_14 {\n    flex-direction: column;\n  }\n\n  ._container_14mbr_1._row_14mbr_18 {\n    flex-direction: row;\n  }\n\n  ._container_14mbr_1._columnReverse_14mbr_22 {\n    flex-direction: column-reverse;\n  }\n\n  ._container_14mbr_1._rowReverse_14mbr_26 {\n    flex-direction: row-reverse;\n  }\n\n  ._container_14mbr_1._startAlign_14mbr_30 {\n    align-items: flex-start;\n  }\n\n  ._container_14mbr_1._endAlign_14mbr_34 {\n    align-items: flex-end;\n  }\n\n  ._container_14mbr_1._stretchAlign_14mbr_38 {\n    align-items: stretch;\n  }\n\n  ._container_14mbr_1._endJustify_14mbr_42 {\n    justify-content: flex-end;\n  }\n\n  ._container_14mbr_1._centerJustify_14mbr_46 {\n    justify-content: center;\n  }\n\n  ._container_14mbr_1._spaceBetweenJustify_14mbr_50 {\n    justify-content: space-between;\n  }\n._up_17n5q_1 {\n  transform: rotate(180deg);\n}\n\n._left_17n5q_5 {\n  transform: rotate(90deg);\n}\n\n._right_17n5q_9 {\n  transform: rotate(-90deg);\n}\n._container_1masa_1 {\n  padding: 0;\n  margin: 0;\n  list-style: none;\n  position: relative;\n}\n\n._tree_1masa_8 {\n  border: 1px solid transparent;\n  padding: 3px 12px 4px;\n}\n\n._arrow_1masa_13 {\n  width: 12px;\n  height: 12px;\n  fill: var(--white);\n}\n._node_1solv_1 {\n  padding-top: var(--spacing-xs);\n  margin: 0;\n  list-style: none;\n}\n\n  ._node_1solv_1 ._collapsed_1solv_6 {\n    transform: rotate(-90deg);\n  }\n\n  ._node_1solv_1._leaf_1solv_10 ._label_1solv_11 {\n      padding-left: 17px;\n    }\n\n  ._node_1solv_1._disabled_1solv_16 > ._label_1solv_11,\n    ._node_1solv_1._disabled_1solv_16 > ._button_1solv_18 {\n      opacity: 0.6;\n    }\n\n  ._node_1solv_1 ._button_1solv_18 {\n    padding: 0;\n    margin: 0 3px 0 0;\n    min-width: auto;\n    min-height: auto;\n    width: auto;\n    height: auto;\n    transition: transform 100ms ease-in-out;\n  }\n\n  ._node_1solv_1 ._button_1solv_18 ._icon_1solv_32 {\n      vertical-align: middle;\n      display: block;\n      height: 8px;\n      width: 8px;\n      margin: var(--spacing-xs);\n      fill: #fff;\n    }\n\n._subtree_1solv_43 {\n  list-style: none;\n  position: relative;\n  padding: 0;\n  margin: 5px 0 0 20px;\n}\n\n._subtree_1solv_43 ._node_1solv_1:first-child {\n      padding-top: 0;\n    }\n\n._subtree_1solv_43 ._node_1solv_1:last-child {\n      padding-bottom: 0;\n    }\n\n._nodeBlock_1solv_60 {\n  display: flex;\n  align-items: center;\n}\n._xs_1vu5j_1 {\n  height: var(--spacing-xs);\n}\n\n._sm_1vu5j_5 {\n  height: var(--spacing-sm);\n}\n\n._md_1vu5j_9 {\n  height: var(--spacing-md);\n}\n\n._lg_1vu5j_13 {\n  height: var(--spacing-lg);\n}\n\n._xl_1vu5j_17 {\n  height: var(--spacing-xl);\n}\n\n._xxl_1vu5j_21 {\n  height: var(--spacing-xxl);\n}\n._pager_bw1ct_1 {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n\n  ._pager_bw1ct_1 svg {\n    height: 20px;\n    width: 20px;\n  }\n\n  ._pager_bw1ct_1 ._page_bw1ct_1 {\n    padding: 0 var(--spacing-sm);\n  }\n\n  ._pager_bw1ct_1 ._page_bw1ct_1._active_bw1ct_14 {\n      color: var(--input-color);\n    }\n\n._pagesContainer_bw1ct_20 {\n  display: flex;\n  align-items: center;\n}\n\n._pagerDisplayItems_bw1ct_25 {\n  color: var(--gray-100);\n  margin-right: var(--spacing-sm);\n}\n._week_1owo4_1 {\n  --button-border-radius: var(--calendar-day-radius);\n  --button-color: var(--calendar-day-color);\n\n  display: grid;\n  grid-template-columns: repeat(7, 1fr);\n  grid-gap: var(--calendar-gap);\n  gap: var(--calendar-gap);\n  margin-bottom: var(--calendar-gap);\n}\n\n  ._week_1owo4_1 ._day_1owo4_10 {\n    flex: 1;\n    transition: border 100ms ease-in-out;\n    padding: var(--calendar-spacing);\n    text-align: center;\n  }\n\n  ._week_1owo4_1 ._day_1owo4_10:hover:not(:disabled) {\n      border-color: var(--calendar-day-border-hover);\n    }\n\n  ._week_1owo4_1 ._day_1owo4_10:not(._range_1owo4_20)._outside_1owo4_20 {\n      color: color-mix(in srgb, var(--button-color) 60%, transparent);\n    }\n\n  ._week_1owo4_1 ._day_1owo4_10._selectedDay_1owo4_24 {\n      background: var(--calendar-day-background-selected) !important;\n      border-color: var(--calendar-day-border-selected) !important;\n    }\n\n  ._week_1owo4_1 ._day_1owo4_10._selectedDay_1owo4_24 {\n      /* !important to override default button styling */\n    }\n\n  ._week_1owo4_1 ._day_1owo4_10._selectedDay_1owo4_24:hover {\n        border-color: var(--calendar-day-border-hover) !important;\n      }\n\n  ._week_1owo4_1 ._day_1owo4_10._range_1owo4_20 {\n      background: var(--calendar-day-background-selected) !important;\n      border-color: var(--calendar-day-border-selected) !important;\n    }\n\n  ._week_1owo4_1 ._day_1owo4_10._range_1owo4_20 {\n      border-radius: 0;\n      /* !important to override default button styling */\n    }\n\n  ._week_1owo4_1 ._day_1owo4_10._range_1owo4_20:hover {\n        border-color: var(--calendar-day-border-hover) !important;\n      }\n\n  ._week_1owo4_1 ._day_1owo4_10._startRangeDate_1owo4_45 {\n      border-top-left-radius: var(--calendar-day-radius);\n    }\n\n  ._week_1owo4_1 ._day_1owo4_10._roundStartDateBottom_1owo4_49 {\n      border-bottom-left-radius: var(--calendar-day-radius);\n    }\n\n  ._week_1owo4_1 ._day_1owo4_10._endRangeDate_1owo4_53 {\n      border-bottom-right-radius: var(--calendar-day-radius);\n    }\n\n  ._week_1owo4_1 ._day_1owo4_10._roundEndDateTop_1owo4_57 {\n      border-top-right-radius: var(--calendar-day-radius);\n    }\n\n._weekLabels_1owo4_63 {\n  display: grid;\n  grid-template-columns: repeat(7, 1fr);\n  grid-gap: var(--spacing-sm);\n  gap: var(--spacing-sm);\n  width: 100%;\n  padding: var(--spacing-md) 0;\n  border-top: 1px solid var(--calendar-divider);\n}\n\n._weekLabels_1owo4_63 ._dayOfWeek_1owo4_71 {\n    text-align: center;\n    font-weight: var(--font-weight-bold);\n  }\n._months_quk7b_1 {\n  display: grid;\n  grid-template-columns: 1fr 1fr 1fr 1fr;\n  grid-column-gap: var(--spacing-md);\n  -moz-column-gap: var(--spacing-md);\n       column-gap: var(--spacing-md);\n}\n\n  ._months_quk7b_1 ._month_quk7b_1 {\n    padding: 6px;\n  }\n._years_188b7_1 {\n  display: grid;\n  grid-template-columns: 1fr 1fr 1fr 1fr;\n  grid-column-gap: var(--spacing-md);\n  -moz-column-gap: var(--spacing-md);\n       column-gap: var(--spacing-md);\n}\n\n  ._years_188b7_1 ._year_188b7_1 {\n    padding: 6px;\n  }\n._container_1bnlb_1 {\n  overflow: hidden;\n}\n\n  ._container_1bnlb_1 ._header_1bnlb_4 {\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    margin-bottom: var(--spacing-sm);\n  }\n._container_3rvg5_1 {\n  overflow: hidden;\n}\n\n  ._container_3rvg5_1 ._header_3rvg5_4 {\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    margin-bottom: var(--spacing-sm);\n  }\n\n  ._container_3rvg5_1 ._monthLabel_3rvg5_11 {\n    display: flex;\n    flex-grow: 1;\n    justify-content: space-around;\n    gap: var(--spacing-lg);\n  }\n\n  ._container_3rvg5_1 ._calendars_3rvg5_18 {\n    display: flex;\n    gap: var(--spacing-lg);\n  }\n._container_1m42y_1 {\n  display: inline-flex;\n  align-items: center;\n  width: 100%;\n}\n\n  ._container_1m42y_1 ._label_1m42y_6 {\n    color: var(--checkbox-label-color);\n    margin-left: var(--spacing-md);\n    width: 100%;\n  }\n\n  ._container_1m42y_1 ._label_1m42y_6._clickable_1m42y_11 {\n      cursor: pointer;\n    }\n\n._check_1m42y_17 {\n  stroke: var(--checkbox-check-stroke);\n}\n\n._checkbox_1m42y_21 {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n}\n\n._checkbox_1m42y_21._small_1m42y_27 {\n    min-width: 14px;\n    min-height: 14px;\n  }\n\n._checkbox_1m42y_21._medium_1m42y_32 {\n    min-width: 16px;\n    min-height: 16px;\n  }\n\n._checkbox_1m42y_21._large_1m42y_37 {\n    min-width: 20px;\n    min-height: 20px;\n  }\n\n._checkbox_1m42y_21:focus-visible {\n    outline: none;\n  }\n\n._checkbox_1m42y_21._disabled_1m42y_46 {\n    cursor: not-allowed;\n    opacity: 0.75;\n  }\n._container_1o1oi_1 {\n  background: var(--input-background);\n  border-radius: var(--input-border-radius);\n  border: var(--input-border);\n  display: flex;\n  flex-direction: row;\n  align-items: center;\n  flex-wrap: nowrap;\n  transition:\n    border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;\n  box-sizing: border-box;\n}\n\n  ._container_1o1oi_1._small_1o1oi_14 {\n    padding: var(--input-spacing-sm);\n  }\n\n  ._container_1o1oi_1._medium_1o1oi_18 {\n    padding: var(--input-spacing-md);\n  }\n\n  ._container_1o1oi_1._large_1o1oi_22 {\n    padding: var(--input-spacing-lg);\n  }\n\n  ._container_1o1oi_1:focus-within,\n  ._container_1o1oi_1:focus-visible {\n    border-color: var(--input-border-focus);\n    outline: none;\n  }\n\n  ._container_1o1oi_1._error_1o1oi_32 {\n    border-color: var(--error-background);\n  }\n\n  ._container_1o1oi_1._fullWidth_1o1oi_36 {\n    width: 100%;\n  }\n\n  ._container_1o1oi_1._fullWidth_1o1oi_36 ._input_1o1oi_39 {\n      width: 100%;\n    }\n\n  ._container_1o1oi_1 ._startAdornment_1o1oi_44,\n  ._container_1o1oi_1 ._endAdornment_1o1oi_45 {\n    display: flex;\n  }\n\n  ._container_1o1oi_1 ._startAdornment_1o1oi_44 svg, ._container_1o1oi_1 ._endAdornment_1o1oi_45 svg {\n      width: var(--input-adornment-size);\n      height: var(--input-adornment-size);\n      fill: var(--input-adornment-fill);\n    }\n\n  ._container_1o1oi_1 ._startAdornment_1o1oi_44 {\n    padding-right: calc(var(--list-item-spacing) / 2);\n  }\n\n  ._container_1o1oi_1 ._endAdornment_1o1oi_45 {\n    padding-left: calc(var(--list-item-spacing) / 2);\n  }\n\n  ._container_1o1oi_1 ._input_1o1oi_39 {\n    flex: 1;\n    font-weight: normal;\n    background: none;\n    font-family: var(--font-family);\n    border: none;\n    color: var(--input-color);\n    padding: 0;\n    margin: 0;\n  }\n\n  ._container_1o1oi_1 ._input_1o1oi_39::-moz-placeholder {\n      color: var(--input-color-placeholder);\n      font-style: var(--input-placeholder-style);\n    }\n\n  ._container_1o1oi_1 ._input_1o1oi_39::placeholder {\n      color: var(--input-color-placeholder);\n      font-style: var(--input-placeholder-style);\n    }\n\n  ._container_1o1oi_1 ._input_1o1oi_39:focus {\n      outline: none;\n    }\n\n  ._container_1o1oi_1 ._input_1o1oi_39:-moz-read-only {\n      cursor: not-allowed;\n      color: var(--disabled-color);\n    }\n\n  ._container_1o1oi_1 ._input_1o1oi_39[disabled],\n    ._container_1o1oi_1 ._input_1o1oi_39:read-only {\n      cursor: not-allowed;\n      color: var(--disabled-color);\n    }\n._input_el63h_1 {\n  background: none;\n  border: 0;\n  outline: none;\n  color: var(--input-color);\n}\n._container_1v4a3_1 {\n  width: 100%;\n  box-sizing: border-box;\n  line-height: 1;\n}\n\n  ._container_1v4a3_1 ._label_1v4a3_6 {\n    color: var(--radio-label-color);\n    margin-left: var(--spacing-md);\n    width: 100%;\n    vertical-align: middle;\n  }\n\n  ._container_1v4a3_1 ._label_1v4a3_6._clickable_1v4a3_12 {\n      cursor: pointer;\n    }\n\n._radio_1v4a3_18 {\n  border: var(--radio-stroke-size) solid var(--radio-stroke);\n  background-color: var(--radio-background);\n  border-radius: 100%;\n  will-change: border-color;\n  display: inline-flex;\n  justify-content: center;\n  align-items: center;\n  box-sizing: border-box;\n  vertical-align: middle;\n}\n\n._radio_1v4a3_18:hover {\n    cursor: pointer;\n  }\n\n._radio_1v4a3_18 ._indicator_1v4a3_33 {\n    border-radius: 100%;\n    background-color: var(--radio-indicator-active);\n  }\n\n._radio_1v4a3_18._checked_1v4a3_38 {\n    border-color: var(--radio-stroke-active);\n  }\n\n._radio_1v4a3_18._small_1v4a3_42 {\n    width: 14px;\n    height: 14px;\n  }\n\n._radio_1v4a3_18._small_1v4a3_42 ._indicator_1v4a3_33 {\n      width: 6px;\n      width: var(--radio-indicator-size, 6px);\n      height: 6px;\n      height: var(--radio-indicator-size, 6px);\n    }\n\n._radio_1v4a3_18._medium_1v4a3_52 {\n    width: 16px;\n    height: 16px;\n  }\n\n._radio_1v4a3_18._medium_1v4a3_52 ._indicator_1v4a3_33 {\n      width: 8px;\n      width: var(--radio-indicator-size, 8px);\n      height: 8px;\n      height: var(--radio-indicator-size, 8px);\n    }\n\n._radio_1v4a3_18._large_1v4a3_62 {\n    width: 20px;\n    height: 20px;\n  }\n\n._radio_1v4a3_18._large_1v4a3_62 ._indicator_1v4a3_33 {\n      width: 10px;\n      width: var(--radio-indicator-size, 10px);\n      height: 10px;\n      height: var(--radio-indicator-size, 10px);\n    }\n\n._radio_1v4a3_18._disabled_1v4a3_72 {\n    cursor: not-allowed;\n    opacity: 0.6;\n  }\n._range_16tdb_1 {\n  position: relative;\n  box-sizing: border-box;\n  width: 100%;\n  height: var(--range-track-size);\n  background: var(--range-track-background);\n  border-radius: var(--range-track-border-radius);\n}\n\n._handleDrag_16tdb_10 {\n  position: absolute;\n  top: calc(-1 * (var(--range-handle-size) - var(--range-track-size)) / 2);\n  left: calc(-1 * var(--range-handle-size) / 2);\n  width: var(--range-handle-size);\n  height: var(--range-handle-size);\n  background: var(--range-handle-background);\n  border-radius: var(--range-handle-border-radius);\n}\n\n/* The hidden input used for keyboard controls */\n\n._handleDrag_16tdb_10 input {\n    position: absolute;\n    left: -9999px;\n  }\n\n._handle_16tdb_10 {\n  cursor: pointer;\n  display: inline-block;\n  position: relative;\n  height: 100%;\n  width: 100%;\n}\n\n._tooltip_16tdb_34 {\n  position: absolute;\n  top: -45px;\n  left: 50%;\n  transform: translateX(-50%);\n  border-radius: var(--border-radius-md);\n  padding: var(--spacing-md);\n  white-space: nowrap;\n  text-align: center;\n  background: var(--tooltip-background);\n  color: var(--tooltip-color);\n}\n\n._rangeHighlight_16tdb_47 {\n  pointer-events: none;\n  height: var(--range-track-size);\n  background: var(--range-track-active-background);\n}\n\n._rangeDisabled_16tdb_53 {\n  opacity: 0.7;\n}\n\n._rangeDisabled_16tdb_53 ._handle_16tdb_10 {\n    cursor: not-allowed;\n  }\n._container_1o7j1_1 {\n  display: flex;\n}\n\n  ._container_1o7j1_1 div {\n    border-radius: 50%;\n    background: var(--loader-background);\n  }\n\n  ._container_1o7j1_1._small_1o7j1_9 div {\n    margin-left: var(--spacing-sm);\n    height: 3px;\n    width: 3px;\n  }\n\n  ._container_1o7j1_1._medium_1o7j1_15 div {\n    margin-left: var(--spacing-md);\n    height: 5px;\n    width: 5px;\n  }\n\n  ._container_1o7j1_1._large_1o7j1_21 div {\n    margin-left: var(--spacing-lg);\n    height: 7px;\n    width: 7px;\n  }\n._tag_sipe1_1 {\n  margin-top: 1px;\n  margin-bottom: 1px;\n  border: solid 1px transparent;\n  cursor: pointer;\n  background: var(--select-chip-background);\n  border: var(--select-chip-border);\n  color: var(--select-chip-color);\n  display: flex;\n  padding: 3px 4px;\n  margin-right: 4px;\n  font-size: 12px;\n  border-radius: var(--select-chip-border-radius);\n  line-height: 1;\n  box-sizing: border-box;\n}\n\n  ._tag_sipe1_1._disabled_sipe1_17 {\n    cursor: not-allowed;\n  }\n\n  ._tag_sipe1_1:focus {\n    border: solid 1px transparent;\n  }\n\n  ._tag_sipe1_1 button {\n    cursor: pointer;\n    background: none;\n    border: none;\n    line-height: 0;\n    padding: 0;\n    margin-left: 4px;\n  }\n\n  ._tag_sipe1_1:focus {\n    outline: none;\n  }\n\n  ._tag_sipe1_1 svg {\n    height: 12px;\n    width: 12px;\n    vertical-align: baseline;\n    pointer-events: none;\n    fill: var(--select-chip-icon-color);\n  }\n._container_umshi_1 {\n  display: flex;\n  flex-wrap: nowrap;\n  background: var(--select-input-background);\n  border-radius: var(--select-input-border-radius);\n  border: var(--select-input-border);\n  align-items: center;\n  padding: var(--select-input-spacing);\n  min-height: 34px;\n  box-sizing: border-box;\n}\n\n  ._container_umshi_1._open_umshi_12 {\n    border-radius: var(--select-input-border-radius)\n      var(--select-input-border-radius) 0 0;\n  }\n\n  ._container_umshi_1:not(._disabled_umshi_17) {\n    cursor: text;\n  }\n\n  ._container_umshi_1._disabled_umshi_17 ._expand_umshi_22,\n    ._container_umshi_1._disabled_umshi_17 ._input_umshi_23 {\n      cursor: not-allowed;\n    }\n\n  ._container_umshi_1._unfilterable_umshi_28 ._input_umshi_23 {\n      caret-color: transparent;\n    }\n\n  ._container_umshi_1._error_umshi_34 {\n    border: 1px solid var(--select-input-error);\n  }\n\n  ._container_umshi_1 ._inputContainer_umshi_38 {\n    display: flex;\n    flex: 1;\n    align-items: center;\n    overflow: hidden;\n  }\n\n  ._container_umshi_1 ._input_umshi_23 {\n    padding: 0;\n    background: transparent;\n    border: none;\n    font-size: 13px;\n    color: var(--select-input-color);\n    font-family: inherit;\n    vertical-align: middle;\n  }\n\n  ._container_umshi_1 ._input_umshi_23[disabled] {\n      color: var(--select-input-disabled-color);\n    }\n\n  ._container_umshi_1 ._input_umshi_23::-moz-placeholder {\n      color: var(--select-input-placeholder-color);\n    }\n\n  ._container_umshi_1 ._input_umshi_23::placeholder {\n      color: var(--select-input-placeholder-color);\n    }\n\n  ._container_umshi_1 ._input_umshi_23:focus {\n      outline: none;\n    }\n\n  ._container_umshi_1 ._input_umshi_23:-moz-read-only {\n      cursor: not-allowed;\n    }\n\n  ._container_umshi_1 ._input_umshi_23:read-only {\n      cursor: not-allowed;\n    }\n\n  ._container_umshi_1._single_umshi_71 ._prefix_umshi_72 {\n      padding: 5px 0;\n      overflow: hidden;\n      white-space: nowrap;\n      text-overflow: ellipsis;\n      max-width: 100%;\n    }\n\n  ._container_umshi_1._single_umshi_71 ._inputContainer_umshi_38 {\n      flex-wrap: nowrap;\n    }\n\n  ._container_umshi_1._single_umshi_71 ._inputContainer_umshi_38 > div,\n      ._container_umshi_1._single_umshi_71 ._inputContainer_umshi_38 ._input_umshi_23 {\n        max-width: 100%;\n      }\n\n  ._container_umshi_1._single_umshi_71 ._input_umshi_23 {\n      width: 100%;\n      text-overflow: ellipsis;\n    }\n\n  ._container_umshi_1._multiple_umshi_95 ._prefix_umshi_72 {\n      display: contents;\n    }\n\n  ._container_umshi_1._multiple_umshi_95 ._inputContainer_umshi_38 {\n      flex-wrap: wrap;\n    }\n\n  ._container_umshi_1 ._prefix_umshi_72 {\n    align-items: center;\n  }\n\n  ._container_umshi_1 ._suffix_umshi_109 {\n    display: flex;\n    margin-left: auto;\n  }\n\n  ._container_umshi_1 ._suffix_umshi_109 svg {\n      height: 20px;\n      width: 20px;\n      vertical-align: middle;\n    }\n\n  ._container_umshi_1 ._suffix_umshi_109 ._loader_umshi_119 {\n      margin-right: 10px;\n      display: flex;\n      align-items: center;\n    }\n\n  ._container_umshi_1 ._suffix_umshi_109 ._btn_umshi_125 {\n      padding: 0;\n      border: none;\n      background: none;\n    }\n\n  ._container_umshi_1 ._suffix_umshi_109 ._btn_umshi_125:focus-visible {\n        outline: 1px dashed var(--button-focus);\n        outline-offset: var(--button-focus-offset);\n      }\n\n  ._container_umshi_1 ._suffix_umshi_109 ._btn_umshi_125:not([disabled]) {\n        cursor: pointer;\n      }\n\n  ._container_umshi_1 ._suffix_umshi_109 ._btn_umshi_125 svg {\n        vertical-align: middle;\n        fill: var(--select-input-icon-color);\n      }\n\n  ._container_umshi_1 ._suffix_umshi_109 ._btn_umshi_125._expand_umshi_22 svg {\n          height: 18px;\n          width: 18px;\n        }\n\n  ._container_umshi_1 ._suffix_umshi_109 ._btn_umshi_125._refresh_umshi_151,\n      ._container_umshi_1 ._suffix_umshi_109 ._btn_umshi_125._close_umshi_152 {\n        margin-right: 5px;\n      }\n\n  ._container_umshi_1 ._suffix_umshi_109 ._btn_umshi_125._refresh_umshi_151 svg, ._container_umshi_1 ._suffix_umshi_109 ._btn_umshi_125._close_umshi_152 svg {\n          height: 16px;\n          width: 16px;\n        }\n._menu_2ruru_1 {\n  background: var(--select-menu-background);\n  text-align: center;\n  will-change: transform, opacity;\n  border-radius: var(--select-menu-border-radius);\n  min-width: 112px;\n  max-height: 300px;\n  overflow-y: auto;\n  text-align: left;\n  border: var(--select-menu-border);\n  box-sizing: border-box;\n}\n\n  ._menu_2ruru_1 ._groupItem_2ruru_13 {\n    border: none;\n    padding: 0;\n  }\n\n  ._menu_2ruru_1 ._groupItem_2ruru_13 h3 {\n      font-size: 12px;\n      margin: 0;\n      font-weight: bold;\n      text-transform: uppercase;\n      padding: var(--spacing-md) 0 var(--spacing-xs) var(--spacing-sm);\n      color: var(--select-menu-group-color);\n    }\n\n  ._menu_2ruru_1 ._option_2ruru_27 {\n    color: var(--select-menu-item-color);\n    padding: var(--select-menu-item-spacing);\n  }\n\n  ._menu_2ruru_1 ._option_2ruru_27:hover,\n    ._menu_2ruru_1 ._option_2ruru_27._active_2ruru_32 {\n      color: var(--select-menu-item-active-color);\n      background: var(--select-menu-item-active-background);\n    }\n\n  ._menu_2ruru_1 ._option_2ruru_27._selected_2ruru_37 {\n      color: var(--select-menu-item-selected-color);\n      background: var(--select-menu-item-selected-background);\n    }\n._root_1nf4s_1 {\n  background: var(--textarea-background);\n  border-radius: var(--textarea-border-radius);\n  border: var(--textarea-border);\n  display: flex;\n  flex-direction: row;\n  align-items: center;\n  flex-wrap: nowrap;\n  transition:\n    border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;\n  box-sizing: border-box;\n}\n\n  ._root_1nf4s_1:focus,\n  ._root_1nf4s_1:focus-within,\n  ._root_1nf4s_1:focus-visible {\n    border-color: var(--textarea-border-focus);\n    outline: none;\n  }\n\n._input_1nf4s_22 {\n  height: 100%;\n  resize: none;\n  font-weight: normal;\n  background: none;\n  font-family: var(--font-family);\n  border: none;\n  color: var(--textarea-color);\n  padding: 0;\n  margin: 0;\n}\n\n._input_1nf4s_22:focus {\n    outline: none;\n  }\n\n._input_1nf4s_22::-moz-placeholder {\n    color: var(--textarea-color-placeholder);\n    font-style: var(--textarea-placeholder-style);\n  }\n\n._input_1nf4s_22::placeholder {\n    color: var(--textarea-color-placeholder);\n    font-style: var(--textarea-placeholder-style);\n  }\n\n._input_1nf4s_22:-moz-read-only {\n    cursor: not-allowed;\n    color: var(--disabled-color);\n  }\n\n._input_1nf4s_22[disabled],\n  ._input_1nf4s_22:read-only {\n    cursor: not-allowed;\n    color: var(--disabled-color);\n  }\n\n._error_1nf4s_49 {\n  border-color: var(--error-background);\n}\n\n._fullWidth_1nf4s_53 {\n  width: 100%;\n}\n\n._fullWidth_1nf4s_53 ._input_1nf4s_22 {\n    width: 100%;\n  }\n\n._small_1nf4s_61 {\n  padding: var(--textarea-spacing-sm);\n}\n\n._medium_1nf4s_65 {\n  padding: var(--textarea-spacing-md);\n}\n\n._large_1nf4s_69 {\n  padding: var(--textarea-spacing-lg);\n}\n._switch_1jog0_1 {\n  display: flex;\n  align-items: center;\n  justify-content: flex-start;\n  border: var(--toggle-border);\n  border-radius: var(--toggle-border-radius);\n  cursor: pointer;\n  background-color: var(--toggle-background);\n  box-sizing: border-box;\n}\n\n  ._switch_1jog0_1._disabled_1jog0_11 {\n    cursor: not-allowed;\n    opacity: 0.8;\n    opacity: var(--toggle-disabled-opacity, 0.8);\n    background-color: var(--toggle-disabled-background);\n  }\n\n  ._switch_1jog0_1._disabled_1jog0_11 ._handle_1jog0_16 {\n      background-color: var(--toggle-handle-disabled-background);\n    }\n\n  ._switch_1jog0_1._disabled_1jog0_11._checked_1jog0_20 {\n      background-color: var(--toggle-checked-disabled-background);\n    }\n\n  ._switch_1jog0_1._disabled_1jog0_11._checked_1jog0_20 ._handle_1jog0_16 {\n        background-color: var(--toggle-handle-checked-disabled-background);\n      }\n\n  ._switch_1jog0_1._small_1jog0_29 {\n    height: calc(35px / 2);\n    height: calc(var(--toggle-height, 35px) / 2);\n    width: calc(55px / 2);\n    width: calc(var(--toggle-width, 55px) / 2);\n    padding: calc(var(--toggle-spacing) / 2);\n  }\n\n  ._switch_1jog0_1._small_1jog0_29 ._handle_1jog0_16 {\n      height: calc(25px / 2);\n      height: calc(var(--toggle-handle-size, 25px) / 2);\n      width: calc(25px / 2);\n      width: calc(var(--toggle-handle-size, 25px) / 2);\n    }\n\n  ._switch_1jog0_1._medium_1jog0_40 {\n    height: calc(35px / 1.5);\n    height: calc(var(--toggle-height, 35px) / 1.5);\n    width: calc(55px / 1.5);\n    width: calc(var(--toggle-width, 55px) / 1.5);\n    padding: calc(var(--toggle-spacing) / 1.5);\n  }\n\n  ._switch_1jog0_1._medium_1jog0_40 ._handle_1jog0_16 {\n      height: calc(25px / 1.5);\n      height: calc(var(--toggle-handle-size, 25px) / 1.5);\n      width: calc(25px / 1.5);\n      width: calc(var(--toggle-handle-size, 25px) / 1.5);\n    }\n\n  ._switch_1jog0_1._large_1jog0_51 {\n    height: 35px;\n    height: var(--toggle-height, 35px);\n    width: 55px;\n    width: var(--toggle-width, 55px);\n    padding: var(--toggle-spacing);\n  }\n\n  ._switch_1jog0_1._large_1jog0_51 ._handle_1jog0_16 {\n      height: 25px;\n      height: var(--toggle-handle-size, 25px);\n      width: 25px;\n      width: var(--toggle-handle-size, 25px);\n    }\n\n  ._switch_1jog0_1 ._handle_1jog0_16 {\n    background-color: var(--toggle-handle-background);\n    border-radius: var(--toggle-handle-border-radius);\n  }\n\n  ._switch_1jog0_1._checked_1jog0_20 {\n    justify-content: flex-end;\n    border: var(--toggle-border-checked);\n    background-color: var(--toggle-background-checked);\n  }\n\n  ._switch_1jog0_1._checked_1jog0_20 ._handle_1jog0_16 {\n      background-color: var(--toggle-handle-checked-background);\n    }\n._avatar_v8yfz_1 {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  background-size: cover;\n  background-position: center;\n  color: var(--avatar-initials-color);\n  border: var(--avatar-border);\n  font-weight: bold;\n}\n\n._rounded_v8yfz_12 {\n  border-radius: 50%;\n}\n._group_1sbi4_1 {\n  display: flex;\n  align-items: center;\n}\n\n  ._group_1sbi4_1 ._avatar_1sbi4_5 {\n    margin-left: var(--avatar-group-spacing);\n  }\n\n  ._group_1sbi4_1 ._overflow_1sbi4_9 {\n    margin-left: var(--spacing-sm);\n  }\n._container_d6on2_1 {\n  position: relative;\n  display: inline-flex;\n  vertical-align: middle;\n  flex-shrink: 0;\n  margin: 0 8px;\n}\n\n  ._container_d6on2_1._disableMargins_d6on2_8 {\n    margin: 0 !important;\n  }\n\n._badge_d6on2_13 {\n  display: flex;\n  flex-direction: row;\n  flex-wrap: wrap;\n  justify-content: center;\n  align-content: center;\n  align-items: center;\n  position: absolute;\n  box-sizing: border-box;\n  line-height: 1;\n  padding: var(--spacing-xs);\n  border-radius: var(--badge-border-radius);\n  min-width: 18px;\n  height: 18px;\n  z-index: 1;\n  font-size: var(--font-size-sm);\n  pointer-events: none;\n\n  /* Positions */\n  top: 0;\n  right: 0;\n  transform: translate(50%, -50%);\n  transform-origin: 100% 0%;\n}\n\n._badge_d6on2_13._top_d6on2_37._left_d6on2_38 {\n      top: 0;\n      transform: translate(-50%, -50%);\n      transform-origin: 0% 0%;\n    }\n\n._badge_d6on2_13._bottom_d6on2_45._left_d6on2_38 {\n      bottom: 0;\n      transform: translate(-50%, 50%);\n      transform-origin: 0% 100%;\n    }\n\n._badge_d6on2_13._bottom_d6on2_45._right_d6on2_52 {\n      bottom: 0;\n      transform: translate(50%, 50%);\n      transform-origin: 100% 100%;\n    }\n\n/* Colors */\n\n._badge_d6on2_13._default_d6on2_60 {\n    background: var(--badge-color-background-default);\n    color: var(--badge-color-default);\n  }\n\n._badge_d6on2_13._primary_d6on2_65 {\n    background: var(--badge-color-background-primary);\n    color: var(--badge-color-primary);\n  }\n\n._badge_d6on2_13._secondary_d6on2_70 {\n    background: var(--badge-color-background-secondary);\n    color: var(--badge-color-secondary);\n  }\n\n._badge_d6on2_13._error_d6on2_75 {\n    background: var(--badge-color-background-error);\n    color: var(--badge-color-error);\n  }\n._tooltip_2b0bf_1 {\n  background: var(--tooltip-background);\n  color: var(--tooltip-color);\n  border-radius: var(--tooltip-border-radius);\n  border: var(--tooltip-border);\n  padding: var(--tooltip-spacing);\n  white-space: nowrap;\n  text-align: center;\n  will-change: transform, opacity;\n}\n\n._disablePointer_2b0bf_12 {\n  pointer-events: none;\n}\n._popover_17s8e_1 {\n  background: var(--popover-background);\n  color: var(--popover-color);\n  border-radius: var(--popover-border-radius);\n  padding: var(--popover-spacing);\n  will-change: transform, opacity;\n}\n\n  ._popover_17s8e_1._disablePadding_17s8e_8 {\n    padding: 0;\n  }\n._dialog_1iyoz_1 {\n  justify-content: center;\n  align-items: center;\n  display: flex;\n  pointer-events: none;\n  top: 0;\n  left: 0;\n  height: 100%;\n  width: 100%;\n  position: fixed;\n  will-change: transform, opacity;\n}\n\n  ._dialog_1iyoz_1._disableHeader_1iyoz_13 ._content_1iyoz_14 {\n      padding: 20px;\n    }\n\n  ._dialog_1iyoz_1._disablePadding_1iyoz_19 ._content_1iyoz_14,\n    ._dialog_1iyoz_1._disablePadding_1iyoz_19 ._header_1iyoz_21 {\n      padding: 0;\n    }\n\n  ._dialog_1iyoz_1 ._inner_1iyoz_26 {\n    background: var(--dialog-background);\n    color: var(--dialog-color);\n    display: flex;\n    flex-direction: column;\n    box-sizing: border-box;\n    outline: 0;\n    pointer-events: auto;\n    max-width: 80vw;\n    max-height: 80vh;\n    overflow: auto;\n  }\n\n  ._dialog_1iyoz_1 ._header_1iyoz_21 {\n    display: flex;\n    justify-content: space-between;\n    padding: 20px 20px 10px 20px;\n  }\n\n  ._dialog_1iyoz_1 ._header_1iyoz_21 ._headerText_1iyoz_44 {\n      margin: 0;\n      padding: 0;\n      flex: 1;\n      display: inline-flex;\n    }\n\n  ._dialog_1iyoz_1 ._header_1iyoz_21 ._closeButton_1iyoz_51 {\n      margin: 0 0 0 15px;\n      opacity: 0.8;\n      height: auto;\n      width: auto;\n      min-width: auto;\n      min-height: auto;\n      display: inline-flex;\n      padding: 0;\n      background: none;\n      border: none;\n      cursor: pointer;\n      align-items: center;\n      color: var(--dialog-color);\n      font-size: 16px;\n    }\n\n  ._dialog_1iyoz_1 ._header_1iyoz_21 ._closeButton_1iyoz_51:focus {\n        outline: none;\n      }\n\n  ._dialog_1iyoz_1 ._content_1iyoz_14 {\n    padding: 10px 20px 20px 20px;\n    flex: auto;\n    overflow: auto;\n  }\n\n  ._dialog_1iyoz_1 ._footer_1iyoz_79 {\n    display: flex;\n    padding: 20px 20px 10px 20px;\n  }\n._drawer_1f5a0_1 {\n  position: fixed;\n  overflow-y: auto;\n  overflow-x: hidden;\n  background: var(--drawer-background);\n  color: var(--drawer-color);\n}\n\n  ._drawer_1f5a0_1:not(._disablePadding_1f5a0_8) ._content_1f5a0_9 {\n      padding: 20px 30px;\n    }\n\n  ._drawer_1f5a0_1 ._header_1f5a0_14 {\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    padding: 20px 30px;\n  }\n\n  ._drawer_1f5a0_1 ._header_1f5a0_14 ._headerText_1f5a0_20 {\n      margin: 0;\n      flex: 1;\n    }\n\n  ._drawer_1f5a0_1 ._closeButton_1f5a0_26 {\n    opacity: 0.8;\n    height: auto;\n    width: auto;\n    min-width: auto;\n    min-height: auto;\n    padding: 0;\n    background: none;\n    border: none;\n    cursor: pointer;\n    color: var(--drawer-color);\n    font-size: 16px;\n  }\n\n  ._drawer_1f5a0_1 ._closeButton_1f5a0_26:focus {\n      outline: none;\n    }\n\n  ._drawer_1f5a0_1 ._closeButton_1f5a0_26._headerlessCloseButton_1f5a0_43 {\n      position: absolute;\n      top: 20px;\n      right: 20px;\n    }\n\n  ._drawer_1f5a0_1._left_1f5a0_50,\n  ._drawer_1f5a0_1._right_1f5a0_51 {\n    top: 0;\n    bottom: 0;\n    height: 100%;\n  }\n\n  ._drawer_1f5a0_1._left_1f5a0_50 {\n    left: 0;\n  }\n\n  ._drawer_1f5a0_1._right_1f5a0_51 {\n    right: 0;\n  }\n\n  ._drawer_1f5a0_1._top_1f5a0_65,\n  ._drawer_1f5a0_1._bottom_1f5a0_66 {\n    width: 100%;\n    left: 0;\n    right: 0;\n  }\n\n  ._drawer_1f5a0_1._top_1f5a0_65 {\n    top: 0;\n  }\n\n  ._drawer_1f5a0_1._bottom_1f5a0_66 {\n    bottom: 0;\n  }\n._container_gicoy_1 {\n  position: relative;\n  padding: 1px;\n  min-width: 112px;\n  max-width: 500px;\n}\n\n  ._container_gicoy_1 ._inner_gicoy_7:focus {\n      outline: none;\n    }\n._enabled_ftw1e_1 {\n  cursor: context-menu;\n}\n._notification_1ggeh_1 {\n  display: flex;\n  position: relative;\n  font-size: 16px;\n  min-width: 400px;\n  padding: 10px;\n  min-height: 45px;\n  margin-bottom: 10px;\n  border-radius: 4px;\n  background: var(--notification-background);\n  color: var(--notification-color);\n  border: 1px solid var(--notification-border);\n}\n\n  ._notification_1ggeh_1 ._contentContainer_1ggeh_14 {\n    display: flex;\n    width: 100%;\n    padding: 0 15px;\n  }\n\n  ._notification_1ggeh_1._error_1ggeh_20 ._header_1ggeh_21 {\n      color: var(--notification-color-error);\n    }\n\n  ._notification_1ggeh_1._warning_1ggeh_26 ._header_1ggeh_21 {\n      color: var(--notification-color-warning);\n    }\n\n  ._notification_1ggeh_1._success_1ggeh_32 ._header_1ggeh_21 {\n      color: var(--notification-color-success);\n    }\n\n  ._notification_1ggeh_1 ._close_1ggeh_38,\n  ._notification_1ggeh_1 ._content_1ggeh_14 {\n    display: inline-flex;\n    align-items: center;\n  }\n\n  ._notification_1ggeh_1 ._content_1ggeh_14 {\n    flex: 1;\n    padding: 3px 10px;\n    flex-direction: column;\n    text-align: center;\n    justify-content: center;\n  }\n\n  ._notification_1ggeh_1 ._content_1ggeh_14 ._header_1ggeh_21 {\n      font-size: 18px;\n    }\n\n  ._notification_1ggeh_1 ._content_1ggeh_14 ._body_1ggeh_55 {\n      color: var(--color-on-notification);\n      opacity: 0.7;\n      font-size: 14px;\n      margin-top: 5px;\n    }\n\n  ._notification_1ggeh_1 ._close_1ggeh_38 ._closeButton_1ggeh_64 {\n      cursor: pointer;\n      background: none;\n      border: none;\n      padding: 5px 10px;\n      font-size: 13px;\n      font-weight: 600;\n      opacity: 0.7;\n      margin: 0;\n      color: var(--color-on-notification);\n    }\n._container_16mce_1 ._positions_16mce_2 {\n    position: fixed;\n    z-index: 9998;\n    height: auto;\n    left: 50%;\n    transform: translateX(-50%);\n    bottom: 0;\n    padding: 0 95px;\n    margin-bottom: 5px;\n  }\n\n    ._container_16mce_1 ._positions_16mce_2 > div {\n      margin: 10px 0 15px 0;\n    }"
                )
              ),
                document.head.appendChild(e);
            }
          } catch (e) {
            console.error("vite-plugin-css-injected-by-js", e);
          }
        })();
        let lR = (0, f.createContext)({}),
          lL = () => {
            let e = (0, f.useContext)(lR);
            if (void 0 === e) throw Error("`useTheme` hook must be used within a `ThemeContext` component");
            return e;
          },
          lF = "5px",
          lI = "10px",
          lB = {
            900: "#1f1315",
            800: "#291415",
            700: "#3c181a",
            600: "#481a1d",
            500: "#541b1f",
            400: "#671e22",
            300: "#822025",
            200: "#aa2429",
            100: "#e5484d",
            50: "#f2555a"
          },
          lU = {
            900: "#0f1720",
            800: "#0f1b2d",
            700: "#10243e",
            600: "#102a4c",
            500: "#0f3058",
            400: "#0d3868",
            300: "#0a4481",
            200: "#0954a5",
            100: "#0091ff",
            50: "#369eff"
          },
          lq = {
            900: "#0d1912",
            800: "#0f1e13",
            700: "#132819",
            600: "#16301d",
            500: "#193921",
            400: "#1d4427",
            300: "#245530",
            200: "#2f6e3b",
            100: "#46a758",
            50: "#55b467"
          },
          lH = {
            900: "#1f1206",
            800: "#2b1400",
            700: "#391a03",
            600: "#441f04",
            500: "#4f2305",
            400: "#5f2a06",
            300: "#763205",
            200: "#943e00",
            100: "#f76808",
            50: "#ff802b"
          },
          lY = {
            900: "#161616",
            800: "#1c1c1c",
            700: "#232323",
            600: "#282828",
            500: "#2e2e2e",
            400: "#343434",
            300: "#3e3e3e",
            200: "#505050",
            100: "#707070",
            50: "#7e7e7e"
          },
          lW = {
            900: "#151718",
            800: "#1a1d1e",
            700: "#202425",
            600: "#26292b",
            500: "#2b2f31",
            400: "#313538",
            300: "#3a3f42",
            200: "#4c5155",
            100: "#697177",
            50: "#787f85"
          };
        lY["900"],
          lU["400"],
          lU["300"],
          lU["200"],
          lU["500"],
          lU["300"],
          lU["400"],
          lU["200"],
          lB["100"],
          lB["100"],
          lB["50"],
          lB["50"],
          lq["100"],
          lq["100"],
          lq["50"],
          lq["50"],
          lH["100"],
          lH["100"],
          lH["50"],
          lH["50"],
          lU["100"],
          lU["100"],
          lU["50"],
          lU["50"],
          lY["500"],
          lY["200"],
          lY["200"],
          lY["100"],
          lY["100"],
          lY["50"],
          lY["100"],
          lY["500"],
          lU["100"],
          lW["800"],
          lW["50"],
          lU["100"],
          lW["100"],
          lW["100"],
          lY["200"],
          lY["100"],
          lY["50"],
          lW["800"],
          lY["500"],
          lW["800"],
          lW["800"],
          lY["200"],
          lY["200"],
          lY["100"],
          lW["800"],
          lY["200"],
          lY["100"],
          lY["200"],
          lW["500"],
          lW["700"],
          lY["500"],
          lB["100"],
          lH["100"],
          lq["100"],
          lY["100"],
          lW["100"],
          lU["100"],
          lU["100"],
          lW["800"],
          lW["200"],
          lB["100"],
          lY["50"],
          lY["100"],
          lY["50"],
          lW["800"],
          lW["200"],
          lW["50"],
          lW["500"],
          lU["200"],
          lW["300"],
          lW["900"],
          lW["50"],
          lY["100"],
          lU["50"],
          lY["300"],
          lY["300"],
          lY["100"],
          lY["300"],
          lU["50"],
          lY["300"],
          lW["500"],
          lW["300"],
          lW["500"];
        let lZ = ({ count: e, zero: t, singular: n, plural: r, showCount: o }) => {
            if (0 === e && t) return t;
            let i = n;
            return 1 !== e && (i = r || sp(n, e)), o ? `${e.toLocaleString()} ${i}` : i;
          },
          lX =
            (new oG.Scale({ ms: 1, s: 1e3, min: 6e4, hr: 36e5, day: 864e5, month: 2592e6 }),
            ({ items: e, threshold: t = 3, size: n = 10, nextSize: r }) => {
              let [o, i] = (0, f.useState)(0),
                a = (0, f.useMemo)(() => [...e].slice(0, o), [o, e]),
                s = o < e.length,
                l = e.length - o,
                u = (0, f.useCallback)(
                  t => {
                    if (s) {
                      let a = r === 1 / 0 ? l : r || t || n;
                      i(Math.min(e.length, o + a));
                    }
                  },
                  [s, o, n, e, l, r]
                );
              return (
                (0, f.useEffect)(() => {
                  let r = (null == e ? void 0 : e.length) || 0;
                  i(r <= n + t ? n + t : Math.min(r, n));
                }, [e.length, n, t]),
                { data: a, hasMore: s, remaining: l, showNext: u }
              );
            }),
          lV = { container: "_container_tjtgz_1", input: "_input_tjtgz_8", icon: "_icon_tjtgz_29" };
        () =>
          (0, d.jsx)("svg", {
            xmlns: "http://www.w3.org/2000/svg",
            fill: "none",
            viewBox: "0 0 24 24",
            strokeWidth: "1.5",
            stroke: "currentColor",
            ariaHidden: "true",
            children: (0, d.jsx)("path", {
              strokeLinecap: "round",
              strokeLinejoin: "round",
              d: "M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            })
          });
        let lG = (0, f.forwardRef)(({ className: e, children: t, ...n }, r) =>
            (0, d.jsx)("div", { ...n, ref: r, role: "list", className: s_(e, "_list_jz30e_1"), children: t })
          ),
          lJ = {
            listItem: "_listItem_r6l8m_1",
            startAdornment: "_startAdornment_r6l8m_10",
            endAdornment: "_endAdornment_r6l8m_14",
            content: "_content_r6l8m_28",
            active: "_active_r6l8m_35",
            disabled: "_disabled_r6l8m_39",
            clickable: "_clickable_r6l8m_43",
            dense: "_dense_r6l8m_53",
            disableGutters: "_disableGutters_r6l8m_69",
            disablePadding: "_disablePadding_r6l8m_74"
          },
          lK = (0, f.forwardRef)(
            ({ className: e, children: t, active: n, disabled: r, disablePadding: o, disableGutters: i, start: a, end: s, dense: l, onClick: u, ...c }, f) =>
              (0, d.jsxs)("div", {
                ...c,
                ref: f,
                role: u ? "button" : "listitem",
                tabIndex: u ? 0 : void 0,
                onClick: e => !r && (null == u ? void 0 : u(e)),
                className: s_(e, lJ.listItem, {
                  [lJ.disabled]: r,
                  [lJ.active]: n,
                  [lJ.clickable]: u && !r,
                  [lJ.disablePadding]: o,
                  [lJ.disableGutters]: i,
                  [lJ.dense]: l
                }),
                children: [
                  a && (0, d.jsx)("div", { className: lJ.startAdornment, children: a }),
                  (0, d.jsx)("div", { className: lJ.content, children: t }),
                  s && (0, d.jsx)("div", { className: lJ.endAdornment, children: s })
                ]
              })
          ),
          lQ = {
            primary: "_primary_1h9pf_1",
            secondary: "_secondary_1h9pf_5",
            error: "_error_1h9pf_9",
            success: "_success_1h9pf_13",
            warning: "_warning_1h9pf_17",
            info: "_info_1h9pf_21",
            mono: "_mono_1h9pf_25"
          };
        (0, f.forwardRef)(({ children: e, color: t, variant: n, disableMargins: r, className: o, ...i }, a) =>
          (0, d.jsx)("h1", { ref: a, className: s_(lQ[t], lQ[n], "_root_1u76g_1", { _disableMargins_1u76g_8: r }, o), ...i, children: e })
        ).defaultProps = { color: "default", variant: "default", disableMargins: !1 };
        (0, f.forwardRef)(({ children: e, color: t, variant: n, disableMargins: r, className: o, ...i }, a) =>
          (0, d.jsx)("h2", { ref: a, className: s_(lQ[t], lQ[n], "_root_9g7kd_1", { _disableMargins_9g7kd_8: r }, o), ...i, children: e })
        ).defaultProps = { color: "default", variant: "default", disableMargins: !1 };
        ((0, f.forwardRef)(({ children: e, color: t, variant: n, disableMargins: r, className: o, ...i }, a) =>
          (0, d.jsx)("h3", { ref: a, className: s_(lQ[t], lQ[n], "_root_1o2ul_1", { _disableMargins_1o2ul_8: r }, o), ...i, children: e })
        ).defaultProps = { color: "default", variant: "default", disableMargins: !1 }),
          ((0, f.forwardRef)(({ children: e, color: t, variant: n, disableMargins: r, className: o, ...i }, a) =>
            (0, d.jsx)("h5", { ref: a, className: s_(lQ[t], lQ[n], "_root_1dv3y_1", { _disableMargins_1dv3y_8: r }, o), ...i, children: e })
          ).defaultProps = { color: "default", variant: "default", disableMargins: !1 });
        let l0 = (0, f.forwardRef)(({ color: e, variant: t, disableMargins: n, children: r, className: o, ...i }, a) =>
          (0, d.jsx)("h6", { ref: a, className: s_(lQ[e], lQ[t], "_root_1dwi9_1", { _disableMargins_1dwi9_7: n }, o), ...i, children: r })
        );
        l0.defaultProps = { color: "default", variant: "default", disableMargins: !1 };
        let l1 = { thin: "_thin_1ls8i_1", bold: "_bold_1ls8i_5", extraBold: "_extraBold_1ls8i_9", italic: "_italic_1ls8i_13" };
        (0, f.forwardRef)(({ color: e, variant: t, fontStyle: n, children: r, className: o, ...i }, a) =>
          (0, d.jsx)("span", { ref: a, className: s_(lQ[e], lQ[t], l1[n], o), ...i, children: r })
        ).defaultProps = { color: "default", variant: "default", fontStyle: "default" };
        let l2 = ({ className: e, children: t, ...n }) => (0, d.jsx)(l0, { ...n, className: s_(e, "_header_1ffms_1"), children: t }),
          l3 = {
            card: "_card_o9yl3_1",
            disablePadding: "_disablePadding_o9yl3_11",
            header: "_header_o9yl3_15",
            headerText: "_headerText_o9yl3_24",
            content: "_content_o9yl3_32"
          },
          l5 =
            ((0, f.forwardRef)(({ children: e, disablePadding: t, className: n, header: r, headerClassName: o, contentClassName: i, ...a }, s) =>
              (0, d.jsxs)("section", {
                ...a,
                ref: s,
                className: s_(n, l3.card, { [l3.disablePadding]: t }),
                children: [
                  r &&
                    (0, d.jsx)("header", {
                      className: s_(l3.header, o),
                      children: r && "string" == typeof r ? (0, d.jsx)("h3", { className: l3.headerText, children: r }) : r
                    }),
                  (0, d.jsx)("div", { className: s_(l3.content, i), children: e })
                ]
              })
            ),
            {
              initial: { transition: { staggerChildren: 0.05, staggerDirection: -1 } },
              animate: { transition: { staggerChildren: 0.07, delayChildren: 0.2 } }
            }),
          l8 = ({ children: e, ...t }) => (0, d.jsx)(C.E.div, { variants: l5, initial: "initial", animate: "animate", ...t, children: e }),
          l6 = {
            initial: { y: -20, opacity: 0, transition: { when: "beforeChildren" } },
            animate: { y: 0, opacity: 1, transition: { when: "beforeChildren" } },
            exit: { y: -20, opacity: 0 }
          },
          l4 = {
            initial: { x: "-100%", opacity: 0, transition: { when: "beforeChildren", x: { stiffness: 10 } } },
            animate: { x: "0%", opacity: 1, transition: { x: { stiffness: 10, velocity: -100 }, when: "beforeChildren", opacity: { duration: 1 } } },
            exit: { x: "-100%", opacity: 0, transition: { x: { stiffness: 10 } } }
          },
          l7 = ({ children: e, direction: t = "vertical", ...n }) => (0, d.jsx)(C.E.div, { variants: "vertical" === t ? l6 : l4, ...n, children: e }),
          l9 = {
            chip: "_chip_df3yr_1",
            startAdornment: "_startAdornment_df3yr_15",
            content: "_content_df3yr_21",
            endAdornment: "_endAdornment_df3yr_26",
            small: "_small_df3yr_33",
            medium: "_medium_df3yr_43",
            large: "_large_df3yr_53",
            filled: "_filled_df3yr_63",
            primary: "_primary_df3yr_72",
            secondary: "_secondary_df3yr_77",
            error: "_error_df3yr_82",
            success: "_success_df3yr_87",
            warning: "_warning_df3yr_92",
            info: "_info_df3yr_97",
            outline: "_outline_df3yr_103",
            selectable: "_selectable_df3yr_167",
            selected: "_selected_df3yr_173",
            disableMargins: "_disableMargins_df3yr_259"
          },
          ue = (0, f.forwardRef)(
            (
              { children: e, color: t, variant: n, size: r, selected: o, disabled: i, className: a, disableMargins: s, start: l, end: u, onClick: c, ...f },
              h
            ) =>
              (0, d.jsxs)("div", {
                ...f,
                ref: h,
                tabIndex: c ? 0 : -1,
                onClick: c,
                className: s_(
                  l9.chip,
                  { [l9[t]]: !0, [l9[n]]: !0, [l9[r]]: !0, [l9.selected]: !!o, [l9.disabled]: i, [l9.selectable]: c && !i, [l9.disableMargins]: s },
                  a
                ),
                children: [
                  l && (0, d.jsx)("div", { className: l9.startAdornment, children: l }),
                  (0, d.jsx)("div", { className: l9.content, children: e }),
                  u && (0, d.jsx)("div", { className: l9.endAdornment, children: u })
                ]
              })
          );
        ue.defaultProps = { color: "default", size: "medium", variant: "filled" };
        let ut = {
            btn: "_btn_1sw82_1",
            small: "_small_1sw82_17",
            medium: "_medium_1sw82_22",
            large: "_large_1sw82_27",
            filled: "_filled_1sw82_32",
            default: "_default_1sw82_35",
            primary: "_primary_1sw82_45",
            secondary: "_secondary_1sw82_55",
            error: "_error_1sw82_65",
            success: "_success_1sw82_75",
            warning: "_warning_1sw82_85",
            outline: "_outline_1sw82_96",
            text: "_text_1sw82_160",
            fullWidth: "_fullWidth_1sw82_213",
            disableMargins: "_disableMargins_1sw82_218",
            disablePadding: "_disablePadding_1sw82_222",
            startAdornment: "_startAdornment_1sw82_257",
            endAdornment: "_endAdornment_1sw82_258",
            group: "_group_1sw82_291"
          },
          un = (0, f.createContext)({ variant: null, size: null }),
          ur = (0, f.forwardRef)(
            (
              {
                color: e,
                variant: t,
                children: n,
                fullWidth: r,
                size: o,
                disableAnimation: i,
                className: a,
                disableMargins: s,
                disablePadding: l,
                disabled: u,
                startAdornment: c,
                endAdornment: h,
                ...p
              },
              _
            ) => {
              let { variant: g, size: m } = (0, f.useContext)(un);
              return (0, d.jsxs)(C.E.button, {
                ...p,
                disabled: u,
                ref: _,
                whileTap: { scale: u || i ? 1 : 0.9 },
                className: s_(
                  ut.btn,
                  {
                    [ut.fullWidth]: r,
                    [ut.disableMargins]: s,
                    [ut.disablePadding]: l,
                    [ut[e]]: !0,
                    [ut[m || o]]: !0,
                    [ut[g || t]]: !0,
                    [ut.group]: !!g && !!m
                  },
                  a
                ),
                children: [
                  c && (0, d.jsx)("div", { className: s_(ut.startAdornment, { [ut[o]]: !0 }), children: c }),
                  n,
                  h && (0, d.jsx)("div", { className: s_(ut.endAdornment, { [ut[o]]: !0 }), children: h })
                ]
              });
            }
          );
        ur.defaultProps = { color: "default", variant: "filled", size: "medium", type: "button" };
        let uo = () =>
            (0, d.jsx)("svg", {
              xmlns: "http://www.w3.org/2000/svg",
              x: "0px",
              y: "0px",
              width: "32",
              height: "32",
              viewBox: "0 0 32 32",
              children: (0, d.jsx)("path", {
                d: "M 7.21875 5.78125 L 5.78125 7.21875 L 14.5625 16 L 5.78125 24.78125 L 7.21875 26.21875 L 16 17.4375 L 24.78125 26.21875 L 26.21875 24.78125 L 17.4375 16 L 26.21875 7.21875 L 24.78125 5.78125 L 16 14.5625 Z"
              })
            }),
          ui = { deleteButton: "_deleteButton_101ah_1", small: "_small_101ah_2", medium: "_medium_101ah_7", large: "_large_101ah_12" };
        (0, f.forwardRef)(({ children: e, disabled: t, deleteIcon: n, onDelete: r, size: o, ...i }, a) =>
          (0, d.jsx)(ue, {
            ref: a,
            size: o,
            disabled: t,
            end: (0, d.jsx)(ur, {
              tabIndex: 0,
              variant: "text",
              size: o,
              className: s_(ui.deleteButton, { [ui[o]]: !0 }),
              onClick: e => {
                t || (e.stopPropagation(), null == r || r());
              },
              disabled: t,
              disableMargins: !0,
              disablePadding: !0,
              children: n
            }),
            ...i,
            children: e
          })
        ).defaultProps = { color: "default", size: "medium", variant: "filled", deleteIcon: (0, d.jsx)(uo, {}) };
        let ua = !1;
        try {
          navigator && (ua = navigator.platform.toUpperCase().indexOf("MAC") >= 0);
        } catch (e) {
          console.warn(e);
        }
        let us = ua ? "⌘" : "CTRL";
        function ul(e) {
          return e.replace("modifier", us).replace("mod", us).replace("meta", us).replace("shift", "⌥").replace("plus", "+").replace("minus", "-");
        }
        let uu = { chip: "_chip_a0oed_1", container: "_container_a0oed_10" },
          uc = ({ className: e, keycode: t, ...n }) => {
            let r = t.split("+").map(ul);
            return (0, d.jsx)("span", {
              className: uu.container,
              children:
                null == r ? void 0 : r.map((t, r) => (0, d.jsx)(ue, { ...n, className: s_(uu.chip, e), children: (0, d.jsx)("kbd", { children: t }) }, r))
            });
          };
        (0, f.forwardRef)(({ children: e, active: t, className: n, end: r, hotkey: o, onClick: i, ...a }, s) =>
          (0, d.jsx)(l7, {
            layout: !0,
            children: (0, d.jsx)(lK, {
              ...a,
              ref: s,
              className: s_(n, "_item_1a75l_1", { _active_1a75l_10: t, _clickable_1a75l_5: i }),
              end: (0, d.jsxs)(d.Fragment, { children: [o && (0, d.jsx)(uc, { keycode: o, size: "small" }), r] }),
              children: e
            })
          })
        ).displayName = "CommandPaletteItem";
        (0, f.forwardRef)(({ children: e, className: t, title: n, index: r, ...o }, i) =>
          (0, d.jsx)(l7, {
            layout: !0,
            children: (0, d.jsxs)(lG, {
              ref: i,
              ...o,
              className: s_("_section_1bd8v_1", t, { _first_1bd8v_2: 0 === r }),
              children: [n && (0, d.jsx)(l2, { children: n }), (0, d.jsx)(l8, { children: e })]
            })
          })
        ).displayName = "CommandPaletteSection";
        var ud =
            "undefined" != typeof globalThis
              ? globalThis
              : "undefined" != typeof window
                ? window
                : "undefined" != typeof global
                  ? global
                  : "undefined" != typeof self
                    ? self
                    : {},
          uf = "object" == typeof ud && ud && ud.Object === Object && ud,
          uh = "object" == typeof self && self && self.Object === Object && self,
          up = (uf || uh || Function("return this")()).Symbol,
          u_ = Object.prototype;
        u_.hasOwnProperty, u_.toString, up && up.toStringTag, Object.prototype.toString, up && up.toStringTag;
        let ug = {
          container: "_container_14mbr_1",
          inline: "_inline_14mbr_6",
          dense: "_dense_14mbr_10",
          column: "_column_14mbr_14",
          row: "_row_14mbr_18",
          columnReverse: "_columnReverse_14mbr_22",
          rowReverse: "_rowReverse_14mbr_26",
          startAlign: "_startAlign_14mbr_30",
          endAlign: "_endAlign_14mbr_34",
          stretchAlign: "_stretchAlign_14mbr_38",
          endJustify: "_endJustify_14mbr_42",
          centerJustify: "_centerJustify_14mbr_46",
          spaceBetweenJustify: "_spaceBetweenJustify_14mbr_50"
        };
        ((0, f.forwardRef)(({ children: e, className: t, direction: n, dense: r, inline: o, alignItems: i, justifyContent: a, ...s }, l) =>
          (0, d.jsx)("div", {
            className: s_(ug.container, t, { [ug.dense]: r, [ug.inline]: o, [ug[n]]: n, [ug[`${i}Align`]]: i, [ug[`${a}Justify`]]: a }),
            ref: l,
            ...s,
            children: e
          })
        ).defaultProps = { dense: !1, inline: !1, direction: "row", alignItems: "center", justifyContent: "start" }),
          (0, f.createContext)({ collapsedIcon: null, expandedIcon: null });
        let um = { xs: "_xs_1vu5j_1", sm: "_sm_1vu5j_5", md: "_md_1vu5j_9", lg: "_lg_1vu5j_13", xl: "_xl_1vu5j_17", xxl: "_xxl_1vu5j_21" };
        (0, f.forwardRef)(({ space: e, className: t, ...n }, r) => (0, d.jsx)("div", { className: s_(t, { [um[e]]: !0 }), ref: r, ...n })).defaultProps = {
          space: "md"
        };
        let uv = (function (e, t = "short") {
            let n = new Intl.DateTimeFormat(void 0 ?? navigator.language, { month: t, timeZone: "UTC" });
            return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
              .map(e => {
                let t = e < 10 ? `0${e}` : e;
                return new Date(`2017-${t}-01T00:00:00+00:00`);
              })
              .map(e => n.format(e));
          })(),
          uy = Array.from({ length: 7 }, (e, t) =>
            new Intl.DateTimeFormat(void 0 ?? navigator.language, { weekday: "short" }).format(new Date(1970, 0, 4 + t))
          ),
          ub = {
            week: "_week_1owo4_1",
            day: "_day_1owo4_10",
            range: "_range_1owo4_20",
            outside: "_outside_1owo4_20",
            selectedDay: "_selectedDay_1owo4_24",
            startRangeDate: "_startRangeDate_1owo4_45",
            roundStartDateBottom: "_roundStartDateBottom_1owo4_49",
            endRangeDate: "_endRangeDate_1owo4_53",
            roundEndDateTop: "_roundEndDateTop_1owo4_57",
            weekLabels: "_weekLabels_1owo4_63",
            dayOfWeek: "_dayOfWeek_1owo4_71"
          },
          ux = {
            container: "_container_1m42y_1",
            label: "_label_1m42y_6",
            clickable: "_clickable_1m42y_11",
            check: "_check_1m42y_17",
            checkbox: "_checkbox_1m42y_21",
            small: "_small_1m42y_27",
            medium: "_medium_1m42y_32",
            large: "_large_1m42y_37",
            disabled: "_disabled_1m42y_46"
          };
        (0, f.forwardRef)(
          (
            {
              checked: e,
              intermediate: t,
              label: n,
              disabled: r,
              size: o,
              onChange: i,
              onBlur: a,
              className: s,
              containerClassName: l,
              labelClassName: u,
              ...c
            },
            f
          ) => {
            let h = lL(),
              p = (0, li.c)(0),
              _ = (0, la.H)(p, [0.05, 0.15], [0, 1]),
              g = { pressed: e => ({ pathLength: e ? 0.85 : 0.3 }), checked: { pathLength: 1 }, unchecked: { pathLength: 0 } },
              m = {
                hover: { strokeWidth: 1, stroke: h.components.checkbox["checkbox-box-checked-stroke"] },
                pressed: { scale: 0.95 },
                checked: { stroke: h.components.checkbox["checkbox-box-checked-stroke"] },
                unchecked: { stroke: h.components.checkbox["checkbox-box-unchecked-stroke"] }
              };
            return (0, d.jsxs)("div", {
              className: s_(ux.container, l),
              children: [
                (0, d.jsx)(C.E.div, {
                  ...c,
                  ref: f,
                  tabIndex: r ? -1 : 0,
                  className: s_(ux.checkbox, s, { [ux.disabled]: r, [ux.small]: "small" === o, [ux.medium]: "medium" === o, [ux.large]: "large" === o }),
                  onClick: t => {
                    !r && i && (t.stopPropagation(), i(!e));
                  },
                  onBlur: a,
                  onKeyDown: t => {
                    !r && i && "Space" === t.code && i(!e);
                  },
                  children: (0, d.jsxs)(C.E.svg, {
                    animate: e ? "checked" : "unchecked",
                    whileHover: r ? void 0 : "hover",
                    whileTap: r ? void 0 : "pressed",
                    viewBox: "0 0 16 16",
                    children: [
                      (0, d.jsx)(C.E.path, { d: "M 0 0 L 0 16 L 16 16 L 16 0 Z", variants: m }),
                      t
                        ? (0, d.jsx)(C.E.path, {
                            d: "M 5.36396 8.17792 L 10.6044 8.17792",
                            fill: "transparent",
                            strokeWidth: "1",
                            className: ux.check,
                            variants: g,
                            style: { pathLength: p, opacity: _ },
                            custom: e
                          })
                        : (0, d.jsx)(C.E.path, {
                            d: "M 5.36396 8.17792 L 7.34236 9.91424 L 10.6044 5.832",
                            fill: "transparent",
                            strokeWidth: "1",
                            className: ux.check,
                            variants: g,
                            style: { pathLength: p, opacity: _ },
                            custom: e
                          })
                    ]
                  })
                }),
                n &&
                  (0, d.jsx)("span", {
                    className: s_(ux.label, u, { [ux.clickable]: !r && i }),
                    onClick: () => {
                      !r && i && (null == i || i(!e));
                    },
                    children: n
                  })
              ]
            });
          }
        ).defaultProps = { checked: !1, intermediate: !1, size: "medium" };
        let uw = {
            container: "_container_1o1oi_1",
            small: "_small_1o1oi_14",
            medium: "_medium_1o1oi_18",
            large: "_large_1o1oi_22",
            error: "_error_1o1oi_32",
            fullWidth: "_fullWidth_1o1oi_36",
            input: "_input_1o1oi_39",
            startAdornment: "_startAdornment_1o1oi_44",
            endAdornment: "_endAdornment_1o1oi_45"
          },
          uk = (0, f.forwardRef)(
            (
              {
                className: e,
                containerClassname: t,
                error: n,
                fullWidth: r,
                selectOnFocus: o,
                start: i,
                end: a,
                autoFocus: s,
                disabled: l,
                value: u,
                size: c,
                onFocus: h,
                onChange: p,
                onValueChange: _,
                ...g
              },
              m
            ) => {
              let v = (0, f.useRef)(null),
                y = (0, f.useRef)(null);
              return (
                (0, f.useImperativeHandle)(m, () => ({
                  inputRef: y,
                  containerRef: v,
                  blur: () => {
                    var e;
                    return null == (e = y.current) ? void 0 : e.blur();
                  },
                  focus: () => {
                    var e;
                    return null == (e = y.current) ? void 0 : e.focus();
                  },
                  select: () => {
                    var e;
                    return null == (e = y.current) ? void 0 : e.select();
                  }
                })),
                (0, f.useLayoutEffect)(() => {
                  s &&
                    requestAnimationFrame(() => {
                      var e;
                      return null == (e = y.current) ? void 0 : e.focus();
                    });
                }, [s]),
                (0, d.jsxs)("div", {
                  className: s_(uw.container, t, { [uw.fullWidth]: r, [uw.error]: n, [uw[c]]: c }),
                  ref: v,
                  children: [
                    i && (0, d.jsx)("div", { className: uw.startAdornment, children: i }),
                    (0, d.jsx)("input", {
                      ...g,
                      ref: y,
                      value: u,
                      disabled: l,
                      className: s_(e, uw.input),
                      onFocus: e => {
                        o && e.target.select(), null == h || h(e);
                      },
                      onChange: e => {
                        null == _ || _(e.target.value), null == p || p(e);
                      }
                    }),
                    a && (0, d.jsx)("div", { className: uw.endAdornment, children: a })
                  ]
                })
              );
            }
          );
        uk.defaultProps = { size: "medium" };
        let uM = (0, f.forwardRef)(({ inputClassName: e, placeholderIsMinWidth: t = !0, ...n }, r) =>
          (0, d.jsx)(ll, { inputRef: r, inputClassName: s_("_input_el63h_1", e), placeholderIsMinWidth: t, ...n })
        );
        (0, f.forwardRef)(({ debounce: e, value: t, onChange: n, onValueChange: r, ...o }, i) => {
          let a = (0, f.useRef)(null),
            [s, l] = (0, f.useState)(t);
          return (
            (0, f.useEffect)(() => {
              l(t);
            }, [t]),
            (0, d.jsx)(uk, {
              ...o,
              ref: i,
              value: s,
              onKeyDown: e => {
                "Enter" === e.key && (null == r || r(e.target.value), null == n || n(e));
              },
              onChange: t => {
                l(t.target.value),
                  e
                    ? (clearTimeout(a.current),
                      (a.current = setTimeout(() => {
                        null == r || r(t.target.value), null == n || n(t);
                      }, e)))
                    : (null == r || r(t.target.value), null == n || n(t));
              }
            })
          );
        }).defaultProps = { debounce: 100 };
        let uj = {
            container: "_container_1v4a3_1",
            label: "_label_1v4a3_6",
            clickable: "_clickable_1v4a3_12",
            radio: "_radio_1v4a3_18",
            indicator: "_indicator_1v4a3_33",
            checked: "_checked_1v4a3_38",
            small: "_small_1v4a3_42",
            medium: "_medium_1v4a3_52",
            large: "_large_1v4a3_62",
            disabled: "_disabled_1v4a3_72"
          },
          uE = (0, f.createContext)({ onChange: null, selectedValue: null }),
          uS = { check: { opacity: 1, scale: 1 }, uncheck: { opacity: 0, scale: 0 } };
        (0, f.forwardRef)(({ checked: e, label: t, disabled: n, onChange: r, onBlur: o, className: i, size: a, value: s, ...l }, u) => {
          let { onChange: c, selectedValue: h } = (0, f.useContext)(uE),
            p = (0, f.useMemo)(() => (null === h ? e : h === s), [e, h, s]),
            _ = e => {
              null == c || c(s), null == r || r(e);
            };
          return (0, d.jsxs)("div", {
            className: s_(uj.container, i),
            children: [
              (0, d.jsx)("div", {
                ...l,
                ref: u,
                tabIndex: 0,
                className: s_(uj.radio, { [uj.disabled]: n, [uj.checked]: p, [uj[a]]: !0 }),
                onClick: () => {
                  n || _(!p);
                },
                onBlur: o,
                onKeyDown: e => {
                  n || "Space" !== e.code || _(!p);
                },
                children: (0, d.jsx)(C.E.div, {
                  className: uj.indicator,
                  initial: n ? {} : { opacity: 0, scale: 0.5 },
                  variants: uS,
                  animate: p ? "check" : "uncheck",
                  transition: { duration: 0.15 }
                })
              }),
              t &&
                (0, d.jsx)("span", {
                  className: s_(uj.label, { [uj.clickable]: !n }),
                  onClick: () => {
                    n || _(!p);
                  },
                  children: t
                })
            ]
          });
        }).defaultProps = { size: "medium" };
        let uT = ({ className: e, size: t, speed: n }) =>
          (0, d.jsx)(C.E.div, {
            className: s_(e, "_container_1o7j1_1", { _small_1o7j1_9: "small" === t, _medium_1o7j1_15: "medium" === t, _large_1o7j1_21: "large" === t }),
            children: [void 0, void 0, void 0].map((e, t) =>
              (0, d.jsx)(
                C.E.div,
                {
                  animate: { opacity: [0, 1, 0], scale: [1, 2, 2, 1, 1] },
                  transition: { duration: 4 * n, ease: "easeInOut", times: [0, 0.2, 0.5, 0.8, 1], repeat: 1 / 0, repeatDelay: n, delay: n * t }
                },
                t
              )
            )
          });
        uT.defaultProps = { speed: 0.2, size: "medium" };
        let uC = ({ option: e, disabled: t, clearable: n, className: r, maxLength: o, closeIcon: i, onTagKeyDown: a, onSelectedChange: s }) => {
          let l = e.inputLabel || e.children,
            u = "string" == typeof l ? eH(l, o) : l;
          return (0, d.jsxs)("span", {
            className: s_("_tag_sipe1_1", r, "select-input-chip"),
            title: l,
            tabIndex: -1,
            onKeyDown: t => a(t, e),
            children: [u, !t && n && (0, d.jsx)("button", { type: "button", onClick: () => s(e), children: i })]
          });
        };
        uC.defaultProps = { closeIcon: (0, d.jsx)(uo, {}), maxLength: 20 };
        let uP = {
            container: "_container_umshi_1",
            open: "_open_umshi_12",
            disabled: "_disabled_umshi_17",
            expand: "_expand_umshi_22",
            input: "_input_umshi_23",
            unfilterable: "_unfilterable_umshi_28",
            error: "_error_umshi_34",
            inputContainer: "_inputContainer_umshi_38",
            single: "_single_umshi_71",
            prefix: "_prefix_umshi_72",
            multiple: "_multiple_umshi_95",
            suffix: "_suffix_umshi_109",
            loader: "_loader_umshi_119",
            btn: "_btn_umshi_125",
            refresh: "_refresh_umshi_151",
            close: "_close_umshi_152"
          },
          uN = ["ArrowLeft", "ArrowRight"],
          uA = ["ArrowUp", "ArrowDown", "Enter", "Escape"];
        () =>
          (0, d.jsx)("svg", {
            xmlns: "http://www.w3.org/2000/svg",
            x: "0px",
            y: "0px",
            width: "50",
            height: "50",
            viewBox: "0 0 32 32",
            children: (0, d.jsx)("path", {
              d: "M 4.21875 10.78125 L 2.78125 12.21875 L 15.28125 24.71875 L 16 25.40625 L 16.71875 24.71875 L 29.21875 12.21875 L 27.78125 10.78125 L 16 22.5625 Z"
            })
          }),
          () =>
            (0, d.jsx)("svg", {
              xmlns: "http://www.w3.org/2000/svg",
              viewBox: "0 0 32 32",
              width: "64px",
              height: "64px",
              children: (0, d.jsx)("path", {
                d: "M 16 4 C 10.886719 4 6.617188 7.160156 4.875 11.625 L 6.71875 12.375 C 8.175781 8.640625 11.710938 6 16 6 C 19.242188 6 22.132813 7.589844 23.9375 10 L 20 10 L 20 12 L 27 12 L 27 5 L 25 5 L 25 8.09375 C 22.808594 5.582031 19.570313 4 16 4 Z M 25.28125 19.625 C 23.824219 23.359375 20.289063 26 16 26 C 12.722656 26 9.84375 24.386719 8.03125 22 L 12 22 L 12 20 L 5 20 L 5 27 L 7 27 L 7 23.90625 C 9.1875 26.386719 12.394531 28 16 28 C 21.113281 28 25.382813 24.839844 27.125 20.375 Z"
              })
            });
        let uO = {
            menu: "_menu_2ruru_1",
            groupItem: "_groupItem_2ruru_13",
            option: "_option_2ruru_27",
            active: "_active_2ruru_32",
            selected: "_selected_2ruru_37"
          },
          u$ = ({ children: e }) => e,
          uD = {
            root: "_root_1nf4s_1",
            input: "_input_1nf4s_22",
            error: "_error_1nf4s_49",
            fullWidth: "_fullWidth_1nf4s_53",
            small: "_small_1nf4s_61",
            medium: "_medium_1nf4s_65",
            large: "_large_1nf4s_69"
          };
        (0, f.forwardRef)(({ fullWidth: e, size: t = "small", containerClassName: n, className: r, error: o, ...i }, a) => {
          let s = (0, f.useRef)(null),
            l = (0, f.useRef)(null);
          return (
            (0, f.useImperativeHandle)(a, () => ({
              inputRef: l,
              containerRef: s,
              blur: () => {
                var e;
                return null == (e = l.current) ? void 0 : e.blur();
              },
              focus: () => {
                var e;
                return null == (e = l.current) ? void 0 : e.focus();
              }
            })),
            (0, d.jsx)("div", {
              className: s_(uD.root, { [uD.fullWidth]: e, [uD.error]: o, [uD[t]]: t }, n),
              ref: s,
              children: (0, d.jsx)(lP, { ref: l, className: s_(uD.input, r), ...i })
            })
          );
        });
        let uz = {
          switch: "_switch_1jog0_1",
          disabled: "_disabled_1jog0_11",
          handle: "_handle_1jog0_16",
          checked: "_checked_1jog0_20",
          small: "_small_1jog0_29",
          medium: "_medium_1jog0_40",
          large: "_large_1jog0_51"
        };
        (0, f.forwardRef)(({ checked: e, disabled: t, onChange: n, onBlur: r, className: o, size: i, ...a }, s) =>
          (0, d.jsx)("div", {
            ...a,
            ref: s,
            tabIndex: 0,
            className: s_(uz.switch, { [uz.disabled]: t, [uz.checked]: e, [uz[i]]: !0 }, o),
            onClick: () => {
              !t && n && n(!e);
            },
            onBlur: r,
            onKeyDown: r => {
              !t && n && "Space" === r.code && n(!e);
            },
            children: (0, d.jsx)(C.E.div, { className: uz.handle, layout: !0, transition: { type: "spring", stiffness: 700, damping: 30 } })
          })
        ).defaultProps = { size: "medium" };
        f.forwardRef(({ name: e, src: t, color: n, size: r, rounded: o, className: i, colorOptions: a, ...s }, l) => {
          let u = (0, f.useMemo)(() => lN(e || ""), [e]),
            c = (0, f.useMemo)(
              () =>
                t
                  ? "transparent"
                  : n ||
                    (function (e, t = {}) {
                      var n;
                      let {
                          saturation: r,
                          lightness: o,
                          alpha: i
                        } = (function (e = {}) {
                          let {
                            s: t,
                            l: n,
                            a: r,
                            saturation: o = null != t ? t : l$.saturation,
                            lightness: i = null != n ? n : l$.lightness,
                            alpha: a = null != r ? r : l$.alpha
                          } = e;
                          return { saturation: o, lightness: i, alpha: a };
                        })(t),
                        a = ((n = e), ((t.algorithm || lO)(n) + 0.6180339887498948) % 1);
                      return `hsl(
    ${Math.floor(360 * a)}
    , ${r}%, ${o}%, ${i}%
  )`;
                    })(e || "", a),
              [n, e, t, a]
            );
          return (0, d.jsx)("div", {
            ...s,
            className: s_("_avatar_v8yfz_1", i, { _rounded_v8yfz_12: o }),
            style: { width: `${r}px`, height: `${r}px`, fontSize: `${0.4 * r}px`, backgroundImage: t ? `url(${t})` : "none", backgroundColor: c },
            ref: l,
            children: !t && e && (0, d.jsx)("span", { children: u })
          });
        }).defaultProps = { size: 24, rounded: !0 };
        let uR = { group: "_group_1sbi4_1", avatar: "_avatar_1sbi4_5", overflow: "_overflow_1sbi4_9" };
        (0, f.forwardRef)(({ children: e, className: t, size: n, ...r }, o) => {
          let { data: i, hasMore: a, remaining: s } = lX({ items: f.Children.toArray(e), size: n });
          return (0, d.jsxs)("div", {
            ...r,
            ref: o,
            className: s_(t, uR.group),
            children: [
              i.map((e, t) => (0, d.jsx)("div", { className: uR.avatar, children: e }, t)),
              a && (0, d.jsxs)("span", { className: uR.overflow, children: ["+", s, " more"] })
            ]
          });
        }).defaultProps = { size: 10 };
        let uL = {
          container: "_container_d6on2_1",
          disableMargins: "_disableMargins_d6on2_8",
          badge: "_badge_d6on2_13",
          top: "_top_d6on2_37",
          left: "_left_d6on2_38",
          bottom: "_bottom_d6on2_45",
          right: "_right_d6on2_52",
          default: "_default_d6on2_60",
          primary: "_primary_d6on2_65",
          secondary: "_secondary_d6on2_70",
          error: "_error_d6on2_75"
        };
        ((0, f.forwardRef)(({ children: e, color: t, className: n, disableMargins: r, content: o, hidden: i, placement: a, ...s }, l) =>
          (0, d.jsxs)("span", {
            className: s_(uL.container, { [uL.disableMargins]: r }),
            children: [
              e,
              !i &&
                (0, d.jsx)(C.E.span, {
                  initial: { opacity: 0, scale: 1 },
                  animate: { opacity: 1, scale: 1 },
                  "aria-hidden": "true",
                  children: (0, d.jsx)("span", {
                    ...s,
                    ref: l,
                    className: s_(n, uL.badge, uL[t], {
                      [uL.top]: "top-start" === a || "top-end" === a,
                      [uL.bottom]: "bottom-start" === a || "bottom-end" === a,
                      [uL.left]: "top-start" === a || "bottom-start" === a,
                      [uL.right]: "top-end" === a || "bottom-end" === a
                    }),
                    children: o
                  })
                })
            ]
          })
        ).defaultProps = { color: "default", placement: "top-end" }),
          (0, f.forwardRef)(({ children: e, ...t }, n) => (0, d.jsx)(ur, { ...t, ref: n, children: e }));
        let uF = (() => {
            let e = [];
            function t(t) {
              e = [...e, t];
            }
            function n(t, n) {
              let r = e.indexOf(t);
              r > -1 && (0, e[r])(!1, n) && e.splice(r, 1);
            }
            function r(t) {
              let n = [];
              e.forEach(e => {
                e(!1, t) || n.push(e);
              }),
                (e = [...n]);
            }
            return () => {
              let [o, i] = (0, f.useState)([]);
              return (
                (0, f.useEffect)(() => {
                  i(e);
                }, []),
                { tooltips: o, deactivateAllTooltips: r, deactivateTooltip: n, addTooltip: t }
              );
            };
          })(),
          uI = ({
            className: e,
            children: t,
            content: n,
            triggerClassName: r,
            disabled: o,
            enterDelay: i,
            leaveDelay: a,
            placement: s,
            trigger: l,
            visible: u,
            followCursor: c,
            closeOnClick: h,
            closeOnEscape: p,
            closeOnBodyClick: _,
            pointerEvents: g,
            isPopover: m,
            onOpen: v,
            onClose: y,
            ...b
          }) => {
            let { addTooltip: x, deactivateTooltip: w, deactivateAllTooltips: k } = uF(),
              [M, j] = (0, f.useState)(u),
              E = (0, f.useRef)(null),
              S = (0, f.useRef)(!1),
              T = (0, f.useRef)((e, t) => (t === m && j(e), t === m));
            return (
              (0, f.useEffect)(() => {
                S.current ? j(u) : (S.current = !0);
                let e = T.current,
                  t = E.current;
                return () => {
                  clearTimeout(t), w(e, m);
                };
              }, [w, m, u]),
              (0, d.jsx)(eq, {
                ...b,
                placement: s,
                trigger: l,
                followCursor: c,
                triggerClassName: r,
                portalClassName: s_({ _disablePointer_2b0bf_12: "none" === g }),
                open: M,
                closeOnBodyClick: _,
                closeOnEscape: p,
                content: () => {
                  let t = "function" == typeof n ? n() : n;
                  return t
                    ? (0, d.jsx)(C.E.div, {
                        className: s_("_tooltip_2b0bf_1", e),
                        initial: { opacity: 0, scale: 0.3, transition: { when: "beforeChildren" } },
                        animate: { opacity: 1, scale: 1, transition: { when: "beforeChildren" } },
                        exit: { opacity: 0, scale: 0.3 },
                        onClick: () => {
                          h && k(m);
                        },
                        children: t
                      })
                    : null;
                },
                onOpen: () => {
                  M ||
                    (clearTimeout(E.current),
                    (E.current = setTimeout(() => {
                      o || (k(m), j(!0), x(T.current), null == v || v());
                    }, i)));
                },
                onClose: e => {
                  var t, n;
                  ((null == (t = null == e ? void 0 : e.nativeEvent) ? void 0 : t.type) !== "click" ||
                    ((null == (n = null == e ? void 0 : e.nativeEvent) ? void 0 : n.type) === "click" && h)) &&
                    (clearTimeout(E.current),
                    (E.current = setTimeout(() => {
                      w(T.current, m), null == y || y();
                    }, a)));
                },
                children: t
              })
            );
          };
        uI.defaultProps = {
          disabled: !1,
          enterDelay: 0,
          leaveDelay: 200,
          placement: "top",
          trigger: "hover",
          visible: !1,
          followCursor: !1,
          closeOnClick: !1,
          closeOnEscape: !0,
          closeOnBodyClick: !0,
          pointerEvents: "none"
        };
        let uB = { header: "_header_1iyoz_21", headerText: "_headerText_1iyoz_44", closeButton: "_closeButton_1iyoz_51" },
          uU = { header: "_header_1f5a0_14", headerText: "_headerText_1f5a0_20", closeButton: "_closeButton_1f5a0_26" },
          uq = { container: "_container_gicoy_1", inner: "_inner_gicoy_7" };
        ((0, f.forwardRef)(
          (
            {
              reference: e,
              children: t,
              style: n,
              className: r,
              placement: o,
              closeOnEscape: i,
              open: a,
              appendToBody: s,
              closeOnBodyClick: l,
              maxHeight: u,
              autofocus: c,
              modifiers: h,
              autoWidth: p,
              minWidth: _,
              maxWidth: g,
              onClose: m,
              onMouseEnter: v,
              onMouseLeave: y
            },
            b
          ) => {
            let x = eO(),
              w = (0, f.useMemo)(() => {
                if (p) {
                  let e = {
                    enabled: !0,
                    order: 840,
                    fn: e => {
                      var t;
                      let { width: n, left: r, right: o } = e.offsets.reference,
                        i = null == (t = null == h ? void 0 : h.offset) ? void 0 : t.offset,
                        a = 0,
                        s = n;
                      if ((g && s > g ? (s = g) : _ && s < _ && (s = _), i)) {
                        if ("number" == typeof i) a = i;
                        else {
                          let [e] = i.split(",");
                          a = parseInt(e.trim(), 10);
                        }
                      }
                      return (e.styles.width = s), (e.offsets.popper.width = s), (e.offsets.popper.left = r + a), (e.offsets.popper.right = o + a), e;
                    }
                  };
                  return h ? { ...h, sameWidth: e } : { sameWidth: e };
                }
                return h;
              }, [h, p, _, g]);
            return (0, d.jsx)(eq, {
              open: a,
              closeOnBodyClick: l,
              appendToBody: s,
              reference: e,
              placement: o,
              modifiers: w,
              closeOnEscape: i,
              content: () =>
                (0, d.jsx)(C.E.div, {
                  ref: b,
                  initial: { opacity: 0, y: -10 },
                  animate: { opacity: 1, y: 0 },
                  exit: { opacity: 0, y: -10 },
                  className: s_(uq.container, r),
                  style: n,
                  onMouseEnter: v,
                  onMouseLeave: y,
                  children: c
                    ? (0, d.jsx)(lD, {
                        focusTrapOptions: { escapeDeactivates: !0, clickOutsideDeactivates: !0, fallbackFocus: `#${x}` },
                        children: (0, d.jsx)("div", {
                          id: x,
                          className: uq.inner,
                          tabIndex: -1,
                          style: { maxHeight: u },
                          children: "function" == typeof t ? t() : t
                        })
                      })
                    : (0, d.jsx)("div", { className: uq.inner, style: { maxHeight: u }, children: "function" == typeof t ? t() : t })
                }),
              onClose: m
            });
          }
        ).defaultProps = {
          placement: "bottom-start",
          closeOnEscape: !0,
          open: !1,
          appendToBody: !0,
          closeOnBodyClick: !0,
          maxHeight: "max-height: calc(100vh - 48px)",
          autofocus: !0
        }),
          lz([]);
        let uH = {
          notification: "_notification_1ggeh_1",
          contentContainer: "_contentContainer_1ggeh_14",
          error: "_error_1ggeh_20",
          header: "_header_1ggeh_21",
          warning: "_warning_1ggeh_26",
          success: "_success_1ggeh_32",
          close: "_close_1ggeh_38",
          content: "_content_1ggeh_14",
          body: "_body_1ggeh_55",
          closeButton: "_closeButton_1ggeh_64"
        };
        (0, f.createContext)({
          notify: () => void 0,
          notifyError: () => void 0,
          notifyWarning: () => void 0,
          notifySuccess: () => void 0,
          clearNotification: () => void 0,
          clearAllNotifications: () => void 0
        });
        var uY =
          Number.isNaN ||
          function (e) {
            return "number" == typeof e && e != e;
          };
        function uW(e, t) {
          if (e.length !== t.length) return !1;
          for (var n, r, o = 0; o < e.length; o++) if (!((n = e[o]) === (r = t[o]) || (uY(n) && uY(r)))) return !1;
          return !0;
        }
        var uZ = n(69523),
          uX = n(36327),
          uV = n(23787),
          uG = n(60441),
          uJ = n(52858);
        function uK(e) {
          return "number" == typeof e ? e : parseFloat(e);
        }
        function uQ(e, t = {}) {
          let { isStatic: n } = (0, f.useContext)(uX._),
            r = (0, f.useRef)(null),
            o = (0, li.c)((0, uZ.i)(e) ? uK(e.get()) : e),
            i = (0, f.useRef)(o.get()),
            a = (0, f.useRef)(() => {}),
            s = () => {
              let e = r.current;
              e && 0 === e.time && e.sample(uJ.w0.delta),
                l(),
                (r.current = (0, uG.y)({
                  keyframes: [o.get(), i.current],
                  velocity: o.getVelocity(),
                  type: "spring",
                  restDelta: 0.001,
                  restSpeed: 0.01,
                  ...t,
                  onUpdate: a.current
                }));
            },
            l = () => {
              r.current && r.current.stop();
            };
          return (
            (0, f.useInsertionEffect)(
              () => o.attach((e, t) => (n ? t(e) : ((i.current = e), (a.current = t), uJ.Wi.update(s), o.get())), l),
              [JSON.stringify(t)]
            ),
            (0, uV.L)(() => {
              if ((0, uZ.i)(e)) return e.on("change", e => o.set(uK(e)));
            }, [o]),
            o
          );
        }
        var u0 = n(15406),
          u1 = n(96845);
        function u2(e, t) {
          t &&
            (e +=
              " " +
              (function (e) {
                let t = 0;
                for (let n = 0; n < e.length; ++n) t = ((t << 5) - t + e.charCodeAt(n)) | 0;
                return t;
              })(e).toString(36));
          let n = e.trim().replace(/\W+/g, "_");
          return u1.ES3[n] || u1.ESnext[n] || /^\d/.test(n) ? "_" + n : n;
        }
        function u3() {}
        function u5() {
          var e,
            t = [];
          return {
            point: function (t, n, r) {
              e.push([t, n, r]);
            },
            lineStart: function () {
              t.push((e = []));
            },
            lineEnd: u3,
            rejoin: function () {
              t.length > 1 && t.push(t.pop().concat(t.shift()));
            },
            result: function () {
              var n = t;
              return (t = []), (e = null), n;
            }
          };
        }
        var u8 = Math.PI,
          u6 = u8 / 2,
          u4 = u8 / 4,
          u7 = 2 * u8,
          u9 = 180 / u8,
          ce = u8 / 180,
          ct = Math.abs,
          cn = Math.atan,
          cr = Math.atan2,
          co = Math.cos,
          ci = Math.exp,
          ca = Math.log,
          cs = Math.sin,
          cl =
            Math.sign ||
            function (e) {
              return e > 0 ? 1 : e < 0 ? -1 : 0;
            },
          cu = Math.sqrt,
          cc = Math.tan;
        function cd(e) {
          return e > 1 ? u6 : e < -1 ? -u6 : Math.asin(e);
        }
        function cf(e, t) {
          return 1e-6 > ct(e[0] - t[0]) && 1e-6 > ct(e[1] - t[1]);
        }
        function ch(e, t, n, r) {
          (this.x = e), (this.z = t), (this.o = n), (this.e = r), (this.v = !1), (this.n = this.p = null);
        }
        function cp(e, t, n, r, o) {
          var i,
            a,
            s = [],
            l = [];
          if (
            (e.forEach(function (e) {
              if (!((t = e.length - 1) <= 0)) {
                var t,
                  n,
                  r = e[0],
                  a = e[t];
                if (cf(r, a)) {
                  if (!r[2] && !a[2]) {
                    for (o.lineStart(), i = 0; i < t; ++i) o.point((r = e[i])[0], r[1]);
                    o.lineEnd();
                    return;
                  }
                  a[0] += 2e-6;
                }
                s.push((n = new ch(r, e, null, !0))),
                  l.push((n.o = new ch(r, null, n, !1))),
                  s.push((n = new ch(a, e, null, !1))),
                  l.push((n.o = new ch(a, null, n, !0)));
              }
            }),
            s.length)
          ) {
            for (l.sort(t), c_(s), c_(l), i = 0, a = l.length; i < a; ++i) l[i].e = n = !n;
            for (var u, c, d = s[0]; ; ) {
              for (var f = d, h = !0; f.v; ) if ((f = f.n) === d) return;
              (u = f.z), o.lineStart();
              do {
                if (((f.v = f.o.v = !0), f.e)) {
                  if (h) for (i = 0, a = u.length; i < a; ++i) o.point((c = u[i])[0], c[1]);
                  else r(f.x, f.n.x, 1, o);
                  f = f.n;
                } else {
                  if (h) for (i = (u = f.p.z).length - 1; i >= 0; --i) o.point((c = u[i])[0], c[1]);
                  else r(f.x, f.p.x, -1, o);
                  f = f.p;
                }
                (u = (f = f.o).z), (h = !h);
              } while (!f.v);
              o.lineEnd();
            }
          }
        }
        function c_(e) {
          if ((t = e.length)) {
            for (var t, n, r = 0, o = e[0]; ++r < t; ) (o.n = n = e[r]), (n.p = o), (o = n);
            (o.n = n = e[0]), (n.p = o);
          }
        }
        class cg {
          constructor() {
            (this._partials = new Float64Array(32)), (this._n = 0);
          }
          add(e) {
            let t = this._partials,
              n = 0;
            for (let r = 0; r < this._n && r < 32; r++) {
              let o = t[r],
                i = e + o,
                a = Math.abs(e) < Math.abs(o) ? e - (i - o) : o - (i - e);
              a && (t[n++] = a), (e = i);
            }
            return (t[n] = e), (this._n = n + 1), this;
          }
          valueOf() {
            let e = this._partials,
              t = this._n,
              n,
              r,
              o,
              i = 0;
            if (t > 0) {
              for (i = e[--t]; t > 0 && ((i = (n = i) + (r = e[--t])), !(o = r - (i - n))); );
              t > 0 && ((o < 0 && e[t - 1] < 0) || (o > 0 && e[t - 1] > 0)) && ((n = i + (r = 2 * o)), r == n - i && (i = n));
            }
            return i;
          }
        }
        function cm(e) {
          return [cr(e[1], e[0]), cd(e[2])];
        }
        function cv(e) {
          var t = e[0],
            n = e[1],
            r = co(n);
          return [r * co(t), r * cs(t), cs(n)];
        }
        function cy(e, t) {
          return e[0] * t[0] + e[1] * t[1] + e[2] * t[2];
        }
        function cb(e, t) {
          return [e[1] * t[2] - e[2] * t[1], e[2] * t[0] - e[0] * t[2], e[0] * t[1] - e[1] * t[0]];
        }
        function cx(e, t) {
          (e[0] += t[0]), (e[1] += t[1]), (e[2] += t[2]);
        }
        function cw(e, t) {
          return [e[0] * t, e[1] * t, e[2] * t];
        }
        function ck(e) {
          var t = cu(e[0] * e[0] + e[1] * e[1] + e[2] * e[2]);
          (e[0] /= t), (e[1] /= t), (e[2] /= t);
        }
        function cM(e) {
          return ct(e[0]) <= u8 ? e[0] : cl(e[0]) * (((ct(e[0]) + u8) % u7) - u8);
        }
        function cj(e) {
          return Array.from(
            (function* (e) {
              for (let t of e) yield* t;
            })(e)
          );
        }
        function cE(e, t, n, r) {
          return function (o) {
            var i,
              a,
              s,
              l = t(o),
              u = u5(),
              c = t(u),
              d = !1,
              f = {
                point: h,
                lineStart: _,
                lineEnd: g,
                polygonStart: function () {
                  (f.point = m), (f.lineStart = v), (f.lineEnd = y), (a = []), (i = []);
                },
                polygonEnd: function () {
                  (f.point = h), (f.lineStart = _), (f.lineEnd = g), (a = cj(a));
                  var e = (function (e, t) {
                    var n = cM(t),
                      r = t[1],
                      o = cs(r),
                      i = [cs(n), -co(n), 0],
                      a = 0,
                      s = 0,
                      l = new cg();
                    1 === o ? (r = u6 + 1e-6) : -1 === o && (r = -u6 - 1e-6);
                    for (var u = 0, c = e.length; u < c; ++u)
                      if ((f = (d = e[u]).length))
                        for (var d, f, h = d[f - 1], p = cM(h), _ = h[1] / 2 + u4, g = cs(_), m = co(_), v = 0; v < f; ++v, p = b, g = w, m = k, h = y) {
                          var y = d[v],
                            b = cM(y),
                            x = y[1] / 2 + u4,
                            w = cs(x),
                            k = co(x),
                            M = b - p,
                            j = M >= 0 ? 1 : -1,
                            E = j * M,
                            S = E > u8,
                            T = g * w;
                          if ((l.add(cr(T * j * cs(E), m * k + T * co(E))), (a += S ? M + j * u7 : M), S ^ (p >= n) ^ (b >= n))) {
                            var C = cb(cv(h), cv(y));
                            ck(C);
                            var P = cb(i, C);
                            ck(P);
                            var N = (S ^ (M >= 0) ? -1 : 1) * cd(P[2]);
                            (r > N || (r === N && (C[0] || C[1]))) && (s += S ^ (M >= 0) ? 1 : -1);
                          }
                        }
                    return (a < -1e-6 || (a < 1e-6 && l < -1e-12)) ^ (1 & s);
                  })(i, r);
                  a.length
                    ? (d || (o.polygonStart(), (d = !0)), cp(a, cT, e, n, o))
                    : e && (d || (o.polygonStart(), (d = !0)), o.lineStart(), n(null, null, 1, o), o.lineEnd()),
                    d && (o.polygonEnd(), (d = !1)),
                    (a = i = null);
                },
                sphere: function () {
                  o.polygonStart(), o.lineStart(), n(null, null, 1, o), o.lineEnd(), o.polygonEnd();
                }
              };
            function h(t, n) {
              e(t, n) && o.point(t, n);
            }
            function p(e, t) {
              l.point(e, t);
            }
            function _() {
              (f.point = p), l.lineStart();
            }
            function g() {
              (f.point = h), l.lineEnd();
            }
            function m(e, t) {
              s.push([e, t]), c.point(e, t);
            }
            function v() {
              c.lineStart(), (s = []);
            }
            function y() {
              m(s[0][0], s[0][1]), c.lineEnd();
              var e,
                t,
                n,
                r,
                l = c.clean(),
                f = u.result(),
                h = f.length;
              if ((s.pop(), i.push(s), (s = null), h)) {
                if (1 & l) {
                  if ((t = (n = f[0]).length - 1) > 0) {
                    for (d || (o.polygonStart(), (d = !0)), o.lineStart(), e = 0; e < t; ++e) o.point((r = n[e])[0], r[1]);
                    o.lineEnd();
                  }
                  return;
                }
                h > 1 && 2 & l && f.push(f.pop().concat(f.shift())), a.push(f.filter(cS));
              }
            }
            return f;
          };
        }
        function cS(e) {
          return e.length > 1;
        }
        function cT(e, t) {
          return ((e = e.x)[0] < 0 ? e[1] - u6 - 1e-6 : u6 - e[1]) - ((t = t.x)[0] < 0 ? t[1] - u6 - 1e-6 : u6 - t[1]);
        }
        let cC = cE(
          function () {
            return !0;
          },
          function (e) {
            var t,
              n = NaN,
              r = NaN,
              o = NaN;
            return {
              lineStart: function () {
                e.lineStart(), (t = 1);
              },
              point: function (i, a) {
                var s,
                  l,
                  u,
                  c,
                  d,
                  f,
                  h,
                  p = i > 0 ? u8 : -u8,
                  _ = ct(i - n);
                1e-6 > ct(_ - u8)
                  ? (e.point(n, (r = (r + a) / 2 > 0 ? u6 : -u6)), e.point(o, r), e.lineEnd(), e.lineStart(), e.point(p, r), e.point(i, r), (t = 0))
                  : o !== p &&
                    _ >= u8 &&
                    (1e-6 > ct(n - o) && (n -= 1e-6 * o),
                    1e-6 > ct(i - p) && (i -= 1e-6 * p),
                    (s = n),
                    (l = r),
                    (u = i),
                    (c = a),
                    (r = ct((h = cs(s - u))) > 1e-6 ? cn((cs(l) * (f = co(c)) * cs(u) - cs(c) * (d = co(l)) * cs(s)) / (d * f * h)) : (l + c) / 2),
                    e.point(o, r),
                    e.lineEnd(),
                    e.lineStart(),
                    e.point(p, r),
                    (t = 0)),
                  e.point((n = i), (r = a)),
                  (o = p);
              },
              lineEnd: function () {
                e.lineEnd(), (n = r = NaN);
              },
              clean: function () {
                return 2 - t;
              }
            };
          },
          function (e, t, n, r) {
            var o;
            if (null == e)
              (o = n * u6),
                r.point(-u8, o),
                r.point(0, o),
                r.point(u8, o),
                r.point(u8, 0),
                r.point(u8, -o),
                r.point(0, -o),
                r.point(-u8, -o),
                r.point(-u8, 0),
                r.point(-u8, o);
            else if (ct(e[0] - t[0]) > 1e-6) {
              var i = e[0] < t[0] ? u8 : -u8;
              (o = (n * i) / 2), r.point(-i, o), r.point(0, o), r.point(i, o);
            } else r.point(t[0], t[1]);
          },
          [-u8, -u6]
        );
        function cP(e, t) {
          (t = cv(t)), (t[0] -= e), ck(t);
          var n,
            r = (n = -t[1]) > 1 ? 0 : n < -1 ? u8 : Math.acos(n);
          return ((0 > -t[2] ? -r : r) + u7 - 1e-6) % u7;
        }
        function cN(e, t) {
          function n(n, r) {
            return t((n = e(n, r))[0], n[1]);
          }
          return (
            e.invert &&
              t.invert &&
              (n.invert = function (n, r) {
                return (n = t.invert(n, r)) && e.invert(n[0], n[1]);
              }),
            n
          );
        }
        let cA = e => e;
        function cO(e, t) {
          return ct(e) > u8 && (e -= Math.round(e / u7) * u7), [e, t];
        }
        function c$(e) {
          return function (t, n) {
            return ct((t += e)) > u8 && (t -= Math.round(t / u7) * u7), [t, n];
          };
        }
        function cD(e) {
          var t = c$(e);
          return (t.invert = c$(-e)), t;
        }
        function cz(e, t) {
          var n = co(e),
            r = cs(e),
            o = co(t),
            i = cs(t);
          function a(e, t) {
            var a = co(t),
              s = co(e) * a,
              l = cs(e) * a,
              u = cs(t),
              c = u * n + s * r;
            return [cr(l * o - c * i, s * n - u * r), cd(c * o + l * i)];
          }
          return (
            (a.invert = function (e, t) {
              var a = co(t),
                s = co(e) * a,
                l = cs(e) * a,
                u = cs(t),
                c = u * o - l * i;
              return [cr(l * o + u * i, s * n + c * r), cd(c * n - s * r)];
            }),
            a
          );
        }
        function cR(e) {
          return function (t) {
            var n = new cL();
            for (var r in e) n[r] = e[r];
            return (n.stream = t), n;
          };
        }
        function cL() {}
        function cF(e, t) {
          e && cB.hasOwnProperty(e.type) && cB[e.type](e, t);
        }
        (cO.invert = cO),
          (cL.prototype = {
            constructor: cL,
            point: function (e, t) {
              this.stream.point(e, t);
            },
            sphere: function () {
              this.stream.sphere();
            },
            lineStart: function () {
              this.stream.lineStart();
            },
            lineEnd: function () {
              this.stream.lineEnd();
            },
            polygonStart: function () {
              this.stream.polygonStart();
            },
            polygonEnd: function () {
              this.stream.polygonEnd();
            }
          });
        var cI = {
            Feature: function (e, t) {
              cF(e.geometry, t);
            },
            FeatureCollection: function (e, t) {
              for (var n = e.features, r = -1, o = n.length; ++r < o; ) cF(n[r].geometry, t);
            }
          },
          cB = {
            Sphere: function (e, t) {
              t.sphere();
            },
            Point: function (e, t) {
              (e = e.coordinates), t.point(e[0], e[1], e[2]);
            },
            MultiPoint: function (e, t) {
              for (var n = e.coordinates, r = -1, o = n.length; ++r < o; ) (e = n[r]), t.point(e[0], e[1], e[2]);
            },
            LineString: function (e, t) {
              cU(e.coordinates, t, 0);
            },
            MultiLineString: function (e, t) {
              for (var n = e.coordinates, r = -1, o = n.length; ++r < o; ) cU(n[r], t, 0);
            },
            Polygon: function (e, t) {
              cq(e.coordinates, t);
            },
            MultiPolygon: function (e, t) {
              for (var n = e.coordinates, r = -1, o = n.length; ++r < o; ) cq(n[r], t);
            },
            GeometryCollection: function (e, t) {
              for (var n = e.geometries, r = -1, o = n.length; ++r < o; ) cF(n[r], t);
            }
          };
        function cU(e, t, n) {
          var r,
            o = -1,
            i = e.length - n;
          for (t.lineStart(); ++o < i; ) (r = e[o]), t.point(r[0], r[1], r[2]);
          t.lineEnd();
        }
        function cq(e, t) {
          var n = -1,
            r = e.length;
          for (t.polygonStart(); ++n < r; ) cU(e[n], t, 1);
          t.polygonEnd();
        }
        var cH = 1 / 0,
          cY = 1 / 0,
          cW = -1 / 0,
          cZ = cW;
        let cX = {
          point: function (e, t) {
            e < cH && (cH = e), e > cW && (cW = e), t < cY && (cY = t), t > cZ && (cZ = t);
          },
          lineStart: u3,
          lineEnd: u3,
          polygonStart: u3,
          polygonEnd: u3,
          result: function () {
            var e = [
              [cH, cY],
              [cW, cZ]
            ];
            return (cW = cZ = -(cY = cH = 1 / 0)), e;
          }
        };
        function cV(e, t, n) {
          var r,
            o,
            i = e.clipExtent && e.clipExtent();
          return (
            e.scale(150).translate([0, 0]),
            null != i && e.clipExtent(null),
            (r = n),
            (o = e.stream(cX)),
            r && cI.hasOwnProperty(r.type) ? cI[r.type](r, o) : cF(r, o),
            t(cX.result()),
            null != i && e.clipExtent(i),
            e
          );
        }
        function cG(e, t, n) {
          return cV(
            e,
            function (n) {
              var r = t[1][0] - t[0][0],
                o = t[1][1] - t[0][1],
                i = Math.min(r / (n[1][0] - n[0][0]), o / (n[1][1] - n[0][1])),
                a = +t[0][0] + (r - i * (n[1][0] + n[0][0])) / 2,
                s = +t[0][1] + (o - i * (n[1][1] + n[0][1])) / 2;
              e.scale(150 * i).translate([a, s]);
            },
            n
          );
        }
        var cJ = co(30 * ce);
        function cK(e, t) {
          var n;
          return +t
            ? (function (e, t) {
                function n(r, o, i, a, s, l, u, c, d, f, h, p, _, g) {
                  var m = u - r,
                    v = c - o,
                    y = m * m + v * v;
                  if (y > 4 * t && _--) {
                    var b = a + f,
                      x = s + h,
                      w = l + p,
                      k = cu(b * b + x * x + w * w),
                      M = cd((w /= k)),
                      j = 1e-6 > ct(ct(w) - 1) || 1e-6 > ct(i - d) ? (i + d) / 2 : cr(x, b),
                      E = e(j, M),
                      S = E[0],
                      T = E[1],
                      C = S - r,
                      P = T - o,
                      N = v * C - m * P;
                    ((N * N) / y > t || ct((m * C + v * P) / y - 0.5) > 0.3 || a * f + s * h + l * p < cJ) &&
                      (n(r, o, i, a, s, l, S, T, j, (b /= k), (x /= k), w, _, g), g.point(S, T), n(S, T, j, b, x, w, u, c, d, f, h, p, _, g));
                  }
                }
                return function (t) {
                  var r,
                    o,
                    i,
                    a,
                    s,
                    l,
                    u,
                    c,
                    d,
                    f,
                    h,
                    p,
                    _ = {
                      point: g,
                      lineStart: m,
                      lineEnd: y,
                      polygonStart: function () {
                        t.polygonStart(), (_.lineStart = b);
                      },
                      polygonEnd: function () {
                        t.polygonEnd(), (_.lineStart = m);
                      }
                    };
                  function g(n, r) {
                    (n = e(n, r)), t.point(n[0], n[1]);
                  }
                  function m() {
                    (c = NaN), (_.point = v), t.lineStart();
                  }
                  function v(r, o) {
                    var i = cv([r, o]),
                      a = e(r, o);
                    n(c, d, u, f, h, p, (c = a[0]), (d = a[1]), (u = r), (f = i[0]), (h = i[1]), (p = i[2]), 16, t), t.point(c, d);
                  }
                  function y() {
                    (_.point = g), t.lineEnd();
                  }
                  function b() {
                    m(), (_.point = x), (_.lineEnd = w);
                  }
                  function x(e, t) {
                    v((r = e), t), (o = c), (i = d), (a = f), (s = h), (l = p), (_.point = v);
                  }
                  function w() {
                    n(c, d, u, f, h, p, o, i, r, a, s, l, 16, t), (_.lineEnd = y), y();
                  }
                  return _;
                };
              })(e, t)
            : ((n = e),
              cR({
                point: function (e, t) {
                  (e = n(e, t)), this.stream.point(e[0], e[1]);
                }
              }));
        }
        var cQ = cR({
          point: function (e, t) {
            this.stream.point(e * ce, t * ce);
          }
        });
        function c0(e, t, n, r, o, i) {
          if (!i)
            return (function (e, t, n, r, o) {
              function i(i, a) {
                return [t + e * (i *= r), n - e * (a *= o)];
              }
              return (
                (i.invert = function (i, a) {
                  return [((i - t) / e) * r, ((n - a) / e) * o];
                }),
                i
              );
            })(e, t, n, r, o);
          var a = co(i),
            s = cs(i),
            l = a * e,
            u = s * e,
            c = a / e,
            d = s / e,
            f = (s * n - a * t) / e,
            h = (s * t + a * n) / e;
          function p(e, i) {
            return [l * (e *= r) - u * (i *= o) + t, n - u * e - l * i];
          }
          return (
            (p.invert = function (e, t) {
              return [r * (c * e - d * t + f), o * (h - d * e - c * t)];
            }),
            p
          );
        }
        var c1,
          c2,
          c3,
          c5,
          c8,
          c6,
          c4,
          c7,
          c9,
          de,
          dt,
          dn = new cg(),
          dr = new cg(),
          di = {
            point: u3,
            lineStart: u3,
            lineEnd: u3,
            polygonStart: function () {
              (di.lineStart = da), (di.lineEnd = du);
            },
            polygonEnd: function () {
              (di.lineStart = di.lineEnd = di.point = u3), dn.add(ct(dr)), (dr = new cg());
            },
            result: function () {
              var e = dn / 2;
              return (dn = new cg()), e;
            }
          };
        function da() {
          di.point = ds;
        }
        function ds(e, t) {
          (di.point = dl), (c7 = de = e), (c9 = dt = t);
        }
        function dl(e, t) {
          dr.add(dt * e - de * t), (de = e), (dt = t);
        }
        function du() {
          dl(c7, c9);
        }
        var dc,
          dd,
          df,
          dh,
          dp = 0,
          d_ = 0,
          dg = 0,
          dm = 0,
          dv = 0,
          dy = 0,
          db = 0,
          dx = 0,
          dw = 0,
          dk = {
            point: dM,
            lineStart: dj,
            lineEnd: dT,
            polygonStart: function () {
              (dk.lineStart = dC), (dk.lineEnd = dP);
            },
            polygonEnd: function () {
              (dk.point = dM), (dk.lineStart = dj), (dk.lineEnd = dT);
            },
            result: function () {
              var e = dw ? [db / dw, dx / dw] : dy ? [dm / dy, dv / dy] : dg ? [dp / dg, d_ / dg] : [NaN, NaN];
              return (dp = d_ = dg = dm = dv = dy = db = dx = dw = 0), e;
            }
          };
        function dM(e, t) {
          (dp += e), (d_ += t), ++dg;
        }
        function dj() {
          dk.point = dE;
        }
        function dE(e, t) {
          (dk.point = dS), dM((df = e), (dh = t));
        }
        function dS(e, t) {
          var n = e - df,
            r = t - dh,
            o = cu(n * n + r * r);
          (dm += (o * (df + e)) / 2), (dv += (o * (dh + t)) / 2), (dy += o), dM((df = e), (dh = t));
        }
        function dT() {
          dk.point = dM;
        }
        function dC() {
          dk.point = dN;
        }
        function dP() {
          dA(dc, dd);
        }
        function dN(e, t) {
          (dk.point = dA), dM((dc = df = e), (dd = dh = t));
        }
        function dA(e, t) {
          var n = e - df,
            r = t - dh,
            o = cu(n * n + r * r);
          (dm += (o * (df + e)) / 2),
            (dv += (o * (dh + t)) / 2),
            (dy += o),
            (db += (o = dh * e - df * t) * (df + e)),
            (dx += o * (dh + t)),
            (dw += 3 * o),
            dM((df = e), (dh = t));
        }
        var dO,
          d$,
          dD,
          dz,
          dR,
          dL = new cg(),
          dF = {
            point: u3,
            lineStart: function () {
              dF.point = dI;
            },
            lineEnd: function () {
              dO && dB(d$, dD), (dF.point = u3);
            },
            polygonStart: function () {
              dO = !0;
            },
            polygonEnd: function () {
              dO = null;
            },
            result: function () {
              var e = +dL;
              return (dL = new cg()), e;
            }
          };
        function dI(e, t) {
          (dF.point = dB), (d$ = dz = e), (dD = dR = t);
        }
        function dB(e, t) {
          (dz -= e), (dR -= t), dL.add(cu(dz * dz + dR * dR)), (dz = e), (dR = t);
        }
        function dU(e) {
          let t = 1;
          this._ += e[0];
          for (let n = e.length; t < n; ++t) this._ += arguments[t] + e[t];
        }
        function dq(e) {
          return e.target.depth;
        }
        function dH(e, t) {
          return e.y0 - t.y0;
        }
        var dY = Math.PI,
          dW = 2 * dY,
          dZ = dW - 1e-6;
        function dX() {
          (this._x0 = this._y0 = this._x1 = this._y1 = null), (this._ = "");
        }
        function dV() {
          return new dX();
        }
        dX.prototype = dV.prototype = {
          constructor: dX,
          moveTo: function (e, t) {
            this._ += "M" + (this._x0 = this._x1 = +e) + "," + (this._y0 = this._y1 = +t);
          },
          closePath: function () {
            null !== this._x1 && ((this._x1 = this._x0), (this._y1 = this._y0), (this._ += "Z"));
          },
          lineTo: function (e, t) {
            this._ += "L" + (this._x1 = +e) + "," + (this._y1 = +t);
          },
          quadraticCurveTo: function (e, t, n, r) {
            this._ += "Q" + +e + "," + +t + "," + (this._x1 = +n) + "," + (this._y1 = +r);
          },
          bezierCurveTo: function (e, t, n, r, o, i) {
            this._ += "C" + +e + "," + +t + "," + +n + "," + +r + "," + (this._x1 = +o) + "," + (this._y1 = +i);
          },
          arcTo: function (e, t, n, r, o) {
            (e *= 1), (t *= 1), (n *= 1), (r *= 1), (o *= 1);
            var i = this._x1,
              a = this._y1,
              s = n - e,
              l = r - t,
              u = i - e,
              c = a - t,
              d = u * u + c * c;
            if (o < 0) throw Error("negative radius: " + o);
            if (null === this._x1) this._ += "M" + (this._x1 = e) + "," + (this._y1 = t);
            else if (d > 1e-6) {
              if (Math.abs(c * s - l * u) > 1e-6 && o) {
                var f = n - i,
                  h = r - a,
                  p = s * s + l * l,
                  _ = Math.sqrt(p),
                  g = Math.sqrt(d),
                  m = o * Math.tan((dY - Math.acos((p + d - (f * f + h * h)) / (2 * _ * g))) / 2),
                  v = m / g,
                  y = m / _;
                Math.abs(v - 1) > 1e-6 && (this._ += "L" + (e + v * u) + "," + (t + v * c)),
                  (this._ += "A" + o + "," + o + ",0,0," + +(c * f > u * h) + "," + (this._x1 = e + y * s) + "," + (this._y1 = t + y * l));
              } else this._ += "L" + (this._x1 = e) + "," + (this._y1 = t);
            }
          },
          arc: function (e, t, n, r, o, i) {
            (e *= 1), (t *= 1), (n *= 1), (i = !!i);
            var a = n * Math.cos(r),
              s = n * Math.sin(r),
              l = e + a,
              u = t + s,
              c = 1 ^ i,
              d = i ? r - o : o - r;
            if (n < 0) throw Error("negative radius: " + n);
            null === this._x1
              ? (this._ += "M" + l + "," + u)
              : (Math.abs(this._x1 - l) > 1e-6 || Math.abs(this._y1 - u) > 1e-6) && (this._ += "L" + l + "," + u),
              n &&
                (d < 0 && (d = (d % dW) + dW),
                d > dZ
                  ? (this._ +=
                      "A" +
                      n +
                      "," +
                      n +
                      ",0,1," +
                      c +
                      "," +
                      (e - a) +
                      "," +
                      (t - s) +
                      "A" +
                      n +
                      "," +
                      n +
                      ",0,1," +
                      c +
                      "," +
                      (this._x1 = l) +
                      "," +
                      (this._y1 = u))
                  : d > 1e-6 &&
                    (this._ +=
                      "A" + n + "," + n + ",0," + +(d >= dY) + "," + c + "," + (this._x1 = e + n * Math.cos(o)) + "," + (this._y1 = t + n * Math.sin(o))));
          },
          rect: function (e, t, n, r) {
            this._ += "M" + (this._x0 = this._x1 = +e) + "," + (this._y0 = this._y1 = +t) + "h" + +n + "v" + +r + "h" + -n + "Z";
          },
          toString: function () {
            return this._;
          }
        };
        var dG = Array.prototype.slice;
        function dJ(e) {
          return function () {
            return e;
          };
        }
        function dK(e) {
          return e[0];
        }
        function dQ(e) {
          return e[1];
        }
        function d0(e) {
          return e.source;
        }
        function d1(e) {
          return e.target;
        }
        function d2(e, t, n, r, o) {
          e.moveTo(t, n), e.bezierCurveTo((t = (t + r) / 2), n, t, o, r, o);
        }
        function d3(e) {
          return [e.source.x1, e.y0];
        }
        function d5(e) {
          return [e.target.x0, e.y1];
        }
        var d8 = n(76521);
        function d6(e, t) {
          let n = (function (e) {
              let t = [];
              for (let n = 0; n < e.length; ++n) for (let r = n + 1; r < e.length; ++r) for (let o of fe(e[n], e[r])) (o.parentIndex = [n, r]), t.push(o);
              return t;
            })(e),
            r = n.filter(t => {
              var n;
              return (n = t), e.every(e => d7(n, e) < e.radius + 1e-10);
            }),
            o = 0,
            i = 0,
            a = [];
          if (r.length > 1) {
            let t = (function (e) {
              let t = { x: 0, y: 0 };
              for (let n of e) (t.x += n.x), (t.y += n.y);
              return (t.x /= e.length), (t.y /= e.length), t;
            })(r);
            for (let e = 0; e < r.length; ++e) {
              let n = r[e];
              n.angle = Math.atan2(n.x - t.x, n.y - t.y);
            }
            r.sort((e, t) => t.angle - e.angle);
            let n = r[r.length - 1];
            for (let t = 0; t < r.length; ++t) {
              let s = r[t];
              i += (n.x + s.x) * (s.y - n.y);
              let l = { x: (s.x + n.x) / 2, y: (s.y + n.y) / 2 },
                u = null;
              for (let t = 0; t < s.parentIndex.length; ++t)
                if (n.parentIndex.includes(s.parentIndex[t])) {
                  let r = e[s.parentIndex[t]],
                    o = Math.atan2(s.x - r.x, s.y - r.y),
                    i = Math.atan2(n.x - r.x, n.y - r.y),
                    a = i - o;
                  a < 0 && (a += 2 * Math.PI);
                  let c = i - a / 2,
                    d = d7(l, { x: r.x + r.radius * Math.sin(c), y: r.y + r.radius * Math.cos(c) });
                  d > 2 * r.radius && (d = 2 * r.radius),
                    (null == u || u.width > d) && (u = { circle: r, width: d, p1: s, p2: n, large: d > r.radius, sweep: !0 });
                }
              null != u && (a.push(u), (o += d4(u.circle.radius, u.width)), (n = s));
            }
          } else {
            let t = e[0];
            for (let n = 1; n < e.length; ++n) e[n].radius < t.radius && (t = e[n]);
            let n = !1;
            for (let r = 0; r < e.length; ++r)
              if (d7(e[r], t) > Math.abs(t.radius - e[r].radius)) {
                n = !0;
                break;
              }
            n
              ? (o = i = 0)
              : ((o = t.radius * t.radius * Math.PI),
                a.push({ circle: t, p1: { x: t.x, y: t.y + t.radius }, p2: { x: t.x - 1e-10, y: t.y + t.radius }, width: 2 * t.radius, large: !0, sweep: !0 }));
          }
          return (i /= 2), t && ((t.area = o + i), (t.arcArea = o), (t.polygonArea = i), (t.arcs = a), (t.innerPoints = r), (t.intersectionPoints = n)), o + i;
        }
        function d4(e, t) {
          return e * e * Math.acos(1 - t / e) - (e - t) * Math.sqrt(t * (2 * e - t));
        }
        function d7(e, t) {
          return Math.sqrt((e.x - t.x) * (e.x - t.x) + (e.y - t.y) * (e.y - t.y));
        }
        function d9(e, t, n) {
          return n >= e + t
            ? 0
            : n <= Math.abs(e - t)
              ? Math.PI * Math.min(e, t) * Math.min(e, t)
              : d4(e, e - (n * n - t * t + e * e) / (2 * n)) + d4(t, t - (n * n - e * e + t * t) / (2 * n));
        }
        function fe(e, t) {
          let n = d7(e, t),
            r = e.radius,
            o = t.radius;
          if (n >= r + o || n <= Math.abs(r - o)) return [];
          let i = (r * r - o * o + n * n) / (2 * n),
            a = Math.sqrt(r * r - i * i),
            s = e.x + (i * (t.x - e.x)) / n,
            l = e.y + (i * (t.y - e.y)) / n,
            u = -(t.y - e.y) * (a / n),
            c = -(t.x - e.x) * (a / n);
          return [
            { x: s + u, y: l - c },
            { x: s - u, y: l + c }
          ];
        }
        function ft(e, t, n) {
          return Math.min(e, t) * Math.min(e, t) * Math.PI <= n + 1e-10 ? Math.abs(e - t) : (0, d8.bisect)(r => d9(e, t, r) - n, 0, e + t);
        }
        function fn(e, t = {}) {
          let n = (function (e, t) {
              let n = t && t.lossFunction ? t.lossFunction : fr,
                r = {},
                o = {};
              for (let t of e)
                if (1 === t.sets.length) {
                  let e = t.sets[0];
                  (r[e] = { x: 1e10, y: 1e10, rowid: r.length, size: t.size, radius: Math.sqrt(t.size / Math.PI) }), (o[e] = []);
                }
              for (let t of (e = e.filter(e => 2 === e.sets.length))) {
                let e = null != t.weight ? t.weight : 1,
                  n = t.sets[0],
                  i = t.sets[1];
                t.size + 1e-10 >= Math.min(r[n].size, r[i].size) && (e = 0),
                  o[n].push({ set: i, size: t.size, weight: e }),
                  o[i].push({ set: n, size: t.size, weight: e });
              }
              let i = [];
              function a(e, t) {
                return t.size - e.size;
              }
              Object.keys(o).forEach(e => {
                let t = 0;
                for (let n = 0; n < o[e].length; ++n) t += o[e][n].size * o[e][n].weight;
                i.push({ set: e, size: t });
              }),
                i.sort(a);
              let s = {};
              function l(e) {
                return e.set in s;
              }
              function u(e, t) {
                (r[t].x = e.x), (r[t].y = e.y), (s[t] = !0);
              }
              u({ x: 0, y: 0 }, i[0].set);
              for (let t = 1; t < i.length; ++t) {
                let s = i[t].set,
                  d = o[s].filter(l),
                  f = r[s];
                if ((d.sort(a), 0 === d.length)) throw "ERROR: missing pairwise overlap information";
                let h = [];
                for (var c = 0; c < d.length; ++c) {
                  let e = r[d[c].set],
                    t = ft(f.radius, e.radius, d[c].size);
                  h.push({ x: e.x + t, y: e.y }), h.push({ x: e.x - t, y: e.y }), h.push({ y: e.y + t, x: e.x }), h.push({ y: e.y - t, x: e.x });
                  for (let n = c + 1; n < d.length; ++n) {
                    let o = r[d[n].set],
                      i = ft(f.radius, o.radius, d[n].size),
                      a = fe({ x: e.x, y: e.y, radius: t }, { x: o.x, y: o.y, radius: i });
                    h.push(...a);
                  }
                }
                let p = 1e50,
                  _ = h[0];
                for (let t of h) {
                  (r[s].x = t.x), (r[s].y = t.y);
                  let o = n(r, e);
                  o < p && ((p = o), (_ = t));
                }
                u(_, s);
              }
              return r;
            })(e, t),
            r = t.lossFunction || fr;
          if (e.length >= 8) {
            let o = (function (e, t = {}) {
              let n = t.restarts || 10,
                r = [],
                o = {};
              for (let t of e) 1 === t.sets.length && ((o[t.sets[0]] = r.length), r.push(t));
              let { distances: i, constraints: a } = (function (e, t, n) {
                  let r = (0, d8.zerosM)(t.length, t.length),
                    o = (0, d8.zerosM)(t.length, t.length);
                  return (
                    e
                      .filter(e => 2 === e.sets.length)
                      .forEach(e => {
                        let i = n[e.sets[0]],
                          a = n[e.sets[1]],
                          s = ft(Math.sqrt(t[i].size / Math.PI), Math.sqrt(t[a].size / Math.PI), e.size);
                        r[i][a] = r[a][i] = s;
                        let l = 0;
                        e.size + 1e-10 >= Math.min(t[i].size, t[a].size) ? (l = 1) : e.size <= 1e-10 && (l = -1), (o[i][a] = o[a][i] = l);
                      }),
                    { distances: r, constraints: o }
                  );
                })(e, r, o),
                s = (0, d8.norm2)(i.map(d8.norm2)) / i.length;
              i = i.map(e => e.map(e => e / s));
              let l = (e, t) =>
                  (function (e, t, n, r) {
                    for (let e = 0; e < t.length; ++e) t[e] = 0;
                    let o = 0;
                    for (let i = 0; i < n.length; ++i) {
                      let a = e[2 * i],
                        s = e[2 * i + 1];
                      for (let l = i + 1; l < n.length; ++l) {
                        let u = e[2 * l],
                          c = e[2 * l + 1],
                          d = n[i][l],
                          f = r[i][l],
                          h = (u - a) * (u - a) + (c - s) * (c - s),
                          p = Math.sqrt(h),
                          _ = h - d * d;
                        (!(f > 0) || !(p <= d)) &&
                          (!(f < 0) || !(p >= d)) &&
                          ((o += 2 * _ * _),
                          (t[2 * i] += 4 * _ * (a - u)),
                          (t[2 * i + 1] += 4 * _ * (s - c)),
                          (t[2 * l] += 4 * _ * (u - a)),
                          (t[2 * l + 1] += 4 * _ * (c - s)));
                      }
                    }
                    return o;
                  })(e, t, i, a),
                u = null;
              for (let e = 0; e < n; ++e) {
                let e = (0, d8.zeros)(2 * i.length).map(Math.random),
                  n = (0, d8.conjugateGradient)(l, e, t);
                (!u || n.fx < u.fx) && (u = n);
              }
              let c = u.x,
                d = {};
              for (let e = 0; e < r.length; ++e) {
                let t = r[e];
                d[t.sets[0]] = { x: c[2 * e] * s, y: c[2 * e + 1] * s, radius: Math.sqrt(t.size / Math.PI) };
              }
              if (t.history) for (let e of t.history) (0, d8.scale)(e.x, s);
              return d;
            })(e, t);
            r(o, e) + 1e-8 < r(n, e) && (n = o);
          }
          return n;
        }
        function fr(e, t) {
          let n = 0;
          for (let r of t) {
            let t;
            if (1 !== r.sets.length) {
              if (2 === r.sets.length) {
                let n = e[r.sets[0]],
                  o = e[r.sets[1]];
                t = d9(n.radius, o.radius, d7(n, o));
              } else t = d6(r.sets.map(t => e[t]));
              n += (null != r.weight ? r.weight : 1) * (t - r.size) * (t - r.size);
            }
          }
          return n;
        }
        var fo = n(99450);
        function fi(e, t) {
          var n = e.r - t.r,
            r = t.x - e.x,
            o = t.y - e.y;
          return n < 0 || n * n < r * r + o * o;
        }
        function fa(e, t) {
          var n = e.r - t.r + 1e-9 * Math.max(e.r, t.r, 1),
            r = t.x - e.x,
            o = t.y - e.y;
          return n > 0 && n * n > r * r + o * o;
        }
        function fs(e, t) {
          for (var n = 0; n < t.length; ++n) if (!fa(e, t[n])) return !1;
          return !0;
        }
        function fl(e, t) {
          var n = e.x,
            r = e.y,
            o = e.r,
            i = t.x,
            a = t.y,
            s = t.r,
            l = i - n,
            u = a - r,
            c = s - o,
            d = Math.sqrt(l * l + u * u);
          return { x: (n + i + (l / d) * c) / 2, y: (r + a + (u / d) * c) / 2, r: (d + o + s) / 2 };
        }
        function fu(e, t, n) {
          var r = e.x,
            o = e.y,
            i = e.r,
            a = t.x,
            s = t.y,
            l = t.r,
            u = n.x,
            c = n.y,
            d = n.r,
            f = r - a,
            h = r - u,
            p = o - s,
            _ = o - c,
            g = l - i,
            m = d - i,
            v = r * r + o * o - i * i,
            y = v - a * a - s * s + l * l,
            b = v - u * u - c * c + d * d,
            x = h * p - f * _,
            w = (p * b - _ * y) / (2 * x) - r,
            k = (_ * g - p * m) / x,
            M = (h * y - f * b) / (2 * x) - o,
            j = (f * m - h * g) / x,
            E = k * k + j * j - 1,
            S = 2 * (i + w * k + M * j),
            T = w * w + M * M - i * i,
            C = -(Math.abs(E) > 1e-6 ? (S + Math.sqrt(S * S - 4 * E * T)) / (2 * E) : T / S);
          return { x: r + w + k * C, y: o + M + j * C, r: C };
        }
        function fc(e, t, n) {
          var r,
            o,
            i,
            a,
            s = e.x - t.x,
            l = e.y - t.y,
            u = s * s + l * l;
          u
            ? ((o = t.r + n.r),
              (o *= o),
              (a = e.r + n.r),
              o > (a *= a)
                ? ((r = (u + a - o) / (2 * u)), (i = Math.sqrt(Math.max(0, a / u - r * r))), (n.x = e.x - r * s - i * l), (n.y = e.y - r * l + i * s))
                : ((r = (u + o - a) / (2 * u)), (i = Math.sqrt(Math.max(0, o / u - r * r))), (n.x = t.x + r * s - i * l), (n.y = t.y + r * l + i * s)))
            : ((n.x = t.x + n.r), (n.y = t.y));
        }
        function fd(e, t) {
          var n = e.r + t.r - 1e-6,
            r = t.x - e.x,
            o = t.y - e.y;
          return n > 0 && n * n > r * r + o * o;
        }
        function ff(e) {
          var t = e._,
            n = e.next._,
            r = t.r + n.r,
            o = (t.x * n.r + n.x * t.r) / r,
            i = (t.y * n.r + n.y * t.r) / r;
          return o * o + i * i;
        }
        function fh(e) {
          (this._ = e), (this.next = null), (this.previous = null);
        }
        function fp(e) {
          var t = 0,
            n = e.children,
            r = n && n.length;
          if (r) for (; --r >= 0; ) t += n[r].value;
          else t = 1;
          e.value = t;
        }
        function f_(e, t) {
          e instanceof Map ? ((e = [void 0, e]), void 0 === t && (t = fm)) : void 0 === t && (t = fg);
          for (var n, r, o, i, a, s = new fb(e), l = [s]; (n = l.pop()); )
            if ((o = t(n.data)) && (a = (o = Array.from(o)).length))
              for (n.children = o, i = a - 1; i >= 0; --i) l.push((r = o[i] = new fb(o[i]))), (r.parent = n), (r.depth = n.depth + 1);
          return s.eachBefore(fy);
        }
        function fg(e) {
          return e.children;
        }
        function fm(e) {
          return Array.isArray(e) ? e[1] : null;
        }
        function fv(e) {
          void 0 !== e.data.value && (e.value = e.data.value), (e.data = e.data.data);
        }
        function fy(e) {
          var t = 0;
          do e.height = t;
          while ((e = e.parent) && e.height < ++t);
        }
        function fb(e) {
          (this.data = e), (this.depth = this.height = 0), (this.parent = null);
        }
        (fb.prototype = f_.prototype =
          {
            constructor: fb,
            count: function () {
              return this.eachAfter(fp);
            },
            each: function (e, t) {
              let n = -1;
              for (let r of this) e.call(t, r, ++n, this);
              return this;
            },
            eachAfter: function (e, t) {
              for (var n, r, o, i = this, a = [i], s = [], l = -1; (i = a.pop()); )
                if ((s.push(i), (n = i.children))) for (r = 0, o = n.length; r < o; ++r) a.push(n[r]);
              for (; (i = s.pop()); ) e.call(t, i, ++l, this);
              return this;
            },
            eachBefore: function (e, t) {
              for (var n, r, o = this, i = [o], a = -1; (o = i.pop()); )
                if ((e.call(t, o, ++a, this), (n = o.children))) for (r = n.length - 1; r >= 0; --r) i.push(n[r]);
              return this;
            },
            find: function (e, t) {
              let n = -1;
              for (let r of this) if (e.call(t, r, ++n, this)) return r;
            },
            sum: function (e) {
              return this.eachAfter(function (t) {
                for (var n = +e(t.data) || 0, r = t.children, o = r && r.length; --o >= 0; ) n += r[o].value;
                t.value = n;
              });
            },
            sort: function (e) {
              return this.eachBefore(function (t) {
                t.children && t.children.sort(e);
              });
            },
            path: function (e) {
              for (
                var t = this,
                  n = (function (e, t) {
                    if (e === t) return e;
                    var n = e.ancestors(),
                      r = t.ancestors(),
                      o = null;
                    for (e = n.pop(), t = r.pop(); e === t; ) (o = e), (e = n.pop()), (t = r.pop());
                    return o;
                  })(t, e),
                  r = [t];
                t !== n;

              )
                r.push((t = t.parent));
              for (var o = r.length; e !== n; ) r.splice(o, 0, e), (e = e.parent);
              return r;
            },
            ancestors: function () {
              for (var e = this, t = [e]; (e = e.parent); ) t.push(e);
              return t;
            },
            descendants: function () {
              return Array.from(this);
            },
            leaves: function () {
              var e = [];
              return (
                this.eachBefore(function (t) {
                  t.children || e.push(t);
                }),
                e
              );
            },
            links: function () {
              var e = this,
                t = [];
              return (
                e.each(function (n) {
                  n !== e && t.push({ source: n.parent, target: n });
                }),
                t
              );
            },
            copy: function () {
              return f_(this).eachBefore(fv);
            },
            [Symbol.iterator]: function* () {
              var e,
                t,
                n,
                r,
                o = this,
                i = [o];
              do for (e = i.reverse(), i = []; (o = e.pop()); ) if ((yield o, (t = o.children))) for (n = 0, r = t.length; n < r; ++n) i.push(t[n]);
              while (i.length);
            }
          }),
          (function e(t) {
            function n(e, n, r, o, i) {
              !(function (e, t, n, r, o, i) {
                for (var a, s, l, u, c, d, f, h, p, _, g, m = [], v = t.children, y = 0, b = 0, x = v.length, w = t.value; y < x; ) {
                  (l = o - n), (u = i - r);
                  do c = v[b++].value;
                  while (!c && b < x);
                  for (d = f = c, p = Math.max(f / (g = c * c * (_ = Math.max(u / l, l / u) / (w * e))), g / d); b < x; ++b) {
                    if (((c += s = v[b].value), s < d && (d = s), s > f && (f = s), (h = Math.max(f / (g = c * c * _), g / d)) > p)) {
                      c -= s;
                      break;
                    }
                    p = h;
                  }
                  m.push((a = { value: c, dice: l < u, children: v.slice(y, b) })),
                    a.dice
                      ? (function (e, t, n, r, o) {
                          for (var i, a = e.children, s = -1, l = a.length, u = e.value && (r - t) / e.value; ++s < l; )
                            ((i = a[s]).y0 = n), (i.y1 = o), (i.x0 = t), (i.x1 = t += i.value * u);
                        })(a, n, r, o, w ? (r += (u * c) / w) : i)
                      : (function (e, t, n, r, o) {
                          for (var i, a = e.children, s = -1, l = a.length, u = e.value && (o - n) / e.value; ++s < l; )
                            ((i = a[s]).x0 = t), (i.x1 = r), (i.y0 = n), (i.y1 = n += i.value * u);
                        })(a, n, r, w ? (n += (l * c) / w) : o, i),
                    (w -= c),
                    (y = b);
                }
              })(t, e, n, r, o, i);
            }
            return (
              (n.ratio = function (t) {
                return e((t *= 1) > 1 ? t : 1);
              }),
              n
            );
          })((1 + Math.sqrt(5)) / 2),
          !(function () {
            try {
              if ("undefined" != typeof document) {
                var e = document.createElement("style");
                e.appendChild(
                  document.createTextNode(
                    "._handle_bk7m7_1 {\n  fill: var(--color-handle-fill);\n  stroke: var(--color-handle-stroke);\n}\n\n._dragging_bk7m7_6 {\n  fill: var(--color-handle-drag-fill);\n}\n\n._dot_bk7m7_10 {\n  fill: var(--color-handle-dots);\n}\n\n._line_bk7m7_14 {\n  stroke: var(--color-handle-line);\n}\n._slice_1knu8_1 {\n  fill: var(--color-primary);\n}\n\n._unsliced_1knu8_5 {\n  fill: var(--color-background);\n  opacity: 0.5;\n  pointer-events: none;\n}\n._container_jtap0_1 {\n  /** Old mappings - to be removed in next major */\n  --color-background: rgb(51, 51, 51);\n  --color-on-background: #fff;\n\n  --color-tooltip: rgba(0, 5, 11, 0.9);\n  --color-on-tooltip: #fff;\n\n  --color-handle-fill: #2c343a;\n  --color-handle-stroke: #67c2e4;\n  --color-handle-drag-fill: transparent;\n  --color-handle-dots: #67c2e4;\n  --color-handle-line: #67c2e4;\n\n  /** New mappings */\n  --tooltip-background: var(--color-tooltip);\n  --tooltip-color: var(--color-on-tooltip);\n  --tooltip-border-radius: 5px;\n  --tooltip-spacing: 5px;\n\n  --chart-background: var(--color-background);\n  --chart-color: var(--color-on-background);\n\n  --chart-handle-fill: var(--color-handle-fill);\n  --chart-handle-stroke: var(--color-handle-stroke);\n  --chart-handle-drag-fill: var(--color-handle-drag-fill);\n  --chart-handle-dots: var(--color-handle-dots);\n  --chart-handle-line: var(--color-handle-line);\n}\n._container_19vag_1 {\n  display: flex;\n  overflow: auto;\n}\n\n  ._container_19vag_1._horizontal_19vag_5 {\n    align-items: center;\n    flex-direction: row;\n  }\n\n  ._container_19vag_1._vertical_19vag_10 {\n    flex-direction: column;\n  }\n._symbol_f5unn_1 {\n  width: 15px;\n  height: 3px;\n}\n._entry_1493o_1 {\n  display: flex;\n  color: var(--color-on-primary);\n  padding: 8px;\n  will-change: transparency;\n  transition: opacity 150ms ease-in;\n}\n\n  ._entry_1493o_1._vertical_1493o_8 {\n    flex-direction: row;\n    align-items: center;\n  }\n\n  ._entry_1493o_1._vertical_1493o_8:first-child {\n      padding-top: 0;\n    }\n\n  ._entry_1493o_1._vertical_1493o_8:last-child {\n      padding-bottom: 0;\n    }\n\n  ._entry_1493o_1._vertical_1493o_8 ._label_1493o_20 {\n      margin-left: 8px;\n    }\n\n  ._entry_1493o_1._vertical_1493o_8 svg {\n      display: block;\n      margin: 0 auto;\n    }\n\n  ._entry_1493o_1._horizontal_1493o_30 {\n    align-items: center;\n    flex-direction: row;\n  }\n\n  ._entry_1493o_1._horizontal_1493o_30:first-child {\n      padding-left: 0;\n    }\n\n  ._entry_1493o_1._horizontal_1493o_30:last-child {\n      padding-right: 0;\n    }\n\n  ._entry_1493o_1._horizontal_1493o_30 ._label_1493o_20 {\n      margin-left: 8px;\n    }\n\n  ._entry_1493o_1 ._label_1493o_20 {\n    font-size: 12px;\n  }\n\n  ._entry_1493o_1 svg {\n    width: 15px;\n    height: 15px;\n  }\n._container_1gnp9_1 {\n  display: flex;\n  height: 100%;\n}\n\n  ._container_1gnp9_1._vertical_1gnp9_5 {\n    flex-direction: column;\n    max-width: 55px;\n  }\n\n  ._container_1gnp9_1._vertical_1gnp9_5 ._start_1gnp9_9,\n    ._container_1gnp9_1._vertical_1gnp9_5 ._end_1gnp9_10 {\n      text-align: center;\n      padding: 5px 0;\n      width: 100%;\n    }\n\n  ._container_1gnp9_1._vertical_1gnp9_5 ._gradient_1gnp9_16 {\n      width: 25px;\n      margin: 0 auto;\n    }\n\n  ._container_1gnp9_1._horizontal_1gnp9_22 {\n    flex-direction: row-reverse;\n  }\n\n  ._container_1gnp9_1._horizontal_1gnp9_22 ._start_1gnp9_9,\n    ._container_1gnp9_1._horizontal_1gnp9_22 ._end_1gnp9_10 {\n      max-width: 20%;\n    }\n\n  ._container_1gnp9_1._horizontal_1gnp9_22 ._start_1gnp9_9 {\n      text-align: right;\n      padding-left: 5px;\n    }\n\n  ._container_1gnp9_1._horizontal_1gnp9_22 ._end_1gnp9_10 {\n      text-align: left;\n      padding-right: 5px;\n    }\n\n  ._container_1gnp9_1 ._gradient_1gnp9_16 {\n    flex: 1;\n    width: 100%;\n    border-radius: 2px;\n  }\n\n  ._container_1gnp9_1 ._start_1gnp9_9,\n  ._container_1gnp9_1 ._end_1gnp9_10 {\n    color: var(--color-on-primary);\n    font-size: 12px;\n    white-space: nowrap;\n    overflow: hidden;\n    text-overflow: ellipsis;\n  }\n._gridLine_5yx3q_1 {\n  shape-rendering: crispEdges;\n  pointer-events: none;\n}\n._gridStripe_xcrvl_1 {\n  pointer-events: none;\n}\n._markLine_1sfls_1 {\n  pointer-events: none;\n  stroke-dasharray: 4, 4;\n  stroke-linecap: round;\n}\n._label_uiu20_1 {\n  font-size: 16px;\n  margin-bottom: 3px;\n  color: var(--color-on-tooltip);\n}\n\n._value_uiu20_7 {\n  font-size: 13px;\n  color: var(--color-on-tooltip);\n  opacity: 0.7;\n}\n\n._subValue_uiu20_13 {\n  display: block;\n  text-align: left;\n  padding: 3px 5px;\n}\n\n._subValue_uiu20_13 ._subValueColor_uiu20_18 {\n    width: 5px;\n    height: 15px;\n    margin-right: 8px;\n    display: inline-block;\n  }\n\n._subValue_uiu20_13 ._subValueName_uiu20_25 {\n    margin-right: 5px;\n  }\n._inactive_l7ttq_1 {\n  opacity: 0.2;\n}\n._scatterPlot_gc5eo_1 {\n  overflow: visible;\n}\n._point_u68jv_1 {\n  stroke: rgba(255, 255, 255, 0.5);\n  stroke-width: 1px;\n}\n._areaChart_yyojn_1 {\n  overflow: visible;\n}\n._barChart_sfjii_1 {\n  overflow: visible;\n}\n\n  ._barChart_sfjii_1._stackedNormalized_sfjii_4 .bar, ._barChart_sfjii_1._stacked_sfjii_4 .bar, ._barChart_sfjii_1._marimekko_sfjii_6 .bar {\n      stroke: var(--color-background);\n      stroke-width: 0.2;\n    }\n._marker_agib4_1 {\n  fill: var(--color-primary);\n  cursor: pointer;\n}\n._label_qd893_1 {\n  font-size: 12px;\n  -webkit-user-select: none;\n     -moz-user-select: none;\n          user-select: none;\n  pointer-events: none;\n}\n._link_15b6h_1 {\n  fill: none;\n  transition: stroke-opacity 100ms ease-in-out, stroke 100ms ease-in-out;\n  mix-blend-mode: screen;\n}\n\n._tooltip_15b6h_7 {\n  text-align: center;\n  pointer-events: none;\n}\n\n._tooltip_15b6h_7 ._tooltipLabel_15b6h_11 {\n    font-size: 16px;\n    margin-bottom: 3px;\n    color: rgba(255, 255, 255, 1);\n    text-align: center;\n  }\n\n._tooltip_15b6h_7 ._tooltipValue_15b6h_18 {\n    font-size: 13px;\n    color: rgba(255, 255, 255, 0.7);\n    text-align: center;\n  }\n._node_oqk6h_1 {\n  transition: opacity 100ms ease-in-out, fill-opacity 100ms ease-in-out;\n}\n\n._tooltip_oqk6h_5 {\n  text-align: center;\n  padding: 0 8px;\n  pointer-events: none;\n}\n\n._tooltip_oqk6h_5 ._tooltipLabel_oqk6h_10 {\n    font-size: 16px;\n    margin-bottom: 3px;\n    color: rgba(255, 255, 255, 1);\n    text-align: center;\n  }\n\n._tooltip_oqk6h_5 ._tooltipValue_oqk6h_17 {\n    font-size: 13px;\n    color: rgba(255, 255, 255, 0.7);\n    text-align: center;\n  }\n._inactive_1yzca_1 {\n  opacity: 0.4;\n  transition: opacity 200ms ease-in-out;\n}\n._valueLabel_1eyd5_1 {\n  font-size: 14px;\n  font-weight: 400;\n  fill: var(--color-on-background);\n  opacity: 0.6;\n}\n._valueLabel_1h164_1 {\n  font-size: 18px;\n  font-weight: 400;\n  fill: var(--color-on-background);\n}\n._stackedValueLabel_1w6zx_1 {\n  font-size: 18px;\n  font-weight: 400;\n  fill: var(--color-on-background);\n}\n._stackedDescriptionLabel_1h95t_1 {\n  font-size: 12px;\n  font-weight: 400;\n  fill: var(--color-on-background);\n}\n._cell_r3f8c_1 {\n  transition: stroke 150ms ease-in-out;\n}\n._item_18e6r_1 {\n  margin-bottom: 5px;\n  align-items: center;\n  display: grid;\n  grid-column-gap: 5px;\n  grid-row-gap: 3px;\n}\n\n  ._item_18e6r_1._labelStart_18e6r_8._valueEnd_18e6r_9 {\n      grid-template-columns: 2fr 2fr 1fr;\n      grid-template-areas: 'label bar value-label';\n    }\n\n  ._item_18e6r_1._labelBottom_18e6r_15._valueEnd_18e6r_9 {\n      grid-template-columns: 1fr 50px;\n      grid-template-areas:\n        'bar value-label'\n        'label label';\n    }\n\n  ._item_18e6r_1._labelNone_18e6r_24 ._label_18e6r_8 {\n      display: none;\n    }\n\n  ._item_18e6r_1._labelNone_18e6r_24._valueEnd_18e6r_9 {\n      grid-template-columns: 1fr 50px;\n      grid-template-areas: 'bar value-label';\n    }\n\n  ._item_18e6r_1._labelEnd_18e6r_35._valueStart_18e6r_36 {\n      grid-template-columns: 50px 1fr 1fr;\n      grid-template-areas: 'value-label bar label';\n    }\n\n  ._item_18e6r_1._labelTop_18e6r_42._valueStart_18e6r_36 {\n      grid-template-columns: 50px 1fr;\n      grid-template-areas:\n        'label label'\n        'value-label bar';\n    }\n\n  ._item_18e6r_1._labelTop_18e6r_42._valueEnd_18e6r_9 {\n      grid-template-columns: 1fr 50px;\n      grid-template-areas:\n        'label label'\n        'bar value-label';\n    }\n\n  ._item_18e6r_1._labelTop_18e6r_42._valueBottom_18e6r_57 {\n      grid-template-columns: 1fr;\n      grid-template-areas:\n        'label'\n        'bar'\n        'value-label';\n    }\n\n  ._item_18e6r_1._labelTop_18e6r_42._valueNone_18e6r_65 {\n      grid-template-columns: 1fr;\n      grid-template-areas:\n        'label'\n        'bar';\n    }\n\n  ._item_18e6r_1._labelTop_18e6r_42._valueNone_18e6r_65 ._valueLabel_18e6r_71 {\n        display: none;\n      }\n\n  ._item_18e6r_1._clickable_18e6r_77 {\n    cursor: pointer;\n  }\n\n  ._item_18e6r_1 ._label_18e6r_8,\n  ._item_18e6r_1 ._valueLabel_18e6r_71 {\n    cursor: inherit;\n  }\n\n  ._item_18e6r_1 ._label_18e6r_8 {\n    grid-area: label;\n  }\n\n  ._item_18e6r_1 ._valueLabel_18e6r_71 {\n    grid-area: value-label;\n    line-height: 10px;\n    text-overflow: ellipsis;\n    overflow-x: hidden;\n  }\n\n  ._item_18e6r_1 ._outerBar_18e6r_97 {\n    grid-area: bar;\n    width: 100%;\n    height: 10px;\n    display: flex;\n    align-items: center;\n  }\n\n  ._item_18e6r_1 ._bar_18e6r_105 {\n    height: 5px;\n  }\n._container_13giw_1 {\n  display: flex;\n  flex-direction: row;\n  justify-content: space-between;\n  align-items: center;\n}\n\n  ._container_13giw_1 > div {\n    flex: 1;\n  }"
                  )
                ),
                  document.head.appendChild(e);
              }
            } catch (e) {
              console.error("vite-plugin-css-injected-by-js", e);
            }
          })();
        class fx extends f.Component {
          getAlign() {
            let { align: e, half: t } = this.props;
            return ("inside" === e || "outside" === e) && "center" === t
              ? "center"
              : "inside" === e
                ? "start" === t
                  ? "end"
                  : "start"
                : "outside" === e
                  ? "start" === t
                    ? "start"
                    : "end"
                  : e;
          }
          getTickLineSpacing() {
            let { line: e } = this.props;
            if (!e) return [0, 0];
            let t = e.props.size,
              n = e.props.position;
            return "start" === n ? [-1 * t, 0] : "end" === n ? [0, t] : [-0.5 * t, 0.5 * t];
          }
          getOffset() {
            let { padding: e, position: t, rotation: n, orientation: r } = this.props,
              o = "number" == typeof e ? { fromAxis: e, alongAxis: e } : e,
              i = this.getTickLineSpacing(),
              a = "start" === t ? i[0] - o.fromAxis : "end" === t ? i[1] + o.fromAxis : 0,
              s = this.getAlign(),
              l = !0 === n ? -5 : 0;
            l += "center" === s ? 0 : "start" === s ? -o.alongAxis : o.alongAxis;
            let u = "horizontal" === r;
            return { [u ? "x" : "y"]: l, [u ? "y" : "x"]: a };
          }
          getTextPosition() {
            let { angle: e, orientation: t, position: n } = this.props,
              r = "",
              o = "",
              i = "middle";
            if (0 !== e) (r = `rotate(${e})`), (o = "end");
            else {
              let e = this.getAlign();
              "horizontal" === t
                ? ((o = "center" === e ? "middle" : "start" === e ? "end" : "start"), "start" === n ? (i = "baseline") : "end" === n && (i = "hanging"))
                : ((i = "center" === e ? "middle" : "start" === e ? "baseline" : "hanging"), (o = "start" === n ? "end" : "end" === n ? "start" : "middle"));
            }
            return { transform: r, textAnchor: this.props.textAnchor || o, alignmentBaseline: i };
          }
          render() {
            let { fill: e, text: t, fullText: n, fontSize: r, fontFamily: o, className: i } = this.props,
              { x: a, y: s } = this.getOffset(),
              l = this.getTextPosition();
            return (0, d.jsxs)("g", {
              transform: `translate(${a}, ${s})`,
              fontSize: r,
              fontFamily: o,
              children: [(0, d.jsx)("title", { children: n }), (0, d.jsx)("text", { ...l, fill: e, className: i, children: t })]
            });
          }
        }
        fx.defaultProps = { fill: "#8F979F", fontSize: 11, fontFamily: "sans-serif", rotation: !0, padding: 0, align: "center" };
        class fw extends f.PureComponent {
          positionTick() {
            let { size: e, position: t, orientation: n } = this.props,
              r = "vertical" === n,
              o = e || 0,
              i = "start" === t ? -1 * o : "center" === t ? -0.5 * o : 0,
              a = i + o;
            return { x1: r ? a : 0, x2: r ? i : 0, y1: r ? 0 : i, y2: r ? 0 : a };
          }
          render() {
            let { strokeColor: e, strokeWidth: t, className: n } = this.props,
              r = this.positionTick();
            return (0, d.jsx)("line", { className: n, strokeWidth: t, stroke: e, ...r });
          }
        }
        fw.defaultProps = { strokeColor: "#8F979F", strokeWidth: 1, size: 5 };
        let fk =
            "undefined" == typeof window
              ? "en"
              : navigator.languages && navigator.languages.length
                ? navigator.languages[0]
                : navigator.userLanguage || navigator.language || navigator.browserLanguage
                  ? "en"
                  : void 0,
          fM = { year: "numeric", month: "numeric", day: "numeric", hour12: !0, formatMatcher: "best fit" };
        function fj(e) {
          return void 0 !== e ? (e instanceof Date ? e.toLocaleDateString(fk, fM) : "number" == typeof e ? e.toLocaleString() : e) : "No value";
        }
        let fE = [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10, 15, 60, 900, 1800, 3600, 7200, 14400, 21600, 28800, 43200, 86400];
        function fS(e, t) {
          if (e.length > t) {
            let n = [],
              r = Math.floor(e.length / t);
            for (let t = 0; t < e.length; t++) t % r == 0 && n.push(e[t]);
            e = n;
          }
          return e;
        }
        function fT(e, t) {
          return Math.floor(t / Math.max(e, 0));
        }
        function fC(e, t, n, r = 100, o) {
          let i;
          return (
            t ||
            (e.ticks
              ? "duration" === n
                ? (function (e, t) {
                    let n = e[1] - e[0],
                      r = null;
                    for (let e of fE)
                      if (n / e < t) {
                        r = e;
                        break;
                      }
                    null === r && (r = 86400 * Math.ceil(n / 86400 / t));
                    let o = [e[0]];
                    for (; o[o.length - 1] + r <= e[1]; ) o.push(o[o.length - 1] + r);
                    return o;
                  })(e.domain(), r)
                : o
                  ? e.ticks(o)
                  : "time" === n
                    ? fS(e.ticks(), r)
                    : e.ticks(r)
              : fS((t = e.domain()), r))
          );
        }
        let fP = {},
          fN = (e, t, n) => {
            let r = `${e}_${t}_${n}`;
            if (fP[r]) return fP[r];
            if ("undefined" == typeof window || "undefined" == typeof document) {
              let t = { height: parseInt("string" == typeof n ? n : n.toString(), 10), width: 8 * e.length };
              return (fP[r] = t), t;
            }
            let o = document.createElement("div");
            (o.style.fontFamily = t),
              (o.style.fontSize = "string" == typeof n ? n : `${n}px`),
              (o.style.position = "absolute"),
              (o.style.left = "-9999px"),
              (o.style.whiteSpace = "nowrap"),
              (o.style.height = "auto"),
              (o.style.fontWeight = "normal"),
              (o.style.lineHeight = "normal"),
              (o.style.width = "auto"),
              (o.style.wordBreak = "normal"),
              (o.textContent = e),
              document.body.appendChild(o);
            let i = { height: o.offsetHeight, width: o.offsetWidth };
            return document.body.removeChild(o), (fP[r] = i), i;
          };
        class fA extends f.Component {
          getAdjustedScale() {
            let { scale: e } = this.props;
            if (!e.bandwidth) return t => +e(t);
            {
              let t = e.bandwidth() / 2;
              return e.round() && (t = Math.round(t)), n => +e(n) + t;
            }
          }
          getPosition(e) {
            let { orientation: t } = this.props;
            return "horizontal" === t ? { x: e, y: 0 } : { x: 0, y: e };
          }
          getDimension() {
            let { height: e, width: t, orientation: n } = this.props;
            return "vertical" === n ? e : t;
          }
          getRotationAngle(e) {
            if (!this.props.label) return 0;
            let t = this.props.label.props,
              n = this.getDimension(),
              r = eY(e, e => e.width),
              o = 0;
            if (t.rotation) {
              if (!0 === t.rotation) {
                let t = r,
                  i = Math.floor(n / e.length);
                for (; t > i && o > -90; ) (o -= 30), (t = Math.cos((Math.PI / 180) * o) * r);
              } else o = t.rotation;
            }
            return o;
          }
          getLabelFormat() {
            let { label: e, scale: t } = this.props;
            return e && e.props.format ? e.props.format : t.tickFormat ? t.tickFormat.apply(t, [5]) : e => fj(e);
          }
          getTicks() {
            let { scale: e, tickSize: t, tickValues: n, interval: r, axis: o, label: i } = this.props,
              a = this.getDimension(),
              s = fT(t, a),
              l = fC(e, n, o.type, s, r),
              u = this.getAdjustedScale(),
              c = this.getLabelFormat(),
              d = a / 2;
            return l.map(e => {
              let t = c(e),
                n = u(e),
                r = this.getPosition(n),
                o = eH(t, 18),
                a = i ? fN(o, i.props.fontFamily, i.props.fontSize.toString()) : {};
              return { ...r, ...a, text: o, fullText: t, half: n === d ? "center" : n < d ? "start" : "end" };
            });
          }
          render() {
            let { label: e, line: t, height: n, width: r, orientation: o } = this.props,
              i = this.getTicks(),
              a = this.getRotationAngle(i);
            return (0, d.jsx)(f.Fragment, {
              children: i.map((i, s) =>
                (0, d.jsxs)(
                  "g",
                  {
                    transform: `translate(${i.x}, ${i.y})`,
                    children: [
                      t && (0, d.jsx)(eB, { element: t, height: n, width: r, orientation: o }),
                      e && (0, d.jsx)(eB, { element: e, text: i.text, fullText: i.fullText, half: i.half, angle: a, orientation: o, line: t })
                    ]
                  },
                  s
                )
              )
            });
          }
        }
        fA.defaultProps = { line: (0, d.jsx)(fw, {}), label: (0, d.jsx)(fx, {}), tickSize: 30 };
        let fO = ({ strokeColor: e, strokeWidth: t, strokeGradient: n, scale: r, orientation: o, className: i }) => {
          let a = eO(),
            [s, l] = r.range();
          return (0, d.jsxs)(f.Fragment, {
            children: [
              (0, d.jsx)("line", {
                className: i,
                x1: "vertical" === o ? 0 : s,
                x2: "vertical" === o ? 1e-5 : l,
                y1: "vertical" === o ? s : 0,
                y2: "vertical" === o ? l : 1e-5,
                strokeWidth: t,
                stroke: n ? `url(#axis-gradient-${a})` : e
              }),
              n && (0, d.jsx)(eB, { element: n, id: `axis-gradient-${a}` })
            ]
          });
        };
        fO.defaultProps = { strokeColor: "#8F979F", strokeWidth: 1 };
        class f$ extends f.Component {
          constructor(e) {
            super(e), (this.ref = (0, f.createRef)()), (this.state = { height: e.height, width: e.width });
          }
          componentDidMount() {
            this.updateDimensions();
          }
          componentDidUpdate(e) {
            let { height: t, width: n, scale: r } = this.props;
            (n !== e.width || t !== e.height || r !== e.scale) && this.updateDimensions();
          }
          updateDimensions() {
            let e, t;
            let { onDimensionsChange: n, orientation: r, position: o } = this.props;
            if ("center" !== o) {
              let n = this.ref.current.getBoundingClientRect();
              (t = Math.floor(n.width)), (e = Math.floor(n.height));
            }
            "vertical" === r
              ? this.state.width !== t && (this.setState({ width: t }), n({ width: t }))
              : this.state.height !== e && (this.setState({ height: e }), n({ height: e }));
          }
          getPosition() {
            let { position: e, width: t, height: n, orientation: r } = this.props,
              o = 0,
              i = 0;
            return (
              "end" === e && "horizontal" === r
                ? (o = n)
                : "center" === e && "horizontal" === r
                  ? (o = n / 2)
                  : "end" === e && "vertical" === r
                    ? (i = t)
                    : "center" === e && "vertical" === r && (i = t / 2),
              { translateX: i, translateY: o }
            );
          }
          render() {
            let { scale: e, height: t, width: n, orientation: r, axisLine: o, tickSeries: i } = this.props,
              { translateX: a, translateY: s } = this.getPosition();
            return (0, d.jsxs)("g", {
              transform: `translate(${a}, ${s})`,
              ref: this.ref,
              children: [
                o && (0, d.jsx)(eB, { element: o, height: t, width: n, scale: e, orientation: r }),
                (i.props.line || i.props.label) && (0, d.jsx)(eB, { element: i, height: t, width: n, scale: e, orientation: r, axis: this.props })
              ]
            });
          }
        }
        f$.defaultProps = { axisLine: (0, d.jsx)(fO, {}), tickSeries: (0, d.jsx)(fA, {}), scaled: !1, roundDomains: !1, onDimensionsChange: () => void 0 };
        let fD = e => (0, d.jsx)(fx, { ...e });
        fD.defaultProps = { ...fx.defaultProps, rotation: !0, position: "end", align: "center" };
        let fz = e => (0, d.jsx)(fw, { ...e });
        fz.defaultProps = { ...fw.defaultProps, position: "end" };
        let fR = e => (0, d.jsx)(fA, { ...e });
        fR.defaultProps = { ...fA.defaultProps, tickSize: 75, line: (0, d.jsx)(fz, {}), label: (0, d.jsx)(fD, {}) };
        let fL = e => (0, d.jsx)(f$, { ...e });
        fL.defaultProps = {
          ...f$.defaultProps,
          position: "end",
          roundDomains: !1,
          scaled: !1,
          type: "value",
          orientation: "horizontal",
          tickSeries: (0, d.jsx)(fR, {})
        };
        let fF = e => (0, d.jsx)(fx, { ...e });
        fF.defaultProps = { ...fx.defaultProps, rotation: !1, position: "start", align: "center" };
        let fI = e => (0, d.jsx)(fw, { ...e });
        fI.defaultProps = { ...fw.defaultProps, position: "start" };
        let fB = e => (0, d.jsx)(fA, { ...e });
        fB.defaultProps = { ...fA.defaultProps, tickSize: 30, line: (0, d.jsx)(fI, {}), label: (0, d.jsx)(fF, {}) };
        let fU = e => (0, d.jsx)(f$, { ...e });
        fU.defaultProps = {
          ...f$.defaultProps,
          orientation: "vertical",
          scaled: !1,
          roundDomains: !1,
          type: "value",
          position: "start",
          tickSeries: (0, d.jsx)(fB, {})
        };
        let fq = e => !!e.tickSeries.props.label || !!e.tickSeries.props.line,
          fH = ({ stroke: e, size: t, position: n, innerRadius: r, outerRadius: o }) =>
            (0, d.jsx)("line", { x1: "outside" === n ? t : -(o - r), x2: 0, stroke: e, style: { pointerEvents: "none" } });
        fH.defaultProps = { stroke: "rgba(113, 128, 141, .5)", size: 10, position: "inside" };
        let fY = e => (180 * e) / Math.PI,
          fW = ({ point: e, autoRotate: t, rotation: n, padding: r, data: o, fill: i, fontFamily: a, fontSize: s, format: l, lineSize: u, index: c }) => {
            let { transform: h, textAnchor: p } = (0, f.useMemo)(() => {
                let o, i;
                if (t) {
                  let t = e >= Math.PI,
                    a = e < 2 * Math.PI;
                  (o = (n >= 85 && n <= 95) || (n <= -85 && n >= -95) ? "middle" : t && a ? "end" : "start"), (i = `rotate(${90 - fY(e)}, ${r}, 0)`);
                } else {
                  let e = n > 100 && n;
                  (o = e ? "end" : "start"), (i = `rotate(${180 * !!e}) translate(${e ? -30 : 0})`);
                }
                return { transform: i, textAnchor: o };
              }, [t, r, e, n]),
              _ = l ? l(o, c) : fj(o);
            return (0, d.jsxs)("g", {
              transform: h,
              children: [
                (0, d.jsx)("title", { children: _ }),
                (0, d.jsx)("text", { dy: "0.35em", x: u + 5, textAnchor: p, fill: i, fontFamily: a, fontSize: s, children: _ })
              ]
            });
          };
        fW.defaultProps = { fill: "#71808d", fontSize: 11, padding: 15, fontFamily: "sans-serif", autoRotate: !0 };
        let fZ = ({ line: e, label: t, scale: n, outerRadius: r, data: o, index: i, padding: a, innerRadius: s }) => {
          let l = n(o),
            u = (180 * l) / Math.PI - 90,
            c = `rotate(${u}) translate(${r + a},0)`,
            f = e ? e.props.size : 0;
          return (0, d.jsxs)("g", {
            transform: c,
            children: [
              e && (0, d.jsx)(eB, { element: e, innerRadius: s, outerRadius: r }),
              t && (0, d.jsx)(eB, { element: t, index: i, point: l, rotation: u, lineSize: f, data: o })
            ]
          });
        };
        fZ.defaultProps = { outerRadius: 0, padding: 0, line: (0, d.jsx)(fH, {}), label: (0, d.jsx)(fW, {}) };
        let fX = ({ scale: e, count: t, outerRadius: n, tick: r, tickValues: o, innerRadius: i, interval: a, type: s }) => {
          let l = fC(e, o, s, t, a || t);
          return (0, d.jsx)(f.Fragment, {
            children: l.map((t, o) => (0, d.jsx)(eB, { element: r, index: o, scale: e, data: t, innerRadius: i, outerRadius: n }, o))
          });
        };
        fX.defaultProps = { count: 12, type: "time", tick: (0, d.jsx)(fZ, {}) };
        let fV = ({ index: e, stroke: t, strokeDasharray: n, scale: r }) => {
          let o = r(e),
            i = "string" == typeof t ? t : t(e),
            a = "string" == typeof n ? n : n(e);
          return (0, d.jsx)("circle", { fill: "none", strokeDasharray: a, stroke: i, style: { pointerEvents: "none" }, cx: "0", cy: "0", r: o });
        };
        fV.defaultProps = { stroke: "#71808d", strokeDasharray: "1,4" };
        let fG = ({ count: e, outerRadius: t, ticks: n, arcs: r }) => {
            let o = [],
              i = (2 * Math.PI) / n;
            for (let a of r) {
              let r = (a / e) * t,
                s = [];
              for (let e = 0; e < n; e++) {
                let t = e * i;
                s.push({ x: r * Math.sin(Math.PI - t), y: r * Math.cos(Math.PI - t) });
              }
              o.push([...s, s[0]]);
            }
            return o;
          },
          fJ = ({ count: e, innerRadius: t, outerRadius: n, line: r, arc: o, tickValues: i }) => {
            let a = t7().domain([0, e]).range([t, n]),
              s = a.ticks(e),
              l = fG({ count: e, outerRadius: n, ticks: i.length, arcs: s });
            return (0, d.jsxs)(d.Fragment, {
              children: [
                r && (0, d.jsx)(d.Fragment, { children: l.map((e, t) => (0, d.jsx)(eB, { element: r, data: e, index: t }, t)) }),
                o && (0, d.jsx)(d.Fragment, { children: s.map(e => (0, d.jsx)(eB, { element: o, index: e, scale: a }, e)) })
              ]
            });
          };
        fJ.defaultProps = { type: "arc", count: 12, arc: (0, d.jsx)(fV, {}) };
        new oG.Scale({ k: 1e3, M: 1e6, B: 1e9 }), new oG.Scale({ M: 1, B: 1e3, T: 1e6 });
        let fK = e => {
          let t = 0,
            n = "";
          for (let r of e.toString().split("").reverse()) t > 0 && t % 3 == 0 && (n = "," + n), (n = r + n), t++;
          return n;
        };
        function fQ(e, t) {
          let n = (e, n) => (Array.isArray(e.data) ? n(e.data, e => e[t]) : e[t]);
          return [eW(e, e => n(e, eW)), eY(e, e => n(e, eY))];
        }
        function f0({ data: e, scaled: t = !1, isDiverging: n = !1 }) {
          let [r, o] = fQ(e, "y"),
            [i, a] = fQ(e, "y1");
          if (r < 0 || n) {
            let e = Math.max(-r, o);
            return [-e, e];
          }
          return t ? [i, a] : [0, a];
        }
        function f1({ data: e, scaled: t = !1, isDiverging: n = !1 }) {
          let r = fQ(e, "x0")[0],
            o = fQ(e, "x1")[1];
          if ("number" == typeof r && "number" == typeof o) {
            if (r < 0 || n) {
              let e = Math.max(-r, o);
              return [-e, e];
            }
            if (!t) return [0, o];
          }
          return [r, o];
        }
        function f2(e) {
          return "smooth" === e ? ou : "step" === e ? od : r5;
        }
        let f3 = e => {
            let t = e.domain(),
              n = e(t[0]),
              r = e.step(),
              [, o] = e.range();
            return e => {
              let i = Math.floor((e - n) / r);
              return 0 === o && (i *= -1), t[Math.max(0, Math.min(i, t.length - 1))];
            };
          },
          f5 = (e, t, n, r = "x") => {
            if (t.invert) {
              let o = t.invert(e),
                i = (0, eV(e => e[r]).right)(n, o),
                a = n[Math.max(0, i - 1)],
                s = Math.min(n.length - 1, i),
                l = n[s],
                u = a[r],
                c = l[r];
              return (u = o - u) < (c -= o) ? a : l;
            }
            {
              let r;
              let o = t.domain();
              return (r = t.mariemkoInvert ? t.mariemkoInvert(e) : f3(t)(e)), n[o.indexOf(r)];
            }
          },
          f8 = e => {
            let t = e.target.ownerSVGElement;
            if (t) for (; t.ownerSVGElement; ) t = t.ownerSVGElement;
            return t;
          },
          f6 = ({ target: e, clientX: t, clientY: n }) => {
            let r = e.getBoundingClientRect();
            return { x: t - ((null == r ? void 0 : r.left) || 0) - e.clientLeft, y: n - ((null == r ? void 0 : r.top) || 0) - e.clientTop };
          },
          f4 = (e, t) => {
            let n = f8(e);
            if (!n) return null;
            let { top: r, left: o } = n.getBoundingClientRect(),
              i = e.clientX - o,
              a = e.clientY - r;
            return oJ(oQ(t), { x: i, y: a });
          },
          f7 = (e, t, n) =>
            [
              { x: 0, y: 0 },
              { x: t, y: e }
            ].map(e => oJ(n, e)),
          f9 = (e, t, n) => {
            let [r, o] = f7(e, t, n);
            return !!(o.x < t) || !!(o.y < e) || !!(r.x > 0) || !!(r.y > 0);
          },
          he = (e, t) => e.scaleFactorMin && e.d * t <= e.scaleFactorMin,
          ht = (e, t) => e.scaleFactorMax && e.d * t >= e.scaleFactorMax,
          hn = (e, t) => {
            let n = he(e, t) && t < 1,
              r = ht(e, t) && t > 1;
            return n || r;
          };
        function hr(e) {
          let t = e ? "" : "none";
          ["-webkit-touch-callout", "-webkit-user-select", "-khtml-user-select", "-moz-user-select", "-ms-user-select", "user-select"].forEach(
            e => (document.body.style[e] = t)
          );
        }
        let ho = (e, t, n) => ("function" == typeof t ? t(n) : "className" === e ? io(t) : void 0 !== t || null !== t ? t : {}),
          hi = (e, t) => ({ className: ho("className", e.className, t), style: ho("style", e.style, t) });
        function ha(e, ...t) {
          let n = [],
            r = (e, o) => {
              for (let i of e) {
                let e = t[o];
                if (void 0 === e) throw Error(`Accessor not found for depth: ${o}`);
                let a = e(i);
                Array.isArray(a) ? r(a, o + 1) : n.includes(a) || n.push(a);
              }
            };
          return r(e, 0), n;
        }
        function hs({ key: e, x: t = 0, size: n, paddingY: r, wrap: o = !0, paddingX: i, width: a, height: s, fontFamily: l, fontSize: u }) {
          n = n || fN(e, l, u);
          let c = e.toString().split(/\s+/);
          if (c.length > 1 && n.width > a) {
            let e = [],
              f = 0,
              h = 0,
              p = "",
              _ = 0,
              g = "",
              m = 0;
            for (let t of c)
              (m = fN((g = "" === p ? t : `${p} ${t}`), l, u).width) <= a - (i ? 2 * i : 0)
                ? ((p = g), (_ = m))
                : (e.push(p), (f = Math.max(f, _)), (_ = fN((p = t), l, u).width));
            return (e.push(p), (h = e.length * n.height), (s && h >= s - (r ? 2 * r : 0)) || (a && f >= a - (i ? 2 * i : 0)))
              ? null
              : !o && e.length > 1
                ? e[0]
                : e.map((e, r) =>
                    (0, d.jsx)(
                      "tspan",
                      {
                        dominantBaseline: "alphabetic",
                        style: { baselineShift: "0%" },
                        dy: r > 0 ? n.height : s ? n.height / 2 - 5 : -h / 2 + n.height,
                        x: t,
                        children: e
                      },
                      r
                    )
                  );
          }
          return (s && n.height + r >= s) || (a && n.width + i >= a)
            ? null
            : (0, d.jsx)("tspan", { dominantBaseline: "alphabetic", style: { baselineShift: "0%" }, dy: n.height / 2 - 5, x: t, children: e });
        }
        let hl = ({ arcs: e, ticks: t, xScale: n, height: r, width: o, innerRadius: i, type: a }) => {
          let s = Math.min(r, o) / 2,
            l = fC(n, t.props.tickValues, a, t.props.count, t.props.interval || t.props.count);
          return (0, d.jsxs)(f.Fragment, {
            children: [
              e && (0, d.jsx)(eB, { element: e, outerRadius: s, innerRadius: i, tickValues: l }),
              t && (0, d.jsx)(eB, { element: t, scale: n, type: a, innerRadius: i, outerRadius: s })
            ]
          });
        };
        hl.defaultProps = { innerRadius: 10, type: "value", arcs: (0, d.jsx)(fJ, {}), ticks: (0, d.jsx)(fX, {}) };
        class hu extends f.Component {
          constructor() {
            super(...arguments),
              (this.started = !1),
              (this.deltaX = 0),
              (this.deltaY = 0),
              (this.prevXPosition = 0),
              (this.prevYPosition = 0),
              (this.onMouseMove = e => {
                e.preventDefault(), e.stopPropagation();
                let { movementX: t, movementY: n } = e;
                (this.deltaX = this.deltaX + t),
                  (this.deltaY = this.deltaY + n),
                  this.checkThreshold()
                    ? (this.disableText(!0),
                      this.setCursor(!0),
                      (this.deltaX = 0),
                      (this.deltaY = 0),
                      (this.started = !0),
                      this.props.onMoveStart({ nativeEvent: e, type: "mouse" }))
                    : (this.rqf = requestAnimationFrame(() => {
                        this.props.onMove({ nativeEvent: e, type: "mouse", x: t, y: n });
                      }));
              }),
              (this.onMouseUp = e => {
                e.preventDefault(),
                  e.stopPropagation(),
                  this.disposeHandlers(),
                  this.started ? this.props.onMoveEnd({ nativeEvent: e, type: "mouse" }) : this.props.onMoveCancel({ nativeEvent: e, type: "mouse" });
              }),
              (this.onTouchMove = e => {
                e.preventDefault(), e.stopPropagation();
                let { clientX: t, clientY: n } = this.getTouchCoords(e),
                  r = t - this.prevXPosition,
                  o = n - this.prevYPosition;
                (this.deltaX = this.deltaX + r),
                  (this.deltaY = this.deltaY + o),
                  this.checkThreshold()
                    ? (this.disableText(!0),
                      this.setCursor(!0),
                      (this.deltaX = 0),
                      (this.deltaY = 0),
                      (this.started = !0),
                      this.props.onMoveStart({ nativeEvent: { ...e, clientX: t, clientY: n }, type: "touch" }))
                    : (this.rqf = requestAnimationFrame(() => {
                        this.props.onMove({ nativeEvent: { ...e, clientX: t, clientY: n }, type: "touch", x: r, y: o });
                      })),
                  (this.prevXPosition = t),
                  (this.prevYPosition = n);
              }),
              (this.onTouchEnd = e => {
                e.preventDefault(),
                  e.stopPropagation(),
                  this.disposeHandlers(),
                  this.started ? this.props.onMoveEnd({ nativeEvent: e, type: "touch" }) : this.props.onMoveCancel({ nativeEvent: e, type: "touch" });
              });
          }
          componentWillUnmount() {
            cancelAnimationFrame(this.rqf), this.disposeHandlers();
          }
          disposeHandlers() {
            window.removeEventListener("mousemove", this.onMouseMove),
              window.removeEventListener("mouseup", this.onMouseUp),
              window.removeEventListener("touchmove", this.onTouchMove),
              window.removeEventListener("touchend", this.onTouchEnd),
              this.setCursor(!1),
              this.disableText(!0);
          }
          disableText(e) {
            this.props.disableText && hr(e);
          }
          setCursor(e) {
            let { cursor: t } = this.props;
            t && (e || (t = "inherit"), (document.body.style.cursor = t));
          }
          checkThreshold() {
            let { threshold: e } = this.props;
            return !this.started && (Math.abs(this.deltaX) > e || Math.abs(this.deltaY) > e);
          }
          getTouchCoords(e) {
            let { clientX: t, clientY: n } = e.touches[0];
            return { clientX: t, clientY: n };
          }
          onMouseDown(e) {
            let { preventRightClick: t, disabled: n } = this.props;
            (3 !== e.nativeEvent.which || !t) &&
              !n &&
              (e.preventDefault(),
              e.stopPropagation(),
              (this.started = !1),
              window.addEventListener("mousemove", this.onMouseMove),
              window.addEventListener("mouseup", this.onMouseUp));
          }
          onTouchStart(e) {
            let { disabled: t } = this.props;
            !t &&
              1 === e.touches.length &&
              (e.preventDefault(),
              e.stopPropagation(),
              (this.started = !1),
              (this.prevXPosition = e.touches[0].clientX),
              (this.prevYPosition = e.touches[0].clientY),
              window.addEventListener("touchmove", this.onTouchMove),
              window.addEventListener("touchend", this.onTouchEnd));
          }
          render() {
            return f.Children.map(this.props.children, e =>
              (0, f.cloneElement)(e, {
                ...e.props,
                onMouseDown: t => {
                  this.onMouseDown(t), e.props.onMouseDown && e.props.onMouseDown(t);
                },
                onTouchStart: t => {
                  this.onTouchStart(t), e.props.onTouchStart && e.props.onTouchStart(t);
                }
              })
            );
          }
        }
        hu.defaultProps = {
          preventRightClick: !0,
          disableText: !0,
          threshold: 0,
          onMoveStart: () => void 0,
          onMove: () => void 0,
          onMoveEnd: () => void 0,
          onMoveCancel: () => void 0
        };
        class hc extends f.PureComponent {
          constructor() {
            super(...arguments), (this.state = { isDragging: !1 });
          }
          onMoveStart() {
            this.setState({ isDragging: !0 });
          }
          onMove(e) {
            this.props.onHandleDrag(e.x);
          }
          onMoveEnd() {
            this.setState({ isDragging: !1 });
          }
          render() {
            let { height: e } = this.props,
              { isDragging: t } = this.state;
            return (0, d.jsx)(hu, {
              cursor: "ew-resize",
              onMoveStart: ii(this.onMoveStart, this),
              onMove: ii(this.onMove, this),
              onMoveEnd: ii(this.onMoveEnd, this),
              children: (0, d.jsxs)("g", {
                children: [
                  (0, d.jsx)("line", { className: "_line_bk7m7_14", y1: "0", y2: e, x1: "5", x2: "5" }),
                  (0, d.jsx)("rect", {
                    className: io("_handle_bk7m7_1", { _dragging_bk7m7_6: t }),
                    height: e - 10,
                    style: { cursor: "ew-resize" },
                    width: 8,
                    y: "5",
                    y1: e - 5
                  }),
                  (0, d.jsx)("g", {
                    transform: `translate(-1, ${e / 2 - 10})`,
                    style: { pointerEvents: "none" },
                    children: eJ(5).map(e => (0, d.jsx)("circle", { cy: 5 * e, cx: "5", r: ".5", className: "_dot_bk7m7_10" }, e))
                  })
                ]
              })
            });
          }
        }
        let hd = "_unsliced_1knu8_5";
        class hf extends f.PureComponent {
          constructor() {
            super(...arguments), (this.state = { isDragging: !1 });
          }
          onMoveStart() {
            let { start: e, end: t, width: n } = this.props;
            (0 !== e || t !== n) && this.setState({ isDragging: !0 });
          }
          onMove({ x: e }) {
            let { onBrushChange: t, width: n } = this.props,
              { start: r, end: o } = this.props;
            (r += e), (o += e), r >= 0 && o <= n && t({ start: r, end: o });
          }
          onMoveEnd() {
            this.setState({ isDragging: !1 });
          }
          onHandleDrag(e, t) {
            let { onBrushChange: n } = this.props,
              { start: r, end: o } = this.props;
            n({ start: (r = "start" === e ? r + t : r), end: (o = "start" !== e ? o + t : o) });
          }
          render() {
            let { height: e, start: t, end: n, width: r } = this.props,
              { isDragging: o } = this.state,
              i = Math.max(n - t, 0),
              a = Math.max(r - n, 0),
              s = 0 === t && n === r;
            return (0, d.jsxs)(f.Fragment, {
              children: [
                (0, d.jsx)("rect", { className: hd, height: e, width: t }),
                (0, d.jsx)("rect", { transform: `translate(${n}, 0)`, className: hd, height: e, width: a }),
                (0, d.jsxs)("g", {
                  transform: `translate(${t}, 0)`,
                  children: [
                    (0, d.jsx)(hu, {
                      cursor: "grabbing",
                      onMoveStart: ii(this.onMoveStart, this),
                      onMove: ii(this.onMove, this),
                      onMoveEnd: ii(this.onMoveEnd, this),
                      children: (0, d.jsx)("rect", {
                        className: "_slice_1knu8_1",
                        height: e,
                        width: i,
                        style: { cursor: o ? "grabbing" : "grab", opacity: 0.1 * !s, pointerEvents: s ? "none" : "initial" }
                      })
                    }),
                    (0, d.jsx)("g", {
                      transform: "translate(-4, 0)",
                      children: (0, d.jsx)(hc, { height: e, onHandleDrag: ii(this.onHandleDrag, this, "start") })
                    }),
                    (0, d.jsx)("g", {
                      transform: `translate(${i - 5}, 0)`,
                      children: (0, d.jsx)(hc, { height: e, onHandleDrag: ii(this.onHandleDrag, this, "end") })
                    })
                  ]
                })
              ]
            });
          }
        }
        class hh extends f.PureComponent {
          constructor(e) {
            super(e), (this.state = { isSlicing: !1, isPanning: !1, start: e.start || 0, end: e.end || e.width });
          }
          componentDidUpdate(e) {
            if (
              (e.width !== this.props.width && this.state.end === e.width && this.setState({ end: this.props.width }),
              !this.state.isSlicing && !this.state.isPanning)
            ) {
              let { start: t, end: n } = this.props,
                r = t !== e.start && t !== this.state.start,
                o = n !== e.end && n !== this.state.end;
              (r || o) && this.setState({ ...this.ensurePositionInBounds(t, n) });
            }
          }
          getStartEnd(e, t = this.state) {
            let n, r;
            let { x: o } = this.getPositionsForPanEvent(e);
            return o < t.initial ? ((n = o), (r = t.initial)) : ((n = t.initial), (r = o)), this.ensurePositionInBounds(n, r, t);
          }
          getPositionsForPanEvent(e) {
            return f6({ target: this.ref, clientX: e.clientX, clientY: e.clientY });
          }
          ensurePositionInBounds(e, t, n = this.state) {
            let { width: r } = this.props,
              o = e,
              i = t;
            return (
              (void 0 === o || o <= 0) && (o = 0),
              void 0 === i && (i = r),
              o > i && (o = n.start),
              i < o && (i = n.end),
              i >= r && (i = r),
              { start: o, end: i }
            );
          }
          onMoveStart(e) {
            let { disabled: t } = this.props;
            if (!t) {
              let t = this.getPositionsForPanEvent(e.nativeEvent);
              this.setState({ isSlicing: !0, initial: t.x });
            }
          }
          onMove(e) {
            let { disabled: t } = this.props;
            t ||
              this.setState(t => {
                let { onBrushChange: n } = this.props,
                  { start: r, end: o } = this.getStartEnd(e.nativeEvent, t);
                return n && n({ start: r, end: o }), { start: r, end: o };
              });
          }
          onMoveEnd() {
            this.setState({ isSlicing: !1 });
          }
          onMoveCancel() {
            let e = { start: 0, end: this.props.width };
            this.setState(e), this.props.onBrushChange && this.props.onBrushChange(e);
          }
          onSliceChange(e) {
            let t = this.ensurePositionInBounds(e.start, e.end);
            this.setState(t), this.props.onBrushChange && this.props.onBrushChange(t);
          }
          render() {
            let { children: e, disabled: t, height: n, width: r } = this.props,
              { isSlicing: o, start: i, end: a } = this.state;
            return (0, d.jsx)(hu, {
              cursor: "crosshair",
              onMoveStart: ii(this.onMoveStart, this),
              onMove: ii(this.onMove, this),
              onMoveEnd: ii(this.onMoveEnd, this),
              onMoveCancel: ii(this.onMoveCancel, this),
              children: (0, d.jsxs)("g", {
                style: { pointerEvents: o ? "none" : "auto", cursor: t ? "" : "crosshair" },
                children: [
                  e,
                  !t &&
                    (0, d.jsxs)(f.Fragment, {
                      children: [
                        (0, d.jsx)("rect", { ref: e => (this.ref = e), height: n, width: r, opacity: 0 }),
                        void 0 !== i && void 0 !== a && (0, d.jsx)(hf, { start: i, end: a, height: n, width: r, onBrushChange: ii(this.onSliceChange, this) })
                      ]
                    })
                ]
              })
            });
          }
        }
        hh.defaultProps = { disabled: !1, height: 0, width: 0, onBrushChange: () => void 0 };
        class hp extends f.Component {
          getBrushOffset() {
            let e, t;
            let { disabled: n, domain: r, scale: o } = this.props;
            return !n && r && ((e = o(r[0])), (t = o(r[1]))), { start: e, end: t };
          }
          onBrushChange(e) {
            let { onBrushChange: t, scale: n, width: r } = this.props;
            if (t) {
              let o;
              if (void 0 !== e.start && void 0 !== e.end && (0 !== e.start || e.end !== r)) {
                if (n.invert) o = [n.invert(e.start), n.invert(e.end)];
                else {
                  let t = n.step(),
                    r = Math.ceil((e.start - t / 2) / t),
                    i = Math.ceil((e.end - t / 2) / t);
                  o = [n.domain()[r], n.domain()[i]];
                }
              }
              t({ domain: o });
            }
          }
          render() {
            let { scale: e, height: t, width: n, children: r, ...o } = this.props;
            return (0, d.jsx)(hh, { ...o, ...this.getBrushOffset(), height: t, width: n, onBrushChange: ii(this.onBrushChange, this), children: r });
          }
        }
        hp.defaultProps = {};
        let { Provider: h_, Consumer: hg } = (0, f.createContext)({}),
          hm = ({
            className: e,
            children: t,
            center: n,
            centerX: r,
            centerY: o,
            style: i,
            margins: a,
            containerClassName: s,
            xAxisVisible: l,
            yAxisVisible: u,
            id: c,
            ...h
          }) => {
            let p = eO(c),
              [_, g] = (0, f.useState)(!1),
              [m, v] = (0, f.useState)(!1),
              [y, b] = (0, f.useState)(0),
              [x, w] = (0, f.useState)(0),
              { observe: k, width: M, height: j } = iu(),
              E = (0, f.useMemo)(() => !!j && !!M && (!l || !!_) && (!u || !!m), [j, M, _, l, u, m]),
              S = (0, f.useCallback)((e, t) => {
                "horizontal" === e ? g(!0) : v(!0), t.height && w(t.height), t.width && b(t.width);
              }, []),
              T = (0, f.useMemo)(
                () => ({
                  chartSized: E,
                  id: p,
                  updateAxes: S,
                  yAxisSized: m,
                  xAxisSized: _,
                  ...(function ({ xOffset: e, yOffset: t, height: n, width: r, margins: o }) {
                    let i, a, s, l;
                    let u =
                        ((i = 0),
                        (a = 0),
                        (s = 0),
                        (l = 0),
                        Array.isArray(o)
                          ? 2 === o.length
                            ? ((i = o[0]), (s = o[0]), (l = o[1]), (a = o[1]))
                            : 4 === o.length && ((i = o[0]), (a = o[1]), (s = o[2]), (l = o[3]))
                          : void 0 !== o && ((i = o), (a = o), (s = o), (l = o)),
                        { top: i, right: a, bottom: s, left: l }),
                      c = (function (e, t, n) {
                        let { left: r, right: o, bottom: i, top: a } = n;
                        return { height: e - a - i, width: t - r - o };
                      })(n, r, u),
                      d = c.width - e,
                      f = c.height - t;
                    return { xOffset: e, yOffset: t, height: n, width: r, chartWidth: d, chartHeight: f, xMargin: e + u.left, yMargin: u.top };
                  })({ margins: a, height: j, width: M, yOffset: x, xOffset: y })
                }),
                [E, p, S, m, _, a, j, M, x, y]
              ),
              C = n || r ? M / 2 : T.xMargin,
              P = n || o ? j / 2 : T.yMargin,
              N = void 0 !== h.height && null !== h.height ? h.height : "100%",
              A = void 0 !== h.width && null !== h.width ? h.width : "100%";
            return (0, d.jsx)("div", {
              ref: k,
              style: { height: N, width: A },
              className: io(s, "_container_jtap0_1"),
              children: (0, d.jsx)(h_, {
                value: T,
                children:
                  j > 0 &&
                  M > 0 &&
                  (0, d.jsx)("svg", {
                    width: M,
                    height: j,
                    className: e,
                    style: i,
                    children: (0, d.jsx)("g", { transform: `translate(${C}, ${P})`, children: t(T) })
                  })
              })
            });
          };
        function hv(e, t) {
          if (!ic.isInstance(e)) return e;
          if (!t.greater(1e6)) return e.toJSNumber();
          {
            let n = t.divide(1e6);
            return e.divide(n).toJSNumber();
          }
        }
        function hy(e) {
          return ic.isInstance(e) ? fK(e) : e;
        }
        function hb(e) {
          let t = ic.one;
          for (let n of e) {
            let e = hx(n.data);
            e.greater(t) && (t = e);
          }
          return t;
        }
        function hx(e) {
          let t = ic.one;
          for (let n of e)
            if (ic.isInstance(n.data)) {
              let e = n.data;
              e.greater(t) && (t = e);
            }
          return t;
        }
        function hw(e, t = !1, n = "vertical") {
          let r = [],
            o = hb(e),
            i = "vertical" === n;
          for (let t of e)
            for (let e of t.data) {
              let n = hy(t.key),
                a = r.findIndex(e => {
                  let t = e.key;
                  return t instanceof Date && n instanceof Date ? t.getTime() === n.getTime() : t === n;
                });
              -1 === a && (r.push({ key: n, metadata: t.metadata, data: [] }), (a = r.length - 1));
              let s = hv(i ? e.key : e.data, o),
                l = hv(i ? e.data : e.key, o);
              r[a].data.push({ key: n, value: hy(e.data), metadata: e.metadata, id: t.id, x: s, x0: i ? s : 0, x1: s, y: l, y0: i ? 0 : l, y1: l });
            }
          return t && (r = r.sort((e, t) => (e1(e.data, e => e.y) < e1(t.data, e => e.y) ? 1 : -1))), r;
        }
        function hk(e, t = "vertical", n) {
          let r = [],
            o = hx(e),
            i = "vertical" === t;
          for (let t of e) {
            let e = Array.isArray(t.data),
              a = t.key;
            n &&
              (a = (function (e, t) {
                if (ic.isInstance(e) && ic.isInstance(t)) return e.add(t);
                if (e instanceof Date && "number" == typeof t) return new Date(e.valueOf() + t);
                if ("number" == typeof e && "number" == typeof t) return e + t;
                throw Error("Invalid types to addToChartTypes");
              })(t.key, n));
            let s = { k0: hv(t.key, o), k1: hv(a, o), v0: hv(e ? t.data[0] : 0, o), v1: hv(e ? t.data[1] : t.data, o) },
              l = i ? "k" : "v",
              u = i ? "v" : "k";
            r.push({
              key: hy(s.k0),
              value: hy(s.v1),
              metadata: t.metadata,
              id: t.id,
              x: s[`${l}1`],
              x0: s[`${l}0`],
              x1: s[`${l}1`],
              y: s[`${u}1`],
              y0: s[`${u}0`],
              y1: s[`${u}1`]
            });
          }
          return r;
        }
        function hM(e = [], t = "default", n = "vertical") {
          let r = ha(
              e,
              e => e.data,
              e => e.key
            ),
            o = (function (e) {
              let t = [],
                n = hb(e);
              for (let r of e)
                for (let e of r.data) {
                  let o = t.findIndex(e => (e.x instanceof Date && r.key instanceof Date ? e.x.getTime() === r.key.getTime() : e.x === r.key));
                  -1 === o && (t.push({ metadata: r.metadata, x: r.key, formattedValues: {} }), (o = t.length - 1)),
                    (t[o].metadata = e.metadata),
                    (t[o][e.key] = hv(e.data, n)),
                    (t[o].formattedValues[e.key] = hy(e.data));
                }
              return t;
            })(e),
            i = og();
          return (
            "expand" === t ? (i = i.offset(om)) : "diverging" === t && (i = i.offset(ov)),
            (function (e, t = "vertical") {
              let n = [],
                r = "vertical" === t;
              for (let t of e)
                for (let e of t) {
                  let o = e.data.x,
                    i = n.findIndex(e => (e.key instanceof Date && o instanceof Date ? e.key.getTime() === o.getTime() : e.key === o));
                  -1 === i && (n.push({ key: o, data: [] }), (i = n.length - 1));
                  let a = t.key,
                    s = e.data[a],
                    [l, u] = e;
                  n[i].data.push({
                    metadata: e.data.metadata,
                    key: o,
                    x: r ? a : u,
                    x0: r ? a : l,
                    x1: r ? a : u,
                    y: r ? s : a,
                    y0: r ? l : a,
                    y1: r ? u : a,
                    value: e.data.formattedValues[a]
                  });
                }
              return n;
            })(i.keys(r)(o), n)
          );
        }
        let hj = (e, t = "vertical", n) => {
          let r = hk(e, t, n),
            o = "vertical" === t ? "y" : "x",
            i = 0;
          for (let e of r) (e[`${o}0`] = i), (i += e[o]), (e[`${o}1`] = i), (e[o] = i);
          return r;
        };
        class hE extends f.Component {
          constructor() {
            super(...arguments),
              (this.prevXPosition = 0),
              (this.prevYPosition = 0),
              (this.started = !1),
              (this.deltaX = 0),
              (this.deltaY = 0),
              (this.childRef = (0, f.createRef)()),
              (this.onMouseDown = e => {
                !this.props.disabled &&
                  3 !== e.which &&
                  (this.props.globalPanning || !e.target || e.target.classList.contains("pan-container")) &&
                  (e.preventDefault(),
                  e.stopPropagation(),
                  hr(!1),
                  (this.started = !1),
                  window.addEventListener("mousemove", this.onMouseMove),
                  window.addEventListener("mouseup", this.onMouseUp));
              }),
              (this.onMouseMove = e => {
                e.preventDefault(),
                  e.stopPropagation(),
                  (this.deltaX = this.deltaX + e.movementX),
                  (this.deltaY = this.deltaY + e.movementY),
                  this.checkThreshold()
                    ? (this.props.cursor && (document.body.style.cursor = this.props.cursor),
                      (this.deltaX = 0),
                      (this.deltaY = 0),
                      (this.started = !0),
                      this.onPanStart(e, "mouse"))
                    : this.pan(e.movementX, e.movementY, e, "mouse");
              }),
              (this.onMouseUp = e => {
                e.preventDefault(),
                  e.stopPropagation(),
                  this.disposeHandlers(),
                  hr(!0),
                  this.started ? this.onPanEnd(e, "mouse") : this.props.onPanCancel({ nativeEvent: e, source: "mouse" });
              }),
              (this.onTouchStart = e => {
                !this.props.disabled &&
                  1 === e.touches.length &&
                  (e.preventDefault(),
                  e.stopPropagation(),
                  hr(!1),
                  (this.started = !1),
                  (this.prevXPosition = e.touches[0].clientX),
                  (this.prevYPosition = e.touches[0].clientY),
                  window.addEventListener("touchmove", this.onTouchMove),
                  window.addEventListener("touchend", this.onTouchEnd));
              }),
              (this.onTouchMove = e => {
                e.preventDefault(), e.stopPropagation();
                let t = e.touches[0].clientX,
                  n = e.touches[0].clientY,
                  r = t - this.prevXPosition,
                  o = n - this.prevYPosition;
                (this.deltaX = this.deltaX + r),
                  (this.deltaY = this.deltaY + o),
                  this.checkThreshold()
                    ? ((this.deltaX = 0), (this.deltaY = 0), (this.started = !0), this.onPanStart(e, "touch"))
                    : this.pan(r, o, e, "touch") || ((this.prevXPosition = t), (this.prevYPosition = n));
              }),
              (this.onTouchEnd = e => {
                e.preventDefault(),
                  e.stopPropagation(),
                  this.disposeHandlers(),
                  hr(!0),
                  this.started ? this.onPanEnd(e, "touch") : this.props.onPanCancel({ nativeEvent: e, source: "touch" });
              });
          }
          componentDidMount() {
            this.childRef.current &&
              (this.childRef.current.addEventListener("mousedown", this.onMouseDown, { passive: !1 }),
              this.childRef.current.addEventListener("touchstart", this.onTouchStart, { passive: !1 }));
          }
          componentWillUnmount() {
            this.disposeHandlers(),
              this.childRef.current &&
                (this.childRef.current.removeEventListener("mousedown", this.onMouseDown),
                this.childRef.current.removeEventListener("touchstart", this.onTouchStart));
          }
          disposeHandlers() {
            window.removeEventListener("mousemove", this.onMouseMove),
              window.removeEventListener("mouseup", this.onMouseUp),
              window.removeEventListener("touchmove", this.onTouchMove),
              window.removeEventListener("touchend", this.onTouchEnd),
              (document.body.style.cursor = "inherit"),
              hr(!0);
          }
          checkThreshold() {
            let { threshold: e } = this.props;
            return !this.started && (Math.abs(this.deltaX) > e || Math.abs(this.deltaY) > e);
          }
          onPanStart(e, t) {
            this.props.onPanStart({ nativeEvent: e, source: t });
          }
          onPanMove(e, t, n, r) {
            this.props.onPanMove({ source: n, nativeEvent: r, x: e, y: t });
          }
          onPanEnd(e, t) {
            let { onPanEnd: n } = this.props;
            n({ nativeEvent: e, source: t });
          }
          pan(e, t, n, r) {
            let { scale: o, constrain: i, width: a, height: s, matrix: l } = this.props,
              u = o5(o2(l, o1(e / o, t / o)), 100),
              c = i && f9(s, a, u);
            return c || this.onPanMove(u.e, u.f, r, n), c;
          }
          render() {
            return (0, d.jsx)("g", { ref: this.childRef, children: this.props.children });
          }
        }
        hE.defaultProps = {
          x: 0,
          y: 0,
          disabled: !1,
          scale: 1,
          threshold: 10,
          globalPanning: !0,
          onPanStart: () => void 0,
          onPanMove: () => void 0,
          onPanEnd: () => void 0,
          onPanCancel: () => void 0
        };
        let hS = (e, t) => ({ x: (e.x + t.x) / 2, y: (e.y + t.y) / 2 }),
          hT = (e, t) => Math.sqrt(Math.pow(t.y - e.y, 2) + Math.pow(t.x - e.x, 2));
        function hC(e, t) {
          let { left: n, top: r } = t.getBoundingClientRect(),
            [o, i] = [...e.touches].map(e => ({ x: e.clientX - Math.round(n), y: e.clientY - Math.round(r) })),
            a = hT(o, i),
            s = hS(o, i);
          return { pointA: o, pointB: i, distance: a, midpoint: s };
        }
        class hP extends f.Component {
          constructor() {
            super(...arguments),
              (this.childRef = (0, f.createRef)()),
              (this.onMouseWheel = e => {
                let { disableMouseWheel: t, requireZoomModifier: n, matrix: r, onZoomEnd: o } = this.props;
                if (t) return !1;
                let i = e.metaKey || e.ctrlKey;
                if (n && !i) return !1;
                e.preventDefault(), e.stopPropagation();
                let a = f4(e, r);
                if (a) {
                  let { x: t, y: n } = a,
                    r = this.getStep(e.deltaY);
                  this.scale(t, n, r, e), clearTimeout(this.timeout), (this.timeout = setTimeout(() => o(), 500));
                }
              }),
              (this.onTouchStart = e => {
                2 === e.touches.length &&
                  (e.preventDefault(),
                  e.stopPropagation(),
                  hr(!1),
                  (this.firstTouch = hC(e, this.childRef.current)),
                  (this.lastDistance = this.firstTouch.distance),
                  window.addEventListener("touchmove", this.onTouchMove),
                  window.addEventListener("touchend", this.onTouchEnd));
              }),
              (this.onTouchMove = e => {
                if (2 === e.touches.length) {
                  e.preventDefault(), e.stopPropagation();
                  let { distance: t } = hC(e, this.childRef.current),
                    n = t / this.lastDistance,
                    r = oJ(oQ(this.props.matrix), { x: this.firstTouch.midpoint.x, y: this.firstTouch.midpoint.y });
                  r.x && r.y && !this.scale(r.x, r.y, n, e) && (this.lastDistance = t);
                }
              }),
              (this.onTouchEnd = e => {
                e.preventDefault(),
                  e.stopPropagation(),
                  window.removeEventListener("touchmove", this.onTouchMove),
                  window.removeEventListener("touchend", this.onTouchEnd),
                  hr(!0),
                  this.props.onZoomEnd();
              });
          }
          componentDidMount() {
            let { disabled: e, disableMouseWheel: t } = this.props,
              n = this.childRef.current;
            !e &&
              n &&
              (t || n.addEventListener("mousewheel", this.onMouseWheel, { passive: !1 }), n.addEventListener("touchstart", this.onTouchStart, { passive: !1 }));
          }
          componentWillUnmount() {
            window.removeEventListener("touchmove", this.onTouchMove),
              window.removeEventListener("touchend", this.onTouchEnd),
              cancelAnimationFrame(this.rqf),
              clearTimeout(this.timeout);
            let e = this.childRef.current;
            e && (e.removeEventListener("mousewheel", this.onMouseWheel), e.removeEventListener("touchstart", this.onTouchStart)), hr(!0);
          }
          getStep(e) {
            let { scaleFactor: t } = this.props;
            return -e > 0 ? t + 1 : 1 - t;
          }
          scale(e, t, n, r) {
            let { minZoom: o, maxZoom: i, onZoom: a, matrix: s } = this.props,
              l = hn({ d: s.a, scaleFactorMin: o, scaleFactorMax: i }, n);
            if (!l) {
              let o = o5(o2(s, o1(e, t), o3(n, n), o1(-e, -t)), 100);
              this.rqf = requestAnimationFrame(() => {
                a({ scale: o.a, x: o.e, y: o.f, nativeEvent: r });
              });
            }
            return l;
          }
          render() {
            let { style: e, children: t } = this.props;
            return (0, d.jsx)("g", { ref: this.childRef, style: e, children: t });
          }
        }
        hP.defaultProps = { x: 0, y: 0, scale: 1, scaleFactor: 0.1, minZoom: 1, maxZoom: 10 };
        class hN extends f.PureComponent {
          render() {
            let { orientation: e, className: t, style: n, colorScheme: r, data: o } = this.props,
              i = iS
                .scale(r)
                .colors(10)
                .reverse()
                .map((e, t) => `${e} ${10 * t}%`)
                .join(","),
              [a, s] = e2(
                ha(
                  o,
                  e => e.data,
                  e => e.data
                )
              );
            return (0, d.jsxs)("div", {
              style: n,
              className: io("_container_1gnp9_1", t, { _vertical_1gnp9_5: "vertical" === e, _horizontal_1gnp9_22: "horizontal" === e }),
              children: [
                (0, d.jsx)("div", { className: "_start_1gnp9_9", children: fj(s) }),
                (0, d.jsx)("div", { className: "_gradient_1gnp9_16", style: { background: `linear-gradient(${"vertical" === e ? "" : "to left,"}${i})` } }),
                (0, d.jsx)("div", { className: "_end_1gnp9_10", children: fj(a) })
              ]
            });
          }
        }
        hN.defaultProps = { colorScheme: ["rgba(28, 107, 86, 0.5)", "#2da283"], orientation: "vertical" };
        let hA = ({ strokeWidth: e, direction: t, className: n, strokeColor: r, data: o, height: i, width: a, scale: s, strokeDasharray: l }) => {
          let u = (0, f.useMemo)(() => {
            let e = s(o);
            return "x" === t ? { x1: e, x2: e, y1: 0, y2: i } : { y1: e, y2: e, x1: 0, x2: a };
          }, [t, o, i, a, s]);
          return (0, d.jsx)("line", { ...u, className: io("_gridLine_5yx3q_1", n), strokeDasharray: l, strokeWidth: e, stroke: r, fill: "none" });
        };
        hA.defaultProps = { strokeWidth: 1, strokeDasharray: "2 5", direction: "all", strokeColor: "rgba(153, 153, 153, 0.5)" };
        let hO = ({ line: e, stripe: t, yScale: n, xScale: r, yAxis: o, xAxis: i, height: a, width: s }) => {
          let l = e => "all" === e || "y" === e,
            u = e => "all" === e || "x" === e,
            { yAxisGrid: c, xAxisGrid: h } = (0, f.useMemo)(
              () => ({
                yAxisGrid: fC(n, o.tickSeries.props.tickValues, o.type, fT(o.tickSeries.props.tickSize, a), o.tickSeries.props.interval),
                xAxisGrid: fC(r, i.tickSeries.props.tickValues, i.type, fT(i.tickSeries.props.tickSize, s), i.tickSeries.props.interval)
              }),
              [a, s, i, o, n, r]
            ),
            p = (0, f.useCallback)(
              (e, t, n, r, o) =>
                t.map((t, i) =>
                  (0, d.jsx)(
                    f.Fragment,
                    { children: (0, d.jsx)(eB, { element: e, index: i, scale: n, data: t, height: a, width: s, direction: r }) },
                    `${o}-${r}-${i}`
                  )
                ),
              [a, s]
            ),
            _ = (0, f.useCallback)(
              (e, t, o, i) => (0, d.jsxs)(f.Fragment, { children: [l(o.props.direction) && p(o, e, n, "y", i), u(o.props.direction) && p(o, t, r, "x", i)] }),
              [p, r, n]
            );
          return (0, d.jsxs)("g", { style: { pointerEvents: "none" }, children: [e && _(c, h, e, "line"), t && _(c, h, t, "stripe")] });
        };
        hO.defaultProps = { line: (0, d.jsx)(hA, { direction: "all" }), stripe: null };
        let h$ = ({ pointX: e, height: t, strokeWidth: n = 1, strokeColor: r = "#eee" }) =>
            (0, d.jsx)("line", { stroke: r, strokeWidth: n, y1: "0", vectorEffect: "non-scaling-stroke", y2: t, x1: e, x2: e, className: "_markLine_1sfls_1" }),
          hD = ({ color: e, offset: t, stopOpacity: n = 1 }) => (0, d.jsx)("stop", { offset: t, stopOpacity: n, stopColor: e }),
          hz = ({ id: e, color: t, direction: n, stops: r }) =>
            (0, d.jsx)("linearGradient", {
              spreadMethod: "pad",
              id: e,
              ...("vertical" === n ? { x1: "10%", x2: "10%", y1: "100%", y2: "0%" } : { y1: "0%", y2: "0%", x1: "0%", x2: "100%" }),
              children: r.map((e, n) => (0, d.jsx)(eB, { element: e, color: e.props.color || t }, `gradient-${n}`))
            });
        hz.defaultProps = {
          direction: "vertical",
          stops: [(0, d.jsx)(hD, { offset: "0%", stopOpacity: 0.3 }, "start"), (0, d.jsx)(hD, { offset: "80%", stopOpacity: 1 }, "stop")]
        };
        let hR = ({ id: e, fill: t }) =>
            (0, d.jsx)("mask", { id: e, children: (0, d.jsx)("rect", { x: "0", y: "0", width: "100%", height: "100%", fill: t }) }),
          hL = ({ value: e, color: t, className: n }) => {
            if (!e) return null;
            let r = (e, n) => {
                let r = t(e, n);
                return (0, d.jsxs)("span", {
                  className: "_subValue_uiu20_13",
                  children: [
                    (0, d.jsx)("span", { className: "_subValueColor_uiu20_18", style: { backgroundColor: r } }),
                    (0, d.jsxs)("span", { className: "_subValueName_uiu20_25", children: [fj(e.key || e.x), ":"] }),
                    (0, d.jsx)("span", { children: fj(e.value || e.y) })
                  ]
                });
              },
              o = Array.isArray(e.data);
            return (0, d.jsxs)("div", {
              className: n,
              role: "tooltip",
              children: [
                (0, d.jsx)("div", { className: "_label_uiu20_1", children: fj(e.x) }),
                (0, d.jsxs)("div", {
                  className: "_value_uiu20_7",
                  children: [
                    o &&
                      (e => {
                        let t = e.data.length - 15,
                          n = e.data.slice(0, 15);
                        return (0, d.jsxs)(f.Fragment, {
                          children: [
                            n.map((e, t) => (0, d.jsx)(f.Fragment, { children: r(e, t) }, t)),
                            t > 0 && (0, d.jsxs)("div", { children: ["...", t, " more..."] })
                          ]
                        });
                      })(e),
                    !o && (0, d.jsx)(f.Fragment, { children: fj(e.value || e.y) })
                  ]
                })
              ]
            });
          },
          hF = ({ content: e, value: t, data: n, color: r, ...o }) =>
            (0, d.jsx)(uI, {
              ...o,
              content: () => (t || n ? ("function" == typeof e ? e(n || t, r) : (0, f.cloneElement)(e, { ...e.props, value: t, color: r })) : null)
            });
        hF.defaultProps = { content: (0, d.jsx)(hL, {}) };
        class hI extends f.Component {
          constructor() {
            super(...arguments),
              (this.state = {}),
              (this.ref = (0, f.createRef)()),
              (this.transformData = (function (e, t) {
                void 0 === t && (t = uW);
                var n = null;
                function r() {
                  for (var r = [], o = 0; o < arguments.length; o++) r[o] = arguments[o];
                  if (n && n.lastThis === this && t(r, n.lastArgs)) return n.lastResult;
                  var i = e.apply(this, r);
                  return (n = { lastResult: i, lastArgs: r, lastThis: this }), i;
                }
                return (
                  (r.clear = function () {
                    n = null;
                  }),
                  r
                );
              })(e => {
                let { inverse: t, isHorizontal: n } = this.props,
                  r = [];
                if (t)
                  for (let t of e)
                    if (Array.isArray(t.data))
                      for (let e of t.data) {
                        let t = e.x,
                          n = r.findIndex(e => {
                            let n = e.x;
                            return n instanceof Date && t instanceof Date ? n.getTime() === t.getTime() : n === t;
                          });
                        -1 === n && (r.push({ x: e.x, data: [] }), (n = r.length - 1));
                        let o = r[n].data;
                        Array.isArray(o) && o.push(e);
                      }
                    else r.push(t);
                else
                  for (let t of e)
                    Array.isArray(t.data)
                      ? r.push({ ...t, x: t.key, data: t.data.map(e => ({ ...e, key: n ? e.y : e.x, value: n ? e.x : e.y })) })
                      : r.push({ ...t, x: void 0 === t.key ? t.x0 : t.key, y: void 0 === t.value ? t.y : t.value });
                return r;
              }));
          }
          getXCoord(e, t) {
            let { isRadial: n, width: r, height: o } = this.props;
            if (n) {
              let n = Math.min(r, o) / 2,
                i = Math.atan2(t - n, e - n) + Math.PI / 2;
              return i < 0 && (i += 2 * Math.PI), i;
            }
            return e;
          }
          onMouseMove(e) {
            let t, n, r;
            let { xScale: o, yScale: i, onValueEnter: a, height: s, width: l, data: u, isRadial: c, isHorizontal: d, placement: f } = this.props,
              { value: h } = this.state,
              p = this.transformData(u),
              _ = f;
            f || (_ = d ? "right" : "top");
            let { y: g, x: m } = f6({ target: this.ref.current, clientX: e.clientX, clientY: e.clientY });
            d ? ((t = i), (n = o), (r = g)) : ((r = this.getXCoord(m, g)), (t = o), (n = i));
            let v = f5(r, t, p);
            if (!lc(v, h) && v) {
              let r = t(v.x),
                o = n(v.y),
                i = 0,
                u = 0;
              if ((isNaN(o) ? ((o = s / 2), (i = 10), f || (_ = "right")) : (u = -10), r === this.prevX && o === this.prevY)) return;
              (this.prevY = o), (this.prevX = r);
              let { top: d, left: h } = e.target.getBoundingClientRect(),
                p = 0,
                g = 0;
              if (c) {
                let e = Math.min(l, s) / 2;
                (p = o * Math.cos(r - Math.PI / 2) + e), (g = o * Math.sin(r - Math.PI / 2) + e);
              } else (p = r), (g = o);
              (p += h + i),
                (g += d + u),
                this.setState({ placement: _, visible: !0, value: v, offsetX: p, offsetY: g }),
                a({ visible: !0, value: v, pointY: o, pointX: r, offsetX: p, offsetY: g, nativeEvent: e });
            }
          }
          onMouseLeave() {
            (this.prevX = void 0), (this.prevY = void 0), this.setState({ value: void 0, visible: !1 }), this.props.onValueLeave();
          }
          getTooltipReference() {
            let { offsetX: e, offsetY: t } = this.state;
            return { width: 4, height: 4, top: t, left: e };
          }
          renderRadial() {
            let { height: e, width: t, innerRadius: n, outerRadius: r } = this.props;
            (n = n || 0), (r = r || Math.min(t, e) / 2);
            let o = oz()({ innerRadius: n, outerRadius: r, startAngle: 180, endAngle: Math.PI / 2 });
            return (0, d.jsx)("path", { d: o, opacity: "0", cursor: "auto", ref: this.ref, onMouseMove: ii(this.onMouseMove, this) });
          }
          renderLinear() {
            let { height: e, width: t } = this.props;
            return (0, d.jsx)("rect", { height: e, ref: this.ref, width: t, opacity: 0, cursor: "auto", onMouseMove: ii(this.onMouseMove, this) });
          }
          render() {
            let { isRadial: e, children: t, tooltip: n, disabled: r, color: o } = this.props,
              { visible: i, placement: a, value: s } = this.state;
            return (0, d.jsxs)(f.Fragment, {
              children: [
                r && t,
                !r &&
                  (0, d.jsxs)("g", {
                    onMouseLeave: ii(this.onMouseLeave, this),
                    children: [
                      e && this.renderRadial(),
                      !e && this.renderLinear(),
                      (0, d.jsx)(eB, {
                        element: n,
                        visible: i,
                        placement: a,
                        modifiers: { offset: { offset: "0, 15px" } },
                        reference: this.getTooltipReference(),
                        color: o,
                        value: s
                      }),
                      t
                    ]
                  })
              ]
            });
          }
        }
        hI.defaultProps = { isRadial: !1, tooltip: (0, d.jsx)(hF, {}), inverse: !0, onValueEnter: () => void 0, onValueLeave: () => void 0 };
        class hB extends f.Component {
          constructor() {
            super(...arguments),
              (this.zoomRef = (0, f.createRef)()),
              (this.panRef = (0, f.createRef)()),
              (this.state = { isZooming: !1, isPanning: !1, matrix: { a: 1, c: 0, e: 0, b: 0, d: 1, f: 0 } });
          }
          static getDerivedStateFromProps(e, t) {
            let n = o2(
              (function (e) {
                return Array.isArray(e) ? e.map(t) : t(e);
                function t(e) {
                  switch (e.type) {
                    case "matrix":
                      if ("a" in e && "b" in e && "c" in e && "d" in e && "e" in e && "f" in e) return oK(e);
                      throw Error("MISSING_MANDATORY_PARAM");
                    case "translate":
                      if (!("tx" in e)) throw Error("MISSING_MANDATORY_PARAM");
                      if ("ty" in e) return o1(e.tx, e.ty);
                      return o1(e.tx);
                    case "scale":
                      if (!("sx" in e)) throw Error("MISSING_MANDATORY_PARAM");
                      if ("sy" in e) return o3(e.sx, e.sy);
                      return o3(e.sx);
                    case "rotate":
                      if (!("angle" in e)) throw Error("MISSING_MANDATORY_PARAM");
                      if ("cx" in e && "cy" in e) return o7(e.angle, e.cx, e.cy);
                      return o7(e.angle);
                    case "skewX":
                      if (!("angle" in e)) throw Error("MISSING_MANDATORY_PARAM");
                      return ie(e.angle, 0);
                    case "skewY":
                      if (!("angle" in e)) throw Error("MISSING_MANDATORY_PARAM");
                      return ie(0, e.angle);
                    case "shear":
                      if (!("shx" in e && "shy" in e)) throw Error("MISSING_MANDATORY_PARAM");
                      return { a: 1, c: e.shx, e: 0, b: e.shy, d: 1, f: 0 };
                    default:
                      throw Error("UNSUPPORTED_DESCRIPTOR");
                  }
                }
              })([
                { type: "translate", tx: e.x, ty: e.y },
                { type: "scale", sx: e.scale, sy: e.scale }
              ])
            );
            return lc(n, t.matrix) ? null : { matrix: n };
          }
          onPanStart(e) {
            this.setState({ isPanning: !0 }), this.props.onPanStart(e);
          }
          onPanMove(e) {
            this.props.onZoomPan({ scale: this.props.scale, x: e.x, y: e.y, type: "pan", nativeEvent: e.nativeEvent }), this.props.onPanMove(e);
          }
          onPanEnd(e) {
            this.setState({ isPanning: !1 }), this.props.onPanEnd(e);
          }
          onZoom(e) {
            this.props.onZoomPan({ x: e.x, y: e.y, scale: e.scale, nativeEvent: e.nativeEvent, type: "zoom" }), this.props.onZoom(e);
          }
          onZoomEnd() {
            this.setState({ isZooming: !1 }), this.props.onZoomEnd();
          }
          render() {
            let {
                height: e,
                width: t,
                children: n,
                disabled: r,
                pannable: o,
                maxZoom: i,
                minZoom: a,
                zoomable: s,
                scale: l,
                x: u,
                y: c,
                disableMouseWheel: f,
                constrain: h,
                zoomStep: p,
                onPanCancel: _,
                requireZoomModifier: g,
                globalPanning: m
              } = this.props,
              { isZooming: v, isPanning: y } = this.state,
              b = v || y ? "none" : "auto",
              x = oK(this.state.matrix);
            return (0, d.jsx)(hE, {
              x: u,
              y: c,
              scale: l,
              matrix: x,
              constrain: h,
              height: e,
              width: t,
              disabled: !o || r,
              ref: this.panRef,
              globalPanning: m,
              onPanStart: ii(this.onPanStart, this),
              onPanMove: ii(this.onPanMove, this),
              onPanEnd: ii(this.onPanEnd, this),
              onPanCancel: _,
              children: (0, d.jsxs)(hP, {
                ref: this.zoomRef,
                disabled: !s || r,
                scaleFactor: p,
                disableMouseWheel: f,
                maxZoom: i,
                minZoom: a,
                scale: l,
                x: u,
                y: c,
                style: { cursor: o ? "move" : "auto" },
                requireZoomModifier: g,
                matrix: x,
                onZoom: ii(this.onZoom, this),
                onZoomEnd: ii(this.onZoomEnd, this),
                children: [
                  !r && (0, d.jsx)("rect", { height: e, width: t, opacity: 0, className: "pan-container" }),
                  (0, d.jsx)("g", { style: { pointerEvents: b, userSelect: b }, children: n })
                ]
              })
            });
          }
        }
        function hU({ type: e, roundDomains: t, data: n, width: r, domain: o, padding: i, scaled: a, isMultiSeries: s = !1, isDiverging: l = !1 }) {
          let u;
          return (
            "time" === e || "duration" === e || "value" === e
              ? (u = (u = "time" === e ? rX().rangeRound([0, r]) : t7().rangeRound([0, r])).domain(o || f1({ data: n, scaled: a, isDiverging: l })))
              : (o || (o = s ? ha(n, e => e.key) : ha(n, e => e.x)),
                (u = r0()
                  .rangeRound([0, r])
                  .padding(i || 0)
                  .domain(o))),
            t ? u.nice() : u
          );
        }
        function hq({
          type: e,
          height: t,
          data: n,
          domain: r,
          roundDomains: o = !1,
          scaled: i = !1,
          padding: a = 0,
          isMultiSeries: s = !1,
          isDiverging: l = !1
        }) {
          let u;
          return (
            "time" === e || "value" === e || "duration" === e
              ? (u = t7()
                  .range([t, 0])
                  .domain(r || f0({ data: n, scaled: i, isDiverging: l })))
              : (r || (r = s ? ha(n, e => e.key) : ha(n, e => e.y)), (u = r0().rangeRound([t, 0]).padding(a).domain(r))),
            o ? u.nice() : u
          );
        }
        hB.defaultProps = {
          maxZoom: 10,
          minZoom: 0,
          zoomStep: 0.1,
          pannable: !0,
          zoomable: !0,
          constrain: !0,
          height: 0,
          width: 0,
          x: 0,
          y: 0,
          scale: 1,
          globalPanning: !0,
          onPanStart: () => void 0,
          onPanMove: () => void 0,
          onPanEnd: () => void 0,
          onPanCancel: () => void 0,
          onZoom: () => void 0,
          onZoomEnd: () => void 0
        };
        let hH = (e, t) => {
            let n = t7().rangeRound([0, e]);
            return t ? n.nice() : n;
          },
          hY = ({ data: e, width: t, valueScale: n, padding: r }) => {
            let o = ha(e, e => e.key),
              i = (t - r * (e.length - 1)) / t,
              a = e => {
                let [t] = e.data;
                return { x0: n(t.x0), x1: n(t.x1) };
              },
              s = t => {
                let n = 0,
                  o = e.findIndex(e => e.key === t),
                  s = e[o];
                if (s && s.data && s.data.length) {
                  let { x1: e, x0: t } = a(s);
                  (n = (e - t) / 2 + t), r && (n = n * i + o * r);
                }
                return n;
              };
            return (
              (s.range = () => [0, t]),
              (s.domain = () => o),
              (s.mariemkoInvert = t => {
                let n;
                for (let i = 0; i < o.length; i++) {
                  let s = o[i],
                    { x1: l, x0: u } = a(e[i]);
                  if (t >= u - r / 2 && t <= l - r / 2) {
                    n = s;
                    break;
                  }
                }
                return n;
              }),
              s
            );
          },
          hW = (e, t, n) => {
            0 === n[0] && 0 === n[1] && (n = [0, 1]);
            let r = t7()
              .range([e * e, t * t])
              .domain(n);
            return Object.assign(e => Math.sqrt(r(e)), r);
          };
        class hZ extends f.Component {
          onZoomPan(e) {
            let { width: t, data: n, axisType: r, roundDomains: o, onZoomPan: i } = this.props;
            if ("zoom" === e.type || ("pan" === e.type && e.scale > 1)) {
              let a = hU({ width: t, type: r, roundDomains: o, data: n });
              i({
                domain: a
                  .copy()
                  .domain(
                    a
                      .range()
                      .map(t => (t - e.x) / e.scale)
                      .map(a.clamp(!0).invert, e.x)
                  )
                  .domain(),
                isZoomed: 1 !== e.scale
              });
            }
          }
          getOffset() {
            let e = { scale: void 0, x: void 0 },
              { disabled: t, domain: n, width: r, data: o, axisType: i, roundDomains: a } = this.props;
            if (!t && n) {
              let t = hU({ width: r, type: i, roundDomains: a, data: o }),
                s = t(n[0]),
                l = r / (t(n[1]) - s);
              (s *= l), (e = { scale: l, x: -s });
            }
            return e;
          }
          render() {
            let { data: e, height: t, children: n, width: r, onZoomPan: o, ...i } = this.props,
              { scale: a, x: s } = this.getOffset();
            return (0, d.jsx)(hB, { ...i, scale: a, x: s, height: t, width: r, pannable: a > 1, onZoomPan: ii(this.onZoomPan, this), children: n });
          }
        }
        hZ.defaultProps = { onZoomPan: () => void 0 };
        let hX = { type: "spring", velocity: 5, damping: 20, restDelta: 0.01, restSpeed: 0.01 },
          hV = ({ custom: e, transition: t, ...n }) => {
            let r = (0, li.c)(e.exit.d),
              o = (0, li.c)(e.exit.d),
              i = uQ(o, { ...hX, from: 0, to: 1 });
            (0, f.useEffect)(() => {
              let t = tB(o.get(), e.enter.d),
                n = i.onChange(e => r.set(t(e)));
              return o.set(e.enter.d), n;
            });
            let { d: a, ...s } = e.enter,
              { d: l, ...u } = e.exit;
            return (0, d.jsx)(C.E.path, { ...n, initial: u, exit: u, animate: s, transition: t, d: !1 !== t.type ? r : a });
          },
          hG = { cybertron: iS.scale(["#2d60e8", "#26efb5"]).correctLightness().colors(8), ...iS.brewer },
          hJ = (e, t) =>
            e.map((e, n) => {
              if (e) {
                if (void 0 !== e[t]) return e[t];
                if (e.data && void 0 !== e.data[t]) return e.data[t];
              }
              return n;
            }),
          hK = e => {
            let {
              point: t,
              colorScheme: n,
              attribute: r,
              index: o,
              data: i,
              active: a,
              isMultiSeries: s,
              domain: l,
              key: u,
              scale: c
            } = { attribute: "key", isMultiSeries: !1, scale: rQ, ...e };
            if (("string" == typeof n && hG[n] && (n = hG[n]), Array.isArray(n))) {
              if (!l) {
                if (s && Array.isArray(i)) {
                  let e = (function (e, t) {
                    let n;
                    let r = -1,
                      o = -1;
                    if (void 0 === t) for (let t of e) ++o, null != t && (n < t || (void 0 === n && t >= t)) && ((n = t), (r = o));
                    else for (let i of e) null != (i = t(i, ++o, e)) && (n < i || (void 0 === n && i >= i)) && ((n = i), (r = o));
                    return r;
                  })(i, e => e.data.length);
                  i = i[e].data;
                }
                l = hJ(i, r);
              }
              return (u = void 0 !== u ? u : t[r]), c(n).domain(l)(u);
            }
            return "function" == typeof n ? n(t, o, a) : n;
          },
          hQ = { from: 0, duration: 1, delay: 0, format: !0, decimalPlaces: 0 },
          h0 = ({ from: e, to: t, duration: n, delay: r, prefix: o, suffix: i, decimalPlaces: a, format: s }) => {
            let l = (0, f.useRef)(null);
            return (
              (e = e || hQ.from),
              (n = n || hQ.duration),
              (r = r || hQ.delay),
              (s = s || hQ.format),
              (a = a || hQ.decimalPlaces),
              (0, f.useEffect)(() => {
                let u = l.current,
                  c = (0, u0.j)(e, t, {
                    duration: n,
                    delay: r,
                    onUpdate(e) {
                      let t = e;
                      (t = a ? Number(e.toFixed(a)) : Number(e.toFixed(0))),
                        s && (t = t.toLocaleString()),
                        u && (o && (t = `${o}${t}`), i && (t = `${t}${i}`), (u.textContent = t));
                    }
                  });
                return () => c.stop();
              }, [e, t, n, r, a, s, o, i]),
              l
            );
          },
          h1 = ({
            symbol: e,
            index: t,
            id: n,
            data: r,
            xScale: o,
            yScale: i,
            active: a,
            tooltip: s,
            cursor: l,
            size: u,
            glow: c,
            color: h,
            animated: p,
            onClick: _,
            onMouseEnter: g,
            onMouseLeave: m,
            ...v
          }) => {
            let y = (0, f.useRef)(null),
              [b, x] = (0, f.useState)(!1),
              w = (0, f.useMemo)(() => hi(v, r), [v, r]),
              k = (0, f.useMemo)(() => ("function" == typeof u ? u(r) : u), [u, r]),
              M = (0, f.useMemo)(() => (e ? e(r) : null), [r, e]),
              j = (0, f.useMemo)(() => (p ? { ...hX, delay: 0.005 * t } : { type: !1, delay: 0 }), [t, p]),
              E = (0, f.useMemo)(() => {
                let e = i(r.y1);
                return i.bandwidth && (e += i.bandwidth() / 2), { x: o(r.x), y: e };
              }, [r, i]),
              S = (0, f.useMemo)(() => {
                let [e] = i.domain();
                return { y: i(e), x: o(r.x) };
              }, [r, i]),
              T = (0, f.useMemo)(() => hK({ colorScheme: h, index: t, point: r }), [r, h, t]),
              P = `symbol-${n}-${u2(`${r.id}`)}`,
              N = c ? { filter: `drop-shadow(${c.props.x}px ${c.props.y}px ${c.props.blur}px ${c.props.color})` } : {};
            return (0, d.jsxs)(f.Fragment, {
              children: [
                (0, d.jsx)("g", {
                  ref: y,
                  className: io({ _inactive_l7ttq_1: !a }),
                  onMouseEnter: () => {
                    x(!0), g(r);
                  },
                  onMouseLeave: () => {
                    x(!1), m(r);
                  },
                  onClick: () => _(r),
                  children: e
                    ? (0, d.jsx)(
                        C.E.g,
                        {
                          ...w,
                          initial: { translateX: S.x, translateY: S.y, opacity: 0 },
                          animate: { translateX: E.x, translateY: E.y, opacity: 1 },
                          exit: { translateX: S.x, translateY: S.y, opacity: 0 },
                          transition: j,
                          children: M
                        },
                        P
                      )
                    : (0, d.jsx)(
                        C.E.circle,
                        {
                          className: w.className,
                          style: { ...w.style, ...N, cursor: l },
                          fill: T,
                          initial: { cx: S.x, cy: S.y, r: k, opacity: 0 },
                          animate: { cx: E.x, cy: E.y, opacity: 1, r: k },
                          exit: { cx: S.x, cy: S.y, r: k, opacity: 0 },
                          transition: j
                        },
                        P
                      )
                }),
                s && !s.props.disabled && (0, d.jsx)(eB, { element: s, visible: b, reference: y, value: r })
              ]
            });
          };
        h1.defaultProps = {
          active: !0,
          tooltip: (0, d.jsx)(hF, {}),
          cursor: "pointer",
          size: 4,
          color: hG.cybertron[0],
          animated: !0,
          onClick: () => void 0,
          onMouseEnter: () => void 0,
          onMouseLeave: () => void 0
        };
        let h2 = ({ data: e, height: t, width: n, id: r, isZoomed: o, activeIds: i, point: a, ...s }) => {
          let l = (0, f.useCallback)(
            (e, t) => {
              let n;
              e.id && (n = e.id);
              let o = u2(`${n || t}`),
                l = !(i && i.length) || i.includes(n),
                u = a.props.visible;
              return u && !u(e, t) ? (0, d.jsx)(f.Fragment, {}, o) : (0, d.jsx)(eB, { element: a, ...s, id: r, data: e, index: t, active: l }, o);
            },
            [a, r, s, i]
          );
          return (0, d.jsxs)(f.Fragment, {
            children: [
              (0, d.jsx)("defs", {
                children: (0, d.jsx)("clipPath", {
                  id: `${r}-path`,
                  children: (0, d.jsx)("rect", { width: o ? n : n + 25, height: t + 25, x: o ? 0 : -12.5, y: -12.5 })
                })
              }),
              (0, d.jsx)("g", { clipPath: `url(#${r}-path)`, children: e.map(l) })
            ]
          });
        };
        h2.defaultProps = { point: (0, d.jsx)(h1, {}) };
        let h3 = ({ data: e, xScale: t, yScale: n, animated: r, point: o, color: i, height: a, width: s, id: l, activeValues: u, show: c }) => {
          let h = (0, f.useCallback)(
            (t, n) => {
              let r = u && t && lc(u.x, t.x);
              return "hover" === c ? r : "first" === c ? (u ? r : 0 === n) : "last" === c ? (u ? r : n === e.length - 1) : c;
            },
            [u, e.length, c]
          );
          return (0, d.jsx)(h2, {
            height: a,
            width: s,
            id: l,
            animated: r,
            data: e,
            xScale: t,
            yScale: n,
            point: (0, d.jsx)(eB, { element: o, color: i, className: "_point_u68jv_1", size: 4, tooltip: null, visible: h })
          });
        };
        h3.defaultProps = { show: "hover", point: (0, d.jsx)(h1, {}) };
        let h5 = ({ id: e, gradient: t, mask: n, data: r, color: o, index: i, total: a, xScale: s, yScale: l, animated: u, interpolation: c, ...h }) => {
          let p = o(r, i),
            _ = (0, f.useMemo)(() => r.map(e => ({ x: s(e.x), x1: s(e.x) - s(e.x1), y: l(e.y), y0: l(e.y0), y1: l(e.y1) })), [r, s, l]),
            g = (0, f.useCallback)(
              e => {
                if (1 === e.length && 1 === a) {
                  let [t] = e,
                    n = t.x,
                    [r, o] = (e = [{ ...t }, { ...t }]);
                  (r.x = 0), (o.x = 2 * n);
                }
                return oR()
                  .x(e => e.x)
                  .y0(e => e.y0)
                  .y1(e => e.y1)
                  .curve(f2(c))(e);
              },
              [c, a]
            ),
            m = (0, f.useMemo)(() => {
              let e = g(_);
              return { d: null === e ? void 0 : e };
            }, [_, g]),
            v = (0, f.useMemo)(() => {
              let e = Math.max(...l.range()),
                t = g(r.map(t => ({ x: s(t.x), x1: 0, y: 0, y1: e, y0: e })));
              return { d: null === t ? void 0 : t };
            }, [r, g, s, l]),
            y = (0, f.useMemo)(() => (n ? `url(#mask-pattern-${e})` : t ? `url(#gradient-${e})` : ""), [t, e, n]),
            b = (0, f.useMemo)(() => (u ? { ...hX, delay: 0.05 * i } : { type: !1, delay: 0 }), [u, i]),
            x = (0, f.useCallback)(() => {
              let t = n ? `url(#mask-${e})` : "",
                o = hi(h, r);
              return (0, d.jsx)(hV, { ...o, pointerEvents: "none", mask: t, fill: y, transition: b, custom: { enter: m, exit: v } });
            }, [r, m, v, y, e, n, h, b]);
          return (0, d.jsxs)(f.Fragment, {
            children: [
              x(),
              n &&
                (0, d.jsxs)(f.Fragment, {
                  children: [(0, d.jsx)(hR, { id: `mask-${e}`, fill: `url(#gradient-${e})` }), (0, d.jsx)(eB, { element: n, id: `mask-pattern-${e}`, fill: p })]
                }),
              t && (0, d.jsx)(eB, { element: t, id: `gradient-${e}`, color: p })
            ]
          });
        };
        h5.defaultProps = { gradient: (0, d.jsx)(hz, {}), interpolation: "linear" };
        let h8 = ({
          width: e,
          data: t,
          color: n,
          index: r,
          strokeWidth: o,
          hasArea: i,
          animated: a,
          yScale: s,
          xScale: l,
          showZeroStroke: u,
          interpolation: c,
          ...h
        }) => {
          let [p, _] = (0, f.useState)(null),
            g = (0, f.useRef)(null);
          (0, f.useEffect)(() => {
            g.current && _(g.current.getTotalLength());
          }, [t, l, s, e]);
          let m = (0, f.useCallback)(
              e =>
                or()
                  .x(e => e.x)
                  .y(e => e.y1)
                  .defined(
                    t =>
                      u ||
                      (function (e, t) {
                        let n = t.indexOf(e),
                          r = !1,
                          o = t[n - 1];
                        n > 0 && o.y && (r = !0), t[n].y && (r = !0);
                        let i = t[n + 1];
                        return n < t.length - 1 && i.y && (r = !0), r;
                      })(t, e)
                  )
                  .curve(f2(c))(e),
              [c, u]
            ),
            v = (0, f.useMemo)(() => (a ? { ...hX, delay: i ? 0 : 0.05 * r } : { type: !1, delay: 0 }), [a, i, r]),
            y = (0, f.useMemo)(() => t.map(e => ({ x: l(e.x), x1: l(e.x) - l(e.x1), y: s(e.y), y0: s(e.y0), y1: s(e.y1) })), [t, l, s]),
            b = (0, f.useMemo)(() => {
              let e = m(y),
                t = "";
              return i || null === p || (t = `${p} ${p}`), { d: null === e ? void 0 : e, strokeDashoffset: 0, strokeDasharray: t };
            }, [y, m, i, p]),
            x = (0, f.useMemo)(() => {
              let e = y;
              if (i) {
                let n = Math.max(...s.range());
                e = t.map(e => ({ x: l(e.x), x1: 0, y: n, y1: n, y0: n }));
              }
              let n = m(e),
                r = "",
                o = 0;
              return i || null === p || ((r = `${p} ${p}`), (o = p)), { d: null === n ? void 0 : n, strokeDasharray: r, strokeDashoffset: o };
            }, [y, t, m, i, p, l, s]),
            w = n(t, r),
            k = hi(h, t),
            M = i || null !== p;
          return (
            i && (delete b.strokeDashoffset, delete x.strokeDashoffset),
            (0, d.jsxs)(f.Fragment, {
              children: [
                M && (0, d.jsx)(hV, { ...k, pointerEvents: "none", stroke: w, strokeWidth: o, fill: "none", transition: v, custom: { enter: b, exit: x } }),
                !i && (0, d.jsx)("path", { opacity: "0", d: b.d, ref: g, pointerEvents: "none" })
              ]
            })
          );
        };
        h8.defaultProps = { showZeroStroke: !0, strokeWidth: 3 };
        let h6 = ({
          data: e,
          height: t,
          id: n,
          width: r,
          isZoomed: o,
          tooltip: i,
          xScale: a,
          yScale: s,
          type: l,
          markLine: u,
          symbols: c,
          animated: h,
          area: p,
          interpolation: _,
          line: g,
          colorScheme: m
        }) => {
          let [v, y] = (0, f.useState)(null),
            [b, x] = (0, f.useState)(null),
            w = (0, f.useCallback)(e => {
              x(e.pointX), y(e.value);
            }, []),
            k = (0, f.useCallback)(() => {
              x(void 0), y(void 0);
            }, []),
            M = "grouped" === l || "stacked" === l || "stackedNormalized" === l,
            j = (0, f.useCallback)(
              (t, n) => {
                var r;
                let o = Array.isArray(t) ? (null == (r = null == t ? void 0 : t[0]) ? void 0 : r.key) : null == t ? void 0 : t.key;
                return hK({ data: e, colorScheme: m, active: v, point: t, index: n, key: o });
              },
              [v, m, e]
            ),
            E = (0, f.useCallback)(
              (e, t = 0, o = 1) =>
                (0, d.jsxs)(f.Fragment, {
                  children: [
                    g &&
                      (0, d.jsx)(eB, {
                        element: g,
                        xScale: a,
                        yScale: s,
                        data: e,
                        width: r,
                        index: t,
                        hasArea: null !== p,
                        animated: h,
                        interpolation: _,
                        color: j
                      }),
                    p &&
                      (0, d.jsx)(eB, {
                        element: p,
                        id: `${n}-area-${t}`,
                        xScale: a,
                        yScale: s,
                        data: e,
                        index: t,
                        total: o,
                        animated: h,
                        interpolation: _,
                        color: j
                      })
                  ]
                }),
              [h, p, j, n, _, g, r, a, s]
            ),
            S = (0, f.useCallback)(
              (e, o = 0) => {
                let i = null !== c,
                  l = (c && c.props.activeValues) || v,
                  u = void 0 !== p && h && !l;
                return (0, d.jsx)(f.Fragment, {
                  children:
                    i &&
                    (0, d.jsx)(
                      eB,
                      { element: c, id: n, height: t, width: r, activeValues: l, xScale: a, yScale: s, index: o, data: e, animated: u, color: () => j(e, o) },
                      `point-series-${n}`
                    )
                });
              },
              [v, h, p, j, t, n, c, r, a, s]
            ),
            T = (0, f.useCallback)(() => (0, d.jsx)(d.Fragment, { children: v && u && (0, d.jsx)(eB, { element: u, height: t, pointX: b }) }), [b, v, t, u]),
            C = (0, f.useCallback)(e => (0, d.jsxs)(f.Fragment, { children: [E(e), T(), S(e)] }), [E, T, S]),
            P = (0, f.useCallback)(
              e =>
                (0, d.jsxs)(f.Fragment, {
                  children: [
                    e.map((t, n) => (0, d.jsx)(f.Fragment, { children: E(t.data, n, e.length) }, u2(`${t.key}`))).reverse(),
                    T(),
                    e.map((e, t) => (0, d.jsx)(f.Fragment, { children: S(e.data, t) }, u2(`${e.key}`))).reverse()
                  ]
                }),
              [E, T, S]
            );
          return (0, d.jsxs)(f.Fragment, {
            children: [
              (0, d.jsx)("defs", {
                children: (0, d.jsx)("clipPath", {
                  id: `${n}-path`,
                  children: (0, d.jsx)("rect", { width: o ? r : r + 25, height: t + 25, x: o ? 0 : -12.5, y: -12.5 })
                })
              }),
              (0, d.jsx)(eB, {
                element: i,
                xScale: a,
                yScale: s,
                data: e,
                height: t,
                width: r,
                color: j,
                onValueEnter: w,
                onValueLeave: k,
                children: (0, d.jsxs)("g", { clipPath: `url(#${n}-path)`, children: [M && P(e), !M && C(e)] })
              })
            ]
          });
        };
        h6.defaultProps = {
          colorScheme: "cybertron",
          animated: !0,
          interpolation: "linear",
          type: "standard",
          line: (0, d.jsx)(h8, {}),
          area: (0, d.jsx)(h5, {}),
          markLine: (0, d.jsx)(h$, {}),
          tooltip: (0, d.jsx)(hI, {}),
          symbols: (0, d.jsx)(h3, {})
        };
        ({
          ...h6.defaultProps,
          tooltip: (0, d.jsx)(hI, {
            tooltip: (0, d.jsx)(hF, {
              content: (e, t) => {
                if (!e) return null;
                let n = { ...e, data: e.data.map(e => ({ ...e, value: `${fj(e.value)} ∙ ${fj(Math.floor((e.y1 - e.y0) * 100))}%` })) };
                return (0, d.jsx)(hL, { color: t, value: n });
              }
            })
          })
        });
        ({ ...h6.defaultProps });
        let h4 = ({
          xAxis: e,
          yAxis: t,
          id: n,
          data: r,
          width: o,
          height: i,
          margins: a,
          className: s,
          containerClassName: l,
          series: u,
          gridlines: c,
          brush: h,
          zoomPan: p,
          secondaryAxis: _
        }) => {
          let g = p ? p.props : {},
            [m, v] = (0, f.useState)(g.domain),
            [y, b] = (0, f.useState)(!1),
            [x, w] = (0, f.useState)(!!g.domain),
            [k] = (0, f.useState)(!g.hasOwnProperty("domain")),
            M = (0, f.useRef)(null),
            j = u.props.type,
            E = "stacked" === j || "stackedNormalized" === j || "grouped" === j,
            S = !0 !== y && u.props.animated;
          (0, f.useEffect)(() => {
            if (p) {
              let e = p.props;
              k || e.domain === m || (v(e.domain), w(!!e.domain));
            }
          }, [k, m, p]);
          let T = (0, f.useMemo)(
              () =>
                "stacked" === j || "stackedNormalized" === j
                  ? (function (e, t = !1) {
                      let n = ha(e, e => e.key),
                        r = (function (e) {
                          let t = [],
                            n = hb(e);
                          for (let r of e)
                            for (let e of r.data) {
                              let o = t.findIndex(t => (t.x instanceof Date && e.key instanceof Date ? t.x.getTime() === e.key.getTime() : t.x === e.key));
                              -1 === o && (t.push({ x: e.key, formattedValues: {} }), (o = t.length - 1)),
                                (t[o][r.key] = hv(e.data, n)),
                                (t[o].formattedValues[r.key] = hy(e.data));
                            }
                          return t;
                        })(e);
                      return (function (e) {
                        let t = [];
                        for (let n of e) {
                          let e = [];
                          for (let t of n) {
                            let [r, o] = t,
                              i = t.data.x;
                            e.push({ key: n.key, x: i, x0: i, x1: i, y: o - r, y0: r, y1: o, value: t.data.formattedValues[n.key] });
                          }
                          t.push({ key: n.key, data: e });
                        }
                        return t;
                      })((t ? og().offset(om) : og()).keys(n)(r));
                    })(r, "stackedNormalized" === j)
                  : "grouped" === j
                    ? hw(r, !0)
                    : hk(r),
              [r, j]
            ),
            C = (0, f.useCallback)(
              (n, r) => ({
                xScale: hU({ width: n, type: e.props.type, roundDomains: e.props.roundDomains, data: T, domain: m || e.props.domain, isMultiSeries: E }),
                yScale: hq({ roundDomains: t.props.roundDomains, type: t.props.type, height: r, data: T, domain: t.props.domain, isMultiSeries: E })
              }),
              [T, E, e.props.domain, e.props.roundDomains, e.props.type, t.props.domain, t.props.roundDomains, t.props.type, m]
            ),
            P = (0, f.useCallback)(
              e => {
                k && (v(e.domain), w(e.isZoomed), b(!0), clearTimeout(M.current), (M.current = setTimeout(() => b(!1))));
              },
              [k]
            ),
            N = (0, f.useCallback)(
              ({ chartHeight: n, chartWidth: r, id: o, updateAxes: i, chartSized: a }) => {
                let { xScale: s, yScale: l } = C(r, n),
                  g = T.length <= 1;
                return (0, d.jsxs)(f.Fragment, {
                  children: [
                    a && c && (0, d.jsx)(eB, { element: c, height: n, width: r, yScale: l, xScale: s, yAxis: t.props, xAxis: e.props }),
                    (0, d.jsx)(eB, { element: e, height: n, width: r, scale: s, onDimensionsChange: e => i("horizontal", e) }),
                    (0, d.jsx)(eB, { element: t, height: n, width: r, scale: l, onDimensionsChange: e => i("vertical", e) }),
                    _ && _.map((e, t) => (0, d.jsx)(eB, { element: e, height: n, width: r, onDimensionsChange: e => i("horizontal", e) }, t)),
                    a &&
                      (0, d.jsx)(eB, {
                        disabled: g,
                        element: h,
                        height: n,
                        width: r,
                        scale: s,
                        children: (0, d.jsx)(eB, {
                          element: p,
                          onZoomPan: P,
                          height: n,
                          width: r,
                          axisType: e.props.type,
                          roundDomains: e.props.roundDomains,
                          data: T,
                          domain: m,
                          children: (0, d.jsx)(eB, {
                            element: u,
                            id: `area-series-${o}`,
                            data: T,
                            height: n,
                            width: r,
                            yScale: l,
                            xScale: s,
                            isZoomed: x,
                            animated: S
                          })
                        })
                      })
                  ]
                });
              },
              [T, S, h, C, c, x, P, _, u, e, t, m, p]
            );
          return (0, d.jsx)(hm, {
            id: n,
            width: o,
            height: i,
            margins: a,
            containerClassName: l,
            xAxisVisible: fq(e.props),
            yAxisVisible: fq(t.props),
            className: io("_areaChart_yyojn_1", s, u.type),
            children: N
          });
        };
        h4.defaultProps = {
          data: [],
          xAxis: (0, d.jsx)(fL, { type: "time" }),
          yAxis: (0, d.jsx)(fU, { type: "value" }),
          series: (0, d.jsx)(h6, {}),
          gridlines: (0, d.jsx)(hO, {}),
          brush: null,
          zoomPan: null
        };
        let h7 = ({
          activeBrightness: e,
          id: t,
          gradient: n,
          data: r,
          barIndex: o,
          color: i,
          yScale: a,
          barCount: s,
          glow: l,
          xScale: u,
          groupIndex: c,
          minHeight: h,
          rangeLines: p,
          animated: _,
          active: g,
          type: m,
          tooltip: v,
          layout: y,
          mask: b,
          label: x,
          cursor: w,
          rx: k,
          ry: M,
          isCategorical: j,
          className: E,
          style: S,
          width: T,
          padding: P,
          guide: N,
          xScale1: A,
          onMouseEnter: O,
          onClick: $,
          onMouseMove: D,
          onMouseLeave: z
        }) => {
          let R = (0, f.useMemo)(() => "vertical" === y, [y]),
            L = (0, f.useRef)(null),
            [F, I] = (0, f.useState)(g);
          l && (l.props.x, l.props.y, l.props.blur, l.props.color);
          let B = (0, f.useCallback)(
              (e, t, n) => {
                let r = e.range()[1],
                  o = (r - P * (s - 1)) / r;
                return (t = t * o + c * P), { size: (n *= o), offset: t };
              },
              [s, c, P]
            ),
            U = (0, f.useCallback)(
              ({ x: e, y: t, width: n, height: r }) => {
                let o = R ? e : Math.min(...u.range()),
                  i = R ? Math.max(...a.range()) : t,
                  s = R ? 0 : r,
                  l = R ? n : 0;
                return "stackedDiverging" === m && (R ? (i /= 2) : (o /= 2)), { x: o, y: i, height: s, width: l };
              },
              [R, m, u, a]
            ),
            q = (0, f.useCallback)(
              (e, t, n, r, o, i, a) => {
                let s, l;
                if (i) {
                  if (r.bandwidth) (s = r(e)), (l = r.bandwidth()), o && ((s = s ? s + l / 2 - o / 2 : l / 2 - o / 2), (l = o));
                  else {
                    if (o) throw Error("Not a valid option for this scale type");
                    if (((s = r(t)), (l = r(n - t)), a)) {
                      let e = B(r, s, l);
                      (s = e.offset), (l = e.size);
                    }
                  }
                } else {
                  if (o) throw Error("Not a valid option for this scale type");
                  let e = r(t),
                    i = r(n);
                  (s = e), (l = Math.max(i - e - 1, 0));
                }
                return { offset: isNaN(s) ? 0 : s, size: isNaN(l) ? 0 : l };
              },
              [B]
            ),
            H = (0, f.useCallback)(
              (e, t, n) => {
                let r = n(e),
                  o = n(t),
                  i = Math.max(h || 0, Math.abs(r - o)),
                  a = Math.min(r, o);
                return { offset: isNaN(a) ? 0 : a, size: isNaN(i) ? 0 : i };
              },
              [h]
            ),
            Y = (0, f.useCallback)(
              e => {
                let t = a,
                  n = u;
                if ((A && (R ? (n = A) : (t = A)), R)) {
                  let r = q(e.x, e.x0, e.x1, n, T, j, P),
                    o = H(e.y0, e.y1, t);
                  return { x: r.offset, width: r.size, y: o.offset, height: o.size };
                }
                {
                  let r = q(e.y, e.y0, e.y1, t, T, j, P),
                    o = H(e.x0, e.x1, n);
                  return { x: o.offset, width: o.size, y: r.offset, height: r.size };
                }
              },
              [q, H, j, R, P, T, u, A, a]
            ),
            W = (0, f.useCallback)(
              e => {
                v && I(!0), O({ value: r, nativeEvent: e });
              },
              [r, O, v]
            ),
            Z = (0, f.useCallback)(
              e => {
                v && I(!1), z({ value: r, nativeEvent: e });
              },
              [r, z, v]
            ),
            X = (0, f.useCallback)(
              e => {
                $({ value: r, nativeEvent: e });
              },
              [r, $]
            ),
            V = (0, f.useCallback)(e => (b ? `url(#mask-pattern-${t})` : n ? `url(#gradient-${t})` : e), [n, t, b]),
            G = (0, f.useMemo)(() => {
              let e = r[j ? "x" : "x0"];
              return r.x0 < 0 && (e = r.x0), (R ? r.key && r.key !== e : r.key && r.key !== r.y) && (e = `${r.key} ∙ ${e}`), { y: r.y, x: e };
            }, [r, j, R]),
            J = (0, f.useCallback)(
              e => {
                if (!_) return { type: !1, delay: 0 };
                {
                  let t = 0;
                  return (t = "vertical" === y ? (e / s) * 0.5 : ((s - e) / s) * 0.5), { ...hX, delay: t };
                }
              },
              [_, s, y]
            ),
            K = (0, f.useCallback)(
              (e, n, o) => {
                let i = b ? `url(#mask-${t})` : "",
                  a = V(e),
                  s = U(n),
                  u = hi({ className: E, style: S }, r),
                  c = J(o),
                  f = { ...s, attrX: s.x, attrY: s.y, fill: a };
                delete f.x, delete f.y;
                let h = { ...n, attrX: n.x, attrY: n.y, fill: a };
                delete h.x, delete h.y;
                let p = l ? { filter: `drop-shadow(${l.props.x}px ${l.props.y}px ${l.props.blur}px ${l.props.color})` } : {};
                return (0, d.jsx)("g", {
                  ref: L,
                  children: (0, d.jsx)(C.E.rect, {
                    className: io(u.className),
                    style: { ...u.style, ...p, cursor: w },
                    mask: i,
                    rx: k,
                    ry: M,
                    initial: f,
                    animate: h,
                    exit: f,
                    transition: c,
                    onMouseEnter: W,
                    onMouseLeave: Z,
                    onClick: X,
                    onMouseMove: D
                  })
                });
              },
              [E, w, r, U, V, J, t, b, X, W, Z, D, k, M, S]
            ),
            Q = (0, f.useCallback)(() => {
              if (!N || ("stacked" === m && 0 !== o)) return null;
              if ("stackedNormalized" === m || "marimekko" === m) return console.error("Guide bars are not supported for these chart types"), null;
              let [e, t] = (R ? a : u).domain(),
                n = R ? "y" : "x",
                i = "stackedDiverging" === m ? "0" : "1",
                s = "stackedDiverging" === m ? e : t,
                l = "stackedDiverging" === m && r[n] > 0 ? t : s,
                c = Y({ ...r, [n]: s, [`${n}${i}`]: l });
              return (0, d.jsx)(eB, { element: N, ...c, active: g });
            }, [g, o, r, Y, N, R, m, u, a]),
            ee = v ? F : g,
            et = i(r, o),
            en = Y(r),
            er = g ? iS(et).brighten(e).hex() : et,
            eo = (p && p.props.color) || et,
            ei = g ? iS(eo).brighten(e) : eo,
            ea = void 0 !== c ? c : o,
            es = R ? a : u,
            el = R ? G.y : G.x,
            eu = "vertical" === y ? "top" : "right";
          return (0, d.jsxs)(f.Fragment, {
            children: [
              Q(),
              K(er, en, ea),
              p && (0, d.jsx)(eB, { element: p, ...en, index: ea, data: r, scale: es, color: ei, barCount: s, animated: _, layout: y, type: m }),
              b &&
                (0, d.jsxs)(f.Fragment, {
                  children: [
                    (0, d.jsx)(hR, { id: `mask-${t}`, fill: `url(#gradient-${t})` }),
                    (0, d.jsx)(eB, { element: b, id: `mask-pattern-${t}`, fill: et })
                  ]
                }),
              n && (0, d.jsx)(eB, { element: n, id: `gradient-${t}`, direction: y, color: er }),
              x &&
                (0, d.jsx)(eB, {
                  element: x,
                  ...en,
                  text: fj(el),
                  index: ea,
                  data: r,
                  scale: es,
                  fill: x.props.fill || er,
                  barCount: s,
                  animated: _,
                  layout: y,
                  type: m
                }),
              v && (0, d.jsx)(eB, { element: v, visible: !!ee, reference: L, color: i, value: G, placement: v.props.placement || eu, data: r })
            ]
          });
        };
        h7.defaultProps = {
          activeBrightness: 0.5,
          rx: 0,
          ry: 0,
          cursor: "auto",
          rangeLines: null,
          label: null,
          tooltip: null,
          layout: "vertical",
          guide: null,
          gradient: (0, d.jsx)(hz, {}),
          onClick: () => void 0,
          onMouseEnter: () => void 0,
          onMouseLeave: () => void 0,
          onMouseMove: () => void 0
        };
        let h9 = ({
          data: e,
          tooltip: t,
          xScale: n,
          yScale: r,
          height: o,
          width: i,
          colorScheme: a,
          xScale1: s,
          bar: l,
          padding: u,
          animated: c,
          isCategorical: h,
          layout: p,
          type: _,
          id: g
        }) => {
          let m = (0, f.useRef)(null),
            [v, y] = (0, f.useState)(null),
            b = (0, f.useMemo)(() => "vertical" === p, [p]),
            x = (0, f.useMemo)(() => "grouped" === _ || "stacked" === _ || "marimekko" === _ || "stackedNormalized" === _ || "stackedDiverging" === _, [_]),
            w = (0, f.useCallback)(
              e => {
                let t = 0,
                  o = 0;
                return "marimekko" !== _ && ("vertical" === p ? (t = n(e.key)) : (o = r(e.key))), `translate(${t}, ${o})`;
              },
              [p, _, n, r]
            ),
            k = (0, f.useCallback)(
              (t, n) => {
                let r = "key";
                return (
                  x && (r = "vertical" === p ? "x" : "y"),
                  void 0 === t[r] && (r = "x0"),
                  hK({ colorScheme: a, point: t, index: n, data: e, isMultiSeries: x, attribute: r })
                );
              },
              [a, e, x, p]
            ),
            M = (0, f.useCallback)(e => {
              var t;
              null == (t = m.current) || t.onMouseMove(e);
            }, []),
            j = (0, f.useCallback)(e => {
              y(e.value);
            }, []),
            E = (0, f.useCallback)(() => {
              y(null);
            }, []),
            S = (0, f.useCallback)(
              (e, t, o, i) => {
                let a = v && v.x === e.key,
                  m = r,
                  y = n;
                s && (b ? (y = s) : (m = s));
                let x = t.toString();
                e.key && (x = `${e.key.toString()}-${i}-${e.x}`);
                let w = Array.isArray(l) ? l[t] : l;
                return (
                  l || (w = (0, d.jsx)(h7, {})),
                  (0, d.jsx)(
                    f.Fragment,
                    {
                      children: (0, d.jsx)(eB, {
                        element: w,
                        id: `${g}-bar-${i}-${t}`,
                        animated: c,
                        active: a,
                        xScale: y,
                        xScale1: s,
                        yScale: m,
                        padding: u,
                        barCount: o,
                        groupIndex: i,
                        barIndex: t,
                        data: e,
                        isCategorical: h,
                        color: k,
                        layout: p,
                        type: _,
                        onMouseMove: M
                      })
                    },
                    x
                  )
                );
              },
              [v, c, l, k, g, h, b, p, M, u, _, n, s, r]
            ),
            T = (0, f.useCallback)((e, t, n) => (0, d.jsx)(f.Fragment, { children: e.map((e, r) => S(e, r, t, n)) }), [S]);
          return (0, d.jsxs)(eB, {
            element: t,
            childRef: m,
            xScale: n,
            yScale: r,
            data: e,
            height: o,
            width: i,
            inverse: !1,
            isHorizontal: "horizontal" === p,
            color: k,
            onValueEnter: j,
            onValueLeave: E,
            children: [x && e.map((t, n) => (0, d.jsx)("g", { transform: w(t), children: T(t.data, e.length, n) }, `bar-group-${n}`)), !x && T(e, e.length)]
          });
        };
        h9.defaultProps = {
          type: "standard",
          padding: 0.1,
          groupPadding: 16,
          animated: !0,
          tooltip: (0, d.jsx)(hI, { tooltip: (0, d.jsx)(hF, { followCursor: !0, modifiers: { offset: "5px, 5px" } }) }),
          colorScheme: "cybertron",
          bar: (0, d.jsx)(h7, {}),
          layout: "vertical"
        };
        let pe = ({
          layout: e,
          color: t,
          x: n,
          y: r,
          scale: o,
          type: i,
          height: a,
          position: s,
          strokeWidth: l,
          width: u,
          animated: c,
          index: h,
          barCount: p,
          data: _
        }) => {
          let g = (0, f.useMemo)(() => "vertical" === e, [e]),
            m = (0, f.useMemo)(() => Math.min(l, g ? a : u), [a, g, l, u]),
            [v, y] = (0, f.useMemo)(() => [g ? u : m, g ? m : a], [a, g, m, u]),
            b = (0, f.useMemo)(() => {
              let e = r,
                t = n,
                o = "top" === s,
                i = g ? (_.y < 0 && o ? "bottom" : s) : _.x0 < 0 && o ? "bottom" : s;
              return g ? (e = "top" === i ? r : r + a - m) : (t = "top" === i ? n + u - m : n), { x: t, y: e, opacity: 1 };
            }, [_.x0, _.y, a, g, s, m, u, n, r]),
            x = (0, f.useMemo)(() => {
              let e = r,
                t = n;
              if (g) {
                let t = Math.max(...o.range());
                e = "top" === s ? t : t + a - m;
              } else {
                let e = Math.min(...o.range());
                t = "top" === s ? e : e + u - m;
              }
              return "stackedDiverging" === i && (g ? (e /= 2) : (t /= 2)), { y: e, x: t, opacity: 0 };
            }, [a, g, s, m, o, i, u, n, r]),
            w = (0, f.useMemo)(() => (c ? ("vertical" === e ? (h / p) * 0.5 : ((p - h) / p) * 0.5) : 0), [c, p, h, e]),
            k = (0, f.useMemo)(() => {
              let e = { ...x, attrX: x.x, attrY: x.y };
              return delete e.x, delete e.y, e;
            }, [x]),
            M = (0, f.useMemo)(() => {
              let e = { ...b, attrX: b.x, attrY: b.y };
              return delete e.x, delete e.y, e;
            }, [b]);
          return (0, d.jsx)(C.E.rect, {
            pointerEvents: "none",
            fill: t,
            width: v,
            height: y,
            initial: k,
            animate: M,
            exit: k,
            transition: { ...hX, delay: w }
          });
        };
        pe.defaultProps = { position: "top", strokeWidth: 1, layout: "vertical" };
        ({
          ...h9.defaultProps,
          bar: (0, d.jsx)(h7, {
            gradient: (0, d.jsx)(hz, {
              stops: [(0, d.jsx)(hD, { offset: "5%", stopOpacity: 0.1 }, "start"), (0, d.jsx)(hD, { offset: "90%", stopOpacity: 0.7 }, "stop")]
            }),
            rangeLines: (0, d.jsx)(pe, { position: "top", strokeWidth: 3 })
          })
        });
        ({
          ...h9.defaultProps,
          tooltip: (0, d.jsx)(hI, {
            tooltip: (0, d.jsx)(hF, {
              followCursor: !0,
              modifiers: { offset: "5px, 5px" },
              content: (e, t) => (
                (e.data = e.data.map(e => {
                  let t = isNaN(e.y0) ? e.x0 : e.y0,
                    n = isNaN(e.y1) ? e.x1 : e.y1;
                  return { ...e, value: `${fj(Math.floor((n - t) * 100))}%` };
                })),
                (0, d.jsx)(hL, { value: e, color: t })
              )
            })
          }),
          bar: (0, d.jsx)(h7, {
            gradient: (0, d.jsx)(hz, {
              stops: [(0, d.jsx)(hD, { offset: "5%", stopOpacity: 0.1 }, "start"), (0, d.jsx)(hD, { offset: "90%", stopOpacity: 0.7 }, "stop")]
            }),
            rangeLines: (0, d.jsx)(pe, { position: "top", strokeWidth: 3 })
          })
        });
        ({
          ...h9.defaultProps,
          tooltip: (0, d.jsx)(hI, {
            tooltip: (0, d.jsx)(hF, {
              followCursor: !0,
              modifiers: { offset: "5px, 5px" },
              content: (e, t) => {
                let n = { ...e, data: e.data.map(e => ({ ...e, value: `${fj(e.value)} ∙ ${fj(Math.floor((e.y1 - e.y0) * 100))}%` })) };
                return (0, d.jsx)(hL, { value: n, color: t });
              }
            })
          }),
          bar: (0, d.jsx)(h7, {
            padding: 10,
            gradient: (0, d.jsx)(hz, {
              stops: [(0, d.jsx)(hD, { offset: "5%", stopOpacity: 0.1 }, "start"), (0, d.jsx)(hD, { offset: "90%", stopOpacity: 0.7 }, "stop")]
            }),
            rangeLines: (0, d.jsx)(pe, { position: "top", strokeWidth: 3 })
          })
        });
        ({
          ...h9.defaultProps,
          colorScheme: hG.cybertron[0],
          tooltip: (0, d.jsx)(hI, {
            tooltip: (0, d.jsx)(hF, {
              followCursor: !0,
              modifiers: { offset: "5px, 5px" },
              content: (e, t) => {
                let n = { ...e, x: `${fj(e.x0)} - ${fj(e.x1)}`, value: e.y };
                return (0, d.jsx)(hL, { value: n, color: t });
              }
            })
          })
        });
        let pt = {
            barChart: "_barChart_sfjii_1",
            stackedNormalized: "_stackedNormalized_sfjii_4",
            stacked: "_stacked_sfjii_4",
            marimekko: "_marimekko_sfjii_6"
          },
          pn = e => (0, d.jsx)(h6, { ...e });
        pn.defaultProps = { ...h6.defaultProps, area: null, line: (0, d.jsx)(h8, { strokeWidth: 3 }) };
        ({ ...h4.defaultProps, series: (0, d.jsx)(pn, {}) });
        let pr = ({ data: e, animated: t, arc: n }) => {
            let r = (0, f.useRef)(null),
              o = (0, f.useMemo)(() => {
                let n = e.startAngle,
                  r = t ? n : e.endAngle;
                return { ...e, startAngle: n, endAngle: r };
              }, [e, t]),
              i = (0, f.useMemo)(() => (t ? { ...hX } : { delay: 0 }), [t]),
              a = r.current ? { ...r.current } : void 0;
            r.current = { ...e };
            let s = (0, li.c)(""),
              l = (0, li.c)(o),
              u = uQ(l, { ...hX, from: 0, to: 1 });
            return (
              (0, f.useEffect)(() => {
                let t = tB(a || l.get(), e),
                  r = u.onChange(e => s.set(n(t(e))));
                return l.set(e), r;
              }, [n, s, e, l, a, u]),
              { d: s, transition: i }
            );
          },
          po = ({ sensitivity: e = 7, interval: t = 50, timeout: n = 10, disabled: r, onPointerOver: o, onPointerOut: i }) => {
            let a = (0, f.useRef)(!1),
              s = (0, f.useRef)(null),
              l = (0, f.useRef)(0),
              u = (0, f.useRef)({ x: null, y: null, px: null, py: null }),
              c = (0, f.useCallback)(e => {
                (u.current.x = e.clientX), (u.current.y = e.clientY);
              }, []),
              d = (0, f.useCallback)(
                n => {
                  s.current = clearTimeout(s.current);
                  let { px: r, x: i, py: a, y: c } = u.current;
                  Math.abs(r - i) + Math.abs(a - c) < e
                    ? ((l.current = 1), o(n))
                    : ((u.current.px = i), (u.current.py = c), (s.current = setTimeout(() => d(n), t)));
                },
                [t, o, e]
              ),
              h = (0, f.useCallback)(() => {
                clearTimeout(s.current), document.removeEventListener("mousemove", c, !1);
              }, [c]),
              p = (0, f.useCallback)(
                e => {
                  r ||
                    ((a.current = !0),
                    h(),
                    1 !== l.current &&
                      ((u.current.px = e.nativeEvent.x),
                      (u.current.py = e.nativeEvent.y),
                      document.addEventListener("mousemove", c, !1),
                      (s.current = setTimeout(() => d(e), n))));
                },
                [h, d, r, c, n]
              ),
              _ = (0, f.useCallback)(
                e => {
                  (s.current = clearTimeout(s.current)), (l.current = 0), i(e);
                },
                [i]
              );
            return {
              pointerOver: p,
              pointerOut: (0, f.useCallback)(
                e => {
                  (a.current = !1), h(), 1 === l.current && (s.current = setTimeout(() => _(e), n));
                },
                [h, _, n]
              )
            };
          },
          pi = ({ color: e, data: t, arc: n, cursor: r, animated: o, disabled: i, onClick: a, onMouseEnter: s, onMouseLeave: l, tooltip: u }) => {
            var c;
            let h = (0, f.useRef)(null),
              { transition: p, d: _ } = pr({ animated: o, arc: n, data: t }),
              [g, m] = (0, f.useState)(!1),
              v = (0, f.useMemo)(() => (g ? iS(e).brighten(0.5) : e), [e, g]),
              { pointerOut: y, pointerOver: b } = po({
                onPointerOver: e => {
                  i || (m(!0), s({ value: t.data, nativeEvent: e }));
                },
                onPointerOut: e => {
                  i || (m(!1), l({ value: t.data, nativeEvent: e }));
                }
              });
            return (0, d.jsxs)("g", {
              ref: h,
              children: [
                (0, d.jsx)(C.E.path, {
                  role: "graphics-symbol",
                  transition: p,
                  d: _,
                  style: { cursor: r },
                  fill: v,
                  onPointerOver: b,
                  onPointerOut: y,
                  onClick: e => {
                    i || a({ value: t.data, nativeEvent: e });
                  }
                }),
                !(null == (c = null == u ? void 0 : u.props) ? void 0 : c.disabled) &&
                  (0, d.jsx)(eB, { element: u, visible: !!g, reference: h, value: { y: t.data.data, x: t.data.key } })
              ]
            });
          };
        pi.defaultProps = {
          cursor: "initial",
          animated: !0,
          disabled: !1,
          onClick: () => void 0,
          onMouseEnter: () => void 0,
          onMouseLeave: () => void 0,
          tooltip: (0, d.jsx)(hF, {})
        };
        let pa = ({ startAngle: e, endAngle: t }) => (e + (t - e) / 2 < Math.PI ? "start" : "end"),
          ps = ({
            centroid: e,
            data: t,
            lineStroke: n,
            padding: r,
            fontSize: o,
            fontFill: i,
            format: a,
            fontFamily: s,
            position: l,
            outerRadius: u,
            width: c,
            height: f
          }) => {
            let h = pa(t),
              p = a ? a({ ...t.data, textAnchor: h }) : fj(t.data.key),
              [_, g] = l,
              m = u + 4,
              v = e(t),
              y = oz().innerRadius(m).outerRadius(m).centroid(t),
              b = (function ([e, t], [n, r]) {
                let o = [0, 0];
                if ((r - t) * Math.sign(t) >= 0) {
                  let i = Math.abs(r / t) || 1;
                  (i = Math.max(Math.min(Math.abs(n / e) || 1, i), 1)), (o = [e * i, r]);
                } else {
                  let r = 0.85,
                    i = Math.abs(e / n) || 1;
                  o = [n * (r = Math.max(Math.min(1, 0.85), i)), t];
                }
                return o;
              })(y, l);
            return (0, d.jsxs)(C.E.g, {
              initial: { opacity: 0 },
              animate: { opacity: 1 },
              exit: { opacity: 0 },
              transition: { duration: 0.1 },
              children: [
                "string" == typeof p
                  ? (0, d.jsxs)(d.Fragment, {
                      children: [
                        (0, d.jsx)("title", { children: p }),
                        (0, d.jsx)("text", {
                          dy: r,
                          fill: i,
                          fontSize: o,
                          fontFamily: s,
                          textAnchor: h,
                          style: { shapeRendering: "crispEdges", transform: `translate3d(${_}px,${g}px, 0)` },
                          children: p
                        })
                      ]
                    })
                  : (0, d.jsx)("foreignObject", {
                      width: c,
                      height: f,
                      style: { transform: `translate3d(${"start" === h ? _ : _ - c}px,${g - f / 2}px, 0)`, color: i, fontFamily: s, fontSize: o },
                      children: p
                    }),
                (0, d.jsx)("polyline", { fill: "none", stroke: n, points: `${v},${y},${b},${l}` })
              ]
            });
          };
        ps.defaultProps = {
          format: void 0,
          lineStroke: "rgba(127,127,127,0.5)",
          fontFill: "#8F979F",
          fontSize: 11,
          fontFamily: "sans-serif",
          padding: ".35em",
          height: 11
        };
        let pl = e => e.startAngle + (e.endAngle - e.startAngle) / 2,
          pu = e => e.endAngle - e.startAngle > Math.PI / 30;
        function pc(e, t, n, r) {
          if (!r || void 0 === t) return e;
          let o = eY(t, e => e.value);
          return (e * n.value) / o;
        }
        hG.cybertron[0];
        let pd = ({
          id: e,
          data: t,
          className: n,
          yScale: r,
          color: o,
          animated: i,
          index: a,
          outerRadius: s,
          xScale: l,
          innerRadius: u,
          interpolation: c,
          gradient: h
        }) => {
          let p = (0, f.useMemo)(() => (i ? { ...hX, delay: 0.05 * a } : { type: !1, delay: 0 }), [i, a]),
            _ = (0, f.useCallback)(t => (h ? `url(#${e}-gradient)` : t), [e, h]),
            g = (0, f.useCallback)(
              e => {
                var t, n, o, i, a, s;
                return ((n = (t = oR().curve(oY)).curve),
                (o = t.lineX0),
                (i = t.lineX1),
                (a = t.lineY0),
                (s = t.lineY1),
                (t.angle = t.x),
                delete t.x,
                (t.startAngle = t.x0),
                delete t.x0,
                (t.endAngle = t.x1),
                delete t.x1,
                (t.radius = t.y),
                delete t.y,
                (t.innerRadius = t.y0),
                delete t.y0,
                (t.outerRadius = t.y1),
                delete t.y1,
                (t.lineStartAngle = function () {
                  return oX(o());
                }),
                delete t.lineX0,
                (t.lineEndAngle = function () {
                  return oX(i());
                }),
                delete t.lineX1,
                (t.lineInnerRadius = function () {
                  return oX(a());
                }),
                delete t.lineY0,
                (t.lineOuterRadius = function () {
                  return oX(s());
                }),
                delete t.lineY1,
                (t.curve = function (e) {
                  return arguments.length ? n(oZ(e)) : n()._curve;
                }),
                t)
                  .angle(e => l(e.x))
                  .innerRadius(e => u)
                  .outerRadius(e => r(e.y))
                  .curve("smooth" === c ? oU : oH)(e);
              },
              [l, r, c, u]
            ),
            m = (0, f.useMemo)(() => ({ d: g(t), opacity: 1 }), [t, g]),
            v = (0, f.useMemo)(() => {
              let [e] = r.domain();
              return { d: g(t.map(t => ({ ...t, y: e }))), opacity: 0 };
            }, [t, g, r]),
            y = o(t, 0);
          return (0, d.jsxs)(f.Fragment, {
            children: [
              (0, d.jsx)(hV, { custom: { enter: m, exit: v }, transition: p, pointerEvents: "none", className: n, fill: _(o) }),
              h && (0, d.jsx)(eB, { element: h, id: `${e}-gradient`, radius: s, color: y })
            ]
          });
        };
        pd.defaultProps = {
          gradient: (0, d.jsx)(
            ({
              id: e,
              color: t,
              radius: n = "30%",
              stops: r = [(0, d.jsx)(hD, { offset: "0%", stopOpacity: 0.2 }, "start"), (0, d.jsx)(hD, { offset: "80%", stopOpacity: 0.7 }, "stop")]
            }) =>
              (0, d.jsx)("radialGradient", {
                id: e,
                cx: 0,
                cy: 0,
                r: n,
                gradientUnits: "userSpaceOnUse",
                children: r.map((e, n) => (0, d.jsx)(eB, { element: e, color: t }, `gradient-${n}`))
              }),
            {}
          )
        };
        let pf = ({ xScale: e, yScale: t, className: n, index: r, hasArea: o, color: i, data: a, interpolation: s, strokeWidth: l, animated: u }) => {
          let c = i(a, r),
            h = (0, f.useCallback)(
              n =>
                oV()
                  .angle(t => e(t.x))
                  .radius(e => t(e.y))
                  .curve("smooth" === s ? oU : oH)(n),
              [e, t, s]
            ),
            p = (0, f.useMemo)(() => (u ? { ...hX, delay: o ? 0 : 0.05 * r } : { type: !1, delay: 0 }), [u, r, o]),
            _ = (0, f.useMemo)(() => ({ d: h(a), opacity: 1 }), [a, h]),
            g = (0, f.useMemo)(() => {
              let [e] = t.domain();
              return { d: h(a.map(t => ({ ...t, y: e }))), opacity: 0 };
            }, [a, t, h]);
          return (0, d.jsx)(hV, { custom: { enter: _, exit: g }, transition: p, className: n, pointerEvents: "none", stroke: c, fill: "none", strokeWidth: l });
        };
        pf.defaultProps = { strokeWidth: 2, animated: !0 };
        let ph = ({ size: e, data: t, color: n, index: r, symbol: o, active: i, tooltip: a, yScale: s, xScale: l, animated: u, className: c, ...h }) => {
          let p = (0, f.useRef)(null),
            [_, g] = (0, f.useState)(!1);
          function m(e) {
            let t = oV()
              .radius(e => s(e.y))
              .angle(e => l(e.x))([e]);
            if (t) {
              let [e, n] = t.slice(1).slice(0, -1).split(",");
              return { translateX: parseFloat(e), translateY: parseFloat(n) };
            }
          }
          let v = "function" == typeof n ? n(t, r) : n,
            y = m(t),
            b = "function" == typeof e ? e(t) : e,
            x = u ? { ...hX, delay: 0.005 * r } : { type: !1, delay: 0 },
            [w] = s.domain(),
            k = m({ ...t, y: w });
          return (0, d.jsxs)(f.Fragment, {
            children: [
              (0, d.jsxs)(C.E.g, {
                initial: { ...k, opacity: 0 },
                animate: { ...y, opacity: 1 },
                exit: { ...k, opacity: 0 },
                transition: x,
                ref: p,
                onMouseEnter: function (e) {
                  g(!0), h.onMouseEnter({ value: t, nativeEvent: e });
                },
                onMouseLeave: function (e) {
                  g(!1), h.onMouseLeave({ value: t, nativeEvent: e });
                },
                onClick: function (e) {
                  h.onClick({ value: t, nativeEvent: e });
                },
                className: io(c, { _inactive_1yzca_1: !i }),
                children: [o && o(t), !o && (0, d.jsx)("circle", { r: b, fill: v })]
              }),
              a && (0, d.jsx)(eB, { element: a, visible: _, reference: p, value: t })
            ]
          });
        };
        ph.defaultProps = {
          size: 3,
          color: hG.cybertron[0],
          tooltip: (0, d.jsx)(hF, {}),
          active: !0,
          onClick: () => void 0,
          onMouseEnter: () => void 0,
          onMouseLeave: () => void 0
        };
        let pp = ({ data: e, point: t, xScale: n, yScale: r, animated: o, activeIds: i }) => {
          let [a, s] = (0, f.useState)(i);
          (0, f.useEffect)(() => {
            s(i || []);
          }, [i]);
          let l = (0, f.useCallback)(
              ({ value: e }) => {
                i || s([e.id]);
              },
              [i]
            ),
            u = (0, f.useCallback)(() => {
              i || s([]);
            }, [i]),
            c = (0, f.useCallback)(
              (e, i) => {
                let s;
                e.id ? (s = e.id) : console.warn("No 'id' property provided for scatter point; provide one via 'id'.");
                let c = u2(`${s || i}`),
                  h = !(a && a.length) || a.includes(s),
                  p = t.props.visible;
                return p && !p(e, i)
                  ? (0, d.jsx)(f.Fragment, {}, c)
                  : (0, d.jsx)(eB, { element: t, data: e, index: i, active: h, xScale: n, yScale: r, animated: o, onMouseEnter: l, onMouseLeave: u }, c);
              },
              [t, a, n, r, o, l, u]
            );
          return (0, d.jsx)(f.Fragment, { children: e.map(c) });
        };
        pp.defaultProps = { point: (0, d.jsx)(ph, {}), animated: !0 };
        let p_ = ({ data: e, xScale: t, yScale: n, animated: r, color: o, activeValues: i, show: a, point: s }) => {
          let l = (0, f.useCallback)(
            (t, n) => {
              let r = i && t && lc(i.x, t.x);
              return "hover" === a ? r : "first" === a ? (i ? r : 0 === n) : "last" === a ? (i ? r : n === e.length - 1) : a;
            },
            [e, i, a]
          );
          return (0, d.jsx)(pp, { animated: r, data: e, xScale: t, yScale: n, point: (0, d.jsx)(eB, { element: s, color: o, tooltip: null, visible: l }) });
        };
        p_.defaultProps = { show: "hover", type: "standard", point: (0, d.jsx)(ph, {}) };
        let pg = ({
          area: e,
          line: t,
          symbols: n,
          tooltip: r,
          xScale: o,
          yScale: i,
          data: a,
          id: s,
          animated: l,
          width: u,
          height: c,
          innerRadius: h,
          outerRadius: p,
          type: _,
          colorScheme: g,
          interpolation: m
        }) => {
          let [v, y] = (0, f.useState)(null),
            b = "grouped" === _,
            x = (0, f.useCallback)(
              (e, t) => {
                var n;
                let r = Array.isArray(e) ? (null == (n = null == e ? void 0 : e[0]) ? void 0 : n.key) : null == e ? void 0 : e.key;
                return hK({ colorScheme: g, data: a, index: t, point: e, key: r });
              },
              [g, a]
            ),
            w = (0, f.useCallback)(
              (n, r = 0) =>
                (0, d.jsxs)(d.Fragment, {
                  children: [
                    e &&
                      (0, d.jsx)(eB, {
                        element: e,
                        id: `${s}-radial-area-${r}`,
                        xScale: o,
                        yScale: i,
                        animated: l,
                        color: x,
                        index: r,
                        data: n,
                        interpolation: m,
                        outerRadius: p,
                        innerRadius: h
                      }),
                    t && (0, d.jsx)(eB, { element: t, xScale: o, yScale: i, hasArea: null !== e, index: r, animated: l, interpolation: m, color: x, data: n })
                  ]
                }),
              [l, e, x, s, h, m, t, p, o, i]
            ),
            k = (0, f.useCallback)(
              (t, r = 0) => {
                let a = (n && n.props.activeValues) || v,
                  s = void 0 !== e && l && !a;
                return (0, d.jsx)(eB, { element: n, activeValues: v, xScale: o, index: r, yScale: i, data: t, animated: s, color: x });
              },
              [v, l, e, x, n, o, i]
            ),
            M = (0, f.useCallback)(e => (0, d.jsxs)(f.Fragment, { children: [w(e), n && k(e)] }), [w, k, n]),
            j = (0, f.useCallback)(
              e =>
                (0, d.jsxs)(f.Fragment, {
                  children: [
                    e.map((e, t) => (0, d.jsx)(f.Fragment, { children: w(e.data, t) }, `${e.key.toString()}`)).reverse(),
                    e.map((e, t) => (0, d.jsx)(f.Fragment, { children: k(e.data, t) }, `${e.key.toString()}`)).reverse()
                  ]
                }),
              [w, k]
            );
          return (0, d.jsx)(eB, {
            element: r,
            xScale: o,
            yScale: i,
            data: a,
            height: c,
            width: u,
            isRadial: !0,
            innerRadius: h,
            outerRadius: p,
            color: x,
            onValueEnter: e => y(e.value),
            onValueLeave: () => y(null),
            children: (0, d.jsxs)("g", { clipPath: `url(#${s}-path)`, children: [b && j(a), !b && M(a)] })
          });
        };
        pg.defaultProps = {
          colorScheme: hG.cybertron,
          interpolation: "smooth",
          type: "standard",
          animated: !0,
          area: (0, d.jsx)(pd, {}),
          line: (0, d.jsx)(pf, {}),
          symbols: (0, d.jsx)(p_, {}),
          tooltip: (0, d.jsx)(hI, {})
        };
        let pm = Math.PI,
          pv = 2 * pm,
          py = pv - 1e-6;
        function pb(e) {
          this._ += e[0];
          for (let t = 1, n = e.length; t < n; ++t) this._ += arguments[t] + e[t];
        }
        class px {
          constructor(e) {
            (this._x0 = this._y0 = this._x1 = this._y1 = null),
              (this._ = ""),
              (this._append =
                null == e
                  ? pb
                  : (function (e) {
                      let t = Math.floor(e);
                      if (!(t >= 0)) throw Error(`invalid digits: ${e}`);
                      if (t > 15) return pb;
                      let n = 10 ** t;
                      return function (e) {
                        this._ += e[0];
                        for (let t = 1, r = e.length; t < r; ++t) this._ += Math.round(arguments[t] * n) / n + e[t];
                      };
                    })(e));
          }
          moveTo(e, t) {
            this._append`M${(this._x0 = this._x1 = +e)},${(this._y0 = this._y1 = +t)}`;
          }
          closePath() {
            null !== this._x1 && ((this._x1 = this._x0), (this._y1 = this._y0), this._append`Z`);
          }
          lineTo(e, t) {
            this._append`L${(this._x1 = +e)},${(this._y1 = +t)}`;
          }
          quadraticCurveTo(e, t, n, r) {
            this._append`Q${+e},${+t},${(this._x1 = +n)},${(this._y1 = +r)}`;
          }
          bezierCurveTo(e, t, n, r, o, i) {
            this._append`C${+e},${+t},${+n},${+r},${(this._x1 = +o)},${(this._y1 = +i)}`;
          }
          arcTo(e, t, n, r, o) {
            if (((e *= 1), (t *= 1), (n *= 1), (r *= 1), (o *= 1) < 0)) throw Error(`negative radius: ${o}`);
            let i = this._x1,
              a = this._y1,
              s = n - e,
              l = r - t,
              u = i - e,
              c = a - t,
              d = u * u + c * c;
            if (null === this._x1) this._append`M${(this._x1 = e)},${(this._y1 = t)}`;
            else if (d > 1e-6) {
              if (Math.abs(c * s - l * u) > 1e-6 && o) {
                let f = n - i,
                  h = r - a,
                  p = s * s + l * l,
                  _ = Math.sqrt(p),
                  g = Math.sqrt(d),
                  m = o * Math.tan((pm - Math.acos((p + d - (f * f + h * h)) / (2 * _ * g))) / 2),
                  v = m / g,
                  y = m / _;
                Math.abs(v - 1) > 1e-6 && this._append`L${e + v * u},${t + v * c}`,
                  this._append`A${o},${o},0,0,${+(c * f > u * h)},${(this._x1 = e + y * s)},${(this._y1 = t + y * l)}`;
              } else this._append`L${(this._x1 = e)},${(this._y1 = t)}`;
            }
          }
          arc(e, t, n, r, o, i) {
            if (((e *= 1), (t *= 1), (n *= 1), (i = !!i), n < 0)) throw Error(`negative radius: ${n}`);
            let a = n * Math.cos(r),
              s = n * Math.sin(r),
              l = e + a,
              u = t + s,
              c = 1 ^ i,
              d = i ? r - o : o - r;
            null === this._x1 ? this._append`M${l},${u}` : (Math.abs(this._x1 - l) > 1e-6 || Math.abs(this._y1 - u) > 1e-6) && this._append`L${l},${u}`,
              n &&
                (d < 0 && (d = (d % pv) + pv),
                d > py
                  ? this._append`A${n},${n},0,1,${c},${e - a},${t - s}A${n},${n},0,1,${c},${(this._x1 = l)},${(this._y1 = u)}`
                  : d > 1e-6 && this._append`A${n},${n},0,${+(d >= pm)},${c},${(this._x1 = e + n * Math.cos(o))},${(this._y1 = t + n * Math.sin(o))}`);
          }
          rect(e, t, n, r) {
            this._append`M${(this._x0 = this._x1 = +e)},${(this._y0 = this._y1 = +t)}h${(n *= 1)}v${+r}h${-n}Z`;
          }
          toString() {
            return this._;
          }
        }
        function pw() {
          return new px();
        }
        pw.prototype = px.prototype;
        let pk = ({ custom: e, transition: t, arc: n, ...r }) => {
            let o = (0, li.c)(""),
              i = (0, li.c)(e.exit),
              a = uQ(i, { ...hX, from: 0, to: 1 });
            (0, f.useEffect)(() => {
              let t = tB(e.previousEnter ? e.previousEnter.y : i.get().y, e.enter.y),
                r = a.onChange(r => o.set(n({ ...e.enter, y: t(r) })));
              return i.set(e.enter), r;
            });
            let { d: s, ...l } = e.enter,
              { d: u, ...c } = e.exit;
            return (0, d.jsx)(C.E.path, { ...r, initial: c, exit: c, animate: l, transition: t, d: !1 !== t.type ? o : s });
          },
          pM = ({ active: e, path: t, fill: n = "#eee", opacity: r = 0.2 }) =>
            (0, d.jsx)(C.E.path, {
              d: t,
              fill: n,
              pointerEvents: "none",
              initial: "hidden",
              animate: e ? "visible" : "hidden",
              variants: { hidden: { opacity: 0 }, visible: { opacity: r } }
            });
        pM.defaultProps = { fill: "#eee", opacity: 0.2 };
        let pj = ({
          animated: e,
          innerRadius: t,
          xScale: n,
          yScale: r,
          curved: o,
          id: i,
          gradient: a,
          barCount: s,
          className: l,
          data: u,
          active: c,
          guide: h,
          index: p,
          color: _,
          onClick: g,
          onMouseEnter: m,
          onMouseLeave: v
        }) => {
          let y = (0, f.useRef)(null),
            b = _(u, p),
            x = c ? iS(b).brighten(0.5) : b,
            w = (0, f.useMemo)(() => (e ? { ...hX, delay: (p / s) * 0.5 } : { type: !1, delay: 0 }), [e, s, p]),
            k = (0, f.useCallback)(e => (a ? `url(#${i}-gradient)` : e), [a, i]),
            M = (0, f.useCallback)(
              e => {
                let i = r(e.y);
                if (o) {
                  let r = n(e.x),
                    o = r + n.bandwidth();
                  return oz().innerRadius(t).outerRadius(i).startAngle(r).endAngle(o).padAngle(0.01).padRadius(t)(e);
                }
                {
                  let r = n(e.x) - 0.5 * Math.PI,
                    o = r + n.bandwidth(),
                    a = o - r,
                    s = (t * a) / i,
                    l = (a - s) / 2,
                    u = pw();
                  return u.arc(0, 0, t, r, o), u.arc(0, 0, i, o - l, r + l, !0), u.toString();
                }
              },
              [o, t, n, r]
            ),
            j = (0, f.useCallback)(
              e => {
                let t = k(e),
                  n = y.current ? { ...y.current } : void 0;
                y.current = { ...u };
                let [o, i] = r.domain(),
                  a = { ...u, y: o },
                  s = M({ ...u, y: i });
                return (0, d.jsxs)(f.Fragment, {
                  children: [
                    h && (0, d.jsx)(eB, { element: h, active: c, path: s }),
                    (0, d.jsx)(pk, {
                      arc: M,
                      custom: { enter: u, exit: a, previousEnter: n },
                      transition: w,
                      fill: t,
                      className: l,
                      onMouseEnter: e => m({ value: u, nativeEvent: e }),
                      onMouseLeave: e => v({ value: u, nativeEvent: e }),
                      onClick: e => g({ value: u, nativeEvent: e })
                    })
                  ]
                });
              },
              [c, l, u, M, k, h, g, m, v, w, r]
            );
          return (0, d.jsxs)(f.Fragment, { children: [j(x), a && (0, d.jsx)(hz, { id: `${i}-gradient`, color: x })] });
        };
        pj.defaultProps = {
          gradient: !0,
          curved: !1,
          guide: (0, d.jsx)(pM, {}),
          onClick: () => void 0,
          onMouseEnter: () => void 0,
          onMouseLeave: () => void 0
        };
        hG.cybertron[0];
        let pE = ({
          data: e,
          startAngle: t,
          endAngle: n,
          innerRadius: r,
          outerRadius: o,
          cornerRadius: i,
          padAngle: a,
          color: s,
          animated: l,
          disabled: u,
          fill: c,
          onClick: h,
          onMouseEnter: p,
          onMouseLeave: _,
          tooltip: g
        }) => {
          let m = (0, f.useMemo)(() => oz().innerRadius(r).outerRadius(o).cornerRadius(i), [r, o, i]);
          return (0, d.jsxs)("g", {
            children: [
              c && (0, d.jsx)("circle", { fill: c, r: o }),
              (0, d.jsx)(pi, {
                arc: m,
                data: { data: e || {}, startAngle: t, endAngle: n, padAngle: a },
                animated: l,
                color: s,
                disabled: u,
                tooltip: g,
                onClick: h,
                onMouseEnter: p,
                onMouseLeave: _
              })
            ]
          });
        };
        pE.defaultProps = {
          cornerRadius: 0,
          padAngle: 0,
          padRadius: 0,
          color: "#353d44",
          animated: !0,
          disabled: !1,
          onClick: () => void 0,
          onMouseEnter: () => void 0,
          onMouseLeave: () => void 0,
          tooltip: (0, d.jsx)(hF, {})
        };
        let pS = e => (0, d.jsx)(pE, { ...e });
        pS.defaultProps = { animated: !1, disabled: !0 };
        ({ data: e, className: t, offset: n, onClick: r = () => void 0 }) => {
          let o = fj(e.key);
          return (0, d.jsx)("text", {
            x: "0",
            y: n,
            textAnchor: "middle",
            alignmentBaseline: "text-after-edge",
            onClick: t => r({ data: e, nativeEvent: t }),
            className: io(t, "_valueLabel_1eyd5_1"),
            children: o
          });
        },
          ({ data: e, className: t }) => {
            let n = h0({ to: e.data });
            return (0, d.jsx)("text", { dy: "-0.5em", x: "0", y: "15", textAnchor: "middle", className: io(t, "_valueLabel_1h164_1"), ref: n });
          };
        let pT = { stackedValueLabel: "_stackedValueLabel_1w6zx_1" },
          pC = { offset: { offset: "0, 3px" } },
          pP = ({
            rx: e,
            ry: t,
            cursor: n,
            tooltip: r,
            onClick: o,
            onMouseEnter: i,
            onMouseLeave: a,
            data: s,
            animated: l,
            cellIndex: u,
            cellCount: c,
            fill: h,
            x: p,
            y: _,
            style: g,
            className: m,
            ...v
          }) => {
            let [y, b] = (0, f.useState)(!1),
              x = (0, f.useRef)(null),
              { pointerOut: w, pointerOver: k } = po({
                onPointerOver: e => {
                  b(!0), i({ value: s, nativeEvent: e });
                },
                onPointerOut: e => {
                  b(!1), a({ value: s, nativeEvent: e });
                }
              }),
              M = (0, f.useMemo)(() => ({ y: s.value, x: `${s.key} ∙ ${s.x}`, data: s }), [s]),
              j = (0, f.useMemo)(() => (l ? { ...hX, delay: (u / c) * 0.005 } : { type: !1, delay: 0 }), [l, u, c]),
              E = hi({ style: g, className: m }, s),
              S = "transparent" === h,
              T = y && !S ? iS(h).brighten(1) : h;
            return (0, d.jsxs)(f.Fragment, {
              children: [
                (0, d.jsx)("g", {
                  ref: x,
                  children: (0, d.jsx)(C.E.rect, {
                    ...v,
                    fill: h,
                    stroke: T,
                    x: p,
                    y: _,
                    rx: e,
                    ry: t,
                    style: { ...E.style, cursor: n },
                    className: io("_cell_r3f8c_1", E.className),
                    initial: { opacity: 0 },
                    animate: { opacity: 1 },
                    exit: { opacity: 0 },
                    transition: j,
                    onPointerOver: k,
                    onPointerOut: w,
                    onClick: e => {
                      o({ value: s, nativeEvent: e });
                    }
                  })
                }),
                r && !r.props.disabled && !S && (0, d.jsx)(eB, { element: r, visible: y, modifiers: r.props.modifiers || pC, reference: x, value: M })
              ]
            });
          };
        pP.defaultProps = {
          rx: 2,
          ry: 2,
          cursor: "auto",
          tooltip: (0, d.jsx)(hF, {}),
          onClick: () => void 0,
          onMouseEnter: () => void 0,
          onMouseLeave: () => void 0
        };
        let pN = (e, t, n) => {
            let r = e2(
              ha(
                e,
                e => e.data,
                e => e.value
              )
            );
            return e =>
              null == e
                ? n
                : hK({
                    scale: function e() {
                      var t,
                        n = [],
                        r = [],
                        o = [];
                      function i() {
                        var e = 0,
                          t = Math.max(1, r.length);
                        for (o = Array(t - 1); ++e < t; )
                          o[e - 1] = (function (e, t, n = e0) {
                            if (!(!(r = e.length) || isNaN((t *= 1)))) {
                              if (t <= 0 || r < 2) return +n(e[0], 0, e);
                              if (t >= 1) return +n(e[r - 1], r - 1, e);
                              var r,
                                o = (r - 1) * t,
                                i = Math.floor(o),
                                a = +n(e[i], i, e);
                              return a + (+n(e[i + 1], i + 1, e) - a) * (o - i);
                            }
                          })(n, e / t);
                        return a;
                      }
                      function a(e) {
                        return null == e || isNaN((e *= 1)) ? t : r[te(o, e)];
                      }
                      return (
                        (a.invertExtent = function (e) {
                          var t = r.indexOf(e);
                          return t < 0 ? [NaN, NaN] : [t > 0 ? o[t - 1] : n[0], t < o.length ? o[t] : n[n.length - 1]];
                        }),
                        (a.domain = function (e) {
                          if (!arguments.length) return n.slice();
                          for (let t of ((n = []), e)) null == t || isNaN((t *= 1)) || n.push(t);
                          return n.sort(eZ), i();
                        }),
                        (a.range = function (e) {
                          return arguments.length ? ((r = Array.from(e)), i()) : r.slice();
                        }),
                        (a.unknown = function (e) {
                          return arguments.length ? ((t = e), a) : t;
                        }),
                        (a.quantiles = function () {
                          return o.slice();
                        }),
                        (a.copy = function () {
                          return e().domain(n).range(r).unknown(t);
                        }),
                        tJ.apply(a, arguments)
                      );
                    },
                    domain: r,
                    key: e,
                    colorScheme: t
                  });
          },
          pA = ({ animated: e, emptyColor: t, colorScheme: n, cell: r, xScale: o, yScale: i, data: a, id: s }) => {
            let l = pN(a, n, t),
              u = i.bandwidth(),
              c = o.bandwidth(),
              h = [...i.domain(), ...o.domain()].length,
              p = ({ row: t, cell: n, rowIndex: a, cellIndex: u, width: c, height: f, cellCount: h }) => {
                let p = o(t.key),
                  _ = i(n.x),
                  g = l(n.value);
                return (0, d.jsx)(
                  eB,
                  { element: r, animated: e, cellIndex: a + u, cellCount: h, x: p, y: _, fill: g, width: c, height: f, data: n },
                  `${s}-${a}-${u}`
                );
              };
            return (0, d.jsx)(f.Fragment, {
              children: a.map((e, t) =>
                e.data.map((n, r) => p({ height: u, width: c, valueScale: l, cellCount: h, row: e, cell: n, rowIndex: t, cellIndex: r }))
              )
            });
          };
        pA.defaultProps = {
          padding: 0.1,
          animated: !0,
          emptyColor: "rgba(200,200,200,0.08)",
          colorScheme: ["rgba(28, 107, 86, 0.5)", "#2da283"],
          cell: (0, d.jsx)(pP, {})
        };
        let pO = e => new Date(e.getFullYear(), e.getMonth(), 1),
          p$ = (e, t) => {
            let n = new Date(e.getTime());
            return n.setDate(n.getDate() + 7 * t), n;
          },
          pD = e => {
            let t = new Date(e.getTime());
            return t.setHours(0, 0, 0, 0), t;
          },
          pz = (e, t) => {
            let n = new Date(e.getTime());
            return n.setDate(n.getDate() + t), n;
          };
        (() => {
          let e = new Date(Date.UTC(2017, 0, 2));
          return eJ(7).map(() => {
            let t = e.toLocaleDateString("default", { weekday: "short" });
            return e.setDate(e.getDate() + 1), t;
          });
        })();
        let pR = e => (0, d.jsx)(h7, { ...e });
        pR.defaultProps = { tooltip: (0, d.jsx)(hF, { placement: "top", content: e => (0, d.jsx)(hL, { value: { y: e.value, x: e.y } }) }) };
        let pL = ({ height: e, width: t, fill: n, ...r }) => (0, d.jsx)("rect", { ...r, fill: n, width: Math.max(t, 0), height: Math.max(e, 0) });
        pL.defaultProps = { fill: "#484848" };
        let pF = ({ data: e, animated: t }) => {
            let n = t ? { ...hX } : { delay: 0, type: !1 },
              r = (0, li.c)(e.path),
              o = (0, li.c)(e.path),
              i = uQ(o, { from: 0, to: 1 });
            return (
              (0, f.useEffect)(() => {
                let t = tB(o.get(), e.path);
                i.onChange(e => r.set(t(e))), o.set(e.path);
              }),
              { transition: n, d: r }
            );
          },
          pI = ({
            data: e,
            fill: t,
            disabled: n,
            animated: r,
            stroke: o,
            mask: i,
            id: a,
            style: s,
            active: l,
            inactiveStyle: u,
            activeStyle: c,
            initialStyle: h,
            strokeWidth: p,
            gradient: _,
            tooltip: g,
            onClick: m,
            onMouseEnter: v,
            onMouseLeave: y
          }) => {
            var b, x;
            let [w, k] = (0, f.useState)(!1),
              M = (0, f.useRef)(null),
              { transition: j, d: E } = pF({ animated: r, data: e }),
              S = l ? c : null === l ? u : h,
              T = _ && !i ? `url(#gradient-${a})` : i ? `url(#mask-pattern-${a})` : t,
              { pointerOut: P, pointerOver: N } = po({
                onPointerOver: t => {
                  n || (k(!0), v({ value: e.data, nativeEvent: t }));
                },
                onPointerOut: t => {
                  n || (k(!1), y({ value: e.data, nativeEvent: t }));
                }
              });
            return (0, d.jsxs)("g", {
              title: e.data.key,
              onPointerOver: N,
              onPointerOut: P,
              onClick: t => {
                n || m({ value: e.data, nativeEvent: t });
              },
              children: [
                (0, d.jsx)(C.E.path, { ref: M, fill: T, id: `${a}-arc`, strokeWidth: p, stroke: o, transition: j, d: E, initial: h, animate: S, style: s }),
                i &&
                  (0, d.jsxs)(f.Fragment, {
                    children: [
                      (0, d.jsx)(hR, { id: `mask-${a}`, fill: `url(#gradient-${a})` }),
                      (0, d.jsx)(eB, { element: i, id: `mask-pattern-${a}`, fill: t })
                    ]
                  }),
                _ && (0, d.jsx)(eB, { element: _, id: `gradient-${a}`, color: t }),
                g &&
                  !g.props.disabled &&
                  (0, d.jsx)(eB, {
                    element: g,
                    visible: !!w,
                    reference: M,
                    value: { y: e.data.size, x: null == (x = null == (b = e.data) ? void 0 : b.sets) ? void 0 : x.join(" | ") }
                  })
              ]
            });
          };
        pI.defaultProps = {
          active: !1,
          inactiveStyle: { opacity: 0.3 },
          activeStyle: { opacity: 0.8 },
          initialStyle: { opacity: 0.6 },
          strokeWidth: 3,
          gradient: (0, d.jsx)(hz, {}),
          tooltip: (0, d.jsx)(hF, {}),
          onClick: () => void 0,
          onMouseEnter: () => void 0,
          onMouseLeave: () => void 0
        };
        let pB = ({ data: e, format: t, id: n, active: r, labelType: o, showAll: i, wrap: a, animated: s, fill: l, fontSize: u, fontFamily: c }) => {
          var f, h, p, _, g;
          if (!i && !(null == (f = e.arcs) ? void 0 : f.filter(e => e.large).length)) return null;
          let m = "key" === o ? (null == (p = null == (h = e.data) ? void 0 : h.sets) ? void 0 : p.join(" | ")) : e.data.size,
            v = s ? hX : { delay: 0, type: !1 },
            y = a
              ? hs({
                  key: m,
                  x: e.text.x,
                  fontFamily: c,
                  fontSize: u,
                  width: null == (g = null == (_ = null == e ? void 0 : e.circles) ? void 0 : _[0]) ? void 0 : g.radius
                })
              : m;
          return (0, d.jsx)(C.E.text, {
            id: `${n}-text`,
            fill: l,
            pointerEvents: "none",
            fontFamily: c,
            fontSize: u,
            initial: { attrX: e.text.x, attrY: e.text.y, opacity: 1 },
            animate: { attrX: e.text.x, attrY: e.text.y, opacity: null === r ? 0.3 : 1 },
            transition: v,
            textAnchor: "middle",
            children: t ? t(e) : y
          });
        };
        pB.defaultProps = { labelType: "key", showAll: !1, wrap: !0, animated: !0, fill: "#000", fontSize: 11, fontFamily: "sans-serif" };
        let pU = ({ data: e, format: t, animated: n, fill: r, fontSize: o, fontFamily: i }) => {
          let a = n ? hX : { delay: 0, type: !1 },
            s = e.set.data.key,
            l = t ? t(e) : s,
            u = (0, f.isValidElement)(l),
            c = u && e.set.icon,
            h = { x: c ? e.set.icon.x : e.set.text.x, y: c ? e.set.icon.y : e.set.text.y };
          return (0, d.jsx)(f.Fragment, {
            children: u
              ? (0, d.jsx)("g", { style: { transform: `translate(${h.x}px, ${h.y}px)` }, children: l })
              : (0, d.jsx)(C.E.text, {
                  fill: r,
                  style: { pointerEvents: "none", fontFamily: i, fontSize: o },
                  textAnchor: "middle" === e.set.align ? "center" : e.set.align,
                  alignmentBaseline: e.set.verticalAlign,
                  initial: { attrX: h.x, attrY: h.y },
                  animate: { attrX: h.x, attrY: h.y },
                  transition: a,
                  children: l
                })
          });
        };
        pU.defaultProps = { animated: !0, fill: "#000", fontSize: 14, fontFamily: "sans-serif" };
        let pq = e => {
            var t, n;
            return null == (n = null == (t = e.data) ? void 0 : t.key) ? void 0 : n.replace(" ", "");
          },
          pH = {
            sets: [{ cx: 0, cy: 0, r: 5, text: { x: 3.5, y: -4 }, align: "start", verticalAlign: "bottom" }],
            intersections: [
              {
                sets: [0],
                x1: 0,
                y1: 5,
                arcs: [
                  { mode: "i", ref: 0, x2: 0, y2: -5, sweep: !1, large: !1 },
                  { mode: "i", ref: 0, x2: 0, y2: 5, sweep: !1, large: !1 }
                ],
                text: { x: 0, y: 0 }
              }
            ],
            bb: { x: -5, y: -5, width: 10, height: 10 }
          },
          pY = {
            sets: [
              { cx: -4, cy: 0, r: 5, text: { x: -7.5, y: 4 }, align: "end", verticalAlign: "top" },
              { cx: 4, cy: 0, r: 5, text: { x: 7.5, y: -4 }, align: "start", verticalAlign: "bottom" }
            ],
            intersections: [
              {
                sets: [0],
                x1: 0,
                y1: -3,
                arcs: [
                  { mode: "i", ref: 0, x2: 0, y2: 3, sweep: !1, large: !0 },
                  { mode: "o", ref: 1, x2: 0, y2: -3, sweep: !0, large: !1 }
                ],
                text: { x: -4, y: 0 }
              },
              {
                sets: [1],
                x1: 0,
                y1: 3,
                arcs: [
                  { mode: "i", ref: 1, x2: 0, y2: -3, sweep: !1, large: !0 },
                  { mode: "o", ref: 0, x2: 0, y2: 3, sweep: !0, large: !1 }
                ],
                text: { x: 4, y: 0 }
              },
              {
                sets: [0, 1],
                x1: 0,
                y1: 3,
                arcs: [
                  { mode: "i", ref: 0, x2: 0, y2: -3, sweep: !1, large: !1 },
                  { mode: "i", ref: 1, x2: 0, y2: 3, sweep: !1, large: !1 }
                ],
                text: { x: 0, y: 0 }
              }
            ],
            bb: { x: -9, y: -5, width: 18, height: 10 }
          },
          pW = {
            sets: [
              { cx: -3.464, cy: -2, r: 5, text: { x: -7, y: -6 }, align: "end" },
              { cx: 3.464, cy: -2, r: 5, text: { x: 7, y: -6 }, align: "start" },
              { cx: 0, cy: 4, r: 5, text: { x: 4, y: 7.5 }, align: "start", verticalAlign: "top" }
            ],
            intersections: [
              {
                sets: [0],
                x1: -4.855,
                y1: 2.803,
                arcs: [
                  { mode: "o", ref: 2, x2: -1.39, y2: -0.803, sweep: !0, large: !1 },
                  { mode: "o", ref: 1, x2: 0, y2: -5.606, sweep: !0, large: !1 },
                  { mode: "i", ref: 0, x2: -4.855, y2: 2.803, sweep: !1, large: !0 }
                ],
                text: { x: -4.216, y: -2.434 }
              },
              {
                sets: [1],
                x1: 0,
                y1: -5.606,
                arcs: [
                  { mode: "o", ref: 0, x2: 1.39, y2: -0.803, sweep: !0, large: !1 },
                  { mode: "o", ref: 2, x2: 4.855, y2: 2.803, sweep: !0, large: !1 },
                  { mode: "i", ref: 1, x2: 0, y2: -5.606, sweep: !1, large: !0 }
                ],
                text: { x: 4.216, y: -2.434 }
              },
              {
                sets: [2],
                x1: -4.855,
                y1: 2.803,
                arcs: [
                  { mode: "o", ref: 0, x2: 0, y2: 1.606, sweep: !1, large: !1 },
                  { mode: "o", ref: 1, x2: 4.855, y2: 2.803, sweep: !1, large: !1 },
                  { mode: "i", ref: 2, x2: -4.855, y2: 2.803, sweep: !0, large: !0 }
                ],
                text: { x: 0, y: 4.869 }
              },
              {
                sets: [0, 1],
                x1: 0,
                y1: -5.606,
                arcs: [
                  { mode: "i", ref: 1, x2: -1.39, y2: -0.803, sweep: !1, large: !1 },
                  { mode: "o", ref: 2, x2: 1.39, y2: -0.803, sweep: !0, large: !1 },
                  { mode: "i", ref: 0, x2: 0, y2: -5.606, sweep: !1, large: !1 }
                ],
                text: { x: 0, y: -2.404 }
              },
              {
                sets: [0, 2],
                x1: -4.855,
                y1: 2.803,
                arcs: [
                  { mode: "i", ref: 2, x2: -1.39, y2: -0.803, sweep: !0, large: !1 },
                  { mode: "o", ref: 1, x2: 0, y2: 1.606, sweep: !1, large: !1 },
                  { mode: "i", ref: 0, x2: -4.855, y2: 2.803, sweep: !0, large: !1 }
                ],
                text: { x: -2.082, y: 1.202 }
              },
              {
                sets: [1, 2],
                x1: 4.855,
                y1: 2.803,
                arcs: [
                  { mode: "i", ref: 2, x2: 1.39, y2: -0.803, sweep: !1, large: !1 },
                  { mode: "o", ref: 0, x2: 0, y2: 1.606, sweep: !0, large: !1 },
                  { mode: "i", ref: 1, x2: 4.855, y2: 2.803, sweep: !1, large: !1 }
                ],
                text: { x: 2.082, y: 1.202 }
              },
              {
                sets: [0, 1, 2],
                x1: 1.39,
                y1: -0.803,
                arcs: [
                  { mode: "i", ref: 0, x2: 0, y2: 1.606, sweep: !0, large: !1 },
                  { mode: "i", ref: 1, x2: -1.39, y2: -0.803, sweep: !0, large: !1 },
                  { mode: "i", ref: 2, x2: 1.39, y2: -0.803, sweep: !0, large: !1 }
                ],
                text: { x: 0, y: 0 }
              }
            ],
            bb: { x: -8.464, y: -7, width: 16.928, height: 16 }
          },
          pZ = {
            sets: [
              { cx: 0.439, cy: -1.061, rx: 2.5, ry: 5, rotation: 45, text: { x: 4.5, y: -4.5 }, align: "start", verticalAlign: "bottom" },
              { cx: 2.561, cy: 1.061, rx: 2.5, ry: 5, rotation: 45, text: { x: 4, y: 3.75 }, align: "start", verticalAlign: "top" },
              { cx: -2.561, cy: 1.061, rx: 2.5, ry: 5, rotation: -45, text: { x: -4, y: 3.7 }, align: "end", verticalAlign: "top" },
              { cx: -0.439, cy: -1.061, rx: 2.5, ry: 5, rotation: -45, text: { x: -4.5, y: -4.5 }, align: "end", verticalAlign: "bottom" }
            ],
            intersections: [
              {
                sets: [0],
                x1: 0,
                y1: -3.94,
                arcs: [
                  { ref: 0, mode: "i", x2: 4.328, y2: -2.828, sweep: !0, large: !1 },
                  { ref: 1, mode: "o", x2: 2.179, y2: -1.858, large: !1 },
                  { ref: 3, mode: "o", x2: 0, y2: -3.94, large: !1 }
                ],
                text: { x: 2.914, y: -3.536 }
              },
              {
                sets: [1],
                x1: 4.328,
                y1: -2.828,
                arcs: [
                  { ref: 1, mode: "i", x2: 0, y2: 5.006, sweep: !0, large: !0 },
                  { ref: 2, mode: "o", x2: 1.328, y2: 2.828 },
                  { ref: 3, mode: "o", x2: 3.108, y2: -0.328 },
                  { ref: 0, mode: "o", x2: 4.328, y2: -2.828 }
                ],
                text: { x: 5.036, y: -1.414 }
              },
              {
                sets: [2],
                x1: 0,
                y1: 5.006,
                arcs: [
                  { ref: 2, mode: "i", x2: -4.328, y2: -2.828, sweep: !0, large: !0 },
                  { ref: 3, mode: "o", x2: -3.108, y2: -0.328 },
                  { ref: 0, mode: "o", x2: -1.328, y2: 2.828 },
                  { ref: 1, mode: "o", x2: 0, y2: 5.006 }
                ],
                text: { x: -5.036, y: -1.414 }
              },
              {
                sets: [3],
                x1: -4.328,
                y1: -2.828,
                arcs: [
                  { ref: 3, mode: "i", x2: 0, y2: -3.94, sweep: !0, large: !1 },
                  { ref: 0, mode: "o", x2: -2.179, y2: -1.858, large: !1 },
                  { ref: 2, mode: "o", x2: -4.328, y2: -2.828, large: !1 }
                ],
                text: { x: -2.914, y: -3.536 }
              },
              {
                sets: [0, 1],
                x1: 4.328,
                y1: -2.828,
                arcs: [
                  { ref: 1, mode: "i", x2: 3.108, y2: -0.328, sweep: !0, large: !1 },
                  { ref: 3, mode: "o", x2: 2.179, y2: -1.858, sweep: !1, large: !1 },
                  { ref: 0, mode: "i", x2: 4.328, y2: -2.828, sweep: !0, large: !1 }
                ],
                text: { x: 3.205, y: -1.672 }
              },
              {
                sets: [0, 2],
                x1: -1.328,
                y1: 2.828,
                arcs: [
                  { ref: 0, mode: "i", x2: -3.108, y2: -0.328, sweep: !0, large: !1 },
                  { ref: 3, mode: "o", x2: -0.969, y2: 1.755, large: !1 },
                  { ref: 1, mode: "o", x2: -1.328, y2: 2.828, large: !1 }
                ],
                text: { x: -2.212, y: 1.591 }
              },
              {
                sets: [0, 3],
                x1: 0,
                y1: -3.94,
                arcs: [
                  { ref: 3, mode: "i", x2: 2.179, y2: -1.858, sweep: !0, large: !1 },
                  { ref: 1, mode: "o", x2: 0, y2: 0.188, sweep: !1, large: !1 },
                  { ref: 2, mode: "o", x2: -2.179, y2: -1.858, sweep: !1, large: !1 },
                  { ref: 0, mode: "i", x2: 0, y2: -3.94, sweep: !0 }
                ],
                text: { x: 0, y: -1.87 }
              },
              {
                sets: [1, 2],
                x1: 1.328,
                y1: 2.828,
                arcs: [
                  { ref: 2, mode: "i", x2: 0, y2: 5.006, sweep: !0, large: !1 },
                  { ref: 1, mode: "i", x2: -1.328, y2: 2.828, sweep: !0, large: !1 },
                  { ref: 0, mode: "o", x2: 0, y2: 2.346, large: !1 },
                  { ref: 3, mode: "o", x2: 1.328, y2: 2.828 }
                ],
                text: { x: 0, y: 3.393 }
              },
              {
                sets: [1, 3],
                x1: 3.108,
                y1: -0.328,
                arcs: [
                  { ref: 3, mode: "i", x2: 1.328, y2: 2.828, sweep: !0, large: !1 },
                  { ref: 2, mode: "o", x2: 0.969, y2: 1.755, large: !1 },
                  { ref: 1, mode: "i", x2: 3.108, y2: -0.328, large: !1 }
                ],
                text: { x: 2.212, y: 1.591 }
              },
              {
                sets: [2, 3],
                x1: -3.108,
                y1: -0.328,
                arcs: [
                  { ref: 3, mode: "i", x2: -4.328, y2: -2.828, sweep: !0, large: !1 },
                  { ref: 2, mode: "i", x2: -2.179, y2: -1.858, sweep: !0, large: !1 },
                  { ref: 0, mode: "o", x2: -3.108, y2: -0.328, large: !1 }
                ],
                text: { x: -3.205, y: -1.672 }
              },
              {
                sets: [0, 1, 2],
                x1: 0,
                y1: 2.346,
                arcs: [
                  { ref: 0, mode: "i", x2: -1.328, y2: 2.828, sweep: !0, large: !1 },
                  { ref: 1, mode: "i", x2: -0.969, y2: 1.755, sweep: !0, large: !1 },
                  { ref: 3, mode: "o", x2: 0, y2: 2.346, large: !1 }
                ],
                text: { x: -0.766, y: 2.31 }
              },
              {
                sets: [0, 1, 3],
                x1: 2.179,
                y1: -1.858,
                arcs: [
                  { ref: 3, mode: "i", x2: 3.108, y2: -0.328, sweep: !0, large: !1 },
                  { ref: 0, mode: "i", x2: 0.969, y2: 1.755, sweep: !0, large: !1 },
                  { ref: 2, mode: "o", x2: 0, y2: 0.188, sweep: !1, large: !1 },
                  { ref: 1, mode: "i", x2: 2.179, y2: -1.858, sweep: !0 }
                ],
                text: { x: 1.558, y: -0.056 }
              },
              {
                sets: [0, 2, 3],
                x1: -0.969,
                y1: 1.755,
                arcs: [
                  { ref: 3, mode: "i", x2: -3.108, y2: -0.328, sweep: !0, large: !1 },
                  { ref: 0, mode: "i", x2: -2.179, y2: -1.858, sweep: !0, large: !1 },
                  { ref: 2, mode: "i", x2: 0, y2: 0.188, sweep: !0, large: !1 },
                  { ref: 1, mode: "o", x2: -0.969, y2: 1.755 }
                ],
                text: { x: -1.558, y: -0.056 }
              },
              {
                sets: [1, 2, 3],
                x1: 1.328,
                y1: 2.828,
                arcs: [
                  { ref: 3, mode: "i", x2: 0, y2: 2.346, sweep: !0, large: !1 },
                  { ref: 0, mode: "o", x2: 0.969, y2: 1.755, sweep: !1, large: !1 },
                  { ref: 2, mode: "i", x2: 1.328, y2: 2.828, sweep: !0, large: !1 }
                ],
                text: { x: 0.766, y: 2.31 }
              },
              {
                sets: [0, 1, 2, 3],
                x1: 0,
                y1: 0.188,
                arcs: [
                  { ref: 2, mode: "i", x2: 0.969, y2: 1.755, sweep: !0, large: !1 },
                  { ref: 0, mode: "i", x2: 0, y2: 2.346, sweep: !0, large: !1 },
                  { ref: 3, mode: "i", x2: -0.969, y2: 1.755, sweep: !0, large: !1 },
                  { ref: 1, mode: "i", x2: 0, y2: 0.188, sweep: !0 }
                ],
                text: { x: 0, y: 1.43 }
              }
            ],
            bb: { x: -6.5, y: -5, width: 13, height: 10 }
          },
          pX = ({ id: e, data: t, format: n, wrap: r, fill: o, fontSize: i, fontFamily: a, animated: s }) => {
            let l;
            let u = s ? hX : { type: !1, delay: 0 },
              c = !1;
            if ((n && ((l = n(t)), (c = (0, f.isValidElement)(l))), !c)) {
              let n = r ? hs({ key: t.data.key, fontFamily: a, fontSize: i, width: t.r }) : t.data.key;
              return (0, d.jsx)(C.E.text, {
                initial: { x: t.x, y: t.y },
                animate: { x: t.x, y: t.y },
                transition: u,
                id: `${e}-text`,
                style: { pointerEvents: "none", fontFamily: a, fontSize: i },
                fill: o,
                textAnchor: "middle",
                children: n
              });
            }
            return (0, d.jsx)("g", { style: { transform: `translate(${t.x}px, ${t.y}px)` }, children: l });
          };
        pX.defaultProps = { wrap: !0, fill: "#000", fontSize: 14, fontFamily: "sans-serif" };
        ({
          id: e,
          data: t,
          fill: n,
          mask: r,
          gradient: o,
          glow: i,
          onClick: a,
          onMouseEnter: s,
          onMouseLeave: l,
          animated: u,
          tooltip: c = (0, d.jsx)(hF, {})
        }) => {
          let [h, p] = (0, f.useState)(!1),
            _ = (0, f.useRef)(null),
            g = u ? hX : { type: !1, delay: 0 },
            { pointerOut: m, pointerOver: v } = po({
              onPointerOver: e => {
                p(!0), null == s || s(e);
              },
              onPointerOut: e => {
                p(!1), null == l || l(e);
              }
            }),
            y = o && !r ? `url(#gradient-${e})` : r ? `url(#mask-pattern-${e})` : n,
            b = i ? { filter: `drop-shadow(${i.props.x}px ${i.props.y}px ${i.props.blur}px ${i.props.color})` } : {};
          return (0, d.jsxs)(f.Fragment, {
            children: [
              (0, d.jsx)(C.E.circle, {
                id: `${e}-bubble`,
                ref: _,
                fill: y,
                style: { ...b },
                initial: { r: t.r, cx: t.x, cy: t.y },
                animate: { r: t.r, cx: t.x, cy: t.y },
                transition: g,
                onClick: a,
                onPointerOver: v,
                onPointerOut: m
              }),
              r &&
                (0, d.jsxs)(f.Fragment, {
                  children: [(0, d.jsx)(hR, { id: `mask-${e}`, fill: `url(#gradient-${e})` }), (0, d.jsx)(eB, { element: r, id: `mask-pattern-${e}`, fill: n })]
                }),
              o && (0, d.jsx)(eB, { element: o, id: `gradient-${e}`, color: n }),
              c && !c.props.disabled && (0, d.jsx)(eB, { element: c, visible: !!h, reference: _, value: { y: t.data.data, x: t.data.key } })
            ]
          });
        };
        let pV = ({ id: e, data: t, fill: n, wrap: r, placement: o, fontSize: i, fontFamily: a }) => {
          let s = t.data.key,
            l = t.x1 - t.x0,
            u = hs({ key: s, fontFamily: a, fontSize: i, paddingX: 10, wrap: r, paddingY: 10, width: l, height: t.y1 - t.y0 }),
            c = fN("string" == typeof u ? u : s, a, i),
            f = "start" === o ? 10 : "middle" === o ? (l - c.width) / 2 : l - c.width - 10;
          return (0, d.jsx)("g", {
            style: { transform: `translate(${f}px, 15px)` },
            children: (0, d.jsx)("text", { id: `${e}-text`, style: { pointerEvents: "none", fontFamily: a, fontSize: i }, fill: n, children: u })
          });
        };
        pV.defaultProps = { fill: "#FFF", wrap: !0, fontSize: 14, fontFamily: "sans-serif", placement: "start" };
        let pG = ({ data: e, fill: t, animated: n, cursor: r, tooltip: o, onMouseEnter: i, onMouseLeave: a, onClick: s }) => {
          let [l, u] = (0, f.useState)(!1),
            c = (0, f.useRef)(null),
            h = n ? hX : { type: !1, delay: 0 },
            p = l ? iS(t).darken(0.8).hex() : t,
            { pointerOut: _, pointerOver: g } = po({
              onPointerOver: t => {
                u(!0), null == i || i(t, e);
              },
              onPointerOut: t => {
                u(!1), null == a || a(t, e);
              }
            }),
            m = (0, f.useMemo)(() => {
              let t = e => (e.parent ? [...t(e.parent), e.data.key] : []);
              return t(e).join(" -> ");
            }, [e]);
          return (0, d.jsxs)(f.Fragment, {
            children: [
              (0, d.jsx)(C.E.rect, {
                ref: c,
                initial: { fill: p, width: e.x1 - e.x0, height: e.y1 - e.y0 },
                animate: { fill: p, width: e.x1 - e.x0, height: e.y1 - e.y0 },
                style: { cursor: r },
                transition: h,
                onClick: t => {
                  null == s || s(t, e);
                },
                onPointerOver: g,
                onPointerOut: _
              }),
              o && !o.props.disabled && (0, d.jsx)(eB, { element: o, visible: !!l, reference: c, value: { y: e.value, x: m } })
            ]
          });
        };
        pG.defaultProps = { cursor: "pointer", tooltip: (0, d.jsx)(hF, {}) };
        hG.cybertron[0];
        hG.cybertron[0];
        let pJ = ({ data: e, index: t, xScale: n, yScale: r, fontFamily: o, padding: i, fontSize: a, fill: s, className: l }) => {
          let u = n(t) + i,
            [c] = r.range(),
            f = e.key,
            h = n(t + 1),
            p = (h ? h - n(t) : 0) - i;
          return fN(f, o, a).width > p
            ? null
            : (0, d.jsxs)(C.E.g, {
                transform: `translate(${u}, ${c / 2 + i})`,
                initial: { opacity: 0 },
                animate: { opacity: 1 },
                children: [
                  (0, d.jsx)("text", {
                    pointerEvents: "none",
                    fill: s,
                    y: -(a + i),
                    className: l,
                    dominantBaseline: "middle",
                    fontFamily: o,
                    fontSize: 2 * a,
                    children: fj(e.data)
                  }),
                  (0, d.jsx)("text", { pointerEvents: "none", fill: s, className: l, dominantBaseline: "middle", fontFamily: o, fontSize: a, children: f })
                ]
              });
        };
        pJ.defaultProps = { fontSize: 13, padding: 10, fontFamily: "sans-serif", fill: "#fff" };
        let pK = ({ strokeColor: e, strokeWidth: t, yScale: n, xScale: r, index: o }) => {
          let [i] = n.range();
          return (0, d.jsx)("line", { x1: r(o), y1: 0, x2: r(o), y2: i, stroke: e, strokeWidth: t, pointerEvents: "none" });
        };
        pK.defaultProps = { strokeColor: "#333", strokeWidth: 2 };
      }
    }
  ]);
//# sourceMappingURL=4278.js.map
