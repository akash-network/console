/*! For license information please see lib-router.js.LICENSE.txt */
!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "2abff297-29b2-4f9d-bdc3-0d8d82ebfc80"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-2abff297-29b2-4f9d-bdc3-0d8d82ebfc80"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.22.9" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["2118"],
  {
    72913: function (e, t, n) {
      n.d(t, { Ep: () => h, aU: () => a, cP: () => f, q_: () => o });
      var r,
        a,
        l = n(13714);
      ((r = a || (a = {})).Pop = "POP"), (r.Push = "PUSH"), (r.Replace = "REPLACE");
      var i = function (e) {
          return e;
        },
        u = "beforeunload";
      function o(e) {
        void 0 === e && (e = {});
        var t = e.window,
          n = void 0 === t ? document.defaultView : t,
          r = n.history;
        function o() {
          var e = f(n.location.hash.substr(1)),
            t = e.pathname,
            a = e.search,
            l = e.hash,
            u = r.state || {};
          return [
            u.idx,
            i({ pathname: void 0 === t ? "/" : t, search: void 0 === a ? "" : a, hash: void 0 === l ? "" : l, state: u.usr || null, key: u.key || "default" })
          ];
        }
        var p = null;
        function d() {
          if (p) P.call(p), (p = null);
          else {
            var e = a.Pop,
              t = o(),
              n = t[0],
              r = t[1];
            if (P.length) {
              if (null != n) {
                var l = g - n;
                l &&
                  ((p = {
                    action: e,
                    location: r,
                    retry: function () {
                      k(-1 * l);
                    }
                  }),
                  k(l));
              }
            } else S(e);
          }
        }
        n.addEventListener("popstate", d),
          n.addEventListener("hashchange", function () {
            h(o()[1]) !== h(y) && d();
          });
        var v = a.Pop,
          m = o(),
          g = m[0],
          y = m[1],
          b = s(),
          P = s();
        function E(e) {
          return (
            (function () {
              var e = document.querySelector("base"),
                t = "";
              if (e && e.getAttribute("href")) {
                var r = n.location.href,
                  a = r.indexOf("#");
                t = -1 === a ? r : r.slice(0, a);
              }
              return t;
            })() +
            "#" +
            ("string" == typeof e ? e : h(e))
          );
        }
        function x(e, t) {
          return (
            void 0 === t && (t = null),
            i(
              (0, l.Z)({ pathname: y.pathname, hash: "", search: "" }, "string" == typeof e ? f(e) : e, {
                state: t,
                key: Math.random().toString(36).substr(2, 8)
              })
            )
          );
        }
        function w(e, t) {
          return [{ usr: e.state, key: e.key, idx: t }, E(e)];
        }
        function C(e, t, n) {
          return !P.length || (P.call({ action: e, location: t, retry: n }), !1);
        }
        function S(e) {
          v = e;
          var t = o();
          (g = t[0]), (y = t[1]), b.call({ action: v, location: y });
        }
        function k(e) {
          r.go(e);
        }
        return (
          null == g && ((g = 0), r.replaceState((0, l.Z)({}, r.state, { idx: g }), "")),
          {
            get action() {
              return v;
            },
            get location() {
              return y;
            },
            createHref: E,
            push: function e(t, l) {
              var i = a.Push,
                u = x(t, l);
              if (
                C(i, u, function () {
                  e(t, l);
                })
              ) {
                var o = w(u, g + 1),
                  c = o[0],
                  s = o[1];
                try {
                  r.pushState(c, "", s);
                } catch (e) {
                  n.location.assign(s);
                }
                S(i);
              }
            },
            replace: function e(t, n) {
              var l = a.Replace,
                i = x(t, n);
              if (
                C(l, i, function () {
                  e(t, n);
                })
              ) {
                var u = w(i, g),
                  o = u[0],
                  c = u[1];
                r.replaceState(o, "", c), S(l);
              }
            },
            go: k,
            back: function () {
              k(-1);
            },
            forward: function () {
              k(1);
            },
            listen: function (e) {
              return b.push(e);
            },
            block: function (e) {
              var t = P.push(e);
              return (
                1 === P.length && n.addEventListener(u, c),
                function () {
                  t(), P.length || n.removeEventListener(u, c);
                }
              );
            }
          }
        );
      }
      function c(e) {
        e.preventDefault(), (e.returnValue = "");
      }
      function s() {
        var e = [];
        return {
          get length() {
            return e.length;
          },
          push: function (t) {
            return (
              e.push(t),
              function () {
                e = e.filter(function (e) {
                  return e !== t;
                });
              }
            );
          },
          call: function (t) {
            e.forEach(function (e) {
              return e && e(t);
            });
          }
        };
      }
      function h(e) {
        var t = e.pathname,
          n = void 0 === t ? "/" : t,
          r = e.search,
          a = void 0 === r ? "" : r,
          l = e.hash,
          i = void 0 === l ? "" : l;
        return a && "?" !== a && (n += "?" === a.charAt(0) ? a : "?" + a), i && "#" !== i && (n += "#" === i.charAt(0) ? i : "#" + i), n;
      }
      function f(e) {
        var t = {};
        if (e) {
          var n = e.indexOf("#");
          n >= 0 && ((t.hash = e.substr(n)), (e = e.substr(0, n)));
          var r = e.indexOf("?");
          r >= 0 && ((t.search = e.substr(r)), (e = e.substr(0, r))), e && (t.pathname = e);
        }
        return t;
      }
    },
    62833: function (e, t, n) {
      n.d(t, { UT: () => o, lr: () => s, rU: () => c });
      var r = n(2784),
        a = n(72913),
        l = n(10289);
      function i() {
        return (i =
          Object.assign ||
          function (e) {
            for (var t = 1; t < arguments.length; t++) {
              var n = arguments[t];
              for (var r in n) Object.prototype.hasOwnProperty.call(n, r) && (e[r] = n[r]);
            }
            return e;
          }).apply(this, arguments);
      }
      let u = ["onClick", "reloadDocument", "replace", "state", "target", "to"];
      function o(e) {
        let { basename: t, children: n, window: i } = e,
          u = (0, r.useRef)();
        null == u.current && (u.current = (0, a.q_)({ window: i }));
        let o = u.current,
          [c, s] = (0, r.useState)({ action: o.action, location: o.location });
        return (
          (0, r.useLayoutEffect)(() => o.listen(s), [o]),
          (0, r.createElement)(l.F0, { basename: t, children: n, location: c.location, navigationType: c.action, navigator: o })
        );
      }
      let c = (0, r.forwardRef)(function (e, t) {
        let { onClick: n, reloadDocument: o, replace: c = !1, state: s, target: h, to: f } = e,
          p = (function (e, t) {
            if (null == e) return {};
            var n,
              r,
              a = {},
              l = Object.keys(e);
            for (r = 0; r < l.length; r++) (n = l[r]), t.indexOf(n) >= 0 || (a[n] = e[n]);
            return a;
          })(e, u),
          d = (0, l.oQ)(f),
          v = (function (e, t) {
            let { target: n, replace: i, state: u } = void 0 === t ? {} : t,
              o = (0, l.s0)(),
              c = (0, l.TH)(),
              s = (0, l.WU)(e);
            return (0, r.useCallback)(
              t => {
                0 === t.button &&
                  (!n || "_self" === n) &&
                  !(t.metaKey || t.altKey || t.ctrlKey || t.shiftKey) &&
                  (t.preventDefault(), o(e, { replace: !!i || (0, a.Ep)(c) === (0, a.Ep)(s), state: u }));
              },
              [c, o, s, i, u, n, e]
            );
          })(f, { replace: c, state: s, target: h });
        return (0, r.createElement)(
          "a",
          i({}, p, {
            href: d,
            onClick: function (e) {
              n && n(e), e.defaultPrevented || o || v(e);
            },
            ref: t,
            target: h
          })
        );
      });
      function s(e) {
        let t = (0, r.useRef)(h(e)),
          n = (0, l.TH)(),
          a = (0, r.useMemo)(() => {
            let e = h(n.search);
            for (let n of t.current.keys())
              e.has(n) ||
                t.current.getAll(n).forEach(t => {
                  e.append(n, t);
                });
            return e;
          }, [n.search]),
          i = (0, l.s0)();
        return [
          a,
          (0, r.useCallback)(
            (e, t) => {
              i("?" + h(e), t);
            },
            [i]
          )
        ];
      }
      function h(e) {
        return (
          void 0 === e && (e = ""),
          new URLSearchParams(
            "string" == typeof e || Array.isArray(e) || e instanceof URLSearchParams
              ? e
              : Object.keys(e).reduce((t, n) => {
                  let r = e[n];
                  return t.concat(Array.isArray(r) ? r.map(e => [n, e]) : [[n, r]]);
                }, [])
          )
        );
      }
    },
    10289: function (e, t, n) {
      n.d(t, { AW: () => S, F0: () => k, Fg: () => C, TH: () => P, WU: () => w, Z5: () => O, fp: () => c, is: () => _, oQ: () => y, s0: () => x, ur: () => E });
      var r = n(72913),
        a = n(2784);
      let l = (0, a.createContext)(null),
        i = (0, a.createContext)(null),
        u = (0, a.createContext)({ outlet: null, matches: [] });
      function o(e, t) {
        if (!e) throw Error(t);
      }
      function c(e, t, n) {
        void 0 === n && (n = "/");
        let a = p(("string" == typeof t ? (0, r.cP)(t) : t).pathname || "/", n);
        if (null == a) return null;
        let l = (function e(t, n, r, a) {
          return (
            void 0 === n && (n = []),
            void 0 === r && (r = []),
            void 0 === a && (a = ""),
            t.forEach((t, l) => {
              let i = { relativePath: t.path || "", caseSensitive: !0 === t.caseSensitive, childrenIndex: l, route: t };
              i.relativePath.startsWith("/") && (i.relativePath.startsWith(a) || o(!1), (i.relativePath = i.relativePath.slice(a.length)));
              let u = d([a, i.relativePath]),
                c = r.concat(i);
              if ((t.children && t.children.length > 0 && (!0 === t.index && o(!1), e(t.children, n, c, u)), null != t.path || t.index)) {
                var f, p;
                let e, r;
                n.push({
                  path: u,
                  score:
                    ((f = u),
                    (p = t.index),
                    (r = (e = f.split("/")).length),
                    e.some(h) && (r += -2),
                    p && (r += 2),
                    e.filter(e => !h(e)).reduce((e, t) => e + (s.test(t) ? 3 : "" === t ? 1 : 10), r)),
                  routesMeta: c
                });
              }
            }),
            n
          );
        })(e);
        !(function (e) {
          e.sort((e, t) => {
            var n, r;
            return e.score !== t.score
              ? t.score - e.score
              : ((n = e.routesMeta.map(e => e.childrenIndex)),
                (r = t.routesMeta.map(e => e.childrenIndex)),
                n.length === r.length && n.slice(0, -1).every((e, t) => e === r[t]) ? n[n.length - 1] - r[r.length - 1] : 0);
          });
        })(l);
        let i = null;
        for (let e = 0; null == i && e < l.length; ++e)
          i = (function (e, t) {
            let { routesMeta: n } = e,
              r = {},
              a = "/",
              l = [];
            for (let e = 0; e < n.length; ++e) {
              let i = n[e],
                u = e === n.length - 1,
                o = "/" === a ? t : t.slice(a.length) || "/",
                c = (function (e, t) {
                  "string" == typeof e && (e = { path: e, caseSensitive: !1, end: !0 });
                  let [n, r] = (function (e, t, n) {
                      void 0 === t && (t = !1), void 0 === n && (n = !0);
                      let r = [],
                        a =
                          "^" +
                          e
                            .replace(/\/*\*?$/, "")
                            .replace(/^\/*/, "/")
                            .replace(/[\\.*+^$?{}|()[\]]/g, "\\$&")
                            .replace(/:(\w+)/g, (e, t) => (r.push(t), "([^\\/]+)"));
                      return (
                        e.endsWith("*")
                          ? (r.push("*"), (a += "*" === e || "/*" === e ? "(.*)$" : "(?:\\/(.+)|\\/*)$"))
                          : (a += n ? "\\/*$" : "(?:(?=[.~-]|%[0-9A-F]{2})|\\b|\\/|$)"),
                        [new RegExp(a, t ? void 0 : "i"), r]
                      );
                    })(e.path, e.caseSensitive, e.end),
                    a = t.match(n);
                  if (!a) return null;
                  let l = a[0],
                    i = l.replace(/(.)\/+$/, "$1"),
                    u = a.slice(1);
                  return {
                    params: r.reduce((e, t, n) => {
                      if ("*" === t) {
                        let e = u[n] || "";
                        i = l.slice(0, l.length - e.length).replace(/(.)\/+$/, "$1");
                      }
                      return (
                        (e[t] = (function (e, t) {
                          try {
                            return decodeURIComponent(e);
                          } catch (t) {
                            return e;
                          }
                        })(u[n] || "", 0)),
                        e
                      );
                    }, {}),
                    pathname: l,
                    pathnameBase: i,
                    pattern: e
                  };
                })({ path: i.relativePath, caseSensitive: i.caseSensitive, end: u }, o);
              if (!c) return null;
              Object.assign(r, c.params);
              let s = i.route;
              l.push({ params: r, pathname: d([a, c.pathname]), pathnameBase: v(d([a, c.pathnameBase])), route: s }),
                "/" !== c.pathnameBase && (a = d([a, c.pathnameBase]));
            }
            return l;
          })(l[e], a);
        return i;
      }
      let s = /^:\w+$/,
        h = e => "*" === e;
      function f(e, t, n) {
        let a,
          l = "string" == typeof e ? (0, r.cP)(e) : e,
          i = "" === e || "" === l.pathname ? "/" : l.pathname;
        if (null == i) a = n;
        else {
          let e = t.length - 1;
          if (i.startsWith("..")) {
            let t = i.split("/");
            for (; ".." === t[0]; ) t.shift(), (e -= 1);
            l.pathname = t.join("/");
          }
          a = e >= 0 ? t[e] : "/";
        }
        let u = (function (e, t) {
          var n;
          let a;
          void 0 === t && (t = "/");
          let { pathname: l, search: i = "", hash: u = "" } = "string" == typeof e ? (0, r.cP)(e) : e;
          return {
            pathname: l
              ? l.startsWith("/")
                ? l
                : ((n = l),
                  (a = t.replace(/\/+$/, "").split("/")),
                  n.split("/").forEach(e => {
                    ".." === e ? a.length > 1 && a.pop() : "." !== e && a.push(e);
                  }),
                  a.length > 1 ? a.join("/") : "/")
              : t,
            search: m(i),
            hash: g(u)
          };
        })(l, a);
        return i && "/" !== i && i.endsWith("/") && !u.pathname.endsWith("/") && (u.pathname += "/"), u;
      }
      function p(e, t) {
        if ("/" === t) return e;
        if (!e.toLowerCase().startsWith(t.toLowerCase())) return null;
        let n = e.charAt(t.length);
        return n && "/" !== n ? null : e.slice(t.length) || "/";
      }
      let d = e => e.join("/").replace(/\/\/+/g, "/"),
        v = e => e.replace(/\/+$/, "").replace(/^\/*/, "/"),
        m = e => (e && "?" !== e ? (e.startsWith("?") ? e : "?" + e) : ""),
        g = e => (e && "#" !== e ? (e.startsWith("#") ? e : "#" + e) : "");
      function y(e) {
        b() || o(!1);
        let { basename: t, navigator: n } = (0, a.useContext)(l),
          { hash: i, pathname: u, search: c } = w(e),
          s = u;
        if ("/" !== t) {
          let n = "" === e || "" === e.pathname ? "/" : "string" == typeof e ? (0, r.cP)(e).pathname : e.pathname,
            a = null != n && n.endsWith("/");
          s = "/" === u ? t + (a ? "/" : "") : d([t, u]);
        }
        return n.createHref({ pathname: s, search: c, hash: i });
      }
      function b() {
        return null != (0, a.useContext)(i);
      }
      function P() {
        return b() || o(!1), (0, a.useContext)(i).location;
      }
      function E() {
        return (0, a.useContext)(i).navigationType;
      }
      function x() {
        b() || o(!1);
        let { basename: e, navigator: t } = (0, a.useContext)(l),
          { matches: n } = (0, a.useContext)(u),
          { pathname: r } = P(),
          i = JSON.stringify(n.map(e => e.pathnameBase)),
          c = (0, a.useRef)(!1);
        return (
          (0, a.useEffect)(() => {
            c.current = !0;
          }),
          (0, a.useCallback)(
            function (n, a) {
              if ((void 0 === a && (a = {}), !c.current)) return;
              if ("number" == typeof n) {
                t.go(n);
                return;
              }
              let l = f(n, JSON.parse(i), r);
              "/" !== e && (l.pathname = d([e, l.pathname])), (a.replace ? t.replace : t.push)(l, a.state);
            },
            [e, t, i, r]
          )
        );
      }
      function w(e) {
        let { matches: t } = (0, a.useContext)(u),
          { pathname: n } = P(),
          r = JSON.stringify(t.map(e => e.pathnameBase));
        return (0, a.useMemo)(() => f(e, JSON.parse(r), n), [e, r, n]);
      }
      function C(e) {
        let { to: t, replace: n, state: r } = e;
        b() || o(!1);
        let l = x();
        return (
          (0, a.useEffect)(() => {
            l(t, { replace: n, state: r });
          }),
          null
        );
      }
      function S(e) {
        o(!1);
      }
      function k(e) {
        let { basename: t = "/", children: n = null, location: u, navigationType: c = r.aU.Pop, navigator: s, static: h = !1 } = e;
        b() && o(!1);
        let f = v(t),
          d = (0, a.useMemo)(() => ({ basename: f, navigator: s, static: h }), [f, s, h]);
        "string" == typeof u && (u = (0, r.cP)(u));
        let { pathname: m = "/", search: g = "", hash: y = "", state: P = null, key: E = "default" } = u,
          x = (0, a.useMemo)(() => {
            let e = p(m, f);
            return null == e ? null : { pathname: e, search: g, hash: y, state: P, key: E };
          }, [f, m, g, y, P, E]);
        return null == x
          ? null
          : (0, a.createElement)(l.Provider, { value: d }, (0, a.createElement)(i.Provider, { children: n, value: { location: x, navigationType: c } }));
      }
      function O(e) {
        let { children: t, location: n } = e;
        return (function (e, t) {
          var n, l, i;
          let s;
          b() || o(!1);
          let { matches: h } = (0, a.useContext)(u),
            f = h[h.length - 1],
            p = f ? f.params : {};
          f && f.pathname;
          let v = f ? f.pathnameBase : "/";
          f && f.route;
          let m = P();
          if (t) {
            let e = "string" == typeof t ? (0, r.cP)(t) : t;
            "/" === v || (null == (n = e.pathname) ? void 0 : n.startsWith(v)) || o(!1), (s = e);
          } else s = m;
          let g = s.pathname || "/",
            y = c(e, { pathname: "/" === v ? g : g.slice(v.length) || "/" });
          return (
            (l =
              y &&
              y.map(e =>
                Object.assign({}, e, {
                  params: Object.assign({}, p, e.params),
                  pathname: d([v, e.pathname]),
                  pathnameBase: "/" === e.pathnameBase ? v : d([v, e.pathnameBase])
                })
              )),
            (void 0 === (i = h) && (i = []), null == l)
              ? null
              : l.reduceRight(
                  (e, t, n) =>
                    (0, a.createElement)(u.Provider, {
                      children: void 0 !== t.route.element ? t.route.element : e,
                      value: { outlet: e, matches: i.concat(l.slice(0, n + 1)) }
                    }),
                  null
                )
          );
        })(_(t), n);
      }
      function _(e) {
        let t = [];
        return (
          a.Children.forEach(e, e => {
            if (!(0, a.isValidElement)(e)) return;
            if (e.type === a.Fragment) {
              t.push.apply(t, _(e.props.children));
              return;
            }
            e.type !== S && o(!1);
            let n = { caseSensitive: e.props.caseSensitive, element: e.props.element, index: e.props.index, path: e.props.path };
            e.props.children && (n.children = _(e.props.children)), t.push(n);
          }),
          t
        );
      }
    }
  }
]);
//# sourceMappingURL=lib-router.js.map
