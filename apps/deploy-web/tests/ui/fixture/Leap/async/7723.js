!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "f2dead6d-0080-4840-8779-56dd437d9f94"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-f2dead6d-0080-4840-8779-56dd437d9f94"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
(_global.SENTRY_RELEASE = { id: "0.22.9" }),
  (self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
    ["7723"],
    {
      60470: function (e, t, r) {
        "use strict";
        Object.defineProperty(t, "__esModule", { value: !0 }), (t.BasePostMessageStream = void 0);
        let n = r(55800),
          i = () => void 0;
        class a extends n.Duplex {
          constructor() {
            super({ objectMode: !0 }), (this._init = !1), (this._haveSyn = !1);
          }
          _handshake() {
            this._write("SYN", null, i), this.cork();
          }
          _onData(e) {
            if (this._init)
              try {
                this.push(e);
              } catch (e) {
                this.emit("error", e);
              }
            else
              "SYN" === e
                ? ((this._haveSyn = !0), this._write("ACK", null, i))
                : "ACK" === e && ((this._init = !0), this._haveSyn || this._write("ACK", null, i), this.uncork());
          }
          _read() {}
          _write(e, t, r) {
            this._postMessage(e), r();
          }
        }
        t.BasePostMessageStream = a;
      },
      6993: function (e, t, r) {
        "use strict";
        Object.defineProperty(t, "__esModule", { value: !0 }), (t.WebWorkerParentPostMessageStream = void 0);
        let n = r(60470),
          i = r(17131);
        class a extends n.BasePostMessageStream {
          constructor({ worker: e }) {
            super(), (this._target = i.DEDICATED_WORKER_NAME), (this._worker = e), (this._worker.onmessage = this._onMessage.bind(this)), this._handshake();
          }
          _postMessage(e) {
            this._worker.postMessage({ target: this._target, data: e });
          }
          _onMessage(e) {
            let t = e.data;
            (0, i.isValidStreamMessage)(t) && this._onData(t.data);
          }
          _destroy() {
            (this._worker.onmessage = null), (this._worker = null);
          }
        }
        t.WebWorkerParentPostMessageStream = a;
      },
      70672: function (e, t, r) {
        "use strict";
        Object.defineProperty(t, "__esModule", { value: !0 }), (t.WebWorkerPostMessageStream = void 0);
        let n = r(60470),
          i = r(17131);
        class a extends n.BasePostMessageStream {
          constructor() {
            if ("undefined" == typeof self || "undefined" == typeof WorkerGlobalScope || !(self instanceof WorkerGlobalScope))
              throw Error("WorkerGlobalScope not found. This class should only be instantiated in a WebWorker.");
            super(), (this._name = i.DEDICATED_WORKER_NAME), (self.onmessage = this._onMessage.bind(this)), this._handshake();
          }
          _postMessage(e) {
            self.postMessage({ data: e });
          }
          _onMessage(e) {
            let t = e.data;
            (0, i.isValidStreamMessage)(t) && t.target === this._name && this._onData(t.data);
          }
          _destroy() {}
        }
        t.WebWorkerPostMessageStream = a;
      },
      55968: function (e, t, r) {
        "use strict";
        var n =
            (this && this.__createBinding) ||
            (Object.create
              ? function (e, t, r, n) {
                  void 0 === n && (n = r),
                    Object.defineProperty(e, n, {
                      enumerable: !0,
                      get: function () {
                        return t[r];
                      }
                    });
                }
              : function (e, t, r, n) {
                  void 0 === n && (n = r), (e[n] = t[r]);
                }),
          i =
            (this && this.__exportStar) ||
            function (e, t) {
              for (var r in e) "default" === r || Object.prototype.hasOwnProperty.call(t, r) || n(t, e, r);
            };
        Object.defineProperty(t, "__esModule", { value: !0 }), i(r(72121), t), i(r(70672), t), i(r(6993), t), i(r(60470), t);
      },
      17131: function (e, t, r) {
        "use strict";
        Object.defineProperty(t, "__esModule", { value: !0 }), (t.isValidStreamMessage = t.DEDICATED_WORKER_NAME = void 0);
        let n = r(45554);
        (t.DEDICATED_WORKER_NAME = "dedicatedWorker"),
          (t.isValidStreamMessage = function (e) {
            return (0, n.isObject)(e) && !!e.data && ("number" == typeof e.data || "object" == typeof e.data || "string" == typeof e.data);
          });
      },
      72121: function (e, t, r) {
        "use strict";
        Object.defineProperty(t, "__esModule", { value: !0 }), (t.WindowPostMessageStream = void 0);
        let n = r(60470),
          i = r(17131);
        class a extends n.BasePostMessageStream {
          constructor({ name: e, target: t, targetOrigin: r = location.origin, targetWindow: n = window }) {
            if ((super(), "undefined" == typeof window || "function" != typeof window.postMessage))
              throw Error("window.postMessage is not a function. This class should only be instantiated in a Window.");
            (this._name = e),
              (this._target = t),
              (this._targetOrigin = r),
              (this._targetWindow = n),
              (this._onMessage = this._onMessage.bind(this)),
              window.addEventListener("message", this._onMessage, !1),
              this._handshake();
          }
          _postMessage(e) {
            this._targetWindow.postMessage({ target: this._target, data: e }, this._targetOrigin);
          }
          _onMessage(e) {
            let t = e.data;
            ("*" === this._targetOrigin || e.origin === this._targetOrigin) &&
              e.source === this._targetWindow &&
              (0, i.isValidStreamMessage)(t) &&
              t.target === this._name &&
              this._onData(t.data);
          }
          _destroy() {
            window.removeEventListener("message", this._onMessage, !1);
          }
        }
        t.WindowPostMessageStream = a;
      },
      89136: function (e) {
        var t = {}.toString;
        e.exports =
          Array.isArray ||
          function (e) {
            return "[object Array]" == t.call(e);
          };
      },
      31034: function (e, t, r) {
        "use strict";
        var n = r(82884),
          i =
            Object.keys ||
            function (e) {
              var t = [];
              for (var r in e) t.push(r);
              return t;
            };
        e.exports = f;
        var a = r(7646);
        a.inherits = r(91285);
        var s = r(67187),
          o = r(3597);
        a.inherits(f, s);
        for (var l = i(o.prototype), u = 0; u < l.length; u++) {
          var d = l[u];
          f.prototype[d] || (f.prototype[d] = o.prototype[d]);
        }
        function f(e) {
          if (!(this instanceof f)) return new f(e);
          s.call(this, e),
            o.call(this, e),
            e && !1 === e.readable && (this.readable = !1),
            e && !1 === e.writable && (this.writable = !1),
            (this.allowHalfOpen = !0),
            e && !1 === e.allowHalfOpen && (this.allowHalfOpen = !1),
            this.once("end", h);
        }
        function h() {
          this.allowHalfOpen || this._writableState.ended || n(c, this);
        }
        function c(e) {
          e.end();
        }
        Object.defineProperty(f.prototype, "destroyed", {
          get: function () {
            return void 0 !== this._readableState && void 0 !== this._writableState && this._readableState.destroyed && this._writableState.destroyed;
          },
          set: function (e) {
            void 0 !== this._readableState && void 0 !== this._writableState && ((this._readableState.destroyed = e), (this._writableState.destroyed = e));
          }
        }),
          (f.prototype._destroy = function (e, t) {
            this.push(null), this.end(), n(t, e);
          });
      },
      82598: function (e, t, r) {
        "use strict";
        e.exports = a;
        var n = r(62287),
          i = r(7646);
        function a(e) {
          if (!(this instanceof a)) return new a(e);
          n.call(this, e);
        }
        (i.inherits = r(91285)),
          i.inherits(a, n),
          (a.prototype._transform = function (e, t, r) {
            r(null, e);
          });
      },
      67187: function (e, t, r) {
        "use strict";
        var n,
          i,
          a = r(34406),
          s = r(82884);
        e.exports = w;
        var o = r(89136);
        (w.ReadableState = _), r(22699).EventEmitter;
        var l = function (e, t) {
            return e.listeners(t).length;
          },
          u = r(80979),
          d = r(55691).Buffer,
          f = r.g.Uint8Array || function () {},
          h = r(7646);
        h.inherits = r(91285);
        var c = r(56052),
          p = void 0;
        p = c && c.debuglog ? c.debuglog("stream") : function () {};
        var g = r(78991),
          b = r(48374);
        h.inherits(w, u);
        var y = ["error", "close", "destroy", "pause", "resume"];
        function _(e, t) {
          (n = n || r(31034)),
            (e = e || {}),
            (this.objectMode = !!e.objectMode),
            t instanceof n && (this.objectMode = this.objectMode || !!e.readableObjectMode);
          var a = e.highWaterMark,
            s = this.objectMode ? 16 : 16384;
          (this.highWaterMark = a || 0 === a ? a : s),
            (this.highWaterMark = Math.floor(this.highWaterMark)),
            (this.buffer = new g()),
            (this.length = 0),
            (this.pipes = null),
            (this.pipesCount = 0),
            (this.flowing = null),
            (this.ended = !1),
            (this.endEmitted = !1),
            (this.reading = !1),
            (this.sync = !0),
            (this.needReadable = !1),
            (this.emittedReadable = !1),
            (this.readableListening = !1),
            (this.resumeScheduled = !1),
            (this.destroyed = !1),
            (this.defaultEncoding = e.defaultEncoding || "utf8"),
            (this.awaitDrain = 0),
            (this.readingMore = !1),
            (this.decoder = null),
            (this.encoding = null),
            e.encoding && (i || (i = r(35099).StringDecoder), (this.decoder = new i(e.encoding)), (this.encoding = e.encoding));
        }
        function w(e) {
          if (((n = n || r(31034)), !(this instanceof w))) return new w(e);
          (this._readableState = new _(e, this)),
            (this.readable = !0),
            e && ("function" == typeof e.read && (this._read = e.read), "function" == typeof e.destroy && (this._destroy = e.destroy)),
            u.call(this);
        }
        function v(e, t, r, n, i) {
          var a,
            s,
            o,
            l = e._readableState;
          return (
            null === t
              ? ((l.reading = !1),
                (function (e, t) {
                  if (!t.ended) {
                    if (t.decoder) {
                      var r = t.decoder.end();
                      r && r.length && (t.buffer.push(r), (t.length += t.objectMode ? 1 : r.length));
                    }
                    (t.ended = !0), M(e);
                  }
                })(e, l))
              : (i ||
                    (o = (function (e, t) {
                      var r;
                      return (
                        !d.isBuffer(t) &&
                          !(t instanceof f) &&
                          "string" != typeof t &&
                          void 0 !== t &&
                          !e.objectMode &&
                          (r = TypeError("Invalid non-string/buffer chunk")),
                        r
                      );
                    })(l, t)),
                  o)
                ? e.emit("error", o)
                : l.objectMode || (t && t.length > 0)
                  ? ("string" != typeof t && !l.objectMode && Object.getPrototypeOf(t) !== d.prototype && ((s = t), (t = d.from(s))),
                    n
                      ? l.endEmitted
                        ? e.emit("error", Error("stream.unshift() after end event"))
                        : m(e, l, t, !0)
                      : l.ended
                        ? e.emit("error", Error("stream.push() after EOF"))
                        : ((l.reading = !1),
                          l.decoder && !r ? ((t = l.decoder.write(t)), l.objectMode || 0 !== t.length ? m(e, l, t, !1) : k(e, l)) : m(e, l, t, !1)))
                  : n || (l.reading = !1),
            !(a = l).ended && (a.needReadable || a.length < a.highWaterMark || 0 === a.length)
          );
        }
        function m(e, t, r, n) {
          t.flowing && 0 === t.length && !t.sync
            ? (e.emit("data", r), e.read(0))
            : ((t.length += t.objectMode ? 1 : r.length), n ? t.buffer.unshift(r) : t.buffer.push(r), t.needReadable && M(e)),
            k(e, t);
        }
        function S(e, t) {
          if (e <= 0 || (0 === t.length && t.ended)) return 0;
          if (t.objectMode) return 1;
          if (e != e) return t.flowing && t.length ? t.buffer.head.data.length : t.length;
          if (e > t.highWaterMark) {
            var r;
            t.highWaterMark =
              ((r = e) >= 8388608 ? (r = 8388608) : (r--, (r |= r >>> 1), (r |= r >>> 2), (r |= r >>> 4), (r |= r >>> 8), (r |= r >>> 16), r++), r);
          }
          return e <= t.length ? e : t.ended ? t.length : ((t.needReadable = !0), 0);
        }
        function M(e) {
          var t = e._readableState;
          (t.needReadable = !1), t.emittedReadable || (p("emitReadable", t.flowing), (t.emittedReadable = !0), t.sync ? s(E, e) : E(e));
        }
        function E(e) {
          p("emit readable"), e.emit("readable"), C(e);
        }
        function k(e, t) {
          t.readingMore || ((t.readingMore = !0), s(R, e, t));
        }
        function R(e, t) {
          for (var r = t.length; !t.reading && !t.flowing && !t.ended && t.length < t.highWaterMark && (p("maybeReadMore read 0"), e.read(0), r !== t.length); )
            r = t.length;
          t.readingMore = !1;
        }
        function O(e) {
          p("readable nexttick read 0"), e.read(0);
        }
        function j(e, t) {
          t.reading || (p("resume read 0"), e.read(0)),
            (t.resumeScheduled = !1),
            (t.awaitDrain = 0),
            e.emit("resume"),
            C(e),
            t.flowing && !t.reading && e.read(0);
        }
        function C(e) {
          var t = e._readableState;
          for (p("flow", t.flowing); t.flowing && null !== e.read(); );
        }
        function N(e, t) {
          var r, n, i, a, s;
          return 0 === t.length
            ? null
            : (t.objectMode
                ? (r = t.buffer.shift())
                : !e || e >= t.length
                  ? ((r = t.decoder ? t.buffer.join("") : 1 === t.buffer.length ? t.buffer.head.data : t.buffer.concat(t.length)), t.buffer.clear())
                  : ((n = e),
                    (i = t.buffer),
                    (a = t.decoder),
                    n < i.head.data.length
                      ? ((s = i.head.data.slice(0, n)), (i.head.data = i.head.data.slice(n)))
                      : (s =
                          n === i.head.data.length
                            ? i.shift()
                            : a
                              ? (function (e, t) {
                                  var r = t.head,
                                    n = 1,
                                    i = r.data;
                                  for (e -= i.length; (r = r.next); ) {
                                    var a = r.data,
                                      s = e > a.length ? a.length : e;
                                    if ((s === a.length ? (i += a) : (i += a.slice(0, e)), 0 == (e -= s))) {
                                      s === a.length ? (++n, r.next ? (t.head = r.next) : (t.head = t.tail = null)) : ((t.head = r), (r.data = a.slice(s)));
                                      break;
                                    }
                                    ++n;
                                  }
                                  return (t.length -= n), i;
                                })(n, i)
                              : (function (e, t) {
                                  var r = d.allocUnsafe(e),
                                    n = t.head,
                                    i = 1;
                                  for (n.data.copy(r), e -= n.data.length; (n = n.next); ) {
                                    var a = n.data,
                                      s = e > a.length ? a.length : e;
                                    if ((a.copy(r, r.length - e, 0, s), 0 == (e -= s))) {
                                      s === a.length ? (++i, n.next ? (t.head = n.next) : (t.head = t.tail = null)) : ((t.head = n), (n.data = a.slice(s)));
                                      break;
                                    }
                                    ++i;
                                  }
                                  return (t.length -= i), r;
                                })(n, i)),
                    (r = s)),
              r);
        }
        function x(e) {
          var t = e._readableState;
          if (t.length > 0) throw Error('"endReadable()" called on non-empty stream');
          t.endEmitted || ((t.ended = !0), s(P, t, e));
        }
        function P(e, t) {
          e.endEmitted || 0 !== e.length || ((e.endEmitted = !0), (t.readable = !1), t.emit("end"));
        }
        function D(e, t) {
          for (var r = 0, n = e.length; r < n; r++) if (e[r] === t) return r;
          return -1;
        }
        Object.defineProperty(w.prototype, "destroyed", {
          get: function () {
            return void 0 !== this._readableState && this._readableState.destroyed;
          },
          set: function (e) {
            this._readableState && (this._readableState.destroyed = e);
          }
        }),
          (w.prototype.destroy = b.destroy),
          (w.prototype._undestroy = b.undestroy),
          (w.prototype._destroy = function (e, t) {
            this.push(null), t(e);
          }),
          (w.prototype.push = function (e, t) {
            var r,
              n = this._readableState;
            return (
              n.objectMode ? (r = !0) : "string" == typeof e && ((t = t || n.defaultEncoding) !== n.encoding && ((e = d.from(e, t)), (t = "")), (r = !0)),
              v(this, e, t, !1, r)
            );
          }),
          (w.prototype.unshift = function (e) {
            return v(this, e, null, !0, !1);
          }),
          (w.prototype.isPaused = function () {
            return !1 === this._readableState.flowing;
          }),
          (w.prototype.setEncoding = function (e) {
            return i || (i = r(35099).StringDecoder), (this._readableState.decoder = new i(e)), (this._readableState.encoding = e), this;
          }),
          (w.prototype.read = function (e) {
            p("read", e), (e = parseInt(e, 10));
            var t,
              r = this._readableState,
              n = e;
            if ((0 !== e && (r.emittedReadable = !1), 0 === e && r.needReadable && (r.length >= r.highWaterMark || r.ended)))
              return p("read: emitReadable", r.length, r.ended), 0 === r.length && r.ended ? x(this) : M(this), null;
            if (0 === (e = S(e, r)) && r.ended) return 0 === r.length && x(this), null;
            var i = r.needReadable;
            return (
              p("need readable", i),
              (0 === r.length || r.length - e < r.highWaterMark) && p("length less than watermark", (i = !0)),
              r.ended || r.reading
                ? p("reading or ended", (i = !1))
                : i &&
                  (p("do read"),
                  (r.reading = !0),
                  (r.sync = !0),
                  0 === r.length && (r.needReadable = !0),
                  this._read(r.highWaterMark),
                  (r.sync = !1),
                  r.reading || (e = S(n, r))),
              null === (t = e > 0 ? N(e, r) : null) ? ((r.needReadable = !0), (e = 0)) : (r.length -= e),
              0 === r.length && (r.ended || (r.needReadable = !0), n !== e && r.ended && x(this)),
              null !== t && this.emit("data", t),
              t
            );
          }),
          (w.prototype._read = function (e) {
            this.emit("error", Error("_read() is not implemented"));
          }),
          (w.prototype.pipe = function (e, t) {
            var r,
              n = this,
              i = this._readableState;
            switch (i.pipesCount) {
              case 0:
                i.pipes = e;
                break;
              case 1:
                i.pipes = [i.pipes, e];
                break;
              default:
                i.pipes.push(e);
            }
            (i.pipesCount += 1), p("pipe count=%d opts=%j", i.pipesCount, t);
            var u = (t && !1 === t.end) || e === a.stdout || e === a.stderr ? w : d;
            function d() {
              p("onend"), e.end();
            }
            i.endEmitted ? s(u) : n.once("end", u),
              e.on("unpipe", function t(r, a) {
                p("onunpipe"),
                  r === n &&
                    a &&
                    !1 === a.hasUnpiped &&
                    ((a.hasUnpiped = !0),
                    p("cleanup"),
                    e.removeListener("close", y),
                    e.removeListener("finish", _),
                    e.removeListener("drain", f),
                    e.removeListener("error", b),
                    e.removeListener("unpipe", t),
                    n.removeListener("end", d),
                    n.removeListener("end", w),
                    n.removeListener("data", g),
                    (h = !0),
                    i.awaitDrain && (!e._writableState || e._writableState.needDrain) && f());
              });
            var f =
              ((r = n),
              function () {
                var e = r._readableState;
                p("pipeOnDrain", e.awaitDrain), e.awaitDrain && e.awaitDrain--, 0 === e.awaitDrain && l(r, "data") && ((e.flowing = !0), C(r));
              });
            e.on("drain", f);
            var h = !1,
              c = !1;
            function g(t) {
              p("ondata"),
                (c = !1),
                !1 !== e.write(t) ||
                  c ||
                  (((1 === i.pipesCount && i.pipes === e) || (i.pipesCount > 1 && -1 !== D(i.pipes, e))) &&
                    !h &&
                    (p("false write response, pause", n._readableState.awaitDrain), n._readableState.awaitDrain++, (c = !0)),
                  n.pause());
            }
            function b(t) {
              p("onerror", t), w(), e.removeListener("error", b), 0 === l(e, "error") && e.emit("error", t);
            }
            function y() {
              e.removeListener("finish", _), w();
            }
            function _() {
              p("onfinish"), e.removeListener("close", y), w();
            }
            function w() {
              p("unpipe"), n.unpipe(e);
            }
            return (
              n.on("data", g),
              (function (e, t, r) {
                if ("function" == typeof e.prependListener) return e.prependListener(t, r);
                e._events && e._events[t] ? (o(e._events[t]) ? e._events[t].unshift(r) : (e._events[t] = [r, e._events[t]])) : e.on(t, r);
              })(e, "error", b),
              e.once("close", y),
              e.once("finish", _),
              e.emit("pipe", n),
              i.flowing || (p("pipe resume"), n.resume()),
              e
            );
          }),
          (w.prototype.unpipe = function (e) {
            var t = this._readableState,
              r = { hasUnpiped: !1 };
            if (0 === t.pipesCount) return this;
            if (1 === t.pipesCount)
              return (e && e !== t.pipes) || (e || (e = t.pipes), (t.pipes = null), (t.pipesCount = 0), (t.flowing = !1), e && e.emit("unpipe", this, r)), this;
            if (!e) {
              var n = t.pipes,
                i = t.pipesCount;
              (t.pipes = null), (t.pipesCount = 0), (t.flowing = !1);
              for (var a = 0; a < i; a++) n[a].emit("unpipe", this, r);
              return this;
            }
            var s = D(t.pipes, e);
            return -1 === s || (t.pipes.splice(s, 1), (t.pipesCount -= 1), 1 === t.pipesCount && (t.pipes = t.pipes[0]), e.emit("unpipe", this, r)), this;
          }),
          (w.prototype.on = function (e, t) {
            var r = u.prototype.on.call(this, e, t);
            if ("data" === e) !1 !== this._readableState.flowing && this.resume();
            else if ("readable" === e) {
              var n = this._readableState;
              n.endEmitted ||
                n.readableListening ||
                ((n.readableListening = n.needReadable = !0), (n.emittedReadable = !1), n.reading ? n.length && M(this) : s(O, this));
            }
            return r;
          }),
          (w.prototype.addListener = w.prototype.on),
          (w.prototype.resume = function () {
            var e,
              t,
              r = this._readableState;
            return r.flowing || (p("resume"), (r.flowing = !0), (e = this), (t = r).resumeScheduled || ((t.resumeScheduled = !0), s(j, e, t))), this;
          }),
          (w.prototype.pause = function () {
            return (
              p("call pause flowing=%j", this._readableState.flowing),
              !1 !== this._readableState.flowing && (p("pause"), (this._readableState.flowing = !1), this.emit("pause")),
              this
            );
          }),
          (w.prototype.wrap = function (e) {
            var t = this._readableState,
              r = !1,
              n = this;
            for (var i in (e.on("end", function () {
              if ((p("wrapped end"), t.decoder && !t.ended)) {
                var e = t.decoder.end();
                e && e.length && n.push(e);
              }
              n.push(null);
            }),
            e.on("data", function (i) {
              if ((p("wrapped data"), t.decoder && (i = t.decoder.write(i)), !t.objectMode || null != i))
                (t.objectMode || (i && i.length)) && (n.push(i) || ((r = !0), e.pause()));
            }),
            e))
              void 0 === this[i] &&
                "function" == typeof e[i] &&
                (this[i] = (function (t) {
                  return function () {
                    return e[t].apply(e, arguments);
                  };
                })(i));
            for (var a = 0; a < y.length; a++) e.on(y[a], n.emit.bind(n, y[a]));
            return (
              (n._read = function (t) {
                p("wrapped _read", t), r && ((r = !1), e.resume());
              }),
              n
            );
          }),
          (w._fromList = N);
      },
      62287: function (e, t, r) {
        "use strict";
        e.exports = s;
        var n = r(31034),
          i = r(7646);
        function a(e) {
          (this.afterTransform = function (t, r) {
            return (function (e, t, r) {
              var n = e._transformState;
              n.transforming = !1;
              var i = n.writecb;
              if (!i) return e.emit("error", Error("write callback called multiple times"));
              (n.writechunk = null), (n.writecb = null), null != r && e.push(r), i(t);
              var a = e._readableState;
              (a.reading = !1), (a.needReadable || a.length < a.highWaterMark) && e._read(a.highWaterMark);
            })(e, t, r);
          }),
            (this.needTransform = !1),
            (this.transforming = !1),
            (this.writecb = null),
            (this.writechunk = null),
            (this.writeencoding = null);
        }
        function s(e) {
          if (!(this instanceof s)) return new s(e);
          n.call(this, e), (this._transformState = new a(this));
          var t = this;
          (this._readableState.needReadable = !0),
            (this._readableState.sync = !1),
            e && ("function" == typeof e.transform && (this._transform = e.transform), "function" == typeof e.flush && (this._flush = e.flush)),
            this.once("prefinish", function () {
              "function" == typeof this._flush
                ? this._flush(function (e, r) {
                    o(t, e, r);
                  })
                : o(t);
            });
        }
        function o(e, t, r) {
          if (t) return e.emit("error", t);
          null != r && e.push(r);
          var n = e._writableState,
            i = e._transformState;
          if (n.length) throw Error("Calling transform done when ws.length != 0");
          if (i.transforming) throw Error("Calling transform done when still transforming");
          return e.push(null);
        }
        (i.inherits = r(91285)),
          i.inherits(s, n),
          (s.prototype.push = function (e, t) {
            return (this._transformState.needTransform = !1), n.prototype.push.call(this, e, t);
          }),
          (s.prototype._transform = function (e, t, r) {
            throw Error("_transform() is not implemented");
          }),
          (s.prototype._write = function (e, t, r) {
            var n = this._transformState;
            if (((n.writecb = r), (n.writechunk = e), (n.writeencoding = t), !n.transforming)) {
              var i = this._readableState;
              (n.needTransform || i.needReadable || i.length < i.highWaterMark) && this._read(i.highWaterMark);
            }
          }),
          (s.prototype._read = function (e) {
            var t = this._transformState;
            null !== t.writechunk && t.writecb && !t.transforming
              ? ((t.transforming = !0), this._transform(t.writechunk, t.writeencoding, t.afterTransform))
              : (t.needTransform = !0);
          }),
          (s.prototype._destroy = function (e, t) {
            var r = this;
            n.prototype._destroy.call(this, e, function (e) {
              t(e), r.emit("close");
            });
          });
      },
      3597: function (e, t, r) {
        "use strict";
        var n,
          i,
          a = r(34406),
          s = r(82884);
        function o(e) {
          var t = this;
          (this.next = null),
            (this.entry = null),
            (this.finish = function () {
              (function (e, t, r) {
                var n = e.entry;
                for (e.entry = null; n; ) {
                  var i = n.callback;
                  t.pendingcb--, i(void 0), (n = n.next);
                }
                t.corkedRequestsFree ? (t.corkedRequestsFree.next = e) : (t.corkedRequestsFree = e);
              })(t, e);
            });
        }
        e.exports = y;
        var l = !a.browser && ["v0.10", "v0.9."].indexOf(a.version.slice(0, 5)) > -1 ? setImmediate : s;
        y.WritableState = b;
        var u = r(7646);
        u.inherits = r(91285);
        var d = { deprecate: r(5803) },
          f = r(80979),
          h = r(55691).Buffer,
          c = r.g.Uint8Array || function () {},
          p = r(48374);
        function g() {}
        function b(e, t) {
          (n = n || r(31034)),
            (e = e || {}),
            (this.objectMode = !!e.objectMode),
            t instanceof n && (this.objectMode = this.objectMode || !!e.writableObjectMode);
          var i = e.highWaterMark,
            a = this.objectMode ? 16 : 16384;
          (this.highWaterMark = i || 0 === i ? i : a),
            (this.highWaterMark = Math.floor(this.highWaterMark)),
            (this.finalCalled = !1),
            (this.needDrain = !1),
            (this.ending = !1),
            (this.ended = !1),
            (this.finished = !1),
            (this.destroyed = !1);
          var u = !1 === e.decodeStrings;
          (this.decodeStrings = !u),
            (this.defaultEncoding = e.defaultEncoding || "utf8"),
            (this.length = 0),
            (this.writing = !1),
            (this.corked = 0),
            (this.sync = !0),
            (this.bufferProcessing = !1),
            (this.onwrite = function (e) {
              (function (e, t) {
                var r = e._writableState,
                  n = r.sync,
                  i = r.writecb;
                if (((r.writing = !1), (r.writecb = null), (r.length -= r.writelen), (r.writelen = 0), t))
                  --r.pendingcb,
                    n
                      ? (s(i, t), s(M, e, r), (e._writableState.errorEmitted = !0), e.emit("error", t))
                      : (i(t), (e._writableState.errorEmitted = !0), e.emit("error", t), M(e, r));
                else {
                  var a = m(r);
                  a || r.corked || r.bufferProcessing || !r.bufferedRequest || v(e, r), n ? l(w, e, r, a, i) : w(e, r, a, i);
                }
              })(t, e);
            }),
            (this.writecb = null),
            (this.writelen = 0),
            (this.bufferedRequest = null),
            (this.lastBufferedRequest = null),
            (this.pendingcb = 0),
            (this.prefinished = !1),
            (this.errorEmitted = !1),
            (this.bufferedRequestCount = 0),
            (this.corkedRequestsFree = new o(this));
        }
        function y(e) {
          if (((n = n || r(31034)), !i.call(y, this) && !(this instanceof n))) return new y(e);
          (this._writableState = new b(e, this)),
            (this.writable = !0),
            e &&
              ("function" == typeof e.write && (this._write = e.write),
              "function" == typeof e.writev && (this._writev = e.writev),
              "function" == typeof e.destroy && (this._destroy = e.destroy),
              "function" == typeof e.final && (this._final = e.final)),
            f.call(this);
        }
        function _(e, t, r, n, i, a, s) {
          (t.writelen = n), (t.writecb = s), (t.writing = !0), (t.sync = !0), r ? e._writev(i, t.onwrite) : e._write(i, a, t.onwrite), (t.sync = !1);
        }
        function w(e, t, r, n) {
          var i, a;
          r || ((i = e), 0 === (a = t).length && a.needDrain && ((a.needDrain = !1), i.emit("drain"))), t.pendingcb--, n(), M(e, t);
        }
        function v(e, t) {
          t.bufferProcessing = !0;
          var r = t.bufferedRequest;
          if (e._writev && r && r.next) {
            var n = Array(t.bufferedRequestCount),
              i = t.corkedRequestsFree;
            i.entry = r;
            for (var a = 0, s = !0; r; ) (n[a] = r), r.isBuf || (s = !1), (r = r.next), (a += 1);
            (n.allBuffers = s),
              _(e, t, !0, t.length, n, "", i.finish),
              t.pendingcb++,
              (t.lastBufferedRequest = null),
              i.next ? ((t.corkedRequestsFree = i.next), (i.next = null)) : (t.corkedRequestsFree = new o(t));
          } else {
            for (; r; ) {
              var l = r.chunk,
                u = r.encoding,
                d = r.callback,
                f = t.objectMode ? 1 : l.length;
              if ((_(e, t, !1, f, l, u, d), (r = r.next), t.writing)) break;
            }
            null === r && (t.lastBufferedRequest = null);
          }
          (t.bufferedRequestCount = 0), (t.bufferedRequest = r), (t.bufferProcessing = !1);
        }
        function m(e) {
          return e.ending && 0 === e.length && null === e.bufferedRequest && !e.finished && !e.writing;
        }
        function S(e, t) {
          e._final(function (r) {
            t.pendingcb--, r && e.emit("error", r), (t.prefinished = !0), e.emit("prefinish"), M(e, t);
          });
        }
        function M(e, t) {
          var r = m(t);
          return (
            r &&
              (t.prefinished ||
                t.finalCalled ||
                ("function" == typeof e._final ? (t.pendingcb++, (t.finalCalled = !0), s(S, e, t)) : ((t.prefinished = !0), e.emit("prefinish"))),
              0 === t.pendingcb && ((t.finished = !0), e.emit("finish"))),
            r
          );
        }
        u.inherits(y, f),
          (b.prototype.getBuffer = function () {
            for (var e = this.bufferedRequest, t = []; e; ) t.push(e), (e = e.next);
            return t;
          }),
          (function () {
            try {
              Object.defineProperty(b.prototype, "buffer", {
                get: d.deprecate(
                  function () {
                    return this.getBuffer();
                  },
                  "_writableState.buffer is deprecated. Use _writableState.getBuffer instead.",
                  "DEP0003"
                )
              });
            } catch (e) {}
          })(),
          "function" == typeof Symbol && Symbol.hasInstance && "function" == typeof Function.prototype[Symbol.hasInstance]
            ? ((i = Function.prototype[Symbol.hasInstance]),
              Object.defineProperty(y, Symbol.hasInstance, {
                value: function (e) {
                  return !!i.call(this, e) || (e && e._writableState instanceof b);
                }
              }))
            : (i = function (e) {
                return e instanceof this;
              }),
          (y.prototype.pipe = function () {
            this.emit("error", Error("Cannot pipe, not readable"));
          }),
          (y.prototype.write = function (e, t, r) {
            var n,
              i,
              a,
              o,
              l,
              u,
              d,
              f,
              p = this._writableState,
              b = !1,
              y = ((n = e), (h.isBuffer(n) || n instanceof c) && !p.objectMode);
            return (
              y && !h.isBuffer(e) && ((i = e), (e = h.from(i))),
              ("function" == typeof t && ((r = t), (t = null)), y ? (t = "buffer") : t || (t = p.defaultEncoding), "function" != typeof r && (r = g), p.ended)
                ? ((a = r), (o = Error("write after end")), this.emit("error", o), s(a, o))
                : (y ||
                    ((l = e),
                    (u = r),
                    (d = !0),
                    (f = !1),
                    null === l
                      ? (f = TypeError("May not write null values to stream"))
                      : "string" == typeof l || void 0 === l || p.objectMode || (f = TypeError("Invalid non-string/buffer chunk")),
                    f && (this.emit("error", f), s(u, f), (d = !1)),
                    d)) &&
                  (p.pendingcb++,
                  (b = (function (e, t, r, n, i, a) {
                    if (!r) {
                      var s,
                        o,
                        l = ((s = n), (o = i), t.objectMode || !1 === t.decodeStrings || "string" != typeof s || (s = h.from(s, o)), s);
                      n !== l && ((r = !0), (i = "buffer"), (n = l));
                    }
                    var u = t.objectMode ? 1 : n.length;
                    t.length += u;
                    var d = t.length < t.highWaterMark;
                    if ((d || (t.needDrain = !0), t.writing || t.corked)) {
                      var f = t.lastBufferedRequest;
                      (t.lastBufferedRequest = { chunk: n, encoding: i, isBuf: r, callback: a, next: null }),
                        f ? (f.next = t.lastBufferedRequest) : (t.bufferedRequest = t.lastBufferedRequest),
                        (t.bufferedRequestCount += 1);
                    } else _(e, t, !1, u, n, i, a);
                    return d;
                  })(this, p, y, e, t, r))),
              b
            );
          }),
          (y.prototype.cork = function () {
            var e = this._writableState;
            e.corked++;
          }),
          (y.prototype.uncork = function () {
            var e = this._writableState;
            !e.corked || (e.corked--, e.writing || e.corked || e.finished || e.bufferProcessing || !e.bufferedRequest || v(this, e));
          }),
          (y.prototype.setDefaultEncoding = function (e) {
            if (
              ("string" == typeof e && (e = e.toLowerCase()),
              !(["hex", "utf8", "utf-8", "ascii", "binary", "base64", "ucs2", "ucs-2", "utf16le", "utf-16le", "raw"].indexOf((e + "").toLowerCase()) > -1))
            )
              throw TypeError("Unknown encoding: " + e);
            return (this._writableState.defaultEncoding = e), this;
          }),
          (y.prototype._write = function (e, t, r) {
            r(Error("_write() is not implemented"));
          }),
          (y.prototype._writev = null),
          (y.prototype.end = function (e, t, r) {
            var n,
              i,
              a,
              o = this._writableState;
            "function" == typeof e ? ((r = e), (e = null), (t = null)) : "function" == typeof t && ((r = t), (t = null)),
              null != e && this.write(e, t),
              o.corked && ((o.corked = 1), this.uncork()),
              o.ending ||
                o.finished ||
                ((n = this), (i = o), (a = r), (i.ending = !0), M(n, i), a && (i.finished ? s(a) : n.once("finish", a)), (i.ended = !0), (n.writable = !1));
          }),
          Object.defineProperty(y.prototype, "destroyed", {
            get: function () {
              return void 0 !== this._writableState && this._writableState.destroyed;
            },
            set: function (e) {
              this._writableState && (this._writableState.destroyed = e);
            }
          }),
          (y.prototype.destroy = p.destroy),
          (y.prototype._undestroy = p.undestroy),
          (y.prototype._destroy = function (e, t) {
            this.end(), t(e);
          });
      },
      78991: function (e, t, r) {
        "use strict";
        var n = r(55691).Buffer;
        e.exports = (function () {
          function e() {
            (function (e, t) {
              if (!(e instanceof t)) throw TypeError("Cannot call a class as a function");
            })(this, e),
              (this.head = null),
              (this.tail = null),
              (this.length = 0);
          }
          return (
            (e.prototype.push = function (e) {
              var t = { data: e, next: null };
              this.length > 0 ? (this.tail.next = t) : (this.head = t), (this.tail = t), ++this.length;
            }),
            (e.prototype.unshift = function (e) {
              var t = { data: e, next: this.head };
              0 === this.length && (this.tail = t), (this.head = t), ++this.length;
            }),
            (e.prototype.shift = function () {
              if (0 !== this.length) {
                var e = this.head.data;
                return 1 === this.length ? (this.head = this.tail = null) : (this.head = this.head.next), --this.length, e;
              }
            }),
            (e.prototype.clear = function () {
              (this.head = this.tail = null), (this.length = 0);
            }),
            (e.prototype.join = function (e) {
              if (0 === this.length) return "";
              for (var t = this.head, r = "" + t.data; (t = t.next); ) r += e + t.data;
              return r;
            }),
            (e.prototype.concat = function (e) {
              if (0 === this.length) return n.alloc(0);
              if (1 === this.length) return this.head.data;
              for (var t = n.allocUnsafe(e >>> 0), r = this.head, i = 0; r; )
                (function (e, t, r) {
                  e.copy(t, r);
                })(r.data, t, i),
                  (i += r.data.length),
                  (r = r.next);
              return t;
            }),
            e
          );
        })();
      },
      48374: function (e, t, r) {
        "use strict";
        var n = r(82884);
        function i(e, t) {
          e.emit("error", t);
        }
        e.exports = {
          destroy: function (e, t) {
            var r = this,
              a = this._readableState && this._readableState.destroyed,
              s = this._writableState && this._writableState.destroyed;
            if (a || s) {
              t ? t(e) : !e || (this._writableState && this._writableState.errorEmitted) || n(i, this, e);
              return;
            }
            this._readableState && (this._readableState.destroyed = !0),
              this._writableState && (this._writableState.destroyed = !0),
              this._destroy(e || null, function (e) {
                !t && e ? (n(i, r, e), r._writableState && (r._writableState.errorEmitted = !0)) : t && t(e);
              });
          },
          undestroy: function () {
            this._readableState &&
              ((this._readableState.destroyed = !1),
              (this._readableState.reading = !1),
              (this._readableState.ended = !1),
              (this._readableState.endEmitted = !1)),
              this._writableState &&
                ((this._writableState.destroyed = !1),
                (this._writableState.ended = !1),
                (this._writableState.ending = !1),
                (this._writableState.finished = !1),
                (this._writableState.errorEmitted = !1));
          }
        };
      },
      80979: function (e, t, r) {
        e.exports = r(22699).EventEmitter;
      },
      55800: function (e, t, r) {
        ((t = e.exports = r(67187)).Stream = t),
          (t.Readable = t),
          (t.Writable = r(3597)),
          (t.Duplex = r(31034)),
          (t.Transform = r(62287)),
          (t.PassThrough = r(82598));
      },
      55691: function (e, t, r) {
        var n = r(48834),
          i = n.Buffer;
        function a(e, t) {
          for (var r in e) t[r] = e[r];
        }
        function s(e, t, r) {
          return i(e, t, r);
        }
        i.from && i.alloc && i.allocUnsafe && i.allocUnsafeSlow ? (e.exports = n) : (a(n, t), (t.Buffer = s)),
          a(i, s),
          (s.from = function (e, t, r) {
            if ("number" == typeof e) throw TypeError("Argument must not be a number");
            return i(e, t, r);
          }),
          (s.alloc = function (e, t, r) {
            if ("number" != typeof e) throw TypeError("Argument must be a number");
            var n = i(e);
            return void 0 !== t ? ("string" == typeof r ? n.fill(t, r) : n.fill(t)) : n.fill(0), n;
          }),
          (s.allocUnsafe = function (e) {
            if ("number" != typeof e) throw TypeError("Argument must be a number");
            return i(e);
          }),
          (s.allocUnsafeSlow = function (e) {
            if ("number" != typeof e) throw TypeError("Argument must be a number");
            return n.SlowBuffer(e);
          });
      },
      35099: function (e, t, r) {
        "use strict";
        var n = r(55691).Buffer,
          i =
            n.isEncoding ||
            function (e) {
              switch ((e = "" + e) && e.toLowerCase()) {
                case "hex":
                case "utf8":
                case "utf-8":
                case "ascii":
                case "binary":
                case "base64":
                case "ucs2":
                case "ucs-2":
                case "utf16le":
                case "utf-16le":
                case "raw":
                  return !0;
                default:
                  return !1;
              }
            };
        function a(e) {
          var t;
          switch (
            ((this.encoding = (function (e) {
              var t = (function (e) {
                var t;
                if (!e) return "utf8";
                for (;;)
                  switch (e) {
                    case "utf8":
                    case "utf-8":
                      return "utf8";
                    case "ucs2":
                    case "ucs-2":
                    case "utf16le":
                    case "utf-16le":
                      return "utf16le";
                    case "latin1":
                    case "binary":
                      return "latin1";
                    case "base64":
                    case "ascii":
                    case "hex":
                      return e;
                    default:
                      if (t) return;
                      (e = ("" + e).toLowerCase()), (t = !0);
                  }
              })(e);
              if ("string" != typeof t && (n.isEncoding === i || !i(e))) throw Error("Unknown encoding: " + e);
              return t || e;
            })(e)),
            this.encoding)
          ) {
            case "utf16le":
              (this.text = l), (this.end = u), (t = 4);
              break;
            case "utf8":
              (this.fillLast = o), (t = 4);
              break;
            case "base64":
              (this.text = d), (this.end = f), (t = 3);
              break;
            default:
              (this.write = h), (this.end = c);
              return;
          }
          (this.lastNeed = 0), (this.lastTotal = 0), (this.lastChar = n.allocUnsafe(t));
        }
        function s(e) {
          return e <= 127 ? 0 : e >> 5 == 6 ? 2 : e >> 4 == 14 ? 3 : e >> 3 == 30 ? 4 : -1;
        }
        function o(e) {
          var t = this.lastTotal - this.lastNeed,
            r = (function (e, t, r) {
              if ((192 & t[0]) != 128) return (e.lastNeed = 0), "�".repeat(r);
              if (e.lastNeed > 1 && t.length > 1) {
                if ((192 & t[1]) != 128) return (e.lastNeed = 1), "�".repeat(r + 1);
                if (e.lastNeed > 2 && t.length > 2 && (192 & t[2]) != 128) return (e.lastNeed = 2), "�".repeat(r + 2);
              }
            })(this, e, t);
          return void 0 !== r
            ? r
            : this.lastNeed <= e.length
              ? (e.copy(this.lastChar, t, 0, this.lastNeed), this.lastChar.toString(this.encoding, 0, this.lastTotal))
              : void (e.copy(this.lastChar, t, 0, e.length), (this.lastNeed -= e.length));
        }
        function l(e, t) {
          if ((e.length - t) % 2 == 0) {
            var r = e.toString("utf16le", t);
            if (r) {
              var n = r.charCodeAt(r.length - 1);
              if (n >= 55296 && n <= 56319)
                return (this.lastNeed = 2), (this.lastTotal = 4), (this.lastChar[0] = e[e.length - 2]), (this.lastChar[1] = e[e.length - 1]), r.slice(0, -1);
            }
            return r;
          }
          return (this.lastNeed = 1), (this.lastTotal = 2), (this.lastChar[0] = e[e.length - 1]), e.toString("utf16le", t, e.length - 1);
        }
        function u(e) {
          var t = e && e.length ? this.write(e) : "";
          if (this.lastNeed) {
            var r = this.lastTotal - this.lastNeed;
            return t + this.lastChar.toString("utf16le", 0, r);
          }
          return t;
        }
        function d(e, t) {
          var r = (e.length - t) % 3;
          return 0 === r
            ? e.toString("base64", t)
            : ((this.lastNeed = 3 - r),
              (this.lastTotal = 3),
              1 === r ? (this.lastChar[0] = e[e.length - 1]) : ((this.lastChar[0] = e[e.length - 2]), (this.lastChar[1] = e[e.length - 1])),
              e.toString("base64", t, e.length - r));
        }
        function f(e) {
          var t = e && e.length ? this.write(e) : "";
          return this.lastNeed ? t + this.lastChar.toString("base64", 0, 3 - this.lastNeed) : t;
        }
        function h(e) {
          return e.toString(this.encoding);
        }
        function c(e) {
          return e && e.length ? this.write(e) : "";
        }
        (t.StringDecoder = a),
          (a.prototype.write = function (e) {
            var t, r;
            if (0 === e.length) return "";
            if (this.lastNeed) {
              if (void 0 === (t = this.fillLast(e))) return "";
              (r = this.lastNeed), (this.lastNeed = 0);
            } else r = 0;
            return r < e.length ? (t ? t + this.text(e, r) : this.text(e, r)) : t || "";
          }),
          (a.prototype.end = function (e) {
            var t = e && e.length ? this.write(e) : "";
            return this.lastNeed ? t + "�".repeat(this.lastTotal - this.lastNeed) : t;
          }),
          (a.prototype.text = function (e, t) {
            var r = (function (e, t, r) {
              var n = t.length - 1;
              if (n < r) return 0;
              var i = s(t[n]);
              return i >= 0
                ? (i > 0 && (e.lastNeed = i - 1), i)
                : --n < r
                  ? 0
                  : (i = s(t[n])) >= 0
                    ? (i > 0 && (e.lastNeed = i - 2), i)
                    : --n < r
                      ? 0
                      : (i = s(t[n])) >= 0
                        ? (i > 0 && (2 === i ? (i = 0) : (e.lastNeed = i - 3)), i)
                        : 0;
            })(this, e, t);
            if (!this.lastNeed) return e.toString("utf8", t);
            this.lastTotal = r;
            var n = e.length - (r - this.lastNeed);
            return e.copy(this.lastChar, 0, n), e.toString("utf8", t, n);
          }),
          (a.prototype.fillLast = function (e) {
            if (this.lastNeed <= e.length)
              return e.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed), this.lastChar.toString(this.encoding, 0, this.lastTotal);
            e.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, e.length), (this.lastNeed -= e.length);
          });
      },
      45554: function (e, t, r) {
        "use strict";
        var n =
            (this && this.__createBinding) ||
            (Object.create
              ? function (e, t, r, n) {
                  void 0 === n && (n = r),
                    Object.defineProperty(e, n, {
                      enumerable: !0,
                      get: function () {
                        return t[r];
                      }
                    });
                }
              : function (e, t, r, n) {
                  void 0 === n && (n = r), (e[n] = t[r]);
                }),
          i =
            (this && this.__exportStar) ||
            function (e, t) {
              for (var r in e) "default" === r || Object.prototype.hasOwnProperty.call(t, r) || n(t, e, r);
            };
        Object.defineProperty(t, "__esModule", { value: !0 }), i(r(5253), t), i(r(70758), t), i(r(62968), t);
      },
      5253: function (e, t, r) {
        "use strict";
        var n =
          (this && this.__importDefault) ||
          function (e) {
            return e && e.__esModule ? e : { default: e };
          };
        Object.defineProperty(t, "__esModule", { value: !0 }),
          (t.validateJsonAndGetSize =
            t.getJsonRpcIdValidator =
            t.assertIsJsonRpcFailure =
            t.isJsonRpcFailure =
            t.assertIsJsonRpcSuccess =
            t.isJsonRpcSuccess =
            t.assertIsJsonRpcRequest =
            t.isJsonRpcRequest =
            t.assertIsJsonRpcNotification =
            t.isJsonRpcNotification =
            t.jsonrpc2 =
            t.isValidJson =
              void 0);
        let i = n(r(69378)),
          a = r(70758);
        function s(e) {
          return !a.hasProperty(e, "id");
        }
        function o(e) {
          return a.hasProperty(e, "id");
        }
        function l(e) {
          return a.hasProperty(e, "result");
        }
        function u(e) {
          return a.hasProperty(e, "error");
        }
        (t.isValidJson = function (e) {
          try {
            return i.default(e, JSON.parse(JSON.stringify(e)));
          } catch (e) {
            return !1;
          }
        }),
          (t.jsonrpc2 = "2.0"),
          (t.isJsonRpcNotification = s),
          (t.assertIsJsonRpcNotification = function (e) {
            if (!s(e)) throw Error("Not a JSON-RPC notification.");
          }),
          (t.isJsonRpcRequest = o),
          (t.assertIsJsonRpcRequest = function (e) {
            if (!o(e)) throw Error("Not a JSON-RPC request.");
          }),
          (t.isJsonRpcSuccess = l),
          (t.assertIsJsonRpcSuccess = function (e) {
            if (!l(e)) throw Error("Not a successful JSON-RPC response.");
          }),
          (t.isJsonRpcFailure = u),
          (t.assertIsJsonRpcFailure = function (e) {
            if (!u(e)) throw Error("Not a failed JSON-RPC response.");
          }),
          (t.getJsonRpcIdValidator = function (e) {
            let { permitEmptyString: t, permitFractions: r, permitNull: n } = Object.assign({ permitEmptyString: !0, permitFractions: !1, permitNull: !0 }, e);
            return e => !!(("number" == typeof e && (r || Number.isInteger(e))) || ("string" == typeof e && (t || e.length > 0)) || (n && null === e));
          }),
          (t.validateJsonAndGetSize = function (e, t = !1) {
            let r = new Set();
            return (function e(t, n) {
              if (void 0 === t) return [!0, 0];
              if (null === t) return [!0, n ? 0 : a.JsonSize.Null];
              let i = typeof t;
              try {
                if ("function" === i) return [!1, 0];
                if ("string" === i || t instanceof String) return [!0, n ? 0 : a.calculateStringSize(t) + 2 * a.JsonSize.Quote];
                if ("boolean" === i || t instanceof Boolean) {
                  if (n) return [!0, 0];
                  return [!0, !0 == t ? a.JsonSize.True : a.JsonSize.False];
                } else if ("number" === i || t instanceof Number) {
                  if (n) return [!0, 0];
                  return [!0, a.calculateNumberSize(t)];
                } else if (t instanceof Date) {
                  if (n) return [!0, 0];
                  return [!0, isNaN(t.getDate()) ? a.JsonSize.Null : a.JsonSize.Date + 2 * a.JsonSize.Quote];
                }
              } catch (e) {
                return [!1, 0];
              }
              if ((!a.isPlainObject(t) && !Array.isArray(t)) || r.has(t)) return [!1, 0];
              r.add(t);
              try {
                return [
                  !0,
                  Object.entries(t).reduce(
                    (i, [s, o], l, u) => {
                      let [d, f] = e(o, n);
                      if (!d) throw Error("JSON validation did not pass. Validation process stopped.");
                      if ((r.delete(t), n)) return 0;
                      if ((0 === f && Array.isArray(t) && (f = a.JsonSize.Null), 0 === f)) return i;
                      let h = Array.isArray(t) ? 0 : s.length + a.JsonSize.Comma + 2 * a.JsonSize.Colon,
                        c = l < u.length - 1 ? a.JsonSize.Comma : 0;
                      return i + h + f + c;
                    },
                    n ? 0 : 2 * a.JsonSize.Wrapper
                  )
                ];
              } catch (e) {
                return [!1, 0];
              }
            })(e, t);
          });
      },
      70758: function (e, t) {
        "use strict";
        var r;
        function n(e) {
          return 127 >= e.charCodeAt(0);
        }
        Object.defineProperty(t, "__esModule", { value: !0 }),
          (t.calculateNumberSize =
            t.calculateStringSize =
            t.isASCII =
            t.isPlainObject =
            t.ESCAPE_CHARACTERS_REGEXP =
            t.JsonSize =
            t.hasProperty =
            t.isObject =
            t.isNullOrUndefined =
            t.isNonEmptyArray =
              void 0),
          (t.isNonEmptyArray = function (e) {
            return Array.isArray(e) && e.length > 0;
          }),
          (t.isNullOrUndefined = function (e) {
            return null == e;
          }),
          (t.isObject = function (e) {
            return !!e && "object" == typeof e && !Array.isArray(e);
          }),
          (t.hasProperty = (e, t) => Object.hasOwnProperty.call(e, t)),
          ((r = t.JsonSize || (t.JsonSize = {}))[(r.Null = 4)] = "Null"),
          (r[(r.Comma = 1)] = "Comma"),
          (r[(r.Wrapper = 1)] = "Wrapper"),
          (r[(r.True = 4)] = "True"),
          (r[(r.False = 5)] = "False"),
          (r[(r.Quote = 1)] = "Quote"),
          (r[(r.Colon = 1)] = "Colon"),
          (r[(r.Date = 24)] = "Date"),
          (t.ESCAPE_CHARACTERS_REGEXP = /"|\\|\n|\r|\t/gu),
          (t.isPlainObject = function (e) {
            if ("object" != typeof e || null === e) return !1;
            try {
              let t = e;
              for (; null !== Object.getPrototypeOf(t); ) t = Object.getPrototypeOf(t);
              return Object.getPrototypeOf(e) === t;
            } catch (e) {
              return !1;
            }
          }),
          (t.isASCII = n),
          (t.calculateStringSize = function (e) {
            var r;
            return (
              e.split("").reduce((e, t) => (n(t) ? e + 1 : e + 2), 0) + (null !== (r = e.match(t.ESCAPE_CHARACTERS_REGEXP)) && void 0 !== r ? r : []).length
            );
          }),
          (t.calculateNumberSize = function (e) {
            return e.toString().length;
          });
      },
      62968: function (e, t) {
        "use strict";
        var r;
        Object.defineProperty(t, "__esModule", { value: !0 }),
          (t.timeSince = t.inMilliseconds = t.Duration = void 0),
          ((r = t.Duration || (t.Duration = {}))[(r.Millisecond = 1)] = "Millisecond"),
          (r[(r.Second = 1e3)] = "Second"),
          (r[(r.Minute = 6e4)] = "Minute"),
          (r[(r.Hour = 36e5)] = "Hour"),
          (r[(r.Day = 864e5)] = "Day"),
          (r[(r.Week = 6048e5)] = "Week"),
          (r[(r.Year = 31536e6)] = "Year");
        let n = e => Number.isInteger(e) && e >= 0,
          i = (e, t) => {
            if (!n(e)) throw Error(`"${t}" must be a non-negative integer. Received: "${e}".`);
          };
        (t.inMilliseconds = function (e, t) {
          return i(e, "count"), e * t;
        }),
          (t.timeSince = function (e) {
            return i(e, "timestamp"), Date.now() - e;
          });
      },
      69378: function (e) {
        "use strict";
        e.exports = function e(t, r) {
          if (t === r) return !0;
          if (t && r && "object" == typeof t && "object" == typeof r) {
            if (t.constructor !== r.constructor) return !1;
            if (Array.isArray(t)) {
              if ((n = t.length) != r.length) return !1;
              for (i = n; 0 != i--; ) if (!e(t[i], r[i])) return !1;
              return !0;
            }
            if (t.constructor === RegExp) return t.source === r.source && t.flags === r.flags;
            if (t.valueOf !== Object.prototype.valueOf) return t.valueOf() === r.valueOf();
            if (t.toString !== Object.prototype.toString) return t.toString() === r.toString();
            if ((n = (a = Object.keys(t)).length) !== Object.keys(r).length) return !1;
            for (i = n; 0 != i--; ) if (!Object.prototype.hasOwnProperty.call(r, a[i])) return !1;
            for (i = n; 0 != i--; ) {
              var n,
                i,
                a,
                s = a[i];
              if (!e(t[s], r[s])) return !1;
            }
            return !0;
          }
          return t != t && r != r;
        };
      },
      82884: function (e, t, r) {
        "use strict";
        var n = r(34406);
        n.version && 0 !== n.version.indexOf("v0.") && (0 !== n.version.indexOf("v1.") || 0 === n.version.indexOf("v1.8."))
          ? (e.exports = n.nextTick)
          : (e.exports = function (e, t, r, i) {
              if ("function" != typeof e) throw TypeError('"callback" argument must be a function');
              var a,
                s,
                o = arguments.length;
              switch (o) {
                case 0:
                case 1:
                  return n.nextTick(e);
                case 2:
                  return n.nextTick(function () {
                    e.call(null, t);
                  });
                case 3:
                  return n.nextTick(function () {
                    e.call(null, t, r);
                  });
                case 4:
                  return n.nextTick(function () {
                    e.call(null, t, r, i);
                  });
                default:
                  for (a = Array(o - 1), s = 0; s < a.length; ) a[s++] = arguments[s];
                  return n.nextTick(function () {
                    e.apply(null, a);
                  });
              }
            });
      }
    }
  ]);
//# sourceMappingURL=7723.js.map
