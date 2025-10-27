/*! For license information please see contentScripts.js.LICENSE.txt */
!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "1fec19f8-7d33-4ad9-93a6-fd0b86d39207"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-1fec19f8-7d33-4ad9-93a6-fd0b86d39207"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
(_global.SENTRY_RELEASE = { id: "0.22.9" }),
  (() => {
    var e = {
        60470: function (e, t, r) {
          "use strict";
          Object.defineProperty(t, "__esModule", { value: !0 }), (t.BasePostMessageStream = void 0);
          let n = r(55800),
            i = () => void 0;
          class o extends n.Duplex {
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
          t.BasePostMessageStream = o;
        },
        6993: function (e, t, r) {
          "use strict";
          Object.defineProperty(t, "__esModule", { value: !0 }), (t.WebWorkerParentPostMessageStream = void 0);
          let n = r(60470),
            i = r(17131);
          class o extends n.BasePostMessageStream {
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
          t.WebWorkerParentPostMessageStream = o;
        },
        70672: function (e, t, r) {
          "use strict";
          Object.defineProperty(t, "__esModule", { value: !0 }), (t.WebWorkerPostMessageStream = void 0);
          let n = r(60470),
            i = r(17131);
          class o extends n.BasePostMessageStream {
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
          t.WebWorkerPostMessageStream = o;
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
          class o extends n.BasePostMessageStream {
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
          t.WindowPostMessageStream = o;
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
          e.exports = h;
          var o = r(7646);
          o.inherits = r(91285);
          var s = r(67187),
            a = r(3597);
          o.inherits(h, s);
          for (var l = i(a.prototype), u = 0; u < l.length; u++) {
            var f = l[u];
            h.prototype[f] || (h.prototype[f] = a.prototype[f]);
          }
          function h(e) {
            if (!(this instanceof h)) return new h(e);
            s.call(this, e),
              a.call(this, e),
              e && !1 === e.readable && (this.readable = !1),
              e && !1 === e.writable && (this.writable = !1),
              (this.allowHalfOpen = !0),
              e && !1 === e.allowHalfOpen && (this.allowHalfOpen = !1),
              this.once("end", c);
          }
          function c() {
            this.allowHalfOpen || this._writableState.ended || n(d, this);
          }
          function d(e) {
            e.end();
          }
          Object.defineProperty(h.prototype, "destroyed", {
            get: function () {
              return void 0 !== this._readableState && void 0 !== this._writableState && this._readableState.destroyed && this._writableState.destroyed;
            },
            set: function (e) {
              void 0 !== this._readableState && void 0 !== this._writableState && ((this._readableState.destroyed = e), (this._writableState.destroyed = e));
            }
          }),
            (h.prototype._destroy = function (e, t) {
              this.push(null), this.end(), n(t, e);
            });
        },
        82598: function (e, t, r) {
          "use strict";
          e.exports = o;
          var n = r(62287),
            i = r(7646);
          function o(e) {
            if (!(this instanceof o)) return new o(e);
            n.call(this, e);
          }
          (i.inherits = r(91285)),
            i.inherits(o, n),
            (o.prototype._transform = function (e, t, r) {
              r(null, e);
            });
        },
        67187: function (e, t, r) {
          "use strict";
          var n,
            i,
            o = r(34406),
            s = r(82884);
          e.exports = v;
          var a = r(89136);
          (v.ReadableState = y), r(22699).EventEmitter;
          var l = function (e, t) {
              return e.listeners(t).length;
            },
            u = r(80979),
            f = r(55691).Buffer,
            h = r.g.Uint8Array || function () {},
            c = r(7646);
          c.inherits = r(91285);
          var d = r(56052),
            g = void 0;
          g = d && d.debuglog ? d.debuglog("stream") : function () {};
          var p = r(78991),
            m = r(48374);
          c.inherits(v, u);
          var b = ["error", "close", "destroy", "pause", "resume"];
          function y(e, t) {
            (n = n || r(31034)),
              (e = e || {}),
              (this.objectMode = !!e.objectMode),
              t instanceof n && (this.objectMode = this.objectMode || !!e.readableObjectMode);
            var o = e.highWaterMark,
              s = this.objectMode ? 16 : 16384;
            (this.highWaterMark = o || 0 === o ? o : s),
              (this.highWaterMark = Math.floor(this.highWaterMark)),
              (this.buffer = new p()),
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
          function v(e) {
            if (((n = n || r(31034)), !(this instanceof v))) return new v(e);
            (this._readableState = new y(e, this)),
              (this.readable = !0),
              e && ("function" == typeof e.read && (this._read = e.read), "function" == typeof e.destroy && (this._destroy = e.destroy)),
              u.call(this);
          }
          function w(e, t, r, n, i) {
            var o,
              s,
              a,
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
                      (t.ended = !0), S(e);
                    }
                  })(e, l))
                : (i ||
                      (a = (function (e, t) {
                        var r;
                        return (
                          !f.isBuffer(t) &&
                            !(t instanceof h) &&
                            "string" != typeof t &&
                            void 0 !== t &&
                            !e.objectMode &&
                            (r = TypeError("Invalid non-string/buffer chunk")),
                          r
                        );
                      })(l, t)),
                    a)
                  ? e.emit("error", a)
                  : l.objectMode || (t && t.length > 0)
                    ? ("string" != typeof t && !l.objectMode && Object.getPrototypeOf(t) !== f.prototype && ((s = t), (t = f.from(s))),
                      n
                        ? l.endEmitted
                          ? e.emit("error", Error("stream.unshift() after end event"))
                          : _(e, l, t, !0)
                        : l.ended
                          ? e.emit("error", Error("stream.push() after EOF"))
                          : ((l.reading = !1),
                            l.decoder && !r ? ((t = l.decoder.write(t)), l.objectMode || 0 !== t.length ? _(e, l, t, !1) : x(e, l)) : _(e, l, t, !1)))
                    : n || (l.reading = !1),
              !(o = l).ended && (o.needReadable || o.length < o.highWaterMark || 0 === o.length)
            );
          }
          function _(e, t, r, n) {
            t.flowing && 0 === t.length && !t.sync
              ? (e.emit("data", r), e.read(0))
              : ((t.length += t.objectMode ? 1 : r.length), n ? t.buffer.unshift(r) : t.buffer.push(r), t.needReadable && S(e)),
              x(e, t);
          }
          function A(e, t) {
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
          function S(e) {
            var t = e._readableState;
            (t.needReadable = !1), t.emittedReadable || (g("emitReadable", t.flowing), (t.emittedReadable = !0), t.sync ? s(E, e) : E(e));
          }
          function E(e) {
            g("emit readable"), e.emit("readable"), M(e);
          }
          function x(e, t) {
            t.readingMore || ((t.readingMore = !0), s(R, e, t));
          }
          function R(e, t) {
            for (
              var r = t.length;
              !t.reading && !t.flowing && !t.ended && t.length < t.highWaterMark && (g("maybeReadMore read 0"), e.read(0), r !== t.length);

            )
              r = t.length;
            t.readingMore = !1;
          }
          function k(e) {
            g("readable nexttick read 0"), e.read(0);
          }
          function T(e, t) {
            t.reading || (g("resume read 0"), e.read(0)),
              (t.resumeScheduled = !1),
              (t.awaitDrain = 0),
              e.emit("resume"),
              M(e),
              t.flowing && !t.reading && e.read(0);
          }
          function M(e) {
            var t = e._readableState;
            for (g("flow", t.flowing); t.flowing && null !== e.read(); );
          }
          function O(e, t) {
            var r, n, i, o, s;
            return 0 === t.length
              ? null
              : (t.objectMode
                  ? (r = t.buffer.shift())
                  : !e || e >= t.length
                    ? ((r = t.decoder ? t.buffer.join("") : 1 === t.buffer.length ? t.buffer.head.data : t.buffer.concat(t.length)), t.buffer.clear())
                    : ((n = e),
                      (i = t.buffer),
                      (o = t.decoder),
                      n < i.head.data.length
                        ? ((s = i.head.data.slice(0, n)), (i.head.data = i.head.data.slice(n)))
                        : (s =
                            n === i.head.data.length
                              ? i.shift()
                              : o
                                ? (function (e, t) {
                                    var r = t.head,
                                      n = 1,
                                      i = r.data;
                                    for (e -= i.length; (r = r.next); ) {
                                      var o = r.data,
                                        s = e > o.length ? o.length : e;
                                      if ((s === o.length ? (i += o) : (i += o.slice(0, e)), 0 == (e -= s))) {
                                        s === o.length ? (++n, r.next ? (t.head = r.next) : (t.head = t.tail = null)) : ((t.head = r), (r.data = o.slice(s)));
                                        break;
                                      }
                                      ++n;
                                    }
                                    return (t.length -= n), i;
                                  })(n, i)
                                : (function (e, t) {
                                    var r = f.allocUnsafe(e),
                                      n = t.head,
                                      i = 1;
                                    for (n.data.copy(r), e -= n.data.length; (n = n.next); ) {
                                      var o = n.data,
                                        s = e > o.length ? o.length : e;
                                      if ((o.copy(r, r.length - e, 0, s), 0 == (e -= s))) {
                                        s === o.length ? (++i, n.next ? (t.head = n.next) : (t.head = t.tail = null)) : ((t.head = n), (n.data = o.slice(s)));
                                        break;
                                      }
                                      ++i;
                                    }
                                    return (t.length -= i), r;
                                  })(n, i)),
                      (r = s)),
                r);
          }
          function C(e) {
            var t = e._readableState;
            if (t.length > 0) throw Error('"endReadable()" called on non-empty stream');
            t.endEmitted || ((t.ended = !0), s(L, t, e));
          }
          function L(e, t) {
            e.endEmitted || 0 !== e.length || ((e.endEmitted = !0), (t.readable = !1), t.emit("end"));
          }
          function j(e, t) {
            for (var r = 0, n = e.length; r < n; r++) if (e[r] === t) return r;
            return -1;
          }
          Object.defineProperty(v.prototype, "destroyed", {
            get: function () {
              return void 0 !== this._readableState && this._readableState.destroyed;
            },
            set: function (e) {
              this._readableState && (this._readableState.destroyed = e);
            }
          }),
            (v.prototype.destroy = m.destroy),
            (v.prototype._undestroy = m.undestroy),
            (v.prototype._destroy = function (e, t) {
              this.push(null), t(e);
            }),
            (v.prototype.push = function (e, t) {
              var r,
                n = this._readableState;
              return (
                n.objectMode ? (r = !0) : "string" == typeof e && ((t = t || n.defaultEncoding) !== n.encoding && ((e = f.from(e, t)), (t = "")), (r = !0)),
                w(this, e, t, !1, r)
              );
            }),
            (v.prototype.unshift = function (e) {
              return w(this, e, null, !0, !1);
            }),
            (v.prototype.isPaused = function () {
              return !1 === this._readableState.flowing;
            }),
            (v.prototype.setEncoding = function (e) {
              return i || (i = r(35099).StringDecoder), (this._readableState.decoder = new i(e)), (this._readableState.encoding = e), this;
            }),
            (v.prototype.read = function (e) {
              g("read", e), (e = parseInt(e, 10));
              var t,
                r = this._readableState,
                n = e;
              if ((0 !== e && (r.emittedReadable = !1), 0 === e && r.needReadable && (r.length >= r.highWaterMark || r.ended)))
                return g("read: emitReadable", r.length, r.ended), 0 === r.length && r.ended ? C(this) : S(this), null;
              if (0 === (e = A(e, r)) && r.ended) return 0 === r.length && C(this), null;
              var i = r.needReadable;
              return (
                g("need readable", i),
                (0 === r.length || r.length - e < r.highWaterMark) && g("length less than watermark", (i = !0)),
                r.ended || r.reading
                  ? g("reading or ended", (i = !1))
                  : i &&
                    (g("do read"),
                    (r.reading = !0),
                    (r.sync = !0),
                    0 === r.length && (r.needReadable = !0),
                    this._read(r.highWaterMark),
                    (r.sync = !1),
                    r.reading || (e = A(n, r))),
                null === (t = e > 0 ? O(e, r) : null) ? ((r.needReadable = !0), (e = 0)) : (r.length -= e),
                0 === r.length && (r.ended || (r.needReadable = !0), n !== e && r.ended && C(this)),
                null !== t && this.emit("data", t),
                t
              );
            }),
            (v.prototype._read = function (e) {
              this.emit("error", Error("_read() is not implemented"));
            }),
            (v.prototype.pipe = function (e, t) {
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
              (i.pipesCount += 1), g("pipe count=%d opts=%j", i.pipesCount, t);
              var u = (t && !1 === t.end) || e === o.stdout || e === o.stderr ? v : f;
              function f() {
                g("onend"), e.end();
              }
              i.endEmitted ? s(u) : n.once("end", u),
                e.on("unpipe", function t(r, o) {
                  g("onunpipe"),
                    r === n &&
                      o &&
                      !1 === o.hasUnpiped &&
                      ((o.hasUnpiped = !0),
                      g("cleanup"),
                      e.removeListener("close", b),
                      e.removeListener("finish", y),
                      e.removeListener("drain", h),
                      e.removeListener("error", m),
                      e.removeListener("unpipe", t),
                      n.removeListener("end", f),
                      n.removeListener("end", v),
                      n.removeListener("data", p),
                      (c = !0),
                      i.awaitDrain && (!e._writableState || e._writableState.needDrain) && h());
                });
              var h =
                ((r = n),
                function () {
                  var e = r._readableState;
                  g("pipeOnDrain", e.awaitDrain), e.awaitDrain && e.awaitDrain--, 0 === e.awaitDrain && l(r, "data") && ((e.flowing = !0), M(r));
                });
              e.on("drain", h);
              var c = !1,
                d = !1;
              function p(t) {
                g("ondata"),
                  (d = !1),
                  !1 !== e.write(t) ||
                    d ||
                    (((1 === i.pipesCount && i.pipes === e) || (i.pipesCount > 1 && -1 !== j(i.pipes, e))) &&
                      !c &&
                      (g("false write response, pause", n._readableState.awaitDrain), n._readableState.awaitDrain++, (d = !0)),
                    n.pause());
              }
              function m(t) {
                g("onerror", t), v(), e.removeListener("error", m), 0 === l(e, "error") && e.emit("error", t);
              }
              function b() {
                e.removeListener("finish", y), v();
              }
              function y() {
                g("onfinish"), e.removeListener("close", b), v();
              }
              function v() {
                g("unpipe"), n.unpipe(e);
              }
              return (
                n.on("data", p),
                (function (e, t, r) {
                  if ("function" == typeof e.prependListener) return e.prependListener(t, r);
                  e._events && e._events[t] ? (a(e._events[t]) ? e._events[t].unshift(r) : (e._events[t] = [r, e._events[t]])) : e.on(t, r);
                })(e, "error", m),
                e.once("close", b),
                e.once("finish", y),
                e.emit("pipe", n),
                i.flowing || (g("pipe resume"), n.resume()),
                e
              );
            }),
            (v.prototype.unpipe = function (e) {
              var t = this._readableState,
                r = { hasUnpiped: !1 };
              if (0 === t.pipesCount) return this;
              if (1 === t.pipesCount)
                return (
                  (e && e !== t.pipes) || (e || (e = t.pipes), (t.pipes = null), (t.pipesCount = 0), (t.flowing = !1), e && e.emit("unpipe", this, r)), this
                );
              if (!e) {
                var n = t.pipes,
                  i = t.pipesCount;
                (t.pipes = null), (t.pipesCount = 0), (t.flowing = !1);
                for (var o = 0; o < i; o++) n[o].emit("unpipe", this, r);
                return this;
              }
              var s = j(t.pipes, e);
              return -1 === s || (t.pipes.splice(s, 1), (t.pipesCount -= 1), 1 === t.pipesCount && (t.pipes = t.pipes[0]), e.emit("unpipe", this, r)), this;
            }),
            (v.prototype.on = function (e, t) {
              var r = u.prototype.on.call(this, e, t);
              if ("data" === e) !1 !== this._readableState.flowing && this.resume();
              else if ("readable" === e) {
                var n = this._readableState;
                n.endEmitted ||
                  n.readableListening ||
                  ((n.readableListening = n.needReadable = !0), (n.emittedReadable = !1), n.reading ? n.length && S(this) : s(k, this));
              }
              return r;
            }),
            (v.prototype.addListener = v.prototype.on),
            (v.prototype.resume = function () {
              var e,
                t,
                r = this._readableState;
              return r.flowing || (g("resume"), (r.flowing = !0), (e = this), (t = r).resumeScheduled || ((t.resumeScheduled = !0), s(T, e, t))), this;
            }),
            (v.prototype.pause = function () {
              return (
                g("call pause flowing=%j", this._readableState.flowing),
                !1 !== this._readableState.flowing && (g("pause"), (this._readableState.flowing = !1), this.emit("pause")),
                this
              );
            }),
            (v.prototype.wrap = function (e) {
              var t = this._readableState,
                r = !1,
                n = this;
              for (var i in (e.on("end", function () {
                if ((g("wrapped end"), t.decoder && !t.ended)) {
                  var e = t.decoder.end();
                  e && e.length && n.push(e);
                }
                n.push(null);
              }),
              e.on("data", function (i) {
                if ((g("wrapped data"), t.decoder && (i = t.decoder.write(i)), !t.objectMode || null != i))
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
              for (var o = 0; o < b.length; o++) e.on(b[o], n.emit.bind(n, b[o]));
              return (
                (n._read = function (t) {
                  g("wrapped _read", t), r && ((r = !1), e.resume());
                }),
                n
              );
            }),
            (v._fromList = O);
        },
        62287: function (e, t, r) {
          "use strict";
          e.exports = s;
          var n = r(31034),
            i = r(7646);
          function o(e) {
            (this.afterTransform = function (t, r) {
              return (function (e, t, r) {
                var n = e._transformState;
                n.transforming = !1;
                var i = n.writecb;
                if (!i) return e.emit("error", Error("write callback called multiple times"));
                (n.writechunk = null), (n.writecb = null), null != r && e.push(r), i(t);
                var o = e._readableState;
                (o.reading = !1), (o.needReadable || o.length < o.highWaterMark) && e._read(o.highWaterMark);
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
            n.call(this, e), (this._transformState = new o(this));
            var t = this;
            (this._readableState.needReadable = !0),
              (this._readableState.sync = !1),
              e && ("function" == typeof e.transform && (this._transform = e.transform), "function" == typeof e.flush && (this._flush = e.flush)),
              this.once("prefinish", function () {
                "function" == typeof this._flush
                  ? this._flush(function (e, r) {
                      a(t, e, r);
                    })
                  : a(t);
              });
          }
          function a(e, t, r) {
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
            o = r(34406),
            s = r(82884);
          function a(e) {
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
          e.exports = b;
          var l = !o.browser && ["v0.10", "v0.9."].indexOf(o.version.slice(0, 5)) > -1 ? setImmediate : s;
          b.WritableState = m;
          var u = r(7646);
          u.inherits = r(91285);
          var f = { deprecate: r(5803) },
            h = r(80979),
            c = r(55691).Buffer,
            d = r.g.Uint8Array || function () {},
            g = r(48374);
          function p() {}
          function m(e, t) {
            (n = n || r(31034)),
              (e = e || {}),
              (this.objectMode = !!e.objectMode),
              t instanceof n && (this.objectMode = this.objectMode || !!e.writableObjectMode);
            var i = e.highWaterMark,
              o = this.objectMode ? 16 : 16384;
            (this.highWaterMark = i || 0 === i ? i : o),
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
                        ? (s(i, t), s(S, e, r), (e._writableState.errorEmitted = !0), e.emit("error", t))
                        : (i(t), (e._writableState.errorEmitted = !0), e.emit("error", t), S(e, r));
                  else {
                    var o = _(r);
                    o || r.corked || r.bufferProcessing || !r.bufferedRequest || w(e, r), n ? l(v, e, r, o, i) : v(e, r, o, i);
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
              (this.corkedRequestsFree = new a(this));
          }
          function b(e) {
            if (((n = n || r(31034)), !i.call(b, this) && !(this instanceof n))) return new b(e);
            (this._writableState = new m(e, this)),
              (this.writable = !0),
              e &&
                ("function" == typeof e.write && (this._write = e.write),
                "function" == typeof e.writev && (this._writev = e.writev),
                "function" == typeof e.destroy && (this._destroy = e.destroy),
                "function" == typeof e.final && (this._final = e.final)),
              h.call(this);
          }
          function y(e, t, r, n, i, o, s) {
            (t.writelen = n), (t.writecb = s), (t.writing = !0), (t.sync = !0), r ? e._writev(i, t.onwrite) : e._write(i, o, t.onwrite), (t.sync = !1);
          }
          function v(e, t, r, n) {
            var i, o;
            r || ((i = e), 0 === (o = t).length && o.needDrain && ((o.needDrain = !1), i.emit("drain"))), t.pendingcb--, n(), S(e, t);
          }
          function w(e, t) {
            t.bufferProcessing = !0;
            var r = t.bufferedRequest;
            if (e._writev && r && r.next) {
              var n = Array(t.bufferedRequestCount),
                i = t.corkedRequestsFree;
              i.entry = r;
              for (var o = 0, s = !0; r; ) (n[o] = r), r.isBuf || (s = !1), (r = r.next), (o += 1);
              (n.allBuffers = s),
                y(e, t, !0, t.length, n, "", i.finish),
                t.pendingcb++,
                (t.lastBufferedRequest = null),
                i.next ? ((t.corkedRequestsFree = i.next), (i.next = null)) : (t.corkedRequestsFree = new a(t));
            } else {
              for (; r; ) {
                var l = r.chunk,
                  u = r.encoding,
                  f = r.callback,
                  h = t.objectMode ? 1 : l.length;
                if ((y(e, t, !1, h, l, u, f), (r = r.next), t.writing)) break;
              }
              null === r && (t.lastBufferedRequest = null);
            }
            (t.bufferedRequestCount = 0), (t.bufferedRequest = r), (t.bufferProcessing = !1);
          }
          function _(e) {
            return e.ending && 0 === e.length && null === e.bufferedRequest && !e.finished && !e.writing;
          }
          function A(e, t) {
            e._final(function (r) {
              t.pendingcb--, r && e.emit("error", r), (t.prefinished = !0), e.emit("prefinish"), S(e, t);
            });
          }
          function S(e, t) {
            var r = _(t);
            return (
              r &&
                (t.prefinished ||
                  t.finalCalled ||
                  ("function" == typeof e._final ? (t.pendingcb++, (t.finalCalled = !0), s(A, e, t)) : ((t.prefinished = !0), e.emit("prefinish"))),
                0 === t.pendingcb && ((t.finished = !0), e.emit("finish"))),
              r
            );
          }
          u.inherits(b, h),
            (m.prototype.getBuffer = function () {
              for (var e = this.bufferedRequest, t = []; e; ) t.push(e), (e = e.next);
              return t;
            }),
            (function () {
              try {
                Object.defineProperty(m.prototype, "buffer", {
                  get: f.deprecate(
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
                Object.defineProperty(b, Symbol.hasInstance, {
                  value: function (e) {
                    return !!i.call(this, e) || (e && e._writableState instanceof m);
                  }
                }))
              : (i = function (e) {
                  return e instanceof this;
                }),
            (b.prototype.pipe = function () {
              this.emit("error", Error("Cannot pipe, not readable"));
            }),
            (b.prototype.write = function (e, t, r) {
              var n,
                i,
                o,
                a,
                l,
                u,
                f,
                h,
                g = this._writableState,
                m = !1,
                b = ((n = e), (c.isBuffer(n) || n instanceof d) && !g.objectMode);
              return (
                b && !c.isBuffer(e) && ((i = e), (e = c.from(i))),
                ("function" == typeof t && ((r = t), (t = null)), b ? (t = "buffer") : t || (t = g.defaultEncoding), "function" != typeof r && (r = p), g.ended)
                  ? ((o = r), (a = Error("write after end")), this.emit("error", a), s(o, a))
                  : (b ||
                      ((l = e),
                      (u = r),
                      (f = !0),
                      (h = !1),
                      null === l
                        ? (h = TypeError("May not write null values to stream"))
                        : "string" == typeof l || void 0 === l || g.objectMode || (h = TypeError("Invalid non-string/buffer chunk")),
                      h && (this.emit("error", h), s(u, h), (f = !1)),
                      f)) &&
                    (g.pendingcb++,
                    (m = (function (e, t, r, n, i, o) {
                      if (!r) {
                        var s,
                          a,
                          l = ((s = n), (a = i), t.objectMode || !1 === t.decodeStrings || "string" != typeof s || (s = c.from(s, a)), s);
                        n !== l && ((r = !0), (i = "buffer"), (n = l));
                      }
                      var u = t.objectMode ? 1 : n.length;
                      t.length += u;
                      var f = t.length < t.highWaterMark;
                      if ((f || (t.needDrain = !0), t.writing || t.corked)) {
                        var h = t.lastBufferedRequest;
                        (t.lastBufferedRequest = { chunk: n, encoding: i, isBuf: r, callback: o, next: null }),
                          h ? (h.next = t.lastBufferedRequest) : (t.bufferedRequest = t.lastBufferedRequest),
                          (t.bufferedRequestCount += 1);
                      } else y(e, t, !1, u, n, i, o);
                      return f;
                    })(this, g, b, e, t, r))),
                m
              );
            }),
            (b.prototype.cork = function () {
              var e = this._writableState;
              e.corked++;
            }),
            (b.prototype.uncork = function () {
              var e = this._writableState;
              !e.corked || (e.corked--, e.writing || e.corked || e.finished || e.bufferProcessing || !e.bufferedRequest || w(this, e));
            }),
            (b.prototype.setDefaultEncoding = function (e) {
              if (
                ("string" == typeof e && (e = e.toLowerCase()),
                !(["hex", "utf8", "utf-8", "ascii", "binary", "base64", "ucs2", "ucs-2", "utf16le", "utf-16le", "raw"].indexOf((e + "").toLowerCase()) > -1))
              )
                throw TypeError("Unknown encoding: " + e);
              return (this._writableState.defaultEncoding = e), this;
            }),
            (b.prototype._write = function (e, t, r) {
              r(Error("_write() is not implemented"));
            }),
            (b.prototype._writev = null),
            (b.prototype.end = function (e, t, r) {
              var n,
                i,
                o,
                a = this._writableState;
              "function" == typeof e ? ((r = e), (e = null), (t = null)) : "function" == typeof t && ((r = t), (t = null)),
                null != e && this.write(e, t),
                a.corked && ((a.corked = 1), this.uncork()),
                a.ending ||
                  a.finished ||
                  ((n = this), (i = a), (o = r), (i.ending = !0), S(n, i), o && (i.finished ? s(o) : n.once("finish", o)), (i.ended = !0), (n.writable = !1));
            }),
            Object.defineProperty(b.prototype, "destroyed", {
              get: function () {
                return void 0 !== this._writableState && this._writableState.destroyed;
              },
              set: function (e) {
                this._writableState && (this._writableState.destroyed = e);
              }
            }),
            (b.prototype.destroy = g.destroy),
            (b.prototype._undestroy = g.undestroy),
            (b.prototype._destroy = function (e, t) {
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
                o = this._readableState && this._readableState.destroyed,
                s = this._writableState && this._writableState.destroyed;
              if (o || s) {
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
          function o(e, t) {
            for (var r in e) t[r] = e[r];
          }
          function s(e, t, r) {
            return i(e, t, r);
          }
          i.from && i.alloc && i.allocUnsafe && i.allocUnsafeSlow ? (e.exports = n) : (o(n, t), (t.Buffer = s)),
            o(i, s),
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
          function o(e) {
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
                (this.fillLast = a), (t = 4);
                break;
              case "base64":
                (this.text = f), (this.end = h), (t = 3);
                break;
              default:
                (this.write = c), (this.end = d);
                return;
            }
            (this.lastNeed = 0), (this.lastTotal = 0), (this.lastChar = n.allocUnsafe(t));
          }
          function s(e) {
            return e <= 127 ? 0 : e >> 5 == 6 ? 2 : e >> 4 == 14 ? 3 : e >> 3 == 30 ? 4 : -1;
          }
          function a(e) {
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
          function f(e, t) {
            var r = (e.length - t) % 3;
            return 0 === r
              ? e.toString("base64", t)
              : ((this.lastNeed = 3 - r),
                (this.lastTotal = 3),
                1 === r ? (this.lastChar[0] = e[e.length - 1]) : ((this.lastChar[0] = e[e.length - 2]), (this.lastChar[1] = e[e.length - 1])),
                e.toString("base64", t, e.length - r));
          }
          function h(e) {
            var t = e && e.length ? this.write(e) : "";
            return this.lastNeed ? t + this.lastChar.toString("base64", 0, 3 - this.lastNeed) : t;
          }
          function c(e) {
            return e.toString(this.encoding);
          }
          function d(e) {
            return e && e.length ? this.write(e) : "";
          }
          (t.StringDecoder = o),
            (o.prototype.write = function (e) {
              var t, r;
              if (0 === e.length) return "";
              if (this.lastNeed) {
                if (void 0 === (t = this.fillLast(e))) return "";
                (r = this.lastNeed), (this.lastNeed = 0);
              } else r = 0;
              return r < e.length ? (t ? t + this.text(e, r) : this.text(e, r)) : t || "";
            }),
            (o.prototype.end = function (e) {
              var t = e && e.length ? this.write(e) : "";
              return this.lastNeed ? t + "�".repeat(this.lastTotal - this.lastNeed) : t;
            }),
            (o.prototype.text = function (e, t) {
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
            (o.prototype.fillLast = function (e) {
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
          Object.defineProperty(t, "__esModule", { value: !0 }), i(r(49545), t), i(r(70758), t), i(r(62968), t);
        },
        49545: function (e, t, r) {
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
            o = r(70758);
          function s(e) {
            return !o.hasProperty(e, "id");
          }
          function a(e) {
            return o.hasProperty(e, "id");
          }
          function l(e) {
            return o.hasProperty(e, "result");
          }
          function u(e) {
            return o.hasProperty(e, "error");
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
            (t.isJsonRpcRequest = a),
            (t.assertIsJsonRpcRequest = function (e) {
              if (!a(e)) throw Error("Not a JSON-RPC request.");
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
              let {
                permitEmptyString: t,
                permitFractions: r,
                permitNull: n
              } = Object.assign({ permitEmptyString: !0, permitFractions: !1, permitNull: !0 }, e);
              return e => !!(("number" == typeof e && (r || Number.isInteger(e))) || ("string" == typeof e && (t || e.length > 0)) || (n && null === e));
            }),
            (t.validateJsonAndGetSize = function (e, t = !1) {
              let r = new Set();
              return (function e(t, n) {
                if (void 0 === t) return [!0, 0];
                if (null === t) return [!0, n ? 0 : o.JsonSize.Null];
                let i = typeof t;
                try {
                  if ("function" === i) return [!1, 0];
                  if ("string" === i || t instanceof String) return [!0, n ? 0 : o.calculateStringSize(t) + 2 * o.JsonSize.Quote];
                  if ("boolean" === i || t instanceof Boolean) {
                    if (n) return [!0, 0];
                    return [!0, !0 == t ? o.JsonSize.True : o.JsonSize.False];
                  } else if ("number" === i || t instanceof Number) {
                    if (n) return [!0, 0];
                    return [!0, o.calculateNumberSize(t)];
                  } else if (t instanceof Date) {
                    if (n) return [!0, 0];
                    return [!0, isNaN(t.getDate()) ? o.JsonSize.Null : o.JsonSize.Date + 2 * o.JsonSize.Quote];
                  }
                } catch (e) {
                  return [!1, 0];
                }
                if ((!o.isPlainObject(t) && !Array.isArray(t)) || r.has(t)) return [!1, 0];
                r.add(t);
                try {
                  return [
                    !0,
                    Object.entries(t).reduce(
                      (i, [s, a], l, u) => {
                        let [f, h] = e(a, n);
                        if (!f) throw Error("JSON validation did not pass. Validation process stopped.");
                        if ((r.delete(t), n)) return 0;
                        if ((0 === h && Array.isArray(t) && (h = o.JsonSize.Null), 0 === h)) return i;
                        let c = Array.isArray(t) ? 0 : s.length + o.JsonSize.Comma + 2 * o.JsonSize.Colon,
                          d = l < u.length - 1 ? o.JsonSize.Comma : 0;
                        return i + c + h + d;
                      },
                      n ? 0 : 2 * o.JsonSize.Wrapper
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
        95766: function (e, t) {
          "use strict";
          (t.byteLength = function (e) {
            var t = l(e),
              r = t[0],
              n = t[1];
            return ((r + n) * 3) / 4 - n;
          }),
            (t.toByteArray = function (e) {
              var t,
                r,
                o = l(e),
                s = o[0],
                a = o[1],
                u = new i(((s + a) * 3) / 4 - a),
                f = 0,
                h = a > 0 ? s - 4 : s;
              for (r = 0; r < h; r += 4)
                (t = (n[e.charCodeAt(r)] << 18) | (n[e.charCodeAt(r + 1)] << 12) | (n[e.charCodeAt(r + 2)] << 6) | n[e.charCodeAt(r + 3)]),
                  (u[f++] = (t >> 16) & 255),
                  (u[f++] = (t >> 8) & 255),
                  (u[f++] = 255 & t);
              return (
                2 === a && ((t = (n[e.charCodeAt(r)] << 2) | (n[e.charCodeAt(r + 1)] >> 4)), (u[f++] = 255 & t)),
                1 === a &&
                  ((t = (n[e.charCodeAt(r)] << 10) | (n[e.charCodeAt(r + 1)] << 4) | (n[e.charCodeAt(r + 2)] >> 2)),
                  (u[f++] = (t >> 8) & 255),
                  (u[f++] = 255 & t)),
                u
              );
            }),
            (t.fromByteArray = function (e) {
              for (var t, n = e.length, i = n % 3, o = [], s = 0, a = n - i; s < a; s += 16383)
                o.push(
                  (function (e, t, n) {
                    for (var i, o = [], s = t; s < n; s += 3)
                      (i = ((e[s] << 16) & 0xff0000) + ((e[s + 1] << 8) & 65280) + (255 & e[s + 2])),
                        o.push(r[(i >> 18) & 63] + r[(i >> 12) & 63] + r[(i >> 6) & 63] + r[63 & i]);
                    return o.join("");
                  })(e, s, s + 16383 > a ? a : s + 16383)
                );
              return (
                1 === i
                  ? o.push(r[(t = e[n - 1]) >> 2] + r[(t << 4) & 63] + "==")
                  : 2 === i && o.push(r[(t = (e[n - 2] << 8) + e[n - 1]) >> 10] + r[(t >> 4) & 63] + r[(t << 2) & 63] + "="),
                o.join("")
              );
            });
          for (
            var r = [],
              n = [],
              i = "undefined" != typeof Uint8Array ? Uint8Array : Array,
              o = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",
              s = 0,
              a = o.length;
            s < a;
            ++s
          )
            (r[s] = o[s]), (n[o.charCodeAt(s)] = s);
          function l(e) {
            var t = e.length;
            if (t % 4 > 0) throw Error("Invalid string. Length must be a multiple of 4");
            var r = e.indexOf("=");
            -1 === r && (r = t);
            var n = r === t ? 0 : 4 - (r % 4);
            return [r, n];
          }
          (n["-".charCodeAt(0)] = 62), (n["_".charCodeAt(0)] = 63);
        },
        48834: function (e, t, r) {
          "use strict";
          let n = r(95766),
            i = r(62333),
            o = "function" == typeof Symbol && "function" == typeof Symbol.for ? Symbol.for("nodejs.util.inspect.custom") : null;
          function s(e) {
            if (e > 0x7fffffff) throw RangeError('The value "' + e + '" is invalid for option "size"');
            let t = new Uint8Array(e);
            return Object.setPrototypeOf(t, a.prototype), t;
          }
          function a(e, t, r) {
            if ("number" == typeof e) {
              if ("string" == typeof t) throw TypeError('The "string" argument must be of type string. Received type number');
              return f(e);
            }
            return l(e, t, r);
          }
          function l(e, t, r) {
            if ("string" == typeof e)
              return (function (e, t) {
                if ((("string" != typeof t || "" === t) && (t = "utf8"), !a.isEncoding(t))) throw TypeError("Unknown encoding: " + t);
                let r = 0 | g(e, t),
                  n = s(r),
                  i = n.write(e, t);
                return i !== r && (n = n.slice(0, i)), n;
              })(e, t);
            if (ArrayBuffer.isView(e))
              return (function (e) {
                if (I(e, Uint8Array)) {
                  let t = new Uint8Array(e);
                  return c(t.buffer, t.byteOffset, t.byteLength);
                }
                return h(e);
              })(e);
            if (null == e)
              throw TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof e);
            if (
              I(e, ArrayBuffer) ||
              (e && I(e.buffer, ArrayBuffer)) ||
              ("undefined" != typeof SharedArrayBuffer && (I(e, SharedArrayBuffer) || (e && I(e.buffer, SharedArrayBuffer))))
            )
              return c(e, t, r);
            if ("number" == typeof e) throw TypeError('The "value" argument must not be of type number. Received type number');
            let n = e.valueOf && e.valueOf();
            if (null != n && n !== e) return a.from(n, t, r);
            let i = (function (e) {
              if (a.isBuffer(e)) {
                let t = 0 | d(e.length),
                  r = s(t);
                return 0 === r.length || e.copy(r, 0, 0, t), r;
              }
              return void 0 !== e.length
                ? "number" != typeof e.length ||
                  (function (e) {
                    return e != e;
                  })(e.length)
                  ? s(0)
                  : h(e)
                : "Buffer" === e.type && Array.isArray(e.data)
                  ? h(e.data)
                  : void 0;
            })(e);
            if (i) return i;
            if ("undefined" != typeof Symbol && null != Symbol.toPrimitive && "function" == typeof e[Symbol.toPrimitive])
              return a.from(e[Symbol.toPrimitive]("string"), t, r);
            throw TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof e);
          }
          function u(e) {
            if ("number" != typeof e) throw TypeError('"size" argument must be of type number');
            if (e < 0) throw RangeError('The value "' + e + '" is invalid for option "size"');
          }
          function f(e) {
            return u(e), s(e < 0 ? 0 : 0 | d(e));
          }
          function h(e) {
            let t = e.length < 0 ? 0 : 0 | d(e.length),
              r = s(t);
            for (let n = 0; n < t; n += 1) r[n] = 255 & e[n];
            return r;
          }
          function c(e, t, r) {
            let n;
            if (t < 0 || e.byteLength < t) throw RangeError('"offset" is outside of buffer bounds');
            if (e.byteLength < t + (r || 0)) throw RangeError('"length" is outside of buffer bounds');
            return (
              Object.setPrototypeOf(
                (n = void 0 === t && void 0 === r ? new Uint8Array(e) : void 0 === r ? new Uint8Array(e, t) : new Uint8Array(e, t, r)),
                a.prototype
              ),
              n
            );
          }
          function d(e) {
            if (e >= 0x7fffffff) throw RangeError("Attempt to allocate Buffer larger than maximum size: 0x7fffffff bytes");
            return 0 | e;
          }
          function g(e, t) {
            if (a.isBuffer(e)) return e.length;
            if (ArrayBuffer.isView(e) || I(e, ArrayBuffer)) return e.byteLength;
            if ("string" != typeof e) throw TypeError('The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type ' + typeof e);
            let r = e.length,
              n = arguments.length > 2 && !0 === arguments[2];
            if (!n && 0 === r) return 0;
            let i = !1;
            for (;;)
              switch (t) {
                case "ascii":
                case "latin1":
                case "binary":
                  return r;
                case "utf8":
                case "utf-8":
                  return B(e).length;
                case "ucs2":
                case "ucs-2":
                case "utf16le":
                case "utf-16le":
                  return 2 * r;
                case "hex":
                  return r >>> 1;
                case "base64":
                  return P(e).length;
                default:
                  if (i) return n ? -1 : B(e).length;
                  (t = ("" + t).toLowerCase()), (i = !0);
              }
          }
          function p(e, t, r) {
            let i = !1;
            if (
              ((void 0 === t || t < 0) && (t = 0),
              t > this.length || ((void 0 === r || r > this.length) && (r = this.length), r <= 0 || (r >>>= 0) <= (t >>>= 0)))
            )
              return "";
            for (e || (e = "utf8"); ; )
              switch (e) {
                case "hex":
                  return (function (e, t, r) {
                    let n = e.length;
                    (!t || t < 0) && (t = 0), (!r || r < 0 || r > n) && (r = n);
                    let i = "";
                    for (let n = t; n < r; ++n) i += D[e[n]];
                    return i;
                  })(this, t, r);
                case "utf8":
                case "utf-8":
                  return v(this, t, r);
                case "ascii":
                  return (function (e, t, r) {
                    let n = "";
                    r = Math.min(e.length, r);
                    for (let i = t; i < r; ++i) n += String.fromCharCode(127 & e[i]);
                    return n;
                  })(this, t, r);
                case "latin1":
                case "binary":
                  return (function (e, t, r) {
                    let n = "";
                    r = Math.min(e.length, r);
                    for (let i = t; i < r; ++i) n += String.fromCharCode(e[i]);
                    return n;
                  })(this, t, r);
                case "base64":
                  var o, s, a;
                  return (o = this), (s = t), (a = r), 0 === s && a === o.length ? n.fromByteArray(o) : n.fromByteArray(o.slice(s, a));
                case "ucs2":
                case "ucs-2":
                case "utf16le":
                case "utf-16le":
                  return (function (e, t, r) {
                    let n = e.slice(t, r),
                      i = "";
                    for (let e = 0; e < n.length - 1; e += 2) i += String.fromCharCode(n[e] + 256 * n[e + 1]);
                    return i;
                  })(this, t, r);
                default:
                  if (i) throw TypeError("Unknown encoding: " + e);
                  (e = (e + "").toLowerCase()), (i = !0);
              }
          }
          function m(e, t, r) {
            let n = e[t];
            (e[t] = e[r]), (e[r] = n);
          }
          function b(e, t, r, n, i) {
            var o;
            if (0 === e.length) return -1;
            if (
              ("string" == typeof r ? ((n = r), (r = 0)) : r > 0x7fffffff ? (r = 0x7fffffff) : r < -0x80000000 && (r = -0x80000000),
              (o = r *= 1) != o && (r = i ? 0 : e.length - 1),
              r < 0 && (r = e.length + r),
              r >= e.length)
            ) {
              if (i) return -1;
              r = e.length - 1;
            } else if (r < 0) {
              if (!i) return -1;
              r = 0;
            }
            if (("string" == typeof t && (t = a.from(t, n)), a.isBuffer(t))) return 0 === t.length ? -1 : y(e, t, r, n, i);
            if ("number" == typeof t)
              return ((t &= 255), "function" == typeof Uint8Array.prototype.indexOf)
                ? i
                  ? Uint8Array.prototype.indexOf.call(e, t, r)
                  : Uint8Array.prototype.lastIndexOf.call(e, t, r)
                : y(e, [t], r, n, i);
            throw TypeError("val must be string, number or Buffer");
          }
          function y(e, t, r, n, i) {
            let o,
              s = 1,
              a = e.length,
              l = t.length;
            if (void 0 !== n && ("ucs2" === (n = String(n).toLowerCase()) || "ucs-2" === n || "utf16le" === n || "utf-16le" === n)) {
              if (e.length < 2 || t.length < 2) return -1;
              (s = 2), (a /= 2), (l /= 2), (r /= 2);
            }
            function u(e, t) {
              return 1 === s ? e[t] : e.readUInt16BE(t * s);
            }
            if (i) {
              let n = -1;
              for (o = r; o < a; o++)
                if (u(e, o) === u(t, -1 === n ? 0 : o - n)) {
                  if ((-1 === n && (n = o), o - n + 1 === l)) return n * s;
                } else -1 !== n && (o -= o - n), (n = -1);
            } else
              for (r + l > a && (r = a - l), o = r; o >= 0; o--) {
                let r = !0;
                for (let n = 0; n < l; n++)
                  if (u(e, o + n) !== u(t, n)) {
                    r = !1;
                    break;
                  }
                if (r) return o;
              }
            return -1;
          }
          function v(e, t, r) {
            r = Math.min(e.length, r);
            let n = [],
              i = t;
            for (; i < r; ) {
              let t = e[i],
                o = null,
                s = t > 239 ? 4 : t > 223 ? 3 : t > 191 ? 2 : 1;
              if (i + s <= r) {
                let r, n, a, l;
                switch (s) {
                  case 1:
                    t < 128 && (o = t);
                    break;
                  case 2:
                    (192 & (r = e[i + 1])) == 128 && (l = ((31 & t) << 6) | (63 & r)) > 127 && (o = l);
                    break;
                  case 3:
                    (r = e[i + 1]),
                      (n = e[i + 2]),
                      (192 & r) == 128 && (192 & n) == 128 && (l = ((15 & t) << 12) | ((63 & r) << 6) | (63 & n)) > 2047 && (l < 55296 || l > 57343) && (o = l);
                    break;
                  case 4:
                    (r = e[i + 1]),
                      (n = e[i + 2]),
                      (a = e[i + 3]),
                      (192 & r) == 128 &&
                        (192 & n) == 128 &&
                        (192 & a) == 128 &&
                        (l = ((15 & t) << 18) | ((63 & r) << 12) | ((63 & n) << 6) | (63 & a)) > 65535 &&
                        l < 1114112 &&
                        (o = l);
                }
              }
              null === o ? ((o = 65533), (s = 1)) : o > 65535 && ((o -= 65536), n.push(((o >>> 10) & 1023) | 55296), (o = 56320 | (1023 & o))),
                n.push(o),
                (i += s);
            }
            return (function (e) {
              let t = e.length;
              if (t <= 4096) return String.fromCharCode.apply(String, e);
              let r = "",
                n = 0;
              for (; n < t; ) r += String.fromCharCode.apply(String, e.slice(n, (n += 4096)));
              return r;
            })(n);
          }
          function w(e, t, r) {
            if (e % 1 != 0 || e < 0) throw RangeError("offset is not uint");
            if (e + t > r) throw RangeError("Trying to access beyond buffer length");
          }
          function _(e, t, r, n, i, o) {
            if (!a.isBuffer(e)) throw TypeError('"buffer" argument must be a Buffer instance');
            if (t > i || t < o) throw RangeError('"value" argument is out of bounds');
            if (r + n > e.length) throw RangeError("Index out of range");
          }
          function A(e, t, r, n, i) {
            O(t, n, i, e, r, 7);
            let o = Number(t & BigInt(0xffffffff));
            (e[r++] = o), (o >>= 8), (e[r++] = o), (o >>= 8), (e[r++] = o), (o >>= 8), (e[r++] = o);
            let s = Number((t >> BigInt(32)) & BigInt(0xffffffff));
            return (e[r++] = s), (s >>= 8), (e[r++] = s), (s >>= 8), (e[r++] = s), (s >>= 8), (e[r++] = s), r;
          }
          function S(e, t, r, n, i) {
            O(t, n, i, e, r, 7);
            let o = Number(t & BigInt(0xffffffff));
            (e[r + 7] = o), (o >>= 8), (e[r + 6] = o), (o >>= 8), (e[r + 5] = o), (o >>= 8), (e[r + 4] = o);
            let s = Number((t >> BigInt(32)) & BigInt(0xffffffff));
            return (e[r + 3] = s), (s >>= 8), (e[r + 2] = s), (s >>= 8), (e[r + 1] = s), (s >>= 8), (e[r] = s), r + 8;
          }
          function E(e, t, r, n, i, o) {
            if (r + n > e.length || r < 0) throw RangeError("Index out of range");
          }
          function x(e, t, r, n, o) {
            return (t *= 1), (r >>>= 0), o || E(e, t, r, 4, 34028234663852886e22, -34028234663852886e22), i.write(e, t, r, n, 23, 4), r + 4;
          }
          function R(e, t, r, n, o) {
            return (t *= 1), (r >>>= 0), o || E(e, t, r, 8, 17976931348623157e292, -17976931348623157e292), i.write(e, t, r, n, 52, 8), r + 8;
          }
          (t.Buffer = a),
            (t.SlowBuffer = function (e) {
              return +e != e && (e = 0), a.alloc(+e);
            }),
            (t.INSPECT_MAX_BYTES = 50),
            (t.kMaxLength = 0x7fffffff),
            (a.TYPED_ARRAY_SUPPORT = (function () {
              try {
                let e = new Uint8Array(1),
                  t = {
                    foo: function () {
                      return 42;
                    }
                  };
                return Object.setPrototypeOf(t, Uint8Array.prototype), Object.setPrototypeOf(e, t), 42 === e.foo();
              } catch (e) {
                return !1;
              }
            })()),
            a.TYPED_ARRAY_SUPPORT ||
              "undefined" == typeof console ||
              "function" != typeof console.error ||
              console.error(
                "This browser lacks typed array (Uint8Array) support which is required by `buffer` v5.x. Use `buffer` v4.x if you require old browser support."
              ),
            Object.defineProperty(a.prototype, "parent", {
              enumerable: !0,
              get: function () {
                if (a.isBuffer(this)) return this.buffer;
              }
            }),
            Object.defineProperty(a.prototype, "offset", {
              enumerable: !0,
              get: function () {
                if (a.isBuffer(this)) return this.byteOffset;
              }
            }),
            (a.poolSize = 8192),
            (a.from = function (e, t, r) {
              return l(e, t, r);
            }),
            Object.setPrototypeOf(a.prototype, Uint8Array.prototype),
            Object.setPrototypeOf(a, Uint8Array),
            (a.alloc = function (e, t, r) {
              return (u(e), e <= 0) ? s(e) : void 0 !== t ? ("string" == typeof r ? s(e).fill(t, r) : s(e).fill(t)) : s(e);
            }),
            (a.allocUnsafe = function (e) {
              return f(e);
            }),
            (a.allocUnsafeSlow = function (e) {
              return f(e);
            }),
            (a.isBuffer = function (e) {
              return null != e && !0 === e._isBuffer && e !== a.prototype;
            }),
            (a.compare = function (e, t) {
              if (
                (I(e, Uint8Array) && (e = a.from(e, e.offset, e.byteLength)),
                I(t, Uint8Array) && (t = a.from(t, t.offset, t.byteLength)),
                !a.isBuffer(e) || !a.isBuffer(t))
              )
                throw TypeError('The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array');
              if (e === t) return 0;
              let r = e.length,
                n = t.length;
              for (let i = 0, o = Math.min(r, n); i < o; ++i)
                if (e[i] !== t[i]) {
                  (r = e[i]), (n = t[i]);
                  break;
                }
              return r < n ? -1 : +(n < r);
            }),
            (a.isEncoding = function (e) {
              switch (String(e).toLowerCase()) {
                case "hex":
                case "utf8":
                case "utf-8":
                case "ascii":
                case "latin1":
                case "binary":
                case "base64":
                case "ucs2":
                case "ucs-2":
                case "utf16le":
                case "utf-16le":
                  return !0;
                default:
                  return !1;
              }
            }),
            (a.concat = function (e, t) {
              let r;
              if (!Array.isArray(e)) throw TypeError('"list" argument must be an Array of Buffers');
              if (0 === e.length) return a.alloc(0);
              if (void 0 === t) for (r = 0, t = 0; r < e.length; ++r) t += e[r].length;
              let n = a.allocUnsafe(t),
                i = 0;
              for (r = 0; r < e.length; ++r) {
                let t = e[r];
                if (I(t, Uint8Array)) i + t.length > n.length ? (a.isBuffer(t) || (t = a.from(t)), t.copy(n, i)) : Uint8Array.prototype.set.call(n, t, i);
                else if (a.isBuffer(t)) t.copy(n, i);
                else throw TypeError('"list" argument must be an Array of Buffers');
                i += t.length;
              }
              return n;
            }),
            (a.byteLength = g),
            (a.prototype._isBuffer = !0),
            (a.prototype.swap16 = function () {
              let e = this.length;
              if (e % 2 != 0) throw RangeError("Buffer size must be a multiple of 16-bits");
              for (let t = 0; t < e; t += 2) m(this, t, t + 1);
              return this;
            }),
            (a.prototype.swap32 = function () {
              let e = this.length;
              if (e % 4 != 0) throw RangeError("Buffer size must be a multiple of 32-bits");
              for (let t = 0; t < e; t += 4) m(this, t, t + 3), m(this, t + 1, t + 2);
              return this;
            }),
            (a.prototype.swap64 = function () {
              let e = this.length;
              if (e % 8 != 0) throw RangeError("Buffer size must be a multiple of 64-bits");
              for (let t = 0; t < e; t += 8) m(this, t, t + 7), m(this, t + 1, t + 6), m(this, t + 2, t + 5), m(this, t + 3, t + 4);
              return this;
            }),
            (a.prototype.toString = function () {
              let e = this.length;
              return 0 === e ? "" : 0 == arguments.length ? v(this, 0, e) : p.apply(this, arguments);
            }),
            (a.prototype.toLocaleString = a.prototype.toString),
            (a.prototype.equals = function (e) {
              if (!a.isBuffer(e)) throw TypeError("Argument must be a Buffer");
              return this === e || 0 === a.compare(this, e);
            }),
            (a.prototype.inspect = function () {
              let e = "",
                r = t.INSPECT_MAX_BYTES;
              return (
                (e = this.toString("hex", 0, r)
                  .replace(/(.{2})/g, "$1 ")
                  .trim()),
                this.length > r && (e += " ... "),
                "<Buffer " + e + ">"
              );
            }),
            o && (a.prototype[o] = a.prototype.inspect),
            (a.prototype.compare = function (e, t, r, n, i) {
              if ((I(e, Uint8Array) && (e = a.from(e, e.offset, e.byteLength)), !a.isBuffer(e)))
                throw TypeError('The "target" argument must be one of type Buffer or Uint8Array. Received type ' + typeof e);
              if (
                (void 0 === t && (t = 0),
                void 0 === r && (r = e ? e.length : 0),
                void 0 === n && (n = 0),
                void 0 === i && (i = this.length),
                t < 0 || r > e.length || n < 0 || i > this.length)
              )
                throw RangeError("out of range index");
              if (n >= i && t >= r) return 0;
              if (n >= i) return -1;
              if (t >= r) return 1;
              if (((t >>>= 0), (r >>>= 0), (n >>>= 0), (i >>>= 0), this === e)) return 0;
              let o = i - n,
                s = r - t,
                l = Math.min(o, s),
                u = this.slice(n, i),
                f = e.slice(t, r);
              for (let e = 0; e < l; ++e)
                if (u[e] !== f[e]) {
                  (o = u[e]), (s = f[e]);
                  break;
                }
              return o < s ? -1 : +(s < o);
            }),
            (a.prototype.includes = function (e, t, r) {
              return -1 !== this.indexOf(e, t, r);
            }),
            (a.prototype.indexOf = function (e, t, r) {
              return b(this, e, t, r, !0);
            }),
            (a.prototype.lastIndexOf = function (e, t, r) {
              return b(this, e, t, r, !1);
            }),
            (a.prototype.write = function (e, t, r, n) {
              var i, o, s, a, l, u, f, h;
              if (void 0 === t) (n = "utf8"), (r = this.length), (t = 0);
              else if (void 0 === r && "string" == typeof t) (n = t), (r = this.length), (t = 0);
              else if (isFinite(t)) (t >>>= 0), isFinite(r) ? ((r >>>= 0), void 0 === n && (n = "utf8")) : ((n = r), (r = void 0));
              else throw Error("Buffer.write(string, encoding, offset[, length]) is no longer supported");
              let c = this.length - t;
              if (((void 0 === r || r > c) && (r = c), (e.length > 0 && (r < 0 || t < 0)) || t > this.length))
                throw RangeError("Attempt to write outside buffer bounds");
              n || (n = "utf8");
              let d = !1;
              for (;;)
                switch (n) {
                  case "hex":
                    return (function (e, t, r, n) {
                      let i;
                      r = Number(r) || 0;
                      let o = e.length - r;
                      n ? (n = Number(n)) > o && (n = o) : (n = o);
                      let s = t.length;
                      for (n > s / 2 && (n = s / 2), i = 0; i < n; ++i) {
                        var a;
                        let n = parseInt(t.substr(2 * i, 2), 16);
                        if ((a = n) != a) break;
                        e[r + i] = n;
                      }
                      return i;
                    })(this, e, t, r);
                  case "utf8":
                  case "utf-8":
                    return (i = t), (o = r), N(B(e, this.length - i), this, i, o);
                  case "ascii":
                  case "latin1":
                  case "binary":
                    return (
                      (s = t),
                      (a = r),
                      N(
                        (function (e) {
                          let t = [];
                          for (let r = 0; r < e.length; ++r) t.push(255 & e.charCodeAt(r));
                          return t;
                        })(e),
                        this,
                        s,
                        a
                      )
                    );
                  case "base64":
                    return (l = t), (u = r), N(P(e), this, l, u);
                  case "ucs2":
                  case "ucs-2":
                  case "utf16le":
                  case "utf-16le":
                    return (
                      (f = t),
                      (h = r),
                      N(
                        (function (e, t) {
                          let r, n;
                          let i = [];
                          for (let o = 0; o < e.length && !((t -= 2) < 0); ++o) (n = (r = e.charCodeAt(o)) >> 8), i.push(r % 256), i.push(n);
                          return i;
                        })(e, this.length - f),
                        this,
                        f,
                        h
                      )
                    );
                  default:
                    if (d) throw TypeError("Unknown encoding: " + n);
                    (n = ("" + n).toLowerCase()), (d = !0);
                }
            }),
            (a.prototype.toJSON = function () {
              return { type: "Buffer", data: Array.prototype.slice.call(this._arr || this, 0) };
            }),
            (a.prototype.slice = function (e, t) {
              let r = this.length;
              (e = ~~e),
                (t = void 0 === t ? r : ~~t),
                e < 0 ? (e += r) < 0 && (e = 0) : e > r && (e = r),
                t < 0 ? (t += r) < 0 && (t = 0) : t > r && (t = r),
                t < e && (t = e);
              let n = this.subarray(e, t);
              return Object.setPrototypeOf(n, a.prototype), n;
            }),
            (a.prototype.readUintLE = a.prototype.readUIntLE =
              function (e, t, r) {
                (e >>>= 0), (t >>>= 0), r || w(e, t, this.length);
                let n = this[e],
                  i = 1,
                  o = 0;
                for (; ++o < t && (i *= 256); ) n += this[e + o] * i;
                return n;
              }),
            (a.prototype.readUintBE = a.prototype.readUIntBE =
              function (e, t, r) {
                (e >>>= 0), (t >>>= 0), r || w(e, t, this.length);
                let n = this[e + --t],
                  i = 1;
                for (; t > 0 && (i *= 256); ) n += this[e + --t] * i;
                return n;
              }),
            (a.prototype.readUint8 = a.prototype.readUInt8 =
              function (e, t) {
                return (e >>>= 0), t || w(e, 1, this.length), this[e];
              }),
            (a.prototype.readUint16LE = a.prototype.readUInt16LE =
              function (e, t) {
                return (e >>>= 0), t || w(e, 2, this.length), this[e] | (this[e + 1] << 8);
              }),
            (a.prototype.readUint16BE = a.prototype.readUInt16BE =
              function (e, t) {
                return (e >>>= 0), t || w(e, 2, this.length), (this[e] << 8) | this[e + 1];
              }),
            (a.prototype.readUint32LE = a.prototype.readUInt32LE =
              function (e, t) {
                return (e >>>= 0), t || w(e, 4, this.length), (this[e] | (this[e + 1] << 8) | (this[e + 2] << 16)) + 0x1000000 * this[e + 3];
              }),
            (a.prototype.readUint32BE = a.prototype.readUInt32BE =
              function (e, t) {
                return (e >>>= 0), t || w(e, 4, this.length), 0x1000000 * this[e] + ((this[e + 1] << 16) | (this[e + 2] << 8) | this[e + 3]);
              }),
            (a.prototype.readBigUInt64LE = U(function (e) {
              C((e >>>= 0), "offset");
              let t = this[e],
                r = this[e + 7];
              (void 0 === t || void 0 === r) && L(e, this.length - 8);
              let n = t + 256 * this[++e] + 65536 * this[++e] + 0x1000000 * this[++e],
                i = this[++e] + 256 * this[++e] + 65536 * this[++e] + 0x1000000 * r;
              return BigInt(n) + (BigInt(i) << BigInt(32));
            })),
            (a.prototype.readBigUInt64BE = U(function (e) {
              C((e >>>= 0), "offset");
              let t = this[e],
                r = this[e + 7];
              (void 0 === t || void 0 === r) && L(e, this.length - 8);
              let n = 0x1000000 * t + 65536 * this[++e] + 256 * this[++e] + this[++e],
                i = 0x1000000 * this[++e] + 65536 * this[++e] + 256 * this[++e] + r;
              return (BigInt(n) << BigInt(32)) + BigInt(i);
            })),
            (a.prototype.readIntLE = function (e, t, r) {
              (e >>>= 0), (t >>>= 0), r || w(e, t, this.length);
              let n = this[e],
                i = 1,
                o = 0;
              for (; ++o < t && (i *= 256); ) n += this[e + o] * i;
              return n >= (i *= 128) && (n -= Math.pow(2, 8 * t)), n;
            }),
            (a.prototype.readIntBE = function (e, t, r) {
              (e >>>= 0), (t >>>= 0), r || w(e, t, this.length);
              let n = t,
                i = 1,
                o = this[e + --n];
              for (; n > 0 && (i *= 256); ) o += this[e + --n] * i;
              return o >= (i *= 128) && (o -= Math.pow(2, 8 * t)), o;
            }),
            (a.prototype.readInt8 = function (e, t) {
              return ((e >>>= 0), t || w(e, 1, this.length), 128 & this[e]) ? -((255 - this[e] + 1) * 1) : this[e];
            }),
            (a.prototype.readInt16LE = function (e, t) {
              (e >>>= 0), t || w(e, 2, this.length);
              let r = this[e] | (this[e + 1] << 8);
              return 32768 & r ? 0xffff0000 | r : r;
            }),
            (a.prototype.readInt16BE = function (e, t) {
              (e >>>= 0), t || w(e, 2, this.length);
              let r = this[e + 1] | (this[e] << 8);
              return 32768 & r ? 0xffff0000 | r : r;
            }),
            (a.prototype.readInt32LE = function (e, t) {
              return (e >>>= 0), t || w(e, 4, this.length), this[e] | (this[e + 1] << 8) | (this[e + 2] << 16) | (this[e + 3] << 24);
            }),
            (a.prototype.readInt32BE = function (e, t) {
              return (e >>>= 0), t || w(e, 4, this.length), (this[e] << 24) | (this[e + 1] << 16) | (this[e + 2] << 8) | this[e + 3];
            }),
            (a.prototype.readBigInt64LE = U(function (e) {
              C((e >>>= 0), "offset");
              let t = this[e],
                r = this[e + 7];
              return (
                (void 0 === t || void 0 === r) && L(e, this.length - 8),
                (BigInt(this[e + 4] + 256 * this[e + 5] + 65536 * this[e + 6] + (r << 24)) << BigInt(32)) +
                  BigInt(t + 256 * this[++e] + 65536 * this[++e] + 0x1000000 * this[++e])
              );
            })),
            (a.prototype.readBigInt64BE = U(function (e) {
              C((e >>>= 0), "offset");
              let t = this[e],
                r = this[e + 7];
              return (
                (void 0 === t || void 0 === r) && L(e, this.length - 8),
                (BigInt((t << 24) + 65536 * this[++e] + 256 * this[++e] + this[++e]) << BigInt(32)) +
                  BigInt(0x1000000 * this[++e] + 65536 * this[++e] + 256 * this[++e] + r)
              );
            })),
            (a.prototype.readFloatLE = function (e, t) {
              return (e >>>= 0), t || w(e, 4, this.length), i.read(this, e, !0, 23, 4);
            }),
            (a.prototype.readFloatBE = function (e, t) {
              return (e >>>= 0), t || w(e, 4, this.length), i.read(this, e, !1, 23, 4);
            }),
            (a.prototype.readDoubleLE = function (e, t) {
              return (e >>>= 0), t || w(e, 8, this.length), i.read(this, e, !0, 52, 8);
            }),
            (a.prototype.readDoubleBE = function (e, t) {
              return (e >>>= 0), t || w(e, 8, this.length), i.read(this, e, !1, 52, 8);
            }),
            (a.prototype.writeUintLE = a.prototype.writeUIntLE =
              function (e, t, r, n) {
                if (((e *= 1), (t >>>= 0), (r >>>= 0), !n)) {
                  let n = Math.pow(2, 8 * r) - 1;
                  _(this, e, t, r, n, 0);
                }
                let i = 1,
                  o = 0;
                for (this[t] = 255 & e; ++o < r && (i *= 256); ) this[t + o] = (e / i) & 255;
                return t + r;
              }),
            (a.prototype.writeUintBE = a.prototype.writeUIntBE =
              function (e, t, r, n) {
                if (((e *= 1), (t >>>= 0), (r >>>= 0), !n)) {
                  let n = Math.pow(2, 8 * r) - 1;
                  _(this, e, t, r, n, 0);
                }
                let i = r - 1,
                  o = 1;
                for (this[t + i] = 255 & e; --i >= 0 && (o *= 256); ) this[t + i] = (e / o) & 255;
                return t + r;
              }),
            (a.prototype.writeUint8 = a.prototype.writeUInt8 =
              function (e, t, r) {
                return (e *= 1), (t >>>= 0), r || _(this, e, t, 1, 255, 0), (this[t] = 255 & e), t + 1;
              }),
            (a.prototype.writeUint16LE = a.prototype.writeUInt16LE =
              function (e, t, r) {
                return (e *= 1), (t >>>= 0), r || _(this, e, t, 2, 65535, 0), (this[t] = 255 & e), (this[t + 1] = e >>> 8), t + 2;
              }),
            (a.prototype.writeUint16BE = a.prototype.writeUInt16BE =
              function (e, t, r) {
                return (e *= 1), (t >>>= 0), r || _(this, e, t, 2, 65535, 0), (this[t] = e >>> 8), (this[t + 1] = 255 & e), t + 2;
              }),
            (a.prototype.writeUint32LE = a.prototype.writeUInt32LE =
              function (e, t, r) {
                return (
                  (e *= 1),
                  (t >>>= 0),
                  r || _(this, e, t, 4, 0xffffffff, 0),
                  (this[t + 3] = e >>> 24),
                  (this[t + 2] = e >>> 16),
                  (this[t + 1] = e >>> 8),
                  (this[t] = 255 & e),
                  t + 4
                );
              }),
            (a.prototype.writeUint32BE = a.prototype.writeUInt32BE =
              function (e, t, r) {
                return (
                  (e *= 1),
                  (t >>>= 0),
                  r || _(this, e, t, 4, 0xffffffff, 0),
                  (this[t] = e >>> 24),
                  (this[t + 1] = e >>> 16),
                  (this[t + 2] = e >>> 8),
                  (this[t + 3] = 255 & e),
                  t + 4
                );
              }),
            (a.prototype.writeBigUInt64LE = U(function (e, t = 0) {
              return A(this, e, t, BigInt(0), BigInt("0xffffffffffffffff"));
            })),
            (a.prototype.writeBigUInt64BE = U(function (e, t = 0) {
              return S(this, e, t, BigInt(0), BigInt("0xffffffffffffffff"));
            })),
            (a.prototype.writeIntLE = function (e, t, r, n) {
              if (((e *= 1), (t >>>= 0), !n)) {
                let n = Math.pow(2, 8 * r - 1);
                _(this, e, t, r, n - 1, -n);
              }
              let i = 0,
                o = 1,
                s = 0;
              for (this[t] = 255 & e; ++i < r && (o *= 256); ) e < 0 && 0 === s && 0 !== this[t + i - 1] && (s = 1), (this[t + i] = (((e / o) >> 0) - s) & 255);
              return t + r;
            }),
            (a.prototype.writeIntBE = function (e, t, r, n) {
              if (((e *= 1), (t >>>= 0), !n)) {
                let n = Math.pow(2, 8 * r - 1);
                _(this, e, t, r, n - 1, -n);
              }
              let i = r - 1,
                o = 1,
                s = 0;
              for (this[t + i] = 255 & e; --i >= 0 && (o *= 256); )
                e < 0 && 0 === s && 0 !== this[t + i + 1] && (s = 1), (this[t + i] = (((e / o) >> 0) - s) & 255);
              return t + r;
            }),
            (a.prototype.writeInt8 = function (e, t, r) {
              return (e *= 1), (t >>>= 0), r || _(this, e, t, 1, 127, -128), e < 0 && (e = 255 + e + 1), (this[t] = 255 & e), t + 1;
            }),
            (a.prototype.writeInt16LE = function (e, t, r) {
              return (e *= 1), (t >>>= 0), r || _(this, e, t, 2, 32767, -32768), (this[t] = 255 & e), (this[t + 1] = e >>> 8), t + 2;
            }),
            (a.prototype.writeInt16BE = function (e, t, r) {
              return (e *= 1), (t >>>= 0), r || _(this, e, t, 2, 32767, -32768), (this[t] = e >>> 8), (this[t + 1] = 255 & e), t + 2;
            }),
            (a.prototype.writeInt32LE = function (e, t, r) {
              return (
                (e *= 1),
                (t >>>= 0),
                r || _(this, e, t, 4, 0x7fffffff, -0x80000000),
                (this[t] = 255 & e),
                (this[t + 1] = e >>> 8),
                (this[t + 2] = e >>> 16),
                (this[t + 3] = e >>> 24),
                t + 4
              );
            }),
            (a.prototype.writeInt32BE = function (e, t, r) {
              return (
                (e *= 1),
                (t >>>= 0),
                r || _(this, e, t, 4, 0x7fffffff, -0x80000000),
                e < 0 && (e = 0xffffffff + e + 1),
                (this[t] = e >>> 24),
                (this[t + 1] = e >>> 16),
                (this[t + 2] = e >>> 8),
                (this[t + 3] = 255 & e),
                t + 4
              );
            }),
            (a.prototype.writeBigInt64LE = U(function (e, t = 0) {
              return A(this, e, t, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
            })),
            (a.prototype.writeBigInt64BE = U(function (e, t = 0) {
              return S(this, e, t, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
            })),
            (a.prototype.writeFloatLE = function (e, t, r) {
              return x(this, e, t, !0, r);
            }),
            (a.prototype.writeFloatBE = function (e, t, r) {
              return x(this, e, t, !1, r);
            }),
            (a.prototype.writeDoubleLE = function (e, t, r) {
              return R(this, e, t, !0, r);
            }),
            (a.prototype.writeDoubleBE = function (e, t, r) {
              return R(this, e, t, !1, r);
            }),
            (a.prototype.copy = function (e, t, r, n) {
              if (!a.isBuffer(e)) throw TypeError("argument should be a Buffer");
              if (
                (r || (r = 0),
                n || 0 === n || (n = this.length),
                t >= e.length && (t = e.length),
                t || (t = 0),
                n > 0 && n < r && (n = r),
                n === r || 0 === e.length || 0 === this.length)
              )
                return 0;
              if (t < 0) throw RangeError("targetStart out of bounds");
              if (r < 0 || r >= this.length) throw RangeError("Index out of range");
              if (n < 0) throw RangeError("sourceEnd out of bounds");
              n > this.length && (n = this.length), e.length - t < n - r && (n = e.length - t + r);
              let i = n - r;
              return (
                this === e && "function" == typeof Uint8Array.prototype.copyWithin
                  ? this.copyWithin(t, r, n)
                  : Uint8Array.prototype.set.call(e, this.subarray(r, n), t),
                i
              );
            }),
            (a.prototype.fill = function (e, t, r, n) {
              let i;
              if ("string" == typeof e) {
                if (
                  ("string" == typeof t ? ((n = t), (t = 0), (r = this.length)) : "string" == typeof r && ((n = r), (r = this.length)),
                  void 0 !== n && "string" != typeof n)
                )
                  throw TypeError("encoding must be a string");
                if ("string" == typeof n && !a.isEncoding(n)) throw TypeError("Unknown encoding: " + n);
                if (1 === e.length) {
                  let t = e.charCodeAt(0);
                  (("utf8" === n && t < 128) || "latin1" === n) && (e = t);
                }
              } else "number" == typeof e ? (e &= 255) : "boolean" == typeof e && (e = Number(e));
              if (t < 0 || this.length < t || this.length < r) throw RangeError("Out of range index");
              if (r <= t) return this;
              if (((t >>>= 0), (r = void 0 === r ? this.length : r >>> 0), e || (e = 0), "number" == typeof e)) for (i = t; i < r; ++i) this[i] = e;
              else {
                let o = a.isBuffer(e) ? e : a.from(e, n),
                  s = o.length;
                if (0 === s) throw TypeError('The value "' + e + '" is invalid for argument "value"');
                for (i = 0; i < r - t; ++i) this[i + t] = o[i % s];
              }
              return this;
            });
          let k = {};
          function T(e, t, r) {
            k[e] = class extends r {
              constructor() {
                super(),
                  Object.defineProperty(this, "message", { value: t.apply(this, arguments), writable: !0, configurable: !0 }),
                  (this.name = `${this.name} [${e}]`),
                  this.stack,
                  delete this.name;
              }
              get code() {
                return e;
              }
              set code(e) {
                Object.defineProperty(this, "code", { configurable: !0, enumerable: !0, value: e, writable: !0 });
              }
              toString() {
                return `${this.name} [${e}]: ${this.message}`;
              }
            };
          }
          function M(e) {
            let t = "",
              r = e.length,
              n = +("-" === e[0]);
            for (; r >= n + 4; r -= 3) t = `_${e.slice(r - 3, r)}${t}`;
            return `${e.slice(0, r)}${t}`;
          }
          function O(e, t, r, n, i, o) {
            if (e > r || e < t) {
              let n;
              let i = "bigint" == typeof t ? "n" : "";
              throw (
                ((n =
                  o > 3
                    ? 0 === t || t === BigInt(0)
                      ? `>= 0${i} and < 2${i} ** ${(o + 1) * 8}${i}`
                      : `>= -(2${i} ** ${(o + 1) * 8 - 1}${i}) and < 2 ** ${(o + 1) * 8 - 1}${i}`
                    : `>= ${t}${i} and <= ${r}${i}`),
                new k.ERR_OUT_OF_RANGE("value", n, e))
              );
            }
            C(i, "offset"), (void 0 === n[i] || void 0 === n[i + o]) && L(i, n.length - (o + 1));
          }
          function C(e, t) {
            if ("number" != typeof e) throw new k.ERR_INVALID_ARG_TYPE(t, "number", e);
          }
          function L(e, t, r) {
            if (Math.floor(e) !== e) throw (C(e, r), new k.ERR_OUT_OF_RANGE(r || "offset", "an integer", e));
            if (t < 0) throw new k.ERR_BUFFER_OUT_OF_BOUNDS();
            throw new k.ERR_OUT_OF_RANGE(r || "offset", `>= ${+!!r} and <= ${t}`, e);
          }
          T(
            "ERR_BUFFER_OUT_OF_BOUNDS",
            function (e) {
              return e ? `${e} is outside of buffer bounds` : "Attempt to access memory outside buffer bounds";
            },
            RangeError
          ),
            T(
              "ERR_INVALID_ARG_TYPE",
              function (e, t) {
                return `The "${e}" argument must be of type number. Received type ${typeof t}`;
              },
              TypeError
            ),
            T(
              "ERR_OUT_OF_RANGE",
              function (e, t, r) {
                let n = `The value of "${e}" is out of range.`,
                  i = r;
                return (
                  Number.isInteger(r) && Math.abs(r) > 0x100000000
                    ? (i = M(String(r)))
                    : "bigint" == typeof r && ((i = String(r)), (r > BigInt(2) ** BigInt(32) || r < -(BigInt(2) ** BigInt(32))) && (i = M(i)), (i += "n")),
                  (n += ` It must be ${t}. Received ${i}`)
                );
              },
              RangeError
            );
          let j = /[^+/0-9A-Za-z-_]/g;
          function B(e, t) {
            let r;
            t = t || 1 / 0;
            let n = e.length,
              i = null,
              o = [];
            for (let s = 0; s < n; ++s) {
              if ((r = e.charCodeAt(s)) > 55295 && r < 57344) {
                if (!i) {
                  if (r > 56319 || s + 1 === n) {
                    (t -= 3) > -1 && o.push(239, 191, 189);
                    continue;
                  }
                  i = r;
                  continue;
                }
                if (r < 56320) {
                  (t -= 3) > -1 && o.push(239, 191, 189), (i = r);
                  continue;
                }
                r = (((i - 55296) << 10) | (r - 56320)) + 65536;
              } else i && (t -= 3) > -1 && o.push(239, 191, 189);
              if (((i = null), r < 128)) {
                if ((t -= 1) < 0) break;
                o.push(r);
              } else if (r < 2048) {
                if ((t -= 2) < 0) break;
                o.push((r >> 6) | 192, (63 & r) | 128);
              } else if (r < 65536) {
                if ((t -= 3) < 0) break;
                o.push((r >> 12) | 224, ((r >> 6) & 63) | 128, (63 & r) | 128);
              } else if (r < 1114112) {
                if ((t -= 4) < 0) break;
                o.push((r >> 18) | 240, ((r >> 12) & 63) | 128, ((r >> 6) & 63) | 128, (63 & r) | 128);
              } else throw Error("Invalid code point");
            }
            return o;
          }
          function P(e) {
            return n.toByteArray(
              (function (e) {
                if ((e = (e = e.split("=")[0]).trim().replace(j, "")).length < 2) return "";
                for (; e.length % 4 != 0; ) e += "=";
                return e;
              })(e)
            );
          }
          function N(e, t, r, n) {
            let i;
            for (i = 0; i < n && !(i + r >= t.length) && !(i >= e.length); ++i) t[i + r] = e[i];
            return i;
          }
          function I(e, t) {
            return e instanceof t || (null != e && null != e.constructor && null != e.constructor.name && e.constructor.name === t.name);
          }
          let D = (function () {
            let e = "0123456789abcdef",
              t = Array(256);
            for (let r = 0; r < 16; ++r) {
              let n = 16 * r;
              for (let i = 0; i < 16; ++i) t[n + i] = e[r] + e[i];
            }
            return t;
          })();
          function U(e) {
            return "undefined" == typeof BigInt ? W : e;
          }
          function W() {
            throw Error("BigInt not supported");
          }
        },
        7646: function (e, t, r) {
          function n(e) {
            return Object.prototype.toString.call(e);
          }
          (t.isArray = function (e) {
            return Array.isArray ? Array.isArray(e) : "[object Array]" === n(e);
          }),
            (t.isBoolean = function (e) {
              return "boolean" == typeof e;
            }),
            (t.isNull = function (e) {
              return null === e;
            }),
            (t.isNullOrUndefined = function (e) {
              return null == e;
            }),
            (t.isNumber = function (e) {
              return "number" == typeof e;
            }),
            (t.isString = function (e) {
              return "string" == typeof e;
            }),
            (t.isSymbol = function (e) {
              return "symbol" == typeof e;
            }),
            (t.isUndefined = function (e) {
              return void 0 === e;
            }),
            (t.isRegExp = function (e) {
              return "[object RegExp]" === n(e);
            }),
            (t.isObject = function (e) {
              return "object" == typeof e && null !== e;
            }),
            (t.isDate = function (e) {
              return "[object Date]" === n(e);
            }),
            (t.isError = function (e) {
              return "[object Error]" === n(e) || e instanceof Error;
            }),
            (t.isFunction = function (e) {
              return "function" == typeof e;
            }),
            (t.isPrimitive = function (e) {
              return null === e || "boolean" == typeof e || "number" == typeof e || "string" == typeof e || "symbol" == typeof e || void 0 === e;
            }),
            (t.isBuffer = r(48834).Buffer.isBuffer);
        },
        22699: function (e) {
          "use strict";
          var t,
            r = "object" == typeof Reflect ? Reflect : null,
            n =
              r && "function" == typeof r.apply
                ? r.apply
                : function (e, t, r) {
                    return Function.prototype.apply.call(e, t, r);
                  };
          t =
            r && "function" == typeof r.ownKeys
              ? r.ownKeys
              : Object.getOwnPropertySymbols
                ? function (e) {
                    return Object.getOwnPropertyNames(e).concat(Object.getOwnPropertySymbols(e));
                  }
                : function (e) {
                    return Object.getOwnPropertyNames(e);
                  };
          var i =
            Number.isNaN ||
            function (e) {
              return e != e;
            };
          function o() {
            o.init.call(this);
          }
          (e.exports = o),
            (e.exports.once = function (e, t) {
              return new Promise(function (r, n) {
                var i, o, s;
                function a(r) {
                  e.removeListener(t, l), n(r);
                }
                function l() {
                  "function" == typeof e.removeListener && e.removeListener("error", a), r([].slice.call(arguments));
                }
                p(e, t, l, { once: !0 }), "error" !== t && ((i = e), (o = a), (s = { once: !0 }), "function" == typeof i.on && p(i, "error", o, s));
              });
            }),
            (o.EventEmitter = o),
            (o.prototype._events = void 0),
            (o.prototype._eventsCount = 0),
            (o.prototype._maxListeners = void 0);
          var s = 10;
          function a(e) {
            if ("function" != typeof e) throw TypeError('The "listener" argument must be of type Function. Received type ' + typeof e);
          }
          function l(e) {
            return void 0 === e._maxListeners ? o.defaultMaxListeners : e._maxListeners;
          }
          function u(e, t, r, n) {
            if (
              (a(r),
              void 0 === (o = e._events)
                ? ((o = e._events = Object.create(null)), (e._eventsCount = 0))
                : (void 0 !== o.newListener && (e.emit("newListener", t, r.listener ? r.listener : r), (o = e._events)), (s = o[t])),
              void 0 === s)
            )
              (s = o[t] = r), ++e._eventsCount;
            else if (("function" == typeof s ? (s = o[t] = n ? [r, s] : [s, r]) : n ? s.unshift(r) : s.push(r), (i = l(e)) > 0 && s.length > i && !s.warned)) {
              s.warned = !0;
              var i,
                o,
                s,
                u = Error(
                  "Possible EventEmitter memory leak detected. " +
                    s.length +
                    " " +
                    String(t) +
                    " listeners added. Use emitter.setMaxListeners() to increase limit"
                );
              (u.name = "MaxListenersExceededWarning"), (u.emitter = e), (u.type = t), (u.count = s.length), console && console.warn && console.warn(u);
            }
            return e;
          }
          function f() {
            if (!this.fired)
              return (this.target.removeListener(this.type, this.wrapFn), (this.fired = !0), 0 == arguments.length)
                ? this.listener.call(this.target)
                : this.listener.apply(this.target, arguments);
          }
          function h(e, t, r) {
            var n = { fired: !1, wrapFn: void 0, target: e, type: t, listener: r },
              i = f.bind(n);
            return (i.listener = r), (n.wrapFn = i), i;
          }
          function c(e, t, r) {
            var n = e._events;
            if (void 0 === n) return [];
            var i = n[t];
            return void 0 === i
              ? []
              : "function" == typeof i
                ? r
                  ? [i.listener || i]
                  : [i]
                : r
                  ? (function (e) {
                      for (var t = Array(e.length), r = 0; r < t.length; ++r) t[r] = e[r].listener || e[r];
                      return t;
                    })(i)
                  : g(i, i.length);
          }
          function d(e) {
            var t = this._events;
            if (void 0 !== t) {
              var r = t[e];
              if ("function" == typeof r) return 1;
              if (void 0 !== r) return r.length;
            }
            return 0;
          }
          function g(e, t) {
            for (var r = Array(t), n = 0; n < t; ++n) r[n] = e[n];
            return r;
          }
          function p(e, t, r, n) {
            if ("function" == typeof e.on) n.once ? e.once(t, r) : e.on(t, r);
            else if ("function" == typeof e.addEventListener)
              e.addEventListener(t, function i(o) {
                n.once && e.removeEventListener(t, i), r(o);
              });
            else throw TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof e);
          }
          Object.defineProperty(o, "defaultMaxListeners", {
            enumerable: !0,
            get: function () {
              return s;
            },
            set: function (e) {
              if ("number" != typeof e || e < 0 || i(e))
                throw RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + e + ".");
              s = e;
            }
          }),
            (o.init = function () {
              (void 0 === this._events || this._events === Object.getPrototypeOf(this)._events) &&
                ((this._events = Object.create(null)), (this._eventsCount = 0)),
                (this._maxListeners = this._maxListeners || void 0);
            }),
            (o.prototype.setMaxListeners = function (e) {
              if ("number" != typeof e || e < 0 || i(e))
                throw RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + e + ".");
              return (this._maxListeners = e), this;
            }),
            (o.prototype.getMaxListeners = function () {
              return l(this);
            }),
            (o.prototype.emit = function (e) {
              for (var t = [], r = 1; r < arguments.length; r++) t.push(arguments[r]);
              var i = "error" === e,
                o = this._events;
              if (void 0 !== o) i = i && void 0 === o.error;
              else if (!i) return !1;
              if (i) {
                if ((t.length > 0 && (s = t[0]), s instanceof Error)) throw s;
                var s,
                  a = Error("Unhandled error." + (s ? " (" + s.message + ")" : ""));
                throw ((a.context = s), a);
              }
              var l = o[e];
              if (void 0 === l) return !1;
              if ("function" == typeof l) n(l, this, t);
              else for (var u = l.length, f = g(l, u), r = 0; r < u; ++r) n(f[r], this, t);
              return !0;
            }),
            (o.prototype.addListener = function (e, t) {
              return u(this, e, t, !1);
            }),
            (o.prototype.on = o.prototype.addListener),
            (o.prototype.prependListener = function (e, t) {
              return u(this, e, t, !0);
            }),
            (o.prototype.once = function (e, t) {
              return a(t), this.on(e, h(this, e, t)), this;
            }),
            (o.prototype.prependOnceListener = function (e, t) {
              return a(t), this.prependListener(e, h(this, e, t)), this;
            }),
            (o.prototype.removeListener = function (e, t) {
              var r, n, i, o, s;
              if ((a(t), void 0 === (n = this._events) || void 0 === (r = n[e]))) return this;
              if (r === t || r.listener === t)
                0 == --this._eventsCount
                  ? (this._events = Object.create(null))
                  : (delete n[e], n.removeListener && this.emit("removeListener", e, r.listener || t));
              else if ("function" != typeof r) {
                for (i = -1, o = r.length - 1; o >= 0; o--)
                  if (r[o] === t || r[o].listener === t) {
                    (s = r[o].listener), (i = o);
                    break;
                  }
                if (i < 0) return this;
                0 === i
                  ? r.shift()
                  : (function (e, t) {
                      for (; t + 1 < e.length; t++) e[t] = e[t + 1];
                      e.pop();
                    })(r, i),
                  1 === r.length && (n[e] = r[0]),
                  void 0 !== n.removeListener && this.emit("removeListener", e, s || t);
              }
              return this;
            }),
            (o.prototype.off = o.prototype.removeListener),
            (o.prototype.removeAllListeners = function (e) {
              var t, r, n;
              if (void 0 === (r = this._events)) return this;
              if (void 0 === r.removeListener)
                return (
                  0 == arguments.length
                    ? ((this._events = Object.create(null)), (this._eventsCount = 0))
                    : void 0 !== r[e] && (0 == --this._eventsCount ? (this._events = Object.create(null)) : delete r[e]),
                  this
                );
              if (0 == arguments.length) {
                var i,
                  o = Object.keys(r);
                for (n = 0; n < o.length; ++n) "removeListener" !== (i = o[n]) && this.removeAllListeners(i);
                return this.removeAllListeners("removeListener"), (this._events = Object.create(null)), (this._eventsCount = 0), this;
              }
              if ("function" == typeof (t = r[e])) this.removeListener(e, t);
              else if (void 0 !== t) for (n = t.length - 1; n >= 0; n--) this.removeListener(e, t[n]);
              return this;
            }),
            (o.prototype.listeners = function (e) {
              return c(this, e, !0);
            }),
            (o.prototype.rawListeners = function (e) {
              return c(this, e, !1);
            }),
            (o.listenerCount = function (e, t) {
              return "function" == typeof e.listenerCount ? e.listenerCount(t) : d.call(e, t);
            }),
            (o.prototype.listenerCount = d),
            (o.prototype.eventNames = function () {
              return this._eventsCount > 0 ? t(this._events) : [];
            });
        },
        83274: function (e, t, r) {
          "use strict";
          var n = r(48834).Buffer;
          let i = r(54851);
          e.exports = class extends i.Duplex {
            constructor(e) {
              super({ objectMode: !0 }),
                (this._port = e),
                this._port.onMessage.addListener(e => this._onMessage(e)),
                this._port.onDisconnect.addListener(() => this._onDisconnect());
            }
            _onMessage(e) {
              if (n.isBuffer(e)) {
                let t = n.from(e);
                this.push(t);
              } else this.push(e);
            }
            _onDisconnect() {
              this.destroy();
            }
            _read() {}
            _write(e, t, r) {
              try {
                if (n.isBuffer(e)) {
                  let t = e.toJSON();
                  (t._isBuffer = !0), this._port.postMessage(t);
                } else this._port.postMessage(e);
              } catch (e) {
                return r(Error("PortDuplexStream - disconnected"));
              }
              return r();
            }
          };
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
              if ((n = (o = Object.keys(t)).length) !== Object.keys(r).length) return !1;
              for (i = n; 0 != i--; ) if (!Object.prototype.hasOwnProperty.call(r, o[i])) return !1;
              for (i = n; 0 != i--; ) {
                var n,
                  i,
                  o,
                  s = o[i];
                if (!e(t[s], r[s])) return !1;
              }
              return !0;
            }
            return t != t && r != r;
          };
        },
        62333: function (e, t) {
          (t.read = function (e, t, r, n, i) {
            var o,
              s,
              a = 8 * i - n - 1,
              l = (1 << a) - 1,
              u = l >> 1,
              f = -7,
              h = r ? i - 1 : 0,
              c = r ? -1 : 1,
              d = e[t + h];
            for (h += c, o = d & ((1 << -f) - 1), d >>= -f, f += a; f > 0; o = 256 * o + e[t + h], h += c, f -= 8);
            for (s = o & ((1 << -f) - 1), o >>= -f, f += n; f > 0; s = 256 * s + e[t + h], h += c, f -= 8);
            if (0 === o) o = 1 - u;
            else {
              if (o === l) return s ? NaN : (1 / 0) * (d ? -1 : 1);
              (s += Math.pow(2, n)), (o -= u);
            }
            return (d ? -1 : 1) * s * Math.pow(2, o - n);
          }),
            (t.write = function (e, t, r, n, i, o) {
              var s,
                a,
                l,
                u = 8 * o - i - 1,
                f = (1 << u) - 1,
                h = f >> 1,
                c = 5960464477539062e-23 * (23 === i),
                d = n ? 0 : o - 1,
                g = n ? 1 : -1,
                p = +(t < 0 || (0 === t && 1 / t < 0));
              for (
                isNaN((t = Math.abs(t))) || t === 1 / 0
                  ? ((a = +!!isNaN(t)), (s = f))
                  : ((s = Math.floor(Math.log(t) / Math.LN2)),
                    t * (l = Math.pow(2, -s)) < 1 && (s--, (l *= 2)),
                    s + h >= 1 ? (t += c / l) : (t += c * Math.pow(2, 1 - h)),
                    t * l >= 2 && (s++, (l /= 2)),
                    s + h >= f
                      ? ((a = 0), (s = f))
                      : s + h >= 1
                        ? ((a = (t * l - 1) * Math.pow(2, i)), (s += h))
                        : ((a = t * Math.pow(2, h - 1) * Math.pow(2, i)), (s = 0)));
                i >= 8;
                e[r + d] = 255 & a, d += g, a /= 256, i -= 8
              );
              for (s = (s << i) | a, u += i; u > 0; e[r + d] = 255 & s, d += g, s /= 256, u -= 8);
              e[r + d - g] |= 128 * p;
            });
        },
        91285: function (e) {
          "function" == typeof Object.create
            ? (e.exports = function (e, t) {
                t &&
                  ((e.super_ = t), (e.prototype = Object.create(t.prototype, { constructor: { value: e, enumerable: !1, writable: !0, configurable: !0 } })));
              })
            : (e.exports = function (e, t) {
                if (t) {
                  e.super_ = t;
                  var r = function () {};
                  (r.prototype = t.prototype), (e.prototype = new r()), (e.prototype.constructor = e);
                }
              });
        },
        82884: function (e, t, r) {
          "use strict";
          var n = r(34406);
          n.version && 0 !== n.version.indexOf("v0.") && (0 !== n.version.indexOf("v1.") || 0 === n.version.indexOf("v1.8."))
            ? (e.exports = n.nextTick)
            : (e.exports = function (e, t, r, i) {
                if ("function" != typeof e) throw TypeError('"callback" argument must be a function');
                var o,
                  s,
                  a = arguments.length;
                switch (a) {
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
                    for (o = Array(a - 1), s = 0; s < o.length; ) o[s++] = arguments[s];
                    return n.nextTick(function () {
                      e.apply(null, o);
                    });
                }
              });
        },
        34406: function (e) {
          var t,
            r,
            n,
            i = (e.exports = {});
          function o() {
            throw Error("setTimeout has not been defined");
          }
          function s() {
            throw Error("clearTimeout has not been defined");
          }
          function a(e) {
            if (t === setTimeout) return setTimeout(e, 0);
            if ((t === o || !t) && setTimeout) return (t = setTimeout), setTimeout(e, 0);
            try {
              return t(e, 0);
            } catch (r) {
              try {
                return t.call(null, e, 0);
              } catch (r) {
                return t.call(this, e, 0);
              }
            }
          }
          !(function () {
            try {
              t = "function" == typeof setTimeout ? setTimeout : o;
            } catch (e) {
              t = o;
            }
            try {
              r = "function" == typeof clearTimeout ? clearTimeout : s;
            } catch (e) {
              r = s;
            }
          })();
          var l = [],
            u = !1,
            f = -1;
          function h() {
            u && n && ((u = !1), n.length ? (l = n.concat(l)) : (f = -1), l.length && c());
          }
          function c() {
            if (!u) {
              var e = a(h);
              u = !0;
              for (var t = l.length; t; ) {
                for (n = l, l = []; ++f < t; ) n && n[f].run();
                (f = -1), (t = l.length);
              }
              (n = null),
                (u = !1),
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
          function d(e, t) {
            (this.fun = e), (this.array = t);
          }
          function g() {}
          (i.nextTick = function (e) {
            var t = Array(arguments.length - 1);
            if (arguments.length > 1) for (var r = 1; r < arguments.length; r++) t[r - 1] = arguments[r];
            l.push(new d(e, t)), 1 !== l.length || u || a(c);
          }),
            (d.prototype.run = function () {
              this.fun.apply(null, this.array);
            }),
            (i.title = "browser"),
            (i.browser = !0),
            (i.env = {}),
            (i.argv = []),
            (i.version = ""),
            (i.versions = {}),
            (i.on = g),
            (i.addListener = g),
            (i.once = g),
            (i.off = g),
            (i.removeListener = g),
            (i.removeAllListeners = g),
            (i.emit = g),
            (i.prependListener = g),
            (i.prependOnceListener = g),
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
        64452: function (e) {
          "use strict";
          var t = {};
          function r(e, r, n) {
            n || (n = Error);
            var i = (function (e) {
              function t(t, n, i) {
                return e.call(this, "string" == typeof r ? r : r(t, n, i)) || this;
              }
              return (t.prototype = Object.create(e.prototype)), (t.prototype.constructor = t), (t.__proto__ = e), t;
            })(n);
            (i.prototype.name = n.name), (i.prototype.code = e), (t[e] = i);
          }
          function n(e, t) {
            if (!Array.isArray(e)) return "of ".concat(t, " ").concat(String(e));
            var r = e.length;
            return ((e = e.map(function (e) {
              return String(e);
            })),
            r > 2)
              ? "one of ".concat(t, " ").concat(e.slice(0, r - 1).join(", "), ", or ") + e[r - 1]
              : 2 === r
                ? "one of ".concat(t, " ").concat(e[0], " or ").concat(e[1])
                : "of ".concat(t, " ").concat(e[0]);
          }
          r(
            "ERR_INVALID_OPT_VALUE",
            function (e, t) {
              return 'The value "' + t + '" is invalid for option "' + e + '"';
            },
            TypeError
          ),
            r(
              "ERR_INVALID_ARG_TYPE",
              function (e, t, r) {
                if (
                  ("string" == typeof t && ((i = "not "), t.substr(0, i.length) === i) ? ((l = "must not be"), (t = t.replace(/^not /, ""))) : (l = "must be"),
                  (o = " argument"),
                  (void 0 === s || s > e.length) && (s = e.length),
                  e.substring(s - o.length, s) === o)
                )
                  u = "The ".concat(e, " ").concat(l, " ").concat(n(t, "type"));
                else {
                  var i,
                    o,
                    s,
                    a,
                    l,
                    u,
                    f = ("number" != typeof a && (a = 0), a + 1 > e.length || -1 === e.indexOf(".", a)) ? "argument" : "property";
                  u = 'The "'.concat(e, '" ').concat(f, " ").concat(l, " ").concat(n(t, "type"));
                }
                return u + ". Received type ".concat(typeof r);
              },
              TypeError
            ),
            r("ERR_STREAM_PUSH_AFTER_EOF", "stream.push() after EOF"),
            r("ERR_METHOD_NOT_IMPLEMENTED", function (e) {
              return "The " + e + " method is not implemented";
            }),
            r("ERR_STREAM_PREMATURE_CLOSE", "Premature close"),
            r("ERR_STREAM_DESTROYED", function (e) {
              return "Cannot call " + e + " after a stream was destroyed";
            }),
            r("ERR_MULTIPLE_CALLBACK", "Callback called multiple times"),
            r("ERR_STREAM_CANNOT_PIPE", "Cannot pipe, not readable"),
            r("ERR_STREAM_WRITE_AFTER_END", "write after end"),
            r("ERR_STREAM_NULL_VALUES", "May not write null values to stream", TypeError),
            r(
              "ERR_UNKNOWN_ENCODING",
              function (e) {
                return "Unknown encoding: " + e;
              },
              TypeError
            ),
            r("ERR_STREAM_UNSHIFT_AFTER_END_EVENT", "stream.unshift() after end event"),
            (e.exports.codes = t);
        },
        77073: function (e, t, r) {
          "use strict";
          var n = r(34406),
            i =
              Object.keys ||
              function (e) {
                var t = [];
                for (var r in e) t.push(r);
                return t;
              };
          e.exports = f;
          var o = r(28051),
            s = r(2557);
          r(91285)(f, o);
          for (var a = i(s.prototype), l = 0; l < a.length; l++) {
            var u = a[l];
            f.prototype[u] || (f.prototype[u] = s.prototype[u]);
          }
          function f(e) {
            if (!(this instanceof f)) return new f(e);
            o.call(this, e),
              s.call(this, e),
              (this.allowHalfOpen = !0),
              e &&
                (!1 === e.readable && (this.readable = !1),
                !1 === e.writable && (this.writable = !1),
                !1 === e.allowHalfOpen && ((this.allowHalfOpen = !1), this.once("end", h)));
          }
          function h() {
            this._writableState.ended || n.nextTick(c, this);
          }
          function c(e) {
            e.end();
          }
          Object.defineProperty(f.prototype, "writableHighWaterMark", {
            enumerable: !1,
            get: function () {
              return this._writableState.highWaterMark;
            }
          }),
            Object.defineProperty(f.prototype, "writableBuffer", {
              enumerable: !1,
              get: function () {
                return this._writableState && this._writableState.getBuffer();
              }
            }),
            Object.defineProperty(f.prototype, "writableLength", {
              enumerable: !1,
              get: function () {
                return this._writableState.length;
              }
            }),
            Object.defineProperty(f.prototype, "destroyed", {
              enumerable: !1,
              get: function () {
                return void 0 !== this._readableState && void 0 !== this._writableState && this._readableState.destroyed && this._writableState.destroyed;
              },
              set: function (e) {
                void 0 !== this._readableState && void 0 !== this._writableState && ((this._readableState.destroyed = e), (this._writableState.destroyed = e));
              }
            });
        },
        95163: function (e, t, r) {
          "use strict";
          e.exports = i;
          var n = r(27640);
          function i(e) {
            if (!(this instanceof i)) return new i(e);
            n.call(this, e);
          }
          r(91285)(i, n),
            (i.prototype._transform = function (e, t, r) {
              r(null, e);
            });
        },
        28051: function (e, t, r) {
          "use strict";
          var n,
            i,
            o,
            s,
            a,
            l = r(34406);
          (e.exports = x), (x.ReadableState = E), r(22699).EventEmitter;
          var u = function (e, t) {
              return e.listeners(t).length;
            },
            f = r(15010),
            h = r(48834).Buffer,
            c = (void 0 !== r.g ? r.g : "undefined" != typeof window ? window : "undefined" != typeof self ? self : {}).Uint8Array || function () {},
            d = r(84713);
          i = d && d.debuglog ? d.debuglog("stream") : function () {};
          var g = r(56637),
            p = r(12262),
            m = r(87605).getHighWaterMark,
            b = r(64452).codes,
            y = b.ERR_INVALID_ARG_TYPE,
            v = b.ERR_STREAM_PUSH_AFTER_EOF,
            w = b.ERR_METHOD_NOT_IMPLEMENTED,
            _ = b.ERR_STREAM_UNSHIFT_AFTER_END_EVENT;
          r(91285)(x, f);
          var A = p.errorOrDestroy,
            S = ["error", "close", "destroy", "pause", "resume"];
          function E(e, t, i) {
            (n = n || r(77073)),
              (e = e || {}),
              "boolean" != typeof i && (i = t instanceof n),
              (this.objectMode = !!e.objectMode),
              i && (this.objectMode = this.objectMode || !!e.readableObjectMode),
              (this.highWaterMark = m(this, e, "readableHighWaterMark", i)),
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
              (this.paused = !0),
              (this.emitClose = !1 !== e.emitClose),
              (this.autoDestroy = !!e.autoDestroy),
              (this.destroyed = !1),
              (this.defaultEncoding = e.defaultEncoding || "utf8"),
              (this.awaitDrain = 0),
              (this.readingMore = !1),
              (this.decoder = null),
              (this.encoding = null),
              e.encoding && (o || (o = r(30214).StringDecoder), (this.decoder = new o(e.encoding)), (this.encoding = e.encoding));
          }
          function x(e) {
            if (((n = n || r(77073)), !(this instanceof x))) return new x(e);
            var t = this instanceof n;
            (this._readableState = new E(e, this, t)),
              (this.readable = !0),
              e && ("function" == typeof e.read && (this._read = e.read), "function" == typeof e.destroy && (this._destroy = e.destroy)),
              f.call(this);
          }
          function R(e, t, r, n, o) {
            i("readableAddChunk", t);
            var s,
              a,
              l = e._readableState;
            if (null === t)
              (l.reading = !1),
                (function (e, t) {
                  if ((i("onEofChunk"), !t.ended)) {
                    if (t.decoder) {
                      var r = t.decoder.end();
                      r && r.length && (t.buffer.push(r), (t.length += t.objectMode ? 1 : r.length));
                    }
                    (t.ended = !0), t.sync ? M(e) : ((t.needReadable = !1), t.emittedReadable || ((t.emittedReadable = !0), O(e)));
                  }
                })(e, l);
            else if (
              (o ||
                (a = (function (e, t) {
                  var r;
                  return (
                    !h.isBuffer(t) &&
                      !(t instanceof c) &&
                      "string" != typeof t &&
                      void 0 !== t &&
                      !e.objectMode &&
                      (r = new y("chunk", ["string", "Buffer", "Uint8Array"], t)),
                    r
                  );
                })(l, t)),
              a)
            )
              A(e, a);
            else if (l.objectMode || (t && t.length > 0)) {
              if (("string" != typeof t && !l.objectMode && Object.getPrototypeOf(t) !== h.prototype && ((s = t), (t = h.from(s))), n))
                l.endEmitted ? A(e, new _()) : k(e, l, t, !0);
              else if (l.ended) A(e, new v());
              else {
                if (l.destroyed) return !1;
                (l.reading = !1), l.decoder && !r ? ((t = l.decoder.write(t)), l.objectMode || 0 !== t.length ? k(e, l, t, !1) : C(e, l)) : k(e, l, t, !1);
              }
            } else n || ((l.reading = !1), C(e, l));
            return !l.ended && (l.length < l.highWaterMark || 0 === l.length);
          }
          function k(e, t, r, n) {
            t.flowing && 0 === t.length && !t.sync
              ? ((t.awaitDrain = 0), e.emit("data", r))
              : ((t.length += t.objectMode ? 1 : r.length), n ? t.buffer.unshift(r) : t.buffer.push(r), t.needReadable && M(e)),
              C(e, t);
          }
          function T(e, t) {
            if (e <= 0 || (0 === t.length && t.ended)) return 0;
            if (t.objectMode) return 1;
            if (e != e) return t.flowing && t.length ? t.buffer.head.data.length : t.length;
            if (e > t.highWaterMark) {
              var r;
              t.highWaterMark =
                ((r = e) >= 0x40000000 ? (r = 0x40000000) : (r--, (r |= r >>> 1), (r |= r >>> 2), (r |= r >>> 4), (r |= r >>> 8), (r |= r >>> 16), r++), r);
            }
            return e <= t.length ? e : t.ended ? t.length : ((t.needReadable = !0), 0);
          }
          function M(e) {
            var t = e._readableState;
            i("emitReadable", t.needReadable, t.emittedReadable),
              (t.needReadable = !1),
              t.emittedReadable || (i("emitReadable", t.flowing), (t.emittedReadable = !0), l.nextTick(O, e));
          }
          function O(e) {
            var t = e._readableState;
            i("emitReadable_", t.destroyed, t.length, t.ended),
              !t.destroyed && (t.length || t.ended) && (e.emit("readable"), (t.emittedReadable = !1)),
              (t.needReadable = !t.flowing && !t.ended && t.length <= t.highWaterMark),
              N(e);
          }
          function C(e, t) {
            t.readingMore || ((t.readingMore = !0), l.nextTick(L, e, t));
          }
          function L(e, t) {
            for (; !t.reading && !t.ended && (t.length < t.highWaterMark || (t.flowing && 0 === t.length)); ) {
              var r = t.length;
              if ((i("maybeReadMore read 0"), e.read(0), r === t.length)) break;
            }
            t.readingMore = !1;
          }
          function j(e) {
            var t = e._readableState;
            (t.readableListening = e.listenerCount("readable") > 0),
              t.resumeScheduled && !t.paused ? (t.flowing = !0) : e.listenerCount("data") > 0 && e.resume();
          }
          function B(e) {
            i("readable nexttick read 0"), e.read(0);
          }
          function P(e, t) {
            i("resume", t.reading), t.reading || e.read(0), (t.resumeScheduled = !1), e.emit("resume"), N(e), t.flowing && !t.reading && e.read(0);
          }
          function N(e) {
            var t = e._readableState;
            for (i("flow", t.flowing); t.flowing && null !== e.read(); );
          }
          function I(e, t) {
            var r;
            return 0 === t.length
              ? null
              : (t.objectMode
                  ? (r = t.buffer.shift())
                  : !e || e >= t.length
                    ? ((r = t.decoder ? t.buffer.join("") : 1 === t.buffer.length ? t.buffer.first() : t.buffer.concat(t.length)), t.buffer.clear())
                    : (r = t.buffer.consume(e, t.decoder)),
                r);
          }
          function D(e) {
            var t = e._readableState;
            i("endReadable", t.endEmitted), t.endEmitted || ((t.ended = !0), l.nextTick(U, t, e));
          }
          function U(e, t) {
            if (
              (i("endReadableNT", e.endEmitted, e.length),
              !e.endEmitted && 0 === e.length && ((e.endEmitted = !0), (t.readable = !1), t.emit("end"), e.autoDestroy))
            ) {
              var r = t._writableState;
              (!r || (r.autoDestroy && r.finished)) && t.destroy();
            }
          }
          function W(e, t) {
            for (var r = 0, n = e.length; r < n; r++) if (e[r] === t) return r;
            return -1;
          }
          Object.defineProperty(x.prototype, "destroyed", {
            enumerable: !1,
            get: function () {
              return void 0 !== this._readableState && this._readableState.destroyed;
            },
            set: function (e) {
              this._readableState && (this._readableState.destroyed = e);
            }
          }),
            (x.prototype.destroy = p.destroy),
            (x.prototype._undestroy = p.undestroy),
            (x.prototype._destroy = function (e, t) {
              t(e);
            }),
            (x.prototype.push = function (e, t) {
              var r,
                n = this._readableState;
              return (
                n.objectMode ? (r = !0) : "string" == typeof e && ((t = t || n.defaultEncoding) !== n.encoding && ((e = h.from(e, t)), (t = "")), (r = !0)),
                R(this, e, t, !1, r)
              );
            }),
            (x.prototype.unshift = function (e) {
              return R(this, e, null, !0, !1);
            }),
            (x.prototype.isPaused = function () {
              return !1 === this._readableState.flowing;
            }),
            (x.prototype.setEncoding = function (e) {
              o || (o = r(30214).StringDecoder);
              var t = new o(e);
              (this._readableState.decoder = t), (this._readableState.encoding = this._readableState.decoder.encoding);
              for (var n = this._readableState.buffer.head, i = ""; null !== n; ) (i += t.write(n.data)), (n = n.next);
              return this._readableState.buffer.clear(), "" !== i && this._readableState.buffer.push(i), (this._readableState.length = i.length), this;
            }),
            (x.prototype.read = function (e) {
              i("read", e), (e = parseInt(e, 10));
              var t,
                r = this._readableState,
                n = e;
              if (
                (0 !== e && (r.emittedReadable = !1),
                0 === e && r.needReadable && ((0 !== r.highWaterMark ? r.length >= r.highWaterMark : r.length > 0) || r.ended))
              )
                return i("read: emitReadable", r.length, r.ended), 0 === r.length && r.ended ? D(this) : M(this), null;
              if (0 === (e = T(e, r)) && r.ended) return 0 === r.length && D(this), null;
              var o = r.needReadable;
              return (
                i("need readable", o),
                (0 === r.length || r.length - e < r.highWaterMark) && i("length less than watermark", (o = !0)),
                r.ended || r.reading
                  ? i("reading or ended", (o = !1))
                  : o &&
                    (i("do read"),
                    (r.reading = !0),
                    (r.sync = !0),
                    0 === r.length && (r.needReadable = !0),
                    this._read(r.highWaterMark),
                    (r.sync = !1),
                    r.reading || (e = T(n, r))),
                null === (t = e > 0 ? I(e, r) : null) ? ((r.needReadable = r.length <= r.highWaterMark), (e = 0)) : ((r.length -= e), (r.awaitDrain = 0)),
                0 === r.length && (r.ended || (r.needReadable = !0), n !== e && r.ended && D(this)),
                null !== t && this.emit("data", t),
                t
              );
            }),
            (x.prototype._read = function (e) {
              A(this, new w("_read()"));
            }),
            (x.prototype.pipe = function (e, t) {
              var r,
                n = this,
                o = this._readableState;
              switch (o.pipesCount) {
                case 0:
                  o.pipes = e;
                  break;
                case 1:
                  o.pipes = [o.pipes, e];
                  break;
                default:
                  o.pipes.push(e);
              }
              (o.pipesCount += 1), i("pipe count=%d opts=%j", o.pipesCount, t);
              var s = (t && !1 === t.end) || e === l.stdout || e === l.stderr ? m : a;
              function a() {
                i("onend"), e.end();
              }
              o.endEmitted ? l.nextTick(s) : n.once("end", s),
                e.on("unpipe", function t(r, s) {
                  i("onunpipe"),
                    r === n &&
                      s &&
                      !1 === s.hasUnpiped &&
                      ((s.hasUnpiped = !0),
                      i("cleanup"),
                      e.removeListener("close", g),
                      e.removeListener("finish", p),
                      e.removeListener("drain", f),
                      e.removeListener("error", d),
                      e.removeListener("unpipe", t),
                      n.removeListener("end", a),
                      n.removeListener("end", m),
                      n.removeListener("data", c),
                      (h = !0),
                      o.awaitDrain && (!e._writableState || e._writableState.needDrain) && f());
                });
              var f =
                ((r = n),
                function () {
                  var e = r._readableState;
                  i("pipeOnDrain", e.awaitDrain), e.awaitDrain && e.awaitDrain--, 0 === e.awaitDrain && u(r, "data") && ((e.flowing = !0), N(r));
                });
              e.on("drain", f);
              var h = !1;
              function c(t) {
                i("ondata");
                var r = e.write(t);
                i("dest.write", r),
                  !1 === r &&
                    (((1 === o.pipesCount && o.pipes === e) || (o.pipesCount > 1 && -1 !== W(o.pipes, e))) &&
                      !h &&
                      (i("false write response, pause", o.awaitDrain), o.awaitDrain++),
                    n.pause());
              }
              function d(t) {
                i("onerror", t), m(), e.removeListener("error", d), 0 === u(e, "error") && A(e, t);
              }
              function g() {
                e.removeListener("finish", p), m();
              }
              function p() {
                i("onfinish"), e.removeListener("close", g), m();
              }
              function m() {
                i("unpipe"), n.unpipe(e);
              }
              return (
                n.on("data", c),
                (function (e, t, r) {
                  if ("function" == typeof e.prependListener) return e.prependListener(t, r);
                  e._events && e._events[t] ? (Array.isArray(e._events[t]) ? e._events[t].unshift(r) : (e._events[t] = [r, e._events[t]])) : e.on(t, r);
                })(e, "error", d),
                e.once("close", g),
                e.once("finish", p),
                e.emit("pipe", n),
                o.flowing || (i("pipe resume"), n.resume()),
                e
              );
            }),
            (x.prototype.unpipe = function (e) {
              var t = this._readableState,
                r = { hasUnpiped: !1 };
              if (0 === t.pipesCount) return this;
              if (1 === t.pipesCount)
                return (
                  (e && e !== t.pipes) || (e || (e = t.pipes), (t.pipes = null), (t.pipesCount = 0), (t.flowing = !1), e && e.emit("unpipe", this, r)), this
                );
              if (!e) {
                var n = t.pipes,
                  i = t.pipesCount;
                (t.pipes = null), (t.pipesCount = 0), (t.flowing = !1);
                for (var o = 0; o < i; o++) n[o].emit("unpipe", this, { hasUnpiped: !1 });
                return this;
              }
              var s = W(t.pipes, e);
              return -1 === s || (t.pipes.splice(s, 1), (t.pipesCount -= 1), 1 === t.pipesCount && (t.pipes = t.pipes[0]), e.emit("unpipe", this, r)), this;
            }),
            (x.prototype.on = function (e, t) {
              var r = f.prototype.on.call(this, e, t),
                n = this._readableState;
              return (
                "data" === e
                  ? ((n.readableListening = this.listenerCount("readable") > 0), !1 !== n.flowing && this.resume())
                  : "readable" !== e ||
                    n.endEmitted ||
                    n.readableListening ||
                    ((n.readableListening = n.needReadable = !0),
                    (n.flowing = !1),
                    (n.emittedReadable = !1),
                    i("on readable", n.length, n.reading),
                    n.length ? M(this) : n.reading || l.nextTick(B, this)),
                r
              );
            }),
            (x.prototype.addListener = x.prototype.on),
            (x.prototype.removeListener = function (e, t) {
              var r = f.prototype.removeListener.call(this, e, t);
              return "readable" === e && l.nextTick(j, this), r;
            }),
            (x.prototype.removeAllListeners = function (e) {
              var t = f.prototype.removeAllListeners.apply(this, arguments);
              return ("readable" === e || void 0 === e) && l.nextTick(j, this), t;
            }),
            (x.prototype.resume = function () {
              var e,
                t,
                r = this._readableState;
              return (
                r.flowing ||
                  (i("resume"), (r.flowing = !r.readableListening), (e = this), (t = r).resumeScheduled || ((t.resumeScheduled = !0), l.nextTick(P, e, t))),
                (r.paused = !1),
                this
              );
            }),
            (x.prototype.pause = function () {
              return (
                i("call pause flowing=%j", this._readableState.flowing),
                !1 !== this._readableState.flowing && (i("pause"), (this._readableState.flowing = !1), this.emit("pause")),
                (this._readableState.paused = !0),
                this
              );
            }),
            (x.prototype.wrap = function (e) {
              var t = this,
                r = this._readableState,
                n = !1;
              for (var o in (e.on("end", function () {
                if ((i("wrapped end"), r.decoder && !r.ended)) {
                  var e = r.decoder.end();
                  e && e.length && t.push(e);
                }
                t.push(null);
              }),
              e.on("data", function (o) {
                if ((i("wrapped data"), r.decoder && (o = r.decoder.write(o)), !r.objectMode || null != o))
                  (r.objectMode || (o && o.length)) && (t.push(o) || ((n = !0), e.pause()));
              }),
              e))
                void 0 === this[o] &&
                  "function" == typeof e[o] &&
                  (this[o] = (function (t) {
                    return function () {
                      return e[t].apply(e, arguments);
                    };
                  })(o));
              for (var s = 0; s < S.length; s++) e.on(S[s], this.emit.bind(this, S[s]));
              return (
                (this._read = function (t) {
                  i("wrapped _read", t), n && ((n = !1), e.resume());
                }),
                this
              );
            }),
            "function" == typeof Symbol &&
              (x.prototype[Symbol.asyncIterator] = function () {
                return void 0 === s && (s = r(1029)), s(this);
              }),
            Object.defineProperty(x.prototype, "readableHighWaterMark", {
              enumerable: !1,
              get: function () {
                return this._readableState.highWaterMark;
              }
            }),
            Object.defineProperty(x.prototype, "readableBuffer", {
              enumerable: !1,
              get: function () {
                return this._readableState && this._readableState.buffer;
              }
            }),
            Object.defineProperty(x.prototype, "readableFlowing", {
              enumerable: !1,
              get: function () {
                return this._readableState.flowing;
              },
              set: function (e) {
                this._readableState && (this._readableState.flowing = e);
              }
            }),
            (x._fromList = I),
            Object.defineProperty(x.prototype, "readableLength", {
              enumerable: !1,
              get: function () {
                return this._readableState.length;
              }
            }),
            "function" == typeof Symbol &&
              (x.from = function (e, t) {
                return void 0 === a && (a = r(90352)), a(x, e, t);
              });
        },
        27640: function (e, t, r) {
          "use strict";
          e.exports = f;
          var n = r(64452).codes,
            i = n.ERR_METHOD_NOT_IMPLEMENTED,
            o = n.ERR_MULTIPLE_CALLBACK,
            s = n.ERR_TRANSFORM_ALREADY_TRANSFORMING,
            a = n.ERR_TRANSFORM_WITH_LENGTH_0,
            l = r(77073);
          function u(e, t) {
            var r = this._transformState;
            r.transforming = !1;
            var n = r.writecb;
            if (null === n) return this.emit("error", new o());
            (r.writechunk = null), (r.writecb = null), null != t && this.push(t), n(e);
            var i = this._readableState;
            (i.reading = !1), (i.needReadable || i.length < i.highWaterMark) && this._read(i.highWaterMark);
          }
          function f(e) {
            if (!(this instanceof f)) return new f(e);
            l.call(this, e),
              (this._transformState = {
                afterTransform: u.bind(this),
                needTransform: !1,
                transforming: !1,
                writecb: null,
                writechunk: null,
                writeencoding: null
              }),
              (this._readableState.needReadable = !0),
              (this._readableState.sync = !1),
              e && ("function" == typeof e.transform && (this._transform = e.transform), "function" == typeof e.flush && (this._flush = e.flush)),
              this.on("prefinish", h);
          }
          function h() {
            var e = this;
            "function" != typeof this._flush || this._readableState.destroyed
              ? c(this, null, null)
              : this._flush(function (t, r) {
                  c(e, t, r);
                });
          }
          function c(e, t, r) {
            if (t) return e.emit("error", t);
            if ((null != r && e.push(r), e._writableState.length)) throw new a();
            if (e._transformState.transforming) throw new s();
            return e.push(null);
          }
          r(91285)(f, l),
            (f.prototype.push = function (e, t) {
              return (this._transformState.needTransform = !1), l.prototype.push.call(this, e, t);
            }),
            (f.prototype._transform = function (e, t, r) {
              r(new i("_transform()"));
            }),
            (f.prototype._write = function (e, t, r) {
              var n = this._transformState;
              if (((n.writecb = r), (n.writechunk = e), (n.writeencoding = t), !n.transforming)) {
                var i = this._readableState;
                (n.needTransform || i.needReadable || i.length < i.highWaterMark) && this._read(i.highWaterMark);
              }
            }),
            (f.prototype._read = function (e) {
              var t = this._transformState;
              null === t.writechunk || t.transforming
                ? (t.needTransform = !0)
                : ((t.transforming = !0), this._transform(t.writechunk, t.writeencoding, t.afterTransform));
            }),
            (f.prototype._destroy = function (e, t) {
              l.prototype._destroy.call(this, e, function (e) {
                t(e);
              });
            });
        },
        2557: function (e, t, r) {
          "use strict";
          var n,
            i,
            o = r(34406);
          function s(e) {
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
                  t.corkedRequestsFree.next = e;
                })(t, e);
              });
          }
          (e.exports = x), (x.WritableState = E);
          var a = { deprecate: r(5803) },
            l = r(15010),
            u = r(48834).Buffer,
            f = (void 0 !== r.g ? r.g : "undefined" != typeof window ? window : "undefined" != typeof self ? self : {}).Uint8Array || function () {},
            h = r(12262),
            c = r(87605).getHighWaterMark,
            d = r(64452).codes,
            g = d.ERR_INVALID_ARG_TYPE,
            p = d.ERR_METHOD_NOT_IMPLEMENTED,
            m = d.ERR_MULTIPLE_CALLBACK,
            b = d.ERR_STREAM_CANNOT_PIPE,
            y = d.ERR_STREAM_DESTROYED,
            v = d.ERR_STREAM_NULL_VALUES,
            w = d.ERR_STREAM_WRITE_AFTER_END,
            _ = d.ERR_UNKNOWN_ENCODING,
            A = h.errorOrDestroy;
          function S() {}
          function E(e, t, i) {
            (n = n || r(77073)),
              (e = e || {}),
              "boolean" != typeof i && (i = t instanceof n),
              (this.objectMode = !!e.objectMode),
              i && (this.objectMode = this.objectMode || !!e.writableObjectMode),
              (this.highWaterMark = c(this, e, "writableHighWaterMark", i)),
              (this.finalCalled = !1),
              (this.needDrain = !1),
              (this.ending = !1),
              (this.ended = !1),
              (this.finished = !1),
              (this.destroyed = !1);
            var a = !1 === e.decodeStrings;
            (this.decodeStrings = !a),
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
                  if ("function" != typeof i) throw new m();
                  if (((r.writing = !1), (r.writecb = null), (r.length -= r.writelen), (r.writelen = 0), t))
                    --r.pendingcb,
                      n
                        ? (o.nextTick(i, t), o.nextTick(C, e, r), (e._writableState.errorEmitted = !0), A(e, t))
                        : (i(t), (e._writableState.errorEmitted = !0), A(e, t), C(e, r));
                  else {
                    var s = M(r) || e.destroyed;
                    s || r.corked || r.bufferProcessing || !r.bufferedRequest || T(e, r), n ? o.nextTick(k, e, r, s, i) : k(e, r, s, i);
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
              (this.emitClose = !1 !== e.emitClose),
              (this.autoDestroy = !!e.autoDestroy),
              (this.bufferedRequestCount = 0),
              (this.corkedRequestsFree = new s(this));
          }
          function x(e) {
            var t = this instanceof (n = n || r(77073));
            if (!t && !i.call(x, this)) return new x(e);
            (this._writableState = new E(e, this, t)),
              (this.writable = !0),
              e &&
                ("function" == typeof e.write && (this._write = e.write),
                "function" == typeof e.writev && (this._writev = e.writev),
                "function" == typeof e.destroy && (this._destroy = e.destroy),
                "function" == typeof e.final && (this._final = e.final)),
              l.call(this);
          }
          function R(e, t, r, n, i, o, s) {
            (t.writelen = n),
              (t.writecb = s),
              (t.writing = !0),
              (t.sync = !0),
              t.destroyed ? t.onwrite(new y("write")) : r ? e._writev(i, t.onwrite) : e._write(i, o, t.onwrite),
              (t.sync = !1);
          }
          function k(e, t, r, n) {
            var i, o;
            r || ((i = e), 0 === (o = t).length && o.needDrain && ((o.needDrain = !1), i.emit("drain"))), t.pendingcb--, n(), C(e, t);
          }
          function T(e, t) {
            t.bufferProcessing = !0;
            var r = t.bufferedRequest;
            if (e._writev && r && r.next) {
              var n = Array(t.bufferedRequestCount),
                i = t.corkedRequestsFree;
              i.entry = r;
              for (var o = 0, a = !0; r; ) (n[o] = r), r.isBuf || (a = !1), (r = r.next), (o += 1);
              (n.allBuffers = a),
                R(e, t, !0, t.length, n, "", i.finish),
                t.pendingcb++,
                (t.lastBufferedRequest = null),
                i.next ? ((t.corkedRequestsFree = i.next), (i.next = null)) : (t.corkedRequestsFree = new s(t)),
                (t.bufferedRequestCount = 0);
            } else {
              for (; r; ) {
                var l = r.chunk,
                  u = r.encoding,
                  f = r.callback,
                  h = t.objectMode ? 1 : l.length;
                if ((R(e, t, !1, h, l, u, f), (r = r.next), t.bufferedRequestCount--, t.writing)) break;
              }
              null === r && (t.lastBufferedRequest = null);
            }
            (t.bufferedRequest = r), (t.bufferProcessing = !1);
          }
          function M(e) {
            return e.ending && 0 === e.length && null === e.bufferedRequest && !e.finished && !e.writing;
          }
          function O(e, t) {
            e._final(function (r) {
              t.pendingcb--, r && A(e, r), (t.prefinished = !0), e.emit("prefinish"), C(e, t);
            });
          }
          function C(e, t) {
            var r = M(t);
            if (
              r &&
              (t.prefinished ||
                t.finalCalled ||
                ("function" != typeof e._final || t.destroyed
                  ? ((t.prefinished = !0), e.emit("prefinish"))
                  : (t.pendingcb++, (t.finalCalled = !0), o.nextTick(O, e, t))),
              0 === t.pendingcb && ((t.finished = !0), e.emit("finish"), t.autoDestroy))
            ) {
              var n = e._readableState;
              (!n || (n.autoDestroy && n.endEmitted)) && e.destroy();
            }
            return r;
          }
          r(91285)(x, l),
            (E.prototype.getBuffer = function () {
              for (var e = this.bufferedRequest, t = []; e; ) t.push(e), (e = e.next);
              return t;
            }),
            (function () {
              try {
                Object.defineProperty(E.prototype, "buffer", {
                  get: a.deprecate(
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
                Object.defineProperty(x, Symbol.hasInstance, {
                  value: function (e) {
                    return !!i.call(this, e) || (this === x && e && e._writableState instanceof E);
                  }
                }))
              : (i = function (e) {
                  return e instanceof this;
                }),
            (x.prototype.pipe = function () {
              A(this, new b());
            }),
            (x.prototype.write = function (e, t, r) {
              var n,
                i,
                s,
                a,
                l,
                h,
                c,
                d = this._writableState,
                p = !1,
                m = !d.objectMode && ((n = e), u.isBuffer(n) || n instanceof f);
              return (
                m && !u.isBuffer(e) && ((i = e), (e = u.from(i))),
                ("function" == typeof t && ((r = t), (t = null)),
                m ? (t = "buffer") : t || (t = d.defaultEncoding),
                "function" != typeof r && (r = S),
                d.ending)
                  ? ((s = r), A(this, (a = new w())), o.nextTick(s, a))
                  : (m ||
                      ((l = e),
                      (h = r),
                      null === l ? (c = new v()) : "string" == typeof l || d.objectMode || (c = new g("chunk", ["string", "Buffer"], l)),
                      !c || (A(this, c), o.nextTick(h, c), 0))) &&
                    (d.pendingcb++,
                    (p = (function (e, t, r, n, i, o) {
                      if (!r) {
                        var s,
                          a,
                          l = ((s = n), (a = i), t.objectMode || !1 === t.decodeStrings || "string" != typeof s || (s = u.from(s, a)), s);
                        n !== l && ((r = !0), (i = "buffer"), (n = l));
                      }
                      var f = t.objectMode ? 1 : n.length;
                      t.length += f;
                      var h = t.length < t.highWaterMark;
                      if ((h || (t.needDrain = !0), t.writing || t.corked)) {
                        var c = t.lastBufferedRequest;
                        (t.lastBufferedRequest = { chunk: n, encoding: i, isBuf: r, callback: o, next: null }),
                          c ? (c.next = t.lastBufferedRequest) : (t.bufferedRequest = t.lastBufferedRequest),
                          (t.bufferedRequestCount += 1);
                      } else R(e, t, !1, f, n, i, o);
                      return h;
                    })(this, d, m, e, t, r))),
                p
              );
            }),
            (x.prototype.cork = function () {
              this._writableState.corked++;
            }),
            (x.prototype.uncork = function () {
              var e = this._writableState;
              !e.corked || (e.corked--, e.writing || e.corked || e.bufferProcessing || !e.bufferedRequest || T(this, e));
            }),
            (x.prototype.setDefaultEncoding = function (e) {
              if (
                ("string" == typeof e && (e = e.toLowerCase()),
                !(["hex", "utf8", "utf-8", "ascii", "binary", "base64", "ucs2", "ucs-2", "utf16le", "utf-16le", "raw"].indexOf((e + "").toLowerCase()) > -1))
              )
                throw new _(e);
              return (this._writableState.defaultEncoding = e), this;
            }),
            Object.defineProperty(x.prototype, "writableBuffer", {
              enumerable: !1,
              get: function () {
                return this._writableState && this._writableState.getBuffer();
              }
            }),
            Object.defineProperty(x.prototype, "writableHighWaterMark", {
              enumerable: !1,
              get: function () {
                return this._writableState.highWaterMark;
              }
            }),
            (x.prototype._write = function (e, t, r) {
              r(new p("_write()"));
            }),
            (x.prototype._writev = null),
            (x.prototype.end = function (e, t, r) {
              var n,
                i,
                s,
                a = this._writableState;
              return (
                "function" == typeof e ? ((r = e), (e = null), (t = null)) : "function" == typeof t && ((r = t), (t = null)),
                null != e && this.write(e, t),
                a.corked && ((a.corked = 1), this.uncork()),
                a.ending ||
                  ((n = this),
                  (i = a),
                  (s = r),
                  (i.ending = !0),
                  C(n, i),
                  s && (i.finished ? o.nextTick(s) : n.once("finish", s)),
                  (i.ended = !0),
                  (n.writable = !1)),
                this
              );
            }),
            Object.defineProperty(x.prototype, "writableLength", {
              enumerable: !1,
              get: function () {
                return this._writableState.length;
              }
            }),
            Object.defineProperty(x.prototype, "destroyed", {
              enumerable: !1,
              get: function () {
                return void 0 !== this._writableState && this._writableState.destroyed;
              },
              set: function (e) {
                this._writableState && (this._writableState.destroyed = e);
              }
            }),
            (x.prototype.destroy = h.destroy),
            (x.prototype._undestroy = h.undestroy),
            (x.prototype._destroy = function (e, t) {
              t(e);
            });
        },
        1029: function (e, t, r) {
          "use strict";
          var n,
            i = r(34406);
          function o(e, t, r) {
            var n;
            return (
              (t =
                "symbol" ==
                typeof (n = (function (e, t) {
                  if ("object" != typeof e || null === e) return e;
                  var r = e[Symbol.toPrimitive];
                  if (void 0 !== r) {
                    var n = r.call(e, t || "default");
                    if ("object" != typeof n) return n;
                    throw TypeError("@@toPrimitive must return a primitive value.");
                  }
                  return ("string" === t ? String : Number)(e);
                })(t, "string"))
                  ? n
                  : String(n)) in e
                ? Object.defineProperty(e, t, { value: r, enumerable: !0, configurable: !0, writable: !0 })
                : (e[t] = r),
              e
            );
          }
          var s = r(59885),
            a = Symbol("lastResolve"),
            l = Symbol("lastReject"),
            u = Symbol("error"),
            f = Symbol("ended"),
            h = Symbol("lastPromise"),
            c = Symbol("handlePromise"),
            d = Symbol("stream");
          function g(e, t) {
            return { value: e, done: t };
          }
          function p(e) {
            var t = e[a];
            if (null !== t) {
              var r = e[d].read();
              null !== r && ((e[h] = null), (e[a] = null), (e[l] = null), t(g(r, !1)));
            }
          }
          function m(e) {
            i.nextTick(p, e);
          }
          var b = Object.getPrototypeOf(function () {}),
            y = Object.setPrototypeOf(
              (o(
                (n = {
                  get stream() {
                    return this[d];
                  },
                  next: function () {
                    var e,
                      t,
                      r = this,
                      n = this[u];
                    if (null !== n) return Promise.reject(n);
                    if (this[f]) return Promise.resolve(g(void 0, !0));
                    if (this[d].destroyed)
                      return new Promise(function (e, t) {
                        i.nextTick(function () {
                          r[u] ? t(r[u]) : e(g(void 0, !0));
                        });
                      });
                    var o = this[h];
                    if (o)
                      t = new Promise(
                        ((e = this),
                        function (t, r) {
                          o.then(function () {
                            if (e[f]) {
                              t(g(void 0, !0));
                              return;
                            }
                            e[c](t, r);
                          }, r);
                        })
                      );
                    else {
                      var s = this[d].read();
                      if (null !== s) return Promise.resolve(g(s, !1));
                      t = new Promise(this[c]);
                    }
                    return (this[h] = t), t;
                  }
                }),
                Symbol.asyncIterator,
                function () {
                  return this;
                }
              ),
              o(n, "return", function () {
                var e = this;
                return new Promise(function (t, r) {
                  e[d].destroy(null, function (e) {
                    if (e) {
                      r(e);
                      return;
                    }
                    t(g(void 0, !0));
                  });
                });
              }),
              n),
              b
            );
          e.exports = function (e) {
            var t,
              r = Object.create(
                y,
                (o((t = {}), d, { value: e, writable: !0 }),
                o(t, a, { value: null, writable: !0 }),
                o(t, l, { value: null, writable: !0 }),
                o(t, u, { value: null, writable: !0 }),
                o(t, f, { value: e._readableState.endEmitted, writable: !0 }),
                o(t, c, {
                  value: function (e, t) {
                    var n = r[d].read();
                    n ? ((r[h] = null), (r[a] = null), (r[l] = null), e(g(n, !1))) : ((r[a] = e), (r[l] = t));
                  },
                  writable: !0
                }),
                t)
              );
            return (
              (r[h] = null),
              s(e, function (e) {
                if (e && "ERR_STREAM_PREMATURE_CLOSE" !== e.code) {
                  var t = r[l];
                  null !== t && ((r[h] = null), (r[a] = null), (r[l] = null), t(e)), (r[u] = e);
                  return;
                }
                var n = r[a];
                null !== n && ((r[h] = null), (r[a] = null), (r[l] = null), n(g(void 0, !0))), (r[f] = !0);
              }),
              e.on("readable", m.bind(null, r)),
              r
            );
          };
        },
        56637: function (e, t, r) {
          "use strict";
          function n(e, t) {
            var r = Object.keys(e);
            if (Object.getOwnPropertySymbols) {
              var n = Object.getOwnPropertySymbols(e);
              t &&
                (n = n.filter(function (t) {
                  return Object.getOwnPropertyDescriptor(e, t).enumerable;
                })),
                r.push.apply(r, n);
            }
            return r;
          }
          function i(e) {
            for (var t = 1; t < arguments.length; t++) {
              var r = null != arguments[t] ? arguments[t] : {};
              t % 2
                ? n(Object(r), !0).forEach(function (t) {
                    var n, i, s;
                    (n = e),
                      (i = t),
                      (s = r[t]),
                      (i = o(i)) in n ? Object.defineProperty(n, i, { value: s, enumerable: !0, configurable: !0, writable: !0 }) : (n[i] = s);
                  })
                : Object.getOwnPropertyDescriptors
                  ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(r))
                  : n(Object(r)).forEach(function (t) {
                      Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(r, t));
                    });
            }
            return e;
          }
          function o(e) {
            var t = (function (e, t) {
              if ("object" != typeof e || null === e) return e;
              var r = e[Symbol.toPrimitive];
              if (void 0 !== r) {
                var n = r.call(e, t || "default");
                if ("object" != typeof n) return n;
                throw TypeError("@@toPrimitive must return a primitive value.");
              }
              return ("string" === t ? String : Number)(e);
            })(e, "string");
            return "symbol" == typeof t ? t : String(t);
          }
          var s = r(48834).Buffer,
            a = r(79549).inspect,
            l = (a && a.custom) || "inspect";
          e.exports = (function () {
            var e;
            function t() {
              (function (e, t) {
                if (!(e instanceof t)) throw TypeError("Cannot call a class as a function");
              })(this, t),
                (this.head = null),
                (this.tail = null),
                (this.length = 0);
            }
            return (
              (e = [
                {
                  key: "push",
                  value: function (e) {
                    var t = { data: e, next: null };
                    this.length > 0 ? (this.tail.next = t) : (this.head = t), (this.tail = t), ++this.length;
                  }
                },
                {
                  key: "unshift",
                  value: function (e) {
                    var t = { data: e, next: this.head };
                    0 === this.length && (this.tail = t), (this.head = t), ++this.length;
                  }
                },
                {
                  key: "shift",
                  value: function () {
                    if (0 !== this.length) {
                      var e = this.head.data;
                      return 1 === this.length ? (this.head = this.tail = null) : (this.head = this.head.next), --this.length, e;
                    }
                  }
                },
                {
                  key: "clear",
                  value: function () {
                    (this.head = this.tail = null), (this.length = 0);
                  }
                },
                {
                  key: "join",
                  value: function (e) {
                    if (0 === this.length) return "";
                    for (var t = this.head, r = "" + t.data; (t = t.next); ) r += e + t.data;
                    return r;
                  }
                },
                {
                  key: "concat",
                  value: function (e) {
                    if (0 === this.length) return s.alloc(0);
                    for (var t, r, n = s.allocUnsafe(e >>> 0), i = this.head, o = 0; i; )
                      (t = i.data), (r = o), s.prototype.copy.call(t, n, r), (o += i.data.length), (i = i.next);
                    return n;
                  }
                },
                {
                  key: "consume",
                  value: function (e, t) {
                    var r;
                    return (
                      e < this.head.data.length
                        ? ((r = this.head.data.slice(0, e)), (this.head.data = this.head.data.slice(e)))
                        : (r = e === this.head.data.length ? this.shift() : t ? this._getString(e) : this._getBuffer(e)),
                      r
                    );
                  }
                },
                {
                  key: "first",
                  value: function () {
                    return this.head.data;
                  }
                },
                {
                  key: "_getString",
                  value: function (e) {
                    var t = this.head,
                      r = 1,
                      n = t.data;
                    for (e -= n.length; (t = t.next); ) {
                      var i = t.data,
                        o = e > i.length ? i.length : e;
                      if ((o === i.length ? (n += i) : (n += i.slice(0, e)), 0 == (e -= o))) {
                        o === i.length ? (++r, t.next ? (this.head = t.next) : (this.head = this.tail = null)) : ((this.head = t), (t.data = i.slice(o)));
                        break;
                      }
                      ++r;
                    }
                    return (this.length -= r), n;
                  }
                },
                {
                  key: "_getBuffer",
                  value: function (e) {
                    var t = s.allocUnsafe(e),
                      r = this.head,
                      n = 1;
                    for (r.data.copy(t), e -= r.data.length; (r = r.next); ) {
                      var i = r.data,
                        o = e > i.length ? i.length : e;
                      if ((i.copy(t, t.length - e, 0, o), 0 == (e -= o))) {
                        o === i.length ? (++n, r.next ? (this.head = r.next) : (this.head = this.tail = null)) : ((this.head = r), (r.data = i.slice(o)));
                        break;
                      }
                      ++n;
                    }
                    return (this.length -= n), t;
                  }
                },
                {
                  key: l,
                  value: function (e, t) {
                    return a(this, i(i({}, t), {}, { depth: 0, customInspect: !1 }));
                  }
                }
              ]),
              (function (e, t) {
                for (var r = 0; r < t.length; r++) {
                  var n = t[r];
                  (n.enumerable = n.enumerable || !1), (n.configurable = !0), "value" in n && (n.writable = !0), Object.defineProperty(e, o(n.key), n);
                }
              })(t.prototype, e),
              Object.defineProperty(t, "prototype", { writable: !1 }),
              t
            );
          })();
        },
        12262: function (e, t, r) {
          "use strict";
          var n = r(34406);
          function i(e, t) {
            s(e, t), o(e);
          }
          function o(e) {
            (!e._writableState || e._writableState.emitClose) && (!e._readableState || e._readableState.emitClose) && e.emit("close");
          }
          function s(e, t) {
            e.emit("error", t);
          }
          e.exports = {
            destroy: function (e, t) {
              var r = this,
                a = this._readableState && this._readableState.destroyed,
                l = this._writableState && this._writableState.destroyed;
              return (
                a || l
                  ? t
                    ? t(e)
                    : e &&
                      (this._writableState
                        ? this._writableState.errorEmitted || ((this._writableState.errorEmitted = !0), n.nextTick(s, this, e))
                        : n.nextTick(s, this, e))
                  : (this._readableState && (this._readableState.destroyed = !0),
                    this._writableState && (this._writableState.destroyed = !0),
                    this._destroy(e || null, function (e) {
                      !t && e
                        ? r._writableState
                          ? r._writableState.errorEmitted
                            ? n.nextTick(o, r)
                            : ((r._writableState.errorEmitted = !0), n.nextTick(i, r, e))
                          : n.nextTick(i, r, e)
                        : t
                          ? (n.nextTick(o, r), t(e))
                          : n.nextTick(o, r);
                    })),
                this
              );
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
                  (this._writableState.finalCalled = !1),
                  (this._writableState.prefinished = !1),
                  (this._writableState.finished = !1),
                  (this._writableState.errorEmitted = !1));
            },
            errorOrDestroy: function (e, t) {
              var r = e._readableState,
                n = e._writableState;
              (r && r.autoDestroy) || (n && n.autoDestroy) ? e.destroy(t) : e.emit("error", t);
            }
          };
        },
        59885: function (e, t, r) {
          "use strict";
          var n = r(64452).codes.ERR_STREAM_PREMATURE_CLOSE;
          function i() {}
          e.exports = function e(t, r, o) {
            if ("function" == typeof r) return e(t, null, r);
            r || (r = {}),
              (s = o || i),
              (a = !1),
              (o = function () {
                if (!a) {
                  a = !0;
                  for (var e = arguments.length, t = Array(e), r = 0; r < e; r++) t[r] = arguments[r];
                  s.apply(this, t);
                }
              });
            var s,
              a,
              l = r.readable || (!1 !== r.readable && t.readable),
              u = r.writable || (!1 !== r.writable && t.writable),
              f = function () {
                t.writable || c();
              },
              h = t._writableState && t._writableState.finished,
              c = function () {
                (u = !1), (h = !0), l || o.call(t);
              },
              d = t._readableState && t._readableState.endEmitted,
              g = function () {
                (l = !1), (d = !0), u || o.call(t);
              },
              p = function (e) {
                o.call(t, e);
              },
              m = function () {
                var e;
                return l && !d
                  ? ((t._readableState && t._readableState.ended) || (e = new n()), o.call(t, e))
                  : u && !h
                    ? ((t._writableState && t._writableState.ended) || (e = new n()), o.call(t, e))
                    : void 0;
              },
              b = function () {
                t.req.on("finish", c);
              };
            return (
              t.setHeader && "function" == typeof t.abort
                ? (t.on("complete", c), t.on("abort", m), t.req ? b() : t.on("request", b))
                : u && !t._writableState && (t.on("end", f), t.on("close", f)),
              t.on("end", g),
              t.on("finish", c),
              !1 !== r.error && t.on("error", p),
              t.on("close", m),
              function () {
                t.removeListener("complete", c),
                  t.removeListener("abort", m),
                  t.removeListener("request", b),
                  t.req && t.req.removeListener("finish", c),
                  t.removeListener("end", f),
                  t.removeListener("close", f),
                  t.removeListener("finish", c),
                  t.removeListener("end", g),
                  t.removeListener("error", p),
                  t.removeListener("close", m);
              }
            );
          };
        },
        90352: function (e) {
          e.exports = function () {
            throw Error("Readable.from is not available in the browser");
          };
        },
        63495: function (e, t, r) {
          "use strict";
          var n,
            i = r(64452).codes,
            o = i.ERR_MISSING_ARGS,
            s = i.ERR_STREAM_DESTROYED;
          function a(e) {
            if (e) throw e;
          }
          function l(e) {
            e();
          }
          function u(e, t) {
            return e.pipe(t);
          }
          e.exports = function () {
            for (var e, t, i = arguments.length, f = Array(i), h = 0; h < i; h++) f[h] = arguments[h];
            var c = (e = f).length && "function" == typeof e[e.length - 1] ? e.pop() : a;
            if ((Array.isArray(f[0]) && (f = f[0]), f.length < 2)) throw new o("streams");
            var d = f.map(function (e, i) {
              var o,
                a,
                u,
                h,
                g,
                p,
                m = i < f.length - 1;
              return (
                (o = i > 0),
                (u = a =
                  function (e) {
                    t || (t = e), e && d.forEach(l), m || (d.forEach(l), c(t));
                  }),
                (h = !1),
                (a = function () {
                  h || ((h = !0), u.apply(void 0, arguments));
                }),
                (g = !1),
                e.on("close", function () {
                  g = !0;
                }),
                void 0 === n && (n = r(59885)),
                n(e, { readable: m, writable: o }, function (e) {
                  if (e) return a(e);
                  (g = !0), a();
                }),
                (p = !1),
                function (t) {
                  if (!g && !p) {
                    if (((p = !0), e.setHeader && "function" == typeof e.abort)) return e.abort();
                    if ("function" == typeof e.destroy) return e.destroy();
                    a(t || new s("pipe"));
                  }
                }
              );
            });
            return f.reduce(u);
          };
        },
        87605: function (e, t, r) {
          "use strict";
          var n = r(64452).codes.ERR_INVALID_OPT_VALUE;
          e.exports = {
            getHighWaterMark: function (e, t, r, i) {
              var o = null != t.highWaterMark ? t.highWaterMark : i ? t[r] : null;
              if (null != o) {
                if (!(isFinite(o) && Math.floor(o) === o) || o < 0) throw new n(i ? r : "highWaterMark", o);
                return Math.floor(o);
              }
              return e.objectMode ? 16 : 16384;
            }
          };
        },
        15010: function (e, t, r) {
          e.exports = r(22699).EventEmitter;
        },
        77834: function (e, t, r) {
          var n = r(48834),
            i = n.Buffer;
          function o(e, t) {
            for (var r in e) t[r] = e[r];
          }
          function s(e, t, r) {
            return i(e, t, r);
          }
          i.from && i.alloc && i.allocUnsafe && i.allocUnsafeSlow ? (e.exports = n) : (o(n, t), (t.Buffer = s)),
            (s.prototype = Object.create(i.prototype)),
            o(i, s),
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
        54851: function (e, t, r) {
          e.exports = i;
          var n = r(22699).EventEmitter;
          function i() {
            n.call(this);
          }
          r(91285)(i, n),
            (i.Readable = r(28051)),
            (i.Writable = r(2557)),
            (i.Duplex = r(77073)),
            (i.Transform = r(27640)),
            (i.PassThrough = r(95163)),
            (i.finished = r(59885)),
            (i.pipeline = r(63495)),
            (i.Stream = i),
            (i.prototype.pipe = function (e, t) {
              var r = this;
              function i(t) {
                e.writable && !1 === e.write(t) && r.pause && r.pause();
              }
              function o() {
                r.readable && r.resume && r.resume();
              }
              r.on("data", i), e.on("drain", o), e._isStdio || (t && !1 === t.end) || (r.on("end", a), r.on("close", l));
              var s = !1;
              function a() {
                s || ((s = !0), e.end());
              }
              function l() {
                s || ((s = !0), "function" == typeof e.destroy && e.destroy());
              }
              function u(e) {
                if ((f(), 0 === n.listenerCount(this, "error"))) throw e;
              }
              function f() {
                r.removeListener("data", i),
                  e.removeListener("drain", o),
                  r.removeListener("end", a),
                  r.removeListener("close", l),
                  r.removeListener("error", u),
                  e.removeListener("error", u),
                  r.removeListener("end", f),
                  r.removeListener("close", f),
                  e.removeListener("close", f);
              }
              return r.on("error", u), e.on("error", u), r.on("end", f), r.on("close", f), e.on("close", f), e.emit("pipe", r), e;
            });
        },
        30214: function (e, t, r) {
          "use strict";
          var n = r(77834).Buffer,
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
          function o(e) {
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
                (this.fillLast = a), (t = 4);
                break;
              case "base64":
                (this.text = f), (this.end = h), (t = 3);
                break;
              default:
                (this.write = c), (this.end = d);
                return;
            }
            (this.lastNeed = 0), (this.lastTotal = 0), (this.lastChar = n.allocUnsafe(t));
          }
          function s(e) {
            return e <= 127 ? 0 : e >> 5 == 6 ? 2 : e >> 4 == 14 ? 3 : e >> 3 == 30 ? 4 : e >> 6 == 2 ? -1 : -2;
          }
          function a(e) {
            var t = this.lastTotal - this.lastNeed,
              r = (function (e, t, r) {
                if ((192 & t[0]) != 128) return (e.lastNeed = 0), "�";
                if (e.lastNeed > 1 && t.length > 1) {
                  if ((192 & t[1]) != 128) return (e.lastNeed = 1), "�";
                  if (e.lastNeed > 2 && t.length > 2 && (192 & t[2]) != 128) return (e.lastNeed = 2), "�";
                }
              })(this, e, 0);
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
          function f(e, t) {
            var r = (e.length - t) % 3;
            return 0 === r
              ? e.toString("base64", t)
              : ((this.lastNeed = 3 - r),
                (this.lastTotal = 3),
                1 === r ? (this.lastChar[0] = e[e.length - 1]) : ((this.lastChar[0] = e[e.length - 2]), (this.lastChar[1] = e[e.length - 1])),
                e.toString("base64", t, e.length - r));
          }
          function h(e) {
            var t = e && e.length ? this.write(e) : "";
            return this.lastNeed ? t + this.lastChar.toString("base64", 0, 3 - this.lastNeed) : t;
          }
          function c(e) {
            return e.toString(this.encoding);
          }
          function d(e) {
            return e && e.length ? this.write(e) : "";
          }
          (t.StringDecoder = o),
            (o.prototype.write = function (e) {
              var t, r;
              if (0 === e.length) return "";
              if (this.lastNeed) {
                if (void 0 === (t = this.fillLast(e))) return "";
                (r = this.lastNeed), (this.lastNeed = 0);
              } else r = 0;
              return r < e.length ? (t ? t + this.text(e, r) : this.text(e, r)) : t || "";
            }),
            (o.prototype.end = function (e) {
              var t = e && e.length ? this.write(e) : "";
              return this.lastNeed ? t + "�" : t;
            }),
            (o.prototype.text = function (e, t) {
              var r = (function (e, t, r) {
                var n = t.length - 1;
                if (n < r) return 0;
                var i = s(t[n]);
                return i >= 0
                  ? (i > 0 && (e.lastNeed = i - 1), i)
                  : --n < r || -2 === i
                    ? 0
                    : (i = s(t[n])) >= 0
                      ? (i > 0 && (e.lastNeed = i - 2), i)
                      : --n < r || -2 === i
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
            (o.prototype.fillLast = function (e) {
              if (this.lastNeed <= e.length)
                return e.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed), this.lastChar.toString(this.encoding, 0, this.lastTotal);
              e.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, e.length), (this.lastNeed -= e.length);
            });
        },
        5803: function (e, t, r) {
          e.exports = function (e, t) {
            if (n("noDeprecation")) return e;
            var r = !1;
            return function () {
              if (!r) {
                if (n("throwDeprecation")) throw Error(t);
                n("traceDeprecation") ? console.trace(t) : console.warn(t), (r = !0);
              }
              return e.apply(this, arguments);
            };
          };
          function n(e) {
            try {
              if (!r.g.localStorage) return !1;
            } catch (e) {
              return !1;
            }
            var t = r.g.localStorage[e];
            return null != t && "true" === String(t).toLowerCase();
          }
        },
        72565: function (e, t, r) {
          var n, i;
          (e = r.nmd(e)),
            "undefined" != typeof globalThis ? globalThis : "undefined" != typeof self && self,
            (i = function (e) {
              "use strict";
              if (!(globalThis.chrome && globalThis.chrome.runtime && globalThis.chrome.runtime.id))
                throw Error("This script should only be loaded in a browser extension.");
              globalThis.browser && globalThis.browser.runtime && globalThis.browser.runtime.id
                ? (e.exports = globalThis.browser)
                : (e.exports = (e => {
                    let t = {
                      alarms: {
                        clear: { minArgs: 0, maxArgs: 1 },
                        clearAll: { minArgs: 0, maxArgs: 0 },
                        get: { minArgs: 0, maxArgs: 1 },
                        getAll: { minArgs: 0, maxArgs: 0 }
                      },
                      bookmarks: {
                        create: { minArgs: 1, maxArgs: 1 },
                        get: { minArgs: 1, maxArgs: 1 },
                        getChildren: { minArgs: 1, maxArgs: 1 },
                        getRecent: { minArgs: 1, maxArgs: 1 },
                        getSubTree: { minArgs: 1, maxArgs: 1 },
                        getTree: { minArgs: 0, maxArgs: 0 },
                        move: { minArgs: 2, maxArgs: 2 },
                        remove: { minArgs: 1, maxArgs: 1 },
                        removeTree: { minArgs: 1, maxArgs: 1 },
                        search: { minArgs: 1, maxArgs: 1 },
                        update: { minArgs: 2, maxArgs: 2 }
                      },
                      browserAction: {
                        disable: { minArgs: 0, maxArgs: 1, fallbackToNoCallback: !0 },
                        enable: { minArgs: 0, maxArgs: 1, fallbackToNoCallback: !0 },
                        getBadgeBackgroundColor: { minArgs: 1, maxArgs: 1 },
                        getBadgeText: { minArgs: 1, maxArgs: 1 },
                        getPopup: { minArgs: 1, maxArgs: 1 },
                        getTitle: { minArgs: 1, maxArgs: 1 },
                        openPopup: { minArgs: 0, maxArgs: 0 },
                        setBadgeBackgroundColor: { minArgs: 1, maxArgs: 1, fallbackToNoCallback: !0 },
                        setBadgeText: { minArgs: 1, maxArgs: 1, fallbackToNoCallback: !0 },
                        setIcon: { minArgs: 1, maxArgs: 1 },
                        setPopup: { minArgs: 1, maxArgs: 1, fallbackToNoCallback: !0 },
                        setTitle: { minArgs: 1, maxArgs: 1, fallbackToNoCallback: !0 }
                      },
                      browsingData: {
                        remove: { minArgs: 2, maxArgs: 2 },
                        removeCache: { minArgs: 1, maxArgs: 1 },
                        removeCookies: { minArgs: 1, maxArgs: 1 },
                        removeDownloads: { minArgs: 1, maxArgs: 1 },
                        removeFormData: { minArgs: 1, maxArgs: 1 },
                        removeHistory: { minArgs: 1, maxArgs: 1 },
                        removeLocalStorage: { minArgs: 1, maxArgs: 1 },
                        removePasswords: { minArgs: 1, maxArgs: 1 },
                        removePluginData: { minArgs: 1, maxArgs: 1 },
                        settings: { minArgs: 0, maxArgs: 0 }
                      },
                      commands: { getAll: { minArgs: 0, maxArgs: 0 } },
                      contextMenus: { remove: { minArgs: 1, maxArgs: 1 }, removeAll: { minArgs: 0, maxArgs: 0 }, update: { minArgs: 2, maxArgs: 2 } },
                      cookies: {
                        get: { minArgs: 1, maxArgs: 1 },
                        getAll: { minArgs: 1, maxArgs: 1 },
                        getAllCookieStores: { minArgs: 0, maxArgs: 0 },
                        remove: { minArgs: 1, maxArgs: 1 },
                        set: { minArgs: 1, maxArgs: 1 }
                      },
                      devtools: {
                        inspectedWindow: { eval: { minArgs: 1, maxArgs: 2, singleCallbackArg: !1 } },
                        panels: { create: { minArgs: 3, maxArgs: 3, singleCallbackArg: !0 }, elements: { createSidebarPane: { minArgs: 1, maxArgs: 1 } } }
                      },
                      downloads: {
                        cancel: { minArgs: 1, maxArgs: 1 },
                        download: { minArgs: 1, maxArgs: 1 },
                        erase: { minArgs: 1, maxArgs: 1 },
                        getFileIcon: { minArgs: 1, maxArgs: 2 },
                        open: { minArgs: 1, maxArgs: 1, fallbackToNoCallback: !0 },
                        pause: { minArgs: 1, maxArgs: 1 },
                        removeFile: { minArgs: 1, maxArgs: 1 },
                        resume: { minArgs: 1, maxArgs: 1 },
                        search: { minArgs: 1, maxArgs: 1 },
                        show: { minArgs: 1, maxArgs: 1, fallbackToNoCallback: !0 }
                      },
                      extension: { isAllowedFileSchemeAccess: { minArgs: 0, maxArgs: 0 }, isAllowedIncognitoAccess: { minArgs: 0, maxArgs: 0 } },
                      history: {
                        addUrl: { minArgs: 1, maxArgs: 1 },
                        deleteAll: { minArgs: 0, maxArgs: 0 },
                        deleteRange: { minArgs: 1, maxArgs: 1 },
                        deleteUrl: { minArgs: 1, maxArgs: 1 },
                        getVisits: { minArgs: 1, maxArgs: 1 },
                        search: { minArgs: 1, maxArgs: 1 }
                      },
                      i18n: { detectLanguage: { minArgs: 1, maxArgs: 1 }, getAcceptLanguages: { minArgs: 0, maxArgs: 0 } },
                      identity: { launchWebAuthFlow: { minArgs: 1, maxArgs: 1 } },
                      idle: { queryState: { minArgs: 1, maxArgs: 1 } },
                      management: {
                        get: { minArgs: 1, maxArgs: 1 },
                        getAll: { minArgs: 0, maxArgs: 0 },
                        getSelf: { minArgs: 0, maxArgs: 0 },
                        setEnabled: { minArgs: 2, maxArgs: 2 },
                        uninstallSelf: { minArgs: 0, maxArgs: 1 }
                      },
                      notifications: {
                        clear: { minArgs: 1, maxArgs: 1 },
                        create: { minArgs: 1, maxArgs: 2 },
                        getAll: { minArgs: 0, maxArgs: 0 },
                        getPermissionLevel: { minArgs: 0, maxArgs: 0 },
                        update: { minArgs: 2, maxArgs: 2 }
                      },
                      pageAction: {
                        getPopup: { minArgs: 1, maxArgs: 1 },
                        getTitle: { minArgs: 1, maxArgs: 1 },
                        hide: { minArgs: 1, maxArgs: 1, fallbackToNoCallback: !0 },
                        setIcon: { minArgs: 1, maxArgs: 1 },
                        setPopup: { minArgs: 1, maxArgs: 1, fallbackToNoCallback: !0 },
                        setTitle: { minArgs: 1, maxArgs: 1, fallbackToNoCallback: !0 },
                        show: { minArgs: 1, maxArgs: 1, fallbackToNoCallback: !0 }
                      },
                      permissions: {
                        contains: { minArgs: 1, maxArgs: 1 },
                        getAll: { minArgs: 0, maxArgs: 0 },
                        remove: { minArgs: 1, maxArgs: 1 },
                        request: { minArgs: 1, maxArgs: 1 }
                      },
                      runtime: {
                        getBackgroundPage: { minArgs: 0, maxArgs: 0 },
                        getPlatformInfo: { minArgs: 0, maxArgs: 0 },
                        openOptionsPage: { minArgs: 0, maxArgs: 0 },
                        requestUpdateCheck: { minArgs: 0, maxArgs: 0 },
                        sendMessage: { minArgs: 1, maxArgs: 3 },
                        sendNativeMessage: { minArgs: 2, maxArgs: 2 },
                        setUninstallURL: { minArgs: 1, maxArgs: 1 }
                      },
                      sessions: { getDevices: { minArgs: 0, maxArgs: 1 }, getRecentlyClosed: { minArgs: 0, maxArgs: 1 }, restore: { minArgs: 0, maxArgs: 1 } },
                      storage: {
                        local: {
                          clear: { minArgs: 0, maxArgs: 0 },
                          get: { minArgs: 0, maxArgs: 1 },
                          getBytesInUse: { minArgs: 0, maxArgs: 1 },
                          remove: { minArgs: 1, maxArgs: 1 },
                          set: { minArgs: 1, maxArgs: 1 }
                        },
                        managed: { get: { minArgs: 0, maxArgs: 1 }, getBytesInUse: { minArgs: 0, maxArgs: 1 } },
                        sync: {
                          clear: { minArgs: 0, maxArgs: 0 },
                          get: { minArgs: 0, maxArgs: 1 },
                          getBytesInUse: { minArgs: 0, maxArgs: 1 },
                          remove: { minArgs: 1, maxArgs: 1 },
                          set: { minArgs: 1, maxArgs: 1 }
                        }
                      },
                      tabs: {
                        captureVisibleTab: { minArgs: 0, maxArgs: 2 },
                        create: { minArgs: 1, maxArgs: 1 },
                        detectLanguage: { minArgs: 0, maxArgs: 1 },
                        discard: { minArgs: 0, maxArgs: 1 },
                        duplicate: { minArgs: 1, maxArgs: 1 },
                        executeScript: { minArgs: 1, maxArgs: 2 },
                        get: { minArgs: 1, maxArgs: 1 },
                        getCurrent: { minArgs: 0, maxArgs: 0 },
                        getZoom: { minArgs: 0, maxArgs: 1 },
                        getZoomSettings: { minArgs: 0, maxArgs: 1 },
                        goBack: { minArgs: 0, maxArgs: 1 },
                        goForward: { minArgs: 0, maxArgs: 1 },
                        highlight: { minArgs: 1, maxArgs: 1 },
                        insertCSS: { minArgs: 1, maxArgs: 2 },
                        move: { minArgs: 2, maxArgs: 2 },
                        query: { minArgs: 1, maxArgs: 1 },
                        reload: { minArgs: 0, maxArgs: 2 },
                        remove: { minArgs: 1, maxArgs: 1 },
                        removeCSS: { minArgs: 1, maxArgs: 2 },
                        sendMessage: { minArgs: 2, maxArgs: 3 },
                        setZoom: { minArgs: 1, maxArgs: 2 },
                        setZoomSettings: { minArgs: 1, maxArgs: 2 },
                        update: { minArgs: 1, maxArgs: 2 }
                      },
                      topSites: { get: { minArgs: 0, maxArgs: 0 } },
                      webNavigation: { getAllFrames: { minArgs: 1, maxArgs: 1 }, getFrame: { minArgs: 1, maxArgs: 1 } },
                      webRequest: { handlerBehaviorChanged: { minArgs: 0, maxArgs: 0 } },
                      windows: {
                        create: { minArgs: 0, maxArgs: 1 },
                        get: { minArgs: 1, maxArgs: 2 },
                        getAll: { minArgs: 0, maxArgs: 1 },
                        getCurrent: { minArgs: 0, maxArgs: 1 },
                        getLastFocused: { minArgs: 0, maxArgs: 1 },
                        remove: { minArgs: 1, maxArgs: 1 },
                        update: { minArgs: 2, maxArgs: 2 }
                      }
                    };
                    if (0 === Object.keys(t).length) throw Error("api-metadata.json has not been included in browser-polyfill");
                    class r extends WeakMap {
                      constructor(e, t) {
                        super(t), (this.createItem = e);
                      }
                      get(e) {
                        return this.has(e) || this.set(e, this.createItem(e)), super.get(e);
                      }
                    }
                    let n = e => e && "object" == typeof e && "function" == typeof e.then,
                      i =
                        (t, r) =>
                        (...n) => {
                          e.runtime.lastError
                            ? t.reject(Error(e.runtime.lastError.message))
                            : r.singleCallbackArg || (n.length <= 1 && !1 !== r.singleCallbackArg)
                              ? t.resolve(n[0])
                              : t.resolve(n);
                        },
                      o = e => (1 == e ? "argument" : "arguments"),
                      s = (e, t) =>
                        function (r, ...n) {
                          if (n.length < t.minArgs) throw Error(`Expected at least ${t.minArgs} ${o(t.minArgs)} for ${e}(), got ${n.length}`);
                          if (n.length > t.maxArgs) throw Error(`Expected at most ${t.maxArgs} ${o(t.maxArgs)} for ${e}(), got ${n.length}`);
                          return new Promise((o, s) => {
                            if (t.fallbackToNoCallback)
                              try {
                                r[e](...n, i({ resolve: o, reject: s }, t));
                              } catch (i) {
                                console.warn(`${e} API method doesn't seem to support the callback parameter, falling back to call it without a callback: `, i),
                                  r[e](...n),
                                  (t.fallbackToNoCallback = !1),
                                  (t.noCallback = !0),
                                  o();
                              }
                            else t.noCallback ? (r[e](...n), o()) : r[e](...n, i({ resolve: o, reject: s }, t));
                          });
                        },
                      a = (e, t, r) => new Proxy(t, { apply: (t, n, i) => r.call(n, e, ...i) }),
                      l = Function.call.bind(Object.prototype.hasOwnProperty),
                      u = (e, t = {}, r = {}) => {
                        let n = Object.create(null);
                        return new Proxy(Object.create(e), {
                          has: (t, r) => r in e || r in n,
                          get(i, o, f) {
                            if (o in n) return n[o];
                            if (!(o in e)) return;
                            let h = e[o];
                            if ("function" == typeof h) {
                              if ("function" == typeof t[o]) h = a(e, e[o], t[o]);
                              else if (l(r, o)) {
                                let t = s(o, r[o]);
                                h = a(e, e[o], t);
                              } else h = h.bind(e);
                            } else if ("object" == typeof h && null !== h && (l(t, o) || l(r, o))) h = u(h, t[o], r[o]);
                            else {
                              if (!l(r, "*"))
                                return (
                                  Object.defineProperty(n, o, {
                                    configurable: !0,
                                    enumerable: !0,
                                    get: () => e[o],
                                    set(t) {
                                      e[o] = t;
                                    }
                                  }),
                                  h
                                );
                              h = u(h, t[o], r["*"]);
                            }
                            return (n[o] = h), h;
                          },
                          set: (t, r, i, o) => (r in n ? (n[r] = i) : (e[r] = i), !0),
                          defineProperty: (e, t, r) => Reflect.defineProperty(n, t, r),
                          deleteProperty: (e, t) => Reflect.deleteProperty(n, t)
                        });
                      },
                      f = e => ({
                        addListener(t, r, ...n) {
                          t.addListener(e.get(r), ...n);
                        },
                        hasListener: (t, r) => t.hasListener(e.get(r)),
                        removeListener(t, r) {
                          t.removeListener(e.get(r));
                        }
                      }),
                      h = new r(e =>
                        "function" != typeof e
                          ? e
                          : function (t) {
                              e(u(t, {}, { getContent: { minArgs: 0, maxArgs: 0 } }));
                            }
                      ),
                      c = new r(e =>
                        "function" != typeof e
                          ? e
                          : function (t, r, i) {
                              let o,
                                s,
                                a = !1,
                                l = new Promise(e => {
                                  o = function (t) {
                                    (a = !0), e(t);
                                  };
                                });
                              try {
                                s = e(t, r, o);
                              } catch (e) {
                                s = Promise.reject(e);
                              }
                              let u = !0 !== s && n(s);
                              return (
                                (!0 === s || !!u || !!a) &&
                                ((e => {
                                  e.then(
                                    e => {
                                      i(e);
                                    },
                                    e => {
                                      let t;
                                      i({
                                        __mozWebExtensionPolyfillReject__: !0,
                                        message: e && (e instanceof Error || "string" == typeof e.message) ? e.message : "An unexpected error occurred"
                                      });
                                    }
                                  ).catch(e => {
                                    console.error("Failed to send onMessage rejected reply", e);
                                  });
                                })(u ? s : l),
                                !0)
                              );
                            }
                      ),
                      d = ({ reject: t, resolve: r }, n) => {
                        e.runtime.lastError
                          ? "The message port closed before a response was received." === e.runtime.lastError.message
                            ? r()
                            : t(Error(e.runtime.lastError.message))
                          : n && n.__mozWebExtensionPolyfillReject__
                            ? t(Error(n.message))
                            : r(n);
                      },
                      g = (e, t, r, ...n) => {
                        if (n.length < t.minArgs) throw Error(`Expected at least ${t.minArgs} ${o(t.minArgs)} for ${e}(), got ${n.length}`);
                        if (n.length > t.maxArgs) throw Error(`Expected at most ${t.maxArgs} ${o(t.maxArgs)} for ${e}(), got ${n.length}`);
                        return new Promise((e, t) => {
                          let i = d.bind(null, { resolve: e, reject: t });
                          n.push(i), r.sendMessage(...n);
                        });
                      },
                      p = {
                        devtools: { network: { onRequestFinished: f(h) } },
                        runtime: { onMessage: f(c), onMessageExternal: f(c), sendMessage: g.bind(null, "sendMessage", { minArgs: 1, maxArgs: 3 }) },
                        tabs: { sendMessage: g.bind(null, "sendMessage", { minArgs: 2, maxArgs: 3 }) }
                      },
                      m = { clear: { minArgs: 1, maxArgs: 1 }, get: { minArgs: 1, maxArgs: 1 }, set: { minArgs: 1, maxArgs: 1 } };
                    return (t.privacy = { network: { "*": m }, services: { "*": m }, websites: { "*": m } }), u(e, p, t);
                  })(chrome));
            }),
            "function" == typeof define && define.amd ? define("webextension-polyfill", ["module"], i) : i(e);
        },
        56052: function () {},
        79549: function () {},
        84713: function () {}
      },
      t = {};
    function r(n) {
      var i = t[n];
      if (void 0 !== i) return i.exports;
      var o = (t[n] = { id: n, loaded: !1, exports: {} });
      return e[n].call(o.exports, o, o.exports, r), (o.loaded = !0), o.exports;
    }
    (r.n = e => {
      var t = e && e.__esModule ? () => e.default : () => e;
      return r.d(t, { a: t }), t;
    }),
      (r.d = (e, t) => {
        for (var n in t) r.o(t, n) && !r.o(e, n) && Object.defineProperty(e, n, { enumerable: !0, get: t[n] });
      }),
      (() => {
        r.g = (() => {
          if ("object" == typeof globalThis) return globalThis;
          try {
            return this || Function("return this")();
          } catch (e) {
            if ("object" == typeof window) return window;
          }
        })();
      })(),
      (r.o = (e, t) => Object.prototype.hasOwnProperty.call(e, t)),
      (r.nmd = e => ((e.paths = []), e.children || (e.children = []), e)),
      (r.rv = () => "1.2.8"),
      (r.ruid = "bundler=rspack@1.2.8"),
      (() => {
        "use strict";
        let e, t, n;
        var i = r(55968),
          o = r(83274),
          s = r.n(o);
        let a = (e, t, r) => {};
        var l = r(72565),
          u = r.n(l);
        function f() {
          (e = u().runtime.connect({ name: "LeapCosmosExtension" })), (t = new (s())(e)), n.pipe(t), t.pipe(n);
        }
        function h() {
          e.onDisconnect.removeListener(h), t.destroy(), f(), e.onDisconnect.addListener(h);
        }
        async function c() {
          await void ((function () {
            let e = "leap";
            n = new i.WindowPostMessageStream({ name: `${e}:content`, target: `${e}:inpage` });
          })(),
          f(),
          e.onDisconnect.addListener(h)),
            await (["interactive", "complete"].includes(document.readyState)
              ? Promise.resolve()
              : new Promise(e => window.addEventListener("DOMContentLoaded", e, { once: !0 })));
        }
        u().runtime.onMessage.addListener((e, t) => {
          if (t.id === u().runtime.id) {
            if ((null == e ? void 0 : e.event) === "leap_keystorechange") {
              let e = new CustomEvent("leap_keystorechange", { detail: {} });
              window.dispatchEvent(e);
            }
            if ((null == e ? void 0 : e.event) === "chainChanged") {
              let t = new CustomEvent("chainChanged", { detail: { data: null == e ? void 0 : e.data } });
              window.dispatchEvent(t);
            }
            if ((null == e ? void 0 : e.event) === "accountsChanged") {
              let t = new CustomEvent("accountsChanged", { detail: { data: null == e ? void 0 : e.data } });
              window.dispatchEvent(t);
            }
            if ((null == e ? void 0 : e.event) === "disconnect") {
              let t = new CustomEvent("disconnect", { detail: { data: null == e ? void 0 : e.data } });
              window.dispatchEvent(t);
            }
            if ((null == e ? void 0 : e.event) === "solanaAccountsChanged") {
              let t = new CustomEvent("solanaAccountsChanged", { detail: { data: null == e ? void 0 : e.data } });
              window.dispatchEvent(t);
            }
            if ((null == e ? void 0 : e.event) === "suiAccountsChanged") {
              let t = new CustomEvent("suiAccountsChanged", { detail: { data: null == e ? void 0 : e.data } });
              window.dispatchEvent(t);
            }
            if ((null == e ? void 0 : e.event) === "disconnectFromOrigin" && (null == e ? void 0 : e.data) && window.location.origin.startsWith(e.data)) {
              let t = new CustomEvent("disconnect", { detail: { data: e.data } });
              window.dispatchEvent(t);
            }
            if ((null == e ? void 0 : e.event) === "leap_activeChainInfoChanged") {
              let t = new CustomEvent("leap_activeChainInfoChanged", { detail: { data: null == e ? void 0 : e.data } });
              window.dispatchEvent(t);
            }
          }
        }),
          (function () {
            let { doctype: e } = window.document;
            return !e || "html" === e.name;
          })() &&
            (function () {
              let e = [/\.xml$/, /\.pdf$/, /\.asp$/, /\.jsp$/, /\.php$/, /\.md$/, /\.svg$/, /\.docx$/, /\.odt$/, /\.eml$/],
                t = window.location.pathname;
              for (let r = 0; r < e.length; r += 1) if (e[r].test(t)) return !1;
              return !0;
            })() &&
            (function () {
              let e = document.documentElement.nodeName;
              return !e || "html" === e.toLowerCase();
            })() &&
            ((function () {
              try {
                let e = document.head || document.documentElement,
                  t = document.createElement("script");
                t.setAttribute("src", chrome.runtime.getURL("injectLeap.js")), e.insertBefore(t, e.children[0]), e.removeChild(t);
              } catch (e) {
                a("MsgDemo provider injection failed.", e);
              }
            })(),
            c(),
            (function () {
              let e = setInterval(async () => {
                try {
                  await u().runtime.sendMessage({ name: "WORKER_RESET_MESSAGE" });
                } catch (t) {
                  "Extension context invalidated." === t.message && clearInterval(e);
                }
              }, 1e3);
            })());
      })();
  })();
//# sourceMappingURL=contentScripts.js.map
