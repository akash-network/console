!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "d0fe7bba-127a-4555-a322-9a5cff5e17cc"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-d0fe7bba-127a-4555-a322-9a5cff5e17cc"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.22.9" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["1009"],
  {
    59145: function (e, t, n) {
      let o;
      n.d(t, { L: () => te, i_: () => tt });
      for (
        var a,
          i,
          s,
          c,
          l,
          u,
          d,
          h,
          f,
          p,
          m,
          w,
          v,
          y,
          g,
          O,
          N,
          b,
          E,
          x,
          _,
          A,
          D,
          S,
          j,
          T,
          C,
          U,
          k = n(82615),
          F = n(34406),
          I = Object.defineProperty,
          L = (e, t, n) => ((t in e) ? I(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : (e[t] = n)),
          q = (e, t, n) => (L(e, "symbol" != typeof t ? t + "" : t, n), n),
          R = "qpzry9x8gf2tvdw0s3jn54khce6mua7l",
          P = {},
          H = 0;
        H < R.length;
        H++
      ) {
        var M = R.charAt(H);
        if (void 0 !== P[M]) throw TypeError(M + " is ambiguous");
        P[M] = H;
      }
      function z(e) {
        var t = e >> 25;
        return (
          ((0x1ffffff & e) << 5) ^
          (0x3b6a57b2 & -((t >> 0) & 1)) ^
          (0x26508e6d & -((t >> 1) & 1)) ^
          (0x1ea119fa & -((t >> 2) & 1)) ^
          (0x3d4233dd & -((t >> 3) & 1)) ^
          (0x2a1462b3 & -((t >> 4) & 1))
        );
      }
      function V(e) {
        for (var t = 1, n = 0; n < e.length; ++n) {
          var o = e.charCodeAt(n);
          if (o < 33 || o > 126) return "Invalid prefix (" + e + ")";
          t = z(t) ^ (o >> 5);
        }
        for (t = z(t), n = 0; n < e.length; ++n) {
          var a = e.charCodeAt(n);
          t = z(t) ^ (31 & a);
        }
        return t;
      }
      function B(e, t) {
        if (((t = t || 90), e.length < 8)) return e + " too short";
        if (e.length > t) return "Exceeds length limit";
        var n = e.toLowerCase(),
          o = e.toUpperCase();
        if (e !== n && e !== o) return "Mixed-case string " + e;
        var a = (e = n).lastIndexOf("1");
        if (-1 === a) return "No separator character for " + e;
        if (0 === a) return "Missing prefix for " + e;
        var i = e.slice(0, a),
          s = e.slice(a + 1);
        if (s.length < 6) return "Data too short";
        var c = V(i);
        if ("string" == typeof c) return c;
        for (var l = [], u = 0; u < s.length; ++u) {
          var d = s.charAt(u),
            h = P[d];
          if (void 0 === h) return "Unknown character " + d;
          (c = z(c) ^ h), u + 6 >= s.length || l.push(h);
        }
        return 1 !== c ? "Invalid checksum for " + e : { prefix: i, words: l };
      }
      var Z = {
          decode: function (e) {
            var t = B.apply(null, arguments);
            if ("object" == typeof t) return t;
            throw Error(t);
          },
          encode: function (e, t, n) {
            if (((n = n || 90), e.length + 7 + t.length > n)) throw TypeError("Exceeds length limit");
            var o = V((e = e.toLowerCase()));
            if ("string" == typeof o) throw Error(o);
            for (var a = e + "1", i = 0; i < t.length; ++i) {
              var s = t[i];
              if (s >> 5) throw Error("Non 5-bit word");
              (o = z(o) ^ s), (a += R.charAt(s));
            }
            for (i = 0; i < 6; ++i) o = z(o);
            for (o ^= 1, i = 0; i < 6; ++i) {
              var c = (o >> ((5 - i) * 5)) & 31;
              a += R.charAt(c);
            }
            return a;
          },
          fromWords: function (e) {
            var t = (function (e, t, n, o) {
              for (var a = 0, i = 0, s = 255, c = [], l = 0; l < e.length; ++l) for (a = (a << 5) | e[l], i += t; i >= n; ) c.push((a >> (i -= n)) & s);
              if (o) i > 0 && c.push((a << (n - i)) & s);
              else {
                if (i >= t) return "Excess padding";
                if ((a << (n - i)) & s) return "Non-zero padding";
              }
              return c;
            })(e, 5, 8, !1);
            if (Array.isArray(t)) return t;
            throw Error(t);
          }
        },
        W =
          (((o = W || {}).NETWORK = "network"),
          (o.NOT_FOUND = "not-found"),
          (o.UNREGISTERED_SERVICE = "unregistered-service"),
          (o.DUPLICATE_SERVICE = "duplicate-service"),
          (o.INVALID_ADDRESS = "invalid-address"),
          (o.UNAVAILABLE_METHOD = "invalid-address"),
          (o.INVALID_ECOSYSTEM = "invalid-ecosystem"),
          o);
      class $ extends Error {
        constructor(e, t) {
          super(e), q(this, "type"), (this.name = "MatchaError"), (this.type = t);
        }
      }
      let J = class {};
      q(J, "clients", {}),
        q(J, "getClient", async e => {
          let t = J.clients[e];
          return void 0 === t && ((t = await k.CosmWasmClient.connect(e)), (J.clients[e] = t)), t;
        });
      class X {
        getCosmWasmClient(e) {
          return J.getClient(e);
        }
      }
      let G = { mainnet: "https://rpc.cosmos.directory/osmosis", testnet: "https://rpc-test.osmosis.zone" },
        K = "icns";
      class Y extends X {
        constructor() {
          super(...arguments),
            q(this, "serviceID", K),
            q(this, "chain", "osmosis"),
            q(this, "contractAddress", {
              mainnet: "osmo1xk0s8xgktn9x5vwcgtjdxqzadg88fgn33p8u9cnpdxwemvxscvast52cdd",
              testnet: "osmo1q2qpencrnnlamwalxt6tac2ytl35z5jejn0v4frnp6jff7gwp37sjcnhu5"
            });
        }
        async resolve(e, t, n) {
          var o, a, i, s;
          let c = await this.getCosmWasmClient((null == (a = null == (o = null == n ? void 0 : n.rpcUrls) ? void 0 : o[K]) ? void 0 : a[t]) ?? G[t]),
            [l, u] = e.split(".");
          try {
            let e = await (null == c ? void 0 : c.queryContractSmart(this.contractAddress[t], { address: { name: l, bech32_prefix: u } }));
            if (
              !(null != e && e.address) ||
              (null == (s = null == (i = null == n ? void 0 : n.allowedTopLevelDomains) ? void 0 : i.icns) ? void 0 : s.indexOf(u)) === -1
            )
              throw new $("", W.NOT_FOUND);
            return e.address;
          } catch {
            throw new $("", W.NOT_FOUND);
          }
        }
        async lookup(e, t, n) {
          var o, a;
          let i = await this.getCosmWasmClient((null == (a = null == (o = null == n ? void 0 : n.rpcUrls) ? void 0 : o[K]) ? void 0 : a[t]) ?? G[t]),
            s = { prefix: null, words: null };
          try {
            let { prefix: t, words: n } = Z.decode(e);
            (s.prefix = t), (s.words = n);
          } catch {
            throw new $("", W.INVALID_ADDRESS);
          }
          try {
            let n = await (null == i ? void 0 : i.queryContractSmart(this.contractAddress[t], { primary_name: { address: e } }));
            if (!(null != n && n.name)) throw new $("", W.NOT_FOUND);
            return `${n.name}.${s.prefix}`;
          } catch {
            throw new $("", W.NOT_FOUND);
          }
        }
      }
      let Q = { mainnet: "https://rpc.cosmos.directory/juno", testnet: "https://rpc.uni.kingnodes.com" },
        ee = "ibcDomains";
      class et extends X {
        constructor() {
          super(...arguments),
            q(this, "serviceID", ee),
            q(this, "chain", "juno"),
            q(this, "contractAddress", {
              mainnet: "juno1ce7wjfsuk79t2mdvpdjtv8280pcc64yh9mh62qptuvxe64twt4pqa68z2a",
              testnet: "juno19al2ptpxz3xk6q8nl3eyvyslkz8g6nz25w48dfpaepwaxavq3mhqsjjqe5"
            });
        }
        async resolve(e, t, n) {
          var o, a, i, s;
          let c = await this.getCosmWasmClient((null == (a = null == (o = null == n ? void 0 : n.rpcUrls) ? void 0 : o[ee]) ? void 0 : a[t]) ?? Q[t]),
            [l, u] = e.split(".");
          try {
            let e = await (null == c ? void 0 : c.queryContractSmart(this.contractAddress[t], { owner_of: { token_id: l } }));
            if (
              !(null != e && e.owner) ||
              (null == (s = null == (i = null == n ? void 0 : n.allowedTopLevelDomains) ? void 0 : i.ibcDomains) ? void 0 : s.indexOf(u)) === -1
            )
              throw new $("", W.NOT_FOUND);
            try {
              let { words: t } = Z.decode(e.owner);
              return Z.encode(u, t);
            } catch {
              throw new $("", W.NOT_FOUND);
            }
          } catch {
            throw new $("", W.NOT_FOUND);
          }
        }
        async lookup(e, t, n) {
          var o, a;
          let i = await this.getCosmWasmClient((null == (a = null == (o = null == n ? void 0 : n.rpcUrls) ? void 0 : o[ee]) ? void 0 : a[t]) ?? Q[t]),
            s = { prefix: null, words: null };
          try {
            let { prefix: t, words: n } = Z.decode(e);
            (s.prefix = t), (s.words = n);
          } catch {
            throw new $("", W.INVALID_ADDRESS);
          }
          let c = Z.encode("juno", s.words);
          try {
            let e = await (null == i ? void 0 : i.queryContractSmart(this.contractAddress[t], { primary_domain: { address: c } }));
            if (!(null != e && e.domain)) throw new $("", W.NOT_FOUND);
            return `${e.domain}.${s.prefix}`;
          } catch {
            throw new $("", W.NOT_FOUND);
          }
        }
      }
      let er = { mainnet: "https://rpc.cosmos.directory/stargaze", testnet: "https://rpc.elgafar-1.stargaze-apis.com" },
        en = "stargazeNames";
      class eo extends X {
        constructor() {
          super(...arguments),
            q(this, "serviceID", en),
            q(this, "chain", "stargaze"),
            q(this, "contractAddress", {
              mainnet: "stars1fx74nkqkw2748av8j7ew7r3xt9cgjqduwn8m0ur5lhe49uhlsasszc5fhr",
              testnet: "stars1rp5ttjvd5g0vlpltrkyvq62tcrdz949gjtpah000ynh4n2laz52qarz2z8"
            });
        }
        async resolve(e, t, n) {
          var o, a, i, s;
          let c = await this.getCosmWasmClient((null == (a = null == (o = null == n ? void 0 : n.rpcUrls) ? void 0 : o[en]) ? void 0 : a[t]) ?? er[t]),
            [l, u] = e.split(".");
          try {
            let e = await c.queryContractSmart(this.contractAddress[t], { associated_address: { name: l } });
            if (!e || (null == (s = null == (i = null == n ? void 0 : n.allowedTopLevelDomains) ? void 0 : i.stargazeNames) ? void 0 : s.indexOf(u)) === -1)
              throw new $("", W.NOT_FOUND);
            try {
              let { words: t } = Z.decode(e);
              return Z.encode(u, t);
            } catch {
              throw new $("", W.NOT_FOUND);
            }
          } catch {
            throw new $("", W.NOT_FOUND);
          }
        }
        async lookup(e, t, n) {
          var o, a;
          let i = await this.getCosmWasmClient((null == (a = null == (o = null == n ? void 0 : n.rpcUrls) ? void 0 : o[en]) ? void 0 : a[t]) ?? er[t]),
            s = { prefix: null, words: null };
          try {
            let { prefix: t, words: n } = Z.decode(e);
            (s.prefix = t), (s.words = n);
          } catch {
            throw new $("", W.INVALID_ADDRESS);
          }
          try {
            return `${await i.queryContractSmart(this.contractAddress[t], { name: { address: e } })}.${s.prefix}`;
          } catch {
            throw new $("", W.NOT_FOUND);
          }
        }
      }
      let ea = { mainnet: "https://rpc.mainnet.archway.io", testnet: "https://rpc.constantine.archway.tech" },
        ei = "archIds";
      class es extends X {
        constructor() {
          super(...arguments),
            q(this, "serviceID", ei),
            q(this, "chain", "archway"),
            q(this, "contractAddress", {
              mainnet: "archway1275jwjpktae4y4y0cdq274a2m0jnpekhttnfuljm6n59wnpyd62qppqxq0",
              testnet: "archway1lr8rstt40s697hqpedv2nvt27f4cuccqwvly9gnvuszxmcevrlns60xw4r"
            });
        }
        async resolve(e, t, n) {
          var o, a, i, s;
          let c = await this.getCosmWasmClient((null == (a = null == (o = null == n ? void 0 : n.rpcUrls) ? void 0 : o[ei]) ? void 0 : a[t]) ?? ea[t]),
            [, l] = e.split(".");
          try {
            let o = await (null == c ? void 0 : c.queryContractSmart(this.contractAddress[t], { resolve_record: { name: e } }));
            if (
              !(null != o && o.address) ||
              (null == (s = null == (i = null == n ? void 0 : n.allowedTopLevelDomains) ? void 0 : i.archIds) ? void 0 : s.indexOf(l)) === -1
            )
              throw new $("", W.NOT_FOUND);
            return o.address;
          } catch {
            throw new $("", W.NOT_FOUND);
          }
        }
        async lookup(e, t, n) {
          var o, a, i;
          let s = await this.getCosmWasmClient((null == (a = null == (o = null == n ? void 0 : n.rpcUrls) ? void 0 : o[ei]) ? void 0 : a[t]) ?? ea[t]),
            c = { prefix: null, words: null };
          try {
            let { prefix: t, words: n } = Z.decode(e);
            (c.prefix = t), (c.words = n);
          } catch {
            throw new $("", W.INVALID_ADDRESS);
          }
          try {
            let n = await (null == s ? void 0 : s.queryContractSmart(this.contractAddress[t], { resolve_address: { address: e } }));
            if (!(null != n && n.names) || !(null != (i = null == n ? void 0 : n.names) && i.length)) throw new $("", W.NOT_FOUND);
            return n.names.join(", ");
          } catch {
            throw new $("", W.NOT_FOUND);
          }
        }
      }
      var ec = {},
        el = {},
        eu = function (e, t) {
          return function () {
            for (var n = Array(arguments.length), o = 0; o < n.length; o++) n[o] = arguments[o];
            return e.apply(t, n);
          };
        },
        ed = Object.prototype.toString;
      function eh(e) {
        return "[object Array]" === ed.call(e);
      }
      function ef(e) {
        return typeof e > "u";
      }
      function ep(e) {
        return null !== e && "object" == typeof e;
      }
      function em(e) {
        if ("[object Object]" !== ed.call(e)) return !1;
        var t = Object.getPrototypeOf(e);
        return null === t || t === Object.prototype;
      }
      function ew(e) {
        return "[object Function]" === ed.call(e);
      }
      function ev(e, t) {
        if (!(null === e || typeof e > "u")) {
          if (("object" != typeof e && (e = [e]), eh(e))) for (var n = 0, o = e.length; n < o; n++) t.call(null, e[n], n, e);
          else for (var a in e) Object.prototype.hasOwnProperty.call(e, a) && t.call(null, e[a], a, e);
        }
      }
      var ey = {
        isArray: eh,
        isArrayBuffer: function (e) {
          return "[object ArrayBuffer]" === ed.call(e);
        },
        isBuffer: function (e) {
          return (
            null !== e && !ef(e) && null !== e.constructor && !ef(e.constructor) && "function" == typeof e.constructor.isBuffer && e.constructor.isBuffer(e)
          );
        },
        isFormData: function (e) {
          return "u" > typeof FormData && e instanceof FormData;
        },
        isArrayBufferView: function (e) {
          return "u" > typeof ArrayBuffer && ArrayBuffer.isView ? ArrayBuffer.isView(e) : e && e.buffer && e.buffer instanceof ArrayBuffer;
        },
        isString: function (e) {
          return "string" == typeof e;
        },
        isNumber: function (e) {
          return "number" == typeof e;
        },
        isObject: ep,
        isPlainObject: em,
        isUndefined: ef,
        isDate: function (e) {
          return "[object Date]" === ed.call(e);
        },
        isFile: function (e) {
          return "[object File]" === ed.call(e);
        },
        isBlob: function (e) {
          return "[object Blob]" === ed.call(e);
        },
        isStream: function (e) {
          return ep(e) && ew(e.pipe);
        },
        isURLSearchParams: function (e) {
          return "u" > typeof URLSearchParams && e instanceof URLSearchParams;
        },
        isStandardBrowserEnv: function () {
          return (
            (!("u" > typeof navigator) || ("ReactNative" !== navigator.product && "NativeScript" !== navigator.product && "NS" !== navigator.product)) &&
            "u" > typeof window &&
            "u" > typeof document
          );
        },
        forEach: ev,
        merge: function e() {
          var t = {};
          function n(n, o) {
            em(t[o]) && em(n) ? (t[o] = e(t[o], n)) : em(n) ? (t[o] = e({}, n)) : eh(n) ? (t[o] = n.slice()) : (t[o] = n);
          }
          for (var o = 0, a = arguments.length; o < a; o++) ev(arguments[o], n);
          return t;
        },
        extend: function (e, t, n) {
          return (
            ev(t, function (t, o) {
              n && "function" == typeof t ? (e[o] = eu(t, n)) : (e[o] = t);
            }),
            e
          );
        },
        trim: function (e) {
          return e.trim ? e.trim() : e.replace(/^\s+|\s+$/g, "");
        }
      };
      function eg(e) {
        return encodeURIComponent(e)
          .replace(/%3A/gi, ":")
          .replace(/%24/g, "$")
          .replace(/%2C/gi, ",")
          .replace(/%20/g, "+")
          .replace(/%5B/gi, "[")
          .replace(/%5D/gi, "]");
      }
      var eO = function (e, t, n) {
        if (!t) return e;
        if (n) o = n(t);
        else if (ey.isURLSearchParams(t)) o = t.toString();
        else {
          var o,
            a = [];
          ey.forEach(t, function (e, t) {
            null === e ||
              typeof e > "u" ||
              (ey.isArray(e) ? (t += "[]") : (e = [e]),
              ey.forEach(e, function (e) {
                ey.isDate(e) ? (e = e.toISOString()) : ey.isObject(e) && (e = JSON.stringify(e)), a.push(eg(t) + "=" + eg(e));
              }));
          }),
            (o = a.join("&"));
        }
        if (o) {
          var i = e.indexOf("#");
          -1 !== i && (e = e.slice(0, i)), (e += (-1 === e.indexOf("?") ? "?" : "&") + o);
        }
        return e;
      };
      function eN() {
        this.handlers = [];
      }
      (eN.prototype.use = function (e, t, n) {
        return this.handlers.push({ fulfilled: e, rejected: t, synchronous: !!n && n.synchronous, runWhen: n ? n.runWhen : null }), this.handlers.length - 1;
      }),
        (eN.prototype.eject = function (e) {
          this.handlers[e] && (this.handlers[e] = null);
        }),
        (eN.prototype.forEach = function (e) {
          ey.forEach(this.handlers, function (t) {
            null !== t && e(t);
          });
        });
      var eb,
        eE,
        ex = function (e, t, n, o, a) {
          return (
            (e.config = t),
            n && (e.code = n),
            (e.request = o),
            (e.response = a),
            (e.isAxiosError = !0),
            (e.toJSON = function () {
              return {
                message: this.message,
                name: this.name,
                description: this.description,
                number: this.number,
                fileName: this.fileName,
                lineNumber: this.lineNumber,
                columnNumber: this.columnNumber,
                stack: this.stack,
                config: this.config,
                code: this.code
              };
            }),
            e
          );
        };
      function e_() {
        return eE
          ? eb
          : ((eE = 1),
            (eb = function (e, t, n, o, a) {
              return ex(Error(e), t, n, o, a);
            }));
      }
      var eA = function (e, t) {
          ey.forEach(e, function (n, o) {
            o !== t && o.toUpperCase() === t.toUpperCase() && ((e[t] = n), delete e[o]);
          });
        },
        eD = { "Content-Type": "application/x-www-form-urlencoded" };
      function eS(e, t) {
        !ey.isUndefined(e) && ey.isUndefined(e["Content-Type"]) && (e["Content-Type"] = t);
      }
      var ej = {
        transitional: { silentJSONParsing: !0, forcedJSONParsing: !0, clarifyTimeoutError: !1 },
        adapter:
          (("u" > typeof XMLHttpRequest || ("u" > typeof F && "[object process]" === Object.prototype.toString.call(F))) &&
            (a = (function () {
              if (N) return O;
              N = 1;
              var e = (function () {
                  if (s) return i;
                  s = 1;
                  var e = e_();
                  return (i = function (t, n, o) {
                    var a = o.config.validateStatus;
                    !o.status || !a || a(o.status) ? t(o) : n(e("Request failed with status code " + o.status, o.config, null, o.request, o));
                  });
                })(),
                t = l
                  ? c
                  : ((l = 1),
                    (c = ey.isStandardBrowserEnv()
                      ? {
                          write: function (e, t, n, o, a, i) {
                            var s = [];
                            s.push(e + "=" + encodeURIComponent(t)),
                              ey.isNumber(n) && s.push("expires=" + new Date(n).toGMTString()),
                              ey.isString(o) && s.push("path=" + o),
                              ey.isString(a) && s.push("domain=" + a),
                              !0 === i && s.push("secure"),
                              (document.cookie = s.join("; "));
                          },
                          read: function (e) {
                            var t = document.cookie.match(RegExp("(^|;\\s*)(" + e + ")=([^;]*)"));
                            return t ? decodeURIComponent(t[3]) : null;
                          },
                          remove: function (e) {
                            this.write(e, "", Date.now() - 864e5);
                          }
                        }
                      : {
                          write: function () {},
                          read: function () {
                            return null;
                          },
                          remove: function () {}
                        })),
                n = (function () {
                  if (m) return p;
                  m = 1;
                  var e =
                      (d ||
                        ((d = 1),
                        (u = function (e) {
                          return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(e);
                        })),
                      u),
                    t =
                      (f ||
                        ((f = 1),
                        (h = function (e, t) {
                          return t ? e.replace(/\/+$/, "") + "/" + t.replace(/^\/+/, "") : e;
                        })),
                      h);
                  return (p = function (n, o) {
                    return n && !e(o) ? t(n, o) : o;
                  });
                })(),
                o = (function () {
                  if (v) return w;
                  v = 1;
                  var e = [
                    "age",
                    "authorization",
                    "content-length",
                    "content-type",
                    "etag",
                    "expires",
                    "from",
                    "host",
                    "if-modified-since",
                    "if-unmodified-since",
                    "last-modified",
                    "location",
                    "max-forwards",
                    "proxy-authorization",
                    "referer",
                    "retry-after",
                    "user-agent"
                  ];
                  return (w = function (t) {
                    var n,
                      o,
                      a,
                      i = {};
                    return (
                      t &&
                        ey.forEach(
                          t.split(`
`),
                          function (t) {
                            (a = t.indexOf(":")),
                              (n = ey.trim(t.substr(0, a)).toLowerCase()),
                              (o = ey.trim(t.substr(a + 1))),
                              n &&
                                !(i[n] && e.indexOf(n) >= 0) &&
                                ("set-cookie" === n ? (i[n] = (i[n] ? i[n] : []).concat([o])) : (i[n] = i[n] ? i[n] + ", " + o : o));
                          }
                        ),
                      i
                    );
                  });
                })(),
                a = g
                  ? y
                  : ((g = 1),
                    (y = ey.isStandardBrowserEnv()
                      ? (function () {
                          var e,
                            t = /(msie|trident)/i.test(navigator.userAgent),
                            n = document.createElement("a");
                          function o(e) {
                            var o = e;
                            return (
                              t && (n.setAttribute("href", o), (o = n.href)),
                              n.setAttribute("href", o),
                              {
                                href: n.href,
                                protocol: n.protocol ? n.protocol.replace(/:$/, "") : "",
                                host: n.host,
                                search: n.search ? n.search.replace(/^\?/, "") : "",
                                hash: n.hash ? n.hash.replace(/^#/, "") : "",
                                hostname: n.hostname,
                                port: n.port,
                                pathname: "/" === n.pathname.charAt(0) ? n.pathname : "/" + n.pathname
                              }
                            );
                          }
                          return (
                            (e = o(window.location.href)),
                            function (t) {
                              var n = ey.isString(t) ? o(t) : t;
                              return n.protocol === e.protocol && n.host === e.host;
                            }
                          );
                        })()
                      : function () {
                          return !0;
                        })),
                b = e_();
              return (O = function (i) {
                return new Promise(function (s, c) {
                  var l = i.data,
                    u = i.headers,
                    d = i.responseType;
                  ey.isFormData(l) && delete u["Content-Type"];
                  var h = new XMLHttpRequest();
                  if (i.auth) {
                    var f = i.auth.username || "",
                      p = i.auth.password ? unescape(encodeURIComponent(i.auth.password)) : "";
                    u.Authorization = "Basic " + btoa(f + ":" + p);
                  }
                  var m = n(i.baseURL, i.url);
                  function w() {
                    if (h) {
                      var t = "getAllResponseHeaders" in h ? o(h.getAllResponseHeaders()) : null;
                      e(s, c, {
                        data: d && "text" !== d && "json" !== d ? h.response : h.responseText,
                        status: h.status,
                        statusText: h.statusText,
                        headers: t,
                        config: i,
                        request: h
                      }),
                        (h = null);
                    }
                  }
                  if (
                    (h.open(i.method.toUpperCase(), eO(m, i.params, i.paramsSerializer), !0),
                    (h.timeout = i.timeout),
                    "onloadend" in h
                      ? (h.onloadend = w)
                      : (h.onreadystatechange = function () {
                          h && 4 === h.readyState && (0 !== h.status || (h.responseURL && 0 === h.responseURL.indexOf("file:"))) && setTimeout(w);
                        }),
                    (h.onabort = function () {
                      h && (c(b("Request aborted", i, "ECONNABORTED", h)), (h = null));
                    }),
                    (h.onerror = function () {
                      c(b("Network Error", i, null, h)), (h = null);
                    }),
                    (h.ontimeout = function () {
                      var e = "timeout of " + i.timeout + "ms exceeded";
                      i.timeoutErrorMessage && (e = i.timeoutErrorMessage),
                        c(b(e, i, i.transitional && i.transitional.clarifyTimeoutError ? "ETIMEDOUT" : "ECONNABORTED", h)),
                        (h = null);
                    }),
                    ey.isStandardBrowserEnv())
                  ) {
                    var v = (i.withCredentials || a(m)) && i.xsrfCookieName ? t.read(i.xsrfCookieName) : void 0;
                    v && (u[i.xsrfHeaderName] = v);
                  }
                  "setRequestHeader" in h &&
                    ey.forEach(u, function (e, t) {
                      typeof l > "u" && "content-type" === t.toLowerCase() ? delete u[t] : h.setRequestHeader(t, e);
                    }),
                    ey.isUndefined(i.withCredentials) || (h.withCredentials = !!i.withCredentials),
                    d && "json" !== d && (h.responseType = i.responseType),
                    "function" == typeof i.onDownloadProgress && h.addEventListener("progress", i.onDownloadProgress),
                    "function" == typeof i.onUploadProgress && h.upload && h.upload.addEventListener("progress", i.onUploadProgress),
                    i.cancelToken &&
                      i.cancelToken.promise.then(function (e) {
                        h && (h.abort(), c(e), (h = null));
                      }),
                    l || (l = null),
                    h.send(l);
                });
              });
            })()),
          a),
        transformRequest: [
          function (e, t) {
            return (
              eA(t, "Accept"),
              eA(t, "Content-Type"),
              ey.isFormData(e) || ey.isArrayBuffer(e) || ey.isBuffer(e) || ey.isStream(e) || ey.isFile(e) || ey.isBlob(e)
                ? e
                : ey.isArrayBufferView(e)
                  ? e.buffer
                  : ey.isURLSearchParams(e)
                    ? (eS(t, "application/x-www-form-urlencoded;charset=utf-8"), e.toString())
                    : ey.isObject(e) || (t && "application/json" === t["Content-Type"])
                      ? (eS(t, "application/json"),
                        (function (e, t, n) {
                          if (ey.isString(e))
                            try {
                              return (0, JSON.parse)(e), ey.trim(e);
                            } catch (e) {
                              if ("SyntaxError" !== e.name) throw e;
                            }
                          return (0, JSON.stringify)(e);
                        })(e))
                      : e
            );
          }
        ],
        transformResponse: [
          function (e) {
            var t = this.transitional,
              n = t && t.silentJSONParsing,
              o = t && t.forcedJSONParsing,
              a = !n && "json" === this.responseType;
            if (a || (o && ey.isString(e) && e.length))
              try {
                return JSON.parse(e);
              } catch (e) {
                if (a) throw "SyntaxError" === e.name ? ex(e, this, "E_JSON_PARSE") : e;
              }
            return e;
          }
        ],
        timeout: 0,
        xsrfCookieName: "XSRF-TOKEN",
        xsrfHeaderName: "X-XSRF-TOKEN",
        maxContentLength: -1,
        maxBodyLength: -1,
        validateStatus: function (e) {
          return e >= 200 && e < 300;
        }
      };
      function eT() {
        return (
          E ||
            ((E = 1),
            (b = function (e) {
              return !!(e && e.__CANCEL__);
            })),
          b
        );
      }
      (ej.headers = { common: { Accept: "application/json, text/plain, */*" } }),
        ey.forEach(["delete", "get", "head"], function (e) {
          ej.headers[e] = {};
        }),
        ey.forEach(["post", "put", "patch"], function (e) {
          ej.headers[e] = ey.merge(eD);
        });
      var eC = function (e, t, n) {
          var o = this || ej;
          return (
            ey.forEach(n, function (n) {
              e = n.call(o, e, t);
            }),
            e
          );
        },
        eU = eT();
      function ek(e) {
        e.cancelToken && e.cancelToken.throwIfRequested();
      }
      var eF = function (e, t) {
          t = t || {};
          var n = {},
            o = ["url", "method", "data"],
            a = ["headers", "auth", "proxy", "params"],
            i = [
              "baseURL",
              "transformRequest",
              "transformResponse",
              "paramsSerializer",
              "timeout",
              "timeoutMessage",
              "withCredentials",
              "adapter",
              "responseType",
              "xsrfCookieName",
              "xsrfHeaderName",
              "onUploadProgress",
              "onDownloadProgress",
              "decompress",
              "maxContentLength",
              "maxBodyLength",
              "maxRedirects",
              "transport",
              "httpAgent",
              "httpsAgent",
              "cancelToken",
              "socketPath",
              "responseEncoding"
            ],
            s = ["validateStatus"];
          function c(e, t) {
            return ey.isPlainObject(e) && ey.isPlainObject(t) ? ey.merge(e, t) : ey.isPlainObject(t) ? ey.merge({}, t) : ey.isArray(t) ? t.slice() : t;
          }
          function l(o) {
            ey.isUndefined(t[o]) ? ey.isUndefined(e[o]) || (n[o] = c(void 0, e[o])) : (n[o] = c(e[o], t[o]));
          }
          ey.forEach(o, function (e) {
            ey.isUndefined(t[e]) || (n[e] = c(void 0, t[e]));
          }),
            ey.forEach(a, l),
            ey.forEach(i, function (o) {
              ey.isUndefined(t[o]) ? ey.isUndefined(e[o]) || (n[o] = c(void 0, e[o])) : (n[o] = c(void 0, t[o]));
            }),
            ey.forEach(s, function (o) {
              o in t ? (n[o] = c(e[o], t[o])) : o in e && (n[o] = c(void 0, e[o]));
            });
          var u = o.concat(a).concat(i).concat(s),
            d = Object.keys(e)
              .concat(Object.keys(t))
              .filter(function (e) {
                return -1 === u.indexOf(e);
              });
          return ey.forEach(d, l), n;
        },
        eI = "0.21.4",
        eL = {};
      ["object", "boolean", "number", "function", "string", "symbol"].forEach(function (e, t) {
        eL[e] = function (n) {
          return typeof n === e || "a" + (t < 1 ? "n " : " ") + e;
        };
      });
      var eq = {},
        eR = eI.split(".");
      eL.transitional = function (e, t, n) {
        var o =
          t &&
          (function (e, t) {
            for (var n = eR, o = e.split("."), a = 0; a < 3; a++) {
              if (n[a] > o[a]) return !0;
              if (n[a] < o[a]) break;
            }
            return !1;
          })(t);
        function a(e, t) {
          return "[Axios v" + eI + "] Transitional option '" + e + "'" + t + (n ? ". " + n : "");
        }
        return function (n, i, s) {
          if (!1 === e) throw Error(a(i, " has been removed in " + t));
          return (
            o && !eq[i] && ((eq[i] = !0), console.warn(a(i, " has been deprecated since v" + t + " and will be removed in the near future"))), !e || e(n, i, s)
          );
        };
      };
      var eP = function (e) {
          return (
            ek(e),
            (e.headers = e.headers || {}),
            (e.data = eC.call(e, e.data, e.headers, e.transformRequest)),
            (e.headers = ey.merge(e.headers.common || {}, e.headers[e.method] || {}, e.headers)),
            ey.forEach(["delete", "get", "head", "post", "put", "patch", "common"], function (t) {
              delete e.headers[t];
            }),
            (e.adapter || ej.adapter)(e).then(
              function (t) {
                return ek(e), (t.data = eC.call(e, t.data, t.headers, e.transformResponse)), t;
              },
              function (t) {
                return (
                  eU(t) || (ek(e), t && t.response && (t.response.data = eC.call(e, t.response.data, t.response.headers, e.transformResponse))),
                  Promise.reject(t)
                );
              }
            )
          );
        },
        eH = {
          assertOptions: function (e, t, n) {
            if ("object" != typeof e) throw TypeError("options must be an object");
            for (var o = Object.keys(e), a = o.length; a-- > 0; ) {
              var i = o[a],
                s = t[i];
              if (s) {
                var c = e[i],
                  l = void 0 === c || s(c, i, e);
                if (!0 !== l) throw TypeError("option " + i + " must be " + l);
                continue;
              }
              if (!0 !== n) throw Error("Unknown option " + i);
            }
          },
          validators: eL
        },
        eM = eH.validators;
      function ez(e) {
        (this.defaults = e), (this.interceptors = { request: new eN(), response: new eN() });
      }
      function eV() {
        if (_) return x;
        function e(e) {
          this.message = e;
        }
        return (
          (_ = 1),
          (e.prototype.toString = function () {
            return "Cancel" + (this.message ? ": " + this.message : "");
          }),
          (e.prototype.__CANCEL__ = !0),
          (x = e)
        );
      }
      function eB(e) {
        var t = new ez(e),
          n = eu(ez.prototype.request, t);
        return ey.extend(n, ez.prototype, t), ey.extend(n, t), n;
      }
      (ez.prototype.request = function (e) {
        "string" == typeof e ? ((e = arguments[1] || {}), (e.url = arguments[0])) : (e = e || {}),
          (e = eF(this.defaults, e)).method
            ? (e.method = e.method.toLowerCase())
            : this.defaults.method
              ? (e.method = this.defaults.method.toLowerCase())
              : (e.method = "get");
        var t,
          n = e.transitional;
        void 0 !== n &&
          eH.assertOptions(
            n,
            {
              silentJSONParsing: eM.transitional(eM.boolean, "1.0.0"),
              forcedJSONParsing: eM.transitional(eM.boolean, "1.0.0"),
              clarifyTimeoutError: eM.transitional(eM.boolean, "1.0.0")
            },
            !1
          );
        var o = [],
          a = !0;
        this.interceptors.request.forEach(function (t) {
          ("function" == typeof t.runWhen && !1 === t.runWhen(e)) || ((a = a && t.synchronous), o.unshift(t.fulfilled, t.rejected));
        });
        var i = [];
        if (
          (this.interceptors.response.forEach(function (e) {
            i.push(e.fulfilled, e.rejected);
          }),
          !a)
        ) {
          var s = [eP, void 0];
          for (Array.prototype.unshift.apply(s, o), s = s.concat(i), t = Promise.resolve(e); s.length; ) t = t.then(s.shift(), s.shift());
          return t;
        }
        for (var c = e; o.length; ) {
          var l = o.shift(),
            u = o.shift();
          try {
            c = l(c);
          } catch (e) {
            u(e);
            break;
          }
        }
        try {
          t = eP(c);
        } catch (e) {
          return Promise.reject(e);
        }
        for (; i.length; ) t = t.then(i.shift(), i.shift());
        return t;
      }),
        (ez.prototype.getUri = function (e) {
          return eO((e = eF(this.defaults, e)).url, e.params, e.paramsSerializer).replace(/^\?/, "");
        }),
        ey.forEach(["delete", "get", "head", "options"], function (e) {
          ez.prototype[e] = function (t, n) {
            return this.request(eF(n || {}, { method: e, url: t, data: (n || {}).data }));
          };
        }),
        ey.forEach(["post", "put", "patch"], function (e) {
          ez.prototype[e] = function (t, n, o) {
            return this.request(eF(o || {}, { method: e, url: t, data: n }));
          };
        });
      var eZ = eB(ej);
      (eZ.Axios = ez),
        (eZ.create = function (e) {
          return eB(eF(eZ.defaults, e));
        }),
        (eZ.Cancel = eV()),
        (eZ.CancelToken = (function () {
          if (S) return D;
          S = 1;
          var e = eV();
          function t(t) {
            if ("function" != typeof t) throw TypeError("executor must be a function.");
            this.promise = new Promise(function (e) {
              n = e;
            });
            var n,
              o = this;
            t(function (t) {
              o.reason || ((o.reason = new e(t)), n(o.reason));
            });
          }
          return (
            (t.prototype.throwIfRequested = function () {
              if (this.reason) throw this.reason;
            }),
            (t.source = function () {
              var e;
              return {
                token: new t(function (t) {
                  e = t;
                }),
                cancel: e
              };
            }),
            (D = t)
          );
        })()),
        (eZ.isCancel = eT()),
        (eZ.all = function (e) {
          return Promise.all(e);
        }),
        (eZ.spread =
          (T ||
            ((T = 1),
            (j = function (e) {
              return function (t) {
                return e.apply(null, t);
              };
            })),
          j)),
        (eZ.isAxiosError =
          (U ||
            ((U = 1),
            (C = function (e) {
              return "object" == typeof e && !0 === e.isAxiosError;
            })),
          C)),
        ({
          get exports() {
            return el;
          },
          set exports(r) {
            el = r;
          }
        }.exports = eZ),
        (el.default = eZ),
        ({
          get exports() {
            return ec;
          },
          set exports(r) {
            ec = r;
          }
        }.exports = el);
      let eW = (A = ec) && A.__esModule && Object.prototype.hasOwnProperty.call(A, "default") ? A.default : A,
        e$ = "https://nameapi.space.id";
      class eJ extends X {
        constructor() {
          super(...arguments),
            q(this, "serviceID", "spaceIds"),
            q(this, "chain", ["injective", "sei", "ethereum", "binance", "solana", "arbitrum", "manta", "lightlink", "story"]),
            q(this, "contractAddress", {});
        }
        async resolve(e, t, n) {
          var o, a;
          try {
            let t = e.includes("@") ? "@" : ".",
              [, i] = e.split(t);
            if ("@" === t) {
              if (!(null != n && n.paymentIdEcosystem)) throw new $("", W.INVALID_ECOSYSTEM);
              let t = await eW.get(`${e$}/getPaymentIdName/${e}/${n.paymentIdEcosystem}`);
              if (0 === t.data.code) return t.data.address;
              throw new $("", W.NOT_FOUND);
            }
            if ((null == (a = null == (o = null == n ? void 0 : n.allowedTopLevelDomains) ? void 0 : o.spaceIds) ? void 0 : a.indexOf(i)) === -1)
              throw new $("", W.NOT_FOUND);
            let s = await eW.get(`${e$}/getAddress?domain=${e}`);
            if (0 === s.data.code) return s.data.address;
            throw new $("", W.NOT_FOUND);
          } catch {
            throw new $("", W.NOT_FOUND);
          }
        }
        async lookup(e, t, n) {
          try {
            if (!(null != n && n.chainId)) throw new $("", W.NOT_FOUND);
            let t = await eW.get(`${e$}/getName?chainid=${n.chainId}&address=${e}`);
            if (0 === t.data.code) return t.data.data.name;
            throw new $("", W.NOT_FOUND);
          } catch {
            throw new $("", W.NOT_FOUND);
          }
        }
      }
      let eX = { mainnet: "https://injective-rpc.publicnode.com:443", testnet: "https://testnet.sentry.tm.injective.network:443" },
        eG = e => (e.endsWith(".sol") ? e.slice(0, -4) : e);
      class eK extends X {
        constructor() {
          super(...arguments),
            q(this, "serviceID", "sns"),
            q(this, "chain", "injective"),
            q(this, "contractAddress", { mainnet: "inj1v7chmgm7vmuwldjt80utmw9c95jkrch979ps8z", testnet: "inj1q79ujqyh72p43mhr2ldaly3x6d50rzp3354at3" });
        }
        async resolve(e, t) {
          let n = await this.getCosmWasmClient(eX[t]);
          try {
            let o = await n.queryContractSmart(this.contractAddress[t], { resolve: { domain_name: eG(e) } });
            if (!o) throw new $("", W.NOT_FOUND);
            return o;
          } catch {
            throw new $("", W.NOT_FOUND);
          }
        }
        async lookup(e, t) {
          var n, o;
          let a = await this.getCosmWasmClient(eX[t]);
          try {
            let i = Z.decode(e),
              s = Z.fromWords(i.words),
              c = [...Array(12).fill(0), ...s],
              l = await a.queryContractSmart(this.contractAddress[t], {
                get_domains_for_owner: { owner_chain: 19, owner_address: c, max_len: 1, domain_offset: void 0 }
              });
            if (!l) throw new $("", W.NOT_FOUND);
            let u = null == (o = null == (n = null == l ? void 0 : l.domains) ? void 0 : n.pop) ? void 0 : o.call(n);
            if (!u) throw new $("", W.NOT_FOUND);
            return u + ".sol";
          } catch {
            throw new $("", W.NOT_FOUND);
          }
        }
      }
      let eY = { mainnet: "https://full-node.mainnet-1.coreum.dev:26657", testnet: "https://full-node.testnet-1.coreum.dev:26657" };
      class eQ extends X {
        constructor() {
          super(...arguments),
            q(this, "serviceID", "bdd"),
            q(this, "chain", "coreum"),
            q(this, "contractAddress", {
              mainnet: "core1z22n0xy004sxm5w9fms48exwpl3vwqxd890nt8ve0kwjj048tgqstlqf6f",
              testnet: "testcore1uwe9yemth6gr58tm56sx3u37t0c5rhmk963fjt480y4nz3cfxers9fn2kh"
            });
        }
        async resolve(e, t) {
          let n = await this.getCosmWasmClient(eY[t]);
          try {
            let o = await n.queryContractSmart(this.contractAddress[t], { resolve: { name: e } });
            if (!o) throw new $("", W.NOT_FOUND);
            return o;
          } catch {
            throw new $("", W.NOT_FOUND);
          }
        }
        async lookup(e, t, n) {
          var o, a;
          let i = await this.getCosmWasmClient((null == (a = null == (o = null == n ? void 0 : n.rpcUrls) ? void 0 : o.bdd) ? void 0 : a[t]) ?? eY[t]),
            s = { prefix: null, words: null };
          try {
            let { prefix: t, words: n } = Z.decode(e);
            (s.prefix = t), (s.words = n);
          } catch {
            throw new $("", W.INVALID_ADDRESS);
          }
          let c = Z.encode("mainnet" === t ? "core" : "testcore", s.words);
          try {
            let e = await (null == i ? void 0 : i.queryContractSmart(this.contractAddress[t], { primary: { address: c } }));
            if (!e) throw new $("", W.NOT_FOUND);
            return e;
          } catch {
            throw new $("", W.NOT_FOUND);
          }
        }
      }
      let e0 = { mainnet: "https://rpc.nibiru.fi:443", testnet: "https://rpc.testnet-2.nibiru.fi:443" },
        e1 = e => (e.endsWith(".nibi") ? e.slice(0, -5) : e);
      class e2 extends X {
        constructor() {
          super(...arguments),
            q(this, "serviceID", "nibId"),
            q(this, "chain", "nibiru"),
            q(this, "contractAddress", { mainnet: "nibi1q0e70vhrv063eah90mu97sazhywmeegptx642t5px7yfcrf0rrsq2dylen", testnet: "" });
        }
        async resolve(e, t) {
          let n = await this.getCosmWasmClient(e0[t]);
          if ("" == this.contractAddress[t]) throw new $("", W.NOT_FOUND);
          try {
            let o = await n.queryContractSmart(this.contractAddress[t], { resolve_record: { name: e1(e) } });
            if ("" == o || null == o) throw new $("", W.NOT_FOUND);
            return null == o ? void 0 : o.address;
          } catch {
            throw new $("", W.NOT_FOUND);
          }
        }
        async lookup(e, t) {
          throw new $(`Lookup is unavailable for ${e} on ${t}`, W.UNAVAILABLE_METHOD);
        }
      }
      let e6 = { mainnet: "https://rpc.sei-apis.com:443" };
      class e4 extends X {
        constructor() {
          super(...arguments),
            q(this, "serviceID", "degeNS"),
            q(this, "chain", "sei"),
            q(this, "contractAddress", { mainnet: "sei10nulnfpdhx2wf7lp9kqa8aez2yxuyxwjyfw9rzlrexd500nhal0sl7mtzm", testnet: "" });
        }
        async resolve(e, t) {
          if ("testnet" === t) throw new $(`Resolve is unavailable for ${e} on ${t}`, W.UNAVAILABLE_METHOD);
          let n = await this.getCosmWasmClient(e6[t]);
          if ("" == this.contractAddress[t]) throw new $("", W.NOT_FOUND);
          try {
            let o = await n.queryContractSmart(this.contractAddress[t], { extension: { msg: { resolves_to: { domain_name: e } } } });
            if ("" == o || null == o) throw new $("", W.NOT_FOUND);
            return null == o ? void 0 : o.address;
          } catch {
            throw new $("", W.NOT_FOUND);
          }
        }
        async lookup(e, t) {
          if ("testnet" === t) throw new $(`Lookup is unavailable for ${e} on ${t}`, W.UNAVAILABLE_METHOD);
          let n = await this.getCosmWasmClient(e6[t]);
          if ("" == this.contractAddress[t]) throw new $("", W.NOT_FOUND);
          try {
            let o = await n.queryContractSmart(this.contractAddress[t], { extension: { msg: { primary_of: { owner: e } } } });
            if ("" == o || null == o) throw new $("", W.NOT_FOUND);
            return null == o ? void 0 : o.domain_name;
          } catch {
            throw new $("", W.NOT_FOUND);
          }
        }
      }
      let e8 = e => (e.startsWith("0x") ? parseInt(e, 16).toString() : e),
        e3 = { mainnet: "https://api.celestials.id", testnet: "https://api.stage.celestials.id" },
        e5 = "celestialsId";
      class e9 extends X {
        constructor() {
          super(...arguments), q(this, "serviceID", e5), q(this, "chain", "celestia-1"), q(this, "contractAddress", { mainnet: "", testnet: "" });
        }
        async getSupportedChains(e, t) {
          var n, o;
          let a = (null == (o = null == (n = null == t ? void 0 : t.rpcUrls) ? void 0 : n[e5]) ? void 0 : o[e]) ?? e3[e];
          try {
            let e = await fetch(`${a}/api/resolver/chains`);
            if (!e.ok) throw new $("", W.NOT_FOUND);
            return (await e.json()).chains;
          } catch {
            throw new $("", W.NOT_FOUND);
          }
        }
        async resolve(e, t, n) {
          var o, a, i, s, c;
          let l = (null == (a = null == (o = null == n ? void 0 : n.rpcUrls) ? void 0 : o[e5]) ? void 0 : a[t]) ?? e3[t],
            [u, d] = e.split(".");
          if (d && (null == (s = null == (i = null == n ? void 0 : n.allowedTopLevelDomains) ? void 0 : i.celestialsId) ? void 0 : s.indexOf(d)) === -1)
            throw new $("", W.NOT_FOUND);
          try {
            let e = await this.getSupportedChains(t, n),
              o = e.map(e => ({ celestials_id: u, chain_id: e.chain_id })),
              a = await fetch(`${l}/api/resolver/lookup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ celestial_chain: o })
              });
            if (!a.ok) throw new $("", W.NOT_FOUND);
            let i = await a.json();
            if (!(null != (c = null == i ? void 0 : i.addresses) && c.length)) throw new $("", W.NOT_FOUND);
            let s = [];
            if (
              (e.forEach((e, t) => {
                var n;
                let o = null == (n = i.addresses[t]) ? void 0 : n.address;
                o && s.push({ chain_id: e8(e.chain_id), address: o });
              }),
              0 === s.length)
            )
              throw new $("", W.NOT_FOUND);
            return s;
          } catch {
            throw new $("", W.NOT_FOUND);
          }
        }
        async lookup(e, t, n) {
          var o, a;
          let i = (null == (a = null == (o = null == n ? void 0 : n.rpcUrls) ? void 0 : o[e5]) ? void 0 : a[t]) ?? e3[t];
          try {
            let o = await this.getSupportedChains(t, n),
              a = o.map(t => ({ address: e, chain_id: t.chain_id })),
              s = await fetch(`${i}/api/resolver/reverse_lookup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chain_addresses: a })
              });
            if (!s.ok) throw new $("", W.NOT_FOUND);
            let c = await s.json(),
              l = [];
            if (
              (c.celestial_ids.forEach((e, t) => {
                var n;
                let a = o[t];
                null != (n = null == e ? void 0 : e[0]) && n.celestial_id && l.push({ name: e[0].celestial_id, chain_id: e8(a.chain_id) });
              }),
              0 === l.length)
            )
              throw new $("", W.NOT_FOUND);
            return l;
          } catch {
            throw new $("", W.NOT_FOUND);
          }
        }
      }
      let e7 = [
          "agoric",
          "akash",
          "arkh",
          "axelar",
          "band",
          "bcna",
          "bitsong",
          "bostrom",
          "cerberus",
          "certik",
          "cheqd",
          "chihuahua",
          "chronic",
          "comdex",
          "cosmos",
          "crc",
          "cre",
          "cro",
          "cudos",
          "darc",
          "decentr",
          "desmos",
          "dig",
          "echelon",
          "emoney",
          "evmos",
          "fetch",
          "firma",
          "galaxy",
          "genesis",
          "gravity",
          "iaa",
          "inj",
          "ixo",
          "juno",
          "kava",
          "ki",
          "like",
          "logos",
          "lum",
          "mantle",
          "mars",
          "meme",
          "micro",
          "mythos",
          "nomic",
          "octa",
          "odin",
          "orai",
          "osmo",
          "panacea",
          "pb",
          "persistence",
          "regen",
          "rizon",
          "secret",
          "sent",
          "sif",
          "somm",
          "star",
          "stars",
          "swth",
          "terra",
          "thor",
          "umee",
          "vdl",
          "kujira",
          "sei",
          "stride",
          "jkl",
          "tori",
          "omniflix",
          "canto",
          "pasg",
          "archway",
          "quasar",
          "neutron",
          "testcore",
          "core",
          "quick",
          "migaloo",
          "kyve",
          "onomy",
          "noble",
          "plq",
          "nolus",
          "c4e",
          "gitopia",
          "nibi",
          "maya",
          "empower",
          "dydx",
          "eth",
          "bnb",
          "sol",
          "arb",
          "manta",
          "mode",
          "zfk",
          "ll",
          "zeta",
          "merlin",
          "gno",
          "taiko",
          "alien",
          "mint",
          "ail",
          "mph",
          "duck",
          "g",
          "ip",
          "lens",
          "crypto"
        ],
        te = {
          icns: e7,
          ibcDomains: e7,
          stargazeNames: e7,
          archIds: ["arch"],
          spaceIds: [
            "eth",
            "bnb",
            "sol",
            "arb",
            "manta",
            "mode",
            "zfk",
            "ll",
            "zeta",
            "merlin",
            "gno",
            "taiko",
            "alien",
            "mint",
            "ail",
            "mph",
            "duck",
            "g",
            "ip",
            "inj",
            "sei",
            "lens",
            "crypto"
          ],
          sns: ["sol"],
          nibId: ["nibi"],
          degeNS: ["pp", "sei"],
          bdd: ["core"],
          celestialsId: ["i"]
        },
        tt = new (class {
          constructor(e) {
            q(this, "services", {}),
              (this.network = e),
              (this.network = e),
              this.registerService(new Y()),
              this.registerService(new et()),
              this.registerService(new eo()),
              this.registerService(new es()),
              this.registerService(new eJ()),
              this.registerService(new eK()),
              this.registerService(new eQ()),
              this.registerService(new e2()),
              this.registerService(new e4()),
              this.registerService(new e9());
          }
          registerService(e) {
            if (this.services[e.serviceID]) throw new $("Service already registered", W.DUPLICATE_SERVICE);
            this.services[e.serviceID] = e;
          }
          getService(e) {
            let t = this.services[e];
            if (!t) throw new $("Service not registered", W.UNREGISTERED_SERVICE);
            return t;
          }
          listServices() {
            return Object.keys(this.services);
          }
          setNetwork(e) {
            this.network = e;
          }
          getNetwork() {
            return this.network;
          }
          async resolve(e, t, n) {
            return this.getService(t).resolve(e, this.network, n);
          }
          async lookup(e, t, n) {
            return this.getService(t).lookup(e, this.network, n);
          }
          async resolveAll(e, t) {
            let n = {};
            return (
              await Promise.all(
                Object.entries(this.services).map(async ([o, a]) => {
                  try {
                    let i = await a.resolve(e, this.network, t);
                    n[o] = i;
                  } catch {
                    n[o] = null;
                  }
                })
              ),
              n
            );
          }
          async lookupAll(e, t) {
            let n = {};
            return (
              await Promise.all(
                Object.entries(this.services).map(async ([o, a]) => {
                  try {
                    let i = await a.lookup(e, this.network, t);
                    n[o] = i;
                  } catch {
                    n[o] = null;
                  }
                })
              ),
              n
            );
          }
        })("mainnet");
    },
    93958: function (e, t, n) {
      n.d(t, { W: () => w });
      var o = n(2784),
        a = n(6806);
      let i = new Map([
        ["bold", o.createElement(o.Fragment, null, o.createElement("path", { d: "M228,128a12,12,0,0,1-12,12H40a12,12,0,0,1,0-24H216A12,12,0,0,1,228,128Z" }))],
        [
          "duotone",
          o.createElement(
            o.Fragment,
            null,
            o.createElement("path", { d: "M216,56V200a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V56A16,16,0,0,1,56,40H200A16,16,0,0,1,216,56Z", opacity: "0.2" }),
            o.createElement("path", { d: "M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128Z" })
          )
        ],
        [
          "fill",
          o.createElement(
            o.Fragment,
            null,
            o.createElement("path", {
              d: "M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM184,136H72a8,8,0,0,1,0-16H184a8,8,0,0,1,0,16Z"
            })
          )
        ],
        ["light", o.createElement(o.Fragment, null, o.createElement("path", { d: "M222,128a6,6,0,0,1-6,6H40a6,6,0,0,1,0-12H216A6,6,0,0,1,222,128Z" }))],
        ["regular", o.createElement(o.Fragment, null, o.createElement("path", { d: "M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128Z" }))],
        ["thin", o.createElement(o.Fragment, null, o.createElement("path", { d: "M220,128a4,4,0,0,1-4,4H40a4,4,0,0,1,0-8H216A4,4,0,0,1,220,128Z" }))]
      ]);
      var s = Object.defineProperty,
        c = Object.defineProperties,
        l = Object.getOwnPropertyDescriptors,
        u = Object.getOwnPropertySymbols,
        d = Object.prototype.hasOwnProperty,
        h = Object.prototype.propertyIsEnumerable,
        f = (e, t, n) => (t in e ? s(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : (e[t] = n)),
        p = (e, t) => {
          for (var n in t || (t = {})) d.call(t, n) && f(e, n, t[n]);
          if (u) for (var n of u(t)) h.call(t, n) && f(e, n, t[n]);
          return e;
        },
        m = (e, t) => c(e, l(t));
      let w = (0, o.forwardRef)((e, t) => o.createElement(a.Z, m(p({ ref: t }, e), { weights: i })));
      w.displayName = "Minus";
    },
    91859: function (e, t, n) {
      n.d(t, { R: () => w });
      var o = n(2784),
        a = n(6806);
      let i = new Map([
        [
          "bold",
          o.createElement(
            o.Fragment,
            null,
            o.createElement("path", {
              d: "M230.15,70.54,185.46,25.86a20,20,0,0,0-28.28,0L33.86,149.17A19.86,19.86,0,0,0,28,163.31V208a20,20,0,0,0,20,20H216a12,12,0,0,0,0-24H125L230.15,98.83A20,20,0,0,0,230.15,70.54ZM91,204H52V165l84-84,39,39ZM192,103,153,64l18.34-18.34,39,39Z"
            })
          )
        ],
        [
          "duotone",
          o.createElement(
            o.Fragment,
            null,
            o.createElement("path", { d: "M221.66,90.34,192,120,136,64l29.66-29.66a8,8,0,0,1,11.31,0L221.66,79A8,8,0,0,1,221.66,90.34Z", opacity: "0.2" }),
            o.createElement("path", {
              d: "M227.32,73.37,182.63,28.69a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H216a8,8,0,0,0,0-16H115.32l112-112A16,16,0,0,0,227.32,73.37ZM48,163.31l88-88L180.69,120l-88,88H48Zm144-54.62L147.32,64l24-24L216,84.69Z"
            })
          )
        ],
        [
          "fill",
          o.createElement(
            o.Fragment,
            null,
            o.createElement("path", {
              d: "M227.32,73.37,182.63,28.69a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H216a8,8,0,0,0,0-16H115.32l112-112A16,16,0,0,0,227.32,73.37ZM192,108.69,147.32,64l24-24L216,84.69Z"
            })
          )
        ],
        [
          "light",
          o.createElement(
            o.Fragment,
            null,
            o.createElement("path", {
              d: "M225.91,74.79,181.22,30.1a14,14,0,0,0-19.8,0L38.1,153.41a13.94,13.94,0,0,0-4.1,9.9V208a14,14,0,0,0,14,14H216a6,6,0,0,0,0-12H110.49L225.91,94.59A14,14,0,0,0,225.91,74.79ZM93.52,210H48a2,2,0,0,1-2-2V163.31a2,2,0,0,1,.59-1.41L136,72.49,183.52,120ZM217.42,86.1,192,111.52,144.49,64,169.9,38.59a2,2,0,0,1,2.83,0l44.69,44.68A2,2,0,0,1,217.42,86.1Z"
            })
          )
        ],
        [
          "regular",
          o.createElement(
            o.Fragment,
            null,
            o.createElement("path", {
              d: "M227.32,73.37,182.63,28.69a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H216a8,8,0,0,0,0-16H115.32l112-112A16,16,0,0,0,227.32,73.37ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.69,147.32,64l24-24L216,84.69Z"
            })
          )
        ],
        [
          "thin",
          o.createElement(
            o.Fragment,
            null,
            o.createElement("path", {
              d: "M224.49,76.2,179.8,31.51a12,12,0,0,0-17,0L39.51,154.83A12,12,0,0,0,36,163.31V208a12,12,0,0,0,12,12H216a4,4,0,0,0,0-8H105.66L224.49,93.17A12,12,0,0,0,224.49,76.2ZM94.34,212H48a4,4,0,0,1-4-4V163.31a4,4,0,0,1,1.17-2.82L136,69.66,186.35,120ZM218.83,87.51,192,114.34,141.66,64l26.83-26.83a4,4,0,0,1,5.66,0l44.68,44.69A4,4,0,0,1,218.83,87.51Z"
            })
          )
        ]
      ]);
      var s = Object.defineProperty,
        c = Object.defineProperties,
        l = Object.getOwnPropertyDescriptors,
        u = Object.getOwnPropertySymbols,
        d = Object.prototype.hasOwnProperty,
        h = Object.prototype.propertyIsEnumerable,
        f = (e, t, n) => (t in e ? s(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : (e[t] = n)),
        p = (e, t) => {
          for (var n in t || (t = {})) d.call(t, n) && f(e, n, t[n]);
          if (u) for (var n of u(t)) h.call(t, n) && f(e, n, t[n]);
          return e;
        },
        m = (e, t) => c(e, l(t));
      let w = (0, o.forwardRef)((e, t) => o.createElement(a.Z, m(p({ ref: t }, e), { weights: i })));
      w.displayName = "PencilSimpleLine";
    },
    11102: function (e, t, n) {
      n.d(t, { X: () => w });
      var o = n(2784),
        a = n(22068),
        i = n(90504),
        s = Object.defineProperty,
        c = Object.defineProperties,
        l = Object.getOwnPropertyDescriptors,
        u = Object.getOwnPropertySymbols,
        d = Object.prototype.hasOwnProperty,
        h = Object.prototype.propertyIsEnumerable,
        f = (e, t, n) => (t in e ? s(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : (e[t] = n)),
        p = (e, t) => {
          for (var n in t || (t = {})) d.call(t, n) && f(e, n, t[n]);
          if (u) for (var n of u(t)) h.call(t, n) && f(e, n, t[n]);
          return e;
        },
        m = (e, t) => c(e, l(t));
      let w = (0, o.forwardRef)((e, t) => o.createElement(a.Z, m(p({ ref: t }, e), { weights: i.Z })));
      w.displayName = "ArrowLeft";
    }
  }
]);
//# sourceMappingURL=1009.js.map
